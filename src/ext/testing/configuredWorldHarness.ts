/** Test-only use of the frozen adapter's existing descriptor override port.
 * Manifest rules/configuration are exactly the production declarations; no fake Game or clock.
 */
import { getInstalledModuleDescriptors } from '../catalog';
import { createWorldHarness } from './worldHarness';
import type { WorldHarnessOptions } from '../worldSdk';
import type { Json } from '../types';
export function createConfiguredWorldHarness(
  options: WorldHarnessOptions,
  configurations: Readonly<Record<string, Json>>
) {
  const installed = getInstalledModuleDescriptors();
  const overrides = Object.entries(configurations).map(([id, configuration]) => {
    const descriptor = installed.find((d) => d.id === id);
    if (!options.modules.includes(id) || !descriptor?.runConfiguration?.validate(configuration))
      throw new Error('Invalid configured test run');
    return {
      ...descriptor,
      rules: descriptor.runConfiguration.identity(configuration),
      runConfiguration: { ...descriptor.runConfiguration, default: structuredClone(configuration) }
    };
  });
  return createWorldHarness(options, overrides);
}
