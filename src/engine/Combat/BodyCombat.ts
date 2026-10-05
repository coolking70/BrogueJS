import type { Creature } from '../../entities/Creature';
import type { Pos } from '../../types';
import type { Grid } from '../Map/Grid';
import { assertNativeSpatial, footprintOf, nearestContact, spatialCatalogFor, type FootprintActor } from '../Movement/CreatureSpatial';
import { entrancementDiagonalBlocked, entrancementPassable } from '../Movement/Entrancement';
import { bodyStatusOwner } from '../Status/BodyStatuses';

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
/** Geometry must validate the actual selected pair before consuming its part
 * scope. A different legal pair elsewhere on the body cannot authorize it. */
export function legalMeleeContactAt(grid: Grid, from: Readonly<Pos>, defender: MeleeActor, to: Readonly<Pos>): boolean {
    return !!nearestLegalMeleeContact(grid, { loc: from }, { loc: to, hasBehavior: defender.hasBehavior?.bind(defender) });
}

/** Synchronous presentation/damage position, never an anchor mutation or saved
 * state. Nested reflected/retaliation/death effects restore the prior scope even
 * on exceptions. No entries are allocated for ordinary 1x1 attacks. */
const contacts = new WeakMap<Creature, Readonly<Pos>>();
export function physicalContactOf(creature: Creature): Readonly<Pos> { return contacts.get(creature) ?? creature.loc; }
export function hasBodyContact(creature: Creature): boolean { return contacts.has(creature); }
const groupDamage = new WeakSet<Creature>();
export function isWholeBodyDamage(creature: Creature): boolean { return groupDamage.has(creature); }
export function withWholeBodyDamage<T>(creature: Creature, run: () => T): T {
    const previous = groupDamage.has(creature); groupDamage.add(creature);
    try { return run(); } finally { if (!previous) groupDamage.delete(creature); }
}
const hitContacts = new WeakMap<readonly Creature[], Map<number, BodyAttackContact>>();
export function hasDeclaredZones(actor: Creature): boolean {
    return !!actor.spatial && !!spatialCatalogFor(actor).definition(actor.spatial.footprintId).zones?.length;
}
/** Shielding precedes takeDamage in native melee/bolt/throw paths. Keep its
 * pre-contact state in the surrounding scope so provider failure can restore
 * protection as well as the health transaction, without changing CE ordering. */
function withZoneProtection<T>(actor: Creature, run: () => T): T {
    if (!hasDeclaredZones(actor) && !actor.spatial?.bodyMember) return run();
    const shieldOwner=bodyStatusOwner(actor,'shielded');
    const shield = shieldOwner.statusDurations.shielded, maxShield = shieldOwner.maxShield;
    const absorber = actor as Creature & { isAbsorbing?: boolean }, absorbing = absorber.isAbsorbing;
    try { return run(); } catch (error) {
        if (shield === undefined) delete shieldOwner.statusDurations.shielded; else shieldOwner.statusDurations.shielded = shield;
        shieldOwner.maxShield = maxShield;
        if (absorbing !== undefined) absorber.isAbsorbing = absorbing;
        throw error;
    }
}
/** Preserve the exact D08 contact alongside legacy creature lists. Ordinary
 * point targets allocate no side table; the array owns its ephemeral lifetime. */
export function appendBodyHit<T extends Creature>(list: T[], actor: T, from: Readonly<Pos>, to: Readonly<Pos>): void {
    list.push(actor);
    if (!hasDeclaredZones(actor)) return;
    const cell = footprintOf(actor).find(p => p.x === to.x && p.y === to.y);
    if (!cell) throw new Error('Stale geometry body contact');
    let rows = hitContacts.get(list);
    if (!rows) { rows = new Map(); hitContacts.set(list, rows); }
    rows.set(list.length - 1, Object.freeze({ from: { ...from, zoneId: 'body' }, to: { ...cell },
        distance: Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) }));
}
export function bodyHitContact(list: readonly Creature[], index: number, from?: Readonly<Pos>): BodyAttackContact | undefined {
    const contact = hitContacts.get(list)?.get(index);
    return contact && from ? { ...contact, from: { ...from, zoneId: 'body' },
        distance: Math.max(Math.abs(from.x - contact.to.x), Math.abs(from.y - contact.to.y)) } : contact;
}
/** A projectile or area effect retains its first real body contact through the
 * complete native effect pipeline, including blood and nested death effects. */
export function withBodyContact<T>(creature: Creature, at: Readonly<Pos>, run: () => T): T {
    if (!creature.spatial) return run();
    assertNativeSpatial(creature);
    const previous = contacts.get(creature);
    contacts.set(creature, Object.freeze({ ...at }));
    try { return withZoneProtection(creature, run); } finally {
        if (previous) contacts.set(creature, previous); else contacts.delete(creature);
    }
}
export function bodyAttackContactOf(attacker: Creature, defender: Creature): BodyAttackContact {
    const from = contacts.get(attacker), to = contacts.get(defender);
    const label = (actor: Creature, at: Readonly<Pos>) => footprintOf(actor).find(p => p.x === at.x && p.y === at.y)?.zoneId ?? 'body';
    return from && to ? Object.freeze({ from: { ...from, zoneId: label(attacker, from) }, to: { ...to, zoneId: label(defender, to) },
        distance: Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) }) : nearestContact(attacker, defender);
}
export function withBodyAttackContact<T>(attacker: Creature, defender: Creature, contact: BodyAttackContact, run: () => T): T {
    if (!attacker.spatial && !defender.spatial) return run();
    assertNativeSpatial(attacker); assertNativeSpatial(defender);
    const oldFrom = contacts.get(attacker), oldTo = contacts.get(defender);
    contacts.set(attacker, contact.from); contacts.set(defender, contact.to);
    try { return withZoneProtection(defender, run); } finally {
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
