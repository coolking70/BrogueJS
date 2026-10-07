import { it, expect } from 'vitest';
import { forage, grant, closedLoop } from './support/forageFixture';
import {
  knowledgeName,
  knowledgeDescription,
  markKnowledge,
  knowledgeState,
  confirmationSatiety
} from '../engine/Core/KindKnowledge';
import { rng } from '../engine/Random';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { definitions } from '../ext/testing/fixtures/forageFixture';
it('name matrix raw/roasted/node, titles, tasted, raw known roasted unknown, monotonic isolation', () => {
  const h = forage(),
    g = h.game(),
    i = grant(h),
    raw = () => knowledgeName(g, 'fgfixture.raw', i.name),
    roast = () => knowledgeName(g, 'fgfixture.roasted', ''),
    node = () => knowledgeName(g, 'fgfixture.node-a', '');
  const unknown = raw();
  expect(unknown).toContain('外观');
  expect(roast()).toBe('烤' + unknown);
  expect(node()).toBe(unknown + '节点');
  expect(knowledgeDescription(g, 'fgfixture.raw', '')).not.toContain('20');
  h.command('item:execute', 'call|' + i.inventoryLetter + '|甲');
  expect(raw()).toContain('甲');
  expect(raw()).toContain(unknown);
  markKnowledge(g, 'fgfixture', 'fgfixture.raw', 'tasted');
  expect(raw()).toContain('尝过');
  expect(markKnowledge(g, 'wrong', 'fgfixture.raw', 'known')).toBe(false);
  markKnowledge(g, 'fgfixture', 'fgfixture.raw', 'known');
  expect(markKnowledge(g, 'fgfixture', 'fgfixture.raw', 'tasted')).toBe(false);
  expect(raw()).toBe('已知样本a');
  expect(roast()).toBe('烤已知样本a（烤制未知）');
  expect(node()).toBe('已知样本a节点');
  markKnowledge(g, 'fgfixture', 'fgfixture.roasted', 'tasted');
  expect(roast()).toContain('尝过');
  markKnowledge(g, 'fgfixture', 'fgfixture.roasted', 'known');
  expect(roast()).toBe('烤已知样本a');
  expect(knowledgeDescription(g, 'fgfixture.raw', '')).toContain('20');
  expect(ItemLoader.identifiedItems.has('fgfixture.raw')).toBe(false);
  const r = rng.getState(),
    s = g.extensionRuntime!.snapshot();
  g.player.setStatusDuration('hallucinating', 10);
  for (let n = 0; n < 30; n++) {
    expect(i.displayName).toBe('已知样本a');
    h.readEdibleContext();
  }
  expect(rng.getState()).toEqual(r);
  expect(g.extensionRuntime!.snapshot()).toEqual(s);
});
it('call is recorded and isolated from native kind tables, empty clears and Unicode limit', () => {
  const h = forage(),
    i = grant(h),
    g = h.game();
  h.command('item:execute', 'call|' + i.inventoryLetter + '|' + '😀'.repeat(40));
  expect([
    ...g.extensionRuntime!.snapshot().foundation.kindKnowledge!.rows[0]!.title!
  ]).toHaveLength(29);
  closedLoop(h);
  h.command('item:execute', 'call|' + i.inventoryLetter + '|  ');
  expect(knowledgeState(g, 'fgfixture.raw')).toBe('unknown');
  expect(g.extensionRuntime!.snapshot().foundation.kindKnowledge).toBeUndefined();
});
it('confirmation uses group maximum including roasted members and unrelated kinds', () => {
  const h = forage(),
    g = h.game(),
    d = definitions.edibleItems![0]!;
  expect(confirmationSatiety(g, d)).toBe(
    Math.max(
      ...definitions
        .knowledgeGroups![0]!.kinds.flatMap((k) => [k.raw, k.roasted])
        .filter((x) => x !== null)
        .map((id) => definitions.edibleItems!.find((d) => d.id === id)!.satiety)
    )
  );
  markKnowledge(g, 'fgfixture', d.id, 'known');
  expect(confirmationSatiety(g, d)).toBe(d.satiety);
});

import { edibleState } from '../engine/Core/EdibleState';
import { canIdentifyChosenItem, canEnchantChosenItem } from '../engine/Items/ItemUseCoordinator';
const matrix = ['raw', 'roasted', 'node-a'].flatMap((kind) =>
  ['unknown', 'tasted', 'known'].flatMap((state) =>
    [false, true].map((title) => ({ kind, state, title }))
  )
);
it.each(matrix)(
  'name matrix $kind/$state/title=$title does not expose another knowledge row',
  ({ kind, state, title }) => {
    const h = forage(),
      g = h.game(),
      id = 'fgfixture.' + kind,
      appearance = knowledgeName(g, 'fgfixture.raw', ''),
      rows =
        state === 'unknown' && !title
          ? []
          : [
              {
                groupId: 'fgfixture.kinds',
                definitionId: id,
                state: state as 'unknown' | 'tasted' | 'known',
                title: title ? '别名' : null
              }
            ];
    if (rows.length) edibleState(g.extensionRuntime!).kindKnowledge = { schema: 1, rows };
    let expected =
      kind === 'node-a'
        ? appearance + '节点'
        : kind === 'roasted'
          ? '烤' + (state === 'known' ? '已知样本a' : appearance)
          : state === 'known'
            ? '已知样本a'
            : appearance;
    if (kind !== 'node-a' && state === 'tasted') expected += '（尝过）';
    if (kind !== 'node-a' && state !== 'known' && title) expected += '，称作“别名”';
    const random = rng.getState(),
      before = g.extensionRuntime!.snapshot();
    for (let n = 0; n < 4; n++) expect(knowledgeName(g, id, '')).toBe(expected);
    expect(g.extensionRuntime!.snapshot()).toEqual(before);
    expect(rng.getState()).toEqual(random);
  }
);
it('edible stays outside identify/enchant/detect/polarity and automatic native food', () => {
  const h = forage(),
    g = h.game(),
    i = grant(h, 'raw', 2);
  expect(canIdentifyChosenItem(g.player, i)).toBe(false);
  expect(canEnchantChosenItem(g.player, i)).toBe(false);
  h.fixture({ kind: 'potion' });
  const potion = g.player.inventory.items.find(
    (item) => item.consumableId === 'potion_of_detect_magic'
  )!;
  h.command('item:execute', 'quaff|' + potion.inventoryLetter);
  expect(g.player.inventory.items).not.toContain(potion);
  ItemLoader.tryIdentifyLastItemKindsAllPolarityCategories();
  expect(i.magicDetected).toBe(false);
  expect(ItemLoader.magicPolarityRevealed.has('fgfixture.raw')).toBe(false);
  expect(ItemLoader.identifiedItems.has('fgfixture.raw')).toBe(false);
  expect(knowledgeState(g, 'fgfixture.raw')).toBe('unknown');
  g.player.inventory.items = g.player.inventory.items.filter((item) => item.category !== 4);
  g.player.nutrition = 1;
  h.command('wait');
  expect(i.quantity).toBe(2);
  expect(g.player.inventory.items).toContain(i);
});
