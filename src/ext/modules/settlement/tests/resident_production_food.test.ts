import { it, expect, vi } from 'vitest';
import { residentScene } from './residentHelpers';
import { current, base, build, add, travelScenes, walk } from './helpers';
import { payload } from './residentProductionHelpers';
import { residentOrder } from '../../../../engine/Core/ResidentOrders';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { assembleEdibleItem } from '../../../../engine/Core/KindKnowledge';
import { ItemCategory } from '../../../../engine/Items/Item';
import { advanceWorldClock } from '../../../world5';
import { settleResidentNeeds } from '../../../../engine/Core/ResidentNeeds';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { c5Hash } from '../../../../engine/Core/WorldCanonical';
function cooking(modules = ['settlement']) {
  const s = residentScene(modules),
    { h, g } = s;
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  expect(h.ext('settlement', 'build', build(g, 'hearth', { x: 20, y: 15 })).error).toBeNull();
  g.player.loc = { x: 22, y: 12 };
  g.refreshStructureDerivedState();
  return {
    ...s,
    station: g.world5!.stations.find((s) => s.definitionId === 'settlement.hearth-station')!
  };
}
it.each([
  ['crop', 3],
  ['meat', 2]
] as const)(
  'chef consumes %s real escrow and outputs ordinary FOOD without peers',
  (ingredient, count) => {
    const { h, g, a, station } = cooking();
    add(g, 'settlement.' + ingredient, count);
    const item = g.player.inventory.items.find(
      (i) => i.worldItem?.definitionId === 'settlement.' + ingredient
    )!;
    expect(
      h.ext('settlement', 'transfer', {
        ...base(g),
        containerId: current(g).supplyId,
        containerRevision: g.world5!.containers.find((b) => b.id === current(g).supplyId)!.revision,
        items: [{ itemId: item.id, quantity: count }],
        direction: 'deposit'
      }).error
    ).toBeNull();
    g.player.loc = { x: 20, y: 14 };
    a.loc = { x: 20, y: 13 };
    g.refreshStructureDerivedState();
    const p = {
      ...payload(g, a.id, 'settlement.cook-' + ingredient, 1),
      stationId: station.interactableId,
      stationRevision: station.revision
    };
    const beforeFood = containerItems(g, current(g).supplyId)
      .filter((i) => i.category === ItemCategory.FOOD)
      .reduce((n, i) => n + i.quantity, 0);
    expect(h.ext('settlement', 'order-work', p).error).toBeNull();
    expect(containerItems(g, current(g).supplyId).some((i) => i.id === item.id)).toBe(false);
    for (let n = 0; n < 40; n++) h.command('wait');
    expect(residentOrder(g, a.id)?.stopReason).toBe('completed');
    const food = containerItems(g, current(g).supplyId).filter(
      (i) => i.category === ItemCategory.FOOD
    );
    expect(food.reduce((n, i) => n + i.quantity, 0)).toBe(beforeFood + 1);
    expect(
      food.every((i) => i.consumableId === 'ration_of_food' && !i.worldItem && i.enchantment === 0)
    ).toBe(true);
    const digest = h.digest();
    h.load(h.save());
    expect(h.digest()).toBe(digest);
  }
);
it('mixed raw/roasted mushrooms qualify by tags, char fails, no knowledge or food effects', () => {
  const { h, g, a, station } = cooking(['settlement', 'foraging']);
  const before = g.extensionRuntime!.snapshot().foundation.kindKnowledge;
  g.player.inventory.addItem(assembleEdibleItem(g, 'foraging.venom', 2));
  g.player.inventory.addItem(assembleEdibleItem(g, 'foraging.prism-roasted', 3));
  g.player.inventory.addItem(assembleEdibleItem(g, 'foraging.char', 1));
  for (const item of g.player.inventory.items.filter((i) =>
    i.worldItem?.definitionId.startsWith('foraging.')
  )) {
    expect(
      h.ext('settlement', 'transfer', {
        ...base(g),
        containerId: current(g).supplyId,
        containerRevision: g.world5!.containers.find((b) => b.id === current(g).supplyId)!.revision,
        items: [{ itemId: item.id, quantity: item.quantity }],
        direction: 'deposit'
      }).error
    ).toBeNull();
  }
  g.player.loc = { x: 20, y: 14 };
  a.loc = { x: 20, y: 13 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'order-work', {
      ...payload(g, a.id, 'settlement.cook-mushroom', 1),
      stationId: station.interactableId,
      stationRevision: station.revision
    }).error
  ).toBeNull();
  for (let n = 0; n < 40; n++) h.command('wait');
  expect(
    containerItems(g, current(g).supplyId)
      .filter((i) => i.worldItem?.definitionId.startsWith('foraging.'))
      .map((i) => i.worldItem!.definitionId)
  ).toEqual(['foraging.char']);
  expect(g.extensionRuntime!.snapshot().foundation.kindKnowledge).toEqual(before);
  expect(a.hasStatus('poisoned') || a.hasStatus('hallucinating')).toBe(false);
  const order = residentOrder(g, a.id)!,
    r = g.extensionRuntime!.residentComponent<any>('settlement', a.id, 'resident')!,
    c = current(g);
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'resupply-work', {
      v: 1,
      stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
      campId: c.regionId,
      campRevision: c.revision,
      targetId: a.id,
      targetRevision: r.revision,
      orderId: order.id,
      orderRevision: order.revision,
      sourceRevision: g.world5!.containers.find((b) => b.id === c.supplyId)!.revision,
      destinationRevision: g.world5!.containers.find((b) => b.id === c.supplyId)!.revision,
      stationRevision: station.revision,
      plotRevisions: [],
      inventoryStamp: base(g).inventoryStamp
    }).error
  ).toBe('C5_INPUT');
});
it('cached hunter is finite and whole/2/17 commits preserve all roots, IDs, RNG and receipts', () => {
  const { h, g, a } = residentScene();
  travelScenes();
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'order-work', payload(g, a.id, 'settlement.hunt', 16)).error
  ).toBeNull();
  g.player.loc = { x: 22, y: 13 };
  g.refreshStructureDerivedState();
  walk(h, g, { x: 30, y: 25 });
  h.command('stairs_down');
  expect(g.depth).toBe(2);
  const original = h.save(),
    start = g.world5!.simulationTicks;
  const cuts = Array.from({ length: 17 }, (_, i) => start + (i + 1) * 2000);
  cuts[16] = 1000000000;
  const run = (segments: number) => {
    h.load(original);
    for (let i = 0; i < cuts.length; i++) {
      advanceWorldClock(g.world5!, cuts[i]! - g.world5!.simulationTicks);
      if (segments === 17 || (segments === 2 && i === 8)) settleResidentNeeds(g);
    }
    settleResidentNeeds(g);
    const s = g.toSnapshot(),
      id = getNextEntityId(),
      random = rng.getState(),
      digest = h.digest();
    h.load(JSON.stringify(s));
    expect(h.digest()).toBe(digest);
    return {
      world: s.run.world5,
      extensions: s.extensions,
      items: s.entityGraph.items,
      id,
      random,
      digest
    };
  };
  const whole = run(1),
    two = run(2);

  expect(c5Hash(JSON.parse(JSON.stringify(two)))).toBe(c5Hash(JSON.parse(JSON.stringify(whole))));
  expect(c5Hash(JSON.parse(JSON.stringify(run(17))))).toBe(
    c5Hash(JSON.parse(JSON.stringify(whole)))
  );
  expect(whole.world!.orders).toHaveLength(0); // four-day starvation retires, refunds, and releases the order.
});
it('provider failures restore the complete prepare object graph including references, IDs and random', () => {
  const { h, g, a } = residentScene(['settlement', 'crafting']);
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  const rt = g.extensionRuntime!,
    query = rt.queryOptional.bind(rt);
  vi.spyOn(rt, 'queryOptional').mockImplementation((capability, input) => {
    if (capability === 'crafting.recipe-catalog.v1') {
      g.world5!.nextPlanId++;
      g.player.hp--;
      throw Error('catalog fault');
    }
    return query(capability, input);
  });
  const audit = auditFullObjectGraph({ g, rt }),
    id = getNextEntityId(),
    random = rng.getState();
  expect(h.ext('settlement', 'order-work', payload(g, a.id)).error).not.toBeNull();
  // Command entry transient flags can change; the pure provider cannot retain its writes.
  expect(g.player.hp).toBe(30);
  expect(g.world5!.nextPlanId).toBe(1);
  expect(getNextEntityId()).toBe(id);
  expect(rng.getState()).toEqual(random);
  expect(audit.differences().filter((d) => d.includes('hp') || d.includes('nextPlanId'))).toEqual(
    []
  );
});
it.each([
  ['settlement', 'crafting'],
  ['settlement', 'crafting', 'foraging']
])('registered offlineEligible crafting recipe actually produces with %j', (...modules) => {
  const { h, g, a } = residentScene(modules);
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('crafting', 'place-station', {
      v: 1,
      definitionId: 'crafting.table',
      x: 20,
      y: 15,
      inventoryStamp: base(g).inventoryStamp
    }).error
  ).toBeNull();
  const station = g.world5!.stations.find((s) => s.definitionId === 'crafting.table')!;
  add(g, 'crafting.wood', 6);
  const wood = g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'crafting.wood')!;
  g.player.loc = { x: 22, y: 12 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'transfer', {
      ...base(g),
      containerId: current(g).supplyId,
      containerRevision: g.world5!.containers.find((b) => b.id === current(g).supplyId)!.revision,
      items: [{ itemId: wood.id, quantity: 6 }],
      direction: 'deposit'
    }).error
  ).toBeNull();
  g.player.loc = { x: 20, y: 14 };
  a.loc = { x: 20, y: 13 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'order-work', {
      ...payload(g, a.id, 'crafting.make-chest-kit', 1),
      stationId: station.interactableId,
      stationRevision: station.revision
    }).error
  ).toBeNull();
  if (modules.length === 2) {
    const rt = g.extensionRuntime!,
      module = (rt as any).modules.find((m: any) => m.id === 'crafting');
    residentOrder(g, a.id)!.production!.paidTicks = 1000;
    advanceWorldClock(g.world5!, 1000 - (g.world5!.simulationTicks % 1000));
    // Existing crafting participants deliberately tolerate bad deliveries. A
    // failed real runtime writer must still poison the production transaction.
    const writer = vi.spyOn(module, 'validateState').mockReturnValue(false);
    const audit = auditFullObjectGraph({ g, rt }),
      random = rng.getState(),
      id = getNextEntityId(),
      tick = g.world5!.simulationTicks;
    expect(() => settleResidentNeeds(g)).toThrow('C5_PROVIDER');
    expect(audit.differences()).toEqual([]);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
    expect(g.world5!.simulationTicks).toBe(tick);
    writer.mockRestore();
    settleResidentNeeds(g);
  }
  for (let n = 0; n < 40; n++) h.command('wait');
  expect(
    containerItems(g, current(g).supplyId).some(
      (i) => i.worldItem?.definitionId === 'crafting.kit-chest' && i.quantity === 1
    )
  ).toBe(true);
  expect((g.extensionRuntime!.snapshot().modules.crafting as any).totals.craftBatches).toBe(1);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});
it('cached chef completes the same paid ticket with real escrow and returns physical ordinary rations', () => {
  const { h, g, a, station } = cooking();
  travelScenes();
  add(g, 'settlement.crop', 3);
  const crop = g.player.inventory.items.find(
    (i) => i.worldItem?.definitionId === 'settlement.crop'
  )!;
  expect(
    h.ext('settlement', 'transfer', {
      ...base(g),
      containerId: current(g).supplyId,
      containerRevision: g.world5!.containers.find((b) => b.id === current(g).supplyId)!.revision,
      items: [{ itemId: crop.id, quantity: 3 }],
      direction: 'deposit'
    }).error
  ).toBeNull();
  g.player.loc = { x: 20, y: 14 };
  a.loc = { x: 20, y: 13 };
  g.refreshStructureDerivedState();
  const dst = current(g).supplyId,
    before = containerItems(g, dst)
      .filter((i) => i.category === ItemCategory.FOOD)
      .reduce((n, i) => n + i.quantity, 0);
  expect(
    h.ext('settlement', 'order-work', {
      ...payload(g, a.id, 'settlement.cook-crop', 1),
      stationId: station.interactableId,
      stationRevision: station.revision
    }).error
  ).toBeNull();
  const ticket = residentOrder(g, a.id)!.ticketId;
  // Controlled from-save geometry moves the observer, retaining the actual
  // resident, input escrow and public order. Stairs use the normal command.
  g.player.loc = { x: 30, y: 25 };
  g.refreshStructureDerivedState();
  h.command('stairs_down');
  expect(g.depth).toBe(2);
  expect(g.world5!.tickets.find((t) => t.ticketId === ticket)!.completedBatches).toBe(0);
  advanceWorldClock(g.world5!, 4000);
  settleResidentNeeds(g);
  expect(residentOrder(g, a.id)?.stopReason).toBe('completed');
  expect(
    containerItems(g, dst)
      .filter((i) => i.category === ItemCategory.FOOD)
      .reduce((n, i) => n + i.quantity, 0)
  ).toBe(before + 1);
  expect(g.world5!.tickets.some((t) => t.ticketId === ticket)).toBe(false);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});
