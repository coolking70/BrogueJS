import type { Creature } from '../entities/Creature';

/** Engine creation entry points, never inferred from species, HP or level. */
export type CreationReason = 'natural' | 'summoned' | 'split' | 'clone' | 'periodic' | 'scripted' | 'test';

export interface CreatureBirth {
    readonly creationReason: CreationReason;
    readonly originalMonsterType: string | null;
    readonly initiallyHostile: boolean;
    readonly sourceId: number | null;
    /** True only when native stats were copied from sourceId, not fresh catalog stats. */
    readonly nativeStatsCopied: boolean;
}

// This is a one-way, session-only construction bridge. The runtime copies this
// DTO into the committed birth fact; modules own any persistent reward identity.
// It is not entity state, does not survive decoding, and never owns a creature.
const births = new WeakMap<Creature, CreatureBirth>();

/** Call only from extended creation paths, after initial allegiance/captivity
 * is set and before first attachment. Later allegiance/polymorph cannot reprice
 * a birth. The override describes a creation-time faction assignment that the
 * original engine performs after insertion (armor phantoms), without moving it.
 * Repeated attachment, revival and relocation never mark a new birth. */
export function markCreatureBirth(creature: Creature, creationReason: CreationReason, sourceId: number | null = null,
    initiallyHostileOverride?: boolean,
    nativeStatsCopied = creationReason === 'clone' || creationReason === 'split'): void {
    if (births.has(creature)) return;
    const monster = creature as Creature & { typeId?: string; isAlly?: boolean; isCaged?: boolean };
    births.set(creature, Object.freeze({ creationReason,
        originalMonsterType: typeof monster.typeId === 'string' ? monster.typeId : null,
        initiallyHostile: initiallyHostileOverride ?? (typeof monster.typeId === 'string' && !monster.isAlly && !monster.isCaged),
        sourceId, nativeStatsCopied }));
}

export function readCreatureBirth(creature: Creature): CreatureBirth | undefined {
    return births.get(creature);
}
