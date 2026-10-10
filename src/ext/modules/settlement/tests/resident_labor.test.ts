import {inventoryStamp} from '../../../../engine/Core/RecordingDigest';
import {ItemCategory} from '../../../../engine/Items/Item';
import { expect, it } from 'vitest';
import { scene, assign, waitUntil } from './residentJobHelpers';
import { walk } from './helpers';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { createActorActionBundle } from '../../../../engine/Core/ActorActionScheduler';
import { sourceFootprintVersion } from '../../../../engine/Movement/AttackShape';
function planting() {
  const state=scene(),{h,g,a,src,dst,plot}=state;
  expect(assign(h,g,a.id,{kind:'plant',plotIds:[plot],sourceId:src,destinationId:dst}).error).toBeNull();
  h.command('move',{x:0,y:-1});h.command('move',{x:0,y:-1});walk(h,g,{x:29,y:9});
  waitUntil(h,()=>g.world5!.residentJobs[0]?.phase==='planting');
  return state;
}
function interval(credit:number,at=15950,options:{duration?:number;foodShortage?:0|1|2|3}={}) {
  const state=planting(),{h,g,a}=state,s=g.toSnapshot(),w=s.run.world5!,j=w.residentJobs[0]!;
  w.simulationTicks=at;
  for(const l of w.offline){l.lastSettledTick=at;l.epochRemainder=at%1000;l.frozen.capturedTick=at;}
  j.creditTicks=credit;j.creditRemainder=0;
  if(options.foodShortage!==undefined)for(const l of w.offline)for(const n of l.residentStates)if(n.actorId===a.id)n.foodShortage=options.foodShortage;
  const duration=options.duration??50;
  const actionId=j.actionId!;
  s.run.actorActions!.bundles=[createActorActionBundle({owner:'foundation',actionId,depth:g.depth,
    decisionOwnerId:a.id,timeChargeOwnerId:a.id,subactions:[{sourceEntityId:a.id,sourcePartId:'body',
      sourceFootprintVersion:sourceFootprintVersion(g.spatialOf(a)),
      phases:[{kind:'recovery',durationTicks:duration,segmentIndex:null}]}]})];
  for(const actors of [s.monsters,s.entityGraph.monsters,...s.levels.map(l=>l.monsters)])
    for(const actor of actors)if(actor.id===a.id)actor.ticksUntilTurn=duration;
  h.load(JSON.stringify(s));return {...state,a:g.monsters.find(m=>m.id===a.id)!,id:j.id,cargoId:j.cargoId};
}
it('F1/A06: exactly 1000 earned at work end completes after needs despite rest',()=>{
  const {h,g,a,dst,plot}=interval(950);h.command('wait');
  expect(g.world5!.simulationTicks).toBe(16050);
  expect(containerItems(g,dst).filter(i=>i.worldItem?.definitionId==='settlement.crop').map(i=>i.quantity)).toEqual([1]);
  expect(g.world5!.residentJobs).toHaveLength(0);
  expect(g.extensionRuntime!.worldCampState('settlement').plotDays).toEqual([{componentId:plot,day:0}]);
  expect(residentComponent(g,a.id)!.job.kind).toBe('idle');
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
});
it('F1/A07: unfinished work retains ticket, seed and credit across rest then resumes once',()=>{
  const {h,g,a,dst,src,id,cargoId}=interval(900);h.command('wait');
  expect(g.world5!.residentJobs[0]).toMatchObject({id,cargoId,creditTicks:950,creditRemainder:0,status:'suspended',actionId:null});
  const seed=containerItems(g,cargoId)[0]!;
  expect(seed.quantity).toBe(1);expect(containerItems(g,src).find(i=>i.worldItem?.definitionId==='settlement.seed')!.quantity).toBe(5);
  for(let n=0;n<150;n++)h.command('wait');
  expect(g.world5!.residentJobs[0]).toMatchObject({id,cargoId,creditTicks:950});
  expect(containerItems(g,cargoId)[0]).toBe(seed);expect(containerItems(g,dst)).toHaveLength(0);
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
  waitUntil(h,()=>containerItems(g,dst).some(i=>i.worldItem?.definitionId==='settlement.crop'),20);
  expect(containerItems(g,dst)[0]!.quantity).toBe(1);expect(g.world5!.residentJobs).toHaveLength(0);
  expect(residentComponent(g,a.id)!.job.kind).toBe('idle');
});


it('F1/A02: genuine accepted planting at 50% earns 500 then 1000 over exactly 2000 paid native ticks', () => {
  const { h, g, dst, id, cargoId } = interval(0, 40000, { duration: 1000, foodShortage: 1 });
  const seed = containerItems(g, cargoId)[0]!;
  for (let n = 0; n < 10; n++) h.command('wait');
  expect(g.world5!.simulationTicks).toBe(41000);
  expect(g.world5!.residentJobs[0]).toMatchObject({ id, cargoId, creditTicks: 500, creditRemainder: 0 });
  expect(containerItems(g, cargoId)[0]).toBe(seed); expect(containerItems(g, dst)).toHaveLength(0);
  for (let n = 0; n < 10; n++) h.command('wait');
  expect(g.world5!.simulationTicks).toBe(42000);
  expect(containerItems(g, dst).filter(i => i.worldItem?.definitionId === 'settlement.crop').map(i => i.quantity)).toEqual([1]);
  expect(g.world5!.residentJobs).toHaveLength(0);
  const digest = h.digest(); h.load(h.save()); expect(h.digest()).toBe(digest);
});

it('F1 haul FOOD at the day endpoint cannot supply the preceding ration; earned delivery completes after needs even at efficiency zero', () => {
  const {h,g,a,src,dst}=scene();
  g.player.loc={x:20,y:14};g.refreshStructureDerivedState();
  const food=g.player.inventory.items.find(i=>i.category===ItemCategory.FOOD)!;
  const box=g.world5!.containers.find(c=>c.id===dst)!;
  const state=g.extensionRuntime!.worldCampState('settlement');
  expect(h.ext('settlement','transfer',{v:1,stateRevision:state.revision,inventoryStamp:inventoryStamp(g.player.inventory.items),containerId:dst,containerRevision:box.revision,direction:'deposit',items:[{itemId:food.id,quantity:2}]}).error).toBeNull();
  const moved=containerItems(g,dst).find(i=>i.category===ItemCategory.FOOD)!;
  const position=[{x:a.x-1,y:a.y},{x:a.x+1,y:a.y},{x:a.x,y:a.y-1},{x:a.x,y:a.y+1}].find(p=>g.grid.getCell(p.x,p.y)?.isPassable&&!g.monsters.some(m=>m.x===p.x&&m.y===p.y))!;
  g.player.loc=position;g.refreshStructureDerivedState();
  expect(assign(h,g,a.id,{kind:'haul',sourceId:dst,destinationId:src,itemId:moved.id,quantity:2}).error).toBeNull();
  g.player.loc={x:29,y:9};g.refreshStructureDerivedState();waitUntil(h,()=>g.world5!.residentJobs[0]?.phase==='delivery');
  const snapshot=g.toSnapshot(),w=snapshot.run.world5!,job=w.residentJobs[0]!,at=31950;
  const supply=w.containers.find(c=>c.id===src)!;
  const remove=new Set(supply.itemIds.filter(id=>snapshot.entityGraph.items.find(i=>i.id===id)?.category===ItemCategory.FOOD));
  supply.itemIds=supply.itemIds.filter(id=>!remove.has(id));snapshot.entityGraph.items=snapshot.entityGraph.items.filter(i=>!remove.has(i.id));
  const camps=(snapshot.extensions!.modules.settlement as any).camps;
  camps[0].locked=[];camps[0].consumedLockedUnits=2;
  w.simulationTicks=at;for(const l of w.offline){l.lastSettledTick=at;l.epochRemainder=at%1000;l.frozen.capturedTick=at;for(const n of l.residentStates){n.foodShortage=2;n.unfedDays=2;}}
  snapshot.run.actorActions!.bundles=[createActorActionBundle({owner:'foundation',actionId:job.actionId!,depth:g.depth,decisionOwnerId:a.id,timeChargeOwnerId:a.id,subactions:[{sourceEntityId:a.id,sourcePartId:'body',sourceFootprintVersion:sourceFootprintVersion(g.spatialOf(a)),phases:[{kind:'recovery',durationTicks:50,segmentIndex:null}]}]})];
  for(const actors of [snapshot.monsters,snapshot.entityGraph.monsters,...snapshot.levels.map(l=>l.monsters)])for(const actor of actors)if(actor.id===a.id)actor.ticksUntilTurn=50;
  h.load(JSON.stringify(snapshot));const cargo=containerItems(g,job.cargoId)[0]!;
  h.command('wait');
  expect(g.world5!.offline[0]!.residentStates[0]).toMatchObject({foodShortage:3,unfedDays:3,departed:false});
  expect(containerItems(g,src).find(i=>i.id===moved.id)).toBe(cargo);expect(cargo.quantity).toBe(2);
  expect(g.world5!.residentJobs).toHaveLength(0);expect(g.world5!.residents).toHaveLength(1);
  const beforeNext=g.toSnapshot(),nw=beforeNext.run.world5!;nw.simulationTicks=63999;for(const l of nw.offline){l.lastSettledTick=63999;l.epochRemainder=999;l.frozen.capturedTick=63999;}
  h.load(JSON.stringify(beforeNext));h.command('wait');
  expect(g.world5!.offline[0]!.residentStates[0]).toMatchObject({foodShortage:2,unfedDays:0,departed:false});
  expect(containerItems(g,src).find(i=>i.id===moved.id)!.quantity).toBe(1);
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
});
