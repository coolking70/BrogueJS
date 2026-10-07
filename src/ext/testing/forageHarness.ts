import i18next from 'i18next';
import foundationLocale from '../../locales/zh_CN.json';
import type { WorldHarnessOptions } from '../worldSdk';
import { createWorldHarness, worldHarnessGame } from './worldHarness';
import { descriptor } from './fixtures/forageFixture';
import { readEdibleContext } from '../../engine/Core/EdibleCommands';
import type { ModuleDescriptor } from '../descriptor';
export function createForageHarness(
  options: WorldHarnessOptions,
  overrides: readonly ModuleDescriptor[] = []
) {
  if (!i18next.isInitialized)
    i18next.init({ lng: 'en', fallbackLng: false, resources: {}, initImmediate: false });
  i18next.addResources(
    i18next.language,
    'translation',
    Object.fromEntries(
      Object.entries(foundationLocale).filter(
        ([key]) =>
          key.startsWith('ext.foundation.edible.') ||
          key.startsWith('ext.foundation.status.slumber')
      )
    )
  );
  for (const resources of Object.values(descriptor.locales ?? {}))
    i18next.addResources(i18next.language, 'translation', resources);
  const harness = createWorldHarness(
    { ...options, modules: [...new Set([...options.modules, 'fgfixture'])] },
    [
      ...overrides.filter((d) => d.id !== descriptor.id),
      overrides.find((d) => d.id === descriptor.id) ?? descriptor
    ]
  );
  return Object.freeze({
    ...harness,
    readEdibleContext: (owner = 'fgfixture') => readEdibleContext(worldHarnessGame(harness), owner),
    fixture: (payload: import('../worldSdk').JsonValue) =>
      harness.ext('fgfixture', 'fixture', payload),
    game: () => worldHarnessGame(harness)
  });
}
