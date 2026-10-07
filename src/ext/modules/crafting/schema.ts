import zhCN from './locales/zh_CN.json';
import type { ItemAmount, ItemDefinitionContribution } from '../../worldSdk';
import type { CraftingLimits, CraftingPack } from './types';

const MAX_LIMITS: Readonly<CraftingLimits> = Object.freeze({
  recipes: 128,
  itemAndStationDefinitions: 128,
  nodeDefinitions: 128,
  nodesPerLevel: 32,
  nodesPerRun: 512,
  stationsPerLevel: 16,
  stationsPerRun: 128,
  startupReceipts: 1,
  placementReceipts: 512,
  workHistory: 128,
  batchMax: 16,
  stack: 99
});

function fail(field: string): never {
  throw new Error(`Invalid crafting definition: ${field}`);
}

/** Inspect descriptors before reading values: validation must never invoke accessors. */
function json(value: unknown, field: string, ancestors = new Set<object>()): void {
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    for (let index = 0; index < value.length; index++) {
      const unit = value.charCodeAt(index);
      if (unit >= 0xd800 && unit <= 0xdbff) {
        const next = value.charCodeAt(++index);
        if (!(next >= 0xdc00 && next <= 0xdfff)) fail(field);
      } else if (unit >= 0xdc00 && unit <= 0xdfff) fail(field);
    }
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) fail(field);
    return;
  }
  if (typeof value !== 'object' || ancestors.has(value)) fail(field);
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
    fail(field);
  const keys = Reflect.ownKeys(value);
  if (array && keys.length !== value.length + 1) fail(field);
  ancestors.add(value);
  for (const key of keys) {
    if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) fail(field);
    json(key, field);
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor)) fail(`${field}.${key}`);
    if (array && key === 'length') continue;
    if (!descriptor.enumerable) fail(`${field}.${key}`);
    if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) fail(field);
    json(descriptor.value, `${field}.${key}`, ancestors);
  }
  ancestors.delete(value);
}

function record(value: unknown, keys: string, field: string): void {
  if (
    !value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== keys.split(',').sort().join(',')
  ) fail(field);
}

function integer(value: unknown, min: number, max: number, field: string): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    fail(field);
}

function list(value: unknown, min: number, max: number, field: string): void {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(field);
}

/** Same ASCII grammar as the foundation validId, kept local to the SDK import boundary. */
function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 128 &&
    /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(value);
}

function tags(value: readonly string[], field: string, min = 0): void {
  list(value, min, 16, field);
  for (let index = 0; index < value.length; index++) {
    if (!validId(value[index]) || (index > 0 && value[index - 1]! >= value[index]!)) fail(field);
  }
}

/** Content validation is pure, all-or-nothing, and independent of the engine. */
export function assertCraftingPack(
  value: unknown,
  locale: Readonly<Record<string, string>> = zhCN
): asserts value is CraftingPack {
  json(value, 'pack');
  json(locale, 'locale');
  if (!locale || typeof locale !== 'object' || Array.isArray(locale) ||
    Object.entries(locale).some(([key, text]) => !key.startsWith('ext.crafting.') || typeof text !== 'string'))
    fail('locale');
  record(value, 'schema,moduleId,moduleVersion,rulesVersion,materials,tools,resourceNodes,stations,recipes,startupItems,limits', 'pack');
  const pack = value as CraftingPack;
  if (pack.schema !== 1 || pack.moduleId !== 'crafting' || pack.moduleVersion !== '1.0.0' || pack.rulesVersion !== '1.0.0')
    fail('version');
  record(pack.limits, Object.keys(MAX_LIMITS).join(','), 'limits');
  for (const key of Object.keys(MAX_LIMITS) as (keyof CraftingLimits)[])
    integer(pack.limits[key], 1, MAX_LIMITS[key], `limits.${key}`);
  for (const key of ['materials', 'tools', 'resourceNodes', 'stations', 'recipes'] as const)
    list(pack[key], 0, 128, key);
  if (pack.materials.length + pack.tools.length + pack.stations.length > pack.limits.itemAndStationDefinitions)
    fail('limits.itemAndStationDefinitions');
  if (pack.recipes.length > pack.limits.recipes) fail('limits.recipes');
  if (pack.resourceNodes.length > pack.limits.nodeDefinitions) fail('limits.nodeDefinitions');

  const ids = new Set<string>();
  function define(row: { owner: string; id: string; nameKey: string; descriptionKey: string; glyph?: string; color?: string }): void {
    if (row.owner !== 'crafting' || !validId(row.id) || !row.id.startsWith('crafting.') || ids.has(row.id))
      fail('id');
    ids.add(row.id);
    for (const key of [row.nameKey, row.descriptionKey])
      if (typeof key !== 'string' || !key.startsWith('ext.crafting.') || !Object.prototype.hasOwnProperty.call(locale, key)) fail('locale.key');
    if ('glyph' in row && (typeof row.glyph !== 'string' || [...row.glyph].length !== 1 ||
      /[\p{Cc}\p{Cf}\p{Cs}]/u.test(row.glyph) || typeof row.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(row.color)))
      fail('appearance');
  }

  const items = [...pack.materials, ...pack.tools];
  for (const [index, row] of items.entries()) {
    record(row, 'owner,id,nameKey,descriptionKey,category,glyph,color,maxStack,nativeTemplate,tags,tool', 'item');
    define(row);
    if (index < pack.materials.length ? !['material', 'kit', 'native'].includes(row.category) : row.category !== 'tool')
      fail('item.category');
    tags(row.tags, 'item.tags');
    integer(row.maxStack, 1, pack.limits.stack, 'item.maxStack');
    if (row.category === 'native') {
      if (!['dagger', 'leather_armor'].includes(row.nativeTemplate!) || row.tool !== null || row.maxStack !== 1)
        fail('item.native');
    } else if (row.nativeTemplate !== null) fail('item.native');
    if (row.category === 'tool') {
      record(row.tool, 'tag,maxDurability,durabilityPerBatch', 'item.tool');
      if (!validId(row.tool!.tag) || !row.tags.includes(row.tool!.tag) || row.maxStack !== 1) fail('item.tool');
      integer(row.tool!.maxDurability, 1, 1_000_000, 'item.tool.maxDurability');
      integer(row.tool!.durabilityPerBatch, 1, row.tool!.maxDurability, 'item.tool.durabilityPerBatch');
    } else if (row.tool !== null) fail('item.tool');
  }
  const byId = new Map(items.map(row => [row.id, row]));
  const toolTags = new Set(pack.tools.map(row => row.tool!.tag));
  function amounts(rows: readonly ItemAmount[], field: string, categories?: readonly ItemDefinitionContribution['category'][]): void {
    list(rows, 1, 8, field);
    const used = new Set<string>();
    for (const row of rows) {
      record(row, 'itemDefinitionId,count', field);
      integer(row.count, 1, 99, `${field}.count`);
      const item = byId.get(row.itemDefinitionId);
      if (!item || used.has(row.itemDefinitionId) || (categories && !categories.includes(item.category))) fail(field);
      used.add(row.itemDefinitionId);
    }
  }
  function toolTag(value: string | null, field: string): void {
    if (value !== null && (!validId(value) || !toolTags.has(value))) fail(field);
  }

  for (const row of pack.resourceNodes) {
    record(row, 'owner,id,nameKey,descriptionKey,glyph,color,kind,yield,capacity,harvestTicks,unitsPerHarvest,requiredToolTag,regeneration,placement', 'node');
    define(row);
    if (!['wood', 'stone', 'ore', 'fiber'].includes(row.kind)) fail('node.kind');
    amounts(row.yield, 'node.yield', ['material']);
    integer(row.capacity, 1, 9999, 'node.capacity');
    integer(row.harvestTicks, 1, 10000, 'node.harvestTicks');
    integer(row.unitsPerHarvest, 1, Math.min(99, row.capacity), 'node.unitsPerHarvest');
    toolTag(row.requiredToolTag, 'node.requiredToolTag');
    if (!row.regeneration || typeof row.regeneration !== 'object') fail('node.regeneration');
    if (row.regeneration.kind === 'none') record(row.regeneration, 'kind', 'node.regeneration');
    else {
      record(row.regeneration, 'kind,units,intervalTicks', 'node.regeneration');
      if (row.regeneration.kind !== 'periodic') fail('node.regeneration');
      integer(row.regeneration.units, 1, 99, 'node.regeneration.units');
      integer(row.regeneration.intervalTicks, 1, 1_000_000, 'node.regeneration.intervalTicks');
    }
    record(row.placement, 'dungeon,site', 'node.placement');
    if (row.placement.site !== null) fail('node.placement.site');
    if (row.placement.dungeon !== null) {
      const placement = row.placement.dungeon;
      record(placement, 'minDepth,maxDepth,maxPerDepth,maxPerRun,onNoSpace', 'node.placement.dungeon');
      integer(placement.minDepth, 1, 40, 'node.placement.minDepth');
      integer(placement.maxDepth, placement.minDepth, 40, 'node.placement.maxDepth');
      integer(placement.maxPerDepth, 1, 32, 'node.placement.maxPerDepth');
      integer(placement.maxPerRun, 1, 512, 'node.placement.maxPerRun');
      if (!['skip', 'defer'].includes(placement.onNoSpace)) fail('node.placement.onNoSpace');
    }
  }
  for (let depth = 1; depth <= 40; depth++) {
    const total = pack.resourceNodes.reduce((sum, node) => {
      const placement = node.placement.dungeon;
      return sum + (placement && depth >= placement.minDepth && depth <= placement.maxDepth ? placement.maxPerDepth : 0);
    }, 0);
    if (total > pack.limits.nodesPerLevel) fail('limits.nodesPerLevel');
  }
  if (pack.resourceNodes.reduce((sum, node) => sum + (node.placement.dungeon?.maxPerRun ?? 0), 0) > pack.limits.nodesPerRun)
    fail('limits.nodesPerRun');

  for (const row of pack.stations) {
    record(row, 'owner,id,nameKey,descriptionKey,glyph,color,interactionDistance,stationTags,placementCost,placementTicks,workPositionPolicy,kitDefinitionId', 'station');
    define(row);
    tags(row.stationTags, 'station.stationTags', 1);
    amounts(row.placementCost, 'station.placementCost', ['material']);
    integer(row.placementTicks, 1, 10000, 'station.placementTicks');
    integer(row.interactionDistance, 0, 16, 'station.interactionDistance');
    if (row.workPositionPolicy !== 'adjacent-passable' || byId.get(row.kitDefinitionId!)?.category !== 'kit') fail('station');
  }
  for (const row of pack.recipes) {
    record(row, 'owner,id,nameKey,descriptionKey,inputs,outputs,stationTags,toolTag,workTicks,offlineEligible', 'recipe');
    define(row);
    amounts(row.inputs, 'recipe.inputs', ['material', 'kit']);
    amounts(row.outputs, 'recipe.outputs');
    if (row.outputs.some(output => output.count > byId.get(output.itemDefinitionId)!.maxStack)) fail('recipe.outputs.maxStack');
    tags(row.stationTags, 'recipe.stationTags');
    if (row.stationTags.length && !pack.stations.some(station => row.stationTags.every(tag => station.stationTags.includes(tag))))
      fail('recipe.stationTags');
    toolTag(row.toolTag, 'recipe.toolTag');
    integer(row.workTicks, 100, 10000, 'recipe.workTicks');
    if (typeof row.offlineEligible !== 'boolean') fail('recipe.offlineEligible');
  }
  record(pack.startupItems, 'instanceKey,items,overflow', 'startupItems');
  if (pack.startupItems.instanceKey !== 'crafting.startup' || pack.startupItems.overflow !== 'floor-then-skip') fail('startupItems');
  amounts(pack.startupItems.items, 'startupItems.items');
}
