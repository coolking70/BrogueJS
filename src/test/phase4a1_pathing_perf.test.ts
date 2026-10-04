import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { CreatureSpatial } from '../engine/Movement/CreatureSpatial';
import { SpatialCatalog } from '../engine/Movement/SpatialSchema';
import { FootprintPathing } from '../engine/Map/FootprintPathing';
import { Grid, TerrainType as T } from '../engine/Map/Grid';
import { Monster, type MonsterData } from '../entities/Monster';
import { rng } from '../engine/Random';
import monsters from '../data/monsters.json';

it('records bounded native-fixture plan+commit costs; no square users build/count/scan nothing', () => {
    const rows = [];
    for (const [size, count] of [[1, 1], [2, 1], [2, 4], [3, 1]] as const) {
        const grid = new Grid(79, 29);
        for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) grid.setTerrain(x, y, x && y && x < 78 && y < 28 ? T.FLOOR : T.WALL);
        const actors = Array.from({ length: count }, (_, i) => {
            const actor = new Monster(4, 4 + i * 6, (monsters as MonsterData[]).find(m => m.id === 'rat')!);
            if (size > 1) actor.spatial = { schema: 1, footprintId: `builtin:square-${size}`, pose: 'r0' };
            return actor;
        });
        const spatial = new CreatureSpatial({ grid, monsters: actors }, new SpatialCatalog(true));
        const pathing = new FootprintPathing(spatial), samples: number[] = [];
        const target = new Monster(67, 14, (monsters as MonsterData[]).find(m => m.id === 'rat')!);
        spatial.replaceWorld({ grid, monsters: [...actors, target] });
        const randomBefore = rng.getState();
        const goal = { kind: 'contact' as const, target };
        let moved = 0, blocked = 0, reads = 0;
        const get = grid.getCell.bind(grid);
        grid.getCell = (x, y) => { reads++; return get(x, y); };
        for (let command = 0; command < 30; command++) {
            const start = performance.now();
            for (const actor of actors) {
                const step = pathing.planStep(actor, goal);
                if (step.kind === 'step') {
                    const plan = spatial.planStepPlacement(actor, step.at!);
                    if (!plan || !spatial.commitPlacement(plan)) throw new Error('fixture movement failed');
                    moved++;
                } else if (step.kind === 'blocked') blocked++;
                else expect(step.kind).toBe('unsupported');
            }
            samples.push(performance.now() - start);
        }
        const randomAfter = rng.getState(); expect(randomAfter).toEqual(randomBefore);
        const sorted = [...samples.slice(1)].sort((a, b) => a - b);
        if (size === 1) {
            expect(pathing.stats).toEqual({ terrainBuilds: 0, distanceBuilds: 0, dynamicReplans: 0, cacheHits: 0, visitedNodes: 0, cachedGraphs: 0 });
            expect(reads).toBe(0); expect(spatial.hasIndex).toBe(false);
        } else { expect(moved).toBeGreaterThan(0); expect(pathing.stats.terrainBuilds).toBe(1); }
        rows.push({ size, count, commands: samples.length, coldMs: samples[0], warmP50Ms: sorted[Math.floor(sorted.length * .5)],
            warmP95Ms: sorted[Math.floor(sorted.length * .95)], moved, blocked, cellReads: reads, ...pathing.stats,
            substantiveRngDelta: randomAfter.randomNumbersGenerated - randomBefore.randomNumbersGenerated,
            cosmeticRngDelta: randomAfter.cosmeticNumbersGenerated - randomBefore.cosmeticNumbersGenerated });
    }
    writeFileSync('/private/tmp/p4a1-pathing-performance.json', JSON.stringify({
        scope: 'native fixture only; one sample plans and commits one movement for each actor; no Game/NPC scheduling or environment',
        node: process.version, nodeOptions: process.env.NODE_OPTIONS, rows,
    }, null, 2) + '\n');
});
