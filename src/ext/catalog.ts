import { ExtensionRegistry } from './registry';
import { createExampleModule, EXAMPLE_ID, EXAMPLE_VERSION } from './modules/example';
import { createGrowthModule } from './modules/growth';
import { GROWTH_VERSION, getGrowthPackIdentity } from './modules/growth/definitions';
// Only invoked for an explicitly extended run or extended input validation.
export function createExtensionRegistry(): ExtensionRegistry {
    const registry = new ExtensionRegistry();
    registry.register(EXAMPLE_ID, EXAMPLE_VERSION, createExampleModule);
    registry.register('growth', GROWTH_VERSION, createGrowthModule, getGrowthPackIdentity());
    return registry;
}
export const DEFAULT_EXTENSIONS: readonly string[] = ['growth'];
