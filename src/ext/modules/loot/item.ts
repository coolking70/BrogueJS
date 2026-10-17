import { matchRuneword, socketRows } from './sockets';
import { ITEM_RUNIC_TARGETS } from '../../itemSdk';
import { enhancementCap, ringImplicit } from './economy';
import type { EffectiveLootCatalog, ItemClass, LootAffixRoll, LootItemDataV1, LootModifierDraft, LootNativeFacts, ModifierSpec } from './types';

const itemKeys = ['v', 'baseId', 'ilvl', 'rarity', 'uniqueId', 'setId', 'pieceId', 'identityKnown', 'affixes', 'corrupted', 'enhancement', 'sockets', 'socketed', 'nameParts', 'origin'];
const rollKeys = ['id', 'tier', 'values', 'known'];
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return actual.length === keys.length && actual.every(k => typeof k === 'string' && keys.includes(k) && Object.getOwnPropertyDescriptor(value, k)?.enumerable === true && Object.getOwnPropertyDescriptor(value, k)?.get === undefined && Object.getOwnPropertyDescriptor(value, k)?.set === undefined);
}
function denseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === value.length + 1 && keys.every(k => k === 'length' || (typeof k === 'string' && /^(0|[1-9]\d*)$/.test(k) && Number(k) < value.length && Object.getOwnPropertyDescriptor(value, k)?.enumerable === true && Object.getOwnPropertyDescriptor(value, k)?.get === undefined && Object.getOwnPropertyDescriptor(value, k)?.set === undefined));
}
function integer(value: unknown, lo: number, hi: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= lo && (value as number) <= hi;
}
export function lootItemClass(baseId: string, catalog: EffectiveLootCatalog): ItemClass | null {
  const bases = catalog.pack.bases;
  if (bases.weapons.some(b => b.baseId === baseId)) return 'weapon';
  if (bases.armors.some(b => b.baseId === baseId)) return 'armor';
  if (bases.rings.some(b => b.baseId === baseId)) return 'ring';
  return null;
}
function valuesFit(values: unknown[], ranges: readonly (readonly [number, number])[]): boolean {
  return values.length === ranges.length && values.every((v, i) => integer(v, ranges[i]![0], ranges[i]![1]));
}
function rollShape(value: unknown): value is LootAffixRoll {
  return object(value) && exact(value, rollKeys) && typeof value.id === 'string' && integer(value.tier, 0, 6)
    && typeof value.known === 'boolean' && denseArray(value.values) && value.values.every(v => Number.isSafeInteger(v));
}

/** Strict V5 trust boundary. Malformed data is rejected without mutation or RNG. */
export function validateLootItemData(value: unknown, catalog: EffectiveLootCatalog): value is LootItemDataV1 {
  if (!object(value) || !exact(value, 'targetClass'in value?[...itemKeys,'targetClass']:itemKeys) || value.v !== 6 || typeof value.baseId !== 'string') return false;
  const itemClass = lootItemClass(value.baseId, catalog);
  if (!itemClass || !integer(value.ilvl, 1, 99) || !['normal', 'magic', 'rare', 'unique', 'set', 'runeword'].includes(value.rarity as string)) return false;
  if (typeof value.corrupted !== 'boolean' || typeof value.identityKnown !== 'boolean' || !integer(value.sockets,0,4) || !denseArray(value.socketed) || value.socketed.length > value.sockets) return false;
  if (!denseArray(value.affixes) || !value.affixes.every(rollShape)) return false;
  if (!object(value.origin) || !exact(value.origin, value.origin.source==='part'?['source','depth','bodyDefinitionId','partId']:value.origin.source==='craft'?['source','depth','recipeId']:['source', 'depth']) || !['floor', 'kill', 'encounter', 'vault','craft','part'].includes(value.origin.source as string) || value.origin.source==='craft' && (typeof value.origin.recipeId!=='string'||!/^crafting\.[a-z0-9.-]+$/.test(value.origin.recipeId)) || !integer(value.origin.depth, 1, 99)) return false;
  const rarity = catalog.pack.rarities.rarities.find(r => r.id === value.rarity);
  // A crafted normal base can later become a runeword through player socketing.
  const origin=value.origin;
  if(origin.source==='part'&&!catalog.partTables.some(t=>t.match.bodyDefinitionId===origin.bodyDefinitionId&&t.match.partIds!.includes(origin.partId as string)))return false;
  if(value.origin.source==='craft'&&(!['normal','magic','runeword'].includes(value.rarity as string)||!value.identityKnown||value.corrupted))return false;
  if (!rarity || !integer(value.enhancement, 0, rarity.enhancementCap)) return false;
  const socketBase=value.rarity==='normal'||value.rarity==='runeword';
  if(!socketBase&&(value.sockets!==0||value.socketed.length!==0))return false;
  if(itemClass==='ring'&&value.sockets!==0)return false;
  if(value.socketed.some(id=>typeof id!=='string'||!Object.prototype.hasOwnProperty.call(catalog.runesById,id)||!catalog.runesById[id]!.itemClasses.includes(itemClass as 'weapon'|'armor')))return false;
  if(value.socketed.length&&value.enhancement!==0)return false;
  if(socketBase){
    if(value.affixes.length||value.uniqueId!==null||value.setId!==null||value.pieceId!==null||value.nameParts!==null||value.corrupted||'targetClass'in value)return false;
    return (value.rarity==='runeword')===!!matchRuneword(catalog,itemClass,value.sockets,value.socketed as string[]);
  }
  if (value.rarity === 'rare') {
    if (!denseArray(value.nameParts) || value.nameParts.length !== 2 || !integer(value.nameParts[0], 0, catalog.pack.rareNames.first.length - 1) || !integer(value.nameParts[1], 0, catalog.pack.rareNames.second.length - 1)) return false;
  } else if (value.nameParts !== null) return false;
  if('targetClass'in value&&typeof value.targetClass!=='string')return false;
  const affixRows=value.affixes;
  if(value.targetClass!==undefined&&(!['slaying','immunity'].some(type=>affixRows.some(a=>catalog.affixes.find(d=>d.id===a.id)?.rune?.runicType===type))||!ITEM_RUNIC_TARGETS.some(t=>t.name===value.targetClass)))return false;
  if (value.identityKnown && !value.affixes.every(a=>a.known)) return false;
  if (value.rarity === 'set') {
    if(typeof value.pieceId!=='string'||typeof value.setId!=='string'||value.uniqueId!==null||value.corrupted)return false;
    const member=catalog.piecesById[value.pieceId];
    return !!member&&member.setId===value.setId&&member.piece.baseId===value.baseId&&member.piece.minIlvl<=value.ilvl
      &&value.affixes.length===member.piece.rows.length&&value.affixes.every((a,i)=>a.id===member.piece.rows[i]!.rowId&&a.tier===0&&valuesFit(a.values,member.piece.rows[i]!.ranges));
  }
  if(value.setId!==null||value.pieceId!==null||value.identityKnown!==value.affixes.every(a=>a.known))return false;
  if (value.rarity === 'unique') {
    if (typeof value.uniqueId !== 'string' || value.corrupted) return false;
    const unique = catalog.pack.uniques.uniques.find(u => u.id === value.uniqueId);
    return !!unique && unique.baseId === value.baseId && unique.minIlvl <= value.ilvl && value.affixes.length === unique.rows.length
      && value.affixes.every((a, i) => a.id === unique.rows[i]!.rowId && a.tier === 0 && valuesFit(a.values, unique.rows[i]!.ranges));
  }
  if (value.uniqueId !== null || !rarity.affixes || (value.corrupted && !catalog.pack.corruption.eligibleRarities.includes(value.rarity as 'magic' | 'rare'))) return false;
  const maxPositive = rarity.affixes.prefixMax + rarity.affixes.suffixMax;
  if (value.affixes.length > Math.min(6, maxPositive + (value.corrupted ? 1 : 0))) return false;
  const usedGroups = new Set<string>();
  let prefixes = 0;
  let suffixes = 0;
  let negatives = 0;
  let advanced = 0;
  for (const roll of value.affixes) {
    const affix = catalog.affixes.find(a => a.id === roll.id);
    if (!affix || !affix.itemClasses.includes(itemClass) || usedGroups.has(affix.group)) return false;
    if(affix.rune&&(!catalog.pack.affixes.runeFamilyEnabled||affix.rune.slot!==itemClass||(['slaying','immunity'].includes(affix.rune.runicType)&&typeof value.targetClass!=='string')))return false;
    usedGroups.add(affix.group);
    const tier = affix.tiers.find(t => t.tier === roll.tier);
    if (!tier || roll.tier < 1 || roll.tier > affix.maxTier || !valuesFit(roll.values, tier.ranges)) return false;
    const unlocked = catalog.pack.tiers.tiers.filter(t => t.enabled && t.minIlvl <= (value.ilvl as number) && t.tier <= affix.maxTier).map(t => t.tier);
    if (!unlocked.includes(roll.tier)) {
      const highest = Math.max(0, ...unlocked);
      if (!value.corrupted || affix.polarity !== 1 || roll.tier !== highest + 1 || ++advanced > 1) return false;
    }
    if (affix.polarity === -1) negatives++;
    else if (affix.position === 'prefix') prefixes++;
    else suffixes++;
  }
  return negatives === (value.corrupted ? 1 : 0) && prefixes <= rarity.affixes.prefixMax && suffixes <= rarity.affixes.suffixMax;
}

type Row = { roll: LootAffixRoll; modifiers: ModifierSpec[]; rune: { runicType: string } | null };
function itemRows(data: LootItemDataV1, catalog: EffectiveLootCatalog): Row[] {
  if (data.rarity === 'set') return data.affixes.map((roll,i)=>({roll,modifiers:catalog.piecesById[data.pieceId!]!.piece.rows[i]!.modifiers,rune:null}));
  if (data.rarity === 'unique') {
    const unique = catalog.pack.uniques.uniques.find(u => u.id === data.uniqueId);
    if (!unique) throw new RangeError('Unknown unique');
    return data.affixes.map((roll, i) => ({ roll, modifiers: unique.rows[i]!.modifiers, rune: null }));
  }
  return data.affixes.map(roll => {
    const affix = catalog.affixes.find(a => a.id === roll.id);
    if (!affix) throw new RangeError('Unknown affix');
    return { roll, modifiers: affix.modifiers, rune: affix.rune };
  });
}

export function deriveNativeFacts(data: LootItemDataV1, catalog: EffectiveLootCatalog): LootNativeFacts {
  const category = lootItemClass(data.baseId, catalog);
  if (!category) throw new RangeError('Unknown base');
  let implicit = category === 'ring' ? ringImplicit(data.ilvl, catalog.pack) : 0;
  let runicType: string | null = null;
  let runicStrength: number | null = null;
  for (const row of itemRows(data, catalog)) {
    if (row.rune) runicType = row.rune.runicType;
    for (const modifier of row.modifiers) {
      if (modifier.stat === 'loot.ring-implicit' && modifier.category === 'override') implicit = row.roll.values[modifier.valueIndex]!;
      if (modifier.runicType !== undefined) {
        runicType = modifier.runicType;
        runicStrength = row.roll.values[modifier.valueIndex] ?? null;
      }
    }
  }
  return { kind: data.baseId, category, enchantment: category === 'ring' ? implicit + Math.floor(data.enhancement / catalog.pack.enhancement.ring.implicitEveryLevels) : 0,
    runicType, runicStrength, isCursed: data.corrupted, identified: data.identityKnown };
}

export function projectItemModifiers(data: LootItemDataV1, catalog: EffectiveLootCatalog): LootModifierDraft[] {
  const drafts: LootModifierDraft[] = [];
  for (const row of itemRows(data, catalog)) {
    for (const modifier of row.modifiers) drafts.push({ sourceId: row.roll.id, stat: modifier.stat, category: modifier.category,
      slot: modifier.slot ?? null, unit: modifier.unit, value: row.roll.values[modifier.valueIndex]!,
      conditions: modifier.conditions, runicType: modifier.runicType ?? null, known: row.roll.known });
  }
  const category = lootItemClass(data.baseId, catalog);
  if (!category) throw new RangeError('Unknown base');
  for(const {row,sourceId} of socketRows(data,category,catalog))for(const m of row.modifiers)drafts.push({sourceId,stat:m.stat,category:m.category,slot:m.slot??null,unit:m.unit,value:row.ranges[m.valueIndex]![0],conditions:m.conditions,runicType:null,known:true});
  const add = (sourceId: string, stat: string, category: ModifierSpec['category'], unit: ModifierSpec['unit'], value: number) => drafts.push({ sourceId, stat, category, slot: null, unit, value, conditions: undefined, runicType: null, known: true });
  if (data.enhancement > 0) {
    const id = `${data.baseId}#enhancement`;
    const rules = catalog.pack.enhancement;
    if (category === 'weapon') {
      add(id, 'loot.local.damage', 'local-increased', 'bp', data.enhancement * rules.weapon.localDamageBpPerLevel);
      add(id, 'native.weapon-enchant', 'flat', 'int', Math.floor(data.enhancement / rules.weapon.weaponEnchantEveryLevels));
    } else if (category === 'armor') {
      add(id, 'native.max-hp', 'flat', 'int', data.enhancement * rules.armor.maxHpPerLevel);
      add(id, 'native.defense', 'flat', 'int', data.enhancement * rules.armor.defenseInternalPerLevel);
    } else add(id, 'loot.ring-implicit', 'flat', 'ring-point', Math.floor(data.enhancement / rules.ring.implicitEveryLevels));
  }
  if (category === 'ring') add(`${data.baseId}#implicit`, 'loot.ring-implicit', 'flat', 'ring-point', ringImplicit(data.ilvl, catalog.pack));
  return drafts;
}

export { enhancementCap, ringImplicit };
