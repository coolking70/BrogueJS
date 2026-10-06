import { describe, expect, it, vi, afterEach } from 'vitest';
import { ExtensionRegistry } from '../ext/registry';
import {
  definitions,
  rules,
  createCraftingSkeleton
} from '../ext/testing/fixtures/craftingSkeleton';
import { workGame } from './support/worldWorkFixture';
import {
  prepareWorldWorkCommand,
  withWorldActorScope,
  commitWorldWork,
  worldWorkLastError,
  transactWorldWork
} from '../engine/Core/WorldWork';
import { readWorkContext } from '../engine/Core/WorldWorkWorld';
import { grantStartupItems } from '../engine/Core/WorldWorkPlacement';
import { getNextEntityId } from '../entities/Creature';
import { rng } from '../engine/Random';
import * as publication from '../engine/Core/WorldWorkWorld';
import * as assemblers from '../engine/Items/WorldItems';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
const request = (g: ReturnType<typeof workGame>, count = 1) => {
  const v = readWorkContext(g, 'craftskel', { kind: 'inventory' });
  if (!v.ok) throw new Error(v.code);
  const s = v.value.stations[0]!;
  return {
    module: 'craftskel',
    action: 'craft',
    payload: {
      v: 1,
      recipeId: 'craftskel.dagger-recipe',
      batchCount: count,
      stationId: s.interactableId,
      stationRevision: s.revision,
      sourceContainerId: null,
      sourceRevision: null,
      inventoryStamp: v.value.inventoryStamp
    }
  };
};
afterEach(() => vi.restoreAllMocks());
describe('C5 SDK construction, expiry and real publication failures', () => {
  it.each([undefined, 2])(
    'worldSdk %s refuses a world module before construction publication',
    (sdk) => {
      const r = new ExtensionRegistry();
      r.register('craftskel', '1.0.0', createCraftingSkeleton, rules, sdk);
      expect(() => r.create(r.manifest(['craftskel']))).toThrow('C5_BAD_VERSION');
    }
  );
  it.each(['collision', 'bad-owner', 'unknown-key', 'count', 'tool'])(
    'whole %s definition registration fails atomically',
    (caseName) => {
      const r = new ExtensionRegistry();
      r.register(
        'craftskel',
        '1.0.0',
        () => {
          const m = createCraftingSkeleton(),
            d: any = structuredClone(definitions);
          if (caseName === 'collision') m.commands = { craft: () => {} };
          if (caseName === 'bad-owner') d.items[0].owner = 'other';
          if (caseName === 'unknown-key') d.items[0].unitWeight = 1;
          if (caseName === 'count') d.recipes[0].outputs[0].count = 100;
          if (caseName === 'tool') d.items[1].maxStack = 2;
          m.worldDefinitions = d;
          return m;
        },
        rules,
        1
      );
      const before = { id: getNextEntityId(), rng: rng.getState() };
      expect(() => r.create(r.manifest(['craftskel']))).toThrow('C5_BAD_DEFINITION');
      expect({ id: getNextEntityId(), rng: rng.getState() }).toEqual(before);
    }
  );
  it('saved prepare SDK is expired and cannot forge an actor', () => {
    const g = workGame(),
      original = g.extensionRuntime!.worldWorkCommand('craftskel', 'craft')!,
      capture: { sdk?: any } = {};
    vi.spyOn(g.extensionRuntime!, 'worldWorkCommand').mockReturnValue({
      prepare: (p, s) => {
        capture.sdk = s;
        return original.prepare(p, s);
      }
    });
    expect(prepareWorldWorkCommand(g, request(g)).outcome.ok).toBe(true);
    expect(capture.sdk.readWorkContext({ kind: 'inventory' })).toEqual({
      ok: false,
      code: 'C5_SCOPE',
      field: null
    });
    expect(capture.sdk.planTimedWork({ kind: 'craft' })).toEqual({
      ok: false,
      code: 'C5_SCOPE',
      field: null
    });
    expect(() =>
      withWorldActorScope(g, 'craftskel', g.player.id, 'npc-decision', () => {})
    ).toThrow('C5_SCOPE');
  });
  it('Promise prepare is consumed and rejected without allocating a plan', async () => {
    const g = workGame(),
      before = { id: getNextEntityId(), w: structuredClone(g.world5), rng: rng.getState() };
    vi.spyOn(g.extensionRuntime!, 'worldWorkCommand').mockReturnValue({
      prepare: (() => Promise.reject(new Error('injected async'))) as any
    });
    expect(prepareWorldWorkCommand(g, request(g)).outcome).toEqual({
      ok: false,
      code: 'C5_PROVIDER',
      field: null
    });
    await Promise.resolve();
    expect({ id: getNextEntityId(), w: structuredClone(g.world5), rng: rng.getState() }).toEqual(
      before
    );
  });
  it('confirmation reprepare rejects a changed inventory with zero further cost', () => {
    const g = workGame();
    g.executeCommand('ext:command', JSON.stringify(request(g, 2)));
    expect(g.pendingCommandConfirmation).not.toBeNull();
    g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'craftskel.fiber')!
      .quantity--;
    const before = { id: getNextEntityId(), w: structuredClone(g.world5), rng: rng.getState() };
    g.resolveCommandDecision(g.pendingCommandConfirmation!.token, true);
    expect(worldWorkLastError(g)).toBe('C5_STALE');
    expect({ id: getNextEntityId(), w: structuredClone(g.world5), rng: rng.getState() }).toEqual(
      before
    );
  });
  it('real escrow assembly failure restores the original objects and allocation state', () => {
    const g = workGame(),
      p = prepareWorldWorkCommand(g, request(g, 2));
    if (!p.outcome.ok) throw new Error(p.outcome.code);
    const h = p.outcome.value,
      roots = {
        bag: g.player.inventory,
        world: g.world5,
        clock: g.actorActions,
        escrow: g.worldContainerItems,
        details: g.worldWorkDetails,
        facts: g.worldWorkFacts
      },
      audit = auditFullObjectGraph(roots),
      before = {
        id: getNextEntityId(),
        state: g.extensionRuntime!.snapshot(),
        rng: rng.getState()
      };
    vi.spyOn(assemblers, 'assembleWorldItem').mockImplementationOnce(() => {
      throw new Error('escrow injection');
    });
    withWorldActorScope(g, 'craftskel', g.player.id, 'trusted-world', (scope) =>
      expect(commitWorldWork(g, h, scope).ok).toBe(false)
    );
    expect(audit.differences()).toEqual([]);
    expect({
      id: getNextEntityId(),
      state: g.extensionRuntime!.snapshot(),
      rng: rng.getState()
    }).toEqual(before);
  });
  it.each(['throw', 'promise'])('startup participant %s restores every owner graph', (kind) => {
    let fail = false;
    const g = workGame({
      participant: () => {
        if (fail) {
          if (kind === 'promise') return Promise.resolve();
          throw new Error('startup');
        }
      }
    });
    g.world5!.startupGrants = [];
    fail = true;
    const roots = {
        bag: g.player.inventory,
        world: g.world5,
        clock: g.actorActions,
        escrow: g.worldContainerItems,
        facts: g.worldWorkFacts
      },
      audit = auditFullObjectGraph(roots),
      before = getNextEntityId();
    expect(() => transactWorldWork(g, () => grantStartupItems(g, 'craftskel'))).toThrow(
      'C5_PROVIDER'
    );
    expect(audit.differences()).toEqual([]);
    expect(getNextEntityId()).toBe(before);
  });
});

it.each(['throw', 'promise'])(
  'station accept participant %s restores every publication',
  (failure) => {
    let enabled = false;
    const g = workGame({
      fixed: false,
      participant: (f) => {
        if (enabled && f.operation === 'place-station') {
          if (failure === 'promise') return Promise.resolve();
          throw new Error('place');
        }
      }
    });
    const { value: context } = readWorkContext(g, 'craftskel', { kind: 'inventory' }) as any;
    const at = [-1, 0, 1]
      .flatMap((dy) => [-1, 0, 1].map((dx) => ({ x: g.player.x + dx, y: g.player.y + dy })))
      .find((p) => publication.clearWorldCell(g, p))!;
    expect(at).toBeDefined();
    const p = prepareWorldWorkCommand(g, {
      module: 'craftskel',
      action: 'place-station',
      payload: {
        v: 1,
        definitionId: 'craftskel.table',
        x: at.x,
        y: at.y,
        inventoryStamp: context.inventoryStamp
      }
    });
    if (!p.outcome.ok) throw new Error(p.outcome.code);
    const handle = p.outcome.value,
      graph = auditFullObjectGraph({
        bag: g.player.inventory,
        w: g.world5,
        root: g.actorActions,
        items: g.worldContainerItems,
        facts: g.worldWorkFacts,
        details: g.worldWorkDetails
      }),
      before = getNextEntityId();
    enabled = true;
    withWorldActorScope(g, 'craftskel', g.player.id, 'trusted-world', (s) =>
      expect(commitWorldWork(g, handle, s)).toMatchObject({ ok: false, code: 'C5_PROVIDER' })
    );
    expect(graph.differences()).toEqual([]);
    expect(getNextEntityId()).toBe(before);
  }
);
it('one recipe amount can exceed maxStack and is split into native output rows', () => {
  const g = workGame({ pack: (p) => (p.recipes[0].outputs[0].count = 2) }),
    before = g.player.inventory.items.filter((i) => i.identityId === 'dagger').length;
  g.executeCommand('ext:command', JSON.stringify(request(g, 1)));
  expect(g.world5!.terminalTickets[0]!.status).toBe('completed');
  expect(g.player.inventory.items.filter((i) => i.identityId === 'dagger')).toHaveLength(
    before + 2
  );
});
