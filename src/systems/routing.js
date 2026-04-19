// Multi-path routing across DCs.
//
// Treats each DC as a graph node; a pair of DCs is connected by one edge per
// LAG (capacity = sum of member links' capacity) OR a single link if no LAG
// exists. We compute up to 3 shortest paths by latency cost, then distribute
// traffic across them using ECMP-style weights biased by residual capacity.
//
// When one path is >80% utilized, excess traffic spills to alternate paths;
// if all paths are saturated, the DC shows congestion and customers take a
// satisfaction hit.

import { on, EV } from '../core/eventBus.js';
import { getLinksForDc } from './links.js';

export function installRouting(state) {
  state.routing = state.routing || { tables: {}, lastComputed: 0 };
  on(EV.DAY, () => {
    recomputeRoutes(state);
    distributeTraffic(state);
  });
  on(EV.CABLE_PLACED, () => recomputeRoutes(state));
}

// Build adjacency: for each pair of DCs, list edges (a LAG or a free link).
// Edge = { fromDc, toDc, capMbps, costMs, lagId?, linkId? }
function buildAdjacency(state) {
  const adj = {};
  for (const dc of state.dcs) adj[dc.id] = [];

  // From LAGs first
  for (const lag of state.network.lags) {
    if (lag.lacpState !== 'sync' || lag.capacityMbps === 0) continue;
    // avg latency = min member latency (fastest port wins effectively)
    let minLat = Infinity;
    for (const lid of lag.memberLinkIds) {
      const l = state.network.links.find(x => x.id === lid);
      if (l && l.status === 'up' && l.latencyMs < minLat) minLat = l.latencyMs;
    }
    const edge = {
      fromDc: lag.ownerDcId, toDc: lag.peerDcId,
      capMbps: lag.capacityMbps, costMs: Math.max(0.1, minLat || 0.2),
      lagId: lag.id,
    };
    adj[lag.ownerDcId].push(edge);
    adj[lag.peerDcId].push({ ...edge, fromDc: lag.peerDcId, toDc: lag.ownerDcId });
  }

  // Free links (not part of any LAG) contribute their own edge
  const lagLinks = new Set();
  for (const lag of state.network.lags) for (const id of lag.memberLinkIds) lagLinks.add(id);

  for (const lnk of state.network.links) {
    if (lagLinks.has(lnk.id)) continue;
    if (lnk.status !== 'up') continue;
    const edge = {
      fromDc: lnk.aDcId, toDc: lnk.bDcId,
      capMbps: lnk.capacityMbps, costMs: lnk.latencyMs,
      linkId: lnk.id,
    };
    adj[lnk.aDcId].push(edge);
    adj[lnk.bDcId].push({ ...edge, fromDc: lnk.bDcId, toDc: lnk.aDcId });
  }

  return adj;
}

// k-shortest paths (up to 3) between src & dst using Yen-lite:
// first shortest by Dijkstra, then 2 more with each of the first-hop edges
// excluded.
function kShortest(adj, srcId, dstId, k = 3) {
  const paths = [];
  const first = dijkstra(adj, srcId, dstId, new Set());
  if (!first) return paths;
  paths.push(first);

  // Exclude each edge of the first path in turn, recompute
  for (let i = 0; i < first.edges.length && paths.length < k; i++) {
    const blocked = new Set([`${first.edges[i].fromDc}->${first.edges[i].toDc}`,
                             `${first.edges[i].toDc}->${first.edges[i].fromDc}`]);
    const alt = dijkstra(adj, srcId, dstId, blocked);
    if (alt && !paths.some(p => samePath(p, alt))) paths.push(alt);
  }
  return paths;
}

function dijkstra(adj, srcId, dstId, blockedEdges) {
  const dist = {};
  const prev = {};       // nodeId → { viaNode, edge }
  for (const id of Object.keys(adj)) dist[id] = Infinity;
  dist[srcId] = 0;

  const queue = [{ id: srcId, d: 0 }];
  while (queue.length) {
    queue.sort((a, b) => a.d - b.d);
    const { id, d } = queue.shift();
    if (d > dist[id]) continue;
    if (id === dstId) break;
    for (const edge of adj[id]) {
      const key = `${edge.fromDc}->${edge.toDc}`;
      if (blockedEdges.has(key)) continue;
      // Penalize near-full edges to encourage spread
      const capPenalty = 1 + (edge.utilMbps || 0) / Math.max(1, edge.capMbps);
      const nd = d + edge.costMs * capPenalty;
      if (nd < dist[edge.toDc]) {
        dist[edge.toDc] = nd;
        prev[edge.toDc] = { viaNode: id, edge };
        queue.push({ id: edge.toDc, d: nd });
      }
    }
  }

  if (dist[dstId] === Infinity) return null;

  // Reconstruct path
  const nodes = [dstId];
  const edges = [];
  let cur = dstId;
  while (prev[cur]) {
    edges.unshift(prev[cur].edge);
    cur = prev[cur].viaNode;
    nodes.unshift(cur);
  }
  // Bottleneck capacity = min cap of any edge
  const minCap = edges.reduce((m, e) => Math.min(m, e.capMbps), Infinity);

  return { nodes, edges, costMs: dist[dstId], capMbps: minCap };
}

function samePath(a, b) {
  if (a.nodes.length !== b.nodes.length) return false;
  for (let i = 0; i < a.nodes.length; i++) if (a.nodes[i] !== b.nodes[i]) return false;
  return true;
}

function recomputeRoutes(state) {
  const adj = buildAdjacency(state);
  const tables = {};
  for (const src of state.dcs) {
    tables[src.id] = {};
    for (const dst of state.dcs) {
      if (src.id === dst.id) continue;
      tables[src.id][dst.id] = kShortest(adj, src.id, dst.id, 3);
    }
  }
  state.routing.tables = tables;
  state.routing.lastComputed = Date.now();
}

// Rough traffic model: each connected building demands X Mbps that must reach
// *its closest DC*; DCs then exchange traffic proportional to their customers
// over the routing table, distributed across paths weighted by residual cap.
function distributeTraffic(state) {
  const net = state.network;
  // Zero out per-link & per-LAG util
  for (const l of net.links) l.utilMbps = 0;
  for (const lag of net.lags) lag.utilMbps = 0;

  if (state.dcs.length < 2) return;

  // Trivial demand: every DC sends D = (customers * 5 Mbps) to every other DC
  // proportional to that DC's customer share.
  const custByDc = {};
  let totalCust = 0;
  for (const b of state.buildings || []) {
    // (buildings array is kept in sync separately; for v2 we iterate world)
  }
  // Walk world once to count customers per closest DC
  for (let y = 0; y < state.world.size; y++) for (let x = 0; x < state.world.size; x++) {
    const bld = state.world.tiles[state.world.idx(x, y)].bld;
    if (!bld || !bld.connected || bld.customers <= 0) continue;
    // closest DC
    let best = null, bd = Infinity;
    for (const dc of state.dcs) {
      const d = Math.abs(dc.x - x) + Math.abs(dc.y - y);
      if (d < bd) { bd = d; best = dc; }
    }
    if (best) custByDc[best.id] = (custByDc[best.id] || 0) + bld.customers;
    totalCust += bld.customers;
  }

  if (totalCust === 0) return;

  // Pair-wise demand
  for (const src of state.dcs) {
    const srcCust = custByDc[src.id] || 0;
    if (srcCust === 0) continue;
    for (const dst of state.dcs) {
      if (src.id === dst.id) continue;
      const dstCust = custByDc[dst.id] || 0;
      const demandMbps = Math.min(srcCust, dstCust) * 2 * 5; // symmetric-ish
      if (demandMbps <= 0) continue;

      const paths = state.routing.tables?.[src.id]?.[dst.id];
      if (!paths || paths.length === 0) continue;

      // Weight paths by residual capacity
      const weights = paths.map(p => Math.max(1, p.capMbps - maxEdgeUtil(p)));
      const wsum = weights.reduce((s, w) => s + w, 0);

      for (let i = 0; i < paths.length; i++) {
        const share = demandMbps * weights[i] / wsum;
        for (const edge of paths[i].edges) applyEdgeUtil(state, edge, share);
      }
    }
  }
}

function maxEdgeUtil(path) {
  let m = 0;
  for (const e of path.edges) m = Math.max(m, e.utilMbps || 0);
  return m;
}

function applyEdgeUtil(state, edge, mbps) {
  if (edge.lagId) {
    const lag = state.network.lags.find(l => l.id === edge.lagId);
    if (!lag) return;
    lag.utilMbps += mbps;
    // Distribute across member links by capacity hash
    const memberLinks = lag.memberLinkIds.map(id => state.network.links.find(l => l.id === id))
      .filter(l => l && l.status === 'up');
    if (memberLinks.length === 0) return;
    const totalCap = memberLinks.reduce((s, l) => s + l.capacityMbps, 0) || 1;
    for (const l of memberLinks) {
      l.utilMbps += mbps * (l.capacityMbps / totalCap);
    }
  } else if (edge.linkId) {
    const l = state.network.links.find(x => x.id === edge.linkId);
    if (l) l.utilMbps += mbps;
  }
}

// Public helpers

export function getRoutes(state, fromDcId, toDcId) {
  return state.routing?.tables?.[fromDcId]?.[toDcId] || [];
}

export function isCongested(state, dcId) {
  const report = [];
  for (const lnk of state.network.links) {
    if (lnk.aDcId !== dcId && lnk.bDcId !== dcId) continue;
    const ratio = lnk.utilMbps / Math.max(1, lnk.capacityMbps);
    if (ratio > 0.8) report.push({ linkId: lnk.id, ratio });
  }
  return report;
}
