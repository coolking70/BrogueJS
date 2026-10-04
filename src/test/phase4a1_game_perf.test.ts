import { writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsterData from '../data/monsters.json';
import { TerrainType as T } from '../engine/Map/Grid';
import { EnvironmentManager } from '../engine/Environment/Gas';
import { WaypointSystem } from '../engine/Map/WaypointMap';
import { commitCreatureAnchor } from '../engine/Movement/CreatureSpatial';
import * as exposures from '../engine/Movement/FootprintExposure';

// Real command, scheduler, NPC and environment execution. Timers observe the
// square bridge, swept fit, placement preflight and exposure reducer only.
// Whole command duration is reported separately; no timing target is a guard.
describe('4a-1 real Game command performance observation', () => {
    it('records 0/1/4 square-2 and 1 square-3 with ordinary zero capability work', () => {
        const rows = [];
        for (const [count, size] of [[0, 2], [1, 2], [4, 2], [1, 3]] as const) {
            const g = createHeadlessGame(411041, 'test'); g.animationEnabled = false;
            g.monsters = []; g.dormantMonsters = []; g.items = [];
            for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) {
                g.grid.setTerrain(x, y, x === 0 || y === 0 || x === g.grid.width - 1 || y === g.grid.height - 1 ? T.WALL : T.FLOOR);
                g.grid.getCell(x, y)!.machineNumber = 0;
            }
            g.environment = new EnvironmentManager(g.grid); g.waypoints = new WaypointSystem();
            commitCreatureAnchor(g.player, { x: 65, y: 14 }); g.player.hp = g.player.maxHp = 100000;
            for (let i = 0; i < Math.max(1, count); i++) {
                const m = new Monster(12, count === 4 ? 5 + i * 6 : 12, (monsterData as MonsterData[]).find(d => d.id === 'rat')!);
                if (count) m.spatial = { schema: 1, footprintId: `builtin:square-${size}`, pose: 'r0' };
                m.state = MonsterState.HUNTING; m.givenUpOnScent = true; m.behaviorFlags.add('MONST_ALWAYS_HUNTING');
                g.monsters.push(m);
            }
            let spatialMs = 0;
            let timerDepth = 0;
            const measured = <V>(call: () => V): V => {
                const outer = timerDepth++ === 0, t = performance.now();
                try { return call(); } finally { timerDepth--; if (outer) spatialMs += performance.now() - t; }
            };
            const bridge = g.planSquareStep.bind(g), swept = g.canStepFootprint.bind(g);
            const preflight = (g as any).canDisplaceCreature.bind(g), exposure = exposures.footprintExposure;
            vi.spyOn(g, 'planSquareStep').mockImplementation((...args) => measured(() => bridge(...args)));
            vi.spyOn(g, 'canStepFootprint').mockImplementation((...args) => measured(() => swept(...args)));
            vi.spyOn(g as any, 'canDisplaceCreature').mockImplementation((...args: unknown[]) => measured(() => preflight(...args)));
            vi.spyOn(exposures, 'footprintExposure').mockImplementation((...args) => measured(() => exposure(...args)));
            const spatial: number[] = [], command: number[] = [];
            for (let i = 0; i < 30; i++) { spatialMs = 0; const t = performance.now(); g.executeCommand('wait'); command.push(performance.now() - t); spatial.push(spatialMs); }
            const quantile = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * q) - 1]!;
            const stats = g.squarePathingStats();
            if (!count) { expect(stats.terrainBuilds).toBe(0); expect(stats.distanceBuilds).toBe(0); expect(spatial.every(v => v === 0)).toBe(true); }
            else { expect(stats.terrainBuilds).toBeGreaterThan(0); expect(g.monsters.every(m => m.x > 12)).toBe(true); }
            rows.push({ count, size: count ? size : 1, samples: 30, coldSpatialMs: spatial[0], spatialP50: quantile(spatial.slice(1), .5), spatialP95: quantile(spatial.slice(1), .95), commandP50: quantile(command.slice(1), .5), commandP95: quantile(command.slice(1), .95), stats, spatial, command });
            vi.restoreAllMocks();
        }
        writeFileSync('/private/tmp/p4a1-game-performance.json', JSON.stringify({ node: process.version, rows }, null, 2));
    });
});
