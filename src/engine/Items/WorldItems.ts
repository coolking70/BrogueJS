/** Fixed C5 assembly. Never calls the random spawning pipeline. */
import { Item, ItemCategory } from './Item';
import type { ItemDefinitionContribution } from '../../ext/worldSdk';
import weapons from '../../data/weapons.json';
import armors from '../../data/armors.json';
import { ItemLoader } from './ItemLoader';
const definitions = new WeakMap<Item, ItemDefinitionContribution>();
export function bindWorldItem(item: Item, definition: ItemDefinitionContribution): void {
  if (
    item.category !== ItemCategory.MATERIAL ||
    item.worldItem?.definitionId !== definition.id ||
    definition.category === 'native'
  )
    throw new Error('C5_BAD_DEFINITION');
  definitions.set(item, definition);
}
export const worldItemDefinition = (item: Item) => definitions.get(item);
export const worldItemMaxStack = (item: Item) => definitions.get(item)?.maxStack ?? 99;
export function assembleWorldItem(definition: ItemDefinitionContribution, quantity = 1): Item {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > definition.maxStack)
    throw new Error('C5_BAD_PAYLOAD');
  if (definition.category !== 'native') {
    const item = new Item(
      definition.nameKey,
      definition.glyph,
      parseInt(definition.color.slice(1), 16),
      ItemCategory.MATERIAL
    );
    item.worldItem = {
      definitionId: definition.id,
      quality: 'basic',
      toolDurability: definition.tool?.maxDurability ?? null
    };
    item.description = definition.descriptionKey;
    item.quantity = quantity;
    item.identified = true;
    item.canBeIdentified = false;
    bindWorldItem(item, definition);
    return item;
  }
  const template = definition.nativeTemplate!;
  const weapon = template === 'dagger' ? weapons.find((w) => w.id === template) : null;
  const armor = template === 'leather_armor' ? armors.find((a) => a.id === template) : null;
  const item = new Item(
    ItemLoader.translateName(weapon?.name ?? armor?.name ?? 'Ration of Food'),
    weapon ? ')' : armor ? ']' : '%',
    weapon ? 0xcccccc : armor ? 0x888888 : 0xddaa55,
    weapon ? ItemCategory.WEAPON : armor ? ItemCategory.ARMOR : ItemCategory.FOOD
  );
  item.quantity = quantity;
  item.identified = true;
  item.canBeIdentified = false;
  if (weapon) {
    item.identityId = template;
    item.damage = weapon.damage;
    item.clumping = weapon.clumping;
    item.strengthRequired = weapon.strengthRequired;
    item.weight = weapon.weight;
    if (weapon.flags) item.flags = [...weapon.flags];
  } else if (armor) {
    item.identityId = template;
    item.armor = armor.armor;
    item.strengthRequired = armor.strengthRequired;
    item.weight = armor.weight;
  } else {
    item.consumableId = template;
    item.weight = 5;
  }
  return item;
}

const inventoryReservations = new WeakMap<object, () => number>();
export function bindInventoryReservations(inventory: object, read: () => number): void {
  inventoryReservations.set(inventory, read);
}
export const inventoryReservedSlots = (inventory: object) =>
  inventoryReservations.get(inventory)?.() ?? 0;
