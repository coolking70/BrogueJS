import { ExtensionRegistry } from './registry';
import { createExampleModule, EXAMPLE_ID, EXAMPLE_VERSION } from './modules/example';
// Only invoked for an explicitly extended run or extended input validation.
export function createExtensionRegistry(): ExtensionRegistry {
    const registry = new ExtensionRegistry();
    registry.register(EXAMPLE_ID, EXAMPLE_VERSION, createExampleModule);
    return registry;
}
export const DEFAULT_EXTENSIONS: readonly string[] = ['example'];
