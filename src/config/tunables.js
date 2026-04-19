// Core game tunables — single source of truth for constants
// everything numeric that may ever be balanced lives here

export const WORLD = {
  MAP_SIZE: 40,          // tiles per side
  TILE_W: 64,             // iso tile width
  TILE_H: 32,             // iso tile height (half of W by iso convention)
};

export const TIME = {
  // 1 real second = REAL_PER_DAY_BASE game days at speed 1
  DAYS_PER_SECOND_BASE: 0.33,
  SPEED_STEPS: [0, 1, 2, 4, 8],   // 0 = paused
  START_YEAR: 2005,
};

export const ECONOMY = {
  STARTING_CASH: 500_000,
  MONTHLY_OVERHEAD: 5_000,
};

export const RENDER = {
  // Zoom bounds
  MIN_ZOOM: 0.2,
  MAX_ZOOM: 5,
  DEFAULT_ZOOM: 1,
  // Day/night — progress across a month drives the tint cycle
  NIGHT_RGB: [0.04, 0.06, 0.14],
  DAY_RGB:   [1.0, 1.0, 1.0],
};

// Tariff / connection / DC catalogues are in separate modules that import
// from here if they need base values.
