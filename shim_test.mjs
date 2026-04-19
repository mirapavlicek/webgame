globalThis.window = globalThis;
globalThis.document = {
  addEventListener(){}, getElementById(){return null;},
  createElement(){return{style:{},append(){},appendChild(){},addEventListener(){},setAttribute(){},classList:{add(){},remove(){},toggle(){}}};},
  querySelectorAll(){return [];}, body:{className:'',append(){}}, readyState:'complete',
};
globalThis.performance={now:()=>Date.now()};
globalThis.requestAnimationFrame=()=>0;
globalThis.HTMLCanvasElement=class{};
globalThis.PIXI=null;
import('./src/main.js').then(()=>console.log('graph: OK')).catch(e=>{console.error('IMPORT FAIL:',e.message);process.exit(1);});
