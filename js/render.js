// ====== RENDERING ======
let canvas,ctx,mmC,mmX,cArea;
// Data flow particles for cable animation
let cableParticles=[];
let cableEdges=[]; // polyline edges between nodes — rebuilt each frame
const MAX_PARTICLES=120;

function initRender(){
  canvas=document.getElementById('gameCanvas');
  ctx=canvas.getContext('2d');
  mmC=document.getElementById('minimap');
  mmX=mmC.getContext('2d');
  cArea=document.getElementById('canvasArea');
}

function toIso(x,y){return{x:(x-y)*(TW/2),y:(x+y)*(TH/2)};}
function fromIso(sx,sy){const px=(sx-cam.x)/cam.zoom,py=(sy-cam.y)/cam.zoom;return{x:Math.floor((px/(TW/2)+py/(TH/2))/2),y:Math.floor((py/(TH/2)-px/(TW/2))/2)};}
function toScr(x,y){return toIso(x,y);}

function zoomIn(){const cx=canvas.width/2,cy=canvas.height/2;const nz=Math.min(6,cam.zoom*1.25);cam.x=cx-(cx-cam.x)*(nz/cam.zoom);cam.y=cy-(cy-cam.y)*(nz/cam.zoom);cam.zoom=nz;}
function zoomOut(){const cx=canvas.width/2,cy=canvas.height/2;const nz=Math.max(.15,cam.zoom/1.25);cam.x=cx-(cx-cam.x)*(nz/cam.zoom);cam.y=cy-(cy-cam.y)*(nz/cam.zoom);cam.zoom=nz;}
function zoomReset(){const iso=toIso(MAP/2,MAP/2);cam.zoom=1;cam.x=-iso.x+canvas.width/2;cam.y=-iso.y+canvas.height/2;}

// Day/night cycle: returns a tint object based on game hour
function getDayTint(){
  if(!G)return{r:0,g:0,b:0,a:0};
  const hour=(G.date.d-1)/30*24; // 0-24 approximation from day of month
  // Night: 0-5, Dawn: 5-7, Day: 7-18, Dusk: 18-20, Night: 20-24
  let a=0,r=0,g=0,b=0;
  if(hour<5){a=.25;r=10;g=15;b=40;} // deep night - blue tint
  else if(hour<7){const t=(hour-5)/2;a=.25*(1-t);r=10*(1-t);g=15*(1-t);b=40*(1-t);} // dawn
  else if(hour<17){a=0;} // full day
  else if(hour<20){const t=(hour-17)/3;a=.18*t;r=30*t;g=10*t;b=5*t;} // dusk - warm
  else{const t=Math.min(1,(hour-20)/3);a=.12+.13*t;r=10;g=15;b=40;} // night
  return{r,g,b,a};
}

// Spawn cable data particles along polyline edges (building → DC)
function spawnParticles(){
  if(!G||!cableEdges||cableEdges.length===0)return;
  // Remove dead particles
  cableParticles=cableParticles.filter(p=>p.life>0);
  if(cableParticles.length<MAX_PARTICLES&&Math.random()<.3){
    // Pick a random loaded edge
    const loaded=[];
    for(const ed of cableEdges){
      let m=0;
      for(const sg of ed.segs){
        const l=segLoads[segKey(sg.x1,sg.y1,sg.x2,sg.y2)];
        if(l&&l.ratio>m)m=l.ratio;
      }
      if(m>.05)loaded.push({ed,ratio:m});
    }
    if(loaded.length>0){
      const pick=loaded[Math.floor(Math.random()*loaded.length)];
      // Randomly flip direction so particles flow both ways (to DC and back)
      const path=Math.random()<.5?pick.ed.path.slice():pick.ed.path.slice().reverse();
      // Slower base speed since particles now traverse whole polylines, not unit segments
      const pathLen=path.length;
      const sp=(.004+pick.ratio*.006)/Math.max(1,pathLen*.6);
      cableParticles.push({path,t:0,speed:sp,life:1,color:pick.ratio>.9?'#ef4444':pick.ratio>.5?'#f59e0b':'#3fb950'});
    }
  }
  // Update particles
  for(const p of cableParticles){p.t+=p.speed;if(p.t>=1){p.t=0;p.life-=.33;}}
}

// Point along polyline at parameter t in [0,1] — pts in screen space, returns {x,y,dx,dy} with local tangent
function pointOnPolyline(pts,t){
  if(pts.length<2)return{x:pts[0]?pts[0].x:0,y:pts[0]?pts[0].y:0,dx:1,dy:0};
  let total=0;const lens=[];
  for(let i=1;i<pts.length;i++){const dl=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);lens.push(dl);total+=dl;}
  if(total<=0)return{x:pts[0].x,y:pts[0].y,dx:1,dy:0};
  const target=total*Math.max(0,Math.min(1,t));
  let acc=0;
  for(let i=0;i<lens.length;i++){
    if(acc+lens[i]>=target||i===lens.length-1){
      const u=lens[i]>0?(target-acc)/lens[i]:0;
      const dx=pts[i+1].x-pts[i].x,dy=pts[i+1].y-pts[i].y;
      return{x:pts[i].x+dx*u,y:pts[i].y+dy*u,dx,dy};
    }
    acc+=lens[i];
  }
  const last=pts[pts.length-1];return{x:last.x,y:last.y,dx:1,dy:0};
}

function render(){
  if(!G)return;
  canvas.width=cArea.clientWidth;canvas.height=cArea.clientHeight;
  ctx.fillStyle='#080c12';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(cam.x,cam.y);
  ctx.scale(cam.zoom,cam.zoom);
  const mg=5,cs=[fromIso(0,0),fromIso(canvas.width,0),fromIso(0,canvas.height),fromIso(canvas.width,canvas.height)];
  let x0=MAP,x1=0,y0=MAP,y1=0;
  for(const c of cs){x0=Math.min(x0,c.x);x1=Math.max(x1,c.x);y0=Math.min(y0,c.y);y1=Math.max(y1,c.y);}
  x0=Math.max(0,x0-mg);x1=Math.min(MAP-1,x1+mg);y0=Math.max(0,y0-mg);y1=Math.min(MAP-1,y1+mg);

  // ====== TERRAIN ======
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const tile=G.map[y][x];
    if(tile.type==='road')drawRoad(x,y);
    else if(tile.type==='water')drawWater(x,y);
    else if(tile.type==='park')drawPark(x,y);
    else drawGrass(x,y,tile.variant||0);
  }

  // (no yellow lane markings — roads are kept clean like OpenTTD)

  // ====== WIFI COVERAGE ======
  for(const ap of G.wifiAPs){
    const wt=WIFI_T[ap.type],s=toScr(ap.x,ap.y);
    ctx.fillStyle=wt.color+'1a';ctx.beginPath();ctx.arc(s.x,s.y,wt.range*(TW/2),0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=wt.color+'55';ctx.lineWidth=1;ctx.stroke();
  }

  // ====== TOWER COVERAGE ======
  for(const tw of(G.towers||[])){
    const tt=TOWER_T[tw.type];if(!tt)continue;
    const s=toScr(tw.x,tw.y);
    ctx.fillStyle=tt.color+'14';ctx.beginPath();ctx.arc(s.x,s.y,tt.range*(TW/2),0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=tt.color+'40';ctx.lineWidth=1.5;ctx.stroke();
  }

  // ====== CABLES ======
  // Step 1: group per unit segment (LAG stacking lives here)
  const segGroups={};
  for(const cb of G.cables){
    const sk=segKey(cb.x1,cb.y1,cb.x2,cb.y2);
    if(!segGroups[sk])segGroups[sk]={x1:cb.x1,y1:cb.y1,x2:cb.x2,y2:cb.y2,cables:[],bestTier:-1,bestType:null};
    segGroups[sk].cables.push(cb);
    const tier=CAB_T[cb.t]?.tier||0;
    if(tier>segGroups[sk].bestTier){segGroups[sk].bestTier=tier;segGroups[sk].bestType=cb.t;}
  }

  // Step 2: build adjacency + detect nodes, trace polyline edges
  const adj={};
  const segList=Object.values(segGroups);
  for(const sg of segList){
    const ka=sg.x1+','+sg.y1,kb=sg.x2+','+sg.y2;
    (adj[ka]=adj[ka]||[]).push({x:sg.x2,y:sg.y2,sg});
    (adj[kb]=adj[kb]||[]).push({x:sg.x1,y:sg.y1,sg});
  }
  const isEndpoint=(x,y)=>{
    if(G.map[y]&&G.map[y][x]&&G.map[y][x].bld)return true;
    if(G.dcs.some(d=>d.x===x&&d.y===y))return true;
    if((G.junctions||[]).some(j=>j.x===x&&j.y===y))return true;
    return false;
  };
  const isNode=(x,y)=>{
    const n=adj[x+','+y]||[];
    if(n.length!==2)return true; // endpoint, T-junction, or 4-way cross
    if(isEndpoint(x,y))return true;
    // Break at type change or LAG-count change so visuals stay accurate
    if(n[0].sg.bestType!==n[1].sg.bestType)return true;
    if(n[0].sg.cables.length!==n[1].sg.cables.length)return true;
    return false;
  };
  const visited=new Set();
  const edges=[];
  for(const k in adj){
    const[nx0,ny0]=k.split(',').map(Number);
    if(!isNode(nx0,ny0))continue;
    for(const nb of adj[k]){
      const sk0=segKey(nx0,ny0,nb.x,nb.y);
      if(visited.has(sk0))continue;
      visited.add(sk0);
      const path=[[nx0,ny0],[nb.x,nb.y]];
      const segs=[nb.sg];
      let cx=nb.x,cy=nb.y,px=nx0,py=ny0;
      while(!isNode(cx,cy)){
        const next=(adj[cx+','+cy]||[]).find(m=>!(m.x===px&&m.y===py));
        if(!next)break;
        const nk=segKey(cx,cy,next.x,next.y);
        if(visited.has(nk))break;
        visited.add(nk);
        segs.push(next.sg);
        path.push([next.x,next.y]);
        px=cx;py=cy;cx=next.x;cy=next.y;
      }
      edges.push({path,segs,type:nb.sg.bestType,count:segs[0].cables.length});
    }
  }
  // Handle closed loops (no node on the cycle): emit each leftover segment as its own edge
  for(const sg of segList){
    const sk=segKey(sg.x1,sg.y1,sg.x2,sg.y2);
    if(visited.has(sk))continue;
    visited.add(sk);
    edges.push({path:[[sg.x1,sg.y1],[sg.x2,sg.y2]],segs:[sg],type:sg.bestType,count:sg.cables.length});
  }
  cableEdges=edges; // expose for particle spawner

  // Step 3: render each edge as one continuous polyline
  for(const ed of edges){
    const ct=CAB_T[ed.type];if(!ct)continue;
    const pts=ed.path.map(p=>toScr(p[0],p[1]));
    // Max load ratio across segs — worst congestion drives color
    let maxRatio=0;
    for(const sg of ed.segs){
      const l=segLoads[segKey(sg.x1,sg.y1,sg.x2,sg.y2)];
      if(l&&l.ratio>maxRatio)maxRatio=l.ratio;
    }
    const baseW=ct.w+Math.log2(ed.count)*1.5;
    const tier=ct.tier||0;
    let color=ct.clr;let utilColor=null;
    if(maxRatio>.95){color='#ef4444';utilColor='#ef4444';}
    else if(maxRatio>.7){color='#f59e0b';utilColor='#f59e0b';}

    const poly=()=>{ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);};
    // Offset polyline — parallel strand at perpendicular distance d, keeps continuity through corners
    const polyOffset=(d)=>{
      ctx.beginPath();
      for(let i=0;i<pts.length;i++){
        let tx,ty;
        if(i===0){tx=pts[1].x-pts[0].x;ty=pts[1].y-pts[0].y;}
        else if(i===pts.length-1){tx=pts[i].x-pts[i-1].x;ty=pts[i].y-pts[i-1].y;}
        else{tx=pts[i+1].x-pts[i-1].x;ty=pts[i+1].y-pts[i-1].y;}
        const l=Math.hypot(tx,ty)||1;
        const nnx=-ty/l,nny=tx/l;
        const ox=pts[i].x+nnx*d,oy=pts[i].y+nny*d;
        if(i===0)ctx.moveTo(ox,oy);else ctx.lineTo(ox,oy);
      }
    };

    ctx.lineCap='round';ctx.lineJoin='round';

    // Outer glow
    const glowStrength=tier>=3?6:tier>=2?4:3;
    poly();ctx.strokeStyle=color+(tier>=3?'42':'30');ctx.lineWidth=baseW+glowStrength;ctx.stroke();

    // Trench underlay for buried cables
    if(tier>=1){poly();ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=baseW+1.5;ctx.stroke();}

    // Main stroke per type
    if(tier===0){
      // COPPER: dashed continuous line
      poly();ctx.strokeStyle=color;ctx.lineWidth=baseW;
      ctx.setLineDash([6,3]);ctx.stroke();ctx.setLineDash([]);
    } else if(tier>=3){
      // BACKBONE: outer sheath + two parallel strands + bright core
      poly();ctx.strokeStyle=color;ctx.lineWidth=baseW;ctx.stroke();
      const off=Math.max(1,baseW*.25);
      polyOffset(off);ctx.strokeStyle=shade(color,25);ctx.lineWidth=Math.max(1,baseW*.35);ctx.stroke();
      polyOffset(-off);ctx.stroke();
      poly();ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=Math.max(1,baseW*.3);ctx.stroke();
    } else {
      // FIBER 1G/10G: solid + bright core
      poly();ctx.strokeStyle=color;ctx.lineWidth=baseW;ctx.stroke();
      poly();ctx.strokeStyle=shade(color,40);ctx.lineWidth=Math.max(1,baseW*.35);ctx.stroke();
    }

    // Inner highlight
    poly();ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=Math.max(.6,baseW*.18);ctx.stroke();

    // Utilization overlay
    if(utilColor){
      const pulse=Math.sin(Date.now()/300)*.25+.75;
      poly();ctx.strokeStyle=utilColor+Math.round(pulse*160).toString(16).padStart(2,'0');
      ctx.lineWidth=Math.max(1,baseW*.55);ctx.stroke();
    }
    // Congestion halo
    if(maxRatio>.7){
      const pulse=Math.sin(Date.now()/260)*.3+.7;
      poly();ctx.strokeStyle=`rgba(255,${maxRatio>.95?'40':'150'},40,${pulse*.28})`;
      ctx.lineWidth=baseW+8;ctx.stroke();
    }
    ctx.lineCap='butt';ctx.lineJoin='miter';

    // ====== One label per edge at arc-length midpoint ======
    const mid=pointOnPolyline(pts,.5);
    const mx=mid.x,my=mid.y;
    const typeSet=new Set();
    for(const sg of ed.segs)for(const cb of sg.cables)typeSet.add(cb.t);
    if(ed.count>1||tier>=3){
      const label=ed.count>1?(typeSet.size>1?'×'+ed.count+' · '+typeSet.size+' typů':'×'+ed.count):'';
      const tierLabel=ct.name.replace('Páteřní ','').replace('Optický ','Opt ').replace('Optika ','Opt ');
      const text=label?tierLabel+'  '+label:tierLabel;
      ctx.font='bold 7.5px sans-serif';ctx.textAlign='center';
      const tw=ctx.measureText(text).width+8;
      ctx.fillStyle='rgba(13,17,23,.88)';
      roundRect(ctx,mx-tw/2,my-9,tw,11,3);ctx.fill();
      ctx.strokeStyle=color+'cc';ctx.lineWidth=.8;
      roundRect(ctx,mx-tw/2,my-9,tw,11,3);ctx.stroke();
      ctx.fillStyle=color;ctx.fillText(text,mx,my-1);
    } else if(tier>=2){
      ctx.font='bold 6.5px sans-serif';ctx.textAlign='center';
      ctx.fillStyle=color;ctx.fillText(ct.name.replace('Optika ','').replace('Páteřní ',''),mx,my-3);
    }

    // One utilization bar per edge at midpoint, perpendicular to local tangent
    if(maxRatio>0&&tier>=2){
      const dlen=Math.hypot(mid.dx,mid.dy)||1;
      const nnx=-mid.dy/dlen,nny=mid.dx/dlen;
      const bx=mx+nnx*(baseW/2+4),by=my+nny*(baseW/2+4);
      const barLen=10,barW2=2;
      const ang=Math.atan2(mid.dy,mid.dx);
      ctx.save();ctx.translate(bx,by);ctx.rotate(ang);
      ctx.fillStyle='rgba(13,17,23,.8)';ctx.fillRect(-barLen/2,-barW2/2,barLen,barW2);
      ctx.fillStyle=maxRatio>.95?'#ef4444':maxRatio>.7?'#f59e0b':'#3fb950';
      ctx.fillRect(-barLen/2,-barW2/2,barLen*Math.min(1,maxRatio),barW2);
      ctx.restore();
    }
  }

  // ====== DATA FLOW PARTICLES (follow full polyline edges) ======
  spawnParticles();
  for(const p of cableParticles){
    if(p.life<=0||!p.path||p.path.length<2)continue;
    const pts=p.path.map(pt=>toScr(pt[0],pt[1]));
    const head=pointOnPolyline(pts,p.t);
    const tail=pointOnPolyline(pts,Math.max(0,p.t-.06));
    ctx.globalAlpha=p.life*.8;
    ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(head.x,head.y,2.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=p.color+'66';ctx.beginPath();ctx.arc(tail.x,tail.y,1.5,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;
  }

  // ====== CONNECTIONS ======
  ctx.setLineDash([2,3]);
  for(const cn of G.conns){const dc=G.dcs[cn.di];if(!dc)continue;const s1=toScr(cn.bx,cn.by),s2=toScr(dc.x,dc.y);
    ctx.beginPath();ctx.moveTo(s1.x,s1.y);ctx.lineTo(s2.x,s2.y);ctx.strokeStyle='rgba(0,212,255,.2)';ctx.lineWidth=1;ctx.stroke();}
  ctx.setLineDash([]);ctx.lineWidth=1;

  // ====== DC INTERCONNECTION ======
  for(const link of G.dcLinks){
    const dc1=G.dcs[link.dc1],dc2=G.dcs[link.dc2];
    if(dc1&&dc2){
      const s1=toScr(dc1.x,dc1.y),s2=toScr(dc2.x,dc2.y);
      ctx.strokeStyle='rgba(168,85,247,.25)';ctx.lineWidth=2;ctx.setLineDash([4,4]);
      ctx.beginPath();ctx.moveTo(s1.x,s1.y);ctx.lineTo(s2.x,s2.y);ctx.stroke();ctx.setLineDash([]);
    }
  }

  // ====== SHADOWS (under buildings/DCs) ======
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const tile=G.map[y][x];
    if(tile.bld){
      const s=toScr(x,y),bt=BTYPES[tile.bld.type];
      const shadowOff=bt.h*.15;
      ctx.fillStyle='rgba(0,0,0,.18)';
      ctx.beginPath();
      ctx.moveTo(s.x+shadowOff,s.y-TH/2+5+shadowOff*.5);
      ctx.lineTo(s.x+TW/2-4+shadowOff,s.y+2+shadowOff*.5);
      ctx.lineTo(s.x+shadowOff,s.y+TH/2+3+shadowOff*.5);
      ctx.lineTo(s.x-TW/2+6+shadowOff,s.y+2+shadowOff*.5);
      ctx.closePath();ctx.fill();
    }
  }

  // ====== DRAW ENTITIES (sorted by depth) ======
  const dr=[];
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){if(G.map[y][x].bld)dr.push({t:'b',x,y,d:x+y});}
  for(let i=0;i<G.dcs.length;i++)dr.push({t:'dc',x:G.dcs[i].x,y:G.dcs[i].y,d:G.dcs[i].x+G.dcs[i].y,i});
  for(let i=0;i<(G.towers||[]).length;i++)dr.push({t:'tw',x:G.towers[i].x,y:G.towers[i].y,d:G.towers[i].x+G.towers[i].y,i});
  // WiFi APs as drawable objects
  for(let i=0;i<G.wifiAPs.length;i++)dr.push({t:'wifi',x:G.wifiAPs[i].x,y:G.wifiAPs[i].y,d:G.wifiAPs[i].x+G.wifiAPs[i].y,i});
  // Junction nodes (field load balancers / switches)
  for(let i=0;i<(G.junctions||[]).length;i++)dr.push({t:'jn',x:G.junctions[i].x,y:G.junctions[i].y,d:G.junctions[i].x+G.junctions[i].y,i});
  dr.sort((a,b)=>a.d-b.d);
  for(const d of dr){
    if(d.t==='b')drawBld(d.x,d.y,G.map[d.y][d.x].bld);
    else if(d.t==='dc')drawDC(d.x,d.y,G.dcs[d.i],d.i);
    else if(d.t==='tw')drawTower(d.x,d.y,G.towers[d.i]);
    else if(d.t==='wifi')drawWiFiAP(d.x,d.y,G.wifiAPs[d.i]);
    else if(d.t==='jn')drawJunction(d.x,d.y,G.junctions[d.i]);
  }

  // ====== HOVER EFFECTS ======
  if(hover&&hover.x>=0&&hover.x<MAP&&hover.y>=0&&hover.y<MAP){
    drawDia(hover.x,hover.y,'rgba(0,212,255,.1)','#00d4ff');
    if(tool.startsWith('cable_')&&cableStart){
      const ct=CAB_T[tool],s1=toScr(cableStart.x,cableStart.y),s2=toScr(hover.x,hover.y);
      ctx.beginPath();ctx.moveTo(s1.x,s1.y);ctx.lineTo(s2.x,s2.y);ctx.strokeStyle=(ct?ct.clr:'#fff')+'66';ctx.lineWidth=2;ctx.stroke();
      const dist=Math.abs(hover.x-cableStart.x)+Math.abs(hover.y-cableStart.y);
      if(ct&&dist>0){ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillStyle='#f59e0b';ctx.fillText(fmt(dist*ct.cost),s2.x,s2.y-20);}}
    if(tool.startsWith('dc_')){const s=toScr(hover.x,hover.y),tile=G.map[hover.y][hover.x];
      ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillStyle=tile.type==='grass'&&!tile.bld?'#3fb950':'#f85149';
      ctx.fillText(tile.type==='grass'&&!tile.bld?'✓':'✗',s.x,s.y-20);}
    if(tool.startsWith('conn_')){const s=toScr(hover.x,hover.y),tile=G.map[hover.y][hover.x];
      const ok=tile.bld&&(!tile.bld.connected||(tile.bld.connType!==tool&&CONN_T[tool]&&CONN_T[tile.bld.connType]&&CONN_T[tool].maxBW>CONN_T[tile.bld.connType].maxBW));
      ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillStyle=ok?'#3fb950':'#f85149';
      ctx.fillText(ok?'✓ '+CONN_T[tool].name:'✗',s.x,s.y-20);}
    if(tool.startsWith('tower_')){const s=toScr(hover.x,hover.y),tile=G.map[hover.y][hover.x];
      const ok=(isRoad(hover.x,hover.y)||G.dcs.some(d=>d.x===hover.x&&d.y===hover.y));
      const tt=TOWER_T[tool];
      ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillStyle=ok?'#3fb950':'#f85149';
      ctx.fillText(ok?'✓ '+((tt&&tt.name)||''):'✗',s.x,s.y-20);
      if(ok&&tt){ctx.fillStyle=tt.color+'18';ctx.beginPath();ctx.arc(s.x,s.y,tt.range*(TW/2),0,Math.PI*2);ctx.fill();
        ctx.strokeStyle=tt.color+'55';ctx.lineWidth=1;ctx.stroke();}}
    if(tool.startsWith('wifi_')){const s=toScr(hover.x,hover.y),tile=G.map[hover.y][hover.x];
      const ok=(isRoad(hover.x,hover.y)||G.dcs.some(d=>d.x===hover.x&&d.y===hover.y));
      ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillStyle=ok?'#3fb950':'#f85149';
      ctx.fillText(ok?'✓':'✗',s.x,s.y-20);}
    if(tool.startsWith('junction_')){
      const s=toScr(hover.x,hover.y);
      const taken=(G.junctions||[]).some(j=>j.x===hover.x&&j.y===hover.y);
      const ok=isRoad(hover.x,hover.y)&&!taken;
      const jt=(typeof JUNCTION_T!=='undefined')?JUNCTION_T[tool]:null;
      ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillStyle=ok?'#3fb950':'#f85149';
      ctx.fillText(ok?('✓ '+((jt&&jt.name)||tool)):(taken?'✗ obsazeno':'✗ jen silnice'),s.x,s.y-20);
    }
  }

  // ====== HEATMAP OVERLAY (pokud zapnutý) ======
  if(G.heatmapMode && typeof drawHeatmapOverlay==='function'){
    try{drawHeatmapOverlay(x0,y0,x1,y1);}catch(e){console.warn('heatmap',e);}
  }

  // ====== DAY/NIGHT OVERLAY ======
  const tint=getDayTint();
  if(tint.a>0){
    ctx.fillStyle=`rgba(${tint.r},${tint.g},${tint.b},${tint.a})`;
    // Cover entire visible area
    const isoTL=toScr(x0-2,y0-2),isoBR=toScr(x1+2,y1+2);
    const isoTR=toScr(x1+2,y0-2),isoBL=toScr(x0-2,y1+2);
    ctx.beginPath();
    ctx.moveTo(isoTL.x-100,Math.min(isoTL.y,isoTR.y)-200);
    ctx.lineTo(isoTR.x+100,Math.min(isoTL.y,isoTR.y)-200);
    ctx.lineTo(isoBR.x+100,Math.max(isoBL.y,isoBR.y)+200);
    ctx.lineTo(isoBL.x-100,Math.max(isoBL.y,isoBR.y)+200);
    ctx.closePath();ctx.fill();
  }

  ctx.restore();
  renderMM();
}

// ====== TERRAIN DRAWING ======

const GRASS_COLORS=['#152215','#16261a','#142016','#182818'];
const GRASS_STROKES=['#1e3a1e','#204020','#1c361c','#224226'];

function drawGrass(x,y,variant){
  const s=toScr(x,y);
  const v=variant%4;
  ctx.beginPath();ctx.moveTo(s.x,s.y-TH/2);ctx.lineTo(s.x+TW/2,s.y);ctx.lineTo(s.x,s.y+TH/2);ctx.lineTo(s.x-TW/2,s.y);ctx.closePath();
  ctx.fillStyle=GRASS_COLORS[v];ctx.fill();
  ctx.strokeStyle=GRASS_STROKES[v];ctx.lineWidth=.5;ctx.stroke();
  // Subtle grass texture dots
  if(v===0||v===2){
    ctx.fillStyle='rgba(50,100,50,.15)';
    ctx.fillRect(s.x-3,s.y-1,1,1);ctx.fillRect(s.x+5,s.y+2,1,1);ctx.fillRect(s.x-7,s.y+1,1,1);
  }
  if(v===1||v===3){
    ctx.fillStyle='rgba(40,80,40,.2)';
    ctx.fillRect(s.x+2,s.y-2,1,1);ctx.fillRect(s.x-5,s.y+3,1,1);
  }
}

function drawWater(x,y){
  const s=toScr(x,y);
  const wave=Math.sin(Date.now()/800+x*1.5+y*.7)*.015;
  ctx.beginPath();ctx.moveTo(s.x,s.y-TH/2);ctx.lineTo(s.x+TW/2,s.y);ctx.lineTo(s.x,s.y+TH/2);ctx.lineTo(s.x-TW/2,s.y);ctx.closePath();
  ctx.fillStyle=`rgba(15,40,${80+Math.round(wave*200)},1)`;ctx.fill();
  ctx.strokeStyle='rgba(30,80,160,.4)';ctx.lineWidth=.5;ctx.stroke();
  // Shimmer highlights
  const shimmer=Math.sin(Date.now()/600+x*2.3+y*1.1)*.5+.5;
  ctx.fillStyle=`rgba(60,140,220,${shimmer*.12})`;
  ctx.beginPath();ctx.moveTo(s.x-6,s.y-2);ctx.lineTo(s.x+4,s.y-4);ctx.lineTo(s.x+6,s.y-1);ctx.lineTo(s.x-4,s.y+1);ctx.closePath();ctx.fill();
  // Second ripple
  const sh2=Math.sin(Date.now()/900+x*1.1+y*2.1)*.5+.5;
  ctx.fillStyle=`rgba(80,160,240,${sh2*.08})`;
  ctx.beginPath();ctx.moveTo(s.x+2,s.y+1);ctx.lineTo(s.x+8,s.y-1);ctx.lineTo(s.x+6,s.y+3);ctx.closePath();ctx.fill();
}

function drawPark(x,y){
  const s=toScr(x,y);
  // Base - lighter green
  ctx.beginPath();ctx.moveTo(s.x,s.y-TH/2);ctx.lineTo(s.x+TW/2,s.y);ctx.lineTo(s.x,s.y+TH/2);ctx.lineTo(s.x-TW/2,s.y);ctx.closePath();
  ctx.fillStyle='#1a3518';ctx.fill();
  ctx.strokeStyle='#265a28';ctx.lineWidth=.5;ctx.stroke();
  // Draw trees (small circles with trunks)
  const treeX=[s.x-6,s.x+5,s.x-1],treeY=[s.y-3,s.y+1,s.y-6];
  for(let i=0;i<3;i++){
    // Trunk
    ctx.fillStyle='#5c3a1e';ctx.fillRect(treeX[i]-0.5,treeY[i]+1,1.5,3);
    // Canopy
    ctx.fillStyle=i%2===0?'#2d7a2d':'#258025';
    ctx.beginPath();ctx.arc(treeX[i]+.3,treeY[i],3.5-i*.3,0,Math.PI*2);ctx.fill();
    // Highlight
    ctx.fillStyle='rgba(80,200,80,.2)';
    ctx.beginPath();ctx.arc(treeX[i]-.5,treeY[i]-1,1.5,0,Math.PI*2);ctx.fill();
  }
  // Pathway dot
  ctx.fillStyle='rgba(200,180,140,.15)';ctx.fillRect(s.x-1,s.y,3,1.5);
}

function drawRoad(x,y){
  const s=toScr(x,y);
  // Base road
  ctx.beginPath();ctx.moveTo(s.x,s.y-TH/2);ctx.lineTo(s.x+TW/2,s.y);ctx.lineTo(s.x,s.y+TH/2);ctx.lineTo(s.x-TW/2,s.y);ctx.closePath();
  ctx.fillStyle='#333a42';ctx.fill();
  ctx.strokeStyle='#4a535e';ctx.lineWidth=1;ctx.stroke();
  // Inner road edge highlight
  const i=3;
  ctx.beginPath();ctx.moveTo(s.x,s.y-TH/2+i);ctx.lineTo(s.x+TW/2-i*2,s.y);ctx.lineTo(s.x,s.y+TH/2-i);ctx.lineTo(s.x-TW/2+i*2,s.y);ctx.closePath();
  ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;ctx.stroke();
  // Sidewalk edges
  ctx.strokeStyle='rgba(180,180,180,.08)';ctx.lineWidth=.5;
  ctx.beginPath();ctx.moveTo(s.x,s.y-TH/2+1);ctx.lineTo(s.x+TW/2-2,s.y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(s.x,s.y-TH/2+1);ctx.lineTo(s.x-TW/2+2,s.y);ctx.stroke();
}

function drawDia(x,y,f,s){const p=toScr(x,y);ctx.beginPath();ctx.moveTo(p.x,p.y-TH/2);ctx.lineTo(p.x+TW/2,p.y);ctx.lineTo(p.x,p.y+TH/2);ctx.lineTo(p.x-TW/2,p.y);ctx.closePath();ctx.fillStyle=f;ctx.fill();if(s){ctx.strokeStyle=s;ctx.lineWidth=.5;ctx.stroke();}}
function shade(c,p){const n=parseInt(c.replace('#',''),16),a=Math.round(2.55*p);return'#'+(0x1000000+Math.max(0,Math.min(255,(n>>16)+a))*0x10000+Math.max(0,Math.min(255,((n>>8)&0xff)+a))*0x100+Math.max(0,Math.min(255,(n&0xff)+a))).toString(16).slice(1);}

function drawBld(x,y,b){
  const bt=BTYPES[b.type],s=toScr(x,y),hw=TW/2-6,h=bt.h;
  const topY=s.y-h-TH/2+2;
  const topE=s.y-h;                   // y at the side corners of the top cap
  const baseColor=bt.clr;

  // ====== BUILDING BODY (shell) ======
  // Pokud je povolená sprite cache, blitneme hotové tělo jedním drawImage.
  // Jinak kreslíme všech 6 tahů inline (backward-compat).
  const _useSprite = G&&G.spriteCacheEnabled&&typeof window!=='undefined'&&window.spriteCacheReady&&typeof BLD_SPRITES!=='undefined'&&BLD_SPRITES[b.type];
  if(_useSprite){
    blitBuildingBody(x,y,b.type);
  } else {
    // Left face (lighter)
    ctx.beginPath();ctx.moveTo(s.x-hw,s.y);ctx.lineTo(s.x,s.y+TH/2-2);ctx.lineTo(s.x,s.y+TH/2-2-h);ctx.lineTo(s.x-hw,topE);ctx.closePath();ctx.fillStyle=shade(baseColor,-15);ctx.fill();
    // Right face (darker)
    ctx.beginPath();ctx.moveTo(s.x+hw,s.y);ctx.lineTo(s.x,s.y+TH/2-2);ctx.lineTo(s.x,s.y+TH/2-2-h);ctx.lineTo(s.x+hw,topE);ctx.closePath();ctx.fillStyle=shade(baseColor,-30);ctx.fill();
    // Top face
    ctx.beginPath();ctx.moveTo(s.x,topY);ctx.lineTo(s.x+hw,topE);ctx.lineTo(s.x,s.y+TH/2-2-h);ctx.lineTo(s.x-hw,topE);ctx.closePath();ctx.fillStyle=shade(baseColor,15);ctx.fill();

    // Ambient occlusion along base (subtle dark band where building meets ground)
    ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(s.x-hw+1,s.y-.5);ctx.lineTo(s.x,s.y+TH/2-2.5);ctx.lineTo(s.x+hw-1,s.y-.5);ctx.stroke();

    // Corner vertical highlight (front edge catches light)
    ctx.strokeStyle='rgba(255,255,255,.1)';ctx.lineWidth=.6;
    ctx.beginPath();ctx.moveTo(s.x,s.y+TH/2-2);ctx.lineTo(s.x,s.y+TH/2-2-h);ctx.stroke();

    // Edge highlight (top edges)
    ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=.6;
    ctx.beginPath();ctx.moveTo(s.x,topY);ctx.lineTo(s.x+hw,topE);ctx.stroke();
    ctx.beginPath();ctx.moveTo(s.x,topY);ctx.lineTo(s.x-hw,topE);ctx.stroke();
  }

  // Day/night helper
  const tint=getDayTint();
  const isNight=tint.a>.1;

  // ====== Horizontal floor lines (on medium+ buildings) ======
  if(h>=24){
    ctx.strokeStyle='rgba(0,0,0,.18)';ctx.lineWidth=.5;
    for(let fy=5;fy<h-3;fy+=5){
      ctx.beginPath();ctx.moveTo(s.x-hw+1,s.y-fy);ctx.lineTo(s.x,s.y+TH/2-2-fy);ctx.stroke();
      ctx.beginPath();ctx.moveTo(s.x+hw-1,s.y-fy);ctx.lineTo(s.x,s.y+TH/2-2-fy);ctx.stroke();
    }
  }

  // ====== Windows — true iso parallelograms + mullion lines (minimalist) ======
  const FT=TH/2-2;                              // face tilt offset (front-to-back)
  const timeSeed=Math.floor(Date.now()/10000);
  const bSeed=(((x*92821)^(y*53987))>>>0)||1;
  const srnd=(k)=>{let t=(bSeed+k*2654435761)>>>0;t^=t>>>15;t=Math.imul(t,2246822519);t^=t>>>13;t=Math.imul(t,3266489917);t^=t>>>16;return(t>>>0)/4294967296;};
  // leftFaceY(wx): screen y of face BOTTOM at horizontal offset wx on left face
  //   at wx=-hw → s.y (back),  at wx=0 → s.y+FT (front)
  // rightFaceY(wx): mirror — at wx=0 → s.y+FT, at wx=hw → s.y
  const leftFaceBy =(wx)=>s.y+(wx+hw)*FT/hw;
  const rightFaceBy=(wx)=>s.y+(hw-wx)*FT/hw;
  // Parallelogram window on LEFT face: (wx1..wx2) horizontal, fy=px above face bottom, height h
  const paraL=(wx1,wx2,fy,hh,fill,alpha)=>{
    const y1=leftFaceBy(wx1)-fy, y2=leftFaceBy(wx2)-fy;
    ctx.beginPath();
    ctx.moveTo(s.x+wx1,y1);
    ctx.lineTo(s.x+wx2,y2);
    ctx.lineTo(s.x+wx2,y2-hh);
    ctx.lineTo(s.x+wx1,y1-hh);
    ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.globalAlpha=alpha||1;ctx.fill();ctx.globalAlpha=1;}
  };
  const paraR=(wx1,wx2,fy,hh,fill,alpha)=>{
    const y1=rightFaceBy(wx1)-fy, y2=rightFaceBy(wx2)-fy;
    ctx.beginPath();
    ctx.moveTo(s.x+wx1,y1);
    ctx.lineTo(s.x+wx2,y2);
    ctx.lineTo(s.x+wx2,y2-hh);
    ctx.lineTo(s.x+wx1,y1-hh);
    ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.globalAlpha=alpha||1;ctx.fill();ctx.globalAlpha=1;}
  };

  if(h>=24){
    const btype=b.type;
    // Per-type pattern parameters — rows (floors) × cols (window columns)
    let rowStep=5,colStep=5,litChance=.40,slitHt=1.4,slitPad=.6,ribbon=false;
    if(btype==='skyscraper'){rowStep=4;colStep=3.2;litChance=.55;slitHt=1.8;slitPad=.3;ribbon=true;}
    else if(btype==='panel'){rowStep=5;colStep=4.5;litChance=.45;slitHt=1.8;slitPad=.5;}
    else if(btype==='bigcorp'){rowStep=6;colStep=3.5;litChance=.32;slitHt=2.2;slitPad=.4;ribbon=true;}
    else if(btype==='public'){rowStep=8;colStep=7;litChance=.40;slitHt=3.2;slitPad=.8;}

    const litCol='rgba(255,218,140,.82)';
    const litHalo='rgba(255,200,100,.14)';
    const darkCol=`rgba(0,0,0,.32)`;

    // --- LEFT FACE ---
    // 1) Floor bands: thin dark horizontal parallelogram slits (window strips)
    //    Each slit is drawn between two consecutive "floor" levels. This is the
    //    main window cue: a subtle glass band that follows the iso tilt.
    for(let fy=2;fy<h-3;fy+=rowStep){
      // glass slit fill
      if(ribbon){
        // Continuous ribbon
        paraL(-hw+2,-1,fy+slitPad,slitHt,isNight?'rgba(90,110,130,.5)':'rgba(120,150,180,.32)');
      } else {
        // Segmented — each column gets a separate slit so we can see mullions
        for(let wx=-hw+2;wx<-colStep;wx+=colStep){
          const wxEnd=Math.min(-1,wx+colStep-.7);
          paraL(wx+.3,wxEnd,fy+slitPad,slitHt,'rgba(90,115,145,.35)');
        }
      }
    }
    // 2) Lit window cells — tilted parallelograms on random cells
    if(isNight){
      for(let fy=2;fy<h-3;fy+=rowStep){
        for(let wx=-hw+2;wx<-colStep;wx+=colStep){
          const hash=srnd((wx+200)*131+fy*17);
          if(hash>litChance)continue;
          const wxEnd=Math.min(-1,wx+colStep-.7);
          // halo (slightly larger + dimmer)
          paraL(wx,wxEnd+.5,fy+slitPad-.5,slitHt+1,litHalo);
          // bright core
          paraL(wx+.3,wxEnd,fy+slitPad,slitHt,litCol);
        }
      }
    }
    // 3) Vertical mullion ticks — thin dark vertical lines that align with building verticals
    ctx.strokeStyle=darkCol;ctx.lineWidth=.5;
    for(let wx=-hw+3;wx<-1;wx+=colStep){
      const yBot=leftFaceBy(wx)-1;
      const yTop=yBot-h+3;
      ctx.beginPath();ctx.moveTo(s.x+wx,yBot);ctx.lineTo(s.x+wx,yTop);ctx.stroke();
    }

    // --- RIGHT FACE (mirrored, darker tones) ---
    for(let fy=2;fy<h-3;fy+=rowStep){
      if(ribbon){
        paraR(1,hw-2,fy+slitPad,slitHt,isNight?'rgba(70,90,110,.55)':'rgba(95,125,155,.35)');
      } else {
        for(let wx=1;wx<hw-colStep;wx+=colStep){
          const wxEnd=Math.min(hw-2,wx+colStep-.7);
          paraR(wx+.3,wxEnd,fy+slitPad,slitHt,'rgba(75,100,130,.38)');
        }
      }
    }
    if(isNight){
      for(let fy=2;fy<h-3;fy+=rowStep){
        for(let wx=1;wx<hw-colStep;wx+=colStep){
          const hash=srnd((wx+500)*113+fy*23);
          if(hash>litChance*.9)continue;
          const wxEnd=Math.min(hw-2,wx+colStep-.7);
          paraR(wx-.2,wxEnd+.3,fy+slitPad-.5,slitHt+1,litHalo);
          paraR(wx+.3,wxEnd,fy+slitPad,slitHt,litCol);
        }
      }
    }
    ctx.strokeStyle='rgba(0,0,0,.38)';ctx.lineWidth=.5;
    for(let wx=2;wx<hw-2;wx+=colStep){
      const yBot=rightFaceBy(wx)-1;
      const yTop=yBot-h+3;
      ctx.beginPath();ctx.moveTo(s.x+wx,yBot);ctx.lineTo(s.x+wx,yTop);ctx.stroke();
    }

    // Mechanical floor (sub-ribbon slightly darker) every ~10 floors on skyscraper
    if(btype==='skyscraper'){
      for(let fy=rowStep*3;fy<h-rowStep*2;fy+=rowStep*4){
        paraL(-hw+2,-1,fy-slitHt-2,1.2,'rgba(0,0,0,.38)');
        paraR(1,hw-2,fy-slitHt-2,1.2,'rgba(0,0,0,.42)');
      }
    }

    // Balconies on panel — small iso ledges on some cells
    if(btype==='panel'){
      for(let fy=rowStep;fy<h-4;fy+=rowStep){
        for(let wx=-hw+3;wx<-colStep;wx+=colStep*2){
          if(srnd(wx*41+fy*17+3)<.22){
            const wxEnd=Math.min(-1.5,wx+colStep-.5);
            // slab
            paraL(wx-.5,wxEnd+.3,fy-.4,.9,'rgba(0,0,0,.50)');
            // top highlight
            paraL(wx-.5,wxEnd+.3,fy-.4,.35,'rgba(255,255,255,.14)');
          }
        }
        for(let wx=2;wx<hw-colStep;wx+=colStep*2){
          if(srnd(wx*37+fy*19+5)<.22){
            const wxEnd=Math.min(hw-2,wx+colStep-.5);
            paraR(wx-.3,wxEnd+.5,fy-.4,.9,'rgba(0,0,0,.55)');
            paraR(wx-.3,wxEnd+.5,fy-.4,.35,'rgba(255,255,255,.12)');
          }
        }
      }
    }

  } else if(h>=14){
    // Small buildings (shop/house/rowhouse): a few iso-parallelogram windows
    // Left face — 2 small slits
    for(let i=0;i<2;i++){
      const wx=-hw+4+i*5;
      const wxEnd=wx+2.5;
      const lit=isNight && srnd(i*11+3)>.35;
      paraL(wx,wxEnd,h-7,2.2,lit?'rgba(255,220,140,.82)':'rgba(120,150,180,.40)');
      if(lit)paraL(wx-.4,wxEnd+.4,h-7.4,3,'rgba(255,200,100,.16)');
    }
    // Right face — 2 small slits
    for(let i=0;i<2;i++){
      const wx=hw-6-i*5;
      const wxEnd=wx+2.5;
      const lit=isNight && srnd(i*17+5)>.4;
      paraR(wx,wxEnd,h-7,2.2,lit?'rgba(255,210,120,.72)':'rgba(95,125,155,.40)');
      if(lit)paraR(wx-.4,wxEnd+.4,h-7.4,3,'rgba(255,190,80,.14)');
    }
    // Vertical mullion ticks on each face
    ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=.5;
    for(let i=0;i<2;i++){
      const wx=-hw+4+i*5+1.2;
      const yBot=leftFaceBy(wx)-h+5;
      ctx.beginPath();ctx.moveTo(s.x+wx,yBot);ctx.lineTo(s.x+wx,yBot-2.4);ctx.stroke();
    }
    for(let i=0;i<2;i++){
      const wx=hw-6-i*5+1.2;
      const yBot=rightFaceBy(wx)-h+5;
      ctx.beginPath();ctx.moveTo(s.x+wx,yBot);ctx.lineTo(s.x+wx,yBot-2.4);ctx.stroke();
    }
  }

  // ====== Iso helper for rooftop boxes (cube sitting on the roof) ======
  // (cx,cy) = screen coords of the bottom-center of the box (on the roof surface).
  // sz = half-width in horizontal screen px;  hp = height above roof in screen px.
  const isoBox=(cx,cy,sz,hp,col,outline)=>{
    const sh=sz*.5;                                        // iso ratio TH/TW = 0.5
    // top diamond (lightest)
    ctx.fillStyle=shade(col,12);
    ctx.beginPath();
    ctx.moveTo(cx,cy-sh-hp);
    ctx.lineTo(cx+sz,cy-hp);
    ctx.lineTo(cx,cy+sh-hp);
    ctx.lineTo(cx-sz,cy-hp);
    ctx.closePath();ctx.fill();
    // SW face (lighter)
    ctx.fillStyle=shade(col,-12);
    ctx.beginPath();
    ctx.moveTo(cx-sz,cy-hp);
    ctx.lineTo(cx,cy+sh-hp);
    ctx.lineTo(cx,cy+sh);
    ctx.lineTo(cx-sz,cy);
    ctx.closePath();ctx.fill();
    // SE face (darker)
    ctx.fillStyle=shade(col,-26);
    ctx.beginPath();
    ctx.moveTo(cx+sz,cy-hp);
    ctx.lineTo(cx,cy+sh-hp);
    ctx.lineTo(cx,cy+sh);
    ctx.lineTo(cx+sz,cy);
    ctx.closePath();ctx.fill();
    if(outline!==false){
      ctx.strokeStyle='rgba(0,0,0,.40)';ctx.lineWidth=.5;
      // front vertical edge
      ctx.beginPath();ctx.moveTo(cx,cy+sh-hp);ctx.lineTo(cx,cy+sh);ctx.stroke();
      // top front edges (N→E, N→W)
      ctx.beginPath();ctx.moveTo(cx,cy-sh-hp);ctx.lineTo(cx+sz,cy-hp);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy-sh-hp);ctx.lineTo(cx-sz,cy-hp);ctx.stroke();
    }
  };

  // ====== Door for small buildings (iso parallelogram on left face) ======
  if(h<24){
    // Door sits on left face, centered near the front corner (wx ∈ [-3, 0])
    paraL(-3,-.3,0,5.5,shade(baseColor,-50));
    // Door frame highlight (bright thin line at top)
    paraL(-3,-.3,5,0.4,'rgba(255,255,255,.25)');
    // Door handle
    const dfront=-.8+hw,dy=dfront*FT/hw;  // tilt at wx=-0.8
    ctx.fillStyle='rgba(240,200,80,.9)';
    ctx.beginPath();ctx.arc(s.x-.8,s.y+dy-2,.5,0,Math.PI*2);ctx.fill();
  }

  // ====== Per-type rooftop details (all iso) ======
  const type=b.type;
  if(type==='house'||type==='rowhouse'){
    // OpenTTD-style pitched roof — ridge runs N–S (visually vertical), two slopes
    // on E and W with a clearly visible S gable (the triangular wall facing camera).
    const ridgeN={x:s.x,y:topY-4};
    const ridgeS={x:s.x,y:s.y+TH/2-2-h-2};
    const eCorner={x:s.x+hw-1,y:topE-1};
    const wCorner={x:s.x-hw+1,y:topE-1};
    // East slope (darker — shadow side, matches SE face)
    ctx.fillStyle=shade(baseColor,-45);
    ctx.beginPath();
    ctx.moveTo(ridgeN.x,ridgeN.y);
    ctx.lineTo(eCorner.x,eCorner.y);
    ctx.lineTo(ridgeS.x,ridgeS.y);
    ctx.closePath();ctx.fill();
    // West slope (lighter — sun side)
    ctx.fillStyle=shade(baseColor,-30);
    ctx.beginPath();
    ctx.moveTo(ridgeN.x,ridgeN.y);
    ctx.lineTo(wCorner.x,wCorner.y);
    ctx.lineTo(ridgeS.x,ridgeS.y);
    ctx.closePath();ctx.fill();
    // South gable triangle (the little triangular wall facing camera)
    ctx.fillStyle=shade(baseColor,-20);
    ctx.beginPath();
    ctx.moveTo(ridgeS.x,ridgeS.y);
    ctx.lineTo(s.x,s.y+TH/2-2);
    ctx.lineTo(s.x-2,s.y+TH/2-2-1);
    ctx.closePath();ctx.fill();
    // Ridge highlight (crisp bright line along the top)
    ctx.strokeStyle='rgba(255,255,255,.24)';ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(ridgeN.x,ridgeN.y);ctx.lineTo(ridgeS.x,ridgeS.y);ctx.stroke();
    // Eaves shadow
    ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=.5;
    ctx.beginPath();ctx.moveTo(wCorner.x,wCorner.y);ctx.lineTo(ridgeS.x,ridgeS.y);ctx.lineTo(eCorner.x,eCorner.y);ctx.stroke();
    // Chimney on the back (N) slope — iso brick box with cap
    isoBox(s.x-1.5,topY+1,1.4,5,'#6b4430');
    // Cap (slightly wider plate)
    isoBox(s.x-1.5,topY-3.5,1.7,.6,shade('#6b4430',20),false);
  }
  else if(type==='shop'){
    // Flat roof with parapet rim + awning stripe (now iso parallelograms on faces)
    ctx.strokeStyle=shade(baseColor,-55);ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(s.x,topY+1);ctx.lineTo(s.x+hw,topE+1);ctx.stroke();
    ctx.beginPath();ctx.moveTo(s.x,topY+1);ctx.lineTo(s.x-hw,topE+1);ctx.stroke();
    // Awning stripes — parallelograms on each face, just above ground
    paraL(-hw+3,-.5,3,1.6,'#ef4444');
    paraR(.5,hw-3,3,1.6,'#fbbf24');
    // Awning bottom shadow
    paraL(-hw+3,-.5,2.6,.4,'rgba(0,0,0,.35)');
    paraR(.5,hw-3,2.6,.4,'rgba(0,0,0,.40)');
    // Shop sign dot on left face
    ctx.fillStyle='rgba(251,191,36,.85)';
    ctx.beginPath();ctx.arc(s.x-hw/2,s.y-h+4+(-hw/2+hw)*FT/hw,1.2,0,Math.PI*2);ctx.fill();
  }
  else if(type==='factory'){
    // Sawtooth roof (iso — ridges running along SE axis)
    ctx.fillStyle=shade(baseColor,-25);
    ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=.4;
    for(let i=0;i<3;i++){
      // Diamond roof position along the top face (moving from W→E direction)
      const u=(i+.5)/3;                          // 0..1 along W→E diagonal
      const cx=s.x-hw+u*2*hw, cy=topE;           // rests on top-face line
      // small ridge: a thin iso ridge box
      isoBox(cx-3,cy,3,3,shade(baseColor,-20),false);
    }
    // Smokestack — tall iso box with red cap (placed toward E corner of roof)
    isoBox(s.x+hw/2-2, topE+0.5, 1.6, 9, '#8b6f4a');
    // Red rim cap
    isoBox(s.x+hw/2-2, topE+0.5-9, 1.9, .8, '#ef4444', false);
  }
  else if(type==='public'){
    // Peaked roof accent (triangular pediment) + flag
    ctx.fillStyle=shade(baseColor,-30);
    ctx.beginPath();
    ctx.moveTo(s.x,topY-2);
    ctx.lineTo(s.x+hw*.6,topE-1);
    ctx.lineTo(s.x-hw*.6,topE-1);
    ctx.closePath();ctx.fill();
    // Ridge
    ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=.6;
    ctx.beginPath();ctx.moveTo(s.x,topY-2);ctx.lineTo(s.x,topE);ctx.stroke();
    // Flag pole with animated flag
    ctx.strokeStyle='rgba(220,220,220,.5)';ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(s.x,topY-2);ctx.lineTo(s.x,topY-8);ctx.stroke();
    const flag=Math.sin(Date.now()/500+x)*.5+.5;
    ctx.fillStyle='#ef4444';
    ctx.fillRect(s.x+.5,topY-8,3+flag*.8,2);
  }
  else if(type==='panel'||type==='bigcorp'){
    // Flat roof — HVAC iso cube + parapet
    // HVAC: placed off-center-left on the roof
    isoBox(s.x-hw*.35,topE-1,3.5,3.5,shade(baseColor,-35));
    // Grate detail on SE face of HVAC
    ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=.4;
    for(let i=0;i<3;i++){
      const gx=s.x-hw*.35-1+i*.8;
      ctx.beginPath();ctx.moveTo(gx,topE-.8);ctx.lineTo(gx+.3,topE-3);ctx.stroke();
    }
    // Parapet rim (thin dark line around top face edges)
    ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=.7;
    ctx.beginPath();ctx.moveTo(s.x-hw,topE);ctx.lineTo(s.x,topY);ctx.lineTo(s.x+hw,topE);ctx.stroke();
    // Second smaller iso unit on the other side
    isoBox(s.x+hw*.3,topE+1,2,2,shade(baseColor,-30),false);
    // Small antenna on bigcorp
    if(type==='bigcorp'){
      // Antenna base iso cube
      isoBox(s.x+3,topE+1,1.2,1.5,'#3a3a3a',false);
      // Mast (iso-centered vertical line from top of base)
      ctx.strokeStyle='rgba(200,200,200,.65)';ctx.lineWidth=.8;
      ctx.beginPath();ctx.moveTo(s.x+3,topE-.5);ctx.lineTo(s.x+3,topE-7);ctx.stroke();
      ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(s.x+3,topE-7,1,0,Math.PI*2);ctx.fill();
    }
  }
  else if(type==='skyscraper'){
    // Stepped iso crown + tall antenna with blinking aviation light
    // Bottom wider iso step
    isoBox(s.x,topE+1,hw*.55,3,shade(baseColor,-30));
    // Top narrower iso step
    isoBox(s.x,topE-2,hw*.32,3,shade(baseColor,-45));
    // Antenna mast (centered on iso top of narrow step)
    ctx.strokeStyle='rgba(200,200,200,.6)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(s.x,topE-6);ctx.lineTo(s.x,topE-14);ctx.stroke();
    // Cross struts — iso-style (going along E and W diagonals)
    ctx.lineWidth=.5;
    ctx.beginPath();
    ctx.moveTo(s.x-1.5,topE-11+.75);ctx.lineTo(s.x+1.5,topE-11-.75);
    ctx.stroke();
    // Blinking aviation warning light
    const blink=(Date.now()%1400)<700;
    ctx.fillStyle=blink?'#ff2020':'#5a1010';
    ctx.beginPath();ctx.arc(s.x,topE-14,1.2,0,Math.PI*2);ctx.fill();
    if(blink){ctx.fillStyle='rgba(255,40,40,.4)';ctx.beginPath();ctx.arc(s.x,topE-14,2.8,0,Math.PI*2);ctx.fill();}
  }

  // ====== Labels ======
  ctx.font='bold 7px sans-serif';ctx.textAlign='center';
  const dy=s.y-h-TH/2-4;
  if(b.connected){
    // Connected badge: green pill with customer count
    ctx.fillStyle='rgba(0,0,0,.55)';
    ctx.beginPath();ctx.arc(s.x,dy,5.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#3fb950';ctx.beginPath();ctx.arc(s.x,dy,4.5,0,Math.PI*2);ctx.fill();
    ctx.font='bold 7px sans-serif';ctx.fillStyle='#fff';ctx.fillText(b.customers+'/'+b.units,s.x,dy+2.5);
    if(b.connType&&CONN_T[b.connType]){ctx.font='7px sans-serif';ctx.fillText(CONN_T[b.connType].icon,s.x+14,dy+2);}
  } else {
    ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillText(b.units+'×🏠',s.x,s.y-h-TH/2-12);
    if(b.want){
      // Subtle pulsing "wants service" indicator
      const pulse=Math.sin(Date.now()/600)*.3+.7;
      ctx.fillStyle=`rgba(251,191,36,${pulse})`;
      ctx.beginPath();ctx.arc(s.x,dy,3,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='rgba(251,191,36,.2)';
      ctx.beginPath();ctx.arc(s.x,dy,5,0,Math.PI*2);ctx.fill();
    }
  }
}

function drawDC(x,y,dc,di){
  const dt=DC_T[dc.type],s=toScr(x,y),hw=TW/2-2,h=dt.h;const isSel=selDC===di;const load=dcLoads[di];
  const isOutage=dc.outage&&dc.outage.active;
  const topY=s.y-h-TH/2+1;
  const topE=s.y-h;
  const isLarge=dc.type==='dc_large';
  const isMedium=dc.type==='dc_medium';
  const isSmall=dc.type==='dc_small';
  const baseColor=dt.color;

  // Shadow
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.moveTo(s.x+3,s.y-TH/2+6);ctx.lineTo(s.x+hw+5,s.y+4);ctx.lineTo(s.x+3,s.y+TH/2+6);ctx.lineTo(s.x-hw-1,s.y+4);ctx.closePath();ctx.fill();

  // ====== Faint ground glow (denotes DC importance) ======
  if(!isOutage){
    const grad=ctx.createRadialGradient(s.x,s.y+2,2,s.x,s.y+2,hw+18);
    grad.addColorStop(0,baseColor+'22');grad.addColorStop(1,baseColor+'00');
    ctx.fillStyle=grad;
    ctx.beginPath();ctx.ellipse(s.x,s.y+2,hw+18,(hw+18)*.5,0,0,Math.PI*2);ctx.fill();
  }

  // Left face (industrial grey-blue tint blended with DC color)
  ctx.beginPath();ctx.moveTo(s.x-hw,s.y);ctx.lineTo(s.x,s.y+TH/2-1);ctx.lineTo(s.x,s.y+TH/2-1-h);ctx.lineTo(s.x-hw,topE);ctx.closePath();
  ctx.fillStyle=isOutage?'#8b0000':shade('#2a3040',-5);ctx.fill();
  // Right face
  ctx.beginPath();ctx.moveTo(s.x+hw,s.y);ctx.lineTo(s.x,s.y+TH/2-1);ctx.lineTo(s.x,s.y+TH/2-1-h);ctx.lineTo(s.x+hw,topE);ctx.closePath();
  ctx.fillStyle=isOutage?'#a00000':shade('#1c2230',-5);ctx.fill();
  // Top
  ctx.beginPath();ctx.moveTo(s.x,topY);ctx.lineTo(s.x+hw,topE);ctx.lineTo(s.x,s.y+TH/2-1-h);ctx.lineTo(s.x-hw,topE);ctx.closePath();
  ctx.fillStyle=isOutage?'#cc0000':shade('#3b4558',10);ctx.fill();

  // Accent trim color band (identifies DC size via its type color)
  ctx.fillStyle=isOutage?'#ff5030':baseColor;
  ctx.fillRect(s.x-hw+2,s.y-3,hw-3,2);
  ctx.fillStyle=isOutage?'#ff3015':shade(baseColor,-20);
  ctx.fillRect(s.x+2,s.y-3,hw-3,2);
  // Accent glow
  ctx.fillStyle=baseColor+'33';
  ctx.fillRect(s.x-hw+2,s.y-5,hw-3,1);ctx.fillRect(s.x+2,s.y-5,hw-3,1);

  // Outage pulse on top
  if(isOutage){
    const pulse=(Math.sin(Date.now()/200)*.5+.5);
    ctx.fillStyle=`rgba(255,50,50,${pulse*.4})`;
    ctx.beginPath();ctx.moveTo(s.x,topY);ctx.lineTo(s.x+hw,topE);ctx.lineTo(s.x,s.y+TH/2-1-h);ctx.lineTo(s.x-hw,topE);ctx.closePath();ctx.fill();
  }

  // ====== Corrugated metal panel lines on faces ======
  ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=.6;
  for(let i=4;i<h-1;i+=3){
    ctx.beginPath();ctx.moveTo(s.x-hw+2,s.y-i);ctx.lineTo(s.x-1,s.y+TH/2-1-i);ctx.stroke();
  }
  // Right face panels
  for(let i=5;i<h-1;i+=4){
    ctx.beginPath();ctx.moveTo(s.x+hw-2,s.y-i);ctx.lineTo(s.x+1,s.y+TH/2-1-i);ctx.stroke();
  }

  // ====== Big entrance gate (front) ======
  if(!isOutage){
    const gw=8,gh=Math.min(7,h-3);
    ctx.fillStyle='#0a0f18';
    ctx.fillRect(s.x-gw/2,s.y+TH/2-1-gh,gw,gh);
    // Gate frame
    ctx.strokeStyle=baseColor+'cc';ctx.lineWidth=.7;
    ctx.strokeRect(s.x-gw/2,s.y+TH/2-1-gh,gw,gh);
    // Subtle gate sheen
    ctx.fillStyle=baseColor+'22';
    ctx.fillRect(s.x-gw/2,s.y+TH/2-1-gh,gw,1.5);
  }

  // ====== LED status column on right face ======
  const eqs=dc.eq||[];
  const ledCount=Math.min(eqs.length||1,8);
  for(let i=0;i<ledCount;i++){
    const ledOn=!isOutage&&(Date.now()+i*137)%1400<700;
    ctx.fillStyle=ledOn?'#3fb950':'#15451a';
    ctx.beginPath();ctx.arc(s.x+hw-4,s.y-h+6+i*4,1.6,0,Math.PI*2);ctx.fill();
    if(ledOn){
      ctx.fillStyle='rgba(63,185,80,.35)';
      ctx.beginPath();ctx.arc(s.x+hw-4,s.y-h+6+i*4,3.2,0,Math.PI*2);ctx.fill();
    }
  }

  // ====== ROOFTOP EQUIPMENT (size-dependent silhouette) ======
  // Common: access hatch
  ctx.fillStyle=shade('#2b3040',-20);
  ctx.fillRect(s.x-3,topE-3,4,3);
  ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=.5;
  ctx.strokeRect(s.x-3,topE-3,4,3);

  // Cooling tower clusters
  const coolColor='#4a5268';
  const coolColorDark='#2e3442';
  const drawCoolBox=(cx,cy,cw,ch)=>{
    // iso box on roof
    ctx.fillStyle=coolColor;
    ctx.fillRect(cx-cw/2,cy-ch,cw,ch);
    ctx.fillStyle=coolColorDark;
    ctx.fillRect(cx-cw/2,cy-ch,cw,1.2); // top shadow
    // Louvers
    ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=.4;
    for(let lv=1;lv<cw-1;lv+=1.4){
      ctx.beginPath();ctx.moveTo(cx-cw/2+lv,cy-ch+1.5);ctx.lineTo(cx-cw/2+lv,cy-.5);ctx.stroke();
    }
    // Top fan circle with spinning blades
    ctx.fillStyle='#1a1e28';
    ctx.beginPath();ctx.arc(cx,cy-ch+1,cw*.3,0,Math.PI*2);ctx.fill();
    if(!isOutage){
      const spin=(Date.now()/200)%(Math.PI*2);
      ctx.strokeStyle='rgba(180,200,220,.5)';ctx.lineWidth=.5;
      for(let b=0;b<3;b++){
        const a=spin+b*(Math.PI*2/3);
        ctx.beginPath();ctx.moveTo(cx,cy-ch+1);ctx.lineTo(cx+Math.cos(a)*cw*.28,cy-ch+1+Math.sin(a)*cw*.28);ctx.stroke();
      }
    }
  };

  if(isSmall){
    // One small cooling unit
    drawCoolBox(s.x+4,topE,4,3);
  } else if(isMedium){
    // Two cooling units + small dish
    drawCoolBox(s.x-6,topE,5,4);
    drawCoolBox(s.x+3,topE,5,4);
    // Satellite dish
    ctx.fillStyle='#dce0e8';
    ctx.beginPath();ctx.arc(s.x+9,topE-2,2.2,Math.PI*.1,Math.PI*.9);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=.4;
    ctx.beginPath();ctx.arc(s.x+9,topE-2,2.2,Math.PI*.1,Math.PI*.9);ctx.stroke();
    // Dish arm
    ctx.strokeStyle='#888';ctx.lineWidth=.6;
    ctx.beginPath();ctx.moveTo(s.x+9,topE-1);ctx.lineTo(s.x+9,topE);ctx.stroke();
  } else if(isLarge){
    // Three cooling towers + antenna array + dish
    drawCoolBox(s.x-10,topE,5,5);
    drawCoolBox(s.x-2,topE,5,5);
    drawCoolBox(s.x+6,topE,5,5);
    // Antenna mast with multiple elements
    ctx.strokeStyle='rgba(210,210,210,.65)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(s.x+11,topE-1);ctx.lineTo(s.x+11,topE-14);ctx.stroke();
    // cross struts
    ctx.lineWidth=.5;
    ctx.beginPath();ctx.moveTo(s.x+9,topE-6);ctx.lineTo(s.x+13,topE-6);ctx.stroke();
    ctx.beginPath();ctx.moveTo(s.x+10,topE-10);ctx.lineTo(s.x+12,topE-10);ctx.stroke();
    // Blinking aviation light
    const blink=(Date.now()%1400)<700;
    ctx.fillStyle=blink?'#ff2020':'#5a1010';
    ctx.beginPath();ctx.arc(s.x+11,topE-14,1.3,0,Math.PI*2);ctx.fill();
    if(blink){ctx.fillStyle='rgba(255,40,40,.4)';ctx.beginPath();ctx.arc(s.x+11,topE-14,3,0,Math.PI*2);ctx.fill();}
    // Satellite dish
    ctx.fillStyle='#dce0e8';
    ctx.beginPath();ctx.arc(s.x-14,topE-3,3,Math.PI*.1,Math.PI*.9);ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=.4;
    ctx.beginPath();ctx.arc(s.x-14,topE-3,3,Math.PI*.1,Math.PI*.9);ctx.stroke();
    ctx.strokeStyle='#888';ctx.lineWidth=.7;
    ctx.beginPath();ctx.moveTo(s.x-14,topE-1);ctx.lineTo(s.x-14,topE);ctx.stroke();
  }

  // ====== Steam/heat plume from cooling (when active) ======
  if(!isOutage&&load&&load.ratio>.3){
    const puffBase=isLarge?Math.PI*3:isMedium?Math.PI*2:Math.PI*1.5;
    const intensity=Math.min(1,load.ratio);
    for(let i=0;i<3;i++){
      const t=((Date.now()/800+i*.33)%1);
      const py=topE-4-t*10;
      const px=s.x+(isLarge?6:2)+Math.sin(t*puffBase)*1.5;
      const r=1.2+t*1.8;
      ctx.fillStyle=`rgba(220,230,240,${(1-t)*intensity*.2})`;
      ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
    }
  }

  // ====== Equipment icons floating above ======
  const uniq=[...new Set(eqs)];
  ctx.font='9px sans-serif';ctx.textAlign='center';
  const iconStart=s.x-Math.min(uniq.length,4)*5;
  uniq.slice(0,4).forEach((eq,i)=>{
    if(EQ[eq])ctx.fillText(EQ[eq].icon,iconStart+i*10,s.y-h-TH/2-4);
  });

  // DC name label with backing chip
  const labelY=s.y-h-TH/2-14;
  const labelText=dt.name;
  ctx.font='bold 8px sans-serif';ctx.textAlign='center';
  const labelW=ctx.measureText(labelText).width+10;
  ctx.fillStyle='rgba(13,17,23,.82)';
  roundRect(ctx,s.x-labelW/2,labelY-6,labelW,10,3);ctx.fill();
  ctx.strokeStyle=baseColor+'cc';ctx.lineWidth=.7;
  roundRect(ctx,s.x-labelW/2,labelY-6,labelW,10,3);ctx.stroke();
  ctx.fillStyle=baseColor;ctx.fillText(labelText,s.x,labelY+1);

  // ====== BW usage bar ======
  if(load){
    const barW=TW-6,barH=5,barX=s.x-barW/2,barY=s.y-h-TH/2-26;
    // Bar background
    ctx.fillStyle='rgba(13,17,23,.85)';ctx.fillRect(barX-1,barY-1,barW+2,barH+2);
    ctx.fillStyle='#161b22';ctx.fillRect(barX,barY,barW,barH);
    const fillW=Math.min(1,load.ratio)*barW;
    // Fill with gradient
    const fc=load.ratio>.95?'#ef4444':load.ratio>.7?'#f59e0b':'#3fb950';
    const fcDark=load.ratio>.95?'#b91c1c':load.ratio>.7?'#b45309':'#15803d';
    const fillGrad=ctx.createLinearGradient(barX,barY,barX,barY+barH);
    fillGrad.addColorStop(0,fc);fillGrad.addColorStop(1,fcDark);
    ctx.fillStyle=fillGrad;ctx.fillRect(barX,barY,fillW,barH);
    // Inner highlight
    ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(barX,barY,fillW,1);
    // Glow for critical
    if(load.ratio>.9){
      const pulse=Math.sin(Date.now()/300)*.3+.7;
      ctx.fillStyle=`rgba(239,68,68,${pulse*.35})`;
      ctx.fillRect(barX-1,barY-2,fillW+2,barH+4);
    }
    // Label
    ctx.font='bold 7px sans-serif';ctx.fillStyle='#fff';ctx.textAlign='center';
    ctx.fillText(fmtBW(load.usedBW)+' / '+fmtBW(load.maxBW),s.x,barY-3);
  }

  // ====== Selection outline ======
  if(isSel){
    ctx.strokeStyle='#00d4ff';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(s.x,topY);ctx.lineTo(s.x+hw,topE);ctx.lineTo(s.x+hw,s.y);ctx.lineTo(s.x,s.y+TH/2-1);ctx.lineTo(s.x-hw,s.y);ctx.lineTo(s.x-hw,topE);ctx.closePath();ctx.stroke();
    ctx.strokeStyle='rgba(0,212,255,.25)';ctx.lineWidth=5;
    ctx.beginPath();ctx.moveTo(s.x,topY);ctx.lineTo(s.x+hw,topE);ctx.lineTo(s.x+hw,s.y);ctx.lineTo(s.x,s.y+TH/2-1);ctx.lineTo(s.x-hw,s.y);ctx.lineTo(s.x-hw,topE);ctx.closePath();ctx.stroke();
    ctx.lineWidth=1;
  }

  // ====== Active DC pulsing halo (subtle ring on ground) ======
  if(!isOutage&&eqs.length>0){
    const pulse=Math.sin(Date.now()/1200)*.15+.85;
    ctx.strokeStyle=`rgba(124,58,237,${pulse*.18})`;ctx.lineWidth=1.2;
    ctx.beginPath();ctx.ellipse(s.x,s.y+2,hw+10,(hw+10)*.5,0,0,Math.PI*2);ctx.stroke();
  }
}

// Helper: rounded rect path
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function drawTower(x,y,tw){
  const tt=TOWER_T[tw.type];if(!tt)return;
  const s=toScr(x,y);
  const isSmall=tt.small||false;
  const isSector=tt.sector||false;
  const h=isSmall?22:isSector?45:40; // pole height

  // Tower base shadow
  ctx.fillStyle='rgba(0,0,0,.2)';
  ctx.beginPath();ctx.ellipse(s.x+2,s.y+2,isSector?8:isSmall?4:6,isSector?4:isSmall?2:3,0,0,Math.PI*2);ctx.fill();

  if(isSector){
    // Sector tower — thick pole with 3 sector panels
    const grad=ctx.createLinearGradient(s.x,s.y,s.x,s.y-h);
    grad.addColorStop(0,'#555');grad.addColorStop(0.5,'#888');grad.addColorStop(1,tt.color);
    ctx.strokeStyle=grad;ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x,s.y-h);ctx.stroke();
    // Platform
    ctx.fillStyle='#666';
    ctx.fillRect(s.x-8,s.y-h-1,16,3);
    // 3 sector panels (120° apart, drawn as rectangles at angles)
    const panelH=12,panelW=3;
    const panelY=s.y-h-panelH/2-2;
    for(let i=0;i<3;i++){
      const angle=(i*120-90)*Math.PI/180;
      const px=s.x+Math.cos(angle)*7;
      const py=panelY+Math.sin(angle)*3;
      ctx.save();ctx.translate(px,py);ctx.rotate(angle);
      ctx.fillStyle=tt.color;ctx.fillRect(-panelW/2,-panelH/2,panelW,panelH);
      ctx.strokeStyle=tt.color+'88';ctx.lineWidth=0.5;ctx.strokeRect(-panelW/2,-panelH/2,panelW,panelH);
      ctx.restore();
    }
    // Center hub
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x,panelY,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=tt.color+'66';ctx.beginPath();ctx.arc(s.x,panelY,6,0,Math.PI*2);ctx.fill();
    // 3 sector beams (wide arcs)
    const pulse=(Math.sin(Date.now()/500)*.3+.7);
    const alpha=Math.round(pulse*70).toString(16).padStart(2,'0');
    ctx.strokeStyle=tt.color+alpha;ctx.lineWidth=1.5;
    for(let i=0;i<3;i++){
      const a0=(i*120-60)*Math.PI/180;
      const a1=(i*120+60)*Math.PI/180;
      for(let r=1;r<=3;r++){
        ctx.beginPath();ctx.arc(s.x,panelY,8+r*6,a0,a1);ctx.stroke();
      }
    }
  } else if(isSmall){
    // Small cell — short cylindrical pole with box on top
    ctx.strokeStyle='#888';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x,s.y-h);ctx.stroke();
    // Box body
    const bw=6,bh=8;
    ctx.fillStyle=tt.color;
    ctx.fillRect(s.x-bw,s.y-h-bh,bw*2,bh);
    ctx.strokeStyle=tt.color+'88';ctx.lineWidth=1;
    ctx.strokeRect(s.x-bw,s.y-h-bh,bw*2,bh);
    // Small LED dots
    ctx.fillStyle='#0f0';ctx.beginPath();ctx.arc(s.x-3,s.y-h-3,1.2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ff0';ctx.beginPath();ctx.arc(s.x+3,s.y-h-3,1.2,0,Math.PI*2);ctx.fill();
    // Glow
    ctx.fillStyle=tt.color+'33';ctx.beginPath();ctx.arc(s.x,s.y-h-bh/2,12,0,Math.PI*2);ctx.fill();
    // Signal waves (shorter range visual)
    const pulse=(Math.sin(Date.now()/350+x)*.3+.7);
    const alpha=Math.round(pulse*60).toString(16).padStart(2,'0');
    ctx.strokeStyle=tt.color+alpha;ctx.lineWidth=1;
    for(let r=1;r<=2;r++){
      ctx.beginPath();ctx.arc(s.x,s.y-h-bh/2,6+r*4,-.6,-.1);ctx.stroke();
      ctx.beginPath();ctx.arc(s.x,s.y-h-bh/2,6+r*4,Math.PI+.1,Math.PI+.6);ctx.stroke();
    }
  } else {
    // Macro tower — tall pole with cross bars
    const grad=ctx.createLinearGradient(s.x,s.y,s.x,s.y-h);
    grad.addColorStop(0,'#666');grad.addColorStop(1,tt.color);
    ctx.strokeStyle=grad;ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x,s.y-h);ctx.stroke();
    // Cross bars
    ctx.strokeStyle='rgba(200,200,200,.3)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(s.x-4,s.y-20);ctx.lineTo(s.x+4,s.y-20);ctx.stroke();
    ctx.beginPath();ctx.moveTo(s.x-3,s.y-30);ctx.lineTo(s.x+3,s.y-30);ctx.stroke();
    // Antenna top with glow
    ctx.fillStyle=tt.color;ctx.beginPath();ctx.arc(s.x,s.y-h-2,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=tt.color+'44';ctx.beginPath();ctx.arc(s.x,s.y-h-2,8,0,Math.PI*2);ctx.fill();
    // Signal waves (animated)
    const pulse=(Math.sin(Date.now()/400)*.3+.7);
    const alpha=Math.round(pulse*80).toString(16).padStart(2,'0');
    ctx.strokeStyle=tt.color+alpha;ctx.lineWidth=1;
    for(let r=1;r<=3;r++){
      ctx.beginPath();ctx.arc(s.x,s.y-h-2,5+r*5,-.8,-.2);ctx.stroke();
      ctx.beginPath();ctx.arc(s.x,s.y-h-2,5+r*5,Math.PI+.2,Math.PI+.8);ctx.stroke();
    }
  }
  // Label
  ctx.font='bold 7px sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(tt.name,s.x,s.y-h-(isSmall?14:14));
}

function drawWiFiAP(x,y,ap){
  const wt=WIFI_T[ap.type];if(!wt)return;
  const s=toScr(x,y);
  // Small pole
  ctx.strokeStyle='#888';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x,s.y-18);ctx.stroke();
  // Antenna
  ctx.fillStyle=wt.color;ctx.beginPath();ctx.arc(s.x,s.y-20,3.5,0,Math.PI*2);ctx.fill();
  // Signal pulse
  const pulse=Math.sin(Date.now()/500+x)*.3+.7;
  ctx.strokeStyle=wt.color+Math.round(pulse*60).toString(16).padStart(2,'0');
  ctx.lineWidth=.8;
  for(let r=1;r<=2;r++){ctx.beginPath();ctx.arc(s.x,s.y-20,3.5+r*3,-1,-.3);ctx.stroke();ctx.beginPath();ctx.arc(s.x,s.y-20,3.5+r*3,Math.PI+.3,Math.PI+1);ctx.stroke();}
}

// ====== JUNCTION / FIELD LOAD-BALANCER ======
function drawJunction(x,y,j){
  const jt=(typeof JUNCTION_T!=='undefined')?JUNCTION_T[j.type]:null;
  if(!jt)return;
  const s=toScr(x,y);
  const isLB=j.type==='junction_lb';
  const active=j.active!==false;
  const col=jt.color||(isLB?'#a78bfa':'#38bdf8');
  // small iso cabinet sitting on the road tile — footprint 14×14 with 4px height
  const bw=13,bd=13,bh=5;
  // base (left + right faces)
  ctx.beginPath();
  ctx.moveTo(s.x-bw,s.y);
  ctx.lineTo(s.x,s.y+bd/2);
  ctx.lineTo(s.x,s.y+bd/2+bh);
  ctx.lineTo(s.x-bw,s.y+bh);
  ctx.closePath();
  ctx.fillStyle=shade(col,-40);ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s.x,s.y+bd/2);
  ctx.lineTo(s.x+bw,s.y);
  ctx.lineTo(s.x+bw,s.y+bh);
  ctx.lineTo(s.x,s.y+bd/2+bh);
  ctx.closePath();
  ctx.fillStyle=shade(col,-25);ctx.fill();
  // top
  ctx.beginPath();
  ctx.moveTo(s.x,s.y-bd/2);
  ctx.lineTo(s.x+bw,s.y);
  ctx.lineTo(s.x,s.y+bd/2);
  ctx.lineTo(s.x-bw,s.y);
  ctx.closePath();
  ctx.fillStyle=shade(col,-10);ctx.fill();
  ctx.strokeStyle=shade(col,15);ctx.lineWidth=.6;ctx.stroke();
  // LED dot (green when active-lb, blue when passive, red if disabled)
  if(active){
    const pulse=Math.sin(Date.now()/(isLB?320:900)+x+y)*.5+.5;
    const ledClr=isLB?`rgba(80,255,140,${.6+pulse*.4})`:`rgba(120,190,255,${.5+pulse*.3})`;
    ctx.fillStyle=ledClr;
    ctx.beginPath();ctx.arc(s.x,s.y-2,1.8,0,Math.PI*2);ctx.fill();
  } else {
    ctx.fillStyle='rgba(200,80,80,.8)';
    ctx.beginPath();ctx.arc(s.x,s.y-2,1.8,0,Math.PI*2);ctx.fill();
  }
  // icon above
  ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(s.x-7,s.y-13,14,10);
  ctx.fillStyle=col;ctx.fillText(jt.icon,s.x,s.y-8);
  ctx.textBaseline='alphabetic';
  // active-LB: arrows showing redistribution
  if(isLB&&active){
    const t=(Date.now()/500)%1;
    ctx.fillStyle=`rgba(167,139,250,${.8-t*.8})`;
    ctx.beginPath();ctx.arc(s.x-bw-2-t*4,s.y+1,1.3,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(s.x+bw+2+t*4,s.y+1,1.3,0,Math.PI*2);ctx.fill();
  }
}

function renderMM(){
  const w=mmC.width,h=mmC.height;mmX.fillStyle='#080c12';mmX.fillRect(0,0,w,h);
  const sc=Math.min(w/MAP,h/MAP),ox=(w-MAP*sc)/2,oy=(h-MAP*sc)/2;
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){const t=G.map[y][x];
    if(t.type==='road')mmX.fillStyle='#4a535e';
    else if(t.type==='water')mmX.fillStyle='#1a4070';
    else if(t.type==='park')mmX.fillStyle='#265a28';
    else if(t.bld)mmX.fillStyle=t.bld.connected?'#3fb950':BTYPES[t.bld.type].clr+'88';
    else mmX.fillStyle='#152215';
    mmX.fillRect(ox+x*sc,oy+y*sc,Math.ceil(sc),Math.ceil(sc));}
  for(const dc of G.dcs){mmX.fillStyle=DC_T[dc.type].color;mmX.fillRect(ox+dc.x*sc-1,oy+dc.y*sc-1,sc+2,sc+2);}
  const mmSegs={};
  for(const cb of G.cables){const sk=segKey(cb.x1,cb.y1,cb.x2,cb.y2);
    if(!mmSegs[sk])mmSegs[sk]={x1:cb.x1,y1:cb.y1,x2:cb.x2,y2:cb.y2,count:0,bestTier:-1,bestType:cb.t};
    mmSegs[sk].count++;const tier=CAB_T[cb.t]?.tier||0;if(tier>mmSegs[sk].bestTier){mmSegs[sk].bestTier=tier;mmSegs[sk].bestType=cb.t;}}
  for(const sk in mmSegs){const ms=mmSegs[sk],load=segLoads[sk];
    mmX.strokeStyle=load&&load.ratio>.95?'#ef4444':load&&load.ratio>.7?'#f59e0b':CAB_T[ms.bestType].clr;
    mmX.lineWidth=Math.min(3,1+Math.log2(ms.count)*0.5);mmX.beginPath();mmX.moveTo(ox+ms.x1*sc+sc/2,oy+ms.y1*sc+sc/2);mmX.lineTo(ox+ms.x2*sc+sc/2,oy+ms.y2*sc+sc/2);mmX.stroke();}
}
