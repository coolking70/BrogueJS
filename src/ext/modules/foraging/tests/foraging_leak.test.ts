import { describe, expect, it } from 'vitest';
import { generateItemDetail } from '../../../../engine/UI/DetailGenerator';
import { createItemDetailContext } from '../../../../engine/UI/ItemDetailContext';
import { loadForagingPack } from '../definitions';
import locale from '../locales/zh_CN.json';
import { makeHarness, scene, game, addFood, addAlly, eat, feed, roast, hearth, native, moveNodeBeside, harvest, view, messages, knowledgeState } from './mechanicsHelpers';
import type { WorldHarness } from '../../../worldSdk';

function safeVisible(h: WorldHarness) {
  const g = game(h), texts = [messages(), JSON.stringify(view(h))];
  for (const i of [...g.player.inventory.items, ...g.items].filter(i => i.worldItem?.definitionId.startsWith('foraging.'))) texts.push(i.displayName, JSON.stringify(generateItemDetail(i, createItemDetailContext(g, i))));
  const text = texts.join('\n');
  expect(text).not.toContain('ext.foraging.'); expect(text).not.toContain('foraging.');
  for (const kind of loadForagingPack().kinds) if (knowledgeState(g, `foraging.${kind.id}`) !== 'known') expect(text).not.toContain((locale as Record<string,string>)[`ext.foraging.kind.${kind.id}.name`]);
  const projected = view(h); if (!projected.available) throw Error('Projection unavailable');
  for (const food of projected.foods) if (food.source === 'foraging' && food.knowledge !== 'known') expect(food.satiety).toBeNull();
}
describe('foraging T-LEAK actual player-visible text and projection', () => {
  it.each(['eat', 'throw', 'drop', 'equip', 'call', 'harvest', 'roast', 'feed', 'explosion', 'save-load'] as const)('%s never leaks unresolved kind IDs, translation keys or hidden satiety', action => {
    const h = makeHarness(51020001, ['foraging', ...(action === 'roast' || action === 'explosion' ? ['fgheat'] : [])]), g = scene(h);
    const food = addFood(h, action === 'explosion' ? 'blast' : 'mend', 2);
    if (action === 'eat') eat(h, food);
    if (action === 'throw') { native(h, 'item:execute', `throw|${food.inventoryLetter}`); h.command('mouse_travel', { x: 13, y: 10 }); }
    if (action === 'drop') native(h, 'item:execute', `drop|${food.inventoryLetter}`);
    if (action === 'equip') native(h, 'item:execute', `equip|${food.inventoryLetter}`);
    if (action === 'call') native(h, 'item:execute', `call|${food.inventoryLetter}|夜风`);
    if (action === 'harvest') expect(harvest(h, moveNodeBeside(h)).error).toBeNull();
    if (action === 'roast' || action === 'explosion') { hearth(h); expect(roast(h, food).error).toBeNull(); }
    if (action === 'feed') { const ally = addAlly(h); expect(feed(h, ally, food, [true]).error).toBeNull(); }
    if (action === 'save-load') { native(h, 'item:execute', `call|${food.inventoryLetter}|远钟`); h.load(h.save()); }
    safeVisible(h);
    if (action === 'explosion') expect(knowledgeState(game(h), 'foraging.blast')).toBe('known');
    void g;
  });
  it('every unknown raw kind has exactly the same glyph and color despite different identities', () => {
    const h = makeHarness(); scene(h);
    for (const kind of loadForagingPack().kinds) { const i = addFood(h, kind.id); expect(i.char).toBe('菌'); expect(i.color).toBe(0xB8A4E0); }
    safeVisible(h);
  });
});
