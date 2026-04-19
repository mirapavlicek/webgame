// ====== PEERING & TRANSIT HIERARCHY ======
// v0.3.0 — hráč si může předplatit transit od globálních carrierů.
// Model:
//   G.peeringContract = {providerId, mbpsCommitted, signedY, signedM, activatedY, activatedM}
//   (jen jeden kontrakt naráz — pro změnu providera nejprve zruš)
//
// Kapacita z kontraktu se přičítá do DC BW poolu (globálně), stejně jako IXP.bwBonus.
// Měsíční cena = mbpsCommitted × provider.pricePerMbpsM × componentInflation.
// NIX.CZ (hasIXP) dokáže offloadnout ~25 % provozu → transit efektivně levnější.

// Uzavřít transitní kontrakt
function subscribeTransit(providerId, mbps){
  const p = TRANSIT_PROVIDERS[providerId];
  if(!p){ try{notify('❌ Neznámý provider!','bad');}catch(e){} return; }
  const m = Math.max(p.minMbps, Math.min(p.maxMbps, Math.round(mbps||p.minMbps)));
  const setup = (typeof inflComponentCost==='function')?inflComponentCost(p.setupFee):p.setupFee;
  if(G.cash < setup){ try{notify(`❌ Chybí ${fmtKc(setup - G.cash)} na setup!`,'bad');}catch(e){} return; }
  if(G.peeringContract && G.peeringContract.providerId){
    try{notify('❌ Nejdřív zruš stávající transit (Tab Cloud → Peering)','bad');}catch(e){}
    return;
  }
  G.cash -= setup;
  G.peeringContract = {
    providerId,
    mbpsCommitted: m,
    signedY: G.date.y, signedM: G.date.m,
  };
  try{notify(`✅ Transit od ${p.name} uzavřen (${m} Mbps, setup ${fmtKc(setup)})`,'good');}catch(e){}
  if(typeof markCapDirty==='function')markCapDirty();
  if(typeof updUI==='function')updUI();
}

// Zrušit transitní kontrakt (včetně vtipné "výpovědní lhůty" 1 měs)
function cancelTransit(){
  if(!G.peeringContract){ try{notify('ℹ️ Žádný aktivní transit','warn');}catch(e){} return; }
  const p = TRANSIT_PROVIDERS[G.peeringContract.providerId];
  const penalty = Math.round((G.peeringContract.mbpsCommitted||0) * ((p&&p.pricePerMbpsM)||10) * 1.0);
  G.cash -= penalty;
  try{notify(`🛑 Transit zrušen. Výpovědní lhůta 1 měs = ${fmtKc(penalty)} penále.`,'warn');}catch(e){}
  G.peeringContract = null;
  if(typeof markCapDirty==='function')markCapDirty();
  if(typeof updUI==='function')updUI();
}

// Upravit smluvenou kapacitu (bez penále pokud nahoru; pokud dolů pod původní, 50% měsíční fee penále)
function adjustTransitCapacity(newMbps){
  if(!G.peeringContract){ try{notify('❌ Žádný aktivní transit','bad');}catch(e){} return; }
  const p = TRANSIT_PROVIDERS[G.peeringContract.providerId];
  if(!p) return;
  const m = Math.max(p.minMbps, Math.min(p.maxMbps, Math.round(newMbps)));
  const cur = G.peeringContract.mbpsCommitted;
  if(m===cur)return;
  if(m < cur){
    const downgradeFee = Math.round((cur-m) * p.pricePerMbpsM * 0.5);
    if(G.cash < downgradeFee){ try{notify(`❌ Chybí ${fmtKc(downgradeFee-G.cash)} na downgrade penále`,'bad');}catch(e){} return; }
    G.cash -= downgradeFee;
    try{notify(`⬇️ Transit snížen z ${cur} na ${m} Mbps (penále ${fmtKc(downgradeFee)})`,'warn');}catch(e){}
  } else {
    try{notify(`⬆️ Transit navýšen z ${cur} na ${m} Mbps`,'good');}catch(e){}
  }
  G.peeringContract.mbpsCommitted = m;
  if(typeof markCapDirty==='function')markCapDirty();
  if(typeof updUI==='function')updUI();
}

// Měsíční náklad transitu (Kč). 0 pokud není kontrakt.
function transitMonthlyCost(){
  if(!G || !G.peeringContract) return 0;
  const pc = G.peeringContract;
  const p = TRANSIT_PROVIDERS[pc.providerId];
  if(!p) return 0;
  let cost = pc.mbpsCommitted * p.pricePerMbpsM;
  // NIX.CZ offloaduje cca 25 % lokálního provozu → slevy na transit
  if(G.hasIXP) cost *= 0.75;
  // Aplikovat komponentní inflaci (účty od carriera)
  if(typeof inflComponentCost==='function') cost = inflComponentCost(cost);
  else cost = Math.round(cost);
  return cost;
}

// Bonus BW (Mbps) z transitu — přidává se do každého DC poměrově
// (pro zjednodušení: rozděleno rovnoměrně mezi všechna DC).
function transitBwBonusPerDC(){
  if(!G || !G.peeringContract || !G.dcs || G.dcs.length===0) return 0;
  return Math.floor((G.peeringContract.mbpsCommitted||0) / G.dcs.length);
}

// Celkový BW přínos transitu (sum)
function transitTotalBwBonus(){
  if(!G || !G.peeringContract) return 0;
  return G.peeringContract.mbpsCommitted||0;
}

// Kvalitní bonus (0..1 float) — přičítat do satisfaction / reputation modelů
function transitQualityMod(){
  if(!G || !G.peeringContract) return 0;
  const p = TRANSIT_PROVIDERS[G.peeringContract.providerId];
  return p ? (p.qualMod||0) : 0;
}

// Latencyový mod (ms) — negativní = rychlejší
function transitLatencyMod(){
  if(!G || !G.peeringContract) return 0;
  const p = TRANSIT_PROVIDERS[G.peeringContract.providerId];
  return p ? (p.latencyMod||0) : 0;
}

// UI helper — HTML popisek aktuálního kontraktu
function transitStatusHTML(){
  if(!G || !G.peeringContract){
    return `<div style="color:#8b949e;font-size:10px">Žádný transitní kontrakt. Veškerý BW teče přes vaše bwUpgrades + IXP.</div>`;
  }
  const pc = G.peeringContract;
  const p = TRANSIT_PROVIDERS[pc.providerId];
  if(!p)return '';
  const monthCost = transitMonthlyCost();
  const qualStr = p.qualMod>0?`<span style="color:#3fb950">+${(p.qualMod*100).toFixed(0)}% kvalita</span>`
                : p.qualMod<0?`<span style="color:#f85149">${(p.qualMod*100).toFixed(0)}% kvalita</span>`
                : '<span style="color:#8b949e">neutrální kvalita</span>';
  const latStr = p.latencyMod<0?`<span style="color:#3fb950">${p.latencyMod} ms</span>`
                : p.latencyMod>0?`<span style="color:#f85149">+${p.latencyMod} ms</span>`
                : '<span style="color:#8b949e">baseline latence</span>';
  let h = `<div style="background:#0d1117;border:1px solid ${p.color}66;border-radius:6px;padding:8px">`;
  h += `<div style="display:flex;justify-content:space-between;align-items:center">`;
  h += `<div><span style="color:${p.color};font-weight:600">${p.icon} ${p.name}</span>`;
  h += `<span style="font-size:9px;color:#8b949e;margin-left:8px">${qualStr} · ${latStr}</span></div>`;
  h += `<button onclick="cancelTransit()" style="padding:2px 8px;background:#1a0a0a;border:1px solid #f85149;border-radius:4px;color:#f85149;cursor:pointer;font-size:9px">Zrušit</button>`;
  h += `</div>`;
  h += `<div style="font-size:10px;color:#e6edf3;margin-top:4px">Kapacita: <b>${pc.mbpsCommitted} Mbps</b> · Cena: <b style="color:#f85149">${fmtKc(monthCost)}/měs</b>`;
  if(G.hasIXP) h += ` <span style="color:#3fb950" title="NIX.CZ offloaduje 25 % provozu">(−25 % z NIX.CZ)</span>`;
  h += `</div>`;
  h += `<div style="margin-top:6px;display:flex;gap:6px;align-items:center;font-size:9px">`;
  h += `<span style="color:#8b949e">Upravit Mbps:</span>`;
  h += `<input type="number" id="transitMbpsAdjust" value="${pc.mbpsCommitted}" min="${p.minMbps}" max="${p.maxMbps}" step="100" style="width:90px;padding:2px 4px;background:#0d1117;border:1px solid #21262d;border-radius:4px;color:#e6edf3;font-size:10px">`;
  h += `<button onclick="adjustTransitCapacity(parseInt(document.getElementById('transitMbpsAdjust').value)||${pc.mbpsCommitted})" style="padding:2px 6px;background:#1a1040;border:1px solid #7c3aed;border-radius:4px;color:#a78bfa;cursor:pointer;font-size:9px">OK</button>`;
  h += `</div>`;
  h += `</div>`;
  return h;
}

// UI helper — panel s dostupnými providery pro subscribe
function transitOfferListHTML(){
  if(G && G.peeringContract) return '';
  let h = `<div style="font-size:9px;color:#8b949e;margin-bottom:4px">Vyber transitního providera — kapacita se přidá do všech DC, cena se sčítá měsíčně.</div>`;
  for(const id in TRANSIT_PROVIDERS){
    const p = TRANSIT_PROVIDERS[id];
    const setup = (typeof inflComponentCost==='function')?inflComponentCost(p.setupFee):p.setupFee;
    const monthMin = (typeof inflComponentCost==='function')?inflComponentCost(p.minMbps*p.pricePerMbpsM):Math.round(p.minMbps*p.pricePerMbpsM);
    h += `<div style="background:#0d1117;border:1px solid ${p.color}55;border-radius:6px;padding:6px;margin-bottom:4px">`;
    h += `<div style="display:flex;justify-content:space-between;align-items:flex-start">`;
    h += `<div style="flex:1">`;
    h += `<div style="color:${p.color};font-weight:600;font-size:10px">${p.icon} ${p.name}</div>`;
    h += `<div style="font-size:9px;color:#8b949e;margin-top:2px">${p.desc}</div>`;
    h += `<div style="font-size:9px;color:#e6edf3;margin-top:3px">${p.pricePerMbpsM} Kč/Mbps/měs · min ${p.minMbps} Mbps · setup ${fmtKc(setup)}</div>`;
    h += `</div>`;
    h += `<div style="display:flex;flex-direction:column;gap:3px;margin-left:8px">`;
    h += `<input type="number" id="transitMbps_${id}" value="${p.minMbps}" min="${p.minMbps}" max="${p.maxMbps}" step="100" style="width:90px;padding:2px 4px;background:#0d1117;border:1px solid #21262d;border-radius:4px;color:#e6edf3;font-size:10px">`;
    h += `<button onclick="subscribeTransit('${id}',parseInt(document.getElementById('transitMbps_${id}').value)||${p.minMbps})" style="padding:2px 6px;background:#1a1040;border:1px solid ${p.color};border-radius:4px;color:${p.color};cursor:pointer;font-size:9px">Uzavřít</button>`;
    h += `</div>`;
    h += `</div></div>`;
  }
  return h;
}
