// Animated cable rendering between DCs.
// - Cable color = utilization (green < 50%, amber < 80%, red > 80%, dim down-links)
// - Flow particles move from low-index DC → high-index DC along the link
// - LAGs render as multiple parallel strokes with a subtle spread

import { toIso } from './iso.js';
import { WORLD } from '../config/tunables.js';
import { getPixi } from './pixiApp.js';

let gfx = null;
let particles = [];

export function initLinkRenderer() {
  const pixi = getPixi();
  if (!pixi.app || !window.PIXI) return;
  const PIXI = window.PIXI;
  if (!gfx) {
    gfx = new PIXI.Graphics();
    gfx.zIndex = -10;
    pixi.buildingLayer.addChild(gfx);
  }
}

export function renderLinks(state) {
  if (!gfx || !window.PIXI) return;
  gfx.clear();
  const cam = state.ui.camera;
  const net = state.network;
  if (!net) return;

  // First: render LAG-grouped links as bundled parallel strokes
  const lagLinks = new Set();
  for (const lag of net.lags) {
    const fromDc = state.dcs.find(d => d.id === lag.ownerDcId);
    const toDc = state.dcs.find(d => d.id === lag.peerDcId);
    if (!fromDc || !toDc || lag.memberLinkIds.length === 0) continue;

    const ratio = lag.capacityMbps > 0 ? lag.utilMbps / lag.capacityMbps : 0;
    const color = utilColor(ratio, lag.lacpState === 'sync');
    const n = lag.memberLinkIds.length;
    drawLag(fromDc, toDc, n, color, cam);
    for (const id of lag.memberLinkIds) lagLinks.add(id);
  }

  // Free links
  for (const lnk of net.links) {
    if (lagLinks.has(lnk.id)) continue;
    const a = state.dcs.find(d => d.id === lnk.aDcId);
    const b = state.dcs.find(d => d.id === lnk.bDcId);
    if (!a || !b) continue;
    const ratio = lnk.capacityMbps > 0 ? lnk.utilMbps / lnk.capacityMbps : 0;
    const color = utilColor(ratio, lnk.status === 'up');
    drawCable(a, b, color, cam, 2, lnk.status !== 'up');
  }

  // Animate flow particles
  updateParticles(state, cam);
}

function drawLag(a, b, n, color, cam) {
  const pa = dcScreen(a, cam);
  const pb = dcScreen(b, cam);
  const dx = pb.x - pa.x, dy = pb.y - pa.y;
  const len = Math.hypot(dx, dy) || 1;
  // perpendicular unit vector
  const nx = -dy / len, ny = dx / len;
  const spread = Math.min(8, 2 + n);
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * (spread / Math.max(1, n - 1 || 1));
    gfx.lineStyle(2 * cam.zoom, color, 0.85);
    gfx.moveTo(pa.x + nx * off, pa.y + ny * off);
    gfx.lineTo(pb.x + nx * off, pb.y + ny * off);
  }
  // bundle wrapper
  gfx.lineStyle(1 * cam.zoom, color, 0.25);
  gfx.moveTo(pa.x, pa.y);
  gfx.lineTo(pb.x, pb.y);
}

function drawCable(a, b, color, cam, width, dashed) {
  const pa = dcScreen(a, cam);
  const pb = dcScreen(b, cam);
  if (dashed) {
    const dx = pb.x - pa.x, dy = pb.y - pa.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const seg = 10;
    for (let t = 0; t < len; t += seg * 2) {
      gfx.lineStyle(width * cam.zoom, color, 0.5);
      gfx.moveTo(pa.x + ux * t, pa.y + uy * t);
      gfx.lineTo(pa.x + ux * Math.min(t + seg, len), pa.y + uy * Math.min(t + seg, len));
    }
  } else {
    gfx.lineStyle(width * cam.zoom, color, 0.85);
    gfx.moveTo(pa.x, pa.y);
    gfx.lineTo(pb.x, pb.y);
  }
}

function dcScreen(dc, cam) {
  const iso = toIso(dc.x, dc.y);
  return {
    x: iso.x * cam.zoom + cam.x,
    y: iso.y * cam.zoom + cam.y + (WORLD.TILE_H / 2) * cam.zoom,
  };
}

function utilColor(ratio, up) {
  if (!up) return 0x475569;
  if (ratio < 0.5)  return 0x10b981;
  if (ratio < 0.8)  return 0xf59e0b;
  return 0xef4444;
}

function updateParticles(state, cam) {
  const net = state.network;
  // spawn
  for (const lnk of net.links) {
    if (lnk.status !== 'up') continue;
    const ratio = lnk.utilMbps / Math.max(1, lnk.capacityMbps);
    if (ratio > 0.05 && Math.random() < 0.08 + ratio * 0.2) {
      particles.push({
        linkId: lnk.id,
        t: 0,
        speed: 0.003 + ratio * 0.01,
        color: utilColor(ratio, true),
      });
    }
  }
  particles = particles.filter(p => p.t <= 1);
  for (const p of particles) p.t += p.speed;

  // draw
  for (const p of particles) {
    const lnk = net.links.find(l => l.id === p.linkId);
    if (!lnk) continue;
    const a = state.dcs.find(d => d.id === lnk.aDcId);
    const b = state.dcs.find(d => d.id === lnk.bDcId);
    if (!a || !b) continue;
    const pa = dcScreen(a, cam);
    const pb = dcScreen(b, cam);
    const x = pa.x + (pb.x - pa.x) * p.t;
    const y = pa.y + (pb.y - pa.y) * p.t;
    gfx.beginFill(p.color, 0.9);
    gfx.lineStyle(0);
    gfx.drawCircle(x, y, 3 * cam.zoom);
    gfx.endFill();
  }
  if (particles.length > 200) particles.length = 200;
}
