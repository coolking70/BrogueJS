import { installedModuleSubsets } from './support/installedExtensions';
/** Captured BEFORE production migration. Hash the complete reachable object
 * graph (including descriptors, aliases, cycles, maps, sets and typed bytes),
 * not EntitySnapshot's field whitelist. Compact SHA-256 fixtures keep the raw
 * multi-MB graph outside the repository. Capture is an explicit manual action. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../engine/Core/Game';
import { createHeadlessGame } from './harness';
import { createExtensionRegistry } from '../ext/catalog';
import { Monster, type MonsterData } from '../entities/Monster';
import { getNextEntityId } from '../entities/Creature';
import monsters from '../data/monsters.json';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { Grid, TerrainType as T } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { timeSystem } from '../engine/Systems/Time';
import { getNextMachineNumber } from '../engine/Generator/BlueprintEngine';

const captureDirectory = process.env.P4A0_CAPTURE_DIR;
const fixturePath = captureDirectory ? `${captureDirectory}/phase4a0-single-cell-baseline.json`
    : 'src/test/fixtures/phase4a0-single-cell-baseline.json';
let projectionIndex = 0;
const sets = installedModuleSubsets(['growth', 'narrative']);
afterEach(() => { vi.restoreAllMocks(); logger.presentAcknowledgments(null); });

export function graphDigest(root: unknown) {
    const ids = new Map<object, number>();
    const nodes: unknown[] = [];
    const encode = (value: any): any => {
        if (value === undefined) return ['undefined'];
        if (typeof value === 'function') return ['function', value.name];
        if (typeof value === 'number' && !Number.isFinite(value)) return [String(value)];
        if (typeof value === 'bigint' || typeof value === 'symbol') return [typeof value, String(value)];
        if (!value || typeof value !== 'object') return value;
        if (ids.has(value)) return ['ref', ids.get(value)];
        const id = nodes.length; ids.set(value, id); nodes.push(null);
        let data: unknown;
        if (value instanceof Map) data = [...value].map(([k, v]) => [encode(k), encode(v)]);
        else if (value instanceof Set) data = [...value].map(encode);
        else if (ArrayBuffer.isView(value)) data = Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
        else if (value instanceof WeakMap || value instanceof WeakSet) data = ['opaque-derived-cache'];
        else data = Reflect.ownKeys(value)
            // 3b adds one pure, session-only visibility port. It changes this
            // object-shape hash without changing any world/recording data.
            // Keep every mechanical field and every pre-existing port guarded.
            .filter(key => !(key === 'visibleActorActionCells' && typeof value[key] === 'function'
                && typeof value.playerId === 'function' && typeof value.depth === 'function'))
            .sort((a, b) => String(a).localeCompare(String(b))).map(key => {
            const d = Object.getOwnPropertyDescriptor(value, key)!;
            let v = 'value' in d ? d.value : ['accessor', d.get?.name, d.set?.name];
            // ONLY version envelopes. RNG/module rules/state versions are retained.
            if (key === 'foundation' && typeof v === 'number' && value.schema === 1 && Array.isArray(value.modules)) v = 'foundation-format';
            if (key === 'version' && (value.schema?.startsWith?.('brogue-web-whole-run-')
                || (value.events && value.seed) || (value.world && value.causality && value.deaths))) v = 'format-version';
            if (key === 'schema' && typeof v === 'string' && v.startsWith('brogue-web-whole-run-')) v = 'whole-run-schema';
            if (key === 'savedAt') v = 'savedAt';
            return [String(key), d.enumerable, d.configurable, d.writable, encode(v)];
        });
        nodes[id] = [Object.getPrototypeOf(value)?.constructor?.name ?? null, data];
        return ['ref', id];
    };
    const entry = encode(root);
    if (captureDirectory) writeFileSync(`${captureDirectory}/p4-${projectionIndex++}.json`, JSON.stringify({ entry, nodes }));
    return { sha256: createHash('sha256').update(JSON.stringify({ entry, nodes })).digest('hex'), objects: nodes.length };
}
function observe(game: Game) {
    const snapshot = game.toSaveSnapshot();
    return { graph: graphDigest({ game, rng, logger, timeSystem,
        identified: ItemLoader.identifiedItems, callTitles: ItemLoader.callTitles,
        polarity: ItemLoader.magicPolarityRevealed, flavors: ItemLoader.arcanaFlavorMap,
        entityAllocator: getNextEntityId(), machineAllocator: getNextMachineNumber() }),
        snapshot: graphDigest(snapshot), rng: rng.getState(), messages: logger.getState() };
}
function open(ids: string[], mode: 'test' | 'normal' = 'test') {
    const registry = createExtensionRegistry();
    const commands = registry.create(registry.manifest(ids)).flatMap(m => m.initialCommand
        ? [JSON.stringify({ module: m.id, ...m.initialCommand })] : []);
    const g = createHeadlessGame(7301, 'test');
    g.startNewGame({ seed: 7301, mode, ruleSet: 'extended', extensions: ids, initialCommands: commands });
    g.animationEnabled = false;
    return g;
}
function scenarios(ids: string[]) {
    vi.spyOn(Date, 'now').mockReturnValue(1791158400000);
    const out: Record<string, ReturnType<typeof observe>> = {};
    const g = open(ids);
    out.newGame = observe(g);
    for (const action of ['wait', 'move', 'wait']) g.executeCommand(action, action === 'move' ? { x: 1, y: 0 } : undefined);
    out.commands = observe(g);
    const saved = JSON.parse(JSON.stringify(g.toSaveSnapshot())), recording = g.exportRecording();
    expect(g.loadSnapshot(saved)).toBe(true); g.animationEnabled = false;
    out.loaded = observe(g);
    g.executeCommand('wait'); out.continued = observe(g);
    expect(g.loadReplay(recording)).toBe(true); g.animationEnabled = false;
    while (g.replayCursor < recording.events.length) { g.replayStep(true); expect(g.replayError).toBeNull(); }
    out.replayed = observe(g);
    g.replaySeek(1); expect(g.replayError).toBeNull(); out.seek = observe(g);
    // Native operation fixtures retain a real generated Game and all cached
    // worlds; their diagnostic recording is NOT claimed replayable from menu.
    const n = open(ids); n.monsters = []; n.dormantMonsters = [];
    n.grid = new Grid(30, 15); for (let x = 0; x < 30; x++) for (let y = 0; y < 15; y++) n.grid.setTerrain(x, y, T.FLOOR);
    (n as any).bindDungeonFeatureEffects();
    n.player.loc = { x: 5, y: 5 }; n.player.hp = n.player.maxHp = 1000;
    const rat = new Monster(6, 5, (monsters as MonsterData[]).find(m => m.id === 'rat')!);
    rat.hp = rat.maxHp = 100; n.monsters.push(rat);
    n.extensionRuntime!.attachCreature(rat, false);
    n.executeCommand('move', { x: 1, y: 0 }); expect(rat.hp).toBeLessThan(100); out.combat = observe(n);
    n.processStaggerHit(n.player, rat); out.knockback = observe(n);
    const wand = ItemLoader.spawnStaff('staff_of_blinking', -1, -1)!;
    n.player.inventory.addItem(wand);
    n.executeItemCommand('use', wand);
    n.setArcanaTarget(12, 5);
    n.executeCommand('confirm_target'); expect(n.player.x).toBeGreaterThan(5); out.blink = observe(n);
    expect(n.cloneMonster(rat)).not.toBeNull(); out.clone = observe(n);
    const summoner = new Monster(20, 10, (monsters as MonsterData[]).find(m => m.id === 'goblin_conjurer')!);
    n.monsters.push(summoner); n.extensionRuntime!.attachCreature(summoner, false);
    expect(n.summonMinionsFor(summoner)).toBe(true); out.summon = observe(n);
    n.grid.setTerrain(10, 5, T.GAS_TRAP_POISON_HIDDEN);
    expect(n.placeCreature(rat, { x: 10, y: 5 })).toBe(true); expect(n.grid.getCell(10, 5)!.volume).toBeGreaterThan(0); out.trap = observe(n);
    const travel = open(ids, 'normal');
    const beforeDepth = travel.depth;
    const stairs = [...Array(travel.grid.width)].flatMap((_, x) => [...Array(travel.grid.height)].map((_, y) => ({ x, y })))
        .find(p => travel.grid.getCell(p.x, p.y)!.layers.includes(T.STAIRS_DOWN))!;
    travel.player.loc = { ...stairs };
    travel.toSnapshot();
    while (logger.pendingAcknowledgment) logger.acknowledgeNext();
    travel.executeCommand('stairs_down'); expect(travel.depth).toBe(beforeDepth + 1); out.level = observe(travel);
    return out;
}
describe('4a0 no-capability full-graph baseline', () => {
    for (const ids of sets) it(`exact pre-migration graph: ${ids.join('+') || 'empty'}`, () => {
        const actual = scenarios(ids), key = ids.join('+') || 'empty';
        if (process.env.P4A0_CAPTURE === '1') {
            let fixture: Record<string, unknown> = {};
            try { fixture = JSON.parse(readFileSync(fixturePath, 'utf8')); } catch { /* first capture */ }
            fixture[key] = actual;
            writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + '\n');
        } else expect(actual).toEqual(JSON.parse(readFileSync(fixturePath, 'utf8'))[key]);
    }, 120000);
});
