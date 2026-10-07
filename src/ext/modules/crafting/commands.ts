import { compareLevelRefs } from '../../worldSdk';
import type {
  CraftingAction, CraftingCommand, JsonValue, WorldPlanHandle, WorldResult,
  WorldWorkCommand, WorldWorkPrepareSDK
} from '../../worldSdk';
import type { CraftingPack } from './types';

const keys: Record<CraftingAction, readonly string[]> = {
  harvest: ['v', 'nodeId', 'nodeRevision', 'inventoryStamp', 'destinationId', 'destinationRevision'],
  craft: ['v', 'recipeId', 'batchCount', 'stationId', 'stationRevision', 'sourceContainerId', 'sourceRevision', 'inventoryStamp'],
  'place-station': ['v', 'definitionId', 'x', 'y', 'inventoryStamp'],
  'cancel-work': ['v', 'ticketId', 'ticketRevision']
};
const bad = (field: string | null = null): WorldResult<WorldPlanHandle> =>
  ({ ok: false, code: 'C5_BAD_PAYLOAD', field });
const uint = (value: unknown, min = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
const pair = (id: unknown, revision: unknown) =>
  (id === null && revision === null) || (uint(id, 1) && uint(revision));
function exact(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const own = Reflect.ownKeys(value);
  return own.length === expected.length && own.every(key => {
    if (typeof key !== 'string' || !expected.includes(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return !!descriptor && descriptor.enumerable === true && 'value' in descriptor;
  });
}

type Payload<A extends CraftingAction> = Extract<CraftingCommand, { action: A }>['payload'];

/** No module state, clocks, allocation or messages: only validate and prepare an SDK plan. */
export function prepareCraftingCommand(
  action: CraftingAction, payload: JsonValue, sdk: WorldWorkPrepareSDK, pack: CraftingPack
): WorldResult<WorldPlanHandle> {
  let p: Record<string, unknown>;
  try {
    if (!Object.prototype.hasOwnProperty.call(keys, action) || !exact(payload, keys[action])) return bad();
    p = payload;
    if (p.v !== 1) return bad('v');
    if (action !== 'cancel-work' && typeof p.inventoryStamp !== 'string') return bad('inventoryStamp');
  } catch {
    return bad();
  }
  switch (action) {
    case 'harvest': {
      if (!uint(p.nodeId, 1)) return bad('nodeId');
      if (!uint(p.nodeRevision)) return bad('nodeRevision');
      if (!pair(p.destinationId, p.destinationRevision)) return bad('destinationId');
      const { v: _v, ...request } = p as Payload<'harvest'>;
      return sdk.planTimedWork({ kind: 'harvest', ...request });
    }
    case 'craft': {
      if (typeof p.recipeId !== 'string') return bad('recipeId');
      if (!uint(p.batchCount, 1) || p.batchCount > pack.limits.batchMax) return bad('batchCount');
      if (!pair(p.stationId, p.stationRevision)) return bad('stationId');
      if (!pair(p.sourceContainerId, p.sourceRevision)) return bad('sourceContainerId');
      const recipe = pack.recipes.find(row => row.id === p.recipeId);
      if (!recipe) return { ok: false, code: 'C5_BAD_DEFINITION', field: 'recipeId' };
      if ((recipe.stationTags.length === 0) !== (p.stationId === null)) return bad('stationId');
      const { v: _v, ...request } = p as Payload<'craft'>;
      return sdk.planTimedWork({ kind: 'craft', ...request });
    }
    case 'place-station': {
      if (typeof p.definitionId !== 'string') return bad('definitionId');
      if (!pack.stations.some(row => row.id === p.definitionId))
        return { ok: false, code: 'C5_BAD_DEFINITION', field: 'definitionId' };
      if (!Number.isSafeInteger(p.x) || !Number.isSafeInteger(p.y)) return bad('at');
      const context = sdk.readWorkContext({ kind: 'inventory' });
      if (!context.ok) return context;
      const count = context.value.stations.filter(station =>
        station.definitionId.startsWith('crafting.') &&
        compareLevelRefs(station.levelRef, context.value.levelRef) === 0
      ).length;
      if (count >= pack.limits.stationsPerLevel) return { ok: false, code: 'C5_BUDGET', field: null };
      const place = p as Payload<'place-station'>;
      return sdk.planStationPlacement({
        definitionId: place.definitionId, at: { x: place.x, y: place.y }, inventoryStamp: place.inventoryStamp
      });
    }
    case 'cancel-work': {
      if (!uint(p.ticketId, 1)) return bad('ticketId');
      if (!uint(p.ticketRevision)) return bad('ticketRevision');
      const cancel = p as Payload<'cancel-work'>;
      return sdk.planCancelWork({ ticketId: cancel.ticketId, ticketRevision: cancel.ticketRevision });
    }
  }
}

export function createCraftingCommands(pack: CraftingPack): Record<CraftingAction, WorldWorkCommand> {
  return {
    harvest: { prepare: (payload, sdk) => prepareCraftingCommand('harvest', payload, sdk, pack) },
    craft: { prepare: (payload, sdk) => prepareCraftingCommand('craft', payload, sdk, pack) },
    'place-station': { prepare: (payload, sdk) => prepareCraftingCommand('place-station', payload, sdk, pack) },
    'cancel-work': { prepare: (payload, sdk) => prepareCraftingCommand('cancel-work', payload, sdk, pack) }
  };
}
