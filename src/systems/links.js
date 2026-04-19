// Physical links, Link Aggregation Groups (LAG), LACP, MLAG.
//
// Terminology:
//   - Port      : one switchport on a DC. Integer id, numbered per-DC from 0.
//   - Link      : a physical cable between exactly two ports (often on different DCs).
//   - LAG       : a logical aggregation of 1..N links that share one peer.
//                 Traffic is hashed across member links; if one fails, LAG continues
//                 at reduced capacity.
//   - LACP      : a LAG whose members negotiate membership via an active/passive
//                 state machine. Until peers sync, a link sits "detached".
//   - MLAG      : a LAG whose two ends span *two different* DCs, joined by a
//                 peer-link (ICCP / control channel). From the far side it looks
//                 like a single LAG peer.
//
// This is deliberately a simplified model — enough to teach the shapes of
// real-world datacenter networking without tracking individual packets.

import { emit, EV, on } from '../core/eventBus.js';

export const LINK_TYPES = {
  copper:  { name: 'Měděná 1G',      capacityMbps: 1_000,     costPerTile: 200,   latencyMs: 0.5 },
  fiber1g: { name: 'Optika 1G',      capacityMbps: 1_000,     costPerTile: 450,   latencyMs: 0.2 },
  fiber10: { name: 'Optika 10G',     capacityMbps: 10_000,    costPerTile: 1_200, latencyMs: 0.2 },
  fiber100:{ name: 'Páteřní 100G',   capacityMbps: 100_000,   costPerTile: 4_500, latencyMs: 0.1 },
  dwdm400: { name: 'DWDM 400G',      capacityMbps: 400_000,   costPerTile: 12_000, latencyMs: 0.1 },
};

export const LAG_MODES = {
  static:       { label: 'Static',        autoNegotiate: false },
  'lacp-active':{ label: 'LACP Active',   autoNegotiate: true, initiator: true },
  'lacp-passive':{ label: 'LACP Passive', autoNegotiate: true, initiator: false },
};

// -------- install into state --------

export function installLinks(state) {
  if (!state.network) state.network = emptyNetwork();
  on(EV.DAY, () => dailyLinkTick(state));
  on(EV.MONTH, () => monthlyLinkMaintenance(state));
}

export function emptyNetwork() {
  return {
    ports: {},          // dcId → [{ id, lagId, linkId, status }]
    links: [],          // [{id, aDcId, aPort, bDcId, bPort, type, status, utilMbps}]
    lags: [],           // [{id, ownerDcId, peerDcId, memberLinkIds[], mode, hashAlgo, lacpState, mlagId}]
    mlagDomains: [],    // [{id, peer1DcId, peer2DcId, peerLinkId}]
    nextPort: {},       // dcId → next port number
    nextLinkId: 1,
    nextLagId: 1,
  };
}

// -------- port allocation --------

export function portsPerDC(dc) {
  // capacity 50 → 8 ports, 200 → 24 ports, 800 → 48 ports
  if (dc.capacity <= 80)  return 8;
  if (dc.capacity <= 300) return 24;
  return 48;
}

export function ensurePorts(state, dc) {
  const net = state.network;
  if (net.ports[dc.id]) return;
  const n = portsPerDC(dc);
  net.ports[dc.id] = [];
  for (let i = 0; i < n; i++) {
    net.ports[dc.id].push({ id: i, lagId: null, linkId: null, status: 'down' });
  }
  net.nextPort[dc.id] = n;
}

export function freePort(state, dcId) {
  const ports = state.network.ports[dcId] || [];
  return ports.find(p => p.linkId == null);
}

// -------- link creation --------

export function createLink(state, aDcId, bDcId, typeId = 'fiber10') {
  const net = state.network;
  const aDc = state.dcs.find(d => d.id === aDcId);
  const bDc = state.dcs.find(d => d.id === bDcId);
  if (!aDc || !bDc) return { ok: false, err: 'DC neexistuje' };
  if (aDcId === bDcId) return { ok: false, err: 'Link musí spojovat dvě různá DC' };

  ensurePorts(state, aDc);
  ensurePorts(state, bDc);

  const aPort = freePort(state, aDcId);
  const bPort = freePort(state, bDcId);
  if (!aPort || !bPort) return { ok: false, err: 'Není volný port v některém DC' };

  const def = LINK_TYPES[typeId];
  const cost = Math.max(5_000, (def.costPerTile || 1_000) * estimateTileDistance(aDc, bDc));
  if (state.cash < cost) return { ok: false, err: `Nedostatek hotovosti (${cost.toLocaleString('cs-CZ')} Kč)` };

  const link = {
    id: `lnk_${net.nextLinkId++}`,
    aDcId, bDcId,
    aPort: aPort.id, bPort: bPort.id,
    typeId,
    capacityMbps: def.capacityMbps,
    utilMbps: 0,
    status: 'up',
    latencyMs: def.latencyMs,
    lagId: null,
  };

  aPort.linkId = link.id; aPort.status = 'up';
  bPort.linkId = link.id; bPort.status = 'up';
  net.links.push(link);
  state.cash -= cost;

  emit(EV.CABLE_PLACED, { state, link });
  emit(EV.CASH_CHANGED, state);
  emit(EV.NOTIFICATION, { level: 'good', icon: '🔌', text: `${def.name}: ${aDc.id} ↔ ${bDc.id}` });
  return { ok: true, link };
}

export function removeLink(state, linkId) {
  const net = state.network;
  const idx = net.links.findIndex(l => l.id === linkId);
  if (idx < 0) return false;
  const lnk = net.links[idx];

  const aPort = net.ports[lnk.aDcId]?.find(p => p.id === lnk.aPort);
  const bPort = net.ports[lnk.bDcId]?.find(p => p.id === lnk.bPort);
  if (aPort) { aPort.linkId = null; aPort.status = 'down'; aPort.lagId = null; }
  if (bPort) { bPort.linkId = null; bPort.status = 'down'; bPort.lagId = null; }

  // If in a LAG, also detach from the LAG
  if (lnk.lagId) detachFromLag(state, linkId);

  net.links.splice(idx, 1);
  return true;
}

function estimateTileDistance(aDc, bDc) {
  return Math.max(1, Math.hypot(aDc.x - bDc.x, aDc.y - bDc.y));
}

// -------- LAG creation / membership --------

export function createLag(state, ownerDcId, peerDcId, mode = 'lacp-active', hashAlgo = 'src-dst-ip') {
  const net = state.network;
  const lag = {
    id: `lag_${net.nextLagId++}`,
    ownerDcId, peerDcId,
    memberLinkIds: [],
    mode, hashAlgo,
    lacpState: mode === 'static' ? 'sync' : 'negotiating',
    mlagId: null,
    utilMbps: 0,
    capacityMbps: 0,
  };
  net.lags.push(lag);
  emit(EV.NOTIFICATION, { level: 'info', icon: '🧩', text: `LAG ${lag.id} vytvořen (${LAG_MODES[mode].label})` });
  return lag;
}

export function attachToLag(state, lagId, linkId) {
  const net = state.network;
  const lag = net.lags.find(l => l.id === lagId);
  const lnk = net.links.find(l => l.id === linkId);
  if (!lag || !lnk) return false;

  // Validate: link endpoints must be between lag's two DCs (either direction).
  const okDirs = (lnk.aDcId === lag.ownerDcId && lnk.bDcId === lag.peerDcId) ||
                 (lnk.aDcId === lag.peerDcId && lnk.bDcId === lag.ownerDcId);
  if (!okDirs) return false;
  if (lnk.lagId) return false; // already aggregated

  lnk.lagId = lagId;
  lag.memberLinkIds.push(linkId);
  recomputeLagCapacity(state, lag);

  // LACP: moving from negotiating → sync once both ends agree.
  if (lag.mode !== 'static') {
    // Simulated: with lacp-active on one side, sync after a short "delay"
    // (we cheat: instantly sync if any member links exist; in a real impl
    // this would be a timed state machine).
    lag.lacpState = 'sync';
  }
  return true;
}

export function detachFromLag(state, linkId) {
  const net = state.network;
  const lnk = net.links.find(l => l.id === linkId);
  if (!lnk || !lnk.lagId) return false;
  const lag = net.lags.find(l => l.id === lnk.lagId);
  lnk.lagId = null;
  if (lag) {
    lag.memberLinkIds = lag.memberLinkIds.filter(id => id !== linkId);
    recomputeLagCapacity(state, lag);
    if (lag.memberLinkIds.length === 0 && lag.mode !== 'static') lag.lacpState = 'detached';
  }
  return true;
}

function recomputeLagCapacity(state, lag) {
  const net = state.network;
  let cap = 0;
  for (const lid of lag.memberLinkIds) {
    const l = net.links.find(x => x.id === lid);
    if (l && l.status === 'up') cap += l.capacityMbps;
  }
  lag.capacityMbps = cap;
}

// -------- MLAG --------

export function createMlagDomain(state, peer1DcId, peer2DcId) {
  const net = state.network;
  // Both DCs must have a direct link (peer-link / ICCP channel)
  const peerLink = net.links.find(l =>
    (l.aDcId === peer1DcId && l.bDcId === peer2DcId) ||
    (l.aDcId === peer2DcId && l.bDcId === peer1DcId));
  if (!peerLink) return { ok: false, err: 'Mezi peer-DC není žádný link (potřeba ICCP)' };

  const domain = {
    id: `mlag_${net.mlagDomains.length + 1}`,
    peer1DcId, peer2DcId,
    peerLinkId: peerLink.id,
  };
  net.mlagDomains.push(domain);
  emit(EV.NOTIFICATION, { level: 'info', icon: '🔗', text: `MLAG doména ${domain.id} aktivní` });
  return { ok: true, domain };
}

export function bindLagToMlag(state, lagId, mlagId) {
  const lag = state.network.lags.find(l => l.id === lagId);
  if (!lag) return false;
  lag.mlagId = mlagId;
  return true;
}

// -------- failure simulation --------

function dailyLinkTick(state) {
  const net = state.network;
  // Tiny per-link cable fail chance, scaled inverse with how new it is
  for (const lnk of net.links) {
    if (lnk.status === 'down') {
      // chance to auto-repair if inside a working LAG (redundancy masks it)
      if (Math.random() < 0.02) {
        lnk.status = 'up';
        emit(EV.NOTIFICATION, { level: 'good', icon: '✅', text: `Link ${lnk.id} obnoven` });
        // LAG recompute
        if (lnk.lagId) {
          const lag = net.lags.find(l => l.id === lnk.lagId);
          if (lag) recomputeLagCapacity(state, lag);
        }
      }
      continue;
    }
    const utilRatio = lnk.utilMbps / Math.max(1, lnk.capacityMbps);
    const failChance = 0.0005 + utilRatio * 0.002;
    if (Math.random() < failChance) {
      lnk.status = 'down';
      emit(EV.NOTIFICATION, {
        level: 'warn', icon: '⚠️',
        text: `Link ${lnk.id} spadl (${(utilRatio * 100).toFixed(0)}% utilizace)`
      });
      if (lnk.lagId) {
        const lag = net.lags.find(l => l.id === lnk.lagId);
        if (lag) recomputeLagCapacity(state, lag);
      }
    }
  }
}

function monthlyLinkMaintenance(state) {
  const net = state.network;
  let cost = 0;
  for (const lnk of net.links) {
    const def = LINK_TYPES[lnk.typeId];
    cost += (def?.costPerTile || 500) * 0.05;
  }
  state.cash -= Math.round(cost);
  if (cost > 0) emit(EV.CASH_CHANGED, state);
}

// -------- accessors --------

export function getLagsForDc(state, dcId) {
  return state.network.lags.filter(l => l.ownerDcId === dcId || l.peerDcId === dcId);
}

export function getLinksForDc(state, dcId) {
  return state.network.links.filter(l => l.aDcId === dcId || l.bDcId === dcId);
}

export function getLinkCapacityReport(state, dcId) {
  const links = getLinksForDc(state, dcId);
  const total = links.filter(l => l.status === 'up').reduce((s, l) => s + l.capacityMbps, 0);
  const util  = links.reduce((s, l) => s + l.utilMbps, 0);
  return { totalMbps: total, utilMbps: util, ratio: total ? util / total : 0 };
}
