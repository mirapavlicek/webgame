#!/usr/bin/env node
/**
 * bgptiers.test.js — rychlostní verze BGP routerů (100G/400G/1T/2.4T)
 *
 * Co testuje:
 *   1. EQ obsahuje 4 tiery s rostoucí bgpCap; top ≥ 1 Tbps
 *   2. EQ_FAMILIES: požadavek 'eq_bgprouter' splní i vyšší tier (eqSatisfied)
 *   3. Sumace bgpCap přes vybavení DC (stejný vzorec jako createBGPPeering)
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
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/capacity.js'), 'utf8'), ctx);
const EQ = vm.runInContext('EQ', ctx);
const eqSatisfied = vm.runInContext('eqSatisfied', ctx);

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

console.log('\u2550\u2550\u2550 Test 1: tiery a kapacity \u2550\u2550\u2550');
{
  const tiers = ['eq_bgprouter', 'eq_bgprouter_400', 'eq_bgprouter_1t', 'eq_bgprouter_2t'];
  ok(tiers.every(t => EQ[t] && EQ[t].bgpCap > 0), 'všechny 4 tiery existují s bgpCap');
  ok(EQ.eq_bgprouter.bgpCap === 100000, '100G tier');
  ok(EQ.eq_bgprouter_400.bgpCap === 400000, '400G tier');
  ok(EQ.eq_bgprouter_1t.bgpCap === 1000000, '1T tier (požadavek: min 1 Tbps)');
  ok(EQ.eq_bgprouter_2t.bgpCap === 2400000, '2.4T tier');
  // rostoucí řada
  let inc = true;
  for (let i = 1; i < tiers.length; i++) if (EQ[tiers[i]].bgpCap <= EQ[tiers[i - 1]].bgpCap) inc = false;
  ok(inc, 'kapacity rostou s tierem');
  ok(tiers.length >= 3, 'alespoň 3 rychlostní verze (jsou 4)');
}

console.log('\u2550\u2550\u2550 Test 2: rodina eq_bgprouter \u2550\u2550\u2550');
{
  ok(eqSatisfied(['eq_bgprouter'], 'eq_bgprouter') === true, 'základní splní požadavek');
  ok(eqSatisfied(['eq_bgprouter_1t'], 'eq_bgprouter') === true, '1T tier splní požadavek eq_bgprouter (služby)');
  ok(eqSatisfied(['eq_bgprouter_2t'], 'eq_bgprouter') === true, '2.4T tier splní požadavek');
  ok(eqSatisfied(['eq_router'], 'eq_bgprouter') === false, 'obyčejný router nesplní');
  ok(eqSatisfied([], 'eq_bgprouter') === false, 'prázdné DC nesplní');
}

console.log('\u2550\u2550\u2550 Test 3: sumace bgpCap (vzorec z createBGPPeering) \u2550\u2550\u2550');
{
  const cap = (eqList) => eqList.filter(e => EQ[e] && EQ[e].bgpCap).reduce((s, e) => s + (EQ[e].bgpCap || 0), 0);
  ok(cap(['eq_bgprouter']) === 100000, '1× 100G = 100 Gbps');
  ok(cap(['eq_bgprouter_1t']) === 1000000, '1× 1T = 1 Tbps');
  ok(cap(['eq_bgprouter', 'eq_bgprouter_400']) === 500000, '100G + 400G se sčítají');
  ok(cap(['eq_bgprouter_2t', 'eq_bgprouter_2t']) === 4800000, '2× 2.4T = 4.8 Tbps (stack)');
  ok(cap(['eq_server', 'eq_firewall']) === 0, 'bez BGP routeru = 0');
}

console.log('\u2550'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
