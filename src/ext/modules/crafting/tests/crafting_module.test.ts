import { describe, expect, it, vi } from 'vitest';
import { validateModuleDescriptors, FOUNDATION_PROTOCOL } from '../../../descriptor';
import type { CommittedWorkFact, JsonValue, ModuleStateTransaction } from '../../../worldSdk';
import { descriptor } from '../descriptor';
import { createCraftingModule } from '../index';
import { createCraftingModuleFromPack } from '../module';
import { getCraftingPackIdentity, loadCraftingPack, toWorldDefinitionPack } from '../definitions';
import { applyFact, initialCraftingState, validateCraftingState } from '../state';
import type { CraftingState } from '../state';

const pack = loadCraftingPack();
const fact = (patch: Partial<CommittedWorkFact> = {}): CommittedWorkFact => ({
  owner: 'crafting', factId: 1, ticketId: 1, completionOrdinal: 1,
  operation: 'craft-batch', definitionId: 'crafting.make-pick', actorId: 1,
  completedBatches: 1, result: 'completed', reason: null, tick: 500, ...patch
});
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
const valid = () => applyFact(initialCraftingState(), fact());

describe('crafting module contract', () => {
  it('discovers a foundation-only descriptor with matching rules and world SDK', () => {
    expect(validateModuleDescriptors([descriptor])).toHaveLength(1);
    expect(descriptor).toMatchObject({
      id: 'crafting', version: '1.0.0', foundation: FOUNDATION_PROTOCOL,
      worldSdk: 1, defaultEnabled: false, rules: getCraftingPackIdentity(pack)
    });
    const module = createCraftingModule();
    expect(Object.keys(module).sort()).toEqual([
      'id', 'version', 'rules', 'worldDefinitions', 'worldWorkCommands',
      'worldWorkParticipant', 'initialState', 'validateState', 'projectView'
    ].sort());
    expect(module.rules).toEqual(descriptor.rules);
    expect(Object.keys(module.worldWorkCommands!).sort()).toEqual(['cancel-work', 'craft', 'harvest', 'place-station']);
    for (const command of Object.values(module.worldWorkCommands!)) expect(Object.keys(command)).toEqual(['prepare']);
    expect(Object.keys(module.worldWorkParticipant!)).toEqual(['onCommitted']);
  });
  it('preserves item and definition order and excludes private limits from SDK definitions', () => {
    expect(toWorldDefinitionPack(pack)).toEqual({
      schema: 1, worldSdk: 1, items: [...pack.materials, ...pack.tools],
      resourceNodes: pack.resourceNodes, stations: pack.stations,
      recipes: pack.recipes, startupItems: pack.startupItems
    });
    expect(toWorldDefinitionPack(pack).items.map(row => row.id)).toEqual([
      ...pack.materials.map(row => row.id), ...pack.tools.map(row => row.id)
    ]);
  });
  it('owns a detached validated pack and rejects invalid configuration atomically', () => {
    const input = loadCraftingPack();
    const module = createCraftingModuleFromPack(input);
    input.recipes[0]!.workTicks = 600;
    expect(module.worldDefinitions!.recipes[0]!.workTicks).toBe(500);
    expect(() => createCraftingModuleFromPack({ ...pack, schema: 2 } as never)).toThrow();
  });
  it('initializes only versioned empty history and counters with fresh arrays', () => {
    const state = initialCraftingState();
    expect(state).toEqual({ schema: 1, lastFactId: 0,
      totals: { harvest: 0, craftBatches: 0, placements: 0, cancels: 0, startup: 0 },
      placements: [], history: [] });
    expect(validateCraftingState(state)).toBe(true);
    expect(createCraftingModule().validateState(state)).toBe(true);
    state.totals.harvest = 3;
    expect(initialCraftingState().totals.harvest).toBe(0);
  });
});

describe('crafting state validation and fact receipts', () => {
  it('handles frozen input, gaps, duplicates, old facts and other owners without mutation', () => {
    const state = freeze(initialCraftingState());
    const next = applyFact(state, freeze(fact({ factId: 40 })));
    expect(next).not.toBe(state);
    expect(state.lastFactId).toBe(0);
    expect(next.lastFactId).toBe(40);
    expect(next.totals.craftBatches).toBe(1);
    expect(applyFact(next, fact({ factId: 40 }))).toBe(next);
    expect(applyFact(next, fact({ factId: 20 }))).toBe(next);
    expect(applyFact(next, fact({ factId: 50, owner: 'other' }))).toBe(next);
    expect(applyFact(next, fact({ factId: 81 })).totals.craftBatches).toBe(2);
  });
  it('accepted advances only the watermark and cannot become a receipt', () => {
    const state = freeze(valid());
    const next = applyFact(state, fact({ factId: 30, result: 'accepted', completedBatches: 0, completionOrdinal: 0 }));
    expect(next).toEqual({ ...state, lastFactId: 30 });
    expect(next).not.toBe(state);
    expect(validateCraftingState(next)).toBe(true);
  });
  it('counts one per completed fact, startup/cancel outcomes, and station interruption receipts', () => {
    let state = initialCraftingState();
    const rows: Partial<CommittedWorkFact>[] = [
      { operation: 'harvest', definitionId: 'crafting.wood-node' },
      { operation: 'craft-batch', completedBatches: 7 },
      { operation: 'place-station', definitionId: 'crafting.table' },
      { operation: 'harvest', definitionId: 'crafting.wood-node', result: 'interrupted' },
      { operation: 'craft-batch', result: 'skipped' },
      { operation: 'place-station', definitionId: 'crafting.table', result: 'interrupted' },
      { operation: 'cancel', definitionId: 'crafting.hearth', result: 'interrupted', reason: 'damage' },
      { operation: 'cancel', result: 'interrupted', reason: 'player' },
      { operation: 'startup', definitionId: 'crafting.wood', result: 'completed', ticketId: null, completedBatches: 0 },
      { operation: 'startup', definitionId: 'crafting.wood', result: 'skipped', ticketId: null, completedBatches: 0 }
    ];
    rows.forEach((row, index) => { state = applyFact(state, fact({ ...row, factId: index + 1 })); });
    expect(state.totals).toEqual({ harvest: 1, craftBatches: 1, placements: 1, cancels: 2, startup: 2 });
    expect(state.placements).toEqual([
      { factId: 3, definitionId: 'crafting.table', result: 'completed', tick: 500 },
      { factId: 7, definitionId: 'crafting.hearth', result: 'interrupted', tick: 500 }
    ]);
    expect(state.history).toHaveLength(10);
    expect(state.history[6]!.reason).toBe('damage');
    expect(validateCraftingState(state)).toBe(true);
  });
  it('rolls receipts to 512 and history to 128 independently', () => {
    let state = initialCraftingState();
    for (let id = 1; id <= 520; id++) state = applyFact(state, fact({ factId: id, operation: 'place-station', definitionId: 'crafting.table' }));
    expect(state.placements).toHaveLength(512);
    expect(state.history).toHaveLength(128);
    expect(state.placements[0]!.factId).toBe(9);
    expect(state.history[0]!.factId).toBe(393);
    expect(state.placements[state.placements.length - 1]!.factId).toBe(520);
    expect(state.totals.placements).toBe(520);
    expect(validateCraftingState(state)).toBe(true);
  });
  it('honors stricter configured receipt limits', () => {
    const tight = structuredClone(pack);
    tight.limits.placementReceipts = 2;
    tight.limits.workHistory = 1;
    let state = initialCraftingState();
    for (let id = 1; id <= 3; id++) state = applyFact(state, fact({ factId: id, operation: 'place-station', definitionId: 'crafting.table' }), tight);
    expect(state.placements.map(row => row.factId)).toEqual([2, 3]);
    expect(state.history.map(row => row.factId)).toEqual([3]);
    expect(validateCraftingState(state, tight)).toBe(true);
  });
  it.each(['harvest', 'craft-batch', 'place-station', 'cancel', 'startup'] as const)('saturates counters for %s', operation => {
    const state = initialCraftingState();
    for (const key of Object.keys(state.totals) as (keyof CraftingState['totals'])[]) state.totals[key] = Number.MAX_SAFE_INTEGER;
    const next = applyFact(state, fact({ operation, definitionId: operation === 'place-station' ? 'crafting.table' : 'crafting.wood' }));
    expect(next.totals).toEqual(state.totals);
    expect(next.lastFactId).toBe(1);
    expect(validateCraftingState(next)).toBe(true);
  });
  const malformed: [string, (state: CraftingState) => unknown][] = [
    ['unknown root key', state => ({ ...state, extra: 1 })],
    ['missing root key', state => { delete (state as Partial<CraftingState>).schema; return state; }],
    ['wrong schema', state => ({ ...state, schema: 2 })],
    ['negative watermark', state => ({ ...state, lastFactId: -1 })],
    ['fractional watermark', state => ({ ...state, lastFactId: 1.2 })],
    ['unsafe watermark', state => ({ ...state, lastFactId: Number.MAX_SAFE_INTEGER + 1 })],
    ['watermark behind receipt', state => ({ ...state, lastFactId: 0 })],
    ['unknown total', state => ({ ...state, totals: { ...state.totals, unknown: 1 } })],
    ['negative total', state => ({ ...state, totals: { ...state.totals, harvest: -1 } })],
    ['unsafe total', state => ({ ...state, totals: { ...state.totals, harvest: Infinity } })],
    ['history duplicate ids', state => ({ ...state, history: [state.history[0], state.history[0]] })],
    ['history zero id', state => { state.history[0]!.factId = 0; return state; }],
    ['history wrong operation', state => { (state.history[0] as unknown as Record<string, unknown>).operation = 'build'; return state; }],
    ['history accepted', state => { (state.history[0] as unknown as Record<string, unknown>).result = 'accepted'; return state; }],
    ['history unknown definition', state => { state.history[0]!.definitionId = 'crafting.unknown'; return state; }],
    ['history other owner', state => { state.history[0]!.definitionId = 'other.wood'; return state; }],
    ['history negative batches', state => { state.history[0]!.completedBatches = -1; return state; }],
    ['history too many batches', state => { state.history[0]!.completedBatches = 17; return state; }],
    ['history fractional tick', state => { state.history[0]!.tick = 0.1; return state; }],
    ['history invalid reason', state => { (state.history[0] as unknown as Record<string, unknown>).reason = 4; return state; }],
    ['history extra key', state => { Object.assign(state.history[0]!, { extra: 1 }); return state; }],
    ['history oversized', state => ({ ...state, lastFactId: 129, history: Array.from({ length: 129 }, (_, i) => ({ ...state.history[0]!, factId: i + 1 })) })],
    ['placements oversized', state => ({ ...state, lastFactId: 513, placements: Array.from({ length: 513 }, (_, i) => ({ factId: i + 1, definitionId: 'crafting.table', result: 'completed', tick: 0 })) })],
    ['placements duplicate ids', state => ({ ...state, placements: [{ factId: 1, definitionId: 'crafting.table', result: 'completed', tick: 0 }, { factId: 1, definitionId: 'crafting.table', result: 'completed', tick: 0 }] })],
    ['placements item id', state => ({ ...state, placements: [{ factId: 1, definitionId: 'crafting.wood', result: 'completed', tick: 0 }] })],
    ['placements skipped', state => ({ ...state, placements: [{ factId: 1, definitionId: 'crafting.table', result: 'skipped', tick: 0 }] })],
    ['sparse history', state => ({ ...state, history: new Array(1) })],
    ['array property', state => { Object.assign(state.history, { extra: 1 }); return state; }],
    ['prototype pollution', state => Object.assign(Object.create({ polluted: true }), state)],
    ['symbol key', state => Object.assign(state, { [Symbol('extra')]: 1 })],
    ['getter', state => Object.defineProperty(state, 'lastFactId', { enumerable: true, get() { throw new Error('getter'); } })]
  ];
  it.each(malformed)('rejects %s without repairing malformed state', (_label, mutate) => {
    const state = mutate(valid());
    expect(validateCraftingState(state)).toBe(false);
    expect(() => applyFact(state, fact({ factId: 5 }))).not.toThrow();
    expect(applyFact(state, fact({ factId: 5 }))).toBe(state);
  });
  it('ignores malformed or throwing facts and never calls accessors', () => {
    const state = freeze(initialCraftingState());
    const getter = vi.fn(() => { throw new Error('getter must not run'); });
    const accessor = Object.defineProperty(fact(), 'factId', { enumerable: true, get: getter });
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    for (const input of [null, undefined, [], 1, 'fact', {}, accessor, revoked.proxy,
      { ...fact(), extra: true }, fact({ factId: 0 }), fact({ definitionId: 'crafting.unknown' }),
      fact({ completedBatches: Infinity }), fact({ tick: NaN }), fact({ actorId: -1 })]) {
      expect(() => applyFact(state, input)).not.toThrow();
      expect(applyFact(state, input)).toBe(state);
    }
    expect(getter).not.toHaveBeenCalled();
  });
  it('participant is synchronous, ignores old deliveries, and never throws even if the writer fails', () => {
    const participant = createCraftingModule().worldWorkParticipant!;
    let state: JsonValue = freeze(initialCraftingState());
    const replaceState = vi.fn((next: JsonValue) => { state = freeze(next); });
    const tx: ModuleStateTransaction = { get state() { return state; }, replaceState };
    expect(participant.onCommitted(fact({ factId: 10 }), tx)).toBeUndefined();
    expect(replaceState).toHaveBeenCalledTimes(1);
    participant.onCommitted(fact({ factId: 8 }), tx);
    participant.onCommitted(fact({ factId: 11, owner: 'other' }), tx);
    participant.onCommitted(null as never, tx);
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(() => participant.onCommitted(fact({ factId: 12 }), {
      state, replaceState() { throw new Error('writer'); }
    })).not.toThrow();
    expect(() => participant.onCommitted(fact(), null as never)).not.toThrow();
    expect(validateCraftingState(state)).toBe(true);
  });
});
