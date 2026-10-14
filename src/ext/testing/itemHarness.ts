import i18next from 'i18next';
import { createWorldHarness, worldHarnessGame } from './worldHarness';
import { descriptor } from './fixtures/itemFixture';
import type { ModuleDescriptor } from '../descriptor';
import type { WorldHarnessOptions } from '../worldSdk';
export function createItemHarness(options: Partial<WorldHarnessOptions> = {}, overrides: readonly ModuleDescriptor[] = []) {
  if(!i18next.isInitialized)i18next.init({lng:'en',fallbackLng:false,resources:{},initImmediate:false});
  for(const d of [descriptor,...overrides])for(const [language,resource]of Object.entries(d.locales??{}))i18next.addResourceBundle(language,'translation',resource,true,true);
  const harness = createWorldHarness({ seed: 6101001, ...options, modules: [...new Set(['c6fixture', ...(options.modules ?? [])])] },
    [descriptor, ...overrides].filter((d, i, all) => !all.slice(i + 1).some(o => o.id === d.id)));
  return Object.freeze({ ...harness, game: () => worldHarnessGame(harness) });
}
