// ====== ŘÍDÍCÍ CENTRUM (NOC / Control Center) ======
// Nadstavba hry: grafický dohled nad sítí. Sdružuje prestiž providera, QoS
// politiku, adresní plány (IP), přehled DC/linek, WiFi a aktivní výpadky.
// Filozofie: když síť udržíš funkční (uptime, nízká kongesce, spokojenost,
// dostatek adres), prestiž roste; při výpadcích a přetížení klesá. Prestiž
// mírně ovlivňuje růst zákazníků a kvalitu nabídek.

// ---- QoS politiky ----
// Aktivní řízení provozu (QoS) zmírní dopad kongesce na růst, ale stojí provoz.
const QOS_PROFILES = {
  off:      { name: 'Bez QoS',        icon: '⚪', congMult: 1.00, mCostPerDC: 0,     prestige: 0 },
  managed:  { name: 'Řízené QoS',     icon: '🟢', congMult: 0.75, mCostPerDC: 1500,  prestige: 4 },
  strict:   { name: 'Přísné QoS/SLA', icon: '🔵', congMult: 0.55, mCostPerDC: 4000,  prestige: 8 },
};

// Pure: násobitel dopadu kongesce podle QoS profilu (nižší = QoS tlumí kongesci).
function qosCongestionFactor(profile){
  const p = QOS_PROFILES[profile] || QOS_PROFILES.off;
  return p.congMult;
}
// Pure: měsíční náklad QoS podle profilu a počtu DC.
function qosMonthlyCost(profile, dcCount){
  const p = QOS_PROFILES[profile] || QOS_PROFILES.off;
  return Math.max(0, (p.mCostPerDC || 0) * (dcCount || 0));
}

// ---- Adresní plán (IP) ----
// Pure: spočítá využití IP adres. Každá přípojka potřebuje adresu, věž/AP také.
// Vrací {total, used, free, util (0..1), headroom (0..1)}.
function addressingPlan(totalIPs, connections, towers, wifiAPs){
  const total = Math.max(0, totalIPs || 0);
  const used = Math.max(0, (connections || 0) + (towers || 0) + (wifiAPs || 0));
  const free = Math.max(0, total - used);
  const util = total > 0 ? Math.min(1, used / total) : (used > 0 ? 1 : 0);
  const headroom = total > 0 ? Math.max(0, 1 - used / total) : 0;
  return { total, used, free, util, headroom };
}

// ---- Prestiž ----
// Pure: cílová prestiž 0..100 z metrik funkčnosti sítě. m = {
//   uptime01, satisfaction01, congestion01, addrHeadroom01, qosPrestige (0..8) }.
function computePrestige(m){
  m = m || {};
  const uptime = clamp01(m.uptime01 != null ? m.uptime01 : 1);
  const sat = clamp01(m.satisfaction01 != null ? m.satisfaction01 : 0.5);
  const cong = clamp01(m.congestion01 || 0);
  const addr = clamp01(m.addrHeadroom01 != null ? m.addrHeadroom01 : 1);
  const qos = Math.max(0, Math.min(8, m.qosPrestige || 0));
  const score =
      uptime * 35 +
      sat * 30 +
      (1 - cong) * 20 +
      addr * 7 +
      qos;                    // 0..8 přímo body
  return Math.max(0, Math.min(100, Math.round(score)));
}
function clamp01(x){ return Math.max(0, Math.min(1, x)); }

// Pure: plynulý posun aktuální prestiže k cílové (setrvačnost reputace).
function smoothPrestige(current, target, rate){
  const c = (current == null) ? target : current;
  const r = (rate == null) ? 0.25 : rate;
  return c + (target - c) * r;
}

// Pure: prestiž → malý multiplikátor růstu zákazníků (0.9 .. 1.15).
function prestigeGrowthMultiplier(prestige){
  const p = Math.max(0, Math.min(100, prestige || 0));
  return 0.9 + (p / 100) * 0.25;
}

// ---- Štěstí lidí ----
// Buckety spokojenosti připojených budov. Pořadí od nejšťastnějších —
// satBucketId vrací první bucket, jehož min je ≤ sat.
const SAT_BUCKETS = [
  { id: 'happy',    min: 70, name: 'Šťastní',     icon: '😊', clr: '#3fb950' },
  { id: 'content',  min: 40, name: 'Spokojení',   icon: '🙂', clr: '#22d3ee' },
  { id: 'unhappy',  min: 20, name: 'Nespokojení', icon: '😕', clr: '#f5a524' },
  { id: 'critical', min: 0,  name: 'Naštvaní',    icon: '😡', clr: '#f86963' },
];
function satBucketId(sat){
  const s = Math.max(0, Math.min(100, sat || 0));
  for (const b of SAT_BUCKETS) if (s >= b.min) return b.id;
  return 'critical';
}

// Pure: rozklad spokojenosti ze seznamu {sat, customers}. Vrací počty budov
// i zákazníků v bucketech, prostý průměr (avg) a zákaznicky vážený průměr
// (wAvg) — velký panelák s 60 lidmi váží víc než prázdný domek.
function satBreakdownFromList(list){
  const out = { n: 0, customers: 0, avg: 0, wAvg: 0, buckets: {} };
  for (const b of SAT_BUCKETS) out.buckets[b.id] = { blds: 0, customers: 0 };
  let sum = 0, wSum = 0, w = 0;
  for (const it of (list || [])){
    const sat = Math.max(0, Math.min(100, it.sat || 0));
    const cust = Math.max(0, it.customers || 0);
    out.n++; out.customers += cust;
    sum += sat;
    const wt = 1 + cust;
    wSum += sat * wt; w += wt;
    const bk = out.buckets[satBucketId(sat)];
    bk.blds++; bk.customers += cust;
  }
  out.avg = out.n > 0 ? sum / out.n : 0;
  out.wAvg = w > 0 ? wSum / w : 0;
  return out;
}

// Katalog příčin nespokojenosti: krátký label + srozumitelné vysvětlení
// s konkrétním návodem, co udělat. Čísla odpovídají mechanice v main.js.
const SAT_ISSUE_DEFS = {
  outage:  { label: '🔌 výpadek datacentra',
             fix: 'DC, na které je budova napojená, má aktivní incident. Vyřeš ho v Mgmt → Incidenty. 🔧 Technici výpadky zkracují, 📊 NOC operátoři a monitoring jim předchází.' },
  cong:    { label: '🚦 přetížená trasa do DC',
             fix: 'Data budovy tečou trasou nad 70 % kapacity — spokojenost padá. Polož na trasu další/lepší kabel (kabely se sčítají), kup BW upgrade v panelu Síť, nebo rozděl provoz polním load balancerem.' },
  price2:  { label: '💸 silně předražený tarif',
             fix: 'Zákazníci platí přes 160 % férové ceny — spokojenost padá rychle a lidi odcházejí. Otevři 💳 Cenové centrum (klik na 😊 nahoře) a stlač cenu tlačítkem „ref".' },
  price1:  { label: '💰 dražší tarif',
             fix: 'Cena je nad 115 % férové ceny (reference) — spokojenost pomalu klesá. V 💳 Cenovém centru cenu sniž, nebo nabídni rychlejší tarif za stejné peníze.' },
  wifi:    { label: '📶 jen WiFi přípojka',
             fix: 'WiFi je sdílené a nestabilní — ubírá 0,5 spokojenosti měsíčně. Až to půjde, nahraď kabelovou přípojkou (koax/DSL/optika) přes nástroj Přípojky.' },
  weakdc:  { label: '🧰 chybí Server/NMS v DC',
             fix: 'Vybavení v racku DC přidává spokojenost všem připojeným: 🖥️ Server +2/měs, 📊 NMS monitoring +2, 🛡️ Firewall +1,5, 🔋 UPS +1,5, 💾 Backup +1. Tomuhle DC chybí Server nebo NMS — dokup je v detailu DC.' },
  nosvc:   { label: '📺 žádné doplňkové služby',
             fix: 'Nikdo v budově nemá IPTV, VoIP ani jiné služby — předplatitelé služeb jsou spokojenější (až +3/měs). Aktivuj služby v záložce Služby a hlídej, ať DC má potřebné vybavení.' },
};

// Pure: diagnóza příčin nespokojenosti z příznaků budovy. f = { outage,
// congRatio (0..1+), overRatio (cena/reference), wifi, noServices, weakDC }.
// Vrací pole {key, label (s parametry), fix} — nejzávažnější první.
function diagnoseSatIssuesEx(f){
  f = f || {};
  const out = [];
  const add = (key, detail) => {
    const d = SAT_ISSUE_DEFS[key];
    out.push({ key, label: d.label + (detail || ''), fix: d.fix });
  };
  if (f.outage) add('outage');
  if ((f.congRatio || 0) > 0.7) add('cong', ` (${Math.round(f.congRatio * 100)} % kapacity)`);
  if ((f.overRatio || 0) > 1.6) add('price2', ` (${f.overRatio.toFixed(1)}× férové ceny)`);
  else if ((f.overRatio || 0) > 1.15) add('price1', ` (${f.overRatio.toFixed(2)}× férové ceny)`);
  if (f.wifi) add('wifi');
  if (f.weakDC) add('weakdc');
  if (f.noServices) add('nosvc');
  return out;
}
// Zpětně kompatibilní varianta — jen texty labelů.
function diagnoseSatIssues(f){
  return diagnoseSatIssuesEx(f).map(i => i.label);
}

// Sběrač: projde připojené budovy, spočítá rozklad štěstí a vrátí i nejhorší
// budovy s diagnózou příčin (pro kartu „Štěstí lidí" v řídícím centru).
function ccHappiness(maxWorst){
  if (typeof G === 'undefined' || !G) return null;
  maxWorst = maxWorst || 5;
  const connByTile = {};
  for (const c of (G.conns || [])) connByTile[c.by * 10000 + c.bx] = c;
  const list = [];
  const all = [];
  for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++){
    const b = G.map[y][x].bld;
    if (!b || !b.connected) continue;
    list.push({ sat: b.sat, customers: b.customers || 0 });
    const f = { wifi: b.connType === 'conn_wifi' };
    const cn = connByTile[y * 10000 + x];
    if (cn){
      const dc = G.dcs[cn.di];
      if (dc){
        f.outage = !!(dc.outage && dc.outage.active);
        const eq = dc.eq || [];
        f.weakDC = !(eq.includes('eq_server') && eq.includes('eq_monitoring'));
      }
      if (typeof dcLoads !== 'undefined' && Array.isArray(dcLoads) && dcLoads[cn.di])
        f.congRatio = dcLoads[cn.di].ratio || 0;
    }
    if (b.customers > 0){
      let hasSvc = false;
      if (b.svcSubs) for (const k in b.svcSubs) if (b.svcSubs[k] > 0) hasSvc = true;
      f.noServices = !hasSvc;
      if (b.tariffDist && typeof refPrice === 'function' && typeof calcBldRevenue === 'function'){
        try {
          const avgPrice = calcBldRevenue(b) / b.customers;
          let avgSpeed = 0, avgShare = 0;
          for (const ti in b.tariffDist){
            const t = G.tariffs[ti];
            if (t){ avgSpeed += t.speed * b.tariffDist[ti]; avgShare += (t.share || 1) * b.tariffDist[ti]; }
          }
          avgSpeed /= b.customers; avgShare /= b.customers;
          const rp = refPrice(avgSpeed, avgShare);
          if (rp > 0) f.overRatio = avgPrice / rp;
        } catch(e) {}
      }
    }
    all.push({ x, y, sat: b.sat, customers: b.customers || 0, type: b.type, f });
  }
  all.sort((a, b) => a.sat - b.sat);
  const bd = satBreakdownFromList(list);
  // Agregace příčin přes všechny budovy — kolika zákazníků se každý problém
  // týká (pro „proč klesá spokojenost" v cenovém/řídícím centru).
  // issueAgg: key → {label, fix, cust, blds}; issueCust zůstává pro kompatibilitu.
  bd.issueCust = {};
  bd.issueAgg = {};
  for (const wb of all){
    for (const iss of diagnoseSatIssuesEx(wb.f)){
      const short = iss.label.replace(/\s*\([^)]*\)/, '');
      bd.issueCust[short] = (bd.issueCust[short] || 0) + Math.max(1, wb.customers);
      if (!bd.issueAgg[iss.key]) bd.issueAgg[iss.key] = { label: short, fix: iss.fix, cust: 0, blds: 0 };
      bd.issueAgg[iss.key].cust += Math.max(1, wb.customers);
      bd.issueAgg[iss.key].blds++;
    }
  }
  bd.worst = all.slice(0, maxWorst).map(wb => ({
    x: wb.x, y: wb.y, sat: Math.round(wb.sat), customers: wb.customers,
    name: (typeof BTYPES !== 'undefined' && BTYPES[wb.type] && BTYPES[wb.type].name) || wb.type,
    icon: (typeof BTYPES !== 'undefined' && BTYPES[wb.type] && BTYPES[wb.type].icon) || '🏠',
    issues: diagnoseSatIssues(wb.f),
    issuesEx: diagnoseSatIssuesEx(wb.f),
  }));
  return bd;
}

// Skok kamery na budovu z řídícího centra (zavře modal a doletí na dlaždici).
function ccFocusBld(x, y){
  if (typeof closeControlCenter === 'function') try{ closeControlCenter(); }catch(e){}
  if (typeof camTarget !== 'undefined' && camTarget && camTarget.zoom < 1.1) camTarget.zoom = 1.3;
  if (typeof camCenterOn === 'function') camCenterOn(x, y);
}

// ====== Integrace se stavem ======
function ccEnsure(){
  if(typeof G === 'undefined' || !G) return null;
  if(G.prestige == null) G.prestige = 55;
  if(!G.qosProfile) G.qosProfile = 'off';
  return G;
}

function ccMetrics(){
  if(typeof G === 'undefined' || !G) return {};
  let anyOutage = false;
  for(const dc of (G.dcs || [])) if(dc.outage && dc.outage.active) anyOutage = true;
  // kongesce: nejhorší poměr napříč DC
  let worstCong = 0;
  if(typeof dcLoads !== 'undefined' && Array.isArray(dcLoads)){
    for(const dl of dcLoads) if(dl && dl.ratio > worstCong) worstCong = dl.ratio;
  }
  // spokojenost: zákaznicky vážený průměr připojených budov — velké budovy
  // s mnoha zákazníky ovlivňují prestiž víc než prázdné domky
  const satList = [];
  for(let y = 0; y < MAP; y++) for(let x = 0; x < MAP; x++){
    const b = G.map[y][x].bld;
    if(b && b.connected) satList.push({ sat: b.sat, customers: b.customers || 0 });
  }
  const satBd = satBreakdownFromList(satList);
  const sat01 = satBd.n > 0 ? satBd.wAvg / 100 : 0.5;
  const totalIPs = (typeof getTotalIPs === 'function') ? getTotalIPs() : 0;
  const plan = addressingPlan(totalIPs, (G.conns || []).length, (G.towers || []).length, (G.wifiAPs || []).length);
  const qosP = (QOS_PROFILES[G.qosProfile] || QOS_PROFILES.off).prestige;
  return {
    anyOutage,
    uptime01: anyOutage ? 0.4 : 1,
    satisfaction01: sat01,
    congestion01: Math.min(1, worstCong),
    addrHeadroom01: plan.headroom,
    qosPrestige: qosP,
    plan,
  };
}

// Měsíční tik — posune prestiž k cíli a strhne náklady QoS.
function controlCenterMonthlyTick(){
  if(!ccEnsure()) return;
  const m = ccMetrics();
  const target = computePrestige(m);
  G.prestige = Math.round(smoothPrestige(G.prestige, target, 0.25));
  // QoS náklady
  const qcost = qosMonthlyCost(G.qosProfile, (G.dcs || []).length);
  if(qcost > 0){
    if(typeof recordOpex === 'function') try{ recordOpex('qos', qcost); }catch(e){}
    G.cash -= qcost;
  }
}

function setQosProfile(profile){
  if(!QOS_PROFILES[profile]) return;
  ccEnsure();
  G.qosProfile = profile;
  if(typeof notify === 'function') notify(`${QOS_PROFILES[profile].icon} QoS: ${QOS_PROFILES[profile].name}`, 'good');
  if(typeof renderControlCenter === 'function') try{ renderControlCenter(); }catch(e){}
  if(typeof updUI === 'function') updUI();
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    QOS_PROFILES, qosCongestionFactor, qosMonthlyCost,
    addressingPlan, computePrestige, smoothPrestige, prestigeGrowthMultiplier,
    SAT_BUCKETS, satBucketId, satBreakdownFromList, diagnoseSatIssues, diagnoseSatIssuesEx, SAT_ISSUE_DEFS,
  };
}
