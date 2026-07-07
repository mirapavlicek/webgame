// ====== CENOVÉ CENTRUM ======
// Samostatný formulář na kontrolu a nastavení cen tarifů. Ukazuje u každého
// tarifu poměr k referenční ceně, dopad na růst/odliv/spokojenost a umožňuje
// cenu rychle upravit (±5 %, na referenci). Nahoře agreguje zdraví ceníku
// a příčiny nespokojenosti (z ccHappiness), aby hráč viděl, PROČ klesá.

// Minimální nominální cena tarifu. Dřív 99 Kč — jenže staré pomalé tarify
// mají referenci ≈ 99 Kč a valorizace nominál násobí, takže i na dně byly
// „předražené" a nešly zlevnit. 29 Kč dává prostor jít pod referenci.
const PRICE_FLOOR = 29;

// Pure: slovní + barevné hodnocení poměru cena/reference. Prahy odpovídají
// mechanice v main.js: růst se láme u 1.1, spokojenost padá od 1.15,
// churn houstne od 1.4.
function priceEffectLabel(ratio){
  const r = ratio || 0;
  if (r <= 0)    return { label: 'bez ceny',                          clr: '#8b949e', severity: 0 };
  if (r < 0.6)   return { label: '🔥 dumpingová — rychlý růst, malá marže', clr: '#3fb950', severity: 0 };
  if (r < 0.8)   return { label: '✓ výhodná — silný růst',            clr: '#3fb950', severity: 0 };
  if (r < 0.95)  return { label: '✓ konkurenční',                     clr: '#3fb950', severity: 0 };
  if (r < 1.1)   return { label: '· férová (≈ reference)',            clr: '#8b949e', severity: 0 };
  if (r < 1.15)  return { label: '↗ mírně dražší — růst zpomaluje',   clr: '#f5a524', severity: 1 };
  if (r < 1.4)   return { label: '⚠️ dražší — klesá spokojenost i růst', clr: '#f5a524', severity: 2 };
  if (r < 1.7)   return { label: '⚠️ drahá — odliv zákazníků',        clr: '#f86963', severity: 3 };
  if (r < 2.2)   return { label: '⛔ velmi drahá — silný odliv',      clr: '#f86963', severity: 4 };
  return           { label: '⛔ zlodějina — zákazníci hromadně utíkají', clr: '#f86963', severity: 5 };
}

// Pure: zdraví celého ceníku. tariffs = [{price, speed, share}], counts =
// zákazníci na tarifu (stejné indexy), refFn = refPrice, tInfl = valorizace.
// Vrací vážený průměrný poměr, počet zákazníků na předražených tarifech
// (ratio > 1.15) a index nejhoršího aktivního tarifu se zákazníky.
function portfolioPriceHealth(tariffs, counts, refFn, tInfl){
  const infl = tInfl || 1;
  let wSum = 0, w = 0, over = 0, worstIdx = -1, worstRatio = 0;
  for (let i = 0; i < (tariffs || []).length; i++){
    const t = tariffs[i];
    if (!t) continue;
    const c = (counts && counts[i]) || 0;
    const rp = refFn(t.speed, t.share);
    if (rp <= 0) continue;
    const ratio = (t.price * infl) / rp;
    if (c > 0){
      wSum += ratio * c; w += c;
      if (ratio > 1.15) over += c;
      if (ratio > worstRatio){ worstRatio = ratio; worstIdx = i; }
    }
  }
  return {
    avgRatio: w > 0 ? wSum / w : 0,
    custTotal: w,
    custOverpriced: over,
    worstIdx, worstRatio,
  };
}

// Pure: doporučená nominální cena tak, aby EFEKTIVNÍ cena (po valorizaci)
// odpovídala poměru `targetRatio` k referenci. Zaokrouhluje na 9 (…199, 449).
function suggestPrice(refP, tInfl, targetRatio){
  const infl = tInfl || 1;
  const raw = (refP * (targetRatio == null ? 1 : targetRatio)) / infl;
  const rounded = Math.max(PRICE_FLOOR, Math.round(raw / 10) * 10 - 1);
  return rounded;
}

// Sběrač: zákazníci per tarif (index → počet) z celé mapy.
function tariffCustomerCounts(){
  const counts = {};
  if (typeof G === 'undefined' || !G) return counts;
  for (let y = 0; y < MAP; y++) for (let x = 0; x < MAP; x++){
    const b = G.map[y][x].bld;
    if (!b || !b.connected) continue;
    if (b.tariffDist){
      for (const ti in b.tariffDist) counts[ti] = (counts[ti] || 0) + b.tariffDist[ti];
    } else if (b.tariff != null){
      counts[b.tariff] = (counts[b.tariff] || 0) + (b.customers || 0);
    }
  }
  return counts;
}

// Nastavení ceny tarifu z cenového centra (s mezí a překreslením).
function setTariffPrice(ti, price){
  if (typeof G === 'undefined' || !G || !G.tariffs[ti]) return;
  G.tariffs[ti].price = Math.max(PRICE_FLOOR, Math.round(price) || PRICE_FLOOR);
  if (typeof renderPricingCenter === 'function') try{ renderPricingCenter(); }catch(e){}
  if (typeof updUI === 'function') updUI();
}
function nudgeTariffPrice(ti, pct){
  if (typeof G === 'undefined' || !G || !G.tariffs[ti]) return;
  setTariffPrice(ti, G.tariffs[ti].price * (1 + pct));
}

// ====== UI — modal Cenového centra ======
function openPricingCenter(){
  const m = document.getElementById('pcModal');
  if (!m) return;
  m.style.display = 'flex';
  renderPricingCenter();
}
function closePricingCenter(){
  const m = document.getElementById('pcModal');
  if (m) m.style.display = 'none';
}

function renderPricingCenter(){
  const el = document.getElementById('pcBody');
  if (!el || typeof G === 'undefined' || !G) return;
  const tInfl = G.tariffInflation || 1;
  const counts = tariffCustomerCounts();
  const health = portfolioPriceHealth(G.tariffs, counts, refPrice, tInfl);

  let h = '<div class="cc-grid">';

  // ---- Souhrn: zdraví ceníku ----
  const avgR = health.avgRatio;
  const avgLbl = priceEffectLabel(avgR);
  h += `<div class="cc-card"><div class="cc-card-h">📊 Zdraví ceníku</div>`;
  if (health.custTotal > 0){
    h += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">`;
    h += `<div style="font-size:26px;font-weight:800;color:${avgLbl.clr}">${Math.round(avgR * 100)}<span style="font-size:13px"> %</span></div>`;
    h += `<div style="font-size:10.5px;color:var(--tx-3)">vážený průměr ceny vůči referenci<br><span style="color:${avgLbl.clr}">${avgLbl.label}</span></div></div>`;
    const overPct = Math.round(health.custOverpriced / health.custTotal * 100);
    h += `<div class="cc-row"><span>Zákazníci na předraženém (&gt;115 %)</span><span style="color:${overPct > 30 ? '#f86963' : overPct > 10 ? '#f5a524' : '#3fb950'};font-weight:600">${fmt(health.custOverpriced)} (${overPct} %)</span></div>`;
    if (health.worstIdx >= 0 && health.worstRatio > 1.15){
      const wt = G.tariffs[health.worstIdx];
      h += `<div class="cc-row"><span>Nejhorší tarif</span><span style="color:#f86963;font-weight:600">${wt ? wt.name : '?'} (${Math.round(health.worstRatio * 100)} %)</span></div>`;
    }
  } else {
    h += `<div style="font-size:11px;color:var(--tx-4)">Zatím žádní zákazníci na tarifech.</div>`;
  }
  const inflPct = Math.round((tInfl - 1) * 100);
  if (inflPct >= 1) h += `<div style="font-size:10px;color:#f5a524;margin-top:5px">📈 Valorizace +${inflPct} % — zákazník platí nominál × ${tInfl.toFixed(2)}. Poměry níže s ní už počítají.</div>`;
  h += `</div>`;

  // ---- Souhrn: proč klesá spokojenost (s návodem, co s tím) ----
  const hp = (typeof ccHappiness === 'function') ? ccHappiness(3) : null;
  h += `<div class="cc-card"><div class="cc-card-h">😟 Proč klesá spokojenost</div>`;
  if (hp && hp.issueAgg && Object.keys(hp.issueAgg).length){
    const sorted = Object.values(hp.issueAgg).sort((a, b) => b.cust - a.cust).slice(0, 5);
    for (const iss of sorted){
      h += `<div style="padding:5px 6px;background:var(--bg-2);border-radius:7px;margin:3px 0">`;
      h += `<div style="display:flex;justify-content:space-between;font-size:11px"><span style="font-weight:600;color:var(--tx-1)">${iss.label}</span><span style="color:#f5a524;font-weight:600;white-space:nowrap">${fmt(iss.cust)} zák. · ${iss.blds} bud.</span></div>`;
      h += `<div style="font-size:10px;color:var(--tx-3);margin-top:2px;line-height:1.45">→ ${iss.fix}</div>`;
      h += `</div>`;
    }
  } else if (hp && hp.n > 0){
    h += `<div style="font-size:11px;color:#3fb950">✓ Žádné zjištěné problémy.</div>`;
  } else {
    h += `<div style="font-size:11px;color:var(--tx-4)">Žádné připojené budovy.</div>`;
  }
  // Jak spokojenost funguje — čísla odpovídají mechanice hry
  h += `<details style="margin-top:7px"><summary style="font-size:10px;color:var(--tx-3);cursor:pointer;font-weight:600">ℹ️ Jak spokojenost funguje?</summary>`;
  h += `<div style="font-size:10px;color:var(--tx-3);line-height:1.55;margin-top:4px">`;
  h += `Každá připojená budova má spokojenost 0–100 (start 50). Měsíčně se mění:<br>`;
  h += `<b style="color:#3fb950">Zvyšuje:</b> základ +0,5 · vybavení DC (🖥️ Server +2, 📊 NMS +2, 🛡️ Firewall +1,5, 🔋 UPS +1,5, 💾 Backup +1) · doplňkové služby až +3 · support upgrady.<br>`;
  h += `<b style="color:#f86963">Snižuje:</b> trasa do DC nad 70 % kapacity · cena nad 115 % reference (čím víc, tím hůř) · WiFi přípojka −0,5 · přetížený vysílač · výpadky.<br>`;
  h += `Pod <b>25</b> zákazníci začínají odcházet, pod <b>10</b> hromadně. Nad <b>70</b> = šťastní (😊 zelené budovy na heatmapě).`;
  h += `</div></details>`;
  h += `</div>`;

  // ---- Tabulka tarifů ----
  h += `<div class="cc-card cc-span2"><div class="cc-card-h">💳 Tarify a ceny</div>`;
  h += `<div style="font-size:10px;color:var(--tx-3);margin-bottom:8px">Reference = férová tržní cena za rychlost a agregaci. Nad 115 % klesá spokojenost, nad 140 % zákazníci odcházejí. Tlačítko „ref" nastaví cenu na referenci (po valorizaci).</div>`;
  let lastCat = '';
  const catNames = { fixed: '🔌 Pevné připojení', mobile: '📱 Mobilní tarify', fwa: '🏠 FWA (Fixed Wireless)' };
  for (let ti = 0; ti < G.tariffs.length; ti++){
    const t = G.tariffs[ti];
    const cat = t.cat || 'fixed';
    if (cat !== lastCat){
      lastCat = cat;
      h += `<div style="font-size:10px;font-weight:700;color:var(--ac-violet-2);margin:8px 0 4px">${catNames[cat] || cat}</div>`;
    }
    const canUse = G.tech >= t.minTech && (typeof anyDCHasEq !== 'function' || anyDCHasEq(t.reqEq));
    const rp = refPrice(t.speed, t.share);
    const ratio = (t.price * tInfl) / rp;
    const eff = priceEffectLabel(ratio);
    const cust = counts[ti] || 0;
    const shareN = t.share || 1;
    h += `<div style="display:flex;align-items:center;gap:8px;padding:5px 6px;background:var(--bg-2);border-radius:8px;margin:3px 0;${canUse ? '' : 'opacity:.45'}">`;
    h += `<input type="checkbox" ${t.active ? 'checked' : ''} ${canUse ? '' : 'disabled'} onchange="G.tariffs[${ti}].active=this.checked;renderPricingCenter();updUI()" title="Nabízet tarif zákazníkům" style="accent-color:#7c3aed">`;
    h += `<div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:600;color:var(--tx-1)">${t.icon || ''} ${t.name} <span style="color:${shareN > 1 ? '#f5a524' : '#3fb950'};font-size:9px">${shareN > 1 ? '1:' + shareN : 'G'}</span>${canUse ? '' : ' 🔒'}</div>`;
    let legacyNote = '';
    if (t.price <= PRICE_FLOOR && ratio > 1.1) legacyNote = ` · <span style="color:#f5a524">na cenovém dně — starý tarif, zvaž vypnutí</span>`;
    h += `<div style="font-size:9.5px;color:var(--tx-4)">${t.speed >= 1000 ? (t.speed / 1000) + ' Gbps' : t.speed + ' Mbps'} · ${fmt(cust)} zák. · ref ${fmtKc(rp)} · <span style="color:${eff.clr}">${eff.label}</span>${legacyNote}</div></div>`;
    // Poměrový bar (50–220 %)
    const barPct = Math.max(0, Math.min(100, (ratio - 0.5) / 1.7 * 100));
    h += `<div style="width:64px" title="${Math.round(ratio * 100)} % reference"><div style="height:6px;border-radius:3px;background:var(--bg-0);overflow:hidden"><div style="width:${barPct}%;height:100%;background:${eff.clr}"></div></div>`;
    h += `<div style="font-size:9px;color:${eff.clr};text-align:center;font-weight:700">${Math.round(ratio * 100)} %</div></div>`;
    h += `<input type="number" value="${t.price}" min="29" ${canUse ? '' : 'disabled'} onchange="setTariffPrice(${ti},parseInt(this.value)||29)" style="width:70px;padding:3px 6px;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:6px;color:${eff.clr};font-size:11px;font-weight:600;text-align:right"> <span style="font-size:10px;color:var(--tx-4)">Kč</span>`;
    h += `<button onclick="nudgeTariffPrice(${ti},-0.05)" ${canUse ? '' : 'disabled'} style="padding:3px 7px;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:6px;color:var(--tx-2);cursor:pointer;font-size:10px" title="Zlevnit o 5 %">−5 %</button>`;
    h += `<button onclick="nudgeTariffPrice(${ti},0.05)" ${canUse ? '' : 'disabled'} style="padding:3px 7px;background:var(--bg-0);border:1px solid var(--bd-1);border-radius:6px;color:var(--tx-2);cursor:pointer;font-size:10px" title="Zdražit o 5 %">+5 %</button>`;
    h += `<button onclick="setTariffPrice(${ti},suggestPrice(${rp},${tInfl},1))" ${canUse ? '' : 'disabled'} style="padding:3px 7px;background:var(--bg-0);border:1px solid ${ratio > 1.15 ? '#3fb950' : 'var(--bd-1)'};border-radius:6px;color:${ratio > 1.15 ? '#3fb950' : 'var(--tx-2)'};cursor:pointer;font-size:10px" title="Nastavit na referenční cenu (${fmtKc(rp)} efektivně)">ref</button>`;
    h += `</div>`;
  }
  h += `</div>`;

  h += '</div>';
  el.innerHTML = h;
}

if (typeof module !== 'undefined' && module.exports){
  module.exports = { priceEffectLabel, portfolioPriceHealth, suggestPrice, PRICE_FLOOR };
}
