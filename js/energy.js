// ====== ENERGY: spot electricity price + PUE per DC ======
// v0.3.0 — zavádíme realistickou proměnnou cenu elektřiny (spot) a metriku
// PUE (Power Usage Effectiveness) pro každé DC. Měsíční náklad na proud je
// zvlášť řádek v sekci Finance a na úrovni DC ho hráč vidí v modalu.
//
// Model:
//   * Každé DC má základní IT load (kW) podle typu + příspěvky z HW.
//   * PUE = celková spotřeba / IT spotřeba → s chlazením klesá, bez něj 1.8+.
//   * Měsíční cost = (IT_kW × PUE) × 730h × spotPrice.
//   * Spot price v Kč/kWh osciluje měsíčně, s yearly trendem + sezónností +
//     občasným šokem (energetická krize 2021-23). AR(1) mean-reversion.

const ELEC_HR_PER_MONTH = 730;
const ELEC_INITIAL = 4.5; // Kč/kWh (2005)
const ELEC_MIN = 2.0, ELEC_MAX = 18.0;

// Základní IT load datacentra (kW při 100% vytížení BW)
const DC_POWER_KW = {
  dc_small: 8,
  dc_medium: 35,
  dc_large: 150,
};

// Základní PUE podle velikosti (menší = vyšší ztráty)
function baseDCPUE(dcType){
  return dcType==='dc_small'?1.85 : dcType==='dc_medium'?1.75 : 1.70;
}

// Elektro-příspěvek jednotlivých zařízení (kW)
// Chlazení samo o sobě = 0 (jeho vliv je v PUE redukci), jinak reálné hodnoty.
const EQ_POWER_KW = {
  eq_router:0.05, eq_router_mid:0.15, eq_router_big:0.35, eq_router_edge:0.80,
  eq_switch24:0.10, eq_switch48:0.18,
  eq_server:0.35,
  eq_firewall:0.15, eq_firewall_pro:0.30, eq_firewall_ent:0.60,
  eq_ups:0.05, eq_monitoring:0.10,
  eq_cooling:0.0, // vliv jde přes PUE, nikoli přímou spotřebu
  eq_backup:0.40,
  eq_wifiap:0.05, eq_voip:0.15, eq_iptv:0.50,
  eq_storage:0.50, eq_storage_big:1.50,
  eq_cloudnode:3.50, eq_cloudnode_big:10.0,
  eq_bgprouter:0.40, eq_loadbalancer:0.20,
};

// Aktuální PUE pro DC: base – (0.12 × počet eq_cooling), min 1.10
function dcPUE(dc){
  const base = baseDCPUE(dc.type);
  let red=0;
  for(const e of (dc.eq||[])){
    if(typeof EQ!=='undefined' && EQ[e] && EQ[e].eff==='cooling') red += 0.12;
  }
  return Math.max(1.10, base - red);
}

// IT load daného DC (kW), škálováno podle momentální utilizace BW.
// Baseline 60 % i při prázdném DC (HW je vždy zapnutý, jen se nebije na watta).
function dcITLoadKW(dc){
  let kw = DC_POWER_KW[dc.type]||10;
  for(const e of (dc.eq||[])) kw += (EQ_POWER_KW[e]||0);
  // BW utilizace — pokud máme dcLoads, použij pro load factor
  let util=0;
  if(typeof dcLoads!=='undefined' && Array.isArray(dcLoads)){
    const di = G.dcs.indexOf(dc);
    const dl = dcLoads[di];
    if(dl && dl.maxBW>0) util = Math.min(1, dl.usedBW/dl.maxBW);
  }
  const loadFactor = 0.60 + 0.40*util;
  return kw*loadFactor;
}

// Měsíční náklad na elektřinu jednoho DC (Kč)
function dcMonthlyElectricityCost(dc){
  const kwIT = dcITLoadKW(dc);
  const pue = dcPUE(dc);
  const price = (G&&G.electricityPrice)||ELEC_INITIAL;
  return Math.round(kwIT * pue * ELEC_HR_PER_MONTH * price);
}

// Celkový měsíční náklad na elektřinu všech DC (Kč)
function totalMonthlyElectricityCost(){
  if(!G||!G.dcs)return 0;
  let s=0;
  for(const dc of G.dcs) s += dcMonthlyElectricityCost(dc);
  return s;
}

// Měsíční drift ceny: AR(1) + yearly trend + sezónnost + vzácný šok.
// Cíl (target) kopíruje historii: 2005-09 stabilní 4.5, 2010-19 pomalý růst,
// 2020-22 energetická krize (peak ~9-12 Kč), 2023+ pozvolna klesá na ~6.
function electricityMonthlyTick(){
  if(!G) return;
  if(G.electricityPrice===undefined) G.electricityPrice = ELEC_INITIAL;
  const y = G.date.y, m = G.date.m;
  let target = ELEC_INITIAL;
  if(y<2010)      target = 4.5;
  else if(y<2020) target = 4.5 + (y-2010)*0.10;
  else if(y<2023) target = 5.5 + (y-2020)*2.0;   // prudký nárůst
  else if(y<2026) target = 9.0 - (y-2023)*0.90;  // pozvolný pokles
  else            target = 5.5 + (y-2026)*0.05;
  // Inflace přepnutá i na elektřinu (dlouhodobý trend)
  target *= (G.componentInflation||1);
  // Sezóna — zima (prosinec/leden) peak ~+15 %
  const season = 1 + 0.15*Math.cos((m-0.5)/12*2*Math.PI);
  target *= season;
  // AR(1) + noise ±10 %
  const prev = G.electricityPrice;
  const noise = (Math.random()-0.5)*0.20;
  let next = prev*0.55 + target*0.45;
  next *= (1+noise);
  // Vzácný šok (3 %) — ±30 %
  if(Math.random()<0.03){
    const shock = 0.70 + Math.random()*0.60;
    next *= shock;
    if(shock>1.15 && typeof notify==='function') notify(`⚡ Cenový šok elektřiny! ${G.electricityPrice.toFixed(2)} → ${(next).toFixed(2)} Kč/kWh`,'bad');
    else if(shock<0.85 && typeof notify==='function') notify(`⚡ Levnější elektřina: ${G.electricityPrice.toFixed(2)} → ${(next).toFixed(2)} Kč/kWh`,'good');
  }
  G.electricityPrice = Math.max(ELEC_MIN, Math.min(ELEC_MAX, next));
}

// UI helper — barevné značení ceny vs. výchozí 4.5 Kč
function electricityPriceColor(){
  const p = (G&&G.electricityPrice)||ELEC_INITIAL;
  if(p<3.5) return '#3fb950';     // levná
  if(p<5.5) return '#22d3ee';     // normál
  if(p<7.5) return '#f59e0b';     // vyšší
  if(p<10) return '#ff8c42';      // drahá
  return '#f85149';               // krize
}
