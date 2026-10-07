import { describe, expect, it } from 'vitest';
import { generateItemDetail } from '../../../../engine/UI/DetailGenerator';
import { createItemDetailContext } from '../../../../engine/UI/ItemDetailContext';
import { knowledgeView } from '../../../../engine/Core/KindKnowledge';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { makeHarness, scene, addFood, eat, game, knowledgeState, native, edible, rng } from './mechanicsHelpers';

describe('foraging T-KNOW native nonmagical knowledge', () => {
  it('unknown → tasted → known is monotonic; raw knowledge does not establish roast policy', () => {
    const h = makeHarness(), g = scene(h), raw = addFood(h, 'mend', 3), roasted = addFood(h, 'mend-roasted');
    const unknown = raw.displayName;
    expect(knowledgeState(g, 'foraging.mend')).toBe('unknown');
    eat(h, raw); expect(knowledgeState(g, 'foraging.mend')).toBe('tasted'); expect(raw.displayName).toBe(`${unknown}（吃过，无明显效果）`);
    g.player.hp = 1; eat(h, raw); expect(knowledgeState(g, 'foraging.mend')).toBe('known'); expect(raw.displayName).toBe('愈合菌');
    expect(knowledgeState(g, 'foraging.mend-roasted')).toBe('unknown'); expect(roasted.displayName).toBe('烤愈合菌（烤后效果未知）');
    g.player.hp = g.player.maxHp; eat(h, raw); expect(knowledgeState(g, 'foraging.mend')).toBe('known');
  });
  it('native call displays title only while unknown but retains it after revelation and save/load', () => {
    const h = makeHarness(), g = scene(h), food = addFood(h, 'venom', 2), original = food.displayName;
    native(h, 'item:execute', `call|${food.inventoryLetter}|月下回声`);
    expect(food.displayName).toBe(`${original}（叫作：月下回声）`);
    eat(h, food); expect(food.displayName).toBe('蚀骨菌');
    expect(knowledgeView(g, 'foraging', 'foraging.mushrooms').rows.find(r => r.definitionId === 'foraging.venom')).toMatchObject({ state: 'known', title: '月下回声' });
    const save = h.save(); h.load(save);
    const restored = game(h).player.inventory.items.find(i => i.id === food.id)!;
    expect(restored.displayName).toBe('蚀骨菌');
    expect(knowledgeView(game(h), 'foraging', 'foraging.mushrooms').rows.find(r => r.definitionId === 'foraging.venom')!.title).toBe('月下回声');
  });
  it('inventory, native details and floor inspection share knowledge names and hide unknown nutrition', () => {
    const h = makeHarness(), g = scene(h), food = addFood(h, 'venom', 2), name = food.displayName;
    const detail = generateItemDetail(food, createItemDetailContext(g, food));
    expect(detail.name).toBe(name); expect(JSON.stringify(detail)).toContain('能稍微充饥。');
    expect(JSON.stringify(detail)).not.toMatch(/300|蚀骨菌|饱腹/); expect(edible(h).inventory.find(i => i.itemId === food.id)!.satiety).toBeNull();
    native(h, 'item:execute', `drop|${food.inventoryLetter}`);
    const floor = g.items.find(i => i.worldItem?.definitionId === 'foraging.venom')!;
    g.handleInspectAt(floor.x, floor.y); expect(g.inspectTarget!.name).toBe(name);
    expect(JSON.stringify(g.inspectTarget)).not.toContain('蚀骨菌');
    h.command('pickup'); const acquired = g.player.inventory.items.find(i => i.worldItem?.definitionId === 'foraging.venom')!;
    eat(h, acquired); const known = g.player.inventory.items.find(i => i.worldItem?.definitionId === 'foraging.venom');
    if (!known) throw Error('Expected one remaining venom');
    expect(generateItemDetail(known, createItemDetailContext(g, known)).name).toBe('蚀骨菌');
    expect(edible(h).inventory.find(i => i.itemId === known.id)!.satiety).toBe(300);
  });
  it('identify scroll selection excludes mushrooms and rejects trying to identify one', () => {
    const h = makeHarness(), g = scene(h), food = addFood(h, 'mend'), scroll = ItemLoader.spawnScroll('scroll_of_identify', 10, 10)!;
    g.player.inventory.addItem(scroll); native(h, 'item:execute', `read|${scroll.inventoryLetter}`);
    expect(food.canBeIdentified).toBe(false); const before = knowledgeView(g, 'foraging', 'foraging.mushrooms');
    native(h, 'item:execute', `identify|${food.inventoryLetter}`);
    expect(knowledgeView(g, 'foraging', 'foraging.mushrooms')).toEqual(before);
    expect(knowledgeState(g, 'foraging.mend')).toBe('unknown');
  });
  it('detect magic adds no magical mark and never reveals a material kind', () => {
    const h = makeHarness(), g = scene(h), food = addFood(h, 'mend'), potion = ItemLoader.spawnPotion('potion_of_detect_magic', 10, 10)!;
    g.player.inventory.addItem(potion); native(h, 'item:execute', `quaff|${potion.inventoryLetter}`);
    expect(food.magicDetected).toBe(false); expect(knowledgeState(g, 'foraging.mend')).toBe('unknown');
  });
  it('revealing eleven mushroom kinds never triggers the native last-kind upgrade', () => {
    const h = makeHarness(), g = scene(h);
    for (const kind of ['mend', 'venom', 'prism', 'astray', 'upheave', 'farsense', 'veil', 'drowse', 'might', 'stiffen', 'quicken']) {
      // Native incapacitation and preexisting status are independent scene preconditions for each trial.
      g.player.hp = g.player.maxHp - 1; g.player.nutrition = 500; g.player.statusDurations = {}; g.player.maxStatus = {};
      eat(h, addFood(h, kind)); expect(knowledgeState(g, `foraging.${kind}`)).toBe('known');
    }
    expect(knowledgeState(g, 'foraging.blast')).toBe('unknown');
  });
  it('hallucination does not randomize names or consume either RNG stream during reads', () => {
    const h = makeHarness(), g = scene(h), food = addFood(h, 'mend'), name = food.displayName;
    g.player.setStatusDuration('hallucinating', 100); const random = rng.getState();
    for (let i = 0; i < 30; i++) { expect(food.displayName).toBe(name); expect(generateItemDetail(food, createItemDetailContext(g, food)).name).toBe(name); }
    expect(rng.getState()).toEqual(random);
  });
});
