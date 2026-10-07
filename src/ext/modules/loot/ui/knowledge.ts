import { lootItemClass, validateLootItemData } from '../item';
import { ringImplicit } from '../economy';
import type { EffectiveLootCatalog, LootItemDataV1, LootModifierDraft, ModifierSpec } from '../types';
import type { LootKnowledgeFacts, LootKnownAffix, LootKnownItem } from './types';
import { exactLootKeys, freezeLootUi, isLootInteger, isPlainLootObject, LootUiError } from './errors';

function validateFacts(value: unknown): asserts value is LootKnowledgeFacts {
  if (!isPlainLootObject(value) || !exactLootKeys(value, ['v', 'location', 'ringKindKnown', 'magicPolarity', 'curseRevealed', 'hallucinating', 'familiarity'])) {
    throw new LootUiError('INVALID_INPUT', 'facts');
  }
  for (const [key, valid] of Object.entries({ v: value.v === 1,
    location: ['floor', 'pack', 'equipped'].includes(value.location as string),
    ringKindKnown: typeof value.ringKindKnown === 'boolean',
    magicPolarity: ['unknown', 'benign', 'malevolent'].includes(value.magicPolarity as string),
    curseRevealed: typeof value.curseRevealed === 'boolean', hallucinating: typeof value.hallucinating === 'boolean' })) {
    if (!valid) throw new LootUiError('INVALID_INPUT', `facts.${key}`);
  }
  const f = value.familiarity;
  if (f !== null && (!isPlainLootObject(f) || !exactLootKeys(f, ['unit', 'remaining'])
    || !['kills', 'turns'].includes(f.unit as string) || !isLootInteger(f.remaining))) {
    throw new LootUiError('INVALID_INPUT', 'facts.familiarity');
  }
}

export function projectLootKnowledge(data: LootItemDataV1, catalog: EffectiveLootCatalog,
  facts: LootKnowledgeFacts): LootKnownItem {
  if (!validateLootItemData(data, catalog)) throw new LootUiError('INVALID_ITEM', 'data');
  validateFacts(facts);
  const identified = data.affixes.every(row => row.known);
  if (facts.curseRevealed && !data.corrupted) throw new LootUiError('INCONSISTENT_FACTS', 'facts.curseRevealed');
  if ((facts.magicPolarity === 'malevolent' && !data.corrupted) || (facts.magicPolarity === 'benign' && data.corrupted)) {
    throw new LootUiError('INCONSISTENT_FACTS', 'facts.magicPolarity');
  }
  if (facts.familiarity !== null && (facts.location === 'floor' || identified)) {
    throw new LootUiError('INCONSISTENT_FACTS', 'facts.familiarity');
  }
  const itemClass = lootItemClass(data.baseId, catalog)!;
  const negativeKnown = data.affixes.some(row => row.known && catalog.affixes.some(def => def.id === row.id && def.polarity === -1));
  const corrupted = data.corrupted ? (identified || facts.curseRevealed || negativeKnown ? true : null) : (identified ? false : null);
  const floor = facts.location === 'floor';
  const affixes: LootKnownAffix[] = floor ? [] : data.affixes.map(row => {
    const def = catalog.affixes.find(def => def.id === row.id);
    const position = data.rarity === 'unique' ? 'row' : def!.position;
    return row.known ? { known: true, id: row.id, position, polarity: data.rarity === 'unique' ? 1 : def!.polarity,
      tier: row.tier, values: [...row.values] } : { known: false, position };
  });
  return freezeLootUi({ v: 1, location: facts.location, itemClass,
    baseId: itemClass === 'ring' && !facts.ringKindKnown ? null : data.baseId,
    rarity: floor && facts.hallucinating ? null : data.rarity, ilvl: floor ? null : data.ilvl,
    enhancement: data.enhancement, affixCount: floor ? null : data.affixes.length, affixes,
    uniqueId: !floor && data.rarity === 'unique' && identified ? data.uniqueId : null,
    rareName: !floor && data.rarity === 'rare' && identified ? [...data.nameParts!] as [number, number] : null,
    corrupted, identified, polarity: corrupted === true ? 'malevolent' : identified && corrupted === false ? 'benign' : facts.magicPolarity,
    familiarity: facts.familiarity === null ? null : { ...facts.familiarity } });
}

/** Resolve only an already disclosed row id; never infer an undisclosed unique identity. */
export function knownAffixModifiers(row: Extract<LootKnownAffix, { known: true }>, catalog: EffectiveLootCatalog): readonly ModifierSpec[] {
  const result = row.position === 'row'
    ? catalog.pack.uniques.uniques.flatMap(unique => unique.rows).find(def => def.rowId === row.id)?.modifiers
    : catalog.affixes.find(def => def.id === row.id)?.modifiers;
  if (!result) throw new LootUiError('UNKNOWN_AFFIX', 'item.affixes.id');
  return result;
}

/** Lightweight validation of the public, already redacted DTO; raw item data is not accepted. */
export function assertLootKnownItem(value: unknown, catalog: EffectiveLootCatalog): asserts value is LootKnownItem {
  const keys = ['v', 'location', 'itemClass', 'baseId', 'rarity', 'ilvl', 'enhancement', 'affixCount', 'affixes', 'uniqueId', 'rareName', 'corrupted', 'identified', 'polarity', 'familiarity'];
  if (!isPlainLootObject(value) || !exactLootKeys(value, keys) || value.v !== 1
    || !['floor', 'pack', 'equipped'].includes(value.location as string)
    || !['weapon', 'armor', 'ring'].includes(value.itemClass as string)
    || !isLootInteger(value.enhancement) || typeof value.identified !== 'boolean'
    || !['unknown', 'benign', 'malevolent'].includes(value.polarity as string)
    || (value.corrupted !== null && typeof value.corrupted !== 'boolean')
    || !Array.isArray(value.affixes)) throw new LootUiError('INVALID_INPUT', 'item');
  if (value.baseId === null ? value.itemClass !== 'ring' : typeof value.baseId !== 'string' || lootItemClass(value.baseId, catalog) !== value.itemClass) {
    throw new LootUiError('UNKNOWN_BASE', 'item.baseId');
  }
  if (value.rarity !== null && !catalog.pack.rarities.rarities.some(r => r.id === value.rarity)) throw new LootUiError('INVALID_INPUT', 'item.rarity');
  if (value.location === 'floor') {
    if (value.ilvl !== null || value.affixCount !== null || value.affixes.length || value.uniqueId !== null || value.rareName !== null) throw new LootUiError('INVALID_INPUT', 'item.location');
  } else if (!isLootInteger(value.ilvl, 1, 99) || value.rarity === null || value.affixCount !== value.affixes.length) {
    throw new LootUiError('INVALID_INPUT', 'item.ilvl');
  }
  if (value.rarity !== null && value.enhancement > catalog.pack.rarities.rarities.find(r => r.id === value.rarity)!.enhancementCap) throw new LootUiError('INVALID_INPUT', 'item.enhancement');
  for (let i = 0; i < value.affixes.length; i++) {
    const row = value.affixes[i];
    if (!isPlainLootObject(row) || typeof row.known !== 'boolean'
      || !['prefix', 'suffix', 'row'].includes(row.position as string)
      || !exactLootKeys(row, row.known ? ['known', 'id', 'position', 'polarity', 'tier', 'values'] : ['known', 'position'])) throw new LootUiError('INVALID_INPUT', `item.affixes.${i}`);
    if (row.known) {
      if (typeof row.id !== 'string' || ![1, -1].includes(row.polarity as number) || !isLootInteger(row.tier, 0, 6)
        || !Array.isArray(row.values) || Array.from(row.values).some(v => !isLootInteger(v, -Number.MAX_SAFE_INTEGER))) throw new LootUiError('INVALID_INPUT', `item.affixes.${i}`);
      const mods = knownAffixModifiers(row as unknown as Extract<LootKnownAffix, { known: true }>, catalog);
      if (mods.some(mod => !isLootInteger((row.values as number[])[mod.valueIndex], -Number.MAX_SAFE_INTEGER))) throw new LootUiError('INVALID_INPUT', `item.affixes.${i}.values`);
    }
  }
  // Held DTOs retain every row, so identification must be proved by those rows.
  // Floor rows are deliberately redacted and cannot be used for this equivalence.
  if (value.location !== 'floor') {
    if (value.identified !== value.affixes.every(row => row.known)) throw new LootUiError('INVALID_INPUT', 'item.identified');
    if ((value.uniqueId !== null) !== (value.rarity === 'unique' && value.identified)) throw new LootUiError('INVALID_INPUT', 'item.uniqueId');
    if ((value.rareName !== null) !== (value.rarity === 'rare' && value.identified)) throw new LootUiError('INVALID_INPUT', 'item.rareName');
  }
  if (value.uniqueId !== null && (typeof value.uniqueId !== 'string' || value.rarity !== 'unique' || !value.identified || !catalog.pack.uniques.uniques.some(u => u.id === value.uniqueId))) throw new LootUiError('INVALID_INPUT', 'item.uniqueId');
  if (value.uniqueId !== null) {
    const unique = catalog.pack.uniques.uniques.find(u => u.id === value.uniqueId)!;
    if ((value.baseId !== null && value.baseId !== unique.baseId) || unique.rows.length !== value.affixes.length
      || value.affixes.some((row, index) => !row.known || row.position !== 'row' || row.id !== unique.rows[index]!.rowId)) {
      throw new LootUiError('INVALID_INPUT', 'item.uniqueId');
    }
  }
  if (value.rareName !== null && (!Array.isArray(value.rareName) || value.rareName.length !== 2 || value.rarity !== 'rare' || !value.identified
    || !isLootInteger(value.rareName[0], 0, catalog.pack.rareNames.first.length - 1) || !isLootInteger(value.rareName[1], 0, catalog.pack.rareNames.second.length - 1))) throw new LootUiError('INVALID_INPUT', 'item.rareName');
  const f = value.familiarity;
  if (f !== null && (!isPlainLootObject(f) || !exactLootKeys(f, ['unit', 'remaining']) || !['kills', 'turns'].includes(f.unit as string)
    || !isLootInteger(f.remaining) || value.location === 'floor' || value.identified)) throw new LootUiError('INVALID_INPUT', 'item.familiarity');
}

export function knownModifierDrafts(item: LootKnownItem, catalog: EffectiveLootCatalog): LootModifierDraft[] {
  assertLootKnownItem(item, catalog);
  if (item.location === 'floor') return freezeLootUi([]);
  const drafts: LootModifierDraft[] = [];
  for (const row of item.affixes) {
    if (!row.known) continue;
    for (const mod of knownAffixModifiers(row, catalog)) drafts.push({ sourceId: row.id, stat: mod.stat,
      category: mod.category, slot: mod.slot ?? null, unit: mod.unit, value: row.values[mod.valueIndex]!,
      conditions: mod.conditions?.map(condition => ({ ...condition })), runicType: mod.runicType ?? null, known: true });
  }
  const add = (sourceId: string, stat: string, category: ModifierSpec['category'], unit: ModifierSpec['unit'], value: number) => {
    drafts.push({ sourceId, stat, category, slot: null, unit, value, conditions: undefined, runicType: null, known: true });
  };
  const base = item.baseId ?? 'unknown-ring';
  const rules = catalog.pack.enhancement;
  if (item.enhancement > 0) {
    const id = `${base}#enhancement`;
    if (item.itemClass === 'weapon') {
      add(id, 'loot.local.damage', 'local-increased', 'bp', item.enhancement * rules.weapon.localDamageBpPerLevel);
      add(id, 'native.weapon-enchant', 'flat', 'int', Math.floor(item.enhancement / rules.weapon.weaponEnchantEveryLevels));
    } else if (item.itemClass === 'armor') {
      add(id, 'native.max-hp', 'flat', 'int', item.enhancement * rules.armor.maxHpPerLevel);
      add(id, 'native.defense', 'flat', 'int', item.enhancement * rules.armor.defenseInternalPerLevel);
    } else add(id, 'loot.ring-implicit', 'flat', 'ring-point', Math.floor(item.enhancement / rules.ring.implicitEveryLevels));
  }
  if (item.itemClass === 'ring' && !(item.rarity === 'unique' && item.affixes.some(row => !row.known))) {
    add(`${base}#implicit`, 'loot.ring-implicit', 'flat', 'ring-point', ringImplicit(item.ilvl!, catalog.pack));
  }
  return freezeLootUi(drafts);
}
