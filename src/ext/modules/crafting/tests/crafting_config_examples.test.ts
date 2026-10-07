import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadCraftingPack } from '../definitions';
import { assertCraftingPack } from '../schema';
import zhCN from '../locales/zh_CN.json';
import { extensionDataFingerprint } from '../../../fingerprint';
import { assertWorldDefinitionPack } from '../../../../engine/Core/WorldDefinitions';

const document = readFileSync(new URL('../../../../../docs/ext/crafting-config.md', import.meta.url), 'utf8');
const examples = [...document.matchAll(/<!-- crafting-config-example: ([a-z-]+) -->\s*```json\s*([\s\S]*?)\s*```/g)]
  .map(match => ({ name: match[1]!, value: JSON.parse(match[2]!) as {
    append: Record<string, unknown[]>; locale: Record<string, string>;
  } }));

describe('crafting configuration examples read directly from the manual', () => {
  it('contains the three promised complete examples', () => {
    expect(examples.map(example => example.name)).toEqual(['material-node', 'table-recipe', 'station-kit']);
  });
  it.each(examples)('validates $name against both real static validators', ({ value }) => {
    expect(Object.keys(value).sort()).toEqual(['append', 'locale']);
    const pack = loadCraftingPack();
    const before = extensionDataFingerprint(pack);
    const locale = { ...zhCN, ...value.locale };
    for (const [key, rows] of Object.entries(value.append)) {
      expect(['materials', 'tools', 'resourceNodes', 'stations', 'recipes']).toContain(key);
      expect(Array.isArray(rows)).toBe(true); expect(rows.length).toBeGreaterThan(0);
      (pack[key as 'materials'] as unknown[]).push(...rows);
    }
    // Production first installs the example locale in zh_CN.json. Here it stays local to the test.
    assertCraftingPack(pack, locale);
    const sdkPack = {
      schema: 1, worldSdk: 1, items: [...pack.materials, ...pack.tools],
      resourceNodes: pack.resourceNodes, stations: pack.stations, recipes: pack.recipes,
      startupItems: pack.startupItems
    };
    expect(() => assertWorldDefinitionPack(sdkPack, 'crafting', new Set(Object.keys(locale)))).not.toThrow();
    expect(extensionDataFingerprint(pack)).not.toBe(before);
    const appended = Object.values(value.append).flat() as { nameKey: string; descriptionKey: string }[];
    expect(new Set(Object.keys(value.locale))).toEqual(new Set(appended.flatMap(row => [row.nameKey, row.descriptionKey])));
  });
});
