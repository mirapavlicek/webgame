// ====== OBTÍŽNOST ======
// Volitelná při založení firmy. Ovlivňuje tři osy hry:
//   • growth  — jak snadno se získávají zákazníci (nižší = hůř),
//   • incident — frekvence poruch/výpadků (vyšší = víc chyb),
//   • cost    — provozní náklady / „dražší služby" (vyšší = dražší).
// Hardcore = 1,33× tvrdší než Heavy (odchylky od normálu škálované ×1.33).

const DIFFICULTY = {
  normal:   { name: 'Normál',   icon: '🙂', desc: 'Vyvážená hra (výchozí).' },
  heavy:    { name: 'Heavy',    icon: '😰', desc: 'Hůř se získávají zákazníci, víc poruch, výrazně dražší provoz.' },
  hardcore: { name: 'Hardcore', icon: '💀', desc: '1,33× tvrdší než Heavy. Jen pro ostřílené.' },
};

// „Harshness" Heavy režimu vůči normálu (baseline 1.0 = normál).
const _HEAVY = { growth: 0.65, incident: 1.60, cost: 1.50 };
const _HARDCORE_K = 1.33;

// Pure: multiplikátory pro danou obtížnost. Vrací {growth, incident, cost}.
function difficultyMods(level){
  if(level === 'heavy'){
    return { growth: _HEAVY.growth, incident: _HEAVY.incident, cost: _HEAVY.cost };
  }
  if(level === 'hardcore'){
    const k = _HARDCORE_K;
    return {
      growth: 1 - (1 - _HEAVY.growth) * k,   // silnější pokles akvizice
      incident: 1 + (_HEAVY.incident - 1) * k,
      cost: 1 + (_HEAVY.cost - 1) * k,
    };
  }
  return { growth: 1, incident: 1, cost: 1 }; // normal / neznámé
}

// Helper nad aktuálním stavem hry.
function diffMods(){
  const lvl = (typeof G !== 'undefined' && G && G.difficulty) ? G.difficulty : 'normal';
  return difficultyMods(lvl);
}
function diffGrowthMult(){ return diffMods().growth; }
function diffIncidentMult(){ return diffMods().incident; }
function diffCostMult(){ return diffMods().cost; }

if(typeof module !== 'undefined' && module.exports){
  module.exports = { DIFFICULTY, difficultyMods };
}
