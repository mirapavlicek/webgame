#!/usr/bin/env node
/**
 * perf.test.js — FPS cap (shouldRenderFrame / perfMinInterval / setTargetFps)
 * z js/perf.js
 *
 * Co testuje:
 *   1. shouldRenderFrame — respektuje minimální interval
 *   2. perfMinInterval — odpovídá cílovému FPS
 *   3. setTargetFps — clamp do [15,120]
 */
'use strict';

const p = require('../js/perf.js');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }
function approx(a, b) { return Math.abs(a - b) < 1e-9; }

console.log('\u2550\u2550\u2550 Test 1: shouldRenderFrame \u2550\u2550\u2550');
ok(p.shouldRenderFrame(100, 0, 25) === true, '100ms od 0 při intervalu 25 → true');
ok(p.shouldRenderFrame(10, 0, 25) === false, '10ms < 25 → false');
ok(p.shouldRenderFrame(25, 0, 25) === true, 'přesně interval → true (>=)');
ok(p.shouldRenderFrame(1024, 1000, 25) === false, 'jen 24ms od posledního → false');

console.log('\u2550\u2550\u2550 Test 2: perfMinInterval vs setTargetFps \u2550\u2550\u2550');
{
  p.setTargetFps(40);
  ok(approx(p.perfMinInterval(), 25), '40 FPS → 25 ms');
  p.setTargetFps(30);
  ok(approx(p.perfMinInterval(), 1000 / 30), '30 FPS → 33.3 ms');
  p.setTargetFps(60);
  ok(approx(p.perfMinInterval(), 1000 / 60), '60 FPS → 16.7 ms');
}

console.log('\u2550\u2550\u2550 Test 3: setTargetFps clamp \u2550\u2550\u2550');
ok(p.setTargetFps(5) === 15, 'pod 15 → 15');
ok(p.setTargetFps(999) === 120, 'nad 120 → 120');
ok(p.setTargetFps(45) === 45, 'v rozsahu beze změny');
ok(p.getTargetFps() === 45, 'getTargetFps vrací poslední');

console.log('\u2550\u2550\u2550 Test 4: nižší FPS = delší interval = méně renderů \u2550\u2550\u2550');
{
  p.setTargetFps(30); const i30 = p.perfMinInterval();
  p.setTargetFps(60); const i60 = p.perfMinInterval();
  ok(i30 > i60, `30 FPS má delší interval než 60 FPS (${i30.toFixed(1)} > ${i60.toFixed(1)})`);
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
