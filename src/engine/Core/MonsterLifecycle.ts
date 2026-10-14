import type { Monster } from '../../entities/Monster';

// Runtime ownership is deliberately outside the serialized creature graph.
// Bind on array insertion/replacement so spawns, restored floors and passengers
// all use their owning Game, including when combat has no Grid argument.
interface DeathOwner {
    monsters: Monster[];
    dormantMonsters: Monster[];
    killMonster(monster: Monster): void;
}
const owners = new WeakMap<Monster, DeathOwner>();
const lists = new WeakMap<Monster[], { raw: Monster[]; owner: DeathOwner }>();
// Like ownership, DYING is a runtime association, not an opaque Game field.
// Persisted deathProcessed carries HAS_DIED; revival explicitly clears DYING.
export const dyingMonsters = new WeakSet<Monster>();

/** CE Monsters.c:925–947: HAS_DIED, not HP or IS_DYING, excludes a list member.
 * Do not filter the owning list: death effects and physical removal have
 * separate lifetimes. Check on each visit so nested deaths are also excluded.
 * Callers that mutate membership must pass their existing stable cohort.
 * This is for active/dormant lists, not web's still-marked purgatory payloads.
 */
export function* iterateCreatures<T extends Pick<Monster, 'deathProcessed'>>(creatures: Iterable<T>): Generator<T> {
    for (const creature of creatures) {
        if (!creature.deathProcessed) yield creature;
    }
}

export function ownedMonsterList(input: Monster[], owner: DeathOwner): Monster[] {
    const old = lists.get(input);
    if (old?.owner === owner) return input;
    const raw = old?.raw ?? input;
    for (const monster of raw) owners.set(monster, owner);
    const list = new Proxy(raw, {
        set(target, key, value, receiver) {
            if (typeof key === 'string' && /^\d+$/.test(key)) owners.set(value, owner);
            return Reflect.set(target, key, value, receiver);
        },
    });
    lists.set(list, { raw, owner });
    return list;
}

export function notifyMonsterDeath(monster: Monster): void {
    const owner = owners.get(monster);
    if (owner && (owner.monsters.includes(monster) || owner.dormantMonsters.includes(monster))) {
        owner.killMonster(monster);
    }
}

/** Read the underlying owned array without invoking a Proxy get for every
 * candidate/property. Membership and order are still read live, including
 * nested death effects, splices, dormancy and restored floor lists. */
export function monsterAt(creatures: Monster[], x: number, y: number, livingOnly = false): Monster | undefined {
    const index = positionReads.get(creatures);
    const raw = index ? (index.get(x)?.get(y) ?? noMonsters) : (lists.get(creatures)?.raw ?? creatures);
    return raw.find(m => m.loc.x === x && m.loc.y === y
        && (m.hp > 0 || (!livingOnly && dyingMonsters.has(m) && !m.deathProcessed)));
}

const noMonsters: readonly Monster[] = [];
const positionReads = new WeakMap<Monster[], Map<number, Map<number, Monster[]>>>();
/** Scope for a synchronous, read-only search/light pass. Never wrap a monster
 * turn or a DF transaction: those can move, spawn or kill mid-call. The normal
 * lookup outside this scope always reads live membership and positions. */
export function withMonsterLookup<T>(creatures: Monster[], read: () => T): T {
    if (positionReads.has(creatures)) return read();
    const index = new Map<number, Map<number, Monster[]>>();
    for (const monster of lists.get(creatures)?.raw ?? creatures) {
        let column = index.get(monster.x);
        if (!column) index.set(monster.x, column = new Map());
        let bucket = column.get(monster.y);
        if (!bucket) column.set(monster.y, bucket = []);
        bucket.push(monster); // Preserve first-match order, including DYING.
    }
    positionReads.set(creatures, index);
    try { return read(); } finally { positionReads.delete(creatures); }
}
