#!/usr/bin/env node
/**
 * sidebar.test.js — sbalitelné sekce (collapseKey z js/sidebar.js)
 *
 * Co testuje:
 *   1. Odstraní ikony/emoji/diakritiku-symboly, zůstane slug
 *   2. Stabilní klíč pro stejný nadpis; různé nadpisy → různé klíče
 *   3. Degenerované vstupy
 */
'use strict';

const s = require('../js/sidebar.js');
const key = s.collapseKey;

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 1: slug z nadpisu \u2550\u2550\u2550');
ok(key('💰 Finance') === 'finance', '„💰 Finance" → finance');
ok(key('📊 Síť & Město') === 'síť_město', '„Síť & Město" → síť_město (bez &)');
ok(key('📡 Kapacita sítě') === 'kapacita_sítě', 'kapacita sítě');
ok(key('🔬 Technologie') === 'technologie', 'technologie');

console.log('\u2550\u2550\u2550 Test 2: stabilita a unikátnost \u2550\u2550\u2550');
ok(key('💰 Finance') === key('Finance'), 'stejný text (s/bez ikony) → stejný klíč');
ok(key('Finance') !== key('Technologie'), 'různé nadpisy → různé klíče');

console.log('\u2550\u2550\u2550 Test 3: degenerované \u2550\u2550\u2550');
ok(key('') === 'sec', 'prázdný → fallback sec');
ok(key('🎯🎯🎯') === 'sec', 'jen emoji → fallback sec');
ok(typeof key(null) === 'string', 'null → string (nespadne)');
ok(key('   Ahoj   Světe  ') === 'ahoj_světe', 'ořez a jednotné podtržítko');

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
