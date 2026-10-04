import type { Creature } from '../../entities/Creature';
import type { Pos } from '../../types';
import type { Grid } from '../Map/Grid';
import { assertNativeSpatial, footprintOf, nearestContact, type FootprintActor } from '../Movement/CreatureSpatial';
import { entrancementDiagonalBlocked, entrancementPassable } from '../Movement/Entrancement';

export type BodyAttackContact = ReturnType<typeof nearestContact>;
type MeleeActor = FootprintActor & { hasBehavior?(flag: string): boolean };

/** CE Monsters.c:3823-3827 / Combat.c:1212-1217, lifted to pairs of body
 * cells. Search ALL adjacent pairs: the geometrically first pair may be behind
 * a corner. Stable footprint y/x order breaks equal-distance ties. Pure, no RNG
 * and no player knowledge writes. Through-wall permission belongs to defender. */
export function nearestLegalMeleeContact(grid: Grid, attacker: MeleeActor, defender: MeleeActor, options: { allowThroughWalls?: boolean; requirePassableTerrain?: boolean } = {}): BodyAttackContact | null {
    const throughWall = options.allowThroughWalls !== false && defender.hasBehavior?.('MONST_ATTACKABLE_THRU_WALLS');
    for (const from of footprintOf(attacker)) for (const to of footprintOf(defender)) {
        if (Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) !== 1) continue;
        if (!throughWall && ((options.requirePassableTerrain !== false && (!entrancementPassable(grid, from) || !entrancementPassable(grid, to)))
            || entrancementDiagonalBlocked(grid, from, to))) continue;
        return Object.freeze({ from: Object.freeze({ ...from }), to: Object.freeze({ ...to }), distance: 1 });
    }
    return null;
}

/** Synchronous presentation/damage position, never an anchor mutation or saved
 * state. Nested reflected/retaliation/death effects restore the prior scope even
 * on exceptions. No entries are allocated for ordinary 1x1 attacks. */
const contacts = new WeakMap<Creature, Readonly<Pos>>();
export function physicalContactOf(creature: Creature): Readonly<Pos> { return contacts.get(creature) ?? creature.loc; }
export function bodyAttackContactOf(attacker: Creature, defender: Creature): BodyAttackContact {
    const from = contacts.get(attacker), to = contacts.get(defender);
    return from && to ? Object.freeze({ from: { ...from, zoneId: 'body' }, to: { ...to, zoneId: 'body' },
        distance: Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) }) : nearestContact(attacker, defender);
}
export function withBodyAttackContact<T>(attacker: Creature, defender: Creature, contact: BodyAttackContact, run: () => T): T {
    if (!attacker.spatial && !defender.spatial) return run();
    assertNativeSpatial(attacker); assertNativeSpatial(defender);
    const oldFrom = contacts.get(attacker), oldTo = contacts.get(defender);
    contacts.set(attacker, contact.from); contacts.set(defender, contact.to);
    try { return run(); } finally {
        if (oldFrom) contacts.set(attacker, oldFrom); else contacts.delete(attacker);
        if (oldTo) contacts.set(defender, oldTo); else contacts.delete(defender);
    }
}

/** Native geometry origin: cast from the leading body boundary, not through
 * the attacker's own body. Ordinary 1x1 origins are identical to CE. */
export function bodyRayOrigin(actor: FootprintActor, dx: number, dy: number): Readonly<Pos> {
    let origin = actor.loc, score = -Infinity;
    for (const p of footprintOf(actor)) {
        const next = p.x * dx + p.y * dy;
        if (next > score) { origin = p; score = next; }
    }
    return origin;
}

/** Directional geometry has an explicit origin and first intersected body cell.
 * The caller owns wall/visibility/enemy filtering and the projectile scope. */
export function bodyRayContact(attacker: Creature, defender: Creature, dx: number, dy: number, range: number, origin?: Readonly<Pos>): BodyAttackContact {
    const from = origin ?? bodyRayOrigin(attacker, dx, dy);
    for (let step = 1; step <= range; step++) {
        const to = footprintOf(defender).find(p => p.x === from.x + step * dx && p.y === from.y + step * dy);
        if (to) return Object.freeze({ from: Object.freeze({ ...from, zoneId: 'body' }), to, distance: step });
    }
    return nearestContact(attacker, defender);
}
