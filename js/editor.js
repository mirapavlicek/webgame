// ====== SANDBOX EDITOR ======
// Volný editor mapy ve 2D izometrii: malování terénu (tráva/silnice/voda/park),
// pokládání a bourání budov — bez peněz, bez omezení. Užitečné pro tvorbu
// vlastních map a rychlé experimenty. Čas se v editoru pozastaví.
//
// Návrh: čisté funkce operující nad `map` polem (nezávislé na G) jsou
// testovatelné; tenká integrační vrstva je napojuje na herní stav a vstup.

const EDITOR_TERRAIN = ['grass', 'road', 'water', 'park'];

// Pure: nastaví typ dlaždice. Při přechodu na ne-trávu smaže budovu (na silnici
// / vodě / parku nelze mít dům). Vrací true když se něco změnilo.
function editorSetTile(map, x, y, type, mapSize){
  if(!map || x < 0 || y < 0 || x >= mapSize || y >= mapSize) return false;
  if(EDITOR_TERRAIN.indexOf(type) < 0) return false;
  const t = map[y][x];
  if(!t) return false;
  t.type = type;
  if(type !== 'grass'){ t.bld = null; }
  if(type === 'grass' && (t.variant == null)) t.variant = 0;
  return true;
}

// Pure: sestaví objekt budovy s deterministickými (středními) hodnotami —
// vhodné pro editor (žádná náhoda → testovatelné a reprodukovatelné).
function editorMakeBuilding(btype, BTYPES){
  const b = BTYPES && BTYPES[btype];
  if(!b) return null;
  const units = Math.round((b.units[0] + b.units[1]) / 2);
  const pop = Math.round((b.pop[0] + b.pop[1]) / 2);
  return {
    type: btype, units, pop, maxPop: Math.round(pop * 1.5),
    connected: false, connType: null, customers: 0, sat: 0,
    tariff: null, want: true, dcIdx: -1, svcSubs: {}
  };
}

// Pure: položí budovu na dlaždici. Vyžaduje trávu bez budovy. Vrací true/false.
function editorPlaceBuilding(map, x, y, btype, mapSize, BTYPES){
  if(!map || x < 0 || y < 0 || x >= mapSize || y >= mapSize) return false;
  const t = map[y][x];
  if(!t || t.type !== 'grass' || t.bld || t.annex) return false;
  const b = editorMakeBuilding(btype, BTYPES);
  if(!b) return false;
  t.bld = b;
  return true;
}

// Pure: srovná dlaždici na trávu bez budovy. Vrací true když se něco změnilo.
function editorBulldoze(map, x, y, mapSize){
  if(!map || x < 0 || y < 0 || x >= mapSize || y >= mapSize) return false;
  const t = map[y][x];
  if(!t) return false;
  const had = t.bld || t.annex || t.type !== 'grass';
  // Multi-tile budova: bourání kterékoli dlaždice odstraní celý závod
  // (anchor + všechny annex značky ukazující na něj).
  let ax = null, ay = null;
  if(t.annex){ ax = t.annex.ax; ay = t.annex.ay; }
  else if(t.bld){ ax = x; ay = y; }
  if(ax != null){
    if(map[ay] && map[ay][ax]) map[ay][ax].bld = null;
    for(let yy = 0; yy < mapSize; yy++)for(let xx = 0; xx < mapSize; xx++){
      const tt = map[yy][xx];
      if(tt && tt.annex && tt.annex.ax === ax && tt.annex.ay === ay){ tt.annex = null; tt.bld = null; if(tt.type !== 'water' && tt.type !== 'road') tt.type = 'grass'; }
    }
  }
  t.bld = null;
  t.annex = null;
  t.type = 'grass';
  if(t.variant == null) t.variant = 0;
  return !!had;
}

// ====== Integrace s herním stavem ======
let editorMode = false;

// Zapne/vypne editor. Při zapnutí pozastaví čas (a zapamatuje si rychlost).
function toggleEditor(){
  editorMode = !editorMode;
  if(typeof G !== 'undefined' && G){
    if(editorMode){
      G._prevSpeed = G.speed;
      if(typeof setSpeed === 'function') setSpeed(0);
    } else if(G._prevSpeed != null){
      if(typeof setSpeed === 'function') setSpeed(G._prevSpeed);
    }
  }
  if(typeof updateEditorPanel === 'function') updateEditorPanel();
  if(typeof notify === 'function') notify(editorMode ? '🛠️ Editor ZAPNUT — čas pozastaven' : '🛠️ Editor vypnut', editorMode ? 'warn' : '');
  if(typeof render === 'function') render();
}

// Aplikuje editorový nástroj na dlaždici (voláno z input.js). tool je řetězec
// jako 'ed_road', 'ed_water', 'ed_bld_house', 'ed_erase'.
function applyEditorTool(tool, x, y){
  if(typeof G === 'undefined' || !G) return;
  let changed = false;
  if(tool === 'ed_erase'){
    changed = editorBulldoze(G.map, x, y, MAP);
  } else if(tool.startsWith('ed_bld_')){
    const bt = tool.slice('ed_bld_'.length);
    changed = editorPlaceBuilding(G.map, x, y, bt, MAP, BTYPES);
  } else if(tool.startsWith('ed_')){
    const terr = tool.slice('ed_'.length);
    changed = editorSetTile(G.map, x, y, terr, MAP);
  }
  if(changed){
    if(typeof markCapDirty === 'function') markCapDirty();
    if(typeof render === 'function') render();
  }
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    EDITOR_TERRAIN, editorSetTile, editorMakeBuilding,
    editorPlaceBuilding, editorBulldoze,
  };
}
