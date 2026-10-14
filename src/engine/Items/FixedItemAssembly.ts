/** Sole deterministic native equipment constructor shared by C5 and C6. */
import { Item, ItemCategory } from './Item';
import { ItemLoader } from './ItemLoader';
import weapons from '../../data/weapons.json';
import armors from '../../data/armors.json';
import arcana from '../../data/arcana.json';
import type { NativeAssembly, DropItemSpec } from '../../ext/itemSdk';
import { assertItemJson, copyItemValue, ItemDataError } from './ItemData';
export const FIXED_EQUIPMENT_BASES = Object.freeze({
  weapon: Object.freeze(weapons.filter(w => !['dart', 'incendiary_dart', 'javelin', 'halberd'].includes(w.id)).map(w => w.id)),
  armor: Object.freeze(armors.map(a => a.id)),
  ring: Object.freeze(arcana.rings.map(r => r.id))
});
export function assembleNativeTemplate(kind: string, quantity = 1): Item {
  const weapon = weapons.find(w => w.id === kind), armor = armors.find(a => a.id === kind), ring = arcana.rings.find(r => r.id === kind);
  if (!weapon && !armor && !ring && kind !== 'ration_of_food') throw new ItemDataError('C6_DATA');
  const item = new Item(ItemLoader.translateName(weapon?.name ?? armor?.name ?? ring?.name ?? 'Ration of Food'),
    weapon ? ')' : armor ? ']' : ring ? '=' : '%', weapon ? 0xcccccc : armor ? 0x888888 : ring ? ring.color : 0xddaa55,
    weapon ? ItemCategory.WEAPON : armor ? ItemCategory.ARMOR : ring ? ItemCategory.RING : ItemCategory.FOOD);
  item.quantity = quantity; item.identified = true; item.canBeIdentified = false;
  if (weapon || armor || ring) item.identityId = kind; else item.consumableId = kind;
  item.weight = weapon?.weight ?? armor?.weight ?? ring?.weight ?? 5;
  if (weapon) { item.damage = weapon.damage; item.clumping = weapon.clumping; item.strengthRequired = weapon.strengthRequired; item.flags = [...(weapon.flags ?? [])]; }
  if (armor) { item.armor = armor.armor; item.strengthRequired = armor.strengthRequired; }
  return item;
}
export function validateNativeAssembly(native: NativeAssembly): void {
  assertItemJson(native);
  if (Object.keys(native).sort().join(',') !== 'category,enchantment,familiarityRemaining,identified,isCursed,kind,runicType'
      || !FIXED_EQUIPMENT_BASES[native.category]?.includes(native.kind)
      || !Number.isSafeInteger(native.enchantment) || Math.abs(native.enchantment) > 100
      || native.category !== 'ring' && native.enchantment !== 0
      || !Number.isSafeInteger(native.familiarityRemaining) || native.familiarityRemaining < 0 || native.familiarityRemaining > 100000
      || typeof native.identified !== 'boolean' || typeof native.isCursed !== 'boolean'
      || native.runicType !== null && !(native.category === 'weapon' ? ItemLoader.WEAPON_RUNIC_BY_CE_INDEX : native.category === 'armor' ? ItemLoader.ARMOR_RUNIC_BY_CE_INDEX : []).includes(native.runicType))
    throw new ItemDataError('C6_DATA');
}
export function assembleDropItem(spec: DropItemSpec): Item {
  validateNativeAssembly(spec.native);
  const n = spec.native, item = assembleNativeTemplate(n.kind);
  item.enchantment = n.enchantment; item.identified = n.identified; item.canBeIdentified = !n.identified;
  item.isCursed = n.isCursed; item.charges = n.familiarityRemaining;
  if (n.runicType !== null) { item.runicType = n.runicType; (item.flags ??= []).push('ITEM_RUNIC'); }
  item.moduleData = copyItemValue(spec.moduleData) as Record<string, import('../../ext/types').Json>;
  return item;
}
