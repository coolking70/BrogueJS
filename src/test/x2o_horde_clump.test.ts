import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../engine/Core/Game';
import { rng } from '../engine/Random';
import { Grid, TerrainType as T } from '../engine/Map/Grid';
import { Monster, type MonsterData } from '../entities/Monster';
import hordes from '../data/hordes.json';
import monsters from '../data/monsters.json';

afterEach(() => vi.restoreAllMocks());
function arena(terrain = T.FLOOR): any {
    const g: any = new Game();
    g.grid = new Grid(79, 29); g.monsters = []; g.dormantMonsters = [];
    g.player.loc = { x: 2, y: 2 }; g.depth = 30;
    for (let x = 1; x < 78; x++) for (let y = 1; y < 28; y++) g.grid.setTerrain(x, y, terrain);
    rng.seedRandomGenerator(20260927);
    return g;
}

describe('X2o horde consumers', () => {
    it('every ordinary/captive/machine horde consumes each member triple exactly once before placement', () => {
        const g = arena();
        vi.spyOn(g, 'findMinionSpawnSpot').mockReturnValue(null);
        const roll = vi.spyOn(rng, 'randClumpedRange');
        for (const h of hordes) {
            g.monsters = []; roll.mockClear();
            expect(g.spawnHordeAt(h, { x: 35, y: 14 }, 1, false)).toBe(true);
            expect(roll.mock.calls).toEqual(h.members.map(m => [m.minCount, m.maxCount, m.clumpFactor]));
            expect(g.monsters).toHaveLength(1);
            expect(g.monsters[0].isCaged).toBe(h.flags.includes('HORDE_LEADER_CAPTIVE'));
        }
    });
    it.each(['GOLEM', 'KRAKEN'])('%s clumped D30 horde places exactly the rolled members on real terrain', type => {
        const h = hordes.find(h => h.leader === type && h.minLevel === 30)!;
        expect(h).toBeDefined();
        const g = arena(type === 'KRAKEN' ? T.WATER_DEEP : T.FLOOR);
        const roll = vi.spyOn(rng, 'randClumpedRange');
        const collected: Monster[] = [];
        expect(g.spawnHordeAt(h, { x: 35, y: 14 }, 30, false, undefined, collected)).toBe(true);
        expect(roll.mock.calls).toEqual([[5, 10, 2]]);
        expect(collected.length).toBe(1 + roll.mock.results[0]!.value);
        expect(new Set(collected.map(m => `${m.x},${m.y}`)).size).toBe(collected.length);
        expect(collected.slice(1).every(m => m.leader === collected[0])).toBe(true);
        expect(collected.every(m => g.grid.getCell(m.x,m.y).terrain === (type === 'KRAKEN' ? T.WATER_DEEP : T.FLOOR))).toBe(true);
    });
    it('all summon rows use their complete CE triple through the actual summon consumer', () => {
        const g = arena();
        const pick = vi.spyOn(g, 'pickHordeType');
        const roll = vi.spyOn(rng, 'randClumpedRange');
        for (const h of hordes.filter(h => h.flags.includes('HORDE_IS_SUMMONED'))) {
            const summoner = new Monster(35, 14, (monsters as MonsterData[]).find(m => m.id === h.leader.toLowerCase())!);
            g.monsters = [summoner]; pick.mockReturnValue(h); roll.mockClear();
            g.summonMinionsFor(summoner);
            expect(roll.mock.calls).toEqual(h.members.map(m => [m.minCount, m.maxCount, m.clumpFactor]));
            expect(g.monsters.filter((m: Monster) => m !== summoner).length).toBe(roll.mock.results.reduce((n, r) => n + r.value, 0));
        }
    });
});
