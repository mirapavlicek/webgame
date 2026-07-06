#!/usr/bin/env node
/**
 * theme.test.js — světlý design + kruhy pokrytí (js/theme.js)
 *
 * Co testuje:
 *   1. nextTheme — cyklí light ↔ dark
 *   2. parseBoolPref — '1'/'0'/null s výchozí hodnotou
 */
'use strict';

const t = require('../js/theme.js');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 1: nextTheme \u2550\u2550\u2550');
ok(t.nextTheme('dark') === 'light', 'dark → light');
ok(t.nextTheme('light') === 'dark', 'light → dark');
ok(t.nextTheme(undefined) === 'light', 'neznámé → light (výchozí přepnutí z dark)');

console.log('\u2550\u2550\u2550 Test 2: parseBoolPref \u2550\u2550\u2550');
ok(t.parseBoolPref('1', false) === true, "'1' → true");
ok(t.parseBoolPref('0', true) === false, "'0' → false");
ok(t.parseBoolPref(null, true) === true, 'null → default true');
ok(t.parseBoolPref(null, false) === false, 'null → default false');
ok(t.parseBoolPref('x', true) === true, 'neznámé → default');

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
