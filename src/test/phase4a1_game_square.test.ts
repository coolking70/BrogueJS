import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { Game } from '../engine/Core/Game';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsterData from '../data/monsters.json';
import { DungeonLayer, TerrainType as T } from '../engine/Map/Grid';
import { EnvironmentManager } from '../engine/Environment/Gas';
import { WaypointSystem } from '../engine/Map/WaypointMap';
import { rng } from '../engine/Random';
import { getNextEntityId } from '../entities/Creature';
import { commitCreatureAnchor, footprintOf, squareAnchorRevision } from '../engine/Movement/CreatureSpatial';
import { footprintExposure } from '../engine/Movement/FootprintExposure';
import { canPlaceCreature, teleportCandidates } from '../engine/Movement/CreaturePlacement';
import { catalogFeature, spawnDungeonFeature } from '../engine/Map/DungeonFeature';
import { DF } from '../engine/Map/DungeonFeatureCatalog';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { monsterCanSubmergeNow, surfaceOnDryLand } from '../engine/Movement/Submersion';
import { monsterBlinkToPreferenceMap } from '../engine/Combat/MonsterBlink';
import * as promotion from '../engine/Map/Promotion';

const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function arrangeSquareGame(game: Game) {
    game.animationEnabled = false;
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        game.grid.setTerrain(x, y, x === 0 || y === 0 || x === game.grid.width - 1 || y === game.grid.height - 1 ? T.WALL : T.FLOOR);
        game.grid.getCell(x, y)!.machineNumber = 0;
    }
    commitCreatureAnchor(game.player, { x: 65, y: 14 }); game.player.hp = game.player.maxHp = 100000;
    game.environment = new EnvironmentManager(game.grid); game.waypoints = new WaypointSystem();
    (game as any).machineCells = new Set(); (game as any).bindDungeonFeatureEffects();
    (game as any).updateVision(); return game;
}
export function squareGame() { return arrangeSquareGame(createHeadlessGame(41041, 'test')); }
export function squareMonster(game: Game, size: 2 | 3 = 2, x = 12, y = 12) {
    const m = game.createSquareMonster((monsterData as MonsterData[]).find(d => d.id === 'rat')!, size, { x, y })!;
    m.hp = m.maxHp = 1000; m.state = MonsterState.HUNTING;
    m.behaviorFlags.add('MONST_ALWAYS_HUNTING'); m.givenUpOnScent = true;
    return m;
}
const effects = (g: Game, m?: Monster) => (g as any).applyEnvironmentalEffects(m);
const stable = (g: Game) => { const state = json(g.toSnapshot()); state.savedAt = 0; return state; };
beforeEach(() => vi.restoreAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('4a-1 real Game square capability/motion/contact', () => {
    it.each([2, 3] as const)('%s-square takes real NPC turns and rejects tail collisions/conservative diagonals', size => {
        const g = squareGame(), m = squareMonster(g, size), from = { ...m.loc };
        g.executeCommand('wait'); expect(m.loc).not.toEqual(from);
        expect(g.squarePathingStats().terrainBuilds).toBeGreaterThan(0);
        for (const p of footprintOf(m)) expect(g.getMonsterAt(p.x, p.y)).toBe(m);
        const anchor = { ...m.loc };
        g.grid.setTerrain(m.x + size, m.y + size - 1, T.WALL);
        expect(g.placeCreature(m, { x: m.x + 1, y: m.y })).toBe(false); expect(m.loc).toEqual(anchor);
        g.grid.setTerrain(m.x + size, m.y + size - 1, T.FLOOR);
        g.grid.setTerrain(m.x - 1, m.y + size - 1, T.WALL);
        expect(g.canStepFootprint(m, { x: m.x - 1, y: m.y - 1 })).toBe(false);
    });
    it('checked square birth rejects a tail wall/occupant without ID, RNG or world mutation', () => {
        const g = squareGame(), data = (monsterData as MonsterData[]).find(d => d.id === 'rat')!;
        g.grid.setTerrain(13, 13, T.WALL); const id = getNextEntityId(), state = rng.getState(), list = g.monsters;
        expect(g.createSquareMonster(data, 2, { x: 12, y: 12 })).toBeNull(); expect(getNextEntityId()).toBe(id); expect(rng.getState()).toEqual(state); expect(g.monsters).toBe(list); expect(g.monsters).toHaveLength(0);
        g.grid.setTerrain(13, 13, T.FLOOR); const blocker = new Monster(13, 13, data); g.monsters.push(blocker); const after = getNextEntityId();
        expect(g.createSquareMonster(data, 2, { x: 12, y: 12 })).toBeNull(); expect(getNextEntityId()).toBe(after);
    });
    it('ordinary Game never creates the optional square session or body path counters', () => {
        const g = squareGame(); g.executeCommand('wait');
        expect(Object.prototype.hasOwnProperty.call(g, 'squareMotion')).toBe(false);
        expect(g.squarePathingStats()).toMatchObject({ terrainBuilds: 0, distanceBuilds: 0, visitedNodes: 0 });
        expect(Object.prototype.hasOwnProperty.call(g.toSnapshot().run, 'spatialWorld')).toBe(false);
    });
    it('still rejects explicit single, locks, masks, zones and a spatial player', () => {
        const g = squareGame();
        for (const spatial of [{ schema: 1, footprintId: 'builtin:single', pose: 'r0' }, { schema: 1, footprintId: 'builtin:square-2', pose: 'r0', actionLockInTicks: 0 }, { schema: 1, footprintId: 'fixture:mask', pose: 'r0' }]) {
            const m = new Monster(4, 4, monsterData[0] as MonsterData); m.spatial = spatial as any;
            expect(() => g.monsters.push(m)).toThrow(); expect(g.monsters).not.toContain(m);
        }
        g.player.spatial = { schema: 1, footprintId: 'builtin:square-2', pose: 'r0' };
        expect(() => g.executeCommand('wait')).toThrow('Player'); delete g.player.spatial;
    });
    it('dynamic tail blocker causes a bounded real body replan, then live self-overlap commits', () => {
        const g = squareGame(), m = squareMonster(g);
        const first = g.planSquareStep(m, { kind: 'contact', target: g.player }); expect(first.kind).toBe('step');
        const blocker = new Monster(first.at!.x + 1, first.at!.y, monsterData[0] as MonsterData); g.monsters.push(blocker);
        const alternative = g.planSquareStep(m, { kind: 'contact', target: g.player });
        expect(alternative.replanned).toBe(true); expect(g.squarePathingStats().dynamicReplans).toBe(1);
        if (alternative.at) expect(g.placeCreature(m, alternative.at)).toBe(true);
        g.monsters.pop(); const anchor = { ...m.loc }; expect(g.placeCreature(m, { x: m.x, y: m.y + 1 })).toBe(true);
        expect(m.y).toBe(anchor.y + 1);
    });
    it('stagger validates the whole swept step and square allies are never auto-swapped', () => {
        const g = squareGame(), m = squareMonster(g); commitCreatureAnchor(g.player, { x: m.x - 1, y: m.y });
        g.grid.setTerrain(m.x + 2, m.y + 1, T.WALL); const old = { ...m.loc };
        g.processStaggerHit(g.player, m); expect(m.loc).toEqual(old);
        g.grid.setTerrain(m.x + 2, m.y + 1, T.FLOOR); g.processStaggerHit(g.player, m); expect(m.x).toBe(old.x + 1);
        m.isAlly = true; const player = { ...g.player.loc };
        expect((g as any).movePlayerPastAlly(m.x, m.y, m)).toBe(false); expect(g.player.loc).toEqual(player);
    });
    it('clone retains square size and an independent component; no-fit allocates no ID', () => {
        const g = squareGame(), m = squareMonster(g, 3); const clone = g.cloneMonster(m)!;
        expect(clone).not.toBeNull(); expect(clone.spatial).toEqual(m.spatial); expect(clone.spatial).not.toBe(m.spatial);
        expect(footprintOf(clone).some(p => footprintOf(m).some(q => p.x === q.x && p.y === q.y))).toBe(false);
        for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) if (!footprintOf(m).some(p => p.x === x && p.y === y)) g.grid.setTerrain(x, y, T.WALL);
        const id = getNextEntityId(), hp = m.hp; expect(g.cloneMonster(m)).toBeNull(); expect(getNextEntityId()).toBe(id); expect(m.hp).toBe(hp);
    });
    it('teleport destination filters cover the tail, dormant reservation, machines and stairs', () => {
        const g = squareGame(), m = squareMonster(g);
        for (let y = 0; y < g.grid.height; y++) g.grid.setTerrain(40, y, T.WALL);
        const candidates = teleportCandidates(g, m); expect(candidates.length).toBeGreaterThan(0);
        const p = candidates.find(p => p.x > 40)!; expect(p).toBeDefined();
        g.grid.getCell(p.x + 1, p.y + 1)!.machineNumber = 1;
        expect(teleportCandidates(g, m)).not.toContainEqual(p);
        g.grid.getCell(p.x + 1, p.y + 1)!.machineNumber = 0;
        g.grid.setTerrain(p.x + 1, p.y + 1, T.STAIRS_DOWN); expect(teleportCandidates(g, m)).not.toContainEqual(p);
    });
    it.each([2, 3] as const)('tail lava kills a %s-square once and leaves one carried item drop', size => {
        const g = squareGame(), m = squareMonster(g, size); const kill = vi.spyOn(g, 'killMonster');
        m.carriedItem = ItemLoader.spawnWeapon('dart', -1, -1)!; const itemId = m.carriedItem.id;
        g.grid.setTerrain(m.x + size - 1, m.y + size - 1, T.LAVA); effects(g, m);
        expect(m.hp).toBe(0); expect(kill).toHaveBeenCalledTimes(1);
        expect(g.items.filter(item => item.id === itemId)).toHaveLength(1);
    });
    it('gas/web/poison across several cells apply one entity effect and one web roll', () => {
        const g = squareGame(), m = squareMonster(g, 3);
        for (const p of footprintOf(m)) {
            g.grid.setTerrainLayer(p.x, p.y, DungeonLayer.SURFACE, T.WEB);
            g.grid.setTerrainLayer(p.x, p.y, DungeonLayer.GAS, T.CONFUSION_GAS);
        }
        const apply = vi.spyOn(m, 'applyStatus'), draws = rng.randomNumbersGenerated; effects(g, m);
        expect(apply.mock.calls.filter(c => c[0] === 'confused')).toHaveLength(1);
        expect(apply.mock.calls.filter(c => c[0] === 'stuck')).toHaveLength(1);
        for (const p of footprintOf(m)) g.grid.setTerrainLayer(p.x, p.y, DungeonLayer.SURFACE, T.NOTHING);
        expect(rng.randomNumbersGenerated - draws).toBe(1); expect(m.getStatusDuration('confused')).toBe(25);
        for (const p of footprintOf(m)) g.grid.setTerrainLayer(p.x, p.y, DungeonLayer.SURFACE, T.LICHEN);
        effects(g, m); expect(m.getStatusDuration('poisoned')).toBe(5);
    });
    it('one supported body cell prevents falling; all unsupported cells enable it', () => {
        const g = squareGame(), m = squareMonster(g, 3), body = footprintOf(m);
        for (const p of body.slice(1)) g.grid.setTerrain(p.x, p.y, T.CHASM);
        expect(footprintExposure(g.grid, m).allUnsupported).toBe(false); expect((g as any).creatureShouldFall(m)).toBe(false);
        g.grid.setTerrain(body[0]!.x, body[0]!.y, T.CHASM); expect((g as any).creatureShouldFall(m)).toBe(true);
    });
    it('independent traps fire once each; a teleport immediately stops old-body contacts', () => {
        const g = squareGame(), m = squareMonster(g), trap = vi.spyOn(g as any, 'triggerTrap');
        for (const p of [m.loc, { x: m.x + 1, y: m.y + 1 }]) { g.grid.setTerrain(p.x, p.y, T.TRAP); g.grid.getCell(p.x, p.y)!.trapType = 'poison_gas'; }
        effects(g, m); expect(trap).toHaveBeenCalledTimes(2); effects(g, m); expect(trap).toHaveBeenCalledTimes(2);
        vi.spyOn(g as any, 'teleportCreature').mockImplementation(() => g.placeCreature(m, { x: 50, y: 8 }));
        g.grid.setTerrain(m.x, m.y, T.TRAP); g.grid.getCell(m.x, m.y)!.trapType = 'teleport';
        const tail = { x: m.x + 1, y: m.y + 1 }; g.grid.setTerrain(tail.x, tail.y, T.TRAP); g.grid.getCell(tail.x, tail.y)!.trapType = 'poison_gas';
        effects(g, m); expect(m.loc).toEqual({ x: 50, y: 8 }); expect(g.grid.getCell(tail.x, tail.y)!.layers).toContain(T.TRAP);
    });
    it('a recursive area DF applies a square web effect once per root, without leaking scope to the next DF', () => {
        const g = squareGame(), m = squareMonster(g, 3), apply = vi.spyOn(m, 'applyStatus').mockReturnValue(true);
        spawnDungeonFeature(g.grid, m.x, m.y, catalogFeature(DF.DF_NET), false);
        expect(apply.mock.calls.filter(c => c[0] === 'stuck')).toHaveLength(1);
        for (const p of footprintOf(m)) g.grid.setTerrainLayer(p.x, p.y, DungeonLayer.SURFACE, T.NOTHING);
        spawnDungeonFeature(g.grid, m.x, m.y, catalogFeature(DF.DF_NET), false);
        expect(apply.mock.calls.filter(c => c[0] === 'stuck')).toHaveLength(2);
    });
    it('failed square awakening retains dormant ownership, flags, anchor and timers', () => {
        const g = squareGame(), m = squareMonster(g); g.toggleMonsterDormancy(m);
        const blocker = new Monster(m.x + 1, m.y + 1, monsterData[0] as MonsterData); g.monsters.push(blocker);
        for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) if (!footprintOf(m).some(p => p.x === x && p.y === y)) g.grid.setTerrain(x, y, T.WALL);
        const loc = m.loc, tick = m.ticksUntilTurn; g.toggleMonsterDormancy(m);
        expect(g.dormantMonsters).toContain(m); expect(g.monsters).not.toContain(m); expect(m.isDormant).toBe(true); expect(m.loc).toBe(loc); expect(m.ticksUntilTurn).toBe(tick);
    });
    it.each([2, 3] as const)('%s-square save/load continues real commands and reconstructs derived occupancy', size => {
        const g = squareGame(), m = squareMonster(g, size); g.executeCommand('wait');
        const saved = json(g.toSaveSnapshot()); expect(saved.run.spatialWorld?.definitions.footprints).toHaveLength(1);
        const expected = []; for (let i = 0; i < 3; i++) { g.executeCommand('wait'); expected.push(stable(g)); }
        const loaded = createHeadlessGame(991, 'test'); loaded.animationEnabled = false; expect(loaded.loadSnapshot(saved)).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(loaded, 'squareMotion')).toBe(false);
        const restored = loaded.monsters.find(c => c.id === m.id)!; expect(footprintOf(restored)).toHaveLength(size * size);
        for (let i = 0; i < 3; i++) { loaded.executeCommand('wait'); expect(stable(loaded)).toEqual(expected[i]); }
    });
    it('malformed/overlapping/outside square snapshots preserve the old world and RNG', () => {
        const g = squareGame(), m = squareMonster(g), saved = json(g.toSnapshot());
        for (const edit of [(s: typeof saved) => { s.monsters[0]!.loc.x = s.width - 1; }, (s: typeof saved) => { s.monsters[0]!.loc = { ...s.player.loc }; }, (s: typeof saved) => { s.run.spatialWorld!.definitions.footprints[0]!.geometry = { kind: 'rect', width: 1, height: 1 }; }]) {
            const bad = json(saved); edit(bad); const world = g.monsters, state = rng.getState(); expect(g.loadSnapshot(bad)).toBe(false); expect(g.monsters).toBe(world); expect(rng.getState()).toEqual(state); expect(g.monsters).toContain(m);
        }
    });
});


const playbackWorld = (g: Game) => {
    const state = stable(g); state.run.recordedInputEvents = []; state.run.recordedInputIndex = 0;
    return state;
};
describe('4a-1 real Game square persistence and failure transactions', () => {
    it.each([2, 3] as const)('%s-square fixture replays each real command, seeks, and resumes the saved prefix', size => {
        const start = Game.prototype.startNewGame;
        vi.spyOn(Game.prototype, 'startNewGame').mockImplementation(function(this: Game, ...args) {
            start.apply(this, args); arrangeSquareGame(this); squareMonster(this, size);
        });
        const g = createHeadlessGame(41041, 'test'), expected = [];
        for (let i = 0; i < 2; i++) { g.executeCommand('wait'); expected.push(playbackWorld(g)); }
        const checkpoint = json(g.toSaveSnapshot());
        for (let i = 0; i < 3; i++) { g.executeCommand('wait'); expected.push(playbackWorld(g)); }
        const recording = g.exportRecording(); expect(recording.events).toHaveLength(5);
        const loaded = createHeadlessGame(991, 'test'); expect(loaded.loadSnapshot(checkpoint)).toBe(true);
        for (let i = 2; i < 5; i++) { loaded.executeCommand('wait'); expect(playbackWorld(loaded)).toEqual(expected[i]); }
        expect(loaded.exportRecording().events).toEqual(recording.events);
        expect(loaded.loadReplay(recording)).toBe(true);
        for (let i = 0; i < 5; i++) { loaded.replayStep(true); expect(loaded.replayError).toBeNull(); expect(playbackWorld(loaded)).toEqual(expected[i]); }
        for (const index of [1, 4, 2, 5]) { loaded.replaySeek(index); expect(loaded.replayError).toBeNull(); expect(playbackWorld(loaded)).toEqual(expected[index - 1]); }
    });
    it('polymorph samples first; no destination preserves all entity fields and relations, then a legal conversion becomes single', () => {
        const g = squareGame(), m = squareMonster(g); m.isAlly = true; m.isCaged = true;
        m.leader = new Monster(2, 2, monsterData[0] as MonsterData); m.setStatusDuration('slowed', 5);
        for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) g.grid.setTerrain(x, y, T.WALL);
        const state = json(g.toSnapshot().monsters[0]), loc = m.loc, leader = m.leader, allocation = getNextEntityId(), draws = rng.randomNumbersGenerated;
        expect((g as any).polymorphBoltTarget(m)).toBe(false);
        expect(json(g.toSnapshot().monsters[0])).toEqual(state); expect(m.loc).toBe(loc); expect(m.leader).toBe(leader);
        expect(getNextEntityId()).toBe(allocation); expect(rng.randomNumbersGenerated).toBeGreaterThan(draws);
        g.grid.setTerrain(m.x, m.y, T.FLOOR);
        expect((g as any).polymorphBoltTarget(m)).toBe(true); expect(m.spatial).toBeUndefined(); expect(Object.prototype.hasOwnProperty.call(m, 'spatial')).toBe(false);
        expect(m.isAlly).toBe(false); expect(m.isCaged).toBe(false); expect(footprintOf(m)).toHaveLength(1);
    });
    it('pending no-fit square preserves its single fall damage over save/load and retries only after space changes', () => {
        const g = squareGame(), m = squareMonster(g, 3); g.mode = 'normal'; (g as any).currentLevelDepth = 1; m.behaviorFlags.add('MONST_WILL_NOT_USE_STAIRS');
        g.depth = 2; (g as any).generateDepth(false); arrangeSquareGame(g);
        for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) g.grid.setTerrain(x, y, T.WALL);
        g.depth = 1; (g as any).generateDepth(true);
        const original = g.monsters.find(c => c.id === m.id)!; original.falling = true;
        (g as any).monstersFall(); expect(g.monsters).not.toContain(original);
        expect((g as any).pendingFallenByDepth.get(2)).toContain(original); const hp = original.hp;
        const saved = json(g.toSnapshot()), loaded = createHeadlessGame(991, 'test'); expect(loaded.loadSnapshot(saved)).toBe(true);
        loaded.depth = 2; (loaded as any).generateDepth(false);
        const pending = (loaded as any).pendingFallenByDepth.get(2)[0] as Monster;
        expect(pending.id).toBe(m.id); expect(pending.hp).toBe(hp); expect(loaded.monsters).not.toContain(pending);
        const search = vi.spyOn(loaded as any, 'retrySquareLandings');
        loaded.executeCommand('wait'); expect(pending.hp).toBe(hp); expect(search).toHaveBeenCalled();
        const revision = (loaded as any).squareLandingRetry.revision;
        loaded.executeCommand('wait'); expect((loaded as any).squareLandingRetry.revision).toBe(revision); expect(pending.hp).toBe(hp);
        for (let x = 10; x <= 15; x++) for (let y = 10; y <= 15; y++) loaded.grid.setTerrain(x, y, T.FLOOR);
        loaded.executeCommand('wait'); expect(loaded.monsters).toContain(pending); expect(pending.hp).toBe(hp);
        expect((loaded as any).pendingFallenByDepth.has(2)).toBe(false); expect(footprintOf(pending)).toHaveLength(9);
    });
    it('cross-floor no-fit entry leaves source ownership and coordinates intact', () => {
        const g = squareGame(); g.mode = 'normal'; (g as any).currentLevelDepth = 1; g.depth = 2; (g as any).generateDepth(false); arrangeSquareGame(g);
        const source = (g as any).levels.get(1), m = new Monster(12, 12, monsterData[0] as MonsterData);
        m.spatial = { schema: 1, footprintId: 'builtin:square-2', pose: 'r0' }; m.entersLevelIn = 1; m.approaching = 1; source.monsters.push(m);
        for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) g.grid.setTerrain(x, y, T.WALL);
        g.grid.setTerrain(5, 5, T.STAIRS_UP); const loc = m.loc, tick = m.ticksUntilTurn;
        (g as any).monsterEntersLevel(m, source); expect(source.monsters).toContain(m); expect(g.monsters).not.toContain(m);
        expect(m.loc).toBe(loc); expect(m.entersLevelIn).toBe(1); expect(m.ticksUntilTurn).toBe(tick);
        for (let x = 4; x <= 8; x++) for (let y = 4; y <= 8; y++) g.grid.setTerrain(x, y, T.FLOOR);
        g.grid.setTerrain(5, 5, T.STAIRS_UP); (g as any).monsterEntersLevel(m, source);
        expect(source.monsters).not.toContain(m); expect(g.monsters).toContain(m); expect(canPlaceCreature(g, m, m.loc)).toBe(true);
    });
});

describe('4a-1 complete placement and contact entrances', () => {
    it('a secret door never exempts another blocking layer under a square tail', () => {
        const g = squareGame(), m = squareMonster(g), at = { x: m.x + 1, y: m.y };
        g.grid.setTerrain(m.x + 2, m.y + 1, T.SECRET_DOOR);
        g.grid.setTerrainLayer(m.x + 2, m.y + 1, DungeonLayer.SURFACE, T.FORCEFIELD);
        expect(g.placeCreature(m, at, { walkingSecretDoor: true })).toBe(false);
        g.grid.setTerrainLayer(m.x + 2, m.y + 1, DungeonLayer.SURFACE, T.NOTHING);
        expect(g.placeCreature(m, at, { walkingSecretDoor: true })).toBe(true);
    });
    it('nested out-and-back displacement stops the original body sequence even at the same final anchor', () => {
        const g = squareGame(), m = squareMonster(g), original = { ...m.loc }, revision = squareAnchorRevision(m);
        g.grid.setTerrain(m.x, m.y, T.TRAP); g.grid.getCell(m.x, m.y)!.trapType = 'teleport';
        vi.spyOn(g as any, 'teleportCreature').mockImplementation(() => {
            g.placeCreature(m, { x: 50, y: 8 }); g.placeCreature(m, original); return true;
        });
        const contacts = vi.spyOn(g as any, 'applyDisplacementTileEntry'); effects(g, m);
        expect(m.loc).toEqual(original); expect(squareAnchorRevision(m)).toBeGreaterThan(revision);
        // Outer origin + the two real destination bodies. The original tail
        // must not resume for another three contacts after the nested return.
        expect(contacts).toHaveBeenCalledTimes(1 + 4 + 4);
    });
    it.each(['wander', 'flee', 'return'] as const)('square %s uses the body graph during a real command', mode => {
        const g = squareGame(), m = squareMonster(g), x = m.x;
        if (mode === 'flee') {
            m.behaviorFlags.delete('MONST_ALWAYS_HUNTING'); m.state = MonsterState.FLEEING; m.setStatusDuration('magical_fear', 10);
        } else if (mode === 'return') m.isAlly = true;
        else {
            m.behaviorFlags.delete('MONST_ALWAYS_HUNTING'); m.state = MonsterState.WANDERING;
            g.waypoints.count = 1; g.waypoints.coordinates = [{ x: 20, y: 12 }];
            g.waypoints.distanceMaps = [Array.from({ length: g.grid.width }, () => Array<number>(g.grid.height).fill(30000))];
        }
        g.executeCommand('wait'); expect(g.squarePathingStats().terrainBuilds).toBeGreaterThan(0);
        if (mode === 'flee') expect(m.x).toBeLessThan(x); else expect(m.x).toBeGreaterThan(x);
        expect(canPlaceCreature(g, m, m.loc)).toBe(true);
    });
    it.each([2, 3] as const)('%s-square blink and pull preflight all cells without releasing on failure', size => {
        const g = squareGame(), m = squareMonster(g, size); m.isCaged = true; m.submerged = true; m.setStatusDuration('stuck', 7);
        commitCreatureAnchor(g.player, { x: 4, y: 12 });
        g.grid.setTerrain(m.x - 1, m.y + size - 1, T.WALL);
        const before = { ...m.loc }, tick = m.ticksUntilTurn;
        (g as any).beckonCreature(m, g.player);
        expect(m.loc).toEqual(before); expect(m.isCaged).toBe(true); expect(m.submerged).toBe(true); expect(m.getStatusDuration('stuck')).toBe(7);
        expect(m.ticksUntilTurn).toBe(Math.max(tick, g.player.attackSpeed + 1));
        g.grid.setTerrain(31 + size - 1, 10 + size - 1, T.WALL);
        expect((g as any).finishBlink({ caster: m, landingPos: { x: 31, y: 10 } })).toBe(false);
        expect(m.loc).toEqual(before); expect(m.isCaged).toBe(true); expect(m.submerged).toBe(true); expect(m.getStatusDuration('stuck')).toBe(7);
        g.grid.setTerrain(m.x - 1, m.y + size - 1, T.FLOOR); (g as any).beckonCreature(m, g.player);
        expect(m.x).toBe(5); expect(m.isCaged).toBe(false); expect(m.submerged).toBe(false); expect(m.getStatusDuration('stuck')).toBe(0);
    });
    it('failed captive random teleport leaves status, faction, location and RNG unchanged', () => {
        const g = squareGame(), m = squareMonster(g); m.isCaged = true; m.setStatusDuration('stuck', 7);
        for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) if (!footprintOf(m).some(p => p.x === x && p.y === y)) g.grid.setTerrain(x, y, T.WALL);
        const before = json(g.toSnapshot().monsters[0]), state = rng.getState(); expect((g as any).teleportBoltTarget(m)).toBe(false);
        expect(json(g.toSnapshot().monsters[0])).toEqual(before); expect(rng.getState()).toEqual(state);
    });
    it('square NPC blink evaluates a body distance map and never picks a point-only landing', () => {
        const g = squareGame(), m = squareMonster(g, 3); m.bolts = ['BLINKING']; m.behaviorFlags.add('MONST_ALWAYS_USE_ABILITY');
        const values = g.squareDistanceValues(m, { kind: 'contact', target: g.player }), from = { ...m.loc };
        expect(monsterBlinkToPreferenceMap(g, m, values, false)).toBe(true);
        expect(m.x - from.x).toBeGreaterThan(1); expect(canPlaceCreature(g, m, m.loc)).toBe(true);
        expect(g.squarePathingStats().distanceBuilds).toBe(1);
    });
    it.each([2, 3] as const)('%s-square self-split preserves geometry, independent component and total HP', size => {
        const g = squareGame(), m = squareMonster(g, size); m.abilityFlags.add('MA_CLONE_SELF_ON_DEFEND'); m.hp = 20;
        (g as any).trySplitMonster(m, g.player); const clone = g.monsters.find(c => c !== m)!;
        expect(clone).toBeDefined(); expect([m.hp, clone.hp]).toEqual([10, 10]); expect(clone.spatial).toEqual(m.spatial); expect(clone.spatial).not.toBe(m.spatial);
        expect(footprintOf(clone).some(p => footprintOf(m).some(q => p.x === q.x && p.y === q.y))).toBe(false);
        g.monsters = [m]; for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) if (!footprintOf(m).some(p => p.x === x && p.y === y)) g.grid.setTerrain(x, y, T.WALL);
        const id = getNextEntityId(), hp = m.hp; (g as any).trySplitMonster(m, g.player); expect(m.hp).toBe(hp); expect(getNextEntityId()).toBe(id); expect(g.monsters).toHaveLength(1);
    });
    it('small summons avoid the whole summoner body and dormant tail reservations', () => {
        const g = squareGame(), m = g.createSquareMonster((monsterData as MonsterData[]).find(d => d.id === 'goblin_conjurer')!, 3, { x: 12, y: 12 })!;
        const dormant = squareMonster(g, 2, 18, 12); g.toggleMonsterDormancy(dormant);
        expect(g.summonMinionsFor(m)).toBe(true);
        const children = g.monsters.filter(c => c !== m); expect(children.length).toBeGreaterThan(0);
        for (const child of children) { expect(footprintOf(m).some(p => p.x === child.x && p.y === child.y)).toBe(false); expect(footprintOf(dormant).some(p => p.x === child.x && p.y === child.y)).toBe(false); }
    });
    it('aquatic movement/submersion require all body cells; already-touched water uses the body origin', () => {
        const g = squareGame(), m = squareMonster(g, 3); m.behaviorFlags.add('MONST_RESTRICTED_TO_LIQUID'); m.behaviorFlags.add('MONST_SUBMERGES');
        for (const p of footprintOf(m)) g.grid.setTerrain(p.x, p.y, T.WATER_DEEP);
        expect(monsterCanSubmergeNow(m, g.grid)).toBe(true); m.submerged = true;
        g.grid.setTerrain(m.x + 2, m.y + 2, T.FLOOR); surfaceOnDryLand(m, g.grid); expect(m.submerged).toBe(false);
        expect(g.planSquareStep(m, { kind: 'contact', target: g.player }).kind).toBe('unreachable');
        m.behaviorFlags.delete('MONST_RESTRICTED_TO_LIQUID'); g.grid.setTerrain(m.x, m.y, T.FLOOR);
        expect((m as any).canEnterWaterTerrain(g, m.x + 3, m.y)).toBe(true);
        g.grid.setTerrain(m.x + 3, m.y, T.WATER_DEEP); expect((m as any).canEnterWaterTerrain(g, m.x + 3, m.y)).toBe(true);
    });
    it('aquatic square birth and clone require a complete liquid body, before allocation', () => {
        const g = squareGame(), data = { ...(monsterData as MonsterData[]).find(d => d.id === 'rat')!, behaviorFlags: ['MONST_RESTRICTED_TO_LIQUID', 'MONST_IMMUNE_TO_WATER'] };
        const id = getNextEntityId(); g.grid.setTerrain(12, 12, T.WATER_DEEP);
        expect(g.createSquareMonster(data, 2, { x: 12, y: 12 })).toBeNull(); expect(getNextEntityId()).toBe(id);
        for (let x = 12; x <= 13; x++) for (let y = 12; y <= 13; y++) g.grid.setTerrain(x, y, T.WATER_DEEP);
        const m = g.createSquareMonster(data, 2, { x: 12, y: 12 })!; expect(m).not.toBeNull(); const after = getNextEntityId();
        expect(g.cloneMonster(m)).toBeNull(); expect(getNextEntityId()).toBe(after);
        for (let x = 14; x <= 15; x++) for (let y = 12; y <= 13; y++) g.grid.setTerrain(x, y, T.WATER_DEEP);
        const clone = g.cloneMonster(m)!; expect(clone).not.toBeNull(); expect(monsterCanSubmergeNow(Object.assign(clone, { behaviorFlags: new Set([...clone.behaviorFlags, 'MONST_SUBMERGES']) }), g.grid)).toBe(true);
        const dry = new Monster(40, 12, data); dry.spatial = { schema: 1, footprintId: 'builtin:square-2', pose: 'r0' };
        expect(g.publishSquareMonster(dry)).toBe(false); expect(g.monsters).not.toContain(dry);
    });
    it('wet extinguishing is AND; several damage/healing contacts reduce to one objective effect', () => {
        const g = squareGame(), m = squareMonster(g, 3); (m.statusDurations as Record<string, number>).burning = 10;
        for (const p of footprintOf(m).slice(1)) g.grid.setTerrain(p.x, p.y, T.WATER_DEEP);
        effects(g, m); expect((m.statusDurations as Record<string, number>).burning).toBe(10);
        g.grid.setTerrain(m.x, m.y, T.WATER_DEEP); effects(g, m); expect((g as any).burningDuration(m)).toBe(0);
        for (const p of footprintOf(m)) { g.grid.setTerrain(p.x, p.y, T.FLOOR); g.grid.setTerrainLayer(p.x, p.y, DungeonLayer.GAS, T.POISON_GAS); }
        const hp = m.hp; effects(g); expect(m.hp).toBe(hp - Math.floor(m.maxHp / 15));
        for (const p of footprintOf(m)) g.grid.setTerrainLayer(p.x, p.y, DungeonLayer.GAS, T.HEALING_CLOUD);
        const before = m.hp; effects(g); expect(m.hp - before).toBe(Math.floor(m.maxHp / 15));
    });
    it('moving contact triggers new cells only, and two real CE trap mechanisms emit once each', () => {
        const g = squareGame(), m = squareMonster(g);
        g.grid.setTerrain(m.x + 1, m.y + 1, T.TRAP); g.grid.getCell(m.x + 1, m.y + 1)!.trapType = 'poison_gas';
        expect(g.placeCreature(m, { x: m.x + 1, y: m.y })).toBe(true);
        expect(g.grid.getCell(m.x, m.y + 1)!.layers).toContain(T.TRAP);
        const a = { x: m.x + 2, y: m.y }, b = { x: m.x + 2, y: m.y + 1 };
        for (const p of [a, b]) g.grid.setTerrain(p.x, p.y, T.GAS_TRAP_CONFUSION);
        const traps = vi.spyOn(promotion, 'triggerCreatureTrapLayers'); expect(g.placeCreature(m, { x: m.x + 1, y: m.y })).toBe(true);
        expect(traps.mock.calls.filter(c => c[1] === a.x && c[2] === a.y)).toHaveLength(1);
        expect(traps.mock.calls.filter(c => c[1] === b.x && c[2] === b.y)).toHaveLength(1);
        const volume = catalogFeature(DF.DF_CONFUSION_GAS_TRAP_CLOUD).startProbability;
        expect(g.grid.getCell(a.x, a.y)!.volume).toBe(volume); expect(g.grid.getCell(b.x, b.y)!.volume).toBe(volume);
    });
    it('a sacrifice altar under a tail triggers and stops contact on death', () => {
        const g = squareGame(), m = squareMonster(g, 3), tail = { x: m.x + 2, y: m.y + 2 };
        m.machineHome = 7; m.markedForSacrifice = true; g.grid.getCell(tail.x, tail.y)!.machineNumber = 7; g.grid.setTerrain(tail.x, tail.y, T.SACRIFICE_ALTAR);
        effects(g, m); expect(g.grid.getCell(tail.x, tail.y)!.layers).not.toContain(T.SACRIFICE_ALTAR); expect(m.hp).toBe(0);
    });
    it('square passenger with no release space remains pending through load and lands once after space opens', () => {
        const g = squareGame(), carrier = squareMonster(g);
        const passenger = new Monster(carrier.x, carrier.y, (monsterData as MonsterData[]).find(d => d.id === 'rat')!);
        passenger.spatial = { schema: 1, footprintId: 'builtin:square-3', pose: 'r0' }; passenger.hp = passenger.maxHp = 500; carrier.carriedMonster = passenger;
        const carried = json(g.toSnapshot()), loaded = createHeadlessGame(991, 'test'); expect(loaded.loadSnapshot(carried)).toBe(true);
        expect(loaded.monsters[0]!.carriedMonster!.spatial).toEqual(passenger.spatial);
        for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) g.grid.setTerrain(x, y, T.WALL);
        g.killMonster(carrier); expect((g as any).pendingFallenByDepth.get(1)).toEqual([passenger]); expect(carrier.carriedMonster).toBeNull();
        expect(loaded.loadSnapshot(json(g.toSnapshot()))).toBe(true);
        for (let x = 10; x <= 15; x++) for (let y = 10; y <= 15; y++) loaded.grid.setTerrain(x, y, T.FLOOR);
        loaded.executeCommand('wait'); const restored = loaded.monsters.find(c => c.id === passenger.id)!;
        expect(restored).toBeDefined(); expect(restored.hp).toBe(500); expect(footprintOf(restored)).toHaveLength(9);
        expect((loaded as any).pendingFallenByDepth.has(1)).toBe(false);
    });
    it('square purgatory retains geometry and refuses no-fit resurrection without mutation', () => {
        const g = squareGame(), m = squareMonster(g, 3); m.isAlly = true; g.killMonster(m); (g as any).removeDeadMonsters();
        expect((g as any).purgatory).toContain(m);
        const loaded = createHeadlessGame(991, 'test'); expect(loaded.loadSnapshot(json(g.toSnapshot()))).toBe(true);
        const dead = (loaded as any).purgatory[0] as Monster; expect(dead.spatial).toEqual(m.spatial);
        for (let x = 0; x < loaded.grid.width; x++) for (let y = 0; y < loaded.grid.height; y++) loaded.grid.setTerrain(x, y, T.WALL);
        const loc = dead.loc, state = rng.getState(); expect(loaded.resurrectAlly({ x: 12, y: 12 })).toBe(false);
        expect(dead.loc).toBe(loc); expect(dead.hp).toBe(0); expect((loaded as any).purgatory).toContain(dead); expect(rng.getState()).toEqual(state);
        for (let x = 10; x <= 15; x++) for (let y = 10; y <= 15; y++) loaded.grid.setTerrain(x, y, T.FLOOR);
        expect(loaded.resurrectAlly({ x: 12, y: 12 })).toBe(true); expect(loaded.monsters).toContain(dead); expect(dead.hp).toBe(dead.maxHp); expect(footprintOf(dead)).toHaveLength(9);
    });
    it('DF evacuation moves the whole body out of its origin and does not allocate an entity', () => {
        const g = squareGame(), m = squareMonster(g, 3), origin = { x: m.x + 2, y: m.y + 2 }, id = getNextEntityId();
        spawnDungeonFeature(g.grid, origin.x, origin.y, catalogFeature(DF.DF_REPEL_CREATURES), false);
        expect(footprintOf(m).some(p => p.x === origin.x && p.y === origin.y)).toBe(false);
        expect(canPlaceCreature(g, m, m.loc)).toBe(true); expect(getNextEntityId()).toBe(id);
    });
});

function verifyCommandRecording(g: Game, commands: Array<{ action: string; data?: { x: number; y: number } }>, prefix: number) {
    const states = []; let checkpoint: ReturnType<Game['toSaveSnapshot']> | undefined;
    for (let i = 0; i < commands.length; i++) {
        const command = commands[i]!; g.executeCommand(command.action, command.data); states.push(playbackWorld(g));
        if (i + 1 === prefix) checkpoint = json(g.toSaveSnapshot());
    }
    const recording = g.exportRecording(), final = playbackWorld(g);
    const loaded = createHeadlessGame(991, 'test'); expect(loaded.loadSnapshot(checkpoint!)).toBe(true);
    for (let i = prefix; i < commands.length; i++) { loaded.executeCommand(commands[i]!.action, commands[i]!.data); expect(playbackWorld(loaded)).toEqual(states[i]); }
    expect(loaded.exportRecording().events).toEqual(recording.events);
    expect(loaded.loadReplay(recording)).toBe(true);
    for (let i = 0; i < commands.length; i++) { loaded.replayStep(true); expect(loaded.replayError).toBeNull(); expect(playbackWorld(loaded)).toEqual(states[i]); }
    for (const index of [prefix, commands.length, 1, commands.length - 1]) { loaded.replaySeek(index); expect(loaded.replayError).toBeNull(); expect(playbackWorld(loaded)).toEqual(states[index - 1]); }
    return { states, final };
}

describe('4a-1 command displacement/level/pending recording closure', () => {
    it.each([2, 3] as const)('%s-square real force attack saves, resumes, replays and seeks', size => {
        const start = Game.prototype.startNewGame;
        vi.spyOn(Game.prototype, 'startNewGame').mockImplementation(function(this: Game, ...args) {
            start.apply(this, args); arrangeSquareGame(this); const m = squareMonster(this, size); m.defense = -1000; m.hp = m.maxHp = 1000000;
            commitCreatureAnchor(this.player, { x: 11, y: 12 });
            const weapon = ItemLoader.spawnWeapon('dagger', -1, -1)!;
            weapon.enchantment = 30; weapon.runicType = 'force'; this.player.inventory.items.push(weapon); this.player.equippedWeapon = weapon;
        });
        const g = createHeadlessGame(41041, 'test'), force = vi.spyOn(g as any, 'applyWeaponRunicEffect');
        verifyCommandRecording(g, [{ action: 'move', data: { x: 1, y: 0 } }, { action: 'wait' }, { action: 'wait' }], 1);
        expect(force.mock.calls.some(c => c[2] === 'force')).toBe(true); expect(g.monsters[0]!.x).toBeGreaterThan(20);
    });
    it.each([2, 3] as const)('%s-square follows through real stair commands and persists both floors', size => {
        const start = Game.prototype.startNewGame;
        vi.spyOn(Game.prototype, 'startNewGame').mockImplementation(function(this: Game, ...args) {
            start.apply(this, args); arrangeSquareGame(this); this.mode = 'normal'; (this as any).currentLevelDepth = 1;
            this.depth = 2; (this as any).generateDepth(false); arrangeSquareGame(this); this.grid.setTerrain(65, 14, T.STAIRS_UP); this.levelSeeds[1]!.upStairsLoc = { x: 65, y: 14 };
            this.depth = 1; (this as any).generateDepth(true); arrangeSquareGame(this); this.grid.setTerrain(65, 14, T.STAIRS_DOWN); this.levelSeeds[0]!.downStairsLoc = { x: 65, y: 14 };
            const m = squareMonster(this, size, 59, 14); m.isAlly = true;
        });
        const g = createHeadlessGame(41041, 'normal');
        verifyCommandRecording(g, [{ action: 'stairs_down' }, ...Array.from({ length: 12 }, () => ({ action: 'wait' }))], 3);
        expect(g.depth).toBe(2); expect(g.monsters.some(m => m.spatial?.footprintId === `builtin:square-${size}`)).toBe(true);
    });
    it('no-fit pending remains single-owned through real commands, save continuation, each replay event and seek', () => {
        const start = Game.prototype.startNewGame;
        vi.spyOn(Game.prototype, 'startNewGame').mockImplementation(function(this: Game, ...args) {
            start.apply(this, args); arrangeSquareGame(this); this.mode = 'normal'; (this as any).currentLevelDepth = 1;
            this.depth = 2; (this as any).generateDepth(false); arrangeSquareGame(this);
            for (let x = 0; x < this.grid.width; x++) for (let y = 0; y < this.grid.height; y++) this.grid.setTerrain(x, y, T.WALL);
            this.grid.setTerrain(65, 14, T.STAIRS_UP); this.levelSeeds[1]!.upStairsLoc = { x: 65, y: 14 };
            this.depth = 1; (this as any).generateDepth(true); arrangeSquareGame(this); this.grid.setTerrain(65, 14, T.STAIRS_DOWN); this.levelSeeds[0]!.downStairsLoc = { x: 65, y: 14 };
            const m = squareMonster(this, 3); m.behaviorFlags.add('MONST_WILL_NOT_USE_STAIRS');
            for (const p of footprintOf(m)) this.grid.setTerrain(p.x, p.y, T.CHASM);
        });
        const g = createHeadlessGame(41041, 'normal');
        const result = verifyCommandRecording(g, [{ action: 'wait' }, { action: 'move', data: { x: 1, y: 1 } }, { action: 'wait' }, { action: 'wait' }], 2);
        expect(result.states[0]!.pendingFallenByDepth[0]!.monsters).toHaveLength(1);
        expect(g.depth).toBe(2); const queue = (g as any).pendingFallenByDepth.get(2) as Monster[]; expect(queue).toHaveLength(1);
        expect(footprintOf(queue[0]!)).toHaveLength(9); expect(g.monsters).not.toContain(queue[0]);
    });
});
