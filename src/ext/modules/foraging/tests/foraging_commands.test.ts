import { describe, expect, it, vi } from 'vitest';
import type { EdiblePrepareSDK } from '../../../edibleSdk';
import type { WorldWorkPrepareSDK } from '../../../worldSdk';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { prepareWorldWorkCommand } from '../../../../engine/Core/WorldWork';
import { prepareEdibleCommand, readEdibleContext } from '../../../../engine/Core/EdibleCommands';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { getNextEntityId } from '../../../../entities/Creature';
import { prepareForagingCommand, createForagingEdibleCommands, createForagingWorldWorkCommands } from '../commands';
import type { ForagingAction } from '../commands';
import { assembleEdibleItem } from '../../../../engine/Core/KindKnowledge';
import { Monster } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { makeHarness, scene, hearth } from './mechanicsHelpers';

const payloads = {
  harvest: { v: 1, nodeId: 5, nodeRevision: 0, inventoryStamp: 'stamp', destinationId: null as number | null, destinationRevision: null as number | null },
  feed: { v: 1, targetId: 4, targetRevision: 0, itemId: 2, inventoryStamp: 'stamp' },
  roast: { v: 1, heatSourceId: 4, itemId: 2, inventoryStamp: 'stamp' }
};
const sentinel = { ok: false, code: 'C5_GATE', field: 'foundation' } as const;
function sdk() {
  return { owner: 'foraging', actorId: 1, readWorkContext: vi.fn<WorldWorkPrepareSDK['readWorkContext']>(),
    planTimedWork: vi.fn<WorldWorkPrepareSDK['planTimedWork']>(() => sentinel), planStationPlacement: vi.fn<WorldWorkPrepareSDK['planStationPlacement']>(),
    planCancelWork: vi.fn<WorldWorkPrepareSDK['planCancelWork']>(), readEdibleContext: vi.fn<EdiblePrepareSDK['readEdibleContext']>(),
    planFeed: vi.fn<EdiblePrepareSDK['planFeed']>(() => sentinel), planRoast: vi.fn<EdiblePrepareSDK['planRoast']>(() => sentinel) };
}
function prepare(action: ForagingAction, value: unknown, tools = sdk()) {
  return action === 'harvest' ? prepareForagingCommand(action, value as never, tools) : prepareForagingCommand(action, value as never, tools);
}
function bad(action: ForagingAction, value: unknown) {
  const tools = sdk(); expect(prepare(action, value, tools)).toMatchObject({ ok: false, code: 'C5_BAD_PAYLOAD' });
  for (const method of [tools.planTimedWork, tools.planFeed, tools.planRoast, tools.planStationPlacement, tools.planCancelWork, tools.readEdibleContext, tools.readWorkContext]) expect(method).not.toHaveBeenCalled();
}

describe('foraging strict command preparation', () => {
  for (const action of Object.keys(payloads) as ForagingAction[]) {
    it.each([null, undefined, [], 1, 'payload', true])(`${action} rejects nonrecord %j`, p => bad(action, p));
    it.each([0, 2, '1', null, 1.5, NaN, Infinity])(`${action} rejects version %j`, v => bad(action, { ...payloads[action], v }));
    for (const key of Object.keys(payloads[action])) it(`${action} requires ${key}`, () => {
      const p: Record<string, unknown> = { ...payloads[action] }; delete p[key]; bad(action, p);
    });
    it(`${action} rejects unknown keys, symbols, prototypes, getters and nonstring stamps`, () => {
      const getter = vi.fn(() => { throw Error('getter'); });
      for (const p of [{ ...payloads[action], actorId: 2 }, { ...payloads[action], [Symbol('extra')]: true },
        Object.assign(Object.create({ extra: 1 }), payloads[action]), Object.defineProperty({ ...payloads[action] }, 'v', { enumerable: true, get: getter })]) bad(action, p);
      expect(getter).not.toHaveBeenCalled();
      for (const inventoryStamp of [null, 0, true, {}, []]) bad(action, { ...payloads[action], inventoryStamp });
      const revoked = Proxy.revocable({}, {}); revoked.revoke(); bad(action, revoked.proxy);
    });
  }
  it('delegates exactly once to the matching plan, removes v and preserves SDK result identity', () => {
    const tools = sdk();
    expect(createForagingWorldWorkCommands().harvest.prepare(Object.freeze({ ...payloads.harvest }), tools)).toBe(sentinel);
    expect(tools.planTimedWork).toHaveBeenCalledExactlyOnceWith({ kind: 'harvest', nodeId: 5, nodeRevision: 0, inventoryStamp: 'stamp', destinationId: null, destinationRevision: null });
    expect(createForagingEdibleCommands().feed.prepare(Object.freeze({ ...payloads.feed }), tools)).toBe(sentinel);
    expect(tools.planFeed).toHaveBeenCalledExactlyOnceWith({ targetId: 4, targetRevision: 0, itemId: 2, inventoryStamp: 'stamp' });
    expect(createForagingEdibleCommands().roast.prepare(Object.freeze({ ...payloads.roast }), tools)).toBe(sentinel);
    expect(tools.planRoast).toHaveBeenCalledExactlyOnceWith({ heatSourceId: 4, itemId: 2, inventoryStamp: 'stamp' });
    expect(tools.readWorkContext).not.toHaveBeenCalled(); expect(tools.readEdibleContext).not.toHaveBeenCalled();
    expect(tools.planStationPlacement).not.toHaveBeenCalled(); expect(tools.planCancelWork).not.toHaveBeenCalled();
  });
  for (const [action, field, min] of [['harvest', 'nodeId', 1], ['harvest', 'nodeRevision', 0], ['feed', 'targetId', 1],
    ['feed', 'targetRevision', 0], ['feed', 'itemId', 1], ['roast', 'heatSourceId', 1], ['roast', 'itemId', 1]] as const) {
    it(`${action}.${field} is a safe integer at least ${min}`, () => {
      for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, '1', null, undefined, ...(min ? [0] : [])])
        bad(action, { ...payloads[action], [field]: value });
      expect(prepare(action, { ...payloads[action], [field]: min })).toBe(sentinel);
      expect(prepare(action, { ...payloads[action], [field]: Number.MAX_SAFE_INTEGER })).toBe(sentinel);
    });
  }
  it('requires paired nulls or valid destination identity/revision', () => {
    for (const [destinationId, destinationRevision] of [[null, 0], [1, null], [0, 0], [-1, 0], [1, -1], [1, 0.2], [1.2, 0], [1, Infinity], ['1', 0], [1, Number.MAX_SAFE_INTEGER + 1]])
      bad('harvest', { ...payloads.harvest, destinationId, destinationRevision });
    expect(prepare('harvest', { ...payloads.harvest, destinationId: 3, destinationRevision: 0 })).toBe(sentinel);
  });
});

describe('foraging real SDK preparation purity', () => {
  it('preserves module/world state, clocks, both streams, entity/plan IDs, recording and messages before commit', () => {
    const h = createWorldHarness({ seed: 1, modules: ['foraging'] });
    try {
      const game = worldHarnessGame(h); game.monsters = []; game.dormantMonsters = [];
      const nodes = h.world5()!.nodes.filter(n => n.owner === 'foraging'); expect(nodes.length).toBeGreaterThan(0);
      const node = nodes[0]!;
      game.player.loc = { ...node.at };
      (game as unknown as { updateVision(): void }).updateVision();
      const read = h.readWorkContext('foraging', { kind: 'node', interactableId: node.interactableId });
      if (!read.ok || !read.value.node) throw Error('node');
      game.player.loc = { ...read.value.node.at };
      const before = () => ({ world: h.world5(), runtime: game.extensionRuntime!.snapshot(), actions: structuredClone(game.actorActions),
        nextId: getNextEntityId(), rng: rng.getState(), tick: game.toSnapshot().run.currentTick,
        messages: logger.getState(), events: game.recordedInputEvents.length,
        inventory: game.player.inventory.items.map(i => ({ id: i.id, quantity: i.quantity, world: i.worldItem })) });
      const snapshot = before();
      const command = { module: 'foraging', action: 'harvest', payload: { ...payloads.harvest, nodeId: node.interactableId,
        nodeRevision: read.value.node.revision, inventoryStamp: read.value.inventoryStamp } };
      expect(prepareWorldWorkCommand(game, JSON.stringify(command)).outcome.ok).toBe(true); expect(before()).toEqual(snapshot);
      for (const payload of [{ ...command.payload, v: 2 }, { ...command.payload, nodeRevision: Number.MAX_SAFE_INTEGER }, { ...command.payload, inventoryStamp: 'stale' }]) {
        expect(prepareWorldWorkCommand(game, JSON.stringify({ ...command, payload })).outcome.ok).toBe(false); expect(before()).toEqual(snapshot);
      }
      for (const action of ['feed', 'roast'] as const) for (const patch of [{}, { v: 2 }, { inventoryStamp: 'stale' }]) {
        expect(prepareEdibleCommand(game, JSON.stringify({ module: 'foraging', action, payload: { ...payloads[action], ...patch } })).outcome.ok).toBe(false);
        expect(before()).toEqual(snapshot);
      }
    } finally { h.dispose(); }
  });
  it('valid feed and roast plans are equally pure, including successful foundation handles', () => {
    const h = makeHarness(51020001, ['fgheat', 'foraging']);
    try {
      const g = scene(h), source = hearth(h);
      const template = monsters.find(m => m.id === 'goblin')!;
      const ally = new Monster(g.player.x, g.player.y + 1, template as unknown as ConstructorParameters<typeof Monster>[2]);
      ally.ticksUntilTurn = 1000000; g.monsters.push(ally); g.extensionRuntime!.attachCreature(ally); g.becomeAllyWith(ally);
      const item = assembleEdibleItem(g, 'foraging.venom', 2); expect(g.player.inventory.addItem(item)).toBe(true);
      (g as unknown as { updateVision(): void }).updateVision();
      const read = readEdibleContext(g, 'foraging'); if (!read.ok) throw Error(read.code);
      const target = read.value.feedTargets.find(t => t.actorId === ally.id)!;
      expect(target).toBeDefined(); expect(read.value.heatSources.some(s => s.interactableId === source.interactableId)).toBe(true);
      const mechanical = () => ({ world: h.world5(), runtime: g.extensionRuntime!.snapshot(), actions: structuredClone(g.actorActions), nextId: getNextEntityId(),
        rng: rng.getState(), tick: g.toSnapshot().run.currentTick, messages: logger.getState(), events: g.recordedInputEvents.length,
        inventory: g.player.inventory.items.map(i => ({ id: i.id, quantity: i.quantity, world: i.worldItem })) });
      const before = mechanical();
      for (const [action, payload] of [
        ['feed', { v: 1, targetId: ally.id, targetRevision: target.targetRevision, itemId: item.id, inventoryStamp: read.value.inventoryStamp }],
        ['roast', { v: 1, heatSourceId: source.interactableId, itemId: item.id, inventoryStamp: read.value.inventoryStamp }]
      ] as const) {
        const prepared = prepareEdibleCommand(g, JSON.stringify({ module: 'foraging', action, payload }));
        expect(prepared.outcome.ok).toBe(true); expect(mechanical()).toEqual(before);
      }
    } finally { h.dispose(); }
  });

});
