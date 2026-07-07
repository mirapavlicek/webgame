#!/usr/bin/env node
/**
 * storagecloud.test.js — PB storage tiery, nové servery a dynamické VPS
 *
 * Co testuje:
 *   1. Konstanty — storage do 4 PB, server rack/blade, cloud superpod,
 *      nové služby (S3 100TB/1PB, cold archive, BaaS, dynamické VPS)
 *   2. dynamicVpsFactor — 0.85..1.45 podle vytížení, ořez mimo meze
 *   3. calcCloudRevenue — dynamické služby účtují víc při vyšším vytížení
 *   4. fmtTB — formát TB/PB
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sandbox = {};
const proxy = new Proxy(sandbox, { has: () => true, get: (t, k) => (k in t ? t[k] : (k in globalThis ? globalThis[k] : undefined)) });
const ctx = vm.createContext(proxy);
for (const f of ['js/constants.js', 'js/capacity.js', 'js/actions.js', 'js/ui.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx);
}
const { EQ, CLOUD_PRICING } = vm.runInContext('({EQ,CLOUD_PRICING})', ctx);

let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  \u2713 ' + m); } else { fail++; console.log('  \u2717 ' + m); } }
function approx(a, b, e) { return Math.abs(a - b) <= (e || 1e-9); }

console.log('═══ Test 1: konstanty ═══');
ok(EQ.eq_storage_rack && EQ.eq_storage_rack.storageTB === 200, 'storage rack 200 TB');
ok(EQ.eq_storage_pod && EQ.eq_storage_pod.storageTB === 1000, 'storage pod 1 PB');
ok(EQ.eq_storage_lake && EQ.eq_storage_lake.storageTB === 4000, 'datové jezero 4 PB');
ok(EQ.eq_server_rack && EQ.eq_server_rack.vCPU === 16 && EQ.eq_server_rack.eff === 'quality', 'server rack: kvalita + compute');
ok(EQ.eq_server_blade && EQ.eq_server_blade.vCPU === 48, 'blade šasi 48 vCPU');
ok(EQ.eq_cloudnode_ultra && EQ.eq_cloudnode_ultra.vCPU === 512 && EQ.eq_cloudnode_ultra.ramGB === 2048, 'cloud superpod 512/2048');
ok(CLOUD_PRICING.s3_100t && CLOUD_PRICING.s3_100t.reqEq.includes('eq_storage_rack'), 'S3 100TB vyžaduje storage rack');
ok(CLOUD_PRICING.s3_1pb && CLOUD_PRICING.s3_1pb.storageTB === 1000 && CLOUD_PRICING.s3_1pb.reqEq.includes('eq_storage_pod'), 'S3 1PB vyžaduje pod');
ok(CLOUD_PRICING.cold_1pb && CLOUD_PRICING.cold_1pb.price < CLOUD_PRICING.s3_1pb.price, 'cold archive levnější než hot 1PB');
ok(CLOUD_PRICING.baas_50t && CLOUD_PRICING.baas_50t.reqEq.includes('eq_backup'), 'BaaS vyžaduje backup');
ok(CLOUD_PRICING.storage_scale && CLOUD_PRICING.storage_scale.storageTB === 100, 'block NVMe 100TB');
ok(CLOUD_PRICING.vps_dynamic && CLOUD_PRICING.vps_dynamic.dynamic === true, 'dynamické VPS má flag dynamic');
ok(CLOUD_PRICING.vps_dynamic_pro && CLOUD_PRICING.vps_dynamic_pro.reqEq.includes('eq_cloudnode_ultra'), 'dyn. VPS Pro vyžaduje superpod');

console.log('═══ Test 2: dynamicVpsFactor ═══');
{
  const f = sandbox.dynamicVpsFactor;
  ok(approx(f(0), 0.85), 'prázdný cloud → 0.85');
  ok(approx(f(1), 1.45), 'plný cloud → 1.45');
  ok(approx(f(0.5), 1.15), 'poloviční → 1.15');
  ok(approx(f(-2), 0.85) && approx(f(5), 1.45), 'ořez mimo meze');
  ok(approx(f(null), 0.85), 'null → 0.85');
}

console.log('═══ Test 3: dynamické služby účtují podle vytížení ═══');
{
  const mkG = (extraInstances) => ({
    dcs: [{ eq: ['eq_cloudnode', 'eq_storage'] }],
    cloudInstances: [{ type: 'vps_dynamic', dcIdx: 0, count: 1 }].concat(extraInstances || []),
    cloudCustomers: { seg_startup: { count: 100 } },
    cloudPriceMult: 1, cloudSLA: 'sla_basic', cloudReputation: 60,
    tariffInflation: 1, componentInflation: 1,
  });
  sandbox.G = mkG();
  const utilLow = sandbox.cloudCPUUtil();
  const revLow = sandbox.calcCloudRevenue();
  // přidej instance, ať vytížení vzroste (vps_xlarge 8 vCPU ×3 = 24 + 2 dyn = 26/32)
  sandbox.G = mkG([{ type: 'vps_xlarge', dcIdx: 0, count: 3 }]);
  const utilHigh = sandbox.cloudCPUUtil();
  const revHigh = sandbox.calcCloudRevenue();
  ok(utilHigh > utilLow, `vytížení vzrostlo (${(utilLow * 100).toFixed(0)} % → ${(utilHigh * 100).toFixed(0)} %)`);
  ok(revHigh > revLow, `dynamické služby zvedly příjem (${revLow} → ${revHigh})`);
}

console.log('═══ Test 4: fmtTB ═══');
{
  const f = sandbox.fmtTB;
  ok(f(10) === '10 TB', '10 → 10 TB');
  ok(f(0.5) === '0.5 TB', '0.5 → 0.5 TB');
  ok(f(1000) === '1.0 PB', '1000 → 1.0 PB');
  ok(f(4000) === '4.0 PB', '4000 → 4.0 PB');
  ok(f(12000) === '12 PB', '12000 → 12 PB');
}

console.log('═'.repeat(60));
if (fail === 0) { console.log(`\u2705 V\u0160ECHNY TESTY PRO\u0160LY: ${pass}/${pass}`); process.exit(0); }
else { console.log(`\u274c SELHALO: ${fail}, pro\u0161lo: ${pass}`); process.exit(1); }
