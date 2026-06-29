// ====== CÍLE / VÝZVY ======
// Dynamické cíle dávají hře směr a odměny. Vždy jsou 3 aktivní; po splnění se
// vyplatí odměna a vygeneruje se nový (škálovaný podle aktuálního stavu hry).
// Hodnocení je čisté (objectiveProgress čte jen G) → snadno testovatelné.

function _objCountConnected(G){
  let n = 0;
  for(let y = 0; y < MAP; y++) for(let x = 0; x < MAP; x++){
    const b = G.map[y][x].bld; if(b && b.connected) n++;
  }
  return n;
}
function _objCountConnectedType(G, type){
  let n = 0;
  for(let y = 0; y < MAP; y++) for(let x = 0; x < MAP; x++){
    const b = G.map[y][x].bld; if(b && b.connected && b.type === type) n++;
  }
  return n;
}

// Pure: aktuální postup cíle (číslo). Splněno když >= obj.target.
function objectiveProgress(obj, G){
  if(!obj || !G) return 0;
  switch(obj.type){
    case 'customers': return (G.stats && G.stats.cust) || 0;
    case 'connected': return _objCountConnected(G);
    case 'dcs':       return (G.dcs || []).length;
    case 'towers':    return (G.towers || []).length;
    case 'tech':      return (G.tech || 0);
    case 'coverType': return _objCountConnectedType(G, obj.building);
    case 'profit':    return (((G.stats && G.stats.inc) || 0) - ((G.stats && G.stats.exp) || 0));
    case 'cash':      return (G.cash || 0);
    default:          return 0;
  }
}
function objectiveDone(obj, G){
  return objectiveProgress(obj, G) >= (obj ? obj.target : Infinity);
}

// Šablony cílů — mk(G,rnd) vrátí konkrétní instanci škálovanou podle stavu.
const OBJ_TEMPLATES = [
  { type:'customers', mk:(G,r)=>{ const c=(G.stats&&G.stats.cust)||0; const t=Math.max(20, Math.round((c+20+Math.floor(r()*60))/5)*5); return {target:t, reward:25000+t*50, desc:`Získej ${t} zákazníků`, icon:'👥'}; } },
  { type:'connected', mk:(G,r)=>{ const c=_objCountConnected(G); const t=Math.max(10, c+5+Math.floor(r()*15)); return {target:t, reward:20000+t*400, desc:`Připoj ${t} budov`, icon:'🔌'}; } },
  { type:'dcs',       mk:(G,r)=>{ const t=(G.dcs||[]).length+1; return {target:t, reward:60000, desc:`Provozuj ${t} datacenter`, icon:'🏢'}; } },
  { type:'towers',    mk:(G,r)=>{ const t=(G.towers||[]).length+2; return {target:t, reward:50000, desc:`Postav celkem ${t} vysílačů`, icon:'📡'}; } },
  { type:'tech',      mk:(G,r)=>{ const t=Math.min((typeof TECHS!=='undefined'?TECHS.length:9)-1, (G.tech||0)+1); const name=(typeof TECHS!=='undefined'&&TECHS[t])?TECHS[t].name:''; return {target:t, reward:90000, desc:`Odemkni technologii ${name}`, icon:'🔬'}; } },
  { type:'coverType', building:'hospital', mk:(G,r)=>{ const c=_objCountConnectedType(G,'hospital'); const t=c+1; return {target:t, reward:120000, desc:`Připoj ${t}× nemocnici`, icon:'🏥', building:'hospital'}; } },
  { type:'coverType', building:'university', mk:(G,r)=>{ const c=_objCountConnectedType(G,'university'); const t=c+1; return {target:t, reward:100000, desc:`Připoj ${t}× univerzitu`, icon:'🎓', building:'university'}; } },
  { type:'profit',    mk:(G,r)=>{ const t=Math.max(50000, Math.round((((G.stats&&G.stats.inc)||0))*0.3/10000)*10000+50000); return {target:t, reward:80000, desc:`Měsíční zisk ${fmtKc?fmtKc(t):t}`, icon:'📈'}; } },
];

// Vygeneruje nový cíl; vyhne se typům, které už jsou aktivní.
function generateObjective(G, rnd, activeTypes){
  rnd = rnd || Math.random;
  activeTypes = activeTypes || new Set();
  const pool = OBJ_TEMPLATES.filter(t => !activeTypes.has(t.type + (t.building || '')));
  const src = (pool.length ? pool : OBJ_TEMPLATES);
  const tpl = src[Math.floor(rnd() * src.length)];
  const inst = tpl.mk(G, rnd);
  inst.type = tpl.type;
  if(tpl.building) inst.building = tpl.building;
  inst.key = tpl.type + (tpl.building || '');
  return inst;
}

function ensureObjectives(){
  if(typeof G === 'undefined' || !G) return [];
  if(!Array.isArray(G.objectives)) G.objectives = [];
  let guard = 0;
  while(G.objectives.length < 3 && guard++ < 10){
    const active = new Set(G.objectives.map(o => o.key));
    G.objectives.push(generateObjective(G, Math.random, active));
  }
  return G.objectives;
}

// Měsíční vyhodnocení — vyplatí odměny za splněné a doplní nové.
function objectivesMonthlyTick(){
  if(typeof G === 'undefined' || !G) return;
  ensureObjectives();
  let completed = 0;
  for(const obj of G.objectives.slice()){
    if(objectiveDone(obj, G)){
      G.cash += obj.reward;
      completed++;
      if(typeof boostDemand === 'function') boostDemand(0.03); // dobrá pověst přitáhne zájem
      if(typeof notify === 'function') notify(`🎯 Cíl splněn: ${obj.desc} (+${typeof fmtKc==='function'?fmtKc(obj.reward):obj.reward})`, 'good');
      const idx = G.objectives.indexOf(obj);
      if(idx >= 0) G.objectives.splice(idx, 1);
    }
  }
  if(completed) ensureObjectives();
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { objectiveProgress, objectiveDone, generateObjective, OBJ_TEMPLATES };
}
