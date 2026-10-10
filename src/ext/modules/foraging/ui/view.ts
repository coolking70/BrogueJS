import type { ForagingView } from '../types';
import type { WorldErrorCode } from '../../../worldSdk';
import type { DisplayFrame } from '../../../../ui/displayProjection';

export type ForagingUiView = Extract<ForagingView, { available: true }>;
export type ForagingTab = 'harvest' | 'roast' | 'feed';
export interface ForagingDraft { tab: ForagingTab; nodeId: number | null; heatSourceId: number | null; itemId: number | null; targetId: number | null }
export const emptyForagingDraft = (): ForagingDraft => ({ tab: 'harvest', nodeId: null, heatSourceId: null, itemId: null, targetId: null });
export type ForagingNodeCard = ForagingUiView['nodes'][number] & { displayName: string };
export type ForagingCompanionCard = ForagingUiView['companions'][number] & { displayName: string; adjacent: boolean };
const errorCodes = new Set<string>([
  'C5_BAD_PAYLOAD', 'C5_BAD_DEFINITION', 'C5_BAD_VERSION', 'C5_DISABLED', 'C5_UNSUPPORTED', 'C5_SCOPE',
  'C5_STALE', 'C5_PLAN_USED', 'C5_BUSY', 'C5_DEAD', 'C5_GATE', 'C5_UNKNOWN_TARGET', 'C5_WRONG_LEVEL',
  'C5_DISTANCE', 'C5_THREAT', 'C5_TOOL', 'C5_INPUT', 'C5_CAPACITY', 'C5_RESOURCE_EMPTY', 'C5_RESERVED',
  'C5_BUDGET', 'C5_OVERLAP', 'C5_PROTECTED', 'C5_BLOCKED', 'C5_ROOM', 'C5_NEEDS_RESUPPLY', 'C5_BAD_TIME',
  'C5_BAD_OWNERSHIP', 'C5_BAD_REFERENCE', 'C5_PROVIDER', 'C5_TRANSACTION', 'C5_OVERFLOW', 'C5_TERMINAL',
]);
const own = (value: object, key: PropertyKey) => Object.getOwnPropertyDescriptor(value, key);
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    || Reflect.ownKeys(value).length !== keys.length || keys.some(key => {
      const field = own(value, key); return !field || !('value' in field) || !field.enumerable;
    })) throw new Error('shape');
  return value as Record<string, unknown>;
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw new Error('integer');
}
function string(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096) throw new Error('string');
}
function boolean(value: unknown) { if (typeof value !== 'boolean') throw new Error('boolean'); }
function enumeration(value: unknown, values: readonly unknown[]) { if (!values.includes(value)) throw new Error('enum'); }
function rows(value: unknown, keys: readonly string[], id: string, check: (row: Record<string, unknown>) => void) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 4096
    || Reflect.ownKeys(value).length !== value.length + 1) throw new Error('array');
  const seen = new Set<unknown>();
  for (let i = 0; i < value.length; i++) {
    const field = own(value, String(i));
    if (!field || !('value' in field) || !field.enumerable) throw new Error('entry');
    const row = object(field.value, keys); integer(row[id], 1);
    if (seen.has(row[id])) throw new Error('duplicate');
    seen.add(row[id]); check(row);
  }
}
function detached<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(detached)) as T;
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, detached(v)]))) as T;
  return value;
}
/** Reject the entire display capability before reading any accessor or partial row. */
export function readForagingUiView(value: unknown): ForagingUiView | null {
  try {
    const root = object(value, ['v', 'available', 'inventoryStamp', 'activeTicket', 'nodes', 'foods', 'companions', 'heatSources']);
    if (root.v !== 1 || root.available !== true) return null;
    string(root.inventoryStamp);
    if (root.activeTicket !== null) {
      const ticket = object(root.activeTicket, ['ticketId', 'remainingTicks']); integer(ticket.ticketId, 1); integer(ticket.remainingTicks);
    }
    rows(root.nodes, ['interactableId', 'remaining', 'capacity', 'available', 'nodeRevision', 'canHarvest', 'reason'], 'interactableId', row => {
      integer(row.capacity, 1, 99); integer(row.remaining, 0, row.capacity); integer(row.available, 0, row.remaining); integer(row.nodeRevision); boolean(row.canHarvest);
      if (row.reason !== null && (typeof row.reason !== 'string' || !errorCodes.has(row.reason))) throw new Error('reason');
      if (row.canHarvest !== (row.reason === null) || (row.canHarvest && row.available < 1)) throw new Error('availability');
    });
    rows(root.foods, ['itemId', 'displayName', 'quantity', 'source', 'knowledge', 'satiety', 'roastable'], 'itemId', row => {
      string(row.displayName); integer(row.quantity, 1); enumeration(row.source, ['foraging', 'native']); boolean(row.roastable);
      enumeration(row.knowledge, ['unknown', 'tasted', 'known', null]);
      if (row.roastable !== (row.source === 'foraging')) throw new Error('roastable');
      if (row.source === 'native') { if (row.knowledge !== null) throw new Error('native'); integer(row.satiety, 0, 2150); }
      else {
        if (row.knowledge === null) throw new Error('knowledge');
        integer(row.quantity, 1, 20);
        if (row.knowledge === 'known') integer(row.satiety, 0, 2150);
        else if (row.satiety !== null) throw new Error('hidden satiety');
      }
    });
    rows(root.companions, ['actorId', 'targetRevision', 'band', 'departing'], 'actorId', row => {
      integer(row.targetRevision); enumeration(row.band, ['fed', 'hungry', 'weak', 'starving']); boolean(row.departing);
    });
    rows(root.heatSources, ['interactableId', 'kind'], 'interactableId', row => enumeration(row.kind, ['bonfire', 'hearth-station']));
    return detached(value) as ForagingUiView;
  } catch { return null; }
}
export function foragingErrorKey(code: WorldErrorCode | null, exists: (key: string) => boolean): string {
  if (code && errorCodes.has(code)) {
    const suffix = code.slice(3).toLowerCase();
    for (const key of [`ext.foraging.error.${suffix}`, `ext.foundation.world.error.${suffix}`]) if (exists(key)) return key;
  }
  return 'ext.foraging.ui.rejected';
}
/** Labels originate exclusively in the public display frame, never definitions. */
export function foragingNodeCards(view: ForagingUiView, frame: DisplayFrame | null): ForagingNodeCard[] {
  return view.nodes.flatMap(node => {
    const name = frame?.interactables?.find(row => row.id === node.interactableId)?.displayName;
    return typeof name === 'string' && name.trim() ? [{ ...node, displayName: name }] : [];
  });
}
export function foragingCompanionCards(view: ForagingUiView, frame: DisplayFrame | null, fallback: string): ForagingCompanionCard[] {
  return view.companions.map(companion => {
    const row = frame?.rows?.find(entry => entry.kind === 'monster' && entry.id === companion.actorId);
    const position = row?.kind === 'monster' ? row.loc : null, player = frame?.player;
    const adjacent = !!position && !!player && [position.x, position.y, player.x, player.y].every(Number.isSafeInteger)
      && Math.max(Math.abs(position.x - player.x), Math.abs(position.y - player.y)) <= 1;
    return { ...companion, displayName: row?.name || fallback, adjacent };
  });
}
