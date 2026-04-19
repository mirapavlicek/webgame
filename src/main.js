// Entry point — wires everything together.

import { createGameState } from './core/state.js';
import { startLoop } from './core/gameLoop.js';
import { installEconomy } from './systems/economy.js';
import { installFinance } from './systems/finance.js';
import { installIncidents } from './systems/incidents.js';
import { installMorale } from './systems/morale.js';
import { installLinks } from './systems/links.js';
import { installRouting } from './systems/routing.js';
import { initRenderer, render, resetCamera } from './rendering/renderer.js';
import { initPixi } from './rendering/pixiApp.js';
import { initLinkRenderer, renderLinks } from './rendering/linkRenderer.js';
import { App } from './ui/App.js';
import { installMouse } from './input/mouse.js';
import { installKeyboard } from './input/keyboard.js';
import { emit, EV } from './core/eventBus.js';

async function main() {
  const state = createGameState('Hráč');
  window.__state__ = state; // debug handle

  const mapCanvas = document.getElementById('mapCanvas');
  const pixiCanvas = document.getElementById('pixiCanvas');

  initRenderer(mapCanvas, pixiCanvas);
  initPixi(pixiCanvas);
  resetCamera(state);

  installEconomy(state);
  installFinance(state);
  installIncidents(state);
  installMorale(state);
  installLinks(state);
  installRouting(state);
  initLinkRenderer();

  const app = new App(document.getElementById('app'), state);
  app.mount();

  installMouse(mapCanvas, state);
  installKeyboard(state);

  window.addEventListener('resize', () => { /* renderer handles it each frame */ });

  emit(EV.NOTIFICATION, { level: 'info', icon: '🎮', text: 'Vítej v NetTycoon v2! Začni tím, že postavíš první DC (ikona 🏢 vlevo).' });

  startLoop({
    state,
    tick: () => { /* per-day system updates happen via events */ },
    render: (s) => { render(s); renderLinks(s); app.update(s); },
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
