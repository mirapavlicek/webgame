// ====== WebGL FX LAYER (PixiJS overlay) ======
// This layer sits BEHIND the Canvas 2D game and provides:
//   • Sky gradient with day/night transitions
//   • Bloom glow for congested cables and DC halos
//   • GPU-batched particle system for data flow
//   • Smooth camera interpolation (lerp)
// If PixiJS fails to load, the base Canvas 2D rendering still works unchanged.

let _pixiApp=null;
let _pixiLayerBg=null;      // background (sky gradient, grid)
let _pixiLayerGlow=null;    // glow/bloom (behind entities)
let _pixiLayerFx=null;      // particles (in front)
let _pixiReady=false;
let _pixiEnabled=true;       // can toggle off via settings
let _pixiSkyEnabled=false;   // sky covered by gameCanvas in overlay mode — off by default
let _pixiSky=null;
let _pixiGlowGfx=null;
let _pixiParticles=[];
const _PIXI_MAX_PARTICLES=300;

// Smooth camera state
let _camSmooth={x:0,y:0,zoom:1,init:false};
const CAM_LERP=0.18;

function initPixiFx(){
  if(!_pixiEnabled)return;
  if(typeof PIXI==='undefined'){
    console.warn('[pixi-fx] PIXI not loaded — WebGL effects disabled');
    return;
  }
  try{
    const canvas=document.getElementById('pixiCanvas');
    if(!canvas)return;

    _pixiApp=new PIXI.Application({
      view:canvas,
      resizeTo:document.getElementById('canvasArea'),
      backgroundAlpha:0,
      antialias:true,
      powerPreference:'high-performance',
    });

    _pixiLayerBg=new PIXI.Container();
    _pixiLayerGlow=new PIXI.Container();
    _pixiLayerFx=new PIXI.Container();
    // BG layer (sky) disabled by default in overlay mode — pixiCanvas sits OVER gameCanvas
    // and the sky would cover the game. Set _pixiSkyEnabled=true to enable.
    _pixiApp.stage.addChild(_pixiLayerBg);
    _pixiApp.stage.addChild(_pixiLayerGlow);
    _pixiApp.stage.addChild(_pixiLayerFx);

    // Sky gradient sprite — filled dynamically in render loop (only if enabled)
    _pixiSky=new PIXI.Graphics();
    _pixiLayerBg.addChild(_pixiSky);
    _pixiLayerBg.visible=!!_pixiSkyEnabled;

    // Glow graphics object (redrawn each frame)
    _pixiGlowGfx=new PIXI.Graphics();
    _pixiLayerGlow.addChild(_pixiGlowGfx);

    // Apply bloom filter to glow layer if pixi-filters is available — try several known names
    let bloom=null;
    try{
      if(typeof PIXI.filters!=='undefined'){
        if(PIXI.filters.AdvancedBloomFilter)bloom=new PIXI.filters.AdvancedBloomFilter({threshold:0.4,bloomScale:1.4,brightness:1.1,blur:6,quality:4});
        else if(PIXI.filters.BloomFilter)bloom=new PIXI.filters.BloomFilter({blur:6,quality:4});
      }
    }catch(e){bloom=null;}
    // Fallback: use built-in blur filter for a soft glow
    _pixiLayerGlow.filters=[bloom||new PIXI.BlurFilter(5,3)];

    _pixiReady=true;
    console.log('[pixi-fx] initialized — WebGL effects active');
  }catch(e){
    console.warn('[pixi-fx] init failed:',e);
    _pixiReady=false;
  }
}

function pixiTogglable(){
  _pixiEnabled=!_pixiEnabled;
  const canvas=document.getElementById('pixiCanvas');
  if(canvas)canvas.style.display=_pixiEnabled?'block':'none';
  if(typeof notify==='function')notify(_pixiEnabled?'✨ WebGL efekty ZAPNUTY':'🚫 WebGL efekty VYPNUTY',_pixiEnabled?'good':'warn');
}

// Smooth camera update — called from main game loop
function updateSmoothCamera(){
  if(typeof cam==='undefined')return;
  if(!_camSmooth.init){
    _camSmooth.x=cam.x;_camSmooth.y=cam.y;_camSmooth.zoom=cam.zoom;_camSmooth.init=true;
    return;
  }
  _camSmooth.x+=(cam.x-_camSmooth.x)*CAM_LERP;
  _camSmooth.y+=(cam.y-_camSmooth.y)*CAM_LERP;
  _camSmooth.zoom+=(cam.zoom-_camSmooth.zoom)*CAM_LERP;
}

// Render the WebGL layer — called from render() after Canvas 2D draw
function renderPixiFx(){
  if(!_pixiReady||!_pixiEnabled||!G)return;
  try{
    updateSmoothCamera();

    // ====== SKY GRADIENT ======
    if(_pixiSkyEnabled)drawPixiSky();

    // ====== GLOW OVERLAYS ======
    _pixiGlowGfx.clear();
    // Apply current camera transform to glow layer for alignment
    _pixiLayerGlow.position.set(cam.x,cam.y);
    _pixiLayerGlow.scale.set(cam.zoom,cam.zoom);
    _pixiLayerFx.position.set(cam.x,cam.y);
    _pixiLayerFx.scale.set(cam.zoom,cam.zoom);

    // Congested cable glow
    if(typeof segLoads!=='undefined'&&typeof CAB_T!=='undefined'&&G.cables){
      const segGroups={};
      for(const cb of G.cables){
        const sk=segKey(cb.x1,cb.y1,cb.x2,cb.y2);
        if(!segGroups[sk])segGroups[sk]={x1:cb.x1,y1:cb.y1,x2:cb.x2,y2:cb.y2,bestTier:-1,bestType:null};
        const tier=CAB_T[cb.t]?.tier||0;
        if(tier>segGroups[sk].bestTier){segGroups[sk].bestTier=tier;segGroups[sk].bestType=cb.t;}
      }
      for(const sk in segGroups){
        const sg=segGroups[sk];
        const load=segLoads[sk];
        if(!load||load.ratio<0.65)continue;
        const s1=toIso(sg.x1,sg.y1),s2=toIso(sg.x2,sg.y2);
        const color=load.ratio>0.95?0xff3030:load.ratio>0.8?0xf59e0b:0xfbbf24;
        const alpha=Math.min(0.55,load.ratio*0.6);
        _pixiGlowGfx.lineStyle({width:8,color,alpha,cap:'round'});
        _pixiGlowGfx.moveTo(s1.x,s1.y).lineTo(s2.x,s2.y);
      }
    }

    // DC halos — brighter for busier DCs, pulsing red for outages
    if(G.dcs){
      const now=Date.now();
      const pulse=Math.sin(now/500)*0.25+0.75;
      for(let i=0;i<G.dcs.length;i++){
        const dc=G.dcs[i];const dcL=(typeof dcLoads!=='undefined'?dcLoads[i]:null);
        const p=toIso(dc.x,dc.y);
        const isOut=dc.outage&&dc.outage.active;
        if(isOut){
          const pulseOut=Math.sin(now/200)*0.4+0.6;
          _pixiGlowGfx.beginFill(0xff2020,pulseOut*0.4);
          _pixiGlowGfx.drawCircle(p.x,p.y-10,36);
          _pixiGlowGfx.endFill();
        } else if(dcL&&dcL.ratio>0.5){
          const c=dcL.ratio>0.9?0xef4444:dcL.ratio>0.7?0xf59e0b:0x7c3aed;
          _pixiGlowGfx.beginFill(c,pulse*0.22*Math.min(1,dcL.ratio));
          _pixiGlowGfx.drawCircle(p.x,p.y-10,28);
          _pixiGlowGfx.endFill();
        } else {
          // Soft idle halo on active DCs
          if((dc.eq||[]).length>0){
            _pixiGlowGfx.beginFill(0x7c3aed,pulse*0.1);
            _pixiGlowGfx.drawCircle(p.x,p.y-10,22);
            _pixiGlowGfx.endFill();
          }
        }
      }
    }

    // Tower beams — subtle glow around towers
    if(G.towers&&typeof TOWER_T!=='undefined'){
      for(const tw of G.towers){
        const tt=TOWER_T[tw.type];if(!tt)continue;
        const p=toIso(tw.x,tw.y);
        const pulseT=Math.sin(Date.now()/700+tw.x*0.3+tw.y*0.7)*0.3+0.7;
        // Parse hex color from string
        const col=tt.color?parseInt(tt.color.replace('#',''),16):0x00d4ff;
        _pixiGlowGfx.beginFill(col,pulseT*0.12);
        _pixiGlowGfx.drawCircle(p.x,p.y-30,14);
        _pixiGlowGfx.endFill();
      }
    }

    // WiFi AP glow
    if(G.wifiAPs&&typeof WIFI_T!=='undefined'){
      for(const ap of G.wifiAPs){
        const wt=WIFI_T[ap.type];if(!wt)continue;
        const p=toIso(ap.x,ap.y);
        const col=wt.color?parseInt(wt.color.replace('#',''),16):0x00d4ff;
        const pulseW=Math.sin(Date.now()/450+ap.x)*0.25+0.75;
        _pixiGlowGfx.beginFill(col,pulseW*0.08);
        _pixiGlowGfx.drawCircle(p.x,p.y-18,10);
        _pixiGlowGfx.endFill();
      }
    }

    // ====== DATA FLOW PARTICLES (WebGL batched) ======
    updatePixiParticles();
  }catch(e){
    // Silently swallow render errors so game keeps running
    console.warn('[pixi-fx] render error:',e);
  }
}

// Draw sky gradient that respects time of day
function drawPixiSky(){
  if(!_pixiSky||!_pixiApp)return;
  _pixiSky.clear();
  const w=_pixiApp.screen.width,h=_pixiApp.screen.height;
  // Get time-of-day color
  const hour=(G.date.d-1)/30*24;
  let topColor,botColor;
  if(hour<5||hour>=21){ // deep night
    topColor=0x030614;botColor=0x0a1028;
  } else if(hour<7){ // dawn
    const t=(hour-5)/2;
    topColor=lerpColor(0x030614,0x1a2048,t);
    botColor=lerpColor(0x0a1028,0xff7a45,t);
  } else if(hour<17){ // day
    topColor=0x0a1a2f;botColor=0x142030;
  } else if(hour<19){ // dusk
    const t=(hour-17)/2;
    topColor=lerpColor(0x0a1a2f,0x2a1040,t);
    botColor=lerpColor(0x142030,0xf59e0b,t);
  } else { // late dusk
    const t=(hour-19)/2;
    topColor=lerpColor(0x2a1040,0x030614,t);
    botColor=lerpColor(0xf59e0b,0x0a1028,t);
  }
  // Simple vertical gradient using quads
  const steps=12;
  for(let i=0;i<steps;i++){
    const t=i/(steps-1);
    const c=lerpColor(topColor,botColor,t);
    _pixiSky.beginFill(c,0.85);
    _pixiSky.drawRect(0,i*(h/steps),w,h/steps+1);
    _pixiSky.endFill();
  }
}

function lerpColor(a,b,t){
  const ar=(a>>16)&0xff,ag=(a>>8)&0xff,ab=a&0xff;
  const br=(b>>16)&0xff,bg=(b>>8)&0xff,bb=b&0xff;
  const r=Math.round(ar+(br-ar)*t);
  const g=Math.round(ag+(bg-ag)*t);
  const bl=Math.round(ab+(bb-ab)*t);
  return(r<<16)|(g<<8)|bl;
}

// ====== PARTICLE SYSTEM (batched) ======
function updatePixiParticles(){
  if(!_pixiLayerFx||!G||!G.cables||typeof segLoads==='undefined')return;

  // Spawn new particles on congested/active segments
  if(_pixiParticles.length<_PIXI_MAX_PARTICLES&&Math.random()<0.6){
    const segs=Object.keys(segLoads);
    if(segs.length>0){
      const sk=segs[Math.floor(Math.random()*segs.length)];
      const load=segLoads[sk];
      if(load&&load.ratio>0.04){
        const parts=sk.split(',').map(Number);
        const s1=toIso(parts[0],parts[1]),s2=toIso(parts[2],parts[3]);
        const dot=new PIXI.Graphics();
        const col=load.ratio>0.9?0xff3030:load.ratio>0.6?0xf59e0b:load.ratio>0.3?0x3fb950:0x00d4ff;
        dot.beginFill(col,0.9);
        dot.drawCircle(0,0,2.2);
        dot.endFill();
        // Soft glow halo
        dot.beginFill(col,0.25);
        dot.drawCircle(0,0,5);
        dot.endFill();
        dot.x=s1.x;dot.y=s1.y;
        _pixiLayerFx.addChild(dot);
        _pixiParticles.push({sprite:dot,x1:s1.x,y1:s1.y,x2:s2.x,y2:s2.y,t:0,speed:0.008+load.ratio*0.018,life:1});
      }
    }
  }

  // Update existing particles
  for(let i=_pixiParticles.length-1;i>=0;i--){
    const p=_pixiParticles[i];
    p.t+=p.speed;
    if(p.t>=1){
      p.t=0;p.life-=0.33;
      if(p.life<=0){
        _pixiLayerFx.removeChild(p.sprite);
        p.sprite.destroy();
        _pixiParticles.splice(i,1);
        continue;
      }
    }
    p.sprite.x=p.x1+(p.x2-p.x1)*p.t;
    p.sprite.y=p.y1+(p.y2-p.y1)*p.t;
    p.sprite.alpha=p.life;
  }
}
