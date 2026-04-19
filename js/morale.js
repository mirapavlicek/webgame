// ====== EMPLOYEE MORALE & TRAINING ======
// Extends basic employee count system with morale (0-100), XP/level, and training

const MORALE_THRESHOLDS={
  quit:20,      // below this for 3+ months → quit
  low:35,       // reduced effectiveness
  normal:60,
  high:80,      // bonus effectiveness
};

// Compute infrastructure load per staff type — measures how overworked the team is
function calcStaffLoad(type){
  if(!G)return 0;
  const count=getStaffCount(type);
  if(count<=0)return 999; // if you have none, you're infinitely underwater
  let workload=0;
  if(type==='noc'){
    // NOC: DCs × 1 + active incidents × 3
    workload=G.dcs.length+(G.incidents||[]).filter(i=>!i.resolved).length*3;
  } else if(type==='tech'||type==='repair'){
    // Tech: sum of DCs' equipment + cables/100
    for(const dc of G.dcs)workload+=(dc.eq||[]).length;
    workload+=Math.floor(G.cables.length/80);
  } else if(type==='sales'){
    // Sales: customer count
    workload=Math.floor((G.stats.cust||0)/200);
  } else if(type==='support'){
    // Support: customer count
    workload=Math.floor((G.stats.cust||0)/150);
  } else if(type==='dev'){
    // Dev: services + cloud
    workload=(G.services||[]).length+(G.cloudInstances||[]).length*2;
  } else {
    workload=G.dcs.length;
  }
  return workload/count; // load per head
}

// Ensure staffDetail has entry for each type
function ensureStaffDetail(type){
  if(!G.staffDetail)G.staffDetail={};
  if(!G.staffDetail[type])G.staffDetail[type]={
    morale:65,xp:0,level:1,lastTrainingY:0,monthsLowMorale:0
  };
  return G.staffDetail[type];
}

// Monthly morale & XP tick
function staffMonthlyTick(){
  if(!G.employees)return;
  let quitting=[];
  for(const em of G.employees){
    const det=ensureStaffDetail(em.type);
    const load=calcStaffLoad(em.type);
    // Morale shift:
    //   load<0.5: +6 (easy work)
    //   load<1.0: +2
    //   load<1.5: 0
    //   load<2.5: -4
    //   load>=2.5: -8 (severe burnout)
    let d=0;
    if(load<0.5)d+=6;
    else if(load<1.0)d+=2;
    else if(load<1.5)d=0;
    else if(load<2.5)d-=4;
    else d-=8;
    // Training budget effect
    if(G.trainingBudgetM>0){
      const perHead=G.trainingBudgetM/Math.max(1,G.employees.reduce((s,e)=>s+e.count,0));
      if(perHead>2000)d+=4;
      else if(perHead>500)d+=2;
    }
    // Dev bonus staff
    const devCount=getStaffCount('dev');
    if(devCount>0&&em.type!=='dev')d+=1;
    // Random life events
    if(Math.random()<0.05)d+=Math.random()<0.5?-3:3;

    det.morale=Math.max(0,Math.min(100,det.morale+d));
    // XP growth
    det.xp+=Math.max(1,em.count);
    while(det.xp>=det.level*50){
      det.xp-=det.level*50;det.level++;
      notify(`🎓 ${STAFF_T[em.type]?.name||em.type} dosáhl L${det.level}!`,'good');
    }
    // Quit check
    if(det.morale<MORALE_THRESHOLDS.quit){
      det.monthsLowMorale=(det.monthsLowMorale||0)+1;
      if(det.monthsLowMorale>=3){
        quitting.push({type:em.type,count:Math.max(1,Math.floor(em.count*0.5))});
        det.monthsLowMorale=0;
      }
    } else {
      det.monthsLowMorale=0;
    }
  }
  // Apply quits
  for(const q of quitting){
    const em=G.employees.find(e=>e.type===q.type);
    if(em){
      em.count=Math.max(0,em.count-q.count);
      notify(`😢 ${q.count}× ${STAFF_T[q.type]?.name||q.type} dal výpověď (nízká morálka)`,'bad');
      if(em.count<=0)G.employees.splice(G.employees.indexOf(em),1);
    }
  }
  // Deduct training budget from cash monthly
  if(G.trainingBudgetM>0&&G.cash>=G.trainingBudgetM){
    G.cash-=G.trainingBudgetM;
  } else if(G.trainingBudgetM>0){
    G.trainingBudgetM=0;
    notify('⚠️ Školení pozastaveno — nedostatek hotovosti','warn');
  }
}

// Get effective multiplier for a staff's output based on morale and level
function getStaffMoraleMultiplier(type){
  const det=G.staffDetail?.[type];
  if(!det)return 1;
  let mult=1;
  if(det.morale>=MORALE_THRESHOLDS.high)mult=1.25;
  else if(det.morale>=MORALE_THRESHOLDS.normal)mult=1.0;
  else if(det.morale>=MORALE_THRESHOLDS.low)mult=0.8;
  else mult=0.55;
  // Level bonus (up to +50% at L10)
  mult*=1+Math.min(0.5,(det.level-1)*0.07);
  return mult;
}

// Set monthly training budget
function setTrainingBudget(amount){
  G.trainingBudgetM=Math.max(0,Math.round(amount));
  notify(`🎓 Školící rozpočet nastaven: ${fmtKc(G.trainingBudgetM)}/měs`,'good');
  updUI();
}

// UI helper — full staff summary
function getStaffSummary(){
  const out=[];
  if(!G.employees)return out;
  for(const em of G.employees){
    const det=ensureStaffDetail(em.type);
    const load=calcStaffLoad(em.type);
    const st=STAFF_T[em.type]||{name:em.type,icon:'👤'};
    out.push({
      type:em.type,
      name:st.name,
      icon:st.icon,
      count:em.count,
      morale:det.morale,
      level:det.level,
      xp:det.xp,
      xpNext:det.level*50,
      load,
      loadStatus:load<0.8?'✓':load<1.5?'⚠️':'🔥',
      multiplier:getStaffMoraleMultiplier(em.type),
    });
  }
  return out;
}
