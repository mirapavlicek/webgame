// ====== COMMAND PALETTE + GLOBAL HOTKEYS ======
// Cmd/Ctrl+K (nebo `/`) otevře paletu. `?` zobrazí nápovědu.
// Paleta je vrstva nad existujícími hotkey v input.js — ty fungují dál.

(function(){
  'use strict';

  // ---------- Actions registry ----------
  // group, icon, label, subtitle, keywords, run
  const actions = [
    // Speed
    {g:'Rychlost',i:'⏸',l:'Pozastavit',sub:'Space',kw:'pauza pause stop zastavit',run:()=>setSpeed(0)},
    {g:'Rychlost',i:'▶',l:'Normální rychlost',sub:'1',kw:'play normal 1x',run:()=>setSpeed(1)},
    {g:'Rychlost',i:'▶▶',l:'Zrychleně 2×',sub:'2',kw:'fast 2x 2x',run:()=>setSpeed(2)},
    {g:'Rychlost',i:'▶▶▶',l:'Turbo 5×',sub:'3',kw:'turbo 5x fast',run:()=>setSpeed(5)},

    // Tabs / panels
    {g:'Panely',i:'🔧',l:'Stavba',sub:'Přepnout panel',kw:'build stavba kabely dc',run:()=>switchTab('tabBuild')},
    {g:'Panely',i:'⚙️',l:'DC vybavení',sub:'Přepnout panel',kw:'dc data center router switch firewall',run:()=>switchTab('tabTech')},
    {g:'Panely',i:'📡',l:'Síť & Bandwidth',sub:'Přepnout panel',kw:'bw bandwidth kapacita kabel',run:()=>switchTab('tabBW')},
    {g:'Panely',i:'💲',l:'Tarify',sub:'Přepnout panel',kw:'cena tarif cenik pricing',run:()=>switchTab('tabTariff')},
    {g:'Panely',i:'📦',l:'Služby',sub:'Přepnout panel',kw:'iptv voip vpn sluzby',run:()=>switchTab('tabSvc')},
    {g:'Panely',i:'☁️',l:'Cloud',sub:'Přepnout panel',kw:'cloud vps k8s storage',run:()=>switchTab('tabCloud')},
    {g:'Panely',i:'👥',l:'Tým',sub:'Přepnout panel',kw:'staff tym zamestnanci kontrakty',run:()=>switchTab('tabStaff')},
    {g:'Panely',i:'🏆',l:'Cíle & Achievementy',sub:'Přepnout panel',kw:'achievement goals kpi trh',run:()=>switchTab('tabAch')},
    {g:'Panely',i:'📋',l:'Management',sub:'Přepnout panel',kw:'mgmt finance incidenty ma uver',run:()=>switchTab('tabMgmt')},
    {g:'Panely',i:'🆙',l:'Upgrady',sub:'Přepnout panel',kw:'upgrade firemní boost',run:()=>switchTab('tabUpgrade')},

    // Common tools
    {g:'Nástroj',i:'👆',l:'Kurzor',sub:'Esc',kw:'kurzor cursor select vyber',run:()=>setTool('none')},
    {g:'Nástroj',i:'🗑️',l:'Demolice',sub:'X',kw:'demolish demolice delete odstranit',run:()=>setTool('demolish')},
    {g:'Nástroj',i:'🏢',l:'Stavět: Malé DC',sub:'D',kw:'dc small male data center',run:()=>{switchTab('tabBuild');setTool('dc_small');}},
    {g:'Nástroj',i:'🏗️',l:'Stavět: Střední DC',sub:'',kw:'dc medium stredni data center',run:()=>{switchTab('tabBuild');setTool('dc_medium');}},
    {g:'Nástroj',i:'🏭',l:'Stavět: Velké DC',sub:'',kw:'dc large velke data center',run:()=>{switchTab('tabBuild');setTool('dc_large');}},
    {g:'Nástroj',i:'🔌',l:'Stavět: Měděný kabel',sub:'C',kw:'cable copper medeny kabel',run:()=>{switchTab('tabBuild');setTool('cable_copper');}},
    {g:'Nástroj',i:'💎',l:'Stavět: Optický kabel 1G',sub:'F',kw:'cable fiber optika optic',run:()=>{switchTab('tabBuild');setTool('cable_fiber');}},
    {g:'Nástroj',i:'⚡',l:'Stavět: Optika 10G',sub:'',kw:'cable fiber 10g optika 10 gbit',run:()=>{switchTab('tabBuild');setTool('cable_fiber10');}},
    {g:'Nástroj',i:'🌐',l:'Stavět: Páteř 100G',sub:'',kw:'cable backbone 100g patern',run:()=>{switchTab('tabBuild');setTool('cable_backbone');}},

    // Connections
    {g:'Přípojky',i:'📞',l:'Stavět: ADSL přípojka',sub:'',kw:'adsl pripojka dsl',run:()=>{switchTab('tabBuild');setTool('conn_adsl');}},
    {g:'Přípojky',i:'📡',l:'Stavět: VDSL přípojka',sub:'',kw:'vdsl pripojka dsl',run:()=>{switchTab('tabBuild');setTool('conn_vdsl');}},
    {g:'Přípojky',i:'💠',l:'Stavět: Optika 100M',sub:'',kw:'fiber 100m optika',run:()=>{switchTab('tabBuild');setTool('conn_fiber100');}},
    {g:'Přípojky',i:'💎',l:'Stavět: Optika 1G',sub:'',kw:'fiber 1g optika',run:()=>{switchTab('tabBuild');setTool('conn_fiber1g');}},
    {g:'Přípojky',i:'📶',l:'Stavět: WiFi přípojka',sub:'',kw:'wifi pripojka',run:()=>{switchTab('tabBuild');setTool('conn_wifi');}},

    // WiFi & Towers
    {g:'Bezdrát',i:'📶',l:'Stavět: WiFi AP 2.4GHz',sub:'',kw:'wifi ap 2.4',run:()=>{switchTab('tabBuild');setTool('wifi_small');}},
    {g:'Bezdrát',i:'📡',l:'Stavět: LTE 800MHz',sub:'',kw:'lte 4g vysilac',run:()=>{switchTab('tabBuild');setTool('tower_lte');}},
    {g:'Bezdrát',i:'🗼',l:'Stavět: 5G NSA',sub:'',kw:'5g nsa vysilac',run:()=>{switchTab('tabBuild');setTool('tower_5g_nsa');}},
    {g:'Bezdrát',i:'🗼',l:'Stavět: 5G SA',sub:'',kw:'5g sa vysilac',run:()=>{switchTab('tabBuild');setTool('tower_5g_sa');}},

    // DC equipment
    {g:'DC vybavení',i:'📡',l:'Koupit: Router',sub:'',kw:'router eq dc',run:()=>{switchTab('tabTech');setTool('eq_router');}},
    {g:'DC vybavení',i:'🖥️',l:'Koupit: Server',sub:'',kw:'server eq dc',run:()=>{switchTab('tabTech');setTool('eq_server');}},
    {g:'DC vybavení',i:'🛡️',l:'Koupit: Firewall Basic',sub:'',kw:'firewall eq dc ddos',run:()=>{switchTab('tabTech');setTool('eq_firewall');}},
    {g:'DC vybavení',i:'🔋',l:'Koupit: UPS',sub:'',kw:'ups zaloha eq',run:()=>{switchTab('tabTech');setTool('eq_ups');}},
    {g:'DC vybavení',i:'❄️',l:'Koupit: Chlazení',sub:'',kw:'chlazeni cooling rack',run:()=>{switchTab('tabTech');setTool('eq_cooling');}},
    {g:'DC vybavení',i:'🔀',l:'Koupit: BGP router',sub:'',kw:'bgp router peering ip',run:()=>{switchTab('tabTech');setTool('eq_bgprouter');}},
    {g:'DC vybavení',i:'☁️',l:'Koupit: Cloud uzel',sub:'',kw:'cloud uzel vcpu ram',run:()=>{switchTab('tabTech');setTool('eq_cloudnode');}},
    {g:'DC vybavení',i:'💿',l:'Koupit: Diskové pole 10TB',sub:'',kw:'storage diskove pole',run:()=>{switchTab('tabTech');setTool('eq_storage');}},

    // Zoom / view
    {g:'Zobrazení',i:'➕',l:'Přiblížit',sub:'+',kw:'zoom in priblizit',run:()=>{if(typeof zoomIn==='function')zoomIn();}},
    {g:'Zobrazení',i:'➖',l:'Oddálit',sub:'−',kw:'zoom out oddálit',run:()=>{if(typeof zoomOut==='function')zoomOut();}},
    {g:'Zobrazení',i:'⌂',l:'Resetovat přiblížení',sub:'',kw:'zoom reset home',run:()=>{if(typeof zoomReset==='function')zoomReset();}},
    {g:'Zobrazení',i:'🌡️',l:'Přepnout heatmap',sub:'',kw:'heatmap pokryti utilizace spokojenost',run:()=>{if(typeof cycleHeatmap==='function')cycleHeatmap();}},
    {g:'Zobrazení',i:'✨',l:'WebGL efekty zap/vyp',sub:'',kw:'pixi fx webgl efekty glow',run:()=>{if(typeof pixiTogglable==='function')pixiTogglable();}},

    // Save/Load
    {g:'Hra',i:'💾',l:'Uložit hru',sub:'',kw:'save ulozit ukladat',run:()=>{if(typeof saveGame==='function')saveGame();}},
    {g:'Hra',i:'📂',l:'Načíst hru',sub:'',kw:'load nacist otevrit',run:()=>{if(typeof loadGame==='function')loadGame();}},
    {g:'Hra',i:'🆕',l:'Nová hra',sub:'',kw:'new nova restart',run:()=>{if(typeof showNewGame==='function')showNewGame();}},
    {g:'Hra',i:'❓',l:'Klávesové zkratky',sub:'?',kw:'help napoveda zkratky shortcuts',run:()=>openHotkeyHelp()},
  ];

  // ---------- DOM build ----------
  function buildPaletteDom(){
    if(document.getElementById('cmdPaletteOverlay'))return;
    const ov=document.createElement('div');
    ov.id='cmdPaletteOverlay';
    ov.innerHTML=`
      <div id="cmdPalette" role="dialog" aria-label="Paleta příkazů">
        <input id="cmdPaletteInput" type="text" placeholder="Najdi akci nebo stavební prvek… (Esc pro zavření)" autocomplete="off" spellcheck="false">
        <div id="cmdPaletteList" role="listbox"></div>
        <div id="cmdPaletteFooter">
          <span class="hint"><span class="kbd">↑</span><span class="kbd">↓</span>&nbsp;pohyb</span>
          <span class="hint"><span class="kbd">Enter</span>&nbsp;spustit</span>
          <span class="hint"><span class="kbd">Esc</span>&nbsp;zavřít</span>
          <span style="margin-left:auto;opacity:.7">? pro nápovědu</span>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click',e=>{if(e.target===ov)closePalette();});

    // Hotkey help modal
    const hk=document.createElement('div');
    hk.id='hotkeyHelpOverlay';
    hk.innerHTML=`
      <div id="hotkeyHelpBox">
        <h2>⌨️ Klávesové zkratky</h2>
        <div class="hk-grid">
          <div class="hk-sec">Globální</div>
          <span class="hk-k">⌘ K / Ctrl K</span><span class="hk-d">Paleta příkazů</span>
          <span class="hk-k">/</span><span class="hk-d">Otevřít paletu</span>
          <span class="hk-k">?</span><span class="hk-d">Tato nápověda</span>
          <span class="hk-k">Esc</span><span class="hk-d">Zavřít modál / zrušit nástroj</span>
          <div class="hk-sec">Rychlost hry</div>
          <span class="hk-k">Space</span><span class="hk-d">Pauza / hrát</span>
          <span class="hk-k">1</span><span class="hk-d">Normální rychlost</span>
          <span class="hk-k">2</span><span class="hk-d">Zrychleně 2×</span>
          <span class="hk-k">3</span><span class="hk-d">Turbo 5×</span>
          <div class="hk-sec">Stavba</div>
          <span class="hk-k">C</span><span class="hk-d">Měděný kabel</span>
          <span class="hk-k">F</span><span class="hk-d">Optický kabel</span>
          <span class="hk-k">D</span><span class="hk-d">Malé DC</span>
          <span class="hk-k">X</span><span class="hk-d">Demolice</span>
          <div class="hk-sec">Zobrazení</div>
          <span class="hk-k">+</span><span class="hk-d">Přiblížit</span>
          <span class="hk-k">−</span><span class="hk-d">Oddálit</span>
        </div>
        <button class="hk-close" onclick="closeHotkeyHelp()">Zavřít</button>
      </div>`;
    document.body.appendChild(hk);
    hk.addEventListener('click',e=>{if(e.target===hk)closeHotkeyHelp();});
  }

  // ---------- Fuzzy score ----------
  function score(q,a){
    if(!q)return 1;
    const hay=(a.l+' '+(a.sub||'')+' '+(a.kw||'')+' '+a.g).toLowerCase();
    q=q.toLowerCase().trim();
    if(!q)return 1;
    // direct substring = strong
    const idx=hay.indexOf(q);
    if(idx>=0)return 100-idx;
    // per-word subsequence match
    const tokens=q.split(/\s+/).filter(Boolean);
    let s=0;
    for(const t of tokens){
      if(hay.indexOf(t)>=0){s+=20;continue;}
      // subsequence
      let i=0,hit=0;
      for(const ch of hay){if(ch===t[i]){i++;hit++;if(i>=t.length)break;}}
      if(i===t.length)s+=5+hit*0.2;else return 0;
    }
    return s;
  }

  let selIndex=0, filtered=[];

  function renderList(q){
    const list=document.getElementById('cmdPaletteList');
    if(!list)return;
    const scored=[];
    for(const a of actions){
      const sc=score(q,a);
      if(sc>0)scored.push({a,sc});
    }
    scored.sort((x,y)=>y.sc-x.sc);
    filtered=scored.map(s=>s.a);
    if(filtered.length===0){
      list.innerHTML='<div class="cmd-empty">Nic nenalezeno. Zkus jiný dotaz.</div>';
      return;
    }
    selIndex=Math.max(0,Math.min(selIndex,filtered.length-1));
    // group by first occurrence
    let h='';let curGroup='';
    filtered.forEach((a,i)=>{
      if(a.g!==curGroup){curGroup=a.g;h+=`<div class="cmd-group">${escapeHtml(curGroup)}</div>`;}
      const sel=i===selIndex?' sel':'';
      const sub=a.sub?`<span class="sub">${escapeHtml(a.sub)}</span>`:'';
      h+=`<div class="cmd-item${sel}" data-i="${i}"><span class="ic">${a.i}</span><span class="tx">${escapeHtml(a.l)}${sub}</span></div>`;
    });
    list.innerHTML=h;
    list.querySelectorAll('.cmd-item').forEach(el=>{
      el.addEventListener('mouseenter',()=>{selIndex=+el.dataset.i;updateSel();});
      el.addEventListener('click',()=>{runAt(+el.dataset.i);});
    });
    scrollSelIntoView();
  }

  function updateSel(){
    const items=document.querySelectorAll('#cmdPaletteList .cmd-item');
    items.forEach((el,i)=>el.classList.toggle('sel',i===selIndex));
    scrollSelIntoView();
  }

  function scrollSelIntoView(){
    const list=document.getElementById('cmdPaletteList');
    const el=list&&list.querySelector('.cmd-item.sel');
    if(el){
      const r=el.getBoundingClientRect(),lr=list.getBoundingClientRect();
      if(r.top<lr.top)el.scrollIntoView({block:'nearest'});
      else if(r.bottom>lr.bottom)el.scrollIntoView({block:'nearest'});
    }
  }

  function runAt(i){
    const a=filtered[i];
    if(!a)return;
    closePalette();
    try{a.run();}catch(err){console.warn('palette action failed',err);}
  }

  function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  // ---------- Open / close ----------
  function openPalette(){
    buildPaletteDom();
    const ov=document.getElementById('cmdPaletteOverlay');
    const inp=document.getElementById('cmdPaletteInput');
    if(!ov||!inp)return;
    ov.classList.add('open');
    inp.value='';
    selIndex=0;
    renderList('');
    setTimeout(()=>inp.focus(),10);
  }
  function closePalette(){
    const ov=document.getElementById('cmdPaletteOverlay');
    if(ov)ov.classList.remove('open');
  }
  function isPaletteOpen(){
    const ov=document.getElementById('cmdPaletteOverlay');
    return ov&&ov.classList.contains('open');
  }

  function openHotkeyHelp(){
    buildPaletteDom();
    document.getElementById('hotkeyHelpOverlay').classList.add('open');
  }
  function closeHotkeyHelp(){
    const el=document.getElementById('hotkeyHelpOverlay');
    if(el)el.classList.remove('open');
  }
  function isHelpOpen(){
    const el=document.getElementById('hotkeyHelpOverlay');
    return el&&el.classList.contains('open');
  }

  // Tab switch helper — musí replikovat chování existujících .tab handlerů
  function switchTab(id){
    document.querySelectorAll('.tab-content').forEach(tc=>tc.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    const tc=document.getElementById(id);
    const tab=document.querySelector('.tab[data-tab="'+id+'"]');
    if(tc)tc.classList.add('active');
    if(tab)tab.classList.add('active');
  }

  // ---------- Global keybindings ----------
  document.addEventListener('keydown',e=>{
    // Cmd+K / Ctrl+K
    if((e.metaKey||e.ctrlKey)&&(e.key==='k'||e.key==='K')){
      e.preventDefault();
      if(isPaletteOpen())closePalette();else openPalette();
      return;
    }

    // Esc close palette / help (runs before input.js Esc)
    if(e.key==='Escape'){
      if(isPaletteOpen()){e.preventDefault();e.stopPropagation();closePalette();return;}
      if(isHelpOpen()){e.preventDefault();e.stopPropagation();closeHotkeyHelp();return;}
    }

    // Palette-internal navigation
    if(isPaletteOpen()){
      if(e.key==='ArrowDown'){e.preventDefault();if(filtered.length){selIndex=(selIndex+1)%filtered.length;updateSel();}return;}
      if(e.key==='ArrowUp'){e.preventDefault();if(filtered.length){selIndex=(selIndex-1+filtered.length)%filtered.length;updateSel();}return;}
      if(e.key==='Enter'){e.preventDefault();runAt(selIndex);return;}
      // jinak typing — input.js už nečte, tady nic neděláme
      return;
    }

    // Mimo paletu: `/` otevře paletu, `?` otevře nápovědu — jen pokud uživatel nepíše do inputu
    if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'))return;

    if(e.key==='/'){e.preventDefault();openPalette();return;}
    if(e.key==='?'){e.preventDefault();openHotkeyHelp();return;}
  },true); // capture — musíme chytit Esc dřív než handler v input.js

  // Input změny (po buildPaletteDom)
  document.addEventListener('input',e=>{
    if(e.target&&e.target.id==='cmdPaletteInput'){
      selIndex=0;
      renderList(e.target.value);
    }
  });

  // Expose close helpers for inline onclick
  window.closeHotkeyHelp=closeHotkeyHelp;
  window.openCommandPalette=openPalette;
  window.closeCommandPalette=closePalette;

  // Build DOM as soon as possible (po DOMContentLoaded)
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',buildPaletteDom);
  }else{
    buildPaletteDom();
  }
})();
