// ====== CASH FLOW vs PROFIT ======
// v0.3.0 — separace CapEx (investice) vs OpEx (provoz), factoring a dotace.
//
// Myšlenka:
//  - Hráč dosud viděl jen "Náklady/měs" ve kterých se míchaly mzdy (OpEx) s HW (CapEx).
//  - Reálně ISP mají CapEx cyklus (velké výdaje na 5–10 let) a OpEx (každý měsíc).
//  - Pro reporting rozdělujeme: trackujeme capexM/opexM/revenueM a YTD.
//  - Přidáváme dva nové finanční nástroje:
//      • Factoring — prodej příštích N měsíců příjmů factoru za 88 % okamžitě (Bridge cash).
//      • Dotace (EU/ČTÚ) — příležitostné nabídky refundace části CapEx na vybrané projekty.
//
// Kategorie CapEx: dc_build, eq_buy, tower, cable, bw_upg, cloud_compute, ixp, misc_capex
// Kategorie OpEx:  salaries, electricity, transit, maintenance, marketing, interest, misc_opex

// --- helper: zaznamenat CapEx event ---
function recordCapex(kind, amount, note){
  if(!G) return;
  if(!G.capexLog) G.capexLog=[];
  if(amount<=0) return;
  G.capexLog.push({y:G.date.y, m:G.date.m, kind, amount:Math.round(amount), note:note||''});
  if(G.capexLog.length>500) G.capexLog.shift();
  G.capexM = (G.capexM||0) + Math.round(amount);
  G.ytdCapex = (G.ytdCapex||0) + Math.round(amount);
}

// --- helper: zaznamenat OpEx event (volané z měsíčního tick) ---
function recordOpex(kind, amount){
  if(!G) return;
  if(amount<=0) return;
  if(!G.opexBreakdownM) G.opexBreakdownM={};
  G.opexBreakdownM[kind] = (G.opexBreakdownM[kind]||0) + Math.round(amount);
  G.opexM = (G.opexM||0) + Math.round(amount);
  G.ytdOpex = (G.ytdOpex||0) + Math.round(amount);
}

// --- reset měsíčních kumulátorů (voláno na začátku monthUp) ---
function cashflowMonthlyReset(){
  if(!G) return;
  G.capexM = 0;
  G.opexM = 0;
  G.opexBreakdownM = {};
}

// --- měsíční závěrka: uložit do historie a reset ---
function cashflowMonthlyClose(revenueM){
  if(!G) return;
  if(!G.cashflowHist) G.cashflowHist=[];
  // Dopočítat depreciation (rovnoměrná 60 měsíců = 5 let pro HW)
  const dep = Math.round(((G.ytdCapex||0) + (G.pastCapexPool||0)) / 60);
  G.cashflowHist.push({
    y:G.date.y, m:G.date.m,
    rev:Math.round(revenueM||0),
    opex:G.opexM||0,
    capex:G.capexM||0,
    dep,
    ebitda:Math.round((revenueM||0) - (G.opexM||0)),
    netProfit:Math.round((revenueM||0) - (G.opexM||0) - dep),
  });
  if(G.cashflowHist.length>36) G.cashflowHist.shift();
}

// --- na přelomu roku: přesunout YTD CapEx do historického poolu ---
function cashflowYearlyClose(){
  if(!G) return;
  G.pastCapexPool = (G.pastCapexPool||0) + (G.ytdCapex||0);
  G.ytdCapex = 0;
  G.ytdOpex = 0;
}

// =========== FACTORING ===========
// Player prodá factoru X měsíců budoucích příjmů za Y % okamžitě.
// Faktor dostane budoucí příjmy — hra je simuluje jako sníženou měsíční tržbu po dobu N měs.
const FACTOR_DISCOUNT = 0.88;   // 12 % haircut — standard
const FACTOR_MIN_MONTHS = 3;
const FACTOR_MAX_MONTHS = 12;

function canFactor(){
  return G && G.stats && (G.stats.inc||0) > 10000 && !G.activeFactoring;
}

// Nabídnout factoring — vrátí odhadovanou částku
function estimateFactoring(months){
  if(!G || !G.stats) return 0;
  const rev = G.stats.inc || 0;
  const n = Math.max(FACTOR_MIN_MONTHS, Math.min(FACTOR_MAX_MONTHS, months||3));
  return Math.round(rev * n * FACTOR_DISCOUNT);
}

function executeFactoring(months){
  if(!canFactor()){ try{notify('❌ Factoring nedostupný (minimální příjem 10 000 Kč/měs nebo již běží)','bad');}catch(e){} return; }
  const n = Math.max(FACTOR_MIN_MONTHS, Math.min(FACTOR_MAX_MONTHS, months||3));
  const rev = G.stats.inc || 0;
  const payout = Math.round(rev * n * FACTOR_DISCOUNT);
  G.cash += payout;
  G.activeFactoring = {
    monthsTotal: n,
    monthsRemaining: n,
    perMonthReduction: Math.round(rev), // factor bere celé očekávané příjmy
    startedY: G.date.y, startedM: G.date.m,
    payoutReceived: payout,
  };
  try{notify(`💸 Factoring ${n} měs · dostal jsi ${fmtKc(payout)}, ale příští ${n} měs budou mít sníženou tržbu`,'warn');}catch(e){}
  if(typeof updUI==='function') updUI();
}

// Aplikovat factoring na měsíční příjem (volané z monthUp PŘED zápisem do stats)
// Vrací faktor kterým se má vynásobit inc (0..1).
function factoringRevenueCut(){
  if(!G || !G.activeFactoring) return 1.0;
  const af = G.activeFactoring;
  if(af.monthsRemaining<=0){ G.activeFactoring = null; return 1.0; }
  af.monthsRemaining--;
  if(af.monthsRemaining<=0){
    try{notify('✅ Factoring uzavřen — budoucí příjmy opět tvoje','good');}catch(e){}
    G.activeFactoring = null;
  }
  // Factor bere 100 % měsíčních tržeb — v reálu by bral jen smluvené faktury,
  // zde zjednodušeno: příjmy klesnou na 0 % po dobu kontraktu.
  return 0.0;
}

// =========== DOTACE / GRANTY ===========
// Náhodné nabídky refundace části CapEx na vybrané projekty.
// Příklady: EU-COHESION (fiber do rurálních oblastí), ČTÚ-BROADBAND (věže 5G), SMART-CITY (IoT infra).
const SUBSIDY_TEMPLATES = [
  {id:'eu_rural_fiber', name:'EU Cohesion: Rural Fiber', icon:'🇪🇺',
    desc:'Refundace 60 % nákladů na optické připojení v rurálních oblastech (<10k obyvatel).',
    refundRate:0.60, maxAmount:5000000, deadlineMonths:12,
    requirement:'fiber_cables_10',
    reqDesc:'Polož ≥ 10 kabelů typu fiber v dalších 12 měsících'},
  {id:'ctu_5g', name:'ČTÚ: 5G Deployment', icon:'🏛️',
    desc:'Refundace 45 % nákladů na 5G věže (pokrytí bílých míst).',
    refundRate:0.45, maxAmount:3000000, deadlineMonths:9,
    requirement:'tower_5g_3',
    reqDesc:'Postav ≥ 3 věže s 5G modulem'},
  {id:'smart_city', name:'Smart City Grant', icon:'🏙️',
    desc:'Refundace 35 % IoT/cloud infra investic (DC + cloud uzly).',
    refundRate:0.35, maxAmount:2000000, deadlineMonths:8,
    requirement:'cloud_dc_2',
    reqDesc:'Provozuj cloud uzel ve 2 různých DC'},
  {id:'mpo_dc', name:'MPO: DC Modernizace', icon:'🏭',
    desc:'Refundace 30 % za stavbu nového DC (energetická efektivita, PUE < 1.5).',
    refundRate:0.30, maxAmount:4000000, deadlineMonths:18,
    requirement:'low_pue_dc',
    reqDesc:'DC s PUE < 1.5 (více kolaerového)'},
  {id:'nkp_education', name:'NKP: Digital Education', icon:'🎓',
    desc:'Refundace 50 % nákladů na školení zaměstnanců.',
    refundRate:0.50, maxAmount:500000, deadlineMonths:12,
    requirement:'training_spent_200k',
    reqDesc:'Utraceno ≥ 200k Kč na školení'},
];

function offerNewSubsidy(){
  if(!G) return;
  if(!G.subsidies) G.subsidies=[];
  if(!G.subsidiesCompleted) G.subsidiesCompleted={};
  // Filter out recently offered / already active
  const active = new Set(G.subsidies.filter(s=>s.status==='active').map(s=>s.id));
  const recentlyDone = new Set(Object.keys(G.subsidiesCompleted||{}));
  const pool = SUBSIDY_TEMPLATES.filter(t=>!active.has(t.id)&&!recentlyDone.has(t.id));
  if(pool.length===0) return;
  const tpl = pool[Math.floor(Math.random()*pool.length)];
  const offer = {
    id: tpl.id,
    name: tpl.name, icon: tpl.icon,
    desc: tpl.desc,
    refundRate: tpl.refundRate,
    maxAmount: tpl.maxAmount,
    deadlineY: G.date.y + Math.floor(tpl.deadlineMonths/12),
    deadlineM: (G.date.m + (tpl.deadlineMonths%12)) % 12,
    requirement: tpl.requirement,
    reqDesc: tpl.reqDesc,
    status: 'offered', // offered → active → completed/expired
    offeredY: G.date.y, offeredM: G.date.m,
    eligibleCapexBase: 0, // kolik CapEx hráč vynaložil od přijetí
  };
  G.subsidies.push(offer);
  try{notify(`${tpl.icon} Nová dotace: ${tpl.name} — ${(tpl.refundRate*100).toFixed(0)}% refundace, max ${fmtKc(tpl.maxAmount)}`,'good');}catch(e){}
}

function acceptSubsidy(subsidyId){
  if(!G || !G.subsidies) return;
  const s = G.subsidies.find(x=>x.id===subsidyId && x.status==='offered');
  if(!s){ try{notify('❌ Dotace nenalezena','bad');}catch(e){} return; }
  s.status = 'active';
  s.acceptedY = G.date.y; s.acceptedM = G.date.m;
  s.eligibleCapexBase = G.ytdCapex || 0; // startovní bod
  try{notify(`✅ Přijata dotace ${s.name}. Deadline: ${s.deadlineM+1}/${s.deadlineY}`,'good');}catch(e){}
  if(typeof updUI==='function') updUI();
}

function declineSubsidy(subsidyId){
  if(!G || !G.subsidies) return;
  G.subsidies = G.subsidies.filter(x=>!(x.id===subsidyId && x.status==='offered'));
  try{notify('Dotace odmítnuta','warn');}catch(e){}
  if(typeof updUI==='function') updUI();
}

// Ověřit, zda aktivní dotace splnila požadavek — voláno měsíčně
function checkSubsidyCompletion(s){
  if(!s || s.status!=='active') return false;
  if(s.requirement==='fiber_cables_10'){
    const fiberCables = (G.cables||[]).filter(c=>c.t && c.t.includes('fiber'));
    return fiberCables.length>=10;
  }
  if(s.requirement==='tower_5g_3'){
    const t5g = (G.towers||[]).filter(t=>t.type && t.type.includes('5g'));
    return t5g.length>=3;
  }
  if(s.requirement==='cloud_dc_2'){
    // Distinct DCs that host cloud instances
    const dcsWithCloud = new Set();
    for(const ci of (G.cloudInstances||[])) if(ci.dcIdx!=null) dcsWithCloud.add(ci.dcIdx);
    return dcsWithCloud.size>=2;
  }
  if(s.requirement==='low_pue_dc'){
    if(typeof dcPUE==='function'){
      for(const dc of G.dcs||[]){ if(dcPUE(dc)<1.5) return true; }
    }
    return false;
  }
  if(s.requirement==='training_spent_200k'){
    return (G.trainingSpent||0)>=200000;
  }
  return false;
}

function subsidyDeadlinePassed(s){
  if(!s) return false;
  if(G.date.y > s.deadlineY) return true;
  if(G.date.y===s.deadlineY && G.date.m >= s.deadlineM) return true;
  return false;
}

// Monthly tick pro dotace
function subsidiesMonthlyTick(){
  if(!G) return;
  if(!G.subsidies) G.subsidies = [];
  if(!G.subsidiesCompleted) G.subsidiesCompleted = {};
  // (a) Zkontroluj deadline a dokončení aktivních
  for(const s of G.subsidies){
    if(s.status!=='active') continue;
    if(checkSubsidyCompletion(s)){
      // Spočítej refund
      const capexSinceAcceptance = (G.ytdCapex||0) + (G.pastCapexPool||0) - (s.eligibleCapexBase||0);
      const payout = Math.min(s.maxAmount, Math.round(Math.max(0, capexSinceAcceptance) * s.refundRate));
      G.cash += payout;
      s.status = 'completed';
      s.payout = payout;
      G.subsidiesCompleted[s.id] = {y:G.date.y,m:G.date.m,payout};
      try{notify(`💰 Dotace ${s.name} vyplacena: ${fmtKc(payout)}`,'good');}catch(e){}
    } else if(subsidyDeadlinePassed(s)){
      s.status = 'expired';
      try{notify(`⌛ Dotace ${s.name} expirovala bez splnění podmínky`,'bad');}catch(e){}
    }
  }
  // (b) Prune subsidies — ponechej jen offered/active (completed/expired smaž do archivu)
  G.subsidies = G.subsidies.filter(s=>s.status==='offered'||s.status==='active');
  // (c) Příležitostně nabídni novou (šance 8 % měsíčně pokud <2 aktivní)
  const activeCount = G.subsidies.filter(s=>s.status!=='offered').length;
  const offeredCount = G.subsidies.filter(s=>s.status==='offered').length;
  if(activeCount+offeredCount<2 && Math.random()<0.08){
    offerNewSubsidy();
  }
}

// ===== UI helpers =====
function cashflowSummaryHTML(){
  if(!G) return '';
  const lastMonth = (G.cashflowHist||[]).slice(-1)[0];
  const rev = lastMonth?lastMonth.rev:0;
  const opex = lastMonth?lastMonth.opex:0;
  const capex = lastMonth?lastMonth.capex:0;
  const ebitda = lastMonth?lastMonth.ebitda:0;
  const dep = lastMonth?lastMonth.dep:0;
  const net = lastMonth?lastMonth.netProfit:0;
  let h = `<div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:8px;font-size:10px">`;
  h += `<div style="font-weight:600;color:#e6edf3;margin-bottom:4px">📊 Cash Flow vs Profit (minulý měsíc)</div>`;
  h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">`;
  h += `<div>Tržby: <b style="color:#3fb950">${fmtKc(rev)}</b></div>`;
  h += `<div>OpEx: <b style="color:#f85149">${fmtKc(opex)}</b></div>`;
  h += `<div>EBITDA: <b style="color:${ebitda>=0?'#3fb950':'#f85149'}">${fmtKc(ebitda)}</b></div>`;
  h += `<div>D&A (odpis): <b style="color:#f59e0b">${fmtKc(dep)}</b></div>`;
  h += `<div>CapEx: <b style="color:#a78bfa">${fmtKc(capex)}</b></div>`;
  h += `<div>Čistý zisk: <b style="color:${net>=0?'#3fb950':'#f85149'}">${fmtKc(net)}</b></div>`;
  h += `</div>`;
  h += `<div style="margin-top:6px;font-size:9px;color:#8b949e">EBITDA = Tržby − OpEx (cash view). Čistý zisk odečítá i D&A z CapEx (5 let).</div>`;
  h += `</div>`;
  return h;
}

function factoringPanelHTML(){
  if(!G || !G.stats) return '';
  let h = `<div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:8px;margin-top:6px">`;
  h += `<div style="font-weight:600;color:#e6edf3;margin-bottom:4px;font-size:10px">💸 Factoring</div>`;
  if(G.activeFactoring){
    const af = G.activeFactoring;
    h += `<div style="font-size:9px;color:#f85149">Běží: ${af.monthsRemaining}/${af.monthsTotal} měs. Tržby během kontraktu = 0 Kč.</div>`;
    h += `<div style="font-size:9px;color:#8b949e">Obdržel jsi ${fmtKc(af.payoutReceived)} od faktora</div>`;
  } else if(canFactor()){
    const est3 = estimateFactoring(3);
    const est6 = estimateFactoring(6);
    const est12 = estimateFactoring(12);
    h += `<div style="font-size:9px;color:#8b949e;margin-bottom:4px">Prodej budoucí tržby factoru (88 % kurs). Příští N měsíců tvé měsíční příjmy = 0.</div>`;
    h += `<div style="display:flex;gap:4px">`;
    h += `<button onclick="executeFactoring(3)" style="flex:1;padding:4px 6px;background:#1a1040;border:1px solid #7c3aed;border-radius:4px;color:#a78bfa;cursor:pointer;font-size:9px">3 měs → ${fmtKc(est3)}</button>`;
    h += `<button onclick="executeFactoring(6)" style="flex:1;padding:4px 6px;background:#1a1040;border:1px solid #7c3aed;border-radius:4px;color:#a78bfa;cursor:pointer;font-size:9px">6 měs → ${fmtKc(est6)}</button>`;
    h += `<button onclick="executeFactoring(12)" style="flex:1;padding:4px 6px;background:#1a1040;border:1px solid #7c3aed;border-radius:4px;color:#a78bfa;cursor:pointer;font-size:9px">12 měs → ${fmtKc(est12)}</button>`;
    h += `</div>`;
  } else {
    h += `<div style="font-size:9px;color:#484f58">Nedostupné (minimální příjem 10 000 Kč/měs)</div>`;
  }
  h += `</div>`;
  return h;
}

function subsidiesPanelHTML(){
  if(!G) return '';
  const subs = G.subsidies || [];
  let h = `<div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:8px;margin-top:6px">`;
  h += `<div style="font-weight:600;color:#e6edf3;margin-bottom:4px;font-size:10px">🇪🇺 Dotace &amp; granty</div>`;
  if(subs.length===0){
    h += `<div style="font-size:9px;color:#484f58">Aktuálně žádné nabídky. Obvykle přijde 1× za 1–2 roky.</div>`;
  } else {
    for(const s of subs){
      h += `<div style="border:1px solid ${s.status==='active'?'#3fb950':'#7c3aed'}55;border-radius:5px;padding:5px 7px;margin-bottom:4px;background:#0a1018">`;
      h += `<div style="display:flex;justify-content:space-between;align-items:flex-start">`;
      h += `<div style="flex:1">`;
      h += `<div style="font-size:10px;color:${s.status==='active'?'#3fb950':'#c084fc'};font-weight:600">${s.icon} ${s.name}</div>`;
      h += `<div style="font-size:9px;color:#8b949e;margin-top:2px">${s.desc}</div>`;
      h += `<div style="font-size:9px;color:#e6edf3;margin-top:2px">Podmínka: <b>${s.reqDesc}</b></div>`;
      h += `<div style="font-size:9px;color:#f59e0b;margin-top:1px">Refundace ${(s.refundRate*100).toFixed(0)}%, max ${fmtKc(s.maxAmount)} · deadline ${s.deadlineM+1}/${s.deadlineY}</div>`;
      h += `</div>`;
      if(s.status==='offered'){
        h += `<div style="display:flex;flex-direction:column;gap:3px;margin-left:6px">`;
        h += `<button onclick="acceptSubsidy('${s.id}')" style="padding:3px 6px;background:#0a2010;border:1px solid #3fb950;border-radius:4px;color:#3fb950;cursor:pointer;font-size:9px">Přijmout</button>`;
        h += `<button onclick="declineSubsidy('${s.id}')" style="padding:3px 6px;background:#1a0a0a;border:1px solid #f85149;border-radius:4px;color:#f85149;cursor:pointer;font-size:9px">Zamítnout</button>`;
        h += `</div>`;
      } else if(s.status==='active'){
        h += `<div style="font-size:9px;color:#3fb950;margin-left:6px">Aktivní ✓</div>`;
      }
      h += `</div></div>`;
    }
  }
  h += `</div>`;
  return h;
}
