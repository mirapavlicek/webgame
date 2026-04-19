// ====== STATE ======
let G=null;
let gameRunning=false;

function createGame(nm){
  return{
    name:nm,
    cash:500000,
    date:{y:2005,m:0,d:1},
    speed:1,
    tech:0,
    map:genMap(),
    cables:[],
    dcs:[],
    conns:[],
    dcLinks:[],
    wifiAPs:[],
    junctions:[],         // placeable on-road loadbalancer/junction nodes [{x,y,type,active}]
    tariffs:JSON.parse(JSON.stringify(DEF_TARIFFS)),
    upgrades:[],
    services:[],
    svcPrices:{},          // player-set service prices {svc_id: price}
    stats:{inc:0,exp:0,cust:0,hist:[]},
    migrationLog:[],
    ipBlocks:[],       // purchased IP blocks [{ips,mCost}]
    cloudInstances:[], // active cloud instances [{type,dcIdx,count}]
    cloudSLA:'sla_basic', // current SLA tier
    cloudCustomers:{},  // {segment_id: {count, satisfaction, lastGrowth}}
    cloudPriceMult:1.0, // player pricing multiplier (0.5 - 3.0)
    cloudReputation:60, // 0-100 — průměr nedávných SLA výsledků + recenze; ovlivňuje růst a ztráty
    cloudSLACreditM:0,  // kumulovaný SLA credit dluh v aktuálním měsíci (Kč) — odečte se na konci měsíce
    cloudOutageDaysM:0, // dny výpadku v aktuálním měsíci pro přesný výpočet SLA creditu
    employees:[],      // hired staff [{type,count}]
    towers:[],         // placed 5G/LTE towers [{x,y,type,dcIdx}]
    bgpPeerings:[],    // manual BGP peerings [{dc1,dc2,allocBW,active}]
    investor:null,     // {name,icon,equityPct,patience,maxPatience,yearsSinceDiv,totalInvested,totalDivPaid}
    dividendHistory:[], // [{year,amount,decision}]
    hasIXP:false,      // connected to IXP
    darkFiber:[],      // leased dark fiber segments [{x1,y1,x2,y2}]
    achievements:[],   // earned achievement ids
    contracts:[],      // active contracts [{id,startDate:{y,m},remaining}]
    completedContracts:[], // finished contract ids
    bindingOffers:[],  // nabídky opravdových kontraktů (s penále) [{id,...}]
    bindingContracts:[], // aktivní opravdové kontrakty [{id,...,remaining}]
    bindingHistory:[], // historie kontraktů [{id,outcome:'won'|'failed',reward?,penalty?,...}]
    companyRating:1,   // 1-5 stars
    competitorsEnabled:false,
    competitors:[],    // AI competitors [{name,color,cash,dcs,cables,customers}]
    survivedOutage:false,
    // ====== NEW SYSTEMS ======
    loans:[],              // active loans [{id,principal,remaining,monthlyPayment,apr,termMonths,startY,startM}]
    creditRating:'BBB',    // AAA..AA..A..BBB..BB..B..CCC..D (based on debt/cash/history)
    quarterlyReports:[],   // quarterly financial summaries
    incidents:[],          // active incidents [{id,dcIdx,severity,cause,ticks,responseLevel,dispatched:[],chain:[]}]
    incidentHistory:[],    // closed incidents for learnings
    incidentLearnings:{},  // {cause: level} reduces future prob by level*5%
    cableCuts:[],          // aktivní přerušení kabelů [{segKey,x1,y1,x2,y2,incidentId,dcIdx,cableType,since}]
    investigations:[],     // policejní pátrání + soudy po kabelových incidentech
    investigationHistory:[],// uzavřené case — historie výher/proher
    staffDetail:{},        // {type: {morale,xp,level,lastTrainingY}}
    trainingBudgetM:0,     // monthly training budget player sets
    competitorAnnouncements:[], // [{aiIdx,type:'expansion'|'pricing'|'tech',endMonth}]
    takeoverOffers:[],     // [{aiIdx,price,expiresY,expiresM}]
    cartelRisk:0,          // 0-100, investigation trigger above 60
    inflation:1.0,         // multiplier on baseline prices/costs (raw CPI index)
    salaryInflation:1.0,   // aplikováno na mzdy (roste 0.2–0.4× inflace/rok)
    componentInflation:1.0,// aplikováno na pořizovací + údržbové ceny HW (0.2–0.4× inflace/rok)
    tariffInflation:1.0,   // aplikováno na tarify (koncové ceny) a cloud — zpravidla 0.5–0.7× CPI
    heatmapMode:null,      // null | 'coverage' | 'utilization' | 'satisfaction'
    spriteCacheEnabled:true, // použít pre-renderované sprite budov (rychlejší render)
  };
}

function saveGame(){
  if(!G)return;
  const json=JSON.stringify(G);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`nettycoon_${G.name}_${G.date.y}.json`;
  a.click();
  URL.revokeObjectURL(url);
  notify('💾 Hra uložena!','good');
}

function loadGame(){
  document.getElementById('fileInput').click();
}

function handleLoad(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    try{
      G=JSON.parse(ev.target.result);
      // Migrations for old saves
      if(!G.dcLinks)G.dcLinks=[];
      if(!G.wifiAPs)G.wifiAPs=[];
      if(!G.migrationLog)G.migrationLog=[];
      if(!G.services)G.services=[];
      if(!G.upgrades)G.upgrades=[];
      if(!G.ipBlocks)G.ipBlocks=[];
      if(!G.cloudInstances)G.cloudInstances=[];
      if(!G.cloudSLA)G.cloudSLA='sla_basic';
      if(!G.cloudCustomers)G.cloudCustomers={};
      if(G.cloudPriceMult===undefined)G.cloudPriceMult=1.0;
      if(!G.employees)G.employees=[];
      if(!G.towers)G.towers=[];
      if(!G.junctions)G.junctions=[];
      if(G.hasIXP===undefined)G.hasIXP=false;
      if(!G.darkFiber)G.darkFiber=[];
      if(!G.achievements)G.achievements=[];
      if(!G.contracts)G.contracts=[];
      if(!G.completedContracts)G.completedContracts=[];
      if(!G.companyRating)G.companyRating=1;
      if(G.competitorsEnabled===undefined)G.competitorsEnabled=false;
      if(!G.competitors)G.competitors=[];
      if(G.survivedOutage===undefined)G.survivedOutage=false;
      if(!G.bgpPeerings)G.bgpPeerings=[];
      if(G.investor===undefined)G.investor=null;
      if(!G.dividendHistory)G.dividendHistory=[];
      if(!G.generatedContracts)G.generatedContracts=[];
      // Rebuild check functions for generated contracts (lost during JSON save/load)
      for(const ct of G.generatedContracts){
        if(ct.checkStr&&!ct.check)try{ct.check=new Function('g','const G=g;'+ct.checkStr);}catch(e){}
      }
      // Service subscription migration
      if(!G.svcPrices)G.svcPrices={};
      for(const svc of SERVICES){if(G.svcPrices[svc.id]===undefined)G.svcPrices[svc.id]=svc.revPerCust;}
      if(!G.unlockedCities)G.unlockedCities=[];
      if(G.ipoCompleted===undefined)G.ipoCompleted=false;
      // New systems migration
      if(!G.loans)G.loans=[];
      if(!G.creditRating)G.creditRating='BBB';
      if(!G.quarterlyReports)G.quarterlyReports=[];
      if(!G.incidents)G.incidents=[];
      if(!G.incidentHistory)G.incidentHistory=[];
      if(!G.incidentLearnings)G.incidentLearnings={};
      if(!G.staffDetail)G.staffDetail={};
      if(G.trainingBudgetM===undefined)G.trainingBudgetM=0;
      if(!G.competitorAnnouncements)G.competitorAnnouncements=[];
      if(!G.takeoverOffers)G.takeoverOffers=[];
      if(G.cartelRisk===undefined)G.cartelRisk=0;
      if(G.inflation===undefined)G.inflation=1.0;
      if(G.salaryInflation===undefined)G.salaryInflation=1.0;
      if(G.componentInflation===undefined)G.componentInflation=1.0;
      if(G.tariffInflation===undefined)G.tariffInflation=1.0;
      // AI konkurence — per-competitor migrace nových polí
      if(Array.isArray(G.competitors)){
        for(const ai of G.competitors){
          if(ai.tariffInflation===undefined)ai.tariffInflation=1.0;
          if(ai.targetMargin===undefined)ai.targetMargin=ai.strategy==='premium'?0.28:ai.strategy==='budget'?0.10:0.18;
          if(ai.lastMonthMargin===undefined)ai.lastMonthMargin=ai.targetMargin;
        }
      }
      if(G.cloudReputation===undefined)G.cloudReputation=60;
      if(G.cloudSLACreditM===undefined)G.cloudSLACreditM=0;
      if(G.cloudOutageDaysM===undefined)G.cloudOutageDaysM=0;
      if(!G.cableCuts)G.cableCuts=[];
      if(!G.investigations)G.investigations=[];
      if(!G.investigationHistory)G.investigationHistory=[];
      if(!G.bindingOffers)G.bindingOffers=[];
      if(!G.bindingContracts)G.bindingContracts=[];
      if(!G.bindingHistory)G.bindingHistory=[];
      if(!G.expansions)G.expansions=[];
      if(G.heatmapMode===undefined)G.heatmapMode=null;
      if(G.spriteCacheEnabled===undefined)G.spriteCacheEnabled=true;
      // Obnovit globální MAP z uložené velikosti — save z rozšířené mapy
      if(G.map&&Array.isArray(G.map)&&G.map.length>0){
        MAP=G.map.length;
        G.mapSize=MAP;
      } else if(G.mapSize){MAP=G.mapSize;}
      // Rebuild check functions for binding (lost during JSON save/load)
      for(const ct of G.bindingOffers){if(ct.checkStr&&!ct.check)try{ct.check=new Function('g','const G=g;'+ct.checkStr);}catch(e){}}
      for(const ct of G.bindingContracts){if(ct.checkStr&&!ct.check)try{ct.check=new Function('g','const G=g;'+ct.checkStr);}catch(e){}}
      for(const dc of G.dcs){
        if(!dc.outage)dc.outage={active:false,remaining:0,cause:''};
        if(!dc.bwUpgrades)dc.bwUpgrades=[];
        if(!dc.eq)dc.eq=[];
      }
      for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
        const tile=G.map[y]?.[x];
        if(tile&&tile.variant===undefined)tile.variant=Math.floor(Math.random()*4);
        const b=tile?.bld;
        if(!b)continue;
        if(b.connected&&!b.connType)b.connType='conn_adsl';
        // Migrate old tower-connected buildings from conn_vdsl to proper wireless type
        if(b.connected&&b.connType==='conn_vdsl'){
          // Check if building is in any tower range — if so, upgrade conn type
          for(const tw of(G.towers||[])){
            const twt=TOWER_T[tw.type];if(!twt)continue;
            if(Math.abs(tw.x-x)+Math.abs(tw.y-y)<=twt.range){
              b.connType=twt.maxBW>=8000?'conn_5g_mmw':twt.maxBW>=500?'conn_5g':twt.maxBW>=200?'conn_lte_a':'conn_lte';
              break;
            }
          }
        }
        if(b.dcIdx===undefined)b.dcIdx=-1;
        // Migrate old single-tariff to tariffDist
        if(b.connected&&b.customers>0&&!b.tariffDist){
          b.tariffDist={};
          if(b.tariff!==null)b.tariffDist[b.tariff]=b.customers;
        }
        if(b.connected&&!b.tariffDist)b.tariffDist={};
        // Migrate: create svcSubs from old flat adopt model
        if(!b.svcSubs)b.svcSubs={};
        if(!b.bizTenants)b.bizTenants=[];
        if(b.connected&&b.customers>0&&Object.keys(b.svcSubs).length===0&&G.services.length>0){
          for(const sid of G.services){
            const svc=SERVICES.find(s=>s.id===sid);
            if(svc){const adopt=svc.adopt[b.type]||0;b.svcSubs[sid]=Math.round(b.customers*adopt);}
          }
        }
      }
      document.getElementById('newGameModal').style.display='none';
      document.getElementById('companyName').textContent=G.name;
      zoomReset();
      calcCapacity();
      if(typeof initHeatmap==='function')initHeatmap();
      if(typeof buildSpriteCache==='function')try{buildSpriteCache();}catch(e){}
      updUI();
      if(!gameRunning){gameRunning=true;lastT=performance.now();requestAnimationFrame(gameLoop);}
      notify('📂 Hra načtena!','good');
    }catch(err){notify('❌ Chyba při načítání!','bad');console.error(err);}
  };
  r.readAsText(f);
  e.target.value='';
}

function showNewGame(){
  document.getElementById('newGameModal').style.display='flex';
}

function startNewGame(){
  const nm=document.getElementById('inputName').value||'MíraNet';
  // Reset MAP na výchozí hodnotu pro novou hru (mohla být přerostlá ze savu)
  MAP=MAP_INITIAL;
  G=createGame(nm);
  G.mapSize=MAP;
  G.expansions=[];
  // Initialize service prices from defaults
  for(const svc of SERVICES)G.svcPrices[svc.id]=svc.revPerCust;
  const compCb=document.getElementById('inputCompetitors');
  if(compCb&&compCb.checked){
    G.competitorsEnabled=true;
    G.competitors=AI_NAMES.slice(0,3).map((name,i)=>{
      const strat=Math.random()<0.3?'premium':Math.random()<0.6?'budget':'balanced';
      const targetMargin=strat==='premium'?0.28:strat==='budget'?0.10:0.18;
      return{
        name,color:AI_COLORS[i],cash:300000,dcs:[],cables:[],customers:0,satisfaction:50,
        tariffIdx:0,aggression:.3+Math.random()*.4,
        strategy:strat,avgPrice:500,pricingMood:0,
        tariffInflation:1.0,targetMargin,lastMonthMargin:targetMargin,
      };
    });
  }
  // ====== HACK: "MíraNet" = 500 000 000 Kč startovní hotovost ======
  if(nm.trim()==='MíraNet'){
    G.cash=500000000;
    setTimeout(()=>{try{notify('🔓 HACK AKTIVOVÁN — startovní hotovost 500 000 000 Kč','good');}catch(e){}},300);
  }
  // ====== HARD režim: 500 000 Kč hotovosti + 500 000 Kč úvěr na krku ======
  const hardCb=document.getElementById('inputHard');
  if(hardCb&&hardCb.checked){
    const amt=500000, apr=0.10, n=60;
    const mr=apr/12;
    const pay=Math.round(amt*(mr*Math.pow(1+mr,n))/(Math.pow(1+mr,n)-1));
    G.loans.push({
      id:'L'+Date.now().toString(36),
      product:'hard-start',
      principal:amt,
      remaining:amt,
      monthlyPayment:pay,
      apr,
      termMonths:n,
      remainingMonths:n,
      startY:G.date.y,startM:G.date.m,
      defaultCount:0,
    });
    // HARD má přednost před MíraNet cheatem → pokud oba, dluh zůstane, ale cash přebije hack
    if(nm.trim()!=='MíraNet')G.cash=500000;
    setTimeout(()=>{try{notify(`💀 HARD REŽIM — úvěr ${fmtKc(amt)} (splátka ${fmtKc(pay)}/měs, ${n} měs)`,'warn');}catch(e){}},600);
    if(typeof updateCreditRating==='function')try{updateCreditRating();}catch(e){}
  }
  document.getElementById('newGameModal').style.display='none';
  document.getElementById('companyName').textContent=nm;
  zoomReset();
  calcCapacity();
  // Seed počátečních nabídek opravdových kontraktů
  try{if(typeof offerNewBindings==='function')offerNewBindings();}catch(e){}
  if(typeof initHeatmap==='function')initHeatmap();
  if(typeof buildSpriteCache==='function')try{buildSpriteCache();}catch(e){}
  updUI();
  updateSpeedButtons();
  if(!gameRunning){gameRunning=true;lastT=performance.now();requestAnimationFrame(gameLoop);}
}
