import { expect, it, vi } from 'vitest';
import { loadLootPack } from '../definitions';
import { buildEffectiveLootCatalog } from '../catalog';
import { lootWorkProvider, reforgeCandidates } from '../work';
import { deriveNativeFacts, validateLootItemData } from '../item';
import type { LootItemDataV1 } from '../types';
import {
  arena,
  add,
  game,
  harness,
  read,
  place,
  amount,
  staged
} from '../../crafting/tests/runtimeHelpers';
import { workItemStamp } from '../../../../engine/Core/WorldWorkItems';
import { assembleDropItem } from '../../../../engine/Items/FixedItemAssembly';
import { rng } from '../../../../engine/Random';
import { prepareWorldWorkCommand } from '../../../../engine/Core/WorldWork';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { readLootGameView } from '../gameView';
import { timeSystem } from '../../../../engine/Systems/Time';
const c = buildEffectiveLootCatalog(loadLootPack(), { growth: null, combat: null, giants: null });
const provider = lootWorkProvider(() => c, 'standard');
const random = { beginItem: () => {}, randomInt: (lo: number) => lo };
function data(n = 2): LootItemDataV1 {
  return {
    v: 5,
    baseId: 'leather_armor',
    ilvl: 20,
    rarity: n === 2 ? 'runeword' : 'normal',
    uniqueId: null,
    setId: null,
    pieceId: null,
    identityKnown: false,
    affixes: [],
    corrupted: false,
    enhancement: 0,
    sockets: n,
    socketed: n === 2 ? ['loot.rune.ka', 'loot.rune.ul'] : Array(n).fill('loot.rune.ka'),
    nameParts: null,
    origin: { source: 'floor', depth: 14 }
  };
}
function equipment(g: ReturnType<typeof game>, d = data()) {
  const n = deriveNativeFacts(d, c);
  const item = assembleDropItem({
    native: {
      kind: n.kind,
      category: n.category,
      enchantment: 0,
      runicType: n.runicType,
      isCursed: n.isCursed,
      identified: n.identified,
      familiarityRemaining: 999
    },
    moduleData: { loot: JSON.parse(JSON.stringify(d)) }
  });
  expect(g.player.inventory.addItem(item)).toBe(true);
  g.extensionRuntime!.bindItemData(item);
  return item;
}
function safeArena(g: ReturnType<typeof game>) {
  const monsters = g.monsters,
    dormant = g.dormantMonsters;
  arena(g);
  g.monsters = monsters;
  g.dormantMonsters = dormant;
  for (const m of monsters) m.ticksUntilTurn = 1000000;
}
function scene(g: ReturnType<typeof game>) {
  safeArena(g);
  add(g, 'stone', 6);
  add(g, 'metal', 4);
  add(g, 'loot.shard', 40);
  equipment(g, data(4));
}
function open() {
  const h = harness({ modules: ['loot', 'crafting'], mode: 'easy' }),
    g = game(h);
  scene(g);
  expect(place(h, 'forge').error).toBeNull();
  expect(g.world5!.stations.some((s) => s.definitionId === 'crafting.forge')).toBe(true);
  return { g, h };
}
function payload(h: ReturnType<typeof harness>, operationId = 'loot.work.unsocket-all') {
  const g = game(h),
    item = g.player.inventory.items.find(
      (i) => i.moduleData?.loot && (i.moduleData.loot as any).socketed.length
    )!,
    s = read(h).stations.find((s) => s.tags.includes('station.forge'))!;
  return {
    operationId,
    itemId: item.id,
    itemRevision: workItemStamp(item),
    stationId: s.interactableId,
    stationRevision: s.revision,
    inventoryStamp: read(h).inventoryStamp
  };
}
it.each([1, 2, 4])(
  'unsocket all %i is one atomic operation with literal cost, time and materials',
  (n) => {
    const d = data(n),
      input = {
        kind: 'operation' as const,
        operationId: 'loot.work.unsocket-all',
        data: JSON.parse(JSON.stringify(d))
      };
    expect(provider.prepare(input)).toEqual({
      inputs: [{ itemDefinitionId: 'loot.shard', count: 10 * n }],
      outputs:
        n === 2
          ? [
              { itemDefinitionId: 'loot.rune.ka', count: 1 },
              { itemDefinitionId: 'loot.rune.ul', count: 1 }
            ]
          : [{ itemDefinitionId: 'loot.rune.ka', count: n }],
      workTicks: 100 * n
    });
    const p = provider.commit(input, {
      beginItem: () => {},
      randomInt: () => {
        throw Error('No RNG');
      }
    });
    expect(p).toMatchObject({
      kind: 'update',
      data: { rarity: 'normal', socketed: [], identityKnown: false }
    });
    expect(validateLootItemData(p.data, c)).toBe(true);
    expect(d.socketed).toHaveLength(n);
  }
);
it('last removes just the terminal rune, keeps base secrets and reforge can become worse', () => {
  const d = data(),
    p = provider.commit(
      {
        kind: 'operation',
        operationId: 'loot.work.unsocket-last',
        data: JSON.parse(JSON.stringify(d))
      },
      random
    );
  expect(p.data).toMatchObject({
    socketed: ['loot.rune.ka'],
    rarity: 'normal',
    identityKnown: false
  });
  const affix = c.affixes.find(
      (a) => a.polarity === 1 && a.rune === null && a.itemClasses.includes('armor')
    )!,
    tier = affix.tiers.find((t) => t.tier === 1)!;
  const m: LootItemDataV1 = {
    ...data(0),
    rarity: 'magic',
    identityKnown: true,
    affixes: [{ id: affix.id, tier: 1, values: tier.ranges.map((r) => r[1]), known: true }]
  };
  expect(reforgeCandidates(m, 0, c).length).toBeGreaterThan(0);
  const result = provider.commit(
    {
      kind: 'operation',
      operationId: 'loot.work.reforge',
      rowId: affix.id,
      data: JSON.parse(JSON.stringify(m))
    },
    random
  );
  expect(validateLootItemData(result.data, c)).toBe(true);
  expect(result.data).toMatchObject({ rarity: 'magic', identityKnown: true, enhancement: 0 });
  for (const bad of [{ ...m, identityKnown: false }, { ...m, rarity: 'unique' }, d])
    expect(() =>
      provider.prepare({
        kind: 'operation',
        operationId: 'loot.work.reforge',
        rowId: affix.id,
        data: JSON.parse(JSON.stringify(bad))
      })
    ).toThrow();
});
it.each(['normal', 'magic'] as const)('craft fixed base, known and bounded %s', (maxRarity) => {
  for (let n = 0; n < 100; n++) {
    const p = provider.commit(
      {
        kind: 'craft',
        baseId: 'dagger',
        recipeId: 'crafting.forge-dagger',
        depth: 20,
        maxRarity,
        rarityFindBp: 10000
      },
      { beginItem: () => {}, randomInt: (lo, hi) => (n % 2 ? hi : lo) }
    );
    expect(p.kind).toBe('create');
    expect(validateLootItemData(p.data, c)).toBe(true);
    expect(p.data).toMatchObject({
      baseId: 'dagger',
      identityKnown: true,
      corrupted: false,
      enhancement: 0,
      origin: { source: 'craft', depth: 20, recipeId: 'crafting.forge-dagger' }
    });
    expect(['normal', ...(maxRarity === 'magic' ? ['magic'] : [])]).toContain(
      (p.data as any).rarity
    );
  }
});
it('real forge construction, No/Yes, 400 ticks, same object, 40 shards and four retained runes', () => {
  const { h, g } = open(),
    p = payload(h),
    target = g.player.inventory.items.find((i) => i.id === p.itemId)!,
    tick = timeSystem.currentTick;
  target.enchantment = -2;
  target.strengthRequired = 17;
  target.isCursed = true;
  p.itemRevision = workItemStamp(target);
  p.inventoryStamp = read(h).inventoryStamp;
  expect(h.ext('loot', 'item-operation', p, [false]).error).toBeNull();
  expect(timeSystem.currentTick).toBe(tick);
  expect(h.ext('loot', 'item-operation', p, [true]).error).toBeNull();
  expect(timeSystem.currentTick - tick).toBe(400);
  expect(g.player.inventory.items).toContain(target);
  expect(target).toMatchObject({
    enchantment: -2,
    strengthRequired: 17,
    isCursed: true,
    identified: false
  });
  expect(target.moduleData!.loot).toMatchObject({ socketed: [], rarity: 'normal' });
  expect(amount(h, 'loot.shard')).toBe(0);
  expect(amount(h, 'loot.rune.ka')).toBe(4);
  expect(g.world5!.tickets).toEqual([]);
  expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({
    kind: 'item-operation',
    completedBatches: 1,
    totalBatches: 1,
    status: 'completed'
  });
  const snapshot = g.toSnapshot();
  expect(
    g.loadSnapshot(snapshot, (message) => {
      throw Error(message);
    })
  ).toBe(true);
  const before = timeSystem.currentTick;
  h.ext('loot', 'item-operation', p);
  expect(timeSystem.currentTick).toBe(before);
});
it('pure preparation and 100 UI reads preserve graph and reject stale/equipped/extra/batch payloads without cost', () => {
  const { h, g } = open(),
    p = payload(h),
    target = g.player.inventory.items.find((i) => i.id === p.itemId)!;
  readLootGameView(g, target.id, []);
  const audit = auditFullObjectGraph([g, rng]);
  for (let i = 0; i < 100; i++) {
    expect(
      prepareWorldWorkCommand(
        g,
        JSON.stringify({ module: 'loot', action: 'item-operation', payload: p })
      ).outcome.ok
    ).toBe(true);
    readLootGameView(g, target.id, []);
  }
  expect(audit.differences()).toEqual([]);
  for (const invalid of [
    { ...p, itemRevision: 'stale' },
    { ...p, batchCount: 2 },
    { ...p, cost: 0 },
    { ...p, rowId: 'loot.affix.keen' }
  ]) {
    const tick = timeSystem.currentTick;
    expect(h.ext('loot', 'item-operation', invalid).error).not.toBeNull();
    expect(timeSystem.currentTick).toBe(tick);
  }
});
it('completion provider failure restores full target and materials but retains all paid work', () => {
  const { h, g } = open(),
    p = payload(h),
    target = g.player.inventory.items.find((i) => i.id === p.itemId)!,
    before = structuredClone(target.moduleData),
    tick = timeSystem.currentTick;
  vi.spyOn(g.extensionRuntime!, 'commitWorkItem').mockImplementation(() => {
    rng.randRange(1, 100);
    throw Error('completion injection');
  });
  h.ext('loot', 'item-operation', p);
  expect(timeSystem.currentTick - tick).toBe(400);
  expect(g.player.inventory.items).toContain(target);
  expect(target.moduleData).toEqual(before);
  expect(amount(h, 'loot.shard')).toBe(40);
  expect(amount(h, 'loot.rune.ka')).toBe(0);
  expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({
    status: 'cancelled',
    completedBatches: 0
  });
  expect(
    g.loadSnapshot(g.toSnapshot(), (message) => {
      throw Error(message);
    })
  ).toBe(true);
});
it.each([false, true])(
  'forge craft soft provider %s, two batches survive save/load and terminal no reissue',
  (loot) => {
    const h = harness({ modules: ['crafting', ...(loot ? ['loot'] : [])], mode: 'easy' }),
      g = game(h);
    safeArena(g);
    add(g, 'stone', 6);
    add(g, 'metal', 12);
    add(g, 'wood', 2);
    expect(place(h, 'forge').error).toBeNull();
    const s = read(h).stations.find((s) => s.tags.includes('station.forge'))!,
      before = new Set(g.player.inventory.items.map((i) => i.id));
    expect(
      h.ext('crafting', 'craft', {
        v: 1,
        recipeId: 'crafting.forge-dagger',
        batchCount: 2,
        stationId: s.interactableId,
        stationRevision: s.revision,
        sourceContainerId: null,
        sourceRevision: null,
        inventoryStamp: read(h).inventoryStamp
      }).error
    ).toBeNull();
    expect(g.world5!.tickets[0]?.completedBatches).toBe(1);
    const save = g.toSnapshot();
    expect(
      g.loadSnapshot(save, (message) => {
        throw Error(message);
      })
    ).toBe(true);
    h.command('auto_step');
    const outputs = g.player.inventory.items.filter(
      (i) => !before.has(i.id) && i.identityId === 'dagger'
    );
    expect(outputs).toHaveLength(2);
    for (const i of outputs) {
      expect(i.identified).toBe(true);
      expect(i.enchantment).toBe(0);
      expect(!!i.moduleData?.loot).toBe(loot);
    }
    expect(
      g.loadSnapshot(g.toSnapshot(), (message) => {
        throw Error(message);
      })
    ).toBe(true);
    h.command('auto_step');
    expect(
      g.player.inventory.items.filter((i) => !before.has(i.id) && i.identityId === 'dagger')
    ).toHaveLength(2);
  }
);
it('production forge and unsocket recording replays/seeks from a legal controlled initial scene', () => {
  const h = staged(scene, { modules: ['crafting', 'loot'], mode: 'easy' });
  expect(place(h, 'forge').error).toBeNull();
  expect(h.ext('loot', 'item-operation', payload(h)).error).toBeNull();
  const recording = h.exportRecording(),
    digest = h.digest();
  expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
  expect(h.digest()).toBe(digest);
  h.seek(recording, 0);
  h.seek(recording, JSON.parse(recording).events.length);
  expect(h.digest()).toBe(digest);
});
it.each(['update', 'material-output', 'fact'])(
  'completion %s failure rolls back the complete entry graph before explicit cancellation',
  (point) => {
    const { h, g } = open(),
      p = payload(h);
    let entry: ReturnType<typeof auditFullObjectGraph> | undefined,
      rolledBack = false,
      differences: unknown = [];
    const checkpoint = g.checkpointWorldWork.bind(g);
    vi.spyOn(g, 'checkpointWorldWork').mockImplementation(() => {
      const restore = checkpoint();
      if (g.world5!.tickets.length) {
        entry = auditFullObjectGraph([g, rng]);
        return () => {
          restore();
          rolledBack = true;
          differences = entry!.differences();
        };
      }
      return restore;
    });
    if (point === 'update') {
      const validate = g.extensionRuntime!.validateItemData.bind(g.extensionRuntime);
      vi.spyOn(g.extensionRuntime!, 'validateItemData').mockImplementation((item, phase) => {
        if (phase === 'update') throw Error('update');
        return validate(item, phase);
      });
    }
    if (point === 'material-output') {
      const addItem = g.player.inventory.addItem.bind(g.player.inventory);
      vi.spyOn(g.player.inventory, 'addItem').mockImplementation((item) => {
        if (item.worldItem?.definitionId === 'loot.rune.ka') throw Error('output');
        return addItem(item);
      });
    }
    if (point === 'fact') {
      const fact = g.extensionRuntime!.worldWorkFact.bind(g.extensionRuntime);
      vi.spyOn(g.extensionRuntime!, 'worldWorkFact').mockImplementation((value, participant) => {
        if (value.result === 'completed') throw Error('fact');
        return fact(value, participant);
      });
    }
    h.ext('loot', 'item-operation', p);
    expect(rolledBack).toBe(true);
    expect(differences).toEqual([]);
    expect(amount(h, 'loot.shard')).toBe(40);
    expect(amount(h, 'loot.rune.ka')).toBe(0);
    expect(g.player.inventory.items.some((i) => i.id === p.itemId)).toBe(true);
  }
);
it('capacity, equipped ownership, absent forge, and insufficient shards reject before spending time', () => {
  const { h, g } = open();
  const raw = g.player.inventory.items.find(
    (i) => i.moduleData?.loot && (i.moduleData.loot as any).socketed.length
  )!;
  (raw.moduleData!.loot as any).socketed = [
    'loot.rune.ka',
    'loot.rune.ul',
    'loot.rune.tal',
    'loot.rune.ren'
  ];
  const p = payload(h),
    tick = timeSystem.currentTick;
  g.player.inventory.capacity = g.player.inventory.packCount();
  expect(h.ext('loot', 'item-operation', p).error).toBe('C5_CAPACITY');
  g.player.inventory.capacity = 26;
  const target = g.player.inventory.items.find((i) => i.id === p.itemId)!;
  g.executeItemCommand('equip', target);
  const equippedTick = timeSystem.currentTick;
  expect(
    h.ext('loot', 'item-operation', {
      ...p,
      itemRevision: workItemStamp(target),
      inventoryStamp: read(h).inventoryStamp
    }).error
  ).toBe('C5_BAD_OWNERSHIP');
  expect(timeSystem.currentTick).toBe(equippedTick);
  expect(equippedTick).toBeGreaterThan(tick);
});
it('craft provider failure cannot become plain output or retry; completed earlier batch remains', () => {
  const { h, g } = open();
  add(g, 'metal', 8);
  add(g, 'wood', 2);
  const s = read(h).stations.find((s) => s.tags.includes('station.forge'))!;
  const p = {
    v: 1,
    recipeId: 'crafting.forge-dagger',
    batchCount: 2,
    stationId: s.interactableId,
    stationRevision: s.revision,
    sourceContainerId: null,
    sourceRevision: null,
    inventoryStamp: read(h).inventoryStamp
  };
  const before = new Set(g.player.inventory.items.map((i) => i.id));
  h.ext('crafting', 'craft', p);
  expect(g.world5!.tickets[0]?.completedBatches).toBe(1);
  vi.spyOn(g.extensionRuntime!, 'commitWorkItem').mockImplementation(() => {
    throw Error('provider gone');
  });
  const tick = timeSystem.currentTick;
  h.command('auto_step');
  expect(timeSystem.currentTick - tick).toBe(1000);
  expect(
    g.player.inventory.items.filter((i) => !before.has(i.id) && i.identityId === 'dagger')
  ).toHaveLength(1);
  expect(amount(h, 'metal')).toBe(4);
  expect(amount(h, 'wood')).toBeGreaterThanOrEqual(1);
  expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({
    status: 'cancelled',
    completedBatches: 1
  });
});

// Official C5 trusted harness exposes the accepted midpoint without inventing a UI clock.
async function acceptOperation(h: ReturnType<typeof harness>, request = payload(h)) {
  const { commitWorldWork, withWorldActorScope } =
    await import('../../../../engine/Core/WorldWork');
  const g = game(h),
    p = prepareWorldWorkCommand(g, {
      module: 'loot',
      action: 'item-operation',
      payload: request
    });
  if (!p.outcome.ok) throw Error(p.outcome.code);
  expect(
    withWorldActorScope(g, 'loot', g.player.id, 'trusted-world', (scope) =>
      commitWorldWork(g, p.outcome.ok ? p.outcome.value : (null as never), scope)
    ).ok
  ).toBe(true);
  return g.world5!.tickets[0]!;
}
it('accepted native escrow saves/loads once, rejects duplicate roots and malformed operation metadata', async () => {
  const { h, g } = open(),
    id = payload(h).itemId,
    t = await acceptOperation(h);
  expect(g.player.inventory.items.some((i) => i.id === id)).toBe(false);
  expect(g.worldContainerItems!.has(id)).toBe(true);
  expect(new TextEncoder().encode(JSON.stringify(t.itemOperation)).length).toBeLessThanOrEqual(
    1024
  );
  const saved = g.toSnapshot();
  const prepareSpy = vi
    .spyOn(Object.getPrototypeOf(g.extensionRuntime!), 'prepareWorkItem')
    .mockImplementation(() => {
      throw Error('load must not prepare');
    });
  expect(
    g.loadSnapshot(saved, (message) => {
      throw Error(message);
    })
  ).toBe(true);
  expect(prepareSpy).not.toHaveBeenCalled();
  prepareSpy.mockRestore();
  const loaded = g.world5!.tickets[0]!,
    target = g.worldContainerItems!.get(id)!;
  expect(loaded.itemOperation?.targetStamp).toBe(workItemStamp(target));
  const { validateWorldWorkReferences } =
    await import('../../../../engine/Core/WorldWorkValidation');
  g.player.inventory.items.push(target);
  expect(() => validateWorldWorkReferences(g)).toThrow('C5_BAD_OWNERSHIP');
  g.player.inventory.items.pop();
  const { cancelWorldWork } = await import('../../../../engine/Core/WorldWork');
  cancelWorldWork(g, loaded.ticketId, 'cancelled');
  expect(g.player.inventory.items).toContain(target);
  expect(amount(h, 'loot.shard')).toBe(40);
  expect(amount(h, 'loot.rune.ka')).toBe(0);
  for (const mutate of [
    (s: any) => (s.run.world5.schema = 5),
    (s: any) => (s.run.world5.tickets[0].itemOperation.targetStamp = 'bad'),
    (s: any) => (s.run.world5.tickets[0].itemOperation.extra = 1),
    (s: any) => (s.run.world5.tickets[0].totalBatches = 2)
  ]) {
    const bad = structuredClone(saved);
    mutate(bad);
    const before = h.digest();
    expect(g.loadSnapshot(bad)).toBe(false);
    expect(h.digest()).toBe(before);
  }
});
it.each(['cancelled', 'damage', 'level-exit', 'target-removed', 'dead'])(
  'native escrow %s returns the full original target and all shards after paid partial labor',
  async (reason) => {
    const { h, g } = open(),
      id = payload(h).itemId,
      target = g.player.inventory.items.find((i) => i.id === id)!,
      before = structuredClone(target.moduleData),
      t = await acceptOperation(h);
    const { productionActorActionScheduler } =
      await import('../../../../engine/Core/ActorActionProduction');
    const scheduler = productionActorActionScheduler(g)!;
    scheduler.advanceActionTime(100);
    const tick = timeSystem.currentTick;
    const { settleWorldWork, cancelWorldWork } = await import('../../../../engine/Core/WorldWork');
    if (reason === 'cancelled') cancelWorldWork(g, t.ticketId, reason);
    else {
      if (reason === 'damage') g.player.hp--;
      if (reason === 'level-exit') g.depth++;
      if (reason === 'target-removed')
        g.world5!.stations = g.world5!.stations.filter((s) => s.interactableId !== t.stationId);
      if (reason === 'dead') g.player.hp = 0;
      settleWorldWork(g, false);
    }
    expect(timeSystem.currentTick).toBe(tick);
    expect(g.player.inventory.items).toContain(target);
    expect(target.moduleData).toEqual(before);
    expect(amount(h, 'loot.shard')).toBe(40);
    expect(amount(h, 'loot.rune.ka')).toBe(0);
    expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({
      status: 'cancelled',
      completedBatches: 0,
      stopReason: reason
    });
  }
);
it('a nearly full pack reserves merges into existing 99-stacks and retains equipment identity', () => {
  const { h, g } = open();
  add(g, 'loot.rune.ka', 95);
  const target = g.player.inventory.items.find((i) => i.id === payload(h).itemId)!;
  g.player.inventory.capacity = g.player.inventory.packCount();
  expect(h.ext('loot', 'item-operation', payload(h)).error).toBeNull();
  expect(amount(h, 'loot.rune.ka')).toBe(99);
  expect(g.player.inventory.items).toContain(target);
});
it('native changes during confirmation invalidate the original full-item stamp', () => {
  const { h, g } = open(),
    p = payload(h),
    target = g.player.inventory.items.find((i) => i.id === p.itemId)!;
  g.onConfirmRequest = null;
  g.onCommandConfirmRequest = () => {};
  const tick = timeSystem.currentTick;
  g.executeCommand(
    'ext:command',
    JSON.stringify({ module: 'loot', action: 'item-operation', payload: p })
  );
  expect(g.pendingCommandConfirmation).not.toBeNull();
  target.enchantment--;
  g.resolveCommandDecision(g.pendingCommandConfirmation!.token, true);
  expect(timeSystem.currentTick).toBe(tick);
  expect(amount(h, 'loot.shard')).toBe(40);
  expect(g.world5!.tickets).toHaveLength(0);
});
it('reforge keeps negative/corruption compensation, native rune and all unselected rows intact', () => {
  const row = (id: string, tier: number, values: number[]) => ({
    id: `loot.affix.${id}`,
    tier,
    values,
    known: true
  });
  const d: LootItemDataV1 = {
    ...data(0),
    baseId: 'dagger',
    ilvl: 1,
    rarity: 'rare',
    identityKnown: true,
    corrupted: true,
    nameParts: [0, 0],
    enhancement: 4,
    affixes: [row('keen', 2, [3000]), row('precise', 1, [1000]), row('sluggish', 1, [500])]
  };
  expect(validateLootItemData(d, c)).toBe(true);
  const input = {
    kind: 'operation' as const,
    operationId: 'loot.work.reforge',
    rowId: 'loot.affix.precise',
    data: JSON.parse(JSON.stringify(d))
  };
  const p = provider.commit(input, random);
  expect(validateLootItemData(p.data, c)).toBe(true);
  expect((p.data as any).affixes[0]).toEqual(d.affixes[0]);
  expect((p.data as any).affixes[2]).toEqual(d.affixes[2]);
  expect(p.data).toMatchObject({ corrupted: true, enhancement: 4, nameParts: [0, 0] });
  expect(() => provider.prepare({ ...input, rowId: 'loot.affix.sluggish' })).toThrow();
  const rune = c.affixes.find((a) => a.rune?.runicType === 'speed')!;
  const rd = {
    ...d,
    corrupted: false,
    enhancement: 0,
    affixes: [{ id: rune.id, tier: 1, values: rune.tiers[0]!.ranges.map((r) => r[0]), known: true }]
  };
  expect(() =>
    provider.prepare({ ...input, data: JSON.parse(JSON.stringify(rd)), rowId: rune.id })
  ).toThrow();
});
it('sixteen forge batches settle once per command, consume exact materials, produce only known +0 normal/magic', () => {
  const h = harness({ modules: ['crafting', 'loot'], mode: 'easy' }),
    g = game(h);
  safeArena(g);
  add(g, 'stone', 6);
  add(g, 'metal', 68);
  add(g, 'wood', 16);
  expect(place(h, 'forge').error).toBeNull();
  const s = read(h).stations.find((s) => s.tags.includes('station.forge'))!,
    before = new Set(g.player.inventory.items.map((i) => i.id)),
    tick = timeSystem.currentTick;
  const p = {
    v: 1,
    recipeId: 'crafting.forge-dagger',
    batchCount: 16,
    stationId: s.interactableId,
    stationRevision: s.revision,
    sourceContainerId: null,
    sourceRevision: null,
    inventoryStamp: read(h).inventoryStamp
  };
  expect(h.ext('crafting', 'craft', p).error).toBeNull();
  for (let n = 1; n < 16; n++) h.command('auto_step');
  const outputs = g.player.inventory.items.filter(
    (i) => !before.has(i.id) && i.identityId === 'dagger'
  );
  expect(outputs).toHaveLength(16);
  expect(timeSystem.currentTick - tick).toBe(16000);
  expect(amount(h, 'metal')).toBe(0);
  for (const i of outputs) {
    expect(i.identified).toBe(true);
    expect(i.enchantment).toBe(0);
    expect(['normal', 'magic']).toContain((i.moduleData!.loot as any).rarity);
  }
  expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({
    status: 'completed',
    completedBatches: 16,
    lastCompletionOrdinal: 16
  });
});
it('craft origin rejects mixed/unknown fields and unregistered recipes before load publication', () => {
  for (const origin of [
    { source: 'craft', depth: 1 },
    { source: 'craft', depth: 1, recipeId: 1 },
    { source: 'craft', depth: 1, recipeId: 'crafting.forge-dagger', siteId: 'x' },
    { source: 'site', siteId: 'x', siteKind: 'cave' },
    { source: 'part', depth: 1, bodyDefinitionId: 'x', partId: 'a' }
  ])
    expect(validateLootItemData({ ...data(0), origin }, c)).toBe(false);
  const { h, g } = open(),
    target = g.player.inventory.items.find((i) => i.id === payload(h).itemId)!;
  const old = target.moduleData!.loot;
  target.moduleData!.loot = {
    ...(old as object),
    origin: { source: 'craft', depth: 1, recipeId: 'crafting.missing' }
  } as any;
  expect(() => g.extensionRuntime!.validateItemData(target, 'load')).toThrow();
  target.moduleData!.loot = old!;
});
it('frozen station mechanics and conservative four-slot row budget are admitted, malformed numerics fail early', async () => {
  const { computeEquipmentRowBudget } = await import('../schema');
  expect(c.pack.stationOperations).toEqual({
    schema: 1,
    stationTag: 'station.forge',
    operations: [
      {
        id: 'loot.work.unsocket-last',
        kind: 'unsocket',
        mode: 'last',
        workTicks: 100,
        shardCost: 10
      },
      {
        id: 'loot.work.unsocket-all',
        kind: 'unsocket',
        mode: 'all',
        workTicks: 100,
        shardCost: 10
      },
      { id: 'loot.work.reforge', kind: 'reforge', mode: null, workTicks: 100, shardCost: 10 }
    ]
  });
  const budget = computeEquipmentRowBudget(c.pack);
  for (const rows of Object.values(budget.perSlot)) expect(rows).toBeLessThanOrEqual(24);
  expect(budget.provider).toBeLessThanOrEqual(256);
  for (const key of ['workTicks', 'shardCost'] as const) {
    const p = structuredClone(c.pack);
    p.stationOperations.operations[0]![key]++;
    expect(() => loadLootPack(p)).toThrow();
  }
  const p = structuredClone(c.pack);
  for (const a of p.affixes.affixes.filter((a) => !a.rune && a.polarity === 1))
    a.modifiers = Array(4).fill(a.modifiers[0]!);
  expect(() => loadLootPack(p)).toThrow();
});

it('reforge literal draw tape replaces only keen T3 6000 with keen T1 1500 and costs exactly 100 ticks/10 shards', () => {
  const { h, g } = open();
  const d: LootItemDataV1 = {
    ...data(0),
    baseId: 'dagger',
    ilvl: 16,
    rarity: 'magic',
    identityKnown: true,
    affixes: [{ id: 'loot.affix.keen', tier: 3, values: [6000], known: true }]
  };
  const target = equipment(g, d),
    station = read(h).stations.find((s) => s.tags.includes('station.forge'))!;
  const draws: number[][] = [];
  const proposal = provider.commit(
    {
      kind: 'operation',
      operationId: 'loot.work.reforge',
      rowId: 'loot.affix.keen',
      data: JSON.parse(JSON.stringify(d))
    },
    {
      beginItem: () => {},
      randomInt: (lo, hi) => {
        draws.push([lo, hi]);
        return lo;
      }
    }
  );
  expect((proposal.data as any).affixes).toEqual([
    { id: 'loot.affix.keen', tier: 1, values: [1500], known: true }
  ]);
  expect(draws).toHaveLength(3);
  expect(draws.slice(1)).toEqual([
    [1, 100],
    [1500, 2500]
  ]);
  target.enchantment = -3;
  target.strengthRequired = 19;
  target.isCursed = true;
  const tick = timeSystem.currentTick;
  expect(
    h.ext('loot', 'item-operation', {
      operationId: 'loot.work.reforge',
      rowId: 'loot.affix.keen',
      itemId: target.id,
      itemRevision: workItemStamp(target),
      stationId: station.interactableId,
      stationRevision: station.revision,
      inventoryStamp: read(h).inventoryStamp
    }).error
  ).toBeNull();
  expect(timeSystem.currentTick - tick).toBe(100);
  expect(amount(h, 'loot.shard')).toBe(30);
  expect(g.player.inventory.items).toContain(target);
  expect(target).toMatchObject({
    enchantment: -3,
    strengthRequired: 19,
    isCursed: true,
    identified: true
  });
  expect(validateLootItemData(target.moduleData!.loot, c)).toBe(true);
});

it('host work RNG is completion-scoped, bounded to 64 draws, and revoked after the callback', () => {
  const { g } = open(),
    runtime = g.extensionRuntime!,
    capability = 'loot.item-roll.v1',
    identity = runtime.workItemIdentity(capability)!;
  const declared = runtime.edibleModule('loot')!.workItemProviders![capability]!;
  const input = {
    kind: 'craft' as const,
    baseId: 'dagger',
    recipeId: 'crafting.forge-dagger',
    depth: 1,
    maxRarity: 'magic' as const,
    rarityFindBp: 0
  };
  let leaked: Parameters<typeof declared.commit>[1] | undefined;
  const original = declared.commit;
  vi.spyOn(declared, 'commit').mockImplementation((request, random) => {
    leaked = random;
    return original(request, random);
  });
  runtime.worldWorkTransaction(() => runtime.commitWorkItem(capability, identity, input));
  expect(() => leaked!.randomInt(0, 1)).toThrow('C5_PROVIDER');
  expect(() => leaked!.beginItem(0)).toThrow('C5_PROVIDER');
  vi.mocked(declared.commit).mockImplementation((_input, random) => {
    random.beginItem(0);
    for (let n = 0; n < 65; n++) random.randomInt(0, 1);
    throw Error('unreachable');
  });
  const before = rng.getState();
  expect(() =>
    runtime.worldWorkTransaction(() => runtime.commitWorkItem(capability, identity, input))
  ).toThrow('C5_BUDGET');
  expect(rng.getState()).toEqual(before);
});

it.each(['rare','wrong-origin','wrong-recipe','wrong-ilvl','wrong-sockets'] as const)('craft rejects %s completion proposals, refunds materials and retains paid labor', (fault) => {
  const {h,g}=open();add(g,'metal',4);add(g,'wood',1);
  const s=read(h).stations.find(s=>s.tags.includes('station.forge'))!;
  const declared=g.extensionRuntime!.edibleModule('loot')!.workItemProviders!['loot.item-roll.v1']!;
  const original=declared.commit;
  vi.spyOn(declared,'commit').mockImplementation((input,random)=>{
    const p=structuredClone(original(input,random));
    const d=p.data as unknown as LootItemDataV1;
    if(fault==='wrong-ilvl')d.ilvl=99;
    if(fault==='wrong-sockets'){d.rarity='normal';d.affixes=[];d.sockets=4;delete d.targetClass;}
    if(fault==='rare'){d.rarity='rare';d.nameParts=[0,0];d.sockets=0;}
    if(fault==='wrong-origin')d.origin={source:'floor',depth:1};
    if(fault==='wrong-recipe')d.origin={source:'craft',depth:1,recipeId:'crafting.forge-leather-armor'};
    return p;
  });
  const ids=g.player.inventory.items.filter(i=>i.moduleData?.loot).map(i=>i.id),tick=timeSystem.currentTick,wood=amount(h,'wood');
  h.ext('crafting','craft',{v:1,recipeId:'crafting.forge-dagger',batchCount:1,stationId:s.interactableId,stationRevision:s.revision,sourceContainerId:null,sourceRevision:null,inventoryStamp:read(h).inventoryStamp});
  expect(timeSystem.currentTick-tick).toBe(1000);
  expect(amount(h,'metal')).toBe(4);expect(amount(h,'wood')).toBe(wood);
  expect(g.player.inventory.items.filter(i=>i.moduleData?.loot).map(i=>i.id)).toEqual(ids);
  expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({status:'cancelled',completedBatches:0});
});

it('craft proposal validation enforces a normal cap without preventing later legal runewords',()=>{
  const input={kind:'craft' as const,baseId:'dagger',recipeId:'crafting.forge-dagger',depth:20,maxRarity:'normal' as const,rarityFindBp:0};
  const proposal=provider.commit(input,random),d=proposal.data as unknown as LootItemDataV1;
  d.rarity='magic';d.sockets=0;d.affixes=[{id:'loot.affix.keen',tier:1,values:[1500],known:true}];
  expect(validateLootItemData(d,c)).toBe(true);
  expect(provider.validateProposal(input,proposal)).toBe(false);
  const word={...data(2),identityKnown:true,origin:{source:'craft' as const,depth:14,recipeId:'crafting.forge-leather-armor'}};
  expect(validateLootItemData(word,c)).toBe(true);
});

it('operation proposal admission rejects changes outside the selected operation',()=>{
  const input={kind:'operation' as const,operationId:'loot.work.unsocket-last',data:JSON.parse(JSON.stringify(data(4)))};
  const p=provider.commit(input,random);
  expect(provider.validateProposal(input,p)).toBe(true);
  (p.data as unknown as LootItemDataV1).identityKnown=true;
  expect(validateLootItemData(p.data,c)).toBe(true);
  expect(provider.validateProposal(input,p)).toBe(false);
  const original={...data(0),baseId:'dagger',rarity:'magic' as const,identityKnown:true,affixes:[{id:'loot.affix.keen',tier:1,values:[1500],known:true}]};
  const reforge={kind:'operation' as const,operationId:'loot.work.reforge',rowId:'loot.affix.keen',data:JSON.parse(JSON.stringify(original))};
  const q=provider.commit(reforge,random);
  expect(provider.validateProposal(reforge,q)).toBe(true);
  (q.data as unknown as LootItemDataV1).enhancement=1;
  expect(validateLootItemData(q.data,c)).toBe(true);
  expect(provider.validateProposal(reforge,q)).toBe(false);
});

function reversedRows(): LootItemDataV1 {
  return {...data(0), baseId:'dagger', ilvl:20, rarity:'magic', identityKnown:true,
    affixes:[{id:'loot.affix.precise',tier:1,values:[1200],known:true},
      {id:'loot.affix.keen',tier:1,values:[2500],known:true}]};
}
function reforgeScene(g: ReturnType<typeof game>) { scene(g); equipment(g,reversedRows()); }
function firstReforge(h: ReturnType<typeof harness>) {
  const g=game(h),item=g.player.inventory.items.find(i=>(i.moduleData?.loot as any)?.rarity==='magic')!;
  const view=readLootGameView(g,item.id,[]),choice=view.workChoices[0]!;
  expect(view.card!.rows.map(r=>r.name?.nameKey)).toEqual(['ext.loot.affix.keen','ext.loot.affix.precise']);
  expect(choice.rowId).toBe('loot.affix.keen');
  expect(choice.rowName).toEqual(view.card!.rows[0]!.name);
  expect(choice.payload).toMatchObject({rowId:'loot.affix.keen'});
  expect(choice.payload).not.toHaveProperty('rowIndex');
  return {item,choice};
}
it('R1 reforge stable rowId matches sorted details through command, recording replay and seek',()=>{
  const h=staged(reforgeScene,{modules:['crafting','loot'],mode:'easy'});
  expect(place(h,'forge').error).toBeNull();
  const {item,choice}=firstReforge(h),before=structuredClone((item.moduleData!.loot as any).affixes),tick=timeSystem.currentTick;
  expect(h.ext('loot','item-operation',JSON.parse(JSON.stringify(choice.payload))).error).toBeNull();
  expect(timeSystem.currentTick-tick).toBe(100);expect(amount(h,'loot.shard')).toBe(30);
  expect((item.moduleData!.loot as any).affixes[0]).toEqual(before[0]);
  expect((item.moduleData!.loot as any).affixes[1]).not.toEqual(before[1]);
  const recording=h.exportRecording(),digest=h.digest();
  expect(recording).toContain('rowId');expect(recording).not.toContain('rowIndex');
  expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(digest);
  h.seek(recording,0);h.seek(recording,JSON.parse(recording).events.length);expect(h.digest()).toBe(digest);
});
it('R1 rowId survives escrow save/load, rejects ordinal/missing IDs, and replaces only the bound row',async()=>{
  const {h,g}=open();equipment(g,reversedRows());
  const {item,choice}=firstReforge(h),before=structuredClone((item.moduleData!.loot as any).affixes);
  for(const bad of [{...choice.payload,rowId:'loot.affix.missing'},{...choice.payload,rowId:0},
    {...choice.payload,rowIndex:0},{...choice.payload,rowId:undefined}]) {
    const tick=timeSystem.currentTick;
    expect(h.ext('loot','item-operation',JSON.parse(JSON.stringify(bad))).error).not.toBeNull();
    expect(timeSystem.currentTick).toBe(tick);expect(amount(h,'loot.shard')).toBe(40);
  }
  await acceptOperation(h,choice.payload as ReturnType<typeof payload>);
  expect(g.world5!.tickets[0]!.itemOperation).toMatchObject({rowId:'loot.affix.keen'});
  const saved=g.toSnapshot();
  for(const rowId of ['loot.affix.missing',0]) {
    const bad=structuredClone(saved) as any;bad.run.world5.tickets[0].itemOperation.rowId=rowId;
    expect(g.loadSnapshot(bad)).toBe(false);
  }
  expect(g.loadSnapshot(saved,message=>{throw Error(message);})).toBe(true);
  const {productionActorActionScheduler}=await import('../../../../engine/Core/ActorActionProduction');
  const {settleWorldWork}=await import('../../../../engine/Core/WorldWork');
  const tick=timeSystem.currentTick;
  productionActorActionScheduler(g)!.advanceActionTime(100);productionActorActionScheduler(g)!.dispatchActorBoundary(g.player.id);settleWorldWork(g);
  const output=g.player.inventory.items.find(i=>i.id===item.id)!;
  expect(output).toBeDefined();expect((output.moduleData!.loot as any).affixes[0]).toEqual(before[0]);
  expect((output.moduleData!.loot as any).affixes[1]).not.toEqual(before[1]);
  expect(timeSystem.currentTick-tick).toBe(100);expect(amount(h,'loot.shard')).toBe(30);
  expect(g.loadSnapshot(g.toSnapshot())).toBe(true);h.command('auto_step');expect(amount(h,'loot.shard')).toBe(30);
});
it('R1 craft source domain rejects legal persisted items outside ilvl/socket/tier/count creation limits',()=>{
  const input={kind:'craft' as const,baseId:'dagger',recipeId:'crafting.forge-dagger',depth:1,maxRarity:'magic' as const,rarityFindBp:0};
  const proposal=provider.commit(input,random);
  expect(proposal.data).toMatchObject({ilvl:1,rarity:'normal',sockets:0});
  for(const patch of [{ilvl:99},{sockets:3},{sockets:4}]) {
    const bad={...proposal,data:{...(proposal.data as any),...patch}};
    expect(validateLootItemData(bad.data,c)).toBe(true);expect(provider.validateProposal(input,bad)).toBe(false);
  }
  const high={...input,depth:40},base=provider.commit(high,random);
  expect(base.data).toMatchObject({ilvl:60});
  for(const affixes of [[],[{id:'loot.affix.keen',tier:1,values:[1500],known:true}]]) {
    const bad={...base,data:{...(base.data as any),rarity:'magic',sockets:0,affixes}};
    expect(validateLootItemData(bad.data,c)).toBe(true);expect(provider.validateProposal(high,bad)).toBe(false);
  }
  for(const depth of [1,8,20,40,99]) for(const end of ['low','high'] as const) {
    const bound={...input,depth},out=provider.commit(bound,{beginItem(){},randomInt:(lo,hi)=>end==='low'?lo:hi});
    expect(out.data).toMatchObject({ilvl:Math.min(99,Math.floor(depth*1.5))});
    expect(provider.validateProposal(bound,out)).toBe(true);
  }
});
function injectWrongCraftIlvl(g: ReturnType<typeof game>) {
  const declared=g.extensionRuntime!.edibleModule('loot')!.workItemProviders!['loot.item-roll.v1']!,original=declared.commit;
  vi.spyOn(declared,'commit').mockImplementation((input,random)=>{
    const proposal=structuredClone(original(input,random));(proposal.data as any).ilvl=99;return proposal;
  });
}
function craftFaultScene(g: ReturnType<typeof game>) {scene(g);add(g,'metal',4);add(g,'wood',1);injectWrongCraftIlvl(g);}
function forgePayload(h: ReturnType<typeof harness>) {
  const s=read(h).stations.find(s=>s.tags.includes('station.forge'))!;
  return {v:1,recipeId:'crafting.forge-dagger',batchCount:1,stationId:s.interactableId,stationRevision:s.revision,
    sourceContainerId:null,sourceRevision:null,inventoryStamp:read(h).inventoryStamp};
}
it('R1 faulty craft keeps 1000 paid ticks and refunds once across replay/seek and terminal save/load',()=>{
  const h=staged(craftFaultScene,{modules:['crafting','loot'],mode:'easy'}),g=game(h);
  expect(place(h,'forge').error).toBeNull();const wood=amount(h,'wood'),tick=timeSystem.currentTick;
  h.ext('crafting','craft',forgePayload(h));
  expect(timeSystem.currentTick-tick).toBe(1000);expect(amount(h,'metal')).toBe(4);expect(amount(h,'wood')).toBe(wood);
  expect(g.player.inventory.items.some(i=>(i.moduleData?.loot as any)?.origin.source==='craft')).toBe(false);
  expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({status:'cancelled',completedBatches:0});
  const recording=h.exportRecording(),digest=h.digest();
  expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(digest);
  h.seek(recording,0);h.seek(recording,JSON.parse(recording).events.length);expect(h.digest()).toBe(digest);
  expect(g.loadSnapshot(g.toSnapshot())).toBe(true);h.command('auto_step');
  expect(amount(h,'metal')).toBe(4);expect(amount(h,'wood')).toBe(wood);
});
it('R1 craft source binding survives accepted-ticket save/load and rejects a faulty completion',async()=>{
  const {h,g}=open();add(g,'metal',4);add(g,'wood',1);const wood=amount(h,'wood');
  const {commitWorldWork,withWorldActorScope,settleWorldWork}=await import('../../../../engine/Core/WorldWork');
  const p=prepareWorldWorkCommand(g,{module:'crafting',action:'craft',payload:forgePayload(h)});
  if(!p.outcome.ok)throw Error(p.outcome.code);
  expect(withWorldActorScope(g,'crafting',g.player.id,'trusted-world',scope=>commitWorldWork(g,p.outcome.ok?p.outcome.value:null as never,scope)).ok).toBe(true);
  expect(g.world5!.tickets[0]!.workRoll).toMatchObject({depth:1,baseId:'dagger',maxRarity:'magic'});
  expect(g.loadSnapshot(g.toSnapshot(),message=>{throw Error(message);})).toBe(true);injectWrongCraftIlvl(g);
  const {productionActorActionScheduler}=await import('../../../../engine/Core/ActorActionProduction');
  const tick=timeSystem.currentTick;productionActorActionScheduler(g)!.advanceActionTime(1000);productionActorActionScheduler(g)!.dispatchActorBoundary(g.player.id);settleWorldWork(g);
  expect(timeSystem.currentTick-tick).toBe(1000);expect(amount(h,'metal')).toBe(4);expect(amount(h,'wood')).toBe(wood);
  expect(g.player.inventory.items.some(i=>(i.moduleData?.loot as any)?.origin.source==='craft')).toBe(false);
  expect(g.world5!.terminalTickets.slice(-1)[0]).toMatchObject({status:'cancelled',completedBatches:0});
});

it('R1 rare cap zero cannot borrow magic enhancement rows in the worst-case budget',async()=>{
  const {computeEquipmentRowBudget}=await import('../schema');
  expect(computeEquipmentRowBudget(c.pack)).toEqual({perSlot:{weapon:11,armor:8,ring:6},provider:35});
  const pack=structuredClone(c.pack);
  pack.enhancement.caps.rare=0;pack.rarities.rarities.find(r=>r.id==='rare')!.enhancementCap=0;
  for(const a of pack.affixes.affixes.filter(a=>!a.rune))a.modifiers=Array.from({length:4},()=>({stat:'native.accuracy',category:'increased',unit:'bp',valueIndex:0}));
  expect(computeEquipmentRowBudget(pack).perSlot.weapon).toBe(24);
  expect(()=>loadLootPack(pack)).not.toThrow();
  pack.enhancement.caps.rare=1;pack.rarities.rarities.find(r=>r.id==='rare')!.enhancementCap=1;
  expect(computeEquipmentRowBudget(pack).perSlot.weapon).toBe(27);
  expect(()=>loadLootPack(pack)).toThrow(expect.objectContaining({code:'BUDGET',path:'pack.equipmentRows'}));
});
