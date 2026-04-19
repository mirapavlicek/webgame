// Hover tooltip + status bar nad viewportem.
// - Status bar vlevo dole: ukazuje aktivní nástroj a krátkou instrukci.
// - Tooltip následuje myš a ukazuje info o dlaždici (budova, DC, souřadnice).

import { Component } from './Component.js';
import { h, clear } from '../utils/dom.js';
import { on, EV } from '../core/eventBus.js';
import { BUILDING_TYPES } from '../config/buildings.js';
import { DC_TYPES } from '../systems/network.js';
import { WORLD } from '../config/tunables.js';

const TOOL_INFO = {
  'select':    { icon: '👆', label: 'Výběr',       help: 'Klikni na DC pro patch panel, LAG a routing. Shift+drag pro posun mapy.' },
  'dc_small':  { icon: '🏢', label: 'Malé DC',     help: 'Klikni na travnatou plochu. Cena 80 000 Kč, kapacita 50 zákazníků.' },
  'dc_medium': { icon: '🏬', label: 'Střední DC',  help: 'Klikni na travnatou plochu. Cena 250 000 Kč, kapacita 200 zákazníků.' },
  'dc_large':  { icon: '🏗️', label: 'Velké DC',    help: 'Klikni na travnatou plochu. Cena 800 000 Kč, kapacita 800 zákazníků.' },
  'delete':    { icon: '🗑️', label: 'Odstranit',   help: 'Klikni na DC, které chceš zbourat.' },
};

export class ViewportHUD extends Component {
  constructor(viewportEl, state) {
    super(viewportEl);
    this.state = state;
    this.viewport = viewportEl;
  }

  mount() {
    super.mount(this.state);

    // Status bar (dolní levý roh viewportu)
    this.statusEl = h('div', { class: 'vp-status' });
    this.viewport.appendChild(this.statusEl);

    // Tooltip (absolutní, sleduje myš)
    this.tipEl = h('div', { class: 'vp-tooltip' });
    this.tipEl.style.display = 'none';
    this.viewport.appendChild(this.tipEl);

    // Legenda (dolní pravý roh)
    this.legendEl = h('div', { class: 'vp-legend' }, [
      h('div', { class: 'vp-legend-title' }, 'Legenda'),
      legendRow('#22d3ee', 'DC — ikona s aurou'),
      legendRow('#10b981', 'Link < 50 % využití'),
      legendRow('#f59e0b', 'Link 50–80 %'),
      legendRow('#ef4444', 'Link > 80 % / down'),
      legendRow('#334155', 'Nepřipojená budova (červené obrysy)'),
    ]);
    this.viewport.appendChild(this.legendEl);

    // Myš tracking pro tooltip
    this.viewport.addEventListener('mousemove', (e) => {
      const rect = this.viewport.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      this.updateTooltip();
    });
    this.viewport.addEventListener('mouseleave', () => {
      this.tipEl.style.display = 'none';
    });

    on(EV.TOOL_CHANGED, () => this.update(this.state));
    this.update(this.state);

    // Welcome overlay jen při prvním spuštění
    this.maybeShowWelcome();
  }

  update(state) {
    this.state = state;
    const info = TOOL_INFO[state.ui.tool] || TOOL_INFO.select;
    clear(this.statusEl);
    this.statusEl.append(
      h('span', { class: 'vp-status-icon' }, info.icon),
      h('span', { class: 'vp-status-label' }, info.label),
      h('span', { class: 'vp-status-help' }, info.help),
    );
    this.updateTooltip();
  }

  updateTooltip() {
    const t = this.state.ui.hoverTile;
    if (!t || t.x < 0 || t.y < 0 || t.x >= WORLD.MAP_SIZE || t.y >= WORLD.MAP_SIZE) {
      this.tipEl.style.display = 'none';
      return;
    }
    const tile = this.state.world.at(t.x, t.y);
    if (!tile) { this.tipEl.style.display = 'none'; return; }

    let html;
    if (tile.dc) {
      const def = DC_TYPES[tile.dc.typeId];
      html = `
        <div class="tip-head">🏢 ${def?.name || 'DC'}</div>
        <div class="tip-line">ID: <span class="mono">${tile.dc.id}</span></div>
        <div class="tip-line">Kapacita: ${tile.dc.capacity} zákazníků</div>
        <div class="tip-line">Využito: ${tile.dc.used} · Náklady ${tile.dc.mCost.toLocaleString('cs')} Kč/měs</div>
        <div class="tip-hint">Klikni (👆 Výběr) pro patch panel, LAG a routing.</div>
      `;
    } else if (tile.bld) {
      const def = BUILDING_TYPES[tile.bld.type];
      const conn = tile.bld.connected ? '<span class="tip-ok">připojeno</span>' : '<span class="tip-bad">nepřipojeno</span>';
      html = `
        <div class="tip-head">${def?.icon || '🏠'} ${def?.name || tile.bld.type}</div>
        <div class="tip-line">Zákazníci: ${tile.bld.customers || 0} / ${tile.bld.units || 0}</div>
        <div class="tip-line">Stav: ${conn}</div>
      `;
    } else {
      const terr = terrainName(tile.type);
      html = `<div class="tip-head">${terr}</div><div class="tip-line muted">Souřadnice ${t.x}, ${t.y}</div>`;
    }

    this.tipEl.innerHTML = html;
    this.tipEl.style.display = 'block';
    // Umístění (ohraničené viewportem)
    const pad = 14;
    const rect = this.viewport.getBoundingClientRect();
    const tw = this.tipEl.offsetWidth;
    const th = this.tipEl.offsetHeight;
    let x = this.mouseX + pad;
    let y = this.mouseY + pad;
    if (x + tw > rect.width - 8)  x = this.mouseX - tw - pad;
    if (y + th > rect.height - 8) y = this.mouseY - th - pad;
    this.tipEl.style.left = x + 'px';
    this.tipEl.style.top  = y + 'px';
  }

  maybeShowWelcome() {
    if (window.sessionStorage) { /* nepoužíváme */ }
    // Ukaž pouze při prvním startu (nemáme žádné DC ani incidenty)
    if (this.state.dcs.length > 0) return;

    const overlay = h('div', { class: 'welcome-overlay' }, [
      h('div', { class: 'welcome-card' }, [
        h('h2', {}, 'Vítej v NetTycoon v2 🎮'),
        h('p', {}, 'Staneš se provozovatelem ISP. Postav datová centra, propoj je kabely, zvládni incidenty a rozšiřuj síť.'),
        h('div', { class: 'welcome-steps' }, [
          step('1', '🏢', 'Postav DC', 'Vlevo klikni na ikonu 🏢/🏬/🏗️ a umísti DC na mapu. První je nejlevnější.'),
          step('2', '👆', 'Otevři patch panel', 'S nástrojem Výběr klikni na postavené DC — uvidíš porty, kabely, LAG a routing.'),
          step('3', '🔗', 'Propoj DC', 'V detailu DC vyber cíl + typ kabelu a polož spoj. Více spojů → LAG pro vyšší propustnost.'),
          step('4', '📊', 'Sleduj trasy', 'Při více DC se provoz rozkládá přes paralelní trasy (ECMP). Při přetížení se přesune jinou cestou.'),
        ]),
        h('button', { class: 'btn btn-primary', onclick: () => overlay.remove() }, 'Rozumím, začít hrát'),
      ]),
    ]);
    document.body.appendChild(overlay);

    // Zmiz automaticky po prvním postavení DC
    const unsub = on(EV.DC_PLACED, () => { overlay.remove(); unsub(); });
  }
}

function legendRow(color, label) {
  return h('div', { class: 'vp-legend-row' }, [
    h('span', { class: 'vp-legend-swatch', style: { background: color } }),
    h('span', {}, label),
  ]);
}

function step(num, icon, title, body) {
  return h('div', { class: 'welcome-step' }, [
    h('div', { class: 'welcome-step-num' }, num),
    h('div', { class: 'welcome-step-body' }, [
      h('div', { class: 'welcome-step-title' }, `${icon} ${title}`),
      h('div', { class: 'welcome-step-text' }, body),
    ]),
  ]);
}

function terrainName(type) {
  if (type === 1) return '🌲 Tráva';
  if (type === 2) return '🛣️ Silnice';
  if (type === 3) return '💧 Voda';
  if (type === 4) return '🌳 Park';
  return 'Terén';
}
