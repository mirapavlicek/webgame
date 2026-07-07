#!/usr/bin/env node
/**
 * pricing.test.js — cenové centrum (js/pricing.js)
 *
 * Co testuje:
 *   1. priceEffectLabel — prahy odpovídající mechanice (1.15 sat, 1.4 churn)
 *   2. portfolioPriceHealth — vážený průměr, předražení zákazníci, nejhorší tarif
 *   3. suggestPrice — doporučená nominální cena vůči referenci a valorizaci
 */
'use strict';

const p = require('../js/pricing.js');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }
function approx(a, b, e) { return Math.abs(a - b) <= (e || 1e-9); }

console.log('\u2550\u2550\u2550 Test 1: priceEffectLabel \u2550\u2550\u2550');
{
  ok(p.priceEffectLabel(1.0).severity === 0, 'férová cena → severity 0');
  ok(p.priceEffectLabel(0.7).severity === 0 && p.priceEffectLabel(0.7).clr === '#3fb950', 'výhodná → zelená');
  ok(p.priceEffectLabel(1.2).severity === 2, '1.2 → klesá spokojenost (severity 2)');
  ok(p.priceEffectLabel(1.5).severity === 3, '1.5 → odliv (severity 3)');
  ok(p.priceEffectLabel(2.5).severity === 5, '2.5 → zlodějina (severity 5)');
  ok(p.priceEffectLabel(1.12).severity === 1, '1.12 → mírně dražší (severity 1)');
  ok(p.priceEffectLabel(0).severity === 0, 'nulový poměr → bez ceny');
  // monotónnost severity
  let mono = true, prev = 0;
  for (const r of [0.5, 0.9, 1.05, 1.12, 1.3, 1.5, 1.9, 2.5]){
    const s = p.priceEffectLabel(r).severity;
    if (s < prev) mono = false; prev = s;
  }
  ok(mono, 'severity neklesá s rostoucím poměrem');
}

console.log('\u2550\u2550\u2550 Test 2: portfolioPriceHealth \u2550\u2550\u2550');
{
  const refFn = (speed) => speed * 10; // jednoduchá reference: 10 Kč/Mbps
  const tariffs = [
    { price: 500, speed: 50 },   // ratio 1.0, 10 zák.
    { price: 1500, speed: 100 }, // ratio 1.5, 5 zák.
    { price: 100, speed: 10 },   // ratio 1.0, 0 zák. — nepočítá se
  ];
  const h = p.portfolioPriceHealth(tariffs, { 0: 10, 1: 5 }, refFn, 1);
  ok(approx(h.avgRatio, (1.0 * 10 + 1.5 * 5) / 15, 1e-9), `vážený průměr = ${(h.avgRatio).toFixed(3)}`);
  ok(h.custTotal === 15, 'celkem 15 zákazníků');
  ok(h.custOverpriced === 5, '5 zákazníků na předraženém (>1.15)');
  ok(h.worstIdx === 1 && approx(h.worstRatio, 1.5), 'nejhorší tarif = index 1 (1.5×)');
  // valorizace zvedá efektivní poměr
  const h2 = p.portfolioPriceHealth([{ price: 500, speed: 50 }], { 0: 10 }, refFn, 1.2);
  ok(approx(h2.avgRatio, 1.2), 'valorizace 1.2 → poměr 1.2');
  const empty = p.portfolioPriceHealth([], {}, refFn, 1);
  ok(empty.avgRatio === 0 && empty.worstIdx === -1, 'prázdné portfolio → nuly');
}

console.log('\u2550\u2550\u2550 Test 3: suggestPrice \u2550\u2550\u2550');
{
  // ref 500, bez valorizace, cíl 1.0 → ~499 (zaokrouhlení na …9)
  ok(p.suggestPrice(500, 1, 1) === 499, `ref 500 → 499 (${p.suggestPrice(500, 1, 1)})`);
  // s valorizací 1.25 musí být nominál nižší: 500/1.25 = 400 → 399
  ok(p.suggestPrice(500, 1.25, 1) === 399, `valorizace 1.25 → nominál 399 (${p.suggestPrice(500, 1.25, 1)})`);
  // cílový poměr 0.9
  ok(p.suggestPrice(1000, 1, 0.9) === 899, `cíl 90 % z ref 1000 → 899 (${p.suggestPrice(1000, 1, 0.9)})`);
  // nikdy pod 99
  ok(p.suggestPrice(50, 1, 1) === 99, 'minimum 99 Kč');
  // efektivní cena po valorizaci ≈ ref (±3 %)
  const nom = p.suggestPrice(789, 1.18, 1);
  ok(Math.abs(nom * 1.18 - 789) / 789 < 0.03, `efektivní cena ≈ ref (${(nom * 1.18).toFixed(0)} vs. 789)`);
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
