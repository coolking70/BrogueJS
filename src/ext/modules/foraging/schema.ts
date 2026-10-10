import zhCN from './locales/zh_CN.json';
import type { EffectIntent } from '../../edibleSdk';
import type { ForagingLimits, ForagingPack } from './types';

const KIND_IDS = ['mend', 'venom', 'prism', 'astray', 'upheave', 'farsense', 'veil', 'drowse', 'blast', 'might', 'stiffen', 'quicken'] as const;
const APPEARANCE_IDS = ['whisper', 'frostbreath', 'stardust', 'echo', 'rune', 'prismshard', 'smoke', 'chime', 'moonsand', 'mirror', 'mistheart', 'needlelight', 'hush', 'warmstone', 'glaze', 'afterimage', 'backshadow', 'hourglass'] as const;
const REVEALS = ['if-injured', 'always', 'if-not-already', 'always', 'always', 'always', 'if-not-already', 'always', 'on-explosion', 'always', 'always', 'always'] as const;
const COMPANION_REVEALS = [true, true, false, true, true, false, false, true, false, true, true, true] as const;
const EFFECTS: readonly EffectIntent[] = [
  { kind: 'heal-fraction', percent: 30, min: 5 },
  { kind: 'status', status: 'poisoned', turns: 8 },
  { kind: 'status', status: 'hallucinating', turns: 100 },
  { kind: 'status', status: 'confused', turns: 8 },
  { kind: 'status-and-satiety', status: 'nauseous', turns: 15, satietyLoss: 300, floor: 150 },
  { kind: 'status', status: 'telepathy', turns: 150 },
  { kind: 'status', status: 'darkness', turns: 200 },
  { kind: 'status', status: 'slumber', turns: 25 },
  { kind: 'explosive' },
  { kind: 'temp-stat', turns: 400, player: { key: 'native.strength', value: 2 }, other: { key: 'native.physical-damage-dealt', category: 'more', valueBp: 2500 } },
  { kind: 'status', status: 'paralyzed', turns: 8 },
  { kind: 'status', status: 'haste', turns: 10 }
];
const MAX_LIMITS: Readonly<ForagingLimits> = Object.freeze({ kinds: 32, appearancePool: 64, edibleItems: 128, maxStack: 20, nodesPerLevel: 3, nodesPerRun: 120, nonEaters: 64, history: 64 });
const TEMPLATES = { roasted: 'ext.foraging.template.roasted', node: 'ext.foraging.template.node', tastedNote: 'ext.foraging.template.tasted_note', roastUnknownNote: 'ext.foraging.template.roast_unknown_note', called: 'ext.foraging.template.called', unknownDetail: 'ext.foraging.template.unknown_detail' };
const NEED = { owner: 'foraging', id: 'foraging.companion-satiety', role: 'satiety', max: 2150, initial: 1800, ticksPerPoint: 200, bands: [{ id: 'fed', atOrBelow: 2150 }, { id: 'hungry', atOrBelow: 300 }, { id: 'weak', atOrBelow: 150 }, { id: 'starving', atOrBelow: 0 }], zeroDeadlineTicks: 30000, departure: { visibleGraceTicks: 2000 } };
const PENALTIES = [{ band: 'weak', accuracyIncreasedBp: -2000, damageIncreasedBp: -2500 }, { band: 'starving', accuracyIncreasedBp: -4000, damageIncreasedBp: -5000 }];

function fail(field: string): never { throw new Error(`Invalid foraging definition: ${field}`); }

/** Inspect property descriptors first; malformed input must never invoke a getter. */
function json(value: unknown, field: string, ancestors = new Set<object>()): void {
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (!Number.isSafeInteger(value)) fail(field); return; }
  if (typeof value === 'string') {
    for (let i = 0; i < value.length; i++) {
      const unit = value.charCodeAt(i);
      if (unit >= 0xd800 && unit <= 0xdbff) { const next = value.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) fail(field); }
      else if (unit >= 0xdc00 && unit <= 0xdfff) fail(field);
    }
    return;
  }
  if (typeof value !== 'object' || ancestors.has(value)) fail(field);
  const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail(field);
  const keys = Reflect.ownKeys(value);
  if (array && keys.length !== value.length + 1) fail(field);
  ancestors.add(value);
  for (const key of keys) {
    if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key)) fail(field);
    json(key, field);
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor)) fail(`${field}.${key}`);
    if (array && key === 'length') continue;
    if (!descriptor.enumerable || (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) fail(field);
    json(descriptor.value, `${field}.${key}`, ancestors);
  }
  ancestors.delete(value);
}
function record(value: unknown, keys: string, field: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== keys.split(',').sort().join(',')) fail(field);
}
function integer(value: unknown, min: number, max: number, field: string): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail(field);
}
function list(value: unknown, min: number, max: number, field: string): void {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(field);
}
/** Object key order is irrelevant; array order is always significant. */
function equal(value: unknown, expected: unknown, field: string): void {
  if (expected === null || typeof expected !== 'object') { if (value !== expected) fail(field); return; }
  if (Array.isArray(expected)) {
    list(value, expected.length, expected.length, field);
    expected.forEach((child, index) => equal((value as unknown[])[index], child, `${field}.${index}`));
  } else {
    record(value, Object.keys(expected).join(','), field);
    for (const [key, child] of Object.entries(expected)) equal((value as Record<string, unknown>)[key], child, `${field}.${key}`);
  }
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 128 && /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(value);
}

/** Strict, pure and all-or-nothing validation before anything reaches registration. */
export function assertForagingPack(value: unknown, localeKeys: ReadonlySet<string> = new Set(Object.keys(zhCN))): asserts value is ForagingPack {
  json(value, 'pack');
  record(value, 'schema,moduleId,moduleVersion,rulesVersion,kinds,edibleItems,resourceNodes,knowledgeGroups,placementGroups,actorNeeds,companion,limits', 'pack');
  const pack = value as ForagingPack;
  if (pack.schema !== 1 || pack.moduleId !== 'foraging' || pack.moduleVersion !== '1.0.0' || pack.rulesVersion !== '1.0.0') fail('version');
  record(pack.limits, Object.keys(MAX_LIMITS).join(','), 'limits');
  for (const key of Object.keys(MAX_LIMITS) as (keyof ForagingLimits)[]) integer(pack.limits[key], 1, MAX_LIMITS[key], `limits.${key}`);
  list(pack.kinds, 12, Math.min(12, pack.limits.kinds), 'kinds');
  list(pack.edibleItems, 24, Math.min(24, pack.limits.edibleItems), 'edibleItems');
  list(pack.resourceNodes, 12, 12, 'resourceNodes');
  list(pack.knowledgeGroups, 1, 1, 'knowledgeGroups');
  list(pack.placementGroups, 1, 1, 'placementGroups');
  list(pack.actorNeeds, 1, 1, 'actorNeeds');
  const ids = new Set<string>();
  function define(row: { owner: string; id: string }): void {
    if (row.owner !== 'foraging' || !validId(row.id) || !row.id.startsWith('foraging.') || ids.has(row.id)) fail('id');
    ids.add(row.id);
  }
  function locale(key: unknown): void {
    if (typeof key !== 'string' || !key.startsWith('ext.foraging.') || !localeKeys.has(key)) fail('locale.key');
  }
  function label(row: { nameKey: string; descriptionKey: string }, stem: string): void {
    if (row.nameKey !== `ext.foraging.${stem}.name` || row.descriptionKey !== `ext.foraging.${stem}.description`) fail('locale.reference');
    locale(row.nameKey); locale(row.descriptionKey);
  }
  function appearance(row: { glyph: string; color: string; maxStack?: number; tags?: readonly string[] }, char = false): void {
    if (row.glyph !== (char ? '炭' : '菌') || row.color !== (char ? '#6B5B53' : '#B8A4E0')) fail('appearance');
    if ('maxStack' in row) { integer(row.maxStack, 1, pack.limits.maxStack, 'maxStack'); if (row.maxStack !== pack.edibleItems[0]!.maxStack) fail('knowledge.maxStack'); }
    if ('tags' in row) equal(row.tags, char ? [] : ['food.ingredient.mushroom'], 'tags');
  }
  let roastedIndex = 12;
  for (const [index, kind] of pack.kinds.entries()) {
    record(kind, 'id,minDepth,weight,satiety,reveal,companionReveal', 'kind');
    if (kind.id !== KIND_IDS[index] || kind.reveal !== REVEALS[index] || kind.companionReveal !== COMPANION_REVEALS[index]) fail('kind');
    integer(kind.minDepth, 1, 40, 'kind.minDepth'); integer(kind.weight, 1, 100, 'kind.weight'); integer(kind.satiety, 1, 2150, 'kind.satiety');
    const raw = pack.edibleItems[index]!;
    record(raw, 'owner,id,nameKey,descriptionKey,glyph,color,maxStack,tags,satiety,effect,fire', 'edibleItem'); define(raw);
    if (raw.id !== `foraging.${kind.id}` || raw.satiety !== kind.satiety) fail('raw');
    label(raw, `item.${kind.id}`); appearance(raw); equal(raw.effect, EFFECTS[index], 'raw.effect');
    equal(raw.fire, kind.id === 'blast'
      ? { onContact: 'explode', largeAtQuantity: 3, messageKey: 'ext.foraging.fire.exploded' }
      : { onContact: 'transform', to: `${raw.id}-roasted`, messageKey: 'ext.foraging.fire.roasted' }, 'raw.fire');
    locale(raw.fire.messageKey);
    if (kind.id !== 'blast') {
      const roasted = pack.edibleItems[roastedIndex++]!;
      record(roasted, 'owner,id,nameKey,descriptionKey,glyph,color,maxStack,tags,satiety,effect,fire', 'roasted'); define(roasted);
      if (roasted.id !== `${raw.id}-roasted` || roasted.satiety !== raw.satiety + 100) fail('roasted');
      integer(roasted.satiety, 1, 2150, 'roasted.satiety'); label(roasted, `item.${kind.id}-roasted`); appearance(roasted);
      equal(roasted.effect, { kind: 'derived-choice', domainId: 'foraging.roast-policy', ordinal: index, options: [raw.effect, { kind: 'none' }] }, 'roasted.effect');
      equal(roasted.fire, { onContact: 'transform', to: 'foraging.char', messageKey: 'ext.foraging.fire.charred' }, 'roasted.fire'); locale(roasted.fire.messageKey);
    }
    const node = pack.resourceNodes[index]!;
    record(node, 'owner,id,nameKey,descriptionKey,glyph,color,kind,yield,capacity,harvestTicks,unitsPerHarvest,requiredToolTag,regeneration,placement', 'node'); define(node);
    if (node.id !== `${raw.id}-patch` || node.kind !== 'fungus') fail('node'); label(node, `node.${kind.id}`); appearance(node);
    equal(node.yield, [{ itemDefinitionId: raw.id, count: 1 }], 'node.yield');
    if (node.capacity !== 3 || node.harvestTicks !== 100 || node.unitsPerHarvest !== 1 || node.requiredToolTag !== null) fail('node.work');
    equal(node.regeneration, { kind: 'periodic', units: 1, intervalTicks: 32000 }, 'node.regeneration');
    equal(node.placement, { dungeon: null, site: null }, 'node.placement');
  }
  const char = pack.edibleItems[23]!;
  record(char, 'owner,id,nameKey,descriptionKey,glyph,color,maxStack,tags,satiety,effect,fire', 'char'); define(char);
  if (char.id !== 'foraging.char' || char.satiety !== 20) fail('char'); label(char, 'item.char'); appearance(char, true);
  equal(char.effect, { kind: 'none' }, 'char.effect'); equal(char.fire, { onContact: 'burn-up', messageKey: 'ext.foraging.fire.burned' }, 'char.fire'); locale(char.fire.messageKey);

  const knowledge = pack.knowledgeGroups[0]!;
  record(knowledge, 'owner,id,kinds,appearancePool,assignmentDomainId,templates', 'knowledge'); define(knowledge);
  if (knowledge.id !== 'foraging.mushrooms' || knowledge.assignmentDomainId !== 'foraging.appearance') fail('knowledge');
  list(knowledge.kinds, 12, 12, 'knowledge.kinds');
  for (const [index, row] of knowledge.kinds.entries()) {
    const kind = pack.kinds[index]!;
    equal(row, { id: kind.id, raw: `foraging.${kind.id}`, roasted: kind.id === 'blast' ? null : `foraging.${kind.id}-roasted`, node: `foraging.${kind.id}-patch`, knownNameKey: `ext.foraging.kind.${kind.id}.name`, knownDescriptionKey: `ext.foraging.kind.${kind.id}.description` }, 'knowledge.kind');
    locale(row.knownNameKey); locale(row.knownDescriptionKey);
  }
  list(knowledge.appearancePool, 18, Math.min(18, pack.limits.appearancePool), 'appearancePool');
  for (const [index, row] of knowledge.appearancePool.entries()) {
    record(row, 'id,nameKey,descriptionKey', 'appearancePool.row');
    if (row.id !== APPEARANCE_IDS[index]) fail('appearancePool.id'); label(row, `appearance.${row.id}`);
  }
  equal(knowledge.templates, TEMPLATES, 'templates'); Object.values(knowledge.templates).forEach(locale);

  const group = pack.placementGroups[0]!;
  record(group, 'owner,id,members,perDepth,maxPerRun,preference', 'placementGroup'); define(group);
  if (group.id !== 'foraging.patches') fail('placementGroup.id');
  list(group.members, 12, 12, 'placementGroup.members');
  for (const [index, member] of group.members.entries()) equal(member, { resourceDefinitionId: pack.resourceNodes[index]!.id, minDepth: pack.kinds[index]!.minDepth, weight: pack.kinds[index]!.weight }, 'placementGroup.member');
  list(group.perDepth, 1, 40, 'perDepth');
  let previousDepth = 0;
  for (const range of group.perDepth) {
    record(range, 'fromDepth,toDepth,min,max', 'perDepth.range');
    integer(range.fromDepth, previousDepth + 1, 40, 'perDepth.fromDepth'); integer(range.toDepth, range.fromDepth, 40, 'perDepth.toDepth');
    integer(range.min, 0, 32, 'perDepth.min'); integer(range.max, range.min, Math.min(32, pack.limits.nodesPerLevel), 'perDepth.max');
    previousDepth = range.toDepth;
  }
  integer(group.maxPerRun, 1, pack.limits.nodesPerRun, 'maxPerRun');
  equal(group.preference, { tags: ['terrain.fungus-forest', 'terrain.luminescent-fungus'], radius: 3, preferredWeight: 4, otherWeight: 1 }, 'preference');
  define(pack.actorNeeds[0]!); equal(pack.actorNeeds[0], NEED, 'actorNeed');
  record(pack.companion, 'needId,component,penalties,nonEaters,residentQuery', 'companion');
  if (pack.companion.needId !== pack.actorNeeds[0]!.id || pack.companion.component !== 'hunger' || pack.companion.residentQuery !== 'settlement.resident-status.v1') fail('companion');
  equal(pack.companion.penalties, PENALTIES, 'companion.penalties');
  list(pack.companion.nonEaters, 0, pack.limits.nonEaters, 'nonEaters');
  for (const [index, id] of pack.companion.nonEaters.entries()) {
    if (typeof id !== 'string' || id.length > 128 || !/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(id) || (index > 0 && pack.companion.nonEaters[index - 1]! >= id)) fail('nonEaters');
  }
}
