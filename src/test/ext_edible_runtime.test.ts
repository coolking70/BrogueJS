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
    const h = make();
    // Installed production packages are allowed; this harness must enable only its fixture.
    expect(h.game().extensionRuntime!.manifest.modules.map((m) => m.id)).toEqual(['fgfixture']);
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

import { definitions as forageDefinitions } from '../ext/testing/fixtures/forageFixture';
import type { WorldDefinitionPack } from '../ext/structureTypes';
import type { Json } from '../ext/types';
import { extensionDataFingerprint } from '../ext/fingerprint';
import { worldWorkReadSDK } from '../engine/Core/WorldWorkWorld';
import { validateWorldWorkReferences } from '../engine/Core/WorldWorkValidation';
const workProjectionFixture = (pack: WorldDefinitionPack = forageDefinitions) => {
  const rules = { schema: 1, version: '1.0.0', fingerprint: extensionDataFingerprint(pack) };
  return {
    ...descriptor, rules,
    create: () => {
      const m = descriptor.create();
      m.rules = rules;
      m.worldDefinitions = pack;
      m.projectView = (c) => ({
        context: c.worldWork?.readWorkContext({ kind: 'inventory' }) ?? null,
        facts: c.worldWork?.recentFacts(0) ?? null
      }) as unknown as Json;
      return m;
    }
  };
};
function harvested() {
  const h = forage([], [workProjectionFixture()]);
  h.fixture({ kind: 'node', definitionId: 'fgfixture.node-a', at: { x: 11, y: 10 } });
  const g = h.game(), node = g.world5!.nodes.find(n => n.at.x === 11 && n.at.y === 10)!;
  const context = h.readWorkContext('fgfixture', { kind: 'node', interactableId: node.interactableId });
  expect(context.ok).toBe(true);
  if (!context.ok) throw Error(context.code);
  expect(h.ext('fgfixture', 'harvest', {
    nodeId: node.interactableId, nodeRevision: node.revision,
    inventoryStamp: context.value.inventoryStamp, destinationId: null, destinationRevision: null
  })).toEqual({ recorded: true, error: null });
  expect(g.world5!.tickets).toEqual([]);
  expect(g.world5!.terminalTickets).toHaveLength(1);
  expect(g.world5!.terminalTickets[0]).toMatchObject({
    owner: 'fgfixture', definitionId: 'fgfixture.node-a', kind: 'harvest', status: 'completed', completedBatches: 1
  });
  expect(g.worldWorkFacts!.map(f => [f.operation, f.result])).toEqual([
    ['harvest', 'accepted'], ['harvest', 'completed']
  ]);
  expect(g.player.inventory.items.find(i => i.worldItem?.definitionId === 'fgfixture.raw')?.quantity).toBe(1);
  return h;
}
it('empty-items harvest preserves terminal tickets and work facts through save/load, replay, seek and continuation', () => {
  const h = harvested(), g = h.game();
  const evidence = () => structuredClone({
    terminal: g.world5!.terminalTickets, facts: g.worldWorkFacts,
    projection: g.extensionRuntime!.readModuleView('fgfixture')!.state
  });
  const expected = evidence();
  expect(expected.projection).toMatchObject({ context: { ok: true }, facts: { ok: true, value: expected.facts } });
  const save = h.save(), digest = h.digest(), rec = h.exportRecording(), n = g.recordedInputEvents.length;
  h.load(save);
  expect(evidence()).toEqual(expected);
  expect(h.digest()).toBe(digest);
  // The harness calls replayStep(true) for every recorded command.
  expect(h.replay(rec)).toEqual({ ok: true, firstMismatch: null });
  expect(evidence()).toEqual(expected);
  expect(h.digest()).toBe(digest);
  h.seek(rec, n - 1);
  expect(g.world5!.terminalTickets).toEqual([]);
  expect(g.worldWorkFacts).toEqual([]);
  expect(g.replayStep(true)).not.toBe(false);
  expect(g.replayError).toBeNull();
  expect(evidence()).toEqual(expected);
  h.seek(rec, n);
  expect(evidence()).toEqual(expected);
  expect(h.digest()).toBe(digest);
  h.load(save);
  h.command('wait');
  const continued = h.exportRecording(), continuedDigest = h.digest();
  // Export promotes the final event to a full checkpoint and rechains it.
  // Continuation keeps every command field and incremental checkpoint unchanged.
  const prefix = (recording: string) => JSON.parse(recording).events.slice(0, n)
    .map(({ fullCheckpoint: _full, chainDigest: _chain, ...event }: any) => event);
  expect(prefix(continued)).toEqual(prefix(rec));
  expect(h.replay(continued)).toEqual({ ok: true, firstMismatch: null });
  expect(evidence()).toEqual(expected);
  expect(h.digest()).toBe(continuedDigest);
});
it('only edibleItems supplies context.worldWork while an absent owner has no projection', () => {
  const pack: WorldDefinitionPack = {
    schema: 1, worldSdk: 1, items: [], resourceNodes: [], stations: [], recipes: [], startupItems: null,
    edibleItems: [forageDefinitions.edibleItems![2]!]
  };
  const h = forage([], [workProjectionFixture(pack)]), g = h.game(), before = h.save(), random = rng.getState();
  expect(g.extensionRuntime!.readModuleView('fgfixture')!.state).toMatchObject({
    context: { ok: true, value: { owner: 'fgfixture' } }, facts: { ok: true, value: [] }
  });
  expect(worldWorkReadSDK(g, 'missing')).toBeUndefined();
  expect(g.extensionRuntime!.readModuleView('missing')).toBeNull();
  expect(h.save().replace(/"savedAt":\d+/, '')).toBe(before.replace(/"savedAt":\d+/, ''));
  expect(rng.getState()).toEqual(random);
  h.load(before);
  expect(g.extensionRuntime!.readModuleView('fgfixture')!.state).toMatchObject({ context: { ok: true } });
});
it.each(['terminal-owner', 'terminal-definition', 'fact-owner', 'fact-definition'] as const)(
  'empty-items harvest still rejects invalid %s references',
  (kind) => {
    const h = harvested(), g = h.game();
    expect(() => validateWorldWorkReferences(g)).not.toThrow();
    // Isolate work-fact validation from terminal-ticket validation as well.
    if (kind.startsWith('fact')) {
      g.world5!.terminalTickets = [];
      g.worldWorkFacts = structuredClone(g.worldWorkFacts);
      expect(() => validateWorldWorkReferences(g)).not.toThrow();
    }
    const row = kind.startsWith('terminal') ? g.world5!.terminalTickets[0]! : g.worldWorkFacts![0]!;
    if (kind.endsWith('owner')) row.owner = 'missing';
    else row.definitionId = 'fgfixture.missing';
    expect(() => validateWorldWorkReferences(g)).toThrow('C5_BAD_REFERENCE');
  }
);
it('empty-items work facts remain valid after their terminal ticket leaves the bounded ledger', () => {
  const h = harvested(), g = h.game();
  g.world5!.terminalTickets = [];
  // Facts have their own retention bound and may outlive the terminal ticket.
  expect(() => validateWorldWorkReferences(g)).not.toThrow();
  expect(() => h.save()).not.toThrow();
});

import { nativeStatRevision } from '../engine/Stats/NativeStatSources';
import { nativeStat, nativePair } from '../engine/Stats/NativeStatSources';
import { Player } from '../entities/Player';
import type { EdibleConsumedFact } from '../ext/edibleSdk';
const healingCases = [
  { maxHp: 30, hp: 10, gained: 9 },
  { maxHp: 10, hp: 1, gained: 5 },
  { maxHp: 30, hp: 28, gained: 2 },
  { maxHp: 30, hp: 30, gained: 0 },
  { maxHp: 200, hp: 100, gained: 60 }
];
it.each(healingCases.flatMap(row => ['eat', 'feed'].map(operation => ({ ...row, operation }))))(
  'point healing $operation max=$maxHp hp=$hp reports exactly $gained before the paid turn',
  ({ maxHp, hp, gained, operation }) => {
    let fact: EdibleConsumedFact | undefined, immediateHp = -1;
    let target: Player | ReturnType<typeof ally>;
    const observer = { ...descriptor, create: () => {
      const m = descriptor.create(), original = m.edibleParticipant!.onConsumed;
      m.edibleParticipant!.onConsumed = (f, tx) => {
        fact = structuredClone(f); immediateHp = target.hp; original?.(f, tx);
      };
      return m;
    } };
    const h = forage([], [observer]), g = h.game(), food = grant(h, 'sample0');
    target = operation === 'eat' ? g.player : ally(h);
    target.maxHp = maxHp; target.hp = hp;
    g.player.regenCarry = 0;
    const revision = nativeStatRevision(target);
    if (operation === 'eat') {
      g.onConfirmRequest = () => true;
      h.command('item:execute', 'eat|' + food.inventoryLetter);
    } else {
      const c = read(h), t = c.feedTargets.find(t => t.actorId === target.id)!;
      expect(h.ext('fgfixture', 'feed', {
        targetId: target.id, targetRevision: t.targetRevision,
        itemId: food.id, inventoryStamp: c.inventoryStamp
      }, [true]).error).toBeNull();
    }
    expect(fact).toMatchObject({ operation, hpBefore: hp, maxHp,
      outcome: { hpGained: gained, applied: gained > 0 } });
    expect(immediateHp).toBe(hp + gained);
    expect(target.hp).toBe(hp + gained);
    expect(nativeStatRevision(target)).toBeGreaterThan(revision);
  }
);
it('native healing remains percentage based and point healing clears terminal causality', () => {
  const p = new Player(0, 0); p.maxHp = 37; p.hp = 1;
  expect(p.heal(30)).toBe(11); expect(p.hp).toBe(12);
  const h = forage(), g = h.game(), a = ally(h);
  a.hp = 0;
  const clear = vi.spyOn(a.extensionHooks!.causality, 'clearTerminal');
  const revision = nativeStatRevision(a);
  expect(a.healPoints(5)).toBe(5);
  expect(a.hp).toBe(5); expect(clear).toHaveBeenCalledWith(a.id);
  expect(nativeStatRevision(a)).toBe(revision + 1);
  void g;
});

it('public and harness node reads materialize 31900/32000, reservations and live CAS without writes', () => {
  const pack = structuredClone(forageDefinitions);
  pack.resourceNodes[0]!.regeneration = { kind: 'periodic', units: 1, intervalTicks: 32000 };
  const h = forage([], [workProjectionFixture(pack)]), g = h.game();
  h.fixture({ kind: 'node', definitionId: 'fgfixture.node-a', at: { x: 11, y: 10 } });
  const node = g.world5!.nodes.find(n => n.at.x === 11 && n.at.y === 10)!;
  const query = { kind: 'node' as const, interactableId: node.interactableId };
  node.remaining = 0; node.lastSettledTick = 0; node.regenRemainder = 0;
  h.fixture({ kind: 'advance', ticks: 31900 });
  const sdk = worldWorkReadSDK(g, 'fgfixture')!;
  const value = () => { const r = sdk.readWorkContext(query); if (!r.ok) throw Error(r.code); return r.value; };
  expect(value().node!.remaining).toBe(0);
  h.fixture({ kind: 'advance', ticks: 100 });
  const before = h.save().replace(/"savedAt":\d+/, ''), random = rng.getState(), id = getNextEntityId();
  for (let i = 0; i < 20; i++) {
    const projected = value();
    expect(projected.node).toMatchObject({ remaining: 1, revision: node.revision, lastSettledTick: 32000 });
    expect(h.readWorkContext('fgfixture', query)).toEqual({ ok: true, value: projected });
  }
  expect(h.save().replace(/"savedAt":\d+/, '')).toBe(before);
  expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(id);
  const save = h.save(), projected = value(); h.load(save);
  expect(value()).toEqual(projected);
  const payload = { nodeId: node.interactableId, nodeRevision: projected.node!.revision,
    inventoryStamp: projected.inventoryStamp, destinationId: null, destinationRevision: null };
  expect(h.ext('fgfixture', 'harvest', payload).error).toBeNull();
  expect(h.ext('fgfixture', 'harvest', { ...payload, inventoryStamp: read(h).inventoryStamp }).error).toBe('C5_STALE');
  const live = g.world5!.nodes.find(n => n.interactableId === node.interactableId)!;
  live.remaining = 0; live.lastSettledTick = g.world5!.simulationTicks - 32000; live.regenRemainder = 0; live.reservedUnits = 1;
  expect(value().node).toMatchObject({ remaining: 1, reservedUnits: 1, revision: live.revision });
  expect(h.ext('fgfixture', 'harvest', { ...payload, nodeRevision: live.revision,
    inventoryStamp: read(h).inventoryStamp }).error).toBe('C5_RESERVED');
  live.reservedUnits = 0; live.remaining = live.capacity; live.lastSettledTick = 0; live.regenRemainder = 123;
  expect(value().node).toMatchObject({ remaining: live.capacity, regenRemainder: 0 });
});

// Candidate time is a foundation concern; these use the neutral four-turn food.
const eatTemporaryStrength = (h: ReturnType<typeof forage>) => {
  const food = grant(h, 'sample6');
  h.game().onConfirmRequest = () => true;
  h.command('item:execute', 'eat|' + food.inventoryLetter);
  expect(h.game().player.strength).toBe(14);
  return h.save();
};
const waitToTemporaryExpiry = (h: ReturnType<typeof forage>, until: number) => {
  while (h.game().world5!.simulationTicks < until) h.command('wait');
  expect(h.game().world5!.simulationTicks).toBe(until);
};
const loadProjection = (g: ReturnType<ReturnType<typeof forage>['game']>) =>
  ({ ...g.toSaveSnapshot(), savedAt: 0 });

describe('candidate clock load regression', () => {
  it('reloads active strength into an expired same Game repeatedly and publicly expires at the boundary', () => {
    const h = forage(), g = h.game(), saved = eatTemporaryStrength(h);
    const until = JSON.parse(saved).extensions.foundation.timedStats.rows[0].untilTick;
    expect([g.world5!.simulationTicks, until]).toEqual([100, 400]);
    expect(g.loadSnapshot(JSON.parse(saved))).toBe(true);
    for (let repetition = 0; repetition < 2; repetition++) {
      waitToTemporaryExpiry(h, until);
      expect(nativeStat(g.player, 'native.strength')).toBe(12);
      expect(g.loadSnapshot(JSON.parse(saved))).toBe(true);
      expect([g.world5!.simulationTicks, nativeStat(g.player, 'native.strength')]).toEqual([100, 14]);
      expect(g.extensionRuntime!.stats.applied(g.player.id, 'native.strength')).toBe(2);
    }
    h.command('wait'); h.command('wait');
    expect([g.world5!.simulationTicks, nativeStat(g.player, 'native.strength')]).toEqual([300, 14]);
    h.command('wait');
    expect([g.world5!.simulationTicks, nativeStat(g.player, 'native.strength')]).toEqual([400, 12]);
    expect(g.extensionRuntime!.snapshot().foundation.timedStats).toBeUndefined();
    expect(g.extensionRuntime!.stats.applied(g.player.id, 'native.strength')).toBe(0);
  });
  it('loads a later candidate into an earlier live clock and a fresh control', () => {
    const h = forage(), g = h.game(), early = eatTemporaryStrength(h);
    h.command('wait'); const later = h.save();
    expect(g.loadSnapshot(JSON.parse(early))).toBe(true);
    expect(g.world5!.simulationTicks).toBe(100);
    expect(g.loadSnapshot(JSON.parse(later))).toBe(true);
    expect([g.world5!.simulationTicks, nativeStat(g.player, 'native.strength')]).toEqual([200, 14]);
    const fresh = forage(), fg = fresh.game();
    expect(fg.world5!.simulationTicks).toBe(0);
    expect(fg.loadSnapshot(JSON.parse(later))).toBe(true);
    expect([fg.world5!.simulationTicks, nativeStat(fg.player, 'native.strength')]).toEqual([200, 14]);
    waitToTemporaryExpiry(fresh, 400);
    expect(nativeStat(fg.player, 'native.strength')).toBe(12);
  });
  it('does not resurrect an expired candidate row when the old live clock is earlier', () => {
    const h = forage(), g = h.game(), active = eatTemporaryStrength(h);
    waitToTemporaryExpiry(h, 400);
    const expired = g.toSnapshot();
    // Expired rows can remain on inactive actors. Isolate source filtering with
    // a schema-valid retained row and its correctly empty applied ledger.
    expired.extensions!.foundation.timedStats = JSON.parse(active).extensions.foundation.timedStats;
    expect(g.loadSnapshot(JSON.parse(active))).toBe(true);
    expect(g.world5!.simulationTicks).toBe(100);
    expect(g.loadSnapshot(expired)).toBe(true);
    expect([g.world5!.simulationTicks, nativeStat(g.player, 'native.strength')]).toEqual([400, 12]);
    expect(g.extensionRuntime!.stats.applied(g.player.id, 'native.strength')).toBe(0);
    h.command('wait');
    expect(nativeStat(g.player, 'native.strength')).toBe(12);
    expect(g.extensionRuntime!.snapshot().foundation.timedStats).toBeUndefined();
  });
  it('restores a companion non-materialized damage source and clears it on real expiry', () => {
    const h = forage(), g = h.game(), a = ally(h), food = grant(h, 'sample6');
    const c = read(h), target = c.feedTargets.find(t => t.actorId === a.id)!;
    expect(h.ext('fgfixture', 'feed', {targetId: a.id, targetRevision: target.targetRevision,
      itemId: food.id, inventoryStamp: c.inventoryStamp})).toEqual({recorded: true, error: null});
    const damage = () => nativePair(g.monsters.find(m => m.id === a.id)!, g.player,
      'physical-damage', {baseValue: 100, attackKind: 'melee', adjacent: true});
    expect(damage()).toBe(120);
    const saved = h.save(), until = JSON.parse(saved).extensions.foundation.timedStats.rows[0].untilTick;
    expect(g.extensionRuntime!.snapshot().foundation.stats).toBeUndefined();
    for (let repetition = 0; repetition < 2; repetition++) {
      waitToTemporaryExpiry(h, until); expect(damage()).toBe(100);
      expect(g.loadSnapshot(JSON.parse(saved))).toBe(true);
      expect(damage()).toBe(120);
      expect(g.player.strength).toBe(12);
      expect(g.extensionRuntime!.snapshot().foundation.stats).toBeUndefined();
    }
    waitToTemporaryExpiry(h, until); expect(damage()).toBe(100);
  });
  it.each(['bonus', 'timed-value', 'until-boundary', 'candidate-clock'] as const)(
    'rejects inconsistent %s without touching the live graph, messages or random streams', kind => {
      const h = forage(), g = h.game(), saved = eatTemporaryStrength(h), bad = g.toSnapshot();
      if (kind === 'bonus') bad.extensions!.foundation.stats!.applied[0]!.bonus++;
      if (kind === 'timed-value') bad.extensions!.foundation.timedStats!.rows[0]!.value++;
      if (kind === 'until-boundary') bad.extensions!.foundation.timedStats!.rows[0]!.untilTick = bad.run.world5!.simulationTicks;
      if (kind === 'candidate-clock') bad.run.world5!.simulationTicks = 400;
      const roots = [g.player, g.player.inventory, g.extensionRuntime, g.grid, g.monsters, g.items, g.world5];
      const before = loadProjection(g), random = rng.getState(), id = getNextEntityId(), messages = logger.getState();
      expect(g.loadSnapshot(bad)).toBe(false);
      [g.player, g.player.inventory, g.extensionRuntime, g.grid, g.monsters, g.items, g.world5]
        .forEach((root, index) => expect(root).toBe(roots[index]));
      expect(loadProjection(g)).toEqual(before);
      expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(id);
      expect(logger.getState()).toEqual(messages);
      expect(nativeStat(g.player, 'native.strength')).toBe(14);
      h.command('wait'); h.command('wait'); h.command('wait');
      expect(nativeStat(g.player, 'native.strength')).toBe(12);
      expect(g.loadSnapshot(JSON.parse(saved))).toBe(true);
      expect(nativeStat(g.player, 'native.strength')).toBe(14);
    });
});

import { FOUNDATION_PROTOCOL, type ModuleDescriptor } from '../ext/descriptor';
import { isJson } from '../ext/json';
import { NATIVE_STAT_KEYS } from '../engine/Stats/NativeStatKeys';
const resourceLoadFixture: ModuleDescriptor = {
  id: 'growth', version: '1.0.0', foundation: FOUNDATION_PROTOCOL, labelKey: 'ext.growth.fixture',
  create: () => ({
    id: 'growth', version: '1.0.0', initialState: () => ({}), validateState: isJson,
    statSources: {
      keys: [
        { ...NATIVE_STAT_KEYS.find(k => k.id === 'native.strength')!, id: 'growth.focus-capacity', owner: 'growth', minimum: 0, base: 5 },
        { ...NATIVE_STAT_KEYS.find(k => k.id === 'native.strength')!, id: 'growth.focus-recovery-interval', owner: 'growth', kind: 'query', minimum: 1, base: 10 }
      ], collect: () => []
    },
    onNewGame: c => c.setComponent(c.playerId, 'focus', { current: 5, remainder: 0 })
  })
};
it('candidate clock load regression retains strict candidate resource bounds', () => {
  const h = forage(['growth'], [resourceLoadFixture]), g = h.game(), saved = eatTemporaryStrength(h);
  waitToTemporaryExpiry(h, 400);
  expect(g.loadSnapshot(JSON.parse(saved))).toBe(true);
  expect(g.extensionRuntime!.stats.value(g.player.id, 'growth.focus-capacity')).toBe(5);
  for (const patch of [{current: 6}, {remainder: 10}]) {
    const bad = g.toSnapshot();
    Object.assign(bad.extensions!.components[String(g.player.id)]!['growth:focus']!, patch);
    const player = g.player, runtime = g.extensionRuntime, world = g.world5;
    const before = loadProjection(g), random = rng.getState(), nextId = getNextEntityId(), messages = logger.getState();
    expect(g.loadSnapshot(bad)).toBe(false);
    expect(g.player).toBe(player); expect(g.extensionRuntime).toBe(runtime); expect(g.world5).toBe(world);
    expect(loadProjection(g)).toEqual(before); expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(nextId); expect(logger.getState()).toEqual(messages);
    expect(nativeStat(g.player, 'native.strength')).toBe(14);
  }
  waitToTemporaryExpiry(h, 400); expect(g.player.strength).toBe(12);
});
