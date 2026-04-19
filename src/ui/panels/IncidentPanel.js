import { Component } from '../Component.js';
import { h, clear } from '../../utils/dom.js';
import { fmtKc } from '../../utils/format.js';
import { respond, CAUSES, SEVERITY } from '../../systems/incidents.js';

export class IncidentPanel extends Component {
  render(state) {
    clear(this.root);
    if (state.incidents.length === 0) {
      this.root.append(h('div', { class: 'muted xs' }, 'Žádné aktivní incidenty. Dobrá práce. ✅'));
      return;
    }
    const sorted = [...state.incidents].sort((a, b) =>
      Object.keys(SEVERITY).indexOf(a.severity) - Object.keys(SEVERITY).indexOf(b.severity));

    for (const inc of sorted) {
      const sev = SEVERITY[inc.severity];
      const card = h('div', { class: 'card' }, [
        h('div', { class: 'card-title' }, [
          h('span', { class: 'badge ' + sevClass(inc.severity) }, inc.severity),
          `${CAUSES[inc.cause]?.label || inc.cause}`,
        ]),
        h('div', { class: 'card-desc' },
          `Zbývá ~${inc.daysLeft.toFixed(1)} dnů · odhad nákladů ${fmtKc(inc.cost)}`),
        h('div', { class: 'row' }, [
          respBtn(state, inc, 'triage', 'Triage (2k)'),
          respBtn(state, inc, 'dispatch', 'Dispatch (8k)'),
          respBtn(state, inc, 'overtime', 'Overtime (15k)'),
          respBtn(state, inc, 'failover', 'Failover (25k)'),
        ]),
      ]);
      this.root.append(card);
    }
  }
}

function respBtn(state, inc, action, label) {
  return h('button', {
    class: 'btn btn-ghost sm',
    onclick: () => { respond(state, inc.id, action); },
  }, label);
}

function sevClass(sev) {
  return sev === 'P1' ? 'bad' : sev === 'P2' ? 'warn' : sev === 'P3' ? 'info' : 'neutral';
}
