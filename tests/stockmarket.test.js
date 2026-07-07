#!/usr/bin/env node
/**
 * stockmarket.test.js — burza s virtuálními firmami (js/stockmarket.js)
 *
 * Co testuje:
 *   1. Katalog — rozsah cen (desítky Kč až miliardy), unikátní id, IPO pool
 *   2. smNextPrice/smNextHealth — meze, drift podle kondice
 *   3. Nákup/prodej — poplatky, kapitalizace
 *   4. Akvizice — prémie 30 %, zohlednění držených akcií
 *   5. Zisk vlastněné firmy a dividendy
 *   6. Riziko krachu
 */
'use strict';

const sm = require('../js/stockmarket.js');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }
function approx(a, b, e) { return Math.abs(a - b) <= (e || 1e-9); }

console.log('═══ Test 1: katalog firem ═══');
{
  ok(sm.SM_COMPANIES.length >= 10, `aspoň 10 firem (${sm.SM_COMPANIES.length})`);
  const prices = sm.SM_COMPANIES.map(c => c.price);
  ok(Math.min(...prices) < 100, `nejlevnější akcie pod 100 Kč (${Math.min(...prices)})`);
  ok(Math.max(...prices) >= 1e9, `nejdražší akcie v řádu miliard (${Math.max(...prices).toLocaleString()})`);
  const ids = new Set(sm.SM_COMPANIES.map(c => c.id).concat(sm.SM_IPO_POOL.map(c => c.id)));
  ok(ids.size === sm.SM_COMPANIES.length + sm.SM_IPO_POOL.length, 'unikátní id včetně IPO poolu');
  ok(sm.SM_COMPANIES.every(c => c.shares > 0 && c.vol > 0), 'všechny mají shares a volatilitu');
  ok(sm.SM_IPO_POOL.length >= 3, 'IPO pool má náhradníky za krachy');
  ok(sm.SM_UNLOCK_CASH === 5000000, 'odemčení při 5 mil. Kč');
}

console.log('═══ Test 2: cena a kondice ═══');
{
  // rnd 0.5 → shock 0, jen drift
  ok(approx(sm.smNextPrice(1000, 1, 0.1, 0.5), 1030), 'plná kondice → +3 % drift');
  ok(approx(sm.smNextPrice(1000, -1, 0.1, 0.5), 970), 'mizerná kondice → −3 %');
  ok(sm.smNextPrice(0.02, -1, 0.5, 0) >= 0.01, 'cena nikdy pod 0,01');
  // volatilita: rnd 1 → +vol, rnd 0 → −vol
  ok(approx(sm.smNextPrice(1000, 0, 0.1, 1), 1100), 'max šok = +vol');
  ok(approx(sm.smNextPrice(1000, 0, 0.1, 0), 900), 'min šok = −vol');
  // health mean-reverting v mezích
  let h = 1; for (let i = 0; i < 50; i++){ h = sm.smNextHealth(h, 0.5); }
  ok(h > -1 && h < 1 && Math.abs(h) < 0.2, `kondice se vrací k nule (${h.toFixed(3)})`);
  ok(sm.smNextHealth(0, 1) <= 1 && sm.smNextHealth(0, 0) >= -1, 'kondice v ⟨−1,1⟩');
}

console.log('═══ Test 3: nákup/prodej s poplatkem ═══');
{
  ok(sm.smBuyCost(1000, 10) === 10050, '10× za 1000 + 0,5 % = 10 050');
  ok(sm.smSellProceeds(1000, 10) === 9950, 'prodej 10× za 1000 − 0,5 % = 9 950');
  ok(sm.smBuyCost(100, 1, 0) === 100, 'bez poplatku přesně cena');
  ok(sm.smMarketCap({ price: 2400000000, shares: 1200 }) === 2.88e12, 'kapitalizace DravecCapital = 2,88 bil.');
}

console.log('═══ Test 4: akvizice celé firmy ═══');
{
  const c = { price: 1000, shares: 1000000 };
  ok(sm.smAcquisitionCost(c, 0) === 1300000000, 'plná akvizice = kap. × 1,3');
  ok(sm.smAcquisitionCost(c, 400000) === 780000000, 'držené akcie snižují cenu převzetí');
  ok(sm.smAcquisitionCost(c, 1000000) === 0, 'vlastníš-li vše, převzetí zdarma');
  ok(sm.SM_ACQ_PREMIUM === 0.30, 'prémie 30 %');
}

console.log('═══ Test 5: zisk vlastněné firmy a dividendy ═══');
{
  ok(sm.smOwnedIncome(1e9, 1) === 7000000, 'zisková mld firma → +7 mil/měs');
  ok(sm.smOwnedIncome(1e9, -0.5) === -3500000, 'ztrátová → −3,5 mil/měs (majitel platí)');
  ok(sm.smOwnedIncome(1e9, 0) === 0, 'neutrální → 0');
  ok(sm.smDividend(1000, 100, 0.06) === 1500, 'dividenda: 100 ks × 1000 × 6 %/4 = 1 500');
  ok(sm.smDividend(1000, 0, 0.06) === 0, 'bez akcií nic');
}

console.log('═══ Test 6: krach ═══');
{
  ok(sm.smBankruptcyRisk(4, 100, -0.8) === true, 'cena 4 % IPO + mizerná kondice → riziko');
  ok(sm.smBankruptcyRisk(4, 100, 0) === false, 'nízká cena, ale OK kondice → ne');
  ok(sm.smBankruptcyRisk(50, 100, -0.9) === false, 'cena drží → ne');
}

console.log('═'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
