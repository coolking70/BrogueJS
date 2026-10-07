import { describe, expect, it, vi } from 'vitest';
import type {
  CraftingAction, CraftingCommand, JsonValue, StationRead, WorkContext,
  WorldResult, WorldPlanHandle, WorldWorkPrepareSDK
} from '../../../worldSdk';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { prepareWorldWorkCommand } from '../../../../engine/Core/WorldWork';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { timeSystem } from '../../../../engine/Systems/Time';
import { getNextEntityId } from '../../../../entities/Creature';
import { createCraftingCommands, prepareCraftingCommand } from '../commands';
import { loadCraftingPack } from '../definitions';

const pack = loadCraftingPack();
const payloads = {
  harvest: { v: 1, nodeId: 5, nodeRevision: 0, inventoryStamp: 'stamp', destinationId: null, destinationRevision: null },
  craft: { v: 1, recipeId: 'crafting.make-pick', batchCount: 1, stationId: null, stationRevision: null, sourceContainerId: null, sourceRevision: null, inventoryStamp: 'stamp' },
  'place-station': { v: 1, definitionId: 'crafting.table', x: 3, y: 4, inventoryStamp: 'stamp' },
  'cancel-work': { v: 1, ticketId: 10, ticketRevision: 0 }
} satisfies { [A in CraftingAction]: Extract<CraftingCommand, { action: A }>['payload'] };
const actions = Object.keys(payloads) as CraftingAction[];
const sentinel: WorldResult<WorldPlanHandle> = { ok: false, code: 'C5_GATE', field: 'foundation' };
function station(id: number, definitionId = 'crafting.table', depth = 1): StationRead {
  return { interactableId: id, definitionId, levelRef: { kind: 'dungeon', depth }, at: { x: 2, y: 3 },
    revision: 0, tags: ['station.table'], workPositions: [{ x: 3, y: 3 }] };
}
function sdkWith(stations: StationRead[] = []) {
  const context: WorkContext = { contract: 'C5-1', owner: 'crafting', actorId: 1,
    levelRef: { kind: 'dungeon', depth: 1 }, at: { x: 3, y: 3 }, inventoryStamp: 'stamp',
    available: true, node: null, stations, inventory: [], containers: [], activeTicket: null };
  return {
    owner: 'crafting', actorId: 1,
    readWorkContext: vi.fn<WorldWorkPrepareSDK['readWorkContext']>(() => ({ ok: true, value: context })),
    planTimedWork: vi.fn<WorldWorkPrepareSDK['planTimedWork']>(() => sentinel),
    planStationPlacement: vi.fn<WorldWorkPrepareSDK['planStationPlacement']>(() => sentinel),
    planCancelWork: vi.fn<WorldWorkPrepareSDK['planCancelWork']>(() => sentinel)
  };
}
const prepare = (action: CraftingAction, payload: unknown, sdk = sdkWith()) =>
  prepareCraftingCommand(action, payload as JsonValue, sdk, pack);
const bad = (action: CraftingAction, payload: unknown) => {
  const sdk = sdkWith();
  expect(prepare(action, payload, sdk)).toMatchObject({ ok: false, code: 'C5_BAD_PAYLOAD' });
  expect(sdk.planTimedWork).not.toHaveBeenCalled();
  expect(sdk.planStationPlacement).not.toHaveBeenCalled();
  expect(sdk.planCancelWork).not.toHaveBeenCalled();
};

describe('crafting strict payloads', () => {
  for (const action of actions) {
    it.each([null, [], 1, 'payload', undefined])(`${action}: rejects non-object %j`, payload => bad(action, payload));
    it.each([0, 2, '1', null, 1.5])(`${action}: rejects version %j`, v => bad(action, { ...payloads[action], v }));
    for (const key of Object.keys(payloads[action])) {
      it(`${action}: requires ${key}`, () => {
        const payload: Record<string, unknown> = { ...payloads[action] };
        delete payload[key];
        bad(action, payload);
      });
    }
    it(`${action}: rejects forged actor, surplus metadata, getters, prototype and symbol keys`, () => {
      bad(action, { ...payloads[action], actorId: 2 });
      bad(action, { ...payloads[action], workTicks: 100 });
      bad(action, Object.assign(Object.create({ polluted: true }), payloads[action]));
      bad(action, { ...payloads[action], [Symbol('extra')]: 1 });
      const getter = vi.fn(() => { throw new Error('must not run'); });
      bad(action, Object.defineProperty({ ...payloads[action] }, 'v', { enumerable: true, get: getter }));
      expect(getter).not.toHaveBeenCalled();
    });
  }
  it('delegates harvest with kind and without v, preserving the SDK result identity', () => {
    const sdk = sdkWith(), payload = Object.freeze({ ...payloads.harvest });
    expect(prepare('harvest', payload, sdk)).toBe(sentinel);
    expect(sdk.planTimedWork).toHaveBeenCalledExactlyOnceWith({ kind: 'harvest', nodeId: 5, nodeRevision: 0,
      inventoryStamp: 'stamp', destinationId: null, destinationRevision: null });
    expect(payload).toEqual(payloads.harvest);
  });
  it('delegates craft, station placement and cancellation to their matching plan methods', () => {
    const sdk = sdkWith(), commands = createCraftingCommands(pack);
    expect(commands.craft.prepare(Object.freeze(payloads.craft), sdk)).toBe(sentinel);
    expect(sdk.planTimedWork).toHaveBeenCalledExactlyOnceWith({ kind: 'craft', recipeId: 'crafting.make-pick',
      batchCount: 1, stationId: null, stationRevision: null, sourceContainerId: null,
      sourceRevision: null, inventoryStamp: 'stamp' });
    expect(commands['place-station'].prepare(Object.freeze(payloads['place-station']), sdk)).toBe(sentinel);
    expect(sdk.readWorkContext).toHaveBeenCalledExactlyOnceWith({ kind: 'inventory' });
    expect(sdk.planStationPlacement).toHaveBeenCalledExactlyOnceWith({ definitionId: 'crafting.table',
      at: { x: 3, y: 4 }, inventoryStamp: 'stamp' });
    expect(commands['cancel-work'].prepare(Object.freeze(payloads['cancel-work']), sdk)).toBe(sentinel);
    expect(sdk.planCancelWork).toHaveBeenCalledExactlyOnceWith({ ticketId: 10, ticketRevision: 0 });
  });
  it.each([0, -1, 17, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '2'])('rejects batch count %j', batchCount => {
    bad('craft', { ...payloads.craft, batchCount });
  });
  it.each([1, 16])('accepts batch boundary %i', batchCount => {
    expect(prepare('craft', { ...payloads.craft, batchCount })).toBe(sentinel);
  });
  it('uses the pack batch limit without expanding the frozen SDK limit', () => {
    const tight = structuredClone(pack); tight.limits.batchMax = 2;
    expect(prepareCraftingCommand('craft', { ...payloads.craft, batchCount: 3 }, sdkWith(), tight))
      .toMatchObject({ ok: false, code: 'C5_BAD_PAYLOAD', field: 'batchCount' });
  });
  const numericFields: [CraftingAction, string, boolean][] = [
    ['harvest', 'nodeId', true], ['harvest', 'nodeRevision', false],
    ['cancel-work', 'ticketId', true], ['cancel-work', 'ticketRevision', false]
  ];
  for (const [action, field, positive] of numericFields) {
    it(`${action}: ${field} is a safe ${positive ? 'positive' : 'nonnegative'} integer`, () => {
      for (const value of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null, ...(positive ? [0] : [])])
        bad(action, { ...payloads[action], [field]: value });
    });
  }
  it('requires integer coordinates and string stamps and IDs', () => {
    for (const field of ['x', 'y']) {
      for (const value of [1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '3', null])
        bad('place-station', { ...payloads['place-station'], [field]: value });
    }
    for (const action of ['harvest', 'craft', 'place-station'] as const)
      for (const inventoryStamp of [null, 1, true]) bad(action, { ...payloads[action], inventoryStamp });
    bad('craft', { ...payloads.craft, recipeId: 3 });
    bad('place-station', { ...payloads['place-station'], definitionId: 3 });
  });
  it('rejects unknown or foreign recipe/station definitions before planning', () => {
    for (const recipeId of ['crafting.missing', 'other.make-pick', 'crafting.table'])
      expect(prepare('craft', { ...payloads.craft, recipeId })).toMatchObject({ ok: false, code: 'C5_BAD_DEFINITION' });
    for (const definitionId of ['crafting.missing', 'other.table', 'crafting.make-pick'])
      expect(prepare('place-station', { ...payloads['place-station'], definitionId })).toMatchObject({ ok: false, code: 'C5_BAD_DEFINITION' });
  });
  it('requires destination and source identifiers/revisions to be null together or valid together', () => {
    for (const [id, revision] of [[null, 0], [1, null], [0, 0], [-1, 0], [1, -1], [1, 0.5], [1.5, 0], [1, Infinity], ['1', 0]]) {
      bad('harvest', { ...payloads.harvest, destinationId: id, destinationRevision: revision });
      bad('craft', { ...payloads.craft, sourceContainerId: id, sourceRevision: revision });
      bad('craft', { ...payloads.craft, recipeId: 'crafting.make-dagger', stationId: id, stationRevision: revision });
    }
    expect(prepare('harvest', { ...payloads.harvest, destinationId: 8, destinationRevision: 0 })).toBe(sentinel);
    expect(prepare('craft', { ...payloads.craft, sourceContainerId: 8, sourceRevision: 0 })).toBe(sentinel);
  });
  it('requires a station exactly when recipe tags are nonempty', () => {
    bad('craft', { ...payloads.craft, stationId: 9, stationRevision: 0 });
    bad('craft', { ...payloads.craft, recipeId: 'crafting.make-dagger' });
    expect(prepare('craft', { ...payloads.craft, recipeId: 'crafting.make-dagger', stationId: 9, stationRevision: 0 })).toBe(sentinel);
  });
  it('counts all crafting stations on this level, but excludes other levels and owners', () => {
    const local = Array.from({ length: 16 }, (_, i) => station(i + 1));
    const sdk = sdkWith(local);
    expect(prepare('place-station', payloads['place-station'], sdk)).toEqual({ ok: false, code: 'C5_BUDGET', field: null });
    expect(sdk.planStationPlacement).not.toHaveBeenCalled();
    const allowed = sdkWith([...local.slice(0, 15), station(90, 'other.table'), station(91, 'crafting.hearth', 2)]);
    expect(prepare('place-station', payloads['place-station'], allowed)).toBe(sentinel);
    expect(allowed.planStationPlacement).toHaveBeenCalledTimes(1);
  });
  it('returns read failures unchanged and never prepares placement after a failed read', () => {
    const sdk = sdkWith();
    const failure = { ok: false, code: 'C5_UNKNOWN_TARGET', field: 'inventory' } as const;
    sdk.readWorkContext.mockReturnValue(failure);
    expect(prepare('place-station', payloads['place-station'], sdk)).toBe(failure);
    expect(sdk.planStationPlacement).not.toHaveBeenCalled();
  });
});

describe('crafting real prepare purity', () => {
  it('valid and rejected preparations preserve state, both RNG streams, entity/plan IDs, clocks and messages', () => {
    const h = createWorldHarness({ seed: 42, mode: 'normal', modules: ['crafting'] });
    try {
      const game = worldHarnessGame(h);
      // Test arrangement only: isolate prepare from an unrelated initial threat gate.
      game.monsters = [];
      game.dormantMonsters = [];
      const read = h.readWorkContext('crafting', { kind: 'inventory' });
      if (!read.ok) throw new Error(read.code);
      const mechanical = () => ({
        world: h.world5(), actions: structuredClone(game.actorActions), ids: getNextEntityId(),
        rng: rng.getState(), tick: timeSystem.currentTick, messages: logger.getState(),
        runtime: game.extensionRuntime!.snapshot(), recording: game.recordedInputEvents.length,
        inventory: game.player.inventory.items.map(item => ({ id: item.id, quantity: item.quantity, world: item.worldItem }))
      });
      const before = mechanical();
      const command = { module: 'crafting', action: 'craft', payload: { ...payloads.craft, inventoryStamp: read.value.inventoryStamp } };
      const plan = prepareWorldWorkCommand(game, JSON.stringify(command));
      expect(plan.outcome.ok).toBe(true);
      expect(mechanical()).toEqual(before);
      if (plan.outcome.ok) expect(Object.isFrozen(plan.outcome.value.casKeys)).toBe(true);
      const rejected: [CraftingAction, JsonValue][] = [
        ['craft', { ...command.payload, batchCount: 17 }],
        ['craft', { ...command.payload, inventoryStamp: 'stale' }],
        ['harvest', { ...payloads.harvest, nodeId: Number.MAX_SAFE_INTEGER, inventoryStamp: read.value.inventoryStamp }],
        ['place-station', { ...payloads['place-station'], definitionId: 'crafting.missing', inventoryStamp: read.value.inventoryStamp }],
        ['cancel-work', payloads['cancel-work']]
      ];
      for (const [action, payload] of rejected) {
        expect(prepareWorldWorkCommand(game, JSON.stringify({ module: 'crafting', action, payload })).outcome.ok).toBe(false);
        expect(mechanical()).toEqual(before);
      }
    } finally { h.dispose(); }
  });
});
