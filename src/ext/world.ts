import { isJson, validId } from './json';
import { validOwnedRegions, type OwnedRegion } from './regions';

/** Foundation-owned, non-blocking/non-combat world objects. No module-specific
 * rules or Creature lifecycle are implied by this capability. */
export interface WorldInteractable {
    readonly id: number; readonly owner: string; readonly depth: number;
    readonly x: number; readonly y: number; readonly instanceKey: string; readonly contentId: string;
    readonly nameKey: string; readonly descriptionKey: string; readonly glyph: string; readonly color: string;
    readonly interactionDistance: number; readonly priority: number;
}
export type WorldInteractableView = Omit<WorldInteractable, 'instanceKey' | 'contentId'>;
export interface WorldInteractablePlacement {
    readonly instanceKey: string; readonly contentId: string;
    readonly nameKey: string; readonly descriptionKey: string; readonly glyph: string; readonly color: string;
    readonly interactionDistance: number; readonly priority: number;
    readonly minStairDistance: number; readonly maxEntranceDistance: number;
}
export interface WorldInteractablePlacementResult { readonly instanceKey: string; readonly entity: WorldInteractable | null }
export interface InteractionGate { readonly owner: string; readonly targetEntityId: number; readonly sessionId: number }
export interface WorldInteractionSnapshot { entities: WorldInteractable[]; gate: InteractionGate | null; regions?: OwnedRegion[] }
export interface WorldInteractionValidation {
    readonly entities: readonly WorldInteractable[]; readonly gate: InteractionGate | null;
    readonly depth: number; readonly turn: number; readonly isGameOver: boolean; readonly nextEntityId: number;
    readonly regions?: readonly OwnedRegion[];
}
export interface ExtensionProjectionContext {
    readonly stats?: import('./stats').StatQuery;
    readonly worldWork?: import('./worldSdk').WorldWorkReadSDK;
    readonly actorActionBundles?: readonly import('../engine/Core/ActorActionScheduler').ReadonlyActorActionBundle[];
    readonly playerId?: number;
    worldRestUnavailable?(id:number):import('./worldRest').WorldRestUnavailableReason|null;
    queryOptional(capability: string, input: import('./types').Json): import('./types').OptionalQueryResult;
    readonly state: import('./types').ReadonlyJson; readonly depth: number; readonly turn: number;
    readonly visibleInteractables: readonly WorldInteractableView[];
    readonly nearbyInteractables: readonly WorldInteractableView[];
}
export const WORLD_INTERACTABLE_LIMIT = 1024;
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const keys = (value: unknown, expected: string[]): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === expected.sort().join(',');
function content(value: Record<string, unknown>, owner: string): boolean {
    return validId(value.instanceKey) && validId(value.contentId)
        && typeof value.nameKey === 'string' && value.nameKey.startsWith(`ext.${owner}.`) && value.nameKey.length <= 256
        && typeof value.descriptionKey === 'string' && value.descriptionKey.startsWith(`ext.${owner}.`) && value.descriptionKey.length <= 256
        && typeof value.glyph === 'string' && [...value.glyph].length === 1 && !/[\x00-\x1f\x7f]/.test(value.glyph)
        && typeof value.color === 'string' && /^#[a-fA-F0-9]{6}$/.test(value.color)
        && integer(value.interactionDistance, 0, 16) && integer(value.priority, -1000, 1000);
}
export function validWorldPlacement(value: unknown, owner: string): value is WorldInteractablePlacement {
    return isJson(value) && keys(value, ['instanceKey','contentId','nameKey','descriptionKey','glyph','color','interactionDistance','priority','minStairDistance','maxEntranceDistance'])
        && content(value, owner) && integer(value.minStairDistance, 0, 256) && integer(value.maxEntranceDistance, 0, 256);
}
export function validWorldSnapshot(value: unknown, owners: readonly string[]): value is WorldInteractionSnapshot {
    if (!isJson(value) || !keys(value, Object.prototype.hasOwnProperty.call(value ?? {}, 'regions') ? ['entities','gate','regions'] : ['entities','gate'])
        || !Array.isArray(value.entities) || value.entities.length > WORLD_INTERACTABLE_LIMIT) return false;
    if ('regions' in value && !validOwnedRegions(value.regions, owners)) return false;
    let previous = 0; const instances = new Set<string>();
    for (const raw of value.entities) {
        if (!keys(raw, ['id','owner','depth','x','y','instanceKey','contentId','nameKey','descriptionKey','glyph','color','interactionDistance','priority'])
            || !integer(raw.id, previous + 1) || typeof raw.owner !== 'string' || !owners.includes(raw.owner)
            || !integer(raw.depth, 1, 40) || !integer(raw.x, 0, 1023) || !integer(raw.y, 0, 1023) || !content(raw, raw.owner)) return false;
        const instance = `${raw.owner}:${raw.instanceKey}`;
        if (instances.has(instance)) return false;
        instances.add(instance); previous = raw.id;
    }
    const entities = value.entities as unknown as WorldInteractable[];
    if ((value.regions as OwnedRegion[] | undefined)?.some(region => entities.some(entity => entity.id === region.id))) return false;
    if (value.gate === null) return true;
    const gate = value.gate;
    return keys(gate, ['owner','targetEntityId','sessionId']) && typeof gate.owner === 'string' && owners.includes(gate.owner)
        && integer(gate.targetEntityId, 1) && integer(gate.sessionId, 1)
        && (value.entities as unknown as WorldInteractable[]).some(entity => entity.id === gate.targetEntityId && entity.owner === gate.owner);
}
export function publicInteractable(entity: WorldInteractable): WorldInteractableView {
    const { instanceKey: _instance, contentId: _content, ...view } = entity;
    return Object.freeze(view);
}
export function sortInteractables<T extends Pick<WorldInteractable,'priority'|'id'>>(entities: readonly T[]): T[] {
    return [...entities].sort((a,b) => b.priority - a.priority || a.id - b.id);
}

/** Empty region ownership is absence, including every C5 placement path. */
export function setOwnedRegions(world: WorldInteractionSnapshot, list: OwnedRegion[]): void {
    if (list.length) world.regions = list; else delete world.regions;
}
