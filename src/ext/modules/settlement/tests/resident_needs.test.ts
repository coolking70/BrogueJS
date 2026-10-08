import { it, expect, vi } from 'vitest';
import { residentScene } from './residentHelpers';
import { current, travelScenes, stairs } from './helpers';
import { settleResidentNeeds } from '../../../../engine/Core/ResidentNeeds';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { advanceWorldClock } from '../../../world5';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import type { Game } from '../../../../engine/Core/Game';
import type { WorldHarness } from '../../../worldSdk';
function beforeDay(h:WorldHarness,g:Game,foodShortage:0|1|2|3=0,quantity=2){
  const s=g.toSnapshot(),w=s.run.world5!;w.simulationTicks=31999;
  for(const l of w.offline){l.lastSettledTick=31999;l.epochRemainder=999;l.frozen.capturedTick=31999;
    for(const n of l.residentStates){n.foodShortage=foodShortage;n.unfedDays=foodShortage;}}
  const c=current(g),id=w.containers.find(b=>b.id===c.supplyId)!.itemIds[0]!;
  for(const i of [...s.entityGraph.items,...s.items,...s.player.inventory,...s.levels.flatMap(l=>l.items)])if(i.id===id)i.quantity=quantity;
  h.load(JSON.stringify(s));return g.worldContainerItems!.get(id)!;
}
it('D01/B02: public wait consumes locked prefixes in same Item without healing or resetting food debt',()=>{
  const {h,g}=residentScene(),food=beforeDay(h,g,3,5),id=food.id;
  const a=g.monsters.find(a=>a.id===g.world5!.residents[0]!.actorId)!;const hp=a.hp;
  h.command('wait');
  expect(food.quantity).toBe(4);expect(g.worldContainerItems!.get(id)).toBe(food);
  expect(current(g)).toMatchObject({consumedLockedUnits:1,locked:[{itemId:id,quantity:1}]});
  expect(g.world5!.offline[0]!.residentStates[0]).toMatchObject({foodShortage:2,unfedDays:0});
  expect(a.hp).toBe(hp);
  advanceWorldClock(g.world5!,64000-g.world5!.simulationTicks);settleResidentNeeds(g);
  expect(food.quantity).toBe(3);expect(current(g)).toMatchObject({consumedLockedUnits:2,locked:[]});
  expect(g.world5!.offline[0]!.residentStates[0]?.foodShortage).toBe(1);
  const read=g.extensionRuntime!.readModuleView('settlement')!,tick=g.world5!.simulationTicks,random=rng.getState();
  for(let i=0;i<5;i++)expect(g.extensionRuntime!.readModuleView('settlement')).toEqual(read);
  expect(g.world5!.simulationTicks).toBe(tick);expect(rng.getState()).toEqual(random);
});
it('F02: failed daily publication restores the transaction entry after the native clock has reached b',()=>{
  const {h,g}=residentScene(),food=beforeDay(h,g),beforeNeed=g.world5!.offline[0]!.residentStates[0]!,beforeLedger=g.world5!.offline[0]!;
  const actor=g.monsters.find(a=>a.id===g.world5!.residents[0]!.actorId)!;
  let entryTick=-1,entryRandom:ReturnType<typeof rng.getState>,entryId=-1;
  const checkpoint=g.checkpointResidentWorld.bind(g);
  vi.spyOn(g,'checkpointResidentWorld').mockImplementation(()=>{
    entryTick=g.world5!.simulationTicks;entryRandom=rng.getState();entryId=getNextEntityId();return checkpoint();
  });
  const replace=g.extensionRuntime!.worldCampReplace.bind(g.extensionRuntime!);
  const fault=vi.spyOn(g.extensionRuntime!,'worldCampReplace').mockImplementation((owner,state)=>{
    replace(owner,state);if(state.camps.some(c=>c.consumedLockedUnits===1))throw Error('daily publication');
  });
  expect(()=>h.command('wait')).toThrow('daily publication');
  expect(entryTick).toBe(32000);expect(g.world5!.simulationTicks).toBe(entryTick);
  expect(food.quantity).toBe(2);expect(g.worldContainerItems!.get(food.id)).toBe(food);
  expect(g.world5!.offline[0]).toBe(beforeLedger);expect(beforeLedger.residentStates[0]).toBe(beforeNeed);
  expect(g.monsters.find(a=>a.id===actor.id)).toBe(actor);expect(current(g).consumedLockedUnits).toBe(0);
  expect(rng.getState()).toEqual(entryRandom!);expect(getNextEntityId()).toBe(entryId);
  fault.mockRestore();settleResidentNeeds(g);expect(food.quantity).toBe(1);expect(g.world5!.simulationTicks).toBe(32000);
});
it('cached home still feeds escort, starvation retires at its actual cached carrier without current-layer loot',()=>{
  travelScenes();const {h,g,a}=residentScene();
  a.loc={x:20,y:13};g.player.loc={x:19,y:13};g.refreshStructureDerivedState();
  const c=current(g),r=residentComponent(g,a.id)!;
  expect(h.ext('settlement','set-residence',{v:1,stateRevision:g.extensionRuntime!.worldCampState('settlement').revision,
    campId:c.regionId,campRevision:c.revision,targetId:a.id,targetRevision:r.revision,mode:'escort'}).error).toBeNull();
  // The genuine staircase command establishes the cached layer. Preventing
  // migration here is a controlled native incapacitation case, not teleportation.
  a.setStatusDuration('paralyzed',1000);
  stairs(h,g,true);expect(g.depth).toBe(2);
  const cached=g.levels.get(1)!,homeFood=containerItems(g,current(g).supplyId)[0]!;
  expect(cached.monsters).toContain(a);
  const loot=ItemLoader.spawnFood('mango',a.x,a.y)!;
  a.carriedItem=loot;const currentItems=[...g.items];
  advanceWorldClock(g.world5!,32000-g.world5!.simulationTicks);settleResidentNeeds(g);
  expect(homeFood.quantity).toBe(1);expect(residentComponent(g,a.id)?.mode).toBe('escort');
  advanceWorldClock(g.world5!,192000-g.world5!.simulationTicks);settleResidentNeeds(g);
  expect(g.world5!.residents).toHaveLength(0);expect(cached.monsters).not.toContain(a);
  expect(cached.items).toContain(loot);expect(g.items).toEqual(currentItems);expect(a.hp).toBeGreaterThan(0);
  expect(g.world5!.receipts.filter(r=>r.identity.includes('departure.'))).toHaveLength(1);
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
  expect(g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]).toMatchObject({status:'terminal',actorId:null});
});

it('I8: actual whole/2/17 commits preserve locks, live roots, revisions, bounded identities and full digest',()=>{
 const {h,g}=residentScene();beforeDay(h,g,2,5);const original=h.save();
 const cuts=[32000,32050,40000,64000,64099,75001,96000,105099,128001,150000,160000,192000,224001,256000,288000,300000,1000000000];
 const run=(segments:number)=>{h.load(original);
   for(const tick of cuts){advanceWorldClock(g.world5!,tick-g.world5!.simulationTicks);
     if(segments===17||segments===2&&tick===64000)settleResidentNeeds(g);}
   settleResidentNeeds(g);const snapshot=g.toSnapshot(),digest=h.digest();h.load(JSON.stringify(snapshot));expect(h.digest()).toBe(digest);
   return {world:snapshot.run.world5,extensions:snapshot.extensions,digest,items:snapshot.entityGraph.items,
     monsters:snapshot.monsters,ledger:snapshot.run.world5!.offline};
 };
 const whole=run(1);expect(run(2)).toEqual(whole);expect(run(17)).toEqual(whole);
 expect(whole.world!.receipts.filter(r=>r.identity.startsWith('ration.'))).toHaveLength(5);
 expect(whole.world!.receipts.filter(r=>r.identity.startsWith('departure.'))).toHaveLength(1);
});

it('PERF/F02: coalesced source publication failure restores native retirement graph at paid b, then retries once',()=>{
 const {h,g,a}=residentScene();
 // Advance beyond the genuine visible grace deadline, retaining the paid b.
 advanceWorldClock(g.world5!,192300-g.world5!.simulationTicks);
 const entry=h.save(),digest=h.digest(),world=g.world5!,runtime=g.extensionRuntime!,
   monsters=g.monsters,source=runtime.snapshot(),food=containerItems(g,current(g).supplyId)[0]!;
 const replace=runtime.worldCampReplace.bind(runtime);
 let failed=false;
 const fault=vi.spyOn(runtime,'worldCampReplace').mockImplementation((owner,state)=>{
   replace(owner,state);
   if(state.spawnSlots.some(slot=>slot.status==='terminal')){failed=true;throw Error('terminal publication');}
 });
 expect(()=>settleResidentNeeds(g)).toThrow('terminal publication');expect(failed).toBe(true);
 expect(g.world5).toBe(world);expect(g.monsters).toBe(monsters);expect(g.monsters).toContain(a);
 expect(g.extensionRuntime).toBe(runtime);expect(runtime.snapshot()).toEqual(source);
 expect(g.worldContainerItems!.get(food.id)).toBe(food);expect(food.quantity).toBe(2);
 expect(g.world5!.simulationTicks).toBe(192300);expect(h.digest()).toBe(digest);
 fault.mockRestore();settleResidentNeeds(g);
 expect(g.world5!.residents).toHaveLength(0);expect(g.departureActors()).not.toContain(a);
 expect(a.hp).toBeGreaterThan(0);
 expect(runtime.worldCampState('settlement').spawnSlots[0]).toMatchObject({status:'terminal',actorId:null});
 const final=h.digest();h.load(entry);settleResidentNeeds(g);expect(h.digest()).toBe(final);
});
