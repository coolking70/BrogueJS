import { describe, it, expect, vi } from 'vitest';
import { forage, grant, read, history, closedLoop } from './support/forageFixture';
import {
  drainFireContacts,
  queueFireContact,
  fireContactPending,
  igniteEdibleInventory
} from '../engine/Core/FireContact';
import { descriptor } from '../ext/testing/fixtures/forageFixture';
import { rng } from '../engine/Random';
import { DF } from '../engine/Map/DungeonFeatureCatalog';
import { heatSources } from '../engine/Core/EdibleCommands';
describe('fire contact foundation', () => {
  it('floor transform same identity, cooldown 9/10/11 and full chain', () => {
    const h = forage(),
      g = h.game(),
      i = grant(h, 'raw', 2, true);
    h.fixture({ kind: 'fire', itemId: i.id });
    expect(i.worldItem!.definitionId).toBe('fgfixture.roasted');
    expect(i.quantity).toBe(2);
    expect(i.fireContactCooldownUntilTurn).toBe(g.absoluteTurnNumber + 10);
    const start = g.absoluteTurnNumber;
    for (const delta of [9, 10, 11]) {
      g.absoluteTurnNumber = start + delta;
      queueFireContact(g, i, 'spawn-fire');
      drainFireContacts(g);
      expect(i.worldItem!.definitionId).toBe(
        delta === 9 ? 'fgfixture.roasted' : 'fgfixture.charred'
      );
    }
    g.absoluteTurnNumber = start + 20;
    queueFireContact(g, i, 'thrown');
    drainFireContacts(g);
    expect(g.items).not.toContain(i);
    expect(fireContactPending(g)).toBe(false);
  });
  it.each(['spawn-fire', 'floor-burning', 'thrown', 'heat-source-throw', 'lava'] as const)(
    '%s once per drain and cooldown shared',
    (cause) => {
      const h = forage(),
        g = h.game(),
        i = grant(h, 'raw', 1, true);
      queueFireContact(g, i, cause);
      queueFireContact(g, i, cause);
      drainFireContacts(g);
      expect(history(h).filter((f) => f.itemId === i.id)).toHaveLength(1);
      expect(g.items.includes(i)).toBe(cause !== 'lava');
    }
  );
  it('fire DF callback uses outer drain; scroll coexistence and save replay', () => {
    const h = forage(),
      i = grant(h, 'raw', 1, true);
    h.fixture({ kind: 'scroll', at: { x: 12, y: 10 } });
    const scroll = h.game().items.find((i) => i.category === 3)!;
    expect(scroll).toBeDefined();
    h.fixture({ kind: 'df', df: DF.DF_PLAIN_FIRE, at: { x: i.x, y: i.y } });
    expect(history(h).filter((f) => f.itemId === i.id)).toHaveLength(1);
    expect(fireContactPending(h.game())).toBe(false);
    h.fixture({ kind: 'df', df: DF.DF_PLAIN_FIRE, at: { x: scroll.x, y: scroll.y } });
    expect(h.game().items).not.toContain(scroll);
    closedLoop(h);
  });
  it.each([1, 2, 3])('quantity %i explosion chooses DF after removal', (quantity) => {
    const h = forage(),
      i = grant(h, 'sample7', quantity, true);
    h.fixture({ kind: 'fire', itemId: i.id });
    expect(h.game().items).not.toContain(i);
    const f = history(h).find((f) => f.itemId === i.id);
    expect(f.explosion).toBe(quantity < 3 ? 'explosion-fire' : 'bloat-explosion');
    closedLoop(h);
  });
  it('real crafting hearth definition authorizes roast with whole stack and no native draw', () => {
    const h = forage(['crafting']);
    const hearth = h
      .game()
      .extensionRuntime!.worldDefinitionPacks()
      .flatMap((p) => p.stations)
      .find((d) => d.stationTags.includes('station.hearth'))!;
    expect(hearth).toBeDefined();
    h.fixture({ kind: 'station', definitionId: hearth.id, at: { x: 11, y: 10 } });
    const i = grant(h, 'raw', 3),
      c = read(h),
      source = c.heatSources.find((s) => s.kind === 'hearth-station')!;
    expect(source).toBeDefined();
    const outcome = h.ext('fgfixture', 'roast', {
      itemId: i.id,
      inventoryStamp: c.inventoryStamp,
      heatSourceId: source.interactableId
    });
    expect(outcome.error).toBeNull();
    expect(i.worldItem!.definitionId).toBe('fgfixture.roasted');
    expect(i.quantity).toBe(3);
    expect('fireContactCooldownUntilTurn' in i).toBe(false);
    closedLoop(h);
  });
  it('no provider yields no sources; player ignition draws one per stack after duration', () => {
    const h = forage(),
      g = h.game();
    expect(heatSources(g)).toEqual([]);
    const draw = vi.spyOn(rng, 'randRange');
    igniteEdibleInventory(g);
    expect(draw).not.toHaveBeenCalled();
    grant(h, 'raw');
    grant(h, 'sample0');
    draw.mockReturnValue(2);
    (g as any).exposeCreatureToFire(g.player);
    expect(draw.mock.calls.filter((c) => c[0] === 1 && c[1] === 3)).toHaveLength(2);
    expect(Number((g.player.statusDurations as any).burning) > 0).toBe(true);
    draw.mockClear();
    (g as any).exposeCreatureToFire(g.player);
    expect(draw.mock.calls.filter((c) => c[0] === 1 && c[1] === 3)).toHaveLength(0);
  });
  it('time participant failure discards staged writes and keeps transformation', () => {
    const bad = {
      ...descriptor,
      create: () => {
        const m = descriptor.create();
        m.edibleParticipant!.onFireContact = (_f, tx) => {
          tx.replaceState({ history: [1] });
          tx.markKnowledge('fgfixture.raw', 'known');
          throw Error('inject');
        };
        return m;
      }
    };
    const h = forage([], [bad]),
      i = grant(h, 'raw', 1, true);
    h.fixture({ kind: 'fire', itemId: i.id });
    expect(i.worldItem!.definitionId).toBe('fgfixture.roasted');
    expect(history(h)).toEqual([]);
    expect(h.game().extensionRuntime!.snapshot().foundation.kindKnowledge).toBeUndefined();
    expect(h.game().extensionRuntime!.readEdibleDiagnostics()).toHaveLength(1);
  });
});

import { prepareEdibleCommand, commitEdibleCommand } from '../engine/Core/EdibleCommands';
import {
  auditFullObjectGraph,
  fullGenerationRoots
} from './support/fullGenerationCheckpointOracle';
import { logger } from '../engine/Systems/Logger';
import { getNextEntityId } from '../entities/Creature';
import * as features from '../engine/Map/DungeonFeature';
it.each(['transform', 'fact', 'participant', 'message', 'DF', 'render'] as const)(
  'roast failure after %s restores every independent native write and owner',
  (point) => {
    const h = forage(['crafting']),
      g = h.game(),
      runtime = g.extensionRuntime!,
      hearth = runtime
        .worldDefinitionPacks()
        .flatMap((p) => p.stations)
        .find((d) => d.stationTags.includes('station.hearth'))!;
    h.fixture({ kind: 'station', definitionId: hearth.id, at: { x: 11, y: 10 } });
    const i = grant(h, point === 'DF' || point === 'render' ? 'sample7' : 'raw', 3),
      c = read(h),
      prepared = prepareEdibleCommand(g, {
        module: 'fgfixture',
        action: 'roast',
        payload: {
          itemId: i.id,
          inventoryStamp: c.inventoryStamp,
          heatSourceId: c.heatSources[0]!.interactableId
        }
      });
    expect(prepared.outcome.ok).toBe(true);
    const target: any =
        point === 'message' ? logger : point === 'DF' ? features : point === 'render' ? g : runtime,
      method =
        point === 'message'
          ? 'log'
          : point === 'DF'
            ? 'spawnDungeonFeature'
            : point === 'render'
              ? 'requestEdibleRender'
              : point === 'participant'
                ? 'edibleParticipate'
                : 'edibleFactId';
    const original = target[method].bind(target);
    vi.spyOn(target, method).mockImplementation((...args: any[]) => {
      if (point !== 'transform') original(...args);
      throw Error('after ' + point);
    });
    const audit = auditFullObjectGraph(fullGenerationRoots(g), [runtime]),
      ext = runtime.snapshot(),
      random = rng.getState(),
      allocator = getNextEntityId(),
      messages = logger.getState();
    if (!prepared.outcome.ok) throw Error();
    expect(commitEdibleCommand(g, prepared.outcome.value)).toMatchObject({
      ok: false,
      code: 'C5_PROVIDER'
    });
    expect(audit.differences()).toEqual([]);
    expect(runtime.snapshot()).toEqual(ext);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(allocator);
    expect(logger.getState()).toEqual(messages);
    expect(g.player.inventory.items).toContain(i);
    expect(i.quantity).toBe(3);
    expect(fireContactPending(g)).toBe(false);
  }
);
it('same-cell id ordering and cross-cell FIFO eliminate chain self-contact', () => {
  const h = forage(),
    g = h.game(),
    a = grant(h, 'sample7', 3, true, { x: 11, y: 10 }),
    b = grant(h, 'raw', 1, true, { x: 12, y: 10 }),
    c = grant(h, 'raw', 1, true, { x: 12, y: 10 });
  h.fixture({ kind: 'fire', itemId: a.id });
  const facts = history(h).filter((f) => f.cause);
  expect(facts.map((f) => f.itemId).filter((id) => id === a.id)).toEqual([a.id]);
  expect(facts.filter((f) => f.itemId === b.id || f.itemId === c.id).map((f) => f.itemId)).toEqual([
    b.id,
    c.id
  ]);
  expect(fireContactPending(g)).toBe(false);
  closedLoop(h);
});
it.each(['floor-fire', 'real-hearth'] as const)(
  'real thrown stack landing into %s preserves identity/quantity and recording',
  (cause) => {
    const h = forage(cause === 'real-hearth' ? ['crafting'] : []),
      g = h.game();
    if (cause === 'real-hearth') {
      const hearth = g
        .extensionRuntime!.worldDefinitionPacks()
        .flatMap((p) => p.stations)
        .find((d) => d.stationTags.includes('station.hearth'))!;
      h.fixture({ kind: 'station', definitionId: hearth.id, at: { x: 13, y: 10 } });
    } else h.fixture({ kind: 'df', df: DF.DF_PLAIN_FIRE, at: { x: 13, y: 10 } });
    const i = grant(h, 'raw', 2);
    h.command('item:execute', 'throw|' + i.inventoryLetter);
    h.command('mouse_travel', { x: 13, y: 10 });
    expect(i.quantity).toBe(1);
    const thrown = g.items.find((item) => item.worldItem?.definitionId === 'fgfixture.roasted')!;
    expect(thrown).toBeDefined();
    expect(thrown.id).not.toBe(i.id);
    expect(thrown.quantity).toBe(1);
    expect(history(h).filter((f) => f.itemId === thrown.id && f.cause)).toHaveLength(1);
    closedLoop(h);
  }
);
