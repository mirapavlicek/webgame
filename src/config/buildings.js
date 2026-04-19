// Building type catalogue — purely data, no logic.
// Rendering reads `shader` params, systems read gameplay params.

export const BUILDING_TYPES = {
  house: {
    id: 'house',
    name: 'Rodinný dům',
    icon: '🏠',
    gameplay: { cost: 0, units: [1, 4], pop: [2, 5], demand: 0.6, growth: 0.02, priceSens: 0.85 },
    shader: {
      // Procedural style parameters for the WebGL building shader
      baseHeight: 1.0,
      widthMul: 1.0,
      roofStyle: 'pitched',      // 'flat' | 'pitched' | 'spire'
      palette: [0.90, 0.88, 0.80], // warm wheat
      windowDensity: 0.25,
      windowSize: 0.12,
      accent: [0.45, 0.25, 0.18], // brick red
      neonChance: 0.0,
    },
  },
  rowhouse: {
    id: 'rowhouse',
    name: 'Řadový dům',
    icon: '🏘️',
    gameplay: { cost: 0, units: [2, 6], pop: [4, 12], demand: 0.65, growth: 0.03, priceSens: 0.8 },
    shader: {
      baseHeight: 1.2,
      widthMul: 1.4,
      roofStyle: 'flat',
      palette: [0.80, 0.70, 0.60],
      windowDensity: 0.35,
      windowSize: 0.10,
      accent: [0.35, 0.25, 0.20],
      neonChance: 0.0,
    },
  },
  panel: {
    id: 'panel',
    name: 'Panelák',
    icon: '🏢',
    gameplay: { cost: 0, units: [20, 80], pop: [40, 200], demand: 0.85, growth: 0.01, priceSens: 0.7 },
    shader: {
      baseHeight: 3.6,
      widthMul: 1.1,
      roofStyle: 'flat',
      palette: [0.70, 0.72, 0.78],
      windowDensity: 0.65,
      windowSize: 0.09,
      accent: [0.50, 0.55, 0.60],
      neonChance: 0.05,
    },
  },
  skyscraper: {
    id: 'skyscraper',
    name: 'Mrakodrap',
    icon: '🏙️',
    gameplay: { cost: 0, units: [50, 200], pop: [100, 500], demand: 0.9, growth: 0.005, priceSens: 0.5 },
    shader: {
      baseHeight: 6.0,
      widthMul: 0.9,
      roofStyle: 'spire',
      palette: [0.20, 0.30, 0.45],
      windowDensity: 0.85,
      windowSize: 0.07,
      accent: [0.15, 0.70, 0.95],
      neonChance: 0.35,
    },
  },
  shop: {
    id: 'shop',
    name: 'Obchod',
    icon: '🏪',
    gameplay: { cost: 0, units: [1, 3], pop: [2, 8], demand: 0.5, growth: 0.01, priceSens: 0.6 },
    shader: {
      baseHeight: 0.9,
      widthMul: 1.3,
      roofStyle: 'flat',
      palette: [0.95, 0.60, 0.25],
      windowDensity: 0.20,
      windowSize: 0.14,
      accent: [1.0, 0.80, 0.10],
      neonChance: 0.50,
    },
  },
  bigcorp: {
    id: 'bigcorp',
    name: 'Velká firma',
    icon: '🏬',
    gameplay: { cost: 0, units: [10, 50], pop: [20, 150], demand: 0.95, growth: 0.01, priceSens: 0.15 },
    shader: {
      baseHeight: 3.2,
      widthMul: 1.6,
      roofStyle: 'flat',
      palette: [0.18, 0.20, 0.28],
      windowDensity: 0.75,
      windowSize: 0.10,
      accent: [0.90, 0.30, 0.90],
      neonChance: 0.45,
    },
  },
  factory: {
    id: 'factory',
    name: 'Průmysl',
    icon: '🏭',
    gameplay: { cost: 0, units: [5, 20], pop: [10, 60], demand: 0.55, growth: 0.005, priceSens: 0.30 },
    shader: {
      baseHeight: 1.8,
      widthMul: 2.0,
      roofStyle: 'flat',
      palette: [0.40, 0.35, 0.30],
      windowDensity: 0.30,
      windowSize: 0.08,
      accent: [0.80, 0.25, 0.05],
      neonChance: 0.10,
    },
  },
  public: {
    id: 'public',
    name: 'Veřejná budova',
    icon: '🏫',
    gameplay: { cost: 0, units: [5, 30], pop: [10, 80], demand: 0.80, growth: 0.01, priceSens: 0.40 },
    shader: {
      baseHeight: 2.4,
      widthMul: 1.7,
      roofStyle: 'pitched',
      palette: [0.85, 0.75, 0.55],
      windowDensity: 0.55,
      windowSize: 0.12,
      accent: [0.80, 0.20, 0.40],
      neonChance: 0.05,
    },
  },
};

export const BUILDING_IDS = Object.keys(BUILDING_TYPES);

// Deterministic RNG seed per building cell — used by the shader to vary
// windows and accent positions without being fully random.
export function buildingSeed(x, y, typeId) {
  const hash = (x * 73856093) ^ (y * 19349663) ^ (typeId.charCodeAt(0) * 83492791);
  return (hash >>> 0) / 0xffffffff;
}
