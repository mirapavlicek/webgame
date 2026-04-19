// Tiny synchronous pub/sub. Systems emit, UI listens.
// Keep it dumb — no wildcards, no async, no priority.

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => off(event, fn);
}

export function off(event, fn) {
  listeners.get(event)?.delete(fn);
}

export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of set) {
    try { fn(payload); } catch (e) { console.error(`[eventBus] ${event} handler failed:`, e); }
  }
}

// Common event names — exported as constants so typos fail loudly.
export const EV = {
  TICK:               'tick',
  DAY:                'day',
  MONTH:              'month',
  YEAR:               'year',
  CASH_CHANGED:       'cash.changed',
  BUILDING_PLACED:    'building.placed',
  DC_PLACED:          'dc.placed',
  CABLE_PLACED:       'cable.placed',
  NOTIFICATION:       'notif',
  INCIDENT_OPENED:    'incident.opened',
  INCIDENT_RESOLVED:  'incident.resolved',
  LOAN_TAKEN:         'loan.taken',
  UI_DIRTY:           'ui.dirty',
  TOOL_CHANGED:       'tool.changed',
};
