import type { ActorFacts, ExtensionRuleContext, Json, ReadonlyJson } from './types';
import { integer, identity, keys } from '../engine/Movement/SpatialSchema';

/** Foundation-owned protocol; no import of a content/combat module. */
export const PART_BREAK_CAPABILITY = 'combat.part-break.v1' as const;
export interface PartBreakReceipt {
    readonly groupId: number;
    readonly partId: string;
    readonly zoneId: string;
    readonly generation: number;
}
export interface PartBreakRequest extends PartBreakReceipt {
    readonly schema: 1;
    readonly resolutionId: number;
    readonly actorId: number;
    readonly sourceId: number | null;
    readonly balanceLoss: number;
    readonly fallbackStunTicks: number;
}
export interface PartBreakPrepareContext extends ExtensionRuleContext {
    readonly actor: Readonly<ActorFacts>;
    /** Foundation-attested live slot. A request alone cannot authorize members. */
    readonly member?: Readonly<PartBreakMemberIdentity>;
}
export interface PartBreakMemberIdentity {
    readonly entityId: number;
    readonly groupId: number;
    readonly partId: string;
    readonly generation: number;
    readonly bodyDefinitionId: string;
}
export type PartBreakPreparation = { status: 'ready'; plan: Json }
    | { status: 'unsupported'; reason: 'disabled' | 'unsupported-target' };
/** Commit may write only the provider's state/components and buffered messages.
 * No HP/resource, commands, rewards, world placement or RNG capabilities. Plans
 * are synchronous, cloned/frozen, consumed once and never leave this call. */
export interface PartBreakCommitContext {
    readonly state: Json;
    readonly member?: Readonly<PartBreakMemberIdentity>;
    setState(state: Json): void;
    getComponent(actorId: number, name: string): Json | undefined;
    setComponent(actorId: number, name: string, value: Json): void;
    removeComponent(actorId: number, name: string): void;
    message(text: string): void;
}
export interface PartBreakProvider {
    prepare(request: Readonly<PartBreakRequest>, context: PartBreakPrepareContext): PartBreakPreparation;
    commit(request: Readonly<PartBreakRequest>, plan: ReadonlyJson, context: PartBreakCommitContext): void;
}
export type PartBreakChoice = { readonly status: 'handled' }
    | { readonly status: 'fallback'; readonly reason: 'absent' | 'disabled' | 'unsupported-target' };
export interface PartBreakNativeCommit<T> {
    apply(choice: PartBreakChoice): T;
    /** Restore all native writes/plan cancellation, preserving object identity. */
    rollback(): void;
}
export type PartBreakCommitter = <T>(request: PartBreakRequest, native: PartBreakNativeCommit<T>) => T;
export function validatePartBreakRequest(value: unknown, member?: Readonly<PartBreakMemberIdentity>): asserts value is PartBreakRequest {
    keys(value, ['schema', 'resolutionId', 'actorId', 'sourceId', 'groupId', 'partId', 'zoneId', 'generation', 'balanceLoss', 'fallbackStunTicks']);
    if (value.schema !== 1 || !integer(value.resolutionId, 1) || !integer(value.actorId, 1)
        || value.groupId !== value.actorId || !identity(value.partId) || !identity(value.zoneId)
        || (value.partId === 'self' && value.zoneId === 'body')
        || value.partId !== 'self' && (!member || member.groupId !== value.groupId || member.partId !== value.partId
            || member.generation !== value.generation || !integer(member.entityId,1) || !identity(member.bodyDefinitionId))
        || value.generation !== 0 || (value.sourceId !== null && !integer(value.sourceId, 1))
        || !integer(value.balanceLoss, 0, 1000000) || !integer(value.fallbackStunTicks, 0, 1000000))
        throw new Error('Invalid fixed zone break request');
}
