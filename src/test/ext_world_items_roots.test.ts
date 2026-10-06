import type { Game } from '../engine/Core/Game';
import { planMaterialTransfer, commitMaterialTransfer, type MaterialTransferRequest } from '../engine/Core/WorldMaterialTransfer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { workGame } from './support/worldWorkFixture';
import { Item, ItemCategory } from '../engine/Items/Item';
import { Inventory } from '../engine/Items/Inventory';
import { assembleWorldItem, worldItemDefinition } from '../engine/Items/WorldItems';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';
import { forEachItemRoot, countWorldItemRoots } from '../engine/Core/WorldItemRoots';
import { checkItemBudget, containerRead } from '../engine/Core/WorldWorkWorld';
import { inventoryStamp } from '../engine/Core/RecordingDigest';
import { getNextEntityId } from '../entities/Creature';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { serializeItem } from '../engine/Core/EntitySnapshot';
import { createHeadlessGame } from './harness';
import { TerrainType } from '../engine/Map/Grid';
import { stealFromPlayer } from '../engine/Combat/MonsterTheft';
afterEach(() => vi.restoreAllMocks());
function trustedTransfer(g: Game, request: MaterialTransferRequest) {
  const plan=planMaterialTransfer(g,request);
  if(!plan.ok)throw new Error(plan.code);
  const committed=commitMaterialTransfer(g,plan.value);
  if(!committed.ok)throw new Error(committed.code);
  expect(committed.value.chargedTicks).toBe(100);
  return committed.value;
}

describe('C5 Item owners and native assembly', () => {
  it('material partial merge keeps stable IDs, tools stay separate, food uses quantity slots', () => {
    const g = workGame(),
      pack = g.extensionRuntime!.worldDefinitionPacks()[0]!,
      fiber = pack.items[0]!,
      knife = pack.items[1]!,
      inv = new Inventory();
    const a = assembleWorldItem(fiber, 98),
      b = assembleWorldItem(fiber, 5);
    expect(inv.addItem(a)).toBe(true);
    expect(inv.addItem(b)).toBe(true);
    expect(inv.items.map((i) => [i.id, i.quantity])).toEqual([
      [a.id, 99],
      [b.id, 4]
    ]);
    expect(inv.packCount()).toBe(2);
    expect(inv.addItem(assembleWorldItem(knife))).toBe(true);
    expect(inv.addItem(assembleWorldItem(knife))).toBe(true);
    expect(inv.packCount()).toBe(4);
    const f = new Item('food', '%', 1, ItemCategory.FOOD);
    f.consumableId = 'ration_of_food';
    f.quantity = 3;
    inv.addItem(f);
    const next = new Item('food', '%', 1, ItemCategory.FOOD);
    next.consumableId = 'ration_of_food';
    next.quantity = 2;
    inv.addItem(next);
    expect(inv.packCount()).toBe(9);
    expect(f.quantity).toBe(5);
  });
  it('26 letters and 99 limits reject a new stack but allow remaining material merge room', () => {
    const g = workGame(),
      d = g.extensionRuntime!.worldDefinitionPacks()[0]!.items[0]!,
      inv = new Inventory();
    for (let n = 0; n < 25; n++) inv.addItem(new Item('weapon' + n, ')', 1, ItemCategory.WEAPON));
    const target = assembleWorldItem(d, 98);
    inv.addItem(target);
    expect(new Set(inv.items.map((i) => i.inventoryLetter)).size).toBe(26);
    expect(inv.addItem(assembleWorldItem(d, 1))).toBe(true);
    expect(target.quantity).toBe(99);
    expect(inv.addItem(assembleWorldItem(d, 1))).toBe(false);
  });
  it.each(['dagger', 'leather_armor', 'ration_of_food'] as const)(
    'fixed %s has no extension fields and consumes no RNG',
    (template) => {
      const g = workGame(),
        base = g.extensionRuntime!.worldDefinitionPacks()[0]!.items[3]!,
        d = {
          ...base,
          id: 'craftskel.' + template,
          nativeTemplate: template,
          maxStack: template === 'ration_of_food' ? 99 : 1
        },
        before = rng.getState(),
        item = assembleWorldItem(d, template === 'ration_of_food' ? 3 : 1);
      expect(rng.getState()).toEqual(before);
      expect(item).not.toHaveProperty('worldItem');
      expect(serializeItem(item)).not.toHaveProperty('worldItem');
      expect(item.enchantment).toBe(0);
      expect(item.isCursed).toBe(false);
      expect(item.isIdentified).toBe(true);
      if (template === 'ration_of_food') {
        const inv = new Inventory();
        inv.addItem(item);
        expect(inv.packCount()).toBe(3);
        expect(ItemLoader.food.find((f) => f.id === item.consumableId)!.nutrition).toBe(1800);
      }
    }
  );
  it.each(['equip', 'quaff', 'read', 'throw', 'eat', 'use'])(
    'MATERIAL %s is zero time with no RNG or ID allocation',
    (operation) => {
      const g = workGame(),
        item = g.player.inventory.items.find((i) => i.category === ItemCategory.MATERIAL)!,
        before = {
          rng: rng.getState(),
          id: getNextEntityId(),
          tick: timeSystem.currentTick,
          world: structuredClone(g.world5),
          quantity: item.quantity
        };
      g.executeItemCommand(operation, item);
      expect({
        rng: rng.getState(),
        id: getNextEntityId(),
        tick: timeSystem.currentTick,
        world: structuredClone(g.world5),
        quantity: item.quantity
      }).toEqual(before);
      expect(g.player.equippedWeapon).not.toBe(item);
    }
  );
  it('all mechanical roots are enumerated once in the frozen canonical owner order', () => {
    const g = workGame();
    g.depth = 2;
    (g as any).generateDepth(false, false);
    const cached = g.levels.get(1)!;
    g.items = [];
    g.monsters = [];
    g.dormantMonsters = [];
    cached.items = [];
    cached.monsters = [];
    cached.dormantMonsters = [];
    g.player.inventory.items = [];
    g.worldContainerItems!.clear();
    for (const c of g.world5!.containers) c.itemIds = [];
    const make = () => new Item('sentinel', '*', 1, ItemCategory.GEM),
      ids: number[] = [];
    const add = (where: Item[]) => {
      const i = make();
      where.push(i);
      ids.push(i.id);
    };
    const carrier = (where: Monster[]) => {
      const m = new Monster(1, 1, monsters[0] as MonsterData);
      m.carriedItem = make();
      where.push(m);
      ids.push(m.carriedItem.id);
    };
    add(g.player.inventory.items);
    add(g.items);
    carrier(g.monsters);
    add(cached.items);
    carrier(cached.monsters);
    const pending: Item[] = [];
    add(pending);
    (g as any).pendingFallenItemsByDepth.set(3, pending);
    carrier(g.purgatory);
    const fall: Monster[] = [];
    carrier(fall);
    (g as any).pendingFallenByDepth.set(3, fall);
    const c = g.world5!.containers[0]!,
      last = make();
    ids.push(last.id);
    c.itemIds.push(last.id);
    g.worldContainerItems!.set(last.id, last);
    const rows: { id: number; owner: string }[] = [];
    forEachItemRoot(g, (i, o) => rows.push({ id: i.id, owner: o.kind }));
    expect(rows.map((r) => r.id)).toEqual(ids);
    expect(rows.map((r) => r.owner)).toEqual([
      'inventory',
      'floor',
      'carrier',
      'floor',
      'carrier',
      'floor',
      'carrier',
      'carrier',
      'container'
    ]);
    expect(countWorldItemRoots(g)).toBe(9);
  });
  it('duplicate owner and material fields on native items reject before retiring the current run', () => {
    const g = workGame(),
      original = g.player,
      bad = g.toSnapshot(),
      id = bad.player.inventory.find((i) => i.worldItem)!.id;
    bad.run.world5!.containers[0]!.itemIds.push(id);
    expect(g.loadSnapshot(bad)).toBe(false);
    expect(g.player).toBe(original);
    const native = g.toSnapshot();
    native.player.inventory[0]!.worldItem = {
      definitionId: 'craftskel.fiber',
      quality: 'basic',
      toolDurability: null
    };
    expect(g.loadSnapshot(native)).toBe(false);
    expect(g.player).toBe(original);
  });
  it('admission is 7168 roots inclusive, native generation continues and load has no native total cap', () => {
    const g = createHeadlessGame(3, 'wizard');
    g.items = [];
    g.player.inventory.items = [];
    g.monsters = [];
    g.dormantMonsters = [];
    for (let n = 0; n < 7168; n++) {
      const i = new Item('native', '*', 1, ItemCategory.GEM);
      i.loc = { ...g.player.loc };
      g.items.push(i);
    }
    expect(() => checkItemBudget(g, 0)).not.toThrow();
    expect(() => checkItemBudget(g, 1)).toThrow('C5_BUDGET');
    {
      const i = new Item('native', '*', 1, ItemCategory.GEM);
      i.loc = { ...g.player.loc };
      g.items.push(i);
    }
    expect(countWorldItemRoots(g)).toBe(7169);
    expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
  });
  it('trusted material transfer moves real owners, quotes 100 ticks, and round trips', () => {
    const g = workGame(),
      c = g.world5!.containers.find((c) => c.kind === 'chest')!,
      item = g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'craftskel.fiber')!,
      before = timeSystem.currentTick;
    trustedTransfer(g, {
      containerId: c.id,
      containerRevision: c.revision,
      inventoryStamp: inventoryStamp(g.player.inventory.items),
      direction: 'deposit',
      items: [{ itemId: item.id, quantity: 3 }]
    });
    expect(containerRead(g, c.id).items[0]!.quantity).toBe(3);
    expect(item.quantity).toBe(17);
    expect(timeSystem.currentTick - before).toBe(0);
    const saved = g.toSnapshot();
    expect(g.loadSnapshot(saved)).toBe(true);
    const c2 = g.world5!.containers.find((c) => c.id === c.id)!,
      moved = containerRead(g, c2.id).items[0]!;
    trustedTransfer(g, {
      containerId: c2.id,
      containerRevision: c2.revision,
      inventoryStamp: inventoryStamp(g.player.inventory.items),
      direction: 'withdraw',
      items: [{ itemId: moved.id, quantity: 3 }]
    });
    expect(containerRead(g, c2.id).items).toEqual([]);
    expect(g.player.inventory.items.find((i) => i.id === item.id)!.quantity).toBe(20);
  });
  it('budget, ownership and load validators use the sole enumerator', () => {
    for (const file of ['WorldWorkWorld', 'WorldWorkValidation']) {
      const code = readFileSync(new URL('../engine/Core/' + file + '.ts', import.meta.url), 'utf8');
      expect(code).toMatch(/from '.\/WorldItemRoots'/);
      expect(code).not.toMatch(
        /\.levels\.values\(|pendingFallenItemsByDepth\.values\(|purgatory\.flatMap\(/
      );
    }
  });
});

describe('MATERIAL uses native ownership movement', () => {
  it('deep water peels one material with its definition, then a chasm queues the same Item once', () => {
    const g = workGame(),
      i = g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'craftskel.fiber')!;
    g.player.inventory.items = [i];
    g.items = [];
    g.player.loc = { x: 8, y: 8 };
    g.grid.setTerrain(8, 8, TerrainType.WATER_DEEP);
    const chance = vi.spyOn(rng, 'randPercent').mockReturnValue(true),
      pick = vi.spyOn(rng, 'randRange').mockReturnValue(0);
    (g as any).sweepDeepWaterItem(g.player, 100);
    chance.mockRestore();
    pick.mockRestore();
    expect(i.quantity).toBe(19);
    const moved = g.items[0]!;
    expect(moved.worldItem).toEqual(i.worldItem);
    expect(worldItemDefinition(moved)).toBe(worldItemDefinition(i));
    g.grid.setTerrain(8, 8, TerrainType.CHASM);
    (g as any).fallFloorItems();
    expect(g.items).not.toContain(moved);
    expect((g as any).pendingFallenItemsByDepth.get(2)).toEqual([moved]);
    expect(countWorldItemRoots(g)).toBe(2);
  });
  it('a real thief takes one material and retains the definition and distinct owner', () => {
    const g = workGame(),
      i = g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'craftskel.fiber')!;
    g.player.inventory.items = [i];
    const m = new Monster(
      g.player.x + 1,
      g.player.y,
      (monsters as MonsterData[]).find((m) =>
        m.abilityFlags?.includes('MA_HIT_STEAL_FLEE')
      ) as MonsterData
    );
    g.monsters = [m];
    const before = countWorldItemRoots(g);
    const stolen = stealFromPlayer(m, g.player, () => true, 1)!;
    expect(stolen).toBe(m.carriedItem);
    expect(stolen.id).not.toBe(i.id);
    expect(stolen.quantity).toBe(1);
    expect(i.quantity).toBe(19);
    expect(worldItemDefinition(stolen)).toBe(worldItemDefinition(i));
    expect(countWorldItemRoots(g)).toBe(before + 1);
  });
  it('native FOOD transfers count quantity slots, split without worldItem, and restore', () => {
    const g = workGame(),
      c = g.world5!.containers.find((c) => c.kind === 'chest')!,
      food = g.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)!;
    food.quantity = 3;
    c.capacity = 2;
    const command = (direction: 'deposit' | 'withdraw', itemId: number, quantity: number) =>
      trustedTransfer(g, {
        containerId: c.id,
        containerRevision: c.revision,
        inventoryStamp: inventoryStamp(g.player.inventory.items),
        direction,
        items: [{ itemId, quantity }]
      });
    command('deposit', food.id, 2);
    expect(food.quantity).toBe(1);
    expect(containerRead(g, c.id).occupiedSlots).toBe(2);
    const id = c.itemIds[0]!;
    expect(g.worldContainerItems!.get(id)).not.toHaveProperty('worldItem');
    command('withdraw', id, 1);
    expect(containerRead(g, c.id).occupiedSlots).toBe(1);
    expect(food.quantity).toBe(2);
    expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
  });
});
