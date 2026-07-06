// ====== VÝKON / FPS CAP ======
// Hra překreslovala celý Canvas 2D při každém snímku requestAnimationFrame —
// na 120Hz ProMotion displejích to je 120 plných redrawů/s, což zbytečně žere
// CPU. Simulace i vizuál pro tycoon hru pohodlně stačí na ~40 FPS. Oddělíme
// tedy kadenci vykreslování od RAF a překreslujeme jen v cílovém intervalu.
// GPU vrstva (PixiJS glow/particles) běží ve stejném rytmu — víc práce tak
// zůstává na GPU a méně na CPU.

let _perf = {
  targetFps: 40,      // cílová snímková frekvence vykreslování
  lastRenderTs: 0,    // čas posledního renderu (ms)
};

// Pure: má se v čase `now` (ms) překreslit, když poslední render byl v `last`
// a minimální interval mezi snímky je `minInterval` ms?
function shouldRenderFrame(now, last, minInterval){
  return (now - last) >= minInterval;
}

// Minimální interval mezi snímky pro aktuální cílové FPS (ms).
function perfMinInterval(){
  const fps = (_perf.targetFps > 0) ? _perf.targetFps : 40;
  return 1000 / fps;
}

// Nastaví cílové FPS (15–120). Nižší = méně CPU.
function setTargetFps(f){
  _perf.targetFps = Math.max(15, Math.min(120, Math.round(f || 40)));
  if(typeof notify === 'function') notify(`🎚️ Cílové FPS: ${_perf.targetFps}`, '');
  return _perf.targetFps;
}
function getTargetFps(){ return _perf.targetFps; }

if(typeof module !== 'undefined' && module.exports){
  module.exports = { shouldRenderFrame, perfMinInterval, setTargetFps, getTargetFps };
}
if(typeof window !== 'undefined'){
  window.setTargetFps = setTargetFps;
}
