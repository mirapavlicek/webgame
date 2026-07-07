#!/usr/bin/env node
/**
 * aicloud.test.js — AI cloud služby + GPU/ASIC servery
 *
 * Co testuje:
 *   1. Konstanty — eq_gpunode/eq_asicnode existují a poskytují akcelerátory,
 *      CLOUD_PRICING má AI produkty (cat:'ai'), segmenty mají poptávku po AI
 *   2. getDCAccel — správně počítá celkovou a využitou GPU/ASIC kapacitu
 *   3. provisionCloud — AI instance vyžadují GPU/ASIC hardware a kapacitu
 *   4. calcCloudRevenue — AI příjmy jen když hráč má GPU/ASIC v nějakém DC
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)) });
const ctx = vm.createContext(proxy);
for (const f of ['js/constants.js', 'js/capacity.js', 'js/actions.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx);
}

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }

const { EQ, CLOUD_PRICING, CLOUD_SEGMENTS } = vm.runInContext('({EQ,CLOUD_PRICING,CLOUD_SEGMENTS})', ctx);

console.log('═══ Test 1: konstanty ═══');
ok(EQ.eq_gpunode && EQ.eq_gpunode.gpu === 8, 'eq_gpunode poskytuje 8 GPU');
ok(EQ.eq_asicnode && EQ.eq_asicnode.asic === 16, 'eq_asicnode poskytuje 16 ASIC');
ok(CLOUD_PRICING.ai_inference && CLOUD_PRICING.ai_inference.cat === 'ai' && CLOUD_PRICING.ai_inference.gpu === 1, 'ai_inference: cat ai, 1 GPU');
ok(CLOUD_PRICING.ai_training && CLOUD_PRICING.ai_training.gpu === 4 && CLOUD_PRICING.ai_training.reqEq.includes('eq_gpunode'), 'ai_training: 4 GPU, vyžaduje eq_gpunode');
ok(CLOUD_PRICING.ai_asic_inference && CLOUD_PRICING.ai_asic_inference.asic === 2 && CLOUD_PRICING.ai_asic_inference.reqEq.includes('eq_asicnode'), 'ai_asic_inference: 2 ASIC, vyžaduje eq_asicnode');
ok(CLOUD_SEGMENTS.every(s => typeof s.demand.ai === 'number' && s.demand.ai > 0), 'všechny segmenty mají poptávku po AI');
{
  const media = CLOUD_SEGMENTS.find(s => s.id === 'seg_media');
  ok(media && CLOUD_SEGMENTS.every(s => s.demand.ai <= media.demand.ai), 'Média & AI má nejvyšší AI poptávku');
}

console.log('═══ Test 2: getDCAccel ═══');
{
  sandbox.G = {
    dcs: [{ eq: ['eq_gpunode', 'eq_asicnode', 'eq_storage'] }],
    cloudInstances: [
      { type: 'ai_training', dcIdx: 0, count: 1 },
      { type: 'ai_asic_inference', dcIdx: 0, count: 2 },
    ],
  };
  const a = sandbox.getDCAccel(0);
  ok(a.gpu === 8 && a.asic === 16, `kapacita 8 GPU / 16 ASIC (${a.gpu}/${a.asic})`);
  ok(a.usedGPU === 4, `1× training spotřebuje 4 GPU (${a.usedGPU})`);
  ok(a.usedASIC === 4, `2× asic inference spotřebují 4 ASIC (${a.usedASIC})`);
  const none = sandbox.getDCAccel(99);
  ok(none.gpu === 0 && none.asic === 0, 'neexistující DC → 0');
}

console.log('═══ Test 3: provisionCloud vyžaduje GPU hardware a kapacitu ═══');
{
  const msgs = [];
  sandbox.notify = (m) => msgs.push(m);
  sandbox.updUI = () => {};
  // DC bez GPU serveru → AI služba nejde nasadit
  sandbox.G = { dcs: [{ eq: ['eq_cloudnode_big', 'eq_storage'] }], cloudInstances: [] };
  sandbox.provisionCloud(0, 'ai_inference');
  ok(sandbox.G.cloudInstances.length === 0, 'bez eq_gpunode se AI instance nenasadí');
  // DC s GPU serverem → jde nasadit až do vyčerpání GPU (8× ai_inference po 1 GPU)
  sandbox.G = { dcs: [{ eq: ['eq_gpunode', 'eq_storage'] }], cloudInstances: [] };
  for (let i = 0; i < 9; i++) sandbox.provisionCloud(0, 'ai_inference');
  const ci = sandbox.G.cloudInstances.find(c => c.type === 'ai_inference');
  ok(ci && ci.count === 8, `8/9 pokusů uspěje — GPU kapacita 8 (${ci ? ci.count : 0})`);
  ok(msgs.some(m => m.includes('GPU')), 'devátý pokus hlásí nedostatek GPU');
}

console.log('═══ Test 4: AI příjmy jen s GPU/ASIC hardwarem ═══');
{
  const baseG = () => ({
    dcs: [{ eq: ['eq_cloudnode', 'eq_storage'] }],
    cloudInstances: [{ type: 'vps_small', dcIdx: 0, count: 1 }],
    cloudCustomers: { seg_media: { count: 100, satisfaction: 70 } },
    cloudPriceMult: 1, cloudSLA: 'sla_basic', cloudReputation: 60,
    tariffInflation: 1, componentInflation: 1,
  });
  sandbox.G = baseG();
  const dynF1 = sandbox.dynamicVpsFactor(sandbox.cloudCPUUtil());
  const revNoAccel = sandbox.calcCloudRevenue();
  sandbox.G = baseG();
  sandbox.G.dcs[0].eq.push('eq_gpunode');
  const dynF2 = sandbox.dynamicVpsFactor(sandbox.cloudCPUUtil());
  const revWithAccel = sandbox.calcCloudRevenue();
  ok(revNoAccel > 0, `příjem bez akcelerátorů > 0 (${revNoAccel})`);
  ok(revWithAccel > revNoAccel, `GPU hardware odemkne AI příjmy (${revWithAccel} > ${revNoAccel})`);
  // rozdíl = AI produkty × demand.ai + posun účtování dynamických služeb
  // (GPU server přidal vCPU → nižší vytížení → dynamické VPS účtují míň)
  const media = CLOUD_SEGMENTS.find(s => s.id === 'seg_media');
  let aiPerCust = 0, dynBasePerCust = 0;
  for (const k in CLOUD_PRICING) {
    const cp = CLOUD_PRICING[k];
    if (cp.cat === 'ai') aiPerCust += cp.price * media.demand.ai;
    if (cp.dynamic) dynBasePerCust += cp.price * (media.demand[cp.cat || 'vps'] || 0);
  }
  const expected = Math.round(100 * (aiPerCust + (dynF2 - dynF1) * dynBasePerCust));
  ok(Math.abs((revWithAccel - revNoAccel) - expected) <= 2, `rozdíl ≈ AI demand × ceny + Δ dynamiky (${revWithAccel - revNoAccel} vs. ${expected})`);
}

console.log('═'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
