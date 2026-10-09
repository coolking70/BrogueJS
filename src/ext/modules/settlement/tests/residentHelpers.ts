import { expect } from 'vitest';
import { setup, establish, current, build, base } from './helpers';
import { residentBedIds } from '../../../../engine/Core/ResidentWorld';
import { bindWorldStructures } from '../../../../engine/Map/StructureWorld';
import type { Game } from '../../../../engine/Core/Game';
import type { WorldHarness } from '../../../worldSdk';
// Save-origin preparation. Actors and native inventory are retained. Every
// structure is paid through the real production command; this is not a natural route.
export function bedroom(h: WorldHarness, g: Game) {
  expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  const home=g.extensionRuntime!.worldCampState('settlement').camps.find(c=>c.depth===g.depth)!;
  const localBuild=(name:string,at:{x:number;y:number})=>{const payload=build(g,name,at),region=g.extensionRuntime!.worldStructureRegions().find(r=>r.id===home.regionId)!;return {...payload,regionId:region.id,regionRevision:region.revision};};
  for (let y = 12; y <= 16; y++) for (let x = 17; x <= 21; x++) {
    const edge = x === 17 || x === 21 || y === 12 || y === 16;
    // Room detection uses cardinal enclosure; corners need no fake marker roof.
    if (edge && (x === 17 || x === 21) && (y === 12 || y === 16)) continue;
    g.player.loc = edge ? y === 12 ? {x,y:13} : y === 16 ? {x,y:15}
      : x === 17 ? {x:18,y} : {x:20,y} : {x:x===19?18:19,y};
    g.refreshStructureDerivedState();
    expect(h.ext('settlement', 'build', localBuild(
      edge ? x === 19 && y === 12 ? 'door' : 'wood-wall' : 'roof', {x,y})).error).toBeNull();
  }
  g.player.loc = { x: 19, y: 13 };
  expect(h.ext('settlement', 'build', localBuild('bed', { x: 18, y: 13 })).error).toBeNull();
  const door = g.world5!.structures.find(s=>s.levelRef.kind==='dungeon'&&s.levelRef.depth===g.depth&&s.at.x===19&&s.at.y===12)!.barrier!;
  const state = g.extensionRuntime!.worldCampState('settlement');
  expect(h.ext('settlement','door',{v:1,stateRevision:state.revision,inventoryStamp:base(g).inventoryStamp,
    componentId:door.id,componentRevision:door.revision,open:true}).error).toBeNull();
  bindWorldStructures(g);
  expect(residentBedIds(g, home)).toHaveLength(1);
}

export function residentScene(modules=["settlement"], raids=false){
 const {h,g}=setup(modules,1,4,raids);bedroom(h,g);
 const id=g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId!;
 const a=g.monsters.find(a=>a.id===id)!;a.loc={x:20,y:13};a.ticksUntilTurn=100;
 g.refreshStructureDerivedState();const c=current(g);
 expect(h.ext('settlement','recruit',{v:1,stateRevision:g.extensionRuntime!.worldCampState('settlement').revision,
   campId:c.regionId,campRevision:c.revision,targetId:id,targetRevision:0}).error).toBeNull();
 return {h,g,a};
}
