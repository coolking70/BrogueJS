import { describe, it, expect } from 'vitest';
import { createForageHarness } from '../ext/testing/forageHarness';
import { descriptor } from '../ext/testing/fixtures/forageFixture';
import { edibleDefinition, knowledgeState } from '../engine/Core/KindKnowledge';
import { rng } from '../engine/Random';
import { getInstalledModuleDescriptors } from '../ext/catalog';
import { timeSystem } from '../engine/Systems/Time';
const make = () => createForageHarness({ seed: 51020001, modules: [] });
describe('5A4 edible real commands', () => {
  it('eat/save/load/replay/seek/continuation and pure projections', () => {
    const h = make();
    h.fixture({ kind: 'grant', definitionId: 'fgfixture.sample0', quantity: 2 });
    const g = h.game(),
      item = g.player.inventory.items.find(
        (i) => i.worldItem?.definitionId === 'fgfixture.sample0'
      )!;
    const beforeRng = rng.getState(),
      before = h.save();
    for (let i = 0; i < 20; i++) h.readEdibleContext();
    expect(h.save().replace(/"savedAt":\d+/, '')).toBe(before.replace(/"savedAt":\d+/, ''));
    expect(rng.getState()).toEqual(beforeRng);
    h.command('item:execute', 'eat|' + item.inventoryLetter);
    expect(g.player.inventory.items.find((i) => i.id === item.id)?.quantity).toBe(1);
    expect(knowledgeState(g, 'fgfixture.sample0')).toBe('tasted');
    expect(edibleDefinition(g, item)).toBeDefined();
    const save = h.save(),
      digest = h.digest();
    h.load(save);
    expect(h.digest()).toBe(digest);
    const rec = h.exportRecording();
    expect(h.replay(rec)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(digest);
    h.seek(rec, 2);
    expect(h.digest()).toBe(digest);
    h.load(save);
    h.command('escape');
    const continued = h.exportRecording();
    expect(h.replay(continued).ok).toBe(true);
    h.dispose();
  });
  it('No is recorded without mechanical costs, known and unknown thresholds use different policy', () => {
    const h = make();
    h.fixture({ kind: 'grant', definitionId: 'fgfixture.raw', quantity: 2 });
    const g = h.game(),
      item = g.player.inventory.items.find((i) => i.worldItem)!;
    g.player.nutrition = 2150;
    g.onConfirmRequest = () => false;
    const tick = timeSystem.currentTick,
      r = rng.getState(),
      n = g.recordedInputEvents.length,
      q = item.quantity;
    h.command('item:execute', 'eat|' + item.inventoryLetter);
    expect(g.recordedInputEvents.length).toBe(n + 1);
    expect(item.quantity).toBe(q);
    expect(timeSystem.currentTick).toBe(tick);
    expect(rng.getState()).toEqual(r);
    h.dispose();
  });
  it.each(['none', 'throw', 'equip', 'read', 'use'])(
    'material dispatch maintains operation %s eligibility',
    (op) => {
      const h = make();
      h.fixture({ kind: 'grant', definitionId: 'fgfixture.raw' });
      const g = h.game(),
        item = g.player.inventory.items.find((i) => i.worldItem)!;
      const tick = timeSystem.currentTick;
      if (op === 'throw') {
        h.command('item:execute', 'throw|' + item.inventoryLetter);
        expect(g.isThrowing).toBe(true);
      } else if (op !== 'none') {
        h.command('item:execute', op + '|' + item.inventoryLetter);
        expect(timeSystem.currentTick).toBe(tick);
        expect(g.player.inventory.items).toContain(item);
      }
      h.dispose();
    }
  );
  it('participant failure rolls back native fields, ownership, knowledge, facts, messages, time and RNG', () => {
    const bad = {
      ...descriptor,
      create: () => {
        const m = descriptor.create();
        m.edibleParticipant!.onConsumed = (_f, tx) => {
          tx.replaceState({ history: [1] });
          tx.markKnowledge('fgfixture.raw', 'known');
          throw Error('fail');
        };
        return m;
      }
    };
    const h = createForageHarness({ seed: 51020001, modules: [] }, [bad]);
    h.fixture({ kind: 'grant', definitionId: 'fgfixture.raw', quantity: 2 });
    const g = h.game(),
      item = g.player.inventory.items.find((i) => i.worldItem)!;
    const snapshot = g.toSnapshot(),
      r = rng.getState(),
      tick = timeSystem.currentTick;
    h.command('item:execute', 'eat|' + item.inventoryLetter);
    expect(item.quantity).toBe(2);
    expect(g.player.nutrition).toBe(snapshot.player.nutrition);
    expect(g.extensionRuntime!.snapshot()).toEqual(snapshot.extensions);
    expect(rng.getState()).toEqual(r);
    expect(timeSystem.currentTick).toBe(tick);
    expect(g.player.inventory.items).toContain(item);
    h.dispose();
  });
  it('bad saved cooldown is refused before current run is retired', () => {
    const h = make();
    h.fixture({ kind: 'grant', definitionId: 'fgfixture.raw' });
    const g = h.game(),
      save = JSON.parse(h.save());
    const item = save.player.inventory.find((i: any) => i.worldItem);
    item.fireContactCooldownUntilTurn = 10;
    save.player.inventory.find((i: any) => i.id === item.id).fireContactCooldownUntilTurn = 10;
    const runtime = g.extensionRuntime;
    expect(g.loadSnapshot(save)).toBe(false);
    expect(g.extensionRuntime).toBe(runtime);
    h.dispose();
  });
  it('registered fixture grants never leak into production catalog', () => {
    expect(getInstalledModuleDescriptors().map((d) => d.id)).not.toContain('fgfixture');
    expect(getInstalledModuleDescriptors().map((d) => d.id)).not.toContain('foraging');
    const h = make();
    expect(h.game().extensionRuntime!.worldDefinitionPacks()[0]!.edibleItems).toHaveLength(11);
    h.dispose();
  });
});

import { vi } from 'vitest';
import { forage, grant, ally, read } from './support/forageFixture';
import {
  prepareEdibleCommand,
  commitEdibleCommand,
  transactEdible
} from '../engine/Core/EdibleCommands';
import { consumeEdible } from '../engine/Core/EdibleEffects';
import {
  auditFullObjectGraph,
  fullGenerationRoots
} from './support/fullGenerationCheckpointOracle';
import { getNextEntityId } from '../entities/Creature';
import { logger } from '../engine/Systems/Logger';
it('prepare SDK expires and a prior prepare handle cannot be substituted into another invocation', () => {
  let retained: any, handle: any;
  const bad = {
    ...descriptor,
    create: () => {
      const m = descriptor.create();
      m.edibleCommands!.feed!.prepare = (p, sdk) => {
        retained = sdk;
        if (handle) return { ok: true, value: handle };
        const r = sdk.planFeed(p as any);
        if (r.ok) handle = r.value;
        return r;
      };
      return m;
    }
  };
  const h = forage([], [bad]),
    a = ally(h),
    i = grant(h),
    g = h.game(),
    c = read(h),
    data = {
      module: 'fgfixture',
      action: 'feed',
      payload: {
        targetId: a.id,
        targetRevision: c.feedTargets[0]!.targetRevision,
        itemId: i.id,
        inventoryStamp: c.inventoryStamp
      }
    };
  const before = g.extensionRuntime!.snapshot(),
    id = getNextEntityId(),
    r = rng.getState();
  expect(prepareEdibleCommand(g, data).outcome.ok).toBe(true);
  expect(retained.readEdibleContext()).toMatchObject({ ok: false, code: 'C5_SCOPE' });
  expect(retained.planFeed(data.payload)).toMatchObject({ ok: false, code: 'C5_SCOPE' });
  expect(prepareEdibleCommand(g, data).outcome).toMatchObject({ ok: false, code: 'C5_SCOPE' });
  h.command('escape');
  expect(commitEdibleCommand(g, handle)).toMatchObject({ ok: false, code: 'C5_SCOPE' });
  expect(g.extensionRuntime!.snapshot()).toEqual(before);
  expect(getNextEntityId()).toBe(id);
  expect(rng.getState()).toEqual(r);
});
it.each(['deduct', 'intent', 'fact', 'participant', 'render'] as const)(
  'eat rollback after %s restores independent object write set and all domains',
  (point) => {
    const h = forage(),
      g = h.game(),
      i = grant(h, 'sample1', 2),
      runtime = g.extensionRuntime!;
    const ext = runtime.snapshot(),
      random = rng.getState(),
      id = getNextEntityId(),
      messages = logger.getState(),
      tick = timeSystem.currentTick;
    const target: any =
      point === 'deduct'
        ? g.player.inventory
        : point === 'fact' || point === 'participant'
          ? runtime
          : g;
    const method =
      point === 'deduct'
        ? 'consumeOne'
        : point === 'intent'
          ? 'applyEdibleStatus'
          : point === 'fact'
            ? 'edibleFactId'
            : point === 'participant'
              ? 'edibleParticipate'
              : 'requestEdibleRender';
    const original = target[method].bind(target);
    vi.spyOn(target, method).mockImplementation((...args: any[]) => {
      original(...args);
      throw Error('after ' + point);
    });
    const audit = auditFullObjectGraph(fullGenerationRoots(g), [runtime]);
    expect(() => transactEdible(g, () => consumeEdible(g, i))).toThrow();
    expect(audit.differences()).toEqual([]);
    expect(runtime.snapshot()).toEqual(ext);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
    expect(logger.getState()).toEqual(messages);
    expect(timeSystem.currentTick).toBe(tick);
    expect(g.player.inventory.items).toContain(i);
    expect(i.quantity).toBe(2);
  }
);
it.each(['knowledge', 'need', 'timedStats', 'departures', 'clock'] as const)(
  'invalid saved %s is refused before retiring the live object graph',
  (kind) => {
    const h = forage(),
      g = h.game();
    const a = ally(h);
    grant(h);
    const s = JSON.parse(h.save()),
      f = s.extensions.foundation;
    if (kind === 'knowledge')
      f.kindKnowledge = {
        schema: 1,
        rows: [
          {
            groupId: 'fgfixture.kinds',
            definitionId: 'fgfixture.raw',
            state: 'unknown',
            title: '\u0000'
          }
        ]
      };
    if (kind === 'need') f.actorNeeds.rows[0].actorId = s.player.id;
    if (kind === 'clock') f.actorNeeds.rows[0].lastSettledTick = s.run.world5.simulationTicks + 1;
    if (kind === 'timedStats')
      f.timedStats = {
        schema: 1,
        rows: [
          {
            actorId: a.id,
            owner: 'fgfixture',
            key: 'native.strength',
            category: 'flat',
            value: 2,
            untilTick: 100
          }
        ]
      };
    if (kind === 'departures')
      f.departures = {
        schema: 1,
        nextOrdinal: 1,
        active: [
          { actorId: 999999, owner: 'fgfixture', reason: 'fixture', startedTick: 0, untilTick: 100 }
        ],
        receipts: []
      };
    const runtime = g.extensionRuntime,
      player = g.player,
      random = rng.getState();
    expect(g.loadSnapshot(s)).toBe(false);
    expect(g.extensionRuntime).toBe(runtime);
    expect(g.player).toBe(player);
    expect(g.monsters).toContain(a);
    expect(rng.getState()).toEqual(random);
  }
);
it.each(['promise', 'throw', 'shape', 'field', 'foreign-operation'] as const)(
  'provider %s is a zero-cost rejection',
  (mode) => {
    const bad = {
      ...descriptor,
      create: () => {
        const m = descriptor.create();
        m.edibleCommands!.feed!.prepare = (_p, _sdk) => {
          if (mode === 'promise')
            return Promise.resolve({ ok: false, code: 'C5_INPUT', field: null }) as any;
          if (mode === 'throw') throw Error('provider');
          if (mode === 'shape') return { ok: 1 } as any;
          if (mode === 'field') return { ok: false, code: 'C5_INPUT', field: 42 } as any;
          return {
            ok: true,
            value: Object.freeze({ operation: 'roast', owner: 'fgfixture', actorId: 1 })
          } as any;
        };
        return m;
      }
    };
    const h = forage([], [bad]),
      g = h.game(),
      before = g.extensionRuntime!.snapshot(),
      random = rng.getState(),
      id = getNextEntityId(),
      tick = timeSystem.currentTick;
    expect(h.ext('fgfixture', 'feed', {}).error).toBe(
      mode === 'foreign-operation' ? 'C5_SCOPE' : 'C5_PROVIDER'
    );
    expect(g.extensionRuntime!.snapshot()).toEqual(before);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
    expect(timeSystem.currentTick).toBe(tick);
  }
);
it('non-JSON request and malformed envelope are payload errors without running a provider', () => {
  const h = forage(),
    g = h.game();
  expect(prepareEdibleCommand(g, '{').outcome).toMatchObject({ ok: false, code: 'C5_BAD_PAYLOAD' });
  expect(
    prepareEdibleCommand(g, { module: 'fgfixture', action: 'feed', payload: undefined }).outcome
  ).toMatchObject({ ok: false, code: 'C5_BAD_PAYLOAD' });
});

it.each(['deduct', 'intent', 'fact', 'participant', 'render'] as const)(
  'feed failure after %s restores independent actor, needs, inventory and clocks',
  (point) => {
    const h = forage(),
      g = h.game(),
      a = ally(h),
      i = grant(h, 'sample1', 2),
      runtime = g.extensionRuntime!;
    const c = read(h);
    const plan = prepareEdibleCommand(g, {
      module: 'fgfixture',
      action: 'feed',
      payload: {
        targetId: a.id,
        targetRevision: c.feedTargets[0]!.targetRevision,
        itemId: i.id,
        inventoryStamp: c.inventoryStamp
      }
    });
    expect(plan.outcome.ok).toBe(true);
    const target: any =
      point === 'deduct'
        ? g.player.inventory
        : point === 'fact' || point === 'participant'
          ? runtime
          : g;
    const method =
      point === 'deduct'
        ? 'consumeOne'
        : point === 'intent'
          ? 'applyEdibleStatus'
          : point === 'fact'
            ? 'edibleFactId'
            : point === 'participant'
              ? 'edibleParticipate'
              : 'requestEdibleRender';
    const original = target[method].bind(target);
    vi.spyOn(target, method).mockImplementation((...args: any[]) => {
      original(...args);
      throw Error('after ' + point);
    });
    const ext = runtime.snapshot(),
      random = rng.getState(),
      id = getNextEntityId(),
      messages = logger.getState(),
      tick = timeSystem.currentTick;
    const audit = auditFullObjectGraph(fullGenerationRoots(g), [runtime]);
    if (!plan.outcome.ok) throw Error();
    expect(commitEdibleCommand(g, plan.outcome.value)).toMatchObject({
      ok: false,
      code: 'C5_PROVIDER'
    });
    expect(audit.differences()).toEqual([]);
    expect(runtime.snapshot()).toEqual(ext);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
    expect(logger.getState()).toEqual(messages);
    expect(timeSystem.currentTick).toBe(tick);
    expect(i.quantity).toBe(2);
  }
);
it('call knowledge publication failure restores the whole independent write set', () => {
  const h = forage(),
    g = h.game(),
    i = grant(h),
    runtime = g.extensionRuntime!;
  const original = runtime.edibleDirty.bind(runtime);
  vi.spyOn(runtime, 'edibleDirty').mockImplementation(() => {
    original();
    throw Error('after knowledge');
  });
  const audit = auditFullObjectGraph(fullGenerationRoots(g), [runtime]),
    ext = runtime.snapshot(),
    random = rng.getState();
  expect(g.callItem(i, 'nickname')).toBe(false);
  expect(audit.differences()).toEqual([]);
  expect(runtime.snapshot()).toEqual(ext);
  expect(rng.getState()).toEqual(random);
});
