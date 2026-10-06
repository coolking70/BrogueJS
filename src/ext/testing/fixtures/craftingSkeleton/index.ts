/** Contract example, deliberately outside catalog discovery and production imports. */
import type {
  WorldDefinitionPack,
  WorldWorkPrepareSDK,
  JsonValue,
  WorldResult,
  WorldPlanHandle
} from '../../../worldSdk';
import type { ExtensionModule, Json } from '../../../types';
import { FOUNDATION_PROTOCOL, type ModuleDescriptor } from '../../../descriptor';
import { extensionDataFingerprint } from '../../../fingerprint';
const owner = 'craftskel';
const item = (
  id: string,
  category: 'material' | 'tool' | 'kit' | 'native',
  nativeTemplate: 'dagger' | null = null
) => ({
  owner,
  id: `${owner}.${id}`,
  nameKey: `ext.${owner}.${id}.name`,
  descriptionKey: `ext.${owner}.${id}.description`,
  category,
  glyph: '*',
  color: '#bbbbbb',
  maxStack: category === 'tool' || category === 'native' ? 1 : 99,
  nativeTemplate,
  tags: category === 'tool' ? ['cut'] : [],
  tool: category === 'tool' ? { tag: 'cut', maxDurability: 2, durabilityPerBatch: 1 } : null
});
export const definitions: WorldDefinitionPack = {
  schema: 1,
  worldSdk: 1,
  items: [
    item('fiber', 'material'),
    item('knife', 'tool'),
    item('kit', 'kit'),
    item('dagger', 'native', 'dagger')
  ],
  resourceNodes: [
    {
      owner,
      id: 'craftskel.fiber-node',
      nameKey: 'ext.craftskel.fiber-node.name',
      descriptionKey: 'ext.craftskel.fiber-node.description',
      glyph: '♣',
      color: '#779955',
      kind: 'fiber',
      yield: [{ itemDefinitionId: 'craftskel.fiber', count: 2 }],
      capacity: 6,
      harvestTicks: 100,
      unitsPerHarvest: 1,
      requiredToolTag: null,
      regeneration: { kind: 'periodic', units: 1, intervalTicks: 1000 },
      placement: {
        dungeon: { minDepth: 1, maxDepth: 3, maxPerDepth: 1, maxPerRun: 3, onNoSpace: 'defer' },
        site: null
      }
    }
  ],
  stations: [
    {
      owner,
      id: 'craftskel.table',
      nameKey: 'ext.craftskel.table.name',
      descriptionKey: 'ext.craftskel.table.description',
      glyph: 'T',
      color: '#bb9966',
      interactionDistance: 1,
      stationTags: ['table'],
      placementCost: [{ itemDefinitionId: 'craftskel.fiber', count: 2 }],
      placementTicks: 100,
      workPositionPolicy: 'adjacent-passable',
      kitDefinitionId: 'craftskel.kit'
    }
  ],
  recipes: [
    {
      owner,
      id: 'craftskel.dagger-recipe',
      nameKey: 'ext.craftskel.dagger-recipe.name',
      descriptionKey: 'ext.craftskel.dagger-recipe.description',
      inputs: [{ itemDefinitionId: 'craftskel.fiber', count: 1 }],
      outputs: [{ itemDefinitionId: 'craftskel.dagger', count: 1 }],
      stationTags: ['table'],
      toolTag: 'cut',
      workTicks: 100,
      offlineEligible: false
    }
  ],
  startupItems: {
    instanceKey: 'craftskel.startup',
    items: [
      { itemDefinitionId: 'craftskel.fiber', count: 20 },
      { itemDefinitionId: 'craftskel.knife', count: 1 },
      { itemDefinitionId: 'craftskel.kit', count: 1 }
    ],
    overflow: 'floor-then-skip'
  }
};
export function prepare(
  action: string,
  payload: JsonValue,
  sdk: WorldWorkPrepareSDK
): WorldResult<WorldPlanHandle> {
  const p = payload as Record<string, JsonValue>;
  if (!p || Array.isArray(p) || p.v !== 1) return { ok: false, code: 'C5_BAD_PAYLOAD', field: 'v' };
  const { v: _version, ...r } = p;
  if (action === 'place-station') {
    const { x, y, ...rest } = r;
    return sdk.planStationPlacement({ ...rest, at: { x, y } } as any);
  }
  if (action === 'cancel-work') return sdk.planCancelWork(r as any);
  return sdk.planTimedWork({ kind: action, ...r } as any);
}
export const rules = {
  schema: 1,
  version: '1.0.0',
  fingerprint: extensionDataFingerprint(definitions)
};
export function createCraftingSkeleton(): ExtensionModule {
  return {
    id: owner,
    version: '1.0.0',
    rules,
    worldDefinitions: definitions,
    initialState: () => ({ history: [] }),
    validateState: (v: unknown): v is Json =>
      !!v && typeof v === 'object' && Array.isArray((v as any).history) && (v as any).history.length <= 128,
    worldWorkCommands: Object.fromEntries(
      ['harvest', 'craft', 'place-station', 'cancel-work'].map((action) => [
        action,
        { prepare: (p: JsonValue, sdk: WorldWorkPrepareSDK) => prepare(action, p, sdk) }
      ])
    ),
    worldWorkParticipant: {
      onCommitted(fact, context) {
        const state = context.state as { history: Json[] };
        context.replaceState({ history: [...state.history, fact as unknown as Json].slice(-128) });
      }
    },
    projectView: (context) =>
      context.worldWork
        ? ({
            context: context.worldWork.readWorkContext({ kind: 'inventory' }),
            facts: context.worldWork.recentFacts(0)
          } as unknown as Json)
        : null
  };
}
const locales = Object.fromEntries(
  [
    ...definitions.items,
    ...definitions.resourceNodes,
    ...definitions.stations,
    ...definitions.recipes
  ].flatMap((d) => [
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
  create: createCraftingSkeleton,
  labelKey: 'ext.craftskel.label',
  locales: { zh_CN: { ...locales, 'ext.craftskel.label': '制作骨架' } }
};
