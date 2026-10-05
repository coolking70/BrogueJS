import monsters from '../../data/monsters.json';
import type { MonsterData } from '../../entities/Monster';

/** Unknown legacy display names are not a safe species identity. */
export function knownPolymorphSpecies(id: string, extra: readonly MonsterData[] = []): boolean {
    return monsters.some(row => row.id === id) || extra.some(row => row.id === id);
}

/** Existing CE species projection: JSON rows are monsterCatalog[1..67],
 * excluding MK_YOU. Keep the full draw range and rejection sampling, including
 * MONST_TURRET's composite INANIMATE bit (Rogue.h:2093). No depth/horde filter. */
export function polymorphSpecies(original: string, random: { randRange(min: number, max: number): number }, extra: readonly MonsterData[] = [],
    permitted: (id: string) => boolean = () => true): MonsterData {
    const catalog = extra.length ? [...monsters, ...extra] : monsters;
    let next: MonsterData;
    do {
        next = catalog[random.randRange(1, catalog.length) - 1] as MonsterData;
    } while (next.id === original || !permitted(next.id) || next.behaviorFlags?.some(flag =>
        flag === 'MONST_INANIMATE' || flag === 'MONST_TURRET' || flag === 'MONST_NO_POLYMORPH'));
    return next;
}

/** Items.c:4595-4605: both divisions truncate; use the better of proportional
 * health and the same absolute injury. There is no upper clamp. */
export function polymorphHP(hp: number, oldMax: number, newMax: number): number {
    const fraction = Math.trunc(hp * 1000 / oldMax);
    return Math.max(1, Math.trunc(fraction * newMax / 1000), newMax - (oldMax - hp));
}
