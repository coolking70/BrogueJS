import { expect, it, vi } from 'vitest';
import { residentScene, bedroom } from './residentHelpers';
import { current, setup } from './helpers';
import * as worldItems from '../../../../engine/Core/WorldWorkWorld';
import { scene as jobScene, assign, waitUntil } from './residentJobHelpers';
import { walk } from './helpers';
import { recordingRootRevision } from '../../../recordingRevisions';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { ItemCategory } from '../../../../engine/Items/Item';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { timeSystem } from '../../../../engine/Systems/Time';
import { logger } from '../../../../engine/Systems/Logger';
import { bindPresentationObserver } from '../../../../engine/Core/PresentationObserver';
import type { Game } from '../../../../engine/Core/Game';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';

it.each(['resident-delete', 'late-drop', 'kill-publication'] as const)(
  'AB-1: %s fault restores the complete death entry and retries once',
  (stage) => {
    const { h, g, a } = residentScene();
    const rt = g.extensionRuntime!;
    const item = ItemLoader.spawnFood('mango', a.x, a.y)!;
    a.carriedItem = item;
    const replace = rt.replaceResidentComponent.bind(rt);
    const drop = g.makeMonsterDropItem.bind(g);
    const emit = rt.emit.bind(rt);
    const faults = [
      vi.spyOn(rt, 'replaceResidentComponent').mockImplementation((...args) => {
        replace(...args);
        if (stage === 'resident-delete' && args[2] === 'resident' && args[3] === null)
          throw Error('death fault');
      }),
      vi.spyOn(g, 'makeMonsterDropItem').mockImplementation((actor) => {
        drop(actor);
        if (stage === 'late-drop') throw Error('death fault');
      }),
      vi.spyOn(rt, 'emit').mockImplementation((...args) => {
        emit(...args);
        if (stage === 'kill-publication' && args[0] === 'kill') throw Error('death fault');
      })
    ];
    const entry = h.digest(),
      random = rng.getState(),
      id = getNextEntityId();
    const dirty = [g.world5, rt, g.actorActions].map(recordingRootRevision);
    const audit = auditFullObjectGraph({ g, rt });
    expect(() => g.killMonster(a)).toThrow('death fault');
    expect(audit.differences()).toEqual([]);
    expect([g.world5, rt, g.actorActions].map(recordingRootRevision)).toEqual(dirty);
    expect(a.hp).toBeGreaterThan(0);
    expect(a.carriedItem).toBe(item);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
    expect(h.digest()).toBe(entry);
    faults.forEach((f) => f.mockRestore());
    const observed = vi.spyOn(rt, 'emit');
    g.killMonster(a);
    expect(a.deathProcessed).toBe(true);
    expect(g.world5!.residents).toHaveLength(0);
    expect(rt.residentComponent('settlement', a.id, 'source')).toBeUndefined();
    expect(g.items.filter((i) => i.id === item.id)).toEqual([item]);
    expect(observed.mock.calls.filter(([name]) => name === 'kill')).toHaveLength(1);
    const terminal = h.digest(),
      terminalId = getNextEntityId();
    g.killMonster(a);
    expect(h.digest()).toBe(terminal);
    expect(getNextEntityId()).toBe(terminalId);
    expect(observed.mock.calls.filter(([name]) => name === 'kill')).toHaveLength(1);
    h.load(h.save());
    expect(h.digest()).toBe(terminal);
  }
);

it('AB-1: a legitimately dead entry stays HP0 after failure, then public wait completes cleanup', () => {
  const { h, g, a } = residentScene();
  a.hp = 0;
  const drop = g.makeMonsterDropItem.bind(g);
  const fault = vi.spyOn(g, 'makeMonsterDropItem').mockImplementation((actor) => {
    drop(actor);
    throw Error('already dead drop');
  });
  expect(() => g.killMonster(a)).toThrow('already dead drop');
  expect(a.hp).toBe(0);
  expect(a.deathProcessed).toBe(false);
  fault.mockRestore();
  h.command('wait');
  expect(a.deathProcessed).toBe(true);
  expect(g.world5!.residents).toHaveLength(0);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});

it.each([false, true])(
  'AB-2: animation=%s blocks repeated public move/attack before effects and elapsed',
  (animated) => {
    const { h, g } = residentScene();
    const initial = g.toSnapshot();
    initial.run.world5!.simulationTicks = 31999;
    for (const l of initial.run.world5!.offline) {
      l.lastSettledTick = 31999;
      l.epochRemainder = 999;
      l.frozen.capturedTick = 31999;
    }
    h.load(JSON.stringify(initial));
    g.animationEnabled = animated;
    const enemy = g.monsters.find((a) => !a.isAlly && a.hp > 0)!;
    enemy.loc = { x: 18, y: 13 };
    enemy.ticksUntilTurn = 100000;
    g.refreshStructureDerivedState();
    const rt = g.extensionRuntime!,
      food = containerItems(g, current(g).supplyId)[0]!;
    const replace = rt.worldCampReplace.bind(rt);
    const retryEntries: { tick: number; loc: object; credit: unknown }[] = [];
    const checkpoint = g.checkpointResidentWorld.bind(g);
    vi.spyOn(g, 'checkpointResidentWorld').mockImplementation(() => {
      retryEntries.push({
        tick: g.world5!.simulationTicks,
        loc: { ...g.player.loc },
        credit: structuredClone(g.world5!.residentJobs)
      });
      return checkpoint();
    });
    const fault = vi.spyOn(rt, 'worldCampReplace').mockImplementation((owner, state) => {
      replace(owner, state);
      if (state.camps.some((c) => c.consumedLockedUnits === 1)) throw Error('pending daily fault');
    });
    if (animated) {
      g.executeCommand('wait');
      expect(g.isAdvancing).toBe(true);
      while (g.isAdvancing) g.stepAdvancement();
      expect((g.lastAdvancementError as Error).message).toBe('pending daily fault');
    } else expect(() => h.command('wait')).toThrow('pending daily fault');
    expect(g.world5!.simulationTicks).toBe(32000);
    expect(g.world5!.offline[0]!.lastSettledTick).toBe(31999);
    expect(g.player.ticksUntilTurn).toBe(100);
    const loc = { ...g.player.loc },
      random = rng.getState(),
      id = getNextEntityId();
    const combat = vi.spyOn(g as any, 'resolvePlayerMeleeAttackOn');
    // Native attacks enter through directional move against an adjacent enemy.
    // Keep the enemy alive and inspect the actual melee entry, not an invented key.
    for (const [action, data] of [
      ['move', { x: 0, y: 1 }],
      ['move', { x: -1, y: 0 }],
      ['move', { x: -1, y: 0 }]
    ] as const) {
      expect(() => g.executeCommand(action, data)).toThrow('pending daily fault');
      expect(g.player.loc).toEqual(loc);
      expect(g.world5!.simulationTicks).toBe(32000);
      expect(g.player.ticksUntilTurn).toBe(100);
      expect(food.quantity).toBe(2);
      expect(rng.getState()).toEqual(random);
      expect(getNextEntityId()).toBe(id);
    }
    const carriedFood = g.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)!;
    const inventory = [...g.player.inventory.items],
      quantity = carriedFood.quantity;
    expect(() => g.executeItemCommand('drop', carriedFood)).toThrow('C5_BUSY');
    expect(g.player.inventory.items).toEqual(inventory);
    expect(carriedFood.quantity).toBe(quantity);
    expect(getNextEntityId()).toBe(id);
    expect(g.world5!.simulationTicks).toBe(32000);
    expect(combat).not.toHaveBeenCalled();
    expect(
      retryEntries.every((e) => e.tick === 32000 && JSON.stringify(e.loc) === JSON.stringify(loc))
    ).toBe(true);
    fault.mockRestore();
    g.executeCommand('move', { x: 0, y: 1 });
    while (g.isAdvancing) g.stepAdvancement();
    expect(retryEntries[retryEntries.length - 1]!.tick).toBe(32000);
    expect(g.player.loc).toEqual({ x: loc.x, y: loc.y + 1 });
    expect(g.world5!.simulationTicks).toBe(32100);
    expect(food.quantity).toBe(1);
    expect(current(g).consumedLockedUnits).toBe(1);
    expect(g.world5!.receipts.filter((r) => r.identity.startsWith('ration.'))).toHaveLength(1);
    expect(residentComponent(g, g.world5!.residents[0]!.actorId)).not.toBeNull();
    const digest = h.digest();
    h.load(h.save());
    expect(h.digest()).toBe(digest);
  }
);

it('I15/F01: public display, recruitment No and stale quotes do not materialize legitimate unsettled needs', () => {
  const { h, g } = setup();
  bedroom(h, g);
  const id = g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId!;
  g.monsters.find((a) => a.id === id)!.loc = { x: 20, y: 13 };
  g.refreshStructureDerivedState();
  const snapshot = g.toSnapshot();
  snapshot.run.world5!.simulationTicks = 32000;
  // This controlled legal save retains the old high water: it has never attempted
  // or failed a demand commit. Opening UI and refusing a quote cannot pay it.
  h.load(JSON.stringify(snapshot));
  const world = structuredClone(g.world5),
    random = rng.getState(),
    nextId = getNextEntityId();
  const food = containerItems(g, current(g).supplyId)[0]!;
  const check = () => {
    expect(g.world5).toEqual(world);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(nextId);
    expect(containerItems(g, current(g).supplyId)[0]).toBe(food);
    expect(food.quantity).toBe(2);
  };
  h.command('toggle_inventory');
  check();
  h.command('toggle_inventory');
  check();
  const c = current(g),
    payload = {
      v: 1,
      stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
      campId: c.regionId,
      campRevision: c.revision,
      targetId: id,
      targetRevision: 0
    };
  expect(h.ext('settlement', 'recruit', payload, [false]).error).toBeNull();
  check();
  expect(h.ext('settlement', 'recruit', { ...payload, targetRevision: 1 }).error).toBe('C5_STALE');
  check();
  g.extensionRuntime!.readModuleView('settlement');
  check();
  const getter = vi.fn(() => () => 'opaque');
  const payloadWithGetter = Object.defineProperty({}, 'toString', {
    enumerable: true,
    get: getter
  });
  expect(() => g.executeCommand('ext:command', payloadWithGetter)).toThrow('C5_BUSY');
  expect(getter).not.toHaveBeenCalled();
  check();
});

it('AB-1: active job refund failure is exposed and restores escrow/scheduler before one death retry', () => {
  const { h, g, a, src, dst, plot } = jobScene();
  expect(
    assign(h, g, a.id, { kind: 'plant', plotIds: [plot], sourceId: src, destinationId: dst }).error
  ).toBeNull();
  h.command('move', { x: 0, y: -1 });
  h.command('move', { x: 0, y: -1 });
  walk(h, g, { x: 29, y: 9 });
  waitUntil(h, () => g.world5!.residentJobs[0]?.phase === 'planting');
  const job = g.world5!.residentJobs[0]!,
    seed = containerItems(g, job.cargoId)[0]!;
  const put = worldItems.putContainer;
  const fault = vi.spyOn(worldItems, 'putContainer').mockImplementation((game, id, item) => {
    put(game, id, item);
    throw Error('death refund fault');
  });
  const audit = auditFullObjectGraph({ g, rt: g.extensionRuntime }),
    digest = h.digest();
  expect(() => g.killMonster(a)).toThrow('death refund fault');
  expect(audit.differences()).toEqual([]);
  expect(h.digest()).toBe(digest);
  expect(containerItems(g, job.cargoId)[0]).toBe(seed);
  expect(job.actionId).not.toBeNull();
  fault.mockRestore();
  g.killMonster(a);
  expect(g.world5!.residentJobs).toHaveLength(0);
  expect(g.actorActions!.bundles.some((b) => b.decisionOwnerId === a.id)).toBe(false);
  expect(g.world5!.containers.some((c) => c.id === job.cargoId)).toBe(false);
  expect(
    containerItems(g, src).find((i) => i.worldItem?.definitionId === 'settlement.seed')!.quantity
  ).toBe(6);
  expect(g.world5!.receipts.filter((r) => r.identity === `resident.${job.id}`)).toHaveLength(1);
  const done = h.digest();
  g.killMonster(a);
  expect(h.digest()).toBe(done);
  h.load(h.save());
  expect(h.digest()).toBe(done);
});

it('AB-2: failed high water survives save/load and the next public input retries at b', () => {
  const { h, g } = residentScene(),
    snapshot = g.toSnapshot();
  snapshot.run.world5!.simulationTicks = 31999;
  for (const l of snapshot.run.world5!.offline) {
    l.lastSettledTick = 31999;
    l.epochRemainder = 999;
    l.frozen.capturedTick = 31999;
  }
  h.load(JSON.stringify(snapshot));
  const rt = g.extensionRuntime!,
    replace = rt.worldCampReplace.bind(rt);
  vi.spyOn(rt, 'worldCampReplace').mockImplementation((owner, state) => {
    replace(owner, state);
    if (state.camps.some((c) => c.consumedLockedUnits === 1)) throw Error('save pending fault');
  });
  expect(() => h.command('wait')).toThrow('save pending fault');
  h.load(h.save());
  expect(g.world5!.simulationTicks).toBe(32000);
  expect(g.world5!.offline[0]!.lastSettledTick).toBe(31999);
  const loc = { ...g.player.loc },
    checkpoints: number[] = [];
  const checkpoint = g.checkpointResidentWorld.bind(g);
  vi.spyOn(g, 'checkpointResidentWorld').mockImplementation(() => {
    checkpoints.push(g.world5!.simulationTicks);
    return checkpoint();
  });
  h.command('move', { x: 0, y: 1 });
  expect(checkpoints[0]).toBe(32000);
  expect(g.player.loc).toEqual({ x: loc.x, y: loc.y + 1 });
  expect(g.world5!.simulationTicks).toBe(32100);
  expect(current(g).consumedLockedUnits).toBe(1);
  expect(g.world5!.receipts.filter((r) => r.identity.startsWith('ration.'))).toHaveLength(1);
});


// AB2 uses real native inventory/target implementations in the paid camp scene.
// Boundary saves are controlled legal inputs, not a natural-route claim.
function ab2Scene(tick = 32000) {
  const result = residentScene(), snapshot = result.g.toSnapshot();
  snapshot.run.world5!.simulationTicks = tick;
  for (const ledger of snapshot.run.world5!.offline) {
    ledger.lastSettledTick = 31999;
    ledger.epochRemainder = 999;
    ledger.frozen.capturedTick = 31999;
  }
  result.h.load(JSON.stringify(snapshot));
  result.g.animationEnabled = false;
  return result;
}
function ab2Mechanical(g: Game) {
  return {
    world: structuredClone(g.world5), random: rng.getState(), id: getNextEntityId(),
    nativeTick: timeSystem.currentTick,
    player: { loc: { ...g.player.loc }, hp: g.player.hp, nutrition: g.player.nutrition },
    actors: g.monsters.map(a => ({ id: a.id, hp: a.hp, loc: { ...a.loc } })),
    inventory: g.player.inventory.items.map(i => ({ id: i.id, quantity: i.quantity, charges: i.charges })),
    floor: g.items.map(i => ({ id: i.id, quantity: i.quantity, loc: { ...i.loc } }))
  };
}
function ab2DailyFault(g: Game) {
  const rt = g.extensionRuntime!, replace = rt.worldCampReplace.bind(rt);
  return vi.spyOn(rt, 'worldCampReplace').mockImplementation((owner, state) => {
    replace(owner, state);
    if (state.camps.some(c => c.consumedLockedUnits === 1)) throw Error('daily fault');
  });
}
function ab2Dart(g: Game) {
  return g.player.inventory.items.find(i => i.category === ItemCategory.WEAPON && i.quantity > 1)!;
}

it('AB2: real perform throw cannot peel items, allocate IDs, roll RNG or pay native time before failed needs', () => {
  const { h, g } = ab2Scene(31999), fault = ab2DailyFault(g);
  expect(() => h.command('wait')).toThrow('daily fault');
  const dart = ab2Dart(g), before = ab2Mechanical(g);
  for (let n = 0; n < 2; n++) {
    expect(() => g.executeItemCommand('throw', dart, undefined, () => g.throwItemAt(dart, 22, 13)))
      .toThrow('daily fault');
    expect(ab2Mechanical(g)).toEqual(before);
  }
  const valuable = g.player.equippedWeapon!;
  g.onConfirmRequest = () => true;
  try {
    expect(() => g.executeItemCommand('throw', valuable, undefined, () => g.throwItemAt(valuable, 22, 13)))
      .toThrow('daily fault');
    expect(ab2Mechanical(g)).toEqual(before);
    expect(g.player.equippedWeapon).toBe(valuable);
    g.executeItemCommand('throw', dart);
    expect(g.isThrowing).toBe(true);
    expect(() => h.command('mouse_travel', { x: 22, y: 13 })).toThrow('daily fault');
    expect(ab2Mechanical(g)).toEqual(before);
  } finally { g.onConfirmRequest = null; fault.mockRestore(); }
});

it.each(['help', 'discoveries'] as const)('AB2: %s directions/close stay pure before the next accepted move', pane => {
  const { h, g } = ab2Scene(), before = ab2Mechanical(g);
  const food = containerItems(g, current(g).supplyId)[0]!;
  h.command(pane);
  expect(g.referenceScreen).toBe(pane);
  h.command('move', { x: 0, y: 1 });
  expect(g.referenceScreen).toBe(pane);
  expect(ab2Mechanical(g)).toEqual(before);
  h.command('escape');
  expect(g.referenceScreen).toBeNull();
  expect(ab2Mechanical(g)).toEqual(before);
  const checkpoint = g.checkpointResidentWorld.bind(g), entries: { tick: number; loc: object }[] = [];
  vi.spyOn(g, 'checkpointResidentWorld').mockImplementation(() => {
    entries.push({ tick: g.world5!.simulationTicks, loc: { ...g.player.loc } });
    return checkpoint();
  });
  h.command('move', { x: 0, y: 1 });
  expect(entries[0]).toEqual({ tick: 32000, loc: before.player.loc });
  expect(food.quantity).toBe(1);
  expect(g.world5!.simulationTicks).toBe(32100);
});

it.each([false, true])('AB2: original valuable throw confirmation No is pure, perform=%s', perform => {
  const { h, g } = ab2Scene(), valuable = g.player.equippedWeapon!;
  expect(valuable.quantity).toBe(1);
  if (!perform) {
    g.executeItemCommand('throw', valuable);
    expect(g.isThrowing).toBe(true);
  }
  const before = ab2Mechanical(g), confirm = vi.fn(() => false);
  g.onConfirmRequest = confirm;
  try {
    if (perform) g.executeItemCommand('throw', valuable, undefined, () => g.throwItemAt(valuable, 22, 13));
    else h.command('mouse_travel', { x: 22, y: 13 });
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(g.isThrowing).toBe(false);
    expect(ab2Mechanical(g)).toEqual(before);
  } finally { g.onConfirmRequest = null; }
});

it('AB2: real throw target preparation and cancellation stay pure', () => {
  const { h, g } = ab2Scene(), before = ab2Mechanical(g);
  g.executeItemCommand('throw', ab2Dart(g));
  expect(g.isThrowing).toBe(true);
  h.command('escape');
  expect(g.isThrowing).toBe(false);
  expect(ab2Mechanical(g)).toEqual(before);
});

it('AB2: ACK and presentation barrier block real item perform without settling needs', () => {
  const { g } = ab2Scene();
  logger.presentAcknowledgments(() => true);
  try {
    logger.log('controlled ACK', '#ffffff', { acknowledge: true });
    expect(logger.pendingAcknowledgment).toBeDefined();
    const before = ab2Mechanical(g), dart = ab2Dart(g);
    g.executeItemCommand('throw', dart, undefined, () => g.throwItemAt(dart, 22, 13));
    expect(ab2Mechanical(g)).toEqual(before);
    logger.acknowledgeNext();
    expect(ab2Mechanical(g)).toEqual(before);
    logger.presentAcknowledgments(null);
    const unbind = bindPresentationObserver(g, { observe() {}, reset() {}, blocked: () => true });
    try {
      g.executeItemCommand('throw', dart, undefined, () => g.throwItemAt(dart, 22, 13));
      expect(ab2Mechanical(g)).toEqual(before);
    } finally { unbind(); }
  } finally { logger.presentAcknowledgments(null); }
});

it('AB2/F2: late death publication restores original logger arrays and folded rows in place', () => {
  const { h, g } = ab2Scene(31999);
  const a = g.monsters.find(m => m.id === g.world5!.residents[0]!.actorId)!;
  logger.log('controlled identity', '#ffffff');
  const rt = g.extensionRuntime!, emit = rt.emit.bind(rt);
  const fault = vi.spyOn(rt, 'emit').mockImplementation((...args) => {
    emit(...args);
    if (args[0] === 'kill') {
      logger.log('controlled identity', '#ffffff');
      throw Error('late kill');
    }
  });
  const audit = auditFullObjectGraph({ logger }), array = logger.messages, rows = [...array];
  expect(() => g.killMonster(a)).toThrow('late kill');
  expect(audit.differences()).toEqual([]);
  expect(logger.messages).toBe(array);
  rows.forEach((row, i) => expect(logger.messages[i]).toBe(row));
  fault.mockRestore();
  g.killMonster(a);
  expect(a.deathProcessed).toBe(true);
  h.load(h.save());
});

it('AB2: recovery settles at the old boundary before exactly one real perform throw and survives save/load', () => {
  const { h, g } = ab2Scene(31999), fault = ab2DailyFault(g);
  expect(() => h.command('wait')).toThrow('daily fault');
  fault.mockRestore();
  const dart = ab2Dart(g), quantity = dart.quantity, nativeTick = timeSystem.currentTick;
  const checkpoint = g.checkpointResidentWorld.bind(g);
  const entries: { tick: number; quantity: number; nativeTick: number }[] = [];
  vi.spyOn(g, 'checkpointResidentWorld').mockImplementation(() => {
    entries.push({ tick: g.world5!.simulationTicks, quantity: dart.quantity, nativeTick: timeSystem.currentTick });
    return checkpoint();
  });
  g.executeItemCommand('throw', dart, undefined, () => g.throwItemAt(dart, 22, 13));
  expect(entries[0]).toEqual({ tick: 32000, quantity, nativeTick });
  expect(dart.quantity).toBe(quantity - 1);
  expect(g.world5!.simulationTicks).toBe(32100);
  expect(current(g).consumedLockedUnits).toBe(1);
  expect(g.world5!.receipts.filter(r => r.identity.startsWith('ration.'))).toHaveLength(1);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});

it('AB2: actual public staff target preparation, cursor direction and cancellation stay pure', () => {
  const { h, g } = ab2Scene(), staff = ItemLoader.spawnStaff('staff_of_lightning', -1, -1)!;
  expect(g.player.inventory.addItem(staff)).toBeTruthy();
  const before = ab2Mechanical(g);
  g.executeItemCommand('use', staff);
  expect(g.pendingArcana?.item).toBe(staff);
  h.command('move', { x: 1, y: 0 });
  expect(ab2Mechanical(g)).toEqual(before);
  h.command('cancel_target');
  expect(g.pendingArcana).toBeNull();
  expect(ab2Mechanical(g)).toEqual(before);
});

it('AB2: actual confirm_target settles before staff charge, effect and native time', () => {
  const { h, g } = ab2Scene(), staff = ItemLoader.spawnStaff('staff_of_lightning', -1, -1)!;
  expect(g.player.inventory.addItem(staff)).toBeTruthy();
  // Native preparation constructs the real target mode; public preparation has
  // its own regression above. Saving the controlled added item clears the mode.
  g.useArcanaItem(staff);
  expect(g.pendingArcana?.item).toBe(staff);
  expect(g.setArcanaTarget(23, 10)).toBe(true);
  const before = ab2Mechanical(g), fault = ab2DailyFault(g);
  expect(() => h.command('confirm_target')).toThrow('daily fault');
  expect(ab2Mechanical(g)).toEqual(before);
  fault.mockRestore();
});
