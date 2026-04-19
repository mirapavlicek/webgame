import { Component } from './Component.js';
import { h, clear } from '../utils/dom.js';
import { fmtKc, fmtDate } from '../utils/format.js';
import { TIME } from '../config/tunables.js';

export class TopBar extends Component {
  render(state) {
    clear(this.root);
    const netMonth = state.monthlyIncome - state.monthlyExpense;
    const cashClass = state.cash < 0 ? 'bad' : '';
    const netClass = netMonth < 0 ? 'bad' : netMonth > 0 ? 'good' : '';

    this.root.append(
      h('div', { class: 'brand' }, [
        h('div', { class: 'brand-mark' }, '⚡'),
        'NetTycoon',
      ]),
      kpi('Hotovost', fmtKc(state.cash), cashClass),
      kpi('Měsíční příjem', fmtKc(state.monthlyIncome)),
      kpi('Měsíční náklady', fmtKc(state.monthlyExpense)),
      kpi('Cashflow', (netMonth >= 0 ? '+' : '') + fmtKc(netMonth), netClass),
      kpi('Rating', state.creditRating, 'info'),
      kpi('Datum', fmtDate(state.date)),
      h('div', { class: 'spacer' }),
      this.speedControls(state),
    );
  }

  speedControls(state) {
    const wrap = h('div', { class: 'speed-controls' });
    const labels = ['⏸', '1×', '2×', '4×', '8×'];
    for (let i = 0; i < TIME.SPEED_STEPS.length; i++) {
      const btn = h('button', {
        class: 'speed-btn' + (state.speed === i ? ' active' : ''),
        onclick: () => { state.speed = i; this.render(state); },
      }, labels[i]);
      wrap.append(btn);
    }
    return wrap;
  }
}

function kpi(label, value, extra) {
  return h('div', { class: 'kpi' }, [
    h('div', { class: 'kpi-label' }, label),
    h('div', { class: 'kpi-value ' + (extra || '') }, value),
  ]);
}
