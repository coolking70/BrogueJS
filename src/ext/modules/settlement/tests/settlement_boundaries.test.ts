import { describe, it, expect } from 'vitest';
import { setup, establish, current, base, build, travelScenes, stairs, walk } from './helpers';
import { TerrainType } from '../../../../engine/Map/Grid';
import { bindGenerationReservation } from '../../../../engine/Generator/GenerationReservation';
import { containerItems, itemDefinition } from '../../../../engine/Core/WorldWorkWorld';
import { commitStructureWorld, planStructureChange } from '../../../../engine/Map/StructureWorld';
import { withWorldActorScope } from '../../../../engine/Core/WorldWork';
import { Item, ItemCategory } from '../../../../engine/Items/Item';
import { assembleWorldItem } from '../../../../engine/Items/WorldItems';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { descriptor } from '../descriptor';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
describe('settlement limits and structures', () => {
  it.each(Array.from({ length: 40 }, (_, i) => i + 1))(
    'D%i permits a legal region and rejects its native protected stair',
    (depth) => {
      const { h, g } = setup(['settlement'], depth);
      const p = establish(g);
      expect(h.ext('settlement', 'establish', p).error).toBeNull();
      g.player.loc = { x: 3, y: 2 };
      g.grid.getCell(2, 2)!.isVisible = true;
      // Region containment denies distant stairs; a protected marker location is rejected before payment.
      const q = establish(g);
      q.x = 2;
      q.y = 2;
      expect(h.ext('settlement', 'establish', q).error).toBe('C5_PROTECTED');
      expect(g.world5!.structures).toHaveLength(0);
    }
  );
  it.each(['stairs', 'machine', 'reservation', 'unknown', 'edge'])(
    'refuses %s region candidates without allocations',
    (kind) => {
      const { h, g } = setup();
      const p = establish(g),
        tick = g.world5!.simulationTicks,
        id = getNextEntityId(),
        random = rng.getState();
      if (kind === 'stairs') g.grid.setTerrain(p.x, p.y, TerrainType.STAIRS_UP);
      if (kind === 'machine') g.grid.getCell(p.x, p.y)!.machineNumber = 1;
      if (kind === 'reservation')
        bindGenerationReservation(g.grid, new Set([9 * g.grid.width + 18]));
      if (kind === 'unknown') g.grid.getCell(p.x, p.y)!.isVisible = false;
      if (kind === 'edge') p.bounds.x = 74;
      expect(h.ext('settlement', 'establish', p).error).not.toBeNull();
      expect(g.world5!.simulationTicks).toBe(tick);
      expect(getNextEntityId()).toBe(id);
      expect(rng.getState()).toEqual(random);
    }
  );
  it('enforces eight global camps, one per level and least free slots', () => {
    travelScenes();
    const { h, g } = setup(['settlement'], 1, 18);
    for (let d = 1; d <= 8; d++) {
      if (d > 1) {
        stairs(h, g, true);
        walk(h, g, { x: 20, y: 12 });
      }
      expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
      expect(current(g).slot).toBe(0);
      expect(
        g.extensionRuntime!.worldCampState('settlement').camps.find((c) => c.depth === d)!.slot
      ).toBe(d - 1);
    }
    stairs(h, g, true);
    walk(h, g, { x: 20, y: 12 });
    const tick = g.world5!.simulationTicks;
    expect(h.ext('settlement', 'establish', establish(g)).error).toBe('C5_BUDGET');
    expect(g.world5!.simulationTicks).toBe(tick);
  });
  it('expands bounds in place, and refuses over-maximum or shrinking bounds', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    const c = current(g),
      r = g.extensionRuntime!.worldStructureRegions()[0]!;
    const p = {
      ...base(g),
      regionId: c.regionId,
      regionRevision: r.revision,
      sourceContainerId: null,
      sourceRevision: null,
      materials: [
        { itemDefinitionId: 'settlement.wood', count: 2 },
        { itemDefinitionId: 'settlement.stone', count: 2 }
      ],
      bounds: { ...r.bounds, width: 10 }
    };
    expect(h.ext('settlement', 'expand', p).error).toBeNull();
    expect(g.extensionRuntime!.worldStructureRegions()[0]).toMatchObject({
      id: r.id,
      revision: 1,
      bounds: { width: 10 }
    });
    expect(
      h.ext('settlement', 'expand', {
        ...p,
        ...base(g),
        regionRevision: 1,
        bounds: { ...p.bounds, width: 25 }
      }).error
    ).not.toBeNull();
    expect(
      h.ext('settlement', 'expand', {
        ...p,
        ...base(g),
        regionRevision: 1,
        bounds: { ...p.bounds, width: 9 }
      }).error
    ).not.toBeNull();
  });
  it('keeps native equipment identity/curse/enchant/identification through real storage', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    expect(h.ext('settlement', 'build', build(g, 'chest')).error).toBeNull();
    const c = g.world5!.containers.find((c) => c.kind === 'chest' && c.id !== current(g).supplyId)!;
    const item = new Item('test-long-equipment', ')', 0xffffff, ItemCategory.WEAPON);
    item.enchantment = 7;
    item.isCursed = true;
    item.identified = true;
    g.player.inventory.addItem(item);
    const id = item.id;
    expect(
      h.ext('settlement', 'transfer', {
        ...base(g),
        containerId: c.id,
        containerRevision: c.revision,
        direction: 'deposit',
        items: [{ itemId: id, quantity: 1 }]
      }).error
    ).toBeNull();
    expect(containerItems(g, c.id)).toContain(item);
    expect(item).toMatchObject({ id, enchantment: 7, isCursed: true, isIdentified: true });
    expect(
      h.ext('settlement', 'transfer', {
        ...base(g),
        containerId: c.id,
        containerRevision: c.revision,
        direction: 'withdraw',
        items: [{ itemId: id, quantity: 1 }]
      }).error
    ).toBeNull();
    expect(g.player.inventory.items).toContain(item);
  });
  it('destruction preserves contents in native drops/remains, and cannot destroy or unlock the supply marker', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    expect(h.ext('settlement', 'build', build(g, 'chest')).error).toBeNull();
    const row = g.world5!.structures[0]!,
      component = row.fixture!,
      box = g.world5!.containers.find((c) => c.kind === 'chest' && c.id !== current(g).supplyId)!;
    const i = assembleWorldItem(itemDefinition(g, 'settlement.wood'), 4);
    g.player.inventory.addItem(i);
    const stored = g.player.inventory.items.find(
      (i) => i.worldItem?.definitionId === 'settlement.wood'
    )!;
    expect(
      h.ext('settlement', 'transfer', {
        ...base(g),
        containerId: box.id,
        containerRevision: box.revision,
        direction: 'deposit',
        items: [{ itemId: stored.id, quantity: 4 }]
      }).error
    ).toBeNull();
    const moved = containerItems(g, box.id)[0]!;
    g.executeCommand('escape', undefined, () =>
      withWorldActorScope(g, 'settlement', g.player.id, 'player-command', (scope) => {
        const p = planStructureChange(
          {
            kind: 'damage',
            componentId: component.id,
            revision: component.revision,
            amount: 1000,
            damageKind: 'physical'
          },
          scope
        );
        expect(p.ok).toBe(true);
        if (p.ok) expect(commitStructureWorld(g, p.value, scope).ok).toBe(true);
      })
    );
    expect(
      g.items.includes(moved) ||
        g
          .world5!.containers.filter((c) => c.kind === 'remains')
          .some((c) => c.itemIds.includes(moved.id))
    ).toBe(true);
    expect(current(g).locked).toHaveLength(1);
    expect(g.world5!.containers.some((c) => c.id === current(g).supplyId)).toBe(true);
    expect(() => h.save()).not.toThrow();
  });
  it('production catalog is disabled by default and startup/three reachable nodes are real once-only grants', () => {
    expect(descriptor.defaultEnabled).toBe(false);
    const h = createWorldHarness({ seed: 51020001, modules: ['settlement'] });
    const g = worldHarnessGame(h);
    try {
      expect(g.extensionRuntime!.isWorldStructureFixture('settlement')).toBe(false);
      expect(g.world5!.nodes.filter((n) => n.owner === 'settlement')).toHaveLength(3);
      expect(
        Object.fromEntries(
          g.player.inventory.items
            .filter((i) => i.worldItem)
            .map((i) => [i.worldItem!.definitionId, i.quantity])
        )
      ).toEqual({ 'settlement.wood': 12, 'settlement.stone': 8, 'settlement.fiber': 6, 'settlement.seed': 6 });
      const receipts = structuredClone(g.world5!.startupGrants);
      h.load(h.save());
      expect(g.world5!.startupGrants).toEqual(receipts);
      expect(
        g.player.inventory.items
          .filter((i) => i.category === ItemCategory.FOOD)
          .reduce((n, i) => n + i.quantity, 0)
      ).toBe(1);
    } finally {
      h.dispose();
    }
  });
});
