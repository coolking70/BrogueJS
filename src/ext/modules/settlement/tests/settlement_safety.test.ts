import { it, expect, vi } from 'vitest';
import { setup, establish, current, build, base } from './helpers';
import { TerrainType } from '../../../../engine/Map/Grid';
import { Item, ItemCategory } from '../../../../engine/Items/Item';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { getNextEntityId } from '../../../../entities/Creature';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { structureReadSDK } from '../../../../engine/Core/StructureProduction';
it('accepts ration and mango as separate real FOOD entities and returns both identities', () => {
  const { h, g } = setup();
  const food = g.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)!;
  food.quantity = 1;
  const mango = new Item('mango', '%', 0xffffff, ItemCategory.FOOD);
  mango.consumableId = 'mango';
  g.player.inventory.addItem(mango);
  const p = establish(g);
  p.food = [
    { itemId: food.id, quantity: 1 },
    { itemId: mango.id, quantity: 1 }
  ];
  expect(h.ext('settlement', 'establish', p).error).toBeNull();
  const c = current(g);
  expect(containerItems(g, c.supplyId)).toEqual([food, mango]);
  expect(c.locked.map((r) => r.itemId)).toEqual([food.id, mango.id]);
  expect(
    h.ext('settlement', 'retire', { ...base(g), regionId: c.regionId, regionRevision: 0 }).error
  ).toBeNull();
  expect(g.player.inventory.items).toContain(food);
  expect(g.player.inventory.items).toContain(mango);
});
it.each([
  TerrainType.LAVA,
  TerrainType.WATER_DEEP,
  TerrainType.CHASM,
  TerrainType.PLAIN_FIRE,
  TerrainType.POISON_GAS,
  TerrainType.PARALYSIS_GAS
])('rejects dangerous build terrain %s before payment or IDs', (terrain) => {
  const { h, g } = setup();
  expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  const p = build(g, 'wood-floor');
  g.grid.setTerrain(p.x, p.y, terrain);
  g.grid.getCell(p.x, p.y)!.isVisible = true;
  const tick = g.world5!.simulationTicks,
    id = getNextEntityId(),
    random = rng.getState(),
    items = structuredClone(g.player.inventory.items);
  expect(h.ext('settlement', 'build', p).error).not.toBeNull();
  expect(g.world5!.simulationTicks).toBe(tick);
  expect(getNextEntityId()).toBe(id);
  expect(rng.getState()).toEqual(random);
  expect(g.player.inventory.items).toEqual(items);
});
it('duplicate confirmation tokens and expired plans cannot build twice', () => {
  const { g } = setup();
  g.onCommandConfirmRequest = () => {};
  g.executeCommand(
    'ext:command',
    JSON.stringify({ module: 'settlement', action: 'establish', payload: establish(g) })
  );
  const pending = g.pendingCommandConfirmation!;
  expect(pending).not.toBeNull();
  expect(g.resolveCommandDecision(pending.token, true)).toBe(true);
  const tick = g.world5!.simulationTicks,
    id = getNextEntityId();
  expect(g.resolveCommandDecision(pending.token, true)).toBe(false);
  expect(g.world5!.simulationTicks).toBe(tick);
  expect(getNextEntityId()).toBe(id);
  expect(g.extensionRuntime!.worldCampState('settlement').camps).toHaveLength(1);
});
it('entry failure restores the complete module/camp/inventory/object graph and ID/RNG owners', () => {
  const { h, g } = setup();
  expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  const runtime = g.extensionRuntime!,
    native = runtime.emit.bind(runtime);
  vi.spyOn(runtime, 'emit').mockImplementation((name, event) => {
    native(name, event);
    if (name === 'enteredLevel') throw new Error('entry-publish');
  });
  // Invoke the same generation boundary inside a real recorded command. The
  // single target-depth input is the only intentional state difference.
  g.executeCommand('escape', undefined, () => {
    const before = auditFullObjectGraph({ g, logger }),
      random = rng.getState(),
      id = getNextEntityId();
    g.depth = 2;
    expect(() => (g as unknown as { generateDepth(): void }).generateDepth()).toThrow(
      'entry-publish'
    );
    expect(before.differences()).toEqual([]);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
  });
  expect(g.depth).toBe(1);
  expect(() => h.save()).not.toThrow();
});
it('remote reserves are not returned by component/door/dismantle commands, including terminal state', () => {
  const { h, g } = setup();
  expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  const c = current(g),
    tick = g.world5!.simulationTicks;
  expect(
    h.ext('settlement', 'dismantle', { ...base(g), componentId: c.markerId, componentRevision: 0 })
      .error
  ).toBe('C5_UNKNOWN_TARGET');
  expect(current(g).locked).toEqual(c.locked);
  g.player.hp = 0;
  const view = structureReadSDK(g, 'settlement').read() as any;
  expect(view.available).toBe(false);
  expect(
    h.ext('settlement', 'transfer', {
      ...base(g),
      containerId: c.supplyId,
      containerRevision: 0,
      direction: 'withdraw',
      items: [{ itemId: c.locked[0]!.itemId, quantity: 1 }]
    }).error
  ).toBe('C5_DEAD');
  expect(g.world5!.simulationTicks).toBe(tick);
});
