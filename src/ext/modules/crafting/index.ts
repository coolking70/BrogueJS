import { loadCraftingPack } from './definitions';
import { createCraftingModuleFromPack } from './module';

export function createCraftingModule() {
  return createCraftingModuleFromPack(loadCraftingPack());
}
