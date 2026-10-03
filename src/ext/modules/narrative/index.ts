import type { ExtensionModule } from '../../types';
import { loadNarrativeDefinitionPack } from './definitions';
import { createNarrativeModuleFromPack } from './module';

export function createNarrativeModule(): ExtensionModule {
    return createNarrativeModuleFromPack(loadNarrativeDefinitionPack());
}
