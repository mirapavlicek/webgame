// ====== INCIDENT MANAGEMENT SYSTEM ======
// Active incidents with severity, response actions, cascade propagation, learnings

const INCIDENT_CAUSES=[
  {id:'power',    label:'⚡ Výpadek napájení', respLabels:['Záložní UPS','Dieselagregát','Obnova sítě'],baseRemedy:60,eqCounter:'eq_ups'},
  {id:'hardware', label:'🔧 Selhání hardwaru', respLabels:['Diagnóza HW','Výměna součástky','Náhradní server'],baseRemedy:55,eqCounter:'eq_backup'},
  {id:'cooling',  label:'❄️ Selhání chlazení',  respLabels:['Nouzový ventilátor','Výměna čerpadla','Údržba'],baseRemedy:50,eqCounter:'eq_cooling'},
  {id:'network',  label:'🌐 Network loop/BGP',  respLabels:['Restart peer','Config rollback','Přepis do alt. cesty'],baseRemedy:40,eqCounter:'eq_bgprouter'},
  {id:'security', label:'🔓 Bezpečnostní incident',respLabels:['Izolace hrozby','Patch nasazení','Forenzní audit'],baseRemedy:70,eqCounter:'eq_firewall_pro'},
  {id:'cable',    label:'🔌 Přerušený kabel',   respLabels:['Kurýr s náhradou','Dočasný spoj','Trvalá výměna'],baseRemedy:55,eqCounter:null},
  {id:'ransomware',label:'🦠 Ransomware útok',  respLabels:['Izolace nakažených','Obnova ze zálohy','Vyjednávání'],baseRemedy:80,eqCounter:'eq_backup'},
];

// Severity levels
const INCIDENT_SEVERITY=[
  {id:'P4',label:'P4 Low',   color:'#3fb950',impactMult:0.2,durMult:0.7,baseCost:5000},
  {id:'P3',label:'P3 Medium',color:'#fbbf24',impactMult:0.5,durMult:1.0,baseCost:20000},
  {id:'P2',label:'P2 High',  color:'#f59e0b',impactMult:1.0,durMult:1.4,baseCost:60000},
  {id:'P1',label:'P1 Critical',color:'#f85149',impactMult:2.0,durMult:2.2,baseCost:150000},
];

// Response actions — cost and duration reduction
const RESPONSE_ACTIONS=[
  {id:'triage',   name:'🔍 Triage',      cost:2000, ticks:1,remedy:10,desc:'Rychlá diagnostika'},
  {id:'dispatch', name:'🚑 Vyslat tým',   cost:15000,ticks:2,remedy:25,desc:'Posádka na místě'},
  {id:'escalate', name:'📞 Eskalace',     cost:35000,ticks:3,remedy:40,desc:'Vendor support / expert'},
  {id:'overtime', name:'⏰ Přesčasy',     cost:25000,ticks:2,remedy:20,desc:'Zaměstnanci pracují přes čas'},
  {id:'failover', name:'🔄 Failover',     cost:50000,ticks:1,remedy:35,desc:'Přesměrovat na alt. DC (nutné BGP peering)'},
];

// Severity based on DC size, cause, inherent risk
function rollIncidentSeverity(dcIdx,cause){
  const dc=G.dcs[dcIdx];if(!dc)return INCIDENT_SEVERITY[0];
  const dcT=DC_T[dc.type];
  const sizeFactor=dcT?(dcT.baseBW>=10000?3:dcT.baseBW>=1000?2:1):1;
  const eqCount=(dc.eq||[]).length;
  const customers=G.conns.filter(c=>c.di===dcIdx).reduce((s,cn)=>{
    const b=G.map[cn.by]?.[cn.bx]?.bld;return s+(b?.customers||0);
  },0);
  let level=0;
  if(customers>1000)level+=2;
  else if(customers>300)level+=1;
  if(sizeFactor>=2)level++;
  if(cause.id==='ransomware'||cause.id==='security')level++;
  if(eqCount<3)level++; // poorly equipped → worse
  level+=Math.floor(Math.random()*2);
  level=Math.min(3,Math.max(0,level));
  return INCIDENT_SEVERITY[3-level]; // P4..P1
}

// Spawn a new incident — either random or chained
function spawnIncident(dcIdx,causeId,isChain){
  if(dcIdx<0||dcIdx>=G.dcs.length)return;
  const dc=G.dcs[dcIdx];
  // Cooldown — don't double-spawn on same DC
  if((G.incidents||[]).some(i=>i.dcIdx===dcIdx&&!i.resolved))return;
  const cause=INCIDENT_CAUSES.find(c=>c.id===causeId)||INCIDENT_CAUSES[Math.floor(Math.random()*INCIDENT_CAUSES.length)];
  // Learnings reduce severity
  const learning=G.incidentLearnings[cause.id]||0;
  const learningBonus=Math.min(0.5,learning*0.05);

  const severity=rollIncidentSeverity(dcIdx,cause);
  // Counter equipment halves remedy remaining
  const hasCounter=cause.eqCounter&&(dc.eq||[]).includes(cause.eqCounter);
  const baseRemedy=cause.baseRemedy*severity.durMult*(hasCounter?0.5:1)*(1-learningBonus);

  const incident={
    id:'I'+Date.now().toString(36)+Math.floor(Math.random()*1000),
    dcIdx,
    causeId:cause.id,
    severity:severity.id,
    remaining:Math.round(baseRemedy),
    maxRemaining:Math.round(baseRemedy),
    startY:G.date.y,startM:G.date.m,startD:G.date.d,
    responses:[],
    isChain:!!isChain,
    resolved:false,
    revenueLoss:0,
  };
  G.incidents.push(incident);

  // Also trigger legacy outage flag for visual cue
  if(!dc.outage)dc.outage={active:true,remaining:Math.ceil(baseRemedy/30),cause:cause.label};
  else{dc.outage.active=true;dc.outage.remaining=Math.ceil(baseRemedy/30);dc.outage.cause=cause.label;}

  notify(`🚨 ${severity.label} INCIDENT DC#${dcIdx+1} — ${cause.label}${isChain?' (kaskáda)':''}`,'bad');

  // Cascade: if severity is P1/P2 and DC is linked, chance to propagate
  if(!isChain&&(severity.id==='P1'||severity.id==='P2')&&Math.random()<0.25){
    for(const link of(G.dcLinks||[])){
      let other=-1;
      if(link.dc1===dcIdx)other=link.dc2;
      else if(link.dc2===dcIdx)other=link.dc1;
      if(other>=0&&!G.incidents.some(i=>i.dcIdx===other&&!i.resolved)){
        // Cascade chance
        if(Math.random()<0.4){
          setTimeout(()=>{try{spawnIncident(other,cause.id,true);}catch(e){}},500);
          break;
        }
      }
    }
  }
}

// Player applies response action to an incident
function applyResponse(incidentId,actionId){
  const inc=(G.incidents||[]).find(i=>i.id===incidentId);
  if(!inc){notify('❌ Incident nenalezen!','bad');return;}
  if(inc.resolved){notify('❌ Incident již vyřešen!','bad');return;}
  const action=RESPONSE_ACTIONS.find(a=>a.id===actionId);
  if(!action){notify('❌ Neznámá akce!','bad');return;}
  // Failover requires BGP peering
  if(actionId==='failover'){
    const hasPeering=(G.bgpPeerings||[]).some(p=>
      (p.dc1===inc.dcIdx||p.dc2===inc.dcIdx)&&p.active);
    if(!hasPeering){notify('❌ Failover vyžaduje BGP peering mezi DC!','bad');return;}
  }
  if(G.cash<action.cost){notify(`❌ Chybí ${fmt(action.cost-G.cash)}!`,'bad');return;}
  G.cash-=action.cost;
  inc.responses.push({actionId,at:Date.now()});
  // NOC staff boosts remedy
  const nocBoost=getStaffCount?(getStaffCount('noc')*2):0;
  inc.remaining=Math.max(0,inc.remaining-(action.remedy+nocBoost));
  notify(`🛠️ ${action.name} aplikováno na DC#${inc.dcIdx+1} (-${action.remedy+nocBoost}% zbývá)`,'good');
  if(inc.remaining<=0)resolveIncident(inc);
  updUI();
}

function resolveIncident(inc){
  inc.resolved=true;
  const dc=G.dcs[inc.dcIdx];
  if(dc&&dc.outage)dc.outage.active=false;
  // Record learning
  if(!G.incidentLearnings[inc.causeId])G.incidentLearnings[inc.causeId]=0;
  G.incidentLearnings[inc.causeId]=Math.min(10,(G.incidentLearnings[inc.causeId]||0)+1);
  // Revenue loss estimate
  const sev=INCIDENT_SEVERITY.find(s=>s.id===inc.severity)||INCIDENT_SEVERITY[0];
  const loss=Math.round(sev.baseCost*sev.impactMult);
  G.cash-=loss;
  inc.revenueLoss=(inc.revenueLoss||0)+loss;
  inc.endY=G.date.y;inc.endM=G.date.m;inc.endD=G.date.d;

  // Pokud šlo o cable incident — obnov kabel a nabídni vyšetřování
  if(inc.causeId==='cable'){
    const cut=(G.cableCuts||[]).find(c=>c.incidentId===inc.id);
    if(cut){
      G.cableCuts=G.cableCuts.filter(c=>c.incidentId!==inc.id);
      if(typeof markCapDirty==='function')markCapDirty();
      notify(`🔧 Kabel na [${cut.x1},${cut.y1}]–[${cut.x2},${cut.y2}] opraven`,'good');
      // 55 % šance, že se vyšetřování vůbec dá zahájit (policie vidí případ jako řešitelný)
      if(Math.random()<0.55){
        offerInvestigation(inc,cut);
      } else {
        notify(`🕵️ Policie odmítla případ — žádné stopy`,'warn');
      }
    }
  }

  G.incidentHistory.push(inc);
  if(G.incidentHistory.length>30)G.incidentHistory.shift();
  G.incidents=G.incidents.filter(i=>!i.resolved);
  notify(`✅ Incident DC#${inc.dcIdx+1} vyřešen! Ztráta ${fmtKc(loss)}, +1 learning (${inc.causeId})`,'good');
}

// ====== CABLE CUT + INVESTIGATIONS ======
// Náhodný řez optického/měděného kabelu — vyvolá cable incident a přidá segment do G.cableCuts
function triggerCableCut(){
  if(!G.cables||G.cables.length===0){notify('🪓 Přerušení kabelu — ale žádné nemáš','warn');return;}
  // Preferuj segmenty s provozem (ty jsou zajímavější pro hráče)
  const candidates=G.cables.map(cb=>({cb,key:segKey(cb.x1,cb.y1,cb.x2,cb.y2)}));
  // Přeskoč už přerušené segmenty
  const active=candidates.filter(c=>!(G.cableCuts||[]).some(cc=>cc.segKey===c.key));
  if(active.length===0){notify('🪓 Všechny segmenty už jsou přerušené','warn');return;}
  const pick=active[Math.floor(Math.random()*active.length)];
  const cb=pick.cb,ct=CAB_T[cb.t];
  // Najdi nejbližší DC (jehož kabelová síť úsek obsahuje) — pro přiřazení incidentu
  let dcIdx=0,bestDist=1e9;
  for(let i=0;i<G.dcs.length;i++){
    const d=G.dcs[i];const dist=Math.min(Math.abs(d.x-cb.x1)+Math.abs(d.y-cb.y1),Math.abs(d.x-cb.x2)+Math.abs(d.y-cb.y2));
    if(dist<bestDist){bestDist=dist;dcIdx=i;}
  }
  if(G.dcs.length===0){notify('🪓 Kabel přerušen, ale nemáš DC','warn');return;}
  // Spawn cable incident
  if(typeof spawnIncident!=='function')return;
  spawnIncident(dcIdx,'cable',false);
  const inc=G.incidents.find(i=>i.dcIdx===dcIdx&&i.causeId==='cable'&&!i.resolved);
  if(!inc){return;} // couldn't spawn (cooldown?)
  // Uprav remaining podle typu kabelu — silnější páteř trvá déle opravit
  const tierMult=Math.max(1,1+((ct&&ct.tier)||0)*0.3);
  inc.remaining=Math.round(inc.remaining*tierMult);
  inc.maxRemaining=inc.remaining;
  G.cableCuts.push({
    segKey:pick.key,
    x1:cb.x1,y1:cb.y1,x2:cb.x2,y2:cb.y2,
    incidentId:inc.id,
    dcIdx,
    cableType:cb.t,
    since:G.date?{y:G.date.y,m:G.date.m,d:G.date.d}:null,
  });
  if(typeof markCapDirty==='function')markCapDirty();
  // Pravděpodobná příčina — flavor text
  const causes=['bagr při výkopu','vandal','krádež mědi','potkani','stavební firma bez oznámení','nepozorný řidič'];
  inc.cableCutCause=causes[Math.floor(Math.random()*causes.length)];
  notify(`🪓 Přerušený kabel ${ct?ct.name:cb.t} — [${cb.x1},${cb.y1}]–[${cb.x2},${cb.y2}] · podezření: ${inc.cableCutCause}`,'bad');
}

// Po vyřešení cable incidentu nabídnout vyšetřování
function offerInvestigation(inc,cut){
  if(!G.investigations)G.investigations=[];
  const v={
    id:'V'+Date.now().toString(36)+Math.floor(Math.random()*1000),
    incidentId:inc.id,
    dcIdx:inc.dcIdx,
    cause:inc.cableCutCause||'neznámá příčina',
    damage:Math.max(10000,Math.round((inc.revenueLoss||0)*2.5)), // škoda = ztráta + oprava + nemajetková újma
    phase:'offered', // offered → police → caught|cold → trial → won|partial|lost
    daysLeft:0,
    claimAmount:0,
    costs:0,
    payout:0,
    startY:G.date.y,startM:G.date.m,startD:G.date.d,
  };
  G.investigations.push(v);
  notify(`🕵️ Policie nabízí vyšetřování přerušeného kabelu — škoda ${fmtKc(v.damage)}. Zahájit? (MGMT → Incidenty)`,'warn');
}

// Hráč zaplatí policii, aby pátrala po viníkovi
function startInvestigation(invId){
  const v=(G.investigations||[]).find(i=>i.id===invId);
  if(!v||v.phase!=='offered')return;
  const cost=Math.max(15000,Math.round(v.damage*0.04));
  if(G.cash<cost){notify(`❌ Chybí ${fmtKc(cost-G.cash)} na vyšetřovatele`,'bad');return;}
  G.cash-=cost;v.costs+=cost;
  v.phase='police';
  v.daysLeft=45+Math.floor(Math.random()*60); // 45-105 dní pátrání
  notify(`🕵️ Vyšetřovatel najat (${fmtKc(cost)}), pátrání běží ~${Math.round(v.daysLeft/30)} měsíců`,'info');
  if(typeof updUI==='function')updUI();
}

// Hráč případ zahodí (ušetří si čas i peníze)
function dropInvestigation(invId){
  const v=(G.investigations||[]).find(i=>i.id===invId);
  if(!v)return;
  v.phase='dropped';
  archiveInvestigation(v);
  notify(`🗑️ Případ odložen`,'info');
  if(typeof updUI==='function')updUI();
}

// Hráč podává žalobu o konkrétní částku (multiplikátor oproti skutečné škodě)
function fileLawsuit(invId,claimAmount){
  const v=(G.investigations||[]).find(i=>i.id===invId);
  if(!v||v.phase!=='caught')return;
  claimAmount=Math.max(1000,Math.round(claimAmount));
  const courtCost=Math.max(15000,Math.round(claimAmount*0.08));
  if(G.cash<courtCost){notify(`❌ Chybí ${fmtKc(courtCost-G.cash)} na soudní náklady`,'bad');return;}
  G.cash-=courtCost;v.costs+=courtCost;
  v.claimAmount=claimAmount;
  v.phase='trial';
  v.daysLeft=90+Math.floor(Math.random()*90); // 3-6 měsíců soud
  notify(`⚖️ Žaloba o ${fmtKc(claimAmount)} podána, soud ~${Math.round(v.daysLeft/30)} měsíců`,'info');
  if(typeof updUI==='function')updUI();
}

function archiveInvestigation(v){
  v.endY=G.date.y;v.endM=G.date.m;v.endD=G.date.d;
  if(!G.investigationHistory)G.investigationHistory=[];
  G.investigationHistory.push(v);
  if(G.investigationHistory.length>30)G.investigationHistory.shift();
  G.investigations=(G.investigations||[]).filter(i=>i.id!==v.id);
}

// Denní progres vyšetřování a soudů
function investigationDailyTick(){
  if(!G.investigations||G.investigations.length===0)return;
  const toArchive=[];
  for(const v of G.investigations){
    if(v.phase==='police'){
      v.daysLeft--;
      if(v.daysLeft<=0){
        // 40 % základní šance + bonus za legal team (pro zjednodušení pevně)
        const chance=0.4;
        if(Math.random()<chance){
          v.phase='caught';
          notify(`🚔 Policie našla viníka (${v.cause})! Můžeš podat žalobu v MGMT → Incidenty`,'good');
        } else {
          v.phase='cold';
          notify(`❌ Viník nenalezen — případ odložen policií`,'bad');
          toArchive.push(v);
        }
      }
    } else if(v.phase==='trial'){
      v.daysLeft--;
      if(v.daysLeft<=0){
        const ratio=v.claimAmount/Math.max(1,v.damage);
        // [fullWinThreshold, partialThreshold] — Math.random() < thresholds
        let thr;
        if(ratio<=0.5)thr=[0.70,0.93];      // skromná žaloba → většinou plný úspěch
        else if(ratio<=1.2)thr=[0.45,0.85]; // přiměřená → férové šance
        else if(ratio<=2.5)thr=[0.18,0.58]; // nafouknutá → většinou částečně
        else if(ratio<=5)thr=[0.05,0.28];   // přehnaná → převážně prohra
        else thr=[0.01,0.12];               // absurdní → prakticky jistá prohra
        const r=Math.random();
        if(r<thr[0]){
          v.phase='won';
          v.payout=v.claimAmount;
          G.cash+=v.payout;
          notify(`⚖️ VYHRÁL JSI SOUD! Soud přiznal ${fmtKc(v.payout)}`,'good');
        } else if(r<thr[1]){
          v.phase='partial';
          v.payout=Math.round(v.claimAmount*0.10);
          G.cash+=v.payout;
          notify(`⚖️ Soud rozhodl částečně — přiznáno 10% (${fmtKc(v.payout)})`,'warn');
        } else {
          v.phase='lost';
          const extra=Math.round(v.claimAmount*0.03);
          G.cash-=extra;v.costs+=extra;v.payout=-extra;
          notify(`⚖️ Prohrál jsi soud! Dodatečné náklady -${fmtKc(extra)}`,'bad');
        }
        toArchive.push(v);
      }
    }
  }
  for(const v of toArchive)archiveInvestigation(v);
}

// Daily tick — decrement incident timers
function incidentDailyTick(){
  if(!G.incidents||G.incidents.length===0)return;
  for(const inc of G.incidents){
    if(inc.resolved)continue;
    // Natural decay — slower if no response, faster with NOC
    const noc=getStaffCount?getStaffCount('noc'):0;
    const decay=0.5+noc*0.2;
    inc.remaining=Math.max(0,inc.remaining-decay);
    // Revenue loss accumulator (per day)
    const sev=INCIDENT_SEVERITY.find(s=>s.id===inc.severity)||INCIDENT_SEVERITY[0];
    inc.revenueLoss=(inc.revenueLoss||0)+Math.round(sev.baseCost*sev.impactMult*0.03);
    if(inc.remaining<=0)resolveIncident(inc);
  }
}

// Monthly chance of spontaneous incident (calibrated to replace checkRandomOutages)
function incidentMonthlyRoll(){
  if(!G.dcs||G.dcs.length===0)return;
  for(let di=0;di<G.dcs.length;di++){
    // Base probability per month, modified by NOC, equipment, learnings
    let prob=0.025;
    const dc=G.dcs[di];
    // More equipment → fewer incidents (quality investment pays off)
    const eqCount=(dc.eq||[]).length;
    prob*=Math.max(0.3,1-eqCount*0.08);
    // Staff effect
    const noc=getStaffCount?getStaffCount('noc'):0;
    prob*=Math.max(0.3,1-noc*0.15);
    // Global learnings
    const totalLearnings=Object.values(G.incidentLearnings||{}).reduce((s,v)=>s+v,0);
    prob*=Math.max(0.5,1-totalLearnings*0.02);
    if(Math.random()<prob){
      spawnIncident(di);
    }
  }
}

// Helper for UI: get open incidents sorted by severity
function getActiveIncidents(){
  if(!G.incidents)return [];
  const order={P1:0,P2:1,P3:2,P4:3};
  return G.incidents.filter(i=>!i.resolved).sort((a,b)=>(order[a.severity]||9)-(order[b.severity]||9));
}

function getIncidentLearningSummary(){
  const out=[];
  for(const c of INCIDENT_CAUSES){
    const lvl=G.incidentLearnings?.[c.id]||0;
    if(lvl>0)out.push({cause:c.id,label:c.label,level:lvl,reductionPct:Math.min(50,lvl*5)});
  }
  return out;
}
