#!/usr/bin/env node
/**
 * citygrowth.test.js — ověření čisté logiky organického růstu města
 * (js/citygrowth.js)
 *
 * Co testuje:
 *   1. pickGrowthBuildingType vrací platné typy budov
 *   2. Jádro města preferuje výškové budovy, periferie rodinné domy
 *   3. Vyšší rok zvyšuje podíl mrakodrapů v jádru
 *   4. cityGrowthAmount roste s počtem zákazníků a je v mezích [1,14]
 */
'use strict';

const cg = require('../js/citygrowth.js');

const VALID = new Set(['house', 'rowhouse', 'shop', 'panel', 'factory', 'public', 'skyscraper', 'bigcorp']);

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  \u2713 ' + msg); }
  else { fail++; console.log('  \u2717 ' + msg); }
}

console.log('\u2550\u2550\u2550 Test 1: platné typy budov \u2550\u2550\u2550');
{
  let allValid = true;
  for (let i = 0; i < 200; i++) {
    const d = Math.random() * 25;
    const t = cg.pickGrowthBuildingType(d, 2010, Math.random);
    if (!VALID.has(t)) { allValid = false; break; }
  }
  ok(allValid, 'všechny vrácené typy jsou platné');
}

console.log('\u2550\u2550\u2550 Test 2: jádro vs periferie \u2550\u2550\u2550');
{
  // rnd=0 → první větev v každém pásmu
  ok(cg.pickGrowthBuildingType(2, 2005, () => 0) === 'skyscraper', 'jádro při rnd=0 → mrakodrap');
  ok(cg.pickGrowthBuildingType(22, 2005, () => 0) === 'house', 'periferie při rnd=0 → dům');
  // statisticky: jádro má víc výškových budov než periferie
  let coreHigh = 0, edgeHigh = 0;
  for (let i = 0; i < 2000; i++) {
    if (['skyscraper', 'bigcorp'].includes(cg.pickGrowthBuildingType(3, 2010, Math.random))) coreHigh++;
    if (['skyscraper', 'bigcorp'].includes(cg.pickGrowthBuildingType(22, 2010, Math.random))) edgeHigh++;
  }
  ok(coreHigh > edgeHigh, `jádro má víc výškových budov (${coreHigh} vs ${edgeHigh})`);
}

console.log('\u2550\u2550\u2550 Test 3: vliv roku na výšku \u2550\u2550\u2550');
{
  // rnd na hraně 0.30: v 2005 NENÍ mrakodrap, v pozdním roce kvůli highRise bonusu ANO
  const r = () => 0.31;
  const early = cg.pickGrowthBuildingType(3, 2005, r);
  const late = cg.pickGrowthBuildingType(3, 2030, r);
  ok(early !== 'skyscraper', `2005 při rnd=0.31 není mrakodrap (${early})`);
  ok(late === 'skyscraper', `2030 při rnd=0.31 je mrakodrap (highRise bonus) (${late})`);
}

console.log('\u2550\u2550\u2550 Test 4: cityGrowthAmount \u2550\u2550\u2550');
{
  const a0 = cg.cityGrowthAmount(2005, 0, () => 0);
  ok(a0 >= 1, `základ při 0 zákaznících >= 1 (${a0})`);
  const aLow = cg.cityGrowthAmount(2010, 100, () => 0);
  const aHigh = cg.cityGrowthAmount(2010, 4000, () => 0);
  ok(aHigh > aLow, `víc zákazníků → větší růst (${aLow} → ${aHigh})`);
  let inRange = true;
  for (let c = 0; c <= 100000; c += 2500) for (const y of [2005, 2020, 2040]) {
    const v = cg.cityGrowthAmount(y, c, Math.random);
    if (v < 1 || v > 14) inRange = false;
  }
  ok(inRange, 'výsledek je vždy v mezích [1, 14]');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
