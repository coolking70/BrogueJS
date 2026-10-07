import { describe, expect, it } from 'vitest';
import { loadCraftingPack, toWorldDefinitionPack } from '../definitions';
import zhCN from '../locales/zh_CN.json';

const identity = (kind: string, id: string) => ({
  owner: 'crafting', id: `crafting.${id}`,
  nameKey: `ext.crafting.${kind}.${id}.name`, descriptionKey: `ext.crafting.${kind}.${id}.description`
});
const amounts = (...rows: [string, number][]) => rows.map(([id, count]) => ({ itemDefinitionId: `crafting.${id}`, count }));
const item = (id: string, category: string, maxStack: number, tags: string[], glyph: string, color: string, nativeTemplate: string | null = null) => ({
  ...identity('item', id), category, maxStack, tags, glyph, color, nativeTemplate, tool: null
});

/** Golden transcription of taskbook §5.2–5.6: changes to mechanics must change this table. */
describe('crafting approved golden data tables (T3)', () => {
  it('freezes every item field and materials-before-tools order', () => {
    const pack = loadCraftingPack();
    const materials = [
      item('wood', 'material', 99, ['basic.wood'], '%', '#A0784A'),
      item('stone', 'material', 99, ['basic.stone'], '%', '#9EA3A8'),
      item('metal', 'material', 99, ['basic.metal'], '%', '#B7C3CF'),
      item('fiber', 'material', 99, ['basic.fiber'], '%', '#8DB360'),
      item('leather', 'material', 99, ['basic.leather'], '%', '#B0805A'),
      item('kit-bed', 'kit', 99, ['kit.bed'], '▣', '#A8B2C0'),
      item('kit-chest', 'kit', 99, ['kit.chest'], '▣', '#A8B2C0'),
      item('kit-table', 'kit', 99, ['kit.station.table'], '▣', '#A8B2C0'),
      item('kit-hearth', 'kit', 99, ['kit.station.hearth'], '▣', '#A8B2C0'),
      item('plain-dagger', 'native', 1, [], ')', '#CCCCCC', 'dagger'),
      item('plain-leather-armor', 'native', 1, [], ']', '#888888', 'leather_armor')
    ];
    const tools = [{
      ...item('pick', 'tool', 1, ['basic.pick'], '†', '#D2D6D8'),
      tool: { tag: 'basic.pick', maxDurability: 40, durabilityPerBatch: 1 }
    }];
    expect(pack.materials).toEqual(materials);
    expect(pack.tools).toEqual(tools);
    expect(toWorldDefinitionPack(pack).items).toEqual([...materials, ...tools]);
  });
  it('freezes all five resource nodes, placement budgets and regeneration', () => {
    const node = (
      id: string, kind: string, output: string, capacity: number, glyph: string, color: string,
      minDepth: number, maxDepth: number, maxPerDepth: number, maxPerRun: number,
      onNoSpace: string, intervalTicks: number | null, requiredToolTag: string | null = null
    ) => ({
      ...identity('node', id), glyph, color, kind, yield: amounts([output, 1]), capacity,
      harvestTicks: 100, unitsPerHarvest: 1, requiredToolTag,
      regeneration: intervalTicks === null ? { kind: 'none' } : { kind: 'periodic', units: 1, intervalTicks },
      placement: { dungeon: { minDepth, maxDepth, maxPerDepth, maxPerRun, onNoSpace }, site: null }
    });
    const pack = loadCraftingPack();
    expect(pack.resourceNodes).toEqual([
      node('wood-node', 'wood', 'wood', 20, '木', '#A0784A', 1, 40, 2, 32, 'defer', 2000),
      node('stone-node', 'stone', 'stone', 20, '石', '#9EA3A8', 1, 40, 2, 32, 'skip', null),
      node('fiber-node', 'fiber', 'fiber', 20, '草', '#8DB360', 1, 40, 2, 32, 'skip', 1000),
      node('metal-node', 'ore', 'metal', 20, '矿', '#B7C3CF', 2, 40, 1, 24, 'skip', null, 'basic.pick'),
      node('hide-cache', 'fiber', 'leather', 12, '皮', '#B0805A', 1, 20, 1, 24, 'skip', null)
    ]);
    expect(pack.resourceNodes.reduce((sum, node) => sum + node.placement.dungeon!.maxPerDepth, 0)).toBe(8);
    expect(pack.resourceNodes.reduce((sum, node) => sum + node.placement.dungeon!.maxPerRun, 0)).toBe(144);
  });
  it('freezes both stations, ordered placement costs and kit references', () => {
    expect(loadCraftingPack().stations).toEqual([
      {
        ...identity('station', 'table'), glyph: '桌', color: '#B08D57', interactionDistance: 1,
        stationTags: ['station.table'], placementCost: amounts(['wood', 4], ['stone', 2]),
        placementTicks: 300, workPositionPolicy: 'adjacent-passable', kitDefinitionId: 'crafting.kit-table'
      },
      {
        ...identity('station', 'hearth'), glyph: '炉', color: '#E0703A', interactionDistance: 1,
        stationTags: ['station.hearth'], placementCost: amounts(['stone', 6], ['wood', 2]),
        placementTicks: 300, workPositionPolicy: 'adjacent-passable', kitDefinitionId: 'crafting.kit-hearth'
      }
    ]);
  });
  it('freezes every recipe, amount order, work time, station and offline flag', () => {
    const recipe = (id: string, inputs: [string, number][], output: string, workTicks: number, station: boolean, offlineEligible: boolean) => ({
      ...identity('recipe', id), inputs: amounts(...inputs), outputs: amounts([output, 1]),
      stationTags: station ? ['station.table'] : [], toolTag: null, workTicks, offlineEligible
    });
    expect(loadCraftingPack().recipes).toEqual([
      recipe('make-pick', [['wood', 2], ['stone', 2]], 'pick', 500, false, false),
      recipe('make-table-kit', [['wood', 4], ['stone', 2]], 'kit-table', 500, false, false),
      recipe('make-hearth-kit', [['stone', 6], ['wood', 2]], 'kit-hearth', 500, false, false),
      recipe('make-dagger', [['metal', 4], ['wood', 1]], 'plain-dagger', 1000, true, false),
      recipe('make-leather-armor', [['fiber', 6], ['leather', 4]], 'plain-leather-armor', 1500, true, false),
      recipe('make-bed-kit', [['wood', 4], ['fiber', 2]], 'kit-bed', 500, true, true),
      recipe('make-chest-kit', [['wood', 6]], 'kit-chest', 500, true, true)
    ]);
  });
  it('freezes startup declaration, all twelve limits, root metadata and SDK projection', () => {
    const pack = loadCraftingPack();
    expect(Object.keys(pack).sort()).toEqual([
      'schema', 'moduleId', 'moduleVersion', 'rulesVersion', 'materials', 'tools',
      'resourceNodes', 'stations', 'recipes', 'startupItems', 'limits'
    ].sort());
    expect([pack.schema, pack.moduleId, pack.moduleVersion, pack.rulesVersion]).toEqual([1, 'crafting', '1.0.0', '1.0.0']);
    expect(pack.startupItems).toEqual({ instanceKey: 'crafting.startup', items: amounts(['wood', 6], ['stone', 4], ['fiber', 2]), overflow: 'floor-then-skip' });
    expect(pack.limits).toEqual({
      recipes: 128, itemAndStationDefinitions: 128, nodeDefinitions: 128,
      nodesPerLevel: 32, nodesPerRun: 512, stationsPerLevel: 16, stationsPerRun: 128,
      startupReceipts: 1, placementReceipts: 512, workHistory: 128, batchMax: 16, stack: 99
    });
    expect(toWorldDefinitionPack(pack)).toEqual({
      schema: 1, worldSdk: 1, items: [...pack.materials, ...pack.tools],
      resourceNodes: pack.resourceNodes, stations: pack.stations, recipes: pack.recipes,
      startupItems: pack.startupItems
    });
  });
  it('freezes all mechanical Chinese names and has no food or fungus content', () => {
    const locale: Record<string, string> = zhCN;
    const pack = loadCraftingPack();
    const rows = [...pack.materials, ...pack.tools, ...pack.resourceNodes, ...pack.stations, ...pack.recipes];
    expect(rows.map(row => locale[row.nameKey])).toEqual([
      '木材', '石料', '金属块', '植物纤维', '皮革', '床铺套件', '储物箱套件', '工作桌套件', '火炉套件', '匕首', '皮甲', '矿镐',
      '朽木堆', '碎石堆', '洞穴苇丛', '金属矿脉', '皮革存料', '工作桌', '火炉',
      '制作矿镐', '制作工作桌套件', '制作火炉套件', '打制匕首', '缝制皮甲', '制作床铺套件', '制作储物箱套件'
    ]);
    expect(rows.every(row => typeof locale[row.descriptionKey] === 'string' && locale[row.descriptionKey]!.length > 0)).toBe(true);
    expect(rows.map(row => row.id).join(',')).not.toMatch(/fungus|ration|food/);
    expect(pack.materials.some(row => row.nativeTemplate === 'ration_of_food')).toBe(false);
    expect(pack.resourceNodes.some(row => row.kind === 'fungus')).toBe(false);
  });
});
