// ====== CAPACITY CALCULATION ======
let dcLoads=[];
let segLoads={};

// ====== DIRTY FLAG CACHE ======
// calcCapacity() is expensive (O(buildings × cables × tariffs)) and was called
// every frame (~60/s). Now it only runs when topology/tariffs actually change.
let _capDirty=true;          // set to true by any mutation that would affect capacity
let _capLastRecalc=0;         // timestamp of last full recalc (for fallback forcing)
function markCapDirty(){_capDirty=true;}
function calcCapacityIfDirty(){
  // Safety fallback: even if flag was missed, force recalc every 2s of real time
  const now=Date.now();
  if(!_capDirty&&now-_capLastRecalc<2000)return;
  _capLastRecalc=now;
  _capDirty=false;
  calcCapacity();
}

function getCloudBWForDC(dcIdx){
  // Calculate bandwidth used by cloud instances in this DC
  let bw=0;
  for(const ci of(G.cloudInstances||[])){
    if(ci.dcIdx!==dcIdx)continue;
    const cp=CLOUD_PRICING[ci.type];if(!cp)continue;
    bw+=(cp.bwMbps||0)*ci.count;
  }
  // Scale by cloud customer utilization
  let totalCloudCust=0;
  if(G.cloudCustomers){for(const seg in G.cloudCustomers)totalCloudCust+=G.cloudCustomers[seg].count||0;}
  const totalInstances=Math.max(1,(G.cloudInstances||[]).filter(ci=>ci.dcIdx===dcIdx).length*3);
  const utilFactor=Math.min(1,totalCloudCust/totalInstances);
  return Math.round(bw*Math.max(0.15,utilFactor));
}

function calcBldBW(b){
  if(!b||!b.connected)return 0;
  const bt=BTYPES[b.type];
  let bw=0;
  if(b.tariffDist){
    for(const ti in b.tariffDist){
      const t=G.tariffs[ti];if(!t)continue;
      bw+=t.speed*b.tariffDist[ti]*bt.bwRatio/(t.share||1);
    }
  } else if(b.tariff!==null){
    const t=G.tariffs[b.tariff];if(!t)return 0;
    bw=t.speed*b.customers*bt.bwRatio/(t.share||1);
  }
  // Service BW: use actual subscribers, not flat adopt
  if(b.svcSubs){
    for(const sid in b.svcSubs){
      const svc=SERVICES.find(s=>s.id===sid);
      if(svc)bw+=svc.extraBW*(b.svcSubs[sid]||0);
    }
  }
  // Business tenants — extra BW from specialized businesses in the building
  if(b.bizTenants){
    for(const tid of b.bizTenants){
      const bt2=BIZ_TENANTS.find(t=>t.id===tid);
      if(bt2)bw+=bt2.bwMbps;
    }
  }
  // Year-over-year usage growth: +5% per year after 2010 (streaming, cloud, WFH)
  if(G&&G.date){
    const yearsAfter=Math.max(0,G.date.y-2010);
    bw*=(1+yearsAfter*0.05);
  }
  return bw;
}

// Get available tariffs for a building based on connection and DC
function getAvailTariffs(connMax,dcIdx,connType){
  const avail=[];
  const isWireless=connType&&(connType.startsWith('conn_lte')||connType.startsWith('conn_5g'));
  const isFixed=!isWireless;
  for(let ti=0;ti<G.tariffs.length;ti++){
    const t=G.tariffs[ti];
    if(!t.active||t.minTech>G.tech||t.speed>connMax)continue;
    if(!networkHasEq(dcIdx,t.reqEq))continue;
    // Filter by connection category
    const tCat=t.cat||'fixed';
    if(tCat==='mobile'&&!isWireless)continue;  // mobile tariffs only for wireless
    if(tCat==='fwa'&&!isWireless)continue;      // FWA only for wireless
    if((tCat==='fixed')&&isWireless)continue;    // fixed tariffs not for wireless
    avail.push(ti);
  }
  return avail;
}

// Pick a tariff for a new customer based on building type sensitivity
function pickTariffForCustomer(b,connMax,dcIdx){
  const bt=BTYPES[b.type];
  const avail=getAvailTariffs(connMax,dcIdx,b.connType);
  if(!avail.length)return null;
  // Weight: price-sensitive strongly avoid expensive, quality-sensitive prefer fast
  const weights=avail.map(ti=>{
    const t=G.tariffs[ti],rp=refPrice(t.speed,t.share);
    const priceRatio=t.price/rp;
    // Steep price curve: at 1.5x ref, priceScore → ~0.05; at 2x ref → ~0
    let priceScore;
    if(priceRatio<=0.8)priceScore=2.0;        // bargain
    else if(priceRatio<=1.0)priceScore=1.5;    // fair
    else if(priceRatio<=1.15)priceScore=1.0;   // acceptable
    else if(priceRatio<=1.3)priceScore=0.4;    // expensive — few takers
    else if(priceRatio<=1.6)priceScore=0.08;   // very expensive — almost nobody
    else priceScore=0.01;                       // absurd — essentially zero
    const qualScore=0.3+Math.log2(1+t.speed)*0.15;
    const w=priceScore*bt.priceSens+qualScore*bt.qualSens;
    return Math.max(0.005,w); // tiny floor so it's technically possible
  });
  // If ALL weights are very low (everything overpriced), high chance of NO signup
  const total=weights.reduce((s,w)=>s+w,0);
  if(total<0.15&&Math.random()<.7)return null; // customer walks away entirely
  let r=Math.random()*total;
  for(let i=0;i<avail.length;i++){r-=weights[i];if(r<=0)return avail[i];}
  return avail[avail.length-1];
}

// Add customer to tariff distribution
function addToTariffDist(b,ti,count){
  if(!b.tariffDist)b.tariffDist={};
  b.tariffDist[ti]=(b.tariffDist[ti]||0)+count;
  syncTariffDist(b);
}

// Remove customer from tariff distribution (from a specific or random tariff)
function removeFromTariffDist(b,count,fromTi){
  if(!b.tariffDist)return;
  if(fromTi!==undefined&&b.tariffDist[fromTi]){
    const rm=Math.min(count,b.tariffDist[fromTi]);
    b.tariffDist[fromTi]-=rm;
    if(b.tariffDist[fromTi]<=0)delete b.tariffDist[fromTi];
  } else {
    // Remove from random tariff (weighted towards cheapest for churn)
    let remaining=count;
    const tis=Object.keys(b.tariffDist).map(Number).sort((a,b2)=>a-b2);
    while(remaining>0&&tis.length){
      const ti=tis[Math.floor(Math.random()*tis.length)];
      const rm=Math.min(remaining,b.tariffDist[ti]);
      b.tariffDist[ti]-=rm;remaining-=rm;
      if(b.tariffDist[ti]<=0){delete b.tariffDist[ti];tis.splice(tis.indexOf(ti),1);}
    }
  }
  syncTariffDist(b);
}

// Sync b.customers and b.tariff from tariffDist
function syncTariffDist(b){
  if(!b.tariffDist){return;}
  let total=0,maxTi=null;
  for(const ti in b.tariffDist){
    total+=b.tariffDist[ti];
    if(maxTi===null||Number(ti)>Number(maxTi))maxTi=Number(ti);
  }
  b.customers=total;
  b.tariff=total>0?maxTi:null;
}

// Get revenue from a building (sum of tariff prices × customer counts)
// Tariff prices are nominal — reálně se aplikuje G.tariffInflation (valorizační doložka).
function calcBldRevenue(b){
  if(!b||!b.connected)return 0;
  let rev=0;
  if(b.tariffDist){
    for(const ti in b.tariffDist){
      const t=G.tariffs[ti];if(!t)continue;
      rev+=t.price*b.tariffDist[ti];
    }
  } else if(b.tariff!==null&&G.tariffs[b.tariff]){
    rev=G.tariffs[b.tariff].price*b.customers;
  }
  const tInfl=(G&&G.tariffInflation)||1;
  // v0.3.0: segment ARPU multiplier (SMB/Enterprise/Gov platí víc za stejný tarif)
  const segMult=(typeof segmentArpuMult==='function')?segmentArpuMult(b.type):1.0;
  // v0.3.0: ČTÚ cenová regulace (-15 % na residential po dobu 36 měs)
  const ctuMult=(typeof ctuPricingMultiplier==='function')?ctuPricingMultiplier(b.type):1.0;
  return rev*tInfl*segMult*ctuMult;
}

// Check if a DC or connected DCs have equipment
function networkHasEq(dcIdx,reqEq){
  if(!reqEq||!reqEq.length)return true;
  const visited=new Set();
  const queue=[dcIdx];
  visited.add(dcIdx);
  while(queue.length){
    const di=queue.shift();
    const dc=G.dcs[di];
    if(dcHasEq(dc,reqEq))return true;
    for(const link of G.dcLinks){
      let other=-1;
      if(link.dc1===di)other=link.dc2;
      else if(link.dc2===di)other=link.dc1;
      if(other>=0&&!visited.has(other)){
        visited.add(other);
        queue.push(other);
      }
    }
  }
  return false;
}

// Get least loaded reachable DC (check tile itself + adjacent road tiles)
function findDC(bx,by){
  // Collect candidate start tiles for BFS (tile itself if road/DC, plus adjacent roads)
  const starts=[];
  if(isRoad(bx,by)||G.dcs.some(d=>d.x===bx&&d.y===by))starts.push([bx,by]);
  for(const[ax,ay]of nb(bx,by)){
    if(ax<0||ax>=MAP||ay<0||ay>=MAP||G.map[ay][ax].type!=='road')continue;
    starts.push([ax,ay]);
  }
  let best=-1,bestLoad=Infinity;
  for(let di=0;di<G.dcs.length;di++){
    const dc=G.dcs[di];
    let reachable=false;
    for(const[sx,sy]of starts){
      if(bfs(sx,sy,dc.x,dc.y)){reachable=true;break;}
    }
    if(!reachable)continue;
    const dl=dcLoads[di]||{ratio:0};
    if(dl.ratio<bestLoad){best=di;bestLoad=dl.ratio;}
  }
  return best;
}

// Equipment families: requiring 'eq_firewall' accepts any firewall tier
const EQ_FAMILIES={
  eq_firewall:['eq_firewall','eq_firewall_pro','eq_firewall_ent'],
  eq_router:['eq_router','eq_router_mid','eq_router_big','eq_router_edge'],
};
function eqSatisfied(eqList,req){
  if(eqList.includes(req))return true;
  const fam=EQ_FAMILIES[req];
  if(fam)return fam.some(e=>eqList.includes(e));
  return false;
}
function dcHasEq(dc,r){if(!r||!r.length)return true;const eq=dc.eq||[];for(const e of r)if(!eqSatisfied(eq,e))return false;return true;}
function getMissingEq(dc,r){if(!r||!r.length)return[];const eq=dc.eq||[];return r.filter(e=>!eqSatisfied(eq,e)).map(e=>EQ[e]?EQ[e].name:e);}
function anyDCHasEq(r){for(const dc of G.dcs)if(dcHasEq(dc,r))return true;return false;}

function dcHasRouter(dc){return(dc.eq||[]).some(e=>{const eq=EQ[e];return eq&&eq.connCap>0;});}

// True if a DC has at least one active load balancer → enables weighted-by-free-capacity routing
function dcHasLoadBalancer(dc){return(dc.eq||[]).some(e=>e==='eq_loadbalancer');}

// True if a given path (array of [x,y]) passes through at least one active junction_lb on the map
function pathHasActiveJunction(path){
  if(!path||!G.junctions||!G.junctions.length)return false;
  for(const j of G.junctions){
    if(j.type!=='junction_lb'||!j.active)continue;
    for(const[x,y]of path)if(x===j.x&&y===j.y)return true;
  }
  return false;
}

// share=1 garantovaný, share=N sdílený 1:N (N lidí sdílí kapacitu → levnější)
function refPrice(speed,share){
  const s=share||1;
  const base=200+speed*0.8+Math.sqrt(speed)*15;
  // sdílený: cenová hladina klesá s rostoucím share (share=10 → ~46% ceny garantovaného)
  const shareMult=s<=1?1:(0.4+0.6/s);
  return Math.round(base*shareMult);
}

// DC network capacity: how many connections can this DC handle
function getDCNetCapacity(dcIdx){
  const dc=G.dcs[dcIdx];if(!dc)return{maxConns:0,usedConns:0,totalPorts:0,usedPorts:0,routerCap:0,routerCount:0};
  const eqs=dc.eq||[];

  // Router capacity: each router type has its own connCap
  let routerCap=0,routerCount=0;
  for(const e of eqs){const eq=EQ[e];if(eq&&eq.connCap){routerCount++;routerCap+=eq.connCap;}}

  // Switch ports: each switch provides ports, base DC provides 4 ports (built-in)
  let totalPorts=4; // built-in ports
  for(const e of eqs){
    const eq=EQ[e];if(!eq)continue;
    if(eq.eff==='ports')totalPorts+=eq.val;
  }

  // Each connection uses 1 port, each BW upgrade uses 1 port (uplink)
  const usedConns=G.conns.filter(c=>c.di===dcIdx).length;
  const bwUplinks=(dc.bwUpgrades||[]).length;
  // Towers connected to this DC also use 1 port each
  const towerPorts=(G.towers||[]).filter(t=>t.dcIdx===dcIdx).length;
  const usedPorts=usedConns+bwUplinks+towerPorts;

  // Max connections = min(router capacity, available ports)
  const maxConns=Math.min(routerCap,totalPorts);

  return{maxConns,usedConns,totalPorts,usedPorts,routerCap,routerCount,bwUplinks,towerPorts};
}

function calcCapacity(){
  dcLoads=G.dcs.map((dc,di)=>{
    let usedBW=0;const dt=DC_T[dc.type];
    let maxBW=dt.baseBW;for(const bwu of(dc.bwUpgrades||[]))maxBW+=bwu.bw;
    if(G.hasIXP)maxBW+=IXP.bwBonus;
    // v0.3.0: transit carrier poskytuje dodatečný BW poolovaný rovnoměrně do všech DC
    if(typeof transitBwBonusPerDC==='function')maxBW+=transitBwBonusPerDC();
    for(const cn of G.conns){
      if(cn.di!==di)continue;
      const b=G.map[cn.by]?.[cn.bx]?.bld;
      usedBW+=calcBldBW(b);
    }
    // Add cloud bandwidth usage for this DC
    const cloudBW=getCloudBWForDC(di);
    usedBW+=cloudBW;
    return{usedBW:Math.round(usedBW),maxBW,ratio:maxBW>0?usedBW/maxBW:0,cloudBW,sharedIn:0,sharedOut:0};
  });

  // Cable segment loads (needed before buildDCLinks)
  segLoads={};
  const cutKeys=new Set((G.cableCuts||[]).map(c=>c.segKey));
  for(const cb of G.cables){
    const key=segKey(cb.x1,cb.y1,cb.x2,cb.y2);
    if(!segLoads[key])segLoads[key]={used:0,max:0,ratio:0,types:[],cut:false};
    const ct=CAB_T[cb.t];
    // Přerušený segment má kapacitu 0 — data musí téct jinudy
    if(!cutKeys.has(key))segLoads[key].max+=ct.maxBW;
    else segLoads[key].cut=true;
    if(!segLoads[key].types.includes(cb.t))segLoads[key].types.push(cb.t);
  }

  // Build DC links (physical cable paths) and recalc BGP peering maxBW
  buildDCLinks();
  if(typeof recalcBGPMaxBW==='function')recalcBGPMaxBW();

  // BGP bandwidth sharing via manual peerings
  const bgpSegTraffic=[]; // collect [{paths,amount}] to load segments after
  for(let pi=0;pi<(G.bgpPeerings||[]).length;pi++){
    const peer=G.bgpPeerings[pi];
    if(!peer.active||peer.allocBW<=0)continue;
    const dc1=G.dcs[peer.dc1],dc2=G.dcs[peer.dc2];
    if(!dc1||!dc2)continue;
    // Find the dcLink for paths
    const link=(G.dcLinks||[]).find(l=>
      (l.dc1===peer.dc1&&l.dc2===peer.dc2)||(l.dc1===peer.dc2&&l.dc2===peer.dc1));
    if(!link||!link.paths||!link.paths.length)continue;
    const l1=dcLoads[peer.dc1],l2=dcLoads[peer.dc2];
    if(!l1||!l2)continue;
    const alloc=Math.min(peer.allocBW,peer.maxBW);
    let shared=0;
    // Direction: share from DC with surplus to DC with deficit
    const free1=l1.maxBW-l1.usedBW-l1.sharedOut;
    const free2=l2.maxBW-l2.usedBW-l2.sharedOut;
    if(l2.ratio>l1.ratio&&free1>0){
      // DC1 helps DC2
      const canShare=Math.min(alloc,free1);
      if(canShare>0){l2.maxBW+=canShare;l2.sharedIn+=canShare;l1.sharedOut+=canShare;shared=canShare;}
    } else if(l1.ratio>l2.ratio&&free2>0){
      // DC2 helps DC1
      const canShare=Math.min(alloc,free2);
      if(canShare>0){l1.maxBW+=canShare;l1.sharedIn+=canShare;l2.sharedOut+=canShare;shared=canShare;}
    } else if(free1>0&&free2>0){
      // Balanced — small equalization
      const halfAlloc=Math.round(alloc*.15);
      if(l1.ratio<l2.ratio){
        const s=Math.min(halfAlloc,free1);
        if(s>0){l2.maxBW+=s;l2.sharedIn+=s;l1.sharedOut+=s;shared=s;}
      } else {
        const s=Math.min(halfAlloc,free2);
        if(s>0){l1.maxBW+=s;l1.sharedIn+=s;l2.sharedOut+=s;shared=s;}
      }
    }
    // Store actual traffic for segment loading
    peer._actualTraffic=shared;
    if(shared>0){
      bgpSegTraffic.push({paths:link.paths,amount:shared});
    }
  }
  // Load BGP traffic onto cable segments — multi-path proportional
  for(const bt of bgpSegTraffic){
    const totalCap=bt.paths.reduce((s,p)=>s+p.cap,0);
    if(totalCap<=0)continue;
    for(const p of bt.paths){
      const share=bt.amount*(p.cap/totalCap);
      for(let i=0;i<p.path.length-1;i++){
        const key=segKey(p.path[i][0],p.path[i][1],p.path[i+1][0],p.path[i+1][1]);
        if(segLoads[key])segLoads[key].used+=share;
      }
    }
  }
  // Recalculate ratios after sharing
  for(const l of dcLoads){l.ratio=l.maxBW>0?l.usedBW/l.maxBW:0;}

  // ====== PER-CONNECTION LOAD DISTRIBUTION ======
  // Two modes:
  //   (a) STATIC (default): share = bw × (pathMinCap / totalPathMinCap)
  //       — classic ECMP-style, proportional to cable capacity.
  //   (b) ACTIVE (when DC has eq_loadbalancer OR path passes through junction_lb):
  //       — weights by current free capacity of the bottleneck segment, so when
  //         one path starts filling up, traffic shifts to a parallel route.
  //         This is what real load balancers do. Reduces need for stacking.
  //   Stacking (LAG) is still respected as a fallback because segLoads[].max
  //   is already the sum over all cables on that segment.
  for(const cn of G.conns){
    const b=G.map[cn.by]?.[cn.bx]?.bld;
    const bw=calcBldBW(b);if(bw<=0)continue;
    const dc=G.dcs[cn.di];if(!dc)continue;
    // Find ALL paths from adjacent roads to DC for load balancing
    const paths=[];
    const adj=nb(cn.bx,cn.by);
    for(const[ax,ay]of adj){
      if(ax<0||ax>=MAP||ay<0||ay>=MAP||G.map[ay][ax].type!=='road')continue;
      const path=bfsPath(ax,ay,dc.x,dc.y);
      if(!path)continue;
      // Gather bottleneck max cap + current bottleneck free cap
      let minCap=Infinity,minFree=Infinity;
      for(let i=0;i<path.length-1;i++){
        const key=segKey(path[i][0],path[i][1],path[i+1][0],path[i+1][1]);
        const s=segLoads[key];
        if(!s){minCap=0;minFree=0;break;}
        minCap=Math.min(minCap,s.max);
        minFree=Math.min(minFree,Math.max(0,s.max-s.used));
      }
      if(minCap>0)paths.push({path,cap:minCap,free:minFree,hasJunctionLB:pathHasActiveJunction(path)});
    }
    if(!paths.length)continue;

    const activeByDC=dcHasLoadBalancer(dc);
    const activeByJunction=paths.some(p=>p.hasJunctionLB);
    const active=activeByDC||activeByJunction;

    if(active){
      // ACTIVE WEIGHTING — prefer paths with the most free bandwidth RIGHT NOW.
      // Use (free + cap×0.02) so even saturated routes still get a tiny drip
      // (matches reality: LB degrades smoothly, doesn't cliff-fail).
      // If all paths are saturated, fall back to proportional-to-cap.
      const weights=paths.map(p=>Math.max(0.01*p.cap,p.free+p.cap*0.02));
      const totalW=weights.reduce((s,w)=>s+w,0);
      if(totalW>0){
        for(let pi=0;pi<paths.length;pi++){
          const p=paths[pi];
          const share=bw*(weights[pi]/totalW);
          for(let i=0;i<p.path.length-1;i++){
            const key=segKey(p.path[i][0],p.path[i][1],p.path[i+1][0],p.path[i+1][1]);
            if(segLoads[key])segLoads[key].used+=share;
          }
        }
      }
    } else {
      // STATIC — proportional to static max capacity (the original behavior)
      const totalCap=paths.reduce((s,p)=>s+p.cap,0);
      for(const p of paths){
        const share=bw*(p.cap/totalCap);
        for(let i=0;i<p.path.length-1;i++){
          const key=segKey(p.path[i][0],p.path[i][1],p.path[i+1][0],p.path[i+1][1]);
          if(segLoads[key])segLoads[key].used+=share;
        }
      }
    }
  }

  for(const k in segLoads){const s=segLoads[k];s.used=Math.round(s.used);s.ratio=s.max>0?s.used/s.max:0;}
}

function buildDCLinks(){
  G.dcLinks=[];
  for(let i=0;i<G.dcs.length;i++){
    for(let j=i+1;j<G.dcs.length;j++){
      const dc1=G.dcs[i],dc2=G.dcs[j];
      // Find ALL paths between DCs for multi-path load balancing
      const paths=findAllDCPaths(dc1.x,dc1.y,dc2.x,dc2.y);
      if(!paths.length)continue;
      // Total capacity = sum of all path bottlenecks
      let totalCap=0;
      for(const p of paths)totalCap+=p.cap;
      if(totalCap>0){
        G.dcLinks.push({dc1:i,dc2:j,capacity:totalCap,paths});
      }
    }
  }
}

// Find multiple paths between two DCs via BFS (up to 4 diverse paths).
// Uses cable-aware BFS — only steps through segments that actually have a cable.
function findAllDCPaths(x1,y1,x2,y2){
  const results=[];
  const usedSegs=new Set();
  for(let attempt=0;attempt<4;attempt++){
    const path=bfsCablePath(x1,y1,x2,y2,usedSegs);
    if(!path)break;
    // Bottleneck = min segment capacity along path (all segments here have a cable by construction)
    let minCap=Infinity;
    for(let pi=0;pi<path.length-1;pi++){
      const key=segKey(path[pi][0],path[pi][1],path[pi+1][0],path[pi+1][1]);
      const seg=segLoads[key];
      minCap=Math.min(minCap,seg?seg.max:0);
    }
    if(minCap<=0)break;
    results.push({path,cap:minCap});
    for(let pi=0;pi<path.length-1;pi++){
      usedSegs.add(segKey(path[pi][0],path[pi][1],path[pi+1][0],path[pi+1][1]));
    }
  }
  return results;
}

// Cable-aware BFS: only traverses tile-to-tile segments that have a cable with max>0.
// Accepts DC tiles as endpoints (start + dest), otherwise requires segment cable presence.
function bfsCablePath(sx,sy,ex,ey,avoidSegs){
  if(sx===ex&&sy===ey)return[[sx,sy]];
  const visited=Array.from({length:MAP},()=>new Array(MAP).fill(false));
  const prev=Array.from({length:MAP},()=>new Array(MAP).fill(null));
  const queue=[[sx,sy]];visited[sy][sx]=true;
  while(queue.length){
    const[cx,cy]=queue.shift();
    if(cx===ex&&cy===ey){
      const path=[];let px=ex,py=ey;
      while(px!==null){path.unshift([px,py]);const pr=prev[py][px];if(!pr)break;px=pr[0];py=pr[1];}
      return path;
    }
    for(const[nx,ny]of nb(cx,cy)){
      if(nx<0||nx>=MAP||ny<0||ny>=MAP||visited[ny][nx])continue;
      const sk=segKey(cx,cy,nx,ny);
      // Must have a cable on this segment
      const seg=segLoads[sk];
      if(!seg||seg.max<=0)continue;
      if(avoidSegs.has(sk)&&queue.length<MAP*MAP*.5)continue;
      visited[ny][nx]=true;
      prev[ny][nx]=[cx,cy];
      queue.push([nx,ny]);
    }
  }
  if(avoidSegs.size>0)return bfsCablePath(sx,sy,ex,ey,new Set());
  return null;
}

// Diagnose why two DCs don't have a BGP-eligible link.
// Returns: 'linked' | 'noRoadPath' | 'cableGap' | 'sameDC'
function diagDCPath(i,j){
  if(i===j)return{status:'sameDC'};
  const dca=G.dcs[i],dcb=G.dcs[j];
  if(!dca||!dcb)return{status:'sameDC'};
  // Already linked?
  const linked=(G.dcLinks||[]).some(l=>(l.dc1===i&&l.dc2===j)||(l.dc1===j&&l.dc2===i));
  if(linked)return{status:'linked'};
  // Ignoring cable presence, does a road path exist at all?
  const roadPath=bfsPathAvoid(dca.x,dca.y,dcb.x,dcb.y,new Set());
  if(!roadPath)return{status:'noRoadPath'};
  // Road path found but no cable coverage → find first missing segment for hint
  for(let pi=0;pi<roadPath.length-1;pi++){
    const key=segKey(roadPath[pi][0],roadPath[pi][1],roadPath[pi+1][0],roadPath[pi+1][1]);
    const seg=segLoads[key];
    if(!seg||seg.max<=0){
      return{status:'cableGap',at:[roadPath[pi],roadPath[pi+1]]};
    }
  }
  // Road+cables exist but bottleneck was 0 somehow — fall through
  return{status:'cableGap'};
}

// BFS pathfinding that avoids (deprioritizes) certain segments
function bfsPathAvoid(sx,sy,ex,ey,avoidSegs){
  if(sx===ex&&sy===ey)return[[sx,sy]];
  const visited=Array.from({length:MAP},()=>new Array(MAP).fill(false));
  const prev=Array.from({length:MAP},()=>new Array(MAP).fill(null));
  // Two-pass BFS: first try without avoided, then with
  const queue=[[sx,sy,0]];visited[sy][sx]=true;
  while(queue.length){
    // Sort by cost (avoid penalty) — simple priority
    const[cx,cy]=queue.shift();
    if(cx===ex&&cy===ey){
      const path=[];let px=ex,py=ey;
      while(px!==null){path.unshift([px,py]);const pr=prev[py][px];if(!pr)break;px=pr[0];py=pr[1];}
      return path;
    }
    for(const[nx,ny]of nb(cx,cy)){
      if(nx<0||nx>=MAP||ny<0||ny>=MAP||visited[ny][nx])continue;
      if(G.map[ny][nx].type!=='road'&&!(nx===ex&&ny===ey))continue;
      const sk=segKey(cx,cy,nx,ny);
      // If segment is avoided and there might be alternatives, skip (but allow as last resort)
      if(avoidSegs.has(sk)&&queue.length<MAP*MAP*.5)continue;
      visited[ny][nx]=true;
      prev[ny][nx]=[cx,cy];
      queue.push([nx,ny]);
    }
  }
  // Fallback: try again without avoidance
  if(avoidSegs.size>0)return bfsPathAvoid(sx,sy,ex,ey,new Set());
  return null;
}
