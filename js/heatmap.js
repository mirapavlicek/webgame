// ====== HEATMAP OVERLAY ======
// 3 módy + off:
//   'coverage'      — tile po tile: pokrytí wifi/tower/DC (zeleně teplé), mimo dosah červeně
//   'utilization'   — kabelové segmenty barevně podle segLoads (segLoads už máme z capacity.js)
//   'satisfaction'  — budovy podle b.sat (0-100)
//
// Přepínání kolečka: off → coverage → utilization → satisfaction → off
// State je uložený v G.heatmapMode (persistuje v saveu).

let heatmapMode = null;  // cache mimo G pro případ, že G ještě neexistuje

const HEATMAP_MODES = [null, 'coverage', 'utilization', 'satisfaction'];
const HEATMAP_LABELS = {
  null: '',
  'coverage': '📶 Pokrytí',
  'utilization': '🔥 Utilizace',
  'satisfaction': '😊 Spokojenost'
};

function cycleHeatmap(){
  if(!G){heatmapMode = null; return;}
  const cur = G.heatmapMode || null;
  const idx = HEATMAP_MODES.indexOf(cur);
  const next = HEATMAP_MODES[(idx+1) % HEATMAP_MODES.length];
  G.heatmapMode = next;
  heatmapMode = next;
  updateHeatmapButton();
  const lbl = HEATMAP_LABELS[next] || 'vypnuto';
  if(typeof notify==='function') notify(`🌡️ Heatmap: ${next?lbl:'vypnuto'}`, 'info');
}

function updateHeatmapButton(){
  const b = document.getElementById('btnHeatmap');
  if(!b) return;
  const mode = (G && G.heatmapMode) || null;
  b.classList.toggle('active', !!mode);
  b.style.background = mode ? '#f59e0b' : '';
  b.style.color = mode ? '#0e1a2b' : '';
  b.title = mode ? `Heatmap: ${HEATMAP_LABELS[mode]} (klikni pro další)` : 'Heatmap: vypnuto (klikni pro zapnutí)';
}

// Výpočet barvy pro tile v coverage módu
function heatmapCoverageColor(x, y){
  const tile = G.map[y] && G.map[y][x];
  if(!tile) return null;
  let bestRange = 0;
  let bestType = null;
  // Tower coverage?
  for(const tw of (G.towers||[])){
    const tt = (typeof TOWER_T!=='undefined') ? TOWER_T[tw.type] : null;
    if(!tt) continue;
    const d = Math.abs(tw.x-x) + Math.abs(tw.y-y);
    if(d <= tt.range){
      const q = 1 - (d / Math.max(1, tt.range));
      if(q > bestRange){bestRange = q; bestType = 'tower';}
    }
  }
  // WiFi coverage?
  for(const ap of (G.wifiAPs||[])){
    const wt = (typeof WIFI_T!=='undefined') ? WIFI_T[ap.type] : null;
    if(!wt) continue;
    const dx = ap.x-x, dy = ap.y-y;
    const d = Math.sqrt(dx*dx+dy*dy);
    if(d <= wt.range){
      const q = 1 - (d / Math.max(1, wt.range));
      if(q > bestRange){bestRange = q; bestType = 'wifi';}
    }
  }
  // DC blízkost (jen pro vzdálenost, ukazuje "blízko infrastruktury")
  for(const dc of G.dcs){
    const d = Math.abs(dc.x-x) + Math.abs(dc.y-y);
    if(d <= 10){
      const q = (1 - d/10) * 0.7;   // DC nedává signál, jen "centralita"
      if(q > bestRange){bestRange = q; bestType = 'dc';}
    }
  }
  if(bestRange <= 0){
    // Mimo pokrytí: červená jen pokud je tam budova
    if(tile.bld) return `rgba(239,68,68,0.28)`;
    return null;
  }
  // Zeleně teplé do žlutozelené
  const g = 180 + Math.round(60 * bestRange);
  const r = 40 + Math.round(120 * (1-bestRange));
  const a = 0.18 + bestRange * 0.22;
  return `rgba(${r},${g},80,${a.toFixed(3)})`;
}

function heatmapUtilColor(x, y){
  // Utilizace se zobrazuje jen na silnicích, které mají segLoad
  const tile = G.map[y] && G.map[y][x];
  if(!tile || tile.type !== 'road') return null;
  if(typeof segLoads === 'undefined' || !segLoads) return null;
  // Najdi nejvyšší ratio pro libovolný segment dotýkající se této dlaždice
  let m = 0;
  for(const [ax,ay] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
    if(ax<0||ax>=MAP||ay<0||ay>=MAP) continue;
    if(G.map[ay][ax].type !== 'road') continue;
    const k1 = (typeof segKey==='function') ? segKey(x,y,ax,ay) : `${x},${y}-${ax},${ay}`;
    const l = segLoads[k1];
    if(l && l.ratio > m) m = l.ratio;
  }
  if(m <= 0.02) return null;
  // 0 → zelená, 0.5 → žlutá, 1 → červená
  let r, g, b;
  if(m < 0.5){
    const t = m/0.5; r = Math.round(80 + t*180); g = 200; b = 80;
  } else {
    const t = (m-0.5)/0.5; r = 255; g = Math.round(200 - t*160); b = 60;
  }
  const a = 0.28 + m * 0.35;
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

function heatmapSatColor(x, y){
  const tile = G.map[y] && G.map[y][x];
  if(!tile || !tile.bld || !tile.bld.connected) return null;
  const s = Math.max(0, Math.min(100, tile.bld.sat || 0));
  // 0 → červená, 50 → oranžová, 100 → zelená
  let r, g, b;
  if(s < 50){
    const t = s/50; r = 255; g = Math.round(60 + t*150); b = 60;
  } else {
    const t = (s-50)/50; r = Math.round(255 - t*195); g = 210; b = Math.round(60 + t*60);
  }
  const a = 0.35;
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

// Hlavní entry-point volaný z render.js
function drawHeatmapOverlay(x0, y0, x1, y1){
  if(!G || !G.heatmapMode) return;
  const mode = G.heatmapMode;
  const colorFn = mode === 'coverage' ? heatmapCoverageColor
                : mode === 'utilization' ? heatmapUtilColor
                : mode === 'satisfaction' ? heatmapSatColor
                : null;
  if(!colorFn) return;

  ctx.save();
  // Kreslíme přes diamond tile-shape, aby to respektovalo iso mřížku
  for(let y=y0; y<=y1; y++){
    for(let x=x0; x<=x1; x++){
      const c = colorFn(x,y);
      if(!c) continue;
      const s = toScr(x,y);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y-TH/2);
      ctx.lineTo(s.x+TW/2, s.y);
      ctx.lineTo(s.x, s.y+TH/2);
      ctx.lineTo(s.x-TW/2, s.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Render legendy v pravém dolním rohu gameCanvasu (ve world-space to ne)
  ctx.restore();
  drawHeatmapLegend(mode);
}

function drawHeatmapLegend(mode){
  if(!canvas) return;
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  const lw = 180, lh = 56, pad = 12;
  const lx = canvas.width - lw - 16, ly = canvas.height - lh - 16;
  ctx.fillStyle = 'rgba(14,26,43,0.88)';
  ctx.strokeStyle = 'rgba(148,163,184,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(lx, ly, lw, lh, 8);
  else ctx.rect(lx, ly, lw, lh);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(HEATMAP_LABELS[mode] || '', lx + pad, ly + 18);

  // Gradient stripe
  const gx = lx + pad, gy = ly + 26, gw = lw - pad*2, gh = 10;
  const grad = ctx.createLinearGradient(gx, gy, gx+gw, gy);
  if(mode === 'coverage'){
    grad.addColorStop(0, 'rgba(239,68,68,0.6)');
    grad.addColorStop(0.5, 'rgba(245,158,11,0.6)');
    grad.addColorStop(1, 'rgba(34,197,94,0.75)');
  } else if(mode === 'utilization'){
    grad.addColorStop(0, 'rgba(34,197,94,0.75)');
    grad.addColorStop(0.5, 'rgba(245,158,11,0.75)');
    grad.addColorStop(1, 'rgba(239,68,68,0.75)');
  } else {
    grad.addColorStop(0, 'rgba(239,68,68,0.7)');
    grad.addColorStop(0.5, 'rgba(245,158,11,0.7)');
    grad.addColorStop(1, 'rgba(34,197,94,0.8)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(gx, gy, gw, gh);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px system-ui, sans-serif';
  const labels = mode === 'coverage' ? ['mimo','pokryto']
               : mode === 'utilization' ? ['volno','přetížení']
               : ['naštvaní','spokojení'];
  ctx.textAlign = 'left';
  ctx.fillText(labels[0], gx, ly + lh - 4);
  ctx.textAlign = 'right';
  ctx.fillText(labels[1], gx + gw, ly + lh - 4);
  ctx.restore();
}

// Sync stavu při startu (volané z main.js po načtení hry)
function initHeatmap(){
  if(G && G.heatmapMode) heatmapMode = G.heatmapMode;
  updateHeatmapButton();
}
