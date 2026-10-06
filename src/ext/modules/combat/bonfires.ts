import type { ExtensionContext, HookEvents, Json, WorldInteractable, WorldInteractablePlacement, WorldInteractablePlacementResult } from '../../types';
import { bonfireBindingDefinition, bonfireInstanceKey, validateBonfireState,
    type BonfireBinding, type BonfirePendingPlacement, type BonfireState } from '../../worldRest';
import { assertLoadedCombatPack, CombatValidationError, integer } from './schema';
import type { CombatPack } from './types';

const order = (a: BonfireBinding, b: BonfireBinding): number => a.instanceKey < b.instanceKey ? -1 : a.instanceKey > b.instanceKey ? 1 : 0;
const fail = (path: string): never => { throw new CombatValidationError('INVALID_STATE', path); };
function rootState(context: ExtensionContext): Record<string, Json> {
    if (!context.state || typeof context.state !== 'object' || Array.isArray(context.state)) fail('$state');
    return context.state as Record<string, Json>;
}
function commit(pack: CombatPack, root: Record<string, Json>, state: BonfireState, context: ExtensionContext): void {
    const next = validateBonfireState(state, pack.bonfires, Number.MAX_SAFE_INTEGER);
    context.setState({ ...root, revision: integer(root.revision, 0, Number.MAX_SAFE_INTEGER - 1) + 1, bonfires: next as unknown as Json });
}
/** The enteredLevel foundation transaction owns placement and rolls back both
 * this ledger and world objects on failure. Cache revisits and load place none. */
export function enterCombatLevel(pack: CombatPack, event: Readonly<HookEvents['enteredLevel']>, context: ExtensionContext): void {
    assertLoadedCombatPack(pack);
    if (!event.firstVisit) return;
    integer(event.depth, 1, 40);
    if (event.depth !== context.depth) fail('$event.depth');
    const root = rootState(context), state = validateBonfireState(root.bonfires, pack.bonfires, Number.MAX_SAFE_INTEGER);
    const before = JSON.stringify(state), depth = event.depth;
    const retained: BonfirePendingPlacement[] = [];
    for (const pending of state.pending) {
        const { definition } = bonfireBindingDefinition(pack.bonfires, pending)!;
        if (depth > definition.placement.maxDepth) state.placements.push({ definitionId: pending.definitionId,
            instanceKey: pending.instanceKey, depth, result: 'skipped', visits: 0, completedRests: 0 });
        else retained.push(pending);
    }
    state.pending = retained;
    const attempts: BonfirePendingPlacement[] = [];
    for (const definition of [...pack.bonfires.definitions].sort((a,b) => a.id < b.id ? -1 : 1)) {
        const placement = definition.placement;
        if (depth < placement.minDepth || depth > placement.maxDepth) continue;
        const existing = [...state.placements, ...state.pending].filter(row => row.definitionId === definition.id);
        const usedHere = state.placements.filter(row => row.definitionId === definition.id && row.depth === depth).length
            + state.pending.filter(row => row.definitionId === definition.id && row.attemptedDepths.includes(depth)).length;
        let available = Math.max(0, placement.maxPerDepth - usedHere);
        for (const pending of state.pending.filter(row => row.definitionId === definition.id).sort(order)) {
            if (!available) break;
            if (pending.attemptedDepths.some(attempted => attempted >= depth)) continue;
            attempts.push(pending); available--;
        }
        let ordinal = existing.length + 1;
        while (available && ordinal <= placement.maxPerRun) {
            attempts.push({ definitionId: definition.id, instanceKey: bonfireInstanceKey(definition.id, ordinal++), attemptedDepths: [] });
            available--;
        }
    }
    attempts.sort(order);
    const attemptKeys = new Set(attempts.map(row => row.instanceKey));
    const newSlots = attempts.filter(row => !state.pending.some(pending => pending.instanceKey === row.instanceKey)).length;
    if (state.placements.length + state.pending.length + newSlots > pack.bonfires.limits.maxPlacements) fail('$state.bonfires.placements');
    const room = Math.max(0, pack.bonfires.limits.maxActive - Object.keys(state.bindings).length);
    const requests: WorldInteractablePlacement[] = attempts.slice(0, room).map(attempt => {
        const { definition } = bonfireBindingDefinition(pack.bonfires, attempt)!;
        return { instanceKey: attempt.instanceKey, contentId: definition.id, nameKey: definition.nameKey,
            descriptionKey: definition.descriptionKey, glyph: definition.glyph, color: definition.color,
            interactionDistance: definition.interactionDistance, priority: 0,
            minStairDistance: definition.placement.minStairDistance, maxEntranceDistance: definition.placement.maxEntranceDistance };
    });
    // The foundation accepts at most 256 requests per capability call. All
    // chunks remain in this same enteredLevel transaction; earlier chunks are
    // visible to later collision checks and roll back together on any failure.
    const results: WorldInteractablePlacementResult[] = [];
    for (let offset = 0; offset < requests.length; offset += 256) {
        const batch = requests.slice(offset, offset + 256), placed = context.placeInteractables(batch);
        if (placed.length !== batch.length || placed.some((result,index) => result.instanceKey !== batch[index]!.instanceKey)) fail('$world.placements');
        results.push(...placed);
    }
    if (results.length !== requests.length || results.some((result,index) => result.instanceKey !== requests[index]!.instanceKey)) fail('$world.placements');
    state.pending = state.pending.filter(row => !attemptKeys.has(row.instanceKey));
    for (const attempt of attempts) {
        const { definition } = bonfireBindingDefinition(pack.bonfires, attempt)!;
        const entity = results.find(result => result.instanceKey === attempt.instanceKey)?.entity ?? null;
        const binding = { definitionId: definition.id, instanceKey: attempt.instanceKey };
        if (entity) {
            if (!matches(entity, definition, binding, depth) || state.bindings[entity.id]) fail('$world.placements');
            integer(entity.id, 1); state.bindings[entity.id] = binding;
            state.placements.push({ ...binding, depth, result: 'placed', visits: 0, completedRests: 0 });
        } else if (definition.placement.onNoSpace === 'skip' || depth === definition.placement.maxDepth) {
            state.placements.push({ ...binding, depth, result: 'skipped', visits: 0, completedRests: 0 });
        } else state.pending.push({ ...binding, attemptedDepths: [...attempt.attemptedDepths, depth] });
    }
    state.placements.sort(order); state.pending.sort(order);
    if (JSON.stringify(state) !== before) commit(pack, root, state, context);
}
function matches(entity: WorldInteractable, definition: CombatPack['bonfires']['definitions'][number], binding: BonfireBinding, depth: number): boolean {
    return entity.owner === 'combat' && entity.depth === depth && entity.instanceKey === binding.instanceKey
        && entity.contentId === definition.id && entity.nameKey === definition.nameKey && entity.descriptionKey === definition.descriptionKey
        && entity.glyph === definition.glyph && entity.color === definition.color && entity.interactionDistance === definition.interactionDistance && entity.priority === 0;
}
/** Mutual ownership checks cover active and cached level objects. A historical
 * placement/receipt is not a GC root and cannot recreate a collected object. */
export function validateCombatBonfireWorldBindings(pack: CombatPack, raw: unknown,
    world: { readonly entities: readonly WorldInteractable[]; readonly gate: { readonly owner: string } | null }): boolean {
    try {
        assertLoadedCombatPack(pack);
        const state = validateBonfireState(raw, pack.bonfires), owned = world.entities.filter(entity => entity.owner === 'combat');
        if (world.gate?.owner === 'combat' || owned.length !== Object.keys(state.bindings).length) return false;
        const entityIds = new Set<number>(), instances = new Set<string>();
        for (const entity of owned) {
            integer(entity.id, 1);
            if (entityIds.has(entity.id) || instances.has(entity.instanceKey)) return false;
            entityIds.add(entity.id); instances.add(entity.instanceKey);
            const binding = state.bindings[entity.id], found = binding && bonfireBindingDefinition(pack.bonfires, binding);
            if (!found) return false;
            const placement = state.placements.find(row => row.instanceKey === binding!.instanceKey);
            if (!placement || placement.result !== 'placed' || !matches(entity, found.definition, binding!, placement.depth)) return false;
        }
        return true;
    } catch { return false; }
}
/** Foundation collectWorld retains active and cached depths. Removal drops only
 * live bindings; finite run slots, visit totals and rolling receipts persist. */
export function removeCombatBonfires(pack: CombatPack, event: Readonly<HookEvents['interactablesRemoved']>, context: ExtensionContext): void {
    assertLoadedCombatPack(pack);
    if (event.owner !== 'combat') return;
    const root = rootState(context), state = validateBonfireState(root.bonfires, pack.bonfires, Number.MAX_SAFE_INTEGER);
    let changed = false;
    for (const entityId of event.entityIds) {
        if (!state.bindings[entityId]) continue;
        delete state.bindings[entityId]; changed = true;
        if (state.active?.bonfireId === entityId) state.active.interrupted = 'target-removed';
    }
    if (changed) commit(pack, root, state, context);
}
