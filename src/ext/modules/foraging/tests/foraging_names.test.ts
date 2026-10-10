import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import locale from '../locales/zh_CN.json';
import { loadForagingPack } from '../definitions';
import { assembleEdibleItem, knowledgeName } from '../../../../engine/Core/KindKnowledge';
import { addFood, eat, edible, game, makeHarness, native, roastChoice, scene } from './mechanicsHelpers';

const APPEARANCES = ['低语菌', '霜息菌', '星屑菌', '回响菌', '符纹菌', '晶棱菌', '烟缕菌', '幽铃菌', '月砂菌', '镜面菌', '雾心菌', '针光菌', '寂鸣菌', '温石菌', '琉璃菌', '虹痕菌', '逆影菌', '沙漏菌'];
const KNOWN = ['愈合菌', '蚀骨菌', '苍鸾菌', '迷途菌', '翻胃菌', '通心菌', '匿影菌', '沉眠菌', '爆燃菌', '蛮力菌', '僵缚菌', '迅步菌'];
const BANNED = ['菇', '蘑', '蕈', '菌盖', '菌褶', '菌柄', '菌环', '菌托', '斑点', '伞', '毒', '鹅膏', '牛肝', '松茸', '香菇', '平菇', '金针', '鸡枞', '鸡油', '灵芝', '竹荪', '羊肚', '木耳', '银耳', '猴头', '松露', '茯苓', '虫草', '孢子', '致幻', '迷幻', '药', '治病', '疗效', '食用菌'];
const text = (key: string) => (locale as Record<string, string>)[key]!;

describe('foraging reviewed imaginary names (T-NAME)', () => {
  const roastPolicies = new Set<boolean>();
  it('freezes both reviewed name lists, order, suffix, uniqueness and non-ASCII names', () => {
    const group = loadForagingPack().knowledgeGroups[0]!;
    expect(group.appearancePool.map(row => text(row.nameKey))).toEqual(APPEARANCES);
    expect(group.kinds.map(row => text(row.knownNameKey))).toEqual(KNOWN);
    expect(APPEARANCES.length).toBeGreaterThanOrEqual(KNOWN.length);
    expect(new Set([...APPEARANCES, ...KNOWN]).size).toBe(30);
    for (const name of [...APPEARANCES, ...KNOWN]) { expect(name.endsWith('菌')).toBe(true); expect(name).not.toMatch(/[a-zA-Z0-9]/); }
  });
  it('copies every authoritative locale value verbatim and scans all values for banned words', () => {
    const task = readFileSync('docs/ext/phase5g.dot-package.md', 'utf8');
    const expected = JSON.parse(task.slice(task.indexOf('### 7.4')).split('```json\n')[1]!.split('\n```')[0]!) as Record<string, string>;
    expect(Object.keys(expected)).toHaveLength(200);
    for (const [key, value] of Object.entries(expected)) expect(text(key), key).toBe(value);
    for (const [key, value] of Object.entries(locale)) {
      if (!Object.prototype.hasOwnProperty.call(expected, key)) expect(key, 'New text may only extend UI/error keys').toMatch(/^ext\.foraging\.(?:ui|error)\./);
      for (const word of BANNED) expect(value.includes(word), `${key}: ${word}`).toBe(false);
    }
    expect(Object.keys(locale).every(key => key.startsWith('ext.foraging.'))).toBe(true);
  });
  it('freezes neutral fallback names and exact template interpolation fields', () => {
    const pack = loadForagingPack();
    for (const item of pack.edibleItems) expect(text(item.nameKey)).toBe(item.id === 'foraging.char' ? '焦炭' : item.id.endsWith('-roasted') ? '烤过的菌' : '奇异的菌');
    for (const node of pack.resourceNodes) expect(text(node.nameKey)).toBe('菌丛');
    const placeholders = (value: string) => [...value.matchAll(/{{([^{}]+)}}/g)].map(match => match[1]);
    expect(Object.fromEntries(Object.entries(pack.knowledgeGroups[0]!.templates).map(([key, value]) => [key, placeholders(text(value))]))).toEqual({ roasted: ['name'], node: ['name'], tastedNote: [], roastUnknownNote: [], called: ['name', 'title'], unknownDetail: [] });
    for (const key of ['roasted', 'charred', 'burned', 'exploded']) expect(placeholders(text(`ext.foraging.fire.${key}`))).toEqual(['item']);
  });
  it.each([1, 2, 3])('actual foundation names stay within reviewed forms for seed %i', seed => {
    const h = makeHarness(seed), g = game(h), pack = loadForagingPack(); scene(h);
    for (const kind of pack.knowledgeGroups[0]!.kinds) {
      const raw = assembleEdibleItem(g, kind.raw).displayName;
      expect(APPEARANCES).toContain(raw);
      expect(knowledgeName(g, kind.node!, `ext.foraging.node.${kind.id}.name`)).toBe(`${raw}丛`);
      if (kind.roasted) expect(assembleEdibleItem(g, kind.roasted).displayName).toBe(`烤${raw}`);
    }
    const raw = addFood(h, 'mend', 3), roasted = addFood(h, 'mend-roasted', 2), name = raw.displayName;
    native(h, 'item:execute', `call|${raw.inventoryLetter}|星光`);
    expect(raw.displayName).toBe(`${name}（叫作：星光）`);
    native(h, 'item:execute', `call|${roasted.inventoryLetter}|余温`);
    expect(roasted.displayName).toBe(`烤${name}（叫作：余温）`);
    g.player.hp = g.player.maxHp; eat(h, raw, [true]);
    expect(raw.displayName).toBe(`${name}（吃过，无明显效果）（叫作：星光）`);
    g.player.hp = g.player.maxHp - 10; eat(h, raw, [true]);
    expect(raw.displayName).toBe('愈合菌');
    expect(knowledgeName(g, 'foraging.mend-patch', 'ext.foraging.node.mend.name')).toBe('愈合菌丛');
    expect(roasted.displayName).toBe('烤愈合菌（烤后效果未知）（叫作：余温）');
    g.player.hp = g.player.maxHp; eat(h, roasted, [true]);
    expect(roasted.displayName).toBe('烤愈合菌（吃过，无明显效果）（叫作：余温）');
    g.player.hp = g.player.maxHp - 10;
    const keep = roastChoice(seed, g.extensionRuntime!.worldDefinitionFingerprints().foraging!, 0) === 0;
    roastPolicies.add(keep);
    eat(h, roasted, [true]);
    const replacement = addFood(h, 'mend-roasted');
    expect(replacement.displayName).toBe(keep ? '烤愈合菌' : '烤愈合菌（吃过，无明显效果）（叫作：余温）');
    expect(edible(h).inventory.find(row => row.itemId === replacement.id)!.displayName).toBe(replacement.displayName);
  });
  it('samples both kept and stripped roasted-name outcomes', () => {
    expect([...roastPolicies].sort()).toEqual([false, true]);
  });
});
