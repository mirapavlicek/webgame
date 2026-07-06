// ====== EVENTS & POWER OUTAGES ======

// Pure: vybere index podle vah (vážený los). r ∈ [0,1) (volitelné). -1 když nic.
function weightedPick(weights, r){
  let total=0;
  for(const w of weights)total+=Math.max(0,w||0);
  if(total<=0)return -1;
  let x=(r==null?Math.random():r)*total;
  for(let i=0;i<weights.length;i++){
    const w=Math.max(0,weights[i]||0);
    if(x<w)return i;
    x-=w;
  }
  return weights.length-1;
}

// Generované události — vážený výběr závislý na éře (minYear) a kontextu (w jako
// funkce stavu). Pozdní/specifické události (DDoS, kyber) se neobjeví na startu;
// bouře jsou pravděpodobnější u rozsáhlé sítě, regulace u velkého hráče atd.
function randEvent(){
  const year=(G&&G.date)?G.date.y:2005;
  const cables=(G&&G.cables)?G.cables.length:0;
  const cust=(G&&G.stats)?(G.stats.cust||0):0;
  const dcs=(G&&G.dcs)?G.dcs.length:0;
  const e=[
    {t:'💰 EU dotace +30k!',f:()=>{G.cash+=30000;},g:1,w:1},
    {t:'⛈️ Bouřka -12k!',f:()=>{G.cash-=12000;},g:0,w:1},
    {t:'📰 Dobrý článek!',f:()=>{boostDemand(.08);},g:1,w:1},
    {t:'🔧 Havárie -20k!',f:()=>{G.cash-=20000;},g:0,w:1},
    {t:'🏗️ Nová zástavba!',f:()=>{addBlds(3);},g:1,w:1.3},
    {t:'📡 Levnější transit!',f:()=>{G.cash+=5000;},g:1,w:1},
    {t:'📊 Konkurent snížil ceny!',f:()=>{churn(.03);},g:0,w:()=>cust>200?1.2:0.4},
    {t:'🎓 Tendr na internet!',f:()=>{boostDemand(.06);},g:1,w:1},
    {t:'🔴 DDoS útok!',f:()=>{if(G.dcs.length)triggerDDoS(Math.floor(Math.random()*G.dcs.length));},g:0,minYear:2010,w:()=>dcs>0?1:0},
    {t:'🔓 Bezpečnostní hrozba!',f:()=>{triggerSecurityBreach();},g:0,minYear:2009,w:()=>dcs>0?1:0},
    {t:'📈 Dotace na digitalizaci!',f:()=>{G.cash+=80000;},g:1,minYear:2014,w:1},
    {t:'🏙️ Smart City projekt!',f:()=>{boostDemand(.1);G.cash+=20000;},g:1,minYear:2012,w:1},
    {t:'🌪️ Vichřice! Poškozeny kabely',f:()=>{triggerStormDamage();},g:0,w:()=>cables>20?1.4:0.5},
    {t:'🎥 Viral video o vašem ISP!',f:()=>{triggerViralGrowth();},g:1,minYear:2008,w:()=>cust>100?1.1:0.3},
    {t:'🏛️ Regulační kontrola',f:()=>{triggerRegulatoryCheck();},g:0,w:()=>cust>400?1.3:0.3},
    {t:'⚡ Blackout regionu',f:()=>{triggerBlackout();},g:0,w:()=>dcs>1?1:0.3},
    {t:'🎉 Nový byznys park!',f:()=>{addBlds(5);boostDemand(.12);},g:1,minYear:2010,w:1},
    {t:'🤝 Partnerství s konkurencí',f:()=>{G.cash+=Math.round(Math.max(20000,G.stats.cust*50));},g:1,w:()=>cust>150?1:0.4},
    {t:'💸 Daňová kontrola',f:()=>{G.cash-=Math.round(Math.max(10000,G.cash*0.03));},g:0,w:1},
    {t:'🔬 Inovační grant',f:()=>{G.cash+=50000;notify('→ +50k Kč na výzkum','good');},g:1,minYear:2011,w:1},
    {t:'🌐 Nový CDN peering',f:()=>{triggerCDNBoost();},g:1,minYear:2009,w:1},
    {t:'🐀 Kabel překousán!',f:()=>{triggerCableDamage(1);},g:0,w:()=>cables>5?1:0.2},
    {t:'🪓 Přerušený optický kabel!',f:()=>{if(typeof triggerCableCut==='function')triggerCableCut();},g:0,w:()=>cables>10?1:0.2},
    {t:'🏆 Anketa zákazníků: 1. místo!',f:()=>{triggerReputationBoost();},g:1,w:()=>cust>300?1.1:0.3},
    {t:'📉 Konkurence na vašem území',f:()=>{triggerCompetitorPush();},g:0,w:()=>cust>200?1.1:0.3},
    // ====== GENEROVANÉ UDÁLOSTI RŮSTU MĚSTA ======
    {t:'🏘️ Rozvoj nové čtvrti!',f:()=>{const r=(typeof extendRoads==='function')?extendRoads(2):0;const b=(typeof growCity==='function')?growCity(6):0;notify(`   → +${b} budov${r>0?' a nové ulice':''}`,'good');},g:1,minYear:2007,w:()=>cust>120?1.3:0.5},
    {t:'🏭 Nová průmyslová zóna',f:()=>{const b=(typeof growCity==='function')?growCity(4):0;boostDemand(.05);notify(`   → +${b} budov, +5% poptávka`,'good');},g:1,minYear:2008,w:()=>cust>150?1:0.3},
    // ====== PROVÁZANÉ S NOVÝMI SYSTÉMY (počasí, budovy, 6G) ======
    {t:'🌡️ Vlna veder',f:()=>{if(typeof setWeather==='function')setWeather('heatwave',0.9);notify('   → DC se přehřívají, vyšší náklady na chlazení','warn');},g:0,minYear:2006,w:0.8},
    {t:'❄️ Sněhová kalamita',f:()=>{if(typeof setWeather==='function')setWeather('storm',0.95);if(typeof triggerStormDamage==='function')triggerStormDamage();},g:0,w:()=>cables>15?1:0.4},
    {t:'🏥 Tendr nemocnice na konektivitu',f:()=>{boostDemand(.06);notify('   → zdravotnictví poptává spolehlivou síť','good');},g:1,minYear:2010,w:()=>cust>200?1:0.4},
    {t:'🎓 Univerzitní kampus se rozšiřuje',f:()=>{const b=(typeof growCity==='function')?growCity(3):0;boostDemand(.05);notify(`   → +${b} budov v okolí kampusu`,'good');},g:1,minYear:2009,w:0.7},
    {t:'🛰️ 6G pilotní projekt!',f:()=>{boostDemand(.12);G.cash+=60000;notify('   → +12% poptávka, +60k grant na 6G','good');},g:1,minYear:2035,w:1.4},
    {t:'📡 Aukce spektra',f:()=>{const fee=Math.round(Math.max(40000,G.stats.cust*40));G.cash-=fee;notify(`   → licenční poplatek ${fmtKc(fee)}`,'bad');},g:0,minYear:2013,w:()=>(G.towers&&G.towers.length>2)?1:0.3},
    {t:'💼 Velký zákazník hledá ISP',f:()=>{const bonus=Math.round(Math.max(50000,G.stats.cust*120));G.cash+=bonus;notify(`   → jednorázová zakázka +${fmtKc(bonus)}`,'good');},g:1,minYear:2008,w:()=>cust>250?1.1:0.3},
    {t:'🔌 Výpadek konkurence v regionu',f:()=>{let c=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b&&!b.want&&!b.connected&&Math.random()<0.25){b.want=true;c++;}}notify(`   → ${c} budov hledá nového providera`,'good');},g:1,minYear:2009,w:()=>cust>150?1:0.4},
  ];
  const weights=e.map(ev=>{
    if(ev.minYear&&year<ev.minYear)return 0;
    return (typeof ev.w==='function')?ev.w():(ev.w==null?1:ev.w);
  });
  const idx=weightedPick(weights);
  if(idx<0)return;
  const ev=e[idx];
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
    if(typeof addFloater==='function')addFloater(dc.x,dc.y,'⚡ '+cause,'#ff5030');
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
  if(typeof addFloater==='function')addFloater(dc.x,dc.y,'⚡ '+cause,'#ff5030');
  notify(`🔴 VÝPADEK DC${dcIdx+1}! (${cause})`,'bad');
}

function checkRandomOutages(){
  // Počasí ovlivňuje riziko výpadku (bouře/vedro = vyšší)
  const wMult=(typeof weatherOutageMultiplier==='function')?weatherOutageMultiplier():1;
  for(let di=0;di<G.dcs.length;di++){
    if(Math.random()<0.01*wMult){
      triggerPowerOutage(di);
    }
  }
}

// Pure: míra refundace tarifu za výpadek (0..~0.6 podílu měsíčního příjmu).
// Fakturace je měsíční, takže výpadek příjem NEVYNULUJE — ale podle délky se
// zákazníci mohou (a nemusí) dožadovat vrácení části peněz:
//   * < 1 den    → tolerováno, žádná refundace
//   * roste pravděpodobnost i výše s délkou (pro-rata za dny mimo provoz)
//   * UPS drží část služby → zhruba poloviční dopad
// rnd() ∈ [0,1) (volitelné) rozhoduje, zda si o vrácení vůbec řeknou.
function outageRefundRate(outageDays, hasUPS, rnd){
  rnd = rnd || Math.random;
  if(!outageDays || outageDays < 1) return 0;      // krátký výpadek se toleruje
  const monthDays = 30;
  // Pravděpodobnost dožadování: 1 den ~15 %, 3 dny ~43 %, 7+ dní ~95 %
  const demandProb = Math.min(0.95, 0.15 + (outageDays - 1) * 0.14);
  if(rnd() >= demandProb) return 0;                // "nemusí se dožadovat"
  let rate = Math.min(1, outageDays / monthDays);  // pro-rata podíl výpadku
  if(hasUPS) rate *= 0.5;                            // UPS = částečný provoz
  rate = Math.min(0.6, rate * 1.3);                 // mírný goodwill navrch, strop 60 %
  return rate;
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
        if(typeof addFloater==='function')addFloater(dc.x,dc.y,'✓ obnoveno','#3fb950');
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
