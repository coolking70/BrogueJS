// Independent owner-side regressions. Uses the installed 1.4 or 1.5 pack as-is.
// Fixtures retain physical commands only, with no teleports or snapshot edits.
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHeadlessGame } from '../test/harness';
import { createExtensionRegistry, getInstalledModuleDescriptors } from '../ext/catalog';
import * as catalog from '../ext/catalog';
import { registryFromDescriptors } from '../ext/descriptor';
import { bodyArenaFixtureDescriptor } from './fixtures/bodyModule';
import { installedOptionalModules } from './support/installedExtensions';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { inMovementRegion } from '../engine/Movement/MovementRegions';
import { TerrainType } from '../engine/Map/Grid';
import { getNextEntityId } from '../entities/Creature';
import type { Game, GameRecording } from '../engine/Core/Game';
const clone = <T>(x:T):T => structuredClone(x);
const settle = () => {while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
const world=(game:Game)=>{
 const {savedAt:_time,run,...snapshot}=game.toSnapshot();
 const {recordingOrigin:_origin,...rest}=run;
 return clone({...snapshot,run:rest});
};
function start(ids:string[],seed:number){
 const registry=createExtensionRegistry();
 const initialCommands=registry.create(registry.manifest(ids)).flatMap(m=>m.initialCommand?[JSON.stringify({module:m.id,...m.initialCommand})]:[]);
 const game=createHeadlessGame(seed,'test');game.startNewGame({seed,mode:'wizard',ruleSet:'extended',extensions:ids,initialCommands});game.animationEnabled=false;settle();return game;
}
type Command=Pick<GameRecording['events'][number],'action'|'data'|'decisions'>;
function execute(game:Game,c:Command){
 settle();const before=game.recordedInputEvents.length;game.executeCommand(c.action,c.data);
 for(const answer of c.decisions??[])if(game.pendingCommandConfirmation)game.resolveCommandDecision(game.pendingCommandConfirmation.token,answer);
 settle();expect(game.recordedInputEvents.length).toBe(before+1);
}
afterEach(()=>vi.restoreAllMocks());
/** Package deletion changes content/generation. Keep the original seven-pack
 * physical input when all are installed. Otherwise a named foundation-owned
 * arena supplies the same region/session contract, alongside every installed
 * package, using checked generation and public stair/walk commands. */
function installedRegionRoute(ids:string[]) {
 const installed=installedOptionalModules(ids);
 const descriptors=[...getInstalledModuleDescriptors(),bodyArenaFixtureDescriptor()];
 vi.spyOn(catalog,'createExtensionRegistry').mockImplementation(()=>registryFromDescriptors(descriptors));
 // Existing independent arena fixture's fixed seed; original seven-pack seed/input remain untouched.
 const game=start([...installed,'body-fixture'],7306);
 for(let n=0;n<2000&&game.depth<8;n++){
  const key=(p:{x:number;y:number})=>p.y*game.grid.width+p.x,source={...game.player.loc};
  const queue=[source],previous=new Map<number,{x:number;y:number}|null>([[key(source),null]]);
  const occupied=new Set(game.monsters.filter(m=>m.hp>0&&m.spatial).flatMap(m=>game.footprintOf(m).map(key)));
  let goal:{x:number;y:number}|undefined;
  for(let i=0;i<queue.length&&!goal;i++){
   const p=queue[i]!;
   if(game.grid.getCell(p.x,p.y)!.terrain===TerrainType.STAIRS_DOWN){goal=p;break;}
   for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
    const next={x:p.x+dx!,y:p.y+dy!},c=game.grid.getCell(next.x,next.y);
    if(!c||previous.has(key(next))||occupied.has(key(next))||(!c.isPassable&&![TerrainType.DOOR,TerrainType.SECRET_DOOR].includes(c.terrain))||
     c.layers.some(t=>[TerrainType.CHASM,TerrainType.LAVA,TerrainType.WATER_DEEP,TerrainType.PLAIN_FIRE].includes(t)))continue;
    previous.set(key(next),p);queue.push(next);
   }
  }
  expect(goal,'neutral native route must reach each real stair').toBeDefined();
  if(key(goal!)===key(source))execute(game,{action:'stairs_down',data:null,decisions:[]});
  else {let next=goal!;while(previous.get(key(next))&&key(previous.get(key(next))!)!==key(source))next=previous.get(key(next))!;
   if(game.grid.getCell(next.x,next.y)!.terrain===TerrainType.SECRET_DOOR)execute(game,{action:'search',data:null,decisions:[]});
   else execute(game,{action:'move',data:{x:next.x-source.x,y:next.y-source.y},decisions:[true,true,true,true]});}
 }
 return game;
}
it('A01 full cached visibility survives save/load, replay and non-monotonic seek',()=>{
 const input=JSON.parse(readFileSync(new URL('./fixtures/foundation/a01-physical-route.fixture.json',import.meta.url),'utf8'));
 const game=start(installedOptionalModules(['narrative']),input.seed),zero=world(game);let previous=0;
 for(const cut of input.cuts){
  for(const c of input.commands.slice(previous,cut.index))execute(game,c);previous=cut.index;
  expect(game.depth).toBe(cut.depth);expect(rng.getState()).toEqual(cut.rng);
  expect({x:game.player.x,y:game.player.y,hp:game.player.hp}).toEqual(cut.player);
  expect(game.absoluteTurnNumber).toBe(cut.turn);expect(game.toSnapshot().run.currentTick).toBe(cut.tick);
  const saved=clone(game.toSaveSnapshot()),expected=world(game),recording=clone(game.exportRecording());
  expect(game.loadSnapshot(saved)).toBe(true);expect(world(game)).toEqual(expected);
  expect(game.loadReplay(recording)).toBe(true);game.animationEnabled=false;
  for(const event of recording.events){game.replayStep(true);expect(game.replayError).toBeNull();expect(game.replayCursor).toBe(event.index+1);expect(rng.getState()).toEqual(event.rng);}
  expect(world(game)).toEqual(expected);
  for(const [index,truth] of [[recording.events.length,expected],[0,zero],[recording.events.length,expected]] as const){
   game.replaySeek(index);expect(game.replayError).toBeNull();expect(game.replayCursor).toBe(index);expect(world(game)).toEqual(truth);
  }
  expect(game.loadSnapshot(saved)).toBe(true);game.animationEnabled=false;settle();
 }
});
it('seven modules reconstruct every cached movement-region session after load',()=>{
 const input=JSON.parse(readFileSync(new URL('./fixtures/foundation/seven-physical-route.fixture.json',import.meta.url),'utf8'));
 const complete=installedOptionalModules(input.modules).length===input.modules.length;
 const game=complete?start(input.modules,input.seed):installedRegionRoute(input.modules);
 if(complete)for(const c of input.commands)execute(game,c);
 expect(game.depth).toBe(8);
 const saved=clone(game.toSaveSnapshot()),expected=world(game);
 expect(game.loadSnapshot(saved)).toBe(true);expect(world(game)).toEqual(expected);
 const regions = game.extensionRuntime!.snapshot().foundation.world.regions!;
 let boundActors = 0;
 for (const [depth, level] of game.levels) for (const actor of [...level.monsters, ...level.dormantMonsters ?? []]) {
  const id = actor.spatial?.movementRegionId;
  if (id === undefined) continue;
  boundActors++;
  for (const at of game.footprintOf(actor)) expect(inMovementRegion(level.grid,id,at)).toBe(true);
  expect(inMovementRegion(level.grid,id,{x:0,y:0})).toBe(false);
  const region = regions.find(r=>r.id===id)!;expect(region.depth).toBe(depth);
  const bad = clone(saved);bad.extensions!.foundation.world.regions = bad.extensions!.foundation.world.regions!.filter(r=>r.id!==id);
  const runtime = game.extensionRuntime, caches = game.levels, random = rng.getState(), allocator = getNextEntityId(), before = world(game);
  expect(game.loadSnapshot(bad)).toBe(false);expect(game.extensionRuntime).toBe(runtime);expect(game.levels).toBe(caches);
  expect(world(game)).toEqual(before);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(allocator);
  expect(inMovementRegion(level.grid,id,actor.loc)).toBe(true);
 }
 expect(boundActors).toBeGreaterThan(0);
 // A second persistence cycle must retain associations for the freshly decoded grids.
 const second=clone(game.toSaveSnapshot());expect(game.loadSnapshot(second)).toBe(true);expect(world(game)).toEqual(expected);
 // Controlled positioning at real native stairs, then the public revisit command.
 const up = Array.from({length:game.grid.width},(_,x)=>Array.from({length:game.grid.height},(_,y)=>({x,y}))).flat()
  .find(at=>game.grid.getCell(at.x,at.y)?.terrain===TerrainType.STAIRS_UP)!;
 expect(up).toBeDefined();game.player.loc={...up};execute(game,{action:'stairs_up',data:null,decisions:[]});expect(game.depth).toBe(7);
 expect(()=>game.toSaveSnapshot()).not.toThrow();
 const retiredBindings=[...game.levels.values()].flatMap(level=>level.monsters.flatMap(actor=>
  actor.spatial?.movementRegionId===undefined?[]:[{grid:level.grid,id:actor.spatial.movementRegionId,at:{...actor.loc}}]));
 expect(retiredBindings.length).toBeGreaterThan(0);
 game.startNewGame({seed:717,mode:'test'});expect(game.extensionRuntime).toBeNull();
 for(const binding of retiredBindings)expect(inMovementRegion(binding.grid,binding.id,binding.at)).toBe(false);
 expect(game.loadSnapshot(saved)).toBe(true);expect(world(game)).toEqual(expected);
 for(const level of game.levels.values())for(const actor of level.monsters)
  if(actor.spatial?.movementRegionId!==undefined)expect(inMovementRegion(level.grid,actor.spatial.movementRegionId,actor.loc)).toBe(true);
});
