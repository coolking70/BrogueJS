/** Replayable controlled fixture: all administrative clock preparation occurs
 * inside the same native command stage in live, load continuation and replay. */
import { it, expect, vi, afterEach } from 'vitest';
import { Game } from '../../../../engine/Core/Game';
import { foundationContractHarness as createConfiguredWorldHarness, foundationCraftId } from '../../../../test/fixtures/foundationOptionalContent';
import { worldHarnessGame } from '../../../testing/worldHarness';
import { installRecordingScene } from '../../../../test/support/recordingV4';
import { scene, establish, build, base, current, walk, travelScenes } from './helpers';
import { campRaid, finishRaidEvents } from '../../../../engine/Core/SettlementRaids';
import { advanceWorldClock } from '../../../world5';
import { settleActorNeeds } from '../../../../engine/Core/ActorNeeds';
import { settleDepartures } from '../../../../engine/Core/ActorDeparture';
import { peekEdibleState } from '../../../../engine/Core/EdibleState';
import { nativeStat } from '../../../../engine/Stats/NativeStatSources';
import { ItemCategory } from '../../../../engine/Items/Item';
import { payload } from './residentProductionHelpers';
import { residentOrder } from '../../../../engine/Core/ResidentOrders';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import type { WorldHarness } from '../../../worldSdk';
const live: WorldHarness[] = [];
afterEach(()=>{live.splice(0).forEach(h=>h.dispose());vi.restoreAllMocks();});
const world=(g:Game)=>{const {savedAt,...s}=g.toSnapshot();return structuredClone(s);};
function origin(modules:string[],raids:boolean){
 installRecordingScene(g=>{
  if(!g.extensionRuntime?.residentOwners().includes('settlement'))return;
  scene(g);g.player.inventory.items.find(i=>i.category===ItemCategory.FOOD)!.quantity=raids?24:12;
  const wood=g.player.inventory.items.find(i=>i.worldItem?.definitionId===foundationCraftId('crafting.wood'));if(wood)wood.quantity=28;
  g.player.hp=g.player.maxHp=1000;
  const a=g.monsters.find(a=>a.id===g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId)!;
  a.loc={x:22,y:13};a.ticksUntilTurn=100000;
 });
 travelScenes();const h=createConfiguredWorldHarness({seed:51020001,mode:'easy',modules},{settlement:{raids}});live.push(h);
 return {h,g:worldHarnessGame(h)};
}
function publicCamp(h: WorldHarness, g: Game) {
  expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  const nearby = (at: { x: number; y: number }) => {
    const spots = [
      { x: at.x - 1, y: at.y },
      { x: at.x + 1, y: at.y },
      { x: at.x, y: at.y - 1 },
      { x: at.x, y: at.y + 1 }
    ]
      .filter((p) => g.grid.getCell(p.x, p.y)?.isPassable && !g.getMonsterAt(p.x, p.y))
      .sort(
        (a, b) =>
          Math.abs(a.x - g.player.x) +
          Math.abs(a.y - g.player.y) -
          Math.abs(b.x - g.player.x) -
          Math.abs(b.y - g.player.y)
      );
    expect(spots.length).toBeGreaterThan(0);
    walk(h, g, spots[0]!);
  };
  nearby({ x: 19, y: 12 });
  expect(h.ext('settlement', 'build', build(g, 'door', { x: 19, y: 12 })).error).toBeNull();
  const door = g.world5!.structures.find(
    (s) => s.barrier?.definitionId === 'settlement.door'
  )!.barrier!;
  expect(
    h.ext('settlement', 'door', {
      ...base(g),
      componentId: door.id,
      componentRevision: door.revision,
      open: true
    }).error
  ).toBeNull();
  for (let y = 12; y <= 16; y++)
    for (let x = 17; x <= 21; x++) {
      const edge = x === 17 || x === 21 || y === 12 || y === 16;
      if (edge && (((x === 17 || x === 21) && (y === 12 || y === 16)) || (x === 19 && y === 12)))
        continue;
      nearby({ x, y });
      expect(
        h.ext('settlement', 'build', build(g, edge ? 'wood-wall' : 'roof', { x, y })).error
      ).toBeNull();
    }
  nearby({ x: 18, y: 13 });
  expect(h.ext('settlement', 'build', build(g, 'bed', { x: 18, y: 13 })).error).toBeNull();
  const a = g.monsters.find(
    (a) => a.id === g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId
  )!;
  nearby(a.loc);
  const c = current(g);
  expect(
    h.ext('settlement', 'recruit', {
      v: 1,
      stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
      campId: c.regionId,
      campRevision: c.revision,
      targetId: a.id,
      targetRevision: 0
    }).error
  ).toBeNull();
  const food = g.player.inventory.items.find((i) => i.consumableId === 'ration_of_food')!;
  nearby({ x: 21, y: 12 });
  expect(
    h.ext('settlement', 'transfer', {
      ...base(g),
      containerId: c.supplyId,
      containerRevision: g.world5!.containers.find((b) => b.id === c.supplyId)!.revision,
      direction: 'deposit',
      items: [{ itemId: food.id, quantity: 8 }]
    }).error
  ).toBeNull();
  return a;
}
it.each([true,false])('XR-02 recorded hungry raid retirement visible=%s, save continuation and nonmonotonic seek',visible=>{
 const native=(Game.prototype as any).performPlayerActionStages;
 const spawn=Game.prototype.createRaidMonster;
 vi.spyOn(Game.prototype,'createRaidMonster').mockImplementation(function(this:Game,...args:Parameters<typeof spawn>){
  const actor=spawn.apply(this,args);if(actor)actor.ticksUntilTurn=1000000;return actor;
 });
 vi.spyOn(Game.prototype as any,'performPlayerActionStages').mockImplementation(function*(this:Game,...args:any[]){
  if(args[0]==='wait'&&this.world5?.raidCamps.length){
   const raid=this.world5.raidCamps[0]!,e=raid.event;
   if(!e||e.phase==='warning'||e.phase==='deferred')advanceWorldClock(this.world5,Math.max(0,71000-this.world5.simulationTicks));
   else if(e.phase==='active'){
    const allyId=e.actorIds.find(id=>this.departureActor(id)?.isAlly),departure=peekEdibleState(this.extensionRuntime!).departures?.active;
    if(departure?.length){advanceWorldClock(this.world5,2100);settleDepartures(this);}
    else if(allyId!==undefined){
     const ally=this.departureActor(allyId)!;ally.loc=visible?{x:this.player.x,y:this.player.y+1}:{x:60,y:20};
     this.grid.getCell(ally.x,ally.y)!.isVisible=visible;
     advanceWorldClock(this.world5,392100);settleActorNeeds(this,true);
    }else if(e.actors.some(a=>a.retired!==null)){
     for(const id of e.actorIds){const enemy=this.departureActor(id);if(enemy)this.killMonster(enemy);}
     finishRaidEvents(this);
    }
   }
  }
  yield* native.apply(this,args);
  const e=this.world5?.raidCamps[0]?.event;
  if(args[0]==='wait'&&e?.phase==='active'&&!e.actors.some(a=>a.retired!==null)&&!e.actorIds.some(id=>this.departureActor(id)?.isAlly)){
   const ally=this.departureActor(e.actorIds[0]!)!;this.becomeAllyWith(ally);finishRaidEvents(this);
  }
 });
 const {h,g}=origin(['settlement','foraging'],true);publicCamp(h,g);
 // Keep the separate resident supplied while the actual companion starves.
 walk(h,g,{x:22,y:12});const food=g.player.inventory.items.find(i=>i.category===ItemCategory.FOOD)!;
 expect(h.ext('settlement','transfer',{...base(g),containerId:current(g).supplyId,
  containerRevision:g.world5!.containers.find(b=>b.id===current(g).supplyId)!.revision,
  items:[{itemId:food.id,quantity:12}],direction:'deposit'}).error).toBeNull();
 const checkpoints=new Map<number,ReturnType<typeof world>>();
 for(let stage=0;stage<(visible?4:3);stage++){
  h.command('wait');const raid=campRaid(g,current(g).slot)!;
  if(stage===0)expect(raid.event!.phase).toBe('active');
  if(stage===1&&visible)expect(peekEdibleState(g.extensionRuntime!).departures!.active).toHaveLength(1);
  if(stage===(visible?2:1)){
   expect(raid.event!.actors.some(a=>a.retired!==null)).toBe(true);expect(raid.event!.defeatedIds).toEqual([]);
  }
  if(stage===(visible?3:2))expect(raid.event!.phase).toBe('closed');
  const saved=h.save(),expected=world(g),recording=h.exportRecording(),cursor=g.recordedInputEvents.length;
  expect(JSON.parse(saved).run.recordingOrigin).toBeDefined();checkpoints.set(cursor,expected);
  h.load(saved);expect(world(g)).toEqual(expected);
  expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(world(g)).toEqual(expected);
  h.load(saved);
 }
 const recording=h.exportRecording(),points=[...checkpoints.keys()];
 for(const cursor of [points[points.length-1]!,points[0]!,points[points.length-1]!]){
  h.seek(recording,cursor);expect(world(g)).toEqual(checkpoints.get(cursor));
 }
});

it.each([false,true])('XR-03 recorded physical four batches offline=%s, persisted facts/totals and seek',offline=>{
 const native=(Game.prototype as any).performPlayerActionStages;
 vi.spyOn(Game.prototype as any,'performPlayerActionStages').mockImplementation(function*(this:Game,...args:any[]){
  if(args[0]==='wait'&&this.world5?.orders.some(o=>o.production&&o.ticketId!==null))
   for(const r of this.world5.residents){const actor=this.departureActor(r.actorId);if(actor)actor.ticksUntilTurn=Math.min(actor.ticksUntilTurn,100);}
  if(args[0]==='wait'&&this.depth===2&&this.world5?.orders.some(o=>o.production&&o.ticketId!==null))
   advanceWorldClock(this.world5,4000);
  yield* native.apply(this,args);
 });
 const {h,g}=origin(['settlement','crafting'],false),a=publicCamp(h,g);
 walk(h,g,{x:20,y:14});expect(h.ext('crafting','place-station',{v:1,definitionId:foundationCraftId('crafting.table'),x:20,y:15,
  inventoryStamp:base(g).inventoryStamp}).error).toBeNull();
 const station=g.world5!.stations.find(s=>s.definitionId===foundationCraftId('crafting.table'))!;
 walk(h,g,{x:22,y:12});const wood=g.player.inventory.items.find(i=>i.worldItem?.definitionId===foundationCraftId('crafting.wood'))!;
 expect(h.ext('settlement','transfer',{...base(g),containerId:current(g).supplyId,
  containerRevision:g.world5!.containers.find(b=>b.id===current(g).supplyId)!.revision,
  items:[{itemId:wood.id,quantity:24}],direction:'deposit'}).error).toBeNull();
 expect(h.ext('settlement','order-work',{...payload(g,a.id,foundationCraftId('crafting.make-chest-kit'),4),
  stationId:station.interactableId,stationRevision:station.revision}).error).toBeNull();
 const supply=current(g).supplyId,ticket=residentOrder(g,a.id)!.ticketId;
 h.command('wait');h.command('wait');
 if(offline){walk(h,g,{x:30,y:25});h.command('stairs_down');expect(g.depth).toBe(2);}
 for(let n=0;n<80&&(g.world5!.offline.some(l=>l.pendingOutputs.some(p=>p.ticketId===ticket))||residentOrder(g,a.id)?.ticketId!==null);n++)h.command('wait');
 const facts=g.worldWorkFacts!.filter(f=>f.ticketId===ticket&&f.operation==='craft-batch');
 expect(facts.map(f=>f.completionOrdinal)).toEqual([1,2,3,4]);
 expect((g.extensionRuntime!.snapshot().modules.crafting as any).totals.craftBatches).toBe(4);
 expect(containerItems(g,supply).filter(i=>i.worldItem?.definitionId===foundationCraftId('crafting.kit-chest')).reduce((n,i)=>n+i.quantity,0)).toBe(4);
 const saved=h.save(),expected=world(g),recording=h.exportRecording(),cursor=g.recordedInputEvents.length;
 expect(JSON.parse(saved).run.recordingOrigin).toBeDefined();h.load(saved);expect(world(g)).toEqual(expected);
 h.command('wait');expect(h.replay(h.exportRecording())).toEqual({ok:true,firstMismatch:null});
 expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(world(g)).toEqual(expected);
 for(const index of [cursor,0,cursor]){h.seek(recording,index);if(index===cursor)expect(world(g)).toEqual(expected);}
});

it('XR-02 native retirement failure restores complete graph and stat bindings before retry',()=>{
 const {h,g}=origin(['settlement','foraging'],true);publicCamp(h,g);
 advanceWorldClock(g.world5!,71000-g.world5!.simulationTicks);h.command('wait');
 for(let n=0;n<40&&campRaid(g,current(g).slot)!.event?.phase!=='active';n++)h.command('wait');
 const raid=campRaid(g,current(g).slot)!,actor=g.departureActor(raid.event!.actorIds[0]!)!;
 g.becomeAllyWith(actor);actor.loc={x:g.player.x,y:g.player.y+1};g.refreshStructureDerivedState();
 advanceWorldClock(g.world5!,392100);settleActorNeeds(g,true);
 expect(peekEdibleState(g.extensionRuntime!).departures!.active.some(r=>r.actorId===actor.id)).toBe(true);
 advanceWorldClock(g.world5!,2100);
 const before=world(g),runtime=g.extensionRuntime!,monsters=g.monsters,hooks=actor.extensionHooks;
 const original=Object.freeze({failure:'late retirement'}),native=g.retireDepartingActors.bind(g);
 const fault=vi.spyOn(g,'retireDepartingActors').mockImplementation(ids=>{native(ids);throw original;});
 try{settleDepartures(g);expect.unreachable();}catch(error){expect(error).toBe(original);}
 expect(world(g)).toEqual(before);expect(g.monsters).toBe(monsters);expect(g.monsters).toContain(actor);
 expect(g.extensionRuntime).toBe(runtime);expect(actor.extensionHooks).toBe(hooks);
 expect(nativeStat(actor,'native.max-hp')).toBe(actor.maxHp);
 expect(raid.event!.actors.find(a=>a.actorId===actor.id)!.retired).toBeNull();
 fault.mockRestore();settleDepartures(g);
 expect(g.departureActor(actor.id)).toBeUndefined();expect(actor.hp).toBeGreaterThan(0);expect(actor.deathProcessed).toBe(false);
 expect(raid.event!.defeatedIds).not.toContain(actor.id);expect(raid.event!.actors.find(a=>a.actorId===actor.id)!.retired).not.toBeNull();
 const saved=h.save(),expected=world(g);h.load(saved);expect(world(g)).toEqual(expected);
});
