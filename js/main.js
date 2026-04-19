// ====== GAME LOOP & MAIN ======

function gameLoop(ts){
  if(!G)return;
  try{
    const dt=Math.min(ts-lastT,2000); // cap at 2s to prevent freeze after tab switch
    lastT=ts;
    if(G.speed>0){
      tAcc+=dt*G.speed;
      // Cap to max 10 days per frame to prevent freeze
      if(tAcc>10000)tAcc=10000;
      while(tAcc>=1000){
        tAcc-=1000;
        advDay();
      }
    }
    calcCapacityIfDirty();
    render();
    // WebGL overlay — bloom/glow/particles (safe no-op if PixiJS failed to load)
    if(typeof renderPixiFx==='function')renderPixiFx();
  }catch(e){console.error('gameLoop error:',e);}
  requestAnimationFrame(gameLoop);
}

function advDay(){
  G.date.d++;
  markCapDirty(); // daily tick changes customers → BW usage dirty
  const dm=[31,28,31,30,31,30,31,31,30,31,30,31];
  if(G.date.d>dm[G.date.m]){
    G.date.d=1;
    G.date.m++;
    if(G.date.m>=12){
      G.date.m=0;
      G.date.y++;
      try{yearUp();}catch(e){console.error('yearUp error:',e);}
    }
    try{monthUp();}catch(e){console.error('monthUp error:',e);}
  }
  try{dailyTick();}catch(e){console.error('dailyTick error:',e);}
  // Daily incident progression (response actions shorten; natural decay)
  try{if(typeof incidentDailyTick==='function')incidentDailyTick();}catch(e){console.error('incidentDailyTick:',e);}
  try{if(typeof investigationDailyTick==='function')investigationDailyTick();}catch(e){console.error('investigationDailyTick:',e);}
  updDate();
  updStats();
}

// ====== DAILY TICK: smooth customer growth, satisfaction, churn ======
function dailyTick(){
  const D=1/30; // daily fraction of monthly probabilities

  // Gather global upgrade multipliers once
  let gm=1;
  if(G.upgrades.includes('marketing1'))gm+=.2;
  if(G.upgrades.includes('marketing2'))gm+=.4;
  if(G.upgrades.includes('marketing3'))gm+=.6;
  // Sales staff boost
  const salesCount=getStaffEffect('sales');
  if(salesCount>0)gm+=salesCount*.15;
  let satBonus=0;
  if(G.upgrades.includes('support1'))satBonus+=10;
  if(G.upgrades.includes('support2'))satBonus+=20;
  if(G.upgrades.includes('support3'))satBonus+=15;
  // Support staff boost
  const supportCount=getStaffEffect('support');
  if(supportCount>0)satBonus+=supportCount*5;
  // Dev staff boost
  const devCount=getStaffEffect('dev');
  if(devCount>0)satBonus+=devCount*3;
  let churnMult=1;
  if(G.upgrades.includes('brand2'))churnMult*=.7; // -30% churn
  const hasPeering=G.upgrades.includes('peering1');
  const hasPublicDemand=G.upgrades.includes('expansion2');

  // Pre-compute tower loads for overload mechanics
  const towerLoads=[];
  for(let ti=0;ti<(G.towers||[]).length;ti++){
    const tw=G.towers[ti];const tt=TOWER_T[tw.type];
    if(!tt){towerLoads.push({clients:0,max:0,ratio:0});continue;}
    const cl=getTowerClients(ti);
    tw.clients=cl; // update stored value
    towerLoads.push({clients:cl,max:tt.maxClients,ratio:tt.maxClients>0?cl/tt.maxClients:0});
  }

  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;
    if(!b||!b.connected)continue;
    const bt=BTYPES[b.type];
    const cn=G.conns.find(c=>c.bx===x&&c.by===y);
    let congPenalty=0;
    if(cn){
      const dl=dcLoads[cn.di];
      if(dl&&dl.ratio>.8)congPenalty+=.2*(dl.ratio-.8)/.2;
      if(dl&&dl.ratio>1)congPenalty+=.4;
    }
    // Tower overload penalty — if building is in range of an overloaded tower
    let towerOverload=0;
    for(let ti=0;ti<(G.towers||[]).length;ti++){
      const tw=G.towers[ti];const tt=TOWER_T[tw.type];if(!tt)continue;
      if(Math.abs(tw.x-x)+Math.abs(tw.y-y)>tt.range)continue;
      // Building is in this tower's range
      const tl=towerLoads[ti];
      if(tl.ratio>0.8){
        // Overload starts at 80% capacity
        const excess=tl.ratio-0.8;
        towerOverload=Math.max(towerOverload,excess); // use worst tower overload
      }
    }
    if(towerOverload>0){
      // Mild at 80-100%, severe above 100%
      congPenalty+=towerOverload*0.5; // adds to growth penalty
    }

    // --- Customer growth (daily, per-unit probability) ---
    if(b.want&&b.customers<b.units){
      // Equipment quality bonus (bigger impact)
      let qb=0;
      if(cn){
        const dc=G.dcs[cn.di];
        if(dc){const eq=dc.eq||[];
          if(eq.includes('eq_server'))qb+=.10;
          if(eq.includes('eq_firewall'))qb+=.06;
          if(eq.includes('eq_monitoring'))qb+=.06;
          if(eq.includes('eq_backup'))qb+=.04;
          if(eq.includes('eq_ups'))qb+=.04;
        }
      }
      if(hasPeering)qb+=.08;
      // Extra demand boost for public buildings with městské partnerství
      let demandBoost=0;
      if(hasPublicDemand&&(b.type==='public'||b.type==='skyscraper'))demandBoost=.15;

      let priceFactor=0;
      const connMax=b.connType&&CONN_T[b.connType]?CONN_T[b.connType].maxBW:20;
      const dcIdx=cn?cn.di:-1;
      const avail=dcIdx>=0?getAvailTariffs(connMax,dcIdx,b.connType):[];
      if(avail.length){
        // Evaluate cheapest available tariff vs reference price
        const cheapest=G.tariffs[avail[0]];
        if(cheapest){const rp=refPrice(cheapest.speed,cheapest.share);
          const ratio=cheapest.price/rp;
          // Much steeper curve: heavy discounts help, overpricing kills growth
          if(ratio<0.6)priceFactor=.18;         // huge discount → great growth
          else if(ratio<0.8)priceFactor=.10;     // good discount
          else if(ratio<0.95)priceFactor=.04;    // slight discount
          else if(ratio<1.1)priceFactor=.01;     // near reference = neutral
          else if(ratio<1.25)priceFactor=-.06;   // slightly expensive
          else if(ratio<1.5)priceFactor=-.15;    // expensive — growth stalls
          else if(ratio<1.8)priceFactor=-.28;    // very expensive — shrinking
          else if(ratio<2.2)priceFactor=-.42;    // absurd — no new customers
          else priceFactor=-.60;                 // robbery — repels everyone
        }
        // Also check average tariff price across all active tariffs (not just cheapest)
        let avgRatio=0,cnt=0;
        for(const ti of avail){const t=G.tariffs[ti];const rp=refPrice(t.speed,t.share);avgRatio+=t.price/rp;cnt++;}
        if(cnt>0){avgRatio/=cnt;if(avgRatio>1.3)priceFactor-=(avgRatio-1.3)*.12;} // penalty for overall expensive portfolio
      }
      const priceEffect=priceFactor*bt.priceSens;
      const qualEffect=qb*bt.qualSens;
      // Per-unit monthly rate — base 12% + satisfaction + bonuses (lowered base from 13.5%)
      const perUnitMonth=Math.max(0,(.12+b.sat/250+priceEffect+qualEffect+demandBoost)*gm-congPenalty);
      // Scale to daily, multiply by free units → expected new customers/day
      const freeUnits=b.units-b.customers;
      const dailyExpected=perUnitMonth*freeUnits*D;
      // Convert expected to actual: integer part + random for fractional part
      const toAdd=Math.floor(dailyExpected)+(Math.random()<(dailyExpected%1)?1:0);
      if(toAdd>0&&dcIdx>=0){
        const actual=Math.min(toAdd,freeUnits);
        for(let ai=0;ai<actual;ai++){
          const ti=pickTariffForCustomer(b,connMax,dcIdx);
          if(ti!==null)addToTariffDist(b,ti,1);
        }
      }
    }

    // --- Satisfaction (daily) ---
    if(b.connected){
      // Base sat growth per day
      let sc=0.5*D; // base +0.5/month
      // Equipment boosts
      if(cn){
        const dc=G.dcs[cn.di];
        if(dc){const eq=dc.eq||[];
          if(eq.includes('eq_server'))sc+=2*D;
          if(eq.includes('eq_firewall'))sc+=1.5*D;
          if(eq.includes('eq_ups'))sc+=1.5*D;
          if(eq.includes('eq_monitoring'))sc+=2*D;
          if(eq.includes('eq_backup'))sc+=1*D;
        }
      }
      // Support upgrades: push satisfaction toward (50 + satBonus) target
      // This means sat will stabilize around 50+satBonus when no other modifiers
      if(satBonus>0){
        const target=Math.min(100,50+satBonus);
        if(b.sat<target)sc+=(target-b.sat)*0.03*D;
      }
      // Services boost — based on actual subscribers, not flat adopt
      let svcB=0;
      if(b.svcSubs){
        let totalSvcSubs=0;
        for(const sid in b.svcSubs)totalSvcSubs+=b.svcSubs[sid];
        if(totalSvcSubs>0)svcB+=(Math.min(totalSvcSubs/b.customers,.5))*3*D; // more svc subs = more satisfied, capped
      }
      // Penalties
      let congDrop=0;
      if(cn){
        const dl=dcLoads[cn.di];
        if(dl&&dl.ratio>.7)congDrop=(dl.ratio-.7)*15*D;
      }
      if(b.connType==='conn_wifi')sc-=0.5*D;
      // Tower overload satisfaction penalty
      if(towerOverload>0.2){
        congDrop+=(towerOverload-0.2)*8*D; // noticeable sat hit when tower >100% (overload=0.2 means 100%)
      }
      if(b.tariffDist&&b.customers>0){
        let avgPrice=calcBldRevenue(b)/b.customers;
        let avgSpeed=0,avgShare=0;
        for(const ti in b.tariffDist){const t=G.tariffs[ti];if(t){avgSpeed+=t.speed*b.tariffDist[ti];avgShare+=(t.share||1)*b.tariffDist[ti];}}
        avgSpeed/=b.customers;avgShare/=b.customers;
        const rp=refPrice(avgSpeed,avgShare);
        const overRatio=avgPrice/rp;
        // Graduated satisfaction penalty for overpricing
        if(overRatio>1.15)congDrop+=bt.priceSens*2*D;       // slightly over → gentle drop
        if(overRatio>1.35)congDrop+=bt.priceSens*5*D;       // notably over → moderate
        if(overRatio>1.6)congDrop+=bt.priceSens*10*D;       // very expensive → heavy
        if(overRatio>2.0)congDrop+=bt.priceSens*18*D;       // absurd → satisfaction crashes
      }
      b.sat=Math.min(100,Math.max(0,b.sat+sc+svcB-congDrop));
      // Random satisfaction dip
      if(Math.random()<.03*D)b.sat=Math.max(0,b.sat-2);

      // Congestion churn (daily)
      if(congPenalty>.3&&b.customers>0&&Math.random()<.08*D*churnMult)removeFromTariffDist(b,1);

      // Price-sensitive churn (daily) — much more aggressive
      if(b.tariffDist){
        for(const ti in b.tariffDist){
          const t=G.tariffs[ti];if(!t||b.tariffDist[ti]<=0)continue;
          const rp=refPrice(t.speed,t.share);
          const priceRatio=t.price/rp;
          let churnProb=0;
          // Graduated churn: starts at 1.15x reference, scales steeply
          if(priceRatio>1.15)churnProb=.03*(priceRatio-1.15)*bt.priceSens;  // light churn begins
          if(priceRatio>1.4)churnProb=.08*(priceRatio-1.0)*bt.priceSens;   // moderate
          if(priceRatio>1.7)churnProb=.15*(priceRatio-0.8)*bt.priceSens;   // heavy
          if(priceRatio>2.2)churnProb=.25*bt.priceSens;                     // mass exodus
          if(churnProb>0){
            // Scale by number of customers on this tariff for bulk churn at high overpricing
            const custOnTariff=b.tariffDist[ti];
            const toChurn=Math.max(1,Math.floor(custOnTariff*churnProb*D*churnMult));
            if(Math.random()<churnProb*D*churnMult*10)removeFromTariffDist(b,toChurn,Number(ti));
          }
        }
      }
      // Low satisfaction churn — unhappy customers leave regardless of price
      if(b.sat<25&&b.customers>0&&Math.random()<.04*D*churnMult)removeFromTariffDist(b,1);
      if(b.sat<10&&b.customers>0&&Math.random()<.12*D*churnMult)removeFromTariffDist(b,Math.ceil(b.customers*.05));
      // Tower overload churn — severely overloaded towers drive people away
      if(towerOverload>0.4&&b.customers>0&&Math.random()<towerOverload*.06*D*churnMult)removeFromTariffDist(b,1);
      if(towerOverload>0.7&&b.customers>0&&Math.random()<.10*D*churnMult)removeFromTariffDist(b,Math.ceil(b.customers*.03));
    }

    // --- Tariff upgrade (daily) ---
    // Base: 8%/month. Boosted when connection is much faster than current tariff (post-upgrade wave)
    const connMax2=b.connType&&CONN_T[b.connType]?CONN_T[b.connType].maxBW:20;
    let upgradeProb=.08;
    if(b.connected&&b.tariffDist&&b.customers>0){
      // Check if customers are on tariffs way below connection capacity → faster upgrades
      let avgTariffSpeed=0,cnt=0;
      for(const ti in b.tariffDist){const t=G.tariffs[ti];if(t){avgTariffSpeed+=t.speed*b.tariffDist[ti];cnt+=b.tariffDist[ti];}}
      if(cnt>0)avgTariffSpeed/=cnt;
      const headroom=connMax2>0?avgTariffSpeed/connMax2:1;
      // If avg tariff uses <30% of connection capacity → triple upgrade rate
      if(headroom<0.3)upgradeProb=.24;
      else if(headroom<0.5)upgradeProb=.16;
      else if(headroom<0.7)upgradeProb=.10;
    }
    if(b.connected&&b.tariffDist&&b.customers>0&&Math.random()<upgradeProb*D){
      const cn2=G.conns.find(c=>c.bx===x&&c.by===y);
      if(cn2){
        const dcIdx2=cn2.di;
        const tis=Object.keys(b.tariffDist).map(Number).sort((a,b2)=>a-b2);
        if(tis.length>0){
          const fromTi=tis[Math.floor(Math.random()*tis.length)];
          const isWL2=b.connType&&(b.connType.startsWith('conn_lte')||b.connType.startsWith('conn_5g'));
          for(let ti=fromTi+1;ti<G.tariffs.length;ti++){
            const t=G.tariffs[ti];
            if(!t.active||t.minTech>G.tech||t.speed>connMax2)continue;
            if(!networkHasEq(dcIdx2,t.reqEq))continue;
            const tCat=t.cat||'fixed';
            if((tCat==='mobile'||tCat==='fwa')&&!isWL2)continue;
            if(tCat==='fixed'&&isWL2)continue;
            if(Math.random()<bt.qualSens*0.6){
              removeFromTariffDist(b,1,fromTi);
              addToTariffDist(b,ti,1);
            }
            break;
          }
        }
      }
    }
  }

  // ====== SERVICE SUBSCRIPTION TICK (daily) ======
  if((G.services||[]).length>0){
    for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
      const b=G.map[y][x].bld;
      if(!b||!b.connected||b.customers<=0)continue;
      if(!b.svcSubs)b.svcSubs={};
      const bt=BTYPES[b.type];
      for(const sid of G.services){
        const svc=SERVICES.find(s=>s.id===sid);if(!svc)continue;
        const adopt=svc.adopt[b.type]||0;
        if(adopt<=0)continue;
        const maxSubs=Math.round(b.customers*adopt);
        const currentSubs=b.svcSubs[sid]||0;
        const svcPrice=G.svcPrices[sid]||svc.revPerCust;
        const refP=svc.revPerCust; // reference price
        const priceRatio=svcPrice/refP;

        // Growth: new subscribers sign up
        if(currentSubs<maxSubs){
          // Price affects signup rate — same logic as tariff pricing
          let signupRate=0;
          if(priceRatio<=0.7)signupRate=.12;       // bargain
          else if(priceRatio<=0.9)signupRate=.08;   // cheap
          else if(priceRatio<=1.1)signupRate=.05;   // fair
          else if(priceRatio<=1.3)signupRate=.02;   // pricey
          else if(priceRatio<=1.6)signupRate=.005;  // expensive — few sign up
          else signupRate=.001;                      // absurd price
          // Satisfaction bonus
          signupRate*=(0.5+b.sat/200);
          const freeSlots=maxSubs-currentSubs;
          const dailyNew=signupRate*freeSlots*D;
          const toAdd=Math.floor(dailyNew)+(Math.random()<(dailyNew%1)?1:0);
          if(toAdd>0)b.svcSubs[sid]=Math.min(maxSubs,currentSubs+toAdd);
        }

        // Churn: subscribers cancel
        if(currentSubs>0){
          let churnRate=0;
          // Base churn (natural)
          churnRate+=.01*D;
          // Price churn — starts at 1.15x
          if(priceRatio>1.15)churnRate+=.03*(priceRatio-1.15)*D;
          if(priceRatio>1.4)churnRate+=.08*(priceRatio-1.0)*D;
          if(priceRatio>1.8)churnRate+=.15*(priceRatio-0.8)*D;
          if(priceRatio>2.2)churnRate+=.25*D;
          // Low satisfaction churn
          if(b.sat<30)churnRate+=.03*D;
          if(b.sat<15)churnRate+=.08*D;
          // Over max (customers decreased, subs now > maxSubs)
          if(currentSubs>maxSubs)churnRate+=.15*D;
          const toRemove=Math.floor(currentSubs*churnRate)+(Math.random()<(currentSubs*churnRate%1)?1:0);
          if(toRemove>0)b.svcSubs[sid]=Math.max(0,currentSubs-toRemove);
        }

        // Cleanup zero subs
        if(b.svcSubs[sid]<=0)delete b.svcSubs[sid];
      }
      // Remove subs for services no longer active
      for(const sid in b.svcSubs){
        if(!G.services.includes(sid)){delete b.svcSubs[sid];}
      }
    }
  }

  // ====== CLOUD CUSTOMER DEMAND TICK (daily) ======
  cloudDemandTick(D);
}

function cloudDemandTick(D){
  if(!G.cloudInstances||!G.cloudInstances.length)return;
  if(!G.cloudCustomers)G.cloudCustomers={};

  // Calculate total cloud capacity
  let totalCPU=0,totalRAM=0,totalStorage=0;
  for(const dc of G.dcs){
    const comp=getDCCompute(G.dcs.indexOf(dc));
    totalCPU+=comp.vCPU;totalRAM+=comp.ram;
    const st=getDCStorage(G.dcs.indexOf(dc));
    totalStorage+=st.total;
  }
  if(totalCPU<=0&&totalStorage<=0)return;

  // Calculate used capacity
  let usedCPU=0,usedRAM=0,usedStorage=0;
  for(const ci of G.cloudInstances){
    const cp=CLOUD_PRICING[ci.type];if(!cp)continue;
    if(cp.vCPU){usedCPU+=cp.vCPU*ci.count;usedRAM+=cp.ramGB*ci.count;}
    if(cp.storageTB)usedStorage+=cp.storageTB*ci.count;
  }

  const cpuUtil=totalCPU>0?usedCPU/totalCPU:0;
  const storUtil=totalStorage>0?usedStorage/totalStorage:0;
  const overallUtil=Math.max(cpuUtil,storUtil);

  // SLA quality — check if any DC has outage
  const sla=SLA_TIERS.find(s=>s.id===G.cloudSLA)||SLA_TIERS[0];
  let dcOutageCount=0;
  for(const dc of G.dcs){if(dc.outage&&dc.outage.active)dcOutageCount++;}
  const slaOK=dcOutageCount===0;
  // Track cumulative outage-days in current month (for monthly SLA credit reconciliation)
  if(!slaOK)G.cloudOutageDaysM=(G.cloudOutageDaysM||0)+D;

  // Check DC has required SLA equipment
  let slaEqMet=true;
  if(sla.reqEq.length>0){slaEqMet=anyDCHasEq(sla.reqEq);}

  // ==== Globální boosty & odpory ====
  // Marketing upgrady ovlivňují i cloud růst (stejně jako ISP zákazníky)
  let mktBoost=1.0;
  if(G.upgrades.includes('marketing1'))mktBoost+=0.15;
  if(G.upgrades.includes('marketing2'))mktBoost+=0.25;
  if(G.upgrades.includes('marketing3'))mktBoost+=0.30;
  if(G.upgrades.includes('brand1'))mktBoost+=0.08;
  if(G.upgrades.includes('brand2'))mktBoost+=0.05;
  // Dev tým přidá organický růst cloudu (lepší produkt = lepší reference)
  const devCount=(typeof getStaffEffect==='function')?getStaffEffect('dev'):0;
  const devBoost=1+Math.min(0.40,devCount*0.025);
  // Support tým sníží churn a zvýší satisfaction
  const supCount=(typeof getStaffEffect==='function')?getStaffEffect('support'):0;
  const supChurnRed=Math.min(0.35,supCount*0.03);
  const supSatBonus=Math.min(3.0,supCount*0.15); // bonus per day

  // Konkurenční tlak (jen pokud hráč má zapnuté AI competitory)
  let compPressure=1.0;
  if(G.competitorsEnabled&&G.competitors&&G.competitors.length){
    // Více a silnější AI = větší tlak (míň volného cloud trhu)
    const compTotal=G.competitors.reduce((s,c)=>s+(c.customers||0),0);
    compPressure=Math.max(0.55,1.0-compTotal/200000); // při 200k AI zákaznících -45%
  }

  // Reputace ovlivňuje růstový koeficient (0-100, neutral=60)
  const rep=G.cloudReputation||60;
  const repFactor=Math.max(0.35,Math.min(1.25,0.35+rep/80));

  // Price attractiveness
  const priceMult=G.cloudPriceMult||1.0;

  for(const seg of CLOUD_SEGMENTS){
    if(!G.cloudCustomers[seg.id])G.cloudCustomers[seg.id]={count:0,satisfaction:50,lastGrowth:0};
    const cs=G.cloudCustomers[seg.id];

    // Max potential customers based on capacity and year progression × konkurenční tlak
    const yearProgress=Math.max(0,G.date.y-2008);
    let marketSize=Math.floor((5+yearProgress*3+totalCPU*0.3+totalStorage*2)*compPressure);
    if(marketSize<1)marketSize=1;

    // SLA attractiveness for this segment
    const prefSLA=SLA_TIERS.findIndex(s=>s.id===seg.slaPref);
    const curSLA=SLA_TIERS.findIndex(s=>s.id===G.cloudSLA);
    let slaFactor=1.0;
    if(curSLA>=prefSLA)slaFactor=1.0+0.1*(curSLA-prefSLA);
    else slaFactor=Math.max(0.2,1.0-0.3*(prefSLA-curSLA));
    if(!slaEqMet)slaFactor*=0.5;

    // Price sensitivity
    let priceFactor=1.0;
    const effPrice=priceMult*sla.priceMult;
    if(effPrice<0.8)priceFactor=1.4;
    else if(effPrice<0.95)priceFactor=1.15;
    else if(effPrice<1.15)priceFactor=1.0;
    else if(effPrice<1.4)priceFactor=0.6;
    else if(effPrice<1.8)priceFactor=0.25;
    else priceFactor=0.05;
    priceFactor=Math.pow(priceFactor,seg.priceSens);

    // Capacity factor — hard to grow if already near full; >85% means "waitlist" (nulový růst)
    let capFactor=1.0;
    if(overallUtil>0.6)capFactor=1.0-(overallUtil-0.6)*1.5;
    if(overallUtil>0.85)capFactor*=0.2; // ostrá brzda na plné kapacitě
    if(overallUtil>0.95)capFactor=0;    // plně zahlceno — žádní noví
    capFactor=Math.max(0,capFactor);

    // Growth — nově s marketing/dev/rep faktory
    if(cs.count<marketSize&&capFactor>0){
      const freeSlots=marketSize-cs.count;
      const growthRate=seg.growthBase*slaFactor*priceFactor*capFactor
        *(0.5+cs.satisfaction/200)*mktBoost*devBoost*repFactor;
      const dailyNew=growthRate*freeSlots*D;
      const toAdd=Math.floor(dailyNew)+(Math.random()<(dailyNew%1)?1:0);
      if(toAdd>0){cs.count=Math.min(marketSize,cs.count+toAdd);cs.lastGrowth=toAdd;}
    }

    // Churn — Support tým redukce, špatná reputace přidává
    if(cs.count>0){
      let churnRate=seg.churnBase*D;
      if(effPrice>1.2)churnRate+=.02*(effPrice-1.2)*D*seg.priceSens;
      if(effPrice>1.6)churnRate+=.05*(effPrice-1.0)*D*seg.priceSens;
      if(!slaOK)churnRate+=.08*D;
      if(!slaEqMet)churnRate+=.03*D;
      if(overallUtil>0.9)churnRate+=.06*(overallUtil-0.9)*10*D;
      if(cs.satisfaction<30)churnRate+=.04*D;
      if(cs.satisfaction<15)churnRate+=.10*D;
      // Reputace < 40 = churn +3%/den, < 20 = +8%/den (spirála smrti)
      if(rep<40)churnRate+=(40-rep)/40*0.03*D;
      if(rep<20)churnRate+=(20-rep)/20*0.05*D;
      // Support redukce
      churnRate*=(1-supChurnRed);
      // brand2 redukce (už existující loyalty upgrade)
      if(G.upgrades.includes('brand2'))churnRate*=0.75;
      const toRemove=Math.floor(cs.count*churnRate)+(Math.random()<(cs.count*churnRate%1)?1:0);
      if(toRemove>0){cs.count=Math.max(0,cs.count-toRemove);}
    }

    // Satisfaction
    let satDelta=0.5*D+supSatBonus*D;
    if(!slaOK)satDelta-=8*D;
    if(!slaEqMet)satDelta-=2*D;
    if(overallUtil>0.85)satDelta-=(overallUtil-0.85)*20*D;
    if(effPrice>1.3)satDelta-=(effPrice-1.3)*5*D;
    if(effPrice<0.9)satDelta+=(0.9-effPrice)*3*D;
    // Reputace přidává/odebírá malý drift
    satDelta+=(rep-60)/60*0.5*D;
    cs.satisfaction=Math.min(100,Math.max(0,cs.satisfaction+satDelta));
  }

  // Reputační denní drift — zlepšuje se pomalu při stabilním provozu, hroutí se rychle při výpadku
  if(slaOK&&slaEqMet){
    G.cloudReputation=Math.min(100,(G.cloudReputation||60)+0.12*D);
  } else if(!slaOK){
    G.cloudReputation=Math.max(0,(G.cloudReputation||60)-2.5*D);
  } else if(!slaEqMet){
    G.cloudReputation=Math.max(0,(G.cloudReputation||60)-0.4*D);
  }
}

function monthUp(){
  calcCapacity();
  // NOC staff reduces outage chance
  const nocEffect=getStaffEffect('noc');
  const outageReduction=nocEffect>0?nocEffect*.25:0;
  if(Math.random()>outageReduction)checkRandomOutages();
  // New: monthly incident roll replaces some legacy outages
  try{if(typeof incidentMonthlyRoll==='function')incidentMonthlyRoll();}catch(e){console.error('incidentMonthlyRoll:',e);}
  // Tech staff speeds up repairs
  const techEffect=getStaffEffect('repair');
  if(techEffect>0){for(const dc of G.dcs){if(dc.outage&&dc.outage.active){dc.outage.remaining=Math.max(1,Math.round(dc.outage.remaining*(1-techEffect*.2)));}}}
  updateOutages();

  let inc=0,cust=0;
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;
    if(!b||!b.connected||b.customers<=0)continue;
    const dc=G.dcs[b.dcIdx];
    const isOutage=dc&&dc.outage&&dc.outage.active;
    const hasUPS=dc&&dc.eq&&dc.eq.includes('eq_ups');
    let bldRev=calcBldRevenue(b);
    if(isOutage)bldRev=Math.round(bldRev*(hasUPS?0.5:0));
    inc+=bldRev;
    cust+=b.customers;
  }

  // Service revenue: from actual subscribers (not flat adopt rate)
  for(const sid of(G.services||[])){
    const svc=SERVICES.find(s=>s.id===sid);if(!svc)continue;
    const svcPrice=G.svcPrices?.[sid]||svc.revPerCust;
    for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
      const b=G.map[y][x].bld;
      if(!b||!b.connected||!b.svcSubs)continue;
      const subs=b.svcSubs[sid]||0;
      if(subs>0)inc+=subs*svcPrice;
    }
  }

  // Business tenant revenue
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;
    if(!b||!b.connected||!b.bizTenants||!b.bizTenants.length)continue;
    for(const tid of b.bizTenants){
      const bt=BIZ_TENANTS.find(t=>t.id===tid);
      if(bt)inc+=bt.revMonth;
    }
  }

  // Provozní náklady HW jsou ovlivněny componentInflation (roste zlomkem CPI).
  // Sčítáme surově a na konci vynásobíme jedním multiplikátorem, ať se to
  // projeví konzistentně napříč všemi kategoriemi techniky.
  let hwExp=0;
  for(const dc of G.dcs){
    hwExp+=DC_T[dc.type].mCost;
    for(const eq of(dc.eq||[]))hwExp+=EQ[eq].mCost;
    for(const bwu of(dc.bwUpgrades||[]))hwExp+=bwu.mCost;
  }
  for(const cb of G.cables)hwExp+=CAB_T[cb.t].mCost;
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;
    if(b&&b.connected&&b.connType&&CONN_T[b.connType])hwExp+=CONN_T[b.connType].mCost;
  }
  for(const sid of(G.services||[])){
    const svc=SERVICES.find(s=>s.id===sid);
    if(svc)hwExp+=svc.mCost;
  }
  for(const ap of G.wifiAPs){
    const wt=WIFI_T[ap.type];
    hwExp+=wt.mCost;
  }
  // IP block costs
  for(const blk of(G.ipBlocks||[]))hwExp+=blk.mCost;
  let exp=inflComponentCost(hwExp);
  // Per-customer servisní náklady (25 Kč/zák.) = support/billing/SG&A.
  // Rostou se salaryInflation — je to primárně lidský náklad (call centrum, fakturace, NOC).
  exp+=inflSalaryCost(cust*25);
  // Cloud revenue — from actual cloud customers (real customers × demand mix × inflation × reputation)
  const cloudRev=calcCloudRevenue();
  inc+=cloudRev;
  // Cloud operational cost — per-instance mCost × inflace − dev automatizace
  const cloudOp=(typeof calcCloudOpCost==='function')?calcCloudOpCost():0;
  exp+=cloudOp;

  // SLA credit — real refund based on actual outage days in the month and contracted uptime
  const slaTier=SLA_TIERS.find(s=>s.id===G.cloudSLA)||SLA_TIERS[0];
  if(slaTier.penaltyPct>0&&cloudRev>0){
    const outageDays=G.cloudOutageDaysM||0;
    const allowedDays=(1-slaTier.uptime)*30; // "měsíční povolený downtime" dle uptime cíle
    const excess=Math.max(0,outageDays-allowedDays);
    if(excess>0){
      // Credit = (nadměrný downtime / 30 dnů) × tier multiplier × cloudRev
      // Cap na penaltyPct × 3 (enterprise tier může jít i na 150% při dlouhém výpadku)
      const creditPct=Math.min(slaTier.penaltyPct*3, (excess/30)*slaTier.penaltyPct*10);
      const credit=Math.round(cloudRev*creditPct);
      exp+=credit;
      G.cloudSLACreditM=credit;
      if(credit>0)notify(`⚠️ SLA credit ${fmtKc(credit)} vrácen cloudovým zákazníkům (${outageDays.toFixed(1)} dní výpadku vs. ${allowedDays.toFixed(1)} povoleno)`,'bad');
      // Reputace trpí proporcionálně (excess dny × tier závažnost)
      G.cloudReputation=Math.max(0,(G.cloudReputation||60)-excess*slaTier.penaltyPct*15);
    } else {
      G.cloudSLACreditM=0;
    }
  } else {
    G.cloudSLACreditM=0;
  }
  // Reset měsíčního počítadla výpadků pro příští měsíc
  G.cloudOutageDaysM=0;
  // Employee salaries — zvlášť scaled přes salaryInflation
  let salExp=0;
  for(const em of(G.employees||[])){const st=STAFF_T[em.type];if(st)salExp+=st.cost*em.count;}
  exp+=inflSalaryCost(salExp);
  // Tower + junction + IXP maintenance jsou HW → componentInflation
  let hwExtra=0;
  for(const tw of(G.towers||[])){const tt=TOWER_T[tw.type];if(tt)hwExtra+=tt.mCost;}
  if(typeof JUNCTION_T!=='undefined'){
    for(const j of(G.junctions||[])){const jt=JUNCTION_T[j.type];if(jt)hwExtra+=jt.mCost;}
  }
  if(G.hasIXP)hwExtra+=IXP.mCost;
  exp+=inflComponentCost(hwExtra);
  // Dark fiber revenue
  if(G.darkFiber&&G.darkFiber.length)inc+=G.darkFiber.length*DARK_FIBER.revenuePerSeg;

  let cr=0;
  if(G.upgrades.includes('auto1'))cr+=.15;
  if(G.upgrades.includes('wholesale1'))cr+=.2;
  exp=Math.round(exp*(1-cr));

  G.cash+=inc-exp;
  G.stats.inc=inc;
  G.stats.exp=exp;
  G.stats.cust=cust;
  G.stats.hist.push({d:`${G.date.m+1}/${G.date.y}`,i:inc,e:exp,c:cust,cash:G.cash});
  if(G.stats.hist.length>36)G.stats.hist.shift();

  // Monthly: population growth, migration, events
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;if(!b)continue;
    if(b.pop<b.maxPop&&Math.random()<BTYPES[b.type].growth)b.pop++;
    if(Math.random()<.003&&b.pop>BTYPES[b.type].pop[0])b.pop--;
  }

  handleCustomerMigration();
  // Business tenant spawning (every 3 months)
  if(G.date.m%3===0)spawnBizTenants();
  if(G.upgrades.includes('brand1')&&Math.random()<.05)boostDemand(.05);
  if(Math.random()<.08)randEvent();
  if(G.cash<-200000)notify('⚠️ Bankrot!','bad');
  // Investor system: check if player needs bailout
  if(G.cash<-50000&&!G.investor)checkInvestorOffer();
  let anyOvr=false;
  for(const dl of dcLoads){if(dl.ratio>.9){anyOvr=true;break;}}
  if(!anyOvr)for(const k in segLoads){if(segLoads[k].ratio>.9){anyOvr=true;break;}}
  if(anyOvr&&Math.random()<.3)notify('⚠️ Síť přetížená! Kupte BW nebo stackujte kabely.','bad');
  // Track survived outages
  for(const dc of G.dcs){if(dc.outage&&!dc.outage.active&&G.stats.cust>0)G.survivedOutage=true;}
  // Monthly checks (wrapped to prevent single failure from breaking game)
  try{checkAchievements();}catch(e){console.error('checkAchievements:',e);}
  try{checkContracts();}catch(e){console.error('checkContracts:',e);}
  try{checkGeneratedContracts();}catch(e){console.error('checkGeneratedContracts:',e);}
  try{if(typeof checkBindingContracts==='function')checkBindingContracts();}catch(e){console.error('checkBindingContracts:',e);}
  // Offer new contracts every 6 months
  if(G.date.m%6===0)try{offerNewContracts();}catch(e){console.error('offerNewContracts:',e);}
  // Binding offers: refresh každé 4 měsíce
  if(G.date.m%4===0)try{if(typeof offerNewBindings==='function')offerNewBindings();}catch(e){console.error('offerNewBindings:',e);}
  try{updateCompanyRating();}catch(e){console.error('updateCompanyRating:',e);}
  try{aiCompetitorTick();}catch(e){console.error('aiCompetitorTick:',e);}
  // Finance monthly tick: loan payments + credit rating + quarterly report
  try{if(typeof financeMonthlyTick==='function')financeMonthlyTick();}catch(e){console.error('financeMonthlyTick:',e);}
  // Staff morale / XP / training budget deduction
  try{if(typeof staffMonthlyTick==='function')staffMonthlyTick();}catch(e){console.error('staffMonthlyTick:',e);}
  // DDoS events (occasional, separate from random events)
  if(Math.random()<.04&&G.dcs.length>0)try{triggerDDoS(Math.floor(Math.random()*G.dcs.length));}catch(e){console.error('triggerDDoS:',e);}
  updUI();
}

function yearUp(){
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;
    if(b){
      if(!b.want&&Math.random()<.2)b.want=true;
      if(b.pop<b.maxPop)b.pop+=Math.floor(Math.random()*3);
    }
  }
  let added=0;
  for(let a=0;a<300&&added<6;a++){
    const x=Math.floor(Math.random()*MAP),y=Math.floor(Math.random()*MAP);
    if(G.map[y][x].type==='grass'&&!G.map[y][x].bld&&nb(x,y).some(([ax,ay])=>ax>=0&&ax<MAP&&ay>=0&&ay<MAP&&G.map[ay][ax].type==='road')){
      const dc=Math.sqrt((x-MAP/2)**2+(y-MAP/2)**2);let bt;
      if(dc<8){const r=Math.random();bt=r<.3?'skyscraper':r<.5?'bigcorp':'panel';}
      else{const r=Math.random();bt=r<.35?'house':r<.55?'rowhouse':r<.75?'panel':'shop';}
      const b=BTYPES[bt],units=b.units[0]+Math.floor(Math.random()*(b.units[1]-b.units[0]+1)),pop=b.pop[0]+Math.floor(Math.random()*(b.pop[1]-b.pop[0]+1));
      G.map[y][x].bld={type:bt,units,pop,maxPop:Math.round(pop*1.5),connected:false,connType:null,customers:0,sat:0,tariff:null,want:Math.random()<b.demand,dcIdx:-1,svcSubs:{}};
      added++;
    }
  }
  if(added>0)notify(`🏗️ Město roste! +${added} budov`,'good');
  // Tower coverage: buildings in range of towers auto-connect if not connected
  for(const tw of(G.towers||[])){
    const tt=TOWER_T[tw.type];if(!tt)continue;
    for(let dy=-tt.range;dy<=tt.range;dy++)for(let dx=-tt.range;dx<=tt.range;dx++){
      const bx=tw.x+dx,by=tw.y+dy;
      if(bx<0||bx>=MAP||by<0||by>=MAP)continue;
      if(Math.abs(dx)+Math.abs(dy)>tt.range)continue;
      const b=G.map[by][bx].bld;
      if(!b||b.connected||!b.want)continue;
      // Auto-connect via tower — connection type matches tower capability
      const di=tw.dcIdx;if(di<0||di>=G.dcs.length)continue;
      const dc=G.dcs[di];if(!dcHasRouter(dc))continue;
      const twConn=tt.maxBW>=8000?'conn_5g_mmw':tt.maxBW>=500?'conn_5g':tt.maxBW>=200?'conn_lte_a':'conn_lte';
      b.connected=true;b.connType=twConn;b.dcIdx=di;b.tariffDist={};b.customers=0;b.sat=50;if(!b.svcSubs)b.svcSubs={};
      G.conns.push({bx,by,di});
    }
  }
  for(let i=G.tech+1;i<TECHS.length;i++){if(G.date.y>=TECHS[i].year){notify(`🔬 ${TECHS[i].name} dostupná!`,'good');break;}}
  // Generate new contracts annually (1-3 new offers)
  try{offerNewContracts();}catch(e){console.error('yearUp offerNewContracts:',e);}
  try{if(typeof offerNewBindings==='function')offerNewBindings();}catch(e){console.error('yearUp offerNewBindings:',e);}
  // Investor year-end check: dividend decision
  try{investorYearCheck();}catch(e){console.error('investorYearCheck:',e);}
  // Annual inflation / finance yearly effects
  try{if(typeof financeYearlyTick==='function')financeYearlyTick();}catch(e){console.error('financeYearlyTick:',e);}
}

window.addEventListener('load',()=>{
  initRender();
  initInput();
  // Initialize WebGL FX overlay (safe — fails silently if PIXI missing)
  if(typeof initPixiFx==='function')initPixiFx();
  updateSpeedButtons();
  updateToolButtons();
  showNewGame();
});
