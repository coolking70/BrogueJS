import { describe, expect, it } from 'vitest';
import { Grid, TerrainType } from '../engine/Map/Grid';
import { LightMap, type PaintLightParams } from '../engine/Lighting/LightMap';
import { LIGHT_CATALOG, LightKind } from '../engine/Map/LightCatalog';
import { displayRandom, sampleLight } from '../engine/Lighting/CosmeticLight';
import { rng } from '../engine/Random';

function grid() {
    const result = new Grid(79, 29);
    for (let x = 0; x < result.width; x++) for (let y = 0; y < result.height; y++) {
        result.setTerrain(x, y, x === 0 || y === 0 || x === 78 || y === 28 || (x === 42 && y % 5 !== 0)
            ? TerrainType.WALL : TerrainType.FLOOR);
    }
    return result;
}
function channels(map: LightMap, g: Grid, render = false) {
    return Array.from({ length: g.width }, (_, x) => Array.from({ length: g.height }, (_, y) =>
        ({ ...(render ? map.renderLightAt(x, y) : map.lightAt(x, y)), shadow: render ? null : map.inShadowAt(x, y) })));
}
function lights(blocker: (x: number, y: number) => boolean): PaintLightParams[] {
    return Array.from({ length: 96 }, (_, i) => ({
        light: LIGHT_CATALOG[i % 3 === 0 ? LightKind.TORCH_LIGHT : LightKind.FIRE_LIGHT]!,
        x: 33 + i % 8, y: 10 + i % 7, hasCreatureAt: blocker,
        maintainShadows: i % 5 === 0, isMinersLight: i % 11 === 0,
    }));
}

describe('late-depth light occupancy batches', () => {
    it('preserves every channel/shadow and RNG while bounding occupancy work independently of light count', () => {
        const g = grid(), reference = new LightMap(g), batch = new LightMap(g), before = rng.getState();
        let queries = 0;
        const sources = lights((x, y) => { queries++; return x === 35 && y === 14; });
        for (const source of sources) reference.paintLight(source);
        const sequentialQueries = queries; queries = 0;
        const start = performance.now(); batch.paintLights(sources); const elapsed = performance.now() - start;
        expect(channels(batch, g)).toEqual(channels(reference, g));
        // Deterministic complexity gate, rather than a fragile laptop speed ratio.
        expect(queries).toBeLessThanOrEqual(g.width * g.height);
        expect(queries * 16).toBeLessThan(sequentialQueries);
        expect(elapsed).toBeLessThan(250); // ample room for two-worker CI contention
        expect(rng.getState()).toEqual(before);
    });

    it('isolates predicates and batches, and leaves individual stateful paint calls uncached', () => {
        const g = grid(), batch = new LightMap(g), reference = new LightMap(g);
        let occupant = 35;
        const sources = lights((x, y) => x === occupant && y === 14);
        sources.push({ ...sources[0]!, hasCreatureAt: (x, y) => x === 38 && y === 12 });
        for (const x of [35, 36, -1]) {
            occupant = x; batch.clearLighting(); reference.clearLighting();
            batch.paintLights(sources);
            for (const source of sources) reference.paintLight(source);
            expect(channels(batch, g)).toEqual(channels(reference, g));
        }
        let calls = 0;
        const source = { ...sources[0]!, hasCreatureAt: () => ++calls % 3 === 0 };
        reference.paintLight(source); const first = calls; reference.paintLight(source);
        expect(calls).toBeGreaterThan(first);
    });

    it('rebuilds the dance cache after movement and terrain changes, preserving sampled colors and display RNG', () => {
        const g = grid(), map = new LightMap(g), simulation = rng.getState();
        let occupant = 35, queries = 0;
        const sources = lights((x, y) => { queries++; return x === occupant && y === 14; });
        map.paintLights(sources);
        const base = channels(map, g), random = displayRandom(g);
        for (const x of [35, 36, -1]) {
            occupant = x;
            if (x === -1) g.setTerrain(34, 13, TerrainType.WALL);
            const state = random.getState(), reference = new LightMap(g);
            for (const source of sources) reference.paintLight({ ...source, light: sampleLight(source.light, 100000, random) });
            const expectedRandom = random.getState(); random.setState(state); queries = 0;
            map.dance();
            expect(queries).toBeLessThanOrEqual(g.width * g.height);
            expect(channels(map, g, true)).toEqual(channels(reference, g, true));
            expect(random.getState()).toEqual(expectedRandom);
            expect(channels(map, g)).toEqual(base);
        }
        expect(rng.getState()).toEqual(simulation);
    });
});
