// ====== ACTIONS ======

// ====== MAP EXPANSION ======
// Koupě rozšíření mapy do směru N/S/E/W o ~1/4 současné velikosti (min. 6 tilů).
// - E/S jen připojí nové sloupce/řádky na konec → souřadnice entit se nemění
// - N/W posune celou mapu o `delta` dolů/doprava → všechny x/y se přepočítají
// Cena se škáluje s velikostí mapy a počtem zákazníků.

function mapExpansionCost(){
  const delta=Math.max(6,Math.ceil(MAP/4));
  const addedArea=delta*MAP;
  const tileCost=1800+Math.round(MAP*120);   // s větší mapou každý další tile dražší
  const custMult=1+(G.stats.cust||0)/2500;
  return{delta,cost:Math.round(addedArea*tileCost*custMult)};
}

function canExpandMap(dir){
  if(MAP>=MAP_MAX)return{ok:false,reason:`Dosažen strop mapy ${MAP_MAX}×${MAP_MAX}`};
  const{delta,cost}=mapExpansionCost();
  if(G.cash<cost)return{ok:false,reason:`Chybí ${fmt(cost-G.cash)}`};
  if(!['n','s','e','w'].includes(dir))return{ok:false,reason:'Neplatný směr'};
  return{ok:true,delta,cost};
}

function expandMap(dir){
  const c=canExpandMap(dir);
  if(!c.ok){notify('❌ '+c.reason,'bad');return;}
  const{delta,cost}=c;
  const oldSize=MAP,newSize=MAP+delta;
  // Offset pro N/W: posun existujících dat
  const offX=(dir==='w')?delta:0;
  const offY=(dir==='n')?delta:0;

  // Alokuj nový grid
  const nm=Array.from({length:newSize},()=>Array.from({length:newSize},()=>({type:'grass',bld:null,variant:Math.floor(Math.random()*4)})));

  // Zkopíruj staré tiles
  for(let y=0;y<oldSize;y++)for(let x=0;x<oldSize;x++){
    nm[y+offY][x+offX]=G.map[y][x];
  }

  // Prodluž existující silnice do nové oblasti
  if(dir==='e'){
    // Pro každý řádek, kde end-sloupec oldSize-1 byl road → pokračuj po novém pásu
    for(let y=offY;y<offY+oldSize;y++){
      if(nm[y][oldSize+offX-1]&&nm[y][oldSize+offX-1].type==='road'){
        for(let x=oldSize+offX;x<newSize;x++){if(Math.random()<.9)nm[y][x].type='road';}
      }
    }
  } else if(dir==='w'){
    for(let y=offY;y<offY+oldSize;y++){
      if(nm[y][offX]&&nm[y][offX].type==='road'){
        for(let x=0;x<offX;x++){if(Math.random()<.9)nm[y][x].type='road';}
      }
    }
  } else if(dir==='s'){
    for(let x=offX;x<offX+oldSize;x++){
      if(nm[oldSize+offY-1][x]&&nm[oldSize+offY-1][x].type==='road'){
        for(let y=oldSize+offY;y<newSize;y++){if(Math.random()<.9)nm[y][x].type='road';}
      }
    }
  } else if(dir==='n'){
    for(let x=offX;x<offX+oldSize;x++){
      if(nm[offY][x]&&nm[offY][x].type==='road'){
        for(let y=0;y<offY;y++){if(Math.random()<.9)nm[y][x].type='road';}
      }
    }
  }

  // Přidej 1-2 příčné spojky v nové oblasti (aby síť vůbec dávala smysl)
  const crossN=1+Math.floor(Math.random()*2);
  for(let c=0;c<crossN;c++){
    if(dir==='e'||dir==='w'){
      const y=offY+Math.floor(Math.random()*oldSize);
      const xs=dir==='e'?oldSize+offX:0,xe=dir==='e'?newSize:offX;
      for(let x=xs;x<xe;x++)if(Math.random()<.85)nm[y][x].type='road';
    } else {
      const x=offX+Math.floor(Math.random()*oldSize);
      const ys=dir==='s'?oldSize+offY:0,ye=dir==='s'?newSize:offY;
      for(let y=ys;y<ye;y++)if(Math.random()<.85)nm[y][x].type='road';
    }
  }

  // Definuj souřadnice nové oblasti
  let nax,nay,nbx,nby; // inclusive/exclusive range nové oblasti v novém gridu
  if(dir==='e'){nax=oldSize+offX;nay=offY;nbx=newSize;nby=offY+oldSize;}
  else if(dir==='w'){nax=0;nay=offY;nbx=offX;nby=offY+oldSize;}
  else if(dir==='s'){nax=offX;nay=oldSize+offY;nbx=offX+oldSize;nby=newSize;}
  else {nax=offX;nay=0;nbx=offX+oldSize;nby=offY;}

  // Posypej novou oblast budovami (podobně jako genMap)
  const centerX=offX+oldSize/2,centerY=offY+oldSize/2;
  for(let y=nay;y<nby;y++)for(let x=nax;x<nbx;x++){
    if(nm[y][x].type!=='grass')continue;
    // Musí mít souseda s road
    let hasRoad=false;
    for(const[ax,ay] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
      if(ax>=0&&ax<newSize&&ay>=0&&ay<newSize&&nm[ay][ax].type==='road'){hasRoad=true;break;}
    }
    if(!hasRoad)continue;
    if(Math.random()>.46)continue; // o něco řidší než centrum
    const dc=Math.sqrt((x-centerX)**2+(y-centerY)**2);
    let bt;
    if(dc<8){const r=Math.random();bt=r<.2?'panel':r<.4?'shop':r<.6?'house':r<.8?'rowhouse':'public';}
    else if(dc<16){const r=Math.random();bt=r<.35?'house':r<.55?'rowhouse':r<.75?'panel':r<.9?'shop':'factory';}
    else{const r=Math.random();bt=r<.5?'house':r<.75?'rowhouse':r<.9?'shop':'factory';}
    const b=BTYPES[bt];if(!b)continue;
    const units=b.units[0]+Math.floor(Math.random()*(b.units[1]-b.units[0]+1));
    const pop=b.pop[0]+Math.floor(Math.random()*(b.pop[1]-b.pop[0]+1));
    nm[y][x].bld={type:bt,units,pop,maxPop:Math.round(pop*1.5),connected:false,connType:null,customers:0,sat:0,tariff:null,want:Math.random()<b.demand,dcIdx:-1,svcSubs:{}};
  }

  // Shift všech entit, pokud N/W
  if(offX>0||offY>0){
    for(const cb of G.cables){cb.x1+=offX;cb.y1+=offY;cb.x2+=offX;cb.y2+=offY;}
    for(const dc of G.dcs){dc.x+=offX;dc.y+=offY;}
    for(const cn of G.conns){cn.bx+=offX;cn.by+=offY;}
    for(const j of (G.junctions||[])){j.x+=offX;j.y+=offY;}
    for(const t of (G.towers||[])){t.x+=offX;t.y+=offY;}
    for(const w of (G.wifiAPs||[])){w.x+=offX;w.y+=offY;}
    for(const df of (G.darkFiber||[])){df.x1+=offX;df.y1+=offY;df.x2+=offX;df.y2+=offY;}
    for(const dl of (G.dcLinks||[])){if(dl.x1!==undefined){dl.x1+=offX;dl.y1+=offY;dl.x2+=offX;dl.y2+=offY;}}
    // Cable cuts — přepočítej segKey
    for(const cut of (G.cableCuts||[])){
      cut.x1+=offX;cut.y1+=offY;cut.x2+=offX;cut.y2+=offY;
      if(typeof segKey==='function')cut.segKey=segKey(cut.x1,cut.y1,cut.x2,cut.y2);
    }
  }

  // Commit
  G.map=nm;
  MAP=newSize;
  G.mapSize=newSize;
  if(!G.expansions)G.expansions=[];
  G.expansions.push({dir,delta,sizeBefore:oldSize,sizeAfter:newSize,cost,y:G.date.y,m:G.date.m});
  G.cash-=cost;

  markCapDirty();if(typeof calcCapacity==='function')calcCapacity();
  const dirName={n:'sever',s:'jih',e:'východ',w:'západ'}[dir];
  notify(`🗺️ Mapa rozšířena na ${dirName} (+${delta} tilů, ${newSize}×${newSize}). −${fmtKc(cost)}`,'good');
  updUI();
}

function placeDC(x,y,type){
  if(G.map[y][x].type!=='grass'){notify('❌ DC jen na trávu!','bad');return;}
  if(G.map[y][x].bld){notify('❌ Obsazeno!','bad');return;}
  if(G.dcs.some(d=>d.x===x&&d.y===y)){notify('❌ Již stojí DC!','bad');return;}
  const dt=DC_T[type];
  const cost=inflComponentCost(dt.cost);
  if(G.cash<cost){notify(`❌ Chybí ${fmt(cost-G.cash)}!`,'bad');return;}
  G.dcs.push({x,y,type,eq:[],bwUpgrades:[],outage:{active:false,remaining:0,cause:''}});G.cash-=cost;
  markCapDirty();
  notify(`✅ ${dt.name} postaveno! (základ ${fmtBW(dt.baseBW)})`,'good');updUI();
}

function buyBW(dcIdx,bwIdx){
  const dc=G.dcs[dcIdx];if(!dc)return;const bwu=BW_UPGRADES[bwIdx];
  const cost=inflComponentCost(bwu.cost);
  if(G.cash<cost){notify(`❌ Chybí ${fmt(cost-G.cash)}!`,'bad');return;}
  if(!dcHasRouter(dc)){notify('❌ DC potřebuje Router pro transit!','bad');return;}
  // BW upgrade needs a free port (uplink)
  const netCap=getDCNetCapacity(dcIdx);
  if(netCap.usedPorts>=netCap.totalPorts){
    notify(`❌ Žádný volný port pro uplink! ${netCap.usedPorts}/${netCap.totalPorts} (potřeba Switch)`,'bad');return;
  }
  if(!dc.bwUpgrades)dc.bwUpgrades=[];
  dc.bwUpgrades.push({bw:bwu.bw,mCost:bwu.mCost});G.cash-=cost;
  markCapDirty();
  notify(`✅ +${fmtBW(bwu.bw)} bandwidth (zabírá 1 port)`,'good');updUI();buildBWList();
}

function removeBW(dcIdx,bwi){
  const dc=G.dcs[dcIdx];if(!dc||!dc.bwUpgrades||bwi>=dc.bwUpgrades.length)return;
  const bwu=dc.bwUpgrades[bwi];
  // Find original cost from BW_UPGRADES
  const orig=BW_UPGRADES.find(b=>b.bw===bwu.bw);
  const refund=orig?Math.round(orig.cost*0.3):0;
  dc.bwUpgrades.splice(bwi,1);
  G.cash+=refund;
  notify(`🗑️ -${fmtBW(bwu.bw)} bandwidth odebráno${refund>0?' (+'+fmtKc(refund)+' refund)':''}`,'good');
  markCapDirty();calcCapacity();updUI();
}

// ====== BGP PEERING MANAGEMENT ======

function createBGPPeering(dc1Idx,dc2Idx){
  if(dc1Idx===dc2Idx){notify('❌ Nelze propojit DC samo se sebou!','bad');return;}
  const dca=G.dcs[dc1Idx],dcb=G.dcs[dc2Idx];
  if(!dca||!dcb){notify('❌ DC neexistuje!','bad');return;}
  // Both DCs need BGP router
  if(!(dca.eq||[]).some(e=>EQ[e]&&EQ[e].bgpCap)){notify('❌ DC#'+(dc1Idx+1)+' nemá BGP router!','bad');return;}
  if(!(dcb.eq||[]).some(e=>EQ[e]&&EQ[e].bgpCap)){notify('❌ DC#'+(dc2Idx+1)+' nemá BGP router!','bad');return;}
  // Check if peering already exists
  const exists=(G.bgpPeerings||[]).some(p=>
    (p.dc1===dc1Idx&&p.dc2===dc2Idx)||(p.dc1===dc2Idx&&p.dc2===dc1Idx));
  if(exists){notify('❌ BGP peering již existuje!','bad');return;}
  // Check physical link exists between DCs
  const linked=(G.dcLinks||[]).some(l=>
    (l.dc1===dc1Idx&&l.dc2===dc2Idx)||(l.dc1===dc2Idx&&l.dc2===dc1Idx));
  if(!linked){notify('❌ DC nejsou propojená kabelem!','bad');return;}
  // Find max link capacity
  const link=(G.dcLinks||[]).find(l=>
    (l.dc1===dc1Idx&&l.dc2===dc2Idx)||(l.dc1===dc2Idx&&l.dc2===dc1Idx));
  const linkCap=link?link.capacity:0;
  // BGP cap = min of both sides' BGP router capacity
  const bgpCap1=(dca.eq||[]).filter(e=>EQ[e]&&EQ[e].bgpCap).reduce((s,e)=>s+(EQ[e].bgpCap||0),0);
  const bgpCap2=(dcb.eq||[]).filter(e=>EQ[e]&&EQ[e].bgpCap).reduce((s,e)=>s+(EQ[e].bgpCap||0),0);
  const maxBW=Math.min(bgpCap1,bgpCap2,linkCap);
  // Default allocation = 30% of max
  const defaultAlloc=Math.round(maxBW*.3);
  G.bgpPeerings.push({dc1:dc1Idx,dc2:dc2Idx,allocBW:defaultAlloc,maxBW,active:true});
  notify(`✅ BGP peering DC#${dc1Idx+1} ↔ DC#${dc2Idx+1} vytvořen (${fmtBW(defaultAlloc)} alokováno)`,'good');
  calcCapacity();updUI();
}

function removeBGPPeering(idx){
  if(!G.bgpPeerings||idx>=G.bgpPeerings.length)return;
  const p=G.bgpPeerings[idx];
  G.bgpPeerings.splice(idx,1);
  notify(`🗑️ BGP peering DC#${p.dc1+1} ↔ DC#${p.dc2+1} odstraněn`,'good');
  calcCapacity();updUI();
}

function setBGPAlloc(idx,bw){
  if(!G.bgpPeerings||idx>=G.bgpPeerings.length)return;
  const p=G.bgpPeerings[idx];
  p.allocBW=Math.max(0,Math.min(bw,p.maxBW));
  calcCapacity();updUI();
}

function toggleBGPPeering(idx){
  if(!G.bgpPeerings||idx>=G.bgpPeerings.length)return;
  const p=G.bgpPeerings[idx];
  p.active=!p.active;
  notify(`${p.active?'✅':'⏸️'} BGP peering DC#${p.dc1+1} ↔ DC#${p.dc2+1} ${p.active?'aktivován':'pozastaven'}`,'good');
  calcCapacity();updUI();
}

function recalcBGPMaxBW(){
  // Recalculate maxBW for all peerings (after equipment or cable changes)
  for(const p of(G.bgpPeerings||[])){
    const dca=G.dcs[p.dc1],dcb=G.dcs[p.dc2];
    if(!dca||!dcb){p.maxBW=0;continue;}
    const bgpCap1=(dca.eq||[]).filter(e=>EQ[e]&&EQ[e].bgpCap).reduce((s,e)=>s+(EQ[e].bgpCap||0),0);
    const bgpCap2=(dcb.eq||[]).filter(e=>EQ[e]&&EQ[e].bgpCap).reduce((s,e)=>s+(EQ[e].bgpCap||0),0);
    const link=(G.dcLinks||[]).find(l=>
      (l.dc1===p.dc1&&l.dc2===p.dc2)||(l.dc1===p.dc2&&l.dc2===p.dc1));
    const linkCap=link?link.capacity:0;
    p.maxBW=Math.min(bgpCap1,bgpCap2,linkCap);
    if(p.allocBW>p.maxBW)p.allocBW=p.maxBW;
  }
}

// ====== JUNCTIONS (placeable load-balancer / switch node on a road tile) ======
function placeJunction(x,y,type){
  if(x<0||x>=MAP||y<0||y>=MAP){notify('❌ Mimo mapu!','bad');return;}
  if(!isRoad(x,y)){notify('❌ Junction jen na silnici!','bad');return;}
  if((G.junctions||[]).some(j=>j.x===x&&j.y===y)){notify('❌ Zde již stojí junction!','bad');return;}
  const jt=(typeof JUNCTION_T!=='undefined')?JUNCTION_T[type]:null;
  if(!jt){notify('❌ Neznámý typ junction!','bad');return;}
  const jCost=inflComponentCost(jt.cost);
  if(G.cash<jCost){notify(`❌ Chybí ${fmt(jCost-G.cash)}!`,'bad');return;}
  // Require at least 2 cables incident to this tile (or 1 + adjacent DC) — otherwise junction useless
  const segKeysHere=Object.keys(segLoads||{}).filter(k=>{
    const p=k.split(',').map(Number);
    return (p[0]===x&&p[1]===y)||(p[2]===x&&p[3]===y);
  });
  // Allow placement even without cables — player may place first, then wire later
  if(!G.junctions)G.junctions=[];
  G.junctions.push({x,y,type,active:true});
  G.cash-=jCost;
  markCapDirty();
  notify(`✅ ${jt.icon} ${jt.name} postaven na [${x},${y}]`,'good');updUI();
}

function toggleJunction(x,y){
  const j=(G.junctions||[]).find(j=>j.x===x&&j.y===y);
  if(!j)return;
  j.active=!j.active;
  markCapDirty();
  notify(`${j.active?'✅':'⏸️'} Junction [${x},${y}] ${j.active?'aktivován':'pozastaven'}`,'good');updUI();
}

function placeCable(x1,y1,x2,y2,type){
  const ok1=isRoad(x1,y1)||G.dcs.some(d=>d.x===x1&&d.y===y1);
  const ok2=isRoad(x2,y2)||G.dcs.some(d=>d.x===x2&&d.y===y2);
  if(!ok1||!ok2){notify('❌ Jen po silnicích/z DC!','bad');return;}
  const segs=pathSegs(x1,y1,x2,y2),ct=CAB_T[type];let ns=0,upgN=0,upgCost=0,stackN=0;
  for(const s of segs){
    // Check for lower-tier cables that can be upgraded
    let upgraded=false;
    for(let i=G.cables.length-1;i>=0;i--){const c=G.cables[i];
      if(!((c.x1===s.x1&&c.y1===s.y1&&c.x2===s.x2&&c.y2===s.y2)||(c.x1===s.x2&&c.y1===s.y2&&c.x2===s.x1&&c.y2===s.y1)))continue;
      const ot=CAB_T[c.t];if(ot&&ot.tier<ct.tier){
        const diff=Math.max(0,ct.cost-ot.cost);upgCost+=diff;upgN++;G.cables.splice(i,1);upgraded=true;break;}}
    // Count existing same-type cables on this segment (for stacking info)
    const sameCount=G.cables.filter(c=>c.t===type&&((c.x1===s.x1&&c.y1===s.y1&&c.x2===s.x2&&c.y2===s.y2)||(c.x1===s.x2&&c.y1===s.y2&&c.x2===s.x1&&c.y2===s.y1))).length;
    if(sameCount>0)stackN++;
    ns++;
  }
  if(ns===0){notify('❌ Žádné segmenty k položení!','bad');return;}
  const totalCost=inflComponentCost((ns-upgN)*ct.cost+upgCost);
  if(G.cash<totalCost){notify(`❌ Chybí ${fmt(totalCost-G.cash)}!`,'bad');return;}
  // Always add cables (stacking = multiple same-type cables on one segment = higher capacity)
  for(const s of segs){
    G.cables.push({...s,t:type});
  }
  G.cash-=totalCost;
  markCapDirty();
  let msg=`✅ ${ct.name} ×${ns}`;
  if(upgN)msg+=` (${upgN} upgradů)`;
  if(stackN)msg+=` (${stackN} stacking)`;
  const totalBW=ct.maxBW*(stackN>0?2:1);
  msg+=` (kap. ${fmtBW(ct.maxBW)}/seg)`;
  notify(msg,'good');updUI();
}

function connectBld(x,y,connType){
  const b=G.map[y]?.[x]?.bld;if(!b){notify('❌ Žádná budova!','bad');return;}
  if(b.connected){
    if(b.connType===connType){notify('❌ Tato přípojka již existuje!','bad');return;}
    const ct=CONN_T[connType],oldCt=CONN_T[b.connType];
    if(ct&&oldCt&&ct.maxBW<=oldCt.maxBW){notify('❌ Nová přípojka musí být rychlejší!','bad');return;}
    if(!ct){notify('❌ Neznámý typ přípojky!','bad');return;}
    if(ct.minTech>G.tech){notify(`❌ Potřeba technologie ${TECHS[ct.minTech].name}!`,'bad');return;}
    const cCost=inflComponentCost(ct.cost);
    if(G.cash<cCost){notify(`❌ Chybí ${fmt(cCost-G.cash)}!`,'bad');return;}
    const cn=G.conns.find(c=>c.bx===x&&c.by===y);
    if(cn){const dc=G.dcs[cn.di];if(dc){const m=getMissingEq(dc,ct.reqEq);if(m.length){notify(`❌ DC potřebuje: ${m.join(', ')}!`,'bad');return;}}}
    const oldConnType=b.connType;
    b.connType=connType;G.cash-=cCost;
    // Trigger upgrade wave — existing customers consider switching to better tariffs
    const upgraded=triggerTariffUpgradeWave(b,x,y,ct.maxBW,oldConnType,connType);
    notify(`⬆️ Upgrade na ${ct.name} (max ${fmtBW(ct.maxBW)})${upgraded>0?' · '+upgraded+' zákazníků přešlo na lepší tarif':''}`,'good');updUI();return;
  }
  const ct=CONN_T[connType];if(!ct){notify('❌ Vyber typ přípojky!','bad');return;}
  if(ct.minTech>G.tech){notify(`❌ Potřeba technologie ${TECHS[ct.minTech].name}!`,'bad');return;}
  const cCost2=inflComponentCost(ct.cost);
  if(G.cash<cCost2){notify(`❌ Chybí ${fmt(cCost2-G.cash)}!`,'bad');return;}

  let di=-1;
  if(connType==='conn_wifi'){
    const ap=getWiFiInRange(x,y);
    if(!ap){notify('❌ Budova není v dosahu WiFi!','bad');return;}
    di=ap.dcIdx;
  }else{
    di=findDC(x,y);
    if(di===-1){notify('❌ Žádné DC kabelem!','bad');return;}
  }

  const dc=G.dcs[di],dt=DC_T[dc.type];
  if(!dcHasRouter(dc)){notify('❌ DC potřebuje Router!','bad');return;}
  if(!networkHasEq(di,ct.reqEq)){notify(`❌ Síť potřebuje: ${getMissingEq(dc,ct.reqEq).join(', ')}!`,'bad');return;}
  // Check router capacity and port availability
  const netCap=getDCNetCapacity(di);
  if(netCap.usedConns>=netCap.routerCap){
    notify(`❌ Router přetížen! ${netCap.usedConns}/${netCap.routerCap} (potřeba další Router)`,'bad');return;
  }
  if(netCap.usedPorts>=netCap.totalPorts){
    notify(`❌ Žádné volné porty! ${netCap.usedPorts}/${netCap.totalPorts} (potřeba Switch)`,'bad');return;
  }
  const dl=dcLoads[di];if(dl&&dl.ratio>1.2){notify('⚠️ DC extrémně přetížené!','bad');return;}
  G.conns.push({bx:x,by:y,di});b.connected=true;b.connType=connType;b.dcIdx=di;G.cash-=cCost2;
  // Initialize tariff distribution — no customers yet, they'll join via growth
  b.tariffDist={};b.customers=0;b.tariff=null;b.sat=50;if(!b.svcSubs)b.svcSubs={};
  markCapDirty();
  notify(`✅ Připojeno na ${ct.name}!`,'good');updUI();
}

// Disconnect a building — remove its connection entirely
function disconnectBld(x,y){
  const b=G.map[y]?.[x]?.bld;if(!b||!b.connected){notify('❌ Budova není připojena!','bad');return;}
  const ct=b.connType?CONN_T[b.connType]:null;
  const refund=ct?Math.round(ct.cost*0.3):0;
  // Remove from connections list
  const ci=G.conns.findIndex(c=>c.bx===x&&c.by===y);
  if(ci>=0)G.conns.splice(ci,1);
  // Reset building state
  const lostCustomers=b.customers;
  b.connected=false;b.connType=null;b.customers=0;b.tariff=null;b.tariffDist={};b.dcIdx=-1;b.sat=0;b.svcSubs={};
  G.cash+=refund;
  notify(`🔌 Odpojeno! ${lostCustomers} zákazníků ztraceno${refund>0?' (+'+fmtKc(refund)+' refund)':''}`,'good');updUI();
}

// Downgrade a building's connection to a cheaper type
function downgradeBld(x,y,newConnType){
  const b=G.map[y]?.[x]?.bld;if(!b||!b.connected){notify('❌ Budova není připojena!','bad');return;}
  const newCt=CONN_T[newConnType];if(!newCt){notify('❌ Neznámý typ přípojky!','bad');return;}
  const oldCt=b.connType?CONN_T[b.connType]:null;
  if(oldCt&&newCt.maxBW>=oldCt.maxBW){notify('❌ To není downgrade!','bad');return;}
  const refund=oldCt?Math.round((oldCt.cost-newCt.cost)*0.3):0;
  const oldConn=b.connType;
  b.connType=newConnType;
  if(refund>0)G.cash+=refund;
  // Customers on tariffs above new maxBW get downgraded or leave
  let lost=0;
  if(b.tariffDist){
    for(const ti in b.tariffDist){
      const t=G.tariffs[ti];if(!t)continue;
      if(t.speed>newCt.maxBW){
        // These customers can't keep their tariff — try to move them down, or they leave
        const cnt=b.tariffDist[ti];
        delete b.tariffDist[ti];
        // Find best available tariff within new limit
        const avail=getAvailTariffs(newCt.maxBW,b.dcIdx,newConnType);
        if(avail.length>0){
          const bestTi=avail[avail.length-1]; // fastest available
          addToTariffDist(b,bestTi,cnt);
        } else {
          b.customers-=cnt;lost+=cnt;
        }
      }
    }
    // Also check category change
    const wasWL=oldConn&&(oldConn.startsWith('conn_lte')||oldConn.startsWith('conn_5g'));
    const isWL=newConnType&&(newConnType.startsWith('conn_lte')||newConnType.startsWith('conn_5g'));
    if(wasWL!==isWL){
      // Category changed — reassign all remaining customers
      const remaining=b.customers;
      b.tariffDist={};
      for(let i=0;i<remaining;i++){
        const ti=pickTariffForCustomer(b,newCt.maxBW,b.dcIdx);
        if(ti!==null)addToTariffDist(b,ti,1);
        else{b.customers--;lost++;}
      }
    }
  }
  b.sat=Math.max(0,b.sat-5); // slight satisfaction hit from downgrade
  notify(`⬇️ Downgrade na ${newCt.name}${lost>0?' · '+lost+' zákazníků odešlo':''}${refund>0?' (+'+fmtKc(refund)+' refund)':''}`,'good');updUI();
}

// When connection is upgraded, a wave of customers try to switch to better tariffs
function triggerTariffUpgradeWave(b,bx,by,newMaxBW,oldConnType,newConnType){
  if(!b.tariffDist||b.customers<=0)return 0;
  const bt=BTYPES[b.type];
  const cn=G.conns.find(c=>c.bx===bx&&c.by===by);
  if(!cn)return 0;
  const dcIdx=cn.di;
  let upgraded=0;

  // Determine if connection category changed (fixed→wireless or vice versa)
  const wasWireless=oldConnType&&(oldConnType.startsWith('conn_lte')||oldConnType.startsWith('conn_5g'));
  const isWireless=newConnType&&(newConnType.startsWith('conn_lte')||newConnType.startsWith('conn_5g'));
  const categoryChanged=wasWireless!==isWireless;

  // If category changed (fixed→mobile or mobile→fixed), reassign ALL customers
  // because their current tariffs are now invalid category
  if(categoryChanged){
    const avail=getAvailTariffs(newMaxBW,dcIdx,newConnType);
    if(avail.length>0){
      const totalCust=b.customers;
      b.tariffDist={};
      // Re-distribute to new category tariffs
      for(let i=0;i<totalCust;i++){
        const ti=pickTariffForCustomer(b,newMaxBW,dcIdx);
        if(ti!==null)addToTariffDist(b,ti,1);
        else{b.customers--;} // couldn't find tariff, customer leaves
      }
      return totalCust;
    }
  }

  // Same category — some customers voluntarily upgrade to faster tariffs
  // Each customer has a chance to upgrade based on building quality sensitivity
  const tis=Object.keys(b.tariffDist).map(Number).sort((a,c)=>a-c);
  for(const fromTi of tis){
    const custOnTariff=b.tariffDist[fromTi];if(!custOnTariff||custOnTariff<=0)continue;
    const oldT=G.tariffs[fromTi];if(!oldT)continue;

    // Find best available upgrade
    for(let ti=fromTi+1;ti<G.tariffs.length;ti++){
      const t=G.tariffs[ti];
      if(!t.active||t.minTech>G.tech||t.speed>newMaxBW)continue;
      if(!networkHasEq(dcIdx,t.reqEq))continue;
      // Category filter
      const tCat=t.cat||'fixed';
      if((tCat==='mobile'||tCat==='fwa')&&!isWireless)continue;
      if(tCat==='fixed'&&isWireless)continue;
      // Only upgrade if new tariff is actually faster
      if(t.speed<=oldT.speed)continue;

      // Upgrade probability: quality-sensitive types upgrade more eagerly
      // ~30-60% of customers on cheaper tariffs will upgrade after connection boost
      const priceRatio=t.price/refPrice(t.speed,t.share);
      let upgradeChance=0.35*bt.qualSens;
      if(priceRatio<0.95)upgradeChance+=0.15;   // cheap tariff → more upgraders
      if(priceRatio>1.2)upgradeChance-=0.15;     // expensive → fewer
      upgradeChance=Math.max(0.05,Math.min(0.7,upgradeChance));

      const toUpgrade=Math.max(1,Math.round(custOnTariff*upgradeChance));
      if(toUpgrade>0){
        removeFromTariffDist(b,toUpgrade,fromTi);
        addToTariffDist(b,ti,toUpgrade);
        upgraded+=toUpgrade;
      }
      break; // only upgrade one step at a time per tariff group
    }
  }

  // Also boost satisfaction — customers are happy about the upgrade
  b.sat=Math.min(100,b.sat+8);

  return upgraded;
}

function placeEq(dcIdx,eqType){
  const dc=G.dcs[dcIdx];if(!dc)return;const eq=EQ[eqType];if(!eq){notify('❌ Neznámé vybavení!','bad');return;}
  const eqCost=inflComponentCost(eq.cost);
  if(G.cash<eqCost){notify(`❌ Chybí ${fmtKc(eqCost-G.cash)}!`,'bad');return;}
  const dt=DC_T[dc.type];if(!dc.eq)dc.eq=[];
  // Hard cap na chlazení dle velikosti DC — brání nekonečnému stackování
  // a tím nekontrolovanému růstu slotů v malém DC.
  if(eqType==='eq_cooling'){
    const coolCount=dc.eq.filter(e=>e==='eq_cooling').length;
    const maxCool=dt.maxCooling||1;
    if(coolCount>=maxCool){
      notify(`❌ Max ${maxCool}× chlazení v ${dt.name}! Upgraduj DC.`,'bad');
      return;
    }
  }
  // Calculate max slots including cooling bonus
  let maxSlots=dt.slots;
  for(const e of dc.eq){if(EQ[e]&&EQ[e].eff==='cooling')maxSlots+=EQ[e].val;}
  if(dc.eq.length>=maxSlots){notify(`❌ DC plné! ${dc.eq.length}/${maxSlots} slotů`,'bad');return;}
  dc.eq.push(eqType);G.cash-=eqCost;
  markCapDirty();
  notify(`✅ ${eq.name} instalováno`,'good');updUI();
}

function buyService(svcIdx){
  const svc=SERVICES[svcIdx];if(!svc){notify('❌ Neznámá služba!','bad');return;}
  if(G.cash<svc.cost){notify(`❌ Chybí ${fmt(svc.cost-G.cash)}!`,'bad');return;}
  if(!anyDCHasEq(svc.reqEq)){notify(`❌ Potřeba: ${svc.reqEq.map(e=>EQ[e]?.name).join(', ')}!`,'bad');return;}
  if(!G.services)G.services=[];if(!G.services.includes(svc.id)){
    G.services.push(svc.id);G.cash-=svc.cost;
    notify(`✅ ${svc.name} aktivována!`,'good');updUI();buildSvcList();
  }
}

function buyUpgrade(upgIdx){
  const upg=UPGRADES[upgIdx];if(!upg){notify('❌ Neznámý upgrade!','bad');return;}
  if(upg.req&&!G.upgrades.includes(upg.req)){notify(`❌ Potřeba: ${UPGRADES.find(u=>u.id===upg.req)?.name}!`,'bad');return;}
  if(G.cash<upg.cost){notify(`❌ Chybí ${fmt(upg.cost-G.cash)}!`,'bad');return;}
  if(!G.upgrades)G.upgrades=[];if(!G.upgrades.includes(upg.id)){
    G.upgrades.push(upg.id);G.cash-=upg.cost;
    notify(`✅ ${upg.name} aktivován!`,'good');updUI();buildUpgradeList();
  }
}

function buyTechUpgrade(){
  if(G.tech>=TECHS.length-1){notify('❌ Už máš nejnovější tech!','bad');return;}
  const t=TECHS[G.tech+1];if(G.date.y<t.year){notify(`❌ Dostupné od ${t.year}!`,'bad');return;}
  if(G.cash<t.cost){notify(`❌ Chybí ${fmt(t.cost-G.cash)}!`,'bad');return;}
  G.tech++;G.cash-=t.cost;
  notify(`🔬 ${t.name} dostupná!`,'good');updUI();
}

function buyIPBlock(blockIdx){
  const blk=IP_BLOCKS[blockIdx];if(!blk){notify('❌ Neznámý blok!','bad');return;}
  const blkCost=inflComponentCost(blk.cost);
  if(G.cash<blkCost){notify(`❌ Chybí ${fmt(blkCost-G.cash)}!`,'bad');return;}
  if(!anyDCHasEq(['eq_bgprouter'])){notify('❌ Potřeba BGP router v DC!','bad');return;}
  if(!G.ipBlocks)G.ipBlocks=[];
  G.ipBlocks.push({ips:blk.ips,mCost:blk.mCost,name:blk.name});
  G.cash-=blkCost;
  const totalIPs=G.ipBlocks.reduce((s,b)=>s+b.ips,0);
  notify(`✅ ${blk.name} zakoupen! (celkem ${fmt(totalIPs)} IP)`,'good');updUI();
}

function getTotalIPs(){if(!G.ipBlocks)return 0;return G.ipBlocks.reduce((s,b)=>s+b.ips,0);}
function getUsedIPs(){
  let used=0;
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;if(!b||!b.connected)continue;
    used+=b.customers; // 1 IP per customer base
    // Public IP service = extra IP per adopting customer
    if(G.services&&G.services.includes('svc_publicip')){
      const adopt=SERVICES.find(s=>s.id==='svc_publicip')?.adopt[b.type]||0;
      used+=Math.round(b.customers*adopt);
    }
  }
  // Cloud instances use IPs too
  if(G.cloudInstances){
    for(const ci of G.cloudInstances)used+=ci.count;
  }
  return used;
}

function getDCStorage(dcIdx){
  const dc=G.dcs[dcIdx];if(!dc)return{total:0,used:0};
  let total=0;
  for(const e of(dc.eq||[])){
    const eq=EQ[e];if(eq&&eq.storageTB)total+=eq.storageTB;
  }
  let used=0;
  if(G.cloudInstances){
    for(const ci of G.cloudInstances){
      if(ci.dcIdx===dcIdx){
        const cp=CLOUD_PRICING[ci.type];if(cp&&cp.storageTB)used+=cp.storageTB*ci.count;
      }
    }
  }
  return{total,used};
}

function getDCCompute(dcIdx){
  const dc=G.dcs[dcIdx];if(!dc)return{vCPU:0,ram:0,usedCPU:0,usedRAM:0};
  let vCPU=0,ram=0;
  for(const e of(dc.eq||[])){
    const eq=EQ[e];if(eq&&eq.vCPU){vCPU+=eq.vCPU;ram+=eq.ramGB;}
  }
  let usedCPU=0,usedRAM=0;
  if(G.cloudInstances){
    for(const ci of G.cloudInstances){
      if(ci.dcIdx===dcIdx){
        const cp=CLOUD_PRICING[ci.type];
        if(cp){if(cp.vCPU){usedCPU+=cp.vCPU*ci.count;usedRAM+=cp.ramGB*ci.count;}}
      }
    }
  }
  return{vCPU,ram,usedCPU,usedRAM};
}

function provisionCloud(dcIdx,typeKey){
  const cp=CLOUD_PRICING[typeKey];if(!cp){notify('❌ Neznámý typ!','bad');return;}
  const dc=G.dcs[dcIdx];if(!dc){notify('❌ Neznámé DC!','bad');return;}
  // Check required equipment in THIS DC
  if(cp.reqEq){
    for(const eq of cp.reqEq){
      if(!(dc.eq||[]).includes(eq)){
        notify(`❌ ${cp.name} vyžaduje ${EQ[eq]?.name||eq} v tomto DC!`,'bad');return;
      }
    }
  }
  // Check storage capacity
  if(cp.storageTB){
    const st=getDCStorage(dcIdx);
    if(st.used+cp.storageTB>st.total){notify(`❌ Nedostatek storage! (${st.used.toFixed(1)}/${st.total} TB)`,'bad');return;}
  }
  // Check compute capacity
  if(cp.vCPU){
    const comp=getDCCompute(dcIdx);
    if(comp.usedCPU+cp.vCPU>comp.vCPU){notify(`❌ Nedostatek vCPU! (${comp.usedCPU}/${comp.vCPU})`,'bad');return;}
    if(comp.usedRAM+(cp.ramGB||0)>comp.ram){notify(`❌ Nedostatek RAM! (${comp.usedRAM}/${comp.ram} GB)`,'bad');return;}
  }
  if(!G.cloudInstances)G.cloudInstances=[];
  // Find existing or create new
  const existing=G.cloudInstances.find(ci=>ci.type===typeKey&&ci.dcIdx===dcIdx);
  if(existing){existing.count++;}
  else{G.cloudInstances.push({type:typeKey,dcIdx,count:1});}
  notify(`✅ ${cp.name} provisionován v DC#${dcIdx+1}`,'good');updUI();
}

function deprovisionCloud(dcIdx,typeKey){
  if(!G.cloudInstances)return;
  const ci=G.cloudInstances.find(c=>c.type===typeKey&&c.dcIdx===dcIdx);
  if(!ci||ci.count<=0){notify('❌ Žádná instance!','bad');return;}
  ci.count--;
  if(ci.count<=0)G.cloudInstances.splice(G.cloudInstances.indexOf(ci),1);
  notify(`🗑️ ${CLOUD_PRICING[typeKey]?.name||typeKey} odebrán`,'good');updUI();
}

// ====== CLOUD REVENUE CALCULATION ======
// Zohledňuje: segment demand mix · SLA tier · playerův price multiplier · inflation · reputaci (discount když je špatná).
function calcCloudRevenue(){
  if(!G.cloudInstances||!G.cloudInstances.length)return 0;
  let totalCloudCust=0;
  for(const seg of CLOUD_SEGMENTS){
    const cs=G.cloudCustomers?.[seg.id];
    if(cs)totalCloudCust+=cs.count;
  }
  if(totalCloudCust<=0)return 0;

  const priceMult=G.cloudPriceMult||1.0;
  const sla=SLA_TIERS.find(s=>s.id===G.cloudSLA)||SLA_TIERS[0];
  // Cloud list-price drift: primárně valorizace pro zákazníka (tariffInflation — 0.5–0.7× CPI),
  // sekundárně backstop přes componentInflation (kdyby hráč dlouhodobě neaktualizoval tariffs).
  const tInfl=(G&&G.tariffInflation)||1.0;
  const cInfl=(G&&G.componentInflation)||1.0;
  const infl=Math.max(tInfl,cInfl*0.9); // nikdy pod 90 % HW inflace — list price musí krýt náklady
  // Špatná reputace = zákazníci platí míň (discount), dobrá = full price
  // 60 = neutrální, 90 = +5%, 30 = -10%, 0 = -20%
  const rep=G.cloudReputation||60;
  const repAdj=1+Math.max(-0.20,Math.min(0.05,(rep-60)/400));
  let rev=0;

  for(const seg of CLOUD_SEGMENTS){
    const cs=G.cloudCustomers?.[seg.id];
    if(!cs||cs.count<=0)continue;
    let segRevPerCust=0;
    for(const key in CLOUD_PRICING){
      const cp=CLOUD_PRICING[key];
      const cat=cp.cat||'vps';
      const demandWeight=seg.demand[cat]||0;
      if(demandWeight>0)segRevPerCust+=cp.price*demandWeight;
    }
    rev+=cs.count*segRevPerCust*priceMult*sla.priceMult*infl*repAdj;
  }
  return Math.round(rev);
}

// Operational cost of running the cloud platform (power, SW licence, backup, peering).
// Per-instance mCost × inflation · sníženo dev staff automatizací (až -30%) a upgrady (auto1).
function calcCloudOpCost(){
  if(!G.cloudInstances||!G.cloudInstances.length)return 0;
  let base=0;
  for(const ci of G.cloudInstances){
    const cp=CLOUD_PRICING[ci.type];
    if(!cp)continue;
    base+=(cp.mCost||0)*ci.count;
  }
  if(base<=0)return 0;
  // Dev team automatizace: každý dev snižuje cloud ops náklady o 2%, cap -30%
  let discount=0;
  try{
    const devs=(typeof getStaffEffect==='function')?getStaffEffect('dev'):0;
    discount=Math.min(0.30,devs*0.02);
    // XP/level dev týmu přidá další slevu (levelovaný tým efektivnější)
    const det=G.staffDetail?.dev;
    if(det&&det.level>1)discount=Math.min(0.40,discount+(det.level-1)*0.01);
  }catch(e){}
  // Automation upgrade přispěje dalších 10%
  if(G.upgrades&&G.upgrades.includes('auto1'))discount=Math.min(0.50,discount+0.10);
  const infl=(G&&G.componentInflation)||1.0;
  return Math.round(base*infl*(1-discount));
}

// For UI: how many Kč/měs by dev tým potenciálně ušetřil pokud by ISP najal dalšího seniora dev
function calcCloudMargin(){
  const rev=calcCloudRevenue();
  const cost=calcCloudOpCost();
  return{rev,cost,profit:rev-cost,marginPct:rev>0?Math.round((rev-cost)/rev*100):0};
}

function getCloudBWUsage(){
  // Calculate total bandwidth used by cloud instances (for DC load)
  let bw=0;
  for(const ci of(G.cloudInstances||[])){
    const cp=CLOUD_PRICING[ci.type];if(!cp)continue;
    bw+=(cp.bwMbps||0)*ci.count;
  }
  // Scale by utilization (cloud customers / capacity)
  let totalCloudCust=0;
  for(const seg of CLOUD_SEGMENTS){
    const cs=G.cloudCustomers?.[seg.id];if(cs)totalCloudCust+=cs.count;
  }
  // More customers = more bandwidth actually used (up to provisioned)
  const utilFactor=Math.min(1,totalCloudCust/Math.max(1,(G.cloudInstances||[]).length*5));
  return Math.round(bw*Math.max(0.1,utilFactor));
}

function setCloudSLA(slaId){
  const sla=SLA_TIERS.find(s=>s.id===slaId);
  if(!sla){notify('❌ Neznámá SLA úroveň!','bad');return;}
  // Check equipment requirements
  if(sla.reqEq.length>0&&!anyDCHasEq(sla.reqEq)){
    notify(`❌ Pro ${sla.name} potřebuješ: ${sla.reqEq.map(e=>EQ[e]?.name||e).join(', ')}`,'bad');return;
  }
  G.cloudSLA=slaId;
  notify(`✅ SLA nastaveno na ${sla.name}`,'good');updUI();
}

function setCloudPriceMult(val){
  const v=Math.max(0.5,Math.min(3.0,parseFloat(val)||1.0));
  G.cloudPriceMult=v;
  updUI();
}

// ====== EMPLOYEES ======
function hireStaff(type){
  const st=STAFF_T[type];if(!st){notify('❌ Neznámý typ!','bad');return;}
  if(!G.employees)G.employees=[];
  const existing=G.employees.find(e=>e.type===type);
  if(existing){existing.count++;}
  else{G.employees.push({type,count:1});}
  notify(`✅ ${st.icon} ${st.name} najat! (${st.cost} Kč/měs)`,'good');updUI();
}
function fireStaff(type){
  if(!G.employees)return;
  const existing=G.employees.find(e=>e.type===type);
  if(!existing||existing.count<=0){notify('❌ Žádný zaměstnanec!','bad');return;}
  existing.count--;
  if(existing.count<=0)G.employees.splice(G.employees.indexOf(existing),1);
  notify(`🗑️ ${STAFF_T[type]?.name||type} propuštěn`,'good');updUI();
}
function getStaffCount(type){
  if(!G.employees)return 0;
  const e=G.employees.find(s=>s.type===type);return e?e.count:0;
}
function getStaffEffect(effType){
  let total=0;if(!G.employees)return 0;
  for(const e of G.employees){const st=STAFF_T[e.type];if(st&&st.eff===effType)total+=e.count;}
  return total;
}

// ====== TOWERS ======
function placeTower(x,y,type){
  const tt=TOWER_T[type];if(!tt){notify('❌ Neznámý typ věže!','bad');return;}
  if(G.tech<tt.minTech){notify(`❌ Potřeba ${TECHS[tt.minTech].name}!`,'bad');return;}
  // Small cells can be placed on buildings too (facade-mounted), macro towers only on roads/DC
  const hasBld=G.map[y]&&G.map[y][x]&&G.map[y][x].bld;
  const onRoadOrDC=isRoad(x,y)||G.dcs.some(d=>d.x===x&&d.y===y);
  if(tt.small){
    if(!onRoadOrDC&&!hasBld){notify('❌ Small cell na silnici, DC nebo budovu!','bad');return;}
  } else {
    if(!onRoadOrDC){notify('❌ Věž jen na silnici/DC!','bad');return;}
  }
  if(G.towers.some(t=>t.x===x&&t.y===y)){notify('❌ Zde už stojí věž!','bad');return;}
  const twCost=inflComponentCost(tt.cost);
  if(G.cash<twCost){notify(`❌ Chybí ${fmt(twCost-G.cash)} Kč!`,'bad');return;}
  // 5G NSA requires LTE anchor tower in range
  if(tt.reqAnchor==='4G'){
    const hasAnchor=G.towers.some(t=>{
      const at=TOWER_T[t.type];if(!at)return false;
      if(at.gen!=='4G'&&at.gen!=='4G+')return false;
      return Math.abs(t.x-x)+Math.abs(t.y-y)<=at.range;
    });
    if(!hasAnchor){notify('❌ 5G NSA vyžaduje LTE věž v dosahu jako kotvu!','bad');return;}
  }
  // Find nearest DC via cable
  const di=findDC(x,y);
  if(di===-1){notify('❌ Věž musí být připojena kabelem k DC!','bad');return;}
  // Tower needs a free port on the DC switch
  const netCap=getDCNetCapacity(di);
  if(netCap.usedPorts>=netCap.totalPorts){
    notify(`❌ Žádný volný port v DC! ${netCap.usedPorts}/${netCap.totalPorts} (potřeba Switch)`,'bad');return;
  }
  G.towers.push({x,y,type,dcIdx:di,clients:0});
  G.cash-=twCost;
  markCapDirty();
  notify(`✅ ${tt.icon} ${tt.name} (${tt.band||''}) · dosah ${tt.range} · max ${fmtBW(tt.maxBW)}`,'good');updUI();
}

// Count clients connected via a specific tower
function getTowerClients(twIdx){
  const tw=G.towers[twIdx];if(!tw)return 0;
  const tt=TOWER_T[tw.type];if(!tt)return 0;
  let clients=0;
  for(let dy=-tt.range;dy<=tt.range;dy++)for(let dx=-tt.range;dx<=tt.range;dx++){
    const bx=tw.x+dx,by=tw.y+dy;
    if(bx<0||bx>=MAP||by<0||by>=MAP)continue;
    if(Math.abs(dx)+Math.abs(dy)>tt.range)continue;
    const b=G.map[by][bx].bld;
    if(b&&b.connected)clients+=b.customers;
  }
  return clients;
}

// ====== IXP ======
function buyIXP(){
  if(G.hasIXP){notify('❌ Již připojeno k IXP!','bad');return;}
  const ixpCost=inflComponentCost(IXP.cost);
  if(G.cash<ixpCost){notify(`❌ Chybí ${fmt(ixpCost-G.cash)} Kč!`,'bad');return;}
  if(!anyDCHasEq(['eq_bgprouter'])){notify('❌ Potřeba BGP router v DC!','bad');return;}
  G.hasIXP=true;G.cash-=ixpCost;
  notify(`✅ ${IXP.name} peering aktivní! (+${fmtBW(IXP.bwBonus)} BW)`,'good');updUI();
}

// ====== DARK FIBER ======
function toggleDarkFiber(segKey){
  if(!G.darkFiber)G.darkFiber=[];
  const idx=G.darkFiber.indexOf(segKey);
  if(idx>=0){G.darkFiber.splice(idx,1);notify('🗑️ Dark fiber pronájem ukončen','good');}
  else{G.darkFiber.push(segKey);notify('✅ Dark fiber pronájem aktivní!','good');}
  updUI();
}

// ====== ACHIEVEMENTS ======
function checkAchievements(){
  if(!G.achievements)G.achievements=[];
  for(const ach of ACHIEVEMENTS){
    if(G.achievements.includes(ach.id))continue;
    try{if(ach.check(G)){G.achievements.push(ach.id);notify(`🏆 Achievement: ${ach.icon} ${ach.name}!`,'good');}}
    catch(e){}
  }
}

// ====== CONTRACTS ======
function acceptContract(contractId){
  if(!G.contracts)G.contracts=[];
  if(!G.completedContracts)G.completedContracts=[];
  const ct=CONTRACTS.find(c=>c.id===contractId);if(!ct){notify('❌ Neznámý kontrakt!','bad');return;}
  if(G.contracts.some(c=>c.id===contractId)){notify('❌ Kontrakt již přijat!','bad');return;}
  if(G.completedContracts.includes(contractId)){notify('❌ Kontrakt již splněn!','bad');return;}
  G.contracts.push({id:contractId,remaining:ct.months});
  notify(`📋 Kontrakt přijat: ${ct.name} (${ct.months} měs.)`,'good');updUI();
}
function checkContracts(){
  if(!G.contracts)return;
  for(let i=G.contracts.length-1;i>=0;i--){
    const c=G.contracts[i];
    const ct=CONTRACTS.find(cc=>cc.id===c.id);if(!ct)continue;
    try{
      if(ct.check(G)){
        G.cash+=ct.reward;
        if(!G.completedContracts)G.completedContracts=[];
        G.completedContracts.push(c.id);
        G.contracts.splice(i,1);
        notify(`✅ Kontrakt splněn: ${ct.name}! +${fmtKc(ct.reward)}`,'good');
      } else {
        c.remaining--;
        if(c.remaining<=0){
          G.contracts.splice(i,1);
          notify(`❌ Kontrakt vypršel: ${ct.name}`,'bad');
        }
      }
    }catch(e){}
  }
}

// ====== GENERATED CONTRACTS ======

function generateContract(){
  if(!G.generatedContracts)G.generatedContracts=[];
  // Pick random template
  const tmpl=CONTRACT_TEMPLATES[Math.floor(Math.random()*CONTRACT_TEMPLATES.length)];
  const data=tmpl.gen(G);
  const id='gen_'+Date.now()+'_'+Math.floor(Math.random()*9999);
  // Build check function from string
  const ct={
    id,name:data.name,desc:data.desc,reward:data.reward,icon:data.icon,
    months:data.months,cat:'generated',generated:true,
    checkStr:data.checkStr,
    check:new Function('g','const G=g;'+data.checkStr),
  };
  G.generatedContracts.push(ct);
  return ct;
}

function offerNewContracts(){
  // Generate contracts if pool is too small (keep 2-4 available)
  if(!G.generatedContracts)G.generatedContracts=[];
  // Count available (not accepted, not completed)
  const activeIds=new Set((G.contracts||[]).map(c=>c.id));
  const doneIds=new Set(G.completedContracts||[]);
  const available=G.generatedContracts.filter(c=>!activeIds.has(c.id)&&!doneIds.has(c.id)&&!c.expired);
  const needed=Math.max(0,3-available.length);
  for(let i=0;i<needed;i++){
    const ct=generateContract();
    notify(`📋 Nová zakázka: ${ct.icon} ${ct.name} (+${fmtKc(ct.reward)})`,'good');
  }
}

function acceptGeneratedContract(genId){
  if(!G.contracts)G.contracts=[];
  if(!G.generatedContracts)return;
  const ct=G.generatedContracts.find(c=>c.id===genId);
  if(!ct){notify('❌ Neznámá zakázka!','bad');return;}
  if(G.contracts.some(c=>c.id===genId)){notify('❌ Zakázka již přijata!','bad');return;}
  // Rebuild check function (lost during save/load)
  if(!ct.check&&ct.checkStr)ct.check=new Function('g','const G=g;'+ct.checkStr);
  G.contracts.push({id:genId,remaining:ct.months,generated:true});
  notify(`📋 Zakázka přijata: ${ct.name} (${ct.months} měs.)`,'good');updUI();
}

function checkGeneratedContracts(){
  if(!G.contracts||!G.generatedContracts)return;
  for(let i=G.contracts.length-1;i>=0;i--){
    const c=G.contracts[i];
    if(!c.generated)continue;
    let ct=G.generatedContracts.find(cc=>cc.id===c.id);
    if(!ct)continue;
    // Rebuild check function if missing (after save/load)
    if(!ct.check&&ct.checkStr)ct.check=new Function('g','const G=g;'+ct.checkStr);
    if(!ct.check)continue;
    try{
      if(ct.check(G)){
        G.cash+=ct.reward;
        if(!G.completedContracts)G.completedContracts=[];
        G.completedContracts.push(c.id);
        G.contracts.splice(i,1);
        notify(`✅ Zakázka splněna: ${ct.name}! +${fmtKc(ct.reward)}`,'good');
      } else {
        c.remaining--;
        if(c.remaining<=0){
          G.contracts.splice(i,1);
          ct.expired=true;
          notify(`❌ Zakázka vypršela: ${ct.name}`,'bad');
        }
      }
    }catch(e){}
  }
  // Remove expired generated contracts from available pool (keep last 20 for history)
  const pool=G.generatedContracts;
  if(pool.length>30){
    const expired=pool.filter(c=>c.expired);
    for(let i=0;i<expired.length&&pool.length>20;i++){
      const idx=pool.indexOf(expired[i]);
      if(idx>=0)pool.splice(idx,1);
    }
  }
}

// ====== BINDING CONTRACTS (opravdové kontrakty s penále) ======
// Rozdíl proti CONTRACTS (odměny za dosažení):
//  - Klient (B2B)
//  - Explicitní penále (≥75 % odměny) při nesplnění v termínu
//  - Deadline se odečítá i tehdy, když kontrakt ještě NEPLNÍ (ostrý čas)

function generateBindingContract(){
  if(!G.bindingOffers)G.bindingOffers=[];
  const tmpl=BINDING_TEMPLATES[Math.floor(Math.random()*BINDING_TEMPLATES.length)];
  const client=BINDING_CLIENTS[Math.floor(Math.random()*BINDING_CLIENTS.length)];
  const data=tmpl.gen(G,client);
  const id='bind_'+Date.now()+'_'+Math.floor(Math.random()*9999);
  // Guard: penalty must be ≥ 75 % odměny (user spec)
  const minPenalty=Math.round(data.reward*0.75);
  const penalty=Math.max(minPenalty,data.penalty||minPenalty);
  const ct={
    id,tmplKey:tmpl.key,
    name:data.name,client:data.client,clientIcon:data.clientIcon,
    icon:data.icon,desc:data.desc,
    reward:data.reward,penalty,
    months:data.months,
    targetN:data.targetN,
    checkStr:data.checkStr,
    check:new Function('g','const G=g;'+data.checkStr),
    offeredY:G.date.y,offeredM:G.date.m,
  };
  G.bindingOffers.push(ct);
  return ct;
}

function offerNewBindings(){
  if(!G.bindingOffers)G.bindingOffers=[];
  if(!G.bindingContracts)G.bindingContracts=[];
  // Expire old offers (≥12 měsíců)
  for(let i=G.bindingOffers.length-1;i>=0;i--){
    const o=G.bindingOffers[i];
    const monthsOld=(G.date.y-o.offeredY)*12+(G.date.m-o.offeredM);
    if(monthsOld>=12){G.bindingOffers.splice(i,1);}
  }
  // Udržuj 2–4 nabídky dostupné
  const needed=Math.max(0,3-G.bindingOffers.length);
  for(let i=0;i<needed;i++){
    const ct=generateBindingContract();
    notify(`📜 Nabídka kontraktu: ${ct.clientIcon||''} ${ct.client} — ${ct.name} (odměna ${fmtKc(ct.reward)} · penále ${fmtKc(ct.penalty)})`,'info');
  }
}

function acceptBinding(offerId){
  if(!G.bindingOffers||!G.bindingContracts)return;
  const idx=G.bindingOffers.findIndex(c=>c.id===offerId);
  if(idx<0){notify('❌ Kontrakt již není dostupný','bad');return;}
  const ct=G.bindingOffers[idx];
  if(!ct.check&&ct.checkStr)ct.check=new Function('g','const G=g;'+ct.checkStr);
  // Převod do aktivních
  const active={...ct,remaining:ct.months,acceptedY:G.date.y,acceptedM:G.date.m};
  G.bindingContracts.push(active);
  G.bindingOffers.splice(idx,1);
  notify(`✍️ Kontrakt podepsán: ${ct.client} — ${ct.name} (${ct.months} měs., penále ${fmtKc(ct.penalty)})`,'good');
  updUI();
}

function declineBinding(offerId){
  if(!G.bindingOffers)return;
  const idx=G.bindingOffers.findIndex(c=>c.id===offerId);
  if(idx<0)return;
  const ct=G.bindingOffers[idx];
  G.bindingOffers.splice(idx,1);
  notify(`🗑️ Nabídka odmítnuta: ${ct.name}`,'info');
  updUI();
}

function checkBindingContracts(){
  if(!G.bindingContracts)return;
  if(!G.bindingHistory)G.bindingHistory=[];
  for(let i=G.bindingContracts.length-1;i>=0;i--){
    const c=G.bindingContracts[i];
    // Rebuild check fn if lost (save/load)
    if(!c.check&&c.checkStr)try{c.check=new Function('g','const G=g;'+c.checkStr);}catch(e){}
    if(!c.check)continue;
    try{
      if(c.check(G)){
        // SPLNĚNO
        G.cash+=c.reward;
        G.bindingHistory.push({
          id:c.id,name:c.name,client:c.client,clientIcon:c.clientIcon,icon:c.icon,
          outcome:'won',reward:c.reward,penalty:c.penalty,
          closedY:G.date.y,closedM:G.date.m,
        });
        G.bindingContracts.splice(i,1);
        notify(`✅ Kontrakt splněn: ${c.client} · ${c.name}! +${fmtKc(c.reward)}`,'good');
      } else {
        c.remaining--;
        if(c.remaining<=0){
          // NESPLNĚNO — penále
          G.cash-=c.penalty;
          G.bindingHistory.push({
            id:c.id,name:c.name,client:c.client,clientIcon:c.clientIcon,icon:c.icon,
            outcome:'failed',reward:c.reward,penalty:c.penalty,
            closedY:G.date.y,closedM:G.date.m,
          });
          G.bindingContracts.splice(i,1);
          // Reputační trest
          if(G.companyRating&&G.companyRating>1&&Math.random()<0.35)G.companyRating=Math.max(1,G.companyRating-1);
          notify(`❌ Kontrakt NESPLNĚN: ${c.client} · ${c.name}. Penále −${fmtKc(c.penalty)}`,'bad');
        }
      }
    }catch(e){console.error('checkBindingContracts:',e);}
  }
  // Ořez historie (posledních 40)
  if(G.bindingHistory.length>40)G.bindingHistory.splice(0,G.bindingHistory.length-40);
}

// ====== COMPANY RATING ======
function updateCompanyRating(){
  let score=0;
  // Customers
  if(G.stats.cust>=50)score++;if(G.stats.cust>=200)score++;if(G.stats.cust>=500)score++;
  // Profit
  if(G.stats.inc-G.stats.exp>0)score++;if(G.stats.inc-G.stats.exp>100000)score++;
  // Satisfaction
  let satAvg=0,satN=0;
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b&&b.connected){satAvg+=b.sat;satN++;}}
  if(satN>0)satAvg/=satN;
  if(satAvg>60)score++;if(satAvg>80)score++;
  // Services
  if((G.services||[]).length>=4)score++;if((G.services||[]).length>=8)score++;
  // Coverage
  let bldT=0,bldC=0;
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b){bldT++;if(b.connected)bldC++;}}
  if(bldT>0&&bldC/bldT>.3)score++;if(bldT>0&&bldC/bldT>.6)score++;
  // Map to 1-5
  G.companyRating=Math.min(5,Math.max(1,Math.ceil(score/2.2)));
}

// ====== AI COMPETITORS ======
function aiCompetitorTick(){
  if(!G.competitorsEnabled||!G.competitors)return;

  // Globální inflační indexy (AI čte stejné jako hráč, reaguje ale přes vlastní ai.tariffInflation).
  const cInfl=(G&&G.componentInflation)||1.0;
  const sInfl=(G&&G.salaryInflation)||1.0;
  const tInfl=(G&&G.tariffInflation)||1.0;

  // Compute player's EFFECTIVE average tariff price (po valorizaci = to, co reálně zákazník platí).
  // AI se rozhoduje podle koncové ceny, ne podle nominálu z UI.
  let playerAvgPrice=500*tInfl;
  if(G.tariffs&&G.tariffs.filter(t=>t.active).length>0){
    const active=G.tariffs.filter(t=>t.active);
    playerAvgPrice=(active.reduce((s,t)=>s+t.price,0)/active.length)*tInfl;
  }
  const totalPlayerCust=Math.max(1,G.stats.cust||0);
  const totalPop=getTotalPop();
  const marketCap=Math.floor(totalPop*0.6); // saturation point

  for(const ai of G.competitors){
    if(!ai.strategy)ai.strategy=Math.random()<0.3?'premium':Math.random()<0.6?'budget':'balanced';
    if(ai.avgPrice===undefined)ai.avgPrice=500;
    if(ai.pricingMood===undefined)ai.pricingMood=0; // -1=lowering, 0=neutral, 1=raising
    if(ai.tariffInflation===undefined)ai.tariffInflation=1.0;
    if(ai.targetMargin===undefined)ai.targetMargin=ai.strategy==='premium'?0.28:ai.strategy==='budget'?0.10:0.18;
    if(ai.lastMonthMargin===undefined)ai.lastMonthMargin=ai.targetMargin;

    // === PRICING — marginal cost + target margin model, s anchor na koncovou cenu trhu ===
    // Marginal cost per customer na provoz AI je ovlivněn inflací mezd + HW (~ 60/40 mix).
    const aiMarginalCost=(20*sInfl+18*cInfl)*(ai.strategy==='premium'?1.2:ai.strategy==='budget'?0.85:1.0);
    // Strategy anchor vůči hráči (hráč je market-reference)
    const strategyAnchor=ai.strategy==='budget'?playerAvgPrice*0.82:
                         ai.strategy==='premium'?playerAvgPrice*1.25:
                         playerAvgPrice*(0.95+Math.random()*0.10);
    // Margin-based floor: ceně minimálně dost, aby pokryla náklad + cílovou marži
    const marginFloor=aiMarginalCost/(1-ai.targetMargin);
    // Valorizovaný anchor: AI si promítá vlastní tariffInflation do svých cen
    let desiredPrice=Math.max(strategyAnchor,marginFloor)*ai.tariffInflation;

    // === pricingMood: reakce na marži minulého měsíce ===
    if(ai.lastMonthMargin<ai.targetMargin*0.7)ai.pricingMood=1;       // zvedat — marže pod očekáváním
    else if(ai.lastMonthMargin>ai.targetMargin*1.4)ai.pricingMood=-1; // srazit — přeceněno, riskujeme odchod
    else ai.pricingMood=0;
    // Small monthly adjustment per mood (±3%)
    if(ai.pricingMood===1)desiredPrice*=1.03;
    else if(ai.pricingMood===-1)desiredPrice*=0.97;

    // Tvrdé stropy a podlahy škálované inflací
    const absMax=1500*tInfl, absMin=150*sInfl;
    ai.avgPrice=Math.max(absMin,Math.min(absMax,Math.round(desiredPrice)));

    // === REVENUE a MARŽE ===
    const revPerCust=Math.round(ai.avgPrice*0.85);
    const monthlyRev=ai.customers*revPerCust;
    ai.cash+=monthlyRev;

    // === EXPANSION — kapacita řízená poptávkou, ne náhodou ===
    const perDcCapacity=ai.strategy==='premium'?300:ai.strategy==='budget'?280:250;
    const currentCapacity=ai.dcs.length*perDcCapacity;
    const capacityPressure=ai.customers/Math.max(1,currentCapacity); // >0.85 = potřebuje DC

    // První DC s inflačně-škálovaným nákladem
    const firstDcCost=Math.round(100000*cInfl);
    if(ai.dcs.length===0&&ai.cash>firstDcCost){
      ai.dcs.push({bw:500,eq:['eq_router','eq_server']});
      ai.cash-=firstDcCost;
    }

    // Expanze: trigger je kombinace tlaku kapacity + hotovosti
    const smallDcCost=Math.round(250000*cInfl);
    const bigDcCost=Math.round(350000*cInfl);
    const wantDc=capacityPressure>0.80 || (ai.dcs.length<3 && ai.cash>smallDcCost*1.5);
    const expansionRoll=Math.random()<(capacityPressure>0.85?0.45:0.12)*ai.aggression;
    if(wantDc&&expansionRoll&&ai.dcs.length<8){
      const goBig=ai.strategy==='premium'&&ai.cash>bigDcCost;
      const cost=goBig?bigDcCost:smallDcCost;
      if(ai.cash>cost){
        const bwSize=goBig?2000:1000;
        const eqSet=goBig?['eq_router','eq_server','eq_firewall_pro','eq_backup']:['eq_router','eq_server','eq_firewall'];
        ai.dcs.push({bw:bwSize,eq:eqSet});
        ai.cash-=cost;
      }
    }

    // === CUSTOMER GROWTH ===
    const playerShare=totalPlayerCust/Math.max(1,totalPlayerCust+ai.customers);
    const priceAdvantage=playerAvgPrice/Math.max(1,ai.avgPrice); // >1 means AI cheaper
    const capacity=ai.dcs.length*perDcCapacity;
    const freeMarket=Math.max(0,marketCap-totalPlayerCust-ai.customers);
    if(ai.customers<capacity&&freeMarket>0){
      let growthBase=ai.aggression*4*(1+ai.dcs.length*0.5);
      if(priceAdvantage>1.1)growthBase*=1.5;
      if(priceAdvantage>1.25)growthBase*=1.8;
      if(playerShare>0.7)growthBase*=0.6;
      // Kapacitní brzda: nad 85% vlastní kapacity AI taky brzdí (nezvládá onboarding)
      if(capacityPressure>0.85)growthBase*=0.3;
      const growth=Math.max(0,Math.floor(growthBase));
      ai.customers=Math.min(capacity,ai.customers+Math.min(growth,freeMarket));
    }

    // === PRICE COMPETITION — AI cheaper → churn for player ===
    if(ai.avgPrice<playerAvgPrice*0.9){
      const diff=playerAvgPrice/ai.avgPrice-1;
      const churnPct=Math.min(0.02,diff*0.04*ai.aggression);
      if(Math.random()<0.4)churn(churnPct);
      if(Math.random()<.08){
        notify(`📉 ${ai.name} snížil ceny (${fmtKc(ai.avgPrice)}/měs) — odcházejí zákazníci!`,'bad');
      }
    }
    // Player much cheaper → AI loses customers
    if(playerAvgPrice<ai.avgPrice*0.85&&ai.customers>10){
      const loss=Math.floor(ai.customers*0.01);
      ai.customers=Math.max(0,ai.customers-loss);
    }

    // Natural churn
    ai.customers=Math.max(0,ai.customers-Math.floor(ai.customers*0.003));

    // === EXPENSES — všechny položky škálované inflací ===
    const dcUpkeep=Math.round(6000*cInfl)*ai.dcs.length;   // údržba HW, energie
    const custSupport=Math.round(28*sInfl)*ai.customers;   // lidský náklad
    const monthlyExp=dcUpkeep+custSupport;
    ai.cash-=monthlyExp;

    // Uložit marži pro pricing feedback loop příštího měsíce
    if(monthlyRev>0)ai.lastMonthMargin=(monthlyRev-monthlyExp)/monthlyRev;

    // === BANKRUPTCY — thresholds škálované inflací ===
    const softBankThresh=Math.round(-80000*cInfl);
    const softRecover=Math.round(50000*cInfl);
    const hardBankThresh=Math.round(-250000*cInfl);

    if(ai.cash<softBankThresh&&ai.dcs.length>1){
      ai.dcs.pop();
      ai.cash+=softRecover;
      ai.customers=Math.floor(ai.customers*0.7);
      notify(`📉 ${ai.name} zavřel DC — finanční potíže`,'good');
    }

    // === Full bankruptcy — AI vanishes and customers redistribute ===
    if(ai.cash<hardBankThresh&&ai.dcs.length<=1){
      ai.bankrupt=true;
      notify(`💀 ${ai.name} ZBANKROTOVAL! Zákazníci migrují na trh`,'good');
      // Redistribute their customers back to open market — boost demand
      const freed=ai.customers;
      ai.customers=0;ai.dcs=[];
      // Chance that freed customers become interested in nearby buildings
      if(freed>0){
        let added=0;
        for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
          const b=G.map[y][x].bld;
          if(!b||b.connected||b.want)continue;
          if(Math.random()<Math.min(0.35,freed/2000)){b.want=true;added++;}
          if(added>=Math.min(20,Math.ceil(freed/30)))break;
        }
      }
    }
  }

  // Clean out bankrupt competitors after redistribution
  G.competitors=G.competitors.filter(ai=>!ai.bankrupt);

  // ====== ANNOUNCEMENTS ======
  // Once per month, chance a competitor announces a strategic move
  if(Math.random()<0.15){
    const active=G.competitors.filter(ai=>!ai.bankrupt);
    if(active.length>0){
      const ai=active[Math.floor(Math.random()*active.length)];
      const aiIdx=G.competitors.indexOf(ai);
      const types=[
        {k:'expansion',txt:`🏗️ ${ai.name} plánuje expanzi do nových oblastí`},
        {k:'pricing',  txt:`💰 ${ai.name} oznámil snížení cen od příštího měsíce`},
        {k:'tech',     txt:`🔬 ${ai.name} nasadí novou technologii`},
        {k:'partnership',txt:`🤝 ${ai.name} uzavřel strategické partnerství`},
      ];
      const ann=types[Math.floor(Math.random()*types.length)];
      const endMonth=G.date.m+2; // effect in 2 months
      if(!G.competitorAnnouncements)G.competitorAnnouncements=[];
      G.competitorAnnouncements.push({aiIdx,type:ann.k,endY:G.date.y+Math.floor(endMonth/12),endM:endMonth%12,txt:ann.txt});
      notify(ann.txt,'warn');
    }
  }

  // ====== TAKEOVER OFFERS ======
  // Weak competitor (low cash, losing customers) becomes available for acquisition
  if(G.competitors.length>0&&(G.stats.cust||0)>800&&G.cash>2000000){
    for(let i=0;i<G.competitors.length;i++){
      const ai=G.competitors[i];
      if(ai.bankrupt)continue;
      // Check if already has a pending offer
      const hasOffer=(G.takeoverOffers||[]).some(o=>o.aiIdx===i);
      if(hasOffer)continue;
      // Weakness: low cash, few customers — thresholds škálují s inflací
      const weak=ai.cash<Math.round(100000*cInfl)&&ai.customers<300;
      if(weak&&Math.random()<0.15){
        // Akviziční cena = zákazníci × 4000 (valorizováno tariffInflation) + DC × 200000 (HW infl)
        const price=Math.round((ai.customers*4000*tInfl+ai.dcs.length*200000*cInfl)*1.2);
        if(!G.takeoverOffers)G.takeoverOffers=[];
        G.takeoverOffers.push({
          aiIdx:i,price,
          customers:ai.customers,dcs:ai.dcs.length,
          expiresY:G.date.y+(G.date.m>=10?1:0),
          expiresM:(G.date.m+2)%12
        });
        notify(`💼 Nabídka akvizice: ${ai.name} k prodeji za ${fmtKc(price)}`,'warn');
      }
    }
  }

  // Expire old offers
  if(G.takeoverOffers){
    G.takeoverOffers=G.takeoverOffers.filter(o=>
      o.expiresY>G.date.y||(o.expiresY===G.date.y&&o.expiresM>=G.date.m));
  }

  // ====== CARTEL RISK ======
  // If player consistently prices above reference AND competitors also expensive → regulator investigates
  if(G.competitorsEnabled&&G.competitors.length>0){
    const active=G.competitors.filter(ai=>!ai.bankrupt);
    if(active.length>=2){
      const avgCompPrice=active.reduce((s,a)=>s+(a.avgPrice||500),0)/active.length;
      // Referenční hranice pro "drahou" cenu škáluje s inflací tarifů (500 Kč v nominálu startu).
      const highRef=500*tInfl;
      const alignRef=50*tInfl;
      const playerPriceHigh=playerAvgPrice>highRef;
      const compPriceHigh=avgCompPrice>highRef;
      if(playerPriceHigh&&compPriceHigh&&Math.abs(playerAvgPrice-avgCompPrice)<alignRef){
        G.cartelRisk=Math.min(100,(G.cartelRisk||0)+3);
      } else {
        G.cartelRisk=Math.max(0,(G.cartelRisk||0)-2);
      }
      if(G.cartelRisk>=70&&Math.random()<0.1){
        const fine=Math.round(Math.max(100000,G.cash*0.05));
        G.cash-=fine;
        G.cartelRisk=30;
        notify(`⚖️ Antimonopolní úřad: pokuta ${fmtKc(fine)} za sladěné ceny!`,'bad');
      }
    }
  }
}

// Player accepts acquisition offer
function acceptTakeover(offerIdx){
  if(!G.takeoverOffers||offerIdx>=G.takeoverOffers.length)return;
  const o=G.takeoverOffers[offerIdx];
  if(G.cash<o.price){notify(`❌ Chybí ${fmt(o.price-G.cash)}!`,'bad');return;}
  const ai=G.competitors[o.aiIdx];
  if(!ai){notify('❌ Konkurent nenalezen!','bad');return;}
  G.cash-=o.price;
  // Gain customers as demand boost on existing network
  let converted=0;
  const toConvert=Math.min(o.customers,300); // cap influx
  for(let y=0;y<MAP&&converted<toConvert;y++)for(let x=0;x<MAP&&converted<toConvert;x++){
    const b=G.map[y][x].bld;
    if(!b||b.connected)continue;
    if(Math.random()<0.5){b.want=true;converted++;}
  }
  notify(`🏆 Akvizice dokončena! ${ai.name} integrován (+${converted} zájemců)`,'good');
  // Remove competitor
  G.competitors.splice(o.aiIdx,1);
  // Fix indices in remaining offers
  G.takeoverOffers=G.takeoverOffers.filter(x=>x!==o).map(x=>{
    if(x.aiIdx>o.aiIdx)x.aiIdx--;
    return x;
  });
  updUI();
}

// Player rejects offer
function rejectTakeover(offerIdx){
  if(!G.takeoverOffers||offerIdx>=G.takeoverOffers.length)return;
  G.takeoverOffers.splice(offerIdx,1);
  notify('Nabídka odmítnuta','warn');
  updUI();
}

// Helper: total population
function getTotalPop(){
  let p=0;
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;
    if(b)p+=b.pop||0;
  }
  return p;
}

// Get market share breakdown including player
function getMarketShareData(){
  const player={name:G.name||'Vy',color:'#7c3aed',customers:G.stats.cust||0,cash:G.cash||0,isPlayer:true};
  const result=[player];
  if(G.competitorsEnabled&&G.competitors){
    for(const ai of G.competitors){
      result.push({name:ai.name,color:ai.color,customers:ai.customers,cash:ai.cash,strategy:ai.strategy,avgPrice:ai.avgPrice,isPlayer:false});
    }
  }
  const total=result.reduce((s,r)=>s+r.customers,0)||1;
  for(const r of result)r.share=r.customers/total;
  return result.sort((a,b)=>b.customers-a.customers);
}

// ====== EXPANSION: MULTI-CITY ======
function unlockCity(cityIdx){
  const city=CITIES[cityIdx];if(!city){notify('❌ Neznámé město!','bad');return;}
  if(city.unlocked||(G.unlockedCities||[]).includes(city.id)){notify('❌ Již odemčeno!','bad');return;}
  if(G.stats.cust<city.minCust){notify(`❌ Potřeba ${city.minCust} zákazníků!`,'bad');return;}
  if(G.cash<city.cost){notify(`❌ Chybí ${fmt(city.cost-G.cash)} Kč!`,'bad');return;}
  if(!G.unlockedCities)G.unlockedCities=[];
  G.unlockedCities.push(city.id);G.cash-=city.cost;
  // Generate extra buildings on edges of map
  let added=0;
  for(let a=0;a<400&&added<12;a++){
    const x=Math.floor(Math.random()*MAP),y=Math.floor(Math.random()*MAP);
    if(G.map[y][x].type==='grass'&&!G.map[y][x].bld&&nb(x,y).some(([ax,ay])=>ax>=0&&ax<MAP&&ay>=0&&ay<MAP&&G.map[ay][ax].type==='road')){
      const r=Math.random(),bt=r<.3?'bigcorp':r<.5?'skyscraper':r<.7?'panel':r<.85?'factory':'shop';
      const b=BTYPES[bt],units=b.units[0]+Math.floor(Math.random()*(b.units[1]-b.units[0]+1));
      const pop=b.pop[0]+Math.floor(Math.random()*(b.pop[1]-b.pop[0]+1));
      G.map[y][x].bld={type:bt,units,pop,maxPop:Math.round(pop*1.5),connected:false,connType:null,customers:0,sat:0,tariff:null,want:Math.random()<b.demand,dcIdx:-1,svcSubs:{}};
      added++;
    }
  }
  notify(`🌆 ${city.name} odemčeno! +${added} budov`,'good');updUI();
}

// ====== IPO / STOCK MARKET ======
function doIPO(){
  if(G.ipoCompleted){notify('❌ IPO již proběhlo!','bad');return;}
  if(G.stats.cust<IPO.minCust){notify(`❌ Potřeba ${IPO.minCust} zákazníků!`,'bad');return;}
  if((G.companyRating||1)<IPO.minRating){notify(`❌ Potřeba hodnocení ${IPO.minRating}⭐!`,'bad');return;}
  const sharePrice=Math.round(IPO.sharePrice*(1+G.stats.cust/500)*(G.companyRating||1)/3);
  const shares=Math.min(IPO.maxShares,Math.round(G.stats.cust*100));
  const raised=sharePrice*Math.round(shares*.25); // Sell 25% of shares
  G.cash+=raised;
  G.ipoCompleted=true;
  G.sharePrice=sharePrice;
  G.totalShares=shares;
  notify(`🏦 IPO úspěšné! ${fmt(Math.round(shares*.25))} akcií po ${fmtKc(sharePrice)} = +${fmtKc(raised)}!`,'good');updUI();
}

function demolishObj(x,y){
  if(x<0||x>=MAP||y<0||y>=MAP)return;
  const dc=G.dcs.findIndex(d=>d.x===x&&d.y===y);
  if(dc>=0){
    G.dcs.splice(dc,1);
    G.conns=G.conns.filter(c=>c.di!==dc&&(c.di>dc?true:true));
    for(const c of G.conns)if(c.di>dc)c.di--;
    markCapDirty();
    notify('🗑️ DC odstraněno','good');updUI();return;
  }
  const cb=G.cables.findIndex(c=>(c.x1===x&&c.y1===y)||(c.x2===x&&c.y2===y)||(c.x1===x||c.x2===x||c.y1===y||c.y2===y));
  if(cb>=0){G.cables.splice(cb,1);markCapDirty();notify('🗑️ Kabel odstraněn','good');updUI();return;}
  const cn=G.conns.findIndex(c=>c.bx===x&&c.by===y);
  if(cn>=0){
    const b=G.map[y][x].bld;
    if(b){b.connected=false;b.connType=null;b.customers=0;b.tariff=null;b.tariffDist={};b.dcIdx=-1;}
    G.conns.splice(cn,1);markCapDirty();notify('🗑️ Přípojka odstraněna','good');updUI();return;
  }
  const ap=G.wifiAPs.findIndex(w=>w.x===x&&w.y===y);
  if(ap>=0){G.wifiAPs.splice(ap,1);markCapDirty();notify('🗑️ WiFi odstraněno','good');updUI();return;}
  const tw=G.towers.findIndex(t=>t.x===x&&t.y===y);
  if(tw>=0){G.towers.splice(tw,1);markCapDirty();notify('🗑️ Věž odstraněna','good');updUI();return;}
  const jn=(G.junctions||[]).findIndex(j=>j.x===x&&j.y===y);
  if(jn>=0){G.junctions.splice(jn,1);markCapDirty();notify('🗑️ Junction odstraněn','good');updUI();return;}
}

// ====== BUSINESS TENANTS ======

function spawnBizTenants(){
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;
    if(!b||!b.connected||b.customers<3)continue;
    if(!b.bizTenants)b.bizTenants=[];
    // Max tenants based on building size
    const bt=BTYPES[b.type];if(!bt)continue;
    const maxTenants=b.type==='bigcorp'?5:b.type==='skyscraper'?4:b.type==='factory'?3:b.type==='public'?2:1;
    if(b.bizTenants.length>=maxTenants)continue;
    // Check each tenant type
    for(const biz of BIZ_TENANTS){
      if(!biz.types.includes(b.type))continue;
      if(b.bizTenants.includes(biz.id))continue;
      if(Math.random()>biz.chance)continue;
      // Check connection type requirement
      if(biz.reqConn.length&&!biz.reqConn.includes(b.connType))continue;
      // Check DC equipment requirements
      const dc=G.dcs[b.dcIdx];
      if(!dc)continue;
      let eqOk=true;
      for(const req of biz.reqSvc){
        if(!eqSatisfied(dc.eq||[],req)){eqOk=false;break;}
      }
      if(!eqOk)continue;
      // Spawn!
      b.bizTenants.push(biz.id);
      notify(`🏢 ${biz.icon} ${biz.name} se nastěhoval do ${bt.name} [${x},${y}]! +${fmtBW(biz.bwMbps)} BW, +${fmtKc(biz.revMonth)}/m`,'good');
      if(b.bizTenants.length>=maxTenants)break;
    }
  }
}

function evictBizTenant(bx,by,tenantId){
  const b=G.map[by]?.[bx]?.bld;
  if(!b||!b.bizTenants)return;
  const idx=b.bizTenants.indexOf(tenantId);
  if(idx<0)return;
  const biz=BIZ_TENANTS.find(t=>t.id===tenantId);
  b.bizTenants.splice(idx,1);
  notify(`🗑️ ${biz?biz.icon:''} ${biz?biz.name:'Nájemce'} vystěhován z [${bx},${by}]`,'good');
  updUI();
}

// ====== INVESTOR SYSTEM ======

function getCompanyValuation(){
  // Simple valuation: monthly revenue × 24 + assets
  const rev=G.stats.inc||0;
  let assets=G.cash;
  for(const dc of G.dcs)assets+=DC_T[dc.type].cost;
  for(const dc of G.dcs)for(const e of(dc.eq||[])){const eq=EQ[e];if(eq)assets+=eq.cost*.5;}
  return Math.max(100000,rev*24+assets);
}

function checkInvestorOffer(){
  // Trigger when cash is significantly negative
  if(G.cash>=-50000)return; // small debt is ok
  if(G.investor)return; // already have investor
  if(G._investorOfferPending)return; // already showing offer

  const debt=Math.abs(G.cash);
  // Find appropriate offer tier
  let offer=INVESTOR_OFFERS[0];
  for(const o of INVESTOR_OFFERS){
    if(debt<=o.maxDebt){offer=o;break;}
    offer=o;
  }
  // Pick random investor
  const inv=INVESTOR_NAMES[Math.floor(Math.random()*INVESTOR_NAMES.length)];
  const valuation=getCompanyValuation();
  const cashOffer=Math.max(offer.cashBonus,Math.round(debt*1.5));

  G._investorOfferPending={
    name:inv.name,icon:inv.icon,style:inv.style,
    equityPct:offer.equityPct,
    cashOffer,
    patienceBase:inv.patienceBase,
    desc:offer.desc,
    valuation,
  };

  notify(`💼 ${inv.icon} ${inv.name} nabízí investici! Otevři nabídku v přehledu.`,'warn');
  showInvestorModal();
}

function acceptInvestor(){
  const o=G._investorOfferPending;if(!o)return;
  G.investor={
    name:o.name,icon:o.icon,style:o.style,
    equityPct:o.equityPct,
    patience:o.patienceBase,
    maxPatience:o.patienceBase,
    yearsSinceDiv:0,
    totalInvested:o.cashOffer,
    totalDivPaid:0,
    joinYear:G.date.y,
  };
  G.cash+=o.cashOffer;
  G._investorOfferPending=null;
  notify(`✅ ${o.icon} ${o.name} investoval ${fmtKc(o.cashOffer)} za ${o.equityPct}% firmy!`,'good');
  updUI();
}

function rejectInvestor(){
  G._investorOfferPending=null;
  notify('❌ Nabídka investora zamítnuta. Poraď si sám!','bad');
  updUI();
}

function showInvestorModal(){
  // Build modal HTML dynamically
  let existing=document.getElementById('investorModal');
  if(!existing){
    existing=document.createElement('div');
    existing.id='investorModal';
    document.body.appendChild(existing);
  }
  const o=G._investorOfferPending;
  if(!o){existing.style.display='none';return;}

  existing.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:10000';
  let h=`<div style="background:#0d1117;border:2px solid #f59e0b;border-radius:12px;padding:24px;max-width:450px;width:90%;color:#e0e0e0;font-family:inherit">`;
  h+=`<div style="text-align:center;font-size:28px;margin-bottom:8px">${o.icon}</div>`;
  h+=`<div style="text-align:center;font-size:16px;font-weight:700;color:#f59e0b;margin-bottom:4px">${o.name}</div>`;
  h+=`<div style="text-align:center;font-size:11px;color:#8b949e;margin-bottom:12px">${o.desc}</div>`;
  h+=`<div style="background:#161b22;border-radius:8px;padding:12px;margin-bottom:12px">`;
  h+=`<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px"><span>Tvůj dluh:</span><span style="color:#f85149;font-weight:700">${fmtKc(Math.abs(G.cash))}</span></div>`;
  h+=`<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px"><span>Nabídka investice:</span><span style="color:#3fb950;font-weight:700">+${fmtKc(o.cashOffer)}</span></div>`;
  h+=`<div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:12px"><span>Požadovaný podíl:</span><span style="color:#f59e0b;font-weight:700">${o.equityPct}%</span></div>`;
  h+=`<div style="display:flex;justify-content:space-between;font-size:12px"><span>Valuace firmy:</span><span style="color:#a78bfa">${fmtKc(o.valuation)}</span></div>`;
  h+=`</div>`;
  h+=`<div style="font-size:10px;color:#8b949e;margin-bottom:12px;line-height:1.5">`;
  h+=`Investor očekává <b style="color:#f59e0b">roční dividendy</b>. Na konci každého roku se rozhodneš, kolik vyplatíš. `;
  h+=`Pokud nevyplatíš 2 roky po sobě, investor může <b style="color:#f85149">převzít firmu</b>. `;
  h+=`Podíl investora si můžeš <b style="color:#3fb950">časem odkoupit</b> zpět.`;
  h+=`</div>`;
  h+=`<div style="display:flex;gap:8px">`;
  h+=`<button onclick="acceptInvestor();document.getElementById('investorModal').style.display='none'" style="flex:1;padding:10px;background:#1a4a1a;border:2px solid #3fb950;border-radius:8px;color:#3fb950;cursor:pointer;font-size:13px;font-weight:700">✅ Přijmout</button>`;
  h+=`<button onclick="rejectInvestor();document.getElementById('investorModal').style.display='none'" style="flex:1;padding:10px;background:#1a0a0a;border:2px solid #f85149;border-radius:8px;color:#f85149;cursor:pointer;font-size:13px;font-weight:700">❌ Odmítnout</button>`;
  h+=`</div></div>`;
  existing.innerHTML=h;
}

function showDividendModal(){
  if(!G.investor)return;
  let existing=document.getElementById('dividendModal');
  if(!existing){
    existing=document.createElement('div');
    existing.id='dividendModal';
    document.body.appendChild(existing);
  }
  const inv=G.investor;
  const valuation=getCompanyValuation();
  const suggestedDiv=Math.round(valuation*inv.equityPct/100*0.08); // ~8% yield
  const minDiv=Math.round(suggestedDiv*0.3); // minimum to keep them happy-ish

  existing.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:10000';
  let h=`<div style="background:#0d1117;border:2px solid #a78bfa;border-radius:12px;padding:24px;max-width:480px;width:90%;color:#e0e0e0;font-family:inherit">`;
  h+=`<div style="text-align:center;font-size:16px;font-weight:700;color:#a78bfa;margin-bottom:8px">📊 Roční dividendy — ${G.date.y}</div>`;
  h+=`<div style="text-align:center;font-size:12px;color:#8b949e;margin-bottom:12px">${inv.icon} ${inv.name} (${inv.equityPct}% podíl)</div>`;

  // Stats
  h+=`<div style="background:#161b22;border-radius:8px;padding:12px;margin-bottom:12px;font-size:11px">`;
  h+=`<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Valuace firmy:</span><span style="color:#a78bfa">${fmtKc(valuation)}</span></div>`;
  h+=`<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Tvůj cash:</span><span style="color:${G.cash>0?'#3fb950':'#f85149'}">${fmtKc(G.cash)}</span></div>`;
  h+=`<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Doporučená dividenda:</span><span style="color:#f59e0b">${fmtKc(suggestedDiv)}</span></div>`;
  h+=`<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Roky bez dividendy:</span><span style="color:${inv.yearsSinceDiv>0?'#f85149':'#3fb950'}">${inv.yearsSinceDiv}</span></div>`;
  // Patience indicator
  const pClr=inv.patience<=1?'#f85149':inv.patience<=2?'#f59e0b':'#3fb950';
  h+=`<div style="display:flex;justify-content:space-between"><span>Trpělivost investora:</span><span style="color:${pClr}">${'🟢'.repeat(Math.max(0,inv.patience))}${'🔴'.repeat(Math.max(0,inv.maxPatience-inv.patience))}</span></div>`;
  h+=`</div>`;

  // Warning if patience low
  if(inv.patience<=1){
    h+=`<div style="background:#1a0a0a;border:1px solid #f85149;border-radius:6px;padding:8px;margin-bottom:12px;font-size:10px;color:#f85149">⚠️ Investor je velmi nespokojený! Pokud nevyplatíš dividendy, hrozí převzetí firmy!</div>`;
  }

  // Dividend options
  h+=`<div style="font-size:10px;color:#8b949e;margin-bottom:8px">Vyber výši dividendy:</div>`;
  const options=[
    {label:'Nula',amount:0,desc:'Žádné dividendy — vše investuješ zpět',risk:'Investor ztrácí trpělivost'},
    {label:'Minimum',amount:minDiv,desc:'Minimální výplata',risk:'Investor lehce nespokojen'},
    {label:'Doporučená',amount:suggestedDiv,desc:'Standardní 8% yield',risk:'Investor spokojený'},
    {label:'Štědrá',amount:Math.round(suggestedDiv*1.5),desc:'150% doporučené',risk:'Investor velmi spokojený'},
    {label:'Velká',amount:Math.round(suggestedDiv*2.5),desc:'250% doporučené',risk:'Investor nadšený, obnoví trpělivost'},
  ];

  for(const opt of options){
    const canAfford=G.cash>=opt.amount;
    const clr=opt.amount===0?'#f85149':canAfford?'#3fb950':'#484f58';
    h+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#161b22;border:1px solid #21262d;border-radius:6px;margin-bottom:4px;${canAfford?'cursor:pointer':'opacity:.5'}" ${canAfford?`onclick="payDividend(${opt.amount});document.getElementById('dividendModal').style.display='none'"`:''}>`;
    h+=`<div style="flex:1"><div style="font-size:11px;font-weight:600;color:${clr}">${opt.label}: ${fmtKc(opt.amount)}</div>`;
    h+=`<div style="font-size:9px;color:#8b949e">${opt.desc}</div>`;
    h+=`<div style="font-size:8px;color:${opt.amount===0?'#f85149':'#6e7681'}">${opt.risk}</div></div>`;
    h+=`<span style="font-size:16px">${canAfford?'💰':'🚫'}</span>`;
    h+=`</div>`;
  }

  // Custom amount
  h+=`<div style="display:flex;gap:6px;margin-top:8px;align-items:center">`;
  h+=`<input id="divCustom" type="number" min="0" max="${G.cash}" value="${suggestedDiv}" style="flex:1;padding:6px;background:#0d1117;border:1px solid #21262d;border-radius:4px;color:#e0e0e0;font-size:11px">`;
  h+=`<button onclick="payDividend(+document.getElementById('divCustom').value);document.getElementById('dividendModal').style.display='none'" style="padding:6px 12px;background:#1a1040;border:1px solid #a78bfa;border-radius:4px;color:#a78bfa;cursor:pointer;font-size:11px">Vyplatit</button>`;
  h+=`</div>`;

  // Buyback option
  if(inv.equityPct>0&&G.cash>0){
    const buybackPrice=Math.round(valuation*0.05); // 5% costs this much
    const maxBuyback=Math.min(inv.equityPct,Math.floor(G.cash/buybackPrice)*5);
    if(maxBuyback>=5){
      h+=`<div style="border-top:1px solid #21262d;margin-top:12px;padding-top:12px">`;
      h+=`<div style="font-size:10px;color:#3fb950;font-weight:600;margin-bottom:6px">🔄 Odkup podílu</div>`;
      h+=`<div style="font-size:9px;color:#8b949e;margin-bottom:6px">Cena za 5%: ${fmtKc(buybackPrice)} · Můžeš odkoupit až ${maxBuyback}%</div>`;
      for(const pct of [5,10,15,20]){
        if(pct>maxBuyback||pct>inv.equityPct)continue;
        const cost=Math.round(buybackPrice*pct/5);
        h+=`<button onclick="buybackShares(${pct});document.getElementById('dividendModal').style.display='none'" style="padding:4px 8px;background:#0a1a0a;border:1px solid #3fb950;border-radius:4px;color:#3fb950;cursor:pointer;font-size:9px;margin-right:4px">Odkup ${pct}% za ${fmtKc(cost)}</button>`;
      }
      h+=`</div>`;
    }
  }

  h+=`</div>`;
  existing.innerHTML=h;
}

function payDividend(amount){
  if(!G.investor)return;
  amount=Math.max(0,Math.min(amount,G.cash));
  const inv=G.investor;
  const valuation=getCompanyValuation();
  const suggestedDiv=Math.round(valuation*inv.equityPct/100*0.08);

  G.cash-=amount;
  inv.totalDivPaid+=amount;
  G.dividendHistory.push({year:G.date.y,amount,decision:amount>0?'paid':'skipped'});

  if(amount===0){
    inv.yearsSinceDiv++;
    inv.patience--;
    notify(`😤 ${inv.icon} ${inv.name} je nespokojen — žádné dividendy! Trpělivost: ${inv.patience}/${inv.maxPatience}`,'bad');
  } else if(amount<suggestedDiv*0.5){
    inv.yearsSinceDiv=0;
    inv.patience=Math.max(inv.patience,inv.patience); // no change
    notify(`😐 ${inv.icon} ${inv.name}: Dividendy ${fmtKc(amount)} — pod očekáváním.`,'warn');
  } else if(amount<suggestedDiv*1.2){
    inv.yearsSinceDiv=0;
    inv.patience=Math.min(inv.maxPatience,inv.patience+1);
    notify(`😊 ${inv.icon} ${inv.name}: Dividendy ${fmtKc(amount)} — spokojený!`,'good');
  } else {
    inv.yearsSinceDiv=0;
    inv.patience=inv.maxPatience; // full reset
    notify(`🤩 ${inv.icon} ${inv.name}: Dividendy ${fmtKc(amount)} — nadšený! Plná trpělivost obnovena.`,'good');
  }

  // Check forced takeover
  if(inv.patience<=0){
    notify(`💀 ${inv.icon} ${inv.name} PŘEBÍRÁ FIRMU! Ztratil trpělivost po ${inv.yearsSinceDiv} letech bez dividend. GAME OVER!`,'bad');
    G.investor.tookOver=true;
    // Don't actually end game, but show severe penalty
    G.cash=Math.round(G.cash*0.3); // investor takes 70%
    G.investor.equityPct=Math.min(80,G.investor.equityPct+20);
    G.investor.patience=2; // reset with much higher stake
    G.investor.yearsSinceDiv=0;
  }
  updUI();
}

function buybackShares(pct){
  if(!G.investor||pct<=0)return;
  const valuation=getCompanyValuation();
  const costPer5=Math.round(valuation*0.05);
  const cost=Math.round(costPer5*pct/5);
  if(G.cash<cost){notify('❌ Nemáš dost peněz na odkup!','bad');return;}
  if(pct>G.investor.equityPct){notify('❌ Investor nemá tolik procent!','bad');return;}

  G.cash-=cost;
  G.investor.equityPct-=pct;
  G.investor.patience=Math.min(G.investor.maxPatience,G.investor.patience+1);

  if(G.investor.equityPct<=0){
    notify(`🎉 Odkoupil jsi celý podíl ${G.investor.icon} ${G.investor.name}! Firma je zase celá tvoje!`,'good');
    G.investor=null;
  } else {
    notify(`🔄 Odkoupeno ${pct}% za ${fmtKc(cost)}. ${G.investor.name} má teď ${G.investor.equityPct}%.`,'good');
  }
  updUI();
}

function investorYearCheck(){
  if(!G.investor||G.investor.tookOver)return;
  // Show dividend decision at year end
  showDividendModal();
}
