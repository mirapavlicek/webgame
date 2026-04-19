import { Component } from './Component.js';
import { h, clear } from '../utils/dom.js';
import { emit, EV } from '../core/eventBus.js';

const TOOLS = [
  { id: 'select',   icon: '👆', label: 'Výběr' },
  { id: 'dc_small', icon: '🏢', label: 'Malé DC (80 000 Kč)' },
  { id: 'dc_medium',icon: '🏬', label: 'Střední DC (250 000 Kč)' },
  { id: 'dc_large', icon: '🏗️', label: 'Velké DC (800 000 Kč)' },
  null, // separator
  { id: 'delete',   icon: '🗑️', label: 'Odstranit' },
];

export class Sidebar extends Component {
  render(state) {
    clear(this.root);
    for (const t of TOOLS) {
      if (!t) { this.root.append(h('div', { class: 'sidebar-sep' })); continue; }
      const active = state.ui.tool === t.id;
      this.root.append(
        h('div', {
          class: 'tool' + (active ? ' active' : ''),
          onclick: () => {
            state.ui.tool = state.ui.tool === t.id ? 'select' : t.id;
            document.body.className =
              state.ui.tool === 'select' ? '' :
              state.ui.tool === 'delete' ? 'cursor-delete' : 'cursor-build';
            emit(EV.TOOL_CHANGED, state.ui.tool);
            this.render(state);
          },
        }, [ t.icon, h('span', { class: 'tool-label' }, t.label) ]),
      );
    }
  }
}
