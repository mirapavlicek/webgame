// ====== HARDWARE AGING ======
// v0.3.0 — každé kus vybavení v DC má instalační datum a stárne.
// Po 5 letech se objevují rostoucí šance na selhání; po 10 letech téměř jisté.
// Hráč může preventivně "vyměnit" HW (zaplatí full cost, reset věku).
//
// Designový cíl: dlouhodobé provozní rozhodování — buď renovuj, nebo vyhoř.
// Data model:
//   dc.eqInstalled[i] = {y, m} — paralelní pole k dc.eq[] se stejným indexem.
//   Pokud pole chybí (starší save), backfillne se aktuálním datem (HW je "jako nové")
//   aby hráč nebyl potrestán zpětně za existující save.

const HW_WARN_AGE_MONTHS = 60;   // 5 let — žlutý alarm
const HW_EOL_AGE_MONTHS  = 120;  // 10 let — červený alarm, časté poruchy

// Věk HW v měsících od instalace
function eqAgeMonths(dc, slotIdx){
  if(!dc||!dc.eqInstalled)return 0;
  const inst = dc.eqInstalled[slotIdx];
  if(!inst) return 0;
  return Math.max(0, (G.date.y - inst.y)*12 + (G.date.m - inst.m));
}

// Měsíční šance, že tento kus HW letos selže.
// Pod 5 let = 0. Mezi 5-7 lety jemný náběh (0 → 0.8 %).
// Mezi 7-10 lety akcelerace (0.8 % → 3.3 %). Nad 10 let drsně (3.5-13 %).
function eqMonthlyFailChance(ageMonths){
  if(ageMonths < HW_WARN_AGE_MONTHS) return 0;
  if(ageMonths < 84){
    return ((ageMonths-HW_WARN_AGE_MONTHS)/24) * 0.008;
  }
  if(ageMonths < HW_EOL_AGE_MONTHS){
    return 0.008 + ((ageMonths-84)/36) * 0.025;
  }
  return 0.035 + Math.min(0.10, (ageMonths-HW_EOL_AGE_MONTHS)/48 * 0.10);
}

// Měsíční tick — pro každý HW hodí kostkou
function eqDoMonthlyAging(){
  if(!G||!G.dcs) return;
  for(let di=0; di<G.dcs.length; di++){
    const dc = G.dcs[di];
    if(!dc.eq || dc.eq.length===0) continue;
    // Zajistit paralelní pole
    if(!dc.eqInstalled) dc.eqInstalled = dc.eq.map(()=>({y:G.date.y, m:G.date.m}));
    while(dc.eqInstalled.length < dc.eq.length) dc.eqInstalled.push({y:G.date.y, m:G.date.m});
    // Iterace odzadu kvůli splice
    for(let i = dc.eq.length-1; i>=0; i--){
      const age = eqAgeMonths(dc, i);
      const chance = eqMonthlyFailChance(age);
      if(chance > 0 && Math.random() < chance){
        const eqId = dc.eq[i];
        const eq = (typeof EQ!=='undefined')?EQ[eqId]:null;
        const name = eq ? eq.name : eqId;
        dc.eq.splice(i, 1);
        dc.eqInstalled.splice(i, 1);
        const ageY = (age/12).toFixed(1);
        try{notify(`💥 ${name} selhal po ${ageY} letech v DC #${di+1}! Nutná výměna.`, 'bad');}catch(e){}
        // Kritické HW přepne DC do krátkého výpadku
        if(eq && (eq.eff==='cap' || eq.eff==='ports' || eq.eff==='reliable' || eq.eff==='cooling')){
          if(!dc.outage) dc.outage = {active:false, remaining:0, cause:''};
          if(!dc.outage.active && Math.random() < 0.35){
            dc.outage.active = true;
            dc.outage.remaining = 1 + Math.floor(Math.random()*3);
            dc.outage.cause = `Selhání ${name} (stáří ${ageY}y)`;
            try{notify(`⚠️ Výpadek DC #${di+1} kvůli HW selhání!`, 'bad');}catch(e){}
          }
        }
      }
    }
    if(typeof markCapDirty==='function') markCapDirty();
  }
}

// Ruční výměna jednoho kusu HW za nový (reset věku). Full cost (inflated).
function replaceAgedEq(dcIdx, slotIdx){
  const dc = G.dcs[dcIdx];
  if(!dc || !dc.eq || slotIdx >= dc.eq.length) return;
  const eqKey = dc.eq[slotIdx];
  const eq = EQ[eqKey];
  if(!eq) return;
  const cost = (typeof inflComponentCost==='function')?inflComponentCost(eq.cost):eq.cost;
  if(G.cash < cost){ try{notify(`❌ Chybí ${fmtKc(cost - G.cash)} na výměnu!`, 'bad');}catch(e){} return; }
  G.cash -= cost;
  if(!dc.eqInstalled) dc.eqInstalled = dc.eq.map(()=>({y:G.date.y, m:G.date.m}));
  dc.eqInstalled[slotIdx] = {y: G.date.y, m: G.date.m};
  try{notify(`✅ ${eq.name} vyměněn za nový (${fmtKc(cost)})`, 'good');}catch(e){}
  if(typeof renderDCModal==='function') renderDCModal();
  if(typeof updUI==='function') updUI();
}

// Hromadná výměna — všechno HW v DC starší než `thresholdY` let
function replaceAllAgedInDC(dcIdx, thresholdY){
  const dc = G.dcs[dcIdx];
  if(!dc || !dc.eq) return;
  if(thresholdY===undefined) thresholdY = 5;
  const thresholdM = thresholdY*12;
  if(!dc.eqInstalled) dc.eqInstalled = dc.eq.map(()=>({y:G.date.y, m:G.date.m}));
  // Spočítat cenu
  let totalCost = 0, count = 0;
  for(let i=0; i<dc.eq.length; i++){
    if(eqAgeMonths(dc, i) >= thresholdM){
      const eq = EQ[dc.eq[i]];
      if(eq){ totalCost += (typeof inflComponentCost==='function')?inflComponentCost(eq.cost):eq.cost; count++; }
    }
  }
  if(count===0){ try{notify('✨ Žádný HW není starší než ' + thresholdY + ' let', 'good');}catch(e){} return; }
  if(G.cash < totalCost){ try{notify(`❌ Chybí ${fmtKc(totalCost - G.cash)} na výměnu ${count} kusů`, 'bad');}catch(e){} return; }
  G.cash -= totalCost;
  for(let i=0; i<dc.eq.length; i++){
    if(eqAgeMonths(dc, i) >= thresholdM){
      dc.eqInstalled[i] = {y: G.date.y, m: G.date.m};
    }
  }
  try{notify(`✅ Obnova DC #${dcIdx+1}: ${count} kusů vyměněno (${fmtKc(totalCost)})`, 'good');}catch(e){}
  if(typeof renderDCModal==='function') renderDCModal();
  if(typeof updUI==='function') updUI();
}

// Text a barva pro UI
function ageLabel(months){
  if(months <= 0) return 'nový';
  if(months < 12) return months + ' měs.';
  const y = Math.floor(months/12);
  const m = months%12;
  return y + 'r' + (m>0?' '+m+'m':'');
}

function ageColor(months){
  if(months < HW_WARN_AGE_MONTHS) return '#3fb950';
  if(months < 84) return '#f59e0b';
  if(months < HW_EOL_AGE_MONTHS) return '#ff8c42';
  return '#f85149';
}
