// Incidents (P1..P4) with response actions.

import { emit, EV, on } from '../core/eventBus.js';

export const CAUSES = {
  power:     { label: 'Výpadek proudu', weight: 0.20 },
  cooling:   { label: 'Přehřátí',       weight: 0.15 },
  network:   { label: 'Síťová porucha', weight: 0.25 },
  security:  { label: 'Bezpečnostní incident', weight: 0.10 },
  cable:     { label: 'Přerušený kabel',  weight: 0.20 },
  ransomware:{ label: 'Ransomware',       weight: 0.10 },
};

export const SEVERITY = {
  P4: { name: 'Nízká',     durationDays: 2,  baseCost: 2_000,  chance: 0.60 },
  P3: { name: 'Střední',   durationDays: 4,  baseCost: 8_000,  chance: 0.25 },
  P2: { name: 'Vysoká',    durationDays: 7,  baseCost: 25_000, chance: 0.12 },
  P1: { name: 'Kritická',  durationDays: 14, baseCost: 90_000, chance: 0.03 },
};

export function installIncidents(state) {
  on(EV.DAY, () => dailyTick(state));
  on(EV.MONTH, () => maybeRoll(state));
}

function rollSeverity() {
  const r = Math.random();
  let acc = 0;
  for (const [k, v] of Object.entries(SEVERITY)) {
    acc += v.chance;
    if (r <= acc) return k;
  }
  return 'P4';
}

function rollCause() {
  const r = Math.random();
  let acc = 0;
  for (const [k, v] of Object.entries(CAUSES)) {
    acc += v.weight;
    if (r <= acc) return k;
  }
  return 'power';
}

export function spawnIncident(state, dcIdx) {
  const dc = state.dcs[dcIdx];
  if (!dc) return null;
  const sev = rollSeverity();
  const cause = rollCause();
  const def = SEVERITY[sev];

  const learningLevel = state.incidentLearnings[cause] || 0;
  const durationMul = Math.max(0.4, 1 - learningLevel * 0.08);

  const inc = {
    id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    dcId: dc.id,
    severity: sev,
    cause,
    daysLeft: def.durationDays * durationMul,
    cost: def.baseCost,
    startedAt: { ...state.date },
  };
  state.incidents.push(inc);
  emit(EV.INCIDENT_OPENED, { state, inc });
  emit(EV.NOTIFICATION, {
    level: sev === 'P1' || sev === 'P2' ? 'bad' : 'warn',
    icon: '⚠️',
    text: `${sev} ${CAUSES[cause].label} — ${dc.typeId.toUpperCase()} DC`,
  });
  return inc;
}

export function respond(state, incId, action) {
  const inc = state.incidents.find(i => i.id === incId);
  if (!inc) return false;
  const cost = { triage: 2_000, dispatch: 8_000, overtime: 15_000, failover: 25_000 }[action] || 0;
  if (state.cash < cost) return false;
  state.cash -= cost;
  const remedy = { triage: 0.15, dispatch: 0.4, overtime: 0.5, failover: 0.75 }[action] || 0;
  inc.daysLeft = Math.max(0.5, inc.daysLeft * (1 - remedy));
  emit(EV.CASH_CHANGED, state);
  return true;
}

function dailyTick(state) {
  for (const inc of state.incidents) {
    inc.daysLeft -= 1;
  }
  const resolved = state.incidents.filter(i => i.daysLeft <= 0);
  for (const r of resolved) {
    state.incidentHistory.push(r);
    state.incidentLearnings[r.cause] = (state.incidentLearnings[r.cause] || 0) + 1;
    emit(EV.INCIDENT_RESOLVED, { state, inc: r });
  }
  state.incidents = state.incidents.filter(i => i.daysLeft > 0);
}

function maybeRoll(state) {
  for (let i = 0; i < state.dcs.length; i++) {
    if (Math.random() < 0.03) spawnIncident(state, i);
  }
}
