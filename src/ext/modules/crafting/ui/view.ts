import type { CraftingView } from '../view';
import type { WorldErrorCode } from '../../../worldSdk';
import locale from '../locales/zh_CN.json';

export type CraftingUiView = Extract<CraftingView, { available: true }>;
export type CraftingTab = 'harvest' | 'craft' | 'station' | 'work';
export type CraftingDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export interface CraftingDraft {
  tab: CraftingTab;
  batches: Readonly<Record<string, number>>;
  directions: Readonly<Record<string, CraftingDirection>>;
}
export const emptyCraftingDraft = (): CraftingDraft => ({ tab: 'harvest', batches: {}, directions: {} });
export const craftingDirections: readonly { id: CraftingDirection; dx: number; dy: number; glyph: string }[] = [
  { id: 'nw', dx: -1, dy: -1, glyph: '↖' }, { id: 'n', dx: 0, dy: -1, glyph: '↑' },
  { id: 'ne', dx: 1, dy: -1, glyph: '↗' }, { id: 'w', dx: -1, dy: 0, glyph: '←' },
  { id: 'e', dx: 1, dy: 0, glyph: '→' }, { id: 'sw', dx: -1, dy: 1, glyph: '↙' },
  { id: 's', dx: 0, dy: 1, glyph: '↓' }, { id: 'se', dx: 1, dy: 1, glyph: '↘' },
];
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
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) throw new Error('object');
  if (Reflect.ownKeys(value).length !== keys.length || keys.some(key => {
    const field = own(value, key); return !field || !('value' in field) || !field.enumerable;
  })) throw new Error('keys');
  return value as Record<string, unknown>;
}
function list(value: unknown, maximum: number, check: (entry: unknown) => void, minimum = 0) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < minimum || value.length > maximum
    || Reflect.ownKeys(value).length !== value.length + 1) throw new Error('array');
  for (let i = 0; i < value.length; i++) {
    const field = own(value, String(i));
    if (!field || !('value' in field) || !field.enumerable) throw new Error('array entry');
    check(field.value);
  }
}
function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error('integer');
}
function string(value: unknown, pattern?: RegExp, maximum = 256): asserts value is string {
  if (typeof value !== 'string' || !value.length || value.length > maximum || (pattern && !pattern.test(value))) throw new Error('string');
}
const definition = (value: unknown) => string(value, /^crafting\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 128);
function textKey(value: unknown) {
  string(value, /^ext\.crafting\.[a-z0-9][a-z0-9._-]*$/);
  if (!Object.prototype.hasOwnProperty.call(locale, value)) throw new Error('text key');
}
function boolean(value: unknown) { if (typeof value !== 'boolean') throw new Error('boolean'); }
function enumeration(value: unknown, values: readonly string[]) { if (typeof value !== 'string' || !values.includes(value)) throw new Error('enum'); }
function reason(value: unknown) { if (value !== null && (typeof value !== 'string' || !errorCodes.has(value))) throw new Error('reason'); }
function pair(id: unknown, revision: unknown) {
  if (id === null && revision === null) return;
  integer(id, 1); integer(revision);
}
function tags(value: unknown, minimum = 0) {
  let previous = '';
  list(value, 16, entry => { string(entry, /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/, 128); if (entry <= previous) throw new Error('tags'); previous = entry; }, minimum);
}
function unique(value: unknown, maximum: number, key: string, check: (entry: Record<string, unknown>) => void, keys: readonly string[], minimum = 0) {
  const seen = new Set<unknown>();
  list(value, maximum, entry => { const row = object(entry, keys); check(row); if (seen.has(row[key])) throw new Error('duplicate'); seen.add(row[key]); }, minimum);
}
function amounts(value: unknown, kind: 'input' | 'output' | 'cost') {
  const quantity = kind === 'cost' ? 'need' : 'perBatch';
  unique(value, 8, 'itemDefinitionId', row => {
    definition(row.itemDefinitionId); textKey(row.nameKey); integer(row[quantity], 1, 99);
    if (kind !== 'output') integer(row.have);
  }, ['itemDefinitionId', 'nameKey', quantity, ...(kind === 'output' ? [] : ['have'])], 1);
}
function detached<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(entry => detached(entry))) as T;
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, detached(entry)]))) as T;
  return value;
}
/** The entire public DTO is one display capability. Never salvage a partial row.
 * Descriptors are checked before values are read, so accessors are never invoked. */
export function readCraftingUiView(value: unknown): CraftingUiView | null {
  try {
    if (!value || typeof value !== 'object' || own(value, 'available')?.value !== true) return null;
    const root = object(value, ['v', 'available', 'levelRef', 'inventoryStamp', 'activeTicket', 'nodes', 'stations', 'recipes', 'placements', 'history']);
    if (root.v !== 1 || root.available !== true) return null;
    const level = root.levelRef;
    if (level && typeof level === 'object' && own(level, 'kind')?.value === 'dungeon') integer(object(level, ['kind', 'depth']).depth, 1, 40);
    else { const site = object(level, ['kind', 'id']); if (site.kind !== 'site') throw new Error('level'); string(site.id, /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/, 128); }
    string(root.inventoryStamp, undefined, 1024);
    if (root.activeTicket !== null) {
      const ticket = object(root.activeTicket, ['ticketId', 'ticketRevision', 'kind', 'definitionId', 'nameKey', 'totalBatches', 'completedBatches', 'remainingTicks', 'status']);
      integer(ticket.ticketId, 1); integer(ticket.ticketRevision); definition(ticket.definitionId); textKey(ticket.nameKey);
      enumeration(ticket.kind, ['harvest', 'craft', 'station', 'build']); enumeration(ticket.status, ['working', 'suspended', 'completed', 'cancelled']);
      integer(ticket.totalBatches, 1, 16); integer(ticket.completedBatches, 0, ticket.totalBatches); integer(ticket.remainingTicks, 0, 10000);
    }
    unique(root.nodes, 32, 'interactableId', row => {
      integer(row.interactableId, 1); definition(row.definitionId); textKey(row.nameKey); integer(row.nodeRevision);
      string(row.glyph); if ([...row.glyph].length !== 1 || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(row.glyph)) throw new Error('glyph');
      string(row.color, /^#[\dA-Fa-f]{6}$/); integer(row.capacity, 1, 9999); integer(row.remaining, 0, row.capacity); integer(row.available, 0, row.remaining);
      if (row.requiredToolTag !== null) string(row.requiredToolTag, /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/, 128);
      boolean(row.canHarvest); reason(row.reason); if (row.canHarvest !== (row.reason === null) || (row.canHarvest && row.available === 0)) throw new Error('harvest eligibility');
    }, ['interactableId', 'definitionId', 'nameKey', 'glyph', 'color', 'remaining', 'capacity', 'available', 'nodeRevision', 'requiredToolTag', 'canHarvest', 'reason']);
    unique(root.stations, 128, 'interactableId', row => {
      integer(row.interactableId, 1); definition(row.definitionId); textKey(row.nameKey); tags(row.tags, 1); integer(row.stationRevision); boolean(row.inReach);
    }, ['interactableId', 'definitionId', 'nameKey', 'tags', 'stationRevision', 'inReach']);
    unique(root.recipes, 128, 'recipeId', row => {
      definition(row.recipeId); textKey(row.nameKey); textKey(row.descriptionKey); amounts(row.inputs, 'input'); amounts(row.outputs, 'output');
      integer(row.workTicks, 100, 10000); tags(row.stationTags); pair(row.stationId, row.stationRevision); integer(row.maxBatch, 0, 16); reason(row.reason);
      if ((row.maxBatch > 0) !== (row.reason === null)) throw new Error('recipe eligibility');
      if ((row.inputs as { perBatch: number; have: number }[]).some(input => (row.maxBatch as number) > Math.floor(input.have / input.perBatch))) throw new Error('recipe ingredients');
      const stationTags = row.stationTags as string[];
      if (!stationTags.length && row.stationId !== null) throw new Error('hand station');
      if (stationTags.length && row.maxBatch > 0 && row.stationId === null) throw new Error('missing station');
    }, ['recipeId', 'nameKey', 'descriptionKey', 'inputs', 'outputs', 'workTicks', 'stationTags', 'stationId', 'stationRevision', 'maxBatch', 'reason']);
    unique(root.placements, 128, 'definitionId', row => {
      definition(row.definitionId); textKey(row.nameKey); integer(row.placementTicks, 1, 10000); integer(row.kitHave); amounts(row.cost, 'cost');
      if (row.source !== null) enumeration(row.source, ['kit', 'materials']);
      const affordable = (row.cost as { need: number; have: number }[]).every(cost => cost.have >= cost.need);
      const expectedSource = row.kitHave > 0 ? 'kit' : affordable ? 'materials' : null;
      if (row.source !== expectedSource) throw new Error('placement source');
    }, ['definitionId', 'nameKey', 'placementTicks', 'source', 'kitHave', 'cost']);
    let lastFact = Number.MAX_SAFE_INTEGER;
    unique(root.history, 8, 'factId', row => {
      integer(row.factId, 1, lastFact); if (row.factId === lastFact && lastFact !== Number.MAX_SAFE_INTEGER) throw new Error('history order'); lastFact = row.factId;
      definition(row.definitionId); enumeration(row.operation, ['harvest', 'craft-batch', 'place-station', 'cancel', 'startup']);
      integer(row.completedBatches, 0, 16); enumeration(row.result, ['completed', 'interrupted', 'skipped']); integer(row.tick);
      if (row.reason !== null) string(row.reason, undefined, 128);
    }, ['factId', 'operation', 'definitionId', 'completedBatches', 'result', 'reason', 'tick']);
    return detached(value) as CraftingUiView;
  } catch { return null; }
}

/** Keys are selected from a finite code set. Never display engine codes/fields. */
export function craftingErrorKey(code: WorldErrorCode | null, exists: (key: string) => boolean): string {
  if (code && errorCodes.has(code)) {
    const suffix = code.slice(3).toLowerCase();
    for (const key of [`ext.crafting.error.${suffix}`, `ext.foundation.world.error.${suffix}`]) if (exists(key)) return key;
  }
  return 'ext.crafting.ui.rejected';
}
