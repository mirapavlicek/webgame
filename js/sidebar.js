// ====== SBALITELNÉ SEKCE POSTRANNÍHO PANELU ======
// Statistické sekce (Finance, Síť & Město, Kapacita, Technologie) ukrajovaly
// většinu výšky a na stavební paletu zbýval malý scroll. Sekce jsou nově
// sbalitelné (klik na nadpis) a stav se pamatuje v localStorage. Sbalené sekce
// uvolní místo pro obsah záložek.

const _COLLAPSE_KEY = 'nt_collapsed_v1';

// Pure: stabilní klíč sekce z textu nadpisu (bez ikon/diakritiky navíc).
function collapseKey(title){
  return String(title || '')
    .replace(/[^\p{L}\p{N} ]/gu, '')   // pryč ikony/emoji/symboly
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .slice(0, 40) || 'sec';
}

function loadCollapsePrefs(){
  try { return JSON.parse(localStorage.getItem(_COLLAPSE_KEY) || '{}') || {}; }
  catch(e){ return {}; }
}
function saveCollapsePrefs(p){
  try { localStorage.setItem(_COLLAPSE_KEY, JSON.stringify(p)); } catch(e){}
}

function initCollapsibleSections(){
  if(typeof document === 'undefined') return;
  const secs = document.querySelectorAll('#sidebar .section');
  const prefs = loadCollapsePrefs();
  secs.forEach(sec => {
    const h = sec.querySelector('h3');
    if(!h) return;
    const key = collapseKey(h.textContent);
    sec.dataset.ckey = key;
    if(prefs[key]) sec.classList.add('collapsed');
    // klik na nadpis přepíná sbalení (a uloží stav)
    h.addEventListener('click', () => {
      sec.classList.toggle('collapsed');
      const p = loadCollapsePrefs();
      p[key] = sec.classList.contains('collapsed');
      saveCollapsePrefs(p);
    });
  });
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { collapseKey };
}
