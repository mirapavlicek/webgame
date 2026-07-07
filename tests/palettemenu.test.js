#!/usr/bin/env node
/**
 * palettemenu.test.js — víceúrovňové menu stavební palety (js/palettemenu.js)
 *
 * Co testuje:
 *   1. palAssignSection — mapování sekcí (.build-cat texty) na skupiny
 *   2. Všechny sekce z index.html (tabBuild/tabTech) jsou zařazené
 *   3. palCountLabel — badge s počty
 */
'use strict';

const fs = require('fs');
const path = require('path');
const pm = require('../js/palettemenu.js');

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('═══ Test 1: palAssignSection ═══');
{
  const cfg = pm.PAL_GROUPS.tabBuild;
  ok(pm.palAssignSection('Datová centra (stavěj na trávu)', cfg) === 'dc', 'DC sekce → dc');
  ok(pm.palAssignSection('Kabely (po silnicích / z DC) · lze stackovat', cfg) === 'cables', 'kabely → cables');
  ok(pm.palAssignSection('🧭 Síťové uzly na odbočkách (místo stackování)', cfg) === 'cables', 'uzly → cables');
  ok(pm.palAssignSection('Přípojky (typ určuje max tarif)', cfg) === 'conns', 'přípojky → conns');
  ok(pm.palAssignSection('📶 5G Small Cell / Dense', cfg) === 'wireless', '5G small → wireless');
  ok(pm.palAssignSection('☀️ Obnovitelné zdroje (na zelené dlaždici, blokují zástavbu)', cfg) === 'energy', 'obnovitelné → energy');
  ok(pm.palAssignSection('Nástroje', cfg) === 'pinned', 'nástroje → pinned (zůstávají na rootu)');
  ok(pm.palAssignSection('Neznámá sekce', cfg) === null, 'neznámé → null (root)');
  const t = pm.PAL_GROUPS.tabTech;
  ok(pm.palAssignSection('Vybavení DC (vyber → klikni na DC)', t) === 'eq', 'vybavení → eq');
  ok(pm.palAssignSection('Síť & Routing', t) === 'net', 'routing → net');
  ok(pm.palAssignSection('Storage & Cloud', t) === 'stor', 'storage → stor');
  ok(pm.palAssignSection('Upgrade technologie', t) === 'pinned', 'upgrade → pinned');
}

console.log('═══ Test 2: pokrytí sekcí z index.html ═══');
{
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  // vytáhni obsah tabBuild a tabTech
  for (const tabId of ['tabBuild', 'tabTech']){
    const start = html.indexOf(`id="${tabId}"`);
    const end = html.indexOf('<div class="tab-content"', start + 10);
    const seg = html.slice(start, end > 0 ? end : undefined);
    const cats = [...seg.matchAll(/<div class="build-cat"[^>]*>([^<]+)<\/div>/g)].map(m => m[1]);
    ok(cats.length > 0, `${tabId}: nalezeno ${cats.length} sekcí`);
    const unassigned = cats.filter(c => pm.palAssignSection(c, pm.PAL_GROUPS[tabId]) === null);
    ok(unassigned.length === 0, `${tabId}: všechny sekce zařazené${unassigned.length ? ' — CHYBÍ: ' + unassigned.join(', ') : ''}`);
  }
}

console.log('═══ Test 3: palCountLabel ═══');
{
  ok(pm.palCountLabel(5, 5) === '5', 'vše dostupné → jen počet');
  ok(pm.palCountLabel(3, 8) === '3/8', 'část zamčená → 3/8');
  ok(pm.palCountLabel(0, 0) === '', 'prázdná skupina → nic');
}

console.log('═'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
