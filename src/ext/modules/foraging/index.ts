import { loadForagingPack } from './definitions';
import { createForagingModuleFromPack } from './module';
export function createForagingModule() {
  return createForagingModuleFromPack(loadForagingPack());
}
