// ====== SPRITE CACHE (atlas-lite) ======
// Pre-renderuje statické části budov (3 iso-fasády) do off-screen canvasů.
// Cíl: ušetřit ~40% ctx volání v render-hot-path tím, že se body budovy blitne
// jedním drawImage místo desítek fillPath/stroke.
//
// Bezpečnost: pokud cache není postavená nebo `G.spriteCacheEnabled` je false,
// render.js používá původní inline cestu — nic se nerozbije. Cache je opt-in.
//
// Použití z render.js (volitelné):
//   if(window.spriteCacheReady && G.spriteCacheEnabled && BLD_SPRITES[b.type]){
//     blitBuildingBody(x,y,b.type);
//     // ... pak kreslit pouze dynamické překryvy (okna, AC, signály)
//   } else {
//     // původní kód drawBld
//   }

let spriteCacheReady = false;
const BLD_SPRITES = {};       // { type: { canvas, ox, oy, w, h } }
const TILE_SPRITES = {};      // { 'grass_0'..'grass_3','road','water','park': canvas }

// Utility — redraw 3 fasády do target ctx na zadané pozici sx,sy (pozice "nohy" tile)
function paintBuildingBody(tctx, sx, sy, bt){
  const hw = TW/2 - 6, h = bt.h;
  const baseColor = bt.clr;
  const topE = sy - h;
  const topY = sy - h - TH/2 + 2;

  // Left face
  tctx.beginPath();
  tctx.moveTo(sx - hw, sy);
  tctx.lineTo(sx, sy + TH/2 - 2);
  tctx.lineTo(sx, sy + TH/2 - 2 - h);
  tctx.lineTo(sx - hw, topE);
  tctx.closePath();
  tctx.fillStyle = (typeof shade==='function') ? shade(baseColor, -15) : baseColor;
  tctx.fill();

  // Right face
  tctx.beginPath();
  tctx.moveTo(sx + hw, sy);
  tctx.lineTo(sx, sy + TH/2 - 2);
  tctx.lineTo(sx, sy + TH/2 - 2 - h);
  tctx.lineTo(sx + hw, topE);
  tctx.closePath();
  tctx.fillStyle = (typeof shade==='function') ? shade(baseColor, -30) : baseColor;
  tctx.fill();

  // Top face
  tctx.beginPath();
  tctx.moveTo(sx, topY);
  tctx.lineTo(sx + hw, topE);
  tctx.lineTo(sx, sy + TH/2 - 2 - h);
  tctx.lineTo(sx - hw, topE);
  tctx.closePath();
  tctx.fillStyle = (typeof shade==='function') ? shade(baseColor, 15) : baseColor;
  tctx.fill();

  // Ambient occlusion along base
  tctx.strokeStyle = 'rgba(0,0,0,.28)';
  tctx.lineWidth = 1;
  tctx.beginPath();
  tctx.moveTo(sx - hw + 1, sy - .5);
  tctx.lineTo(sx, sy + TH/2 - 2.5);
  tctx.lineTo(sx + hw - 1, sy - .5);
  tctx.stroke();

  // Corner vertical highlight
  tctx.strokeStyle = 'rgba(255,255,255,.1)';
  tctx.lineWidth = .6;
  tctx.beginPath();
  tctx.moveTo(sx, sy + TH/2 - 2);
  tctx.lineTo(sx, sy + TH/2 - 2 - h);
  tctx.stroke();

  // Top edges highlight
  tctx.strokeStyle = 'rgba(255,255,255,.12)';
  tctx.lineWidth = .6;
  tctx.beginPath();
  tctx.moveTo(sx, topY);
  tctx.lineTo(sx + hw, topE);
  tctx.stroke();
  tctx.beginPath();
  tctx.moveTo(sx, topY);
  tctx.lineTo(sx - hw, topE);
  tctx.stroke();
}

// Postaví kešové canvasy pro všechny BTYPES. Cheap — jednorázové na start.
function buildSpriteCache(){
  if(typeof BTYPES === 'undefined') return;
  spriteCacheReady = false;
  for(const type in BTYPES){
    const bt = BTYPES[type];
    if(!bt || bt.h === undefined) continue;
    const padX = 4, padY = 4;
    const w = TW + padX * 2;
    const h = bt.h + TH + padY * 2;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w);
    cv.height = Math.ceil(h);
    const c = cv.getContext('2d');
    // "Foot" pozice budovy uvnitř canvasu: centr vodorovně, spodek s pad-em zespod
    const footX = cv.width / 2;
    const footY = cv.height - padY - TH/2;
    paintBuildingBody(c, footX, footY, bt);
    BLD_SPRITES[type] = {
      canvas: cv,
      ox: footX,            // offset, který má být vyrovnán s s.x
      oy: footY,            // offset s s.y
      w: cv.width,
      h: cv.height
    };
  }
  spriteCacheReady = true;
  window.spriteCacheReady = true;
  console.log('[sprite-cache] built sprites for', Object.keys(BLD_SPRITES).length, 'building types');
}

// Blit tělo budovy z cache. Ošetřuje fallback.
function blitBuildingBody(x, y, type){
  const sp = BLD_SPRITES[type];
  if(!sp){
    // Fallback: přímo nakresli (nemělo by nastat)
    const bt = BTYPES[type]; if(!bt) return false;
    const s = toScr(x,y);
    paintBuildingBody(ctx, s.x, s.y, bt);
    return true;
  }
  const s = toScr(x,y);
  // drawImage s origin posunutým, aby (footX,footY) v sprite padlo na s.x,s.y
  ctx.drawImage(sp.canvas, s.x - sp.ox, s.y - sp.oy);
  return true;
}

// Rebuild sprite cache po změně velikosti/fontu (např. po zoom — zbytečné,
// ale necháváme public API).
function invalidateSpriteCache(){
  spriteCacheReady = false;
  window.spriteCacheReady = false;
  for(const k in BLD_SPRITES) delete BLD_SPRITES[k];
  for(const k in TILE_SPRITES) delete TILE_SPRITES[k];
}

// Export pro debug
window.BLD_SPRITES = BLD_SPRITES;
window.buildSpriteCache = buildSpriteCache;
window.blitBuildingBody = blitBuildingBody;
window.invalidateSpriteCache = invalidateSpriteCache;
