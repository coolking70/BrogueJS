/** Test-only reference implementation from 1a0, commit 51897db (equivalently
 * 30da8c1): GenerationCoordinator.checkpointGenerationWorld and its Game roots.
 * Keep this full traversal independent of the production generation write-set.
 * It deliberately has no import from GenerationCoordinator.
 */
import type { Game, LevelState } from '../../engine/Core/Game';
import { ItemLoader } from '../../engine/Items/ItemLoader';
import { logger } from '../../engine/Systems/Logger';
import { rng } from '../../engine/Random';
import { getRewardRoomsGenerated } from '../../engine/Generator/BlueprintEngine';
import { toWholeRunSnapshot } from '../../engine/Core/WholeRunSnapshot';

export function fullGenerationRoots(game: Game): object {
    return { game, identifiedItems: ItemLoader.identifiedItems,
        callTitles: ItemLoader.callTitles, magicPolarityRevealed: ItemLoader.magicPolarityRevealed };
}

/** The original full-object-graph algorithm, retained rather than implemented
 * by calling the production helper with a bigger list of roots. Functions and
 * frozen/weak objects have the same opaque semantics as the historical code. */
export function checkpointFullObjectGraph(root: object, excluded: readonly object[]): () => void {
    const seen = new Set<object>(excluded);
    const restore: Array<() => void> = [];
    const capture = (value: unknown): void => {
        if (!value || typeof value !== 'object' || seen.has(value) || Object.isFrozen(value)) return;
        seen.add(value);
        if (value instanceof WeakMap || value instanceof WeakSet) return;
        if (ArrayBuffer.isView(value)) {
            const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
            const saved = bytes.slice();
            restore.push(() => { bytes.set(saved); });
        } else if (value instanceof Map) {
            const entries = [...value];
            restore.push(() => { value.clear(); for (const [key, entry] of entries) value.set(key, entry); });
            for (const [key, entry] of entries) { capture(key); capture(entry); }
        } else if (value instanceof Set) {
            const entries = [...value];
            restore.push(() => { value.clear(); for (const entry of entries) value.add(entry); });
            entries.forEach(capture);
        } else {
            const descriptors = Object.getOwnPropertyDescriptors(value);
            restore.push(() => {
                for (const key of Reflect.ownKeys(value)) {
                    if (!Object.prototype.hasOwnProperty.call(descriptors, key)) Reflect.deleteProperty(value, key);
                }
                Object.defineProperties(value, descriptors);
            });
            for (const descriptor of Object.values(descriptors)) if ('value' in descriptor) capture(descriptor.value);
        }
    };
    capture(root);
    return () => { for (const apply of restore) apply(); };
}

/** 1a0 cannot see WeakMap internals. Preserve the independently documented
 * 1a1 render-session fix for ALL existing floor lights, without evaluating the
 * narrowed selector or using its references/restoreSession list. Remaining
 * globals (RNG, Logger, DF session, runtime) still use Game's outer transaction. */
export function checkpointFullGenerationWorld(game: Game): () => void {
    const lights = new Set([game.lightMap, ...[...game.levels.values()].map(level => level.lightMap)]);
    const sessions = [...lights].map(light => light.checkpointRenderState());
    const restore = checkpointFullObjectGraph(fullGenerationRoots(game), [game.extensionRuntime!]);
    return () => { restore(); sessions.forEach(session => session.restore()); };
}

/** A separate read-only, breadth-first audit of every old reachable object.
 * Unlike a save projection it sees unregistered fields, typed bytes, aliases,
 * descriptor flags, symbols, Map keys and every array/container identity.
 * No production field lists, root selector or capture algorithm are reused.
 * An edge must retain its exact value/reference; newly reachable/replaced
 * objects therefore fail even if their JSON happens to be equal.
 */
export function auditFullObjectGraph(root: object, excluded: readonly object[] = []) {
    const seen = new Set<object>(excluded);
    const queue: Array<{ object: object; path: string }> = [{ object: root, path: 'world' }];
    const checks: Array<() => string | undefined> = [];
    let objects = 0;
    const enqueue = (value: unknown, path: string) => {
        if (value !== null && typeof value === 'object' && !seen.has(value)) queue.push({ object: value, path });
    };
    const sameSequence = (a: readonly unknown[], b: readonly unknown[]) =>
        a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
    for (let index = 0; index < queue.length; index++) {
        const { object, path } = queue[index]!;
        if (seen.has(object)) continue;
        seen.add(object);
        if (Object.isFrozen(object) || object instanceof WeakMap || object instanceof WeakSet) continue;
        objects++;
        const prototype = Object.getPrototypeOf(object);
        checks.push(() => Object.getPrototypeOf(object) === prototype ? undefined : `${path} prototype`);
        if (ArrayBuffer.isView(object)) {
            const bytes = new Uint8Array(object.buffer, object.byteOffset, object.byteLength);
            const saved = [...bytes];
            checks.push(() => sameSequence(saved, [...bytes]) ? undefined : `${path} typed bytes`);
        } else if (object instanceof Map) {
            const entries = [...object.entries()];
            checks.push(() => sameSequence(entries.flat(), [...object.entries()].flat()) ? undefined : `${path} Map entries`);
            entries.forEach(([key, value], i) => { enqueue(key, `${path}.key[${i}]`); enqueue(value, `${path}.value[${i}]`); });
        } else if (object instanceof Set) {
            const entries = [...object];
            checks.push(() => sameSequence(entries, [...object]) ? undefined : `${path} Set entries`);
            entries.forEach((value, i) => enqueue(value, `${path}.member[${i}]`));
        } else {
            // Intentionally read individual descriptors, rather than the
            // historical checkpoint's getOwnPropertyDescriptors traversal.
            const keys = Reflect.ownKeys(object);
            checks.push(() => sameSequence(keys, Reflect.ownKeys(object)) ? undefined : `${path} own keys`);
            for (const key of keys) {
                const descriptor = Object.getOwnPropertyDescriptor(object, key)!;
                const childPath = `${path}.${String(key)}`;
                checks.push(() => {
                    const current = Object.getOwnPropertyDescriptor(object, key);
                    if (!current) return `${childPath} missing descriptor`;
                    for (const flag of ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'] as const) {
                        if (!Object.is(descriptor[flag], current[flag])) return `${childPath} ${flag}`;
                    }
                    return undefined;
                });
                if ('value' in descriptor) enqueue(descriptor.value, childPath);
            }
        }
    }
    return { objects, differences: () => checks.flatMap(check => { const issue = check(); return issue ? [issue] : []; }) };
}

/** Pure diagnostic version of Game.toSnapshot. It bypasses display settling
 * and the normally flushing Logger.getState; observation must not repair or
 * erase a failed entry's transient evidence. Only savedAt and documented
 * non-rollback allocators are removed. Full entity IDs remain unchanged. */
export function projectGenerationWorld(game: Game) {
    const privateGame = game as any;
    const descriptor = Object.getOwnPropertyDescriptor(logger, 'getState');
    Object.defineProperty(logger, 'getState', { configurable: true, value: () => ({
        messages: logger.messages.map(message => ({ ...message })), nextId: (logger as any).nextId, turn: logger.turn,
    }) });
    let run: ReturnType<typeof game.toSnapshot>['run'];
    try { run = privateGame.snapshotRunState(); }
    finally {
        if (descriptor) Object.defineProperty(logger, 'getState', descriptor);
        else Reflect.deleteProperty(logger, 'getState');
    }
    const snapshot = toWholeRunSnapshot({
        depth: game.depth, currentLevelDepth: privateGame.currentLevelDepth, active: privateGame.activeLevelState(), levels: game.levels,
        snapshotLevel: (depth: number, level: LevelState) => privateGame.snapshotLevel(depth, level),
        pendingFallenByDepth: privateGame.pendingFallenByDepth, pendingFallenItemsByDepth: privateGame.pendingFallenItemsByDepth,
        purgatory: game.purgatory, monsters: game.monsters, dormantMonsters: game.dormantMonsters,
        items: game.items, player: game.player, everSeenMonsters: game.everSeenMonsters, everSeenItems: game.everSeenItems,
        visibleMonsters: game.visibleMonsters, visibleItems: game.visibleItems, travelTargetItem: game.travelTargetItem,
        isAdvancing: game.isAdvancing, currentSeed: game.currentSeed, levelSeeds: game.levelSeeds, mode: game.mode,
        ticksTillUpdateEnvironment: game.ticksTillUpdateEnvironment, pendingEnchantment: game.pendingEnchantment,
        stats: game.stats, run,
        services: {
            rngState: () => rng.getState(), identifiedItems: () => [...ItemLoader.identifiedItems],
            callTitles: () => Object.fromEntries(ItemLoader.callTitles), magicPolarityRevealed: () => [...ItemLoader.magicPolarityRevealed],
            flavors: () => ItemLoader.snapshotFlavors(),
            staffFlavors: () => Object.fromEntries(ItemLoader.staffs.map(staff => [staff.id, ItemLoader.arcanaFlavorMap.get(staff.id)!])),
            wandFlavors: () => Object.fromEntries(ItemLoader.wands.map(wand => [wand.id, ItemLoader.arcanaFlavorMap.get(wand.id)!])),
            rewardRoomsGenerated: () => getRewardRoomsGenerated(),
        },
    });
    snapshot.extensions = game.extensionRuntime!.snapshot();
    const { savedAt: _savedAt, ...world } = snapshot;
    delete (world.run as any).nextEntityId;
    delete (world.run as any).nextMachineNumber;
    return JSON.parse(JSON.stringify(world)) as Omit<typeof snapshot, 'savedAt'>;
}
