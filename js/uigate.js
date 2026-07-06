// ====== GATING STAVEBNÍ PALETY ======
// Přehlednější paleta: skrývá prvky, které hráč zatím nemůže postavit (vyšší
// technologická éra), a schovává i prázdné kategorie. Odemyká se automaticky
// s postupem technologie. Cíl: méně vizuálního šumu, moderní "jen relevantní"
// přístup ve stylu Apple System Settings.

// Pure: je nástroj dostupný v dané technologické éře? Bezdrát/přípojky mají
// minTech; ostatní (DC, kabely, WiFi, junctiony, elektrárny, nástroje) jsou
// vždy dostupné. defs = { CONN_T, TOWER_T }.
function isToolAvailable(tool, tech, defs){
  defs = defs || {};
  if(!tool) return true;
  const c = defs.CONN_T && defs.CONN_T[tool];
  if(c) return (c.minTech || 0) <= tech;
  const t = defs.TOWER_T && defs.TOWER_T[tool];
  if(t) return (t.minTech || 0) <= tech;
  return true;
}

// Skryje nedostupné build tlačítka a prázdné kategorie v #tabBuild.
function gateBuildPalette(){
  if(typeof G === 'undefined' || !G) return;
  if(typeof document === 'undefined') return;
  const defs = {
    CONN_T: (typeof CONN_T !== 'undefined') ? CONN_T : null,
    TOWER_T: (typeof TOWER_T !== 'undefined') ? TOWER_T : null,
  };
  const container = document.getElementById('tabBuild');
  if(!container) return;

  // 1) tlačítka podle dostupnosti
  container.querySelectorAll('button.bb[data-tool]').forEach(b => {
    const tool = b.getAttribute('data-tool');
    b.style.display = isToolAvailable(tool, G.tech, defs) ? '' : 'none';
  });

  // 2) kategorie (a jejich popisky) skryj, když v nich nezbylo nic viditelného
  const kids = Array.from(container.children);
  for(let i = 0; i < kids.length; i++){
    const el = kids[i];
    if(!(el.classList && el.classList.contains('build-cat'))) continue;
    const group = [];
    let anyVisible = false;
    for(let j = i + 1; j < kids.length; j++){
      const n = kids[j];
      if(n.classList && n.classList.contains('build-cat')) break;
      group.push(n);
      if(n.matches && n.matches('button.bb') && n.style.display !== 'none') anyVisible = true;
    }
    el.style.display = anyVisible ? '' : 'none';
    for(const n of group){
      if(n.matches && n.matches('button.bb')) continue; // tlačítka řízena výše
      if(n.id === 'renewableInfo') continue;            // dynamický obsah
      n.style.display = anyVisible ? '' : 'none';
    }
  }
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { isToolAvailable };
}
