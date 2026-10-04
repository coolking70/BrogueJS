import { assertCombatJson, assertLoadedCombatPack, cells, freezeCombat, id, integer, record } from './schema';
import { attackTiming, FACINGS, validateCombatResources, validateCombatSource, validateLockedCells } from './components';
import { validateCombatState } from './state';
import type { AttackShape, Cell, CombatAction, CombatPack, CombatResources, CombatSource, CombatState, Facing } from './types';

export interface SourceRequest {
    source: CombatSource; attackId: string; facing: Facing; footprint: Cell[];
}
export interface BundleRequest {
    schema: 1; revision: number; sessionRevision: number; coreEntityId: number;
    decisionOwnerId: number; timeChargeOwnerId: number; groupId: number; depth: number;
    profileId: string; eligible: boolean; resources: CombatResources;
    groupFootprint: Cell[]; subactions: SourceRequest[];
}
/** This is an adapter seam, NOT a registered foundation capability. Only future
 * foundation geometry may implement it in production. It receives the initiating
 * member's footprint and explicit relative template, never a union as its source.
 * It must enforce bounds/LOS/exclusion using trusted detached world facts. */
export interface ShapeProjectionRequest {
    source: CombatSource; footprint: Cell[]; groupFootprint: Cell[];
    shape: AttackShape; facing: Facing;
}
export type ShapeProjection = (request: Readonly<ShapeProjectionRequest>) => readonly Cell[];
export interface CombatPlan {
    revision: number; sessionRevision: number;
    action: Omit<CombatAction, 'actionId'>;
    durationTicks: number; nextBoundaryTicks: number;
}
export type CombatPlanResult = { status: 'ready'; plan: CombatPlan }
    | { status: 'rejected'; reason: 'stale' | 'ineligible' | 'insufficient-stamina' | 'foundation-unavailable' };

function readRequest(value: unknown, pack: CombatPack): BundleRequest {
    assertCombatJson(value);
    const input = record(value, ['schema', 'revision', 'sessionRevision', 'coreEntityId', 'decisionOwnerId', 'timeChargeOwnerId', 'groupId', 'depth', 'profileId', 'eligible', 'resources', 'groupFootprint', 'subactions']);
    if (input.schema !== 1 || typeof input.eligible !== 'boolean') throw new Error('combat: invalid planning request');
    integer(input.revision, 0, Number.MAX_SAFE_INTEGER - 1); integer(input.sessionRevision, 1);
    integer(input.coreEntityId, 1); integer(input.groupId, 1); integer(input.depth, 1, 40);
    if (input.decisionOwnerId !== input.coreEntityId || input.timeChargeOwnerId !== input.coreEntityId) throw new Error('combat: only core may own a bundle');
    const profile = pack.profiles.find(item => item.id === input.profileId);
    const resources = validateCombatResources(input.resources, pack);
    if (!profile || profile.resourcePolicyId !== resources.policyId) throw new Error('combat: profile/resource mismatch');
    const group = cells(input.groupFootprint, 1024), groupKeys = new Set(group.map(cell => `${cell.x},${cell.y}`));
    if (!Array.isArray(input.subactions) || input.subactions.length < 1 || input.subactions.length > 4) throw new Error('combat: subaction budget');
    const entities = new Set<number>(), parts = new Set<string>(), occupied = new Set<string>();
    for (const value of input.subactions) {
        const sub = record(value, ['source', 'attackId', 'facing', 'footprint']);
        const source = validateCombatSource(sub.source);
        if (entities.has(source.entityId) || parts.has(source.partId)) throw new Error('combat: duplicate source member');
        entities.add(source.entityId); parts.add(source.partId);
        if (!profile.attackIds.includes(sub.attackId as string) || !FACINGS.includes(sub.facing as Facing)) throw new Error('combat: invalid profile attack/facing');
        for (const cell of cells(sub.footprint, 256)) {
            const key = `${cell.x},${cell.y}`;
            if (!groupKeys.has(key) || occupied.has(key)) throw new Error('combat: inconsistent source/group footprint');
            occupied.add(key);
        }
    }
    return structuredClone(value) as BundleRequest;
}
/** Pure preflight: no RNG, ID allocation, resource write, engine command, actor
 * binding or timer. Invalid data/providers throw; an absent adapter is explicit.
 * Later segments must be locked by the future executor with positive warning time.
 */
export function planCombatBundle(pack: CombatPack, stateValue: CombatState, value: unknown, projectShape?: ShapeProjection): CombatPlanResult {
    assertLoadedCombatPack(pack);
    const state = validateCombatState(stateValue), input = readRequest(value, pack);
    if (state.revision !== input.revision) return { status: 'rejected', reason: 'stale' };
    if (!input.eligible) return { status: 'rejected', reason: 'ineligible' };
    const sources = [...input.subactions].sort((a, b) => a.source.partId < b.source.partId ? -1 : a.source.partId > b.source.partId ? 1 : 0);
    const cost = sources.reduce((sum, source) => sum + pack.attacks.find(attack => attack.id === source.attackId)!.cost, 0);
    if (input.resources.stamina < cost) return { status: 'rejected', reason: 'insufficient-stamina' };
    if (!projectShape) return { status: 'rejected', reason: 'foundation-unavailable' };
    const durations: number[] = [];
    const subactions = sources.map((source, index) => {
        const attack = pack.attacks.find(item => item.id === source.attackId)!;
        durations.push(attackTiming(attack).duration);
        const request = freezeCombat(structuredClone({ source: source.source, footprint: source.footprint,
            groupFootprint: input.groupFootprint, shape: attack.segments[0]!.shape, facing: source.facing }));
        const projected = projectShape(request);
        assertCombatJson(projected); validateLockedCells(projected);
        return { sourceSubactionId: index + 1, source: source.source, attackId: source.attackId, facing: source.facing,
            phase: 'windup' as const, phaseRemainingTicks: attack.windupTicks, elapsedTicks: 0, nextSegmentIndex: 0,
            lockedCells: structuredClone(projected) as Cell[] };
    });
    return freezeCombat({ status: 'ready', plan: { revision: state.revision, sessionRevision: input.sessionRevision,
        action: { schema: 1, decisionOwnerId: input.coreEntityId, timeChargeOwnerId: input.coreEntityId,
            groupId: input.groupId, profileId: input.profileId, depth: input.depth, paidCost: cost, subactions },
        durationTicks: Math.max(...durations), nextBoundaryTicks: Math.min(...subactions.map(sub => sub.phaseRemainingTicks)) } });
}

export interface PartContact { entityId: number; groupId: number; partId: string; generation: number }
/** Fixture-level mechanical key contract. Input order belongs to foundation
 * collectBodyTargets; never re-sort contacts here or collapse a group to one hit.
 * No receipts are persisted and no damage is applied by this helper. */
export function deduplicatePartContacts(value: unknown): PartContact[] {
    assertCombatJson(value);
    if (!Array.isArray(value) || value.length > 1024) throw new Error('combat: contact budget');
    const seen = new Set<string>();
    const result: PartContact[] = [];
    for (const item of value) {
        const contact = record(item, ['entityId', 'groupId', 'partId', 'generation']);
        integer(contact.entityId, 1); integer(contact.groupId, 1); integer(contact.generation, 1);
        // Part identifiers share the same namespace restrictions as source IDs.
        id(contact.partId);
        const key = JSON.stringify([contact.entityId, contact.groupId, contact.partId, contact.generation]);
        if (!seen.has(key)) { seen.add(key); result.push(structuredClone(item) as PartContact); }
    }
    return result;
}
