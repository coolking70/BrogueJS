import { SpatialValidationError, type SpatialCatalog } from '../Movement/SpatialSchema';
import { assertNativeSpatial, isSquareFootprint } from '../Movement/CreatureSpatial';
import type { Monster } from '../../entities/Monster';

// Runtime ownership is deliberately outside the serialized creature graph.
// Bind on array insertion/replacement so spawns, restored floors and passengers
// all use their owning Game, including when combat has no Grid argument.
import type { ExtensionRuntime } from '../../ext/runtime';
interface DeathOwner {
    extensionRuntime?: ExtensionRuntime | null;
    readonly spatialCatalog?: SpatialCatalog;
    monsters: Monster[];
    dormantMonsters: Monster[];
    killMonster(monster: Monster): void;
    monsterListsChanged?(): void;
}
const owners = new WeakMap<Monster, DeathOwner>();
const lists = new WeakMap<Monster[], { raw: Monster[]; owner: DeathOwner }>();
const squareCounts = new WeakMap<Monster[], number>();
export function squareListUsers(list: readonly Monster[]): number { return squareCounts.get(list as Monster[]) ?? 0; }
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
    let squares = 0;
    for (const monster of raw) {
        assertNativeSpatial(monster, owner.spatialCatalog);
        if (!isSquareFootprint(monster) && monster.spatial!.footprintId !== monster.typeId) throw new SpatialValidationError('Native form body identity mismatch');
        owners.set(monster, owner);
        if (owner.extensionRuntime) owner.extensionRuntime.attachCreature(monster);
        if (monster.spatial) squares++;
    }
    const list = new Proxy(raw, {
        set(target, key, value, receiver) {
            let nextSquares = squares;
            if (typeof key === 'string' && /^\d+$/.test(key)) {
                assertNativeSpatial(value, owner.spatialCatalog);
                if (!isSquareFootprint(value) && value.spatial!.footprintId !== value.typeId) throw new SpatialValidationError('Native form body identity mismatch');
                owners.set(value, owner);
                if (owner.extensionRuntime) owner.extensionRuntime.attachCreature(value);
                nextSquares += Number(!!value.spatial) - Number(!!target[Number(key)]?.spatial);
            }
            if (key === 'length' && value < target.length && squares) nextSquares -= target.slice(value).filter(m => m?.spatial).length;
            const result = Reflect.set(target, key, value, receiver);
            if (result) { squares = nextSquares; squareCounts.set(list, squares); owner.monsterListsChanged?.(); }
            return result;
        },
        deleteProperty(target, key) {
            const square = typeof key === 'string' && /^\d+$/.test(key) && !!target[Number(key)]?.spatial;
            const result = Reflect.deleteProperty(target, key);
            if (result && square) { squares--; squareCounts.set(list, squares); owner.monsterListsChanged?.(); }
            return result;
        },
    });
    lists.set(list, { raw, owner });
    squareCounts.set(list, squares);
    return list;
}

export function notifyMonsterDeath(monster: Monster): void {
    const owner = owners.get(monster);
    if (owner && (owner.monsters.includes(monster) || owner.dormantMonsters.includes(monster))) {
        owner.killMonster(monster);
    }
}
