import stationOperations from './data/stationOperations.json';
import { ITEM_RUNIC_TARGETS } from '../../itemSdk';
import ilvl from './data/ilvl.json';
import tiers from './data/tiers.json';
import bases from './data/bases.json';
import rarities from './data/rarities.json';
import affixes from './data/affixes.json';
import uniques from './data/uniques.json';
import sets from './data/sets.json';
import runes from './data/runes.json';
import runewords from './data/runewords.json';
import sockets from './data/sockets.json';
import runeDrops from './data/runeDrops.json';
import monsterClasses from './data/monsterClasses.json';
import dropTables from './data/dropTables.json';
import gold from './data/gold.json';
import presets from './data/presets.json';
import enhancement from './data/enhancement.json';
import identify from './data/identify.json';
import corruption from './data/corruption.json';
import salvage from './data/salvage.json';
import caps from './data/caps.json';
import rareNames from './data/rareNames.json';
import { extensionDataFingerprint } from '../../fingerprint';
import { assertLootPack, deepFreeze } from './schema';
import type { LootPack, LootRawFiles } from './types';
export const LOOT_VERSION = '0.6.0';
const files = { stationOperations, ilvl, tiers, bases, rarities, affixes, uniques, sets, runes, runewords, sockets, runeDrops, monsterClasses, dropTables, gold, presets, enhancement, identify, corruption, salvage, caps, rareNames };
let defaultPack: LootPack | undefined;
export function loadLootPack(raw?: LootRawFiles): LootPack {
  if(raw===undefined && defaultPack) return defaultPack;
  const value: unknown = raw===undefined ? files : raw;
  assertLootPack(value);
  const pack=deepFreeze(structuredClone(value));
  if(raw===undefined)defaultPack=pack;
  return pack;
}
let identity: { schema: number; version: string; fingerprint: string } | undefined;
export function getLootPackIdentity() {
  return identity ??= deepFreeze({schema:5,version:LOOT_VERSION,fingerprint:extensionDataFingerprint({pack:loadLootPack(),targets:ITEM_RUNIC_TARGETS})});
}
