import { validateAttributeCatalog } from '../../attributeCatalog';
import type { Json, ReadonlyJson, OptionalQueryResult } from '../../types';
import { extensionDataFingerprint } from '../../fingerprint';
import { isJson } from '../../json';
import { loadLootPack, getLootPackIdentity } from './definitions';
import { buildEffectiveLootCatalog } from './catalog';
import { defaultLootPickupFilter, normalizeLootPickupFilter } from './ui/viewModel';
import type { LootAvailability } from './types';

export const LOOT_MODULE_VERSION = '0.9.0';
export const DEFAULT_CONFIGURATION = { presetId: 'standard' };
export function validConfiguration(value: unknown): value is Json {
  return isJson(value) && !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).join(',') === 'presetId'
    && loadLootPack().presets.presets.some(p => p.id === value.presetId);
}
export function lootRules(configuration: Json = DEFAULT_CONFIGURATION) {
  if (!validConfiguration(configuration)) throw new Error('Invalid loot configuration');
  return { schema: 1, version: LOOT_MODULE_VERSION,
    fingerprint: extensionDataFingerprint({ integration: LOOT_MODULE_VERSION, pack: getLootPackIdentity().fingerprint, configuration }) };
}
export function resolveLootCatalog(query: (capability: string, input: Json) => OptionalQueryResult) {
  const keys = [...new Set(loadLootPack().affixes.affixes.filter(a => a.requires?.module === 'combat').map(a => a.requires!.key))];
  const result = query('foundation.stats.v1', { keys });
  const available = result.status === 'available' ? result.value as {keys: {id: string; available: boolean}[]} : null;
  const stats = available?.keys.filter(k => k.available).map(k => k.id) ?? [];
  const encounters = query('foundation.item-encounters.v1', {});
  const forms = encounters.status === 'available' ? (encounters.value as {owners: {owner: string; formIds: string[]}[]}).owners.filter(o => o.owner === 'giants').flatMap(o => o.formIds) : [];
  const growthResult = query('growth.attributes.v1', {v:1});
  let growth: LootAvailability['growth'] = null;
  if (growthResult.status === 'available') {
    validateAttributeCatalog(growthResult.value);
    const catalog = growthResult.value;
    const requested = ['growth.focus-capacity','growth.xp-gain',...catalog.attributes.map(a=>a.stat)];
    const declared = query('foundation.stats.v1', {keys:requested});
    if(declared.status!=='available')throw new Error('Missing stat capability');
    const rows = (declared.value as {keys:{id:string;available:boolean}[]}).keys;
    if(catalog.attributes.some(a=>!rows.some(k=>k.id===a.stat&&k.available)))throw new Error('Undeclared growth attribute');
    growth={stats:[...rows.filter(k=>k.available).map(k=>k.id),'growth.attribute'],attributes:catalog.attributes.filter(a=>a.equipment).map(a=>a.id),fingerprint:catalog.fingerprint};
  } else if(growthResult.reason!=='absent')throw new Error('Unsupported growth catalog');
  const bodies=query('foundation.item-bodies.v1',{});
  const bodyRows=bodies.status==='available'?(bodies.value as unknown as import('../../itemSdk').ItemBodyCapability).bodies:[];
  const availability: LootAvailability = { bodies:bodyRows, combat: stats.length ? {stats} : null, growth, giants: forms.length ? {formIds: forms} : null };
  return buildEffectiveLootCatalog(loadLootPack(), availability);
}
export type LootState = { v: 2; presetId: string; created: boolean; revision: number; catalogFingerprint: string;
  setMask: string; uniqueMask: number; watermark: number; filter: {v:1; minRarity:'normal'|'magic'|'rare'|'unique'|'set'; classes:('weapon'|'armor'|'ring')[]; autoPickupGold:boolean} };
export const stateOf = (state: ReadonlyJson): LootState => state as unknown as LootState;
export function initialLootState(presetId: string, catalogFingerprint: string): LootState {
  return { v: 2, setMask: "0".repeat(32), presetId, created: false, revision: 0, catalogFingerprint, uniqueMask: 0, watermark: 0,
    filter: structuredClone(defaultLootPickupFilter(presetId)) as LootState['filter'] };
}
export function validLootState(value: unknown, presetId: string, fingerprint: string): value is Json {
  if (!isJson(value) || !value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as unknown as LootState;
  try { return Object.keys(s).sort().join(',') === 'catalogFingerprint,created,filter,presetId,revision,setMask,uniqueMask,v,watermark'
    && s.v === 2 && s.presetId === presetId && s.catalogFingerprint === fingerprint && typeof s.created === 'boolean'
    && Number.isSafeInteger(s.revision) && s.revision >= 0 && (s.created ? s.revision > 0 : s.revision === 0)
    && Number.isSafeInteger(s.uniqueMask) && s.uniqueMask >= 0 && s.uniqueMask < 256
    && typeof s.setMask==='string' && /^[0-9a-f]{32}$/.test(s.setMask)
    && BigInt('0x'+s.setMask) < (1n << BigInt(loadLootPack().sets.sets.reduce((n,set)=>n+set.pieces.length,0)))
    && Number.isSafeInteger(s.watermark) && s.watermark >= 0
    && JSON.stringify(normalizeLootPickupFilter(s.filter)) === JSON.stringify(s.filter)
    && new TextEncoder().encode(JSON.stringify(s)).length <= 4096;
  } catch { return false; }
}
