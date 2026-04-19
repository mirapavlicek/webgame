// Core economy: cash flow, revenue, expenses, monthly reconciliation.

import { ECONOMY } from '../config/tunables.js';
import { emit, EV, on } from '../core/eventBus.js';
import { listBuildings } from './world.js';

export function installEconomy(state) {
  on(EV.MONTH, () => monthlyReconcile(state));
}

function monthlyReconcile(state) {
  const buildings = listBuildings(state.world);

  let income = 0;
  for (const b of buildings) {
    if (!b.connected) continue;
    // 320 Kč base/customer/month with a satisfaction multiplier
    income += b.customers * 320 * (0.6 + (b.satisfaction / 100) * 0.6);
  }

  let expense = ECONOMY.MONTHLY_OVERHEAD;
  // DC upkeep
  for (const dc of state.dcs) expense += dc.mCost || 8_000;
  // Staff salaries
  const salaries = { tech: 35_000, support: 28_000, sales: 40_000, noc: 45_000, dev: 55_000 };
  for (const k of Object.keys(state.staff)) expense += state.staff[k].count * salaries[k];
  // Loans
  for (const l of state.loans) expense += l.monthlyPayment || 0;

  state.monthlyIncome = Math.round(income);
  state.monthlyExpense = Math.round(expense);
  const net = state.monthlyIncome - state.monthlyExpense;

  state.cash += net;
  emit(EV.CASH_CHANGED, state);

  state.incomeHistory.push(state.monthlyIncome);
  state.expenseHistory.push(state.monthlyExpense);
  if (state.incomeHistory.length > 48) { state.incomeHistory.shift(); state.expenseHistory.shift(); }

  if (net < 0 && state.cash < 0) {
    emit(EV.NOTIFICATION, { level: 'bad', icon: '💸', text: `Záporný cash flow! ${net.toLocaleString('cs-CZ')} Kč` });
  } else if (net > 100_000) {
    emit(EV.NOTIFICATION, { level: 'good', icon: '💰', text: `Měsíční zisk ${net.toLocaleString('cs-CZ')} Kč` });
  }
}
