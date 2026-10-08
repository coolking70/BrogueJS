import { it, expect, vi } from 'vitest';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { residentScene } from './residentHelpers';
import { current, travelScenes, stairs, walk } from './helpers';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
function mode(state:ReturnType<typeof residentScene>,value:'stay'|'escort') {
  const {h,g,a}=state,c=current(g),r=residentComponent(g,a.id)!;
  return h.ext('settlement','set-residence',{v:1,stateRevision:g.extensionRuntime!.worldCampState('settlement').revision,
    campId:c.regionId,campRevision:c.revision,targetId:a.id,targetRevision:r.revision,mode:value});
}
it('D: actual stairs migrate one authorized escort and real return-home preserves home and bed',()=>{
  travelScenes();const state=residentScene(),{h,g,a}=state,home=current(g),bed=residentComponent(g,a.id)!.bedId;
  expect(mode(state,'escort').error).toBeNull();
  // Leave the actual sole doorway; the public native walk then owns every step.
  h.command('move',{x:0,y:-1});h.command('move',{x:0,y:-1});h.command('move',{x:1,y:0});
  stairs(h,g,true);expect(g.depth).toBe(2);
  let arrived=false;
  for(let n=0;n<200&&!arrived;n++) {h.command('wait');arrived=g.monsters.includes(a);}
  expect(arrived).toBe(true);expect(g.levels.get(1)!.monsters).not.toContain(a);
  expect(g.departureActors().filter(m=>m.id===a.id)).toHaveLength(1);
  expect(residentComponent(g,a.id)).toMatchObject({campId:home.regionId,bedId:bed,mode:'escort'});
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
  const actor=g.monsters.find(m=>m.id===a.id)!;
  stairs(h,g,false);expect(g.depth).toBe(1);
  for(let n=0;n<200&&!g.monsters.includes(actor);n++)h.command('wait');
  expect(g.monsters).toContain(actor);
  walk(h,g,{x:22,y:11});
  for(let n=0;n<100&&Math.max(Math.abs(actor.x-g.player.x),Math.abs(actor.y-g.player.y))>1;n++)h.command('wait');
  const c=current(g),r=residentComponent(g,a.id)!;
  expect(h.ext('settlement','return-home',{v:1,stateRevision:g.extensionRuntime!.worldCampState('settlement').revision,
    campId:c.regionId,campRevision:c.revision,targetId:a.id,targetRevision:r.revision}).error).toBeNull();
  expect(residentComponent(g,a.id)).toMatchObject({campId:home.regionId,bedId:bed,mode:'stay'});
  expect(actor.entersLevelIn).toBe(0);expect(actor.approaching).toBe(0);
  const final=h.digest();h.load(h.save());expect(h.digest()).toBe(final);
});

it('D no-position: a real cached escort retains source ownership, anchor, original loot and countdown one, then arrives once', () => {
  travelScenes();const state=residentScene(),{h,g,a}=state;
  expect(mode(state,'escort').error).toBeNull();
  const loot=ItemLoader.spawnFood('mango',a.x,a.y)!;a.carriedItem=loot;
  h.command('move',{x:0,y:-1});h.command('move',{x:0,y:-1});h.command('move',{x:1,y:0});
  stairs(h,g,true);expect(g.depth).toBe(2);expect(g.levels.get(1)!.monsters).toContain(a);
  const originalAnchor={...a.loc},normalGrid=g.toSnapshot().grid;
  // A controlled destination with no unoccupied native landing. Public waits
  // drive the actual cached countdown; no selector/placement stub is involved.
  for(let y=0;y<g.grid.height;y++)for(let x=0;x<g.grid.width;x++){
    const c=g.grid.getCell(x,y)!;
    if(c.layers.some(t=>t===13||t===14)||x===g.player.x&&y===g.player.y)continue;
    g.grid.setTerrain(x,y,3);
  }
  for(let n=0;n<200&&a.entersLevelIn>1;n++)h.command('wait');
  expect(a.entersLevelIn).toBe(1);
  h.command('wait');h.command('wait');
  expect(g.levels.get(1)!.monsters).toContain(a);expect(g.monsters).not.toContain(a);
  expect(a.loc).toEqual(originalAnchor);expect(a.entersLevelIn).toBe(1);expect(a.carriedItem).toBe(loot);
  expect(g.departureActors().filter(m=>m.id===a.id)).toHaveLength(1);
  const blocked=g.toSnapshot();const digest=h.digest();h.load(JSON.stringify(blocked));expect(h.digest()).toBe(digest);
  const resumed=g.toSnapshot();resumed.grid=normalGrid;h.load(JSON.stringify(resumed));
  const actor=g.departureActors().find(m=>m.id===a.id)!;
  for(let n=0;n<5&&!g.monsters.includes(actor);n++)h.command('wait');
  expect(g.monsters).toContain(actor);expect(actor.entersLevelIn).toBe(0);
  expect(g.levels.get(1)!.monsters).not.toContain(actor);expect(g.departureActors().filter(m=>m.id===a.id)).toHaveLength(1);
});

it('D/F2: a late cached escort publication failure rolls back its actual entry and retries once', () => {
  travelScenes();const state=residentScene(),{h,g,a}=state;expect(mode(state,'escort').error).toBeNull();
  h.command('move',{x:0,y:-1});h.command('move',{x:0,y:-1});h.command('move',{x:1,y:0});stairs(h,g,true);
  const snapshot=g.toSnapshot();for(const list of [snapshot.monsters,snapshot.entityGraph.monsters,...snapshot.levels.map(l=>l.monsters)])for(const actor of list)if(actor.id===a.id)actor.entersLevelIn=1;
  h.load(JSON.stringify(snapshot));const actor=g.departureActors().find(m=>m.id===a.id)!;
  let audit:ReturnType<typeof auditFullObjectGraph>|undefined,random:ReturnType<typeof rng.getState>|undefined,id:number|undefined;
  const checkpoint=g.checkpointResidentWorld.bind(g);
  vi.spyOn(g,'checkpointResidentWorld').mockImplementation(()=>{audit=auditFullObjectGraph({g,logger});random=rng.getState();id=getNextEntityId();const restore=checkpoint();return()=>{restore();expect(audit!.differences(),JSON.stringify(audit!.differences())).toEqual([]);};});
  const native=(g as any).restoreLevelResident.bind(g);
  const fault=vi.spyOn(g as any,'restoreLevelResident').mockImplementation((m:unknown,...args:unknown[])=>{native(m,...args);if(m===actor)throw Error('escort publication');});
  expect(()=>h.command('wait')).toThrow('escort publication');
  expect(audit,'outer entry checkpoint').toBeDefined();
  // The oracle is checked at the transaction's restore return, before the
  // outer public command legitimately clears executingRecordedCommand.
  expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(id);
  expect(g.levels.get(1)!.monsters).toContain(actor);expect(g.monsters).not.toContain(actor);expect(actor.entersLevelIn).toBe(1);
  fault.mockRestore();h.command('wait');expect(g.monsters).toContain(actor);expect(g.levels.get(1)!.monsters).not.toContain(actor);expect(actor.entersLevelIn).toBe(0);
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
});
