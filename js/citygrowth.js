// ====== ORGANICKÝ RŮST MĚSTA ======
// Město neroste jako pravidelný čtverec — postupně se zahušťuje kolem stávající
// zástavby (shlukování na frontieru) a občas si prorazí novou ulici do volné
// plochy, čímž otevře novou čtvrť. Růst škáluje s prosperitou hráče (počet
// zákazníků) a dobou — úspěšný ISP přitahuje developery. Vznikne tak nepravidelný,
// živě rostoucí půdorys místo statické mřížky.
//
// Bezpečnost: vše respektuje vodu, parky, elektrárny, DC a existující budovy.
// Vykreslování nových budov je automatické (render iteruje G.map každý frame,
// sprite cache je postavená pro všechny BTYPES).

// Pure: vybere typ budovy podle vzdálenosti od centra a roku. rnd() -> [0,1).
function pickGrowthBuildingType(distCenter, year, rnd){
  rnd = rnd || Math.random;
  const r = rnd();
  // Postupem času (modernizace) roste podíl výškových budov v jádru.
  const highRise = Math.min(0.25, Math.max(0, (year - 2005)) * 0.012);
  if(distCenter < 6){
    if(r < 0.30 + highRise) return 'skyscraper';
    if(r < 0.52 + highRise) return 'bigcorp';
    if(r < 0.70) return 'panel';
    if(r < 0.82) return 'shop';
    if(r < 0.90) return 'public';
    if(r < 0.95) return 'hotel';
    return 'hospital';
  } else if(distCenter < 12){
    if(r < 0.20) return 'panel';
    if(r < 0.37) return 'shop';
    if(r < 0.52) return 'rowhouse';
    if(r < 0.66) return 'house';
    if(r < 0.80) return 'factory';
    if(r < 0.89) return 'bigcorp';
    if(r < 0.95) return 'university';
    return 'mall';
  } else if(distCenter < 18){
    if(r < 0.30) return 'house';
    if(r < 0.50) return 'rowhouse';
    if(r < 0.64) return 'panel';
    if(r < 0.78) return 'shop';
    if(r < 0.93) return 'factory';
    return 'mall';
  } else {
    if(r < 0.45) return 'house';
    if(r < 0.68) return 'rowhouse';
    if(r < 0.80) return 'shop';
    if(r < 0.90) return 'factory';
    return 'panel';
  }
}

// Pure: kolik budov letos přibude. Škáluje s prosperitou (zákazníci) a dobou.
function cityGrowthAmount(year, customers, rnd){
  rnd = rnd || Math.random;
  const base = 2 + Math.floor((customers || 0) / 400);
  const yearBonus = Math.max(0, year - 2005) * 0.15;
  const noise = rnd() * 2;
  return Math.max(1, Math.min(14, Math.round(base + yearBonus + noise)));
}

// Vytvoří objekt budovy daného typu na dlaždici (stejná struktura jako genMap).
function spawnBuilding(x, y, bt){
  const b = BTYPES[bt]; if(!b) return false;
  const units = b.units[0] + Math.floor(Math.random() * (b.units[1] - b.units[0] + 1));
  const pop = b.pop[0] + Math.floor(Math.random() * (b.pop[1] - b.pop[0] + 1));
  G.map[y][x].bld = {
    type: bt, units, pop, maxPop: Math.round(pop * 1.5),
    connected: false, connType: null, customers: 0, sat: 0,
    tariff: null, want: Math.random() < b.demand, dcIdx: -1, svcSubs: {}
  };
  G.map[y][x].variant = G.map[y][x].variant || 0;
  return true;
}

// Postaví až n budov na frontieru (volná tráva u silnice). Preferuje místa
// obklopená zástavbou (shlukování), občas zasadí budovu do nově otevřené oblasti.
function growCity(n){
  if(!G || !G.map) return 0;
  const tiles = [];
  for(let y = 0; y < MAP; y++) for(let x = 0; x < MAP; x++){
    const t = G.map[y][x];
    if(t.type !== 'grass' || t.bld || t.annex) continue;
    if(typeof hasPowerPlant === 'function' && hasPowerPlant(x, y)) continue;
    if(typeof dcIndexAt === 'function' && dcIndexAt(x, y) >= 0) continue;
    if(!nb(x, y).some(([ax, ay]) => isRoad(ax, ay))) continue;
    // "development score" = počet sousedních budov v okolí 3×3
    let dev = 0;
    for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){
      const nx = x + dx, ny = y + dy;
      if(nx >= 0 && nx < MAP && ny >= 0 && ny < MAP && G.map[ny][nx].bld) dev++;
    }
    tiles.push({ x, y, dev });
  }
  if(!tiles.length) return 0;
  // Řazení: hustě zastavěná místa první, s lehkým šumem aby růst nebyl mechanický.
  tiles.sort((a, b) => (b.dev - a.dev) + (Math.random() - 0.5) * 1.5);
  const year = (G.date && G.date.y) || 2005;
  let built = 0;
  for(let i = 0; i < tiles.length && built < n; i++){
    const tl = tiles[i];
    // izolovaná místa (dev 0) zastavuj jen občas — jinak by růst byl roztříštěný
    if(tl.dev === 0 && Math.random() < 0.6) continue;
    const dc = Math.sqrt((tl.x - MAP / 2) ** 2 + (tl.y - MAP / 2) ** 2);
    const bt = pickGrowthBuildingType(dc, year, Math.random);
    if(spawnBuilding(tl.x, tl.y, bt)){
      if(typeof addPulse === 'function') addPulse(tl.x, tl.y, '#3fb950');
      built++;
    }
  }
  return built;
}

// Prorazí novou ulici z existující silnice ven do volné plochy (3–6 dlaždic).
// Tím město roste nepravidelně — vznikají chapadla a nové čtvrti, ne čtverec.
function extendRoads(count){
  if(!G || !G.map) return 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const cx = MAP / 2, cy = MAP / 2;
  let made = 0;
  for(let attempt = 0; attempt < 80 && made < count; attempt++){
    const x = Math.floor(Math.random() * MAP), y = Math.floor(Math.random() * MAP);
    if(!isRoad(x, y)) continue;
    // preferuj směr ven od centra
    dirs.sort(() => Math.random() - 0.5);
    let chosen = null;
    for(const d of dirs){
      const nx = x + d[0], ny = y + d[1];
      if(nx < 0 || nx >= MAP || ny < 0 || ny >= MAP) continue;
      if(G.map[ny][nx].type !== 'grass' || G.map[ny][nx].bld) continue;
      // outward = zvyšuje vzdálenost od centra
      const outward = (Math.abs(nx - cx) + Math.abs(ny - cy)) > (Math.abs(x - cx) + Math.abs(y - cy));
      if(outward || Math.random() < 0.3){ chosen = d; break; }
    }
    if(!chosen) continue;
    const len = 3 + Math.floor(Math.random() * 4);
    let ccx = x, ccy = y, laid = 0;
    for(let s = 0; s < len; s++){
      const nx = ccx + chosen[0], ny = ccy + chosen[1];
      if(nx < 0 || nx >= MAP || ny < 0 || ny >= MAP) break;
      const t = G.map[ny][nx];
      if(t.type === 'water' || t.type === 'park' || t.bld) break;
      if(t.type === 'road'){ laid++; break; } // napojeno na existující silnici
      if(t.type === 'grass'){ t.type = 'road'; laid++; ccx = nx; ccy = ny; }
      else break;
    }
    if(laid > 0) made++;
  }
  return made;
}

// ====== VELKÝ ZÁVOD (multi-tile 2×2) ======
// Najde volné 2×2 místo na trávě (bez budov/annexů/DC/elektráren) s alespoň
// jednou silnicí u půdorysu. Preferuje okraj města (dál od centra).
function findPlantSpot(){
  if(!G||!G.map)return null;
  const w=(BTYPES.megafactory&&BTYPES.megafactory.tilesW)||2;
  const h=(BTYPES.megafactory&&BTYPES.megafactory.tilesH)||2;
  let best=null,bestDist=-1;
  for(let attempt=0;attempt<250;attempt++){
    const x=Math.floor(Math.random()*(MAP-w)),y=Math.floor(Math.random()*(MAP-h));
    let ok=true,nearRoad=false;
    for(const t of footprintTiles(x,y,w,h)){
      const tl=G.map[t.y][t.x];
      if(tl.type!=='grass'||tl.bld||tl.annex){ok=false;break;}
      if(typeof dcIndexAt==='function'&&dcIndexAt(t.x,t.y)>=0){ok=false;break;}
      if(typeof hasPowerPlant==='function'&&hasPowerPlant(t.x,t.y)){ok=false;break;}
      for(const[ax,ay]of nb(t.x,t.y)){
        if(ax>=0&&ax<MAP&&ay>=0&&ay<MAP&&G.map[ay][ax].type==='road')nearRoad=true;
      }
    }
    if(!ok||!nearRoad)continue;
    const dist=Math.sqrt((x-MAP/2)**2+(y-MAP/2)**2);
    if(dist>bestDist){bestDist=dist;best={x,y};}
    if(bestDist>MAP*0.3)break; // dost daleko od centra — bereme
  }
  return best;
}

// Postaví velký závod: anchor bld + annex značky na zbytku půdorysu.
function spawnMegaFactory(){
  const bt=BTYPES.megafactory;if(!bt)return 0;
  const spot=findPlantSpot();if(!spot)return 0;
  if(!spawnBuilding(spot.x,spot.y,'megafactory'))return 0;
  for(const t of footprintTiles(spot.x,spot.y,bt.tilesW||2,bt.tilesH||2)){
    if(t.x===spot.x&&t.y===spot.y)continue;
    G.map[t.y][t.x].annex={ax:spot.x,ay:spot.y};
  }
  if(typeof addPulse==='function')addPulse(spot.x,spot.y,'#8d6e63');
  if(typeof notify==='function')notify('🏗️ Ve městě vzniká VELKÝ ZÁVOD (2×2)! Chce přípojku ≥10 Gbps a páteřní kabel (100G+) přímo k závodu — páteř ze 2 směrů = bonus +30 %.','good');
  return 1;
}

// Roční tik růstu — volán z yearUp. Otevře občas novou čtvrť a zahustí frontier.
function cityGrowthTick(){
  if(!G || !G.map) return 0;
  const year = (G.date && G.date.y) || 2005;
  const cust = (G.stats && G.stats.cust) || 0;
  const amount = cityGrowthAmount(year, cust, Math.random);
  let roadsAdded = 0;
  if(Math.random() < Math.min(0.7, 0.25 + cust / 3000)){
    roadsAdded = extendRoads(1 + Math.floor(Math.random() * 2));
  }
  const built = growCity(amount);
  if(built > 0 && typeof notify === 'function'){
    notify(`🏗️ Město roste: +${built} nových budov${roadsAdded > 0 ? ' a nová ulice' : ''}`, '');
  }
  // Velký závod — vzniká později (minYear) a vzácně; velké město = větší šance
  const mfYear=(BTYPES.megafactory&&BTYPES.megafactory.minYear)||2015;
  if(year>=mfYear&&cust>300&&Math.random()<0.20){
    try{spawnMegaFactory();}catch(e){console.error('spawnMegaFactory:',e);}
  }
  return built;
}

// Export pro node testy (vm/CommonJS) — v prohlížeči je module undefined.
if(typeof module !== 'undefined' && module.exports){
  module.exports = { pickGrowthBuildingType, cityGrowthAmount };
}
