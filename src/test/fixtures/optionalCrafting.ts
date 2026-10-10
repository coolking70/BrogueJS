/** Test prerequisites for consumers that must work without the crafting pack. */
import { vi } from 'vitest';
import * as catalog from '../../ext/catalog';
import { descriptor as skeleton, definitions as skeletonDefinitions } from '../../ext/testing/fixtures/craftingSkeleton';
import type { ModuleDescriptor } from '../../ext/descriptor';
import type { Json, ExtensionModule } from '../../ext/types';
import type { WorldDefinitionPack } from '../../ext/worldSdk';
import { extensionDataFingerprint } from '../../ext/fingerprint';

const materialOwner = 'material-fixture';
// Rename the complete neutral pack, including all references and text ownership.
// The harness always installs its original craftskel descriptor separately.
const rename = <T>(value: T): T => JSON.parse(JSON.stringify(value).split('craftskel').join(materialOwner));
const materialDefinitions = rename(skeletonDefinitions);
materialDefinitions.items.find(d => d.id === `${materialOwner}.fiber`)!.tags = ['basic.wood'];
materialDefinitions.items.find(d => d.id === `${materialOwner}.kit`)!.tags = ['kit.bed'];
materialDefinitions.stations[0]!.stationTags = ['station.hearth', 'table'];
materialDefinitions.startupItems!.items = materialDefinitions.startupItems!.items.filter(i => i.itemDefinitionId !== `${materialOwner}.kit`);
const materialRules = { schema: 1, version: skeleton.version, fingerprint: extensionDataFingerprint(materialDefinitions) };
export const craftingMaterialFixture: ModuleDescriptor = {
  ...skeleton, id: materialOwner, labelKey: `ext.${materialOwner}.label`, locales: rename(skeleton.locales), rules: materialRules,
  create: () => Object.assign(skeleton.create(), { id: materialOwner, rules: materialRules, worldDefinitions: materialDefinitions })
};
export function craftingMaterials() {
  const installed = catalog.getInstalledModuleDescriptors();
  const real = installed.some(d => d.id === 'crafting');
  if (!real) vi.spyOn(catalog, 'getInstalledModuleDescriptors').mockReturnValue([...installed, craftingMaterialFixture]);
  return real
    ? { module: 'crafting', wood: 'crafting.wood', bedKit: 'crafting.kit-bed' }
    : { module: materialOwner, wood: `${materialOwner}.fiber`, bedKit: `${materialOwner}.kit` };
}

/** Supplemental own recipe on the genuinely installed settlement module.
 * No descriptor or definition is registered under the physically absent pack.
 */
export function registerResidentRecipeFixture() {
  const installed = catalog.getInstalledModuleDescriptors();
  const base = installed.find(d => d.id === 'settlement')!;
  const originalDefinitions = structuredClone(base.create(base.runConfiguration!.default).worldDefinitions!);
  const input = 'settlement.wood', output = 'settlement.fixture-kit', recipe = 'settlement.fixture-kit-recipe';
  const prototype = originalDefinitions.items.find(d => d.id === input)!;
  const definitions: WorldDefinitionPack = { ...originalDefinitions,
    items: [...originalDefinitions.items, { ...prototype, id: output, category: 'kit', tags: ['kit.chest'],
      nameKey: 'ext.settlement.fixture-kit.name', descriptionKey: 'ext.settlement.fixture-kit.description' }],
    recipes: [...originalDefinitions.recipes, { owner: 'settlement', id: recipe,
    nameKey: 'ext.settlement.fixture-recipe.name', descriptionKey: 'ext.settlement.fixture-recipe.description',
    inputs: [{ itemDefinitionId: input, count: 6 }], outputs: [{ itemDefinitionId: output, count: 1 }],
    stationTags: ['station.hearth'], toolTag: null, workTicks: 500, offlineEligible: true }] };
  const identity = (configuration: Json) => {
    const original = base.runConfiguration!.identity(configuration);
    return { ...original, fingerprint: extensionDataFingerprint({ original, definitions }) };
  };
  const participant: NonNullable<ExtensionModule['worldWorkParticipant']> = {
    onCommitted(_fact, tx) {
      // Like the real crafting participant, tolerate a delivery failure; the
      // runtime must still detect the failed real writer and poison the commit.
      try { tx.replaceState(tx.state); } catch { /* checked by runtime writerFailed */ }
    }
  };
  const descriptor: ModuleDescriptor = {
    ...base, rules: identity(base.runConfiguration!.default),
    runConfiguration: { ...base.runConfiguration!, identity },
    locales: { ...base.locales, zh_CN: { ...base.locales?.zh_CN,
      'ext.settlement.fixture-kit.name': '测试箱套件', 'ext.settlement.fixture-kit.description': '独立生产测试套件。',
      'ext.settlement.fixture-recipe.name': '测试套件配方', 'ext.settlement.fixture-recipe.description': '六份木材产出一份套件。' } },
    create: (configuration = base.runConfiguration!.default) => Object.assign(base.create(configuration), {
      rules: identity(configuration), worldDefinitions: definitions, worldWorkParticipant: participant
    })
  };
  vi.spyOn(catalog, 'getInstalledModuleDescriptors').mockReturnValue(installed.map(d => d.id === base.id ? descriptor : d));
  return { input, output, recipe };
}
