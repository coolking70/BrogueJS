import type { Item } from './Item';
import type { ItemDefinitionContribution } from '../../ext/worldSdk';
export interface WorldItemPresentation {
  name(): string;
  description(): string;
}
const definitions = new WeakMap<ItemDefinitionContribution, WorldItemPresentation>();
const items = new WeakMap<Item, WorldItemPresentation>();
export function bindWorldDefinitionPresentation(
  d: ItemDefinitionContribution,
  p: WorldItemPresentation
): void {
  definitions.set(d, p);
}
export function bindWorldItemPresentation(item: Item, d: ItemDefinitionContribution): void {
  const p = definitions.get(d);
  if (p) items.set(item, p);
  else items.delete(item);
}
export function worldItemPresentation(item: Item): WorldItemPresentation | undefined {
  return items.get(item);
}
