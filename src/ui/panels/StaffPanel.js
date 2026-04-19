import { Component } from '../Component.js';
import { h, clear } from '../../utils/dom.js';
import { fmtKc } from '../../utils/format.js';

const STAFF_LABEL = {
  tech: { name: 'Technici',  icon: '🔧', salary: 35_000 },
  support: { name: 'Support', icon: '🎧', salary: 28_000 },
  sales:   { name: 'Obchod',  icon: '💼', salary: 40_000 },
  noc:     { name: 'NOC',     icon: '📊', salary: 45_000 },
  dev:     { name: 'Vývojáři',icon: '💻', salary: 55_000 },
};

export class StaffPanel extends Component {
  render(state) {
    clear(this.root);
    for (const key of Object.keys(state.staff)) {
      const st = state.staff[key];
      const info = STAFF_LABEL[key];
      const moraleClass = st.morale < 30 ? 'bad' : st.morale < 60 ? 'warn' : 'ok';
      this.root.append(h('div', { class: 'card' }, [
        h('div', { class: 'card-title' }, [
          `${info.icon} ${info.name}`,
          h('span', { class: 'badge neutral', style: { marginLeft: 'auto' } }, `${st.count}`),
        ]),
        h('div', { class: 'card-desc' },
          `L${st.level} · XP ${st.xp} · mzda ${fmtKc(info.salary)} / měs / os.`),
        h('div', { class: 'row' }, [
          h('div', { style: { flex: '1' } }, [
            h('div', { class: 'xs muted' }, `Morálka ${st.morale.toFixed(0)} / 100`),
            h('div', { class: 'progress' }, [
              h('div', {
                class: 'progress-fill ' + moraleClass,
                style: { width: `${st.morale}%` },
              }),
            ]),
          ]),
          h('button', { class: 'btn sm', onclick: () => { this.hire(state, key, info.salary); } }, 'Najmout'),
          h('button', { class: 'btn btn-ghost sm',
            onclick: () => { st.count = Math.max(0, st.count - 1); this.render(state); } }, '−'),
        ]),
      ]));
    }

    this.root.append(h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, 'Tréninkový rozpočet'),
      h('div', { class: 'card-desc' }, `Měsíčně: ${fmtKc(state.trainingBudget)}`),
      h('div', { class: 'row' }, [5_000, 15_000, 50_000, 0].map(v =>
        h('button', {
          class: 'btn btn-ghost sm',
          onclick: () => { state.trainingBudget = v; this.render(state); },
        }, v === 0 ? 'Vypnout' : fmtKc(v)))),
    ]));
  }

  hire(state, key, salary) {
    const signOn = salary * 0.5;
    if (state.cash < signOn) return;
    state.cash -= signOn;
    state.staff[key].count += 1;
    this.render(state);
  }
}
