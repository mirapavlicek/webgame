// ====== RENEWABLE ENERGY ======
// v0.3.1 — Solární a větrné elektrárny. Postav je na zelené (grass) dlaždici,
// vyrábějí kW co ti snižují fakturu za elektřinu. Přebytek se prodává do sítě
// za 1/3 spotové ceny. Tile s elektrárnou je "zabraná" a auto-zástavba se
// vyhne.
//
// Plus: eq_solar_roof — solární panely na střechu DC. Malý, ale pohodlný
// bonus (žádná extra plocha, bez vertikálních bariér stínění).

const PP_T = {
  pp_solar_tile: {
    name:'Solární panel', icon:'🌞',
    cost: 450000, mCost: 1800,
    kwAvg: 3.0,          // průměrný kW výkon (1 rok včetně noci/sezóny)
    type:'solar',
    desc:'Malá solární instalace na zelené dlaždici. Vyrobí ~3 kW v průměru (léto ×1,4, zima ×0,5).',
  },
  pp_solar_farm: {
    name:'Solární farma', icon:'🔆',
    cost: 1800000, mCost: 6500,
    kwAvg: 12.0,
    type:'solar',
    desc:'Velkoplošná fotovoltaika, 12 kW průměr. Dotace v EU často dostupné (#6).',
  },
  pp_wind_small: {
    name:'Větrník', icon:'💨',
    cost: 900000, mCost: 5500,
    kwAvg: 6.0,
    type:'wind',
    desc:'Menší větrná elektrárna. 6 kW průměr, sezónně mírně stabilnější než solar (zima ×1,15).',
  },
  pp_wind_park: {
    name:'Větrný park', icon:'🌀',
    cost: 3500000, mCost: 18000,
    kwAvg: 25.0,
    type:'wind',
    desc:'Velká turbína s výkonem 25 kW průměr. Nejvyšší stabilita dodávky.',
  },
};

const RENEWABLE_MAINT_PCT = 0.004; // 0,4 % z capex/měs base (navíc k mCost)
const SURPLUS_SELL_RATIO = 1/3;    // přebytek se vykupuje za 1/3 spot ceny

// ====== PLACEMENT ======

function hasPowerPlant(x,y){
  return (G.powerPlants||[]).some(p=>p.x===x&&p.y===y);
}

function getPowerPlant(x,y){
  return (G.powerPlants||[]).find(p=>p.x===x&&p.y===y)||null;
}

function canPlacePowerPlant(x,y,type){
  if(!G||!G.map) return {ok:false,err:'mapa není načtena'};
  if(x<0||x>=MAP||y<0||y>=MAP) return {ok:false,err:'mimo mapu'};
  const t = G.map[y][x];
  if(t.type!=='grass') return {ok:false,err:'pouze na zelené dlaždici'};
  if(t.bld) return {ok:false,err:'dlaždice je zastavěná'};
  if(hasPowerPlant(x,y)) return {ok:false,err:'elektrárna už tu je'};
  // taky se vyhni DC / junction / tower
  if((G.dcs||[]).some(d=>d.x===x&&d.y===y)) return {ok:false,err:'DC na této dlaždici'};
  if((G.junctions||[]).some(j=>j.x===x&&j.y===y)) return {ok:false,err:'junction na této dlaždici'};
  if((G.towers||[]).some(tw=>tw.x===x&&tw.y===y)) return {ok:false,err:'věž na této dlaždici'};
  if(!PP_T[type]) return {ok:false,err:'neznámý typ elektrárny'};
  const def = PP_T[type];
  const cost = inflComponentCost(def.cost);
  if(G.cash < cost) return {ok:false,err:`potřebuješ ${fmtKc(cost)}`};
  return {ok:true, cost};
}

function placePowerPlant(x,y,type){
  const chk = canPlacePowerPlant(x,y,type);
  if(!chk.ok){ try{notify('❌ '+chk.err,'bad');}catch(e){} return false; }
  const def = PP_T[type];
  G.cash -= chk.cost;
  if(!G.powerPlants) G.powerPlants=[];
  G.powerPlants.push({
    type, x, y,
    installedY: G.date.y, installedM: G.date.m,
    mtfbMonths: 0,
  });
  try{if(typeof recordCapex==='function')recordCapex('power_plant',chk.cost,`${def.name} @(${x},${y})`);}catch(e){}
  try{notify(`${def.icon} ${def.name} postaven @ (${x},${y})`,'good');}catch(e){}
  if(typeof markCapDirty==='function') markCapDirty();
  if(typeof updUI==='function') updUI();
  if(typeof render==='function') render();
  return true;
}

function demolishPowerPlant(x,y){
  const i = (G.powerPlants||[]).findIndex(p=>p.x===x&&p.y===y);
  if(i<0) return false;
  const pp = G.powerPlants[i];
  const def = PP_T[pp.type];
  G.powerPlants.splice(i,1);
  try{notify(`🗑️ ${def?def.name:'Elektrárna'} demolována`,'warn');}catch(e){}
  if(typeof updUI==='function') updUI();
  if(typeof render==='function') render();
  return true;
}

// ====== PRODUCTION MODEL ======

// Sezónní faktor pro daný typ v daném měsíci (0-11)
function seasonalFactor(type, m){
  // m je 0-based měsíc (0 = leden), lépe používej 1-based pokud to je standard
  // V projektu je G.date.m typicky 1-12 — převedu na radiány
  const phase = ((m-1)/12)*2*Math.PI;
  if(type==='solar'){
    // Léto (červen/červenec) peak ×1,4; zima ×0,5. cos((m-7)/12*2PI) → max v červenci
    const s = 0.95 + 0.45*Math.cos((m-7)/12*2*Math.PI);
    return Math.max(0.40, s);
  }
  if(type==='wind'){
    // Zima peak (leden/prosinec) ×1,15; léto ×0,85
    const w = 1.0 + 0.15*Math.cos((m-1)/12*2*Math.PI);
    return w;
  }
  return 1.0;
}

// kW průměrný výkon dané elektrárny v aktuálním měsíci
function plantKW(pp){
  const def = PP_T[pp.type];
  if(!def) return 0;
  const m = (G&&G.date)?G.date.m:6;
  const season = seasonalFactor(def.type, m);
  // Náhodný šum ±12 %
  const noise = 0.88 + Math.random()*0.24;
  // Degradace: −0,8 % ročně
  let age = 0;
  if(pp.installedY && G.date){
    age = (G.date.y - pp.installedY) + (G.date.m - (pp.installedM||G.date.m))/12;
  }
  const degrade = Math.max(0.60, 1 - 0.008*age);
  return def.kwAvg * season * noise * degrade;
}

// Total kW produkce ze všech outdoor elektráren + DC solar střechy
function totalRenewableKW(){
  if(!G) return 0;
  let kw = 0;
  for(const pp of (G.powerPlants||[])) kw += plantKW(pp);
  // DC solar roof (eq_solar_roof)
  for(const dc of (G.dcs||[])){
    const m = (G&&G.date)?G.date.m:6;
    const season = seasonalFactor('solar', m);
    for(const e of (dc.eq||[])){
      if(e==='eq_solar_roof') kw += 2.0 * season * (0.88 + Math.random()*0.24);
    }
  }
  return kw;
}

// Měsíční produkce v kWh
function totalRenewableKWh(){
  return totalRenewableKW() * 730; // ELEC_HR_PER_MONTH
}

// Kompenzace spotřeby DC + přebytkový příjem. Volané z main.js monthUp.
// Vrací {generatedKWh, consumedKWh, netBillKWh, surplusKWh, surplusRev}
function renewableMonthlySettle(){
  if(!G) return {generatedKWh:0, consumedKWh:0, netBillKWh:0, surplusKWh:0, surplusRev:0};
  const generatedKWh = totalRenewableKWh();
  let consumedKWh = 0;
  if(typeof dcITLoadKW==='function' && typeof dcPUE==='function'){
    for(const dc of (G.dcs||[])){
      consumedKWh += dcITLoadKW(dc)*dcPUE(dc)*730;
    }
  }
  const netBillKWh = Math.max(0, consumedKWh - generatedKWh);
  const surplusKWh = Math.max(0, generatedKWh - consumedKWh);
  const price = (G&&G.electricityPrice)||4.5;
  const surplusRev = Math.round(surplusKWh * price * SURPLUS_SELL_RATIO);
  return {generatedKWh, consumedKWh, netBillKWh, surplusKWh, surplusRev};
}

// Nová verze totalMonthlyElectricityCost s odečtem renewable — voláno z main.js
// místo původní. Vrací ČISTÉ náklady (může být 0 pokud je přebytek).
function totalMonthlyElectricityCostNet(){
  if(!G||!G.dcs) return 0;
  const settle = renewableMonthlySettle();
  const price = (G&&G.electricityPrice)||4.5;
  return Math.round(settle.netBillKWh * price);
}

// Měsíční provozní náklady elektráren (údržba) — voláno v main.js
function renewableMonthlyMaintCost(){
  if(!G||!G.powerPlants) return 0;
  let c = 0;
  for(const pp of G.powerPlants){
    const def = PP_T[pp.type]; if(!def) continue;
    c += def.mCost;
  }
  return c;
}

// ====== UI ======

function renewableSummaryHTML(){
  if(!G) return '';
  const settle = renewableMonthlySettle();
  const plants = G.powerPlants||[];
  const dcSolar = (G.dcs||[]).reduce((s,d)=>s+((d.eq||[]).filter(e=>e==='eq_solar_roof').length),0);
  let h = `<div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:8px">`;
  h += `<div style="font-weight:600;color:#e6edf3;font-size:10px;margin-bottom:4px">☀️ Obnovitelné zdroje</div>`;
  h += `<div style="font-size:9px;color:#8b949e;line-height:1.5">`;
  h += `Instalace: <b style="color:#22d3ee">${plants.length}</b> elektráren + <b style="color:#fbbf24">${dcSolar}</b> DC solar<br>`;
  h += `Produkce: <b style="color:#3fb950">${(settle.generatedKWh/1000).toFixed(1)} MWh/měs</b><br>`;
  h += `Spotřeba DC: <b style="color:#f59e0b">${(settle.consumedKWh/1000).toFixed(1)} MWh/měs</b><br>`;
  if(settle.surplusKWh>0){
    h += `<span style="color:#3fb950">↗ Přebytek: ${(settle.surplusKWh/1000).toFixed(1)} MWh → +${fmtKc(settle.surplusRev)}/měs</span><br>`;
  } else {
    h += `Zbývá nakoupit ze sítě: <b>${(settle.netBillKWh/1000).toFixed(1)} MWh</b><br>`;
  }
  h += `Měsíční O&M náklad: ${fmtKc(renewableMonthlyMaintCost())}`;
  h += `</div></div>`;
  return h;
}

function renewableBuildOptionsHTML(){
  let h = `<div style="font-size:9px;color:#8b949e;margin-bottom:4px">Vyber typ a klikni na zelenou dlaždici. Elektrárny blokují zástavbu & šetří el.</div>`;
  for(const id in PP_T){
    const def = PP_T[id];
    const cost = (typeof inflComponentCost==='function')?inflComponentCost(def.cost):def.cost;
    const canAfford = G.cash >= cost;
    const col = canAfford ? '#22d3ee' : '#6e7681';
    h += `<button onclick="setTool('${id}')" style="width:100%;padding:5px 7px;background:#0d1117;border:1px solid ${col};border-radius:4px;color:${col};cursor:pointer;font-size:9px;text-align:left;margin-bottom:3px">`;
    h += `<b>${def.icon} ${def.name}</b> — ${fmtKc(cost)} · ~${def.kwAvg} kW<br>`;
    h += `<span style="color:#6e7681">${def.desc} · O&M ${fmtKc(def.mCost)}/měs</span>`;
    h += `</button>`;
  }
  return h;
}
