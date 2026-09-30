import { describe, expect, it, vi, afterEach } from 'vitest';
import { Grid, TerrainType as T, DungeonLayer as L } from '../engine/Map/Grid';
import { lakeDisruptsPassability } from '../engine/Map/Connectivity';
import { TERRAIN_FLAGS, T_OBSTRUCTS_PASSABILITY, T_LAVA_INSTA_DEATH, T_AUTO_DESCENT, T_IS_DEEP_WATER, T_OBSTRUCTS_DIAGONAL_MOVEMENT } from '../engine/Map/TerrainCatalog';
import { createHeadlessGame } from './harness';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';

afterEach(() => vi.restoreAllMocks());

function blank() {
    const grid = new Grid(7, 7);
    for (let x = 0; x < 7; x++) for (let y = 0; y < 7; y++) grid.setTerrain(x, y, T.GRANITE);
    return grid;
}

describe('LAVA-1 CE lake connectivity', () => {
    it('rejects a lake leaving only a diagonal wall corner; accepts a cardinal bypass', () => {
        const grid = blank();
        for (const [x, y] of [[2, 2], [3, 2], [3, 3]]) grid.setTerrain(x!, y!, T.FLOOR);
        expect(lakeDisruptsPassability(grid, (x, y) => x === 3 && y === 2)).toBe(true);
        grid.setTerrain(2, 3, T.FLOOR);
        expect(lakeDisruptsPassability(grid, (x, y) => x === 3 && y === 2)).toBe(false);
    });

    it.each([T.LAVA, T.CHASM, T.WATER_DEEP, T.TRAP])('does not count existing hazard %s as a dry corridor, including a liquid layer under a bridge', hazard => {
        const grid = blank();
        for (let x = 1; x <= 5; x++) grid.setTerrain(x, 3, T.FLOOR);
        grid.setTerrain(3, 3, hazard);
        if (hazard === T.LAVA) grid.setTerrainLayer(3, 3, L.SURFACE, T.BRIDGE);
        expect(lakeDisruptsPassability(grid, () => false)).toBe(true);
    });

    it('allows a CE TM_CONNECTS_LEVEL gate to connect dry regions without counting it as dry', () => {
        const grid = blank();
        for (let x = 1; x <= 5; x++) grid.setTerrain(x, 3, T.FLOOR);
        grid.setTerrain(3, 3, T.WOODEN_BARRICADE);
        expect(lakeDisruptsPassability(grid, () => false)).toBe(false);
        grid.setTerrain(5, 5, T.FLOOR);
        expect(lakeDisruptsPassability(grid, () => false)).toBe(true); // visited gate must not hide an isolated dry tile
    });
});

describe('LAVA-1 actual player commands', () => {
    it('promotes a diagonal wall lever before rejecting its wall corner, without moving the player', () => {
        const g = createHeadlessGame(33001, 'test');
        g.monsters = []; g.dormantMonsters = []; g.items = [];
        g.player.loc = { x: 10, y: 10 };
        g.grid.setTerrain(10, 10, T.FLOOR);
        g.grid.setTerrain(11, 10, T.WALL); g.grid.setTerrain(10, 11, T.WALL);
        g.grid.setTerrain(11, 11, T.WALL_LEVER);
        const turn = g.absoluteTurnNumber;
        g.executeCommand('move', { x: 1, y: 1 });
        expect(g.grid.getCell(11, 11)!.layers).toContain(T.WALL_LEVER_PULLED);
        expect(g.player.loc).toEqual({ x: 10, y: 10 });
        expect(g.absoluteTurnNumber).toBe(turn + 1);
    });

    it.each([false, true])('ordinary melee cannot cross a wall corner; attackable-through-walls exception=%s', throughWalls => {
        const g = createHeadlessGame(33001, 'test');
        g.monsters = []; g.dormantMonsters = []; g.items = [];
        g.player.loc = { x: 10, y: 10 };
        for (const [x, y] of [[10, 10], [11, 11], [10, 11]]) g.grid.setTerrain(x!, y!, T.FLOOR);
        g.grid.setTerrain(11, 10, T.WALL);
        const monster = new Monster(11, 11, { ...monsters.find(m => m.id === 'rat')!, hp: 500 } as MonsterData);
        monster.state = MonsterState.ASLEEP;
        if (throughWalls) monster.behaviorFlags.add('MONST_ATTACKABLE_THRU_WALLS');
        g.monsters.push(monster);
        const attack = vi.spyOn(g as any, 'resolvePlayerMeleeAttackOn');
        const turn = g.absoluteTurnNumber;
        g.executeCommand('move', { x: 1, y: 1 });
        expect(attack.mock.calls.length).toBe(throughWalls ? 1 : 0);
        expect(g.absoluteTurnNumber).toBe(turn + (throughWalls ? 1 : 0));
        expect(g.player.loc).toEqual({ x: 10, y: 10 });
    });

    it.each([true, false])('blocks the wall/lava diagonal even when the wall is known=%s, without time or RNG', known => {
        const g = createHeadlessGame(33001, 'test');
        g.monsters = []; g.dormantMonsters = []; g.items = [];
        g.player.loc = { x: 10, y: 10 };
        g.grid.setTerrain(10, 10, T.FLOOR); g.grid.setTerrain(11, 11, T.FLOOR);
        g.grid.setTerrain(11, 10, T.WALL); g.grid.setTerrain(10, 11, T.LAVA);
        const c = g.grid.getCell(11, 10)!;
        c.isVisible = c.hasMemory = c.isExplored = known;
        c.isMagicMapped = false; c.rememberedLayers = known ? [...c.layers] : [T.NOTHING, T.NOTHING, T.NOTHING, T.NOTHING];
        const old = structuredClone({ loc: g.player.loc, turn: g.absoluteTurnNumber, tick: timeSystem.currentTick, rng: rng.getState() });
        g.executeCommand('move', { x: 1, y: 1 });
        expect({ loc: g.player.loc, turn: g.absoluteTurnNumber, tick: timeSystem.currentTick, rng: rng.getState() }).toEqual(old);
        expect(g.exportRecording().events.slice(-1)[0]).toMatchObject({ turn: old.turn, tick: old.tick, rng: old.rng });
        g.grid.setTerrain(11, 10, T.FLOOR);
        g.executeCommand('move', { x: 1, y: 1 });
        expect(g.player.loc).toEqual({ x: 11, y: 11 }); // lava alone does not block a diagonal
    });

    it('the replay seed D4 has a route between stairs without lava, deep water, falling, or squeezing a wall corner', () => {
        const g: any = createHeadlessGame(437995121);
        for (let d = 2; d <= 4; d++) { g.depth = d; g.generateDepth(false, false); }
        expect(g.levelSeeds[3].levelSeed).toBe('15318643');
        const start = g.levelSeeds[3].upStairsLoc, target = g.levelSeeds[3].downStairsLoc;
        const flags = (x: number, y: number): number => g.grid.getCell(x, y)?.layers.reduce((f: number, t: T) => f | TERRAIN_FLAGS[t].flags, 0) ?? T_OBSTRUCTS_PASSABILITY;
        const blocked = T_OBSTRUCTS_PASSABILITY | T_LAVA_INSTA_DEATH | T_AUTO_DESCENT | T_IS_DEEP_WATER;
        const seen = new Set([`${start.x},${start.y}`]), queue = [start];
        for (let i = 0; i < queue.length; i++) {
            const p = queue[i];
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
                if (!dx && !dy) continue;
                const x = p.x + dx, y = p.y + dy, key = `${x},${y}`;
                if (seen.has(key) || (flags(x, y) & blocked)) continue;
                if (dx && dy && ((flags(p.x, y) | flags(x, p.y)) & T_OBSTRUCTS_DIAGONAL_MOVEMENT)) continue;
                seen.add(key); queue.push({ x, y });
            }
        }
        expect(seen.has(`${target.x},${target.y}`), `stairs ${JSON.stringify({ start, target })}`).toBe(true);
    });
});
