import type { ExtensionModule } from '../../types';
import { loadCombatDefinitionPack } from './definitions';
import { createCombatModuleFromPack } from './module';
export function createCombatModule(): ExtensionModule { return createCombatModuleFromPack(loadCombatDefinitionPack()); }
