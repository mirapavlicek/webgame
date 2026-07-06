// ====== WiFi SYSTEM ======

function placeWiFi(x,y,wifiType){
  if(!isRoad(x,y)&&!G.dcs.some(d=>d.x===x&&d.y===y)){
    notify('❌ WiFi jen na silnicích nebo DC!','bad');
    return;
  }
  const wt=WIFI_T[wifiType];
  if(!wt){notify('❌ Neznámý typ WiFi!','bad');return;}
  if(G.cash<wt.cost){notify(`❌ Chybí ${fmt(wt.cost-G.cash)}!`,'bad');return;}

  const dcIdx=findDC(x,y);
  if(dcIdx===-1){notify('❌ WiFi musí být připojeno k DC kabelem!','bad');return;}

  const dc=G.dcs[dcIdx];
  if(!(dc.eq||[]).includes('eq_wifiap')){
    notify('❌ DC musí mít WiFi AP kontroler!','bad');return;
  }

  G.wifiAPs.push({x,y,type:wifiType,dcIdx});
  G.cash-=wt.cost;
  if(typeof addPulse==='function')addPulse(x,y,wt.color||'#22d3ee');
  notify(`✅ ${wt.name} umístěn (dosah ${wt.range})`,'good');
  updUI();
}

function removeWiFi(idx){
  if(idx>=0&&idx<G.wifiAPs.length){
    const ap=G.wifiAPs[idx];
    const wt=WIFI_T[ap.type];
    G.wifiAPs.splice(idx,1);
    notify(`🗑️ WiFi odstraněn`,'good');
  }
}

// Pure: kolik nových domů bezdrátový tým připojí za měsíc (škáluje s počtem týmů).
function wifiTeamMonthlyConnects(teams){
  if(!teams||teams<=0)return 0;
  return teams*4; // 1 tým ~ 4 nové připojené domy/měsíc
}

// Měsíční tik — bezdrátové týmy automaticky připojují nepřipojené budovy, které
// jsou v dosahu WiFi AP (a jejichž DC má router). Platí se materiál (conn_wifi).
function wifiTeamTick(){
  if(typeof G==='undefined'||!G)return 0;
  const teams=(typeof getStaffEffect==='function')?getStaffEffect('wifi'):0;
  if(teams<=0)return 0;
  let budget=wifiTeamMonthlyConnects(teams);
  if(budget<=0)return 0;
  const ct=(typeof CONN_T!=='undefined')?CONN_T['conn_wifi']:null;
  if(!ct)return 0;
  // kandidáti: nepřipojené budovy v dosahu WiFi AP; preferuj ty, co „chtějí" internet
  const cands=[];
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    const b=G.map[y]&&G.map[y][x]&&G.map[y][x].bld;
    if(!b||b.connected)continue;
    const ap=getWiFiInRange(x,y);
    if(!ap)continue;
    const di=ap.dcIdx;
    if(di<0||di>=G.dcs.length)continue;
    const dc=G.dcs[di];
    if(typeof dcHasRouter==='function'&&!dcHasRouter(dc))continue;
    cands.push({x,y,b,di,want:!!b.want});
  }
  cands.sort((a,b)=>(b.want?1:0)-(a.want?1:0)); // zájemci první
  let done=0,spent=0;
  for(const cd of cands){
    if(budget<=0)break;
    const cost=(typeof inflComponentCost==='function')?inflComponentCost(ct.cost):ct.cost;
    if(G.cash<cost)break; // došly peníze → pauza
    const b=cd.b;
    b.connected=true;b.connType='conn_wifi';b.dcIdx=cd.di;b.tariffDist={};b.customers=0;b.tariff=null;b.sat=50;if(!b.svcSubs)b.svcSubs={};
    G.conns.push({bx:cd.x,by:cd.y,di:cd.di});
    G.cash-=cost;spent+=cost;
    if(typeof recordCapex==='function')recordCapex('connection',cost,'WiFi tým — nový dům');
    if(typeof addFloater==='function')addFloater(cd.x,cd.y,'📶 +WiFi','#22d3ee');
    done++;budget--;
  }
  if(done>0){
    if(typeof markCapDirty==='function')markCapDirty();
    if(typeof notify==='function')notify(`📶 Bezdrátový tým připojil ${done} ${done===1?'nový dům':done<5?'nové domy':'nových domů'} přes WiFi (${typeof fmtKc==='function'?fmtKc(spent):spent})`,'good');
  }
  return done;
}

function getWiFiInRange(bx,by){
  for(const ap of G.wifiAPs){
    const dist=Math.abs(bx-ap.x)+Math.abs(by-ap.y);
    if(dist<=WIFI_T[ap.type].range){
      return ap;
    }
  }
  return null;
}

function canBuildingUseWiFi(bx,by){
  return getWiFiInRange(bx,by)!==null;
}

function getWiFiStats(){
  let total=0,coverage=0;
  for(const ap of G.wifiAPs){
    const wt=WIFI_T[ap.type];
    const range=wt.range;
    for(let y=Math.max(0,ap.y-range);y<=Math.min(MAP-1,ap.y+range);y++){
      for(let x=Math.max(0,ap.x-range);x<=Math.min(MAP-1,ap.x+range);x++){
        const dist=Math.abs(x-ap.x)+Math.abs(y-ap.y);
        if(dist<=range){
          total++;
          if(G.map[y][x].bld)coverage++;
        }
      }
    }
  }
  return{total,coverage};
}
