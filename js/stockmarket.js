// ====== BURZA — INVESTICE DO VIRTUÁLNÍCH FIREM ======
// Endgame pro bohaté hráče: nahodilé firmy s různými zisky/ztrátami,
// akcie od pár korun po miliardy za kus (třída „Dravec A"), kvartální
// výsledky, dividendy, krachy, IPO nových firem — a když máš opravdu
// hodně peněz, můžeš firmu koupit celou a inkasovat její zisk (i ztrátu).
//
// Odemyká se, jakmile hotovost poprvé přesáhne SM_UNLOCK_CASH.

const SM_UNLOCK_CASH = 5000000;   // 5 mil. Kč — „když máš hodně peněz"
const SM_FEE = 0.005;             // broker fee 0,5 %
const SM_HISTORY = 24;            // délka cenové historie (měsíce)
const SM_ACQ_PREMIUM = 0.30;      // prémie 30 % při koupi celé firmy

// Katalog firem: cena za akcii od desítek Kč po miliardy (à la BRK.A).
// health = skrytá kondice firmy (−1..1), řídí drift ceny a zisk/ztrátu.
const SM_COMPANIES = [
  { id:'uhlomor',  name:'Uhlomor a.s.',        icon:'⛏️', sector:'Těžba',      price:45,          shares:80000000, vol:0.06, div:0.06 },
  { id:'pekarna',  name:'Pekárny Bohemia',     icon:'🥖', sector:'Potraviny',  price:120,         shares:40000000, vol:0.04, div:0.05 },
  { id:'telco1',   name:'TelCo One',           icon:'📞', sector:'Telekom',    price:340,         shares:60000000, vol:0.05, div:0.045 },
  { id:'slunce',   name:'SlunceEnergo',        icon:'☀️', sector:'Energie',    price:890,         shares:30000000, vol:0.09, div:0.02 },
  { id:'megabank', name:'MegaBanka',           icon:'🏦', sector:'Finance',    price:2400,        shares:50000000, vol:0.05, div:0.055 },
  { id:'robofarm', name:'RoboFarm',            icon:'🤖', sector:'Průmysl',    price:5600,        shares:12000000, vol:0.10, div:0 },
  { id:'biogenix', name:'BioGenix',            icon:'🧬', sector:'Biotech',    price:14500,       shares:8000000,  vol:0.16, div:0 },
  { id:'nanochip', name:'NanoChip Fab',        icon:'💾', sector:'Polovodiče', price:48000,       shares:5000000,  vol:0.13, div:0.01 },
  { id:'cloudm',   name:'CloudMasta Corp',     icon:'☁️', sector:'Cloud/IT',   price:185000,      shares:2500000,  vol:0.12, div:0 },
  { id:'astronet', name:'AstroNet Orbital',    icon:'🛰️', sector:'Vesmír',     price:920000,      shares:900000,   vol:0.18, div:0 },
  { id:'kvantum',  name:'Kvantum Technologies',icon:'⚛️', sector:'Kvantová IT',price:8500000,     shares:300000,   vol:0.20, div:0 },
  { id:'dravec',   name:'DravecCapital A',     icon:'🦅', sector:'Holding',    price:2400000000,  shares:1200,     vol:0.05, div:0 },
];

// Firmy čekající na IPO (nastupují, když někdo zkrachuje)
const SM_IPO_POOL = [
  { id:'fuzetech', name:'FúzeTech Reaktory', icon:'⚡', sector:'Energie',   price:62000,  shares:4000000, vol:0.17, div:0 },
  { id:'aigenix',  name:'AIGenix Labs',      icon:'🧠', sector:'AI',        price:310000, shares:1500000, vol:0.19, div:0 },
  { id:'hypernet', name:'HyperNet 7G',       icon:'📡', sector:'Telekom',   price:27000,  shares:6000000, vol:0.11, div:0.015 },
  { id:'zlatodul', name:'ZlatoDůl Kutná',    icon:'🥇', sector:'Těžba',     price:780,    shares:25000000,vol:0.08, div:0.03 },
];

// ---- Čisté funkce (testovatelné) ----

// Další cena: random walk s driftem podle kondice. rnd ∈ [0,1).
// Cena nikdy neklesne pod 1 % IPO ceny jinak než krachem.
function smNextPrice(price, health, vol, rnd){
  const drift = (health || 0) * 0.03;                    // kondice táhne ±3 %/měs
  const shock = ((rnd != null ? rnd : Math.random()) * 2 - 1) * (vol || 0.08);
  return Math.max(0.01, price * (1 + drift + shock));
}

// Vývoj kondice: mean-reverting náhodná procházka v ⟨−1, 1⟩.
function smNextHealth(health, rnd){
  const r = (rnd != null ? rnd : Math.random()) * 2 - 1;
  const next = (health || 0) * 0.85 + r * 0.35;
  return Math.max(-1, Math.min(1, next));
}

// Cena nákupu n akcií včetně poplatku.
function smBuyCost(price, n, fee){
  return Math.round(price * n * (1 + (fee == null ? SM_FEE : fee)));
}
// Výnos z prodeje n akcií po poplatku.
function smSellProceeds(price, n, fee){
  return Math.round(price * n * (1 - (fee == null ? SM_FEE : fee)));
}
// Tržní kapitalizace.
function smMarketCap(c){ return c.price * c.shares; }

// Cena za koupi celé firmy: zbývající akcie (mimo hráčovy) × cena × prémie.
function smAcquisitionCost(c, ownedShares){
  const remaining = Math.max(0, c.shares - (ownedShares || 0));
  return Math.round(remaining * c.price * (1 + SM_ACQ_PREMIUM));
}

// Měsíční zisk/ztráta vlastněné firmy: ~0,7 % kapitalizace ročně na bodu
// kondice — zisková firma vydělává, ztrátová prodělává i majiteli.
function smOwnedIncome(cap, health){
  return Math.round(cap * (health || 0) * 0.007 / 1.0);
}

// Kvartální dividenda z držených akcií (div = roční yield).
function smDividend(price, sharesHeld, divYield){
  return Math.round(price * (sharesHeld || 0) * (divYield || 0) / 4);
}

// Krach: firma v mizerné kondici a cena pod 5 % IPO → riziko delistingu.
function smBankruptcyRisk(price, ipoPrice, health){
  return (price < ipoPrice * 0.05 && (health || 0) < -0.5);
}

// ---- Stav ----
function smEnsure(){
  if (typeof G === 'undefined' || !G) return null;
  if (!G.stockMarket){
    G.stockMarket = {
      unlocked: false,
      companies: SM_COMPANIES.map(c => ({
        ...c, ipoPrice: c.price, health: (Math.random() * 2 - 1) * 0.5,
        hist: [c.price], lastChange: 0, ownedByPlayer: false, delisted: false,
      })),
      ipoQueue: SM_IPO_POOL.map(c => ({ ...c })),
    };
  }
  if (!G.portfolio) G.portfolio = {};   // compId → {shares, avgCost}
  return G;
}

function smUnlockCheck(){
  if (!smEnsure()) return;
  if (!G.stockMarket.unlocked && G.cash >= SM_UNLOCK_CASH){
    G.stockMarket.unlocked = true;
    if (typeof notify === 'function') notify('📈 BURZA ODEMČENA! Máš dost kapitálu na investice do firem — najdeš ji v Mgmt → Burza.', 'good');
  }
}

// ---- Měsíční tik ----
function stockMarketMonthlyTick(){
  if (!smEnsure()) return;
  smUnlockCheck();
  const sm = G.stockMarket;
  if (!sm.unlocked) return;
  const isQuarter = (G.date.m % 3) === 0;

  for (const c of sm.companies){
    if (c.delisted) continue;
    c.health = smNextHealth(c.health);
    const prev = c.price;
    c.price = smNextPrice(c.price, c.health, c.vol);

    // Kvartální výsledky: skok podle kondice (trh reaguje na earnings)
    if (isQuarter){
      const surprise = c.health * (0.06 + Math.random() * 0.10);
      c.price *= (1 + surprise);
    }
    // Náhodné zprávy (průlom/skandál) — 4 %/měs
    if (Math.random() < 0.04){
      const news = (Math.random() < 0.5 ? -1 : 1) * (0.10 + Math.random() * 0.30);
      c.price *= (1 + news);
      const held = (G.portfolio[c.id]?.shares || 0) > 0 || c.ownedByPlayer;
      if (held && typeof notify === 'function')
        notify(`${news > 0 ? '🚀' : '📉'} ${c.icon} ${c.name}: ${news > 0 ? 'průlom — akcie +' : 'skandál — akcie −'}${Math.round(Math.abs(news) * 100)} %`, news > 0 ? 'good' : 'bad');
    }
    c.price = Math.max(0.01, c.price);
    c.lastChange = prev > 0 ? (c.price / prev - 1) : 0;
    c.hist.push(c.price);
    if (c.hist.length > SM_HISTORY) c.hist.shift();

    // Vlastněná firma sype (nebo žere) měsíční zisk
    if (c.ownedByPlayer){
      const inc = smOwnedIncome(smMarketCap(c), c.health);
      G.cash += inc;
      if (isQuarter && typeof notify === 'function')
        notify(`${c.icon} ${c.name} (tvoje firma): ${inc >= 0 ? '+' : ''}${fmtKc(inc)}/měs`, inc >= 0 ? 'good' : 'bad');
    }

    // Dividendy z držených akcií (kvartálně)
    if (isQuarter && c.div > 0 && !c.ownedByPlayer){
      const held = G.portfolio[c.id]?.shares || 0;
      if (held > 0){
        const d = smDividend(c.price, held, c.div);
        if (d > 0){ G.cash += d; if (typeof notify === 'function') notify(`💵 Dividenda ${c.name}: +${fmtKc(d)}`, 'good'); }
      }
    }

    // Krach — delisting, akcie bezcenné (vlastněnou firmu hráč nenechá padnout)
    if (!c.ownedByPlayer && smBankruptcyRisk(c.price, c.ipoPrice, c.health) && Math.random() < 0.25){
      c.delisted = true;
      const held = G.portfolio[c.id]?.shares || 0;
      if (typeof notify === 'function') notify(`💀 ${c.name} ZKRACHOVALA!${held > 0 ? ' Tvoje akcie jsou bezcenné.' : ''}`, held > 0 ? 'bad' : 'info');
      delete G.portfolio[c.id];
      // IPO náhradníka
      if (sm.ipoQueue.length){
        const ipo = sm.ipoQueue.shift();
        sm.companies.push({ ...ipo, ipoPrice: ipo.price, health: 0.3 + Math.random() * 0.4, hist: [ipo.price], lastChange: 0, ownedByPlayer: false, delisted: false });
        if (typeof notify === 'function') notify(`🔔 IPO: na burzu vstupuje ${ipo.icon} ${ipo.name} (${fmtKc(ipo.price)}/akcie)`, 'info');
      }
    }
  }
}

// ---- Akce hráče ----
function smBuy(compId, n){
  if (!smEnsure()) return;
  const c = G.stockMarket.companies.find(x => x.id === compId);
  if (!c || c.delisted || c.ownedByPlayer){ notify('❌ Nelze koupit.', 'bad'); return; }
  const held = G.portfolio[compId]?.shares || 0;
  n = Math.max(1, Math.min(Math.floor(n), c.shares - held));
  const cost = smBuyCost(c.price, n);
  if (G.cash < cost){ notify(`❌ Chybí ${fmtKc(cost - G.cash)} (${n}× ${c.name} = ${fmtKc(cost)})`, 'bad'); return; }
  G.cash -= cost;
  const p = G.portfolio[compId] || { shares: 0, avgCost: 0 };
  p.avgCost = (p.avgCost * p.shares + c.price * n) / (p.shares + n);
  p.shares += n;
  G.portfolio[compId] = p;
  notify(`📈 Koupeno ${fmt(n)}× ${c.name} za ${fmtKc(cost)} (vč. poplatku 0,5 %)`, 'good');
  renderStockMarket(); if (typeof updUI === 'function') updUI();
}

function smSell(compId, n){
  if (!smEnsure()) return;
  const c = G.stockMarket.companies.find(x => x.id === compId);
  const p = G.portfolio[compId];
  if (!c || !p || p.shares <= 0){ notify('❌ Nemáš co prodat.', 'bad'); return; }
  n = Math.max(1, Math.min(Math.floor(n), p.shares));
  const proceeds = smSellProceeds(c.price, n);
  G.cash += proceeds;
  p.shares -= n;
  if (p.shares <= 0) delete G.portfolio[compId];
  notify(`💰 Prodáno ${fmt(n)}× ${c.name} za ${fmtKc(proceeds)}`, 'good');
  renderStockMarket(); if (typeof updUI === 'function') updUI();
}

function smAcquire(compId){
  if (!smEnsure()) return;
  const c = G.stockMarket.companies.find(x => x.id === compId);
  if (!c || c.delisted || c.ownedByPlayer) return;
  const held = G.portfolio[compId]?.shares || 0;
  const cost = smAcquisitionCost(c, held);
  if (G.cash < cost){ notify(`❌ Převzetí ${c.name} stojí ${fmtKc(cost)} — chybí ${fmtKc(cost - G.cash)}`, 'bad'); return; }
  G.cash -= cost;
  c.ownedByPlayer = true;
  delete G.portfolio[compId];
  notify(`🏆 PŘEVZETÍ! ${c.icon} ${c.name} je celá tvoje — měsíčně inkasuješ její zisk (i ztrátu).`, 'good');
  renderStockMarket(); if (typeof updUI === 'function') updUI();
}

function smSellCompany(compId){
  if (!smEnsure()) return;
  const c = G.stockMarket.companies.find(x => x.id === compId);
  if (!c || !c.ownedByPlayer) return;
  const proceeds = Math.round(smMarketCap(c) * 0.9); // prodej pod cenou (rychlý exit)
  G.cash += proceeds;
  c.ownedByPlayer = false;
  notify(`💼 ${c.name} prodána za ${fmtKc(proceeds)} (90 % kapitalizace)`, 'good');
  renderStockMarket(); if (typeof updUI === 'function') updUI();
}

// Hodnota portfolia (akcie + vlastněné firmy)
function smPortfolioValue(){
  if (!smEnsure()) return 0;
  let v = 0;
  for (const c of G.stockMarket.companies){
    if (c.delisted) continue;
    if (c.ownedByPlayer) v += smMarketCap(c);
    const p = G.portfolio[c.id];
    if (p) v += p.shares * c.price;
  }
  return Math.round(v);
}

// ---- UI ----
function smSpark(hist, w, h, clr){
  if (!hist || hist.length < 2) return '';
  const min = Math.min(...hist), max = Math.max(...hist), span = (max - min) || 1;
  const pts = hist.map((v, i) => `${(i / (hist.length - 1) * w).toFixed(1)},${(h - (v - min) / span * h).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" style="display:block"><polyline points="${pts}" fill="none" stroke="${clr}" stroke-width="1.5"/></svg>`;
}

function fmtKcBig(n){
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toLocaleString('cs-CZ', { maximumFractionDigits: 2 }) + ' mld Kč';
  if (a >= 1e6) return (n / 1e6).toLocaleString('cs-CZ', { maximumFractionDigits: 1 }) + ' mil Kč';
  return fmtKc(Math.round(n));
}

function renderStockMarket(){
  const el = document.getElementById('stockMarketPanel');
  if (!el || !smEnsure()) return;
  smUnlockCheck(); // odemkni hned, jak je kapitál — ne až při měsíčním ticku
  const sm = G.stockMarket;
  if (!sm.unlocked){
    el.innerHTML = `<div style="font-size:10.5px;color:var(--tx-4);padding:8px;text-align:center">🔒 Burza se odemkne, až hotovost poprvé přesáhne <b>${fmtKcBig(SM_UNLOCK_CASH)}</b>.<br>Investuj přebytečný kapitál do virtuálních firem — od levných akcií po miliardové kusy.</div>`;
    return;
  }
  const pv = smPortfolioValue();
  let h = `<div style="font-size:10px;color:var(--tx-3);padding:4px 6px;background:var(--bg-2);border-radius:6px;margin-bottom:6px">💼 Hodnota investic: <b style="color:#3fb950">${fmtKcBig(pv)}</b> · poplatek 0,5 % · dividendy a výsledky kvartálně</div>`;
  const live = sm.companies.filter(c => !c.delisted);
  live.sort((a, b) => (b.ownedByPlayer ? 1 : 0) - (a.ownedByPlayer ? 1 : 0) || ((G.portfolio[b.id]?.shares || 0) > 0 ? 1 : 0) - ((G.portfolio[a.id]?.shares || 0) > 0 ? 1 : 0) || a.price - b.price);
  for (const c of live){
    const p = G.portfolio[c.id];
    const chg = Math.round((c.lastChange || 0) * 100);
    const chgClr = chg > 0 ? '#3fb950' : chg < 0 ? '#f85149' : '#8b949e';
    const hClr = c.health > 0.2 ? '#3fb950' : c.health < -0.2 ? '#f85149' : '#f59e0b';
    h += `<div style="background:#0d1117;border:1px solid ${c.ownedByPlayer ? '#f59e0b' : p ? '#7c3aed' : '#21262d'};border-radius:6px;padding:6px;margin:4px 0">`;
    h += `<div style="display:flex;align-items:center;gap:6px">`;
    h += `<div style="flex:1;min-width:0"><div style="font-size:10.5px;font-weight:700;color:#e6edf3">${c.icon} ${c.name}${c.ownedByPlayer ? ' <span style="color:#f59e0b">— TVOJE FIRMA</span>' : ''}</div>`;
    h += `<div style="font-size:9px;color:#6e7681">${c.sector} · kap. ${fmtKcBig(smMarketCap(c))} · kondice <b style="color:${hClr}">${c.health > 0.2 ? 'zisková' : c.health < -0.2 ? 'ztrátová' : 'neutrální'}</b>${c.div > 0 ? ` · div ${(c.div * 100).toFixed(1)} %` : ''}</div></div>`;
    h += `<div style="text-align:right"><div style="font-size:10.5px;font-weight:700;color:#e6edf3">${fmtKcBig(c.price)}</div><div style="font-size:9px;color:${chgClr}">${chg >= 0 ? '+' : ''}${chg} %/měs</div></div>`;
    h += `<div>${smSpark(c.hist, 52, 20, chgClr)}</div>`;
    h += `</div>`;
    if (c.ownedByPlayer){
      const inc = smOwnedIncome(smMarketCap(c), c.health);
      h += `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;font-size:9.5px"><span style="flex:1;color:${inc >= 0 ? '#3fb950' : '#f85149'}">Měsíční ${inc >= 0 ? 'zisk' : 'ZTRÁTA'}: ${inc >= 0 ? '+' : ''}${fmtKcBig(inc)}</span>`;
      h += `<button onclick="smSellCompany('${c.id}')" style="padding:2px 8px;background:#161b22;border:1px solid #f59e0b;border-radius:4px;color:#f59e0b;cursor:pointer;font-size:9px">Prodat firmu (${fmtKcBig(Math.round(smMarketCap(c) * 0.9))})</button></div>`;
    } else {
      if (p && p.shares > 0){
        const gain = (c.price / p.avgCost - 1) * 100;
        h += `<div style="font-size:9.5px;color:#a78bfa;margin-top:3px">Držíš ${fmt(p.shares)} ks (⌀ ${fmtKcBig(p.avgCost)}) · ${gain >= 0 ? '+' : ''}${gain.toFixed(1)} % · hodnota ${fmtKcBig(p.shares * c.price)}</div>`;
      }
      h += `<div style="display:flex;gap:3px;margin-top:4px;flex-wrap:wrap">`;
      for (const n of [1, 10, 100]){
        if (n > 1 && c.price * n > G.cash * 4) continue; // nesmyslná tlačítka skryj
        h += `<button onclick="smBuy('${c.id}',${n})" style="padding:2px 7px;background:#0a1a0a;border:1px solid #3fb950;border-radius:4px;color:#3fb950;cursor:pointer;font-size:9px">+${n}</button>`;
      }
      h += `<button onclick="smBuy('${c.id}',Math.floor(G.cash/(${c.price}*1.005)))" style="padding:2px 7px;background:#0a1a0a;border:1px solid #3fb950;border-radius:4px;color:#3fb950;cursor:pointer;font-size:9px" title="Nakup maximum za hotovost">MAX</button>`;
      if (p && p.shares > 0){
        h += `<button onclick="smSell('${c.id}',${Math.max(1, Math.floor((p.shares) / 2))})" style="padding:2px 7px;background:#1a0a0a;border:1px solid #f85149;border-radius:4px;color:#f85149;cursor:pointer;font-size:9px">−½</button>`;
        h += `<button onclick="smSell('${c.id}',${p.shares})" style="padding:2px 7px;background:#1a0a0a;border:1px solid #f85149;border-radius:4px;color:#f85149;cursor:pointer;font-size:9px">Prodat vše</button>`;
      }
      const acqCost = smAcquisitionCost(c, p?.shares || 0);
      if (G.cash > acqCost * 0.5){
        h += `<button onclick="smAcquire('${c.id}')" style="padding:2px 7px;background:#161b22;border:1px solid #f59e0b;border-radius:4px;color:#f59e0b;cursor:pointer;font-size:9px" title="Koupit zbývající akcie s prémií 30 % — firma pak měsíčně sype zisk (nebo žere ztrátu)">🏆 Koupit celou (${fmtKcBig(acqCost)})</button>`;
      }
      h += `</div>`;
    }
    h += `</div>`;
  }
  el.innerHTML = h;
}

if (typeof module !== 'undefined' && module.exports){
  module.exports = {
    SM_COMPANIES, SM_IPO_POOL, SM_UNLOCK_CASH, SM_FEE, SM_ACQ_PREMIUM,
    smNextPrice, smNextHealth, smBuyCost, smSellProceeds, smMarketCap,
    smAcquisitionCost, smOwnedIncome, smDividend, smBankruptcyRisk,
  };
}
