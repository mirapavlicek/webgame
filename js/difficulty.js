// ====== OBTÍŽNOST ======
// Volitelná při založení firmy. Ovlivňuje tři osy hry:
//   • growth  — jak snadno se získávají zákazníci (nižší = hůř),
//   • incident — frekvence poruch/výpadků (vyšší = víc chyb),
//   • cost    — provozní náklady / „dražší služby" (vyšší = dražší).
// Hardcore = 1,33× tvrdší než Heavy (odchylky od normálu škálované ×1.33).

const DIFFICULTY = {
  normal:   { name: 'Normál',   icon: '🙂', desc: 'Vyvážená hra (výchozí).' },
  heavy:    { name: 'Heavy',    icon: '😰', desc: 'Hůř se získávají zákazníci, víc poruch, dražší provoz. 4 agresivnější AI konkurenti, cenové války.' },
  hardcore: { name: 'Hardcore', icon: '💀', desc: '1,33× tvrdší než Heavy. 5 AI žraloků — cenové války, přetahování zákazníků, noví konkurenti. Jen pro ostřílené.' },
};

// „Harshness" Heavy režimu vůči normálu (baseline 1.0 = normál).
const _HEAVY = { growth: 0.65, incident: 1.60, cost: 1.50 };
const _HARDCORE_K = 1.33;

// ---- AI konkurenti podle obtížnosti ----
// Pure: parametry AI konkurence. count = kolik soupeřů startuje; aggr =
// násobitel agresivity; cash = násobitel startovní hotovosti; priceWar =
// násobitel dopadu cenové konkurence (churn cap, sklon k válce); poach =
// měsíční podíl hráčových zákazníků, který umí AI přetáhnout marketingem
// (0 na normálu); entry = smí vstupovat noví konkurenti během hry;
// maxDcs = strop expanze jednoho AI.
function competitorMods(level){
  if(level === 'heavy'){
    return { count: 4, aggr: 1.35, cash: 1.6, priceWar: 1.3, poach: 0.004, entry: true, maxDcs: 10 };
  }
  if(level === 'hardcore'){
    return { count: 5, aggr: 1.7, cash: 2.5, priceWar: 1.6, poach: 0.009, entry: true, maxDcs: 12 };
  }
  return { count: 3, aggr: 1.0, cash: 1.0, priceWar: 1.0, poach: 0, entry: false, maxDcs: 8 };
}

// Pure: cena v cenové válce — budget AI podstřelí hráče o 22 %, ale nikdy
// nejde pod svůj margin floor (ať se neprodá do bankrotu).
function priceWarPrice(desired, playerAvg, marginFloor){
  return Math.max(marginFloor || 0, Math.min(desired, (playerAvg || 0) * 0.78));
}

// Pure: měsíční podíl hráčových zákazníků přetažených jedním AI.
// Vysoká prestiž hráče (70+) poaching půlí — loajalita značce.
function poachPct(basePoach, aggr, prestige){
  const p = Math.max(0, (basePoach || 0)) * Math.max(0, aggr || 1);
  return (prestige >= 70 ? p * 0.5 : p);
}

// Pure: má na trh vstoupit nový AI konkurent? Jen na vyšších obtížnostech,
// když hráč dominuje (podíl > 60 %) a je místo pod stropem počtu.
function shouldCompetitorEnter(entry, activeCount, maxCount, playerShare, rndVal){
  if(!entry) return false;
  if(activeCount >= maxCount + 1) return false;
  if((playerShare || 0) <= 0.6) return false;
  return (rndVal != null ? rndVal : Math.random()) < 0.08;
}

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
  module.exports = { DIFFICULTY, difficultyMods, competitorMods, priceWarPrice, poachPct, shouldCompetitorEnter };
}
