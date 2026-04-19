// DC detail view — opens as a modal overlay.
// Shows:
//   - DC summary & capacity
//   - Patch panel grid (ports × status × assignments)
//   - LAG list with LACP state, member links, utilization bar
//   - Buttons to create new cable to another DC, and create/bind LAGs
//   - MLAG controls if 2 DCs are eligible

import { Component } from '../Component.js';
import { h, clear } from '../../utils/dom.js';
import { fmtKc } from '../../utils/format.js';
import {
  LINK_TYPES, LAG_MODES,
  createLink, removeLink, ensurePorts, getLagsForDc, getLinksForDc,
  createLag, attachToLag, detachFromLag,
  createMlagDomain, bindLagToMlag,
} from '../../systems/links.js';
import { getRoutes } from '../../systems/routing.js';

let backdrop = null;

export function openDCView(state, dcId) {
  closeDCView();
  const dc = state.dcs.find(d => d.id === dcId);
  if (!dc) return;
  ensurePorts(state, dc);

  backdrop = h('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) closeDCView(); } });
  const modal = h('div', { class: 'modal', style: { maxWidth: '920px', width: '95%' } });
  backdrop.append(modal);
  document.body.append(backdrop);

  const view = new DCView(modal, state, dc);
  view.mount();
}

export function closeDCView() {
  if (backdrop) { backdrop.remove(); backdrop = null; }
}

class DCView extends Component {
  constructor(root, state, dc) {
    super(root);
    this.state = state;
    this.dc = dc;
  }

  mount() {
    super.mount(this.state);
    this.render();
  }

  render() {
    clear(this.root);
    const { state, dc } = this;
    const links = getLinksForDc(state, dc.id);
    const lags = getLagsForDc(state, dc.id);
    const ports = state.network.ports[dc.id] || [];
    const used = ports.filter(p => p.linkId).length;

    this.root.append(
      h('div', { class: 'modal-title' }, `🏢 DC detail — ${dc.typeId.toUpperCase()}`),
      h('div', { class: 'row between sm muted', style: { marginBottom: '12px' } }, [
        h('span', {}, `Souřadnice: ${dc.x}, ${dc.y}`),
        h('span', {}, `Kapacita: ${dc.capacity} zákazníků`),
        h('span', {}, `Linky: ${links.length} · LAG: ${lags.length}`),
        h('span', {}, `Porty: ${used} / ${ports.length}`),
        h('button', { class: 'btn btn-ghost sm', onclick: () => closeDCView() }, '✕ Zavřít'),
      ]),

      this.renderPatchPanel(ports, links),
      this.renderLagSection(lags, links),
      this.renderCableSection(),
      this.renderRoutingSection(),
    );
  }

  renderPatchPanel(ports, links) {
    const wrap = h('div', { class: 'card', style: { marginBottom: '12px' } }, [
      h('div', { class: 'card-title' }, '🔌 Patch panel'),
      h('div', { class: 'card-desc' }, 'Každý čtverec = port. Kliknutím zobrazíš detail.'),
    ]);
    const grid = h('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(24, ports.length)}, 1fr)`,
        gap: '3px',
        marginTop: '8px',
      }
    });
    for (const p of ports) {
      const lnk = p.linkId ? links.find(l => l.id === p.linkId) : null;
      const peer = lnk ? (lnk.aDcId === this.dc.id ? lnk.bDcId : lnk.aDcId) : null;
      let bg = '#1a2233';
      if (lnk) {
        const ratio = lnk.utilMbps / Math.max(1, lnk.capacityMbps);
        if (lnk.status !== 'up') bg = '#ef4444';
        else if (ratio < 0.5) bg = '#10b981';
        else if (ratio < 0.8) bg = '#f59e0b';
        else bg = '#ef4444';
      }
      const title = lnk
        ? `Port ${p.id} → ${peer}\n${LINK_TYPES[lnk.typeId]?.name}\n${lnk.utilMbps.toFixed(0)} / ${lnk.capacityMbps} Mbps (${(lnk.utilMbps/lnk.capacityMbps*100).toFixed(0)}%)`
        : `Port ${p.id} — volný`;
      grid.append(h('div', {
        title,
        style: {
          height: '24px',
          borderRadius: '4px',
          background: bg,
          border: p.lagId ? '1px solid #22d3ee' : '1px solid rgba(255,255,255,0.08)',
          cursor: lnk ? 'pointer' : 'default',
          display: 'grid',
          placeItems: 'center',
          fontSize: '9px',
          color: 'rgba(255,255,255,0.7)',
          fontFamily: 'monospace',
        },
        onclick: () => {
          if (lnk && confirm(`Odebrat link na portu ${p.id}?`)) {
            removeLink(this.state, lnk.id); this.render();
          }
        },
      }, p.id));
    }
    wrap.append(grid);
    return wrap;
  }

  renderLagSection(lags, links) {
    const card = h('div', { class: 'card', style: { marginBottom: '12px' } }, [
      h('div', { class: 'card-title' }, '🧩 LAG skupiny'),
    ]);
    if (lags.length === 0) {
      card.append(h('div', { class: 'muted xs' }, 'Žádné LAG. Vytvoř kliknutím níže.'));
    } else {
      for (const lag of lags) {
        const ratio = lag.capacityMbps > 0 ? lag.utilMbps / lag.capacityMbps : 0;
        const peerId = lag.ownerDcId === this.dc.id ? lag.peerDcId : lag.ownerDcId;
        const fillClass = ratio < 0.5 ? 'ok' : ratio < 0.8 ? 'warn' : 'bad';
        const lagLinks = lag.memberLinkIds.map(id => links.find(l => l.id === id)).filter(Boolean);

        card.append(h('div', {
          style: {
            padding: '8px', marginTop: '6px',
            background: 'rgba(34,211,238,0.05)',
            border: '1px solid rgba(34,211,238,0.15)',
            borderRadius: '6px',
          }
        }, [
          h('div', { class: 'row between' }, [
            h('span', {}, [
              h('span', { class: 'mono' }, lag.id),
              ' → ',
              h('span', { class: 'mono muted' }, peerId),
              ' · ',
              h('span', { class: 'badge ' + (lag.lacpState === 'sync' ? 'ok' : 'warn') }, lag.lacpState),
              ' · ',
              h('span', { class: 'muted xs' }, LAG_MODES[lag.mode].label),
              lag.mlagId ? h('span', { class: 'badge info', style: { marginLeft: '4px' } }, `MLAG:${lag.mlagId}`) : null,
            ]),
            h('span', { class: 'mono xs' }, `${lag.utilMbps.toFixed(0)} / ${lag.capacityMbps} Mbps`),
          ]),
          h('div', { class: 'progress', style: { marginTop: '4px' } },
            h('div', { class: 'progress-fill ' + fillClass, style: { width: (ratio * 100).toFixed(1) + '%' } })),
          h('div', { class: 'xs muted', style: { marginTop: '4px' } },
            `Členové: ${lagLinks.length} linků`),
          h('div', { class: 'row', style: { marginTop: '6px', gap: '4px', flexWrap: 'wrap' } },
            this.linkAssignButtons(lag, links)),
        ]));
      }
    }

    // Create LAG button — pick a peer DC that has at least one link to us
    const peerOptions = this.peerCandidates();
    if (peerOptions.length > 0) {
      const sel = h('select', { class: 'btn btn-ghost sm' });
      for (const id of peerOptions) sel.append(h('option', { value: id }, id));
      const modeSel = h('select', { class: 'btn btn-ghost sm' });
      for (const m of Object.keys(LAG_MODES)) modeSel.append(h('option', { value: m }, LAG_MODES[m].label));

      card.append(h('div', { class: 'row', style: { marginTop: '8px', gap: '6px' } }, [
        h('span', { class: 'xs muted' }, 'Peer DC:'),
        sel,
        modeSel,
        h('button', {
          class: 'btn btn-primary sm',
          onclick: () => {
            createLag(this.state, this.dc.id, sel.value, modeSel.value);
            this.render();
          },
        }, '+ LAG'),
      ]));
    }
    return card;
  }

  linkAssignButtons(lag, links) {
    // Links that are between lag.ownerDcId and lag.peerDcId and not yet in any LAG
    const candidates = links.filter(l =>
      ((l.aDcId === lag.ownerDcId && l.bDcId === lag.peerDcId) ||
       (l.aDcId === lag.peerDcId && l.bDcId === lag.ownerDcId)) &&
      !l.lagId);

    const btns = [];
    for (const l of candidates) {
      btns.push(h('button', {
        class: 'btn btn-ghost sm',
        onclick: () => { attachToLag(this.state, lag.id, l.id); this.render(); },
      }, `+ ${l.id} (${LINK_TYPES[l.typeId]?.name})`));
    }
    // Members — detach buttons
    for (const id of lag.memberLinkIds) {
      btns.push(h('button', {
        class: 'btn sm',
        style: { background: 'rgba(239,68,68,0.15)', color: '#ef4444' },
        onclick: () => { detachFromLag(this.state, id); this.render(); },
      }, `− ${id}`));
    }
    return btns;
  }

  peerCandidates() {
    const links = getLinksForDc(this.state, this.dc.id);
    const peers = new Set();
    for (const l of links) peers.add(l.aDcId === this.dc.id ? l.bDcId : l.aDcId);
    return [...peers];
  }

  renderCableSection() {
    const card = h('div', { class: 'card', style: { marginBottom: '12px' } }, [
      h('div', { class: 'card-title' }, '➕ Nový kabel mezi DC'),
    ]);
    const otherDcs = this.state.dcs.filter(d => d.id !== this.dc.id);
    if (otherDcs.length === 0) {
      card.append(h('div', { class: 'muted xs' }, 'Postav další DC a pak můžeš táhnout kabely.'));
      return card;
    }
    const dcSel = h('select', { class: 'btn btn-ghost sm' });
    for (const d of otherDcs) dcSel.append(h('option', { value: d.id }, `${d.typeId} (${d.x},${d.y})`));
    const typeSel = h('select', { class: 'btn btn-ghost sm' });
    for (const t of Object.keys(LINK_TYPES)) {
      const def = LINK_TYPES[t];
      typeSel.append(h('option', { value: t }, `${def.name} · ${def.capacityMbps/1000}G`));
    }
    card.append(h('div', { class: 'row', style: { gap: '6px', marginTop: '6px' } }, [
      h('span', { class: 'xs muted' }, 'Cíl:'), dcSel,
      h('span', { class: 'xs muted' }, 'Typ:'), typeSel,
      h('button', {
        class: 'btn btn-primary sm',
        onclick: () => {
          const r = createLink(this.state, this.dc.id, dcSel.value, typeSel.value);
          if (!r.ok) alert(r.err);
          this.render();
        },
      }, 'Položit kabel'),
    ]));
    return card;
  }

  renderRoutingSection() {
    const card = h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, '🗺️ Routovací tabulka'),
    ]);
    const others = this.state.dcs.filter(d => d.id !== this.dc.id);
    if (others.length === 0) {
      card.append(h('div', { class: 'muted xs' }, 'Žádná další DC.'));
      return card;
    }
    for (const dst of others) {
      const routes = getRoutes(this.state, this.dc.id, dst.id);
      const row = h('div', { style: { marginTop: '6px' } }, [
        h('div', { class: 'row between' }, [
          h('span', { class: 'mono xs' }, `→ ${dst.id}`),
          h('span', { class: 'xs muted' }, routes.length === 0 ? 'nedostupné' : `${routes.length} trasa/trasy`),
        ]),
      ]);
      for (const r of routes) {
        row.append(h('div', { class: 'xs mono muted', style: { paddingLeft: '12px' } },
          `${r.nodes.map(n => n.replace('dc_', '')).join(' → ')}  · ${r.capMbps.toFixed(0)} Mbps · ${r.costMs.toFixed(2)}ms`));
      }
      card.append(row);
    }
    return card;
  }
}
