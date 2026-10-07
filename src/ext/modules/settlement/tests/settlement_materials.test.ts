import { it, expect } from 'vitest';
import { setup, establish, base, current, build, add } from './helpers';
import { itemDefinition, containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { assembleWorldItem } from '../../../../engine/Items/WorldItems';
it('accepts an explicitly selected optional bed kit without importing or converting its identity', () => {
  const { h, g } = setup(['settlement', 'crafting']);
  expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  add(g, 'crafting.kit-bed', 1);
  const p = build(g),
    wood = g.player.inventory.items.find(
      (i) => i.worldItem?.definitionId === 'settlement.wood'
    )!.quantity;
  p.materials = [{ itemDefinitionId: 'crafting.kit-bed', count: 1 }];
  expect(h.ext('settlement', 'build', p).error).toBeNull();
  expect(
    g.player.inventory.items.some((i) => i.worldItem?.definitionId === 'crafting.kit-bed')
  ).toBe(false);
  expect(
    g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'settlement.wood')!.quantity
  ).toBe(wood);
  const c = g.world5!.structures[0]!.fixture!;
  expect(
    h.ext('settlement', 'dismantle', {
      ...base(g),
      componentId: c.id,
      componentRevision: c.revision
    }).error
  ).toBeNull();
  expect(
    g.player.inventory.items.some((i) => i.worldItem?.definitionId === 'crafting.kit-bed')
  ).toBe(false);
});
it('consumes selected tagged material from one box and refunds its actual definition at remaining durability', () => {
  const { h, g } = setup(['settlement', 'crafting']);
  expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  const camp = current(g),
    box = g.world5!.containers.find((c) => c.id === camp.supplyId)!;
  const material = assembleWorldItem(itemDefinition(g, 'crafting.wood'), 8);
  g.player.inventory.addItem(material);
  const native = g.player.inventory.items.find(
    (i) => i.worldItem?.definitionId === 'crafting.wood'
  )!;
  expect(
    h.ext('settlement', 'transfer', {
      ...base(g),
      containerId: box.id,
      containerRevision: box.revision,
      direction: 'deposit',
      items: [{ itemId: native.id, quantity: 8 }]
    }).error
  ).toBeNull();
  const before = containerItems(g, box.id).find(
      (i) => i.worldItem?.definitionId === 'crafting.wood'
    )!.quantity,
    inventoryBefore =
      g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'crafting.wood')
        ?.quantity ?? 0;
  const p = build(g, 'wood-wall', { x: 20, y: 13 });
  p.materials = [{ itemDefinitionId: 'crafting.wood', count: 2 }];
  p.sourceContainerId = box.id as never;
  p.sourceRevision = box.revision as never;
  expect(h.ext('settlement', 'build', p).error).toBeNull();
  expect(
    containerItems(g, box.id).find((i) => i.worldItem?.definitionId === 'crafting.wood')!.quantity
  ).toBe(before - 2);
  const c = g.world5!.structures[0]!.barrier!;
  expect(
    h.ext('settlement', 'dismantle', {
      ...base(g),
      componentId: c.id,
      componentRevision: c.revision
    }).error
  ).toBeNull();
  expect(
    g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'crafting.wood')!.quantity
  ).toBe(inventoryBefore + 1);
});
