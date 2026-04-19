// Main renderer: terrain + DCs on Canvas2D; buildings on PixiJS (see buildingRenderer).

import { WORLD } from '../config/tunables.js';
import { TILE } from '../systems/world.js';
import { toIso, fromIso, centerCamera } from './iso.js';
import { renderBuildings, setBuildingContext } from './buildingRenderer.js';

let ctx, canvas, pixiCanvas;

export function initRenderer(mapCanvas, pxCanvas) {
  canvas = mapCanvas;
  pixiCanvas = pxCanvas;
  ctx = canvas.getContext('2d');
  setBuildingContext(ctx);
}

export function resize() {
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;
}

export function screenToTile(state, sx, sy) {
  return fromIso(sx, sy, state.ui.camera, canvas.width, canvas.height);
}

function getNightFactor(state) {
  const hour = ((state.date.d - 1) / 30) * 24;
  if (hour < 5)  return 1.0;
  if (hour < 7)  return 1.0 - (hour - 5) / 2;
  if (hour < 18) return 0.0;
  if (hour < 21) return (hour - 18) / 3;
  return 1.0;
}

export function render(state) {
  if (!ctx) return;
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;

  const { camera } = state.ui;
  ctx.fillStyle = '#02040a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  const w = state.world;
  for (let y = 0; y < w.size; y++) for (let x = 0; x < w.size; x++) {
    const t = w.tiles[w.idx(x, y)];
    drawTile(x, y, t);
  }

  // Day/night factor
  const night = getNightFactor(state);

  // Buildings — klidné 2D iso krabičky, malované rovnou do téhož ctx.
  renderBuildings(state, night);

  // DCs as glowing hexagons — on top of buildings
  for (const dc of state.dcs) drawDC(dc, state);

  // Hover highlight
  if (state.ui.hoverTile) drawHover(state.ui.hoverTile);

  // Day/night tint celé scény
  if (night > 0) {
    ctx.restore();
    ctx.fillStyle = `rgba(10, 20, 60, ${night * 0.25})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  ctx.restore();
}

function drawTile(x, y, tile) {
  const iso = toIso(x, y);
  ctx.save();
  ctx.translate(iso.x, iso.y);
  // Diamond
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(WORLD.TILE_W / 2, WORLD.TILE_H / 2);
  ctx.lineTo(0, WORLD.TILE_H);
  ctx.lineTo(-WORLD.TILE_W / 2, WORLD.TILE_H / 2);
  ctx.closePath();

  if (tile.type === TILE.ROAD) {
    ctx.fillStyle = '#1d222c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (tile.type === TILE.WATER) {
    ctx.fillStyle = '#0e3a5b';
    ctx.fill();
  } else if (tile.type === TILE.PARK) {
    ctx.fillStyle = '#223822';
    ctx.fill();
  } else {
    // grass variants
    const variants = ['#14301f', '#17351f', '#183b22', '#183820'];
    ctx.fillStyle = variants[tile.variant % variants.length];
    ctx.fill();
  }
  ctx.restore();
}

function drawDC(dc, state) {
  const iso = toIso(dc.x, dc.y);
  ctx.save();
  ctx.translate(iso.x, iso.y + WORLD.TILE_H / 2);

  const pulse = 0.8 + 0.2 * Math.sin(performance.now() / 400);
  ctx.shadowColor = `#${dc.color.toString(16).padStart(6, '0')}`;
  ctx.shadowBlur = 24 * pulse;

  ctx.fillStyle = `#${dc.color.toString(16).padStart(6, '0')}`;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0b1018';
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  // coverage ring
  const r = 8 + Math.floor(dc.capacity / 60);
  ctx.strokeStyle = `rgba(${colorHexRGBA(dc.color, 0.12)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r * WORLD.TILE_W / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function colorHexRGBA(c, a) {
  const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
  return `${r},${g},${b},${a}`;
}

function drawHover({ x, y }) {
  if (x < 0 || y < 0 || x >= WORLD.MAP_SIZE || y >= WORLD.MAP_SIZE) return;
  const iso = toIso(x, y);
  ctx.save();
  ctx.translate(iso.x, iso.y);
  ctx.strokeStyle = 'rgba(34,211,238,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(WORLD.TILE_W / 2, WORLD.TILE_H / 2);
  ctx.lineTo(0, WORLD.TILE_H);
  ctx.lineTo(-WORLD.TILE_W / 2, WORLD.TILE_H / 2);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

export function resetCamera(state) {
  centerCamera(state.ui.camera, canvas.width, canvas.height);
}
