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
  // spokojenost: průměr připojených budov
  let satSum = 0, satN = 0;
  for(let y = 0; y < MAP; y++) for(let x = 0; x < MAP; x++){
    const b = G.map[y][x].bld;
    if(b && b.connected){ satSum += b.sat; satN++; }
  }
  const sat01 = satN > 0 ? (satSum / satN) / 100 : 0.5;
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
  };
}
