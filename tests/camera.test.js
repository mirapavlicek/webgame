#!/usr/bin/env node
/**
 * camera.test.js — ověření čisté matematiky plynulé kamery (js/camera.js)
 *
 * Spouští se: `node tests/camera.test.js` (z rootu repa)
 *
 * Co testuje:
 *   1. camKeyDir — mapování šipek na směr (vč. opačných kláves co se ruší)
 *   2. camApplyKeys — posun cíle úměrný dt, normalizace diagonály
 *   3. camEaseStep — dojezd se blíží k cíli a nakonec na něj přichytí
 *   4. camApplyInertia — útlum a vynulování pod prahem
 */
'use strict';

const cam = require('../js/camera.js');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  \u2713 ' + msg); }
  else { fail++; console.log('  \u2717 ' + msg); }
}
function approx(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-6); }

console.log('\u2550\u2550\u2550 Test 1: camKeyDir \u2550\u2550\u2550');
ok(JSON.stringify(cam.camKeyDir(new Set(['arrowleft']))) === JSON.stringify({ dx: 1, dy: 0 }), 'arrowleft -> dx=+1');
ok(JSON.stringify(cam.camKeyDir(new Set(['arrowright']))) === JSON.stringify({ dx: -1, dy: 0 }), 'arrowright -> dx=-1');
ok(JSON.stringify(cam.camKeyDir(new Set(['arrowup']))) === JSON.stringify({ dx: 0, dy: 1 }), 'arrowup -> dy=+1');
ok(JSON.stringify(cam.camKeyDir(new Set(['arrowdown']))) === JSON.stringify({ dx: 0, dy: -1 }), 'arrowdown -> dy=-1');
{
  const d = cam.camKeyDir(new Set(['arrowleft', 'arrowright']));
  ok(d.dx === 0 && d.dy === 0, 'opačné klávesy se ruší');
}
{
  const d = cam.camKeyDir(new Set(['arrowup', 'arrowleft']));
  ok(d.dx === 1 && d.dy === 1, 'diagonála vrací oba směry');
}
{
  const d = cam.camKeyDir(new Set(['w', 'a', 's', 'd']));
  ok(d.dx === 0 && d.dy === 0, 'WASD se ignoruje (obsazené stavebními zkratkami)');
}

console.log('\u2550\u2550\u2550 Test 2: camApplyKeys \u2550\u2550\u2550');
{
  const t = { x: 0, y: 0, zoom: 1 };
  cam.camApplyKeys(t, new Set(['arrowleft']), 1000); // 1s
  ok(approx(t.x, cam.CAM_PAN_SPEED), `1s vlevo posune o CAM_PAN_SPEED (${t.x})`);
  ok(t.y === 0, 'svislá osa beze změny');
}
{
  const t = { x: 0, y: 0, zoom: 1 };
  cam.camApplyKeys(t, new Set([]), 1000);
  ok(t.x === 0 && t.y === 0, 'bez kláves žádný posun');
}
{
  const t = { x: 0, y: 0, zoom: 1 };
  cam.camApplyKeys(t, new Set(['arrowup', 'arrowleft']), 1000);
  // diagonála je normalizovaná: délka posunu == CAM_PAN_SPEED
  const len = Math.hypot(t.x, t.y);
  ok(approx(len, cam.CAM_PAN_SPEED, 1e-4), `diagonála normalizovaná na CAM_PAN_SPEED (len=${len.toFixed(2)})`);
}

console.log('\u2550\u2550\u2550 Test 3: camEaseStep \u2550\u2550\u2550');
{
  const c = { x: 0, y: 0, zoom: 1 };
  const target = { x: 100, y: -50, zoom: 2 };
  cam.camEaseStep(c, target, 16);
  ok(c.x > 0 && c.x < 100, `x se posunul k cíli (${c.x.toFixed(2)})`);
  ok(c.y < 0 && c.y > -50, `y se posunul k cíli (${c.y.toFixed(2)})`);
  ok(c.zoom > 1 && c.zoom < 2, `zoom se posunul k cíli (${c.zoom.toFixed(3)})`);
  // po mnoha krocích konverguje a přichytí
  for (let i = 0; i < 200; i++) cam.camEaseStep(c, target, 16);
  ok(c.x === 100 && c.y === -50 && c.zoom === 2, 'po mnoha krocích přichytí přesně na cíl');
}

console.log('\u2550\u2550\u2550 Test 4: camApplyInertia \u2550\u2550\u2550');
{
  const t = { x: 0, y: 0, zoom: 1 };
  const inertia = { x: 1000, y: 0 };
  cam.camApplyInertia(t, inertia, 16);
  ok(t.x > 0, `setrvačnost posune cíl (${t.x.toFixed(2)})`);
  ok(inertia.x < 1000, `rychlost se utlumila (${inertia.x.toFixed(2)})`);
  // doběhne do klidu
  for (let i = 0; i < 2000; i++) cam.camApplyInertia(t, inertia, 16);
  ok(inertia.x === 0 && inertia.y === 0, 'setrvačnost se vynuluje pod prahem');
}
{
  const t = { x: 5, y: 5, zoom: 1 };
  const inertia = { x: 0.5, y: -0.5 };
  cam.camApplyInertia(t, inertia, 16);
  ok(t.x === 5 && t.y === 5, 'pod prahem se cíl nehne');
  ok(inertia.x === 0 && inertia.y === 0, 'pod prahem se rychlost rovnou vynuluje');
}

console.log('\u2550\u2550\u2550 Test 5: nextDCIndex \u2550\u2550\u2550');
ok(cam.nextDCIndex(null, 3) === 0, 'z null -> 0');
ok(cam.nextDCIndex(-1, 3) === 0, 'z -1 -> 0');
ok(cam.nextDCIndex(0, 3) === 1, '0 -> 1');
ok(cam.nextDCIndex(2, 3) === 0, '2 -> 0 (wrap)');
ok(cam.nextDCIndex(0, 3, -1) === 2, '0 zpět -> 2 (wrap)');
ok(cam.nextDCIndex(null, 3, -1) === 2, 'null zpět -> poslední');
ok(cam.nextDCIndex(0, 0) === -1, 'prázdný seznam -> -1');

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
