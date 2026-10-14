import { bindWorldItemPresentation } from './WorldItemPresentation';
import { assembleNativeTemplate } from './FixedItemAssembly';
/** Fixed C5 assembly. Never calls the random spawning pipeline. */
import { Item, ItemCategory } from './Item';
import type { ItemDefinitionContribution } from '../../ext/worldSdk';
const definitions = new WeakMap<Item, ItemDefinitionContribution>();
export function bindWorldItem(item: Item, definition: ItemDefinitionContribution): void {
  if (
    item.category !== ItemCategory.MATERIAL ||
    item.worldItem?.definitionId !== definition.id ||
    definition.category === 'native'
  )
    throw new Error('C5_BAD_DEFINITION');
  definitions.set(item, definition);
  bindWorldItemPresentation(item,definition);
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
  return assembleNativeTemplate(definition.nativeTemplate!, quantity);
}

const inventoryReservations = new WeakMap<object, () => number>();
export function bindInventoryReservations(inventory: object, read: () => number): void {
  inventoryReservations.set(inventory, read);
}
export const inventoryReservedSlots = (inventory: object) =>
  inventoryReservations.get(inventory)?.() ?? 0;
