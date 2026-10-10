import { describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { FOUNDATION_PROTOCOL, validateModuleDescriptors } from '../../../descriptor';
import type { ActorNeedFacts, EdibleConsumedFact, EdibleTransaction, EffectIntent, FireContactFact, NeedEventFact, NeedTransaction } from '../../../edibleSdk';
import type { JsonValue } from '../../../worldSdk';
import { descriptor } from '../descriptor';
import { createForagingModule } from '../index';
import { createForagingModuleFromPack } from '../module';
import { getForagingPackIdentity, loadForagingPack, toWorldDefinitionPack } from '../definitions';
import { initialForagingState, validateForagingState, validateHunger, applyFact } from '../state';
import { shouldReveal } from '../knowledge';
import type { ForagingState } from '../types';
import { projectForagingView } from '../view';
import zhCN from '../locales/zh_CN.json';

const pack = loadForagingPack();
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function consumed(kind = 'venom', patch: Partial<EdibleConsumedFact> = {}): EdibleConsumedFact {
  const effect = pack.edibleItems.find(d => d.id === `foraging.${kind}`)!.effect as EffectIntent;
  return { owner: 'foraging', factId: 1, operation: 'eat', eaterId: 1, feederId: null, definitionId: `foraging.${kind}`,
    nativeFood: null, resolvedIntent: effect, outcome: { intent: effect.kind, applied: true, newlyStarted: true, immune: false,
      notApplicable: false, hpGained: 0, satietyGained: 200, satietyLost: 0 }, hpBefore: 10, maxHp: 20, visibleToPlayer: true, tick: 100, ...patch };
}
function fire(patch: Partial<FireContactFact> = {}): FireContactFact {
  return { owner: 'foraging', factId: 1, itemId: 2, definitionId: 'foraging.venom', quantity: 1,
    cause: 'roast-command', location: 'inventory', at: { x: 1, y: 1 }, result: 'transformed',
    toDefinitionId: 'foraging.venom-roasted', explosion: null, visibleToPlayer: true, tick: 100, ...patch };
}
function need(patch: Partial<NeedEventFact> = {}): NeedEventFact {
  return { owner: 'foraging', factId: 1, actorId: 3, needId: pack.companion.needId, kind: 'attached',
    band: 'fed', previousBand: null, value: 1800, crossedAtTick: 0, tick: 0, deferred: false, visibleToPlayer: true, reason: null, ...patch };
}
function transactions() {
  let state: JsonValue = freeze(initialForagingState());
  const tx = { get state() { return state; }, replaceState: vi.fn((next: JsonValue) => { state = freeze(next); }),
    markKnowledge: vi.fn(() => true), message: vi.fn(), setOwnComponent: vi.fn(), removeOwnComponent: vi.fn(), depart: vi.fn() } satisfies EdibleTransaction & NeedTransaction;
  return tx;
}

describe('foraging module and state contract', () => {
  it('is a discovered foundation-only module with exactly the specified capabilities', () => {
    expect(validateModuleDescriptors([descriptor])).toHaveLength(1);
    expect(descriptor).toMatchObject({ id: 'foraging', version: '1.0.0', foundation: FOUNDATION_PROTOCOL, worldSdk: 1, defaultEnabled: false,
      rules: getForagingPackIdentity(pack) });
    const module = createForagingModule();
    expect(Object.keys(module).sort()).toEqual(['id', 'version', 'rules', 'worldDefinitions', 'worldWorkCommands', 'edibleCommands', 'edibleParticipant',
      'actorNeedParticipant', 'hooks', 'statSources', 'componentValidators', 'initialState', 'validateState', 'projectView'].sort());
    expect(Object.keys(module.statSources!)).toEqual(['collect']);
    expect(Object.keys(module.worldWorkCommands!)).toEqual(['harvest']);
    expect(Object.keys(module.edibleCommands!)).toEqual(['feed', 'roast']);
    expect(module.initialState()).toEqual(initialForagingState());
    expect(module.validateState(module.initialState())).toBe(true);
  });
  it('deep-copies world definitions in package order and does not expose private policy fields', () => {
    const world = toWorldDefinitionPack(pack);
    expect(world).toEqual({ schema: 1, worldSdk: 1, items: [], resourceNodes: pack.resourceNodes, stations: [], recipes: [], startupItems: null,
      edibleItems: pack.edibleItems, knowledgeGroups: pack.knowledgeGroups, placementGroups: pack.placementGroups, actorNeeds: pack.actorNeeds });
    expect(world.edibleItems).not.toBe(pack.edibleItems);
    expect(world.edibleItems![0]).not.toBe(pack.edibleItems[0]);
    const copy = loadForagingPack(); const module = createForagingModuleFromPack(copy);
    copy.edibleItems[0]!.satiety = 900;
    expect(module.worldDefinitions!.edibleItems![0]!.satiety).toBe(200);
    expect(() => createForagingModuleFromPack({ ...pack, schema: 2 } as never)).toThrow();
  });
  it('fresh state is empty, independent, and contains only bounded numeric counters', () => {
    expect(initialForagingState()).toEqual({ schema: 1, lastFactId: 0, totals: { eaten: 0, fed: 0, revealed: 0, roasted: 0, charred: 0, burned: 0, exploded: 0, departed: 0 }, history: [] });
    const a = initialForagingState(); a.totals.eaten = 4;
    expect(initialForagingState().totals.eaten).toBe(0);
  });
  it('handles frozen input, gaps, duplicates and foreign owners idempotently', () => {
    const initial = freeze(initialForagingState());
    const state = applyFact(initial, freeze(consumed('venom', { factId: 8 })), pack, true);
    expect(state.lastFactId).toBe(8); expect(state.totals.eaten).toBe(1); expect(state.totals.revealed).toBe(1);
    expect(initial.lastFactId).toBe(0);
    expect(applyFact(state, consumed('venom', { factId: 8 }))).toBe(state);
    expect(applyFact(state, consumed('venom', { factId: 4 }))).toBe(state);
    expect(applyFact(state, consumed('venom', { factId: 9, owner: 'other' }))).toBe(state);
    expect(applyFact(state, consumed('venom', { factId: 20 })).totals.eaten).toBe(2);
  });
  it('accounts for each kind of fact without retaining identity, names or need values', () => {
    let s = initialForagingState();
    const rows = [consumed(), consumed('venom', { operation: 'feed', feederId: 1, eaterId: 3 }),
      fire(), fire({ definitionId: 'foraging.venom-roasted', toDefinitionId: 'foraging.char' }),
      fire({ definitionId: 'foraging.char', result: 'burned-up', toDefinitionId: null }),
      fire({ result: 'destroyed', toDefinitionId: null }), fire({ definitionId: 'foraging.blast', result: 'exploded', toDefinitionId: null, explosion: 'explosion-fire' }),
      need({ kind: 'detached', reason: 'departed' })];
    rows.forEach((row, i) => { s = applyFact(s, { ...row, factId: i + 1 }, pack, i === 0); });
    expect(s.totals).toEqual({ eaten: 1, fed: 1, revealed: 1, roasted: 1, charred: 1, burned: 2, exploded: 1, departed: 1 });
    expect(s.history).toHaveLength(8); expect(JSON.stringify(s)).not.toMatch(/foraging\.|definitionId|venom|band|1800/);
    expect(validateForagingState(s)).toBe(true);
  });
  it('bounds receipts at 64, honors stricter history limits, and saturates all counters', () => {
    let s = initialForagingState();
    for (let i = 1; i <= 70; i++) s = applyFact(s, consumed('venom', { factId: i }), pack, true);
    expect(s.history).toHaveLength(64); expect(s.history[0]!.factId).toBe(7);
    const tight = structuredClone(pack); tight.limits.history = 2;
    s = initialForagingState(); for (let i = 1; i <= 3; i++) s = applyFact(s, consumed('venom', { factId: i }), tight);
    expect(s.history.map(f => f.factId)).toEqual([2, 3]);
    s = initialForagingState(); for (const k of Object.keys(s.totals) as (keyof ForagingState['totals'])[]) s.totals[k] = Number.MAX_SAFE_INTEGER;
    let id = 1;
    for (const f of [consumed(), consumed('venom', { operation: 'feed', feederId: 1 }), fire(), fire({ definitionId: 'foraging.venom-roasted' }),
      fire({ result: 'burned-up' }), fire({ result: 'exploded' }), need({ kind: 'detached', reason: 'departed' })]) s = applyFact(s, { ...f, factId: id++ }, pack, true);
    expect(Object.values(s.totals)).toEqual(Array(8).fill(Number.MAX_SAFE_INTEGER));
  });
  const corruptions: [string, (s: ForagingState) => unknown][] = [
    ['extra root', s => ({ ...s, extra: true })], ['missing root', s => { delete (s as Partial<ForagingState>).schema; return s; }],
    ['schema', s => ({ ...s, schema: 2 })], ['negative id', s => ({ ...s, lastFactId: -1 })], ['fraction id', s => ({ ...s, lastFactId: 1.2 })],
    ['unsafe id', s => ({ ...s, lastFactId: Number.MAX_SAFE_INTEGER + 1 })], ['id behind history', s => ({ ...s, lastFactId: 0 })],
    ['unknown total', s => ({ ...s, totals: { ...s.totals, foo: 1 } })], ['negative total', s => ({ ...s, totals: { ...s.totals, fed: -1 } })],
    ['nonfinite total', s => ({ ...s, totals: { ...s.totals, fed: Infinity } })], ['undefined total', s => ({ ...s, totals: { ...s.totals, fed: undefined } })],
    ['duplicate history', s => ({ ...s, history: [s.history[0], s.history[0]] })], ['unknown result', s => ({ ...s, history: [{ ...s.history[0], result: 'secret' }] })],
    ['wrong kind result', s => ({ ...s, history: [{ ...s.history[0], kind: 'fire' }] })], ['kind', s => ({ ...s, history: [{ ...s.history[0], kind: 'other' }] })],
    ['extra history', s => ({ ...s, history: [{ ...s.history[0], definitionId: 'secret' }] })], ['tick', s => ({ ...s, history: [{ ...s.history[0], tick: -1 }] })],
    ['too long', s => ({ ...s, lastFactId: 65, history: Array.from({ length: 65 }, (_, i) => ({ ...s.history[0]!, factId: i + 1 })) })],
    ['sparse', s => ({ ...s, history: Array(1) })], ['array property', s => { Object.assign(s.history, { extra: true }); return s; }],
    ['prototype', s => Object.assign(Object.create({ polluted: 1 }), s)], ['symbol', s => ({ ...s, [Symbol('extra')]: 1 })],
    ['getter', s => Object.defineProperty(s, 'lastFactId', { enumerable: true, get() { throw Error('getter'); } })]
  ];
  it.each(corruptions)('strictly rejects %s without repairing', (_label, corrupt) => {
    const invalid = corrupt(applyFact(initialForagingState(), consumed()));
    expect(validateForagingState(invalid)).toBe(false);
    expect(applyFact(invalid, consumed('venom', { factId: 10 }))).toBe(invalid);
  });
});

describe('foraging pure reveal matrix', () => {
  for (const kind of pack.kinds) it(`${kind.id}: eat/feed, raw/roasted, injury/start, immunity/applicability and stripped policy`, () => {
    for (const operation of ['eat', 'feed'] as const) for (const form of ['raw', 'roasted'] as const)
      for (const injured of [false, true]) for (const newlyStarted of [false, true]) for (const immune of [false, true])
        for (const notApplicable of [false, true]) for (const visibleToPlayer of [false, true]) {
          const f = consumed(kind.id, { operation, visibleToPlayer, hpBefore: injured ? 10 : 20 });
          f.outcome = { ...f.outcome, newlyStarted, immune, notApplicable, applied: false };
          const expected = !immune && !notApplicable && (operation === 'eat' || kind.companionReveal && visibleToPlayer) &&
            (kind.reveal === 'always' || kind.reveal === 'if-injured' && injured || kind.reveal === 'if-not-already' && newlyStarted);
          expect(shouldReveal(kind, form, freeze(f))).toBe(expected);
          expect(shouldReveal(kind, form, { ...f, resolvedIntent: { kind: 'none' }, outcome: { ...f.outcome, intent: 'none' } })).toBe(false);
        }
  });
});

describe('foraging participants and hunger sources', () => {
  it('reveals roasted and raw together but learning raw leaves roasted unknown, and duplicate facts are silent', () => {
    i18next.init({ lng: 'zh_CN', resources: { zh_CN: { translation: zhCN } }, initImmediate: false });
    const p = createForagingModule().edibleParticipant!;
    const tx = transactions(); p.onConsumed!(consumed('venom', { definitionId: 'foraging.venom-roasted' }), tx);
    expect(tx.markKnowledge.mock.calls).toEqual([['foraging.venom-roasted', 'known'], ['foraging.venom', 'known']]);
    expect(tx.message).toHaveBeenCalledWith('ext.foraging.message.revealed_roasted', { name: '蚀骨菌' });
    p.onConsumed!(consumed(), tx); expect(tx.replaceState).toHaveBeenCalledTimes(1);
    const rawTx = transactions(); p.onConsumed!(consumed(), rawTx);
    expect(rawTx.markKnowledge.mock.calls).toEqual([['foraging.venom', 'known']]);
    rawTx.markKnowledge.mockReturnValue(false); p.onConsumed!(consumed('venom', { factId: 2 }), rawTx);
    expect((rawTx.state as ForagingState).totals.revealed).toBe(1);
  });
  it('marks inconclusive food tasted, leaves native food and char knowledge alone, and counts consumption', () => {
    const p = createForagingModule().edibleParticipant!;
    const tx = transactions(); p.onConsumed!(consumed('mend', { hpBefore: 20 }), tx);
    expect(tx.markKnowledge).toHaveBeenCalledWith('foraging.mend', 'tasted');
    const native = transactions(); const f = consumed('blast', { operation: 'feed', definitionId: null, nativeFood: 'mango',
      resolvedIntent: { kind: 'none' }, outcome: { ...consumed('blast').outcome, intent: 'none' } });
    p.onConsumed!(f, native); expect(native.markKnowledge).not.toHaveBeenCalled(); expect(native.message).toHaveBeenCalledWith('ext.foraging.message.fed_food');
    expect((native.state as ForagingState).totals.fed).toBe(1);
    const char = transactions(); p.onConsumed!({ ...f, definitionId: 'foraging.char', nativeFood: null }, char);
    expect(char.markKnowledge).not.toHaveBeenCalled();
  });
  it('only reveals visible or inventory blast explosions and never repeats foundation fire messages', () => {
    const p = createForagingModule().edibleParticipant!;
    for (const location of ['inventory', 'floor'] as const) for (const visibleToPlayer of [false, true]) {
      const tx = transactions(); p.onFireContact!(fire({ definitionId: 'foraging.blast', result: 'exploded', location, visibleToPlayer }), tx);
      expect(tx.markKnowledge).toHaveBeenCalledTimes(location === 'inventory' || visibleToPlayer ? 1 : 0);
      expect(tx.message).not.toHaveBeenCalled(); expect((tx.state as ForagingState).totals.exploded).toBe(1);
    }
  });
  const facts: ActorNeedFacts = { actorId: 2, monsterId: 'goblin', allied: true, inanimate: false, timedSummon: false, groupRole: 'single' };
  it('qualifies all permitted allies and rejects every exclusion, with defensive optional querying', () => {
    const p = createForagingModule().actorNeedParticipant!;
    const queryOptional = vi.fn(() => ({ status: 'unavailable', reason: 'absent' } as const));
    expect(p.qualifies(pack.companion.needId, facts, { queryOptional })).toBe(true);
    expect(queryOptional).toHaveBeenCalledWith('settlement.resident-status.v1', { actorId: 2 });
    expect(p.qualifies(pack.companion.needId, { ...facts, groupRole: 'core', monsterId: null }, { queryOptional })).toBe(true);
    for (const patch of [{ allied: false }, { inanimate: true }, { timedSummon: true }, { groupRole: 'member' },
      ...pack.companion.nonEaters.map(monsterId => ({ monsterId }))]) expect(p.qualifies(pack.companion.needId, { ...facts, ...patch } as ActorNeedFacts, { queryOptional })).toBe(false);
    expect(p.qualifies('other.need', facts, { queryOptional })).toBe(false);
    for (const result of [null, {}, { status: 'available', value: { resident: false } }, { status: 'available', value: { resident: true, extra: 1 } },
      { status: 'available', value: true }, { status: 'available', value: { resident: 1 } }, Promise.resolve({ resident: true })]) {
      expect(p.qualifies(pack.companion.needId, facts, { queryOptional: () => result as never })).toBe(true);
    }
    expect(p.qualifies(pack.companion.needId, facts, { queryOptional: () => ({ status: 'available', value: { resident: true } }) })).toBe(false);
    expect(p.qualifies(pack.companion.needId, facts, { queryOptional() { throw Error('missing'); } })).toBe(true);
    expect(p.qualifies(pack.companion.needId, null as never, null as never)).toBe(false);
  });
  it('processes each band, suppresses deferred/hidden messages, departs on deadline, and requests idempotent cleanup', () => {
    const p = createForagingModule().actorNeedParticipant!, tx = transactions();
    p.onNeedEvent!(need(), tx); expect(tx.setOwnComponent).toHaveBeenCalledWith(3, 'hunger', { band: 'fed' }); expect(tx.message).not.toHaveBeenCalled();
    for (const [i, band] of (['hungry', 'weak', 'starving', 'fed'] as const).entries()) p.onNeedEvent!(need({ factId: i + 2, kind: 'band', band }), tx);
    expect(tx.message.mock.calls.map(c => c[0])).toEqual(['hungry', 'weak', 'starving', 'fed'].map(b => `ext.foraging.message.band.${b}`));
    p.onNeedEvent!(need({ factId: 6, kind: 'band', band: 'weak', deferred: true }), tx);
    p.onNeedEvent!(need({ factId: 7, kind: 'band', band: 'weak', visibleToPlayer: false }), tx); expect(tx.message).toHaveBeenCalledTimes(4);
    p.onNeedEvent!(need({ factId: 8, kind: 'deadline', band: 'starving' }), tx); expect(tx.depart).toHaveBeenCalledExactlyOnceWith(3);
    p.onNeedEvent!(need({ factId: 9, kind: 'detached', reason: 'departed' }), tx);
    expect((tx.state as ForagingState).totals.departed).toBe(1);
  });
  it('uses strict hunger components and only the declared temporary increased penalties', () => {
    const m = createForagingModule();
    for (const band of ['fed', 'hungry', 'weak', 'starving']) {
      expect(validateHunger({ band })).toBe(true);
      const rows = m.statSources!.collect({ id: 2 } as never, { getComponent: () => ({ band }) } as never);
      const penalty = pack.companion.penalties.find(p => p.band === band);
      expect(rows).toEqual(penalty ? [
        { stat: 'native.accuracy', category: 'increased', value: penalty.accuracyIncreasedBp, layer: 'temporary', sourceKind: 'foraging.hunger', sourceId: `foraging.hunger.${band}` },
        { stat: 'native.physical-damage-dealt', category: 'increased', value: penalty.damageIncreasedBp, layer: 'temporary', sourceKind: 'foraging.hunger', sourceId: `foraging.hunger.${band}` }
      ] : []);
    }
    for (const value of [undefined, null, {}, { band: 'bad' }, { band: 'weak', extra: 1 }, ['weak']]) {
      expect(validateHunger(value)).toBe(false);
      expect(m.statSources!.collect({ id: 2 } as never, { getComponent: () => value } as never)).toEqual([]);
    }
  });
  it('does not throw, execute accessors or write when fact/state inputs are malformed', () => {
    const m = createForagingModule(), tx = transactions(), getter = vi.fn(() => { throw Error('getter'); });
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    const bad = [null, undefined, [], 3, {}, revoked.proxy, Object.defineProperty(consumed(), 'owner', { get: getter, enumerable: true }),
      consumed('venom', { owner: 'other' }), consumed('venom', { definitionId: 'other.edible' }), consumed('venom', { factId: 0 })];
    for (const f of bad) {
      expect(() => m.edibleParticipant!.onConsumed!(f as never, tx)).not.toThrow();
      expect(() => m.edibleParticipant!.onFireContact!(f as never, tx)).not.toThrow();
      expect(() => m.actorNeedParticipant!.onNeedEvent!(f as never, tx)).not.toThrow();
    }
    expect(getter).not.toHaveBeenCalled(); expect(tx.replaceState).not.toHaveBeenCalled(); expect(tx.markKnowledge).not.toHaveBeenCalled();
    for (const target of [null, { get state() { throw Error('state'); } }])
      expect(() => m.edibleParticipant!.onConsumed!(consumed(), target as never)).not.toThrow();
  });
  it('validates nested facts and precomputes valid state before any transaction side effect', () => {
    const m = createForagingModule();
    const getter = vi.fn(() => { throw Error('nested accessor'); });
    const tx = transactions();
    for (const fact of [
      { ...consumed(), outcome: { ...consumed().outcome, unexpected: true } },
      { ...consumed(), outcome: Object.defineProperty({ ...consumed().outcome }, 'immune', { enumerable: true, get: getter }) },
      { ...consumed(), resolvedIntent: Object.defineProperty({ ...consumed().resolvedIntent }, 'kind', { enumerable: true, get: getter }) }
    ]) m.edibleParticipant!.onConsumed!(fact as never, tx);
    const malformedState = { ...initialForagingState(), totals: { ...initialForagingState().totals, eaten: -1 } };
    const invalid = { ...tx, state: malformedState };
    m.edibleParticipant!.onConsumed!(consumed(), invalid);
    m.edibleParticipant!.onFireContact!(fire(), invalid);
    m.actorNeedParticipant!.onNeedEvent!(need(), invalid);
    expect(getter).not.toHaveBeenCalled();
    for (const writer of [tx.replaceState, tx.markKnowledge, tx.message, tx.setOwnComponent, tx.removeOwnComponent, tx.depart]) expect(writer).not.toHaveBeenCalled();
  });
  it('announces only owned departures with the actor name and does not change state', () => {
    const hook = createForagingModule().hooks!.actorDeparted!, message = vi.fn();
    for (const deferred of [false, true]) hook({ owner: 'foraging', reason: 'hunger', actor: { name: '哥布林' }, deferred } as never, { message } as never);
    expect(message.mock.calls).toEqual([['哥布林饿得受不了，离开了队伍。'], ['哥布林在你离开时离队了。']]);
    hook({ owner: 'other' } as never, { message } as never); expect(message).toHaveBeenCalledTimes(2);
  });
});

describe('foraging projection privacy', () => {
  it('fails closed without either SDK and on failed reads', () => {
    for (const c of [{}, { worldWork: {} }, { edible: {} }, { edible: { readEdibleContext: () => ({ ok: false }) }, worldWork: { readWorkContext: () => ({ ok: false }) } }])
      expect(projectForagingView(c as never)).toEqual({ v: 1, available: false });
  });
  it('keeps only own edible or native foods and publishes no hidden IDs, policy or exact need values', () => {
    const inventory = [
      { itemId: 1, definitionId: 'foraging.blast', nativeFood: null, quantity: 2, displayName: '低语菌', knowledge: 'unknown', satiety: 150 },
      { itemId: 2, definitionId: 'foraging.char', nativeFood: null, quantity: 1, displayName: '焦炭', knowledge: 'known', satiety: 20 },
      { itemId: 3, definitionId: null, nativeFood: 'mango', quantity: 1, displayName: '芒果', knowledge: null, satiety: 1550 },
      { itemId: 4, definitionId: 'foreign.food', nativeFood: null, quantity: 1, displayName: '外物', knowledge: 'known', satiety: 99 },
      { itemId: 5, definitionId: 'foraging.missing', nativeFood: null, quantity: 1, displayName: '外物', knowledge: 'unknown', satiety: null }
    ];
    const work = { available: true, at: { x: 1, y: 1 }, activeTicket: null };
    const context = { nearbyInteractables: [], worldWork: { readWorkContext: () => ({ ok: true, value: work }) },
      edible: { readEdibleContext: () => ({ ok: true, value: { inventoryStamp: 'stamp', inventory,
        feedTargets: [{ actorId: 6, targetRevision: 2, needId: pack.companion.needId, band: 'weak', value: 100, departing: false }],
        heatSources: [{ interactableId: 7, kind: 'hearth-station', at: { x: 1, y: 1 } }] } }) } };
    const view = projectForagingView(context as never); expect(view.available).toBe(true);
    if (!view.available) throw Error('view');
    expect(view.foods.map(f => f.itemId)).toEqual([1, 2, 3]); expect(view.foods[0]!.satiety).toBeNull();
    expect(view.foods.map(f => f.roastable)).toEqual([true, true, false]);
    expect(JSON.stringify(view)).not.toMatch(/blast|definitionId|needId|foraging\.|roast-policy|"value":/);
    expect(projectForagingView(freeze(context) as never)).toEqual(view);
  });
  it('uses node reason priority without names, and exposes only own harvest tickets', () => {
    const node = { owner: 'foraging', definitionId: 'foraging.mend-patch', interactableId: 4, remaining: 3, capacity: 3, reservedUnits: 0, revision: 2, at: { x: 2, y: 1 } };
    const work = { available: true, at: { x: 1, y: 1 }, activeTicket: null as unknown };
    const context = { nearbyInteractables: [{ owner: 'foraging', id: 4 }, { owner: 'other', id: 5 }],
      worldWork: { readWorkContext: (q: { kind: string }) => ({ ok: true, value: q.kind === 'node' ? { ...work, node } : work }) },
      edible: { readEdibleContext: () => ({ ok: true, value: { inventoryStamp: 'stamp', inventory: [], feedTargets: [], heatSources: [] } }) } };
    const read = () => { const v = projectForagingView(context as never); if (!v.available) throw Error('view'); return v; };
    expect(read().nodes[0]).toEqual({ interactableId: 4, remaining: 3, capacity: 3, available: 3, nodeRevision: 2, canHarvest: true, reason: null });
    node.reservedUnits = 3; expect(read().nodes[0]!.reason).toBe('C5_RESERVED');
    node.remaining = 0; expect(read().nodes[0]!.reason).toBe('C5_RESOURCE_EMPTY');
    node.at.x = 4; expect(read().nodes[0]!.reason).toBe('C5_DISTANCE');
    work.available = false; expect(read().nodes[0]!.reason).toBe('C5_GATE');
    work.activeTicket = { owner: 'foraging', kind: 'harvest', definitionId: node.definitionId, ticketId: 9, remainingTicks: 40 };
    expect(read().nodes[0]!.reason).toBe('C5_BUSY'); expect(read().activeTicket).toEqual({ ticketId: 9, remainingTicks: 40 });
    work.activeTicket = { owner: 'other', kind: 'harvest', definitionId: node.definitionId, ticketId: 9, remainingTicks: 40 }; expect(read().activeTicket).toBeNull();
  });
});

// These tests distinguish invalid input fallback from failures of trusted transaction writers.
describe('foraging participant submission failures', () => {
  const cases = [
    ['consumed', () => consumed('venom', { definitionId: 'foraging.venom-roasted' }), ['markKnowledge', 'markKnowledge', 'message', 'replaceState']],
    ['fire', () => fire({ definitionId: 'foraging.blast', result: 'exploded', toDefinitionId: null, explosion: 'explosion-fire' }), ['markKnowledge', 'replaceState']],
    ['band', () => need({ kind: 'band', band: 'weak', previousBand: 'hungry' }), ['setOwnComponent', 'message', 'replaceState']],
    ['deadline', () => need({ kind: 'deadline', band: 'starving' }), ['message', 'depart', 'replaceState']],
    ['detached', () => need({ kind: 'detached', reason: 'ineligible' }), ['removeOwnComponent', 'replaceState']]
  ] as const;
  function invoke(label: string, fact: unknown, tx: EdibleTransaction & NeedTransaction) {
    const m = createForagingModule();
    if (label === 'consumed') m.edibleParticipant!.onConsumed!(fact as EdibleConsumedFact, tx);
    else if (label === 'fire') m.edibleParticipant!.onFireContact!(fact as FireContactFact, tx);
    else m.actorNeedParticipant!.onNeedEvent!(fact as NeedEventFact, tx);
  }
  for (const [label, fact, writers] of cases) {
    for (const phase of ['before', 'after'] as const) for (let index = 0; index < writers.length; index++) {
      it(`${label}: ${phase} writer ${index + 1} (${writers[index]}) propagates the identical error and stops`, () => {
        const tx = transactions(), error = Error('injected writer failure'), calls: string[] = [], completed: string[] = [];
        const wrapped = { ...tx };
        for (const key of ['markKnowledge', 'message', 'replaceState', 'setOwnComponent', 'removeOwnComponent', 'depart'] as const) {
          Object.assign(wrapped, { [key]: (...args: unknown[]) => {
            calls.push(key);
            if (calls.length === index + 1 && phase === 'before') throw error;
            const result = (tx[key] as (...args: unknown[]) => unknown)(...args); completed.push(key);
            if (calls.length === index + 1 && phase === 'after') throw error;
            return result;
          } });
        }
        expect(() => invoke(label, fact(), wrapped)).toThrow(error);
        expect(calls).toEqual(writers.slice(0, index + 1));
        expect(completed).toEqual(writers.slice(0, index + (phase === 'after' ? 1 : 0)));
      });
    }
    it(`${label}: malformed, foreign, duplicate and inaccessible state inputs invoke no writer`, () => {
      const tx = transactions();
      const accessor = vi.fn(() => { throw Error('accessor'); });
      const f = fact();
      for (const invalid of [{ ...f, owner: 'foreign' }, { ...f, factId: 0 },
        Object.defineProperty({ ...f }, 'tick', { enumerable: true, get: accessor })]) invoke(label, invalid, tx);
      for (const invalidState of [null, { ...initialForagingState(), lastFactId: 1 }, { ...initialForagingState(), unexpected: true }])
        invoke(label, f, { ...tx, state: invalidState } as never);
      invoke(label, f, { ...tx, get state(): never { throw Error('state'); } });
      expect(accessor).not.toHaveBeenCalled();
      for (const key of ['markKnowledge', 'message', 'replaceState', 'setOwnComponent', 'removeOwnComponent', 'depart'] as const)
        expect(tx[key]).not.toHaveBeenCalled();
    });
  }
});
