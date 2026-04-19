// Staff morale & training — minimal.

import { on, EV, emit } from '../core/eventBus.js';

export function installMorale(state) {
  on(EV.MONTH, () => monthlyMorale(state));
}

export function monthlyMorale(state) {
  const s = state.staff;
  // Load drops morale, training raises morale
  for (const key of Object.keys(s)) {
    const st = s[key];
    if (st.count === 0) continue;

    // load proxy — buildings served per tech, incidents per noc, etc.
    let loadPenalty = 0;
    if (key === 'tech')    loadPenalty = Math.max(0, state.dcs.length / st.count - 2) * 3;
    if (key === 'noc')     loadPenalty = state.incidents.length / Math.max(1, st.count) * 4;
    if (key === 'support') loadPenalty = Math.max(0, state.buildings.length / Math.max(1, st.count) / 40);
    st.morale = Math.max(0, st.morale - loadPenalty);

    // training
    if (state.trainingBudget > 0 && state.cash >= state.trainingBudget) {
      const perHead = state.trainingBudget / Object.values(s).reduce((a, x) => a + x.count, 0);
      st.xp += Math.floor(perHead / 5_000);
      st.morale = Math.min(100, st.morale + perHead / 2_000);
      state.cash -= state.trainingBudget;
    }

    // level up
    while (st.xp >= st.level * 100) {
      st.xp -= st.level * 100;
      st.level += 1;
      emit(EV.NOTIFICATION, { level: 'good', icon: '⬆️', text: `${key} tým povýšil na level ${st.level}` });
    }

    // quit when consistently low
    if (st.morale < 20) {
      st.count = Math.max(0, st.count - 1);
      emit(EV.NOTIFICATION, { level: 'bad', icon: '👋', text: `${key} dal výpověď (morálka)` });
      st.morale = 50;
    }
  }
}
