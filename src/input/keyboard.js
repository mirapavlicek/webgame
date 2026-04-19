import { TIME } from '../config/tunables.js';

export function installKeyboard(state) {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { state.paused = !state.paused; e.preventDefault(); return; }
    if (e.key >= '1' && e.key <= '4') {
      const i = parseInt(e.key, 10);
      if (i < TIME.SPEED_STEPS.length) state.speed = i;
    }
    if (e.key === 'Escape') { state.ui.tool = 'select'; document.body.className = ''; }
  });
}
