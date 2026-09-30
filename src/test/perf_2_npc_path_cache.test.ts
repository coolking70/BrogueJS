import { describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import type { Game } from '../engine/Core/Game';
import { Pathfind } from '../engine/Map/Pathfind';
import { TerrainType } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import monsters from '../data/monsters.json';

describe('PERF-2 NPC query-local passability', () => {
    it.each(['spectral_blade', 'stone_guardian'])('retains raw paths and refreshes terrain reads between %s queries', id => {
        const game = createHeadlessGame(27030, 'test');
        game.monsters = []; game.dormantMonsters = [];
        for (let x = 5; x <= 24; x++) for (let y = 5; y <= 24; y++) game.grid.setTerrain(x, y, TerrainType.FLOOR);
        game.player.loc = { x: 10, y: 10 };
        const monster = new Monster(20, 20, monsters.find(row => row.id === id)! as unknown as MonsterData);
        monster.state = MonsterState.HUNTING;
        monster.isAlly = id === 'spectral_blade'; monster.boundToPlayer = monster.isAlly;
        monster.doesNotTrackLeader = false; monster.givenUpOnScent = true; game.monsters.push(monster);
        const exposed = monster as unknown as { canEnterMovementTerrain(game: Game, x: number, y: number): boolean };
        const terrain = exposed.canEnterMovementTerrain, find = Pathfind.findPath.bind(Pathfind);
        let inQuery = false, reads = new Map<string, number>();
        const paths: Array<ReturnType<typeof find>> = [];
        const terrainSpy = vi.spyOn(exposed, 'canEnterMovementTerrain').mockImplementation((g, x, y) => {
            if (inQuery) { const key = `${x},${y}`; reads.set(key, (reads.get(key) ?? 0) + 1); }
            return terrain.call(monster, g, x, y);
        });
        const pathSpy = vi.spyOn(Pathfind, 'findPath').mockImplementation((grid, sx, sy, gx, gy, canPass, canStep) => {
            const before = JSON.stringify(game.toSnapshot()), random = rng.getState(); reads = new Map();
            inQuery = true;
            const path = find(grid, sx, sy, gx, gy, canPass, canStep);
            inQuery = false;
            const oracle = find(grid, sx, sy, gx, gy,
                (x, y) => terrain.call(monster, game, x, y) && !game.getMonsterAt(x, y), canStep);
            expect(path).toEqual(oracle); expect(rng.getState()).toEqual(random);
            // Snapshot wall-clock metadata is captured independently of world state.
            const stripTime = (s: string) => { const { savedAt: _savedAt, ...world } = JSON.parse(s); return world; };
            expect(stripTime(JSON.stringify(game.toSnapshot()))).toEqual(stripTime(before));
            expect(reads.size).toBeGreaterThan(10);
            expect(Math.max(...reads.values())).toBe(1);
            paths.push(path); return path;
        });
        try {
            monster.takeTurn(game, 14); expect(paths).toHaveLength(1);
            game.grid.setTerrain(18, 18, TerrainType.WALL); game.player.loc.y = 12;
            monster.takeTurn(game, 14); expect(paths).toHaveLength(2);
            expect(paths[1]).not.toEqual(paths[0]);
        } finally { pathSpy.mockRestore(); terrainSpy.mockRestore(); }
    });
});
