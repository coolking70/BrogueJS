import { describe, it, expect, vi } from 'vitest';
import type { Json } from '../../../types';
import { setup, establish, current, build, base } from './helpers';
import { assertSettlementPack } from '../schema';
import { loadSettlementPack } from '../definitions';
import { initialState, validateState } from '../state';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { logger } from '../../../../engine/Systems/Logger';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import {
  prepareStructureCommand,
  commitStructureCommand,
  structureReadSDK
} from '../../../../engine/Core/StructureProduction';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { ItemCategory, Item } from '../../../../engine/Items/Item';
const mechanically = (g: ReturnType<typeof setup>['g']) => ({
  world: structuredClone(g.world5),
  state: g.extensionRuntime!.snapshot(),
  items: structuredClone(g.player.inventory.items),
  rng: rng.getState(),
  id: getNextEntityId()
});
describe('settlement strict package/input/state and rollback', () => {
  it('rejects unknown keys recursively, non-JSON, unsafe ints and missing references', () => {
    const input = loadSettlementPack();
    const paths: (string | number)[][] = [
      [],
      ['camp'],
      ['world'],
      ['world', 'items', 0],
      ['world', 'structures', 0],
      ['world', 'restPoints', 0],
      ['world', 'resourceNodes', 0],
      ['world', 'resourceNodes', 0, 'placement', 'dungeon']
    ];
    for (const path of paths) {
      const p = structuredClone(input);
      let row: any = p;
      for (const k of path) row = row[k];
      row.unapproved = 1;
      expect(() => assertSettlementPack(p)).toThrow();
    }
    for (const value of [1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const p = structuredClone(input);
      p.world.items[0]!.maxStack = value;
      expect(() => assertSettlementPack(p)).toThrow();
    }
    const p = structuredClone(input);
    (p.world.structures![0]!.constructionCost as any[])[0] = {
      itemDefinitionId: 'settlement.missing',
      count: 1
    };
    expect(() => assertSettlementPack(p)).toThrow();
    const badCamp = structuredClone(input);
    badCamp.camp.nameKey = 'ext.settlement.missing';
    expect(() => assertSettlementPack(badCamp)).toThrow();
    expect(validateState({ ...initialState(), unknown: 1 })).toBe(false);
    expect(validateState({ ...initialState(), revision: 1.5 })).toBe(false);
    expect(validateState({ ...initialState(), camps: [{ actorId: 1 }] })).toBe(false);
    const malicious: any = { ...input };
    Object.defineProperty(malicious, 'world', {
      enumerable: true,
      get() {
        throw new Error('getter invoked');
      }
    });
    expect(() => assertSettlementPack(malicious)).toThrow();
  });
  it.each(['unknown', 'fraction', 'unsafe', 'food', 'material', 'threat', 'dead'])(
    'rejects %s with no mechanical cost',
    (kind) => {
      const { h, g } = setup();
      const p: any = establish(g);
      let expected = 'C5_BAD_PAYLOAD';
      if (kind === 'unknown') p.actorId = g.player.id;
      if (kind === 'fraction') p.stateRevision = 0.5;
      if (kind === 'unsafe') p.stateRevision = Number.MAX_SAFE_INTEGER + 1;
      if (kind === 'food') {
        p.food[0].quantity = 1;
        expected = 'C5_INPUT';
      }
      if (kind === 'material') {
        p.materials[0].itemDefinitionId = 'settlement.fiber';
        expected = 'C5_INPUT';
      }
      if (kind === 'threat') {
        g.monsters[0]!.loc = { x: 23, y: 12 };
        expected = 'C5_THREAT';
      }
      if (kind === 'dead') {
        g.player.hp = 0;
        expected = 'C5_DEAD';
      }
      const before = mechanically(g);
      expect(h.ext('settlement', 'establish', p)).toMatchObject({ error: expected });
      expect(mechanically(g)).toEqual(before);
    }
  );
  it.each(['marker', 'state', 'clock'])(
    'rolls back complete graph after %s publication fault',
    (kind) => {
      const { g } = setup();
      const payload = establish(g);
      const runtime = g.extensionRuntime!;
      let audit: ReturnType<typeof auditFullObjectGraph> | undefined;
      let id = 0,
        random: any;
      g.executeCommand(
        'ext:command',
        JSON.stringify({ module: 'settlement', action: 'establish', payload }),
        () => {
          const plan = prepareStructureCommand(
            g,
            JSON.stringify({ module: 'settlement', action: 'establish', payload })
          );
          expect(plan.ok).toBe(true);
          if (!plan.ok) return;
          if (kind === 'marker') {
            const original = runtime.worldWorkPlace.bind(runtime);
            vi.spyOn(runtime, 'worldWorkPlace').mockImplementation((v) => {
              const out = original(v);
              throw Object.assign(new Error('after-marker'), { out });
            });
          }
          if (kind === 'state') {
            const original = runtime.worldCampReplace.bind(runtime);
            vi.spyOn(runtime, 'worldCampReplace').mockImplementation((o, s) => {
              original(o, s);
              throw new Error('after-state');
            });
          }
          if (kind === 'clock') {
            g.player.ticksUntilTurn = -1;
          } // checked integer clock refuses after world/state publish
          audit = auditFullObjectGraph({ g, logger });
          id = getNextEntityId();
          random = rng.getState();
          expect(commitStructureCommand(g, plan.value)).toMatchObject({ ok: false });
          expect(audit.differences()).toEqual([]);
          expect(getNextEntityId()).toBe(id);
          expect(rng.getState()).toEqual(random);
        }
      );
    }
  );
  it('extra food merges into actual locked entity; only the unlocked suffix is withdrawable', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    const c = current(g),
      locked = containerItems(g, c.supplyId)[0]!,
      food = g.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)!;
    const box = () => g.world5!.containers.find((b) => b.id === c.supplyId)!;
    expect(
      h.ext('settlement', 'transfer', {
        ...base(g),
        containerId: c.supplyId,
        containerRevision: box().revision,
        direction: 'deposit',
        items: [{ itemId: food.id, quantity: 1 }]
      }).error
    ).toBeNull();
    expect(containerItems(g, c.supplyId)[0]).toBe(locked);
    expect(locked.quantity).toBe(3);
    expect(
      h.ext('settlement', 'transfer', {
        ...base(g),
        containerId: c.supplyId,
        containerRevision: box().revision,
        direction: 'withdraw',
        items: [{ itemId: locked.id, quantity: 1 }]
      }).error
    ).toBeNull();
    expect(locked.quantity).toBe(2);
    const before = mechanically(g);
    expect(
      h.ext('settlement', 'transfer', {
        ...base(g),
        containerId: c.supplyId,
        containerRevision: box().revision,
        direction: 'withdraw',
        items: [{ itemId: locked.id, quantity: 1 }]
      }).error
    ).toBe('C5_RESERVED');
    expect(mechanically(g)).toEqual(before);
  });
  it('rejects corrupted lock/region/identity references before replacing a live run', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    const save = JSON.parse(h.save()),
      digest = h.digest();
    for (const mutate of [
      (s: any) => s.extensions.modules.settlement.camps[0].locked[0].itemId++,
      (s: any) => s.extensions.modules.settlement.camps[0].supplyId++,
      (s: any) => s.extensions.modules.settlement.camps[0].ordinal++,
      (s: any) => (s.extensions.modules.settlement.camps[0].depth = 2),
      (s: any) => (s.extensions.modules.settlement.camps[0].locked = []),
      (s: any) => (s.extensions.modules.settlement.camps[0].locked[0].quantity = 1)
    ]) {
      const copy = structuredClone(save);
      mutate(copy);
      expect(g.loadSnapshot(copy)).toBe(false);
      expect(h.digest()).toBe(digest);
    }
  });
  it('full backpack refuses camp removal, retaining every real supply Item', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    while (g.player.inventory.packCount() < g.player.inventory.capacity)
      g.player.inventory.addItem(new Item('test', ')', 0xaaaaaa, ItemCategory.WEAPON));
    const c = current(g),
      before = mechanically(g);
    expect(
      h.ext('settlement', 'retire', { ...base(g), regionId: c.regionId, regionRevision: 0 }).error
    ).toBe('C5_CAPACITY');
    expect(mechanically(g)).toEqual(before);
  });
  it('rejects deleted or inflated construction payment receipts on load', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    expect(h.ext('settlement', 'build', build(g))).toMatchObject({ error: null });
    const save = JSON.parse(h.save()),
      digest = h.digest();
    for (const mutate of [
      (s: any) => (s.extensions.modules.settlement.constructions = []),
      (s: any) => (s.extensions.modules.settlement.constructions[0].materials[0].count = 99)
    ]) {
      const copy = structuredClone(save);
      mutate(copy);
      expect(g.loadSnapshot(copy)).toBe(false);
      expect(h.digest()).toBe(digest);
    }
  });
  it('hides current unseen box contents and retains only the last observed camp report', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    const c = current(g),
      known = structureReadSDK(g, 'settlement').read() as any;
    const e = g.extensionRuntime!.worldWorkEntities().find((e) => e.id === c.markerId)!;
    g.grid.getCell(e.x, e.y)!.isVisible = false;
    containerItems(g, c.supplyId)[0]!.quantity = 3;
    const hidden = structureReadSDK(g, 'settlement').read() as any;
    expect(hidden.boxes.some((b: any) => b.id === c.supplyId)).toBe(false);
    expect(hidden.camps[0].reportItems).toEqual(known.camps[0].reportItems);
  });
  it('read-only local and remote projections do not consume time, IDs or RNG', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    const before = mechanically(g);
    for (let i = 0; i < 10; i++) structureReadSDK(g, 'settlement').read();
    expect(
      g.extensionRuntime!.queryOptional('settlement.resident-status.v1', { actorId: g.player.id })
    ).toMatchObject({ status: 'available', value: { resident: false } });
    const invalidInputs: Json[] = [
      { actorId: 0 },
      { actorId: 1.5 },
      { actorId: g.player.id, unknown: true }
    ];
    for (const input of invalidInputs)
      expect(g.extensionRuntime!.queryOptional('settlement.resident-status.v1', input)).toEqual({
        status: 'unavailable',
        reason: 'unsupported-input'
      });
    expect(mechanically(g)).toEqual(before);
  });
  it('single-level duplicate camp and stale build revisions are refused', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    const p = establish(g);
    p.x = 20;
    p.y = 13;
    expect(h.ext('settlement', 'establish', p).error).toBe('C5_OVERLAP');
    const b = build(g);
    b.regionRevision = 3;
    expect(h.ext('settlement', 'build', b).error).toBe('C5_STALE');
  });
});
