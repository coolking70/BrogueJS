/** Pure grid A* benchmark. No Game import, dungeon generation, browser or RNG. */
import { createServer } from 'vite';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
const server = await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
try {
 const {Pathfind}=await server.ssrLoadModule('/src/engine/Map/Pathfind.ts');
 const {LegacyPathfind}=await server.ssrLoadModule('/src/test/support/legacyPathfind.ts');
 const width=79,height=29;
 const grid={isValidPos:(x,y)=>x>=0&&y>=0&&x<width&&y<height};
 const scenarios=[
  {name:'open-diagonal',start:[2,2],goal:[75,25],pass:()=>true},
  {name:'unreachable-barrier',start:[2,14],goal:[75,14],pass:(x)=>x!==40},
  {name:'alternating-gaps',start:[2,2],goal:[75,25],pass:(x,y)=>x%8!==0||y===(x%16===0?2:26)},
  {name:'short-neighbor',start:[20,14],goal:[21,14],pass:()=>true},
 ];
 const iterations=Number(process.env.UX1_PATH_ITERATIONS||8), batches=9;
 const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);return {median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted.at(-1)};};
 const result=[];
 for(const scene of scenarios){
  const run=(Finder,trace=false)=>{let calls=0;const path=Finder.findPath(grid,...scene.start,...scene.goal,(x,y)=>{if(trace)calls++;return scene.pass(x,y);});return {path,calls};};
  assert.deepEqual(run(Pathfind,true),run(LegacyPathfind,true));
  for(let i=0;i<4;i++){run(Pathfind);run(LegacyPathfind);}
  const old=[],current=[];
  for(let sample=0;sample<batches;sample++){
   for(const [Finder,out] of sample%2?[[Pathfind,current],[LegacyPathfind,old]]:[[LegacyPathfind,old],[Pathfind,current]]){
    const t=performance.now();for(let i=0;i<iterations;i++)run(Finder);out.push((performance.now()-t)/iterations);
   }
  }
  const legacyMs=stats(old),currentMs=stats(current);
  result.push({name:scene.name,grid:[width,height],iterations,batches,passCalls:run(Pathfind,true).calls,pathLength:run(Pathfind).path?.length??null,legacyMs,currentMs,medianSpeedup:legacyMs.median/currentMs.median});
 }
 console.log(JSON.stringify({runtime:process.version,purpose:'controlled pure-grid microbenchmark, not natural depth-4 reproduction',result},null,2));
}finally{await server.close();}
