import { productionActorActionScheduler } from '../../../../engine/Core/ActorActionProduction';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { TerrainType } from '../../../../engine/Map/Grid';
import { assembleWorldItem } from '../../../../engine/Items/WorldItems';
import { itemDefinition } from '../../../../engine/Core/WorldWorkWorld';
import { assign } from './residentJobHelpers';
import { setup, establish } from './helpers';
import {
  applyActorPoiseDamage,
  isActorStaggered
} from '../../../../engine/Core/PhasedAttackProduction';
import { residentHasNativePriority } from '../../../../engine/Core/ResidentJobs';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import species from '../../../../data/monsters.json';
import { it, expect, vi } from 'vitest';
import { residentScene, bedroom } from './residentHelpers';
import { base, current, travelScenes } from './helpers';
import { payload } from './residentProductionHelpers';
import { advanceWorldClock } from '../../../world5';
import { campRaid, campEconomicTick, frozenRaidActors } from '../../../../engine/Core/SettlementRaids';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { residentOrder, residentOrderTicket } from '../../../../engine/Core/ResidentOrders';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { withWorldActorScope } from '../../../../engine/Core/WorldWork';
import { planStructureChange, commitStructureWorld } from '../../../../engine/Map/StructureWorld';
function active(modules = ['settlement']) {
  const s = residentScene(modules, true),
    { h, g } = s;
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  advanceWorldClock(g.world5!, 71000 - g.world5!.simulationTicks);
  h.command('wait');
  for (let n = 0; n < 40 && campRaid(g, current(g).slot)!.event?.phase !== 'active'; n++)
    h.command('wait');
  expect(campRaid(g, current(g).slot)!.event?.phase).toBe('active');
  return s;
}
function exit(s: ReturnType<typeof active>, down = true) {
  const { h, g } = s;
  g.player.loc = down ? { x: 30, y: 25 } : { x: 2, y: 2 };
  g.refreshStructureDerivedState();
  h.command(down ? 'stairs_down' : 'stairs_up');
  expect(g.depth).toBe(down ? 2 : 1);
}
const economics = (s: ReturnType<typeof active>) => ({
  items: [...s.g.worldContainerItems!.values()].map((i) => ({
    id: i.id,
    quantity: i.quantity,
    worldItem: i.worldItem
  })),
  orders: s.g.world5!.orders,
  tickets: s.g.world5!.tickets,
  terminal: s.g.world5!.terminalTickets,
  pending: s.g.world5!.offline[0]!.pendingOutputs,
  quota: s.g.world5!.offline[0]!.productionQuotas,
  needs: s.g.world5!.offline[0]!.residentStates,
  locked: current(s.g).locked,
  consumed: current(s.g).consumedLockedUnits
});
it.each(
  [
    ['settlement'],
    ['settlement', 'combat'],
    ['settlement', 'giants'],
    ['settlement', 'combat', 'giants']
  ].map((modules) => ({ modules }))
)('real native bounded wave with $modules, local warning and strict persistence', ({ modules }) => {
  const s = active(modules),
    r = campRaid(s.g, current(s.g).slot)!,
    e = r.event!;
  expect(e.budget).toBe(2);
  expect(e.actorIds).toHaveLength(e.budget);
  for (const id of e.actorIds) {
    const a = s.g.monsters.find((a) => a.id === id)!;
    expect(a.isAlly).toBe(false);
    expect(s.g.footprintOf(a)).toHaveLength(1);
    expect(
      s.g
        .extensionRuntime!.worldStructureRegions()
        .some(
          (r) =>
            a.spawnLoc.x >= r.bounds.x &&
            a.spawnLoc.x < r.bounds.x + r.bounds.width &&
            a.spawnLoc.y >= r.bounds.y &&
            a.spawnLoc.y < r.bounds.y + r.bounds.height
        )
    ).toBe(false);
  }
  const before = s.h.digest();
  s.h.load(s.h.save());
  expect(s.h.digest()).toBe(before);
});
it('S1/S2: active enemies freeze, >32 offline epochs do not settle, return alone and repeated exit stay paused; genuine death resumes only future time', () => {
  travelScenes();
  const s = active(),
    { g, h } = s,
    r = campRaid(g, current(g).slot)!,
    eventId = r.event!.id;
  exit(s);
  expect(r.pauseFrom).not.toBeNull();
  const actors = g.levels
    .get(1)!
    .monsters.filter((a) => r.event!.actorIds.includes(a.id))
    .map((a) => ({
      id: a.id,
      hp: a.hp,
      loc: { ...a.loc },
      timer: a.ticksUntilTurn,
      status: structuredClone(a.statusDurations)
    }));
  const before = structuredClone(economics(s)),
    economicTick = campEconomicTick(g, r.slot);
  advanceWorldClock(g.world5!, 96 * 1000);
  h.command('wait');
  expect(economics(s)).toEqual(before);
  expect(campEconomicTick(g, r.slot)).toBe(economicTick);
  expect(r.event!.id).toBe(eventId);
  expect(r.event!.phase).toBe('active');
  expect(
    g.levels
      .get(1)!
      .monsters.filter((a) => r.event!.actorIds.includes(a.id))
      .map((a) => ({
        id: a.id,
        hp: a.hp,
        loc: { ...a.loc },
        timer: a.ticksUntilTurn,
        status: structuredClone(a.statusDurations)
      }))
  ).toEqual(actors);
  const save = h.save(),
    digest = h.digest();
  h.load(save);
  expect(h.digest()).toBe(digest);
  exit(s, false);
  const returned = campRaid(g, r.slot)!;
  expect(returned.event!.phase).toBe('active');
  expect(returned.pauseFrom).toBeNull();
  exit(s);
  const again = structuredClone(economics(s));
  advanceWorldClock(g.world5!, 64000);
  h.command('wait');
  expect(economics(s)).toEqual(again);
  exit(s, false);
  for (const id of campRaid(g, r.slot)!.event!.actorIds) {
    const a = g.monsters.find((a) => a.id === id)!;
    g.killMonster(a);
  }
  h.command('wait');
  expect(campRaid(g, r.slot)!.event!.phase).toBe('closed');
  const consumed = current(g).consumedLockedUnits;
  advanceWorldClock(g.world5!, 1000);
  h.command('wait');
  expect(current(g).consumedLockedUnits).toBe(consumed);
  expect(campEconomicTick(g, r.slot)).toBeLessThan(g.world5!.simulationTicks - 150000);
});
it('S3: pending output, earned labor, escrow and reservations survive siege; cancellation refunds once without early delivery', () => {
  travelScenes();
  const s = residentScene(['settlement'], true),
    { g, h, a } = s;
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'order-work', payload(g, a.id, 'settlement.hunt', 16)).error
  ).toBeNull();
  const o = residentOrder(g, a.id)!;
  o.production!.paidTicks = 1000;
  advanceWorldClock(g.world5!, 1000 - (g.world5!.simulationTicks % 1000));
  h.command('wait');
  expect(g.world5!.offline[0]!.pendingOutputs.length).toBeGreaterThan(0);
  // Already earned ownership is staged at an imminent genuine raid boundary.
  const r = campRaid(g, current(g).slot)!;
  r.createdTick = 0;
  r.lastPressureTick = g.world5!.simulationTicks;
  r.pressure = 63;
  advanceWorldClock(g.world5!, 32000 - g.world5!.simulationTicks);
  h.command('wait');
  for (let n = 0; n < 80 && r.event?.phase !== 'active'; n++) h.command('wait');
  expect(r.event?.phase).toBe('active');
  // A second controlled earned batch waits for the next economic epoch.
  o.production!.paidTicks = 1000;
  advanceWorldClock(g.world5!, 1000 - (g.world5!.simulationTicks % 1000));
  h.command('wait');
  exit(s);
  const frozen = structuredClone(economics(s));
  advanceWorldClock(g.world5!, 320000);
  h.command('wait');
  expect(economics(s)).toEqual(frozen);
  exit(s, false);
  g.player.loc = { x: a.x + 1, y: a.y };
  g.refreshStructureDerivedState();
  const c = current(g),
    resident = residentComponent(g, a.id)!;
  const completed = residentOrderTicket(g, a.id)!.completedBatches;
  expect(
    h.ext('settlement', 'cancel-order', {
      v: 1,
      stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
      campId: c.regionId,
      campRevision: c.revision,
      targetId: a.id,
      targetRevision: resident.revision,
      orderId: o.id,
      orderRevision: o.revision
    }).error
  ).toBeNull();
  expect(g.world5!.containers.filter((b) => b.kind === 'escrow')).toHaveLength(0);
  const total =
    containerItems(g, c.supplyId)
      .filter((i) => i.worldItem?.definitionId === 'settlement.meat')
      .reduce((n, i) => n + i.quantity, 0) +
    g
      .world5!.offline[0]!.pendingOutputs.flatMap((p) => p.items)
      .filter((i) => i.itemDefinitionId === 'settlement.meat')
      .reduce((n, i) => n + i.count, 0);
  expect(total).toBe(completed);
  h.load(h.save());
  expect(
    containerItems(g, c.supplyId)
      .filter((i) => i.worldItem?.definitionId === 'settlement.meat')
      .reduce((n, i) => n + i.quantity, 0) +
      g
        .world5!.offline[0]!.pendingOutputs.flatMap((p) => p.items)
        .filter((i) => i.itemDefinitionId === 'settlement.meat')
        .reduce((n, i) => n + i.count, 0)
  ).toBe(completed);
});
it('S4: forged siege event and exclusion boundaries reject atomically; read UI is zero-write', () => {
  travelScenes();
  const s = active(),
    { h, g } = s;
  exit(s);
  advanceWorldClock(g.world5!, 32000);
  h.command('wait');
  for (const mutate of [
    (w: any) => (w.raidCamps[0].event = null),
    (w: any) => w.raidCamps[0].pauseThrough++,
    (w: any) => (w.raidCamps[0].event.actorIds[0] = 99999),
    (w: any) => (w.raidCamps[0].event.reason = 'summary'),
    (w: any) => (w.raidCamps[0].event.lostUnits = 1),
    (w: any) => (w.raidCamps[0].event.lastAttemptTick = w.raidCamps[0].event.triggerTick - 1),
    (w: any) => (w.raidCamps[0].event.severity = 1)
  ]) {
    const snapshot = g.toSnapshot();
    mutate(snapshot.run.world5);
    const audit = auditFullObjectGraph({ g, rt: g.extensionRuntime });
    expect(() => h.load(JSON.stringify(snapshot))).toThrow();
    expect(audit.differences()).toEqual([]);
  }
  const before = h.digest();
  for (let n = 0; n < 5; n++) g.extensionRuntime!.readModuleView('settlement');
  expect(h.digest()).toBe(before);
});
it('S5: failed event close writer restores event and economics; retry closes once; death freezes', () => {
  const s = active(),
    { g, h } = s,
    r = campRaid(g, current(g).slot)!;
  for (const id of r.event!.actorIds) g.killMonster(g.monsters.find((a) => a.id === id)!);
  const before = structuredClone(economics(s)),
    event = structuredClone(r),
    replace = g.extensionRuntime!.worldCampReplace.bind(g.extensionRuntime!);
  const spy = vi.spyOn(g.extensionRuntime!, 'worldCampReplace').mockImplementation(() => {
    throw Error('writer');
  });
  expect(() => h.command('wait')).toThrow();
  expect(r).toEqual(event);
  expect(economics(s)).toEqual(before);
  spy.mockImplementation(replace);
  h.command('wait');
  expect(r.event!.phase).toBe('closed');
  expect(r.report).toEqual({ phase: 'closed', reason: 'combat', lostUnits: 0, damagedHp: 0 });
  expect(r.reportedTick).toBe(r.event!.endedTick);
  expect(g.world5!.receipts.filter((x) => x.identity === r.event!.id + '.closed')).toHaveLength(1);
  const state = structuredClone(g.world5!);
  g.triggerGameOver(false);
  advanceWorldClock(g.world5!, 64000);
  h.command('wait');
  expect(g.world5!.raidCamps).toEqual(state.raidCamps);
  expect(economics(s)).toEqual(before);
});
it('paid public repair previews exact durability/material/ticks and rejects stale/No without free HP', () => {
  const { g, h } = residentScene();
  const c = g.world5!.structures.find(
    (s) => s.fixture?.definitionId === 'settlement.bed'
  )!.fixture!;
  withWorldActorScope(g, 'settlement', g.player.id, 'trusted-world', (scope) => {
    const p = planStructureChange(
      {
        kind: 'damage',
        componentId: c.id,
        revision: c.revision,
        amount: 25,
        damageKind: 'physical'
      },
      scope
    );
    expect(p.ok).toBe(true);
    if (p.ok) expect(commitStructureWorld(g, p.value, scope).ok).toBe(true);
  });
  g.player.loc = { x: 19, y: 13 };
  g.refreshStructureDerivedState();
  const d = g
    .extensionRuntime!.worldDefinitionPacks()
    .flatMap((p) => p.structures ?? [])
    .find((d) => d.id === c.definitionId)!;
  const amount = d.maxHp - c.hp,
    materials = d.constructionCost.map((a) => ({
      ...a,
      count: Math.ceil((a.count * amount) / d.maxHp)
    }));
  const request = () => ({
    ...base(g),
    componentId: c.id,
    componentRevision: c.revision,
    amount,
    sourceContainerId: null,
    sourceRevision: null,
    materials
  });
  const hp = c.hp,
    before = h.digest();
  expect(h.ext('settlement', 'repair', request(), [false]).error).toBeNull();
  expect(h.digest()).toBe(before);
  expect(c.hp).toBe(hp);
  g.onConfirmRequest = () => {
    c.revision++;
    return true;
  };
  g.executeCommand(
    'ext:command',
    JSON.stringify({ module: 'settlement', action: 'repair', payload: request() })
  );
  expect(c.hp).toBe(hp);
  expect(g.extensionRuntime!.readModuleView('settlement')!.state).toMatchObject({
    lastError: 'C5_STALE'
  });
  const counts = materials.map((a) =>
      g.player.inventory.items
        .filter((i) => i.worldItem?.definitionId === a.itemDefinitionId)
        .reduce((n, i) => n + i.quantity, 0)
    ),
    tick = g.world5!.simulationTicks;
  expect(h.ext('settlement', 'repair', request()).error).toBeNull();
  expect(c.hp).toBe(d.maxHp);
  expect(g.world5!.simulationTicks - tick).toBeGreaterThanOrEqual(
    Math.max(100, Math.ceil((d.constructionTicks * amount) / d.maxHp))
  );
  materials.forEach((a, n) =>
    expect(
      g.player.inventory.items
        .filter((i) => i.worldItem?.definitionId === a.itemDefinitionId)
        .reduce((n, i) => n + i.quantity, 0)
    ).toBe(counts[n]! - a.count)
  );
});
it('A2/A3: cached warning pays one bounded aggregate loss, native enemies remain, entering only the layer does not rearm; actual region visit reports once', () => {
  travelScenes();
  const s = residentScene(['settlement'], true),
    { h, g } = s,
    c = current(g);
  g.player.loc = { x: 22, y: 12 };
  g.refreshStructureDerivedState();
  for (const name of ['wood', 'stone']) {
    const i = g.player.inventory.items.find(
      (i) => i.worldItem?.definitionId === 'settlement.' + name
    )!;
    expect(
      h.ext('settlement', 'transfer', {
        ...base(g),
        containerId: c.supplyId,
        containerRevision: g.world5!.containers.find((b) => b.id === c.supplyId)!.revision,
        direction: 'deposit',
        items: [{ itemId: i.id, quantity: 20 }]
      }).error
    ).toBeNull();
  }
  // Remove paid barriers through the public command so this is a real nonzero theft/damage path.
  for (const row of [...g.world5!.structures].filter((row) => row.barrier)) {
    const component = row.barrier!,
      at = [
        { x: row.at.x - 1, y: row.at.y },
        { x: row.at.x + 1, y: row.at.y },
        { x: row.at.x, y: row.at.y - 1 },
        { x: row.at.x, y: row.at.y + 1 }
      ].find((p) => g.grid.getCell(p.x, p.y)?.isPassable && !g.getMonsterAt(p.x, p.y))!;
    g.player.loc = at;
    g.refreshStructureDerivedState();
    expect(
      h.ext('settlement', 'dismantle', {
        ...base(g),
        componentId: component.id,
        componentRevision: component.revision
      }).error
    ).toBeNull();
  }
  const quantities = () =>
    containerItems(g, c.supplyId)
      .filter(
        (i) =>
          i.worldItem?.definitionId === 'settlement.wood' ||
          i.worldItem?.definitionId === 'settlement.stone'
      )
      .reduce((n, i) => n + i.quantity, 0);
  const before = quantities();
  exit(s);
  const native = g.levels.get(1)!.monsters.map((a) => ({ id: a.id, hp: a.hp, loc: { ...a.loc } }));
  advanceWorldClock(g.world5!, 71000 - g.world5!.simulationTicks);
  const beforeSummary = structuredClone({
    world: g.world5,
    items: [...g.worldContainerItems!.values()].map((i) => ({ id: i.id, quantity: i.quantity })),
    state: g.extensionRuntime!.worldCampState('settlement')
  });
  const replace = g.extensionRuntime!.worldCampReplace.bind(g.extensionRuntime!);
  const fail = vi.spyOn(g.extensionRuntime!, 'worldCampReplace').mockImplementation(() => {
    throw Error('summary writer');
  });
  expect(() => h.command('wait')).toThrow('summary writer');
  expect({
    world: g.world5,
    items: [...g.worldContainerItems!.values()].map((i) => ({ id: i.id, quantity: i.quantity })),
    state: g.extensionRuntime!.worldCampState('settlement')
  }).toEqual(beforeSummary);
  fail.mockImplementation(replace);
  h.command('wait');
  const r = campRaid(g, c.slot)!;
  expect(r.event!.phase).toBe('aftermath');
  const remote = (g.extensionRuntime!.readModuleView('settlement')!.state as any).raids.camps.find(
    (c: any) => c.campId === r.campId
  );
  expect(remote.phase).toBe(r.report?.phase ?? null);
  expect(remote.lostUnits).toBe(r.report?.lostUnits ?? null);
  expect(r.report?.phase).not.toBe('aftermath');
  expect(r.event!.actorIds).toEqual([]);
  expect(r.event!.lostUnits).toBeGreaterThan(0);
  expect(r.event!.damagedHp).toBeGreaterThan(0);
  expect(r.event!.lostUnits).toBeLessThanOrEqual(Math.floor(before / 4));
  expect(quantities()).toBe(before - r.event!.lostUnits);
  expect(g.levels.get(1)!.monsters.map((a) => ({ id: a.id, hp: a.hp, loc: { ...a.loc } }))).toEqual(
    native
  );
  for (const row of g.world5!.structures)
    for (const component of [row.floor, row.barrier, row.roof, row.fixture])
      if (component) {
        const d = g
          .extensionRuntime!.worldDefinitionPacks()
          .flatMap((p) => p.structures ?? [])
          .find((d) => d.id === component.definitionId)!;
        expect(component.hp).toBeGreaterThanOrEqual(Math.ceil(d.maxHp / 4));
      }
  const event = structuredClone(r.event!),
    items = quantities();
  advanceWorldClock(g.world5!, 320000);
  h.command('wait');
  expect(r.event).toEqual(event);
  expect(quantities()).toBe(items);
  exit(s, false);
  expect(r.event!.phase).toBe('aftermath');
  g.player.loc = { x: 22, y: 12 };
  g.refreshStructureDerivedState();
  h.command('wait');
  expect(r.event!.phase).toBe('closed');
  expect(r.lastOrdinal).toBe(1);
  expect(g.world5!.receipts.filter((x) => x.identity === event.id + '.summary')).toHaveLength(1);
});
it('warning no legal complete landing defers the same budget and identity; full materialization writer failure rolls allocator and actors back', () => {
  const s = residentScene(['settlement'], true),
    { g, h } = s;
  advanceWorldClock(g.world5!, 64000 - g.world5!.simulationTicks);
  h.command('wait');
  const r = campRaid(g, current(g).slot)!;
  // Reach the warning using the real world clock and public command, never instantiate an event fixture.
  for (let n = 0; n < 20 && !r.event; n++) h.command('wait');
  expect(r.event!.phase).toBe('warning');
  const id = r.event!.id,
    region = g.extensionRuntime!.worldStructureRegions().find((x) => x.id === current(g).regionId)!,
    b = region.bounds;
  const cells: { x: number; y: number; explored: boolean }[] = [];
  for (let y = b.y - 1; y <= b.y + b.height; y++)
    for (let x = b.x - 1; x <= b.x + b.width; x++)
      if (x < b.x || y < b.y || x >= b.x + b.width || y >= b.y + b.height) {
        const cell = g.grid.getCell(x, y)!;
        cells.push({ x, y, explored: cell.isExplored });
        cell.isExplored = false;
      }
  advanceWorldClock(g.world5!, 3000);
  h.command('wait');
  expect(r.event!.phase).toBe('deferred');
  expect(r.event!.id).toBe(id);
  expect(r.event!.actorIds).toEqual([]);
  for (const p of cells) g.grid.getCell(p.x, p.y)!.isExplored = p.explored;
  const create = g.createRaidMonster.bind(g),
    actors = g.monsters.map((a) => a.id);
  let n = 0;
  const spy = vi.spyOn(g, 'createRaidMonster').mockImplementation((...args) => {
    const actor = create(...args);
    if (++n === 2) throw Error('wave writer');
    return actor;
  });
  advanceWorldClock(g.world5!, 1000);
  expect(() => h.command('wait')).toThrow('wave writer');
  expect(g.monsters.map((a) => a.id)).toEqual(actors);
  expect(r.event!.actorIds).toEqual([]);
  expect(r.event!.phase).toBe('deferred');
  spy.mockRestore();
  h.command('wait');
  expect(r.event!.phase).toBe('active');
  expect(r.event!.id).toBe(id);
  expect(r.event!.actorIds).toHaveLength(r.event!.budget);
});
it('S1 other camp: a besieged cached home excludes all time while a second real public home consumes rations and produces from its original finite ticket', () => {
  travelScenes();
  const s = active(),
    { g, h } = s,
    c1 = current(g);
  exit(s);
  g.player.loc = { x: 20, y: 12 };
  g.refreshStructureDerivedState();
  bedroom(h, g);
  const c2 = g.extensionRuntime!.worldCampState('settlement').camps.find((c) => c.depth === 2)!;
  const a = new Monster(20, 13, (species as MonsterData[]).find((m) => m.id === 'goblin')!);
  a.isCaged = true;
  g.monsters.push(a);
  g.extensionRuntime!.attachCreature(a);
  g.executeCommand('wait', undefined, () => g.freeCaptive(a));
  a.loc = { x: 20, y: 13 };
  a.ticksUntilTurn = 100;
  g.player.loc = { x: 19, y: 13 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'recruit', {
      v: 1,
      stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
      campId: c2.regionId,
      campRevision: c2.revision,
      targetId: a.id,
      targetRevision: 0
    }).error
  ).toBeNull();
  const request = payload(g, a.id, 'settlement.hunt', 16),
    box = g.world5!.containers.find((b) => b.id === c2.supplyId)!;
  Object.assign(request, {
    campId: c2.regionId,
    campRevision: g.extensionRuntime!.worldCampState('settlement').camps.find((c) => c.depth === 2)!
      .revision,
    sourceId: box.id,
    sourceRevision: box.revision,
    destinationId: box.id,
    destinationRevision: box.revision
  });
  expect(h.ext('settlement', 'order-work', request).error).toBeNull();
  g.player.loc = { x: 30, y: 25 };
  g.refreshStructureDerivedState();
  h.command('stairs_down');
  expect(g.depth).toBe(3);
  const l1 = g.world5!.offline.find((l) => l.campSlotId === c1.slot)!,
    l2 = g.world5!.offline.find((l) => l.campSlotId === c2.slot)!,
    before1 = structuredClone({
      needs: l1.residentStates,
      outputs: l1.pendingOutputs,
      items: containerItems(g, c1.supplyId).map((i) => ({ id: i.id, quantity: i.quantity }))
    });
  const paid = c2.consumedLockedUnits,
    budget = residentOrder(g, a.id)!.remainingEpochs;
  advanceWorldClock(g.world5!, 64000);
  h.command('wait');
  expect({
    needs: l1.residentStates,
    outputs: l1.pendingOutputs,
    items: containerItems(g, c1.supplyId).map((i) => ({ id: i.id, quantity: i.quantity }))
  }).toEqual(before1);
  expect(campRaid(g, c1.slot)!.pauseFrom).not.toBeNull();
  expect(
    g.extensionRuntime!.worldCampState('settlement').camps.find((c) => c.depth === 2)!
      .consumedLockedUnits
  ).toBeGreaterThan(paid);
  expect(residentOrder(g, a.id)!.remainingEpochs).toBeLessThan(budget);
  expect(
    containerItems(g, c2.supplyId).some((i) => i.worldItem?.definitionId === 'settlement.meat')
  ).toBe(true);
  expect(Math.floor(l2.lastSettledTick / 1000)).toBe(Math.floor(g.world5!.simulationTicks / 1000));
});
it('existing giants group keeps occupancy, native target/damage/death identities beside an ordinary raid without extra giant births', () => {
  const s = residentScene(['settlement', 'giants', 'combat'], true),
    { g, h } = s;
  const core = g.createCompositeMonster('giants.shale-weaver-body', { x: 12, y: 12 })!;
  expect(core).toBeTruthy();
  const group = g.bodyGroups!.find((b) => b.coreId === core.id)!;
  const ids = group.members.map((m) => m.entityId);
  for (const a of g.monsters.filter((a) => ids.includes(a.id))) {
    a.ticksUntilTurn = 100000;
  }
  advanceWorldClock(g.world5!, 71000 - g.world5!.simulationTicks);
  h.command('wait');
  const r = campRaid(g, current(g).slot)!;
  expect(r.event!.phase).toBe('active');
  expect(g.bodyGroups!.filter((b) => b.groupId === group.groupId)).toHaveLength(1);
  expect(group.members.map((m) => m.entityId)).toEqual(ids);
  const occupied = g.monsters.filter((a) => ids.includes(a.id)).flatMap((a) => g.footprintOf(a));
  for (const id of r.event!.actorIds) {
    const a = g.monsters.find((a) => a.id === id)!;
    expect(occupied.some((p) => g.footprintOf(a).some((q) => p.x === q.x && p.y === q.y))).toBe(
      false
    );
    expect(a.spatial?.bodyMember).toBeUndefined();
  }
  const before = core.hp;
  core.takeDamage(3, true, g.grid);
  expect(core.hp).toBeLessThan(before);
  expect(g.bodyGroups!.find((b) => b.groupId === group.groupId)!.coreId).toBe(core.id);
  g.killMonster(core);
  h.command('wait');
  expect(g.bodyGroups?.some((b) => b.groupId === group.groupId) ?? false).toBe(false);
  expect(g.monsters.some((a) => ids.includes(a.id))).toBe(false);
  expect(r.event!.phase).toBe('active');
});
it('S4/S5: whole and 17 segmented public cached advances exclude the identical time; failed watermark writer rolls back full original graph', () => {
  travelScenes();
  const s = active(),
    { g, h } = s;
  exit(s);
  const start = g.world5!.simulationTicks,
    save = h.save(),
    target = start + 96037;
  const result = () =>
    structuredClone({
      raid: campRaid(g, current(g).slot),
      ledger: g.world5!.offline[0],
      economics: economics(s),
      camp: g.extensionRuntime!.worldCampState('settlement')
    });
  advanceWorldClock(g.world5!, target - g.world5!.simulationTicks - 100);
  h.command('wait');
  const whole = result();
  h.load(save);
  for (let n = 1; n <= 17; n++) {
    const to = start + Math.floor((96037 * n) / 17),
      elapsed = to - g.world5!.simulationTicks - 100;
    if (elapsed > 0) advanceWorldClock(g.world5!, elapsed);
    h.command('wait');
  }
  expect(g.world5!.simulationTicks).toBe(target);
  expect(result()).toEqual(whole);
  h.load(save);
  advanceWorldClock(g.world5!, 32000);
  const replace = g.extensionRuntime!.worldCampReplace.bind(g.extensionRuntime!);
  const spy = vi.spyOn(g.extensionRuntime!, 'worldCampReplace').mockImplementation(() => {
    throw Error('watermark writer');
  });
  let checked = 0;
  const checkpoint = g.checkpointResidentWorld.bind(g);
  vi.spyOn(g, 'checkpointResidentWorld').mockImplementation(() => {
    const audit = auditFullObjectGraph({ g, rt: g.extensionRuntime }),
      restore = checkpoint();
    return () => {
      restore();
      checked++;
      expect(audit.differences()).toEqual([]);
    };
  });
  const before = result();
  expect(() => h.command('wait')).toThrow('watermark writer');
  expect(result()).toEqual(before);
  expect(checked).toBeGreaterThan(0);
  spy.mockImplementation(replace);
  h.command('wait');
  expect(campRaid(g, current(g).slot)!.excludedTicks).toBeGreaterThan(before.raid!.excludedTicks);
});
it('paid repair writer failure restores actual HP, materials, reservations and clock, then a public retry charges exactly once', () => {
  const { h, g } = residentScene(),
    component = g.world5!.structures.find(
      (s) => s.fixture?.definitionId === 'settlement.bed'
    )!.fixture!;
  withWorldActorScope(g, 'settlement', g.player.id, 'trusted-world', (scope) => {
    const p = planStructureChange(
      {
        kind: 'damage',
        componentId: component.id,
        revision: component.revision,
        amount: 25,
        damageKind: 'physical'
      },
      scope
    );
    expect(p.ok).toBe(true);
    if (p.ok) expect(commitStructureWorld(g, p.value, scope).ok).toBe(true);
  });
  g.player.loc = { x: 19, y: 13 };
  g.refreshStructureDerivedState();
  const d = g
      .extensionRuntime!.worldDefinitionPacks()
      .flatMap((p) => p.structures ?? [])
      .find((d) => d.id === component.definitionId)!,
    amount = d.maxHp - component.hp;
  const request = () => ({
    ...base(g),
    componentId: component.id,
    componentRevision: component.revision,
    amount,
    sourceContainerId: null,
    sourceRevision: null,
    materials: d.constructionCost.map((a) => ({
      ...a,
      count: Math.ceil((a.count * amount) / d.maxHp)
    }))
  });
  const state = structuredClone({
      hp: component.hp,
      items: g.player.inventory.items.map((i) => ({ id: i.id, quantity: i.quantity })),
      world: g.world5
    }),
    replace = g.extensionRuntime!.worldCampReplace.bind(g.extensionRuntime!);
  let failedAfterHp = 0;
  const spy = vi
    .spyOn(g.extensionRuntime!, 'worldCampReplace')
    .mockImplementation((owner, value) => {
      if (component.hp > state.hp) {
        failedAfterHp++;
        throw Error('repair writer');
      }
      return replace(owner, value);
    });
  expect(h.ext('settlement', 'repair', request()).error).toBe('C5_PROVIDER');
  expect(failedAfterHp).toBeGreaterThan(0);
  expect({
    hp: component.hp,
    items: g.player.inventory.items.map((i) => ({ id: i.id, quantity: i.quantity })),
    world: g.world5
  }).toEqual(state);
  spy.mockImplementation(replace);
  expect(h.ext('settlement', 'repair', request()).error).toBeNull();
  expect(component.hp).toBe(d.maxHp);
});

it('ordinary raid uses a legal paid guard post and native danger priority with one native decision per turn', () => {
  const { h, g, a } = active();
  g.player.loc = { x: 19, y: 13 };
  g.refreshStructureDerivedState();
  expect(assign(h, g, a.id, { kind: 'guard', at: { x: 19, y: 14 } }).error).toBeNull();
  const enemy = g.monsters.find((m) =>
    campRaid(g, current(g).slot)!.event!.actorIds.includes(m.id)
  )!;
  for (const m of g.monsters) if (m !== a) m.ticksUntilTurn = 100000;
  a.loc = { x: 19, y: 14 };
  a.ticksUntilTurn = 100;
  a.hp = a.maxHp = 100;
  enemy.loc = { x: 18, y: 14 };
  enemy.hp = enemy.maxHp = 100;
  g.refreshStructureDerivedState();
  expect(residentHasNativePriority(g, a)).toBe(true);
  const hp = enemy.hp,
    prepare = vi.spyOn(a, 'prepareNativeDecision');
  for (let n = 0; n < 20 && enemy.hp === hp; n++) {
    const calls = prepare.mock.calls.length;
    h.command('wait');
    expect(prepare.mock.calls.length - calls).toBeLessThanOrEqual(1);
  }
  expect(prepare).toHaveBeenCalled();
  expect(enemy.hp).toBeLessThan(hp);
  expect(residentComponent(g, a.id)!.job.kind).toBe('guard');
  expect(g.world5!.residentJobs).toHaveLength(0);
});
it('combat ordinary raid enters the existing native warning and poise pool, without treating walls as actors', () => {
  const { h, g, a } = active(['settlement', 'combat']),
    e = campRaid(g, current(g).slot)!.event!;
  const enemy = g.monsters.find((m) => e.actorIds.includes(m.id))!;
  for (const m of g.monsters) m.ticksUntilTurn = 100000;
  a.loc = { x: 26, y: 13 };
  g.player.loc = { x: 23, y: 13 };
  g.player.hp = g.player.maxHp = 1000;
  enemy.loc = { x: 24, y: 13 };
  enemy.hp = enemy.maxHp = 100;
  enemy.state = MonsterState.HUNTING;
  enemy.ticksUntilTurn = 99;
  g.refreshStructureDerivedState();
  h.command('wait');
  const warning = g.actorActions!.bundles.find((b) => b.decisionOwnerId === enemy.id)!;
  expect(warning).toBeDefined();
  expect(warning.owner).toBe('combat');
  expect(warning.subactions.some((s) => s.phases[s.phaseIndex]?.kind === 'windup')).toBe(true);
  const state = g.extensionRuntime!.actorActionBinding()!.state,
    pool = state.actors.find((r) => r.actorId === enemy.id)!;
  expect(pool.poise).toBeGreaterThan(0);
  const before = pool.poise;
  applyActorPoiseDamage(g, enemy.id, 1);
  expect(pool.poise).toBe(before - 1);
  applyActorPoiseDamage(g, enemy.id, before);
  expect(isActorStaggered(g, enemy.id)).toBe(true);
  expect(
    g
      .world5!.structures.flatMap((s) => [s.floor, s.barrier, s.roof, s.fixture])
      .filter(Boolean)
      .every((c) => !state.actors.some((r) => r.actorId === c!.id))
  ).toBe(true);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});
it.each([false, true])(
  'empty paid camp does not gain pressure or spawn pursuit, raids=%s',
  (raids) => {
    const { h, g } = setup(['settlement'], 1, 4, raids);
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    const before = g.monsters.map((m) => m.id);
    advanceWorldClock(g.world5!, 320000);
    h.command('wait');
    expect(g.monsters.map((m) => m.id)).toEqual(before);
    if (raids) {
      const r = campRaid(g, current(g).slot)!;
      expect(r.pressure).toBe(0);
      expect(r.event).toBeNull();
    } else expect(g.world5!.raidCamps).toEqual([]);
    const digest = h.digest();
    h.load(h.save());
    expect(h.digest()).toBe(digest);
  }
);

it('five real paid homes share four raid slots; frozen active waves pin slots, fifth keeps bounded pressure/reason, closure admits its original home fairly', () => {
  travelScenes();
  const { h, g } = residentScene(['settlement'], true);
  // Controlled stock/geometry preparation, then every camp is paid by the same public construction/recruitment commands.
  g.player.inventory.addItem(assembleWorldItem(itemDefinition(g, 'settlement.wood'), 99));
  g.player.inventory.addItem(assembleWorldItem(itemDefinition(g, 'settlement.wood'), 99));
  g.player.inventory.items.find((i) => i.consumableId === 'ration_of_food')!.quantity = 40;
  const homes: number[] = [];
  for (let depth = 1; depth <= 5; depth++) {
    if (depth > 1) {
      g.player.loc = { x: 30, y: 25 };
      g.refreshStructureDerivedState();
      h.command('stairs_down');
      expect(g.depth).toBe(depth);
      g.player.loc = { x: 20, y: 12 };
      g.refreshStructureDerivedState();
      bedroom(h, g);
      const c = g
        .extensionRuntime!.worldCampState('settlement')
        .camps.find((c) => c.depth === depth)!;
      const a = new Monster(20, 13, (species as MonsterData[]).find((m) => m.id === 'goblin')!);
      a.isCaged = true;
      g.monsters.push(a);
      g.extensionRuntime!.attachCreature(a);
      g.executeCommand('wait', undefined, () => g.freeCaptive(a));
      a.loc = { x: 20, y: 13 };
      a.ticksUntilTurn = 100;
      g.player.loc = { x: 19, y: 13 };
      g.refreshStructureDerivedState();
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
    }
    const c = g
      .extensionRuntime!.worldCampState('settlement')
      .camps.find((c) => c.depth === depth)!;
    homes.push(c.slot);
    const r = campRaid(g, c.slot)!;
    g.player.loc = { x: 20, y: 14 };
    g.refreshStructureDerivedState();
    advanceWorldClock(g.world5!, r.createdTick + 71000 - g.world5!.simulationTicks);
    h.command('wait');
    if (depth < 5) {
      expect(r.event!.phase).toBe('active');
      expect(r.event!.actorIds).toHaveLength(r.event!.budget);
    } else {
      expect(r.event).toBeNull();
      expect(r.admissionReason).toBe('slots');
      expect(r.report).toMatchObject({phase:'deferred',reason:'slots'});
      const view = g.extensionRuntime!.readModuleView('settlement')!.state as any;
      expect(view.raids.camps.find((row: any) => row.campId === r.campId)).toMatchObject({reason:'slots',phase:'deferred'});
      expect(r.pressure).toBeLessThanOrEqual(256);
      expect(r.lastOrdinal).toBe(0);
    }
  }
  expect(g.world5!.raidCamps.filter((r) => r.event?.phase === 'active')).toHaveLength(4);
  expect(g.world5!.raidCamps.filter((r) => r.pauseFrom !== null)).toHaveLength(4);
  const fifth = campRaid(g, homes[4]!)!,
    identity = fifth.campId;
  const saved = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(saved);
  g.player.loc = { x: 2, y: 2 };
  g.refreshStructureDerivedState();
  h.command('stairs_up');
  expect(g.depth).toBe(4);
  const fourth = campRaid(g, homes[3]!)!;
  for (const id of fourth.event!.actorIds) g.killMonster(g.monsters.find((m) => m.id === id)!);
  h.command('wait');
  expect(fourth.event!.phase).toBe('closed');
  advanceWorldClock(g.world5!, 1000);
  h.command('wait');
  const admitted = campRaid(g, homes[4]!)!;
  expect(admitted.campId).toBe(identity);
  expect(admitted.lastOrdinal).toBe(1);
  expect(admitted.event!.phase).toBe('warning');
  expect(admitted.admissionReason).toBeNull();
  expect(g.world5!.raidAdmissionCursor).toBe(identity);
  const final = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(final);
});
it('combat S1/S4: a real raid windup, locked cells and resource pool freeze intact across public stairs, long cached time and save/load; return resumes that action once', () => {
  travelScenes();
  const { h, g } = active(['settlement', 'combat']),
    r = campRaid(g, current(g).slot)!;
  const enemy = g.monsters.find((m) => m.id === r.event!.actorIds[0])!;
  for (const m of g.monsters) m.ticksUntilTurn = 100000;
  g.player.loc = { x: 30, y: 25 };
  g.player.hp = g.player.maxHp = 1000;
  enemy.loc = { x: 29, y: 25 };
  enemy.hp = enemy.maxHp = 100;
  enemy.state = MonsterState.HUNTING;
  enemy.ticksUntilTurn = 99;
  g.refreshStructureDerivedState();
  h.command('wait');
  const bundle = g.actorActions!.bundles.find((b) => b.decisionOwnerId === enemy.id)!;
  expect(bundle.subactions[0]!.phases[bundle.subactions[0]!.phaseIndex]!.kind).toBe('windup');
  const id = bundle.actionId,
    actorId = enemy.id;
  const frozen = () => ({
    bundle: g.actorActions!.bundles.find((b) => b.actionId === id),
    metadata: g
      .extensionRuntime!.actorActionBinding()!
      .state.actions.find((a) => a.actionId === id),
    pool: g.extensionRuntime!.actorActionBinding()!.state.actors.find((a) => a.actorId === actorId)
  });
  const original = structuredClone(frozen());
  g.player.loc = { x: 30, y: 25 };
  g.refreshStructureDerivedState();
  h.command('stairs_down');
  while (g.pendingCommandConfirmation)
    g.resolveCommandDecision(g.pendingCommandConfirmation.token, true);
  expect(
    g.depth,
    JSON.stringify({
      at: g.player.loc,
      pending: g.hasPendingConfirmation,
      locked: g.isInputLocked(),
      error: g.replayError,
      raid: campRaid(g, r.slot),
      bundle: g.actorActions!.bundles.find((b) => b.actionId === id)
    })
  ).toBe(2);
  expect(campRaid(g, r.slot)!.pauseFrom).not.toBeNull();
  expect(frozen()).toEqual(original);
  advanceWorldClock(g.world5!, 96000);
  h.command('wait');
  expect(frozen()).toEqual(original);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
  expect(frozen()).toEqual(original);
  const forgedTimes = [
    (r: any) => { r.event.triggerTick = r.createdTick + 1; r.event.dueTick = r.event.triggerTick + 2000; },
    (r: any) => { r.createdTick = r.event.triggerTick; },
    (r: any) => { r.event.lastAttemptTick = r.pauseFrom + 1; },
    (r: any) => { r.event.dueTick++; }
  ];
  for (const forge of forgedTimes) {
    const candidate = g.toSnapshot();
    forge(candidate.run.world5!.raidCamps[0]);
    const originalGraph = auditFullObjectGraph({ g, rt: g.extensionRuntime });
    expect(() => h.load(JSON.stringify(candidate))).toThrow();
    expect(originalGraph.differences()).toEqual([]);
    expect(frozen()).toEqual(original);
  }
  const bad = g.toSnapshot();
  bad.run.world5!.raidCamps[0]!.event = null;
  const audit = auditFullObjectGraph({ g, rt: g.extensionRuntime });
  expect(() => h.load(JSON.stringify(bad))).toThrow();
  expect(audit.differences()).toEqual([]);
  g.player.loc = { x: 2, y: 2 };
  g.refreshStructureDerivedState();
  h.command('stairs_up');
  expect(g.depth).toBe(1);
  expect(frozen()).toEqual(original);
  h.command('wait');
  const resumed = g.actorActions!.bundles.find((b) => b.actionId === id)!;
  expect(resumed).toBeDefined();
  expect(resumed.elapsedActionTicks).toBeGreaterThan(original.bundle!.elapsedActionTicks);
  expect(resumed.subactions[0]!.phaseIndex).toBeGreaterThan(
    original.bundle!.subactions[0]!.phaseIndex
  );
  expect(g.actorActions!.nextActionId).toBeGreaterThan(id);
  expect(campRaid(g, r.slot)!.event!.id).toBe(r.event!.id);
  const after = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(after);
});

it.each([['settlement'], ['settlement', 'combat'], ['settlement', 'giants'], ['settlement', 'combat', 'giants']].map(modules => ({ modules })))(
  'R1-F1 native polymorph preserves raid identity and strict references with $modules', ({ modules }) => {
    travelScenes(); const { g, h } = active(modules), r = campRaid(g, current(g).slot)!, e = r.event!;
    for (const a of g.monsters) a.ticksUntilTurn = 1000000;
    g.player.hp = g.player.maxHp = 1000;
    const enemy = g.monsters.find(a => a.id === e.actorIds[0])!, id = enemy.id, eventId = e.id;
    const born = e.actors[0]!.birthTypeId, members = [...e.actorIds];
    g.player.loc = { x: 28, y: 20 }; enemy.loc = { x: 29, y: 20 }; g.refreshStructureDerivedState();
    const wand = ItemLoader.spawnWand('wand_of_polymorphism', -1, -1)!;
    wand.charges = 10; g.player.inventory.addItem(wand);
    g.executeItemCommand('use', wand); h.command('mouse_travel', { ...enemy.loc });
    expect(enemy.typeId).not.toBe(born); expect(enemy.hp).toBeGreaterThan(0);
    expect(e.id).toBe(eventId); expect(e.actorIds).toEqual(members);
    expect(e.actors[0]).toEqual({ actorId: id, birthTypeId: born, currentTypeId: enemy.typeId, departed: null });
    exit({ g, h } as ReturnType<typeof active>);
    const economic = campEconomicTick(g, r.slot), form = enemy.typeId;
    advanceWorldClock(g.world5!, 96037); h.command('wait');
    expect(campEconomicTick(g, r.slot)).toBe(economic);
    const digest = h.digest(); h.load(h.save()); expect(h.digest()).toBe(digest);
    expect(g.departureActors().find(a => a.id === id)!.typeId).toBe(form);
    exit({ g, h } as ReturnType<typeof active>, false);
    expect(campRaid(g, r.slot)!.event!.actorIds).toEqual(members);
    const bad = g.toSnapshot(); bad.run.world5!.raidCamps[0]!.event!.actors[0]!.currentTypeId = born;
    const audit = auditFullObjectGraph({ g, rt: g.extensionRuntime });
    expect(() => h.load(JSON.stringify(bad))).toThrow(); expect(audit.differences()).toEqual([]);
    // Birth whitelist remains strict even though the registered current native form is legal.
    const badBirth = g.toSnapshot(); badBirth.run.world5!.raidCamps[0]!.event!.actors[0]!.birthTypeId = 'pink_jelly';
    expect(() => h.load(JSON.stringify(badBirth))).toThrow(); expect(audit.differences()).toEqual([]);
  }
);
it('R1-F1 native surviving fall retires only effective membership, with no death/reward/entity loss and no paused-time catch-up', () => {
  travelScenes(); const { g, h } = setup(['settlement', 'combat', 'growth'], 9, 4, true); bedroom(h, g);
  const c = current(g), resident = new Monster(20, 13, species.find(a => a.id === 'goblin') as MonsterData);
  resident.isCaged = true; g.monsters.push(resident); g.extensionRuntime!.attachCreature(resident);
  g.executeCommand('wait', undefined, () => g.freeCaptive(resident));
  resident.loc = { x: 20, y: 13 }; g.player.loc = { x: 19, y: 13 }; g.refreshStructureDerivedState();
  expect(h.ext('settlement', 'recruit', { v: 1, stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
    campId: c.regionId, campRevision: c.revision, targetId: resident.id, targetRevision: 0 }).error).toBeNull();
  g.player.loc = { x: 20, y: 14 }; g.refreshStructureDerivedState();
  advanceWorldClock(g.world5!, 71000 - g.world5!.simulationTicks); h.command('wait');
  let r = campRaid(g, c.slot)!, e = r.event!; expect(e.phase).toBe('active');
  for (const a of g.monsters) a.ticksUntilTurn = 1000000;
  g.player.hp = g.player.maxHp = 1000;
  const enemy = g.monsters.find(a => a.id === e.actorIds[0])!, id = enemy.id;
  // Exclude a genuine long cached interval first; returning does not end this event.
  g.player.loc = { x: 30, y: 25 }; g.refreshStructureDerivedState(); h.command('stairs_down'); expect(g.depth).toBe(10);
  const economic = campEconomicTick(g, c.slot);
  advanceWorldClock(g.world5!, 96037); h.command('wait'); expect(campEconomicTick(g, c.slot)).toBe(economic);
  g.player.loc = { x: 2, y: 2 }; g.refreshStructureDerivedState(); h.command('stairs_up'); expect(g.depth).toBe(9);
  r = campRaid(g, c.slot)!; e = r.event!; const excluded = r.excludedTicks;
  expect(e.phase).toBe('active'); expect(r.pauseFrom).toBeNull();
  const deaths = structuredClone(g.extensionRuntime!.snapshot()), items = g.items.map(i => i.id);
  const xp = () => (g.extensionRuntime!.snapshot().components[g.player.id]!['growth:progression'] as { experience: number }).experience;
  const xpBefore = xp(), goldBefore = g.stats.gold;
  expect(Number.isSafeInteger(xpBefore)).toBe(true);
  enemy.loc = { x: 14, y: 10 }; enemy.ticksUntilTurn = 1000000;
  g.grid.setTerrain(enemy.x, enemy.y, TerrainType.HOLE); g.refreshStructureDerivedState();
  const fallTick = g.world5!.simulationTicks; h.command('wait');
  expect(enemy.hp).toBeGreaterThan(0); expect(enemy.deathProcessed).toBe(false);
  expect(e.defeatedIds).not.toContain(id); expect(e.actors.find(a => a.actorId === id)!.departed).toEqual({ depth: 10, tick: fallTick });
  expect(e.phase).toBe('active'); expect(g.monsters).not.toContain(enemy);
  expect([...((g as any).pendingFallenByDepth as Map<number, Monster[]>).values()].flat().concat(g.levels.get(10)!.monsters)).toContain(enemy);
  expect(g.items.map(i => i.id)).toEqual(items);
  expect(g.extensionRuntime!.snapshot().foundation.deaths).toEqual(deaths.foundation.deaths);
  expect(xp()).toBe(xpBefore); expect(g.stats.gold).toBe(goldBefore);
  expect(frozenRaidActors(g)).not.toContain(id);
  const fallenSave = h.save(), digest = h.digest(); h.load(fallenSave); expect(h.digest()).toBe(digest);
  // The departed traveller must never inherit the original camp's cached-attack permission.
  g.player.loc = { x: 30, y: 25 }; g.refreshStructureDerivedState(); h.command('stairs_down');
  expect(g.depth).toBe(10); expect(campRaid(g, c.slot)!.pauseFrom).not.toBeNull();
  expect(frozenRaidActors(g)).not.toContain(id);
  expect(frozenRaidActors(g)).toContain(e.actorIds[1]);
  const arrived = g.monsters.find(a => a.id === id)!; expect(arrived).toBeDefined();
  // A later actual death on the target layer is a native death fact, distinct from the earlier fall retirement.
  g.killMonster(arrived); h.command('wait');
  expect(campRaid(g, c.slot)!.event!.defeatedIds).toContain(id);
  expect(campRaid(g, c.slot)!.event!.phase).toBe('active');
  expect(() => h.load(h.save())).not.toThrow();
  h.load(fallenSave); expect(h.digest()).toBe(digest);
  // R2: a later real native return is present again, not permanently pinned to the fall's target layer.
  g.player.loc = { x: 30, y: 25 }; g.refreshStructureDerivedState(); h.command('stairs_down');
  expect(g.depth).toBe(10); expect(g.monsters.some(a => a.id === id)).toBe(true);
  g.player.loc = { x: 2, y: 2 }; g.refreshStructureDerivedState(); h.command('stairs_up'); expect(g.depth).toBe(9);
  const source = g.levels.get(10)!, traveller = source.monsters.find(a => a.id === id);
  if (traveller) {
    // Controlled native approach-queue preparation; actual transfer occurs in the public wait's native sink.
    traveller.preplaced = false; traveller.approaching = 2; traveller.entersLevelIn = 1;
  }
  h.command('wait');
  expect(g.monsters.some(a => a.id === id && a.hp > 0 && !a.isAlly)).toBe(true);
  expect(campRaid(g, c.slot)!.event!.actors.find(a => a.actorId === id)!.departed).toBeNull();
  expect(campRaid(g, c.slot)!.event!.phase).toBe('active');
  const returned = h.digest(); h.load(h.save()); expect(h.digest()).toBe(returned);
  h.load(fallenSave); expect(h.digest()).toBe(digest);
  const alive = g.departureActors().find(a => a.id === id)!;
  expect(alive.hp).toBeGreaterThan(0); expect(alive.deathProcessed).toBe(false);
  const forged = g.toSnapshot(); forged.run.world5!.raidCamps[0]!.event!.actors.find(a => a.actorId === id)!.departed = null;
  const audit = auditFullObjectGraph({ g, rt: g.extensionRuntime });
  expect(() => h.load(JSON.stringify(forged))).toThrow(); expect(audit.differences()).toEqual([]);
  for (const actorId of campRaid(g, c.slot)!.event!.actorIds.filter(actorId => actorId !== id)) g.killMonster(g.monsters.find(a => a.id === actorId)!);
  h.command('wait'); expect(campRaid(g, c.slot)!.event!.phase).toBe('closed');
  expect(campRaid(g, c.slot)!.excludedTicks).toBe(excluded);
  expect(g.departureActors().find(a => a.id === id)).toBe(alive);
  expect(alive.hp).toBeGreaterThan(0); expect(alive.deathProcessed).toBe(false);
  const final = h.digest(); h.load(h.save()); expect(h.digest()).toBe(final);
});
it('R1-F2 same-layer return retains published report until real region entry, with zero read writes and exactly one publication', () => {
  travelScenes(); const s = residentScene(['settlement'], true), { g, h } = s, c = current(g), r = campRaid(g, c.slot)!;
  withWorldActorScope(g, 'settlement', g.player.id, 'trusted-world', scope => {
    for (const row of g.world5!.structures.filter(s => s.barrier)) {
      const part = row.barrier!, p = planStructureChange({ kind: 'damage', componentId: part.id, revision: part.revision, amount: 20, damageKind: 'physical' }, scope);
      expect(p.ok).toBe(true); if (p.ok) expect(commitStructureWorld(g, p.value, scope).ok).toBe(true);
    }
  });
  exit(s); advanceWorldClock(g.world5!, 71000 - g.world5!.simulationTicks - 100); h.command('wait');
  expect(r.event!.phase).toBe('aftermath'); expect(r.event!.damagedHp).toBeGreaterThan(0);
  const view = () => (g.extensionRuntime!.readModuleView('settlement')!.state as any).raids.camps[0];
  const old = structuredClone(view()); exit(s, false);
  expect(r.report).toBeNull(); expect(r.event!.phase).toBe('aftermath');
  const audit = auditFullObjectGraph({ g, rt: g.extensionRuntime });
  expect(view()).toEqual(old); expect(view()).toEqual(old); expect(audit.differences()).toEqual([]);
  const save = h.save(); h.load(save); expect(view()).toEqual(old);
  g.player.loc = { x: 20, y: 14 }; g.refreshStructureDerivedState(); h.command('wait');
  const published = campRaid(g, c.slot)!;
  expect(published.event!.phase).toBe('closed'); expect(view().damagedHp).toBe(published.event!.damagedHp);
  expect(view().reason).toBe('summary'); expect(view().reportedTick).toBeGreaterThan(0);
  const report = structuredClone(published.report), reportedTick = published.reportedTick;
  const reads = auditFullObjectGraph({ g, rt: g.extensionRuntime }); view(); view(); expect(reads.differences()).toEqual([]);
  h.command('wait'); expect(published.report).toEqual(report); expect(published.reportedTick).toBe(reportedTick);
});

it('R2-F1 forged departed cannot retire living camp invaders; candidate rejection preserves graph and session', () => {
  travelScenes(); const { g, h } = active(['settlement', 'combat']), c = current(g);
  for (const a of g.monsters) a.ticksUntilTurn = 1000000;
  g.player.hp = g.player.maxHp = 1000;
  const event = campRaid(g, c.slot)!.event!, ids = [...event.actorIds];
  expect(ids.every(id => g.monsters.some(a => a.id === id && a.hp > 0 && !a.isAlly))).toBe(true);
  const candidate = g.toSnapshot();
  for (const row of candidate.run.world5!.raidCamps[0]!.event!.actors)
    row.departed = { depth: c.depth + 1, tick: event.lastAttemptTick };
  const runtime = g.extensionRuntime, binding = runtime!.actorActionBinding()!, actions = g.actorActions;
  const scheduler = productionActorActionScheduler(g); expect(scheduler).toBeDefined();
  const digest = h.digest(), audit = auditFullObjectGraph({ g, rt: runtime });
  expect(() => h.load(JSON.stringify(candidate))).toThrow();
  expect(g.extensionRuntime).toBe(runtime); expect(runtime!.actorActionBinding()!.state).toBe(binding.state);
  expect(runtime!.actorActionBinding()!.definition).toBe(binding.definition);
  expect(productionActorActionScheduler(g)).toBe(scheduler);
  expect(g.actorActions).toBe(actions); expect(audit.differences()).toEqual([]); expect(h.digest()).toBe(digest);
  h.command('wait'); expect(campRaid(g, c.slot)!.event!.phase).toBe('active');
  expect(ids.every(id => g.monsters.some(a => a.id === id && a.hp > 0 && !a.isAlly))).toBe(true);
  const save = h.save(), after = h.digest(); h.load(save); expect(h.digest()).toBe(after);
});
