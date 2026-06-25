// ====== SMOOTH CAMERA ======
// Plynulá kamera s tlumeným dojezdem (easing), klávesovým posouváním
// (WASD / šipky), setrvačností po tažení a animovaným zoomem.
//
// `cam` (aktuální, vykreslovaný stav) je deklarován v input.js.
// Tady přidáváme `camTarget` (cíl, ke kterému se cam plynule blíží),
// sadu stisknutých kláves a pomocné funkce. Vykreslovací smyčka v main.js
// volá `updateCamera(dt)` jednou za snímek — to je jediné místo, kde se
// `cam` mění směrem k cíli.

let camTarget = { x: 0, y: 0, zoom: 1 };
const camKeys = new Set();        // aktuálně držené posouvací klávesy
let camInertia = { x: 0, y: 0 };  // setrvačnost po puštění tažení (px/s ve screen space)
let camDragVel = { x: 0, y: 0 };  // odhad rychlosti během tažení
let camAnimEnabled = true;        // lze vypnout pro deterministické testy

const CAM_PAN_SPEED = 900;        // rychlost klávesového posouvání (screen px/s)
const CAM_EASE_TAU = 90;          // časová konstanta dojezdu v ms (menší = svižnější)
const CAM_INERTIA_FRICTION = 0.0045; // útlum setrvačnosti za ms
const CAM_ZOOM_MIN = 0.15, CAM_ZOOM_MAX = 6;

// Zkopíruje aktuální cam do cíle (po přímé manipulaci — tažení, atd.),
// aby ho dojezd hned nevracel zpět.
function syncCamTarget() {
  camTarget.x = cam.x; camTarget.y = cam.y; camTarget.zoom = cam.zoom;
  camInertia.x = 0; camInertia.y = 0;
}

// Mapování klávesy → směr posunu cíle. Vrací {dx,dy} v "jednotkách směru".
// Posouváme šipkami — písmena W/A/S/D jsou obsazená stavebními zkratkami
// (c/f/d/x), takže by kolidovala.
function camKeyDir(keys) {
  let dx = 0, dy = 0;
  if (keys.has('arrowup'))    dy += 1;
  if (keys.has('arrowdown'))  dy -= 1;
  if (keys.has('arrowleft'))  dx += 1;
  if (keys.has('arrowright')) dx -= 1;
  return { dx, dy };
}

// Pure: posune cíl podle držených kláves. dt v ms. Vrací nový cíl (mutuje).
function camApplyKeys(target, keys, dt) {
  const { dx, dy } = camKeyDir(keys);
  if (dx === 0 && dy === 0) return target;
  // normalizace diagonály
  const len = Math.hypot(dx, dy) || 1;
  const step = CAM_PAN_SPEED * (dt / 1000);
  target.x += (dx / len) * step;
  target.y += (dy / len) * step;
  return target;
}

// Pure: jeden krok exponenciálního dojezdu cam → target. dt v ms. Mutuje cam.
function camEaseStep(c, target, dt) {
  // k = 1 - e^(-dt/tau): frame-rate nezávislé tlumení
  const k = 1 - Math.exp(-dt / CAM_EASE_TAU);
  c.x += (target.x - c.x) * k;
  c.y += (target.y - c.y) * k;
  c.zoom += (target.zoom - c.zoom) * k;
  // přichycení na cíl, aby float nikdy neprokmital donekonečna
  if (Math.abs(target.x - c.x) < 0.05) c.x = target.x;
  if (Math.abs(target.y - c.y) < 0.05) c.y = target.y;
  if (Math.abs(target.zoom - c.zoom) < 0.0005) c.zoom = target.zoom;
  return c;
}

// Pure: aplikuje a utlumí setrvačnost. Mutuje target i inertia. dt v ms.
function camApplyInertia(target, inertia, dt) {
  if (Math.abs(inertia.x) < 1 && Math.abs(inertia.y) < 1) {
    inertia.x = 0; inertia.y = 0; return target;
  }
  target.x += inertia.x * (dt / 1000);
  target.y += inertia.y * (dt / 1000);
  const decay = Math.exp(-CAM_INERTIA_FRICTION * dt);
  inertia.x *= decay; inertia.y *= decay;
  return target;
}

// Zoom k pevnému bodu na obrazovce (fx,fy). Upraví camTarget tak, aby bod
// pod kurzorem zůstal po zoomu na místě. immediate=true přepíše i cam.
function camZoomTo(newZoom, fx, fy, immediate) {
  newZoom = Math.max(CAM_ZOOM_MIN, Math.min(CAM_ZOOM_MAX, newZoom));
  const oz = camTarget.zoom || 1;
  // world bod pod (fx,fy) vůči cíli
  camTarget.x = fx - (fx - camTarget.x) * (newZoom / oz);
  camTarget.y = fy - (fy - camTarget.y) * (newZoom / oz);
  camTarget.zoom = newZoom;
  if (immediate || !camAnimEnabled) {
    cam.x = camTarget.x; cam.y = camTarget.y; cam.zoom = camTarget.zoom;
  }
}

// Vycentruje kameru na dlaždici (tileX,tileY) — animovaně.
function camCenterOn(tileX, tileY) {
  if (typeof canvas === 'undefined' || !canvas) return;
  const iso = toIso(tileX, tileY);
  camTarget.x = canvas.width / 2 - iso.x * camTarget.zoom;
  camTarget.y = canvas.height / 2 - iso.y * camTarget.zoom;
  camInertia.x = 0; camInertia.y = 0;
  if (!camAnimEnabled) { cam.x = camTarget.x; cam.y = camTarget.y; }
}

// Hlavní per-frame update — volán z gameLoop. dt v ms.
function updateCamera(dt) {
  if (typeof cam === 'undefined' || !cam) return;
  if (!camAnimEnabled) return;
  dt = Math.max(0, Math.min(dt || 16, 100)); // ořež dlouhé pauzy (přepnutí tabu)
  if (drag) {
    // během aktivního tažení nic neeasuje — cam sleduje myš 1:1 (řeší input.js)
    syncCamTarget();
    return;
  }
  camApplyKeys(camTarget, camKeys, dt);
  // setrvačnost běží jen když hráč nedrží klávesy
  if (camKeys.size === 0) camApplyInertia(camTarget, camInertia, dt);
  else { camInertia.x = 0; camInertia.y = 0; }
  camEaseStep(cam, camTarget, dt);
}

// Zaregistruje klávesy pro posouvání. Volá se z initInput().
function initCameraKeys() {
  const PAN_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
  document.addEventListener('keydown', e => {
    if (!G) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (PAN_KEYS.has(k)) { camKeys.add(k); camInertia.x = 0; camInertia.y = 0; e.preventDefault(); }
  });
  document.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (camKeys.has(k)) camKeys.delete(k);
  });
  // při ztrátě fokusu okna uvolni všechny klávesy (jinak by kamera ujížděla)
  window.addEventListener('blur', () => camKeys.clear());
}

// Export pro node testy (vm/CommonJS) — v prohlížeči je module undefined.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    camKeyDir, camApplyKeys, camEaseStep, camApplyInertia,
    CAM_PAN_SPEED, CAM_EASE_TAU,
  };
}
