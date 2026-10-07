import { describe, it, expect } from 'vitest';
import { setup, establish, current, build, base, stairs, travelScenes } from './helpers';
import { ItemCategory } from '../../../../engine/Items/Item';
import { structureReadSDK } from '../../../../engine/Core/StructureProduction';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
describe('settlement traversal/persistence public commands', () => {
  it.each([1, 5])('D%i full public operation/save/replay/seek/continue chain', (depth) => {
    const { h, g } = setup(['settlement'], depth);
    const foodBefore = g.player.inventory.items
      .filter((i) => i.category === ItemCategory.FOOD)
      .reduce((n, i) => n + i.quantity, 0);
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    expect(h.ext('settlement', 'build', build(g, 'chest')).error).toBeNull();
    const point = h.save(),
      digest = h.digest(),
      cursor = g.recordedInputEvents.length;
    const continuation = () => {
      const part = g.world5!.structures.find((r) => r.fixture)!.fixture!;
      expect(
        h.ext('settlement', 'dismantle', {
          ...base(g),
          componentId: part.id,
          componentRevision: part.revision
        }).error
      ).toBeNull();
      const c = current(g);
      expect(
        h.ext('settlement', 'retire', { ...base(g), regionId: c.regionId, regionRevision: 0 }).error
      ).toBeNull();
    };
    continuation();
    const recording = h.exportRecording(),
      final = h.digest();
    expect(
      g.player.inventory.items
        .filter((i) => i.category === ItemCategory.FOOD)
        .reduce((n, i) => n + i.quantity, 0)
    ).toBe(foodBefore);
    h.load(point);
    expect(h.digest()).toBe(digest);
    continuation();
    expect(h.digest()).toBe(final);
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(final);
    h.seek(recording, cursor);
    expect(h.digest()).toBe(digest);
    h.load(h.save());
    continuation();
    const continued = h.exportRecording();
    expect(h.digest()).toBe(final);
    expect(h.replay(continued)).toEqual({ ok: true, firstMismatch: null });
  });
  it('walks genuine stair commands, preserves the cached camp/food, and never settles remote views', () => {
    travelScenes();
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    expect(h.ext('settlement', 'build', build(g, 'bed')).error).toBeNull();
    const oldGrid = g.grid,
      lock = current(g).locked,
      part = g.world5!.structures[0]!.fixture;
    const food = g.player.inventory.items
      .filter((i) => i.category === ItemCategory.FOOD)
      .reduce((n, i) => n + i.quantity, 0);
    const grants = structuredClone(g.world5!.startupGrants);
    stairs(h, g, true);
    expect(g.depth).toBe(2);
    expect(
      g.player.inventory.items
        .filter((i) => i.category === ItemCategory.FOOD)
        .reduce((n, i) => n + i.quantity, 0)
    ).toBe(food);
    expect(g.world5!.startupGrants).toEqual(grants);
    expect(g.levels.get(1)!.grid).toBe(oldGrid);
    const ledger = structuredClone(g.world5!.offline),
      tick = g.world5!.simulationTicks,
      random = rng.getState(),
      id = getNextEntityId();
    const view = structureReadSDK(g, 'settlement').read() as any;
    expect(view.camps[0].remote).toBe(true);
    for (let i = 0; i < 10; i++) structureReadSDK(g, 'settlement').read();
    expect(g.world5!.offline).toEqual(ledger);
    expect(g.world5!.simulationTicks).toBe(tick);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
    const saved = h.save(),
      point = h.digest();
    stairs(h, g, false);
    expect(g.depth).toBe(1);
    expect(g.grid).toBe(oldGrid);
    expect(current(g).locked).toEqual(lock);
    expect(g.world5!.structures[0]!.fixture).toBe(part);
    const final = h.digest(),
      recording = h.exportRecording();
    h.load(saved);
    expect(h.digest()).toBe(point);
    stairs(h, g, false);
    expect(h.digest()).toBe(final);
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(final);
  });
  it('uses minimum empty slot and retains its creation high-water on rebuilding', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    const c = current(g);
    expect(c.slot).toBe(0);
    expect(c.ordinal).toBe(1);
    expect(
      h.ext('settlement', 'retire', { ...base(g), regionId: c.regionId, regionRevision: 0 }).error
    ).toBeNull();
    expect(g.world5!.campSlotOrdinals![0]).toBe(1);
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    expect(current(g)).toMatchObject({ slot: 0, ordinal: 2 });
  });
  it('native bed rest progresses hunger/clock and can stop without replenishing HP', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    expect(h.ext('settlement', 'build', build(g)).error).toBeNull();
    const r = g.world5!.restPoints[0]!,
      nutrition = g.player.nutrition,
      tick = g.world5!.simulationTicks;
    g.player.hp = g.player.maxHp - 5;
    const { inventoryStamp: _, ...b } = base(g);
    expect(
      h.ext('settlement', 'rest', {
        ...b,
        restPointId: r.interactableId,
        restPointRevision: r.revision
      }).error
    ).toBeNull();
    expect(g.player.hp).toBe(g.player.maxHp - 5);
    for (let i = 0; i < 5 && g.isAutoTraveling(); i++) h.command('auto_step');
    expect(g.player.nutrition).toBeLessThan(nutrition);
    expect(g.world5!.simulationTicks).toBeGreaterThan(tick);
    h.command('escape');
    expect(g.isAutoTraveling()).toBe(false);
  });
  it.each([
    { modules: ['settlement'] },
    { modules: ['settlement', 'crafting'] },
    { modules: ['settlement', 'combat'] },
    { modules: ['settlement', 'giants'] }
  ])('plays paid camp and persists %j', ({ modules }) => {
    const { h, g } = setup(modules);
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    expect(h.ext('settlement', 'build', build(g, 'wood-floor')).error).toBeNull();
    const saved = h.save(),
      digest = h.digest();
    h.load(saved);
    expect(h.digest()).toBe(digest);
    const recording = h.exportRecording();
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(digest);
  });
  it('no settlement installs no production definitions or camp UI state', () => {
    const { g } = setup(['crafting']);
    expect(g.extensionRuntime!.worldCampOwners()).toEqual([]);
    expect(
      g
        .extensionRuntime!.worldDefinitionPacks()
        .flatMap((p) => p.items)
        .some((d) => d.owner === 'settlement')
    ).toBe(false);
    expect(g.extensionRuntime!.readModuleView('settlement')).toBeNull();
  });
});
