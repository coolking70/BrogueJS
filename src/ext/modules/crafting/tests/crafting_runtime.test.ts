import { describe, expect, it } from 'vitest';
import { threat } from '../../../../engine/Core/WorldWorkWorld';
import { grantStartupItems } from '../../../../engine/Core/WorldWorkPlacement';
import { TerrainType } from '../../../../engine/Map/Grid';
import { ItemCategory } from '../../../../engine/Items/Item';
import { getNextEntityId } from '../../../../entities/Creature';
import { rng } from '../../../../engine/Random';
import { add, amount, amounts, arena, craft, descend, fillBag, game, harness, harvest, nearNode, node, place, read, rejected, harvestPayload, SAFE_SEED, staged } from './runtimeHelpers';

describe('crafting T7 real runtime', () => {
  it('uses documented threat-free normal seed and grants exactly wood 6, stone 4, fiber 2 once', () => {
    const h = harness(), g = game(h);
    expect(g.currentSeed).toBe(String(SAFE_SEED));
    expect(threat(g)).toBe(false);
    expect(amounts(h)).toEqual({ 'crafting.fiber': 2, 'crafting.stone': 4, 'crafting.wood': 6 });
    expect(h.world5()!.startupGrants).toEqual([{ owner: 'crafting', instanceKey: 'crafting.startup', result: 'granted', toInventory: [
      { itemDefinitionId: 'crafting.wood', count: 6 }, { itemDefinitionId: 'crafting.stone', count: 4 }, { itemDefinitionId: 'crafting.fiber', count: 2 }
    ], toFloor: [], skipped: [], tick: 0 }]);
    const original = h.digest(), grant = h.world5()!.startupGrants;
    h.load(h.save());
    expect(h.digest()).toBe(original);
    expect(h.world5()!.startupGrants).toEqual(grant);
    h.command('escape');
    const recording = h.exportRecording(), final = h.digest();
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(final);
    expect(h.world5()!.startupGrants).toEqual(grant);
    expect(amounts(h)).toEqual({ 'crafting.fiber': 2, 'crafting.stone': 4, 'crafting.wood': 6 });
  });

  it.each(['partial', 'skipped'] as const)('automatic startup lifecycle records %s overflow exactly once', (result) => {
    const h = harness(), g = game(h);
    // Re-create the pre-grant scene. Startup is a lifecycle event, not a player action.
    g.world5!.startupGrants = [];
    g.player.inventory.items = g.player.inventory.items.filter(i => !i.worldItem);
    fillBag(g);
    if (result === 'partial') arena(g);
    else for (let y = g.player.y - 4; y <= g.player.y + 4; y++)
      for (let x = g.player.x - 4; x <= g.player.x + 4; x++)
        if (g.grid.isValidPos(x, y)) g.grid.setTerrain(x, y, TerrainType.WALL);
    const id = getNextEntityId(), random = rng.getState(), before = g.items.length;
    grantStartupItems(g, 'crafting');
    const receipt = g.world5!.startupGrants[0]!;
    expect(receipt.result).toBe(result);
    expect(receipt.toInventory).toEqual([]);
    expect(receipt[result === 'partial' ? 'toFloor' : 'skipped']).toEqual([
      { itemDefinitionId: 'crafting.wood', count: 6 }, { itemDefinitionId: 'crafting.stone', count: 4 }, { itemDefinitionId: 'crafting.fiber', count: 2 }
    ]);
    expect(g.items.length - before).toBe(result === 'partial' ? 3 : 0);
    expect(getNextEntityId() - id).toBe(result === 'partial' ? 3 : 0);
    expect(rng.getState()).toEqual(random);
    const once = structuredClone(receipt), count = g.items.length;
    grantStartupItems(g, 'crafting');
    expect(g.world5!.startupGrants).toEqual([once]);
    expect(g.items).toHaveLength(count);
  });

  it.each(['wood-node', 'stone-node', 'fiber-node', 'hide-cache'])('%s harvest costs 100 ticks and yields exactly one', shortId => {
    const h = harness(), n = nearNode(h, shortId), g = game(h);
    const output = { 'wood-node': 'wood', 'stone-node': 'stone', 'fiber-node': 'fiber', 'hide-cache': 'leather' }[shortId]!;
    const before = amount(h, output), tick = g.world5!.simulationTicks, remaining = n.remaining;
    expect(harvest(h, shortId)).toEqual({ recorded: true, error: null });
    expect(amount(h, output)).toBe(before + 1);
    expect(g.world5!.simulationTicks - tick).toBe(100);
    expect(n.remaining).toBe(remaining - 1);
    expect(g.actorActions!.bundles).toEqual([]);
    expect(h.world5()!.terminalTickets.slice(-1)[0]).toMatchObject({ status: 'completed', completedBatches: 1 });
  });

  it.each(['kit', 'materials'] as const)('pick → table from %s → hearth never double-charges placement', source => {
    const h = staged(), g = game(h);
    expect(craft(h, 'make-pick').error).toBeNull();
    expect(amount(h, 'pick')).toBe(1);
    expect(amount(h, 'wood')).toBe(4);
    expect(amount(h, 'stone')).toBe(2);
    if (source === 'kit') {
      expect(craft(h, 'make-table-kit').error).toBeNull();
      add(g, 'wood', 4); add(g, 'stone', 2);
    }
    const wood = amount(h, 'wood'), stone = amount(h, 'stone');
    expect(place(h).error).toBeNull();
    expect(amount(h, 'kit-table')).toBe(0);
    expect(amount(h, 'wood')).toBe(wood - (source === 'kit' ? 0 : 4));
    expect(amount(h, 'stone')).toBe(stone - (source === 'kit' ? 0 : 2));
    add(g, 'stone', 6); add(g, 'wood', 2);
    const before = amounts(h);
    expect(place(h, 'hearth').error).toBeNull();
    expect(amount(h, 'stone')).toBe(before['crafting.stone']! - 6);
    expect(amount(h, 'wood')).toBe(before['crafting.wood']! - 2);
    expect(read(h).stations.map(s => s.definitionId).sort()).toEqual(['crafting.hearth', 'crafting.table']);
  });

  it('D2 metal requires a working pick, subtracts one durability, retains a broken pick', () => {
    const h = harness();
    descend(h);
    const n = nearNode(h, 'metal-node'), g = game(h);
    rejected(h, 'harvest', harvestPayload(h, n), 'C5_TOOL');
    add(g, 'pick', 1);
    const pick = g.player.inventory.items.find(i => i.worldItem?.definitionId === 'crafting.pick')!;
    expect(harvest(h, 'metal-node').error).toBeNull();
    expect(amount(h, 'metal')).toBe(1);
    expect(pick.worldItem!.toolDurability).toBe(39);
    pick.worldItem!.toolDurability = 1;
    expect(harvest(h, 'metal-node', [true]).error).toBeNull();
    expect(amount(h, 'metal')).toBe(2);
    expect(pick.worldItem!.toolDurability).toBe(0);
    rejected(h, 'harvest', harvestPayload(h, node(h, 'metal-node')), 'C5_TOOL');
    expect(g.player.inventory.items).toContain(pick);
  });

  it('native dagger and leather armor are +0, identified, uncursed, unruned, and obey natural stacking', () => {
    const h = staged(), g = game(h);
    const originalDagger = g.player.inventory.items.find(i => i.identityId === 'dagger')!;
    const originalArmor = g.player.inventory.items.find(i => i.identityId === 'leather_armor')!;
    expect(place(h).error).toBeNull();
    add(g, 'metal', 4); add(g, 'fiber', 6); add(g, 'leather', 4);
    const food = g.player.inventory.items.filter(i => i.category === ItemCategory.FOOD).map(i => [i.id, i.quantity]);
    expect(craft(h, 'make-dagger').error).toBeNull();
    expect(craft(h, 'make-leather-armor').error).toBeNull();
    for (const [id, natural] of [['dagger', originalDagger], ['leather_armor', originalArmor]] as const) {
      expect(natural).toBeDefined();
      const produced = g.player.inventory.items.find(i => i.identityId === id && i.id !== natural.id)!;
      expect(produced).toMatchObject({ enchantment: 0, identified: true, canBeIdentified: false, isCursed: false });
      expect(produced.worldItem).toBeUndefined();
      expect(produced.runicType).toBeUndefined();
      expect(produced.runicKnown).toBe(false);
      expect(g.player.inventory.stacksWith(natural, produced)).toBe(g.player.inventory.stacksWith(natural, natural));
      expect(g.player.inventory.stacksWith(produced, natural)).toBe(false);
    }
    expect(g.player.inventory.items.filter(i => i.category === ItemCategory.FOOD).map(i => [i.id, i.quantity])).toEqual(food);
    expect(g.player.inventory.items.some(i => i.worldItem?.definitionId.includes('ration'))).toBe(false);
  });

  it.each(['kit-table', 'kit-hearth', 'kit-bed', 'kit-chest'])('%s stacks to 99 and persists', shortId => {
    const h = staged(), g = game(h);
    if (shortId === 'kit-bed' || shortId === 'kit-chest') expect(place(h).error).toBeNull();
    add(g, shortId, 98);
    add(g, 'wood', 8); add(g, 'stone', 8); add(g, 'fiber', 4);
    const recipe = { 'kit-table': 'make-table-kit', 'kit-hearth': 'make-hearth-kit', 'kit-bed': 'make-bed-kit', 'kit-chest': 'make-chest-kit' }[shortId]!;
    expect(craft(h, recipe).error).toBeNull();
    expect(read(h).inventory.filter(i => i.definitionId === `crafting.${shortId}`).map(i => i.quantity)).toEqual([99]);
    const save = h.save(), digest = h.digest();
    h.load(save);
    expect(h.digest()).toBe(digest);
    expect(amount(h, shortId)).toBe(99);
  });
});
