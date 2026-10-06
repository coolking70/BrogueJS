import * as worldPredicates from '../engine/Core/WorldWorkWorld';
import { createWorldHarness, worldHarnessGame } from '../ext/testing/worldHarness';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { workGame } from './support/worldWorkFixture';
import { createHeadlessGame } from './harness';
import {
  readWorkContext,
  recordWorldFact,
  recordWorldReceipt,
  placementCandidates,
  placeNode
} from '../engine/Core/WorldWorkWorld';
import {
  prepareWorldWorkCommand,
  commitWorldWork,
  withWorldActorScope,
  transactWorldWork,
  worldWorkLastError,
  settleWorldWork,
  prepareTrustedWorldWork,
  cancelWorldWork
} from '../engine/Core/WorldWork';
import { productionActorActionScheduler } from '../engine/Core/ActorActionProduction';
import { enterWorldWorkLevel } from '../engine/Core/WorldWorkPlacement';
import { assertWorldDefinitionPack } from '../engine/Core/WorldDefinitions';
import { createActorActionBundle } from '../engine/Core/ActorActionScheduler';
import { definitions } from '../ext/testing/fixtures/craftingSkeleton';
import { compareCodePoints } from '../engine/Core/WorldCanonical';
import { eventDigest } from '../engine/Core/RecordingDigest';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
import { Item, ItemCategory } from '../engine/Items/Item';
import type { Game } from '../engine/Core/Game';
import type { CommittedWorkFact } from '../ext/worldSdk';
const read = (g: Game) => {
  const r = readWorkContext(g, 'craftskel', { kind: 'inventory' });
  if (!r.ok) throw new Error(r.code);
  return r.value;
};
const craft = (g: Game, n = 2) => {
  const r = read(g),
    s = r.stations[0]!;
  return {
    module: 'craftskel',
    action: 'craft',
    payload: {
      v: 1,
      recipeId: 'craftskel.dagger-recipe',
      batchCount: n,
      stationId: s.interactableId,
      stationRevision: s.revision,
      sourceContainerId: null,
      sourceRevision: null,
      inventoryStamp: r.inventoryStamp
    }
  };
};
const harvest = (g: Game) => {
  const n = g.world5!.nodes[0]!;
  return {
    module: 'craftskel',
    action: 'harvest',
    payload: {
      v: 1,
      nodeId: n.interactableId,
      nodeRevision: n.revision,
      destinationId: null,
      destinationRevision: null,
      inventoryStamp: read(g).inventoryStamp
    }
  };
};
const execute = (g: Game, request: unknown) => {
  g.onConfirmRequest = () => true;
  g.executeCommand('ext:command', JSON.stringify(request));
  while (g.pendingCommandConfirmation)
    g.resolveCommandDecision(g.pendingCommandConfirmation.token, true);
};
const commit = (g: Game, request: unknown) => {
  const p = prepareWorldWorkCommand(g, request);
  if (!p.outcome.ok) throw new Error(p.outcome.code);
  return withWorldActorScope(g, 'craftskel', g.player.id, 'trusted-world', (s) =>
    commitWorldWork(g, p.outcome.ok ? p.outcome.value : null!, s)
  );
};
const loopGame = () => {
  const g = workGame({
    pack: (p) => {
      p.items[1].tool.maxDurability = 10000;
      p.recipes[0].workTicks = 1;
      p.recipes[0].outputs = [{ itemDefinitionId: 'craftskel.fiber', count: 1 }];
    }
  });
  g.monsters = [];
  g.dormantMonsters = [];
  return g;
};
afterEach(() => vi.restoreAllMocks());
describe('5A2 independent review regressions', () => {
  it('R1 rejects dangling auto_work without retiring the live Game', () => {
    const g = workGame(),
      s = JSON.parse(JSON.stringify(g.toSnapshot()));
    expect(g.loadSnapshot(s)).toBe(true);
    const old = g.player;
    (s.run as any).autoAction = { kind: 'auto_work', ticketId: 424242 };
    expect(g.loadSnapshot(s)).toBe(false);
    expect(g.player).toBe(old);
  });
  it('rejects auto_work in classic and terminal/reverse-inconsistent world snapshots', () => {
    const classic = createHeadlessGame(2, 'wizard'),
      s = classic.toSnapshot();
    (s.run as any).autoAction = { kind: 'auto_work', ticketId: 1 };
    expect(classic.loadSnapshot(s)).toBe(false);
    const g = workGame();
    execute(g, craft(g));
    const pending = g.toSaveSnapshot();
    (pending.run as any).autoAction = null;
    expect(g.loadSnapshot(pending)).toBe(false);
    g.executeCommand('auto_step');
    const done = g.toSaveSnapshot();
    (done.run as any).autoAction = {
      kind: 'auto_work',
      ticketId: g.world5!.terminalTickets[0]!.ticketId
    };
    expect(g.loadSnapshot(done)).toBe(false);
  });
  it.each(['depth', 'run'])(
    'R2 rejects aggregate per-%s definitions before creating a run',
    (budget) => {
      const p: any = structuredClone(definitions);
      const a = p.resourceNodes[0];
      a.placement.dungeon.maxPerDepth = budget === 'depth' ? 20 : 1;
      a.placement.dungeon.maxPerRun = budget === 'run' ? 300 : 100;
      p.resourceNodes.push({ ...structuredClone(a), id: 'craftskel.node-two' });
      expect(() => assertWorldDefinitionPack(p, 'craftskel')).toThrow('C5_BAD_DEFINITION');
    }
  );
  it('runtime node budget records skips, retains the floor, and uses unique ordinals', () => {
    const g = workGame({
        pack: (p) => {
          p.resourceNodes[0].placement.dungeon.maxPerDepth = 32;
          p.resourceNodes[0].placement.dungeon.maxPerRun = 512;
        }
      }),
      w = g.world5!,
      d = g.extensionRuntime!.worldDefinitionPacks()[0]!.resourceNodes[0]!;
    while (w.nodes.length < 32)
      placeNode(g, d, placementCandidates(g)[0]!, `fixture.budget.${w.nodes.length}`);
    vi.spyOn(g.extensionRuntime!, 'isWorldWorkFixture').mockReturnValue(false);
    const before = g.grid;
    expect(() => enterWorldWorkLevel(g, true)).not.toThrow();
    expect(g.grid).toBe(before);
    expect(w.nodes).toHaveLength(32);
    const skips = w.receipts.filter((r) => r.kind === 'placement' && r.reason === 'budget');
    expect(skips).toHaveLength(32);
    expect(skips.every((r) => r.result === 'skipped')).toBe(true);
    expect(new Set(w.receipts.map((r) => r.ordinal)).size).toBe(w.receipts.length);
  });
  it('R3 exposes accepted vs completed without ordinal inference; place acceptance writes no receipt', () => {
    const seen: CommittedWorkFact[] = [];
    const g = workGame({
      participant: (f) => {
        seen.push(f);
      }
    });
    execute(g, harvest(g));
    const facts = seen.filter((f) => f.operation === 'harvest');
    expect(facts.map((f) => f.result)).toEqual(['accepted', 'completed']);
    expect(facts.filter((f) => f.result === 'completed')).toHaveLength(1);
    const r = read(g),
      at = placementCandidates(g).find(
        (p) => Math.max(Math.abs(p.x - g.player.x), Math.abs(p.y - g.player.y)) <= 1
      )!;
    const count = g.world5!.receipts.length;
    expect(
      commit(g, {
        module: 'craftskel',
        action: 'place-station',
        payload: {
          v: 1,
          definitionId: 'craftskel.table',
          x: at.x,
          y: at.y,
          inventoryStamp: r.inventoryStamp
        }
      }).ok
    ).toBe(true);
    expect(seen[seen.length - 1]!.result).toBe('accepted');
    expect(g.world5!.receipts).toHaveLength(count);
    expect(g.world5!.stations).toHaveLength(1);
  });
  it('R4 retires delivered tickets, keeps 64 summaries, and admits above the old 8192 lifetime limit', () => {
    const g = loopGame();
    g.world5!.nextWorldId = 8193;
    for (let n = 0; n < 140; n++) {
      execute(g, craft(g));
      g.executeCommand('auto_step');
      expect(worldWorkLastError(g)).toBeNull();
      expect(g.world5!.tickets).toHaveLength(0);
    }
    const w = g.world5!;
    expect(w.nextWorldId).toBeGreaterThan(8193);
    expect(w.terminalTickets).toHaveLength(64);
    expect(new Set(w.terminalTickets.map((t) => t.ticketId)).size).toBe(64);
    expect((g.extensionRuntime!.snapshot().modules.craftskel as any).history).toHaveLength(128);
    expect(g.worldWorkFacts).toHaveLength(128);
    expect(g.loadSnapshot(g.toSaveSnapshot())).toBe(true);
  });
  it('scoped rollback restores the independent full graph at D8 and never traverses grid/cache', () => {
    const g = workGame();
    for (let d = 2; d <= 8; d++) {
      g.depth = d;
      (g as any).generateDepth();
    }
    const audit = auditFullObjectGraph(
      { game: g, world: g.world5, actions: g.actorActions, containers: g.worldContainerItems },
      [g.extensionRuntime!]
    );
    const extensionBefore = g.extensionRuntime!.snapshot();
    const originalGrid = g.grid;
    g.grid = new Proxy(originalGrid, {
      ownKeys() {
        throw new Error('grid traversed');
      }
    });
    expect(() =>
      transactWorldWork(g, () => {
        g.world5!.nextWorldId++;
        g.actorActions!.nextActionId++;
        g.player.inventory.items[0]!.quantity++;
        g.worldWorkFacts!.push({ factId: 999 } as any);
        g.beginWorldAutoWork(999);
        throw new Error('fault');
      })
    ).toThrow('fault');
    g.grid = originalGrid;
    expect(audit.differences()).toEqual([]);
    expect(g.extensionRuntime!.snapshot()).toEqual(extensionBefore);
  });
  it('dirty domains reuse clean hashes and agree with the independent oracle after writes/rollback', () => {
    const g = loopGame();
    g.executeCommand('escape');
    const snapshot = vi.spyOn(g.extensionRuntime!, 'snapshot');
    g.executeCommand('escape');
    expect(snapshot).not.toHaveBeenCalled();
    snapshot.mockRestore();
    execute(g, craft(g));
    for (const action of ['escape', 'wait', 'search', 'escape']) {
      g.executeCommand(action);
      const recorded = g.recordedInputEvents[g.recordedInputEvents.length - 1]!.checkpoint;
      expect(recorded).toEqual(
        eventDigest(
          g.extensionRuntime!.snapshot(),
          g.world5!,
          g.extensionRuntime!.manifest,
          g.actorActions!,
          g.worldWorkFacts!,
          g.worldWorkDetails!
        )
      );
    }
  });
  it('code-point fast path preserves the previous ordering including supplementary prefixes', () => {
    const values = [
      '',
      'a',
      'ab',
      'b',
      '中',
      '😀',
      '😀a',
      '😀b',
      '\ue000',
      '𝄞',
      '\ud800',
      '\udc00',
      'a😀',
      'a\ue000'
    ];
    const original = (a: string, b: string) => {
      const x = Array.from(a, (c) => c.codePointAt(0)!),
        y = Array.from(b, (c) => c.codePointAt(0)!);
      for (let i = 0; i < Math.min(x.length, y.length); i++)
        if (x[i] !== y[i]) return x[i]! - y[i]!;
      return x.length - y.length;
    };
    for (const a of values)
      for (const b of values)
        expect(Math.sign(compareCodePoints(a, b)), `${a}/${b}`).toBe(Math.sign(original(a, b)));
  });
  it('native root growth cannot cancel a previously reserved paid batch', () => {
    const g = workGame();
    g.monsters = [];
    expect(commit(g, craft(g, 1)).ok).toBe(true);
    for (let i = 0; i < 7169; i++) {
      const item = new Item('native', '*', 1, ItemCategory.GEM);
      item.loc = { ...g.player.loc };
      g.items.push(item);
    }
    const scheduler = productionActorActionScheduler(g)!;
    scheduler.advanceActionTime(100);
    scheduler.dispatchActorBoundary(g.player.id);
    settleWorldWork(g);
    expect(g.world5!.tickets).toHaveLength(0);
    expect(g.world5!.terminalTickets[0]).toMatchObject({
      status: 'completed',
      completedBatches: 1
    });
    expect(g.player.inventory.items.filter((i) => i.identityId === 'dagger')).toHaveLength(2);
  });
  it('provider batch failure delivers its cancellation and classifies the real failure', () => {
    const seen: CommittedWorkFact[] = [];
    const g = workGame({
      participant: (f) => {
        if (f.operation === 'craft-batch' && f.result === 'completed') throw new Error('provider');
        seen.push(f);
      }
    });
    execute(g, craft(g));
    expect(g.world5!.terminalTickets[0]!.stopReason).toBe('provider');
    expect(seen.filter((f) => f.operation === 'cancel').map((f) => f.reason)).toEqual(['provider']);
  });
  it('foundation binds the definition pack even when a module leaves its rules fingerprint unchanged', () => {
    const original = workGame(),
      save = original.toSaveSnapshot();
    const changed = workGame({
      rulesFingerprint: original.extensionRuntime!.manifest.modules[0]!.rules!.fingerprint,
      pack: (p) => {
        p.recipes[0].workTicks = 101;
      }
    });
    expect(changed.extensionRuntime!.manifest).toEqual(original.extensionRuntime!.manifest);
    expect(changed.world5!.definitionsFingerprint).not.toEqual(
      original.world5!.definitionsFingerprint
    );
    expect(changed.loadSnapshot(save)).toBe(false);
  });
  it('retired facts survive another owner evicting their ticket summary', () => {
    const h = createWorldHarness({
        seed: 51020001,
        mode: 'normal',
        modules: [],
        fixtures: ['world-work-basic', 'crafting-skeleton']
      }),
      g = worldHarnessGame(h);
    const n = g.world5!.nodes.find((n) => n.owner === 'c5fixture')!,
      r = readWorkContext(g, 'c5fixture', { kind: 'inventory' });
    if (!r.ok) throw new Error(r.code);
    const p = prepareTrustedWorldWork(g, 'c5fixture', g.player.id, {
      kind: 'harvest',
      nodeId: n.interactableId,
      nodeRevision: n.revision,
      destinationId: null,
      destinationRevision: null,
      inventoryStamp: r.value.inventoryStamp
    });
    if (!p.ok) throw new Error(p.code);
    expect(
      withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (s) =>
        commitWorldWork(g, p.value, s)
      ).ok
    ).toBe(true);
    const scheduler = productionActorActionScheduler(g)!;
    scheduler.advanceActionTime(100);
    scheduler.dispatchActorBoundary(g.player.id);
    settleWorldWork(g);
    const oldTicket = g.world5!.terminalTickets[0]!.ticketId;
    for (let i = 0; i < 70; i++) {
      expect(commit(g, craft(g)).ok).toBe(true);
      cancelWorldWork(g, g.world5!.tickets[0]!.ticketId, 'input');
    }
    expect(g.world5!.terminalTickets.some((t) => t.ticketId === oldTicket)).toBe(false);
    expect(g.worldWorkFacts!.filter((f) => f.owner === 'c5fixture')).toHaveLength(2);
    g.executeCommand('escape');
    expect(g.loadSnapshot(g.toSaveSnapshot())).toBe(true);
    h.dispose();
  });
  it('provider cannot return foreign error codes or mutate prepared payloads', () => {
    const g = workGame();
    let frozen = false;
    vi.spyOn(g.extensionRuntime!, 'worldWorkCommand').mockReturnValue({
      prepare: (p: any) => {
        frozen = Object.isFrozen(p);
        return { ok: false, code: 'FOREIGN' as any, field: null };
      }
    });
    expect(prepareWorldWorkCommand(g, craft(g)).outcome).toEqual({
      ok: false,
      code: 'C5_PROVIDER',
      field: null
    });
    expect(frozen).toBe(true);
  });
  it('world:transfer is not a public state-changing command', () => {
    const g = workGame(),
      before = g.player.inventory.items.map((i) => [i.id, i.quantity]);
    g.executeCommand('world:transfer', { direction: 'deposit' });
    expect(g.player.inventory.items.map((i) => [i.id, i.quantity])).toEqual(before);
    expect(g.world5!.containers.find((c) => c.kind === 'chest')!.itemIds).toEqual([]);
  });
  it.each(['input', 'disturbed', 'threat', 'damage'])(
    'auto work records the real %s cancellation source',
    (reason) => {
      const g = workGame();
      execute(g, craft(g));
      vi.spyOn(worldPredicates, 'threat').mockReturnValue(reason === 'threat');
      if (reason === 'damage') g.player.hp--;
      g.disturbed = reason !== 'input';
      g.executeCommand(reason === 'input' ? 'escape' : 'auto_step');
      expect(g.world5!.terminalTickets[0]!.stopReason).toBe(reason);
    }
  );
  it('confirmation suspension releases the command flag and resumes it only for execution', () => {
    const g = workGame();
    g.onConfirmRequest = null;
    g.executeCommand('ext:command', JSON.stringify(craft(g, 3)));
    expect(g.pendingCommandConfirmation).not.toBeNull();
    expect(g.isExecutingRecordedCommand()).toBe(false);
    g.resolveCommandDecision(g.pendingCommandConfirmation!.token, true);
    expect(g.isExecutingRecordedCommand()).toBe(false);
  });
  it('bundles require explicit owner', () => {
    expect(() =>
      createActorActionBundle({
        actionId: 1,
        depth: 1,
        decisionOwnerId: 1,
        timeChargeOwnerId: 1,
        subactions: [
          {
            sourceEntityId: 1,
            sourcePartId: 'body',
            sourceFootprintVersion: 'fixture',
            phases: [{ kind: 'recovery', durationTicks: 1, segmentIndex: null }]
          }
        ]
      } as any)
    ).toThrow();
  });
  it('station eligibility honors interactionDistance', () => {
    const g = workGame({
      pack: (p) => {
        p.stations[0].interactionDistance = 0;
      }
    });
    expect(read(g).stations[0]!.workPositions).toEqual([]);
    expect(prepareWorldWorkCommand(g, craft(g)).outcome).toMatchObject({
      ok: false,
      code: 'C5_DISTANCE'
    });
  });
  it('fact rings preserve 128 per owner and receipt ordinals cannot duplicate on load', () => {
    const g = workGame({ modules: ['combat'] });
    for (let n = 0; n < 140; n++)
      recordWorldFact(
        g,
        {
          owner: 'craftskel',
          ticketId: null,
          completionOrdinal: 0,
          operation: 'startup',
          definitionId: 'craftskel.fiber',
          actorId: g.player.id,
          completedBatches: 0,
          result: 'completed',
          reason: null,
          tick: 0
        },
        false
      );
    const first = g.worldWorkFacts!.filter((f) => f.owner === 'craftskel');
    for (let n = 0; n < 140; n++)
      recordWorldFact(g, { ...first[0]!, owner: 'combat' } as any, false);
    expect(g.worldWorkFacts!.filter((f) => f.owner === 'craftskel')).toHaveLength(128);
    expect(g.worldWorkFacts!.filter((f) => f.owner === 'combat')).toHaveLength(128);
    const other = workGame();
    recordWorldReceipt(other, 'craftskel', 'placement', 'one', 'skipped', 'budget');
    recordWorldReceipt(other, 'craftskel', 'placement', 'two', 'skipped', 'budget');
    const s = other.toSaveSnapshot(),
      r = s.run.world5!.receipts;
    r[r.length - 1]!.ordinal = r[r.length - 2]!.ordinal;
    expect(other.loadSnapshot(s)).toBe(false);
  });
});
