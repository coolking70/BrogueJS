import type { ExtensionRegistry } from './registry';
import { registryFromDescriptors, validateModuleDescriptors, type ModuleDescriptor } from './descriptor';
import type { StrategicDescriptor } from '../engine/Simulation/StrategicRuntime';
import type { RealtimeModuleDescriptor } from '../engine/Simulation/RangedRuntime';

// Vite/Vitest discover pure declarations only, without constructing any run.
const discovered = import.meta.glob<{ descriptor: ModuleDescriptor | RealtimeModuleDescriptor | StrategicDescriptor }>('./modules/*/descriptor.ts', { eager: true });
const installed = validateModuleDescriptors(Object.entries(discovered).map(([path, entry]) => {
    const directory = path.split('/')[2];
    if (!entry.descriptor || entry.descriptor.id !== directory) throw new Error(`Module directory/descriptor mismatch: ${path}`);
    return entry.descriptor;
}).filter((d): d is ModuleDescriptor => !('runtime' in d)));
export function getInstalledModuleDescriptors(): readonly ModuleDescriptor[] { return installed; }
export function createExtensionRegistry(descriptors: readonly ModuleDescriptor[] = installed): ExtensionRegistry {
    return registryFromDescriptors(descriptors);
}
/** Current configurable package defaults. Any subset, including empty, is valid. */
export const DEFAULT_EXTENSIONS: readonly string[] = Object.freeze(installed.filter(module => module.defaultEnabled).map(module => module.id));
