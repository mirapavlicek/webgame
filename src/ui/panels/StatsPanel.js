import { Component } from '../Component.js';
import { h, clear } from '../../utils/dom.js';
import { fmtKc, fmtNum } from '../../utils/format.js';
import { listBuildings } from '../../systems/world.js';

export class StatsPanel extends Component {
  render(state) {
    clear(this.root);
    const buildings = listBuildings(state.world);
    const connected = buildings.filter(b => b.connected).length;
    const totalCust = buildings.reduce((s, b) => s + b.customers, 0);
    const avgSat = connected === 0 ? 0 :
      buildings.filter(b => b.connected).reduce((s, b) => s + b.satisfaction, 0) / connected;

    this.root.append(
      statRow('Zákazníci', fmtNum(totalCust)),
      statRow('Budovy (připojené)', `${connected} / ${buildings.length}`),
      statRow('Datová centra', `${state.dcs.length}`),
      statRow('Průměrná spokojenost', `${avgSat.toFixed(1)} %`),
      statRow('Aktivní incidenty', `${state.incidents.length}`),
      statRow('Aktivní úvěry', `${state.loans.length}`),
      statRow('Celkový dluh', fmtKc(state.loans.reduce((s, l) => s + l.remaining, 0))),
    );
  }
}

function statRow(label, value) {
  return h('div', { class: 'stat-row' }, [
    h('span', { class: 'stat-label' }, label),
    h('span', { class: 'stat-value' }, value),
  ]);
}
