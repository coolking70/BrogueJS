import { describe, expect, it } from 'vitest';
import data from '../data/definitions.json';
import zhCN from '../locales/zh_CN.json';
import { assertForagingPack } from '../schema';
import { getForagingPackIdentity, loadForagingPack, toWorldDefinitionPack } from '../definitions';
import { extensionDataFingerprint } from '../../../fingerprint';
import { assertWorldDefinitionPack } from '../../../../engine/Core/WorldDefinitions';

type Path = (string | number)[];
const clone = (): Record<string, unknown> => structuredClone(data) as unknown as Record<string, unknown>;
const at = (v: unknown, path: Path): unknown => path.reduce<unknown>((row, key) => (row as Record<string | number, unknown>)[key], v);
function set(v: unknown, path: Path, next: unknown): void { (at(v, path.slice(0, -1)) as Record<string | number, unknown>)[path[path.length - 1]!] = next; }
function entries(value: unknown, path: Path = []): { path: Path; value: unknown }[] {
  const result = [{ path, value }];
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) result.push(...entries(child, [...path, Array.isArray(value) ? Number(key) : key]));
  return result;
}
const invalid: [string, unknown][] = [
  ['schema', 2], ['moduleId', 'other'], ['moduleVersion', '1.0.1'], ['rulesVersion', '1.1.0'],
  ['kinds', []], ['edibleItems', null], ['resourceNodes', {}], ['knowledgeGroups', []], ['placementGroups', []], ['actorNeeds', []],
  ['kinds.0.id', 'venom'], ['kinds.0.minDepth', 0], ['kinds.0.minDepth', 41], ['kinds.0.weight', 0], ['kinds.0.weight', 101], ['kinds.0.satiety', 0], ['kinds.0.satiety', 2151], ['kinds.0.reveal', 'always'], ['kinds.0.companionReveal', 'true'],
  ['edibleItems.0.id', 'foreign.mend'], ['edibleItems.0.owner', 'foreign'], ['edibleItems.1.id', 'foraging.mend'], ['resourceNodes.0.id', 'foraging.mend'], ['knowledgeGroups.0.id', 'foraging.mend'], ['placementGroups.0.id', 'foraging.mend'], ['actorNeeds.0.id', 'foraging.mend'],
  ['edibleItems.0.nameKey', 'ext.other.name'], ['edibleItems.0.descriptionKey', 'ext.foraging.missing'], ['edibleItems.0.glyph', '?'], ['edibleItems.0.color', '#112233'], ['edibleItems.0.maxStack', 21], ['edibleItems.0.maxStack', 0], ['edibleItems.0.satiety', 201], ['edibleItems.0.effect.percent', 31], ['edibleItems.0.effect', { kind: 'none' }], ['edibleItems.0.fire.to', 'foraging.venom-roasted'],
  ['edibleItems.12.effect.options.0.percent', 31], ['edibleItems.12.effect.ordinal', 1], ['edibleItems.12.effect.domainId', 'other.policy'], ['edibleItems.12.effect.options.1', { kind: 'explosive' }], ['edibleItems.12.effect.options', [{ kind: 'none' }]], ['edibleItems.12.satiety', 301], ['edibleItems.12.glyph', '烤'], ['edibleItems.12.color', '#C8966A'], ['edibleItems.12.maxStack', 19], ['edibleItems.12.tags', []], ['edibleItems.12.fire.to', 'foraging.mend'],
  ['edibleItems.8.fire', { onContact: 'transform', to: 'foraging.blast-roasted', messageKey: 'ext.foraging.fire.roasted' }], ['edibleItems.8.fire.largeAtQuantity', 2], ['edibleItems.23.tags', ['food.ingredient.mushroom']], ['edibleItems.23.fire', { onContact: 'explode', largeAtQuantity: 3, messageKey: 'ext.foraging.fire.exploded' }], ['edibleItems.23.effect', { kind: 'explosive' }],
  ['resourceNodes.0.glyph', '*'], ['resourceNodes.0.color', '#112233'], ['resourceNodes.0.kind', 'wood'], ['resourceNodes.0.yield.0.itemDefinitionId', 'foraging.venom'], ['resourceNodes.0.yield.0.count', 2], ['resourceNodes.0.capacity', 4], ['resourceNodes.0.harvestTicks', 99], ['resourceNodes.0.unitsPerHarvest', 2], ['resourceNodes.0.regeneration.intervalTicks', 32001], ['resourceNodes.0.placement.site', {}], ['resourceNodes.0.requiredToolTag', 'basic.pick'],
  ['knowledgeGroups.0.kinds.8.roasted', 'foraging.blast-roasted'], ['knowledgeGroups.0.kinds.0.raw', 'foraging.venom'], ['knowledgeGroups.0.kinds.0.node', 'foraging.venom-patch'], ['knowledgeGroups.0.kinds.0.knownNameKey', 'ext.foraging.kind.venom.name'], ['knowledgeGroups.0.appearancePool.0.id', 'echo'], ['knowledgeGroups.0.assignmentDomainId', 'foreign.appearance'], ['knowledgeGroups.0.templates.roasted', 'ext.foraging.missing'],
  ['placementGroups.0.members.0.resourceDefinitionId', 'foraging.venom-patch'], ['placementGroups.0.members.0.minDepth', 2], ['placementGroups.0.members.0.weight', 11], ['placementGroups.0.perDepth.0.max', 4], ['placementGroups.0.perDepth.0.min', -1], ['placementGroups.0.perDepth.0.fromDepth', 0], ['placementGroups.0.perDepth.0.toDepth', 41], ['placementGroups.0.perDepth.1.fromDepth', 3], ['placementGroups.0.maxPerRun', 121], ['placementGroups.0.preference.radius', 4],
  ['actorNeeds.0.max', 2151], ['actorNeeds.0.initial', 1799], ['actorNeeds.0.ticksPerPoint', 199], ['actorNeeds.0.bands.1.atOrBelow', 301], ['actorNeeds.0.zeroDeadlineTicks', 30001], ['actorNeeds.0.departure.visibleGraceTicks', 2001], ['companion.needId', 'foraging.missing'], ['companion.component', 'other'], ['companion.penalties.0.band', 'hungry'], ['companion.penalties.1.damageIncreasedBp', -4999], ['companion.residentQuery', 'other.query'], ['companion.nonEaters', ['zombie', 'bloat']], ['companion.nonEaters', ['bloat', 'bloat']], ['companion.nonEaters', ['BAD']],
  ['limits.kinds', 11], ['limits.appearancePool', 17], ['limits.edibleItems', 23], ['limits.maxStack', 19], ['limits.nodesPerLevel', 2], ['limits.nodesPerRun', 119], ['limits.nonEaters', 19]
];

describe('foraging strict package schema (T1)', () => {
  it('accepts the authoritative pack and the actual foundation validators', () => {
    const pack = loadForagingPack();
    expect(() => assertForagingPack(pack)).not.toThrow();
    expect(() => assertWorldDefinitionPack(toWorldDefinitionPack(pack), 'foraging', new Set(Object.keys(zhCN)))).not.toThrow();
  });
  it.each(invalid)('rejects %s = %j', (path, replacement) => { const value = clone(); set(value, path.split('.'), replacement); expect(() => assertForagingPack(value)).toThrow(); });
  const objects = entries(data).filter(row => row.value && typeof row.value === 'object' && !Array.isArray(row.value));
  it.each(objects.map(row => [row.path.join('.') || 'root', row.path] as const))('strict keys at every object: %s', (_name, path) => {
    for (const mode of ['extra', 'missing', 'undefined']) {
      const value = clone(), target = at(value, path) as Record<string, unknown>, first = Object.keys(target)[0]!;
      if (mode === 'extra') target.unexpected = 1; else if (mode === 'missing') delete target[first]; else target[first] = undefined;
      expect(() => assertForagingPack(value)).toThrow();
    }
  });
  it.each(Object.entries(data.limits))('enforces safe and non-relaxed limit %s', (key, max) => {
    for (const amount of [max + 1, 0, 0.5, Number.MAX_SAFE_INTEGER + 1]) { const value = clone(); set(value, ['limits', key], amount); expect(() => assertForagingPack(value)).toThrow(); }
  });
  it('permits stricter valid limits and a reviewed sorted nonEaters edit', () => {
    const value = clone(); set(value, ['limits', 'kinds'], 12); set(value, ['limits', 'appearancePool'], 18); set(value, ['limits', 'edibleItems'], 24); set(value, ['companion', 'nonEaters'], ['bloat', 'zombie']);
    expect(() => assertForagingPack(value)).not.toThrow();
  });
  it('rejects every non-JSON value, invalid unicode, exotic prototype, sparse or embellished array', () => {
    for (const replacement of [undefined, () => 1, 1n, Symbol('x'), NaN, Infinity, new Date(0), new Map(), Object.create({ inherited: true }), '\ud800']) { const value = clone(); set(value, ['kinds', 0, 'weight'], replacement); expect(() => assertForagingPack(value)).toThrow(); }
    for (const change of [
      (v: Record<string, unknown>) => { v.self = v; },
      (v: Record<string, unknown>) => { Object.defineProperty(v, '__proto__', { value: {}, enumerable: true }); },
      (v: Record<string, unknown>) => { Object.defineProperty(v, 'hidden', { value: true }); },
      (v: Record<string, unknown>) => { Object.defineProperty(v, Symbol('hidden'), { value: true }); },
      (v: Record<string, unknown>) => { Object.setPrototypeOf(v, { polluted: true }); },
      (v: Record<string, unknown>) => { delete (v.kinds as unknown[])[0]; },
      (v: Record<string, unknown>) => { Object.assign(v.kinds as object, { extra: true }); },
      (v: Record<string, unknown>) => { Object.defineProperty(v.kinds, Symbol('hidden'), { value: true }); }
    ]) { const value = clone(); change(value); expect(() => assertForagingPack(value)).toThrow(); }
  });
  it('rejects accessors without invoking them at any depth', () => {
    for (const path of [['schema'], ['kinds', 0], ['edibleItems', 0, 'effect', 'percent']] as Path[]) {
      const value = clone(); let calls = 0;
      Object.defineProperty(at(value, path.slice(0, -1)), path[path.length - 1]!, { enumerable: true, get() { calls++; return 1; } });
      expect(() => assertForagingPack(value)).toThrow(); expect(calls).toBe(0);
    }
  });
  it('requires every referenced name, description, message and template key', () => {
    const keys = new Set(entries(data).filter(row => typeof row.value === 'string' && row.value.startsWith('ext.foraging.')).map(row => row.value as string));
    for (const key of keys) { const localeKeys = new Set(Object.keys(zhCN)); localeKeys.delete(key); expect(() => assertForagingPack(clone(), localeKeys), key).toThrow(); }
  });
  it('rejects each mechanical array reorder where order is constrained', () => {
    for (const path of [['kinds'], ['edibleItems'], ['resourceNodes'], ['knowledgeGroups', 0, 'kinds'], ['knowledgeGroups', 0, 'appearancePool'], ['placementGroups', 0, 'members'], ['actorNeeds', 0, 'bands'], ['companion', 'penalties']] as Path[]) {
      const value = clone(); set(value, path, [...at(value, path) as unknown[]].reverse()); expect(() => assertForagingPack(value)).toThrow();
    }
  });
});

describe('foraging complete mechanical identity (T1)', () => {
  it('is stable, independently cloned, and fingerprints the complete validated pack', () => {
    const a = loadForagingPack(), b = loadForagingPack();
    expect(a).not.toBe(b); expect(a.edibleItems[0]).not.toBe(b.edibleItems[0]);
    expect(getForagingPackIdentity(a)).toEqual(getForagingPackIdentity(b));
    expect(getForagingPackIdentity(a)).toEqual({ schema: 1, version: '1.0.0', fingerprint: 'sha256:d2e0803474a80f1adfc41680351199da38b7f3e8129df3d58ffd0349488d936f' });
    expect(getForagingPackIdentity(a).fingerprint).toBe(extensionDataFingerprint(a));
  });
  it('covers every reorderable mechanical array, including nested arrays', () => {
    const fingerprint = extensionDataFingerprint(data);
    for (const { path, value } of entries(data).filter(row => Array.isArray(row.value) && row.value.length > 1)) { const changed = clone(); set(changed, path, [...value as unknown[]].reverse()); expect(extensionDataFingerprint(changed), path.join('.')).not.toBe(fingerprint); }
  });
  it('covers every numeric leaf', () => {
    const fingerprint = extensionDataFingerprint(data);
    for (const { path, value } of entries(data).filter(row => typeof row.value === 'number')) { const changed = clone(); set(changed, path, (value as number) + 1); expect(extensionDataFingerprint(changed), path.join('.')).not.toBe(fingerprint); }
  });
  it('changes for a valid tighter limit and ignores locale text', () => {
    const pack = loadForagingPack(), before = getForagingPackIdentity(pack);
    const locale = { ...zhCN, 'ext.foraging.ui.title': '采食测试' };
    assertForagingPack(pack, new Set(Object.keys(locale))); expect(getForagingPackIdentity(pack)).toEqual(before);
    pack.limits.kinds--; expect(getForagingPackIdentity(pack).fingerprint).not.toBe(before.fingerprint);
  });
  it('deep-copies exactly the SDK arrays in original order and omits module-only rules', () => {
    const pack = loadForagingPack(), world = toWorldDefinitionPack(pack);
    expect(world).toEqual({ schema: 1, worldSdk: 1, items: [], resourceNodes: pack.resourceNodes, stations: [], recipes: [], startupItems: null, edibleItems: pack.edibleItems, knowledgeGroups: pack.knowledgeGroups, placementGroups: pack.placementGroups, actorNeeds: pack.actorNeeds });
    for (const key of ['resourceNodes', 'edibleItems', 'knowledgeGroups', 'placementGroups', 'actorNeeds'] as const) { expect(world[key]).not.toBe(pack[key]); expect(world[key]![0]).not.toBe(pack[key][0]); }
    pack.edibleItems[0]!.satiety = 999; expect(world.edibleItems![0]!.satiety).toBe(200);
  });
});
