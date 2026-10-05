import { loadGiantsDefinitionPack } from './definitions';
import { createGiantsModuleFromPack } from './module';
export function createGiantsModule() {
  return createGiantsModuleFromPack(loadGiantsDefinitionPack());
}
