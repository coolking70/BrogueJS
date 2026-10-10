// External, controlled review probes; run via phase5-xreview.repro.mjs.
// __REPO_ROOT__ is replaced only in the temporary copy. Production files are not changed.
import { it, expect } from 'vitest';
import { residentScene } from '__REPO_ROOT__/src/ext/modules/settlement/tests/residentHelpers';
import {
  current,
  base,
  build,
} from '__REPO_ROOT__/src/ext/modules/settlement/tests/helpers';
import { payload } from '__REPO_ROOT__/src/ext/modules/settlement/tests/residentProductionHelpers';
import {
  residentOrder,
  residentOrderTicket,
} from '__REPO_ROOT__/src/engine/Core/ResidentOrders';
import { advanceWorldClock } from '__REPO_ROOT__/src/ext/world5';
import { settleResidentNeeds } from '__REPO_ROOT__/src/engine/Core/ResidentNeeds';
it('XR-01 completed order destination dismantle must remain saveable', () => {
  const { h, g, a } = residentScene();
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'build', build(g, 'chest', { x: 20, y: 15 })).error,
  ).toBeNull();
  const chest = g.world5!.containers.find(
    (b) => b.kind === 'chest' && b.id !== current(g).supplyId,
  )!;
  a.loc = { x: 20, y: 13 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'order-work', {
      ...payload(g, a.id, 'settlement.hunt', 1),
      destinationId: chest.id,
      destinationRevision: chest.revision,
    }).error,
  ).toBeNull();
  residentOrder(g, a.id)!.production!.paidTicks = 1000;
  advanceWorldClock(g.world5!, 1000 - (g.world5!.simulationTicks % 1000));
  settleResidentNeeds(g);
  advanceWorldClock(g.world5!, 1000);
  settleResidentNeeds(g);
  expect(residentOrderTicket(g, a.id)).toBeUndefined();
  expect(residentOrder(g, a.id)?.stopReason).toBe('completed');
  expect(() => h.save()).not.toThrow();
  const comp = g.world5!.structures.find(
    (s) => s.fixture?.definitionId === 'settlement.chest',
  )!.fixture!;
  const result = h.ext('settlement', 'dismantle', {
    ...base(g),
    componentId: comp.id,
    componentRevision: comp.revision,
  });
  console.log(
    'XR-01 dismantle',
    result.error,
    'remainingOrder',
    JSON.stringify(residentOrder(g, a.id)),
    'boxExists',
    g.world5!.containers.some((b) => b.id === chest.id),
  );
  expect(result.error).toBeNull();
  expect(() => h.save()).not.toThrow();
});

import {
  campRaid,
  finishRaidEvents,
} from '__REPO_ROOT__/src/engine/Core/SettlementRaids';
import { settleActorNeeds } from '__REPO_ROOT__/src/engine/Core/ActorNeeds';
import { settleDepartures } from '__REPO_ROOT__/src/engine/Core/ActorDeparture';
it('XR-02 dominated raid ally hungry retirement must not leave raid reference', () => {
  const { h, g } = residentScene(['settlement', 'foraging'], true);
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  advanceWorldClock(g.world5!, 71000 - g.world5!.simulationTicks);
  h.command('wait');
  for (
    let n = 0;
    n < 40 && campRaid(g, current(g).slot)!.event?.phase !== 'active';
    n++
  )
    h.command('wait');
  const raid = campRaid(g, current(g).slot)!;
  expect(raid.event?.phase).toBe('active');
  expect(raid.event!.actorIds.length).toBeGreaterThan(1);
  const ally = g.monsters.find((a) => a.id === raid.event!.actorIds[0])!;
  g.becomeAllyWith(ally);
  finishRaidEvents(g);
  expect(raid.event!.phase).toBe('active');
  expect(
    g
      .extensionRuntime!.snapshot()
      .foundation.actorNeeds!.rows.some((r) => r.actorId === ally.id),
  ).toBe(true);
  expect(() => h.save()).not.toThrow();
  advanceWorldClock(g.world5!, 392100);
  settleActorNeeds(g, true);
  advanceWorldClock(g.world5!, 2100);
  settleDepartures(g);
  finishRaidEvents(g);
  for (const id of raid.event!.actorIds.filter((id) => id !== ally.id)) {
    const enemy = g.monsters.find((a) => a.id === id);
    if (enemy) g.killMonster(enemy);
  }
  finishRaidEvents(g);
  console.log(
    'XR-02 ally present',
    g.departureActors().some((a) => a.id === ally.id),
    'raid',
    JSON.stringify(raid.event),
  );
  expect(g.departureActors().some((a) => a.id === ally.id)).toBe(false);
  expect(() => h.save()).not.toThrow();
  expect(raid.event!.phase).toBe('closed');
});

import { add } from '__REPO_ROOT__/src/ext/modules/settlement/tests/helpers';
import { containerItems } from '__REPO_ROOT__/src/engine/Core/WorldWorkWorld';
it('CONTROL online multi-batch resident crafting facts count each physical batch', () => {
  const { h, g, a } = residentScene(['settlement', 'crafting']);
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('crafting', 'place-station', {
      v: 1,
      definitionId: 'crafting.table',
      x: 20,
      y: 15,
      inventoryStamp: base(g).inventoryStamp,
    }).error,
  ).toBeNull();
  const station = g.world5!.stations.find(
    (s) => s.definitionId === 'crafting.table',
  )!;
  add(g, 'crafting.wood', 12);
  const wood = g.player.inventory.items.find(
    (i) => i.worldItem?.definitionId === 'crafting.wood',
  )!;
  g.player.loc = { x: 22, y: 12 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'transfer', {
      ...base(g),
      containerId: current(g).supplyId,
      containerRevision: g.world5!.containers.find(
        (b) => b.id === current(g).supplyId,
      )!.revision,
      items: [{ itemId: wood.id, quantity: 12 }],
      direction: 'deposit',
    }).error,
  ).toBeNull();
  g.player.loc = { x: 20, y: 14 };
  a.loc = { x: 20, y: 13 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'order-work', {
      ...payload(g, a.id, 'crafting.make-chest-kit', 2),
      stationId: station.interactableId,
      stationRevision: station.revision,
    }).error,
  ).toBeNull();
  for (let n = 0; n < 40; n++) h.command('wait');
  const kits = containerItems(g, current(g).supplyId)
    .filter((i) => i.worldItem?.definitionId === 'crafting.kit-chest')
    .reduce((n, i) => n + i.quantity, 0);
  const state = g.extensionRuntime!.snapshot().modules.crafting as any;
  console.log(
    'crafting evidence',
    kits,
    'totals',
    state.totals,
    'history',
    state.history.filter((f: any) => f.operation === 'craft-batch'),
  );
  expect(kits).toBe(2);
  expect(() => h.save()).not.toThrow();
  expect(state.totals.craftBatches).toBe(kits);
});

import { travelScenes } from '__REPO_ROOT__/src/ext/modules/settlement/tests/helpers';
it('XR-03 offline resident crafting facts count each physical batch', () => {
  travelScenes();
  const { h, g, a } = residentScene(['settlement', 'crafting']);
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('crafting', 'place-station', {
      v: 1,
      definitionId: 'crafting.table',
      x: 20,
      y: 15,
      inventoryStamp: base(g).inventoryStamp,
    }).error,
  ).toBeNull();
  const station = g.world5!.stations.find(
    (s) => s.definitionId === 'crafting.table',
  )!;
  add(g, 'crafting.wood', 24);
  const wood = g.player.inventory.items.find(
    (i) => i.worldItem?.definitionId === 'crafting.wood',
  )!;
  g.player.loc = { x: 22, y: 12 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'transfer', {
      ...base(g),
      containerId: current(g).supplyId,
      containerRevision: g.world5!.containers.find(
        (b) => b.id === current(g).supplyId,
      )!.revision,
      items: [{ itemId: wood.id, quantity: 24 }],
      direction: 'deposit',
    }).error,
  ).toBeNull();
  g.player.loc = { x: 20, y: 14 };
  a.loc = { x: 20, y: 13 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'order-work', {
      ...payload(g, a.id, 'crafting.make-chest-kit', 4),
      stationId: station.interactableId,
      stationRevision: station.revision,
    }).error,
  ).toBeNull();
  const supplyId = current(g).supplyId;
  for (let n = 0; n < 2; n++) h.command('wait');
  g.player.loc = { x: 30, y: 25 };
  g.refreshStructureDerivedState();
  h.command('stairs_down');
  expect(g.depth).toBe(2);
  advanceWorldClock(g.world5!, 4000);
  h.command('wait');
  const kits = containerItems(g, supplyId)
    .filter((i) => i.worldItem?.definitionId === 'crafting.kit-chest')
    .reduce((n, i) => n + i.quantity, 0);
  const state = g.extensionRuntime!.snapshot().modules.crafting as any;
  console.log(
    'crafting evidence',
    kits,
    'totals',
    state.totals,
    'history',
    state.history.filter((f: any) => f.operation === 'craft-batch'),
  );
  expect(kits).toBe(4);
  expect(() => h.save()).not.toThrow();
  expect(state.totals.craftBatches).toBe(kits);
});
