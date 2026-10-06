/** Fixed D1 placement through the trusted fixture mechanism. */
import type { ExtensionModule, Json } from '../../types';
import { registerWorld5WorkFixture } from '../../world5Fixture';
import type { WorldDefinitionPack } from '../../worldSdk';
import { FOUNDATION_PROTOCOL, type ModuleDescriptor } from '../../descriptor';
import { extensionDataFingerprint } from '../../fingerprint';
const owner = 'c5fixture';
export const definitions: WorldDefinitionPack = {
  schema: 1,
  worldSdk: 1,
  items: [
    {
      owner,
      id: 'c5fixture.stone',
      nameKey: 'ext.c5fixture.stone.name',
      descriptionKey: 'ext.c5fixture.stone.description',
      category: 'material',
      glyph: '*',
      color: '#aaaaaa',
      maxStack: 99,
      nativeTemplate: null,
      tags: [],
      tool: null
    }
  ],
  resourceNodes: [
    {
      owner,
      id: 'c5fixture.stone-node',
      nameKey: 'ext.c5fixture.stone-node.name',
      descriptionKey: 'ext.c5fixture.stone-node.description',
      glyph: '♠',
      color: '#aaaaaa',
      kind: 'stone',
      yield: [{ itemDefinitionId: 'c5fixture.stone', count: 1 }],
      capacity: 8,
      harvestTicks: 100,
      unitsPerHarvest: 1,
      requiredToolTag: null,
      regeneration: { kind: 'none' },
      placement: { dungeon: null, site: null }
    }
  ],
  stations: [
    {
      owner,
      id: 'c5fixture.table',
      nameKey: 'ext.c5fixture.table.name',
      descriptionKey: 'ext.c5fixture.table.description',
      glyph: 'T',
      color: '#aaaaaa',
      interactionDistance: 1,
      stationTags: ['table'],
      placementCost: [{ itemDefinitionId: 'c5fixture.stone', count: 1 }],
      placementTicks: 100,
      workPositionPolicy: 'adjacent-passable',
      kitDefinitionId: null
    }
  ],
  recipes: [],
  startupItems: null
};
export const rules = {
  schema: 1,
  version: '1.0.0',
  fingerprint: extensionDataFingerprint(definitions)
};
export function createWorldWorkBasic(): ExtensionModule {
  return registerWorld5WorkFixture({
    id: owner,
    version: '1.0.0',
    rules,
    worldDefinitions: definitions,
    initialState: () => null,
    validateState: (v: unknown): v is Json => v === null
  });
}
const locales = Object.fromEntries(
  [...definitions.items, ...definitions.resourceNodes, ...definitions.stations].flatMap((d) => [
    [d.nameKey, d.id],
    [d.descriptionKey, `测试 ${d.id}`]
  ])
);
export const descriptor: ModuleDescriptor = {
  id: owner,
  version: '1.0.0',
  foundation: FOUNDATION_PROTOCOL,
  worldSdk: 1,
  rules,
  create: createWorldWorkBasic,
  labelKey: 'ext.c5fixture.label',
  locales: { zh_CN: { ...locales, 'ext.c5fixture.label': '世界工作 fixture' } }
};
