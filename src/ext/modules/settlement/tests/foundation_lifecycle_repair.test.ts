/** Controlled lifecycle combinations through real command/retirement/physical production paths.
 * Map/clock preparation is explicit; these are engine regressions, not UI acceptance. */
import { it, expect, vi, afterEach } from 'vitest';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import { residentScene as nativeResidentScene } from './residentHelpers';
import { foundationContractHarness, foundationNeedOwner, foundationCraftId } from '../../../../test/fixtures/foundationOptionalContent';
const residentScene = (modules = ['settlement'], raids = false) => nativeResidentScene(modules, raids, foundationContractHarness);
import { current, base, build, add, travelScenes } from './helpers';
import { payload } from './residentProductionHelpers';
import { residentOrder, residentOrderTicket } from '../../../../engine/Core/ResidentOrders';
import { advanceWorldClock } from '../../../world5';
import { settleResidentNeeds } from '../../../../engine/Core/ResidentNeeds';
import { campRaid, finishRaidEvents } from '../../../../engine/Core/SettlementRaids';
import { settleActorNeeds } from '../../../../engine/Core/ActorNeeds';
import { beginDeparture, settleDepartures } from '../../../../engine/Core/ActorDeparture';
import { peekEdibleState } from '../../../../engine/Core/EdibleState';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { advanceStructureFire } from '../../../../engine/Map/StructureWorld';
import { TerrainType } from '../../../../engine/Map/Grid';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { getNextEntityId } from '../../../../entities/Creature';
import { createHeadlessGame } from '../../../../test/harness';
import { ExtensionRegistry } from '../../../registry';
import * as catalog from '../../../catalog';
import { LightKind } from '../../../../engine/Map/LightCatalog';
import { ItemCategory } from '../../../../engine/Items/Item';
afterEach(() => vi.restoreAllMocks());
const count = (g: ReturnType<typeof residentScene>['g'], definition: string) =>
  [...g.worldContainerItems!.values(), ...g.items, ...g.player.inventory.items]
    .filter(i => i.worldItem?.definitionId === definition).reduce((n, i) => n + i.quantity, 0);
const boundary = (g: ReturnType<typeof residentScene>['g']) => {
  advanceWorldClock(g.world5!, 1000 - g.world5!.simulationTicks % 1000);
  settleResidentNeeds(g);
};

it.each(['before-output', 'pending-output', 'delivered'] as const)(
  'XR-01 %s same source/destination burned through the common destruction path', phase => {
    const { h, g, a } = residentScene();
    g.player.loc = { x: 20, y: 14 }; g.refreshStructureDerivedState();
    expect(h.ext('settlement', 'build', build(g, 'chest', { x: 20, y: 15 })).error).toBeNull();
    const chest = g.world5!.containers.find(b => b.kind === 'chest' && b.id !== current(g).supplyId)!;
    a.loc = { x: 20, y: 13 }; g.refreshStructureDerivedState();
    expect(h.ext('settlement', 'order-work', {
      ...payload(g, a.id, 'settlement.hunt', 1), sourceId: chest.id, sourceRevision: chest.revision,
      destinationId: chest.id, destinationRevision: chest.revision
    }).error).toBeNull();
    if (phase !== 'before-output') { residentOrder(g, a.id)!.production!.paidTicks = 1000; boundary(g); }
    if (phase === 'delivered') boundary(g);
    const expected = phase === 'before-output' ? 0 : 1;
    if (phase === 'pending-output') expect(count(g, 'settlement.meat')).toBe(0);
    if (phase === 'delivered') expect(residentOrderTicket(g, a.id)).toBeUndefined();
    const row = g.world5!.structures.find(s => s.fixture?.definitionId === 'settlement.chest')!;
    const componentId = row.fixture!.id;
    // Controlled native fire, every objective block uses the actual damage rule.
    for (let n = 0; n < 100 && g.world5!.structures.some(s => s.fixture?.id === componentId); n++) {
      g.grid.setTerrain(row.at.x, row.at.y, TerrainType.PLAIN_FIRE); advanceStructureFire(g);
    }
    expect(g.world5!.containers.some(b => b.id === chest.id)).toBe(false);
    expect(residentOrder(g, a.id)).toBeUndefined();
    expect(() => h.save()).not.toThrow();
    if (phase === 'pending-output') expect(count(g, 'settlement.meat')).toBe(0);
    boundary(g); boundary(g);
    expect(count(g, 'settlement.meat')).toBe(expected);
    h.load(h.save()); boundary(g);
    expect(count(g, 'settlement.meat')).toBe(expected);
  }
);

function crafting(batches: number, raids = false, wideWork = false) {
  const s = residentScene(['settlement', 'crafting'], raids), { h, g, a } = s;
  g.player.loc = { x: 20, y: 14 }; g.refreshStructureDerivedState();
  expect(h.ext('crafting', 'place-station', { v: 1, definitionId: foundationCraftId('crafting.table'), x: 20, y: 15,
    inventoryStamp: base(g).inventoryStamp }).error).toBeNull();
  const station = g.world5!.stations.find(s => s.definitionId === foundationCraftId('crafting.table'))!;
  add(g, foundationCraftId('crafting.wood'), batches * 6);
  const wood = g.player.inventory.items.find(i => i.worldItem?.definitionId === foundationCraftId('crafting.wood'))!;
  g.player.loc = { x: 22, y: 12 }; g.refreshStructureDerivedState();
  expect(h.ext('settlement', 'transfer', { ...base(g), containerId: current(g).supplyId,
    containerRevision: g.world5!.containers.find(b => b.id === current(g).supplyId)!.revision,
    items: [{ itemId: wood.id, quantity: batches * 6 }], direction: 'deposit' }).error).toBeNull();
  g.player.loc = { x: 20, y: 14 }; a.loc = { x: 20, y: 13 }; g.refreshStructureDerivedState();
  if (wideWork) {
 const c=current(g),r=residentComponent(g,a.id)!;
 expect(h.ext('settlement','set-schedule',{v:1,stateRevision:g.extensionRuntime!.worldCampState('settlement').revision,
  campId:c.regionId,campRevision:c.revision,targetId:a.id,targetRevision:r.revision,schedule:[30,1,1]}).error).toBeNull();
  }
  expect(h.ext('settlement', 'order-work', { ...payload(g, a.id, foundationCraftId('crafting.make-chest-kit'), batches),
    stationId: station.interactableId, stationRevision: station.revision }).error).toBeNull();
  return { ...s, station };
}
it.each(['pending-output', 'delivered'] as const)('XR-01 station dismantle at %s preserves exact outputs/refunds', phase => {
  const { h, g, a } = residentScene();
  g.player.loc = { x: 20, y: 14 }; g.refreshStructureDerivedState();
  expect(h.ext('settlement','build',build(g,'hearth',{x:20,y:15})).error).toBeNull();
  const station = g.world5!.stations.find(s=>s.definitionId==='settlement.hearth-station')!;
  add(g,'settlement.meat',2);const meat=g.player.inventory.items.find(i=>i.worldItem?.definitionId==='settlement.meat')!;
  g.player.loc={x:22,y:12};g.refreshStructureDerivedState();
  expect(h.ext('settlement','transfer',{...base(g),containerId:current(g).supplyId,
    containerRevision:g.world5!.containers.find(b=>b.id===current(g).supplyId)!.revision,
    items:[{itemId:meat.id,quantity:2}],direction:'deposit'}).error).toBeNull();
  g.player.loc={x:20,y:14};a.loc={x:20,y:13};g.refreshStructureDerivedState();
  const foods=()=>[...g.worldContainerItems!.values(),...g.player.inventory.items,...g.items]
    .filter(i=>i.category===ItemCategory.FOOD).reduce((n,i)=>n+i.quantity,0), initialFood=foods();
  expect(h.ext('settlement','order-work',{...payload(g,a.id,'settlement.cook-meat',1),
    stationId:station.interactableId,stationRevision:station.revision}).error).toBeNull();
  residentOrder(g, a.id)!.production!.paidTicks = 1000; boundary(g);
  if (phase === 'delivered') boundary(g);
  const comp = g.world5!.structures.find(s => s.fixture?.id === station.boundComponentId)!.fixture!;
  expect(h.ext('settlement', 'dismantle', { ...base(g), componentId: comp.id,
    componentRevision: comp.revision }).error).toBeNull();
  expect(residentOrder(g, a.id)).toBeUndefined();
  const woodAfterDismantle = count(g, 'settlement.wood');
  expect(() => h.save()).not.toThrow();
  boundary(g); boundary(g); h.load(h.save()); boundary(g);
  expect(foods()).toBe(initialFood + 1);expect(count(g,'settlement.meat')).toBe(0);
  expect(count(g, 'settlement.wood')).toBe(woodAfterDismantle);
});

it.each([true, false])('XR-02 real hungry ally retirement visible=%s, witness, strict negatives and economic recovery', visible => {
  travelScenes();
  const { h, g } = residentScene(['settlement', 'foraging'], true);
  g.player.loc = { x: 20, y: 14 }; g.refreshStructureDerivedState();
  advanceWorldClock(g.world5!, 71000 - g.world5!.simulationTicks); h.command('wait');
  for (let n = 0; n < 40 && campRaid(g, current(g).slot)!.event?.phase !== 'active'; n++) h.command('wait');
  let raid = campRaid(g, current(g).slot)!;
  expect(raid.event!.actorIds.length).toBeGreaterThan(1);
  const id = raid.event!.actorIds[0]!, ally = g.monsters.find(a => a.id === id)!;
  const killStats = structuredClone(g.stats), gold = g.stats.gold;
  const deaths = vi.spyOn(g.extensionRuntime!, 'captureDeath');
  g.becomeAllyWith(ally); finishRaidEvents(g);
  expect(raid.event!.phase).toBe('active');
  ally.loc = visible ? { x: 20, y: 13 } : { x: 60, y: 20 };
  g.grid.getCell(ally.x, ally.y)!.isVisible = visible;
  advanceWorldClock(g.world5!, 392100); settleActorNeeds(g, true);
  expect(g.departureActors().some(a => a.id === id)).toBe(visible);
  if (visible) { advanceWorldClock(g.world5!, 2100); settleDepartures(g); }
  expect(g.departureActors().some(a => a.id === id)).toBe(false);
  expect(ally.hp).toBeGreaterThan(0); expect(ally.deathProcessed).toBe(false);
  expect(g.stats).toEqual(killStats); expect(g.stats.gold).toBe(gold); expect(deaths).not.toHaveBeenCalled();
  const row = raid.event!.actors.find(a => a.actorId === id)!;
  expect(row.departed).toBeNull(); expect(row.retired).not.toBeNull();
  expect(raid.event!.defeatedIds).not.toContain(id);
  expect(row.retired).toMatchObject({ owner: foundationNeedOwner(), reason: expect.any(String), tick: expect.any(Number) });
  expect(peekEdibleState(g.extensionRuntime!).departures!.receipts).toContainEqual({
    ...row.retired!, actorId: id, result: 'retired'
  });
  finishRaidEvents(g); expect(raid.event!.phase).toBe('active');
  if (visible) {
    // Later authoritative departures must age out unrelated receipts without
    // losing the still-active raid's non-kill witness. No ledger injection.
    for (let n = 0; n < 129; n++) {
      // (60,20) is occupied by the initial scene's unrelated live kobold.
      // Reuse an actually empty native floor cell; each retirement must clear it.
      expect(g.getMonsterAt(60, 21)).toBeUndefined();
      const other = g.createRaidMonster(ally.typeId, { x: 60, y: 21 });
      expect(other).not.toBeNull(); g.becomeAllyWith(other!);
      beginDeparture(g, other!.id, { owner: foundationNeedOwner(), reason: row.retired!.reason, visibleGraceTicks: 0 });
      expect(g.departureActor(other!.id)).toBeUndefined();
    }
    expect(peekEdibleState(g.extensionRuntime!).departures!.receipts).toHaveLength(128);
    expect(peekEdibleState(g.extensionRuntime!).departures!.receipts).toContainEqual({
      ...row.retired!, actorId: id, result: 'retired'
    });
    expect(g.stats).toEqual(killStats); expect(deaths).not.toHaveBeenCalled();
  }
  if (!visible) {
    const other = g.createRaidMonster(ally.typeId, { x: 60, y: 21 });
    expect(other).not.toBeNull(); g.becomeAllyWith(other!);
    beginDeparture(g, other!.id, { owner: foundationNeedOwner(), reason: row.retired!.reason, visibleGraceTicks: 0 });
    expect(g.departureActor(other!.id)).toBeUndefined();
  }
  const unrelated = peekEdibleState(g.extensionRuntime!).departures!.receipts.find(r => r.actorId !== id)!;
  expect(unrelated).toBeDefined();
  const saved = g.toSaveSnapshot();
  for (const mutation of ['missing', 'departed', 'owner', 'reason', 'time', 'ordinal', 'receipt', 'live', 'defeated', 'old-world', 'old-foundation', 'old-module', 'fake-actor', 'unrelated-receipt', 'fake-region']) {
    const bad = structuredClone(saved), event = bad.run.world5!.raidCamps[0]!.event!, r = event.actors.find(a => a.actorId === id)!;
    if (mutation === 'missing') r.retired = null;
    if (mutation === 'departed') { r.retired = null; r.departed = { depth: 2, tick: g.world5!.simulationTicks }; }
    if (mutation === 'owner') r.retired!.owner = 'settlement';
    if (mutation === 'reason') r.retired!.reason += '-forged';
    if (mutation === 'time') r.retired!.tick++;
    if (mutation === 'ordinal') r.retired!.ordinal++;
    if (mutation === 'receipt') bad.extensions!.foundation.departures!.receipts = [];
    if (mutation === 'fake-actor') {
      const fake = bad.run.nextEntityId - 1;
      expect(fake).not.toBe(id); r.actorId = fake;
      event.actorIds = event.actorIds.map(actorId => actorId === id ? fake : actorId);
    }
    if (mutation === 'unrelated-receipt') {
      const { actorId: _other, result: _result, ...receipt } = unrelated;
      r.retired = { ...receipt };
    }
    if (mutation === 'fake-region') {
      const camp = bad.run.world5!.raidCamps[0]!;
      camp.campId = Math.max(...bad.extensions!.foundation.world.regions!.map(r => r.id)) + 1;
      event.id = `raid.${camp.campId}.${event.ordinal}`;
    }
    if (mutation === 'live') {
      const other = event.actors.find(a => a.actorId !== id)!;
      other.retired = { ...r.retired!, ordinal: r.retired!.ordinal + 1 };
      const departures = bad.extensions!.foundation.departures!;
      departures.nextOrdinal = other.retired.ordinal + 1;
      departures.receipts.push({ ...other.retired, actorId: other.actorId, result: 'retired' });
    }
    if (mutation === 'defeated') event.defeatedIds.push(id);
    if (mutation === 'old-world') (bad.run.world5 as any).schema = 4;
    if (mutation === 'old-foundation') (bad.extensions!.foundation as any).version = 13;
    if (mutation === 'old-module') bad.extensions!.manifest.modules.find(m=>m.id==='settlement')!.version='1.3.0';
    const rt = g.extensionRuntime, w = g.world5, before = h.digest(), random = rng.getState(), allocator = getNextEntityId();
    expect(() => h.load(JSON.stringify(bad)), mutation).toThrow();
    expect(g.extensionRuntime).toBe(rt); expect(g.world5).toBe(w); expect(h.digest()).toBe(before);
    expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(allocator);
  }
  h.load(JSON.stringify(saved)); raid = campRaid(g, current(g).slot)!;
  expect(raid.event!.actors.find(a => a.actorId === id)!.retired).toEqual(row.retired);
  for (const enemyId of raid.event!.actorIds.filter(a => a !== id)) {
    const enemy = g.monsters.find(a => a.id === enemyId); if (enemy) g.killMonster(enemy);
  }
  finishRaidEvents(g); expect(raid.event!.phase).toBe('closed');
  const beforeEconomy = g.world5!.offline[0]!.lastSettledTick;
  g.player.loc = { x: 30, y: 25 }; g.refreshStructureDerivedState(); h.command('stairs_down');
  expect(g.depth).toBe(2); advanceWorldClock(g.world5!, 1000); h.command('wait');
  expect(g.world5!.offline[0]!.lastSettledTick).toBeGreaterThan(beforeEconomy);
  expect(g.world5!.raidCamps[0]!.pauseFrom).toBeNull(); expect(() => h.save()).not.toThrow();
});

it.each([{ batches: 1, offline: false }, { batches: 4, offline: false }, { batches: 4, offline: true }])(
  'XR-03 physical batch facts $batches offline=$offline, exact ordinal and repeat settlement', ({ batches, offline }) => {
    travelScenes(); const { h, g, a } = crafting(batches), supplyId = current(g).supplyId;
    h.command('wait'); h.command('wait');
    const ticketId = residentOrder(g, a.id)!.ticketId;
    if (offline) {
      g.player.loc = { x: 30, y: 25 }; g.refreshStructureDerivedState(); h.command('stairs_down');
      expect(g.depth).toBe(2); advanceWorldClock(g.world5!, 4000); h.command('wait');
    } else for (let n = 0; n < 60; n++) h.command('wait');
    const physical = () => containerItems(g, supplyId).filter(i => i.worldItem?.definitionId === foundationCraftId('crafting.kit-chest')).reduce((n, i) => n + i.quantity, 0);
    expect(physical()).toBe(batches);
    const facts = g.worldWorkFacts!.filter(f => f.ticketId === ticketId && f.operation === 'craft-batch');
    expect(facts.map(f => f.completionOrdinal)).toEqual(Array.from({ length: batches }, (_, i) => i + 1));
    expect(facts.map(f => f.completedBatches)).toEqual(Array.from({ length: batches }, (_, i) => i + 1));
    const state = () => g.extensionRuntime!.snapshot().modules.crafting as any;
    expect(state().totals.craftBatches).toBe(batches);
    expect(g.world5!.terminalTickets.find(t => t.ticketId === ticketId)!.completedBatches).toBe(batches);
    const expected = structuredClone(state()); h.load(h.save()); settleResidentNeeds(g); settleResidentNeeds(g);
    expect(state()).toEqual(expected); expect(physical()).toBe(batches);
    expect(() => h.save()).not.toThrow();
  }
);

function extensionFixture(handler: (context: any) => unknown) {
  const registry = new ExtensionRegistry();
  registry.register('atomic', '1.0.0', () => ({ id: 'atomic', version: '1.0.0', initialState: () => ({}),
    validateState: (x): x is any => !!x && typeof x === 'object', commands: { fail: (_p, c) => handler(c) } }));
  vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
  const g = createHeadlessGame(717, 'test'); g.startNewGame({ seed: 717, mode: 'test', ruleSet: 'extended', extensions: ['atomic'] });
  g.animationEnabled = false; while (logger.pendingAcknowledgment) logger.acknowledgeNext();
  return { g, input: JSON.stringify({ module: 'atomic', action: 'fail', payload: null }) };
}
it('ORIGIN receipt preserves original thrown object, preprocessor automation, hover and recorder prefix', () => {
  const original = Object.freeze({ problem: 'original' });
  const { g, input } = extensionFixture(c => { c.setState({ changed: true }); c.randomInt(1, 9); c.message('buffered'); throw original; });
  g.executeCommand('search_long');
  g.hoveredCell = { ...g.player.loc }; g.hoveredText = 'controlled hover';
  const before = g.toSaveSnapshot(), random = rng.getState(), automation = (g as any).autoAction,
    cursor = g.recordedInputEvents.length, hovered = g.hoveredCell;
  try { g.executeCommand('ext:command', input); expect.unreachable(); } catch (error) { expect(error).toBe(original); }
  expect(g.hasCompleteRecording).toBe(true); expect(g.canExportRecording).toBe(true);
  const after = g.toSaveSnapshot(); after.savedAt = before.savedAt;
  expect(after).toEqual(before); expect(rng.getState()).toEqual(random);
  expect((g as any).autoAction).toBe(automation); expect(g.hoveredCell).toBe(hovered); expect(g.hoveredText).toBe('controlled hover');
  expect(g.recordedInputEvents).toHaveLength(cursor);
});
it.each(['async', 'native', 'unknown', 'publication', 'unowned-flare'] as const)('ORIGIN %s stays fail closed and throws original failure', kind => {
  const original = new Error('original failure');
  const { g, input } = extensionFixture(c => {
    c.setState({ changed: true });
    if (kind === 'async') return Promise.resolve();
    if (kind === 'native') c.executeAction({ actorId: c.playerId, action: 'wait', target: { kind: 'self' } }, {
      beforeCommit() {}, afterResolve() { throw original; }
    });
    if (kind === 'publication') { c.message('published then failed'); return; }
    throw original;
  });
  if (kind === 'unowned-flare') g.createFlare(g.player.x, g.player.y, LightKind.SCROLL_ENCHANTMENT_LIGHT);
  if (kind === 'publication') vi.spyOn(logger, 'log').mockImplementation(() => { g.player.hp--; throw original; });
  if (kind === 'unknown') vi.spyOn(g.extensionRuntime!, 'command').mockImplementation(() => { throw original; });
  const command = input;
  expect(() => g.executeCommand('ext:command', command)).toThrow();
  expect(g.hasCompleteRecording).toBe(false); expect(g.canExportRecording).toBe(false);
  expect(g.toSaveSnapshot().run.recordingOrigin).toBeUndefined();
});

it.each([false, true])('VISIBILITY ordinary snapshot normalization remembers no knowledge and consumes no RNG, flare=%s', flare => {
  const g = createHeadlessGame(717, 'test'); g.animationEnabled = false;
  while (logger.pendingAcknowledgment) logger.acknowledgeNext();
  if (flare) { g.createFlare(g.player.x, g.player.y, LightKind.SCROLL_ENCHANTMENT_LIGHT); g.tickFlareAnimation(10); }
  // Commit the actual flare knowledge before testing the ordinary cleanup boundary.
  g.toSnapshot();
  const before = g.toSnapshot(), random = rng.getState(), messages = logger.getState();
  const food = g.player.inventory.items.find(i => i.category === ItemCategory.FOOD)!;
  expect(food).toBeDefined();
  const cell = g.grid.getCell(1, 1)!; cell.isVisible = !cell.isVisible;
  const after = g.toSnapshot(); after.savedAt = before.savedAt;
  expect(after).toEqual(before); expect(rng.getState()).toEqual(random); expect(logger.getState()).toEqual(messages);
});

it.each([false,true])('XR-03 four physical batches across day boundary/raid pause, raid=%s',raids=>{
 travelScenes();
 const {h,g,a}=crafting(4,raids,true),supply=current(g).supplyId,ticket=residentOrder(g,a.id)!.ticketId;
 advanceWorldClock(g.world5!,(raids?71000:31900)-g.world5!.simulationTicks);h.command('wait');
 if(raids){
  for(let n=0;n<40&&campRaid(g,current(g).slot)!.event?.phase!=='active';n++)h.command('wait');
  const raid=campRaid(g,current(g).slot)!;expect(raid.event!.phase).toBe('active');
  for(const id of raid.event!.actorIds)g.departureActor(id)!.ticksUntilTurn=1000000;
  g.player.loc={x:30,y:25};g.refreshStructureDerivedState();h.command('stairs_down');expect(g.depth).toBe(2);
  expect(campRaid(g,current(g).slot)!.pauseFrom).not.toBeNull();
  const progress=structuredClone(residentOrder(g,a.id)!.production),facts=structuredClone(g.worldWorkFacts),totals=structuredClone((g.extensionRuntime!.snapshot().modules.crafting as any).totals);
  advanceWorldClock(g.world5!,32000);h.command('wait');
  expect(residentOrder(g,a.id)!.production).toEqual(progress);expect(g.worldWorkFacts).toEqual(facts);
  expect((g.extensionRuntime!.snapshot().modules.crafting as any).totals).toEqual(totals);
  const saved=h.save(),digest=h.digest();h.load(saved);expect(h.digest()).toBe(digest);
  g.player.loc={x:2,y:2};g.refreshStructureDerivedState();h.command('stairs_up');expect(g.depth).toBe(1);
  for(const id of campRaid(g,current(g).slot)!.event!.actorIds){const enemy=g.departureActor(id);if(enemy)g.killMonster(enemy);}
  finishRaidEvents(g);expect(campRaid(g,current(g).slot)!.event!.phase).toBe('closed');
  const actor=g.departureActor(a.id)!;g.player.loc={x:actor.x,y:actor.y+1};g.refreshStructureDerivedState();
  const o=residentOrder(g,a.id)!,r=residentComponent(g,a.id)!,c=current(g),box=g.world5!.containers.find(b=>b.id===supply)!;
  expect(o.status).toBe('stopped');expect(o.stopReason).toBe('danger');
  expect(h.ext('settlement','resupply-work',{v:1,stateRevision:g.extensionRuntime!.worldCampState('settlement').revision,
   campId:c.regionId,campRevision:c.revision,targetId:a.id,targetRevision:r.revision,orderId:o.id,orderRevision:o.revision,
   sourceRevision:box.revision,destinationRevision:box.revision,stationRevision:g.world5!.stations.find(s=>s.interactableId===o.production!.stationId)!.revision,
   plotRevisions:[],inventoryStamp:base(g).inventoryStamp}).error).toBeNull();
  expect(residentOrder(g,a.id)!.ticketId).toBe(ticket);
 }
 for(let n=0;n<120&&residentOrder(g,a.id)?.ticketId!==null;n++)h.command('wait');
 for(let n=0;n<15;n++)h.command('wait');
 expect(containerItems(g,supply).filter(i=>i.worldItem?.definitionId===foundationCraftId('crafting.kit-chest')).reduce((n,i)=>n+i.quantity,0),JSON.stringify({order:residentOrder(g,a.id),actor:g.departureActor(a.id)?.ticksUntilTurn,clock:g.world5!.simulationTicks,raid:campRaid(g,current(g).slot),needs:g.world5!.offline[0]!.residentStates})).toBe(4);
 const batches=g.worldWorkFacts!.filter(f=>f.operation==='craft-batch'&&f.ticketId===ticket);
 expect(batches.map(f=>[f.completionOrdinal,f.completedBatches])).toEqual([[1,1],[2,2],[3,3],[4,4]]);
 expect((g.extensionRuntime!.snapshot().modules.crafting as any).totals.craftBatches).toBe(4);
 expect(g.world5!.terminalTickets.find(t=>t.ticketId===ticket)!.completedBatches).toBe(4);
 const final=h.digest();h.load(h.save());settleResidentNeeds(g);settleResidentNeeds(g);expect(h.digest()).toBe(final);
});
