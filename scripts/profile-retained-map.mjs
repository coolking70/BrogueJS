/** Opt-in CPU benchmark; no browser, GPU timing, game writes, or external traffic.
 * node scripts/profile-retained-map.mjs [/tmp/brogue-map-profile.json]
 * Compares the v7 painter + actual Pixi tessellation with retained geometry.
 * Repeated, changing-color frames include initialization separately and report
 * median/p95/max, not just an average. Synthetic visible/memory tile mixes are
 * 320 (small), 1200 (explored), and 3713 (oversized stress (actual map: 79×29=2291)); not Android FPS. */
import { writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { Graphics } from 'pixi.js';
import { buildContextBatches } from '../node_modules/pixi.js/lib/scene/graphics/shared/utils/buildContextBatches.mjs';
import { GpuGraphicsContext } from '../node_modules/pixi.js/lib/scene/graphics/shared/GraphicsContextSystem.mjs';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try {
 const {paintVectorTile}=await server.ssrLoadModule('/src/ui/vectorAtlas.ts');
 const {RetainedVectorLayer,RetainedBackgroundLayer,VectorGeometryCache}=await server.ssrLoadModule('/src/ui/retainedMapDrawing.ts');
 const kinds=['墙','地','地','地','墙','水','草','地','门','深','渊','地'];
 const values=kinds.map(hanzi=>({id:'sample',hanzi,kind:'terrain',original:'.'}));
 const summary=a=>{const b=[...a].sort((x,y)=>x-y);return {n:b.length,median:+b[Math.floor(b.length*.5)].toFixed(3),p95:+b[Math.floor(b.length*.95)].toFixed(3),max:+b.at(-1).toFixed(3),over16:a.filter(x=>x>16.67).length}};
 const results=[];
 for(const count of [320,1200,3713])for(const mode of ['v7-retessellated','retained']){
  const frames=count===3713?210:630;
  const g=new Graphics(),gpu=new GpuGraphicsContext(),cache=new VectorGeometryCache(),background=new RetainedBackgroundLayer(),retained=new RetainedVectorLayer(cache,background);
  const gpuContexts=new Map(),paint=[],tess=[],total=[];let coldMs=0,rebuilds=0;
  for(let frame=0;frame<frames;frame++){
   const start=performance.now();g.clear();retained.clear();background.clear();
   for(let i=0;i<count;i++){
    const color=0x808080+(frame%31)*0x010101,x=i%79,y=Math.floor(i/79);
    if(mode==='v7-retessellated')g.rect(x*16,y*16,16,16).fill(color>>1);
    else background.paint(color>>1,x,y,16);
    paintVectorTile(mode==='v7-retessellated'?g:retained,values[i%values.length],color,x,y,16);
   }
   retained.finish();background.finish();background.sortChildren();const middle=performance.now();
   if(mode==='v7-retessellated'){gpu.reset();buildContextBatches(g.context,gpu);rebuilds++;}
   else for(const sprite of background.children.filter(s=>s.renderPipeId==='graphics')){
    if(!gpuContexts.has(sprite.context)){const data=new GpuGraphicsContext();buildContextBatches(sprite.context,data);gpuContexts.set(sprite.context,data);rebuilds++;}
   }
   const end=performance.now();if(frame===0)coldMs=end-start;
   if(frame>=30){paint.push(middle-start);tess.push(end-middle);total.push(end-start);}
  }
  results.push({mode,count,frames:frames-30,coldMs:+coldMs.toFixed(3),paint:summary(paint),tessellation:summary(tess),total:summary(total),geometryContexts:cache.size,tessellations:rebuilds});
  gpu.destroy();g.destroy();for(const data of gpuContexts.values())data.destroy();
  retained.destroy({children:true,context:false});background.destroy({children:true,texture:false});cache.destroy();
 }
 const result={runtime:process.version,method:'Synthetic repeated color-changing frames. CPU construction + actual Pixi triangulation; excludes browser layout, GPU upload/draw, and engine work.',results};
 const output=process.argv[2]??'/tmp/brogue-map-profile.json';await writeFile(output,JSON.stringify(result,null,2));process.stdout.write(JSON.stringify(result,null,2)+'\n');
} finally {await server.close();}
