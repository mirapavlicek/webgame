// ====== INPUT HANDLING ======
let cam={x:0,y:0,zoom:1},drag=false,dS={x:0,y:0},cS={x:0,y:0};
let tool='none',cableStart=null,selDC=null;
let hover=null,lastT=0,tAcc=0;

function initInput(){
  canvas.addEventListener('mousedown',e=>{
    if(!G)return;
    const r=canvas.getBoundingClientRect();
    const sx=e.clientX-r.left,sy=e.clientY-r.top;
    if(e.button===1||e.button===2||(e.button===0&&e.shiftKey)){drag=true;dS={x:sx,y:sy};cS={x:cam.x,y:cam.y};e.preventDefault();return;}
    const h=fromIso(sx,sy);
    if(h.x<0||h.x>=MAP||h.y<0||h.y>=MAP)return;

    // Cursor mode: select DC or show tile info
    if(tool==='none'){
      const di=G.dcs.findIndex(d=>d.x===h.x&&d.y===h.y);
      if(di>=0){selDC=di;updUI();}else{selDC=null;}
      return;
    }
    if(tool.startsWith('dc_')){placeDC(h.x,h.y,tool);return;}
    if(tool.startsWith('cable_')){
      if(!cableStart){cableStart={x:h.x,y:h.y};}else{
        placeCable(cableStart.x,cableStart.y,h.x,h.y,tool);cableStart=null;}return;}
    if(tool.startsWith('conn_')){connectBld(h.x,h.y,tool);return;}
    // Equipment: click on a DC on the map to install
    if(tool.startsWith('eq_')){
      const di=G.dcs.findIndex(d=>d.x===h.x&&d.y===h.y);
      if(di>=0){
        placeEq(di,tool);
        selDC=di;
        updUI();
      } else {
        notify('❌ Klikni na datové centrum!','bad');
      }
      return;
    }
    if(tool.startsWith('tower_')){placeTower(h.x,h.y,tool);return;}
    if(tool.startsWith('wifi_')){placeWiFi(h.x,h.y,tool);return;}
    if(tool.startsWith('junction_')){placeJunction(h.x,h.y,tool);return;}
    if(tool==='demolish'){demolishObj(h.x,h.y);return;}
    if(tool==='upgrade_tech'){buyTechUpgrade();return;}
  });

  canvas.addEventListener('mousemove',e=>{
    if(!G)return;
    const r=canvas.getBoundingClientRect();const sx=e.clientX-r.left,sy=e.clientY-r.top;
    if(drag){cam.x=cS.x+(sx-dS.x);cam.y=cS.y+(sy-dS.y);render();return;}
    hover=fromIso(sx,sy);

    // Tooltip logic
    const ox=e.clientX-cArea.getBoundingClientRect().left;
    const oy=e.clientY-cArea.getBoundingClientRect().top;
    if(hover&&hover.x>=0&&hover.x<MAP&&hover.y>=0&&hover.y<MAP){
      const tile=G.map[hover.y][hover.x];
      const dc=G.dcs.find(d=>d.x===hover.x&&d.y===hover.y);
      const tt=document.getElementById('tooltip');

      if(dc){
        const di=G.dcs.indexOf(dc),dt=DC_T[dc.type];
        const dl=dcLoads[di]||{usedBW:0,maxBW:dt.baseBW,ratio:0};
        let maxBW=dt.baseBW;for(const bwu of(dc.bwUpgrades||[]))maxBW+=bwu.bw;
        const eqs=dc.eq||[];
        let maxSlots=dt.slots;
        // Count cooling slots
        for(const eq of eqs){if(EQ[eq]&&EQ[eq].eff==='cooling')maxSlots+=EQ[eq].val;}
        const isOut=dc.outage&&dc.outage.active;

        let h=`<b>${dt.name} #${di+1}</b>`;
        if(isOut)h+=` <span style="color:#f85149">⚠️ VÝPADEK: ${dc.outage.cause} (${dc.outage.remaining}d)</span>`;
        h+=`<br>`;
        h+=`<div class="tr"><span>BW</span><span class="tv" style="color:${dl.ratio>.9?'#f85149':dl.ratio>.7?'#f59e0b':'#3fb950'}">${fmtBW(dl.usedBW)} / ${fmtBW(maxBW)} (${Math.round(dl.ratio*100)}%)</span></div>`;
        h+=`<div class="tr"><span>Rack sloty</span><span class="tv">${eqs.length} / ${maxSlots}</span></div>`;
        h+=`<div class="tr"><span>Přípojky</span><span class="tv">${G.conns.filter(c=>c.di===di).length}</span></div>`;
        if(eqs.length){
          const counts={};for(const e of eqs)counts[e]=(counts[e]||0)+1;
          h+='<br>';
          for(const e in counts){const eq=EQ[e];if(eq)h+=`${eq.icon} ${eq.name}${counts[e]>1?' ×'+counts[e]:''} · `;}
        }
        // DC links
        const links=(G.dcLinks||[]).filter(l=>l.dc1===di||l.dc2===di);
        if(links.length)h+=`<br><span style="color:#a78bfa">🔗 Propojeno: ${links.map(l=>'DC#'+(l.dc1===di?l.dc2+1:l.dc1+1)).join(', ')}</span>`;
        tt.innerHTML=h;tt.style.display='block';tt.style.left=(ox+15)+'px';tt.style.top=(oy+15)+'px';

      } else if(tile.bld){
        const b=tile.bld,bt=BTYPES[b.type];
        let h=`<b>${bt.icon} ${bt.name}</b><br>`;
        h+=`<div class="tr"><span>Populace</span><span class="tv">${b.pop}/${b.maxPop}</span></div>`;
        h+=`<div class="tr"><span>Jednotky</span><span class="tv">${b.units}</span></div>`;
        h+=`<div class="tr"><span>Citlivost</span><span class="tv">💰${Math.round(bt.priceSens*100)}% ⚙️${Math.round(bt.qualSens*100)}%</span></div>`;
        h+=`<div class="tr"><span>BW vzor</span><span class="tv">${Math.round(bt.bwRatio*100)}% tarifu</span></div>`;
        if(b.connected){
          const ct=b.connType&&CONN_T[b.connType]?CONN_T[b.connType]:null;
          h+=`<div class="tr"><span>Přípojka</span><span class="tv">${ct?ct.icon+' '+ct.name+' ('+fmtBW(ct.maxBW)+')':'–'}</span></div>`;
          h+=`<div class="tr"><span>Zákazníci</span><span class="tv">${b.customers}/${b.units}</span></div>`;
          // Show tariff distribution
          if(b.tariffDist&&Object.keys(b.tariffDist).length>0){
            h+=`<div style="font-size:9px;color:#a78bfa;margin:2px 0">Tarify:</div>`;
            for(const ti in b.tariffDist){
              const t=G.tariffs[ti];if(!t||!b.tariffDist[ti])continue;
              h+=`<div class="tr"><span style="padding-left:6px">${t.name}</span><span class="tv">${b.tariffDist[ti]}× · ${fmtKc(t.price)}/m</span></div>`;
            }
          } else {
            h+=`<div class="tr"><span>Tarif</span><span>${b.tariff!==null&&G.tariffs[b.tariff]?G.tariffs[b.tariff].name:'–'}</span></div>`;
          }
          h+=`<div class="tr"><span>BW spotřeba</span><span class="tv">${fmtBW(Math.round(calcBldBW(b)))}</span></div>`;
          h+=`<div class="tr"><span>Spokojenost</span><span class="tv">${Math.round(b.sat)}%</span></div>`;
          // DC info
          const cn=G.conns.find(c=>c.bx===hover.x&&c.by===hover.y);
          if(cn&&G.dcs[cn.di]){h+=`<div class="tr"><span>DC</span><span class="tv">${DC_T[G.dcs[cn.di].type].name} #${cn.di+1}</span></div>`;}
          // Services with actual subscriber counts
          if(b.svcSubs&&Object.keys(b.svcSubs).length>0){
            let svcTxt='';
            for(const sid in b.svcSubs){
              const svc=SERVICES.find(s=>s.id===sid);
              if(svc&&b.svcSubs[sid]>0)svcTxt+=`${svc.icon}${b.svcSubs[sid]} `;
            }
            if(svcTxt)h+=`<div class="tr"><span>Služby</span><span class="tv">${svcTxt}</span></div>`;
          }
          // Business tenants
          if(b.bizTenants&&b.bizTenants.length>0){
            h+=`<div style="font-size:9px;color:#f59e0b;margin:3px 0">🏢 Nájemci:</div>`;
            for(const tid of b.bizTenants){
              const biz=BIZ_TENANTS.find(t=>t.id===tid);if(!biz)continue;
              h+=`<div class="tr"><span style="padding-left:4px">${biz.icon} ${biz.name}</span><span class="tv">+${fmtBW(biz.bwMbps)} · +${fmtKc(biz.revMonth)}/m</span></div>`;
            }
          }
          // Connection management buttons
          h+=`<div style="margin-top:4px;display:flex;gap:3px;flex-wrap:wrap">`;
          // Downgrade options — show cheaper connection types
          if(ct){
            for(const ck in CONN_T){
              const c2=CONN_T[ck];
              if(c2.maxBW<ct.maxBW&&c2.maxBW>=20&&c2.minTech<=G.tech){
                // Skip wireless types for cable buildings and vice versa
                const isWL=b.connType&&(b.connType.startsWith('conn_lte')||b.connType.startsWith('conn_5g'));
                const c2WL=ck.startsWith('conn_lte')||ck.startsWith('conn_5g');
                if(isWL!==c2WL)continue;
                if(ck==='conn_wifi')continue; // wifi needs AP, skip
                h+=`<button onclick="event.stopPropagation();downgradeBld(${hover.x},${hover.y},'${ck}')" style="padding:1px 5px;background:#1a1a00;border:1px solid #f59e0b;border-radius:3px;color:#f59e0b;cursor:pointer;font-size:7px">⬇ ${c2.name}</button>`;
              }
            }
          }
          h+=`<button onclick="event.stopPropagation();disconnectBld(${hover.x},${hover.y})" style="padding:1px 5px;background:#1a0a0a;border:1px solid #f85149;border-radius:3px;color:#f85149;cursor:pointer;font-size:7px">🔌 Odpojit</button>`;
          h+=`</div>`;
        } else {
          h+=b.want?'<span style="color:#fbbf24">⭐ Chce internet</span>':'<span style="color:#484f58">Nemá zájem</span>';
        }
        tt.innerHTML=h;tt.style.display='block';tt.style.left=(ox+15)+'px';tt.style.top=(oy+15)+'px';

      } else if(tile.type==='water'){
        const tt=document.getElementById('tooltip');
        tt.innerHTML='<b>💧 Vodní plocha</b><br><span style="color:#6e7681">Nelze stavět</span>';
        tt.style.display='block';tt.style.left=(ox+15)+'px';tt.style.top=(oy+15)+'px';
      } else if(tile.type==='park'){
        const tt=document.getElementById('tooltip');
        tt.innerHTML='<b>🌳 Park</b><br><span style="color:#6e7681">Nelze stavět</span>';
        tt.style.display='block';tt.style.left=(ox+15)+'px';tt.style.top=(oy+15)+'px';
      } else {
        // Check tower at this location
        const twIdx=(G.towers||[]).findIndex(t=>t.x===hover.x&&t.y===hover.y);
        if(twIdx>=0){
          const tw=G.towers[twIdx];const twt=TOWER_T[tw.type];
          if(twt){
            const clients=getTowerClients(twIdx);
            const loadPct=twt.maxClients>0?Math.round(clients/twt.maxClients*100):0;
            const loadClr=loadPct>90?'#f85149':loadPct>60?'#f59e0b':'#3fb950';
            let h=`<b>${twt.icon} ${twt.name}</b><br>`;
            h+=`<div style="color:#6e7681;font-size:9px;margin-bottom:3px">${twt.desc||''}</div>`;
            h+=`<div class="tr"><span>Generace</span><span class="tv">${twt.gen||'?'}</span></div>`;
            h+=`<div class="tr"><span>Pásmo</span><span class="tv">${twt.band||'?'}</span></div>`;
            h+=`<div class="tr"><span>Dosah</span><span class="tv">${twt.range} dlaždic</span></div>`;
            h+=`<div class="tr"><span>Max BW</span><span class="tv">${fmtBW(twt.maxBW)}</span></div>`;
            h+=`<div class="tr"><span>Klienti</span><span style="color:${loadClr};font-weight:600">${clients}/${twt.maxClients} (${loadPct}%)</span></div>`;
            if(loadPct>90)h+=`<div style="color:#f85149;font-size:9px;margin-top:2px">⚠️ Přetíženo — degradace kvality!</div>`;
            if(twt.reqAnchor)h+=`<div style="color:#f59e0b;font-size:9px;margin-top:2px">🔗 Vyžaduje LTE kotvu</div>`;
            h+=`<div class="tr"><span>Provoz</span><span style="color:#f85149">${fmtKc(twt.mCost)}/měs</span></div>`;
            const tt=document.getElementById('tooltip');
            tt.innerHTML=h;tt.style.display='block';tt.style.left=(ox+15)+'px';tt.style.top=(oy+15)+'px';
          }
        } else {
        // Check junction at this location
        const jn=(G.junctions||[]).find(j=>j.x===hover.x&&j.y===hover.y);
        if(jn){
          const jt=(typeof JUNCTION_T!=='undefined')?JUNCTION_T[jn.type]:null;
          if(jt){
            let h=`<b>${jt.icon} ${jt.name}</b><br>`;
            h+=`<div style="color:#6e7681;font-size:9px;margin-bottom:3px">${jt.desc||''}</div>`;
            h+=`<div class="tr"><span>Stav</span><span class="tv" style="color:${jn.active?'#3fb950':'#f59e0b'}">${jn.active?'AKTIVNÍ':'POZASTAVENO'}</span></div>`;
            h+=`<div class="tr"><span>Provoz</span><span style="color:#f85149">${fmtKc(jt.mCost)}/měs</span></div>`;
            if(jn.type==='junction_lb'){
              h+=`<div style="color:#a78bfa;font-size:9px;margin-top:3px">⚖️ Váží trasy přes volnou kapacitu místo statického max.</div>`;
            } else {
              h+=`<div style="color:#38bdf8;font-size:9px;margin-top:3px">🔀 Pasivní přepínač, staticky rozbočuje provoz.</div>`;
            }
            h+=`<div style="margin-top:4px;display:flex;gap:3px">`;
            h+=`<button onclick="event.stopPropagation();toggleJunction(${hover.x},${hover.y})" style="padding:1px 5px;background:#0a1a0a;border:1px solid #3fb950;border-radius:3px;color:#3fb950;cursor:pointer;font-size:7px">${jn.active?'⏸️ Pozastavit':'▶️ Aktivovat'}</button>`;
            h+=`<button onclick="event.stopPropagation();demolishObj(${hover.x},${hover.y})" style="padding:1px 5px;background:#1a0a0a;border:1px solid #f85149;border-radius:3px;color:#f85149;cursor:pointer;font-size:7px">🗑️ Odstranit</button>`;
            h+=`</div>`;
            tt.innerHTML=h;tt.style.display='block';tt.style.left=(ox+15)+'px';tt.style.top=(oy+15)+'px';
            render();return;
          }
        }
        // Check WiFi AP at this location
        const ap=G.wifiAPs.find(w=>w.x===hover.x&&w.y===hover.y);
        if(ap){
          const wt=WIFI_T[ap.type];
          let h=`<b>${wt.icon} ${wt.name}</b><br>`;
          h+=`<div class="tr"><span>Dosah</span><span class="tv">${wt.range} dlaždic</span></div>`;
          h+=`<div class="tr"><span>Max BW</span><span class="tv">${fmtBW(wt.maxBW)}</span></div>`;
          h+=`<div class="tr"><span>Max klientů</span><span class="tv">${wt.maxClients}</span></div>`;
          tt.innerHTML=h;tt.style.display='block';tt.style.left=(ox+15)+'px';tt.style.top=(oy+15)+'px';
        } else {
          // Check cables at this tile
          const cabHere=[];
          for(const k in segLoads){
            const parts=k.split(',').map(Number);
            if((parts[0]===hover.x&&parts[1]===hover.y)||(parts[2]===hover.x&&parts[3]===hover.y))cabHere.push({key:k,...segLoads[k]});
          }
          if(cabHere.length){
            let h='<b>Kabely:</b><br>';
            for(const seg of cabHere){
              h+=`${seg.types.map(t=>CAB_T[t]?.name||t).join('+')}: <span style="color:${seg.ratio>.9?'#f85149':seg.ratio>.7?'#f59e0b':'#3fb950'}">${fmtBW(seg.used)}/${fmtBW(seg.max)}</span> (${Math.round(seg.ratio*100)}%)<br>`;
            }
            tt.innerHTML=h;tt.style.display='block';tt.style.left=(ox+15)+'px';tt.style.top=(oy+15)+'px';
          } else {
            tt.style.display='none';
          }
        }
        }
      }
    } else {
      document.getElementById('tooltip').style.display='none';
    }

    render();
  });

  canvas.addEventListener('dblclick',e=>{
    if(!G)return;
    const r=canvas.getBoundingClientRect();
    const sx=e.clientX-r.left,sy=e.clientY-r.top;
    const h=fromIso(sx,sy);
    if(h.x<0||h.x>=MAP||h.y<0||h.y>=MAP)return;
    const di=G.dcs.findIndex(d=>d.x===h.x&&d.y===h.y);
    if(di>=0){openDCModal(di);e.preventDefault();}
  });
  canvas.addEventListener('mouseup',()=>{drag=false;});
  canvas.addEventListener('mouseleave',()=>{drag=false;document.getElementById('tooltip').style.display='none';});
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    const r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
    const f=e.deltaY<0?1.12:.89;
    const nz=Math.max(.15,Math.min(6,cam.zoom*f));
    cam.x=mx-(mx-cam.x)*(nz/cam.zoom);cam.y=my-(my-cam.y)*(nz/cam.zoom);
    cam.zoom=nz;render();
  },{passive:false});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('keydown',e=>{
    if(!G)return;
    if(e.target.tagName==='INPUT')return;
    switch(e.key){
      case 'Escape':if(dcModalIdx>=0){closeDCModal();}else{cableStart=null;tool='none';selDC=null;updateToolButtons();}break;
      case ' ':e.preventDefault();setSpeed(G.speed===0?1:0);break;
      case '1':setSpeed(1);break;case '2':setSpeed(2);break;case '3':setSpeed(5);break;
      case 'c':setTool('cable_copper');break;case 'f':setTool('cable_fiber');break;
      case 'd':setTool('dc_small');break;case 'x':setTool('demolish');break;
      case '+':case '=':zoomIn();break;case '-':zoomOut();break;
    }
  });
}

function setSpeed(s){if(!G)return;G.speed=s;updateSpeedButtons();}
function updateSpeedButtons(){
  ['btnP','btnS1','btnS2','btnS5'].forEach(id=>{const el=document.getElementById(id);if(el)el.classList.remove('active');});
  if(!G)return;
  const id=G.speed===0?'btnP':G.speed===1?'btnS1':G.speed===2?'btnS2':'btnS5';
  const el=document.getElementById(id);if(el)el.classList.add('active');
}

function setTool(t){
  tool=t;
  if(!t.startsWith('cable_'))cableStart=null;
  updateToolButtons();
}

function updateToolButtons(){
  document.querySelectorAll('.bb[data-tool]').forEach(btn=>{
    const t=btn.getAttribute('data-tool');
    btn.classList.toggle('active',t===tool);
  });
}

// Bind tab switching
document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',e=>{
    const tc=tab.getAttribute('data-tab');
    document.querySelectorAll('.tab-content').forEach(tc2=>tc2.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.getElementById(tc).classList.add('active');
    tab.classList.add('active');
  });
});

// Bind management sub-tabs
document.querySelectorAll('.mgmt-subtab').forEach(b=>{
  b.addEventListener('click',()=>{
    const id=b.getAttribute('data-mgmt');
    if(typeof switchMgmtSubtab==='function')switchMgmtSubtab(id);
  });
});

// Bind tool buttons
document.querySelectorAll('.bb[data-tool]').forEach(btn=>{
  btn.addEventListener('click',e=>{
    const t=btn.getAttribute('data-tool');
    if(t==='upgrade_tech'){if(G)buyTechUpgrade();return;}
    setTool(t);
    if(t.startsWith('eq_'))notify('🔧 Klikni na DC na mapě pro instalaci','');
  });
});
