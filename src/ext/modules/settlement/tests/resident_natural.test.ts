import { writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { ItemCategory, type Item } from '../../../../engine/Items/Item';
import route from './resident-natural-route.json';
import { worldWorkLastError } from '../../../../engine/Core/WorldWork';
import { assign, scene, waitUntil } from './residentJobHelpers';
import { walk, base, current } from './helpers';
import { advanceWorldClock } from '../../../world5';
import { settleResidentNeeds } from '../../../../engine/Core/ResidentNeeds';
import { mechanicalDigest } from '../../../../engine/Core/RecordingDigest';

it('normal new-game core/day-food: original956, same actor/crop carry, guard, stairs, home and persistence', async () => {
  vi.restoreAllMocks();
  const h = createWorldHarness({ seed: route.seed, mode: 'normal', modules: ['settlement'] }),
    g = worldHarnessGame(h);
  const candidate = g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId!;
  const original = g.monsters.find((a) => a.id === candidate)!;
  const checkpoints = new Map(route.checkpoints.map((c) => [c.events, c]));
  const captured = new Map<number, string>();
  const seeks = route.checkpoints.filter(c => c.digest !== null);
  let crop: Item | undefined, food: Item | undefined;
  const foods = () => g.player.inventory.items.filter(i => i.category === ItemCategory.FOOD)
    .reduce((n, i) => n + i.quantity, 0);
  const checkPoint = (point: typeof route.checkpoints[number]) => {
    expect(g.depth).toBe(point.depth);
    expect(g.world5!.simulationTicks).toBe(point.tick);
    expect(g.departureActors().find(a => a.id === candidate)).toBe(original);
    expect(original.loc).toEqual(point.actorLocation);
    expect(original.hp).toBe(point.actorHp);
    expect(g.monsters.includes(original)).toBe(point.actorActive);
    if (point.digest !== null) {
      if (process.env.RESIDENT_FORMAT_CAPTURE) captured.set(point.events, h.digest());
      else expect(h.digest()).toBe(point.digest);
    }
  };
  try {
    expect(candidate).toBe(route.actorId);
    expect(foods()).toBe(1);
    checkPoint(checkpoints.get(0)!);
    for (const step of route.steps)
      for (let n = 0; n < step.count; n++) {
        const before = g.recordedInputEvents.length, event = before + 1,
          tick = g.world5!.simulationTicks;
        const beforeDigest = event === route.milestones.recruitNo || event === 916 ? h.digest() : null;
        const rejectedStairs = event === 916 ? {
          snapshot: g.toSnapshot(), inputState: (g as any).recordingInputState()
        } : null;
        const decisions = [...step.decisions];
        g.onConfirmRequest = () => decisions.shift() ?? true;
        // Missing data and explicit null remain distinct in the original inputs.
        h.command(step.action, step.data);
        while (g.pendingCommandConfirmation)
          g.resolveCommandDecision(g.pendingCommandConfirmation.token, decisions.shift() ?? true);
        expect(g.recordedInputEvents.length).toBe(before + 1);
        expect(decisions).toHaveLength(0);
        expect(g.isGameOver).toBe(false);
        if (step.action === 'ext:command')
          expect(worldWorkLastError(g), `event ${event}: ${step.data}`).toBeNull();
        if (beforeDigest !== null) {
          expect(g.world5!.simulationTicks).toBe(tick);
          if (!rejectedStairs) expect(h.digest()).toBe(beforeDigest);
          else {
            // Original916 rejects stairs without elapsed time, but emits one
            // native mechanical log. That exact knowledge change is retained.
            const after = g.toSnapshot(), inputState = (g as any).recordingInputState(),
              before = mechanicalDigest(rejectedStairs.snapshot, rejectedStairs.inputState),
              actual = mechanicalDigest(after, inputState),
              log = rejectedStairs.snapshot.run.logger,
              emission = {turn:904,color:'#aaaaaa',acknowledge:false,foldable:false};
            for (const domain of ['native','extensions','world5','actorActions','random'] as const)
              expect(actual.domains[domain]).toBe(before.domains[domain]);
            expect(after.rngState).toEqual(rejectedStairs.snapshot.rngState);
            expect(inputState).toEqual(rejectedStairs.inputState);
            const previous = g.recordedInputEvents[event - 2]!, recorded = g.recordedInputEvents[event - 1]!;
            for (const field of ['tick','turn','levelRef','simulationTicks','player','hp','inventoryStamp','rng','terminal','checkpoint'] as const)
              expect(recorded[field]).toEqual(previous[field]);
            expect(log.mechanical.nextId).toBe(79);
            expect(after.run.logger).toEqual({...log,nextId:log.nextId+1,
              messages:[...log.messages,{id:log.nextId,text:'There are no stairs up here.',color:'#aaaaaa',count:1,turn:904}],
              mechanical:{nextId:80,messages:[...log.mechanical.messages,emission]}});
            const expected = structuredClone(rejectedStairs.snapshot);
            expected.run.logger.mechanical = {nextId:80,messages:[...log.mechanical.messages,emission]};
            expect(actual).toEqual(mechanicalDigest(expected,rejectedStairs.inputState));
            expect(actual.domains.knowledge).not.toBe(before.domains.knowledge);
            expect(actual.root).not.toBe(beforeDigest);
          }
        }
        if (event === route.milestones.recruitYes) {
          expect(g.world5!.simulationTicks - tick).toBe(100);
          expect(residentComponent(g, candidate)).toMatchObject({campId: route.campId, bedId: route.bedId});
          expect(g.extensionRuntime!.residentComponent<{consumed:boolean}>('settlement',candidate,'source')?.consumed).toBe(true);
          food = containerItems(g, g.extensionRuntime!.worldCampState('settlement').camps[0]!.supplyId)
            .find(i => i.category === ItemCategory.FOOD);
          expect(food).toBeDefined();expect(food!.quantity).toBe(2);
        }
        const point = checkpoints.get(event);
        if (!point) continue;
        checkPoint(point);
        if (point.name === 'native-food') expect(foods()).toBe(2);
        if (point.name === 'crop') {
          crop = g.worldContainerItems!.get(route.cropId);
          expect(crop).toBeDefined();
          expect(crop).toMatchObject({category:ItemCategory.MATERIAL,quantity:1});
          expect(crop!.worldItem?.definitionId).toBe('settlement.crop');
          expect(containerItems(g,route.sourceId)).toContain(crop);
        }
        if (point.name === 'daily-food') {
          expect(food!.quantity).toBe(1);
          expect(g.worldContainerItems!.get(food!.id)).toBe(food);
          expect(g.extensionRuntime!.worldCampState('settlement').camps[0]).toMatchObject({
            consumedLockedUnits:1,locked:[{itemId:food!.id,quantity:1}]});
        }
        if (['pickup','first-carry','second-carry'].includes(point.name)) {
          const job = g.world5!.residentJobs.find(j => j.actorId === candidate)!;
          expect(job).toMatchObject({kind:'haul',id:37,cargoId:38});
          expect(containerItems(g,job.cargoId)).toContain(crop);
          expect(containerItems(g,route.sourceId)).not.toContain(crop);
          expect(g.worldContainerItems!.get(route.cropId)).toBe(crop);
          if (point.name !== 'pickup') expect(g.world5!.simulationTicks - tick).toBe(100);
        }
        if (point.name === 'haul') {
          expect(containerItems(g,route.destinationId)).toContain(crop);
          expect(g.worldContainerItems!.get(route.cropId)).toBe(crop);
          expect(g.world5!.residentJobs).toHaveLength(0);
          expect(g.world5!.containers.some(c => c.id === 38)).toBe(false);
        }
        if (point.name === 'guard-wait') {
          expect(g.world5!.simulationTicks - tick).toBe(100);
          expect(residentComponent(g,candidate)?.job).toEqual({kind:'guard',at:{x:29,y:22}});
        }
        if (point.name === 'escort') {
          expect(g.monsters).toContain(original);
          expect(g.levels.get(1)!.monsters).not.toContain(original);
          expect(g.departureActors().filter(a => a.id === candidate)).toHaveLength(1);
        }
        if (point.name === 'return-home')
          expect(residentComponent(g,candidate)).toMatchObject({mode:'stay',campId:route.campId,bedId:route.bedId});
      }
    expect(g.recordedInputEvents).toHaveLength(route.events);
    const recording = h.exportRecording(), save = h.save(), digest = h.digest();
    h.load(save);expect(h.digest()).toBe(digest);
    h.command('wait');
    expect(h.replay(h.exportRecording())).toEqual({ok:true,firstMismatch:null});
    expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});
    for (const point of seeks) {
      h.seek(recording,point.events);expect(h.digest()).toBe(captured.get(point.events) ?? point.digest);
    }
    if (process.env.RESIDENT_FORMAT_CAPTURE)
      writeFileSync(process.env.RESIDENT_FORMAT_CAPTURE + '.natural.json', JSON.stringify([...captured].map(([events,digest])=>({events,digest})),null,2)+'\n');
    // Optional external originals are immutable references, never rewritten fixtures.
    if (process.env.RESIDENT_SELF_RECORDINGS) {
      const {readFileSync,writeFileSync} = await import('node:fs');
      const {createHash} = await import('node:crypto');
      const references = process.env.RESIDENT_SELF_RECORDINGS.split('|').map(path => {
        const bytes = readFileSync(path), result = h.replay(bytes.toString());
        expect(result).toEqual({ok:true,firstMismatch:null});
        return {path,sha256:createHash('sha256').update(bytes).digest('hex'),result};
      });
      if (process.env.RESIDENT_SELF_REFERENCE_AUDIT)
        writeFileSync(process.env.RESIDENT_SELF_REFERENCE_AUDIT,JSON.stringify({references,
          seeks:seeks.map(p=>({events:p.events,digest:p.digest})),fixtureProvenance:route.provenance},null,2));
    }
  } finally {h.dispose();}
});

// Formal6.3 allows a strict from-save rule case for the old natural tail.
// The cached-carrier starvation test also retains nonlethal retirement/one departure.
it('controlled from-save tail: four unfed days remove resident alive, then public camp retirement refunds actual produced crop', () => {
  const {h,g,a,src,dst,plot} = scene();
  expect(assign(h,g,a.id,{kind:'plant',plotIds:[plot],sourceId:src,destinationId:dst}).error).toBeNull();
  h.command('move',{x:0,y:-1});h.command('move',{x:0,y:-1});
  walk(h,g,{x:29,y:9});
  waitUntil(h,()=>containerItems(g,dst).some(i=>i.worldItem?.definitionId==='settlement.crop'));
  const cropId = containerItems(g,dst).find(i=>i.worldItem?.definitionId==='settlement.crop')!.id;
  walk(h,g,{x:22,y:12});
  expect(g.world5!.simulationTicks).toBeLessThan(31999);
  const snapshot = g.toSnapshot(), world = snapshot.run.world5!;
  world.simulationTicks=31999;
  for(const l of world.offline){l.lastSettledTick=31999;l.epochRemainder=999;l.frozen.capturedTick=31999;}
  h.load(JSON.stringify(snapshot));
  const actor = g.monsters.find(m=>m.id===a.id)!, crop = g.worldContainerItems!.get(cropId)!;
  advanceWorldClock(g.world5!,192000-g.world5!.simulationTicks);settleResidentNeeds(g);
  expect(g.world5!.residents).toHaveLength(0);expect(actor.hp).toBeGreaterThan(0);
  expect(g.world5!.receipts.filter(r=>r.identity.startsWith('departure.'))).toHaveLength(1);
  expect(containerItems(g,dst)).toContain(crop);
  // Load a strict controlled save after the direct rule settlement. Its absent
  // natural prefix is not exportable; recording coverage belongs to core/day-food.
  h.load(JSON.stringify(g.toSnapshot()));
  const refunded = g.worldContainerItems!.get(cropId)!;
  // Camp retirement requires all paid structures dismantled. Refund through
  // the public executor, including the real destination chest's original Item.
  while (g.world5!.structures.length) {
    const part = g.world5!.structures.find(s=>s.fixture) ?? g.world5!.structures[0]!,
      component = part.fixture ?? part.roof ?? part.barrier!;
    const approaches = [-1,0,1].flatMap(dx=>[-1,0,1].map(dy=>({x:part.at.x+dx,y:part.at.y+dy})))
      .filter(p=>g.grid.getCell(p.x,p.y)?.isPassable&&!g.getMonsterAt(p.x,p.y))
      .sort((p,q)=>Math.max(Math.abs(p.x-g.player.x),Math.abs(p.y-g.player.y))
        -Math.max(Math.abs(q.x-g.player.x),Math.abs(q.y-g.player.y))||p.y-q.y||p.x-q.x);
    expect(approaches.length).toBeGreaterThan(0);walk(h,g,approaches[0]!);
    expect(h.ext('settlement','dismantle',{...base(g),componentId:component.id,componentRevision:component.revision}).error).toBeNull();
  }
  const camp = current(g),
    region = g.extensionRuntime!.worldStructureRegions().find(r=>r.id===camp.regionId)!;
  walk(h,g,{x:22,y:12});
  expect(h.ext('settlement','retire',{...base(g),regionId:region.id,regionRevision:region.revision}).error).toBeNull();
  expect(g.world5!.structures).toHaveLength(0);
  expect(g.extensionRuntime!.worldCampState('settlement').camps).toHaveLength(0);
  expect(g.player.inventory.items).toContain(refunded);expect(refunded.quantity).toBe(1);
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
});
