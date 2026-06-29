// ====== POČASÍ (dynamická mechanika) ======
// Počasí se mění podle ročního období a ovlivňuje provoz sítě:
//   • bouře (storm)   → vyšší riziko výpadků + občas poškodí kabely
//   • vedro (heatwave) → vyšší zátěž chlazení DC = dražší elektřina + riziko
//   • déšť (rain)      → mírná degradace bezdrátu (kosmeticky + malý vliv)
//   • mlha (fog)       → hlavně atmosféra
//   • jasno (clear)    → bez efektu
// Vizuál: GPU vrstva (PixiJS) kreslí déšť/mlhu/horký opar; HUD ukazuje stav.
//
// Bezpečnost: stav je líně inicializovaný (žádná změna save formátu nutná),
// efekty jsou aplikované přes guardované násobiče.

const WEATHER_T = {
  clear:    { name: 'Jasno',  icon: '☀️', energyMult: 1.00, outageMult: 1.0 },
  rain:     { name: 'Déšť',   icon: '🌧️', energyMult: 0.97, outageMult: 1.3 },
  fog:      { name: 'Mlha',   icon: '🌫️', energyMult: 1.00, outageMult: 1.1 },
  storm:    { name: 'Bouře',  icon: '⛈️', energyMult: 1.02, outageMult: 2.6 },
  heatwave: { name: 'Vedro',  icon: '🔥', energyMult: 1.35, outageMult: 1.8 },
};

// Sezónně vážené pravděpodobnosti přechodu (index měsíce 0=led .. 11=pro).
// Vrací mapu typ→váha. Pure.
function weatherWeights(month){
  const m = ((month % 12) + 12) % 12;
  const winter = (m === 11 || m === 0 || m === 1);
  const summer = (m >= 5 && m <= 7);
  const spring = (m >= 2 && m <= 4);
  // základ: většinou jasno
  const w = { clear: 6, rain: 2, fog: 1, storm: 1, heatwave: 0.4 };
  if (winter) { w.fog = 3; w.storm = 2.2; w.rain = 2.5; w.heatwave = 0; w.clear = 4; }
  else if (summer) { w.heatwave = 3.2; w.storm = 2; w.rain = 1.2; w.fog = 0.3; w.clear = 4.5; }
  else if (spring) { w.rain = 3; w.storm = 1.4; w.clear = 5; }
  else { /* podzim */ w.rain = 3; w.fog = 2; w.storm = 1.6; w.clear = 4.5; }
  return w;
}

// Pure: vybere další počasí podle měsíce. rnd ∈ [0,1) volitelné.
function nextWeather(month, rnd){
  const w = weatherWeights(month);
  const keys = Object.keys(w);
  let total = 0; for (const k of keys) total += Math.max(0, w[k]);
  if (total <= 0) return 'clear';
  let x = (rnd == null ? Math.random() : rnd) * total;
  for (const k of keys){ const v = Math.max(0, w[k]); if (x < v) return k; x -= v; }
  return keys[keys.length - 1];
}

// Líná inicializace stavu počasí na G.
function ensureWeather(){
  if (typeof G === 'undefined' || !G) return null;
  if (!G.weather) G.weather = { type: 'clear', since: G.date ? { y: G.date.y, m: G.date.m } : { y: 2005, m: 0 } };
  return G.weather;
}

function currentWeather(){
  const w = ensureWeather();
  return (w && w.type) || 'clear';
}
function weatherEnergyMultiplier(){
  const t = currentWeather();
  return (WEATHER_T[t] && WEATHER_T[t].energyMult) || 1;
}
function weatherOutageMultiplier(){
  const t = currentWeather();
  return (WEATHER_T[t] && WEATHER_T[t].outageMult) || 1;
}

// Měsíční tik — případně změní počasí a aplikuje okamžité efekty (bouře).
function weatherMonthlyTick(){
  const w = ensureWeather();
  if (!w || !G.date) return;
  // ~55% šance na změnu počasí každý měsíc
  if (Math.random() < 0.55){
    const prev = w.type;
    w.type = nextWeather(G.date.m, Math.random());
    w.since = { y: G.date.y, m: G.date.m };
    if (w.type !== prev && w.type !== 'clear' && typeof notify === 'function'){
      const def = WEATHER_T[w.type];
      notify(`${def.icon} Počasí: ${def.name}`, w.type === 'storm' || w.type === 'heatwave' ? 'warn' : '');
    }
  }
  // Bouře může poškodit kabely
  if (w.type === 'storm' && Math.random() < 0.5 && typeof triggerStormDamage === 'function'){
    try { triggerStormDamage(); } catch(e){ console.error('weather storm:', e); }
  }
}

// Export pro node testy.
if (typeof module !== 'undefined' && module.exports){
  module.exports = { WEATHER_T, weatherWeights, nextWeather };
}
