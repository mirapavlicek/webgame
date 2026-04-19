// DC + cable + connection placement logic.
// Keeps `state.dcs`, `state.cables`, `state.conns` consistent.
// Very simple connectivity: a building is considered "connected" if any DC
// lies within a straight Chebyshev distance <= range of an existing cable network.

import { emit, EV } from '../core/eventBus.js';
import { TILE, listBuildings } from './world.js';

export const DC_TYPES = {
  small:  { name: 'Malé DC',    cost: 80_000,  mCost: 5_000,  capacity: 50,  color: 0xf59e0b },
  medium: { name: 'Střední DC', cost: 250_000, mCost: 15_000, capacity: 200, color: 0xf97316 },
  large:  { name: 'Velké DC',   cost: 800_000, mCost: 40_000, capacity: 800, color: 0xef4444 },
};

export function placeDC(state, typeId, x, y) {
  const def = DC_TYPES[typeId];
  if (!def) return { ok: false, err: 'Neznámý typ DC' };
  if (state.cash < def.cost) return { ok: false, err: 'Nedostatek hotovosti' };

  const tile = state.world.at(x, y);
  if (!tile) return { ok: false, err: 'Mimo mapu' };
  if (tile.type !== TILE.GRASS && tile.type !== TILE.PARK) return { ok: false, err: 'Sem DC nejde' };
  if (tile.bld || tile.dc) return { ok: false, err: 'Obsazeno' };

  const dc = {
    id: `dc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    typeId,
    x, y,
    capacity: def.capacity,
    used: 0,
    mCost: def.mCost,
    color: def.color,
    placedAt: { ...state.date },
  };
  state.dcs.push(dc);
  tile.dc = dc;
  state.cash -= def.cost;

  recalcConnectivity(state);
  emit(EV.DC_PLACED, { state, dc });
  emit(EV.CASH_CHANGED, state);

  // One-time tip when the user places their very first DC — patch panel is hidden otherwise.
  if (state.dcs.length === 1) {
    emit(EV.NOTIFICATION, {
      level: 'info',
      icon: '💡',
      text: 'Tip: přepni na nástroj 👆 Výběr a klikni na DC pro patch panel, LAG a routing.',
    });
  }
  return { ok: true, dc };
}

export function recalcConnectivity(state) {
  // Simple: each DC has an effective connection radius = 8 + capacity/100 tiles
  for (const b of listBuildings(state.world)) b.connected = false;

  for (const dc of state.dcs) {
    const r = 8 + Math.floor(dc.capacity / 60);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = dc.x + dx, ny = dc.y + dy;
      const t = state.world.at(nx, ny);
      if (!t || !t.bld) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d > r) continue;
      t.bld.connected = true;
      // seed customers slowly on first connect
      if (t.bld.customers === 0) {
        t.bld.customers = Math.max(1, Math.floor(t.bld.units * 0.2));
      }
    }
  }
}

export function removeDC(state, dcId) {
  const idx = state.dcs.findIndex(d => d.id === dcId);
  if (idx < 0) return false;
  const dc = state.dcs[idx];
  const tile = state.world.at(dc.x, dc.y);
  if (tile && tile.dc === dc) tile.dc = null;
  state.dcs.splice(idx, 1);
  recalcConnectivity(state);
  return true;
}
