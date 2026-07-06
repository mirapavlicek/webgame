#!/usr/bin/env node
/**
 * megaplant.test.js — velký závod (multi-tile B2B gigant)
 * (backboneFeedDirs / backboneRedundancyBonus z js/map.js + BTYPES data)
 *
 * Co testuje:
 *   1. backboneFeedDirs — směry páteřního napájení 2×2 půdorysu
 *   2. backboneRedundancyBonus — 2+ směry = +30 %
 *   3. BTYPES.megafactory — 2×2, reqBackbone, minConnBW 10G, minYear, náročný profil
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)) });
const ctx = vm.createContext(proxy);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/constants.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/map.js'), 'utf8'), ctx);
const feedDirs = vm.runInContext('backboneFeedDirs', ctx);
const bonus = vm.runInContext('backboneRedundancyBonus', ctx);
const BTYPES = vm.runInContext('BTYPES', ctx);

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

// mock: páteř na zadaných segmentech (klíč "x1,y1-x2,y2" v obou směrech)
function mockBackbone(segs){
  const set = new Set();
  for(const [a,b] of segs){ set.add(a.join(',')+'-'+b.join(',')); set.add(b.join(',')+'-'+a.join(',')); }
  return (x1,y1,x2,y2)=>set.has([x1,y1].join(',')+'-'+[x2,y2].join(','));
}

console.log('\u2550\u2550\u2550 Test 1: backboneFeedDirs (2×2 od (5,5)) \u2550\u2550\u2550');
{
  ok(feedDirs(5,5,2,2,()=>false).length===0, 'bez páteře → 0 směrů');
  // páteř ze severu do (6,5)
  const n=feedDirs(5,5,2,2,mockBackbone([[[6,5],[6,4]]]));
  ok(n.length===1&&n[0]==='N', 'sever přes (6,5)-(6,4) → [N]');
  // páteř z východu do (6,6)
  const v=feedDirs(5,5,2,2,mockBackbone([[[6,6],[7,6]]]));
  ok(v.length===1&&v[0]==='V', 'východ přes (6,6)-(7,6) → [V]');
  // dva směry (N + Z)
  const two=feedDirs(5,5,2,2,mockBackbone([[[5,5],[5,4]],[[5,6],[4,6]]]));
  ok(two.length===2&&two.includes('N')&&two.includes('Z'), 'N+Z → 2 směry');
  // vnitřní segment půdorysu se nepočítá
  const inner=feedDirs(5,5,2,2,mockBackbone([[[5,5],[6,5]]]));
  ok(inner.length===0, 'vnitřní segment (5,5)-(6,5) není napájení');
  // dva severní přívody = pořád 1 směr (N)
  const nn=feedDirs(5,5,2,2,mockBackbone([[[5,5],[5,4]],[[6,5],[6,4]]]));
  ok(nn.length===1&&nn[0]==='N', '2× přívod ze severu = 1 směr');
  // všechny 4 směry
  const all=feedDirs(5,5,2,2,mockBackbone([[[5,5],[5,4]],[[6,6],[6,7]],[[6,5],[7,5]],[[5,6],[4,6]]]));
  ok(all.length===4, 'ze všech stran → 4 směry');
}

console.log('\u2550\u2550\u2550 Test 2: redundanční bonus \u2550\u2550\u2550');
ok(bonus(0)===1.0, '0 směrů → bez bonusu');
ok(bonus(1)===1.0, '1 směr → bez bonusu');
ok(bonus(2)===1.3, '2 směry → +30 %');
ok(bonus(4)===1.3, '4 směry → +30 % (cap)');
ok(bonus(undefined)===1.0, 'undefined → 1.0');

console.log('\u2550\u2550\u2550 Test 3: BTYPES.megafactory \u2550\u2550\u2550');
{
  const m=BTYPES.megafactory;
  ok(!!m, 'typ existuje');
  ok(m.tilesW===2&&m.tilesH===2, 'zabírá 2×2 pole');
  ok(m.reqBackbone===true, 'vyžaduje páteř u půdorysu');
  ok(m.minConnBW===10000, 'přípojka ≥ 10 Gbps');
  ok(m.minYear>=2015, 'vzniká později (2015+)');
  ok(m.qualSens>=0.8&&m.priceSens<=0.2, 'náročný na kvalitu, necitlivý na cenu');
  ok(m.bwRatio>1, 'masivní spotřeba BW');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
