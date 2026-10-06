/** Static content validation, before any run or ID allocator is touched. */
import type { ExtensionModule } from '../../ext/types';
import type { WorldDefinitionPack, ItemAmount } from '../../ext/worldSdk';
import { validId } from '../../ext/json';
import { c5Canonical } from './WorldCanonical';
import { deepFreeze } from '../Movement/SpatialSchema';
import { World5Error } from '../../ext/world5';
const fail = (field: string): never => {
  throw new World5Error('C5_BAD_DEFINITION', field);
};
export function assertWorldDefinitionPack(
  value: unknown,
  owner: string,
  localeKeys?: ReadonlySet<string>
): asserts value is WorldDefinitionPack {
  try {
    c5Canonical(value);
  } catch {
    fail('json');
  }
  const record = (v: any, keys: string) => {
    if (
      !v ||
      Array.isArray(v) ||
      Object.keys(v).sort().join(',') !== keys.split(',').sort().join(',')
    )
      fail(keys);
  };
  const int = (v: any, min: number, max: number) => {
    if (!Number.isSafeInteger(v) || v < min || v > max) fail('integer');
  };
  const list = (v: any, min: number, max: number) => {
    if (!Array.isArray(v) || v.length < min || v.length > max) fail('list');
  };
  const tags = (v: any, min = 0) => {
    list(v, min, 16);
    if (v.some((s: any, i: number) => !validId(s) || (i > 0 && v[i - 1] >= s))) fail('tags');
  };
  const pack = value as WorldDefinitionPack;
  record(pack, 'schema,worldSdk,items,resourceNodes,stations,recipes,startupItems');
  if (pack.schema !== 1 || pack.worldSdk !== 1) fail('version');
  for (const key of ['items', 'resourceNodes', 'stations', 'recipes'] as const)
    list(pack[key], 0, 128);
  if (pack.items.length + pack.stations.length > 128) fail('definitions');
  const ids = new Set<string>();
  const define = (v: any) => {
    if (v.owner !== owner || !validId(v.id) || !v.id.startsWith(owner + '.') || ids.has(v.id))
      fail('id');
    ids.add(v.id);
    for (const key of ['nameKey', 'descriptionKey'])
      if (
        typeof v[key] !== 'string' ||
        !v[key].startsWith('ext.' + owner + '.') ||
        (localeKeys && !localeKeys.has(v[key]))
      )
        fail(key);
    if (
      'glyph' in v &&
      (typeof v.glyph !== 'string' ||
        [...v.glyph].length !== 1 ||
        !/^#[a-fA-F0-9]{6}$/.test(v.color))
    )
      fail('appearance');
  };
  const amounts = (v: readonly ItemAmount[], input = false) => {
    list(v, 1, 8);
    const used = new Set<string>();
    for (const row of v) {
      record(row, 'itemDefinitionId,count');
      int(row.count, 1, 99);
      const definition = pack.items.find((d) => d.id === row.itemDefinitionId);
      if (
        !definition ||
        used.has(row.itemDefinitionId) ||
        (input && !['material', 'kit'].includes(definition.category))
      )
        fail('amount');
      used.add(row.itemDefinitionId);
    }
  };
  for (const d of pack.items) {
    record(
      d,
      'owner,id,nameKey,descriptionKey,category,glyph,color,maxStack,nativeTemplate,tags,tool'
    );
    define(d);
    tags(d.tags);
    int(d.maxStack, 1, 99);
    if (!['material', 'tool', 'kit', 'native'].includes(d.category)) fail('category');
    if (d.category === 'native') {
      if (
        !['dagger', 'leather_armor', 'ration_of_food'].includes(d.nativeTemplate!) ||
        d.tool !== null ||
        d.maxStack !== (d.nativeTemplate === 'ration_of_food' ? 99 : 1)
      )
        fail('native');
    } else if (d.nativeTemplate !== null) fail('native');
    if (d.category === 'tool') {
      record(d.tool, 'tag,maxDurability,durabilityPerBatch');
      if (!validId(d.tool!.tag) || !d.tags.includes(d.tool!.tag) || d.maxStack !== 1) fail('tool');
      int(d.tool!.maxDurability, 1, 1000000);
      int(d.tool!.durabilityPerBatch, 1, d.tool!.maxDurability);
    } else if (d.tool !== null) fail('tool');
  }
  for (const d of pack.resourceNodes) {
    record(
      d,
      'owner,id,nameKey,descriptionKey,glyph,color,kind,yield,capacity,harvestTicks,unitsPerHarvest,requiredToolTag,regeneration,placement'
    );
    define(d);
    if (!['wood', 'stone', 'ore', 'fiber', 'fungus'].includes(d.kind)) fail('node.kind');
    amounts(d.yield);
    int(d.capacity, 1, 9999);
    int(d.harvestTicks, 1, 10000);
    int(d.unitsPerHarvest, 1, Math.min(99, d.capacity));
    if (d.requiredToolTag !== null && !validId(d.requiredToolTag)) fail('toolTag');
    if (d.regeneration.kind === 'none') record(d.regeneration, 'kind');
    else {
      record(d.regeneration, 'kind,units,intervalTicks');
      if (d.regeneration.kind !== 'periodic') fail('regeneration');
      int(d.regeneration.units, 1, 99);
      int(d.regeneration.intervalTicks, 1, 1000000);
    }
    record(d.placement, 'dungeon,site');
    if (d.placement.dungeon) {
      const p = d.placement.dungeon;
      record(p, 'minDepth,maxDepth,maxPerDepth,maxPerRun,onNoSpace');
      int(p.minDepth, 1, 40);
      int(p.maxDepth, p.minDepth, 40);
      int(p.maxPerDepth, 1, 32);
      int(p.maxPerRun, 1, 512);
      if (!['skip', 'defer'].includes(p.onNoSpace)) fail('placement');
    }
    if (d.placement.site) {
      const p = d.placement.site;
      record(p, 'siteTags,maxPerSite,maxPerRun,onNoSpace');
      tags(p.siteTags);
      int(p.maxPerSite, 1, 32);
      int(p.maxPerRun, 1, 512);
      if (!['skip', 'defer'].includes(p.onNoSpace)) fail('placement');
    }
  }
  for(let depth=1;depth<=40;depth++)if(pack.resourceNodes.reduce((n,d)=>{const p=d.placement.dungeon;return n+(p&&depth>=p.minDepth&&depth<=p.maxDepth?p.maxPerDepth:0);},0)>32)fail('placement.totalPerDepth');
  if(pack.resourceNodes.reduce((n,d)=>n+(d.placement.dungeon?.maxPerRun??0)+(d.placement.site?.maxPerRun??0),0)>512)fail('placement.totalPerRun');
  for (const d of pack.stations) {
    record(
      d,
      'owner,id,nameKey,descriptionKey,glyph,color,interactionDistance,stationTags,placementCost,placementTicks,workPositionPolicy,kitDefinitionId'
    );
    define(d);
    tags(d.stationTags, 1);
    amounts(d.placementCost, true);
    int(d.placementTicks, 1, 10000);
    int(d.interactionDistance, 0, 16);
    if (
      d.workPositionPolicy !== 'adjacent-passable' ||
      (d.kitDefinitionId !== null &&
        pack.items.find((i) => i.id === d.kitDefinitionId)?.category !== 'kit')
    )
      fail('station');
  }
  for (const d of pack.recipes) {
    record(
      d,
      'owner,id,nameKey,descriptionKey,inputs,outputs,stationTags,toolTag,workTicks,offlineEligible'
    );
    define(d);
    amounts(d.inputs, true);
    amounts(d.outputs);
    tags(d.stationTags);
    int(d.workTicks, 1, 10000);
    if (typeof d.offlineEligible !== 'boolean' || (d.toolTag !== null && !validId(d.toolTag)))
      fail('recipe');
  }
  if (pack.startupItems) {
    record(pack.startupItems, 'instanceKey,items,overflow');
    amounts(pack.startupItems.items);
    if (!validId(pack.startupItems.instanceKey) || pack.startupItems.overflow !== 'floor-then-skip')
      fail('startup');
  }
}
export function validateWorldModule(
  module: ExtensionModule,
  worldSdk?: number,
  locales?: ReadonlySet<string>
): void {
  const declares = !!(
    module.worldDefinitions ||
    module.worldWorkCommands ||
    module.worldWorkParticipant
  );
  if (declares !== (worldSdk === 1) || (worldSdk !== undefined && worldSdk !== 1))
    throw new World5Error('C5_BAD_VERSION', 'worldSdk');
  if (!declares) return;
  if (module.worldDefinitions) {
    assertWorldDefinitionPack(module.worldDefinitions, module.id, locales);
    Object.defineProperty(module, 'worldDefinitions', {
      value: deepFreeze(structuredClone(module.worldDefinitions)),
      writable: false
    });
  }
  if (
    module.worldWorkCommands &&
    Object.entries(module.worldWorkCommands).some(
      ([action, command]) =>
        !['harvest', 'craft', 'place-station', 'cancel-work'].includes(action) ||
        !command ||
        Object.keys(command).join(',') !== 'prepare' ||
        typeof command.prepare !== 'function' ||
        module.commands?.[action]
    )
  )
    throw new World5Error('C5_BAD_DEFINITION', 'worldWorkCommands');
  if (
    module.worldWorkParticipant &&
    (Object.keys(module.worldWorkParticipant).join(',') !== 'onCommitted' ||
      typeof module.worldWorkParticipant.onCommitted !== 'function')
  )
    throw new World5Error('C5_BAD_DEFINITION', 'participant');
}
