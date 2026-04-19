import { Component } from './Component.js';
import { h, clear } from '../utils/dom.js';
import { on, EV } from '../core/eventBus.js';

export class NotificationFeed extends Component {
  constructor(root, state) {
    super(root);
    this.state = state;
    on(EV.NOTIFICATION, (n) => this.pushNotif(n));
  }

  pushNotif(n) {
    this.state.ui.notifications.unshift({ ...n, t: Date.now() });
    if (this.state.ui.notifications.length > 40) this.state.ui.notifications.length = 40;
    this.render(this.state);
  }

  render(state) {
    clear(this.root);
    for (const n of state.ui.notifications.slice(0, 12)) {
      this.root.append(
        h('div', { class: 'notif ' + (n.level || 'info') }, [
          h('div', { class: 'notif-icon' }, n.icon || '•'),
          h('div', { class: 'notif-body' }, [
            n.text,
            h('div', { class: 'notif-time' }, agoStr(n.t)),
          ]),
        ]),
      );
    }
    if (state.ui.notifications.length === 0) {
      this.root.append(h('div', { class: 'muted xs' }, 'Žádné události.'));
    }
  }
}

function agoStr(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'právě teď';
  if (diff < 3600) return `před ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `před ${Math.floor(diff / 3600)} h`;
  return `před ${Math.floor(diff / 86400)} dny`;
}
