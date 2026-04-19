// Central game state — one big object, but constructed by modules.
// All systems read/write through this. Clean schema, no legacy migrations.

import { WORLD, TIME, ECONOMY } from '../config/tunables.js';
import { generateWorld } from '../systems/world.js';
import { emptyNetwork } from '../systems/links.js';

export function createGameState(playerName) {
  return {
    // Meta
    name: playerName || 'NetTycoon',
    version: 2,
    createdAt: Date.now(),

    // Time
    date: { y: TIME.START_YEAR, m: 0, d: 1 },
    speed: 1,
    paused: false,
    tickAccumulator: 0,

    // Economy
    cash: ECONOMY.STARTING_CASH,
    monthlyIncome: 0,
    monthlyExpense: 0,
    loans: [],
    creditRating: 'BBB',
    incomeHistory: [],
    expenseHistory: [],

    // World
    world: generateWorld(WORLD.MAP_SIZE),
    dcs: [],
    buildings: [],     // flat list for fast iteration — also referenced from world.tiles[].bld

    // Networking — physical links, LAGs, MLAG domains, routing tables
    network: emptyNetwork(),
    routing: { tables: {}, lastComputed: 0 },

    // Staff
    staff: {
      tech: { count: 0, morale: 80, xp: 0, level: 1 },
      support: { count: 0, morale: 80, xp: 0, level: 1 },
      sales: { count: 0, morale: 80, xp: 0, level: 1 },
      noc: { count: 0, morale: 80, xp: 0, level: 1 },
      dev: { count: 0, morale: 80, xp: 0, level: 1 },
    },
    trainingBudget: 0,

    // Incidents
    incidents: [],
    incidentHistory: [],
    incidentLearnings: {},

    // Competitors
    competitors: [],
    cartelRisk: 0,
    takeoverOffers: [],

    // UI ephemeral
    ui: {
      tool: 'select',           // 'select' | 'dc' | 'cable' | 'delete' | 'building-<type>'
      camera: { x: 0, y: 0, zoom: 1 },
      hoverTile: null,
      panels: { stats: true, finance: true, incidents: true, staff: false },
      notifications: [],        // ring-buffered feed
    },
  };
}
