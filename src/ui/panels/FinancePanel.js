import { Component } from '../Component.js';
import { h, clear } from '../../utils/dom.js';
import { fmtKc } from '../../utils/format.js';
import { CREDIT_TIERS, LOAN_PRODUCTS, takeLoan, getCreditTier } from '../../systems/finance.js';

export class FinancePanel extends Component {
  render(state) {
    clear(this.root);
    const tier = getCreditTier(state);

    const ratingBox = h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, ['Credit rating',
        h('span', { class: 'badge info', style: { marginLeft: 'auto' } }, state.creditRating)]),
      h('div', { class: 'card-desc' }, `APR ${(tier.apr * 100).toFixed(2)} % · škála AAA → D`),
    ]);

    const loansList = h('div', { class: 'col' });
    if (state.loans.length === 0) {
      loansList.append(h('div', { class: 'muted xs' }, 'Žádné úvěry.'));
    } else {
      for (const l of state.loans) {
        loansList.append(h('div', { class: 'card' }, [
          h('div', { class: 'card-title' }, `${LOAN_PRODUCTS[l.productId]?.name || l.productId}`),
          h('div', { class: 'card-desc' },
            `Zbývá ${fmtKc(l.remaining)} · splátka ${fmtKc(l.monthlyPayment)} / měs · APR ${(l.apr * 100).toFixed(2)} %`),
        ]));
      }
    }

    const productButtons = h('div', { class: 'col' });
    for (const key of Object.keys(LOAN_PRODUCTS)) {
      const p = LOAN_PRODUCTS[key];
      productButtons.append(h('button', {
        class: 'btn btn-ghost',
        onclick: () => {
          const amount = parseInt(prompt(`Výše úvěru pro ${p.name} (Kč)?`, '200000') || '0', 10);
          if (amount > 0) {
            const r = takeLoan(state, key, amount);
            if (!r.ok) alert(r.err);
            this.render(state);
          }
        },
      }, `${p.name} · ${p.termMonths} měs`));
    }

    this.root.append(
      ratingBox,
      h('div', { class: 'sm muted' }, 'Aktivní úvěry'),
      loansList,
      h('div', { class: 'sm muted' }, 'Vzít nový úvěr'),
      productButtons,
    );
  }
}
