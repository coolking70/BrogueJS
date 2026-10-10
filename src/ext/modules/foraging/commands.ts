import type { EdibleCommand, EdiblePlanHandle, EdiblePrepareSDK } from '../../edibleSdk';
import type { JsonValue, WorldPlanHandle, WorldResult, WorldWorkCommand, WorldWorkPrepareSDK } from '../../worldSdk';

export type ForagingAction = 'harvest' | 'feed' | 'roast';
const fields: Record<ForagingAction, readonly string[]> = {
  harvest: ['v', 'nodeId', 'nodeRevision', 'inventoryStamp', 'destinationId', 'destinationRevision'],
  feed: ['v', 'targetId', 'targetRevision', 'itemId', 'inventoryStamp'],
  roast: ['v', 'heatSourceId', 'itemId', 'inventoryStamp']
};
const bad = (field: string | null = null) => ({ ok: false as const, code: 'C5_BAD_PAYLOAD' as const, field });
const uint = (value: unknown, min = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && own.every(key => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return typeof key === 'string' && keys.includes(key) && !!d && d.enumerable && 'value' in d;
  });
}

export function prepareForagingCommand(action: 'harvest', payload: JsonValue, sdk: WorldWorkPrepareSDK): WorldResult<WorldPlanHandle>;
export function prepareForagingCommand(action: 'feed' | 'roast', payload: JsonValue, sdk: EdiblePrepareSDK): WorldResult<EdiblePlanHandle>;
/** Validate only the envelope; all mechanical gates and CAS belong to foundation. */
export function prepareForagingCommand(
  action: ForagingAction, payload: JsonValue, sdk: WorldWorkPrepareSDK | EdiblePrepareSDK
): WorldResult<WorldPlanHandle | EdiblePlanHandle> {
  let p: Record<string, unknown>;
  try {
    if (!Object.prototype.hasOwnProperty.call(fields, action) || !exact(payload, fields[action])) return bad();
    p = payload;
    if (p.v !== 1) return bad('v');
    if (typeof p.inventoryStamp !== 'string') return bad('inventoryStamp');
    if (action === 'harvest') {
      if (!uint(p.nodeId, 1)) return bad('nodeId');
      if (!uint(p.nodeRevision)) return bad('nodeRevision');
      if (p.destinationId !== null && !uint(p.destinationId, 1)) return bad('destinationId');
      if (p.destinationRevision !== null && !uint(p.destinationRevision)) return bad('destinationRevision');
      if ((p.destinationId === null) !== (p.destinationRevision === null)) return bad('destinationId');
    } else {
      if (!uint(p.itemId, 1)) return bad('itemId');
      if (action === 'feed') {
        if (!uint(p.targetId, 1)) return bad('targetId');
        if (!uint(p.targetRevision)) return bad('targetRevision');
      } else if (!uint(p.heatSourceId, 1)) return bad('heatSourceId');
    }
  } catch { return bad(); }
  if (action === 'harvest') return (sdk as WorldWorkPrepareSDK).planTimedWork({
    kind: 'harvest', nodeId: p.nodeId as number, nodeRevision: p.nodeRevision as number,
    inventoryStamp: p.inventoryStamp as string, destinationId: p.destinationId as number | null,
    destinationRevision: p.destinationRevision as number | null
  });
  if (action === 'feed') return (sdk as EdiblePrepareSDK).planFeed({
    targetId: p.targetId as number, targetRevision: p.targetRevision as number,
    itemId: p.itemId as number, inventoryStamp: p.inventoryStamp as string
  });
  return (sdk as EdiblePrepareSDK).planRoast({
    heatSourceId: p.heatSourceId as number, itemId: p.itemId as number, inventoryStamp: p.inventoryStamp as string
  });
}
export function createForagingWorldWorkCommands(): { harvest: WorldWorkCommand } {
  return { harvest: { prepare: (payload, sdk) => prepareForagingCommand('harvest', payload, sdk) } };
}
export function createForagingEdibleCommands(): { feed: EdibleCommand; roast: EdibleCommand } {
  return {
    feed: { prepare: (payload, sdk) => prepareForagingCommand('feed', payload, sdk) },
    roast: { prepare: (payload, sdk) => prepareForagingCommand('roast', payload, sdk) }
  };
}
