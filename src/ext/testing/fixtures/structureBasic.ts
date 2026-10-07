/** Foundation-only fixture. Never discovered by the production catalog. */
import { definitions as basic, descriptor as base } from './worldWorkBasic';
import { registerWorld5StructureFixture } from '../../world5Fixture';
import type { WorldDefinitionPack, StructureDefinition } from '../../structureTypes';
import { extensionDataFingerprint } from '../../fingerprint';
export const definitions: WorldDefinitionPack = structuredClone(basic);
const blocks = {
  movement: false,
  vision: false,
  physicalProjectile: false,
  magicProjectile: false,
  gas: false,
  liquid: false
};
const make = (
  name: string,
  slot: StructureDefinition['slot'],
  changes: Partial<StructureDefinition> = {}
): StructureDefinition => ({
  owner: 'c5fixture',
  id: `c5fixture.${name}`,
  slot,
  barrierKind: null,
  nameKey: `ext.c5fixture.${name}.name`,
  descriptionKey: `ext.c5fixture.${name}.description`,
  maxHp: 100,
  blocks: { ...blocks },
  flammable: false,
  resistances: { physical: 0, fire: 0 },
  constructionCost: [{ itemDefinitionId: 'c5fixture.stone', count: 4 }],
  constructionTicks: 100,
  refundNumerator: 1,
  refundDenominator: 2,
  containerCapacity: null,
  stationDefinitionId: null,
  restPointDefinitionId: null,
  tags: [],
  ...changes
});
definitions.structures = [
  make('floor', 'floor'),
  make('fixture', 'fixture'),
  make('wall', 'barrier', {
    barrierKind: 'wall',
    blocks: {
      movement: true,
      vision: true,
      physicalProjectile: true,
      magicProjectile: true,
      gas: true,
      liquid: true
    },
    flammable: true
  }),
  make('door', 'barrier', {
    barrierKind: 'door',
    blocks: {
      movement: true,
      vision: true,
      physicalProjectile: true,
      magicProjectile: true,
      gas: true,
      liquid: true
    }
  }),
  make('window', 'barrier', {
    barrierKind: 'window',
    blocks: {
      movement: true,
      vision: false,
      physicalProjectile: true,
      magicProjectile: false,
      gas: false,
      liquid: true
    }
  }),
  make('roof', 'roof'),
  make('bed', 'fixture', { restPointDefinitionId: 'c5fixture.rest', tags: ['bed'] }),
  make('chest', 'fixture', { containerCapacity: 16 }),
  make('bound-table', 'fixture', { stationDefinitionId: 'c5fixture.table' }),
  make('combined', 'fixture', {
    containerCapacity: 16,
    stationDefinitionId: 'c5fixture.table',
    restPointDefinitionId: 'c5fixture.rest',
    tags: ['bed']
  }),
  make('furnace', 'fixture', { stationDefinitionId: 'c5fixture.table', tags: ['furnace'] })
];
definitions.restPoints = [
  {
    owner: 'c5fixture',
    id: 'c5fixture.rest',
    nameKey: 'ext.c5fixture.rest.name',
    descriptionKey: 'ext.c5fixture.rest.description',
    glyph: '=',
    color: '#aaaaaa',
    maxRestTicks: 300,
    interactionDistance: 1,
    restorePolicy: { hp: 'native-over-time', optionalCombatResources: 'none' },
    resetPolicy: 'none'
  }
];
definitions.startupItems = {
  instanceKey: 'structure-fixture',
  items: [{ itemDefinitionId: 'c5fixture.stone', count: 99 }],
  overflow: 'floor-then-skip'
};
definitions.recipes = [
  {
    owner: 'c5fixture',
    id: 'c5fixture.stone-work',
    nameKey: 'ext.c5fixture.stone-work.name',
    descriptionKey: 'ext.c5fixture.stone-work.description',
    inputs: [{ itemDefinitionId: 'c5fixture.stone', count: 1 }],
    outputs: [{ itemDefinitionId: 'c5fixture.stone', count: 1 }],
    stationTags: ['table'],
    toolTag: null,
    workTicks: 300,
    offlineEligible: false
  }
];
const rules = { schema: 1, version: '1.0.0', fingerprint: extensionDataFingerprint(definitions) };
export const descriptor = {
  ...base,
  rules,
  create: () =>
    registerWorld5StructureFixture({
      id: 'c5fixture',
      version: '1.0.0',
      rules,
      worldDefinitions: definitions,
      initialState: () => null,
      validateState: (v: unknown): v is null => v === null,
      commands: Object.fromEntries(
        ['fixture-region', 'fixture-structure', 'fixture-rest-placement', 'fixture-rest'].map(
          (k) => [k, () => {}]
        )
      )
    }),
  locales: {
    zh_CN: {
      ...base.locales!.zh_CN,
      ...Object.fromEntries(
        [...definitions.structures!, ...definitions.restPoints!, ...definitions.recipes].flatMap(
          (d) => [
            [d.nameKey, d.id],
            [d.descriptionKey, `测试 ${d.id}`]
          ]
        )
      )
    }
  }
};
