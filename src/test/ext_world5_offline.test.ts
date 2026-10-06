import { afterEach, describe, expect, it, vi } from 'vitest';
import { c5Canonical } from '../engine/Core/WorldCanonical';
import {
  commitOfflineSettlement,
  offlineDraw,
  offlineSeedKey,
  planOfflineSettlement,
  type OfflineInput,
  type OfflinePlan
} from '../engine/Core/WorldSettlement';
import { createWorld5, indexWorldLevels, validateWorld5 } from '../ext/world5';
import {
  fixtureFingerprint,
  fixtureRules,
  createWorld5Module,
  fixtureRulesIdentity
} from './fixtures/world5-module';
import * as catalog from '../ext/catalog';
import { ExtensionRegistry } from '../ext/registry';
import { createHeadlessGame } from './harness';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
import {
  auditFullObjectGraph,
  fullGenerationRoots
} from './support/fullGenerationCheckpointOracle';
import { isAutoDescent, isDeepWater } from '../engine/Map/TerrainCatalog';
import { TerrainType, DungeonLayer } from '../engine/Map/Grid';
import { Monster, type MonsterData } from '../entities/Monster';
import { continuingPrefix } from './support/recordingV4';
import monsters from '../data/monsters.json';
const clone = <T>(v: T): T => structuredClone(v);
function input(toTick = 1000): OfflineInput {
  const world = createWorld5();
  indexWorldLevels(world, [{ visited: true }], 1);
  const level = world.levels[0]!;
  level.policy = 'frozen-ecology-economy-v1';
  level.persistenceReasons = ['camp', 'resident', 'work'];
  return {
    schema: 1,
    rulesFingerprint: fixtureFingerprint,
    runSeed: '51005000',
    campSlotId: 0,
    level,
    fromTick: 0,
    toTick,
    ledger: {
      levelRef: level.levelRef,
      campSlotId: 0,
      lastSettledTick: 0,
      epochRemainder: 0,
      revision: 0,
      seedKey: offlineSeedKey('51005000', 0, 'raid', fixtureFingerprint),
      lastEventOrdinal: 0,
      residentStates: [{ actorId: 1, alive: true, shortage: 0 }],
      pendingOutputs: [],
      needsResupply: false,
      frozen: {
        capturedTick: 0,
        rulesFingerprint: fixtureFingerprint,
        structureRevision: 0,
        residents: [
          {
            actorId: 1,
            bedComponentId: null,
            route: { reachable: true, distance: 1, travelTicks: 100 }
          }
        ],
        facilities: [],
        knownThreats: []
      }
    },
    rules: clone(fixtureRules),
    containers: [],
    nodes: [],
    tickets: [],
    orders: [
      {
        id: 1,
        owner: 'world5-fixture',
        actorId: 1,
        levelRef: level.levelRef,
        definitionId: 'world5-fixture.order',
        priority: 0,
        planId: 1,
        remainingEpochs: 32,
        ticketId: null,
        status: 'working',
        stopReason: null,
        revision: 0
      }
    ],
    pendingEvents: [
      {
        id: 'world5-fixture.raid',
        absoluteEpoch: 3,
        ordinal: 1,
        kind: 'raid',
        policy: { remainingBudget: 3 }
      }
    ]
  };
}
function plan(i: OfflineInput): OfflinePlan {
  const result = planOfflineSettlement(i);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}
/** Independent specification iterator for the actual 5A1 roots (no future item/ticket/structure roots).
 * Deliberately iterates all epochs, including the exhausted/shortage-saturated tail. */
function reference(i: OfflineInput) {
  const nextLedger = clone(i.ledger),
    nextOrders = clone(i.orders),
    receipts: OfflinePlan['receipts'] = [],
    effects: OfflinePlan['effects'] = [];
  for (
    let epoch = Math.floor(i.fromTick / 1000) + 1;
    epoch <= Math.floor(i.toTick / 1000);
    epoch++
  ) {
    nextLedger.residentStates.forEach((s) => {
      if (s.alive) s.shortage = Math.min(s.shortage + 1, 3) as 0 | 1 | 2 | 3;
    });
    for (const o of nextOrders)
      if (o.status === 'working' && o.remainingEpochs) {
        o.remainingEpochs--;
        o.revision++;
        if (o.remainingEpochs === 0) {
          o.status = 'needs-resupply';
          o.stopReason = 'needs-resupply';
        }
      }
    const event = i.pendingEvents
      .filter((e) => e.absoluteEpoch === epoch && e.ordinal > nextLedger.lastEventOrdinal)
      .sort((a, b) => a.ordinal - b.ordinal)[0];
    if (event) {
      nextLedger.lastEventOrdinal = event.ordinal;
      if (event.kind === 'raid')
        effects.push({
          kind: 'pending-encounter',
          eventId: event.id,
          remainingBudget: event.policy.remainingBudget
        });
      else
        for (const o of nextOrders)
          if (o.status === 'working') {
            o.status = 'stopped';
            o.stopReason = event.id;
            o.revision++;
          }
      receipts.push({
        owner: nextOrders[0]?.owner ?? 'world5-fixture',
        ordinal: event.ordinal,
        identity: 'offline.' + i.campSlotId + '.' + event.id + '.' + epoch,
        kind: 'offline',
        levelRef: clone(i.level.levelRef),
        tick: epoch * 1000,
        result: 'completed',
        reason: null
      });
    }
    nextLedger.revision++;
  }
  nextLedger.lastSettledTick = i.toTick;
  nextLedger.epochRemainder = i.toTick % 1000;
  nextLedger.needsResupply = nextOrders.some((o) => o.status === 'needs-resupply');
  return { nextLedger, nextOrders, nextNodes: [], receipts, effects };
}
afterEach(() => vi.restoreAllMocks());
describe('C5 offline deterministic economy', () => {
  it('freezes all three draw and four stable camp-slot seed vectors', () => {
    expect(offlineDraw('0'.repeat(64), 0, 'raid', 0)).toBe(156442572);
    expect(offlineDraw('0'.repeat(64), 1, 'raid', 0)).toBe(2088227424);
    expect(
      offlineDraw('f'.repeat(64), Number.MAX_SAFE_INTEGER, 'work', Number.MAX_SAFE_INTEGER)
    ).toBe(1192871423);
    const vectors = [
      [
        '51005000',
        0,
        'raid',
        '0',
        'b805996d1d733cdc9a239db3c0549af9adb33eb68128c567df35d86af0e57be1'
      ],
      [
        '51005000',
        7,
        'raid',
        '0',
        'caab464d66c5b7f81ce79e3e26df67961e0983e52ce6c24bd6bb63cde42589c8'
      ],
      [
        '51005000',
        0,
        'work',
        '0',
        '3eb323a663f1e34d6083d7ab803682e8e2633a5b71233dd09478fe0c2173bdd5'
      ],
      [
        '1',
        3,
        'settlement.raid',
        'f',
        '847315b5921d3d55464c8068e10475fff4ab1eab54904b6d2deacbaba3b6be49'
      ]
    ] as const;
    for (const [seed, slot, domain, char, expected] of vectors)
      expect(offlineSeedKey(seed, slot, domain, char.repeat(64))).toBe(expected);
    for (const key of ['', '0'.repeat(65), 'g'.repeat(64), 'A'.repeat(64)])
      expect(() => offlineDraw(key, 0, 'raid', 0)).toThrow();
    for (const n of [-1, 1.1, Number.MAX_SAFE_INTEGER + 1])
      expect(() => offlineDraw('0'.repeat(64), n, 'raid', 0)).toThrow();
    for (const slot of [-1, 8, 1.1])
      expect(() => offlineSeedKey('1', slot as never, 'raid', '0'.repeat(64))).toThrow();
    for (const domain of ['', '营地', 'a'.repeat(129)])
      expect(() => offlineSeedKey('1', 0, domain, '0'.repeat(64))).toThrow();
    expect(() => offlineSeedKey('18446744073709551616', 0, 'raid', '0'.repeat(64))).toThrow();
    expect(c5Canonical(['营地', '\n\u0001', '"', '\\'])).toBe(
      '["营地","\\n\\u0001","\\\"","\\\\"]'
    );
  });
  it.each([0, 999, 1000, 1001, 31000, 32000, 33000, 10000000])(
    'matches independent epoch specification at %i ticks',
    (to) => {
      const i = input(to),
        before = clone(i),
        random = rng.getState(),
        p = plan(i),
        expected = reference(i);
      for (const key of ['nextLedger', 'nextOrders', 'nextNodes', 'receipts', 'effects'] as const)
        expect(p[key]).toEqual(expected[key]);
      expect(i).toEqual(before);
      expect(rng.getState()).toEqual(random);
    }
  );
  it('has bounded billion-tick long tails and full state equivalence for 1 / 2 / 17 segments including JSON saves', () => {
    const original = input(1000000000),
      t = performance.now(),
      whole = plan(original);
    expect(performance.now() - t).toBeLessThan(500);
    for (const segments of [2, 17]) {
      let current = clone(original);
      const receipts: OfflinePlan['receipts'] = [],
        effects: OfflinePlan['effects'] = [];
      for (let n = 1; n <= segments; n++) {
        current.toTick = Math.floor((original.toTick * n) / segments);
        const p = plan(current);
        receipts.push(...p.receipts);
        effects.push(...p.effects);
        current = JSON.parse(
          JSON.stringify({
            ...current,
            fromTick: current.toTick,
            ledger: p.nextLedger,
            orders: p.nextOrders
          })
        );
      }
      expect(current.ledger).toEqual(whole.nextLedger);
      expect(current.orders).toEqual(whole.nextOrders);
      expect(receipts).toEqual(whole.receipts);
      expect(effects).toEqual(whole.effects);
    }
  });
  it('rejects reverse time, ledger legacy fields, wrong frozen rules and unsupported effects; commits once and restores identities on failure', () => {
    const i = input(1000);
    i.toTick = -1;
    expect(planOfflineSettlement(i).ok).toBe(false);
    i.toTick = 1000;
    i.fromTick = 1;
    expect(planOfflineSettlement(i)).toMatchObject({ ok: false, code: 'C5_BAD_TIME' });
    i.fromTick = 0;
    i.ledger.frozen.rulesFingerprint = '0'.repeat(64);
    expect(planOfflineSettlement(i)).toMatchObject({ ok: false, code: 'C5_BAD_VERSION' });
    const good = input(4000),
      p = plan(good),
      w = createWorld5();
    w.simulationTicks = 4000;
    w.offline = [clone(good.ledger)];
    w.orders = clone(good.orders);
    const root = w.offline[0],
      orders = w.orders,
      order = orders[0],
      before = clone(w);
    let state = 0;
    const participant = {
      checkpoint: () => {
        const old = state;
        return () => {
          state = old;
        };
      },
      prepare: () => () => {
        state++;
        throw new Error('publish');
      }
    };
    expect(commitOfflineSettlement(w, p, participant)).toMatchObject({
      ok: false,
      code: 'C5_TRANSACTION'
    });
    expect(w).toEqual(before);
    expect(w.offline[0]).toBe(root);
    expect(w.orders).toBe(orders);
    expect(w.orders[0]).toBe(order);
    expect(state).toBe(0);
    const unsupported = {
      ...p,
      effects: [
        {
          kind: 'item-delta' as const,
          containerId: 1,
          definitionId: 'fixture.material',
          delta: 1,
          availableEpoch: 1
        }
      ]
    };
    expect(commitOfflineSettlement(w, unsupported)).toMatchObject({
      ok: false,
      code: 'C5_UNSUPPORTED'
    });
    expect(commitOfflineSettlement(w, p)).toEqual({ ok: true, value: { committed: true } });
    expect(commitOfflineSettlement(w, p)).toEqual({ ok: true, value: { committed: false } });
    expect(commitOfflineSettlement(w, { ...p, toTick: 3999 })).toMatchObject({
      ok: false,
      code: 'C5_STALE'
    });
    expect(commitOfflineSettlement(w, p, undefined, false, true)).toMatchObject({
      ok: false,
      code: 'C5_TERMINAL'
    });
  });
  it('review H2: native monstersFall may displace a resident into pending and its save remains readable', () => {
    const g = game(); g.executeCommand('world5:fixture');
    const id = g.world5!.residents[0]!.actorId, m = g.monsters.find(m => m.id === id)!;
    m.hp = m.maxHp = 500; g.grid.setTerrain(m.x, m.y, TerrainType.CHASM);
    (g as any).monstersFall();
    expect((g as any).pendingFallenByDepth.get(2)).toContain(m);
    expect(g.monsters).not.toContain(m);
    expect(g.world5!.orders[0]).toMatchObject({ status: 'stopped', stopReason: 'resident-displaced' });
    const saved = g.toSnapshot();
    expect(g.loadSnapshot(saved)).toBe(true);
    expect((g as any).pendingFallenByDepth.get(2).map((m: Monster) => m.id)).toContain(id);
  });
  it('review H3: native monstersFall queues arrivals to a cached managed lower floor until settlement and then places them', () => {
    const g = game();
    g.depth = 2; (g as any).generateDepth(false); g.executeCommand('world5:fixture');
    g.depth = 1; (g as any).generateDepth(true);
    const m = new Monster(1, 1, monsters.find(m => m.id === 'goblin')! as MonsterData);
    m.hp = m.maxHp = 500; m.falling = true;
    g.monsters.push(m); g.extensionRuntime!.attachCreature(m);
    (g as any).monstersFall();
    expect(g.levels.get(2)!.monsters).not.toContain(m);
    expect((g as any).pendingFallenByDepth.get(2)).toContain(m);
    const settle = vi.spyOn(g as any, 'settleManagedWorld');
    g.depth = 2; (g as any).generateDepth(false);
    expect(settle).toHaveBeenCalled();
    expect(g.monsters).toContain(m); expect(m.preplaced).toBe(false);
    expect(g.grid.getCell(m.x, m.y)!.isPassable).toBe(true);
    expect((g as any).pendingFallenByDepth.has(2)).toBe(false);
    expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
  });
  it('review H2: a resident killed into native purgatory can resurrect on another layer and round-trip', () => {
    const g = game(); g.executeCommand('world5:fixture');
    const actor = g.monsters.find(m => m.id === g.world5!.residents[0]!.actorId)!;
    actor.isAlly = true;
    g.executeCommand('wait', undefined, () => g.killMonster(actor));
    g.executeCommand('wait'); // Native corpse sweep, rather than manufacturing a purgatory root.
    expect(g.purgatory).toContain(actor);
    g.depth = 2; (g as any).generateDepth(false);
    expect(g.resurrectAlly(g.player.loc)).toBe(true); expect(g.monsters).toContain(actor);
    expect(g.world5!.orders[0]).toMatchObject({ status: 'stopped', stopReason: 'resident-dead' });
    const saved = g.toSnapshot(); expect(g.loadSnapshot(saved)).toBe(true);
    expect(g.monsters.some(m => m.id === actor.id && m.hp > 0)).toBe(true);
    expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
  });
  it('review H2/L1: writer and reader reject the same invalid world references and both reader branches provide a reason', () => {
    const g = game(); g.executeCommand('world5:fixture');
    const saved = g.toSnapshot(), goodId = g.world5!.residents[0]!.actorId;
    g.world5!.residents[0]!.actorId = g.player.inventory.items[0]!.id;
    expect(() => g.toSnapshot()).toThrow('C5_BAD_REFERENCE');
    g.world5!.residents[0]!.actorId = goodId;
    for (const mutate of [
      (s: typeof saved) => { delete s.run.world5; },
      (s: typeof saved) => { s.run.world5!.offline[0]!.frozen.rulesFingerprint = '0'.repeat(64); },
    ]) {
      const bad = clone(saved); mutate(bad); const notify = vi.fn(), player = g.player;
      expect(g.loadSnapshot(bad, notify)).toBe(false); expect(notify).toHaveBeenCalledOnce();
      expect(notify.mock.calls[0]![0]).toBeTruthy(); expect(g.player).toBe(player);
    }
  });
  it('review M2: retains the latest 128 receipts and uses ledger ordinals after history eviction', () => {
    const i = input(128000);
    i.pendingEvents = Array.from({ length: 128 }, (_, n) => ({ id: 'raid.' + n, ordinal: n + 1,
      absoluteEpoch: n + 1, kind: 'raid' as const, policy: { remainingBudget: 0 } }));
    const p = plan(i), w = createWorld5();
    w.simulationTicks = i.toTick; w.levels = [clone(i.level)]; w.offline = [clone(i.ledger)]; w.orders = clone(i.orders);
    expect(p.receipts).toHaveLength(128);
    expect(commitOfflineSettlement(w, p)).toEqual({ ok: true, value: { committed: true } });
    const tail = plan({ ...i, fromTick: i.toTick, toTick: 130000, ledger: clone(w.offline[0]!), orders: clone(w.orders),
      pendingEvents: [129, 130].map(ordinal => ({ id: 'raid.' + (ordinal - 1), ordinal,
        absoluteEpoch: ordinal, kind: 'raid' as const, policy: { remainingBudget: 0 } })) });
    w.simulationTicks = 130000;
    expect(commitOfflineSettlement(w, tail)).toEqual({ ok: true, value: { committed: true } });
    expect(w.receipts.map(r => r.ordinal)).toEqual(Array.from({ length: 128 }, (_, n) => n + 3));
    expect(w.offline[0]!.lastEventOrdinal).toBe(130);
    const saved = clone(w);
    expect(commitOfflineSettlement(w, tail)).toEqual({ ok: true, value: { committed: false } });
    expect(w).toEqual(saved);
    const next = { ...i, fromTick: 130000, toTick: 131000, ledger: clone(w.offline[0]!), orders: clone(w.orders),
      // A returning fixture may advertise an old ordinal at a later epoch.
      // Ordinal 1 is already evicted, so scanning the public history cannot deduplicate it.
      pendingEvents: [{ id: 'raid.0', ordinal: 1, absoluteEpoch: 131, kind: 'raid' as const, policy: { remainingBudget: 0 } }] };
    const again = plan(next); w.simulationTicks = next.toTick;
    expect(again.receipts).toEqual([]);
    expect(again.effects.filter(e => e.kind === 'pending-encounter')).toEqual([]);
    expect(commitOfflineSettlement(w, again).ok).toBe(true);
    expect(w.receipts).toEqual(saved.receipts);
  });
});

describe('synchronous settlement participant rollback', () => {
  it.each(['checkpoint', 'prepare', 'publish'] as const)(
    'rejects a Promise from %s and restores all identities and newly shadowed own keys', phase => {
      const i = input(4000), p = plan(i), w = createWorld5();
      w.simulationTicks = 4000; w.offline = [clone(i.ledger)]; w.orders = clone(i.orders);
      const audit = auditFullObjectGraph(w), before = clone(w);
      let state = 0;
      const mutate = () => {
        w.orders[0]!.remainingEpochs = 0;
        Object.defineProperty(w, 'constructor', { value: 'shadow', configurable: true, enumerable: true });
        Object.defineProperty(w.offline[0]!, 'toString', { value: 'shadow', configurable: true, enumerable: true });
      };
      const participant = {
        checkpoint: () => {
          if (phase === 'checkpoint') { mutate(); return Promise.resolve(() => {}) as any; }
          return () => { state = 0; };
        },
        prepare: () => {
          if (phase === 'prepare') { state++; mutate(); return Promise.resolve(() => {}) as any; }
          return () => { state++; mutate(); return Promise.resolve() as any; };
        }
      };
      expect(commitOfflineSettlement(w, p, participant)).toMatchObject({ ok: false, code: 'C5_PROVIDER' });
      expect(w).toEqual(before); expect(state).toBe(0); expect(audit.differences()).toEqual([]);
    }
  );
});

/** Test-only material/ticket adapter: these DTOs never enter production world5 roots. */
function economicInput(to = 40000): OfflineInput {
  const i = input(to);
  i.pendingEvents = [];
  i.rules.rationDefinitions = ['fixture.ration'];
  const item = (id: number, definitionId: string, quantity: number) => ({
    id,
    category: 'material' as const,
    nativeCategory: null,
    definitionId,
    quantity,
    available: quantity,
    packSlots: 1,
    tags: [],
    toolDurability: null
  });
  i.containers = [
    {
      id: 10,
      levelRef: i.level.levelRef,
      at: null,
      kind: 'chest',
      revision: 0,
      capacity: 1024,
      occupiedSlots: 2,
      reservedSlots: 0,
      items: [item(10, 'fixture.ration', 12), item(11, 'fixture.wood', 20)]
    },
    {
      id: 11,
      levelRef: i.level.levelRef,
      at: null,
      kind: 'chest',
      revision: 0,
      capacity: 1024,
      occupiedSlots: 0,
      reservedSlots: 10,
      items: []
    }
  ];
  i.rules.recipes = [
    {
      owner: 'world5-fixture',
      id: 'fixture.recipe',
      inputs: [{ itemDefinitionId: 'fixture.wood', count: 2 }],
      outputs: [{ itemDefinitionId: 'fixture.kit', count: 1 }],
      stationTags: [],
      toolTag: null,
      workTicks: 500,
      offlineEligible: true
    }
  ];
  i.tickets = [
    {
      ticketId: 20,
      owner: 'world5-fixture',
      actorId: 1,
      levelRef: i.level.levelRef,
      definitionId: 'fixture.recipe',
      sourceContainerId: 10,
      totalBatches: 10,
      completedBatches: 0,
      remainingTicks: 500,
      laborCreditTicks: 0,
      status: 'working',
      outputReservation: {
        destination: { kind: 'container', containerId: 11 },
        slots: 10,
        counts: [{ itemDefinitionId: 'fixture.kit', count: 10 }]
      }
    }
  ];
  i.orders[0]!.ticketId = 20;
  i.rules.nodeDefinitions = [
    {
      owner: 'world5-fixture',
      id: 'fixture.node',
      capacity: 100,
      regeneration: { kind: 'periodic', units: 3, intervalTicks: 1700 }
    }
  ];
  i.nodes = [
    {
      interactableId: 30,
      owner: 'world5-fixture',
      definitionId: 'fixture.node',
      instanceKey: 'a',
      levelRef: i.level.levelRef,
      at: { x: 1, y: 1 },
      capacity: 100,
      remaining: 0,
      reservedUnits: 0,
      regenRemainder: 0,
      lastSettledTick: 0,
      revision: 0
    }
  ];
  return i;
}
function applyProxy(i: OfflineInput, p: OfflinePlan): OfflineInput {
  const next = clone(i);
  next.fromTick = p.toTick;
  next.ledger = clone(p.nextLedger);
  next.orders = clone(p.nextOrders);
  next.nodes = clone(p.nextNodes);
  for (const effect of p.effects) {
    if (effect.kind === 'item-delta') {
      const c = next.containers.find((c) => c.id === effect.containerId)!;
      let row = c.items.find((i) => i.definitionId === effect.definitionId);
      if (!row) {
        row = {
          id: 0,
          category: 'material',
          nativeCategory: null,
          definitionId: effect.definitionId,
          quantity: 0,
          available: 0,
          packSlots: 1,
          tags: [],
          toolDurability: null
        };
        c.items.push(row);
      }
      row.quantity += effect.delta;
      row.available += effect.delta;
    } else if (effect.kind === 'ticket-progress') {
      const t = next.tickets.find((t) => t.ticketId === effect.ticketId)!,
        recipe = next.rules.recipes.find((r) => r.id === t.definitionId)!;
      t.completedBatches += effect.completedBatches;
      t.laborCreditTicks += effect.laborTicks - effect.completedBatches * recipe.workTicks;
    }
  }
  return next;
}
/** Independently advance exactly one normative epoch, including deferred output and node remainder. */
function economicReference(i: OfflineInput): OfflineInput {
  const n = clone(i);
  for (
    let epoch = Math.floor(i.fromTick / 1000) + 1;
    epoch <= Math.floor(i.toTick / 1000);
    epoch++
  ) {
    for (const output of n.ledger.pendingOutputs.filter((o) => o.availableEpoch <= epoch)) {
      const c = n.containers.find((c) => c.id === output.destinationId)!;
      for (const amount of output.items) {
        let row = c.items.find((x) => x.definitionId === amount.itemDefinitionId);
        if (!row) {
          row = {
            id: 0,
            category: 'material',
            nativeCategory: null,
            definitionId: amount.itemDefinitionId,
            quantity: 0,
            available: 0,
            packSlots: 1,
            tags: [],
            toolDurability: null
          };
          c.items.push(row);
        }
        row.available += amount.count;
        row.quantity += amount.count;
      }
      n.ledger.pendingOutputs.splice(n.ledger.pendingOutputs.indexOf(output), 1);
    }
    for (const actor of n.ledger.residentStates.slice().sort((a, b) => a.actorId - b.actorId))
      if (actor.alive) {
        const ration = n.containers
          .flatMap((c) => c.items)
          .find((i) => n.rules.rationDefinitions.includes(i.definitionId ?? '') && i.available > 0);
        if (ration) {
          ration.quantity--;
          ration.available--;
          actor.shortage = 0;
        } else actor.shortage = Math.min(3, actor.shortage + 1) as 0 | 1 | 2 | 3;
      }
    let completions = 0;
    for (const order of n.orders
      .slice()
      .sort(
        (a, b) =>
          a.priority - b.priority ||
          a.definitionId.localeCompare(b.definitionId) ||
          a.actorId - b.actorId
      ))
      if (order.status === 'working' && order.remainingEpochs) {
        order.remainingEpochs--;
        order.revision++;
        const t = n.tickets.find((t) => t.ticketId === order.ticketId)!,
          recipe = n.rules.recipes.find((r) => r.id === t.definitionId)!,
          actor = n.ledger.residentStates.find((a) => a.actorId === order.actorId)!;
        t.laborCreditTicks += Math.floor(
          (1000 * n.rules.shortageEfficiencyNumerators[actor.shortage]) /
            n.rules.efficiencyDenominator
        );
        const source = n.containers.find((c) => c.id === t.sourceContainerId)!;
        while (
          t.completedBatches < t.totalBatches &&
          t.laborCreditTicks >= recipe.workTicks &&
          completions < 1024 &&
          recipe.inputs.every(
            (a) =>
              (source.items.find((i) => i.definitionId === a.itemDefinitionId)?.available ?? 0) >=
              a.count
          )
        ) {
          for (const amount of recipe.inputs) {
            const row = source.items.find((i) => i.definitionId === amount.itemDefinitionId)!;
            row.available -= amount.count;
            row.quantity -= amount.count;
          }
          t.laborCreditTicks -= recipe.workTicks;
          t.completedBatches++;
          completions++;
          n.ledger.pendingOutputs.push({
            ticketId: t.ticketId,
            availableEpoch: epoch + 1,
            destinationId: t.outputReservation!.destination.containerId,
            items: clone(recipe.outputs)
          });
        }
        if (!order.remainingEpochs) {
          order.status = 'needs-resupply';
          order.stopReason = 'needs-resupply';
        }
      }
    for (const node of n.nodes) {
      const def = n.rules.nodeDefinitions.find((d) => d.id === node.definitionId)!;
      if (def.regeneration.kind === 'periodic') {
        const ticks = epoch * 1000 - node.lastSettledTick + node.regenRemainder;
        node.remaining = Math.min(
          node.capacity,
          node.remaining +
            Math.floor(ticks / def.regeneration.intervalTicks) * def.regeneration.units
        );
        node.regenRemainder = ticks % def.regeneration.intervalTicks;
      }
      node.lastSettledTick = epoch * 1000;
    }
    n.ledger.revision++;
  }
  n.fromTick = n.toTick;
  n.ledger.lastSettledTick = n.toTick;
  n.ledger.epochRemainder = n.toTick % 1000;
  n.ledger.needsResupply = n.orders.some((o) => o.status === 'needs-resupply');
  return n;
}
describe('C5 private economy effect fixture', () => {
  it.each([999, 1000, 1001, 32000, 33000, 10000000])(
    'conserves food/material/output/ticket credit/node remainders against independent iteration at %i',
    (to) => {
      const i = economicInput(to),
        p = plan(i),
        actual = applyProxy(i, p),
        expected = economicReference(i);
      expect(actual).toEqual(expected);
      expect(
        actual.containers[0]!.items[1]!.quantity + 2 * actual.tickets[0]!.completedBatches
      ).toBe(20);
      const kits =
        actual.containers[1]!.items.reduce((n, i) => n + i.quantity, 0) +
        actual.ledger.pendingOutputs.flatMap((o) => o.items).reduce((n, i) => n + i.count, 0);
      expect(kits).toBe(actual.tickets[0]!.completedBatches);
    }
  );
  it('matches all economic state across irregular 2 and 17 segments including private adapter state persistence', () => {
    const original = economicInput(41037),
      whole = applyProxy(original, plan(original));
    for (const segments of [2, 17]) {
      let state = clone(original);
      for (let part = 1; part <= segments; part++) {
        state.toTick = Math.floor((original.toTick * part) / segments);
        state = JSON.parse(JSON.stringify(applyProxy(state, plan(state))));
      }
      expect(state).toEqual(whole);
    }
  });
  it('rejects non-material/kit recipe inputs, impossible reservations, malformed remainder and duplicate residents', () => {
    const bad = economicInput();
    bad.containers[0]!.items[1]!.category = 'native';
    expect(planOfflineSettlement(bad).ok).toBe(false);
    const capacity = economicInput();
    capacity.containers[1]!.reservedSlots = 1025;
    expect(planOfflineSettlement(capacity).ok).toBe(false);
    const remainder = economicInput();
    remainder.ledger.epochRemainder = 1;
    expect(planOfflineSettlement(remainder)).toMatchObject({ ok: false, code: 'C5_BAD_TIME' });
    const duplicate = economicInput();
    duplicate.ledger.residentStates.push(clone(duplicate.ledger.residentStates[0]!));
    expect(planOfflineSettlement(duplicate).ok).toBe(false);
    const legacy = economicInput();
    (legacy.ledger as any).remainingEpochs = 32;
    expect(planOfflineSettlement(legacy).ok).toBe(false);
  });
});

function game() {
  const r = new ExtensionRegistry();
  r.register('world5-fixture', '1.0.0', createWorld5Module, fixtureRulesIdentity);
  vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(r);
  const g = createHeadlessGame(51005100, 'test');
  g.startNewGame({
    seed: 51005100,
    mode: 'wizard',
    ruleSet: 'extended',
    extensions: ['world5-fixture']
  });
  g.animationEnabled = false;
  return g;
}
describe('C5 real managed layer fixture', () => {
  it('freezes departure routes, ecological state and residents; settles once before pending arrival and enteredLevel; load produces nothing', () => {
    const g = game();
    g.executeCommand('world5:fixture');
    const w = g.world5!,
      resident = g.monsters.find((m) => m.id === w.residents[0]!.actorId)!,
      grid = g.grid;
    g.grid.setTerrainLayer(resident.x, resident.y, DungeonLayer.SURFACE, TerrainType.PLAIN_FIRE);
    resident.entersLevelIn = 4;
    const hp = resident.hp,
      clock = rng.getState();
    g.depth = 2;
    (g as any).generateDepth(false);
    expect(g.levels.get(1)!.grid).toBe(grid);
    expect(g.levels.get(1)!.monsters).toContain(resident);
    expect(resident.entersLevelIn).toBe(4);
    const frozen = clone(w.offline[0]!.frozen);
    for (let n = 0; n < 350; n++) {
      while (logger.pendingAcknowledgment) logger.acknowledgeNext();
      g.executeCommand('wait');
    }
    expect(resident.hp).toBe(hp);
    expect(resident.entersLevelIn).toBe(4);
    expect(w.offline[0]!.frozen).toEqual(frozen);
    const m = new Monster(
      resident.x,
      resident.y,
      monsters.find((m) => m.id === 'rat')! as MonsterData
    );
    (g as any).pendingFallenByDepth.set(1, [m]);
    const saved = g.toSaveSnapshot(),
      state = clone(g.extensionRuntime!.snapshot().modules['world5-fixture']);
    expect(g.loadSnapshot(saved)).toBe(true);
    expect(g.extensionRuntime!.snapshot().modules['world5-fixture']).toEqual(state);
    const before = g.world5!.simulationTicks;
    g.depth = 1;
    (g as any).generateDepth(true);
    expect(g.monsters.find((m) => m.id === resident.id)!.entersLevelIn).toBe(4);
    expect(g.world5!.simulationTicks).toBe(before);
    expect(g.world5!.orders[0]!.remainingEpochs).toBe(0);
    expect(g.world5!.offline[0]!.residentStates[0]!.shortage).toBe(3);
    expect(g.world5!.receipts).toHaveLength(1);
    expect((g as any).pendingFallenByDepth.has(1)).toBe(false);
    expect(g.monsters.some((x) => x.id === m.id)).toBe(true);
    expect(g.extensionRuntime!.snapshot().modules['world5-fixture']).toMatchObject({
      epochs: Math.floor(before / 1000) - Math.floor(frozen.capturedTick / 1000),
      encounters: ['world5-fixture.raid']
    });
    expect(clock).not.toEqual(rng.getState());
  });
  it('records a real resident death once, stops its work and permits its historical identity after native removal', () => {
    const g = game();
    g.executeCommand('world5:fixture');
    const id = g.world5!.residents[0]!.actorId,
      m = g.monsters.find((m) => m.id === id)!;
    g.executeCommand('wait', undefined, () => g.killMonster(m));
    expect(g.world5!.offline[0]!.residentStates[0]!.alive).toBe(false);
    expect(g.world5!.orders[0]).toMatchObject({ status: 'stopped', stopReason: 'resident-dead' });
    const saved = g.toSnapshot();
    expect(g.loadSnapshot(saved)).toBe(true);
    expect(g.world5!.residents[0]!.actorId).toBe(id);
    expect(() => validateWorld5(saved.run.world5, {
      active: saved.depth, visited: saved.levelSeeds,
      cachedDepths: saved.levels.map(l => l.depth), owners: ['world5-fixture'],
      nextEntityId: saved.run.nextEntityId, actors: new Map([[id, 2]]),
      rulesFingerprint: fixtureFingerprint
    })).not.toThrow(); // Maintainer: the record denotes an economic home, not current native ownership.
    const bad = clone(saved);
    bad.run.world5!.residents[0]!.actorId = bad.run.nextEntityId;
    bad.run.world5!.offline[0]!.residentStates[0]!.actorId = bad.run.nextEntityId;
    expect(g.loadSnapshot(bad)).toBe(false);
  });
  it('loads a historical dead resident after the native sweep has removed its active entity', () => {
    const g = game(); g.executeCommand('world5:fixture');
    const id = g.world5!.residents[0]!.actorId, actor = g.monsters.find(m => m.id === id)!;
    g.executeCommand('wait', undefined, () => g.killMonster(actor));
    g.executeCommand('wait');
    expect(g.monsters.some(m => m.id === id)).toBe(false);
    const saved = g.toSnapshot();
    expect(g.loadSnapshot(saved)).toBe(true);
    expect(g.world5!.residents[0]!.actorId).toBe(id);
    expect(g.world5!.offline[0]!.residentStates[0]!.alive).toBe(false);
    expect(g.world5!.orders[0]).toMatchObject({ status: 'stopped', stopReason: 'resident-dead' });
  });
  it('rejects a historical-dead resident ID that is currently owned by a native Item', () => {
    const g = game(); g.executeCommand('world5:fixture');
    const actor = g.monsters.find(m => m.id === g.world5!.residents[0]!.actorId)!;
    g.executeCommand('wait', undefined, () => g.killMonster(actor)); g.executeCommand('wait');
    const bad = clone(g.toSnapshot()), id = bad.player.inventory[0]!.id, w = bad.run.world5!;
    w.residents[0]!.actorId = id; w.orders[0]!.actorId = id;
    w.offline[0]!.residentStates[0]!.actorId = id; w.offline[0]!.frozen.residents[0]!.actorId = id;
    const player = g.player, world = g.world5, random = rng.getState();
    expect(g.loadSnapshot(bad)).toBe(false); expect(g.player).toBe(player); expect(g.world5).toBe(world);
    expect(rng.getState()).toEqual(random);
  });
  it('accepts a retired economic resident registration while its native actor is pending on a different layer', () => {
    const g = game(); g.executeCommand('world5:fixture');
    const saved = g.toSnapshot(), id = g.world5!.residents[0]!.actorId;
    const row = saved.monsters.find(m => m.id === id)!;
    const bad = clone(saved);
    bad.monsters = bad.monsters.filter(m => m.id !== id);
    bad.entityGraph.monsters = bad.entityGraph.monsters.filter(m => m.id !== id);
    bad.pendingFallenByDepth.push({ depth: 2, monsters: [clone(row)] });
    bad.run.world5!.offline[0]!.residentStates[0]!.alive = false;
    bad.run.world5!.orders[0]!.status = 'stopped'; bad.run.world5!.orders[0]!.stopReason = 'resident-dead';
    expect(g.loadSnapshot(bad)).toBe(true);
    expect(g.world5!.offline[0]!.residentStates[0]!.alive).toBe(false);
    expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
  });
  it('rejects bad frozen fingerprints and legacy ledger duplication before retiring the live run', () => {
    const g = game();
    g.executeCommand('world5:fixture');
    const saved = clone(g.toSnapshot()),
      player = g.player,
      world = g.world5;
    for (const mutate of [
      (s: typeof saved) => {
        s.run.world5!.offline[0]!.frozen.rulesFingerprint = '0'.repeat(64);
      },
      (s: typeof saved) => {
        (s.run.world5!.offline[0] as any).remainingEpochs = 3;
      }
    ]) {
      const bad = clone(saved);
      mutate(bad);
      expect(g.loadSnapshot(bad)).toBe(false);
      expect(g.player).toBe(player);
      expect(g.world5).toBe(world);
    }
  });
  it.each(['prepare', 'publish'] as const)('entry rejects asynchronous %s and rolls back the native graph and services', phase => {
    const g = game(); g.executeCommand('world5:fixture');
    g.depth = 2; (g as any).generateDepth(false); g.executeCommand('wait');
    const audit = auditFullObjectGraph(fullGenerationRoots(g), [g.extensionRuntime!]), world = g.world5,
      random = rng.getState(), messages = logger.peekState(), modules = g.extensionRuntime!.snapshot();
    const mutate = () => { g.player.hp--; g.world5!.orders[0]!.remainingEpochs = 0; rng.randRange(0, 100); logger.log('injected'); };
    vi.spyOn(g.extensionRuntime!, 'prepareWorld5Settlement').mockImplementation(() => {
      if (phase === 'prepare') { mutate(); return Promise.resolve(() => {}) as any; }
      return () => { mutate(); return Promise.resolve() as any; };
    });
    g.depth = 1;
    expect(() => (g as any).generateDepth(true)).toThrow('C5_PROVIDER');
    expect(g.depth).toBe(2); expect(g.world5).toBe(world); expect(rng.getState()).toEqual(random);
    expect(logger.peekState()).toEqual(messages); expect(g.extensionRuntime!.snapshot()).toEqual(modules);
    expect(audit.differences()).toEqual([]);
  });
  it('entry participant failure restores the complete object graph, ownership, frozen ledger and RNG', () => {
    const g = game();
    g.executeCommand('world5:fixture');
    g.depth = 2;
    (g as any).generateDepth(false);
    g.executeCommand('wait');
    const audit = auditFullObjectGraph(fullGenerationRoots(g), [g.extensionRuntime!]),
      w = g.world5,
      random = rng.getState();
    vi.spyOn(g.extensionRuntime!, 'prepareWorld5Settlement').mockImplementation(() => () => {
      throw new Error('fixture publish');
    });
    g.depth = 1;
    expect(() => (g as any).generateDepth(true)).toThrow('C5_TRANSACTION');
    expect(g.depth).toBe(2);
    expect(g.world5).toBe(w);
    expect(rng.getState()).toEqual(random);
    expect(audit.differences()).toEqual([]);
  });
});

function walkToStair(g: ReturnType<typeof game>, kind: TerrainType): { x: number; y: number } {
  for (let commands = 0; commands < 600; commands++) {
    g.update();
    while (logger.pendingAcknowledgment) logger.acknowledgeNext();
    let target: { x: number; y: number } | undefined;
    for (let y = 0; y < g.grid.height; y++)
      for (let x = 0; x < g.grid.width; x++)
        if (g.grid.getCell(x, y)!.layers.includes(kind)) target = { x, y };
    expect(target).toBeDefined();
    if (Math.abs(g.player.x - target!.x) + Math.abs(g.player.y - target!.y) <= 1) return target!;
    const key = (p: { x: number; y: number }) => p.y * g.grid.width + p.x,
      queue = [{ ...g.player.loc }],
      previous = new Map<number, { x: number; y: number } | null>([[key(g.player.loc), null]]);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!;
      if (key(p) === key(target!)) break;
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0]
      ]) {
        const at = { x: p.x + dx!, y: p.y + dy! },
          c = g.grid.getCell(at.x, at.y);
        if (
          c &&
          (c.isPassable ||
            c.layers.includes(TerrainType.DOOR) ||
            c.layers.includes(TerrainType.SECRET_DOOR)) &&
          !c.layers.some((t) => isAutoDescent(t) || isDeepWater(t) || t === TerrainType.LAVA) &&
          !g.getMonsterAt(at.x, at.y)?.isAlly &&
          !previous.has(key(at))
        ) {
          previous.set(key(at), p);
          queue.push(at);
        }
      }
    }
    if (!previous.has(key(target!))) {
      g.executeCommand('wait');
      continue;
    }
    let at = target!,
      next = at;
    while (previous.get(key(at))) {
      next = at;
      at = previous.get(key(at))!;
    }
    if (g.grid.getCell(next.x, next.y)!.layers.includes(TerrainType.SECRET_DOOR))
      g.executeCommand('search');
    else g.executeCommand('move', { x: next.x - g.player.x, y: next.y - g.player.y });
  }
  throw new Error(
    'Fixture stair route did not complete ' +
      JSON.stringify({
        loc: g.player.loc,
        hp: g.player.hp,
        depth: g.depth,
        gameOver: g.isGameOver,
        inputLocked: g.isInputLocked(),
        inventory: g.isInventoryOpen,
        pending: g.pendingCommandConfirmation,
        tail: g.recordedInputEvents
          .slice(-6)
          .map((e) => ({ action: e.action, pos: e.player, tick: e.tick, decisions: e.decisions }))
      })
  );
}
describe('C5 actual two-floor input replay and continuation', () => {
  it.each(
    [['world5-fixture'], ['world5-fixture', 'combat', 'giants']].map((ids) => [ids] as const)
  )(
    'settles once on the original return command in %j, including save/load, replay, seek and continuation',
    (ids) => {
      const registry = catalog.createExtensionRegistry();
      registry.register('world5-fixture', '1.0.0', createWorld5Module, fixtureRulesIdentity);
      vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
      const g = createHeadlessGame(7306, 'test');
      g.startNewGame({ seed: 7306, mode: 'wizard', ruleSet: 'extended', extensions: ids });
      g.animationEnabled = false;
      const down = walkToStair(g, TerrainType.STAIRS_DOWN);
      g.executeCommand('world5:fixture');
      const actor = g.world5!.residents[0]!.actorId;
      g.executeCommand('move', { x: down.x - g.player.x, y: down.y - g.player.y });
      expect(g.depth).toBe(2);
      expect(g.levels.get(1)!.monsters.some((m) => m.id === actor)).toBe(true);
      for (let i = 0; i < 340; i++) {
        g.update();
        while (logger.pendingAcknowledgment) logger.acknowledgeNext();
        g.executeCommand('wait');
      }
      const save = structuredClone(g.toSaveSnapshot());
      expect(save.run.recordingOrigin).toBeDefined();
      const ledger = structuredClone(save.run.world5!.offline[0]!);
      expect(g.loadSnapshot(save)).toBe(true);
      expect(g.world5!.offline[0]).toEqual(ledger);
      const up = walkToStair(g, TerrainType.STAIRS_UP);
      g.executeCommand('move', { x: up.x - g.player.x, y: up.y - g.player.y });
      expect(g.depth).toBe(1);
      expect(g.world5!.receipts).toHaveLength(1);
      const expected = structuredClone(g.world5!),
        module = structuredClone(g.extensionRuntime!.snapshot()),
        recording = g.exportRecording();
      expect(g.loadReplay(recording)).toBe(true);
      while (g.replayCursor < recording.events.length && !g.replayError) g.replayStep(true);
      expect(g.replayError).toBeNull();
      expect(g.world5).toEqual(expected);
      expect(g.extensionRuntime!.snapshot()).toEqual(module);
      for (const index of [save.run.recordingOrigin!.events.length, recording.events.length]) {
        g.replaySeek(index);
        expect(g.replayError).toBeNull();
        expect(g.replayCursor).toBe(index);
      }
      expect(g.world5).toEqual(expected);
      const branch = g.toSaveSnapshot();
      expect(g.loadSnapshot(branch)).toBe(true);
      g.executeCommand('escape');
      const continued = g.exportRecording();
      expect(continued.events.slice(0, recording.events.length)).toEqual(continuingPrefix(recording));
      expect(g.loadReplay(continued)).toBe(true);
      g.replaySeek(continued.events.length);
      expect(g.replayError).toBeNull();
      expect(g.world5).toEqual(expected);
    },
    120000
  );
});
