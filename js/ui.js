// ====== UI UPDATES ======

function updDate(){
  const d=G.date,day=d.d,month=MO[d.m],year=d.y;
  document.getElementById('dateDisplay').textContent=`${day}. ${month} ${year}`;
}

function fmt(n){return new Intl.NumberFormat('cs-CZ').format(Math.round(n));}
function fmtKc(n){return fmt(n)+' Kč';}
function fmtBW(n){if(n>=1000000)return(n/1000000).toFixed(1)+' Tbps';if(n>=1000)return(n/1000).toFixed(1)+' Gbps';return n.toFixed(0)+' Mbps';}
// refPrice is in capacity.js

// Lightweight stats update — called every day (cheap, no DOM list rebuilds)
function updStats(){
  if(!G)return;
  let pop=0,bldCount=0,connCount=0,cust=0,satSum=0,satN=0;
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;if(!b)continue;pop+=b.pop;bldCount++;
    if(b.connected){connCount++;cust+=b.customers;satSum+=b.sat;satN++;}
  }
  document.getElementById('sCash').textContent=fmtKc(G.cash);
  document.getElementById('sCash').className='v '+(G.cash>=0?'pos':'neg');
  document.getElementById('sCst').textContent=fmt(cust);
  document.getElementById('sCov').textContent=bldCount>0?Math.round(connCount/bldCount*100)+'%':'0%';
  document.getElementById('sSat').textContent=satN>0?Math.round(satSum/satN)+'%':'–';
  document.getElementById('sPop').textContent=fmt(pop);
  document.getElementById('moneyDisplay').textContent=fmtKc(G.cash);
  document.getElementById('popDisplay').textContent='👥 '+fmt(pop);

  const dcTotal=dcLoads.reduce((s,dl)=>s+dl.maxBW,0);
  const dcUsed=dcLoads.reduce((s,dl)=>s+dl.usedBW,0);
  document.getElementById('sBwDC').textContent=fmtBW(dcUsed)+'/'+fmtBW(dcTotal);
  const dcRatio=dcTotal>0?dcUsed/dcTotal:0;
  document.getElementById('sBwDC').className='v '+(dcRatio>.9?'neg':dcRatio>.7?'warn':'pos');
  const dcBar=document.getElementById('bwBar');
  dcBar.style.width=Math.min(100,dcRatio*100)+'%';
  dcBar.className='fill '+(dcRatio>.95?'crit':dcRatio>.7?'warn':'ok');
  document.getElementById('bwDisplay').textContent='📡 '+fmtBW(dcUsed)+'/'+fmtBW(dcTotal);

  let worstRatio=0,worstName='–';
  for(const k in segLoads){const s=segLoads[k];if(s.ratio>worstRatio){worstRatio=s.ratio;worstName=s.types.map(t=>CAB_T[t]?.name||t).join('+')+' '+Math.round(s.ratio*100)+'%';}}
  document.getElementById('sWorst').textContent=worstRatio>0?worstName:'–';
  document.getElementById('sWorst').className='v '+(worstRatio>.9?'neg':worstRatio>.7?'warn':'');

  let congSum=0,congCnt=0;
  for(const k in segLoads){congSum+=segLoads[k].ratio;congCnt++;}
  document.getElementById('sCong').textContent=congCnt>0?Math.round(congSum/congCnt*100)+'%':'0%';
}

// Full UI update — called monthly + on player actions (rebuilds all lists)
// Přepočítá popisky cen v levé stavební paletě podle aktuální componentInflation.
// Původní popisky jsou zadrátované v index.html, takže si je při prvním běhu
// odložíme do data-atributů a potom jen překreslíme cenovou část.
function refreshBuildPaletteCosts(){
  const infl=(G&&G.componentInflation)||1;
  const showPct=infl>1.005;
  const pct=Math.round((infl-1)*100);
  const toolToCost={};
  // Sesbíráme základní ceny z konstant
  for(const k in (typeof DC_T!=='undefined'?DC_T:{}))toolToCost[k]=DC_T[k].cost;
  for(const k in (typeof CAB_T!=='undefined'?CAB_T:{}))toolToCost[k]=CAB_T[k].cost;
  for(const k in (typeof TOWER_T!=='undefined'?TOWER_T:{}))toolToCost[k]=TOWER_T[k].cost;
  if(typeof JUNCTION_T!=='undefined')for(const k in JUNCTION_T)toolToCost[k]=JUNCTION_T[k].cost;
  if(typeof CONN_T!=='undefined')for(const k in CONN_T)toolToCost[k]=CONN_T[k].cost;
  const btns=document.querySelectorAll('button.bb[data-tool]');
  btns.forEach(btn=>{
    const tool=btn.getAttribute('data-tool');
    const base=toolToCost[tool];
    if(!base)return;
    const cs=btn.querySelector('.cs');
    if(!cs)return;
    // Při prvním průchodu uložíme původní text (s jednotkami typu "/seg · kap. …")
    if(!cs.dataset.orig)cs.dataset.orig=cs.textContent;
    const orig=cs.dataset.orig;
    // Najdeme první výskyt "… Kč" v původním textu a nahradíme aktuální cenou.
    const m=orig.match(/^([\s\S]*?)(\d[\d\s\u00a0]*Kč)([\s\S]*)$/);
    if(!m){return;}
    const actual=Math.round(base*infl);
    const newPrice=fmtKc(actual)+(showPct?` (↑${pct}%)`:'');
    cs.textContent=m[1]+newPrice+m[3];
  });
}

function updUI(){
  if(!G)return;
  updDate();
  calcCapacityIfDirty();
  refreshBuildPaletteCosts();

  // Stats
  updStats();
  document.getElementById('sInc').textContent=fmtKc(G.stats.inc);
  document.getElementById('sExp').textContent=fmtKc(G.stats.exp);
  const pro=G.stats.inc-G.stats.exp;
  const proEl=document.getElementById('sPro');
  proEl.textContent=fmtKc(pro);
  proEl.className='v '+(pro>=0?'pos':'neg');

  document.getElementById('sTech').textContent=TECHS[G.tech].name;
  document.getElementById('sSpd').textContent=fmtBW(TECHS[G.tech].speed);

  // Inflation row — zobrazuje kumulativní % nárůst proti výchozímu 1.0.
  // Při čerstvé hře je to 0 %, po letech roste.
  const infEl=document.getElementById('sInfl');
  if(infEl){
    const cpi=((G.inflation||1)-1)*100;
    const sal=((G.salaryInflation||1)-1)*100;
    const hw=((G.componentInflation||1)-1)*100;
    const tar=((G.tariffInflation||1)-1)*100;
    infEl.textContent=`CPI +${cpi.toFixed(1)}% (mzdy +${sal.toFixed(1)}% · HW +${hw.toFixed(1)}% · tarify +${tar.toFixed(1)}%)`;
  }

  // Tech upgrade button
  const upCostEl=document.getElementById('upCost');
  const upDescEl=document.getElementById('upDesc');
  if(G.tech<TECHS.length-1){
    const t=TECHS[G.tech+1];
    upCostEl.textContent=fmtKc(t.cost)+(G.date.y<t.year?' [od '+t.year+']':'');
    upDescEl.textContent='→ '+t.name+' (max '+fmtBW(t.speed)+')';
  } else {
    upCostEl.textContent='–';
    upDescEl.textContent='Nejnovější technologie!';
  }

  buildBWList();
  buildTariffTable();
  buildSvcList();
  buildCloudTab();
  buildUpgradeList();
  buildStaffList();
  buildContractList();
  if(typeof buildBindingList==='function')buildBindingList();
  buildAchList();
  buildRatingDisplay();
  buildMarketShareDisplay();
  buildKPIDashboard();
  buildRevenueChart();
  buildIXPStatus();
  buildCityList();
  if(typeof buildMapExpandPanel==='function')buildMapExpandPanel();
  buildIPOStatus();
  try{buildMgmtTab();}catch(e){console.error('buildMgmtTab:',e);}
}

// ====== BW / DC TAB ======
function buildBWList(){
  const list=document.getElementById('bwDCList');list.innerHTML='';
  if(!G.dcs.length){list.innerHTML='<p style="font-size:10px;color:#484f58;padding:8px">Postav první datové centrum ve záložce Stavba</p>';return;}

  for(let di=0;di<G.dcs.length;di++){
    const dc=G.dcs[di],dt=DC_T[dc.type],load=dcLoads[di]||{usedBW:0,maxBW:dt.baseBW,ratio:0};
    let maxBW=dt.baseBW;for(const u of(dc.bwUpgrades||[]))maxBW+=u.bw;
    const isSel=selDC===di;
    const isOut=dc.outage&&dc.outage.active;
    const eqs=dc.eq||[];
    let maxSlots=dt.slots;for(const e of eqs){if(EQ[e]&&EQ[e].eff==='cooling')maxSlots+=EQ[e].val;}

    const div=document.createElement('div');
    div.style.cssText='background:#0d1117;border:1px solid '+(isSel?'#7c3aed':isOut?'#f85149':'#21262d')+';border-radius:6px;padding:8px;margin-bottom:6px;cursor:pointer;transition:.15s';
    div.onclick=()=>{selDC=(selDC===di?null:di);updUI();};

    let h=`<div style="display:flex;justify-content:space-between;align-items:center">`;
    h+=`<span style="font-size:11px;font-weight:600;color:${isOut?'#f85149':'#00d4ff'}">${isOut?'⚠️ ':''}${dt.name} #${di+1}</span>`;
    h+=`<div style="display:flex;gap:4px;align-items:center"><button onclick="event.stopPropagation();openDCModal(${di})" style="padding:2px 8px;background:#1a1040;border:1px solid #7c3aed;border-radius:4px;color:#a78bfa;cursor:pointer;font-size:8px" onmouseover="this.style.background='#7c3aed';this.style.color='#fff'" onmouseout="this.style.background='#1a1040';this.style.color='#a78bfa'">🔧 Otevřít</button><span style="font-size:9px;color:#8b949e">[${dc.x},${dc.y}]</span></div></div>`;

    // Outage status
    if(isOut)h+=`<div style="color:#f85149;font-size:9px;margin:2px 0">🔴 VÝPADEK: ${dc.outage.cause} (${dc.outage.remaining} dní)</div>`;

    // BW bar
    const ratio=load.ratio,ratioP=Math.round(ratio*100);
    const clr=ratio>.95?'#f85149':ratio>.7?'#f59e0b':'#3fb950';
    const effBW=load.maxBW||maxBW;
    const bgpTxt=(load.sharedIn>0?` +${fmtBW(load.sharedIn)} BGP`:load.sharedOut>0?` →${fmtBW(load.sharedOut)} BGP`:'');
    h+=`<div style="font-size:9px;color:#8b949e;margin:3px 0">BW: <b style="color:${clr}">${fmtBW(load.usedBW)} / ${fmtBW(effBW)}</b> (${ratioP}%)${bgpTxt?`<span style="color:#a78bfa;font-size:8px">${bgpTxt}</span>`:''}</div>`;
    h+=`<div class="cap-bar"><div class="fill ${ratio>.95?'crit':ratio>.7?'warn':'ok'}" style="width:${Math.min(100,ratioP)}%"></div></div>`;

    // Rack slots + network capacity
    const netCap=getDCNetCapacity(di);
    const portClr=netCap.usedPorts>=netCap.totalPorts?'#f85149':netCap.usedPorts>=netCap.totalPorts*.8?'#f59e0b':'#8b949e';
    const routClr=netCap.usedConns>=netCap.routerCap?'#f85149':netCap.usedConns>=netCap.routerCap*.8?'#f59e0b':'#8b949e';
    h+=`<div style="font-size:9px;color:#8b949e;margin:2px 0">Rack: ${eqs.length}/${maxSlots} · Porty: <b style="color:${portClr}">${netCap.usedPorts}/${netCap.totalPorts}</b> · Router: <b style="color:${routClr}">${netCap.usedConns}/${netCap.routerCap}</b></div>`;
    // Overload warnings
    const warnings=[];
    if(ratio>.95)warnings.push('⚠️ BW přetížení!');
    if(netCap.usedPorts>=netCap.totalPorts)warnings.push('🔌 Plné porty!');
    if(netCap.routerCap>0&&netCap.usedConns>=netCap.routerCap)warnings.push('📡 Router plný!');
    if(netCap.routerCap===0)warnings.push('📡 Chybí router!');
    if(eqs.length>=maxSlots)warnings.push('🔧 Rack plný!');
    if(warnings.length)h+=`<div style="font-size:9px;color:#f85149;background:#1a0a0a;border:1px solid #f8514933;border-radius:4px;padding:3px 6px;margin:3px 0">${warnings.join(' · ')}</div>`;

    // Equipment icons
    if(eqs.length){
      h+='<div style="margin:3px 0">';
      const counts={};for(const e of eqs)counts[e]=(counts[e]||0)+1;
      for(const e in counts){
        const eq=EQ[e];if(!eq)continue;
        h+=`<span style="display:inline-block;padding:1px 4px;background:#1a1040;border:1px solid #30363d;border-radius:3px;font-size:8px;margin:1px" title="${eq.name}">${eq.icon}${counts[e]>1?'×'+counts[e]:''}</span>`;
      }
      h+='</div>';
    }

    // DC links + BGP peerings
    const dcLinks=(G.dcLinks||[]).filter(l=>l.dc1===di||l.dc2===di);
    const dcPeerings=(G.bgpPeerings||[]).filter(p=>p.dc1===di||p.dc2===di);
    if(dcLinks.length){
      h+=`<div style="font-size:8px;color:#a78bfa;margin:2px 0">🔗 ${dcLinks.map(l=>'DC#'+(l.dc1===di?l.dc2+1:l.dc1+1)).join(', ')}`;
      if(dcPeerings.length)h+=` · <span style="color:#3fb950">${dcPeerings.length} BGP</span>`;
      h+=`</div>`;
    }

    // Expanded view when selected
    if(isSel){
      h+=`<div style="border-top:1px solid #21262d;margin-top:6px;padding-top:6px">`;

      // Installed equipment detail
      h+=`<div style="font-size:9px;font-weight:600;color:#a78bfa;margin-bottom:4px">Instalované vybavení:</div>`;
      if(eqs.length){
        for(const e of eqs){
          const eq=EQ[e];if(!eq)continue;
          h+=`<div style="display:flex;justify-content:space-between;padding:2px 4px;background:#161b22;border-radius:3px;margin:1px 0;font-size:9px">`;
          h+=`<span>${eq.icon} ${eq.name}</span><span style="color:#8b949e">${fmtKc(eq.mCost)}/m</span></div>`;
        }
      } else {
        h+=`<div style="font-size:9px;color:#484f58">Žádné vybavení – vyber typ z tabu DC a klikni na mapu</div>`;
      }

      // Storage & Compute stats
      const stInfo=getDCStorage(di);
      const compInfo=getDCCompute(di);
      if(stInfo.total>0||compInfo.vCPU>0){
        h+=`<div style="font-size:9px;font-weight:600;color:#22d3ee;margin:6px 0 3px">Cloud kapacita:</div>`;
        if(compInfo.vCPU>0)h+=`<div style="font-size:9px;color:#8b949e">☁️ CPU: ${compInfo.usedCPU}/${compInfo.vCPU} vCPU · RAM: ${compInfo.usedRAM}/${compInfo.ram} GB</div>`;
        if(stInfo.total>0)h+=`<div style="font-size:9px;color:#8b949e">💿 Storage: ${stInfo.used.toFixed(1)}/${stInfo.total} TB</div>`;
      }

      // Missing critical equipment warnings
      const missing=[];
      if(!dcHasRouter(dc))missing.push('📡 Router (povinný!)');
      if(!eqs.includes('eq_ups'))missing.push('🔋 UPS (ochrana proti výpadkům)');
      if(!eqs.includes('eq_monitoring'))missing.push('📊 NMS (prevence výpadků)');
      if(missing.length){
        h+=`<div style="margin-top:4px;padding:4px;background:#1a0a0a;border:1px solid #f85149;border-radius:3px;font-size:8px;color:#f85149">`;
        h+=`⚠️ Chybí: ${missing.join(' · ')}</div>`;
      }

      // Active BW upgrades with remove buttons
      if((dc.bwUpgrades||[]).length){
        h+=`<div style="font-size:9px;font-weight:600;color:#f59e0b;margin:8px 0 4px">Aktivní transit:</div>`;
        for(let bwi=0;bwi<dc.bwUpgrades.length;bwi++){
          const bwu=dc.bwUpgrades[bwi];
          h+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 4px;background:#1a1a0a;border:1px solid #33300a;border-radius:3px;margin:1px 0;font-size:9px">`;
          h+=`<span>📡 +${fmtBW(bwu.bw)} · ${fmtKc(bwu.mCost)}/m</span>`;
          h+=`<button onclick="event.stopPropagation();removeBW(${di},${bwi})" style="padding:1px 4px;background:#1a0a0a;border:1px solid #f85149;border-radius:3px;color:#f85149;cursor:pointer;font-size:8px" title="Odebrat (30% refund)">✕</button>`;
          h+=`</div>`;
        }
      }

      // BW purchase buttons
      h+=`<div style="font-size:9px;font-weight:600;color:#f59e0b;margin:8px 0 4px">Koupit bandwidth:</div>`;
      for(let bi=0;bi<BW_UPGRADES.length;bi++){
        const bwu=BW_UPGRADES[bi];
        h+=`<button onclick="event.stopPropagation();buyBW(${di},${bi})" style="display:block;width:100%;padding:3px 6px;margin:2px 0;background:#161b22;border:1px solid #21262d;border-radius:4px;color:#e0e0e0;cursor:pointer;font-size:9px;text-align:left" onmouseover="this.style.borderColor='#7c3aed'" onmouseout="this.style.borderColor='#21262d'">${bwu.name} · <span style="color:#f59e0b">${fmtCostInfl(bwu.cost)}</span> · <span style="color:#8b949e">${fmtKc(inflComponentCost(bwu.mCost))}/m</span></button>`;
      }

      // Quick-install equipment
      h+=`<div style="font-size:9px;font-weight:600;color:#7c3aed;margin:8px 0 4px">Rychlá instalace vybavení:</div>`;
      for(const eqKey in EQ){
        const eq=EQ[eqKey];
        const canFit=eqs.length<maxSlots;
        h+=`<button onclick="event.stopPropagation();placeEq(${di},'${eqKey}');selDC=${di};updUI()" style="display:block;width:100%;padding:3px 6px;margin:2px 0;background:#161b22;border:1px solid #21262d;border-radius:4px;color:${canFit?'#e0e0e0':'#484f58'};cursor:${canFit?'pointer':'default'};font-size:9px;text-align:left" ${canFit?'onmouseover="this.style.borderColor=\'#7c3aed\'" onmouseout="this.style.borderColor=\'#21262d\'"':''}>${eq.icon} ${eq.name} · <span style="color:#f59e0b">${fmtCostInfl(eq.cost)}</span> · <span style="color:#8b949e">${fmtKc(inflComponentCost(eq.mCost))}/m</span></button>`;
      }

      h+='</div>';
    }

    div.innerHTML=h;
    list.appendChild(div);
  }

  // Cable stats
  const cs=document.getElementById('bwCableStats');
  const segStats={};
  for(const k in segLoads){
    const s=segLoads[k];const key=s.types.sort().join('+');
    if(!segStats[key])segStats[key]={count:0,maxRatio:0,sumRatio:0,maxBW:s.max};
    segStats[key].count++;segStats[key].maxRatio=Math.max(segStats[key].maxRatio,s.ratio);segStats[key].sumRatio+=s.ratio;
  }
  let ch='';
  for(const key in segStats){
    const st=segStats[key];const avg=st.count?st.sumRatio/st.count:0;
    ch+=`<div class="sr"><span class="l">${key} (${st.count} seg)</span><span class="v ${st.maxRatio>.9?'neg':st.maxRatio>.7?'warn':'pos'}">avg ${Math.round(avg*100)}% / max ${Math.round(st.maxRatio*100)}%</span></div>`;
    ch+=`<div class="cap-bar"><div class="fill ${st.maxRatio>.9?'crit':st.maxRatio>.7?'warn':'ok'}" style="width:${Math.min(100,st.maxRatio*100)}%"></div></div>`;
  }

  // WiFi stats
  if(G.wifiAPs&&G.wifiAPs.length){
    ch+=`<div style="margin-top:8px;font-size:9px;font-weight:600;color:#22d3ee">📶 WiFi přístupové body: ${G.wifiAPs.length}</div>`;
    for(const ap of G.wifiAPs){
      const wt=WIFI_T[ap.type];
      ch+=`<div class="sr"><span class="l">${wt.icon} ${wt.name} [${ap.x},${ap.y}]</span><span class="v">${fmtBW(wt.maxBW)} · dosah ${wt.range}</span></div>`;
    }
  }

  // Migration log
  if(G.migrationLog&&G.migrationLog.length){
    ch+=`<div style="margin-top:8px;font-size:9px;font-weight:600;color:#a78bfa">🔄 Poslední migrace:</div>`;
    for(const log of G.migrationLog.slice(-5)){
      ch+=`<div style="font-size:8px;color:#8b949e;padding:1px 0">${log}</div>`;
    }
  }

  cs.innerHTML=ch||'<span style="color:#484f58">Žádné kabely</span>';
}

// ====== TARIFF TAB ======
function buildTariffTable(){
  const tbody=document.getElementById('tariffBody');tbody.innerHTML='';
  let lastCat='';
  // Valorizace — informační ukazatel pro hráče, že inflace už promítá do fakturace
  const tInfl=(G&&G.tariffInflation)||1;
  const inflPct=Math.round((tInfl-1)*100);
  if(inflPct>=1){
    const hdr=document.createElement('tr');
    hdr.innerHTML=`<td colspan="5" style="padding:4px 4px;font-size:9px;color:#f59e0b;background:#1a1410;border-bottom:1px solid #30363d">📈 Valorizační doložka: +${inflPct}% k nominálním cenám níže (automaticky se účtuje zákazníkům). Když tarify aktualizuješ nahoru, valorizace se přenese i na novou hodnotu.</td>`;
    tbody.appendChild(hdr);
  }
  for(let ti=0;ti<G.tariffs.length;ti++){
    const t=G.tariffs[ti];
    // Category headers
    const cat=t.cat||'fixed';
    if(cat!==lastCat){
      lastCat=cat;
      const catNames={fixed:'🔌 Pevné připojení',mobile:'📱 Mobilní tarify',fwa:'🏠 FWA (Fixed Wireless)'};
      const catRow=document.createElement('tr');
      catRow.innerHTML=`<td colspan="5" style="padding:6px 4px 3px;font-size:10px;font-weight:700;color:#a78bfa;border-bottom:1px solid #30363d">${catNames[cat]||cat}</td>`;
      tbody.appendChild(catRow);
    }
    const canUse=G.tech>=t.minTech;
    const hasEq=anyDCHasEq(t.reqEq);
    const rp=refPrice(t.speed,t.share);
    // Referenční cena je v "real terms" — srovnáváme s efektivní (po valorizaci) cenou
    const effPrice=t.price*tInfl;
    const priceRatio=effPrice/rp;
    const priceClr=priceRatio>1.3?'#f85149':priceRatio>1.1?'#f59e0b':priceRatio<.8?'#3fb950':'#8b949e';

    const tr=document.createElement('tr');
    tr.className=canUse&&hasEq?'unlocked':'locked';

    let reqHtml=t.reqEq.length?t.reqEq.map(r=>{
      const eq=EQ[r];const has=anyDCHasEq([r]);
      return`<span class="req-tag" style="border-color:${has?'#3fb950':'#f85149'};color:${has?'#3fb950':'#f85149'}">${eq?eq.icon:''}${eq?eq.name:r}</span>`;
    }).join(''):'<span style="color:#484f58;font-size:8px">–</span>';

    // Customer count for this tariff (from tariffDist)
    let custCount=0;
    for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(!b||!b.connected)continue;
      if(b.tariffDist&&b.tariffDist[ti])custCount+=b.tariffDist[ti];
      else if(b.tariff===ti)custCount+=b.customers;
    }

    const shareN=t.share||1;
    const shareTag=shareN>1?`<span style="color:#f59e0b;font-size:9px;font-weight:600;margin-left:4px" title="Sdílený tarif — ${shareN} zákazníků sdílí linku">1:${shareN}</span>`:`<span style="color:#3fb950;font-size:9px;font-weight:600;margin-left:4px" title="Garantovaná rychlost">G</span>`;
    tr.innerHTML=`<td><input type="checkbox" class="tariff-toggle" ${t.active?'checked':''} ${canUse&&hasEq?'':'disabled'} onchange="G.tariffs[${ti}].active=this.checked;updUI()"></td>`+
      `<td>${t.icon||''}${t.name}${shareTag}${!hasEq?' 🔒':''}</td>`+
      `<td>${t.speed>=1000?(t.speed/1000)+'G':t.speed}</td>`+
      `<td><input type="number" class="tariff-edit" value="${t.price}" min="99" ${canUse?'':'disabled'} onchange="G.tariffs[${ti}].price=parseInt(this.value)||99;updUI()" style="color:${priceClr}"> Kč</td>`+
      `<td>${reqHtml}</td>`;
    tbody.appendChild(tr);

    // Stats row — always show reference + price warning
    const stRow=document.createElement('tr');
    let priceLabel='';
    if(priceRatio>2.0)priceLabel='<span style="color:#f85149;font-weight:700"> ⛔ EXTRÉMNĚ DRAHÉ — zákazníci utíkají!</span>';
    else if(priceRatio>1.5)priceLabel='<span style="color:#f85149"> ⚠️ Velmi drahé — silný odliv</span>';
    else if(priceRatio>1.25)priceLabel='<span style="color:#f59e0b"> ⚠️ Nadprůměrná cena</span>';
    else if(priceRatio<0.75)priceLabel='<span style="color:#3fb950"> 🔥 Výprodej!</span>';
    else if(priceRatio<0.9)priceLabel='<span style="color:#3fb950"> ✓ Konkurenční cena</span>';
    const effRev=Math.round(custCount*t.price*tInfl);
    const inflTag=inflPct>=1?` <span style="color:#f59e0b" title="Nominál ${fmtKc(t.price)} × valorizace ${inflPct}%">↑${inflPct}%</span>`:'';
    const custInfo=custCount>0?`${custCount} zákazníků · ${fmtKc(effRev)}/měs${inflTag} · `:'';
    const descInfo=t.desc?` · <span style="color:#6e7681">${t.desc}</span>`:'';
    stRow.innerHTML=`<td colspan="5" style="padding:1px 4px;font-size:8px;color:#8b949e;border-bottom:1px solid #161b22">└ ${custInfo}ref: ${fmtKc(rp)} (${Math.round(priceRatio*100)}%)${priceLabel}${descInfo}</td>`;
    tbody.appendChild(stRow);
  }

  // Tariff stats summary
  const statsEl=document.getElementById('tariffStats');
  let tStat='';
  let totalRev=0,totalCust=0;
  for(let ti=0;ti<G.tariffs.length;ti++){
    const t=G.tariffs[ti];let c=0;
    for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(!b||!b.connected)continue;
      if(b.tariffDist&&b.tariffDist[ti])c+=b.tariffDist[ti];
      else if(b.tariff===ti)c+=b.customers;
    }
    if(c>0){totalRev+=c*t.price;totalCust+=c;}
  }
  const totalEff=Math.round(totalRev*tInfl);
  tStat+=`<div class="sr"><span class="l">Celkem zákazníků</span><span class="v hl">${fmt(totalCust)}</span></div>`;
  tStat+=`<div class="sr"><span class="l">Příjmy z tarifů</span><span class="v pos">${fmtKc(totalEff)}/měs${inflPct>=1?` <span style="color:#f59e0b;font-size:85%" title="Nominál ${fmtKc(totalRev)}, valorizace +${inflPct}%">↑${inflPct}%</span>`:''}</span></div>`;
  // Average revenue per customer
  if(totalCust>0)tStat+=`<div class="sr"><span class="l">Prům. na zákazníka</span><span class="v">${fmtKc(Math.round(totalEff/totalCust))}/měs</span></div>`;
  statsEl.innerHTML=tStat;
}

// ====== SERVICES TAB ======
function buildSvcList(){
  const list=document.getElementById('svcList');list.innerHTML='';
  if(!G.services)G.services=[];

  // Active services summary — real subscriber-based revenue
  if(G.services.length>0){
    let svcRev=0,totalSubs=0;
    for(const sid of G.services){
      const svc=SERVICES.find(s=>s.id===sid);if(!svc)continue;
      const svcPrice=G.svcPrices?.[sid]||svc.revPerCust;
      let subs=0;
      for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
        const b=G.map[y][x].bld;if(!b||!b.connected||!b.svcSubs)continue;
        subs+=(b.svcSubs[sid]||0);
      }
      svcRev+=subs*svcPrice;totalSubs+=subs;
    }
    let totalMCost=0;
    for(const sid of G.services){const svc=SERVICES.find(s=>s.id===sid);if(svc)totalMCost+=svc.mCost;}
    let sumHtml=`<div style="background:#0a1a0a;border:1px solid #3fb950;border-radius:5px;padding:6px 8px;margin-bottom:8px;font-size:9px">`;
    sumHtml+=`<div style="font-weight:600;color:#3fb950">✅ Aktivní: ${G.services.length}/${SERVICES.length} · ${totalSubs} odběratelů</div>`;
    sumHtml+=`<div style="color:#8b949e;margin-top:2px">Příjem: <b style="color:#3fb950">${fmtKc(svcRev)}</b> · Provoz: <b style="color:#f85149">${fmtKc(totalMCost)}</b> · Zisk: <b style="color:${svcRev>totalMCost?'#3fb950':'#f85149'}">${fmtKc(svcRev-totalMCost)}/měs</b></div>`;
    sumHtml+='</div>';
    list.innerHTML+=sumHtml;
  }

  // Categorize services
  const svcCats={
    consumer:{name:'👤 Služby pro zákazníky',ids:['svc_iptv','svc_voip','svc_gaming','svc_cloud','svc_security','svc_iot']},
    business:{name:'🏢 B2B služby',ids:['svc_dedicated','svc_publicip','svc_vpn','svc_managed']},
    cloud:{name:'☁️ Cloud & Hosting',ids:['svc_cloudvps','svc_cloudstorage','svc_colocation','svc_hosting','svc_cdn']},
  };
  for(const catKey in svcCats){
    const cat=svcCats[catKey];
    const catSvcs=cat.ids.map(id=>SERVICES.findIndex(s=>s.id===id)).filter(i=>i>=0);
    if(!catSvcs.length)continue;
    const catDiv=document.createElement('div');
    catDiv.className='svc-cat';catDiv.textContent=cat.name;
    list.appendChild(catDiv);
    for(const si of catSvcs){
      buildSvcCard(list,si);
    }
  }
  // Any uncategorized
  const allCatIds=Object.values(svcCats).flatMap(c=>c.ids);
  for(let si=0;si<SERVICES.length;si++){
    if(!allCatIds.includes(SERVICES[si].id))buildSvcCard(list,si);
  }
}
function buildSvcCard(list,si){
  const svc=SERVICES[si];
  const owned=G.services.includes(svc.id);
  const eqOk=anyDCHasEq(svc.reqEq);

  const div=document.createElement('div');
  div.className='svc-card'+(owned?' owned':'');

  // Count actual subscribers across all buildings
  let totalSubs=0,maxPotential=0;
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y][x].bld;if(!b||!b.connected)continue;
    if(b.svcSubs)totalSubs+=(b.svcSubs[svc.id]||0);
    maxPotential+=Math.round(b.customers*(svc.adopt[b.type]||0));
  }

  const svcPrice=G.svcPrices?.[svc.id]||svc.revPerCust;
  const refP=svc.revPerCust;
  const priceRatio=svcPrice/refP;
  const rev=totalSubs*svcPrice;

  let h=`<div class="svc-name">${svc.icon} ${svc.name}${owned?' ✅':''}${!eqOk?' 🔒':''}</div>`;
  h+=`<div class="svc-info">${svc.desc}</div>`;

  if(owned){
    // === OWNED SERVICE: show subscribers, editable price, revenue ===
    // Subscriber bar
    const subPct=maxPotential>0?Math.round(totalSubs/maxPotential*100):0;
    const barClr=subPct>70?'#3fb950':subPct>30?'#f59e0b':'#f85149';
    h+=`<div style="margin-top:4px;font-size:9px;color:#8b949e">Odběratelé: <b style="color:#e0e0e0">${totalSubs}</b> / ${maxPotential} max (${subPct}%)</div>`;
    h+=`<div style="height:4px;background:#21262d;border-radius:2px;margin:2px 0;overflow:hidden"><div style="width:${subPct}%;height:100%;background:${barClr};border-radius:2px"></div></div>`;

    // Editable price
    const priceClr=priceRatio>1.4?'#f85149':priceRatio>1.15?'#f59e0b':priceRatio<0.8?'#3fb950':'#e0e0e0';
    h+=`<div style="display:flex;align-items:center;gap:6px;margin-top:3px;font-size:9px">`;
    h+=`<span style="color:#8b949e">Cena/měs:</span>`;
    h+=`<input type="number" value="${svcPrice}" min="10" style="width:60px;background:#0d1117;border:1px solid #21262d;border-radius:3px;color:${priceClr};padding:2px 4px;font-size:10px;text-align:right" onchange="G.svcPrices['${svc.id}']=parseInt(this.value)||${refP};buildSvcList()">`;
    h+=`<span style="color:#6e7681">Kč (ref: ${refP})</span>`;
    h+=`</div>`;

    // Price warning
    let priceWarn='';
    if(priceRatio>2.0)priceWarn='<span style="color:#f85149;font-weight:700">⛔ Extrémně drahé!</span>';
    else if(priceRatio>1.4)priceWarn='<span style="color:#f85149">⚠️ Velmi drahé — odliv</span>';
    else if(priceRatio>1.15)priceWarn='<span style="color:#f59e0b">⚠️ Nadprůměrná cena</span>';
    else if(priceRatio<0.75)priceWarn='<span style="color:#3fb950">🔥 Výprodej!</span>';
    else if(priceRatio<0.9)priceWarn='<span style="color:#3fb950">✓ Konkurenční</span>';
    if(priceWarn)h+=`<div style="font-size:8px;margin-top:1px">${priceWarn} (${Math.round(priceRatio*100)}% ref)</div>`;

    // Revenue breakdown
    h+=`<div style="margin-top:3px;display:flex;gap:8px;flex-wrap:wrap;font-size:9px">`;
    h+=`<span style="color:#3fb950">Příjem: ${fmtKc(rev)}/měs</span>`;
    h+=`<span style="color:#f85149">Provoz: ${fmtKc(svc.mCost)}/měs</span>`;
    h+=`<span style="color:${rev>svc.mCost?'#3fb950':'#f85149'}">Zisk: ${fmtKc(rev-svc.mCost)}/měs</span>`;
    h+=`</div>`;
  } else {
    // === NOT OWNED: show potential ===
    h+=`<div style="margin-top:3px;display:flex;gap:8px;flex-wrap:wrap;font-size:9px">`;
    h+=`<span style="color:#f59e0b">Jednorázově: ${fmtKc(svc.cost)}</span>`;
    h+=`<span style="color:#8b949e">Provoz: ${fmtKc(svc.mCost)}/měs</span>`;
    h+=`</div>`;
    h+=`<div style="font-size:8px;color:#8b949e;margin-top:2px">Max. odběratelů: ${maxPotential} · Ref. cena: ${refP} Kč/měs</div>`;
  }

  // Extra BW consumption
  h+=`<div style="font-size:8px;color:#8b949e;margin-top:2px">${svc.extraBW>=0?'+':''}${svc.extraBW} Mbps BW/odběratel</div>`;

  // Equipment requirements
  const reqNames=svc.reqEq.map(r=>{
    const eq=EQ[r];const has=anyDCHasEq([r]);
    return`<span style="color:${has?'#3fb950':'#f85149'}">${eq?eq.icon:''}${eq?eq.name:r}${has?' ✓':' ✗'}</span>`;
  }).join(' · ');
  h+=`<div style="font-size:8px;margin-top:2px">Vyžaduje: ${reqNames}</div>`;

  // Adoption rates preview
  h+=`<div style="font-size:8px;color:#6e7681;margin-top:2px">Max. adopce: `;
  const topAdopt=Object.entries(svc.adopt).sort((a,b)=>b[1]-a[1]).slice(0,3);
  h+=topAdopt.map(([k,v])=>`${BTYPES[k]?.icon||''} ${Math.round(v*100)}%`).join(' · ');
  h+=`</div>`;

  if(!owned&&eqOk){
    h+=`<button onclick="event.stopPropagation();buyService(${si})" style="margin-top:4px;padding:4px 10px;background:#1a1040;border:1px solid #7c3aed;color:#a78bfa;border-radius:4px;cursor:pointer;font-size:9px;width:100%">🛒 Aktivovat za ${fmtKc(svc.cost)}</button>`;
  } else if(!owned&&!eqOk){
    h+=`<div style="margin-top:3px;font-size:8px;color:#f85149">⚠️ Chybí vybavení v DC!</div>`;
  }

  div.innerHTML=h;
  if(!owned&&eqOk)div.style.cursor='pointer';
  list.appendChild(div);
}

// ====== UPGRADES TAB ======
function buildUpgradeList(){
  const list=document.getElementById('upgradeList');list.innerHTML='';
  if(!G.upgrades)G.upgrades=[];

  // Group by category
  const cats={
    marketing:{name:'📢 Marketing',items:[]},
    support:{name:'📞 Podpora',items:[]},
    brand:{name:'🎨 Značka',items:[]},
    ops:{name:'🤖 Provoz',items:[]},
    network:{name:'🔗 Síť',items:[]},
    expansion:{name:'📄 Expanze',items:[]}
  };
  UPGRADES.forEach((u,i)=>{
    const cat=u.cat||'ops';
    if(!cats[cat])cats[cat]={name:cat,items:[]};
    cats[cat].items.push({...u,idx:i});
  });

  for(const catKey in cats){
    const cat=cats[catKey];
    if(!cat.items.length)continue;
    let catHtml=`<div style="font-size:9px;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;margin:8px 0 4px;font-weight:700">${cat.name}</div>`;
    list.innerHTML+=catHtml;

    for(const upg of cat.items){
      const owned=G.upgrades.includes(upg.id);
      const locked=upg.req&&!G.upgrades.includes(upg.req);
      const div=document.createElement('div');
      div.className='uc'+(owned?' owned':'');
      if(locked)div.style.opacity='.5';

      let h=`<div class="un">${upg.icon||'🆙'} ${upg.name}${owned?' ✅':''}${locked?' 🔒':''}</div>`;
      if(!owned){
        h+=`<div class="up" style="color:#f59e0b">${fmtKc(upg.cost)}</div>`;
      } else {
        h+=`<div class="up" style="color:#3fb950">Aktivní</div>`;
      }
      h+=`<div class="ud">${upg.desc}</div>`;
      if(locked){
        const reqUpg=UPGRADES.find(u=>u.id===upg.req);
        h+=`<div style="margin-top:2px;font-size:8px;color:#f59e0b">Vyžaduje: ${reqUpg?.icon||''} ${reqUpg?.name||upg.req}</div>`;
      }
      if(!owned&&!locked){
        h+=`<button onclick="event.stopPropagation();buyUpgrade(${upg.idx})" style="margin-top:4px;padding:3px 8px;background:#1a1040;border:1px solid #7c3aed;color:#a78bfa;border-radius:4px;cursor:pointer;font-size:9px">🛒 Koupit</button>`;
      }

      div.innerHTML=h;
      if(!owned&&!locked)div.onclick=()=>buyUpgrade(upg.idx);
      list.appendChild(div);
    }
  }
}

// ====== CLOUD / IP TAB ======
function buildCloudTab(){
  // === Cloud Overview Dashboard ===
  const ovEl=document.getElementById('cloudOverview');
  let oh='';
  const cloudRev=calcCloudRevenue();
  let totalCloudCust=0,avgCloudSat=0,segCount=0;
  for(const seg of CLOUD_SEGMENTS){
    const cs=G.cloudCustomers?.[seg.id];
    if(cs&&cs.count>0){totalCloudCust+=cs.count;avgCloudSat+=cs.satisfaction;segCount++;}
  }
  if(segCount>0)avgCloudSat=Math.round(avgCloudSat/segCount);
  const curSLA=SLA_TIERS.find(s=>s.id===G.cloudSLA)||SLA_TIERS[0];

  const cloudOp=(typeof calcCloudOpCost==='function')?calcCloudOpCost():0;
  const cloudProfit=cloudRev-cloudOp;
  const marginPct=cloudRev>0?Math.round(cloudProfit/cloudRev*100):0;
  const rep=Math.round(G.cloudReputation||60);
  const repClr=rep>=70?'#3fb950':rep>=45?'#f59e0b':'#f85149';
  const repLbl=rep>=85?'výborná':rep>=65?'dobrá':rep>=45?'průměrná':rep>=25?'slabá':'špatná';

  oh+=`<div class="sr"><span class="l">Cloud zákazníci</span><span class="v hl">${fmt(totalCloudCust)}</span></div>`;
  oh+=`<div class="sr"><span class="l">Cloud příjmy</span><span class="v pos">${fmtKc(cloudRev)}/měs</span></div>`;
  oh+=`<div class="sr" title="Provoz cloudu: per-instance mCost × inflace − automatizace (dev tým + upgrady)"><span class="l">Provozní náklady</span><span class="v neg">-${fmtKc(cloudOp)}/měs</span></div>`;
  oh+=`<div class="sr" title="Čistý měsíční zisk z cloud byznysu"><span class="l">Cloud marže</span><span class="v ${cloudProfit>0?'pos':'neg'}">${fmtKc(cloudProfit)} (${marginPct}%)</span></div>`;
  oh+=`<div class="sr" title="Reputace 0–100. Vliv na růst, churn, elasticitu ceny. Klesá výpadky, roste stabilním provozem."><span class="l">Reputace</span><span class="v" style="color:${repClr}">${rep} · ${repLbl}</span></div>`;
  oh+=`<div class="sr"><span class="l">Průměr. spokojenost</span><span class="v ${avgCloudSat>60?'pos':avgCloudSat>30?'warn':'neg'}">${avgCloudSat}%</span></div>`;
  oh+=`<div class="sr"><span class="l">SLA úroveň</span><span class="v hl">${curSLA.name}</span></div>`;
  oh+=`<div class="sr"><span class="l">Cenový koeficient</span><span class="v">${(G.cloudPriceMult||1).toFixed(2)}×</span></div>`;
  // Waitlist warning — kapacita skoro plná
  let cU=0,cT=0,sU=0,sT=0;
  for(let di=0;di<G.dcs.length;di++){
    const c=getDCCompute(di);cU+=c.usedCPU;cT+=c.vCPU;
    const s=getDCStorage(di);sU+=s.used;sT+=s.total;
  }
  const util=Math.max(cT>0?cU/cT:0,sT>0?sU/sT:0);
  if(util>0.85){
    oh+=`<div class="sr" style="color:#f85149" title="Zákazníci odcházejí kvůli plné kapacitě. Přidej instance/HW."><span class="l">⚠️ Kapacita</span><span class="v neg">${Math.round(util*100)}% — waitlist aktivní</span></div>`;
  } else if(util>0.7){
    oh+=`<div class="sr" style="color:#f59e0b"><span class="l">Kapacita</span><span class="v warn">${Math.round(util*100)}%</span></div>`;
  }
  // SLA credit last month
  if((G.cloudSLACreditM||0)>0){
    oh+=`<div class="sr" title="Kredit vrácený zákazníkům za překročený downtime minulý měsíc"><span class="l">Min. SLA credit</span><span class="v neg">-${fmtKc(G.cloudSLACreditM)}</span></div>`;
  }
  // Cloud BW usage
  let cloudBW=0;
  for(let di=0;di<G.dcs.length;di++)cloudBW+=getCloudBWForDC(di);
  if(cloudBW>0)oh+=`<div class="sr"><span class="l">Cloud BW</span><span class="v warn">${fmtBW(cloudBW)}</span></div>`;
  ovEl.innerHTML=oh;

  // === SLA Selector ===
  const slaEl=document.getElementById('slaSelector');
  let sh='';
  for(const sla of SLA_TIERS){
    const isCurrent=G.cloudSLA===sla.id;
    const eqMet=sla.reqEq.length===0||anyDCHasEq(sla.reqEq);
    const borderClr=isCurrent?'#7c3aed':eqMet?'#21262d':'#21262d';
    const bgClr=isCurrent?'#1a1040':'#0d1117';
    const txtClr=eqMet?'#e0e0e0':'#484f58';
    sh+=`<button onclick="event.stopPropagation();setCloudSLA('${sla.id}')" style="display:block;width:100%;padding:5px 8px;margin:2px 0;background:${bgClr};border:1px solid ${borderClr};border-radius:4px;color:${txtClr};cursor:${eqMet?'pointer':'default'};font-size:9px;text-align:left" ${eqMet&&!isCurrent?'onmouseover="this.style.borderColor=\'#7c3aed\'" onmouseout="this.style.borderColor=\'#21262d\'"':''}>`;
    sh+=`<b>${isCurrent?'✅ ':''} ${sla.name}</b>`;
    sh+=` <span style="color:#6e7681">· cena ×${sla.priceMult} · penále ${Math.round(sla.penaltyPct*100)}%</span>`;
    if(sla.reqEq.length>0&&!eqMet)sh+=` <span style="color:#f85149">🔒 ${sla.reqEq.map(e=>EQ[e]?.name||e).join(', ')}</span>`;
    sh+=`<br><span style="font-size:8px;color:#6e7681">${sla.desc}</span></button>`;
  }
  slaEl.innerHTML=sh;

  // === Cloud Pricing Slider ===
  const prEl=document.getElementById('cloudPricing');
  const pm=G.cloudPriceMult||1.0;
  let ph=`<div style="display:flex;align-items:center;gap:6px;font-size:9px">`;
  ph+=`<span style="color:#8b949e">Levné</span>`;
  ph+=`<input type="range" min="50" max="300" value="${Math.round(pm*100)}" style="flex:1;height:4px;accent-color:#7c3aed" oninput="setCloudPriceMult(this.value/100);document.getElementById('cloudPriceVal').textContent=(this.value/100).toFixed(2)+'×'">`;
  ph+=`<span style="color:#8b949e">Drahé</span>`;
  ph+=`<span id="cloudPriceVal" style="color:#f59e0b;font-weight:600;min-width:35px">${pm.toFixed(2)}×</span>`;
  ph+=`</div>`;
  ph+=`<div style="font-size:8px;color:#6e7681;margin-top:2px">Efektivní cena: ${(pm*curSLA.priceMult).toFixed(2)}× (základ × SLA)</div>`;
  prEl.innerHTML=ph;

  // === Customer Segments ===
  const segEl=document.getElementById('cloudSegments');
  let sg='';
  for(const seg of CLOUD_SEGMENTS){
    const cs=G.cloudCustomers?.[seg.id]||{count:0,satisfaction:50,lastGrowth:0};
    const yearProgress=Math.max(0,G.date.y-2008);
    let totalCPU=0,totalStorage=0;
    for(let di=0;di<G.dcs.length;di++){const c=getDCCompute(di);totalCPU+=c.vCPU;const s=getDCStorage(di);totalStorage+=s.total;}
    const marketSize=Math.floor(5+yearProgress*3+totalCPU*0.3+totalStorage*2);
    const fillPct=marketSize>0?Math.round(cs.count/marketSize*100):0;
    const satClr=cs.satisfaction>60?'#3fb950':cs.satisfaction>30?'#f59e0b':'#f85149';

    sg+=`<div style="background:#0d1117;border:1px solid #21262d;border-radius:5px;padding:6px;margin-bottom:4px">`;
    sg+=`<div style="display:flex;justify-content:space-between;align-items:center">`;
    sg+=`<span style="font-size:10px;font-weight:600">${seg.icon} ${seg.name}</span>`;
    sg+=`<span style="font-size:9px;color:#a78bfa">${cs.count}/${marketSize}</span>`;
    sg+=`</div>`;
    sg+=`<div class="cap-bar" style="margin:3px 0"><div class="fill ok" style="width:${Math.min(100,fillPct)}%"></div></div>`;
    sg+=`<div style="display:flex;justify-content:space-between;font-size:8px;color:#6e7681">`;
    sg+=`<span>Spokojenost: <b style="color:${satClr}">${Math.round(cs.satisfaction)}%</b></span>`;
    sg+=`<span>Pref. SLA: ${SLA_TIERS.find(s=>s.id===seg.slaPref)?.name||'?'}</span>`;
    sg+=`</div>`;
    sg+=`<div style="font-size:8px;color:#484f58">${seg.desc}</div>`;
    sg+=`</div>`;
  }
  if(!G.cloudInstances||!G.cloudInstances.length)sg='<div style="font-size:9px;color:#484f58">Nejdřív provisionuj cloud instance v DC, pak přijdou zákazníci.</div>';
  segEl.innerHTML=sg;

  // === IP Stats ===
  const ipEl=document.getElementById('ipStats');
  const totalIP=getTotalIPs();
  const usedIP=getUsedIPs();
  const hasBGP=anyDCHasEq(['eq_bgprouter']);
  let ih='';
  if(totalIP>0){
    const ratio=totalIP>0?usedIP/totalIP:0;
    ih+=`<div class="sr"><span class="l">IP celkem</span><span class="v hl">${fmt(totalIP)}</span></div>`;
    ih+=`<div class="sr"><span class="l">IP využito</span><span class="v ${ratio>.9?'neg':ratio>.7?'warn':'pos'}">${fmt(usedIP)} (${Math.round(ratio*100)}%)</span></div>`;
    ih+=`<div class="cap-bar"><div class="fill ${ratio>.95?'crit':ratio>.7?'warn':'ok'}" style="width:${Math.min(100,ratio*100)}%"></div></div>`;
    for(const blk of G.ipBlocks){
      ih+=`<div style="font-size:9px;color:#8b949e;padding:1px 0">📋 ${blk.name} · ${fmtKc(blk.mCost)}/m</div>`;
    }
  } else {
    ih+=`<div style="font-size:9px;color:#484f58">Žádné IP bloky — zákazníci sdílejí NAT</div>`;
  }
  ipEl.innerHTML=ih;

  // IP Block purchase buttons
  const ipList=document.getElementById('ipBlockList');
  let bh='';
  for(let bi=0;bi<IP_BLOCKS.length;bi++){
    const blk=IP_BLOCKS[bi];
    bh+=`<button onclick="event.stopPropagation();buyIPBlock(${bi})" style="display:block;width:100%;padding:4px 8px;margin:2px 0;background:#0d1117;border:1px solid #21262d;border-radius:4px;color:${hasBGP?'#e0e0e0':'#484f58'};cursor:${hasBGP?'pointer':'default'};font-size:9px;text-align:left" ${hasBGP?'onmouseover="this.style.borderColor=\'#7c3aed\'" onmouseout="this.style.borderColor=\'#21262d\'"':''}>${blk.icon} ${blk.name} · <span style="color:#f59e0b">${fmtCostInfl(blk.cost)}</span> · <span style="color:#8b949e">${fmtKc(inflComponentCost(blk.mCost))}/m</span>${!hasBGP?' 🔒':''}</button>`;
  }
  ipList.innerHTML=bh;

  // === Per-DC cloud infrastructure ===
  const dcList=document.getElementById('cloudDCList');
  let dh='';
  const categories={vps:'💻 VPS & GPU',k8s:'🐳 Kubernetes',db:'🗃️ Databáze',s3:'📁 Object Storage',block:'💿 Block Storage'};
  for(let di=0;di<G.dcs.length;di++){
    const dc=G.dcs[di],dt=DC_T[dc.type];
    const st=getDCStorage(di);
    const comp=getDCCompute(di);
    const hasCloud=comp.vCPU>0||st.total>0;
    if(!hasCloud)continue;

    dh+=`<div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:8px;margin-bottom:6px">`;
    dh+=`<div style="font-size:11px;font-weight:600;color:#00d4ff;margin-bottom:4px">${dt.name} #${di+1}</div>`;

    // Storage bar
    if(st.total>0){
      const sRatio=st.total>0?st.used/st.total:0;
      dh+=`<div style="font-size:9px;color:#8b949e">💿 Storage: <b style="color:${sRatio>.9?'#f85149':'#3fb950'}">${st.used.toFixed(1)} / ${st.total} TB</b></div>`;
      dh+=`<div class="cap-bar"><div class="fill ${sRatio>.9?'crit':sRatio>.7?'warn':'ok'}" style="width:${Math.min(100,sRatio*100)}%"></div></div>`;
    }

    // Compute bar
    if(comp.vCPU>0){
      const cRatio=comp.vCPU>0?comp.usedCPU/comp.vCPU:0;
      const rRatio=comp.ram>0?comp.usedRAM/comp.ram:0;
      dh+=`<div style="font-size:9px;color:#8b949e">☁️ CPU: <b>${comp.usedCPU}/${comp.vCPU} vCPU</b> · RAM: <b>${comp.usedRAM}/${comp.ram} GB</b></div>`;
      dh+=`<div class="cap-bar"><div class="fill ${Math.max(cRatio,rRatio)>.9?'crit':Math.max(cRatio,rRatio)>.7?'warn':'ok'}" style="width:${Math.min(100,Math.max(cRatio,rRatio)*100)}%"></div></div>`;
    }

    // Cloud BW for this DC
    const dcCloudBW=getCloudBWForDC(di);
    if(dcCloudBW>0)dh+=`<div style="font-size:9px;color:#8b949e">📶 Cloud BW: <b style="color:#f59e0b">${fmtBW(dcCloudBW)}</b></div>`;

    // Active instances
    const dcInstances=(G.cloudInstances||[]).filter(ci=>ci.dcIdx===di);
    if(dcInstances.length){
      dh+=`<div style="font-size:9px;font-weight:600;color:#a78bfa;margin:4px 0 2px">Aktivní instance:</div>`;
      for(const ci of dcInstances){
        const cp=CLOUD_PRICING[ci.type];if(!cp)continue;
        dh+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 4px;background:#161b22;border-radius:3px;margin:1px 0;font-size:9px">`;
        dh+=`<span>${cp.icon} ${cp.name} ×${ci.count}</span>`;
        dh+=`<span style="color:#6e7681">${cp.bwMbps||0} Mbps</span>`;
        dh+=`<button onclick="event.stopPropagation();deprovisionCloud(${di},'${ci.type}')" style="padding:1px 4px;background:#1a0a0a;border:1px solid #f85149;border-radius:3px;color:#f85149;cursor:pointer;font-size:8px">−1</button>`;
        dh+=`</div>`;
      }
    }

    // Provision buttons — organized by category
    for(const catKey in categories){
      const catProducts=Object.entries(CLOUD_PRICING).filter(([k,v])=>(v.cat||'vps')===catKey);
      if(!catProducts.length)continue;
      dh+=`<div style="font-size:9px;font-weight:600;color:#f59e0b;margin:6px 0 2px">${categories[catKey]}</div>`;
      for(const [key,cp] of catProducts){
        const isCompute=cp.vCPU!==undefined;
        const needsStorage=cp.storageTB!==undefined&&cp.storageTB>0;
        let canProvision=true;
        if(isCompute&&(comp.vCPU-comp.usedCPU<cp.vCPU||comp.ram-comp.usedRAM<(cp.ramGB||0)))canProvision=false;
        if(needsStorage&&st.total-st.used<cp.storageTB)canProvision=false;
        // Check required equipment
        if(cp.reqEq){for(const eq of cp.reqEq){if(!(dc.eq||[]).includes(eq))canProvision=false;}}
        const info=isCompute?`${cp.vCPU} vCPU · ${cp.ramGB||0}GB`:(cp.storageTB?`${cp.storageTB} TB`:'');
        dh+=`<button onclick="event.stopPropagation();provisionCloud(${di},'${key}')" style="display:block;width:100%;padding:3px 6px;margin:1px 0;background:#161b22;border:1px solid #21262d;border-radius:4px;color:${canProvision?'#e0e0e0':'#484f58'};cursor:${canProvision?'pointer':'default'};font-size:9px;text-align:left" ${canProvision?'onmouseover="this.style.borderColor=\'#7c3aed\'" onmouseout="this.style.borderColor=\'#21262d\'"':''}>`;
        dh+=`${cp.icon} ${cp.name} · ${info} · ${cp.bwMbps||0} Mbps · <span style="color:#3fb950">${fmtKc(cp.price)}/m</span>`;
        if(cp.desc)dh+=`<br><span style="font-size:8px;color:#6e7681">${cp.desc}</span>`;
        dh+=`</button>`;
      }
    }
    dh+=`</div>`;
  }
  if(!dh)dh='<div style="font-size:9px;color:#484f58">Instaluj Cloud uzel nebo Diskové pole do DC</div>';
  dcList.innerHTML=dh;
}

// Persistent notification feed (kept across the session)
let _notifFeed=[];
const _NOTIF_MAX=80;

function categorizeNotif(msg){
  // Simple heuristic categorization from message prefix/content
  const m=msg.toLowerCase();
  if(/výpadek|blackout|výpadky|obnoveno|ups|nms/.test(m))return 'outage';
  if(/zákazník|churn|migrace|tarif|spokojen/.test(m))return 'customer';
  if(/kč|příjm|náklad|bankrot|dividend|pokuta|dotace|investor|grant|sla penal/.test(m))return 'finance';
  if(/konkurent|trh|cen|snížil/.test(m))return 'competitor';
  if(/ddos|útok|bezpečnost|regulac|vichřice|bouřka|smart city|virál/.test(m))return 'event';
  return 'info';
}

function notify(msg,type){
  // Legacy transient toast
  const n=document.createElement('div');
  n.className='notif'+(type==='bad'?' bad':type==='good'?' good':type==='warn'?' warn':'');
  n.textContent=msg;
  const container=document.getElementById('notifications');
  if(container){
    container.appendChild(n);
    while(container.children.length>6)container.firstChild.remove();
    setTimeout(()=>{n.style.opacity='0';n.style.transition='opacity .3s';setTimeout(()=>n.remove(),300);},4500);
  }
  // Persistent feed entry
  const ts=G?`${G.date.d}.${G.date.m+1}.${G.date.y}`:'';
  const cat=categorizeNotif(msg);
  _notifFeed.unshift({msg,type:type||'info',cat,ts,at:Date.now()});
  if(_notifFeed.length>_NOTIF_MAX)_notifFeed.length=_NOTIF_MAX;
  renderNotifFeed();
}

// Current filter (null = all)
let _notifFilter=null;
function setNotifFilter(f){_notifFilter=_notifFilter===f?null:f;renderNotifFeed();}
function clearNotifFeed(){_notifFeed=[];renderNotifFeed();}

function renderNotifFeed(){
  const panel=document.getElementById('notifFeedList');
  if(!panel)return;
  const filtered=_notifFilter?_notifFeed.filter(n=>n.cat===_notifFilter):_notifFeed;
  if(filtered.length===0){
    panel.innerHTML='<div style="font-size:10px;color:#484f58;padding:8px;text-align:center">Žádné události</div>';
    return;
  }
  const catColors={outage:'#f85149',customer:'#00d4ff',finance:'#fbbf24',competitor:'#a78bfa',event:'#f59e0b',info:'#8b949e'};
  const catIcons={outage:'🔴',customer:'👥',finance:'💰',competitor:'📊',event:'⚡',info:'ℹ️'};
  let h='';
  for(const n of filtered.slice(0,30)){
    const c=n.type==='bad'?'#f85149':n.type==='good'?'#3fb950':n.type==='warn'?'#f59e0b':'#8b949e';
    h+=`<div style="display:flex;gap:6px;padding:4px 6px;margin:2px 0;background:#0d1117;border-left:2px solid ${c};border-radius:3px;font-size:10px;align-items:center">`;
    h+=`<span title="${n.cat}" style="color:${catColors[n.cat]};font-size:9px">${catIcons[n.cat]}</span>`;
    h+=`<span style="flex:1;color:#c9d1d9">${n.msg}</span>`;
    if(n.ts)h+=`<span style="font-size:8px;color:#484f58">${n.ts}</span>`;
    h+=`</div>`;
  }
  panel.innerHTML=h;
  // Filter button states
  document.querySelectorAll('.nf-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.cat===_notifFilter);
  });
}

// ====== STAFF TAB ======
function buildStaffList(){
  const list=document.getElementById('staffList');if(!list)return;
  list.innerHTML='';
  if(!G.employees)G.employees=[];

  // Current staff summary
  let totalCost=0;
  for(const em of G.employees){const st=STAFF_T[em.type];if(st)totalCost+=st.cost*em.count;}
  if(totalCost>0){
    let sh=`<div style="background:#0a1a0a;border:1px solid #3fb950;border-radius:5px;padding:6px 8px;margin-bottom:8px;font-size:9px">`;
    sh+=`<div style="font-weight:600;color:#3fb950">👥 Zaměstnanci: ${G.employees.reduce((s,e)=>s+e.count,0)}</div>`;
    sh+=`<div style="color:#8b949e;margin-top:2px">Mzdové náklady: <b style="color:#f85149">${fmtKc(totalCost)}/měs</b></div></div>`;
    list.innerHTML+=sh;
  }

  for(const type in STAFF_T){
    const st=STAFF_T[type];
    const count=getStaffCount(type);
    const div=document.createElement('div');
    div.style.cssText='background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:8px;margin-bottom:4px';
    let h=`<div style="display:flex;justify-content:space-between;align-items:center">`;
    h+=`<span style="font-size:11px;font-weight:600">${st.icon} ${st.name}</span>`;
    h+=`<span style="font-size:11px;color:#00d4ff;font-weight:600">${count}×</span></div>`;
    h+=`<div style="font-size:9px;color:#8b949e;margin:2px 0">${st.desc}</div>`;
    h+=`<div style="font-size:9px;color:#f59e0b">${fmtKc(st.cost)}/měs za osobu</div>`;
    h+=`<div style="display:flex;gap:4px;margin-top:4px">`;
    h+=`<button onclick="event.stopPropagation();hireStaff('${type}')" style="flex:1;padding:3px 6px;background:#1a1040;border:1px solid #3fb950;border-radius:4px;color:#3fb950;cursor:pointer;font-size:9px">+ Najít</button>`;
    if(count>0)h+=`<button onclick="event.stopPropagation();fireStaff('${type}')" style="flex:1;padding:3px 6px;background:#1a0a0a;border:1px solid #f85149;border-radius:4px;color:#f85149;cursor:pointer;font-size:9px">− Propustit</button>`;
    h+=`</div>`;
    div.innerHTML=h;
    list.appendChild(div);
  }
}

// ====== CONTRACTS ======
function buildContractList(){
  const list=document.getElementById('contractList');if(!list)return;
  list.innerHTML='';
  if(!G.contracts)G.contracts=[];
  if(!G.completedContracts)G.completedContracts=[];
  if(!G.generatedContracts)G.generatedContracts=[];

  const activeIds=new Set(G.contracts.map(c=>c.id));
  const doneIds=new Set(G.completedContracts);

  // ===== ACTIVE CONTRACTS =====
  const activeContracts=G.contracts.filter(c=>true);
  if(activeContracts.length>0){
    let ah='<div style="font-size:10px;font-weight:700;color:#f59e0b;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">📌 Aktivní ('+activeContracts.length+')</div>';
    for(const c of activeContracts){
      // Find definition — static or generated
      let ct=CONTRACTS.find(cc=>cc.id===c.id);
      if(!ct)ct=G.generatedContracts.find(cc=>cc.id===c.id);
      if(!ct)continue;
      const urgClr=c.remaining<=3?'#f85149':c.remaining<=6?'#f59e0b':'#8b949e';
      const catInfo=CONTRACT_CATS[ct.cat]||{name:'',color:'#8b949e'};
      ah+=`<div style="background:#0d1117;border:1px solid #f59e0b44;border-left:3px solid ${catInfo.color};border-radius:5px;padding:6px 8px;margin-bottom:4px">`;
      ah+=`<div style="display:flex;justify-content:space-between;align-items:center">`;
      ah+=`<span style="font-size:11px;font-weight:600">${ct.icon} ${ct.name}</span>`;
      ah+=`<span style="font-size:8px;color:${urgClr};font-weight:600">${c.remaining} měs.</span></div>`;
      ah+=`<div style="font-size:9px;color:#8b949e;margin:2px 0">${ct.desc}</div>`;
      // Progress bar (time remaining)
      const totalMonths=ct.months||12;
      const elapsed=totalMonths-c.remaining;
      const pct=Math.round(elapsed/totalMonths*100);
      ah+=`<div style="display:flex;align-items:center;gap:6px;margin-top:3px">`;
      ah+=`<div style="flex:1;height:4px;background:#21262d;border-radius:2px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${urgClr};border-radius:2px"></div></div>`;
      ah+=`<span style="font-size:8px;color:#3fb950">${fmtKc(ct.reward)}</span></div>`;
      ah+=`</div>`;
    }
    list.innerHTML+=ah;
  }

  // ===== AVAILABLE — grouped by category =====
  // Collect all available: static + generated
  const allAvail=[];
  for(const ct of CONTRACTS){
    if(activeIds.has(ct.id)||doneIds.has(ct.id))continue;
    allAvail.push({...ct,source:'static'});
  }
  for(const ct of G.generatedContracts){
    if(activeIds.has(ct.id)||doneIds.has(ct.id)||ct.expired)continue;
    allAvail.push({...ct,source:'generated'});
  }

  if(allAvail.length>0){
    let ah='<div style="font-size:10px;font-weight:700;color:#a78bfa;margin:10px 0 6px;text-transform:uppercase;letter-spacing:1px">📋 Dostupné ('+allAvail.length+')</div>';
    // Group by category
    const byCat={};
    for(const ct of allAvail){
      const cat=ct.cat||'other';
      if(!byCat[cat])byCat[cat]=[];
      byCat[cat].push(ct);
    }
    for(const catKey in byCat){
      const catInfo=CONTRACT_CATS[catKey]||{name:catKey,color:'#8b949e'};
      ah+=`<div style="font-size:8px;color:${catInfo.color};font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:8px 0 3px">${catInfo.name}</div>`;
      for(const ct of byCat[catKey]){
        const isGen=ct.source==='generated';
        ah+=`<div style="background:#0d1117;border:1px solid #21262d;border-left:3px solid ${catInfo.color};border-radius:5px;padding:6px 8px;margin-bottom:3px">`;
        ah+=`<div style="display:flex;justify-content:space-between;align-items:center">`;
        ah+=`<span style="font-size:10px;font-weight:600">${ct.icon} ${ct.name}${isGen?' <span style="font-size:7px;color:#f59e0b;background:#1a1a0a;padding:1px 4px;border-radius:2px">ZAKÁZKA</span>':''}</span>`;
        ah+=`<span style="font-size:8px;color:#8b949e">${ct.months}m</span></div>`;
        ah+=`<div style="font-size:9px;color:#8b949e;margin:2px 0">${ct.desc}</div>`;
        ah+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px">`;
        ah+=`<span style="font-size:9px;color:#3fb950;font-weight:600">${fmtKc(ct.reward)}</span>`;
        const acceptFn=isGen?`acceptGeneratedContract('${ct.id}')`:`acceptContract('${ct.id}')`;
        ah+=`<button onclick="event.stopPropagation();${acceptFn}" style="padding:3px 10px;background:#1a1040;border:1px solid #7c3aed;color:#a78bfa;border-radius:4px;cursor:pointer;font-size:8px;font-weight:600" onmouseover="this.style.background='#7c3aed';this.style.color='#fff'" onmouseout="this.style.background='#1a1040';this.style.color='#a78bfa'">Přijmout</button>`;
        ah+=`</div></div>`;
      }
    }
    list.innerHTML+=ah;
  }

  // ===== COMPLETED =====
  if(G.completedContracts.length>0){
    let ch='<div style="font-size:10px;font-weight:700;color:#3fb950;margin:10px 0 4px;text-transform:uppercase;letter-spacing:1px">✅ Splněné ('+G.completedContracts.length+')</div>';
    ch+='<div style="display:flex;flex-wrap:wrap;gap:3px">';
    for(const id of G.completedContracts){
      let ct=CONTRACTS.find(c=>c.id===id);
      if(!ct)ct=G.generatedContracts.find(c=>c.id===id);
      const name=ct?ct.name:id;
      const icon=ct?ct.icon:'✅';
      ch+=`<span style="display:inline-flex;align-items:center;gap:2px;padding:2px 6px;background:#0a1a0a;border:1px solid #3fb95044;border-radius:3px;font-size:8px;color:#3fb950" title="${name}">${icon}</span>`;
    }
    ch+='</div>';
    list.innerHTML+=ch;
  }
}

// ====== BINDING CONTRACTS (opravdové kontrakty s penále) ======
function buildBindingList(){
  const list=document.getElementById('bindingList');if(!list)return;
  list.innerHTML='';
  if(!G.bindingOffers)G.bindingOffers=[];
  if(!G.bindingContracts)G.bindingContracts=[];
  if(!G.bindingHistory)G.bindingHistory=[];

  // ===== AKTIVNÍ =====
  if(G.bindingContracts.length>0){
    let h='<div style="font-size:10px;font-weight:700;color:#f59e0b;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">📌 Podepsané ('+G.bindingContracts.length+')</div>';
    for(const c of G.bindingContracts){
      const urg=c.remaining<=2?'#f85149':c.remaining<=4?'#f59e0b':'#38d5f5';
      const totalM=c.months||12;
      const elapsed=totalM-c.remaining;
      const pct=Math.round(elapsed/totalM*100);
      // Live progress — použije check() pokud dostupný
      let progressPct=0;
      try{
        if(c.targetN){
          // Best-effort live progress readout
          if(c.tmplKey==='gigabit_business'){
            for(let ti=0;ti<G.tariffs.length;ti++){const t=G.tariffs[ti];if(t.active&&t.speed>=1000){let cn=0;for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const b=G.map[y][x].bld;if(b&&b.tariffDist&&b.tariffDist[ti])cn+=b.tariffDist[ti];}progressPct=Math.max(progressPct,Math.min(100,Math.round(cn/c.targetN*100)));}}
          } else if(c.check&&c.check(G)){progressPct=100;}
        }
      }catch(e){}
      h+=`<div style="background:#1a2030;border:1px solid #f5a52466;border-left:3px solid ${urg};border-radius:5px;padding:7px 9px;margin-bottom:5px">`;
      h+=`<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">`;
      h+=`<span style="font-size:10.5px;font-weight:700;color:#e8edf5">${c.clientIcon||'📜'} ${c.client}</span>`;
      h+=`<span style="font-size:9px;color:${urg};font-weight:700">${c.remaining} měs.</span></div>`;
      h+=`<div style="font-size:10px;color:#d1d9e6;font-weight:600;margin:2px 0">${c.icon} ${c.name}</div>`;
      h+=`<div style="font-size:9px;color:#9ba5b8;margin-bottom:4px">${c.desc}</div>`;
      h+=`<div style="display:flex;gap:6px;align-items:center;margin:3px 0">`;
      h+=`<div style="flex:1;height:4px;background:#2e3548;border-radius:2px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${urg};border-radius:2px"></div></div>`;
      h+=`<span style="font-size:8px;color:#7c8699">čas ${pct}%</span></div>`;
      if(progressPct>0){
        h+=`<div style="display:flex;gap:6px;align-items:center;margin:3px 0">`;
        h+=`<div style="flex:1;height:4px;background:#2e3548;border-radius:2px;overflow:hidden"><div style="height:100%;width:${progressPct}%;background:#4ec96b;border-radius:2px"></div></div>`;
        h+=`<span style="font-size:8px;color:#4ec96b">cíl ${progressPct}%</span></div>`;
      }
      h+=`<div style="display:flex;justify-content:space-between;font-size:9px;margin-top:3px">`;
      h+=`<span style="color:#4ec96b;font-weight:600">✅ ${fmtKc(c.reward)}</span>`;
      h+=`<span style="color:#f86963;font-weight:600">❌ −${fmtKc(c.penalty)}</span></div>`;
      h+=`</div>`;
    }
    list.innerHTML+=h;
  }

  // ===== NABÍDKY =====
  if(G.bindingOffers.length>0){
    let h='<div style="font-size:10px;font-weight:700;color:#38d5f5;margin:10px 0 6px;text-transform:uppercase;letter-spacing:1px">📥 Nabídky ('+G.bindingOffers.length+')</div>';
    for(const o of G.bindingOffers){
      const ratio=(o.penalty/Math.max(1,o.reward));
      const riskClr=ratio>=1.2?'#f86963':ratio>=0.95?'#f5a524':'#fbc531';
      h+=`<div style="background:#242b3d;border:1px solid #3a4358;border-left:3px solid #38d5f5;border-radius:5px;padding:7px 9px;margin-bottom:5px">`;
      h+=`<div style="display:flex;justify-content:space-between;align-items:center">`;
      h+=`<span style="font-size:10.5px;font-weight:700;color:#b69bff">${o.clientIcon||'📜'} ${o.client}</span>`;
      h+=`<span style="font-size:8px;color:#7c8699">${o.months} měs.</span></div>`;
      h+=`<div style="font-size:10px;color:#e8edf5;font-weight:600;margin:2px 0">${o.icon} ${o.name}</div>`;
      h+=`<div style="font-size:9px;color:#9ba5b8;margin-bottom:4px">${o.desc}</div>`;
      h+=`<div style="display:flex;justify-content:space-between;align-items:center;background:#1a2030;padding:3px 6px;border-radius:3px;margin:3px 0;font-size:9px">`;
      h+=`<span style="color:#4ec96b;font-weight:700">Odměna ${fmtKc(o.reward)}</span>`;
      h+=`<span style="color:${riskClr};font-weight:700">Penále ${fmtKc(o.penalty)} (${Math.round(ratio*100)}%)</span>`;
      h+=`</div>`;
      h+=`<div style="display:flex;gap:4px;margin-top:5px">`;
      h+=`<button onclick="event.stopPropagation();acceptBinding('${o.id}')" style="flex:1;padding:4px 8px;background:#1a4032;border:1px solid #4ec96b;color:#4ec96b;border-radius:4px;cursor:pointer;font-size:9px;font-weight:700" onmouseover="this.style.background='#4ec96b';this.style.color='#0f1720'" onmouseout="this.style.background='#1a4032';this.style.color='#4ec96b'">✍️ Podepsat</button>`;
      h+=`<button onclick="event.stopPropagation();declineBinding('${o.id}')" style="padding:4px 8px;background:#242b3d;border:1px solid #4a5470;color:#9ba5b8;border-radius:4px;cursor:pointer;font-size:9px" onmouseover="this.style.borderColor='#f86963';this.style.color='#f86963'" onmouseout="this.style.borderColor='#4a5470';this.style.color='#9ba5b8'">Odmítnout</button>`;
      h+=`</div>`;
      h+=`</div>`;
    }
    list.innerHTML+=h;
  }

  // ===== HISTORIE =====
  if(G.bindingHistory.length>0){
    const wins=G.bindingHistory.filter(h=>h.outcome==='won').length;
    const losses=G.bindingHistory.filter(h=>h.outcome==='failed').length;
    let h=`<div style="font-size:10px;font-weight:700;color:#9ba5b8;margin:10px 0 4px;text-transform:uppercase;letter-spacing:1px">📚 Historie (${wins}✅ / ${losses}❌)</div>`;
    h+='<div style="display:flex;flex-direction:column;gap:2px">';
    const shown=G.bindingHistory.slice(-10).reverse();
    for(const r of shown){
      const clr=r.outcome==='won'?'#4ec96b':'#f86963';
      const amt=r.outcome==='won'?`+${fmtKc(r.reward)}`:`−${fmtKc(r.penalty)}`;
      h+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;background:#1a2030;border:1px solid #2e3548;border-left:2px solid ${clr};border-radius:3px;font-size:9px">`;
      h+=`<span style="color:#d1d9e6">${r.clientIcon||'📜'} ${r.client} · ${r.name}</span>`;
      h+=`<span style="color:${clr};font-weight:700">${amt}</span>`;
      h+=`</div>`;
    }
    h+='</div>';
    list.innerHTML+=h;
  }

  if(G.bindingOffers.length===0&&G.bindingContracts.length===0&&G.bindingHistory.length===0){
    list.innerHTML='<p style="font-size:9px;color:#6e7681">Zatím žádné nabídky. Klienti se ozvou během pár měsíců.</p>';
  }
}

// ====== ACHIEVEMENTS ======
function buildAchList(){
  const list=document.getElementById('achList');if(!list)return;
  list.innerHTML='';
  if(!G.achievements)G.achievements=[];

  const earned=G.achievements.length;
  let h=`<div style="font-size:10px;color:#8b949e;margin-bottom:6px">${earned}/${ACHIEVEMENTS.length} odemčeno</div>`;
  h+=`<div class="cap-bar"><div class="fill ok" style="width:${Math.round(earned/ACHIEVEMENTS.length*100)}%"></div></div>`;

  for(const ach of ACHIEVEMENTS){
    const done=G.achievements.includes(ach.id);
    h+=`<div style="display:flex;align-items:center;padding:4px 6px;margin:2px 0;background:${done?'#0a1a0a':'#0d1117'};border:1px solid ${done?'#3fb950':'#21262d'};border-radius:5px;gap:8px">`;
    h+=`<span style="font-size:18px;${done?'':'filter:grayscale(1);opacity:.5'}">${ach.icon}</span>`;
    h+=`<div><div style="font-size:10px;font-weight:600;color:${done?'#3fb950':'#8b949e'}">${ach.name}${done?' ✅':''}</div>`;
    h+=`<div style="font-size:8px;color:#6e7681">${ach.desc}</div></div></div>`;
  }
  list.innerHTML=h;
}

// ====== COMPANY RATING ======
function buildRatingDisplay(){
  const el=document.getElementById('ratingDisplay');if(!el)return;
  const r=G.companyRating||1;
  el.innerHTML='<span style="color:#fbbf24">'+'⭐'.repeat(r)+'</span><span style="color:#21262d">'+'☆'.repeat(5-r)+'</span>'+`<div style="font-size:10px;color:#8b949e;margin-top:4px">${['','Nováček','Rostoucí','Stabilní','Profesionál','Magnát'][r]}</div>`;
}

// ====== MARKET SHARE / COMPETITORS ======
function buildMarketShareDisplay(){
  const el=document.getElementById('marketShare');if(!el)return;
  if(!G.competitorsEnabled||!G.competitors||G.competitors.length===0){
    el.innerHTML='<div style="font-size:10px;color:#484f58;padding:6px;text-align:center">Žádní AI konkurenti — aktivuj v nové hře</div>';
    return;
  }
  const data=getMarketShareData();
  const totalCust=data.reduce((s,r)=>s+r.customers,0);
  let h=`<div style="font-size:9px;color:#8b949e;margin-bottom:4px">Tržní podíl podle zákazníků (celkem ${fmt(totalCust)})</div>`;
  // Stacked bar
  h+='<div style="display:flex;height:14px;border-radius:4px;overflow:hidden;margin-bottom:6px;border:1px solid #21262d">';
  for(const r of data){
    const pct=Math.max(0.5,r.share*100);
    h+=`<div title="${r.name}: ${Math.round(r.share*100)}%" style="background:${r.color};width:${pct}%;position:relative"></div>`;
  }
  h+='</div>';
  // Per-competitor rows
  for(const r of data){
    const pct=(r.share*100).toFixed(1);
    const you=r.isPlayer?' 👤':'';
    const priceInfo=r.isPlayer?'':(r.avgPrice?` · ⌀ ${fmtKc(Math.round(r.avgPrice))}`:'');
    const strategyBadge=r.strategy?({budget:'💰 Nízké ceny',premium:'💎 Premium',balanced:'⚖️ Vyvážená'}[r.strategy]||''):'';
    h+=`<div style="display:flex;align-items:center;padding:4px 6px;margin:2px 0;background:#0d1117;border:1px solid ${r.isPlayer?'#7c3aed':'#21262d'};border-radius:4px;font-size:10px">`;
    h+=`<span style="display:inline-block;width:10px;height:10px;background:${r.color};border-radius:2px;margin-right:6px"></span>`;
    h+=`<span style="flex:1;color:${r.isPlayer?'#fff':'#8b949e'};font-weight:${r.isPlayer?'700':'400'}">${r.name}${you}</span>`;
    h+=`<span style="color:${r.isPlayer?'#7c3aed':r.color};font-weight:600">${pct}%</span>`;
    h+=`</div>`;
    if(strategyBadge||priceInfo){
      h+=`<div style="font-size:8px;color:#6e7681;padding:0 6px 4px 22px">${strategyBadge}${priceInfo}</div>`;
    }
  }
  el.innerHTML=h;
}

// ====== KPI DASHBOARD ======
function buildKPIDashboard(){
  const el=document.getElementById('kpiDashboard');if(!el)return;
  let h='';
  // Key metrics in grid
  const metrics=[
    {l:'Zákazníci',v:fmt(G.stats.cust),c:'#00d4ff'},
    {l:'Zisk/měs',v:fmtKc(G.stats.inc-G.stats.exp),c:G.stats.inc-G.stats.exp>=0?'#3fb950':'#f85149'},
    {l:'Služby',v:(G.services||[]).length+'/'+SERVICES.length,c:'#a78bfa'},
    {l:'DC',v:G.dcs.length+'',c:'#f59e0b'},
    {l:'Zaměstnanci',v:(G.employees||[]).reduce((s,e)=>s+e.count,0)+'',c:'#22d3ee'},
    {l:'Achievementy',v:(G.achievements||[]).length+'/'+ACHIEVEMENTS.length,c:'#fbbf24'},
  ];
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">';
  for(const m of metrics){
    h+=`<div style="background:#0d1117;border:1px solid #21262d;border-radius:5px;padding:6px;text-align:center">`;
    h+=`<div style="font-size:14px;font-weight:700;color:${m.c}">${m.v}</div>`;
    h+=`<div style="font-size:8px;color:#6e7681">${m.l}</div></div>`;
  }
  h+='</div>';

  // Investor status
  if(G.investor){
    const inv=G.investor;
    const patienceColor=inv.patience>inv.maxPatience*0.6?'#3fb950':inv.patience>inv.maxPatience*0.3?'#f59e0b':'#f85149';
    const patiencePct=Math.round(inv.patience/inv.maxPatience*100);
    h+=`<div style="background:#1a0a0a;border:1px solid #f59e0b;border-radius:5px;padding:6px 8px;margin-top:6px">`;
    h+=`<div style="font-size:9px;font-weight:600;color:#f59e0b;margin-bottom:3px">${inv.icon} Investor: ${inv.name}</div>`;
    h+=`<div style="display:flex;justify-content:space-between;font-size:9px;margin:2px 0"><span style="color:#8b949e">Podíl:</span><span style="color:#f59e0b;font-weight:600">${inv.equityPct}%</span></div>`;
    h+=`<div style="display:flex;justify-content:space-between;font-size:9px;margin:2px 0"><span style="color:#8b949e">Trpělivost:</span><span style="color:${patienceColor};font-weight:600">${patiencePct}%</span></div>`;
    h+=`<div style="background:#21262d;border-radius:3px;height:4px;margin-top:3px"><div style="background:${patienceColor};width:${patiencePct}%;height:100%;border-radius:3px"></div></div>`;
    h+=`<div style="display:flex;justify-content:space-between;font-size:8px;margin-top:3px;color:#6e7681"><span>Investováno: ${fmtKc(inv.totalInvested)}</span><span>Vyplaceno: ${fmtKc(inv.totalDivPaid)}</span></div>`;
    if(inv.equityPct>0){
      const valuation=getCompanyValuation();
      const buybackCost=Math.round(valuation*0.05/5*inv.equityPct);
      h+=`<div style="font-size:8px;color:#6e7681;margin-top:2px">Odkup 5%: ~${fmtKc(Math.round(valuation*0.05))}</div>`;
    }
    h+=`</div>`;
  }

  // AI Competitors summary
  if(G.competitorsEnabled&&G.competitors&&G.competitors.length>0){
    h+=`<div style="font-size:9px;font-weight:600;color:#e74c3c;margin:8px 0 4px">🏢 Konkurence:</div>`;
    for(const ai of G.competitors){
      h+=`<div style="display:flex;justify-content:space-between;padding:2px 4px;font-size:9px;margin:1px 0;background:#161b22;border-radius:3px">`;
      h+=`<span style="color:${ai.color}">${ai.name}</span>`;
      h+=`<span style="color:#8b949e">${ai.customers} zák · ${ai.dcs.length} DC</span></div>`;
    }
  }
  el.innerHTML=h;
}

// ====== REVENUE CHART ======
function buildRevenueChart(){
  const cv=document.getElementById('revenueChart');if(!cv)return;
  const cx=cv.getContext('2d');
  const w=cv.width,h=cv.height;
  cx.fillStyle='#0d1117';cx.fillRect(0,0,w,h);
  const hist=G.stats.hist;if(!hist||hist.length<2)return;

  const maxVal=Math.max(...hist.map(h=>Math.max(h.i,h.e)),1);
  const pad={l:35,r:5,t:15,b:20};
  const cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;

  // Grid
  cx.strokeStyle='#21262d';cx.lineWidth=1;
  for(let i=0;i<5;i++){const y=pad.t+ch*i/4;cx.beginPath();cx.moveTo(pad.l,y);cx.lineTo(w-pad.r,y);cx.stroke();
    cx.font='7px sans-serif';cx.fillStyle='#484f58';cx.textAlign='right';cx.fillText(fmt(Math.round(maxVal*(1-i/4))),pad.l-3,y+3);}

  // Income line (green)
  cx.beginPath();cx.strokeStyle='#3fb950';cx.lineWidth=1.5;
  for(let i=0;i<hist.length;i++){const x=pad.l+i*cw/(hist.length-1),y=pad.t+ch*(1-hist[i].i/maxVal);
    if(i===0)cx.moveTo(x,y);else cx.lineTo(x,y);}
  cx.stroke();

  // Expense line (red)
  cx.beginPath();cx.strokeStyle='#f85149';cx.lineWidth=1.5;
  for(let i=0;i<hist.length;i++){const x=pad.l+i*cw/(hist.length-1),y=pad.t+ch*(1-hist[i].e/maxVal);
    if(i===0)cx.moveTo(x,y);else cx.lineTo(x,y);}
  cx.stroke();

  // Labels
  cx.font='7px sans-serif';cx.fillStyle='#3fb950';cx.textAlign='left';cx.fillText('Příjmy',pad.l+2,pad.t-4);
  cx.fillStyle='#f85149';cx.fillText('Náklady',pad.l+40,pad.t-4);

  // X axis labels
  cx.fillStyle='#484f58';cx.textAlign='center';
  const step=Math.max(1,Math.floor(hist.length/6));
  for(let i=0;i<hist.length;i+=step){
    const x=pad.l+i*cw/(hist.length-1);
    cx.fillText(hist[i].d,x,h-3);
  }
}

// ====== IXP STATUS ======
function buildIXPStatus(){
  const el=document.getElementById('ixpStatus');if(!el)return;
  if(G.hasIXP){
    el.innerHTML=`<div style="background:#0a1a0a;border:1px solid #3fb950;border-radius:5px;padding:6px 8px;font-size:9px"><div style="font-weight:600;color:#3fb950">✅ ${IXP.name} aktivní</div><div style="color:#8b949e;margin-top:2px">+${fmtBW(IXP.bwBonus)} BW bonus · ${fmtKc(IXP.mCost)}/měs</div></div>`;
  } else {
    const hasBGP=anyDCHasEq(['eq_bgprouter']);
    el.innerHTML=`<button onclick="buyIXP()" style="display:block;width:100%;padding:6px 8px;background:#0d1117;border:1px solid ${hasBGP?'#7c3aed':'#21262d'};border-radius:5px;color:${hasBGP?'#e0e0e0':'#484f58'};cursor:${hasBGP?'pointer':'default'};font-size:10px;text-align:left" ${hasBGP?'':'disabled'}>🔗 ${IXP.name} · <span style="color:#f59e0b">${fmtCostInfl(IXP.cost)}</span> · <span style="color:#8b949e">${fmtKc(inflComponentCost(IXP.mCost))}/m</span>${!hasBGP?' 🔒 (BGP router)':''}</button>`;
  }
}

// ====== CITY EXPANSION ======
function buildCityList(){
  const el=document.getElementById('cityList');if(!el)return;
  let h='';
  for(let i=0;i<CITIES.length;i++){
    const city=CITIES[i];
    const unlocked=city.unlocked||(G.unlockedCities||[]).includes(city.id);
    const canUnlock=!unlocked&&G.stats.cust>=city.minCust&&G.cash>=city.cost;
    h+=`<div style="background:#0d1117;border:1px solid ${unlocked?'#3fb950':'#21262d'};border-radius:5px;padding:6px 8px;margin-bottom:4px">`;
    h+=`<div style="font-size:11px;font-weight:600;color:${unlocked?'#3fb950':'#8b949e'}">🏙️ ${city.name}${unlocked?' ✅':''}</div>`;
    if(!unlocked){
      h+=`<div style="font-size:9px;color:#8b949e">Cena: ${fmtKc(city.cost)} · Potřeba: ${city.minCust} zákazníků</div>`;
      h+=`<button onclick="unlockCity(${i})" style="margin-top:3px;padding:3px 8px;background:#1a1040;border:1px solid ${canUnlock?'#7c3aed':'#21262d'};color:${canUnlock?'#a78bfa':'#484f58'};border-radius:4px;cursor:${canUnlock?'pointer':'default'};font-size:9px;width:100%" ${canUnlock?'':'disabled'}>🔓 Odemknout</button>`;
    }
    h+=`</div>`;
  }
  el.innerHTML=h;
}

function buildMapExpandPanel(){
  const el=document.getElementById('mapExpandPanel');if(!el)return;
  const info=(typeof mapExpansionCost==='function')?mapExpansionCost():{delta:Math.ceil(MAP/4),cost:0};
  const atMax=MAP>=MAP_MAX;
  const canAfford=G.cash>=info.cost;
  const nSize=atMax?MAP:(MAP+info.delta);
  const clr=atMax?'#7c8699':(canAfford?'#4ec96b':'#f5a524');
  let h='';
  h+=`<div style="background:var(--bg-1);border:1px solid var(--bd-1);border-radius:5px;padding:7px 9px;margin-bottom:6px">`;
  h+=`<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;margin-bottom:4px">`;
  h+=`<span style="color:var(--tx-2)">Velikost: <b style="color:var(--ac-cyan)">${MAP}×${MAP}</b></span>`;
  h+=`<span style="color:var(--tx-4);font-size:9px">Rozšíření: ${(G.expansions||[]).length}×</span></div>`;
  if(atMax){
    h+=`<div style="font-size:9px;color:var(--ac-amber);padding:4px 0">⛔ Dosažen strop mapy ${MAP_MAX}×${MAP_MAX}. Další expanze by hra nezvládla renderovat.</div>`;
  } else {
    h+=`<div style="font-size:9px;color:var(--tx-3);margin-bottom:5px">Přidá pás <b>${info.delta}</b> tilů (nová velikost <b>${nSize}×${nSize}</b>). Cena: <b style="color:${clr}">${fmtKc(info.cost)}</b></div>`;
    // 3×3 grid se směrovými tlačítky (N nahoře, E/W po stranách, S dole)
    h+=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:auto auto auto;gap:3px;margin-top:4px">`;
    h+=`<span></span>`;
    h+=`<button onclick="expandMap('n')" ${canAfford?'':'disabled'} style="padding:6px;background:${canAfford?'var(--bg-2)':'var(--bg-0)'};border:1px solid ${canAfford?'var(--ac-cyan)':'var(--bd-1)'};color:${canAfford?'var(--ac-cyan)':'var(--tx-5)'};border-radius:4px;cursor:${canAfford?'pointer':'default'};font-size:10px;font-weight:700" title="Rozšířit na sever">⬆️ N</button>`;
    h+=`<span></span>`;
    h+=`<button onclick="expandMap('w')" ${canAfford?'':'disabled'} style="padding:6px;background:${canAfford?'var(--bg-2)':'var(--bg-0)'};border:1px solid ${canAfford?'var(--ac-cyan)':'var(--bd-1)'};color:${canAfford?'var(--ac-cyan)':'var(--tx-5)'};border-radius:4px;cursor:${canAfford?'pointer':'default'};font-size:10px;font-weight:700" title="Rozšířit na západ">⬅️ W</button>`;
    h+=`<div style="display:flex;align-items:center;justify-content:center;font-size:16px">🗺️</div>`;
    h+=`<button onclick="expandMap('e')" ${canAfford?'':'disabled'} style="padding:6px;background:${canAfford?'var(--bg-2)':'var(--bg-0)'};border:1px solid ${canAfford?'var(--ac-cyan)':'var(--bd-1)'};color:${canAfford?'var(--ac-cyan)':'var(--tx-5)'};border-radius:4px;cursor:${canAfford?'pointer':'default'};font-size:10px;font-weight:700" title="Rozšířit na východ">➡️ E</button>`;
    h+=`<span></span>`;
    h+=`<button onclick="expandMap('s')" ${canAfford?'':'disabled'} style="padding:6px;background:${canAfford?'var(--bg-2)':'var(--bg-0)'};border:1px solid ${canAfford?'var(--ac-cyan)':'var(--bd-1)'};color:${canAfford?'var(--ac-cyan)':'var(--tx-5)'};border-radius:4px;cursor:${canAfford?'pointer':'default'};font-size:10px;font-weight:700" title="Rozšířit na jih">⬇️ S</button>`;
    h+=`<span></span>`;
    h+=`</div>`;
  }
  // Historie expanzí
  if((G.expansions||[]).length>0){
    h+=`<div style="margin-top:6px;padding-top:5px;border-top:1px solid var(--bd-1);font-size:8px;color:var(--tx-4);line-height:1.5">`;
    const last=G.expansions.slice(-4).reverse();
    for(const ex of last){
      const d={n:'N',s:'S',e:'E',w:'W'}[ex.dir]||ex.dir;
      h+=`${ex.y}/${String(ex.m+1).padStart(2,'0')}: ${d} +${ex.delta}t → ${ex.sizeAfter}² (${fmtKc(ex.cost||0)})<br>`;
    }
    h+=`</div>`;
  }
  h+=`</div>`;
  el.innerHTML=h;
}

function buildIPOStatus(){
  const el=document.getElementById('ipoStatus');if(!el)return;
  if(G.ipoCompleted){
    const sp=G.sharePrice||100;
    // Stock price fluctuates with company performance
    const currentPrice=Math.round(sp*(0.8+G.companyRating*.1+G.stats.cust/2000));
    el.innerHTML=`<div style="background:#0a1a0a;border:1px solid #3fb950;border-radius:5px;padding:8px;font-size:10px"><div style="font-weight:600;color:#3fb950">📈 Na burze!</div><div style="color:#8b949e;margin-top:2px">Akcie: ${fmtKc(currentPrice)} · Tržní kap: ${fmtKc(currentPrice*(G.totalShares||1000))}</div></div>`;
  } else {
    const canIPO=G.stats.cust>=IPO.minCust&&(G.companyRating||1)>=IPO.minRating;
    el.innerHTML=`<button onclick="doIPO()" style="display:block;width:100%;padding:6px 8px;background:#0d1117;border:1px solid ${canIPO?'#fbbf24':'#21262d'};border-radius:5px;color:${canIPO?'#fbbf24':'#484f58'};cursor:${canIPO?'pointer':'default'};font-size:10px" ${canIPO?'':'disabled'}>🏦 IPO · Potřeba: ${IPO.minCust} zák. + ${IPO.minRating}⭐</button>`;
  }
}

// ====== DC INTERIOR MODAL ======
let dcModalIdx=-1;

function openDCModal(dcIdx){
  dcModalIdx=dcIdx;
  document.getElementById('dcModal').classList.add('open');
  renderDCModal();
}
function closeDCModal(){
  dcModalIdx=-1;
  document.getElementById('dcModal').classList.remove('open');
}

function renderDCModal(){
  if(dcModalIdx<0||dcModalIdx>=G.dcs.length){closeDCModal();return;}
  const dc=G.dcs[dcModalIdx],dt=DC_T[dc.type];
  const eqs=dc.eq||[];
  const isOut=dc.outage&&dc.outage.active;

  // Header
  document.getElementById('dcModalTitle').innerHTML=`${isOut?'⚠️':'🏢'} ${dt.name} #${dcModalIdx+1} <span style="font-size:11px;color:#8b949e;font-weight:400">[${dc.x},${dc.y}]</span>`;
  const outEl=document.getElementById('dcModalOutage');
  if(isOut){outEl.style.display='inline';outEl.textContent=`🔴 VÝPADEK: ${dc.outage.cause} (${dc.outage.remaining}d)`;}
  else{outEl.style.display='none';}

  // Calculate capacities
  let maxSlots=dt.slots;
  for(const e of eqs){if(EQ[e]&&EQ[e].eff==='cooling')maxSlots+=EQ[e].val;}
  let maxBW=dt.baseBW;for(const bwu of(dc.bwUpgrades||[]))maxBW+=bwu.bw;
  if(G.hasIXP)maxBW+=IXP.bwBonus;
  const load=dcLoads[dcModalIdx]||{usedBW:0,maxBW,ratio:0};
  const stInfo=getDCStorage(dcModalIdx);
  const compInfo=getDCCompute(dcModalIdx);

  // Security level
  let secLevel=0;
  for(const e of eqs){const eq=EQ[e];if(eq&&eq.fwTier)secLevel=Math.max(secLevel,eq.fwTier);}
  const hasUPS=eqs.includes('eq_ups');
  const hasCooling=eqs.some(e=>EQ[e]&&EQ[e].eff==='cooling');

  // === RACK AREA ===
  const rackArea=document.getElementById('dcRackArea');
  let rh='';

  // Summary cards
  const netCap=getDCNetCapacity(dcModalIdx);
  const portRatio=netCap.totalPorts>0?netCap.usedPorts/netCap.totalPorts:0;
  const routRatio=netCap.routerCap>0?netCap.usedConns/netCap.routerCap:0;
  const effMaxBW=load.maxBW||maxBW;
  const bgpIn=load.sharedIn||0;
  const bgpOut=load.sharedOut||0;
  rh+=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">`;
  rh+=dcMiniCard('📡','Bandwidth',`${fmtBW(load.usedBW)}/${fmtBW(effMaxBW)}`,load.ratio,load.ratio>.9?'#f85149':load.ratio>.7?'#f59e0b':'#3fb950');
  rh+=dcMiniCard('🔌','Rack sloty',`${eqs.length}/${maxSlots}`,maxSlots>0?eqs.length/maxSlots:0,eqs.length>=maxSlots?'#f85149':eqs.length>=maxSlots*.8?'#f59e0b':'#3fb950');
  rh+=dcMiniCard('🛡️','Bezpečnost',['Žádná','Basic','Pro','Enterprise'][secLevel],secLevel/3,secLevel===0?'#f85149':secLevel===1?'#f59e0b':secLevel===2?'#22d3ee':'#3fb950');
  rh+=`</div>`;
  rh+=`<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:6px">`;
  rh+=dcMiniCard('🔗','Porty',`${netCap.usedPorts}/${netCap.totalPorts}`,portRatio,portRatio>.9?'#f85149':portRatio>.7?'#f59e0b':'#3fb950');
  rh+=dcMiniCard('📡','Router',`${netCap.usedConns}/${netCap.routerCap}`,routRatio,routRatio>.9?'#f85149':routRatio>.7?'#f59e0b':'#00d4ff');
  rh+=`</div>`;
  // Port breakdown tooltip
  rh+=`<div style="font-size:10px;color:#8b949e;margin:4px 0 2px;text-align:center">`;
  rh+=`Porty: ${netCap.usedConns} přípojek + ${netCap.bwUplinks||0} transit + ${netCap.towerPorts||0} věží`;
  rh+=`</div>`;

  // BW stacked bar with BGP visualization
  if(bgpIn>0||bgpOut>0){
    const ownBW=maxBW;
    const totalBar=effMaxBW>0?effMaxBW:1;
    const ownPct=Math.round(ownBW/totalBar*100);
    const bgpPct=Math.round(bgpIn/totalBar*100);
    const usedPct=Math.min(100,Math.round(load.usedBW/totalBar*100));
    rh+=`<div style="background:#161b22;border:1px solid #21262d;border-radius:6px;padding:8px;margin:6px 0">`;
    rh+=`<div style="font-size:9px;color:#8b949e;margin-bottom:4px;font-weight:600">📡 Bandwidth breakdown</div>`;
    // Stacked bar
    rh+=`<div style="height:18px;border-radius:4px;overflow:hidden;background:#0d1117;display:flex;position:relative">`;
    rh+=`<div style="width:${ownPct}%;background:#1a4a1a;border-right:1px solid #0d1117" title="Vlastní: ${fmtBW(ownBW)}"></div>`;
    if(bgpIn>0)rh+=`<div style="width:${bgpPct}%;background:#2d1a4a;border-right:1px solid #0d1117" title="BGP přijato: ${fmtBW(bgpIn)}"></div>`;
    // Usage overlay
    rh+=`<div style="position:absolute;top:0;left:0;height:100%;width:${usedPct}%;background:rgba(255,255,255,.12);pointer-events:none"></div>`;
    rh+=`</div>`;
    // Legend
    rh+=`<div style="display:flex;gap:10px;margin-top:4px;font-size:8px">`;
    rh+=`<span><span style="display:inline-block;width:8px;height:8px;background:#1a4a1a;border-radius:2px;margin-right:3px"></span>Vlastní ${fmtBW(ownBW)}</span>`;
    if(bgpIn>0)rh+=`<span><span style="display:inline-block;width:8px;height:8px;background:#2d1a4a;border-radius:2px;margin-right:3px"></span>BGP ← ${fmtBW(bgpIn)}</span>`;
    if(bgpOut>0)rh+=`<span style="color:#f59e0b"><span style="display:inline-block;width:8px;height:8px;background:#4a3a1a;border-radius:2px;margin-right:3px"></span>BGP → ${fmtBW(bgpOut)}</span>`;
    rh+=`<span style="color:#e0e0e0">Využito: ${fmtBW(load.usedBW)}</span>`;
    rh+=`</div></div>`;
  }

  // Rack visualization — split into "racks" of 8 slots
  const slotsPerRack=8;
  const totalRacks=Math.ceil(maxSlots/slotsPerRack);
  for(let ri=0;ri<totalRacks;ri++){
    const rackStart=ri*slotsPerRack;
    const rackEnd=Math.min(rackStart+slotsPerRack,maxSlots);
    rh+=`<div class="rack">`;
    rh+=`<div class="rack-header"><span>Rack ${ri+1}</span><span>Sloty ${rackStart+1}–${rackEnd}</span></div>`;
    rh+=`<div class="rack-grid">`;
    for(let si=rackStart;si<rackEnd;si++){
      if(si<eqs.length){
        const eqKey=eqs[si];
        const eq=EQ[eqKey];
        if(!eq){rh+=`<div class="rack-slot filled"><span class="slot-icon">❓</span></div>`;continue;}
        let ledClass=isOut?'red':'green';
        if(!isOut&&eq.eff==='security'&&eq.fwTier<2)ledClass='amber';
        let borderClr='#30363d';
        if(eq.eff==='cap'||eq.eff==='ports')borderClr='#22d3ee';
        else if(eq.eff==='security')borderClr='#f59e0b';
        else if(eq.eff==='quality'||eq.eff==='cloud')borderClr='#a78bfa';
        else if(eq.eff==='storage')borderClr='#3fb950';
        else if(eq.eff==='reliable'||eq.eff==='cooling')borderClr='#ef4444';
        else if(eq.eff==='routing'||eq.eff==='lb')borderClr='#06b6d4';

        rh+=`<div class="rack-slot filled" style="border-color:${borderClr}" title="${eq.name} · ${fmtKc(eq.mCost)}/měs\nKlikni pro odebrání (50% refund)" onclick="event.stopPropagation();removeEqFromDC(${dcModalIdx},${si})">`;
        rh+=`<span class="slot-led ${ledClass}"></span>`;
        rh+=`<span class="slot-icon">${eq.icon}</span>`;
        rh+=`<span class="slot-name">${eq.name}</span>`;
        rh+=`</div>`;
      } else {
        rh+=`<div class="rack-slot"><span style="font-size:14px;color:#21262d">+</span></div>`;
      }
    }
    rh+=`</div></div>`;
  }

  // BW Upgrades
  rh+=`<div class="rack" style="border-color:#f59e0b44">`;
  rh+=`<div class="rack-header"><span style="color:#f59e0b">📡 Transit / Bandwidth</span><span>${fmtBW(load.usedBW)} / ${fmtBW(effMaxBW)}${bgpIn>0?' <span style="color:#a78bfa;font-size:8px">(+'+fmtBW(bgpIn)+' BGP)</span>':''}</span></div>`;
  rh+=`<div style="padding:6px;display:flex;flex-wrap:wrap;gap:4px">`;
  for(let bwi=0;bwi<(dc.bwUpgrades||[]).length;bwi++){
    const bwu=dc.bwUpgrades[bwi];
    rh+=`<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:#1a1a0a;border:1px solid #f59e0b;border-radius:4px;font-size:9px">📡 +${fmtBW(bwu.bw)} · ${fmtKc(bwu.mCost)}/m <button onclick="event.stopPropagation();removeBW(${dcModalIdx},${bwi});renderDCModal()" style="padding:0 3px;background:none;border:1px solid #f85149;border-radius:2px;color:#f85149;cursor:pointer;font-size:8px;line-height:1.2" title="Odebrat (30% refund)">✕</button></span>`;
  }
  if(!(dc.bwUpgrades||[]).length)rh+=`<span style="color:#484f58;font-size:9px">Pouze základní BW (${fmtBW(dt.baseBW)})</span>`;
  // BGP sharing info
  if(load.sharedIn>0)rh+=`<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:#1a1040;border:1px solid #a78bfa;border-radius:4px;font-size:9px;color:#a78bfa">🔀 BGP ← +${fmtBW(load.sharedIn)} z propojených DC</span>`;
  if(load.sharedOut>0)rh+=`<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:#1a1040;border:1px solid #a78bfa;border-radius:4px;font-size:9px;color:#a78bfa">🔀 BGP → ${fmtBW(load.sharedOut)} sdíleno ostatním DC</span>`;
  rh+=`</div><div style="padding:0 6px 6px;display:flex;flex-wrap:wrap;gap:3px">`;
  for(let bi=0;bi<BW_UPGRADES.length;bi++){
    const bwu=BW_UPGRADES[bi];
    rh+=`<button onclick="event.stopPropagation();buyBW(${dcModalIdx},${bi});renderDCModal()" style="padding:3px 8px;background:#0d1117;border:1px solid #21262d;border-radius:4px;color:#e0e0e0;cursor:pointer;font-size:8px;transition:.15s" onmouseover="this.style.borderColor='#f59e0b'" onmouseout="this.style.borderColor='#21262d'">+${fmtBW(bwu.bw)} · ${fmtCostInfl(bwu.cost)}</button>`;
  }
  rh+=`</div></div>`;

  // Cloud capacity
  if(compInfo.vCPU>0||stInfo.total>0){
    rh+=`<div class="rack" style="border-color:#a78bfa44">`;
    rh+=`<div class="rack-header"><span style="color:#a78bfa">☁️ Cloud kapacita</span></div>`;
    rh+=`<div style="padding:6px;font-size:10px">`;
    if(compInfo.vCPU>0){
      const cpuR=compInfo.usedCPU/compInfo.vCPU;const ramR=compInfo.ram>0?compInfo.usedRAM/compInfo.ram:0;
      rh+=`<div style="margin-bottom:4px">CPU: <b style="color:${cpuR>.9?'#f85149':'#3fb950'}">${compInfo.usedCPU}/${compInfo.vCPU} vCPU</b></div>`;
      rh+=`<div class="cap-bar"><div class="fill ${cpuR>.9?'crit':cpuR>.7?'warn':'ok'}" style="width:${Math.min(100,cpuR*100)}%"></div></div>`;
      rh+=`<div style="margin:4px 0">RAM: <b style="color:${ramR>.9?'#f85149':'#3fb950'}">${compInfo.usedRAM}/${compInfo.ram} GB</b></div>`;
      rh+=`<div class="cap-bar"><div class="fill ${ramR>.9?'crit':ramR>.7?'warn':'ok'}" style="width:${Math.min(100,ramR*100)}%"></div></div>`;
    }
    if(stInfo.total>0){
      const stR=stInfo.used/stInfo.total;
      rh+=`<div style="margin:4px 0">Storage: <b style="color:${stR>.9?'#f85149':'#3fb950'}">${stInfo.used.toFixed(1)}/${stInfo.total} TB</b></div>`;
      rh+=`<div class="cap-bar"><div class="fill ${stR>.9?'crit':stR>.7?'warn':'ok'}" style="width:${Math.min(100,stR*100)}%"></div></div>`;
    }
    rh+=`</div></div>`;
  }

  // DC Links & BGP Peerings
  const links=(G.dcLinks||[]).filter(l=>l.dc1===dcModalIdx||l.dc2===dcModalIdx);
  const hasBGP=eqs.some(e=>EQ[e]&&EQ[e].bgpCap);
  const bgpTotal=eqs.filter(e=>EQ[e]&&EQ[e].bgpCap).reduce((s,e)=>s+(EQ[e].bgpCap||0),0);
  const myPeerings=(G.bgpPeerings||[]).map((p,i)=>({...p,idx:i})).filter(p=>p.dc1===dcModalIdx||p.dc2===dcModalIdx);

  if(links.length||myPeerings.length||hasBGP){
    rh+=`<div class="rack" style="border-color:#a78bfa44">`;
    rh+=`<div class="rack-header"><span style="color:#a78bfa">🔀 BGP Peering & Směrování</span>${hasBGP?`<span style="font-size:8px">Kapacita: ${fmtBW(bgpTotal)}</span>`:''}</div>`;
    rh+=`<div style="padding:6px">`;

    // Physical links overview + diagnostic for unlinked BGP-capable DCs
    {
      rh+=`<div style="font-size:9px;color:#8b949e;margin-bottom:6px">📡 Ostatní DC:</div>`;
      let shownAny=false;
      for(let oi=0;oi<G.dcs.length;oi++){
        if(oi===dcModalIdx)continue;
        const odc=G.dcs[oi];
        const oBGP=(odc.eq||[]).some(e=>EQ[e]&&EQ[e].bgpCap);
        const link=links.find(l=>l.dc1===oi||l.dc2===oi);
        const peerExists=myPeerings.some(p=>(p.dc1===oi||p.dc2===oi));
        shownAny=true;
        if(link){
          const pathCount=link.paths?link.paths.length:1;
          rh+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 6px;background:#161b22;border:1px solid #21262d;border-radius:4px;margin-bottom:3px;font-size:9px">`;
          rh+=`<span>🔗 DC#${oi+1} · ${fmtBW(link.capacity)} · ${pathCount} ${pathCount>1?'tras':'trasa'}${oBGP?' · <span style="color:#3fb950">BGP✓</span>':'<span style="color:#f59e0b"> · bez BGP</span>'}</span>`;
          if(hasBGP&&oBGP&&!peerExists){
            rh+=`<button onclick="event.stopPropagation();createBGPPeering(${dcModalIdx},${oi});renderDCModal()" style="padding:2px 6px;background:#1a1040;border:1px solid #a78bfa;border-radius:3px;color:#a78bfa;cursor:pointer;font-size:8px" title="Vytvořit BGP peering">+ BGP</button>`;
          }
          rh+=`</div>`;
        } else {
          // Not linked — diagnose and show hint
          const diag=(typeof diagDCPath==='function')?diagDCPath(dcModalIdx,oi):{status:'noRoadPath'};
          let hint='';
          if(diag.status==='noRoadPath'){
            hint='není silniční trasa mezi DC (polož silnice nebo junctiony)';
          } else if(diag.status==='cableGap'){
            if(diag.at){
              const a=diag.at[0],b=diag.at[1];
              hint=`chybí kabel na segmentu (${a[0]},${a[1]})↔(${b[0]},${b[1]})`;
            } else {
              hint='silnice ano, ale někde v trase chybí kabel';
            }
          }
          rh+=`<div style="padding:3px 6px;background:#161b22;border:1px solid #30363d;border-radius:4px;margin-bottom:3px;font-size:9px;color:#8b949e">`;
          rh+=`⚠️ DC#${oi+1}${oBGP?' (BGP✓)':' (bez BGP)'} — <span style="color:#f59e0b">${hint}</span>`;
          rh+=`</div>`;
        }
      }
      if(!shownAny){
        rh+=`<div style="font-size:9px;color:#484f58;font-style:italic">Žádná další DC na mapě.</div>`;
      }
    }

    // Active BGP Peerings with controls
    if(myPeerings.length){
      rh+=`<div style="font-size:9px;color:#a78bfa;margin:8px 0 4px;font-weight:600">🔀 Aktivní BGP Peerings:</div>`;
      for(const p of myPeerings){
        const oi=p.dc1===dcModalIdx?p.dc2:p.dc1;
        const traffic=p._actualTraffic||0;
        const allocPct=p.maxBW>0?Math.round(p.allocBW/p.maxBW*100):0;
        const trafficPct=p.allocBW>0?Math.round(traffic/p.allocBW*100):0;
        const stClr=p.active?'#3fb950':'#484f58';
        rh+=`<div style="background:#161b22;border:1px solid ${p.active?'#a78bfa44':'#21262d'};border-radius:6px;padding:8px;margin-bottom:6px">`;
        // Header
        rh+=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">`;
        rh+=`<span style="font-size:10px;font-weight:600;color:${stClr}">↔ DC#${oi+1} ${p.active?'':'(pozastaveno)'}</span>`;
        rh+=`<div style="display:flex;gap:3px">`;
        rh+=`<button onclick="event.stopPropagation();toggleBGPPeering(${p.idx});renderDCModal()" style="padding:2px 6px;background:none;border:1px solid ${p.active?'#f59e0b':'#3fb950'};border-radius:3px;color:${p.active?'#f59e0b':'#3fb950'};cursor:pointer;font-size:7px">${p.active?'⏸️':'▶️'}</button>`;
        rh+=`<button onclick="event.stopPropagation();removeBGPPeering(${p.idx});renderDCModal()" style="padding:2px 6px;background:none;border:1px solid #f85149;border-radius:3px;color:#f85149;cursor:pointer;font-size:7px">✕</button>`;
        rh+=`</div></div>`;
        // Info row
        rh+=`<div style="font-size:8px;color:#8b949e;margin-bottom:4px">Max: ${fmtBW(p.maxBW)} · Alokováno: <b style="color:#a78bfa">${fmtBW(p.allocBW)}</b> (${allocPct}%) · Aktuální: <b style="color:#22d3ee">${fmtBW(traffic)}</b></div>`;
        // Traffic bar
        rh+=`<div style="height:6px;background:#0d1117;border-radius:3px;overflow:hidden;margin-bottom:6px;position:relative">`;
        rh+=`<div style="position:absolute;height:100%;width:${allocPct}%;background:#a78bfa33;border-radius:3px"></div>`;
        rh+=`<div style="position:absolute;height:100%;width:${Math.min(100,trafficPct*allocPct/100)}%;background:#a78bfa;border-radius:3px"></div>`;
        rh+=`</div>`;
        // Bandwidth allocation slider
        rh+=`<div style="display:flex;align-items:center;gap:6px">`;
        rh+=`<span style="font-size:8px;color:#6e7681;white-space:nowrap">Alokace:</span>`;
        rh+=`<input type="range" min="0" max="${p.maxBW}" step="${Math.max(100,Math.round(p.maxBW/100))}" value="${p.allocBW}" oninput="setBGPAlloc(${p.idx},+this.value);this.nextElementSibling.textContent=fmtBW(+this.value)" style="flex:1;height:4px;accent-color:#a78bfa">`;
        rh+=`<span style="font-size:8px;color:#a78bfa;min-width:55px;text-align:right">${fmtBW(p.allocBW)}</span>`;
        rh+=`</div>`;
        // Quick allocation buttons
        rh+=`<div style="display:flex;gap:3px;margin-top:4px">`;
        for(const pct of [0,25,50,75,100]){
          const val=Math.round(p.maxBW*pct/100);
          const sel=Math.abs(p.allocBW-val)<Math.max(100,p.maxBW*.02);
          rh+=`<button onclick="event.stopPropagation();setBGPAlloc(${p.idx},${val});renderDCModal()" style="flex:1;padding:2px;background:${sel?'#a78bfa':'#0d1117'};border:1px solid ${sel?'#a78bfa':'#21262d'};border-radius:3px;color:${sel?'#fff':'#8b949e'};cursor:pointer;font-size:7px">${pct}%</button>`;
        }
        rh+=`</div>`;
        rh+=`</div>`;
      }
    } else if(hasBGP&&links.length){
      rh+=`<div style="font-size:9px;color:#484f58;font-style:italic;margin-top:4px">Žádné BGP peerings — klikni "+ BGP" u propojeného DC</div>`;
    } else if(hasBGP&&!links.length){
      rh+=`<div style="font-size:9px;color:#f59e0b;font-style:italic;margin-top:4px">⚠️ BGP router je připraven, ale toto DC není fyzicky propojeno s žádným jiným DC. Nataž kabel (přes junction nebo přímo) mezi tímto DC a DC s BGP routerem — pak se objeví tlačítko "+ BGP".</div>`;
    } else if(!hasBGP){
      rh+=`<div style="font-size:9px;color:#484f58;font-style:italic;margin-top:4px">Potřebuješ BGP router pro sdílení bandwidth</div>`;
    }

    rh+=`</div></div>`;
  }

  // ====== LOAD BALANCER / ACTIVE ROUTING STATUS ======
  // Shows whether active balancing is on, and per-connection path distribution
  const hasLB=eqs.includes('eq_loadbalancer');
  const myConns=G.conns.filter(c=>c.di===dcModalIdx);
  const junctionsOnMap=(G.junctions||[]).filter(j=>j.type==='junction_lb'&&j.active).length;
  if(hasLB||myConns.length>0||junctionsOnMap>0){
    rh+=`<div class="rack" style="border-color:${hasLB?'#a78bfa88':'#21262d'}">`;
    rh+=`<div class="rack-header"><span style="color:${hasLB?'#a78bfa':'#8b949e'}">⚖️ Aktivní Load Balancing & Směrování</span>`;
    rh+=`<span style="font-size:8px;color:${hasLB?'#3fb950':'#8b949e'}">${hasLB?'AKTIVNÍ (DC LB)':junctionsOnMap>0?'AKTIVNÍ (polní LB)':'STATICKÉ (ECMP)'}</span></div>`;
    rh+=`<div style="padding:6px">`;
    if(hasLB){
      rh+=`<div style="font-size:9px;color:#a78bfa;margin-bottom:6px">✅ DC má <b>Load Balancer</b> — váhování tras podle volné kapacity místo statické max. šířky. Pokud se jedna trasa zaplňuje, provoz se automaticky přesouvá na paralelní kabely.</div>`;
    } else {
      rh+=`<div style="font-size:9px;color:#6e7681;margin-bottom:6px">ℹ️ Bez DC LB se provoz rozděluje staticky podle max. kapacity kabelů (ECMP). Pro aktivní rebalance přidej <b>⚖️ Load balancer</b> do racku, nebo postav <b>polní Load Balancer</b> na odbočce na mapě.</div>`;
    }
    // Summary of building connections routed from/to this DC, with path count
    if(myConns.length>0){
      const pathStats=myConns.slice(0,5).map(cn=>{
        const b=G.map[cn.by]?.[cn.bx]?.bld;
        const bt=b?BTYPES[b.type]:null;
        let pathCount=0;
        if(b){
          const adj=(typeof nb==='function')?nb(cn.bx,cn.by):[];
          for(const[ax,ay]of adj){
            if(ax<0||ax>=MAP||ay<0||ay>=MAP||G.map[ay][ax].type!=='road')continue;
            if(typeof bfsPath==='function'&&bfsPath(ax,ay,dc.x,dc.y))pathCount++;
          }
        }
        return {cn,bt,pathCount};
      });
      rh+=`<div style="font-size:9px;color:#8b949e;margin-bottom:3px">📊 Ukázka tras z připojených budov (max 5):</div>`;
      for(const st of pathStats){
        const multi=st.pathCount>1;
        rh+=`<div style="display:flex;justify-content:space-between;font-size:9px;padding:2px 6px;background:#0d1117;border-radius:3px;margin-bottom:2px">`;
        rh+=`<span>${st.bt?st.bt.icon:'?'} [${st.cn.bx},${st.cn.by}]</span>`;
        rh+=`<span style="color:${multi?'#3fb950':'#8b949e'}">${st.pathCount} ${st.pathCount===1?'trasa':'tras'}${multi?' · aktivně balancuje':''}</span>`;
        rh+=`</div>`;
      }
      if(myConns.length>5){
        rh+=`<div style="font-size:8px;color:#6e7681;font-style:italic;text-align:center">… a další ${myConns.length-5} přípojek</div>`;
      }
    }
    if(junctionsOnMap>0){
      rh+=`<div style="font-size:9px;color:#3fb950;margin-top:6px">🧭 Na mapě je <b>${junctionsOnMap}</b> aktivních polních Load Balancerů — trasy přes ně automaticky přepočítávají váhy.</div>`;
    }
    rh+=`</div></div>`;
  }

  // Monthly costs summary
  let mCost=DC_T[dc.type].mCost;
  for(const e of eqs){const eq=EQ[e];if(eq)mCost+=eq.mCost;}
  for(const bwu of(dc.bwUpgrades||[]))mCost+=bwu.mCost;
  // Include junctions in cost display info (not added to dc costs — junctions are on the map, not in DC)
  rh+=`<div style="font-size:10px;color:#f85149;padding:6px;background:#161b22;border-radius:5px;text-align:center;margin-top:6px">💸 Měsíční provoz: <b>${fmtKc(mCost)}</b></div>`;

  rackArea.innerHTML=rh;

  // === SIDEBAR: Equipment Shop ===
  const shop=document.getElementById('dcShopSidebar');
  let sh=`<div style="font-size:10px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">🛒 Vybavení</div>`;
  sh+=`<div style="font-size:8px;color:#6e7681;margin-bottom:8px">Klikni pro instalaci. Na obsazený slot klikni pro odebrání (50% refund).</div>`;

  const eqCats={
    network:{name:'📡 Síťové',items:['eq_router','eq_router_mid','eq_router_big','eq_router_edge','eq_switch24','eq_switch48','eq_bgprouter','eq_loadbalancer']},
    compute:{name:'🖥️ Výpočetní',items:['eq_server','eq_cloudnode','eq_cloudnode_big']},
    storage:{name:'💿 Storage',items:['eq_storage','eq_storage_big','eq_backup']},
    security:{name:'🛡️ Bezpečnost',items:['eq_firewall','eq_firewall_pro','eq_firewall_ent']},
    infra:{name:'🔌 Infrastruktura',items:['eq_ups','eq_monitoring','eq_cooling']},
    service:{name:'📺 Služby',items:['eq_wifiap','eq_voip','eq_iptv']},
  };

  const canFit=eqs.length<maxSlots;
  const dcType=G.dcs[dcModalIdx]?.type;
  const dcTypeInfo=DC_T[dcType]||{};
  const maxCool=dcTypeInfo.maxCooling||1;
  const coolCount=eqs.filter(e=>e==='eq_cooling').length;
  for(const catKey in eqCats){
    const cat=eqCats[catKey];
    sh+=`<div style="font-size:8px;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;margin:8px 0 3px;font-weight:700">${cat.name}</div>`;
    for(const eqKey of cat.items){
      const eq=EQ[eqKey];if(!eq)continue;
      // Inflace se musí počítat s aktuálním stavem G.componentInflation,
      // aby cena v shopu odpovídala skutečně strhnuté částce v placeEq().
      const eqCurCost=inflComponentCost(eq.cost);
      const affordable=G.cash>=eqCurCost;
      // Cooling má speciální hard-cap podle DC velikosti
      const isCoolingAtMax=eqKey==='eq_cooling'&&coolCount>=maxCool;
      const enabled=canFit&&affordable&&!isCoolingAtMax;
      const count=eqs.filter(e=>e===eqKey).length;
      sh+=`<div class="eq-shop-item${enabled?'':' disabled'}" ${enabled?`onclick="event.stopPropagation();placeEq(${dcModalIdx},'${eqKey}');renderDCModal()"`:''}>`
      sh+=`<span class="eq-icon">${eq.icon}</span>`;
      sh+=`<div class="eq-info">`;
      // U chlazení ukazuj X/Y místo jen Nx — aby bylo vidět, kolik jich jde max
      const countBadge=eqKey==='eq_cooling'
        ? ` <span style="color:${coolCount>=maxCool?'#f85149':'#3fb950'}">(${coolCount}/${maxCool})</span>`
        : (count>0?` <span style="color:#3fb950">(${count}×)</span>`:'');
      sh+=`<div class="eq-name">${eq.name}${countBadge}</div>`;
      sh+=`<div class="eq-cost">${fmtCostInfl(eq.cost)} · ${fmtKc(inflComponentCost(eq.mCost))}/m</div>`;
      let specTxt='';
      if(eq.storageTB)specTxt+=`💿${eq.storageTB}TB `;
      if(eq.vCPU)specTxt+=`☁️${eq.vCPU}vCPU/${eq.ramGB}GB `;
      if(eq.ddosBlock)specTxt+=`🛡️${Math.round(eq.ddosBlock*100)}% DDoS `;
      if(eq.connCap)specTxt+=`📡${eq.connCap} přípojek `;
      else if(eq.eff==='cap')specTxt+=`+${eq.val} kap `;
      if(eq.eff==='ports')specTxt+=`🔗+${eq.val} portů `;
      if(eq.bgpCap)specTxt+=`🔀${fmtBW(eq.bgpCap)} BGP `;
      if(eq.eff==='cooling')specTxt+=`+${eq.val} slotů `;
      if(eq.eff==='reliable')specTxt+=`-${eq.val}% výpadky `;
      if(specTxt)sh+=`<div class="eq-desc">${specTxt}</div>`;
      if(eq.desc)sh+=`<div class="eq-desc" style="color:#6e7681;font-style:italic">${eq.desc}</div>`;
      sh+=`</div></div>`;
    }
  }
  shop.innerHTML=sh;

  // === STATUS BAR ===
  const statusBar=document.getElementById('dcStatusBar');
  let sb='';
  sb+=dcMeter('Bandwidth',load.ratio,load.ratio>.9?'#f85149':load.ratio>.7?'#f59e0b':'#3fb950');
  const rackR=maxSlots>0?eqs.length/maxSlots:0;
  sb+=dcMeter('Rack',rackR,rackR>=1?'#f85149':rackR>.8?'#f59e0b':'#3fb950');
  sb+=dcMeter('Napájení',hasUPS?0.3:0.8,hasUPS?'#3fb950':'#f59e0b');
  sb+=dcMeter('Chlazení',hasCooling?0.4:0.7,hasCooling?'#3fb950':'#f59e0b');
  sb+=dcMeter('Bezpečnost',1-secLevel/3,secLevel>=2?'#3fb950':secLevel===1?'#f59e0b':'#f85149');
  statusBar.innerHTML=sb;
}

function dcMiniCard(icon,label,value,ratio,color){
  return `<div style="background:#161b22;border:1px solid #21262d;border-radius:6px;padding:8px;text-align:center">
    <div style="font-size:16px">${icon}</div>
    <div style="font-size:14px;font-weight:700;color:${color};margin:2px 0">${value}</div>
    <div style="font-size:8px;color:#6e7681">${label}</div>
    ${ratio>0?`<div class="cap-bar" style="margin-top:4px"><div class="fill ${ratio>.9?'crit':ratio>.7?'warn':'ok'}" style="width:${Math.min(100,ratio*100)}%"></div></div>`:''}
  </div>`;
}

function dcMeter(label,ratio,color){
  return `<div class="meter">
    <div class="meter-label">${label}</div>
    <div class="meter-bar"><div class="meter-fill" style="width:${Math.min(100,ratio*100)}%;background:${color}"></div></div>
  </div>`;
}

function removeEqFromDC(dcIdx,slotIdx){
  const dc=G.dcs[dcIdx];if(!dc||!dc.eq||slotIdx>=dc.eq.length)return;
  const eqKey=dc.eq[slotIdx];
  const eq=EQ[eqKey];
  const refund=eq?Math.round(eq.cost*0.5):0;
  dc.eq.splice(slotIdx,1);
  G.cash+=refund;
  notify(`🗑️ ${eq?eq.name:'Vybavení'} odebráno (+${fmtKc(refund)} refund)`,'good');
  renderDCModal();
  updUI();
}

function showTooltip(x,y,html){
  const tt=document.getElementById('tooltip');
  tt.innerHTML=html;tt.style.left=(x+10)+'px';tt.style.top=(y+10)+'px';tt.style.display='block';
}
function hideTooltip(){document.getElementById('tooltip').style.display='none';}

// ====== MANAGEMENT TAB ======
function switchMgmtSubtab(id){
  document.querySelectorAll('.mgmt-subtab').forEach(b=>b.classList.toggle('active',b.dataset.mgmt===id));
  document.querySelectorAll('.mgmt-content').forEach(c=>c.classList.toggle('active',c.id===id));
}

function buildCreditRating(){
  const el=document.getElementById('creditRatingBox');if(!el)return;
  const tier=(typeof getCreditTier==='function')?getCreditTier():{id:'BBB',apr:0.07,label:'–'};
  const score=(typeof calcCreditScore==='function')?calcCreditScore():50;
  el.innerHTML=`<div class="credit-rating-box">
    <div class="rating-letter ${tier.id}">${tier.id}</div>
    <div class="rating-label">${tier.label} · skóre ${score}/100</div>
    <div class="rating-apr">Základní úrok: <b>${(tier.apr*100).toFixed(1)}% p.a.</b></div>
  </div>`;
}

function buildLoansDisplay(){
  const sumEl=document.getElementById('loanSummary');
  const listEl=document.getElementById('activeLoans');
  if(!sumEl||!listEl)return;
  if(typeof getLoanSummary!=='function'){sumEl.textContent='';listEl.innerHTML='';return;}
  const s=getLoanSummary();
  sumEl.innerHTML=`Aktivní: <b>${s.count}</b> · Zůstatek: <b style="color:#fbbf24">${fmtKc(s.total)}</b> · Splátky: <b style="color:#f59e0b">${fmtKc(s.monthlyBurden)}/měs</b>`;
  if(!G.loans||G.loans.length===0){listEl.innerHTML='<p style="font-size:9px;color:#6e7681">Žádné aktivní úvěry</p>';return;}
  listEl.innerHTML='';
  for(const l of G.loans){
    const prod=LOAN_PRODUCTS.find(p=>p.id===l.product)||{name:'Úvěr'};
    const progress=(1-l.remaining/l.principal)*100;
    const div=document.createElement('div');
    div.className='loan-entry';
    div.innerHTML=`<div class="loan-hdr">
        <span style="color:#00d4ff;font-weight:600">${prod.name}</span>
        <span style="color:#8b949e">${l.remainingMonths}m · ${(l.apr*100).toFixed(2)}%</span>
      </div>
      <div style="font-size:9px;color:#8b949e">Zbývá <b style="color:#fbbf24">${fmtKc(Math.round(l.remaining))}</b> / ${fmtKc(l.principal)} · splátka ${fmtKc(l.monthlyPayment)}</div>
      <div class="loan-bar"><div class="loan-bar-fill" style="width:${progress}%"></div></div>
      <button onclick="payLoanEarly('${l.id}')">Předčasně splatit (+5%)</button>`;
    listEl.appendChild(div);
  }
}

function buildLoanProducts(){
  const el=document.getElementById('loanProducts');if(!el||typeof LOAN_PRODUCTS==='undefined')return;
  el.innerHTML='';
  const tier=(typeof getCreditTier==='function')?getCreditTier():{apr:0.07};
  for(const p of LOAN_PRODUCTS){
    const apr=(tier.apr*p.multiplier*100).toFixed(2);
    const defaultAmount=Math.round((p.minAmount+p.maxAmount)/4);
    const div=document.createElement('div');
    div.className='loan-product';
    div.innerHTML=`<div class="lp-name">${p.name}</div>
      <div class="lp-desc">${p.description} · ${p.termMonths}měs · ${apr}% p.a. · ${fmtKc(p.minAmount)}-${fmtKc(p.maxAmount)}</div>
      <input type="number" id="loanAmt_${p.id}" value="${defaultAmount}" min="${p.minAmount}" max="${p.maxAmount}" step="10000">
      <button onclick="takeLoan('${p.id}',parseInt(document.getElementById('loanAmt_${p.id}').value||0))">💰 Přijmout úvěr</button>`;
    el.appendChild(div);
  }
}

function buildQuarterlyReports(){
  const el=document.getElementById('quarterlyReports');if(!el)return;
  const rpts=G.quarterlyReports||[];
  if(rpts.length===0){el.innerHTML='<p style="font-size:9px;color:#6e7681">Ještě žádný report (čtvrtletní cyklus: březen/červen/září/prosinec)</p>';return;}
  el.innerHTML='';
  // Show newest first
  const sorted=[...rpts].reverse().slice(0,10);
  for(const r of sorted){
    const profClass=r.profit>=0?'pos':'neg';
    const row=document.createElement('div');
    row.className='qr-row';
    row.innerHTML=`<span class="qr-q">Q${r.q}/${r.y}</span>
      <span>Zisk: <b class="qr-prof ${profClass}">${fmtKc(r.profit)}</b></span>
      <span style="color:#8b949e">Daň: ${fmtKc(r.tax)}</span>
      <span class="qr-rating">${r.rating}</span>`;
    el.appendChild(row);
  }
}

function buildIncidentsDisplay(){
  const el=document.getElementById('activeIncidents');if(!el)return;
  const incs=(typeof getActiveIncidents==='function')?getActiveIncidents():[];

  // Badge na hlavní záložku Mgmt i na sub-tab Incidenty
  const mgmtTab=document.querySelector('.tab[data-tab="tabMgmt"]');
  const incTab=document.querySelector('.mgmt-subtab[data-mgmt="mgmtIncidents"]');
  const n=incs.length;
  if(mgmtTab){
    let b=mgmtTab.querySelector('.tab-badge');
    if(n>0){
      if(!b){b=document.createElement('span');b.className='tab-badge';mgmtTab.appendChild(b);}
      b.textContent=n;b.style.cssText='background:#f85149;color:#fff;font-size:8px;font-weight:800;border-radius:8px;padding:0 4px;margin-left:3px;animation:pulse 1.2s ease-in-out infinite';
    } else if(b){b.remove();}
  }
  if(incTab){
    let b=incTab.querySelector('.tab-badge');
    if(n>0){
      if(!b){b=document.createElement('span');b.className='tab-badge';incTab.appendChild(b);}
      b.textContent=' '+n;b.style.cssText='background:#f85149;color:#fff;font-size:9px;font-weight:800;border-radius:8px;padding:1px 5px;margin-left:4px';
    } else if(b){b.remove();}
  }

  if(incs.length===0){el.innerHTML='<p style="font-size:9px;color:#3fb950">✓ Žádné aktivní incidenty</p>';}
  else{
    el.innerHTML='';
    for(const inc of incs){
      const cause=INCIDENT_CAUSES.find(c=>c.id===inc.causeId)||{label:inc.causeId};
      const sev=INCIDENT_SEVERITY.find(s=>s.id===inc.severity)||INCIDENT_SEVERITY[0];
      const progress=Math.max(0,Math.min(100,(1-inc.remaining/inc.maxRemaining)*100));
      const div=document.createElement('div');
      div.className='incident-card '+inc.severity;
      let btns='';
      for(const a of RESPONSE_ACTIONS){
        const affordable=G.cash>=a.cost;
        btns+=`<button class="inc-action-btn" onclick="applyResponse('${inc.id}','${a.id}')"${affordable?'':' disabled'} title="${a.desc} · ${fmtKc(a.cost)}">${a.name} (${fmtKc(a.cost)})</button>`;
      }
      div.innerHTML=`<div class="inc-hdr">
          <span>DC#${inc.dcIdx+1} · ${cause.label}</span>
          <span class="inc-sev" style="background:${sev.color}33;color:${sev.color}">${sev.label}</span>
        </div>
        <div style="font-size:9px;color:#8b949e">Progress obnovy: ${Math.round(progress)}% · ztráta dosud ${fmtKc(inc.revenueLoss||0)}</div>
        <div class="inc-bar"><div class="inc-bar-fill" style="width:${progress}%;background:${sev.color}"></div></div>
        <div class="inc-actions">${btns}</div>`;
      el.appendChild(div);
    }
  }

  // Learnings
  const learnEl=document.getElementById('incidentLearnings');
  if(learnEl){
    const ls=(typeof getIncidentLearningSummary==='function')?getIncidentLearningSummary():[];
    if(ls.length===0)learnEl.innerHTML='<span style="color:#6e7681">Zatím žádná learnings — řeš incidenty a odemkneš bonusy</span>';
    else{
      learnEl.innerHTML=ls.map(l=>`<div style="padding:2px 0">${l.label} <b style="color:#3fb950">L${l.level}</b> · -${l.reductionPct}% budoucí riziko</div>`).join('');
    }
  }

  // Investigations
  try{buildInvestigationsDisplay();}catch(e){console.error('investigations:',e);}

  // History
  const histEl=document.getElementById('incidentHistoryList');
  if(histEl){
    const h=G.incidentHistory||[];
    if(h.length===0)histEl.innerHTML='<span style="color:#6e7681">Zatím bez historie</span>';
    else{
      histEl.innerHTML=h.slice(-10).reverse().map(inc=>{
        const cause=INCIDENT_CAUSES.find(c=>c.id===inc.causeId)||{label:inc.causeId};
        return `<div style="padding:2px 0;border-bottom:1px solid #21262d">${inc.severity} · ${cause.label} · DC#${inc.dcIdx+1} · <b>${fmtKc(inc.revenueLoss||0)}</b></div>`;
      }).join('');
    }
  }
}

function buildInvestigationsDisplay(){
  const el=document.getElementById('investigationsList');if(!el)return;
  const list=G.investigations||[];
  if(list.length===0){el.innerHTML='<p style="font-size:9px;color:#6e7681">Žádná aktivní vyšetřování.</p>';return;}
  el.innerHTML='';
  for(const v of list){
    const div=document.createElement('div');
    div.className='investigation-card';
    let body='';
    const dateStr=`${v.startD}.${v.startM+1}.${v.startY}`;
    const head=`<div class="inv-hdr"><span>🕵️ Kabel DC#${v.dcIdx+1} · ${v.cause}</span><span class="inv-damage">škoda ${fmtKc(v.damage)}</span></div><div class="inv-date">Zahájeno ${dateStr}</div>`;
    if(v.phase==='offered'){
      const cost=Math.max(15000,Math.round(v.damage*0.04));
      body=`<div class="inv-phase">Policie nabízí pátrání</div>
        <div class="inv-info">Poplatek za vyšetřovatele: <b>${fmtKc(cost)}</b>. Šance dopadení viníka ~40 %. Pátrání trvá 2–4 měsíce.</div>
        <div class="inv-actions">
          <button class="inv-btn start" onclick="startInvestigation('${v.id}')">🚔 Zahájit pátrání (${fmtKc(cost)})</button>
          <button class="inv-btn drop" onclick="dropInvestigation('${v.id}')">🗑️ Odložit</button>
        </div>`;
    } else if(v.phase==='police'){
      const mo=Math.max(1,Math.ceil(v.daysLeft/30));
      const pct=Math.max(0,Math.min(100,(1-v.daysLeft/(45+60))*100));
      body=`<div class="inv-phase">🔎 Policie pátrá (${mo} měs.)</div>
        <div class="inv-bar"><div class="inv-bar-fill police" style="width:${pct}%"></div></div>
        <div class="inv-info">Náklady dosud: ${fmtKc(v.costs)}</div>`;
    } else if(v.phase==='caught'){
      body=`<div class="inv-phase caught">✅ Viník nalezen!</div>
        <div class="inv-info">Nyní můžeš podat žalobu. Čím vyšší částku žaluješ, tím menší šance plného úspěchu. Nejlepší šance: 0,5–1,2× škody (${fmtKc(Math.round(v.damage*0.5))}–${fmtKc(Math.round(v.damage*1.2))}).</div>
        <div class="inv-claim-row">
          <label>Požadovaná částka:</label>
          <input type="number" id="inv-claim-${v.id}" value="${v.damage}" min="1000" step="5000" style="flex:1" oninput="updateLawsuitOdds('${v.id}',${v.damage})">
          <span id="inv-claim-ratio-${v.id}" style="font-size:9px;color:#8b949e">1.0× škody</span>
        </div>
        <div class="inv-odds">${formatLawsuitOdds(v.damage,v.damage)}</div>
        <div class="inv-actions">
          <button class="inv-btn file" onclick="fileLawsuitFromInput('${v.id}')">⚖️ Podat žalobu</button>
          <button class="inv-btn half" onclick="document.getElementById('inv-claim-${v.id}').value=${Math.round(v.damage*0.5)};updateLawsuitOdds('${v.id}',${v.damage})">0.5× škody</button>
          <button class="inv-btn full" onclick="document.getElementById('inv-claim-${v.id}').value=${v.damage};updateLawsuitOdds('${v.id}',${v.damage})">1× škody</button>
          <button class="inv-btn two" onclick="document.getElementById('inv-claim-${v.id}').value=${Math.round(v.damage*2)};updateLawsuitOdds('${v.id}',${v.damage})">2× škody</button>
          <button class="inv-btn drop" onclick="dropInvestigation('${v.id}')">🗑️ Smír (zahodit)</button>
        </div>`;
    } else if(v.phase==='trial'){
      const mo=Math.max(1,Math.ceil(v.daysLeft/30));
      const pct=Math.max(0,Math.min(100,(1-v.daysLeft/(90+90))*100));
      const ratio=(v.claimAmount/Math.max(1,v.damage)).toFixed(2);
      body=`<div class="inv-phase">⚖️ Soudní řízení (${mo} měs.)</div>
        <div class="inv-bar"><div class="inv-bar-fill trial" style="width:${pct}%"></div></div>
        <div class="inv-info">Žalobní návrh ${fmtKc(v.claimAmount)} (${ratio}× škody) · náklady dosud ${fmtKc(v.costs)}</div>
        <div class="inv-odds">${formatLawsuitOdds(v.claimAmount,v.damage)}</div>`;
    }
    div.innerHTML=head+body;
    el.appendChild(div);
  }
}

function formatLawsuitOdds(claim,damage){
  const ratio=claim/Math.max(1,damage);
  let thr;
  if(ratio<=0.5)thr=[70,23,7];
  else if(ratio<=1.2)thr=[45,40,15];
  else if(ratio<=2.5)thr=[18,40,42];
  else if(ratio<=5)thr=[5,23,72];
  else thr=[1,11,88];
  return `<span style="color:#3fb950">Plná výhra ${thr[0]}%</span> · <span style="color:#fbbf24">Částečná 10% ${thr[1]}%</span> · <span style="color:#f85149">Prohra ${thr[2]}%</span>`;
}
function updateLawsuitOdds(invId,damage){
  const inp=document.getElementById('inv-claim-'+invId);
  const rEl=document.getElementById('inv-claim-ratio-'+invId);
  if(!inp)return;
  const claim=parseInt(inp.value||0)||0;
  const ratio=claim/Math.max(1,damage);
  if(rEl)rEl.textContent=ratio.toFixed(2)+'× škody';
  // Update odds row
  const card=inp.closest('.investigation-card');
  if(card){const o=card.querySelector('.inv-odds');if(o)o.innerHTML=formatLawsuitOdds(claim,damage);}
}
function fileLawsuitFromInput(invId){
  const inp=document.getElementById('inv-claim-'+invId);if(!inp)return;
  const claim=parseInt(inp.value||0)||0;
  if(claim<1000){notify('Minimální žaloba je 1 000 Kč','bad');return;}
  if(typeof fileLawsuit==='function')fileLawsuit(invId,claim);
}

function buildStaffDetailList(){
  const el=document.getElementById('staffDetailList');if(!el)return;
  const rows=(typeof getStaffSummary==='function')?getStaffSummary():[];
  if(rows.length===0){el.innerHTML='<p style="font-size:9px;color:#6e7681">Najmi zaměstnance ve záložce Tým</p>';return;}
  el.innerHTML='';
  for(const r of rows){
    const moraleCls=r.morale>=80?'high':r.morale>=60?'normal':r.morale>=35?'low':'quit';
    const div=document.createElement('div');
    div.className='staff-row';
    div.innerHTML=`<div class="sr-hdr">
        <span class="sr-name">${r.icon} ${r.name} ×${r.count}</span>
        <span class="sr-lvl">L${r.level} · ${r.xp}/${r.xpNext} XP</span>
      </div>
      <div class="sr-morale-bar"><div class="sr-morale-fill ${moraleCls}" style="width:${r.morale}%"></div></div>
      <div class="sr-meta">
        <span>Morálka: <b style="color:${r.morale>=60?'#3fb950':r.morale>=35?'#fbbf24':'#f85149'}">${Math.round(r.morale)}%</b></span>
        <span>Zatížení: ${r.loadStatus} ${r.load.toFixed(1)}×</span>
        <span>Efektivita: <b>${Math.round(r.multiplier*100)}%</b></span>
      </div>`;
    el.appendChild(div);
  }
  // Training budget input prefill
  const inp=document.getElementById('trainingBudgetInput');
  if(inp&&document.activeElement!==inp)inp.value=G.trainingBudgetM||0;
}

function applyTrainingBudget(){
  const inp=document.getElementById('trainingBudgetInput');
  if(!inp)return;
  const v=parseInt(inp.value||0);
  if(typeof setTrainingBudget==='function')setTrainingBudget(v);
}

function buildTakeoverList(){
  const el=document.getElementById('takeoverList');if(!el)return;
  const offers=G.takeoverOffers||[];
  if(offers.length===0){el.innerHTML='<p style="font-size:9px;color:#6e7681">Žádné aktivní nabídky. Sledujte oslabenou konkurenci.</p>';return;}
  el.innerHTML='';
  for(let i=0;i<offers.length;i++){
    const o=offers[i];
    const ai=G.competitors[o.aiIdx];
    if(!ai)continue;
    const affordable=G.cash>=o.price;
    const div=document.createElement('div');
    div.className='takeover-card';
    div.innerHTML=`<div class="tk-name">${ai.name}</div>
      <div class="tk-price">${fmtKc(o.price)}</div>
      <div class="tk-stats">👥 ${o.customers} zákazníků · 🏢 ${o.dcs} DC · platnost do ${o.expiresM+1}/${o.expiresY}</div>
      <div class="tk-actions">
        <button class="accept" onclick="acceptTakeover(${i})"${affordable?'':' disabled style="opacity:.4"'}>✓ Koupit</button>
        <button class="reject" onclick="rejectTakeover(${i})">✕ Odmítnout</button>
      </div>`;
    el.appendChild(div);
  }
}

function buildCompetitorAnnouncements(){
  const el=document.getElementById('competitorAnnouncements');if(!el)return;
  const anns=G.competitorAnnouncements||[];
  // Filter to current
  const active=anns.filter(a=>a.endY>G.date.y||(a.endY===G.date.y&&a.endM>=G.date.m));
  if(active.length===0){el.innerHTML='<span style="color:#6e7681">Zatím ticho na trhu</span>';return;}
  el.innerHTML=active.map(a=>`<div style="padding:3px 0;border-bottom:1px solid #21262d">${a.txt} <span style="color:#6e7681;font-size:9px">(do ${a.endM+1}/${a.endY})</span></div>`).join('');
}

function buildCartelRiskBar(){
  const el=document.getElementById('cartelRiskBar');if(!el)return;
  const r=G.cartelRisk||0;
  const warn=r>=60?' <span style="color:#f85149">⚠️ Vysoké riziko vyšetřování</span>':r>=40?' <span style="color:#fbbf24">Sledováno regulátorem</span>':'';
  el.innerHTML=`<div style="font-size:9px;color:#8b949e">Aktuální skóre:${warn}</div>
    <div class="cartel-bar"><div class="cartel-bar-fill" style="width:${r}%"></div>
      <div class="cartel-bar-label">${r}/100</div>
    </div>
    <div style="font-size:9px;color:#6e7681;margin-top:4px">Sladěné vysoké ceny s konkurencí zvyšují riziko pokuty</div>`;
}

function buildMgmtTab(){
  try{buildCreditRating();}catch(e){console.error('creditRating:',e);}
  try{buildLoansDisplay();}catch(e){console.error('loans:',e);}
  try{buildLoanProducts();}catch(e){console.error('loanProducts:',e);}
  try{buildQuarterlyReports();}catch(e){console.error('quarterlyReports:',e);}
  try{buildIncidentsDisplay();}catch(e){console.error('incidents:',e);}
  try{buildStaffDetailList();}catch(e){console.error('staffDetail:',e);}
  try{buildTakeoverList();}catch(e){console.error('takeover:',e);}
  try{buildCompetitorAnnouncements();}catch(e){console.error('announcements:',e);}
  try{buildCartelRiskBar();}catch(e){console.error('cartel:',e);}
}
