#!/usr/bin/env node
/**
 * editor.test.js — ověření čistých funkcí sandbox editoru (js/editor.js)
 *
 * Co testuje:
 *   1. editorSetTile — nastaví terén, mimo mapu ne, ne-tráva smaže budovu
 *   2. editorMakeBuilding — střední hodnoty, neznámý typ → null
 *   3. editorPlaceBuilding — jen na prázdnou trávu
 *   4. editorBulldoze — srovná na trávu, smaže budovu
 */
'use strict';

const ed = require('../js/editor.js');

const BTYPES = {
  house: { name: 'Dům', icon: '🏠', units: [1, 4], pop: [2, 5], demand: 0.6 },
  panel: { name: 'Panelák', icon: '🏢', units: [20, 80], pop: [40, 200], demand: 0.85 },
};

function mkMap(n){
  const m = [];
  for(let y = 0; y < n; y++){ const row = []; for(let x = 0; x < n; x++) row.push({ type: 'grass', bld: null, variant: 0 }); m.push(row); }
  return m;
}

let pass = 0, fail = 0;
function ok(c, m){ if(c){ pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 1: editorSetTile \u2550\u2550\u2550');
{
  const m = mkMap(4);
  ok(ed.editorSetTile(m, 1, 1, 'road', 4) === true, 'nastaví silnici');
  ok(m[1][1].type === 'road', 'dlaždice je road');
  ok(ed.editorSetTile(m, 9, 9, 'road', 4) === false, 'mimo mapu → false');
  ok(ed.editorSetTile(m, 1, 1, 'lava', 4) === false, 'neznámý typ → false');
  // ne-tráva smaže budovu
  m[2][2].bld = { type: 'house' };
  ed.editorSetTile(m, 2, 2, 'water', 4);
  ok(m[2][2].bld === null, 'voda smaže budovu na dlaždici');
}

console.log('\u2550\u2550\u2550 Test 2: editorMakeBuilding \u2550\u2550\u2550');
{
  const b = ed.editorMakeBuilding('house', BTYPES);
  ok(b && b.type === 'house', 'vytvoří dům');
  ok(b.units === Math.round((1 + 4) / 2), 'units = střed rozsahu (3)');
  ok(b.pop === Math.round((2 + 5) / 2), 'pop = střed rozsahu (4)');
  ok(b.maxPop === Math.round(b.pop * 1.5), 'maxPop = pop×1.5');
  ok(b.connected === false && b.want === true, 'nový dům nepřipojen, chce internet');
  ok(ed.editorMakeBuilding('nope', BTYPES) === null, 'neznámý typ → null');
}

console.log('\u2550\u2550\u2550 Test 3: editorPlaceBuilding \u2550\u2550\u2550');
{
  const m = mkMap(4);
  ok(ed.editorPlaceBuilding(m, 0, 0, 'panel', 4, BTYPES) === true, 'položí na prázdnou trávu');
  ok(m[0][0].bld && m[0][0].bld.type === 'panel', 'budova je na místě');
  ok(ed.editorPlaceBuilding(m, 0, 0, 'house', 4, BTYPES) === false, 'nelze na obsazenou dlaždici');
  m[1][1].type = 'road';
  ok(ed.editorPlaceBuilding(m, 1, 1, 'house', 4, BTYPES) === false, 'nelze na silnici');
  ok(ed.editorPlaceBuilding(m, 2, 2, 'nope', 4, BTYPES) === false, 'neznámý typ → false');
}

console.log('\u2550\u2550\u2550 Test 4: editorBulldoze \u2550\u2550\u2550');
{
  const m = mkMap(4);
  m[0][0].type = 'water';
  m[1][1].bld = { type: 'house' };
  ok(ed.editorBulldoze(m, 0, 0, 4) === true, 'srovná vodu → změna');
  ok(m[0][0].type === 'grass', 'z vody je tráva');
  ok(ed.editorBulldoze(m, 1, 1, 4) === true, 'smaže budovu → změna');
  ok(m[1][1].bld === null, 'budova pryč');
  ok(ed.editorBulldoze(m, 2, 2, 4) === false, 'prázdná tráva → beze změny');
  ok(ed.editorBulldoze(m, 9, 9, 4) === false, 'mimo mapu → false');
}

console.log('\u2550'.repeat(60));
if(fail === 0){ console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
