// Loans, credit rating, tax — trimmed port of the v1 finance system.

import { emit, EV, on } from '../core/eventBus.js';

export const CREDIT_TIERS = [
  { letter: 'AAA', minScore: 92, apr: 0.034 },
  { letter: 'AA',  minScore: 82, apr: 0.042 },
  { letter: 'A',   minScore: 72, apr: 0.055 },
  { letter: 'BBB', minScore: 60, apr: 0.072 },
  { letter: 'BB',  minScore: 48, apr: 0.095 },
  { letter: 'B',   minScore: 35, apr: 0.128 },
  { letter: 'CCC', minScore: 20, apr: 0.180 },
  { letter: 'D',   minScore: 0,  apr: 0.280 },
];

export const LOAN_PRODUCTS = {
  short: { id: 'short', name: 'Krátkodobá půjčka', termMonths: 12, maxMult: 0.8, aprMul: 1.0 },
  medium:{ id: 'medium', name: 'Střednědobá půjčka', termMonths: 36, maxMult: 2.0, aprMul: 1.15 },
  long:  { id: 'long', name: 'Dlouhodobá', termMonths: 84, maxMult: 4.0, aprMul: 1.30 },
};

export const TAX_RATE = 0.19;

export function installFinance(state) {
  on(EV.MONTH, () => loanMonthlyTick(state));
  on(EV.MONTH, () => updateCreditRating(state));
}

export function calcCreditScore(state) {
  const cashScore = Math.min(30, state.cash / 100_000);
  const profitScore = Math.min(25, (state.monthlyIncome - state.monthlyExpense) / 20_000);
  const debtScore = Math.max(-25, -state.loans.reduce((s, l) => s + l.remaining, 0) / 200_000);
  const histBonus = Math.min(20, state.incomeHistory.length * 0.5);
  return Math.max(0, Math.min(100, 50 + cashScore + profitScore + debtScore + histBonus));
}

export function getCreditTier(state) {
  const score = calcCreditScore(state);
  for (const t of CREDIT_TIERS) if (score >= t.minScore) return t;
  return CREDIT_TIERS[CREDIT_TIERS.length - 1];
}

export function updateCreditRating(state) {
  state.creditRating = getCreditTier(state).letter;
}

export function annuity(principal, apr, months) {
  const r = apr / 12;
  if (r === 0) return principal / months;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

export function takeLoan(state, productId, principal) {
  const product = LOAN_PRODUCTS[productId];
  if (!product) return { ok: false, err: 'Neplatný produkt' };
  const tier = getCreditTier(state);
  const maxAmt = Math.round((state.cash + state.monthlyIncome * 12) * product.maxMult);
  if (principal > maxAmt) return { ok: false, err: `Max ${maxAmt.toLocaleString('cs-CZ')} Kč` };
  const apr = tier.apr * product.aprMul;
  const monthly = Math.round(annuity(principal, apr, product.termMonths));
  state.loans.push({
    id: `loan_${Date.now()}`,
    productId,
    principal,
    remaining: principal,
    monthlyPayment: monthly,
    apr,
    termMonths: product.termMonths,
    paid: 0,
    startY: state.date.y,
    startM: state.date.m,
  });
  state.cash += principal;
  emit(EV.LOAN_TAKEN, state);
  emit(EV.CASH_CHANGED, state);
  emit(EV.NOTIFICATION, { level: 'info', icon: '💳', text: `Půjčka ${principal.toLocaleString('cs-CZ')} Kč (${product.name}, ${(apr*100).toFixed(2)}%)` });
  return { ok: true };
}

function loanMonthlyTick(state) {
  for (const l of state.loans) {
    const interest = l.remaining * (l.apr / 12);
    const principalPayment = Math.max(0, l.monthlyPayment - interest);
    l.remaining = Math.max(0, l.remaining - principalPayment);
    l.paid += l.monthlyPayment;
  }
  state.loans = state.loans.filter(l => l.remaining > 0.5);
}
