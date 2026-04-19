// ====== EVENTS & POWER OUTAGES ======

function randEvent(){
  const e=[
    {t:'💰 EU dotace +30k!',f:()=>{G.cash+=30000;},g:1},
    {t:'⛈️ Bouřka -12k!',f:()=>{G.cash-=12000;},g:0},
    {t:'📰 Dobrý článek!',f:()=>{boostDemand(.08);},g:1},
    {t:'🔧 Havárie -20k!',f:()=>{G.cash-=20000;},g:0},
    {t:'🏗️ Nová zástavba!',f:()=>{addBlds(3);},g:1},
    {t:'📡 Levnější transit!',f:()=>{G.cash+=5000;},g:1},
    {t:'📊 Konkurent snížil ceny!',f:()=>{churn(.03);},g:0},
    {t:'🎓 Tendr na internet!',f:()=>{boostDemand(.06);},g:1},
    {t:'🔴 DDoS útok!',f:()=>{if(G.dcs.length)triggerDDoS(Math.floor(Math.random()*G.dcs.length));},g:0},
    {t:'🔓 Bezpečnostní hrozba!',f:()=>{triggerSecurityBreach();},g:0},
    {t:'📈 Dotace na digitalizaci!',f:()=>{G.cash+=80000;},g:1},
    {t:'🏙️ Smart City projekt!',f:()=>{boostDemand(.1);G.cash+=20000;},g:1},
    // ====== NEW EVENTS ======
    {t:'🌪️ Vichřice! Poškozeny kabely',f:()=>{triggerStormDamage();},g:0},
    {t:'🎥 Viral video o vašem ISP!',f:()=>{triggerViralGrowth();},g:1},
    {t:'🏛️ Regulační kontrola',f:()=>{triggerRegulatoryCheck();},g:0},
    {t:'⚡ Blackout regionu',f:()=>{triggerBlackout();},g:0},
    {t:'🎉 Nový byznys park!',f:()=>{addBlds(5);boostDemand(.12);},g:1},
    {t:'🤝 Partnerství s konkurencí',f:()=>{G.cash+=Math.round(Math.max(20000,G.stats.cust*50));},g:1},
    {t:'💸 Daňová kontrola',f:()=>{G.cash-=Math.round(Math.max(10000,G.cash*0.03));},g:0},
    {t:'🔬 Inovační grant',f:()=>{G.cash+=50000;notify('→ +50k Kč na výzkum','good');},g:1},
    {t:'🌐 Nový CDN peering',f:()=>{triggerCDNBoost();},g:1},
    {t:'🐀 Kabel překousán!',f:()=>{triggerCableDamage(1);},g:0},
    {t:'🪓 Přerušený optický kabel!',f:()=>{if(typeof triggerCableCut==='function')triggerCableCut();},g:0},
    {t:'🏆 Anketa zákazníků: 1. místo!',f:()=>{triggerReputationBoost();},g:1},
    {t:'📉 Konkurence na vašem území',f:()=>{triggerCompetitorPush();},g:0},
  ];
  const ev=e[Math.floor(Math.random()*e.length)];
  notify(ev.t,ev.g?'good':'bad');
  ev.f();
}

// ====== NEW EVENT HANDLERS ======

// Storm damages 2-5 random cable segments (removes them)
function triggerStormDamage(){
  if(!G.cables||G.cables.length===0){notify('   (žádné kabely k poškození)','warn');return;}
  const count=2+Math.floor(Math.random()*4);
  let removed=0,cost=0;
  for(let i=0;i<count&&G.cables.length>0;i++){
    const idx=Math.floor(Math.random()*G.cables.length);
    const cb=G.cables[idx];
    const ct=CAB_T[cb.t];
    cost+=Math.round((ct?ct.cost:1500)*0.7); // repair cost
    G.cables.splice(idx,1);
    removed++;
  }
  G.cash-=cost;
  markCapDirty();
  notify(`   → ${removed} segmentů zničeno, oprava ${fmtKc(cost)}`,'bad');
}

// 1 specific cable destroyed
function triggerCableDamage(n){
  for(let i=0;i<n&&G.cables.length;i++){
    const idx=Math.floor(Math.random()*G.cables.length);
    G.cables.splice(idx,1);
  }
  markCapDirty();
  notify(`   → Kabel opraven za ${fmtKc(3000)}`,'bad');
  G.cash-=3000;
}

// Viral growth: many buildings start wanting internet
function triggerViralGrowth(){
  let c=0;
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;
    if(b&&!b.want&&!b.connected&&Math.random()<0.35){b.want=true;c++;}
  }
  // Boost existing customers' satisfaction briefly
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;
    if(b&&b.connected)b.sat=Math.min(100,b.sat+5);
  }
  notify(`   → +${c} budov zájemců, +5 spokojenost zákazníků`,'good');
}

// Regulatory check: if player has monitoring + firewall, pass; else fine
function triggerRegulatoryCheck(){
  let hasMonitoring=false,hasFirewall=false;
  for(const dc of G.dcs){
    const eq=dc.eq||[];
    if(eq.includes('eq_monitoring'))hasMonitoring=true;
    if(eq.some(e=>e.startsWith('eq_firewall')))hasFirewall=true;
  }
  if(hasMonitoring&&hasFirewall){
    notify('   → ✅ Prošli jsme! Bonus +15k','good');
    G.cash+=15000;
  } else {
    const fine=Math.round(Math.max(25000,G.stats.cust*15));
    G.cash-=fine;
    notify(`   → ❌ Pokuta ${fmtKc(fine)} (chybí monitoring/firewall)`,'bad');
  }
}

// Regional blackout: forces outage on 1-2 DCs (less severe if UPS)
function triggerBlackout(){
  if(G.dcs.length===0)return;
  const n=Math.min(G.dcs.length,1+Math.floor(Math.random()*2));
  const chosen=new Set();
  while(chosen.size<n)chosen.add(Math.floor(Math.random()*G.dcs.length));
  for(const di of chosen)triggerPowerOutage(di);
}

// CDN boost: temporary BW bonus + satisfaction
function triggerCDNBoost(){
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;
    if(b&&b.connected)b.sat=Math.min(100,b.sat+4);
  }
  notify('   → +4 spokojenost sítě','good');
}

// Reputation boost: cash + satisfaction
function triggerReputationBoost(){
  const bonus=Math.round(Math.max(20000,G.stats.cust*30));
  G.cash+=bonus;
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;
    if(b&&b.connected)b.sat=Math.min(100,b.sat+8);
  }
  notify(`   → +${fmtKc(bonus)} a +8 spokojenost`,'good');
}

// Competitor push: churn concentrated on one DC
function triggerCompetitorPush(){
  if(G.dcs.length===0)return;
  const di=Math.floor(Math.random()*G.dcs.length);
  let lost=0;
  for(const cn of G.conns){
    if(cn.di!==di)continue;
    const b=G.map[cn.by]?.[cn.bx]?.bld;
    if(!b||!b.connected||b.customers<=0)continue;
    if(Math.random()<0.15){
      const rm=Math.min(2,b.customers);
      if(b.tariffDist)removeFromTariffDist(b,rm);
      else b.customers-=rm;
      lost+=rm;
    }
  }
  notify(`   → DC${di+1}: -${lost} zákazníků`,'bad');
}

// Map legacy OUTAGE_CAUSES labels to new incident causeIds (for MGMT response UI)
const LEGACY_CAUSE_MAP={
  'Výpadek elektřiny':'power',
  'Selhání hardwaru':'hardware',
  'Porucha chlazení':'cooling',
  'Síťový útok':'security',
};

function triggerPowerOutage(dcIdx){
  if(dcIdx<0||dcIdx>=G.dcs.length)return;
  const dc=G.dcs[dcIdx];
  if(!dc.outage)dc.outage={active:false,remaining:0,cause:''};

  const hasMonitoring=dc.eq&&dc.eq.includes('eq_monitoring');
  if(hasMonitoring&&Math.random()<0.3){
    notify(`⚠️ NMS detekoval hrozící výpadek DC${dcIdx+1}!`,'bad');
    return;
  }

  // Cooldown — don't stack legacy outage on active incident (spawnIncident already rejects this too)
  if((G.incidents||[]).some(i=>i.dcIdx===dcIdx&&!i.resolved))return;

  const cause=OUTAGE_CAUSES[Math.floor(Math.random()*OUTAGE_CAUSES.length)];
  const incidentCauseId=LEGACY_CAUSE_MAP[cause]||'power';

  // Route through unified incident system so player can respond via MGMT → Incidenty
  if(typeof spawnIncident==='function'){
    spawnIncident(dcIdx,incidentCauseId,false);
    // BGP failover: halve remaining on fresh incident if peering exists
    const inc=(G.incidents||[]).find(i=>i.dcIdx===dcIdx&&!i.resolved);
    if(inc){
      let bgpFailover=false;
      for(const peer of(G.bgpPeerings||[])){
        if(!peer.active||peer.allocBW<=0)continue;
        let other=-1;
        if(peer.dc1===dcIdx)other=peer.dc2;
        else if(peer.dc2===dcIdx)other=peer.dc1;
        if(other<0)continue;
        const otherDC=G.dcs[other];
        if(!otherDC||(otherDC.outage&&otherDC.outage.active))continue;
        bgpFailover=true;break;
      }
      if(bgpFailover){
        inc.remaining=Math.max(1,Math.ceil(inc.remaining*.4));
        inc.maxRemaining=inc.remaining;
        if(dc.outage)dc.outage.remaining=Math.max(1,Math.ceil(dc.outage.remaining*.4));
        if(dc.outage)dc.outage.bgpFailover=true;
        notify(`   → BGP failover aktivní, kratší výpadek`,'warn');
      }
    }
    return;
  }

  // Fallback: legacy direct outage (should not happen if incidents.js is loaded)
  const hasUPS=dc.eq&&dc.eq.includes('eq_ups');
  const duration=hasUPS?1+Math.floor(Math.random()*3):5+Math.floor(Math.random()*11);
  dc.outage={active:true,remaining:duration,cause};
  notify(`🔴 VÝPADEK DC${dcIdx+1}! (${cause})`,'bad');
}

function checkRandomOutages(){
  for(let di=0;di<G.dcs.length;di++){
    if(Math.random()<0.01){
      triggerPowerOutage(di);
    }
  }
}

function updateOutages(){
  for(let di=0;di<G.dcs.length;di++){
    const dc=G.dcs[di];
    if(!dc.outage)dc.outage={active:false,remaining:0,cause:''};
    if(dc.outage.active){
      // Pokud je k výpadku přiřazen aktivní incident v MGMT, nech o tempu rozhodovat incidentDailyTick/resolveIncident
      const linkedIncident=(G.incidents||[]).find(i=>i.dcIdx===di&&!i.resolved);
      if(linkedIncident){
        // Udržuj dc.outage.remaining v synchronizaci s incidentem (dny ≈ remaining/30)
        dc.outage.remaining=Math.max(1,Math.ceil(linkedIncident.remaining/30));
        continue;
      }
      dc.outage.remaining--;
      if(dc.outage.remaining<=0){
        dc.outage.active=false;
        notify(`✅ DC${di+1} obnoveno!`,'good');
      }
    }
  }
}

function boostDemand(n){
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;
    if(b&&!b.want&&Math.random()<n)b.want=true;
  }
}

function churn(n){
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;
    if(b&&b.connected&&b.customers>0&&Math.random()<n){
      if(b.tariffDist)removeFromTariffDist(b,1);
      else b.customers--;
    }
  }
}

function addBlds(n){
  let c=0;
  for(let a=0;a<200&&c<n;a++){
    const x=Math.floor(Math.random()*MAP),y=Math.floor(Math.random()*MAP);
    if(G.map[y][x].type==='grass'&&!G.map[y][x].bld&&(typeof hasPowerPlant!=='function'||!hasPowerPlant(x,y))&&nb(x,y).some(([ax,ay])=>ax>=0&&ax<MAP&&ay>=0&&ay<MAP&&G.map[ay][ax].type==='road')){
      const r=Math.random(),bt=r<.4?'house':r<.6?'rowhouse':r<.8?'panel':'shop';
      const b=BTYPES[bt],units=b.units[0]+Math.floor(Math.random()*(b.units[1]-b.units[0]+1)),pop=b.pop[0]+Math.floor(Math.random()*(b.pop[1]-b.pop[0]+1));
      G.map[y][x].bld={type:bt,units,pop,maxPop:Math.round(pop*1.5),connected:false,connType:null,customers:0,sat:0,tariff:null,want:Math.random()<b.demand,dcIdx:-1};
      c++;
    }
  }
}

// ====== DDoS & SECURITY EVENTS ======
function triggerDDoS(dcIdx){
  if(dcIdx<0||dcIdx>=G.dcs.length)return;
  const dc=G.dcs[dcIdx];
  // Find best firewall tier in this DC
  let bestBlock=0;
  for(const e of(dc.eq||[])){
    const eq=EQ[e];if(eq&&eq.ddosBlock&&eq.ddosBlock>bestBlock)bestBlock=eq.ddosBlock;
  }
  if(Math.random()<bestBlock){
    notify(`🛡️ DDoS útok na DC#${dcIdx+1} zablokován! (${Math.round(bestBlock*100)}% ochrana)`,'good');
    return;
  }
  // DDoS hits — customers lose satisfaction, some revenue lost
  const dmg=Math.round((1-bestBlock)*30);
  notify(`🔴 DDoS útok na DC#${dcIdx+1}! -${dmg}% spokojenost`,'bad');
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;if(!b||!b.connected)continue;
    const cn=G.conns.find(c=>c.bx===x&&c.by===y);
    if(cn&&cn.di===dcIdx)b.sat=Math.max(0,b.sat-dmg*(1-bestBlock));
  }
  G.cash-=Math.round(5000*(1-bestBlock));
}

function triggerSecurityBreach(){
  // Random DC
  if(G.dcs.length===0)return;
  const dcIdx=Math.floor(Math.random()*G.dcs.length);
  const dc=G.dcs[dcIdx];
  let bestFw=0;
  for(const e of(dc.eq||[])){const eq=EQ[e];if(eq&&eq.fwTier&&eq.fwTier>bestFw)bestFw=eq.fwTier;}
  if(bestFw>=2&&Math.random()<.5){
    notify(`🛡️ Bezpečnostní hrozba na DC#${dcIdx+1} odvrácena (FW tier ${bestFw})`,'good');return;
  }
  const fine=bestFw===0?50000:bestFw===1?20000:5000;
  G.cash-=fine;
  notify(`🔓 Bezpečnostní incident DC#${dcIdx+1}! Pokuta -${fmtKc(fine)}`,'bad');
  // NOC operators reduce damage
  const nocCount=getStaffCount('noc');
  if(nocCount>0){G.cash+=Math.round(fine*0.3*nocCount);notify(`📊 NOC zmírnil škody (+${fmtKc(Math.round(fine*0.3*nocCount))})`,'good');}
}

function handleCustomerMigration(){
  for(let y=0;y<MAP;y++){
    for(let x=0;x<MAP;x++){
      const b=G.map[y][x].bld;
      if(!b||!b.connected||b.dcIdx===-1)continue;

      const cn=G.conns.find(c=>c.bx===x&&c.by===y);
      if(!cn)continue;

      const currentDC=dcLoads[cn.di];
      if(!currentDC||currentDC.ratio<0.9)continue;

      let bestAlt=-1,bestAltLoad=Infinity;
      for(const link of G.dcLinks){
        let other=-1;
        if(link.dc1===cn.di)other=link.dc2;
        else if(link.dc2===cn.di)other=link.dc1;

        if(other>=0){
          const altLoad=dcLoads[other];
          if(altLoad&&altLoad.ratio<0.6&&altLoad.ratio<bestAltLoad){
            bestAlt=other;
            bestAltLoad=altLoad.ratio;
          }
        }
      }

      if(bestAlt>=0){
        const migrateCount=Math.floor(b.customers*0.08);
        if(migrateCount>0){
          if(b.tariffDist)removeFromTariffDist(b,migrateCount);
          else b.customers-=migrateCount;
          const altConn=G.conns.find(c=>c.di===bestAlt&&c.bx===x&&c.by===y);
          if(altConn){
            const logEntry={from:cn.di,to:bestAlt,building:`${x},${y}`,customers:migrateCount};
            G.migrationLog.push(logEntry);
            if(G.migrationLog.length>10)G.migrationLog.shift();
          }
        }
      }
    }
  }
}
