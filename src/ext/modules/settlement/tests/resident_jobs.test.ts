import {Monster,type MonsterData} from '../../../../entities/Monster';
import monsterData from '../../../../data/monsters.json';
import { it, expect, vi } from 'vitest';
import { TerrainType } from '../../../../engine/Map/Grid';
import { residentPlotReason, residentHasNativePriority } from '../../../../engine/Core/ResidentJobs';
import { walk, base } from './helpers';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import { containerItems, containerRead } from '../../../../engine/Core/WorldWorkWorld';
import { productionActorActionScheduler } from '../../../../engine/Core/ActorActionProduction';
import { assign, scene, waitUntil } from './residentJobHelpers';
it('walks real source/plot, escrows one seed and produces one MATERIAL crop with one native clock', () => {
  const { h, g, a, src, dst, plot } = scene(),
    before = containerItems(g, src).find(
      (i) => i.worldItem?.definitionId === 'settlement.seed'
    )!.quantity;
  const prepare = vi.spyOn(a, 'prepareNativeDecision');
  expect(
    assign(h, g, a.id, { kind: 'plant', plotIds: [plot], sourceId: src, destinationId: dst }).error
  ).toBeNull();
  h.command('move', { x: 0, y: -1 });
  h.command('move', { x: 0, y: -1 });
  expect(g.lightMap.lightSumAt(19, 15)).toBeGreaterThan(306);
  const tick = g.world5!.simulationTicks;
  walk(h, g, { x: 29, y: 9 });
  expect(g.lightMap.lightSumAt(19, 15)).toBeLessThanOrEqual(306);
  waitUntil(h, () => g.world5!.residentJobs[0]?.phase === 'planting');
  const j = g.world5!.residentJobs[0]!,
    action = j.actionId!;
  expect(productionActorActionScheduler(g)!.isBusy(a.id)).toBe(true);
  expect(
    containerItems(g, src).find((i) => i.worldItem?.definitionId === 'settlement.seed')!.quantity
  ).toBe(before - 1);
  expect(containerItems(g, j.cargoId)[0]?.quantity).toBe(1);
  const prelude = prepare.mock.calls.length;
  h.command('wait');
  expect(prepare.mock.calls.length).toBe(prelude);
  expect(g.actorActions!.bundles.filter((b) => b.decisionOwnerId === a.id)).toHaveLength(1);
  expect(g.actorActions!.bundles[0]?.actionId).toBe(action);
  waitUntil(h, () =>
    containerItems(g, dst).some((i) => i.worldItem?.definitionId === 'settlement.crop')
  );
  expect(g.world5!.simulationTicks - tick).toBeGreaterThanOrEqual(1100);
  expect(
    containerItems(g, dst).find((i) => i.worldItem?.definitionId === 'settlement.crop')!.quantity
  ).toBe(1);
  expect(g.world5!.residentJobs).toHaveLength(0);
  expect(residentComponent(g, a.id)?.job.kind).toBe('idle');
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});
it('I5/A11: active-bundle reassignment retires and refunds exactly once at zero time', () => {
  const { h, g, a, src, dst, plot } = scene();
  expect(
    assign(h, g, a.id, { kind: 'plant', plotIds: [plot], sourceId: src, destinationId: dst }).error
  ).toBeNull();
  h.command('move', { x: 0, y: -1 });
  h.command('move', { x: 0, y: -1 });
  walk(h, g, { x: 29, y: 9 });
  waitUntil(h, () => g.world5!.residentJobs[0]?.phase === 'planting');
  const j = g.world5!.residentJobs[0]!,
    action = j.actionId!,
    cargo = j.cargoId;
  g.player.loc = { x: a.x + 1, y: a.y };
  g.refreshStructureDerivedState();
  const tick = g.world5!.simulationTicks;
  expect(assign(h, g, a.id, { kind: 'guard', at: { x: 19, y: 14 } }).error).toBeNull();
  expect(g.world5!.simulationTicks).toBe(tick);
  expect(g.world5!.residentJobs).toHaveLength(0);
  expect(g.actorActions!.bundles.some((b) => b.actionId === action)).toBe(false);
  expect(g.world5!.containers.some((c) => c.id === cargo)).toBe(false);
  expect(
    containerItems(g, src).find((i) => i.worldItem?.definitionId === 'settlement.seed')!.quantity
  ).toBe(6);
  expect(g.world5!.receipts.filter((r) => r.identity === 'resident.' + j.id)).toHaveLength(1);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});
it('real hauling walks to destination; whole Item retains ID and cancellation does not duplicate it', () => {
  const { h, g, a, src, dst } = scene(),
    seed = containerItems(g, src).find((i) => i.worldItem?.definitionId === 'settlement.seed')!;
  expect(
    assign(h, g, a.id, {
      kind: 'haul',
      sourceId: src,
      destinationId: dst,
      itemId: seed.id,
      quantity: 6
    }).error
  ).toBeNull();
  h.command('move', { x: 0, y: -1 });
  h.command('move', { x: 0, y: -1 });
  h.command('move', { x: 1, y: 0 });
  h.command('move', { x: 0, y: -1 });
  waitUntil(h, () => g.world5!.residentJobs[0]?.phase === 'carrying');
  expect(containerItems(g, src)).not.toContain(seed);
  expect(g.worldContainerItems!.get(seed.id)).toBe(seed);
  expect(containerItems(g, dst)).not.toContain(seed);
  waitUntil(h, () => containerItems(g, dst).some((i) => i.id === seed.id));
  expect(containerItems(g, dst)[0]).toBe(seed);
  expect(g.world5!.residentJobs).toHaveLength(0);
  expect(g.world5!.containers.filter((c) => c.kind === 'escrow')).toHaveLength(0);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});


it('plant water qualification uses composed safe stable mechanics, rejecting deep/temporary/unknown water', () => {
  const {h,g,plot} = scene();
  h.command('move',{x:0,y:-1}); h.command('move',{x:0,y:-1}); walk(h,g,{x:29,y:9});
  expect(residentPlotReason(g,plot)).toBeNull();
  for(const terrain of [TerrainType.WATER_DEEP, TerrainType.FLOOD_WATER_SHALLOW, TerrainType.LAVA, TerrainType.FLOOR]) {
    g.grid.setTerrain(19,17,terrain);
    expect(residentPlotReason(g,plot)).toBe('water');
  }
  g.grid.setTerrain(19,17,TerrainType.WATER_SHALLOW);
  const cell=g.grid.getCell(19,17)!;
  cell.isVisible=cell.hasMemory=cell.isExplored=false;
  expect(residentPlotReason(g,plot)).toBe('water');
  cell.hasMemory=true;
  expect(residentPlotReason(g,plot)).toBeNull();
});

for (const pause of ['rest', 'needs'] as const) it(`carrying pauses for ${pause} and resumes the original ticket and real cargo exactly once`, () => {
  const {h,g,a,src,dst}=scene();
  const original=containerItems(g,src).find(i=>i.worldItem?.definitionId==='settlement.seed')!;
  expect(assign(h,g,a.id,{kind:'haul',sourceId:src,destinationId:dst,itemId:original.id,quantity:6}).error).toBeNull();
  h.command('move',{x:0,y:-1});h.command('move',{x:0,y:-1});h.command('move',{x:1,y:0});h.command('move',{x:0,y:-1});
  waitUntil(h,()=>g.world5!.residentJobs[0]?.phase==='carrying');
  const s=g.toSnapshot(),w=s.run.world5!,id=w.residentJobs[0]!.id,cargoId=w.residentJobs[0]!.cargoId;
  const at=pause==='rest'?16000:40000;w.simulationTicks=at;
  for(const l of w.offline){l.lastSettledTick=at;l.epochRemainder=at%1000;l.frozen.capturedTick=at;
    for(const n of l.residentStates)if(n.actorId===a.id)n.foodShortage=pause==='needs'?2:0;}
  h.load(JSON.stringify(s));
  const actor=g.monsters.find(m=>m.id===a.id)!,position={...actor.loc},cargo=containerItems(g,cargoId)[0]!;
  for(let n=0;n<5;n++)h.command('wait');
  expect(actor.loc).toEqual(position);expect(g.world5!.residentJobs[0]).toMatchObject({id,cargoId,phase:'carrying',status:'suspended'});
  expect(containerItems(g,cargoId)[0]).toBe(cargo);expect(containerItems(g,dst)).toHaveLength(0);
  const resume=g.toSnapshot(),rw=resume.run.world5!,next=64000;rw.simulationTicks=next;
  for(const l of rw.offline){l.lastSettledTick=next;l.epochRemainder=next%1000;l.frozen.capturedTick=next;for(const n of l.residentStates)if(n.actorId===a.id)n.foodShortage=0;}
  h.load(JSON.stringify(resume));
  const resumedCargo=containerItems(g,cargoId)[0]!;
  waitUntil(h,()=>containerItems(g,dst).some(i=>i.id===original.id));
  expect(containerItems(g,dst)[0]).toBe(resumedCargo);expect(containerItems(g,dst)[0]!.quantity).toBe(6);
  expect(g.world5!.residentJobs).toHaveLength(0);expect(g.world5!.containers.some(c=>c.id===cargoId)).toBe(false);
  expect(g.world5!.receipts.filter(r=>r.identity==='resident.'+id)).toHaveLength(1);
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
});

it('guard reaches its real post and yields to one native combat decision without manufacturing a work timer', () => {
  const {h,g,a}=scene();
  expect(assign(h,g,a.id,{kind:'guard',at:{x:19,y:14}}).error).toBeNull();
  h.command('move',{x:0,y:-1});h.command('move',{x:0,y:-1});
  waitUntil(h,()=>a.x===19&&a.y===14);
  const enemy=g.monsters.find(m=>!m.isAlly&&!m.isCaged&&!m.isDormant&&m.hp>0)!;
  enemy.loc={x:18,y:14};enemy.ticksUntilTurn=100000;g.refreshStructureDerivedState();
  const hp=enemy.hp,prepare=vi.spyOn(a,'prepareNativeDecision'),tick=g.world5!.simulationTicks;
  for(let n=0;n<20&&enemy.hp===hp;n++){
    const calls=prepare.mock.calls.length;h.command('wait');expect(prepare.mock.calls.length-calls).toBeLessThanOrEqual(1);
  }
  expect(enemy.hp).toBeLessThan(hp);expect(prepare).toHaveBeenCalled();
  expect(g.world5!.simulationTicks).toBeGreaterThan(tick);expect(g.world5!.residentJobs).toHaveLength(0);
  expect(residentComponent(g,a.id)?.job.kind).toBe('guard');
  expect(g.actorActions!.bundles.filter(b=>b.decisionOwnerId===a.id)).toHaveLength(0);
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
});

for (const target of ['plot', 'destination'] as const) it(`dismantling an active plant ${target} retires its one bundle and refunds its escrow once`,()=>{
  const {h,g,a,src,dst,plot}=scene();
  expect(assign(h,g,a.id,{kind:'plant',plotIds:[plot],sourceId:src,destinationId:dst}).error).toBeNull();
  h.command('move',{x:0,y:-1});h.command('move',{x:0,y:-1});walk(h,g,{x:29,y:9});
  waitUntil(h,()=>g.world5!.residentJobs[0]?.phase==='planting');
  const j=g.world5!.residentJobs[0]!,action=j.actionId!,cargo=j.cargoId;
  const at=containerRead(g,dst).at!;
  const s=g.world5!.structures.find(s=>target==='plot'?s.fixture?.id===plot:s.at.x===at.x&&s.at.y===at.y&&s.fixture?.definitionId==='settlement.chest')!,component=s.fixture!;
  // Only the test's work position is controlled. Real paid dismantling owns
  // invalidation, the nested scheduler callback and its Item refund.
  g.player.loc={x:s.at.x,y:s.at.y+1};g.refreshStructureDerivedState();
  expect(h.ext('settlement','dismantle',{...base(g),componentId:component.id,componentRevision:component.revision}).error).toBeNull();
  expect(g.world5!.residentJobs).toHaveLength(0);expect(g.actorActions!.bundles.some(b=>b.actionId===action)).toBe(false);
  expect(g.world5!.containers.some(c=>c.id===cargo)).toBe(false);
  expect(containerItems(g,src).find(i=>i.worldItem?.definitionId==='settlement.seed')!.quantity).toBe(6);
  expect(g.world5!.receipts.filter(r=>r.identity==='resident.'+j.id)).toHaveLength(1);
  h.command('wait');expect(containerItems(g,src).find(i=>i.worldItem?.definitionId==='settlement.seed')!.quantity).toBe(6);
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
});

it('native danger interrupts real active planting and returns its single escrow once before native combat',()=>{
  const {h,g,a,src,dst,plot}=scene();
  expect(assign(h,g,a.id,{kind:'plant',plotIds:[plot],sourceId:src,destinationId:dst}).error).toBeNull();
  h.command('move',{x:0,y:-1});h.command('move',{x:0,y:-1});walk(h,g,{x:29,y:9});waitUntil(h,()=>g.world5!.residentJobs[0]?.phase==='planting');
  const j=g.world5!.residentJobs[0]!,action=j.actionId!;
  const danger=[{x:a.x+1,y:a.y},{x:a.x-1,y:a.y},{x:a.x,y:a.y+1},{x:a.x,y:a.y-1}].find(p=>g.grid.getCell(p.x,p.y)?.isPassable&&!g.monsters.some(m=>m.x===p.x&&m.y===p.y))!;
  expect(danger).toBeDefined();
  const enemy=new Monster(danger.x,danger.y,(monsterData as MonsterData[]).find(d=>d.id==='kobold')!);
  enemy.ticksUntilTurn=100;g.monsters.push(enemy);g.extensionRuntime!.attachCreature(enemy);
  expect(residentHasNativePriority(g,a)).toBe(true);
  const prepare=vi.spyOn(a,'prepareNativeDecision');
  for(let n=0;n<3&&g.world5!.residentJobs.length;n++){
    const count=prepare.mock.calls.length;h.command('wait');expect(prepare.mock.calls.length-count).toBeLessThanOrEqual(1);
  }
  expect(g.world5!.residentJobs).toHaveLength(0);expect(g.actorActions!.bundles.some(b=>b.actionId===action)).toBe(false);
  expect(containerItems(g,src).find(i=>i.worldItem?.definitionId==='settlement.seed')!.quantity).toBe(6);
  expect(g.world5!.receipts.filter(r=>r.identity==='resident.'+j.id)).toHaveLength(1);
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
});

it('one native guard goes around ordinary allied blockers instead of waiting forever for a decreasing unoccupied gradient',()=>{
  const {h,g,a}=scene();a.loc={x:19,y:11};g.player.loc={x:18,y:10};g.refreshStructureDerivedState();
  for(const y of [10,11]){
    const blocker=new Monster(20,y,(monsterData as MonsterData[]).find(d=>d.id==='goblin')!);blocker.isAlly=true;blocker.doesNotTrackLeader=true;blocker.ticksUntilTurn=1000000;g.monsters.push(blocker);g.extensionRuntime!.attachCreature(blocker);
  }
  expect(assign(h,g,a.id,{kind:'guard',at:{x:21,y:11}}).error).toBeNull();h.command('move',{x:-1,y:0});
  for(let n=0;n<30&&(a.x!==21||a.y!==11);n++)h.command('wait');
  expect(a.loc).toEqual({x:21,y:11});expect(g.monsters.filter(m=>m!==a&&m.x===20&&[10,11].includes(m.y))).toHaveLength(2);
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
});
