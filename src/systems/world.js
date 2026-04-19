// Procedural world/map generation.
// Tiles are stored as a flat row-major array for cache-friendly iteration.

import { BUILDING_IDS, BUILDING_TYPES } from '../config/buildings.js';

export const TILE = {
  GRASS: 0,
  ROAD:  1,
  WATER: 2,
  PARK:  3,
};

export function generateWorld(size) {
  const tiles = new Array(size * size);
  for (let i = 0; i < tiles.length; i++) {
    tiles[i] = { type: TILE.GRASS, variant: Math.floor(Math.random() * 4), bld: null };
  }

  const idx = (x, y) => y * size + x;

  // Grid of roads — blocks of 5×5
  const blockSize = 5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x % blockSize === 0 || y % blockSize === 0) tiles[idx(x, y)].type = TILE.ROAD;
    }
  }

  // A couple of parks
  for (let i = 0; i < 3; i++) {
    const cx = 5 + Math.floor(Math.random() * (size - 10));
    const cy = 5 + Math.floor(Math.random() * (size - 10));
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < size && ny < size) {
        if (tiles[idx(nx, ny)].type === TILE.GRASS) tiles[idx(nx, ny)].type = TILE.PARK;
      }
    }
  }

  // Buildings — spawn on grass adjacent to road
  const buildable = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (tiles[idx(x, y)].type !== TILE.GRASS) continue;
    const neigh = [[1,0],[-1,0],[0,1],[0,-1]];
    const nextToRoad = neigh.some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < size && ny < size && tiles[idx(nx, ny)].type === TILE.ROAD;
    });
    if (nextToRoad) buildable.push([x, y]);
  }

  // Weighted sampling for type
  const typeWeights = {
    house: 0.30, rowhouse: 0.20, panel: 0.12, skyscraper: 0.04,
    shop: 0.12, bigcorp: 0.06, factory: 0.08, public: 0.08,
  };
  const weightedPick = () => {
    const r = Math.random();
    let acc = 0;
    for (const [id, w] of Object.entries(typeWeights)) {
      acc += w;
      if (r <= acc) return id;
    }
    return 'house';
  };

  const buildingFillRate = 0.55;
  for (const [x, y] of buildable) {
    if (Math.random() > buildingFillRate) continue;
    const typeId = weightedPick();
    const t = BUILDING_TYPES[typeId];
    const units = t.gameplay.units;
    const pop = t.gameplay.pop;
    tiles[idx(x, y)].bld = {
      type: typeId,
      x, y,
      units: Math.floor(units[0] + Math.random() * (units[1] - units[0] + 1)),
      population: Math.floor(pop[0] + Math.random() * (pop[1] - pop[0] + 1)),
      connected: false,
      customers: 0,
      satisfaction: 50,
      // shader variation seed (0..1, deterministic per tile)
      seed: ((x * 73856093) ^ (y * 19349663)) >>> 0,
    };
  }

  return {
    size,
    tiles,
    idx,
    at: (x, y) => (x >= 0 && y >= 0 && x < size && y < size) ? tiles[idx(x, y)] : null,
  };
}

export function listBuildings(world) {
  const out = [];
  for (let y = 0; y < world.size; y++) for (let x = 0; x < world.size; x++) {
    const t = world.tiles[world.idx(x, y)];
    if (t.bld) out.push(t.bld);
  }
  return out;
}
