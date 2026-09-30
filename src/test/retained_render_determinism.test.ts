import { expect, it } from 'vitest';
import { Graphics } from 'pixi.js';
import { createHeadlessGame } from './harness';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { displayRandom } from '../engine/Lighting/CosmeticLight';
import { terrainRandomValues } from '../engine/UI/DancingColors';
import { cellAppearance } from '../engine/UI/Appearance';
import { terrainSemantic } from '../ui/mapTileSemantics';
import { paintVectorTile } from '../ui/vectorAtlas';
import { VectorGeometryCache, RetainedVectorLayer } from '../ui/retainedMapDrawing';
import { RenderRequests } from '../ui/renderRequests';
import { DCOLS, DROWS } from '../types';

it('same seed and 60 real commands keep identical recordings/world/RNG with extra direct or coalesced vector draws',()=>{
 const run=(retained:boolean)=>{
  const game=createHeadlessGame(27027),cache=new VectorGeometryCache(),layer=new RetainedVectorLayer(cache),old=new Graphics(),requests=new RenderRequests();
  let draws=0,nonturn=0;
  const draw=()=>{
   draws++;old.clear();layer.clear();
   const random=displayRandom(game.grid),cosmetic={percent:(p:number)=>random.randPercent(p),pick:<T>(v:readonly T[])=>v[random.randRange(0,v.length-1)]!};
   for(let x=0;x<DCOLS;x++)for(let y=0;y<DROWS;y++){
    const cell=game.grid.getCell(x,y)!;
    const visual=cellAppearance(cell,{gas:game.environment.gasGrid[x]?.[y],lightChannels:game.lightMap.lightAt(x,y),dancingLightChannels:game.lightMap.renderLightAt(x,y),terrainRandomValues:terrainRandomValues(cell,game.grid),flareChannels:game.flareLightAt(x,y),flashChannels:game.terrainFlashAt(x,y),depth:game.depth,groundItem:null,carriedItem:null,hallucinating:true,cosmetic});
    if(visual)paintVectorTile(retained?layer:old,terrainSemantic(cell,visual,true),visual.color,x,y,16);
   }
   layer.finish();
  };
  game.onRenderRequested=retained?requests.request:draw;
  const checkpoints=[];
  for(let i=0;i<60&&!game.isGameOver;i++){
   while(logger.pendingAcknowledgment)logger.acknowledgeNext();
   const before=game.absoluteTurnNumber;
   game.executeCommand(game.isAutoTraveling()?'auto_step':nonturn>=2?'wait':'auto_explore');game.update();
   // Animation and update can both request the same presented frame.
   for(let j=0;j<3;j++)if(retained)requests.request();else draw();
   if(retained)requests.flush(draw);
   nonturn=before===game.absoluteTurnNumber?nonturn+1:0;
   checkpoints.push({turn:game.absoluteTurnNumber,player:{...game.player.loc},hp:game.player.hp,nutrition:game.player.nutrition,rng:rng.getState(),monsters:game.monsters.map(m=>[m.typeId,m.loc.x,m.loc.y,m.hp])});
  }
  const events=game.exportRecording().events;
  const cells=[];for(let x=0;x<DCOLS;x++)for(let y=0;y<DROWS;y++){const c=game.grid.getCell(x,y)!;cells.push([c.layers,c.rememberedLayers,c.isVisible,c.hasMemory]);}
  game.onRenderRequested=null;old.destroy();layer.destroy({children:true,context:false});cache.destroy();
  return {draws,events,checkpoints,cells};
 };
 const baseline=run(false),optimized=run(true);
 expect(optimized.events).toHaveLength(60);
 expect(optimized.events).toEqual(baseline.events);expect(optimized.checkpoints).toEqual(baseline.checkpoints);expect(optimized.cells).toEqual(baseline.cells);
 expect(optimized.draws).toBe(60);expect(baseline.draws).toBeGreaterThan(optimized.draws*3);
});
