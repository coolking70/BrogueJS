import type { Creature } from '../../entities/Creature';
import { integer, keys, SpatialValidationError, type BodyDefinition, type BodyGroupState, type SpatialCatalog } from './SpatialSchema';

function invalid(): never { throw new SpatialValidationError('Invalid production body group'); }
/** The applied break set determines both direct destruction and chain subtree
 * retirement. A tombstone consumes its original slot; regeneration is closed. */
export function retiredBodyParts(definition: BodyDefinition, group: BodyGroupState): ReadonlySet<string> {
    const retired = new Set(group.appliedBreaks.map(b => b.partId));
    for (let changed = true; changed;) {
        changed = false;
        for (const edge of definition.constraints) if (retired.has(edge.parentPartId) && !retired.has(edge.childPartId)) {
            retired.add(edge.childPartId); changed = true;
        }
    }
    return retired;
}
/** Pure ownership/receipt validation shared by live planning and detached load.
 * Geometry and physical lane checks remain with the caller's spatial world. */
export function validateBodyGroup(group: BodyGroupState, catalog: SpatialCatalog, entity: (id: number) => Creature | undefined): void {
    keys(group, ['schema', 'groupId', 'coreId', 'bodyDefinitionId', 'members', 'appliedBreaks']);
    const definition = catalog.body(group.bodyDefinitionId);
    if (group.schema !== 1 || !integer(group.groupId, 1) || group.coreId !== group.groupId || !Array.isArray(group.members)
        || group.members.length !== definition.parts.length || !Array.isArray(group.appliedBreaks)
        || group.appliedBreaks.length > definition.parts.length - 1) invalid();
    const breaks = new Set<string>();
    for (const b of group.appliedBreaks) {
        keys(b, ['partId', 'zoneId', 'generation']);
        const part = definition.parts.find(p => p.partId === b.partId);
        if (!part || part.role === 'core' || b.zoneId !== 'body' || b.generation !== 0 || breaks.has(b.partId)) invalid();
        breaks.add(b.partId);
    }
    const retired = retiredBodyParts(definition, group), parts = new Set<string>(), ids = new Set<number>();
    for (const slot of group.members) {
        keys(slot, ['partId', 'entityId', 'life', 'generation', 'readyInTicks']);
        const part = definition.parts.find(p => p.partId === slot.partId);
        if (!part || parts.has(slot.partId) || slot.generation !== 0 || !integer(slot.readyInTicks, 0, 1000000)) invalid();
        parts.add(slot.partId);
        if (retired.has(slot.partId)) {
            if (slot.life !== 'removed' || slot.entityId !== null || slot.readyInTicks !== 0) invalid();
            continue;
        }
        const actor = slot.entityId === null ? undefined : entity(slot.entityId);
        if (slot.life !== 'active' || !integer(slot.entityId, 1) || ids.has(slot.entityId) || !actor || !integer(actor.hp, 1)
            || actor.spatial?.bodyMember?.groupId !== group.groupId || actor.spatial.bodyMember.partId !== slot.partId
            || actor.spatial.footprintId !== catalog.form(part.formId).footprintId
            || (actor as Creature & { typeId?: string }).typeId !== part.formId
            || part.role === 'core' && actor.id !== group.coreId) invalid();
        ids.add(slot.entityId);
    }
}
/** Derive from immutable native speed and unique direct receipts on every read.
 * Never reapply a multiplier to a saved/current speed on load or seek. */
export function bodyMoveTicks(definition: BodyDefinition, group: BodyGroupState, catalog: SpatialCatalog, nativeTicks: number): number {
    if (!integer(nativeTicks, 1, 1000000)) invalid();
    let numerator = BigInt(nativeTicks), denominator = 1n;
    for (const receipt of group.appliedBreaks) {
        const part = definition.parts.find(p => p.partId === receipt.partId)!;
        for (const modifier of catalog.breakRule(part.breakRuleId).modifiers) if (modifier.kind === 'move-ticks-multiplier') {
            numerator *= BigInt(modifier.numerator); denominator *= BigInt(modifier.denominator);
        }
    }
    const ticks = (numerator + denominator - 1n) / denominator;
    if (ticks < 1n || ticks > 1000000n) invalid();
    return Number(ticks);
}
