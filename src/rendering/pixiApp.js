// PixiJS application setup — used only for building rendering + glow overlay.
// Terrain stays on Canvas2D so we don't have to reimplement the iso grid in WebGL.

let pixiApp = null;
let buildingLayer = null;
let glowLayer = null;

export function initPixi(canvas) {
  if (!window.PIXI) {
    console.warn('PIXI not loaded');
    return null;
  }
  const PIXI = window.PIXI;
  pixiApp = new PIXI.Application({
    view: canvas,
    resizeTo: canvas.parentElement,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });
  buildingLayer = new PIXI.Container();
  glowLayer = new PIXI.Container();
  pixiApp.stage.addChild(buildingLayer);
  pixiApp.stage.addChild(glowLayer);

  // Optional bloom on glowLayer if filters are loaded
  try {
    const F = PIXI.filters || window.__PIXI_FILTERS__;
    const BloomCls = F?.AdvancedBloomFilter || F?.BloomFilter;
    if (BloomCls) {
      const bloom = new BloomCls({ threshold: 0.35, bloomScale: 1.3, blur: 8, quality: 6 });
      glowLayer.filters = [bloom];
    }
  } catch (e) { /* no bloom available */ }

  return pixiApp;
}

export function getPixi() { return { app: pixiApp, buildingLayer, glowLayer }; }

export function clearPixiLayers() {
  buildingLayer?.removeChildren();
  glowLayer?.removeChildren();
}
