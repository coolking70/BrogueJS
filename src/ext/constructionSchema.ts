/** Shared pure package validator; edible extension is supplied by its trusted owner. */
import type { ItemAmount } from './worldSdk';
import type { WorldDefinitionPack } from './structureTypes';
import { validId } from './json';
import { c5Canonical } from './worldJson';
import { World5Error } from './worldBasics';
const fail = (field: string): never => {
  throw new World5Error('C5_BAD_DEFINITION', field);
};
export function assertConstructionPack(
  value: unknown,
  owner: string,
  localeKeys?: ReadonlySet<string>,
  extras: { keys: readonly string[]; validate(pack: WorldDefinitionPack): void } = {
    keys: [],
    validate() {}
  }
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
  record(
    pack,
    'schema,worldSdk,items,resourceNodes,stations,recipes,startupItems' +
      ('structures' in pack ? ',structures' : '') +
      ('restPoints' in pack ? ',restPoints' : '') +
      extras.keys
        .filter((k) => k in pack)
        .map((k) => ',' + k)
        .join('')
  );
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
  const amounts = (v: readonly ItemAmount[], input = false, edible = false) => {
    list(v, 1, 8);
    const used = new Set<string>();
    for (const row of v) {
      record(row, 'itemDefinitionId,count');
      int(row.count, 1, 99);
      const definition =
        pack.items.find((d) => d.id === row.itemDefinitionId) ??
        (edible ? pack.edibleItems?.find((d) => d.id === row.itemDefinitionId) : undefined);
      if (
        !definition ||
        used.has(row.itemDefinitionId) ||
        (input &&
          !['material', 'kit'].includes('category' in definition ? definition.category : 'edible'))
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
    amounts(d.yield, false, true);
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
  for (let depth = 1; depth <= 40; depth++)
    if (
      pack.resourceNodes.reduce((n, d) => {
        const p = d.placement.dungeon;
        return n + (p && depth >= p.minDepth && depth <= p.maxDepth ? p.maxPerDepth : 0);
      }, 0) > 32
    )
      fail('placement.totalPerDepth');
  if (
    pack.resourceNodes.reduce(
      (n, d) => n + (d.placement.dungeon?.maxPerRun ?? 0) + (d.placement.site?.maxPerRun ?? 0),
      0
    ) > 512
  )
    fail('placement.totalPerRun');
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
  if (pack.structures !== undefined) list(pack.structures, 0, 128);
  if (pack.restPoints !== undefined) list(pack.restPoints, 0, 64);
  for (const d of pack.restPoints ?? []) {
    record(
      d,
      'owner,id,nameKey,descriptionKey,glyph,color,maxRestTicks,interactionDistance,restorePolicy,resetPolicy'
    );
    define(d);
    int(d.maxRestTicks, 100, 30000);
    int(d.interactionDistance, 0, 16);
    record(d.restorePolicy, 'hp,optionalCombatResources');
    if (
      d.maxRestTicks % 100 ||
      !['native-over-time', 'none'].includes(d.restorePolicy.hp) ||
      d.restorePolicy.optionalCombatResources !== 'none' ||
      d.resetPolicy !== 'none'
    )
      fail('restPoint.policy');
  }
  for (const d of pack.structures ?? []) {
    record(
      d,
      'owner,id,slot,barrierKind,nameKey,descriptionKey,maxHp,blocks,flammable,resistances,constructionCost,constructionTicks,refundNumerator,refundDenominator,containerCapacity,stationDefinitionId,restPointDefinitionId,tags'
    );
    define(d);
    tags(d.tags);
    if (
      !['floor', 'barrier', 'roof', 'fixture'].includes(d.slot) ||
      (d.slot === 'barrier'
        ? !['wall', 'door', 'window'].includes(d.barrierKind!)
        : d.barrierKind !== null)
    )
      fail('structure.slot');
    int(d.maxHp, 1, 1000000);
    int(d.constructionTicks, 1, 10000);
    int(d.refundDenominator, 1, 10000);
    int(d.refundNumerator, 0, d.refundDenominator);
    record(d.resistances, 'physical,fire');
    int(d.resistances.physical, 0, 100);
    int(d.resistances.fire, 0, 100);
    record(d.blocks, 'movement,vision,physicalProjectile,magicProjectile,gas,liquid');
    if (
      Object.values(d.blocks).some((v) => typeof v !== 'boolean') ||
      typeof d.flammable !== 'boolean'
    )
      fail('structure.blocks');
    amounts(d.constructionCost, true);
    if (d.slot === 'barrier') {
      const window = d.barrierKind === 'window';
      if (
        !d.blocks.movement ||
        !d.blocks.physicalProjectile ||
        !d.blocks.liquid ||
        d.blocks.vision === window ||
        d.blocks.gas === window
      )
        fail('barrier.blocks');
    }
    if (d.slot === 'floor' || d.slot === 'roof')
      if (Object.values(d.blocks).some(Boolean)) fail('structure.nonBlocking');
    if (d.containerCapacity !== null) {
      if (d.slot !== 'fixture') fail('container.slot');
      int(d.containerCapacity, 1, 64);
    }
    if (
      d.stationDefinitionId !== null &&
      (d.slot !== 'fixture' || !pack.stations.some((s) => s.id === d.stationDefinitionId))
    )
      fail('structure.station');
    if (
      d.restPointDefinitionId !== null &&
      (d.slot !== 'fixture' || !pack.restPoints?.some((r) => r.id === d.restPointDefinitionId))
    )
      fail('structure.restPoint');
  }
  extras.validate(pack);
  if (pack.startupItems) {
    record(pack.startupItems, 'instanceKey,items,overflow');
    amounts(pack.startupItems.items);
    if (!validId(pack.startupItems.instanceKey) || pack.startupItems.overflow !== 'floor-then-skip')
      fail('startup');
  }
}
/** Finite production policy; registering this never grants a Game/context writer. */
export function assertCampPolicy(
  value: unknown,
  owner: string,
  pack: WorldDefinitionPack,
  localeKeys?: ReadonlySet<string>
): asserts value is import('./structureSdk').CampPolicy {
  c5Canonical(value);
  const d = value as import('./structureSdk').CampPolicy;
  if (
    !d ||
    Object.keys(d).sort().join(',') !==
      'color,createCost,createTicks,descriptionKey,dismantleTicks,expandCost,expandTicks,glyph,markerDefinitionId,nameKey,requiredFood,retireTicks,supplyCapacity'
  )
    fail('camp.policy');
  if (
    !validId(d.markerDefinitionId) ||
    !d.markerDefinitionId.startsWith(owner + '.') ||
    !d.nameKey.startsWith('ext.' + owner + '.') ||
    !d.descriptionKey.startsWith('ext.' + owner + '.') ||
    (localeKeys && (!localeKeys.has(d.nameKey) || !localeKeys.has(d.descriptionKey))) ||
    [...d.glyph].length !== 1 ||
    !/^#[a-fA-F0-9]{6}$/.test(d.color)
  )
    fail('camp.identity');
  for (const k of [
    'createTicks',
    'expandTicks',
    'dismantleTicks',
    'retireTicks',
    'supplyCapacity'
  ] as const)
    if (!Number.isSafeInteger(d[k]) || d[k] < 1 || d[k] > (k === 'supplyCapacity' ? 64 : 10000))
      fail('camp.limit');
  if (d.requiredFood !== 2) fail('camp.food');
  for (const bill of [d.createCost, d.expandCost]) {
    if (!Array.isArray(bill) || bill.length < 1 || bill.length > 8) fail('camp.bill');
    const seen = new Set();
    for (const a of bill) {
      if (
        Object.keys(a).sort().join(',') !== 'count,itemDefinitionId' ||
        !Number.isSafeInteger(a.count) ||
        a.count < 1 ||
        a.count > 99 ||
        seen.has(a.itemDefinitionId) ||
        !pack.items.some(
          (d) =>
            d.id === a.itemDefinitionId &&
            d.category === 'material' &&
            d.tags.some((t) => t.startsWith('basic.'))
        )
      )
        fail('camp.cost');
      seen.add(a.itemDefinitionId);
    }
  }
}
