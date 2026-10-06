/** Test-only discovery, like the native spatial fixture. No catalog descriptor.
 * Registration occurs on a factory's module object before runtime creation. */
import type { ExtensionModule } from './types';
import type { Json } from './types';
import type { OfflineRules, OfflineEvent, OfflinePlan } from '../engine/Core/WorldSettlement';
export interface World5FixtureConfiguration {
  rulesFingerprint: string;
  rules: OfflineRules;
  events(capturedTick: number): OfflineEvent[];
  prepareState(state: Json, plan: Readonly<OfflinePlan>): Json;
}
const fixtures = new WeakSet<ExtensionModule>();
const configurations = new WeakMap<ExtensionModule, World5FixtureConfiguration>();
export function registerWorld5Fixture(
  module: ExtensionModule,
  configuration?: World5FixtureConfiguration
): ExtensionModule {
  if (!import.meta.env.DEV) throw new Error('World5 fixture registration is unavailable');
  fixtures.add(module);
  if (configuration) configurations.set(module, configuration);
  return module;
}
export function world5FixtureConfiguration(
  module: ExtensionModule
): World5FixtureConfiguration | undefined {
  return configurations.get(module);
}
export function isWorld5Fixture(module: ExtensionModule): boolean {
  return fixtures.has(module);
}
