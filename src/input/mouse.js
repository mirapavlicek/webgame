// Mouse pan, zoom, hover, click interactions.

import { screenToTile } from '../rendering/renderer.js';
import { placeDC, removeDC } from '../systems/network.js';
import { WORLD } from '../config/tunables.js';
import { emit, EV } from '../core/eventBus.js';
import { openDCView } from '../ui/views/DCView.js';

export function installMouse(canvas, state) {
  let dragging = false;
  let lastX = 0, lastY = 0;

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mouseup', () => {
    dragging = false;
    canvas.style.cursor = '';
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (dragging) {
      state.ui.camera.x += e.clientX - lastX;
      state.ui.camera.y += e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
    }
    state.ui.hoverTile = screenToTile(state, e.clientX - rect.left, e.clientY - rect.top);
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const t = screenToTile(state, e.clientX - rect.left, e.clientY - rect.top);
    if (!t || t.x < 0 || t.y < 0 || t.x >= WORLD.MAP_SIZE || t.y >= WORLD.MAP_SIZE) return;

    const tool = state.ui.tool;
    const tile = state.world.at(t.x, t.y);

    if (tool.startsWith('dc_')) {
      const typeId = tool.slice(3);
      const r = placeDC(state, typeId, t.x, t.y);
      if (!r.ok) emit(EV.NOTIFICATION, { level: 'bad', icon: '🚫', text: r.err });
      else emit(EV.NOTIFICATION, { level: 'good', icon: '🏗️', text: `DC ${typeId} postaveno` });
    } else if (tool === 'delete') {
      if (tile?.dc) {
        removeDC(state, tile.dc.id);
        emit(EV.NOTIFICATION, { level: 'warn', icon: '🗑️', text: 'DC odstraněno' });
      }
    } else if (tool === 'select' && tile?.dc) {
      // Open DC patch-panel view on selection click
      openDCView(state, tile.dc.id);
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const cam = state.ui.camera;
    const nz = Math.max(0.2, Math.min(5, cam.zoom * factor));
    cam.x = cx - (cx - cam.x) * (nz / cam.zoom);
    cam.y = cy - (cy - cam.y) * (nz / cam.zoom);
    cam.zoom = nz;
  }, { passive: false });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
