// ====== VZHLED: SVĚTLÝ DESIGN + PŘEPÍNAČ KRUHŮ POKRYTÍ ======
// 1) Světlý design — přepíná `body.light`, které přemapuje CSS design tokeny
//    (viz style.css). Preference se pamatuje v localStorage.
// 2) Kruhy pokrytí (WiFi AP / vysílače) jdou vypnout — na hustých mapách dělají
//    vizuální šum. Náhledy při umisťování zůstávají vždy.

const _THEME_KEY = 'nt_theme';       // 'light' | 'dark'
const _COVERAGE_KEY = 'nt_coverage'; // '1' | '0'

let _coverageOn = true;

// Pure: další téma v cyklu.
function nextTheme(cur){ return cur === 'light' ? 'dark' : 'light'; }
// Pure: parse uložené bool preference ('0'/'1'/null) s výchozí hodnotou.
function parseBoolPref(v, def){
  if(v === '1') return true;
  if(v === '0') return false;
  return !!def;
}

function coverageEnabled(){ return _coverageOn; }

function toggleCoverage(){
  _coverageOn = !_coverageOn;
  try{ localStorage.setItem(_COVERAGE_KEY, _coverageOn ? '1' : '0'); }catch(e){}
  if(typeof notify === 'function') notify(_coverageOn ? '⭕ Kruhy pokrytí ZAPNUTY' : '⭕ Kruhy pokrytí vypnuty', '');
  _syncToggleButtons();
  if(typeof render === 'function') try{ render(); }catch(e){}
}

function currentTheme(){
  return (typeof document !== 'undefined' && document.body.classList.contains('light')) ? 'light' : 'dark';
}

function toggleTheme(){
  const next = nextTheme(currentTheme());
  applyTheme(next);
  try{ localStorage.setItem(_THEME_KEY, next); }catch(e){}
  if(typeof notify === 'function') notify(next === 'light' ? '☀️ Světlý design' : '🌙 Tmavý design', '');
}

function applyTheme(theme){
  if(typeof document === 'undefined') return;
  document.body.classList.toggle('light', theme === 'light');
  _syncToggleButtons();
}

function _syncToggleButtons(){
  if(typeof document === 'undefined') return;
  const tb = document.getElementById('btnTheme');
  if(tb) tb.textContent = currentTheme() === 'light' ? '🌙' : '☀️';
  const cb = document.getElementById('btnCoverage');
  if(cb) cb.style.opacity = _coverageOn ? '1' : '.45';
}

// Obnova preferencí při startu.
function initTheme(){
  let theme = 'dark', cov = '1';
  try{ theme = localStorage.getItem(_THEME_KEY) || 'dark'; }catch(e){}
  try{ cov = localStorage.getItem(_COVERAGE_KEY); }catch(e){}
  _coverageOn = parseBoolPref(cov, true);
  applyTheme(theme);
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { nextTheme, parseBoolPref };
}
