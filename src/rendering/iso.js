// Isometric projection helpers. The world is a grid (x, y) of tiles;
// screen coords are obtained by shearing.

import { WORLD } from '../config/tunables.js';

export function toIso(x, y) {
  return {
    x: (x - y) * (WORLD.TILE_W / 2),
    y: (x + y) * (WORLD.TILE_H / 2),
  };
}

export function fromIso(sx, sy, camera, canvasW, canvasH) {
  const px = (sx - camera.x) / camera.zoom;
  const py = (sy - camera.y) / camera.zoom;
  return {
    x: Math.floor((px / (WORLD.TILE_W / 2) + py / (WORLD.TILE_H / 2)) / 2),
    y: Math.floor((py / (WORLD.TILE_H / 2) - px / (WORLD.TILE_W / 2)) / 2),
  };
}

export function centerCamera(camera, canvasW, canvasH) {
  const iso = toIso(WORLD.MAP_SIZE / 2, WORLD.MAP_SIZE / 2);
  camera.x = canvasW / 2 - iso.x;
  camera.y = canvasH / 2 - iso.y;
}
