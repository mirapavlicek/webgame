// ====== MAP ======
function genMap(){
  const m=Array.from({length:MAP},()=>Array.from({length:MAP},()=>({type:'grass',bld:null,variant:0})));
  const main=[4,10,16,22,28,35],minor=[7,13,19,25,31];
  for(const s of main){if(s<MAP)for(let i=0;i<MAP;i++){m[s][i].type='road';m[i][s].type='road';}}
  for(const s of minor){if(s<MAP)for(let i=0;i<MAP;i++){if(Math.random()<.06)continue;m[s][i].type='road';m[i][s].type='road';}}

  // Generate water features (small lakes/rivers) using noise-like blobs
  const waterSeeds=[];
  for(let i=0;i<4;i++)waterSeeds.push({x:3+Math.floor(Math.random()*(MAP-6)),y:3+Math.floor(Math.random()*(MAP-6)),r:2+Math.random()*3});
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    if(m[y][x].type==='road')continue;
    for(const ws of waterSeeds){
      const dist=Math.sqrt((x-ws.x)**2+(y-ws.y)**2);
      if(dist<ws.r+(Math.sin(x*1.3+y*.7)*.8)){m[y][x].type='water';break;}
    }
  }

  // Generate parks (small green areas near center)
  const parkSeeds=[];
  for(let i=0;i<5;i++)parkSeeds.push({x:5+Math.floor(Math.random()*(MAP-10)),y:5+Math.floor(Math.random()*(MAP-10)),r:1.5+Math.random()*2});
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    if(m[y][x].type!=='grass')continue;
    for(const ps of parkSeeds){
      const dist=Math.sqrt((x-ps.x)**2+(y-ps.y)**2);
      if(dist<ps.r){m[y][x].type='park';break;}
    }
  }

  // Assign grass tile variants for visual variety (0-3)
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    if(m[y][x].type==='grass')m[y][x].variant=Math.floor(Math.random()*4);
  }

  // Place buildings
  for(let y=0;y<MAP;y++)for(let x=0;x<MAP;x++){
    if(m[y][x].type!=='grass')continue;
    if(!nb(x,y).some(([ax,ay])=>ax>=0&&ax<MAP&&ay>=0&&ay<MAP&&m[ay][ax].type==='road'))continue;
    if(Math.random()>.52)continue;
    const dc=Math.sqrt((x-MAP/2)**2+(y-MAP/2)**2);let bt;
    if(dc<5){const r=Math.random();bt=r<.35?'skyscraper':r<.55?'bigcorp':r<.75?'panel':'public';}
    else if(dc<10){const r=Math.random();bt=r<.25?'panel':r<.4?'bigcorp':r<.55?'shop':r<.7?'public':r<.85?'factory':'skyscraper';}
    else if(dc<16){const r=Math.random();bt=r<.25?'house':r<.40?'rowhouse':r<.55?'panel':r<.70?'shop':r<.85?'factory':'public';}
    else{const r=Math.random();bt=r<.40?'house':r<.60?'rowhouse':r<.72?'panel':r<.82?'shop':r<.92?'factory':'public';}
    const b=BTYPES[bt],units=b.units[0]+Math.floor(Math.random()*(b.units[1]-b.units[0]+1));
    const pop=b.pop[0]+Math.floor(Math.random()*(b.pop[1]-b.pop[0]+1));
    m[y][x].bld={type:bt,units,pop,maxPop:Math.round(pop*1.5),connected:false,connType:null,customers:0,sat:0,tariff:null,want:Math.random()<b.demand,dcIdx:-1,svcSubs:{}};
  }
  return m;
}

function nb(x,y){return[[x-1,y],[x+1,y],[x,y-1],[x,y+1]];}

function isRoad(x,y){return x>=0&&x<MAP&&y>=0&&y<MAP&&G.map[y][x].type==='road';}

function bfsPath(sx,sy,tx,ty){
  const v=new Map(),q=[[sx,sy]];v.set(sx+','+sy,null);
  while(q.length){
    const[cx,cy]=q.shift();
    if(cx===tx&&cy===ty){const path=[];let cur=[cx,cy];while(cur){path.unshift(cur);cur=v.get(cur[0]+','+cur[1]);}return path;}
    for(const cb of G.cables){let nx,ny;
      if(cb.x1===cx&&cb.y1===cy){nx=cb.x2;ny=cb.y2;}
      else if(cb.x2===cx&&cb.y2===cy){nx=cb.x1;ny=cb.y1;}else continue;
      const k=nx+','+ny;if(!v.has(k)){v.set(k,[cx,cy]);q.push([nx,ny]);}}
  }
  return null;
}

function bfs(sx,sy,tx,ty){
  const v=new Set(),q=[[sx,sy]];v.add(sx+','+sy);
  while(q.length){const[cx,cy]=q.shift();if(cx===tx&&cy===ty)return true;
    for(const cb of G.cables){let nx,ny;if(cb.x1===cx&&cb.y1===cy){nx=cb.x2;ny=cb.y2;}else if(cb.x2===cx&&cb.y2===cy){nx=cb.x1;ny=cb.y1;}else continue;
      const k=nx+','+ny;if(!v.has(k)){v.add(k);q.push([nx,ny]);}}}return false;
}

function segKey(x1,y1,x2,y2){
  const ax=Math.min(x1,x2),ay=Math.min(y1,y2),bx=Math.max(x1,x2),by=Math.max(y1,y2);
  if(x1===x2)return`${ax},${Math.min(y1,y2)},${ax},${Math.max(y1,y2)}`;
  return`${ax},${ay},${bx},${by}`;
}

function pathSegs(x1,y1,x2,y2){const s=[];let cx=x1,cy=y1;while(cx!==x2||cy!==y2){let nx=cx,ny=cy;if(cx<x2)nx++;else if(cx>x2)nx--;else if(cy<y2)ny++;else ny--;s.push({x1:cx,y1:cy,x2:nx,y2:ny});cx=nx;cy=ny;}return s;}
