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
