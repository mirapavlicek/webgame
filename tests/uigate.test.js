#!/usr/bin/env node
/**
 * uigate.test.js — gating stavební palety (isToolAvailable z js/uigate.js)
 *
 * Co testuje:
 *   1. Přípojky/věže gated podle minTech vs. aktuální éra
 *   2. Prvky bez minTech (DC, kabely, WiFi, nástroje) vždy dostupné
 *   3. Neznámý/ prázdný nástroj → dostupný (nezakázaný)
 */
'use strict';

const g = require('../js/uigate.js');
const isAvail = g.isToolAvailable;

const defs = {
  CONN_T: {
    conn_isdn: { minTech: 0 },
    conn_vdsl: { minTech: 1 },
    conn_fiber1g: { minTech: 3 },
    conn_fiber100g: { minTech: 7 },
  },
  TOWER_T: {
    tower_lte: { minTech: 1 },
    tower_5g_sa: { minTech: 3 },
    tower_6g: { minTech: 8 },
  },
};

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 1: přípojky dle éry \u2550\u2550\u2550');
ok(isAvail('conn_isdn', 0, defs) === true, 'ISDN dostupné v tech 0');
ok(isAvail('conn_vdsl', 0, defs) === false, 'VDSL nedostupné v tech 0');
ok(isAvail('conn_vdsl', 1, defs) === true, 'VDSL dostupné v tech 1');
ok(isAvail('conn_fiber100g', 6, defs) === false, '100G nedostupné v tech 6');
ok(isAvail('conn_fiber100g', 7, defs) === true, '100G dostupné v tech 7');

console.log('\u2550\u2550\u2550 Test 2: věže dle éry \u2550\u2550\u2550');
ok(isAvail('tower_lte', 0, defs) === false, 'LTE nedostupné v tech 0');
ok(isAvail('tower_5g_sa', 3, defs) === true, '5G SA dostupné v tech 3');
ok(isAvail('tower_6g', 7, defs) === false, '6G nedostupné v tech 7');
ok(isAvail('tower_6g', 8, defs) === true, '6G dostupné v tech 8');

console.log('\u2550\u2550\u2550 Test 3: prvky bez minTech \u2550\u2550\u2550');
ok(isAvail('dc_small', 0, defs) === true, 'DC vždy dostupné');
ok(isAvail('cable_backbone', 0, defs) === true, 'kabely vždy dostupné');
ok(isAvail('wifi_small', 0, defs) === true, 'WiFi vždy dostupné');
ok(isAvail('demolish', 0, defs) === true, 'nástroj demolice vždy');
ok(isAvail('none', 0, defs) === true, 'kurzor vždy');

console.log('\u2550\u2550\u2550 Test 4: degenerované \u2550\u2550\u2550');
ok(isAvail('', 0, defs) === true, 'prázdný tool → dostupný');
ok(isAvail('neznamy', 5, defs) === true, 'neznámý tool → dostupný');
ok(isAvail('conn_isdn', 0, {}) === true, 'bez defs → dostupný (nezakázaný)');

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
