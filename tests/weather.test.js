#!/usr/bin/env node
/**
 * weather.test.js — ověření logiky počasí (js/weather.js)
 *
 * Co testuje:
 *   1. weatherWeights — sezónní rozložení (vedro v létě, ne v zimě)
 *   2. nextWeather — vždy platný typ, deterministický při daném rnd
 *   3. WEATHER_T — smysluplné násobiče (vedro dražší energie, bouře = víc výpadků)
 */
'use strict';

const w = require('../js/weather.js');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  \u2713 ' + msg); }
  else { fail++; console.log('  \u2717 ' + msg); }
}

const TYPES = new Set(Object.keys(w.WEATHER_T));

console.log('\u2550\u2550\u2550 Test 1: sezónní váhy \u2550\u2550\u2550');
{
  const summer = w.weatherWeights(6); // červenec
  const winter = w.weatherWeights(0); // leden
  ok(summer.heatwave > 0, 'v létě je možné vedro');
  ok(winter.heatwave === 0, 'v zimě vedro není');
  ok(winter.fog >= summer.fog, 'v zimě je víc mlhy než v létě');
  ok(summer.heatwave > winter.heatwave, 'vedro je pravděpodobnější v létě');
}

console.log('\u2550\u2550\u2550 Test 2: nextWeather \u2550\u2550\u2550');
{
  let allValid = true;
  for (let m = 0; m < 12; m++) for (let i = 0; i < 100; i++) {
    if (!TYPES.has(w.nextWeather(m, Math.random()))) allValid = false;
  }
  ok(allValid, 'vždy vrací platný typ počasí');
  ok(w.nextWeather(6, 0) === 'clear', 'rnd=0 → první klíč (clear)');
  // cyklení měsíce
  ok(w.nextWeather(0, 0.999) === w.nextWeather(12, 0.999), 'měsíc 0 ≡ 12');
}

console.log('\u2550\u2550\u2550 Test 3: násobiče \u2550\u2550\u2550');
{
  ok(w.WEATHER_T.heatwave.energyMult > 1, 'vedro = dražší energie');
  ok(w.WEATHER_T.clear.energyMult === 1, 'jasno = neutrální energie');
  ok(w.WEATHER_T.storm.outageMult > w.WEATHER_T.clear.outageMult, 'bouře = vyšší riziko výpadku');
  ok(w.WEATHER_T.rain.outageMult >= 1, 'déšť mírně zvyšuje riziko');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
