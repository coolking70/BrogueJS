import type { WorldDefinitionPack } from '../../ext/structureTypes';

/** Work-capable ownership comes from definitions, not the presence of ordinary items.
 * Callers receive packs already checked by assertWorldDefinitionPack.
 */
export function ownsWorldWorkDefinitions(pack: WorldDefinitionPack, owner: string): boolean {
  return [pack.items, pack.resourceNodes, pack.stations, pack.recipes, pack.edibleItems ?? []]
    .some((definitions) => definitions.some((definition) => definition.owner === owner));
}
