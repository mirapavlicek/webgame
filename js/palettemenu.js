// ====== VÍCEÚROVŇOVÉ MENU STAVEBNÍ PALETY ======
// Dlouhý plochý seznam v levém panelu (12+ sekcí pod sebou) se špatně
// používal. Tenhle modul ho přeskládá na drill-down menu:
//   úroveň 1 (root): velké dlaždice skupin (Datacentra, Kabely, Přípojky…)
//   úroveň 2: sekce dané skupiny s tlačítky nástrojů + „← Zpět"
// Nástroje jako Kurzor/Demolice zůstávají připnuté na rootu (časté akce).
// Původní tlačítka se jen PŘESOUVAJÍ (zachovají si click handlery z input.js
// i gating z uigate.js). Poslední otevřená skupina se pamatuje v localStorage.

const PAL_GROUPS = {
  tabBuild: {
    pinned: ['Nástroje'],
    groups: [
      { id: 'dc',       icon: '🏢', name: 'Datacentra',      match: ['Datová centra'] },
      { id: 'cables',   icon: '🔌', name: 'Kabely & uzly',   match: ['Kabely', 'Síťové uzly'] },
      { id: 'conns',    icon: '🔗', name: 'Přípojky',        match: ['Přípojky'] },
      { id: 'wireless', icon: '📶', name: 'Bezdrát',         match: ['WiFi přístupové', '4G / LTE', '5G vysílače', '5G Sektorové', '5G Small', '5G mmWave'] },
      { id: 'energy',   icon: '☀️', name: 'Energie',         match: ['Obnovitelné'] },
    ],
  },
  tabTech: {
    pinned: ['Upgrade technologie'],
    groups: [
      { id: 'eq',   icon: '🖥️', name: 'Vybavení DC',     match: ['Vybavení DC'] },
      { id: 'net',  icon: '📡', name: 'Síť & Routing',   match: ['Síť & Routing'] },
      { id: 'stor', icon: '💾', name: 'Storage & Cloud', match: ['Storage & Cloud'] },
    ],
  },
};

// Pure: přiřadí sekci (podle textu .build-cat) skupinu z konfigurace.
// Vrací id skupiny, 'pinned' pro připnuté sekce, nebo null (nechat na rootu).
function palAssignSection(catText, cfg){
  if (!catText || !cfg) return null;
  const t = String(catText).trim();
  for (const p of (cfg.pinned || [])) if (t.includes(p)) return 'pinned';
  for (const g of (cfg.groups || [])) for (const m of g.match) if (t.includes(m)) return g.id;
  return null;
}

// Pure: text badge na dlaždici — počet dostupných nástrojů ve skupině.
function palCountLabel(visible, total){
  if (total <= 0) return '';
  return visible < total ? `${visible}/${total}` : `${total}`;
}

const _palState = {}; // tabId → aktuální pohled ('root' | groupId)

function _palKey(tabId){ return 'nettycoon.palview.' + tabId; }

// Přestaví DOM jedné záložky: sekce → wrappery skupin + root menu s dlaždicemi.
function initPaletteMenu(tabId){
  if (typeof document === 'undefined') return;
  const cfg = PAL_GROUPS[tabId];
  const tab = document.getElementById(tabId);
  if (!cfg || !tab || tab.querySelector('.pal-root')) return;

  // 1) rozděl children na sekce [{cat, nodes[]}] v pořadí
  const sections = [];
  let cur = null;
  for (const node of Array.from(tab.children)){
    if (node.classList && node.classList.contains('build-cat')){
      cur = { cat: node.textContent, nodes: [node] };
      sections.push(cur);
    } else if (cur){
      cur.nodes.push(node);
    } else {
      sections.push({ cat: null, nodes: [node] }); // obsah před první kategorií
    }
  }

  // 2) root menu + wrappery
  const root = document.createElement('div');
  root.className = 'pal-root';
  const wrappers = {};
  for (const g of cfg.groups){
    const w = document.createElement('div');
    w.className = 'pal-group';
    w.dataset.group = g.id;
    w.style.display = 'none';
    const back = document.createElement('button');
    back.className = 'pal-back';
    back.innerHTML = `← Zpět <span style="color:var(--tx-4)">·</span> ${g.icon} ${g.name}`;
    back.onclick = () => palShow(tabId, 'root');
    w.appendChild(back);
    wrappers[g.id] = w;
  }

  const pinnedNodes = [];
  for (const sec of sections){
    const gid = palAssignSection(sec.cat, cfg);
    if (gid && wrappers[gid]){
      for (const n of sec.nodes) wrappers[gid].appendChild(n);
    } else {
      for (const n of sec.nodes) pinnedNodes.push(n); // pinned i nezařazené zůstávají na rootu
    }
  }

  // 3) dlaždice
  for (const g of cfg.groups){
    const tile = document.createElement('button');
    tile.className = 'pal-tile';
    tile.dataset.group = g.id;
    tile.innerHTML = `<span class="pal-tile-ico">${g.icon}</span><span class="pal-tile-nm">${g.name}</span><span class="pal-tile-n"></span>`;
    tile.onclick = () => palShow(tabId, g.id);
    root.appendChild(tile);
  }

  // 4) poskládej: root menu, wrappery skupin, pak připnuté sekce
  tab.appendChild(root);
  for (const g of cfg.groups) tab.appendChild(wrappers[g.id]);
  for (const n of pinnedNodes) tab.appendChild(n);

  // 5) obnov poslední pohled
  let saved = 'root';
  try{ saved = localStorage.getItem(_palKey(tabId)) || 'root'; }catch(e){}
  if (saved !== 'root' && !wrappers[saved]) saved = 'root';
  palShow(tabId, saved);
}

// Přepne pohled záložky: 'root' = dlaždice, jinak konkrétní skupina.
function palShow(tabId, view){
  const tab = document.getElementById(tabId);
  if (!tab) return;
  _palState[tabId] = view;
  try{ localStorage.setItem(_palKey(tabId), view); }catch(e){}
  const root = tab.querySelector('.pal-root');
  if (root) root.style.display = (view === 'root') ? '' : 'none';
  tab.querySelectorAll('.pal-group').forEach(w => {
    w.style.display = (w.dataset.group === view) ? '' : 'none';
  });
  palRefresh(tabId);
}

// Aktualizuje počty na dlaždicích (po gatingu) a zvýrazní skupinu s aktivním
// nástrojem. Volá se z updUI po gateBuildPalette.
function palRefresh(tabId){
  const ids = tabId ? [tabId] : Object.keys(PAL_GROUPS);
  for (const id of ids){
    const tab = document.getElementById(id);
    if (!tab) continue;
    const root = tab.querySelector('.pal-root');
    if (!root) continue;
    root.querySelectorAll('.pal-tile').forEach(tile => {
      const w = tab.querySelector(`.pal-group[data-group="${tile.dataset.group}"]`);
      if (!w) return;
      const btns = Array.from(w.querySelectorAll('button.bb'));
      const vis = btns.filter(b => b.style.display !== 'none');
      const nEl = tile.querySelector('.pal-tile-n');
      if (nEl) nEl.textContent = palCountLabel(vis.length, btns.length);
      tile.style.display = vis.length === 0 && btns.length > 0 ? 'none' : '';
      tile.classList.toggle('has-active', !!w.querySelector('button.bb.active'));
    });
  }
}

function initPaletteMenus(){
  for (const tabId in PAL_GROUPS) initPaletteMenu(tabId);
}

// Inicializace hned při načtení (skripty jsou na konci body, DOM už stojí).
if (typeof document !== 'undefined' && document.getElementById){
  try{ initPaletteMenus(); }catch(e){ console.error('palettemenu init:', e); }
}

if (typeof module !== 'undefined' && module.exports){
  module.exports = { palAssignSection, palCountLabel, PAL_GROUPS };
}
