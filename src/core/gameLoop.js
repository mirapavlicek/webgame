// Fixed-timestep game loop with separated tick / render phases.
// Tick runs world/economy simulation; render is pure.

import { TIME } from '../config/tunables.js';
import { emit, EV } from './eventBus.js';

let running = false;
let last = 0;

export function startLoop({ state, tick, render }) {
  running = true;
  last = performance.now();
  const frame = (now) => {
    if (!running) return;
    const dtMs = Math.min(100, now - last);
    last = now;

    if (!state.paused) {
      // dt in game-days
      const speed = TIME.SPEED_STEPS[state.speed] ?? 0;
      const dDays = (dtMs / 1000) * TIME.DAYS_PER_SECOND_BASE * speed;
      state.tickAccumulator += dDays;

      while (state.tickAccumulator >= 1) {
        state.tickAccumulator -= 1;
        advanceDay(state);
        tick(state);
      }
    }

    render(state, dtMs);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export function stopLoop() { running = false; }

function advanceDay(state) {
  const d = state.date;
  d.d += 1;
  emit(EV.DAY, state);
  const daysInMonth = 30;
  if (d.d > daysInMonth) {
    d.d = 1; d.m += 1;
    emit(EV.MONTH, state);
    if (d.m >= 12) { d.m = 0; d.y += 1; emit(EV.YEAR, state); }
  }
}
