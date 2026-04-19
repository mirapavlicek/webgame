// Klidná izometrická 2D grafika budov.
// Každá budova je krabička s 3 viditelnými stěnami (top, left, right) a volitelným
// roof / spire detailem. Kreslí se přímo do Canvas2D contextu terénu, aby grafika
// zůstala konzistentní a přehledná — žádné shadery, žádné přerůstání přes mapu.

import { WORLD } from '../config/tunables.js';
import { BUILDING_TYPES } from '../config/buildings.js';
import { toIso } from './iso.js';

let ctx2d = null;

export function setBuildingContext(ctx) { ctx2d = ctx; }

export function renderBuildings(state, nightFactor) {
  if (!ctx2d) return;
  const w = state.world;
  const list = [];
  for (let y = 0; y < w.size; y++) {
    for (let x = 0; x < w.size; x++) {
      const t = w.tiles[w.idx(x, y)];
      if (t.bld) list.push({ x, y, bld: t.bld });
    }
  }
  // Z-order: nižší iso.y (vzadu) dřív, vyšší iso.y později (překrývá)
  list.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  for (const item of list) drawBuilding(item.x, item.y, item.bld, nightFactor);
}

function drawBuilding(tx, ty, bld, night) {
  const def = BUILDING_TYPES[bld.type];
  if (!def) return;
  const p = def.shader;

  // Normalizovaná výška: max ~3× tile_h, aby se nic netyčilo přes celou mapu.
  const H = Math.min(WORLD.TILE_H * 3.5, WORLD.TILE_H * 0.5 * (p.baseHeight || 1));

  // Půdorys budovy — o něco menší než dlaždice, ať je vidět tráva.
  const shrink = Math.min(0.92, 0.55 + 0.1 * (p.widthMul || 1));
  const halfW = (WORLD.TILE_W / 2) * shrink;
  const halfH = (WORLD.TILE_H / 2) * shrink;

  const iso = toIso(tx, ty);
  // Střed dlaždice (v iso prostoru = roh vlevo nahoře + TILE_W/2, TILE_H/2)
  const cx = iso.x;
  const cy = iso.y + WORLD.TILE_H / 2;

  // Body podstavy (na zemi)
  const top    = { x: cx,          y: cy - halfH };
  const right  = { x: cx + halfW,  y: cy };
  const bottom = { x: cx,          y: cy + halfH };
  const left   = { x: cx - halfW,  y: cy };

  // Body koruny (o H výš)
  const topU    = { x: top.x,    y: top.y    - H };
  const rightU  = { x: right.x,  y: right.y  - H };
  const bottomU = { x: bottom.x, y: bottom.y - H };
  const leftU   = { x: left.x,   y: left.y   - H };

  const dim = bld.connected ? 1.0 : 0.62;

  // Paleta (3 odstíny: top, front-left, front-right)
  const base = rgbFromPalette(p.palette, dim);
  const frontCol = mixRGB(base, [0, 0, 0], 0.10);
  const sideCol  = mixRGB(base, [0, 0, 0], 0.30);
  const topCol   = mixRGB(base, [255, 255, 255], 0.08);

  const ctx = ctx2d;

  // Pravá (front-right) stěna: bottom → right → rightU → bottomU
  fillPoly(ctx, frontCol, [bottom, right, rightU, bottomU]);
  drawWindows(ctx, [bottom, right, rightU, bottomU], p, bld.seed || 0, night, 'right');

  // Levá (front-left) stěna: bottom → left → leftU → bottomU
  fillPoly(ctx, sideCol, [bottom, left, leftU, bottomU]);
  drawWindows(ctx, [bottom, left, leftU, bottomU], p, (bld.seed || 0) + 1, night, 'left');

  // Střecha / top plocha: topU → rightU → bottomU → leftU
  fillPoly(ctx, topCol, [topU, rightU, bottomU, leftU]);

  // Roof detail
  if (p.roofStyle === 'pitched') {
    const peak = { x: cx, y: topU.y - WORLD.TILE_H * 0.45 };
    const accent = rgbTupleToCss(p.accent, dim);
    fillPoly(ctx, accent, [topU, rightU, peak]);
    fillPoly(ctx, mixRGBcss(accent, 'rgb(0,0,0)', 0.25), [topU, leftU, peak]);
  } else if (p.roofStyle === 'spire') {
    const accent = rgbTupleToCss(p.accent, dim);
    const peak = { x: cx, y: topU.y - H * 0.55 };
    // anténa/spire
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, topU.y);
    ctx.lineTo(peak.x, peak.y);
    ctx.stroke();
    // blikající červená lampička
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(peak.x, peak.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Obrys
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bottom.x, bottom.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(rightU.x, rightU.y);
  ctx.lineTo(topU.x, topU.y);
  ctx.lineTo(leftU.x, leftU.y);
  ctx.lineTo(left.x, left.y);
  ctx.closePath();
  ctx.stroke();

  // Disconnected indikátor — červený rámeček
  if (!bld.connected) {
    ctx.strokeStyle = 'rgba(239,68,68,0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y); ctx.lineTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y); ctx.lineTo(left.x, left.y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawWindows(ctx, quad, p, seed, night, face) {
  const density = p.windowDensity || 0;
  if (density <= 0) return;

  // quad order: bottom → corner → cornerU → bottomU (trapezoid)
  // parametrizujeme (s,t) ∈ [0,1] × [0,1]:
  //   (0,0) = bottom (spodní střed/roh)
  //   (1,0) = corner (vedlejší spodní roh)
  //   (1,1) = cornerU (roh nahoře)
  //   (0,1) = bottomU (spodní střed nahoře)
  // Vytvoříme mřížku oken.
  const cols = face === 'right' ? 3 : 2;
  const rows = Math.max(2, Math.round(density * 8));
  const winW = p.windowSize || 0.1;
  const winH = winW * 1.4;

  const neonOn = hash2(seed, 42) < (p.neonChance || 0) && night > 0.3;
  const accentCss = rgbTupleToCss(p.accent, 1.0);
  const litCol = night > 0.4
    ? (neonOn ? accentCss : 'rgba(255,215,130,0.95)')
    : 'rgba(210,225,245,0.65)';
  const darkCol = 'rgba(20,28,45,0.7)';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tCol = (c + 0.5) / cols;
      const tRow = (r + 0.5) / rows;
      // U,V na trapezoidu (bilinearní interp. 4 rohů)
      const pt = bilinear(quad[0], quad[1], quad[2], quad[3], tCol, tRow);

      // Rozměr okna ve screen px — zmenšený podle řádku (perspektiva zleva horizontálně)
      const wpx = Math.max(1.5, winW * WORLD.TILE_W * 0.5);
      const hpx = Math.max(1.5, winH * WORLD.TILE_H * 0.5);

      const lit = (hash2(seed + r * 17, c * 23) < (0.55 + night * 0.35));
      ctx.fillStyle = lit ? litCol : darkCol;
      ctx.fillRect(pt.x - wpx / 2, pt.y - hpx / 2, wpx, hpx);
    }
  }
}

function bilinear(a, b, c, d, s, t) {
  // a(0,0) b(1,0) c(1,1) d(0,1)
  const ab = { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s };
  const dc = { x: d.x + (c.x - d.x) * s, y: d.y + (c.y - d.y) * s };
  return { x: ab.x + (dc.x - ab.x) * t, y: ab.y + (dc.y - ab.y) * t };
}

function fillPoly(ctx, color, pts) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
}

function rgbFromPalette(pal, dim) {
  return [
    Math.round(pal[0] * 255 * dim),
    Math.round(pal[1] * 255 * dim),
    Math.round(pal[2] * 255 * dim),
  ];
}

function rgbTupleToCss(tuple, dim) {
  return `rgb(${Math.round(tuple[0] * 255 * dim)},${Math.round(tuple[1] * 255 * dim)},${Math.round(tuple[2] * 255 * dim)})`;
}

function mixRGB(a, b, t) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

function mixRGBcss(a, b, t) {
  const pa = a.match(/\d+/g).map(Number);
  const pb = b.match(/\d+/g).map(Number);
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)},${Math.round(pa[1] + (pb[1] - pa[1]) * t)},${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`;
}

function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 1024) / 1024;
}

export function clearBuildingPool() {
  // no pool in this implementation
}
