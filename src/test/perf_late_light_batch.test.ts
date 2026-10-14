import { describe, expect, it, vi } from 'vitest';
import { Grid, TerrainType, DungeonLayer } from '../engine/Map/Grid';
import { LightMap, type PaintLightParams } from '../engine/Lighting/LightMap';
import { LIGHT_CATALOG, LightKind } from '../engine/Map/LightCatalog';
import { displayRandom, sampleLight } from '../engine/Lighting/CosmeticLight';
import { fillSpawnMap } from '../engine/Map/DungeonFeature';
import { analyzeLoopMap } from '../engine/Map/LoopMap';
import { monsterAt, withMonsterLookup } from '../engine/Core/MonsterLifecycle';
import type { Monster } from '../entities/Monster';
import { FOVSys } from '../engine/Lighting/FOV';
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


describe('round two retained lighting work', () => {
    it('does no painting or shadowcasting for unchanged inputs, and reuses the visual buffer', () => {
        const g = grid(), map = new LightMap(g);
        const light = { ...LIGHT_CATALOG[LightKind.TORCH_LIGHT]!,
            radius: { lowerBound: 500, upperBound: 500, clumpFactor: 1 },
            color: { red: 90, green: 60, blue: 20, redRand: 0, greenRand: 0, blueRand: 0, rand: 0 } };
        const sources = [{ light, x: 30, y: 13 }];
        const paint = vi.spyOn(map, 'paintLights');
        expect(map.updateLighting(sources)).toBe(true);
        expect(map.updateLighting(sources)).toBe(false);
        expect(paint).toHaveBeenCalledTimes(1);
        expect(map.dance()).toBe(true);
        const visual = (map as any).visualMap;
        const cast = vi.spyOn(visual, 'castLightMask');
        for (let i = 0; i < 40; i++) expect(map.dance()).toBe(false);
        expect((map as any).visualMap).toBe(visual);
        expect(cast).not.toHaveBeenCalled();
        const reference = new LightMap(g); reference.paintLight(sources[0]!);
        expect(channels(map, g, true)).toEqual(channels(reference, g, true));
    });

    it('reuses static shadow geometry while retaining color samples and both random streams', () => {
        const g = grid(), map = new LightMap(g), random = displayRandom(g);
        const sources = lights(() => false).map(s => ({ ...s, light: { ...s.light,
            radius: { lowerBound: 500, upperBound: 500, clumpFactor: 1 } } }));
        map.paintLights(sources); map.dance();
        const visual = (map as any).visualMap, cast = vi.spyOn(visual, 'castLightMask');
        const simulation = rng.getState();
        for (let i = 0; i < 8; i++) {
            const start = random.getState(), reference = new LightMap(g);
            for (const source of sources) reference.paintLight({ ...source, light: sampleLight(source.light, 100000, random) });
            const end = random.getState(); random.setState(start);
            map.dance();
            expect(channels(map, g, true)).toEqual(channels(reference, g, true));
            expect(random.getState()).toEqual(end);
        }
        expect(cast).not.toHaveBeenCalled();
        expect(rng.getState()).toEqual(simulation);
    });

    it('reuses distance attenuation for RGB edits while radius and fade edits rebuild it', () => {
        const g = grid(), map = new LightMap(g);
        const source = { light: { ...LIGHT_CATALOG[LightKind.TORCH_LIGHT]!,
            color: { ...LIGHT_CATALOG[LightKind.TORCH_LIGHT]!.color } }, x: 30, y: 13 };
        map.updateLighting([source]);
        for (const edit of ['color', 'radius', 'fade'] as const) {
            if (edit === 'color') source.light.color.red -= 7;
            if (edit === 'radius') source.light.radius = { ...source.light.radius, lowerBound: 300, upperBound: 300 };
            if (edit === 'fade') source.light.radialFadeToPercent = 42;
            const reference = new LightMap(g); reference.paintLight(source);
            const sqrt = vi.spyOn(Math, 'sqrt');
            try {
                map.updateLighting([source]);
                if (edit === 'color') expect(sqrt).not.toHaveBeenCalled();
                else expect(sqrt).toHaveBeenCalled();
            } finally { sqrt.mockRestore(); }
            expect(channels(map, g)).toEqual(channels(reference, g));
        }
    });

    it('invalidates on blockers, source edits and explicit clears, without losing knowledge updates', () => {
        const g = grid(), map = new LightMap(g);
        let occupant = 35;
        const sources = lights((x, y) => x === occupant && y === 14);
        sources.push({ ...sources[0]!, hasCreatureAt: (x, y) => x === 38 && y === 12 });
        const check = () => {
            const reference = new LightMap(g);
            for (const source of sources) reference.paintLight(source);
            expect(map.updateLighting(sources)).toBe(true);
            expect(channels(map, g)).toEqual(channels(reference, g));
            expect(map.updateLighting(sources)).toBe(false);
        };
        check(); occupant = 36; check();
        g.setTerrain(34, 13, TerrainType.WALL); check();
        g.getCell(34, 13)!.isOpaque = false; check();
        sources[0]!.x++; check();
        sources[0]!.radiusHundredths = 350; check();
        sources[0]!.light = { ...sources[0]!.light, radialFadeToPercent: 20 }; check();
        map.clearLighting(); check();
    });
});


it('retains pure FOV geometry but invalidates on origin, radius and direct opacity edits', () => {
    const g = grid(), fov = new FOVSys(g), cast = vi.spyOn(fov, 'computeFOVMask');
    const first = fov.computeVisionMask(30, 12, 108);
    for (let i = 0; i < 50; i++) expect(fov.computeVisionMask(30, 12, 108)).toBe(first);
    expect(cast).toHaveBeenCalledTimes(1);
    for (const [x, y, radius] of [[31, 12, 108], [31, 12, 5], [31, 13, 5]]) {
        g.getCell(32, 12)!.isOpaque = !g.getCell(32, 12)!.isOpaque;
        expect(fov.computeVisionMask(x!, y!, radius!)).toEqual(
            new FOVSys(g).computeFOVMask(x!, y!, radius!, cell => cell.isOpaque));
    }
    const before = JSON.stringify(g);
    fov.computeVisionMask(31, 13, 5);
    expect(JSON.stringify(g)).toBe(before);
});


it('reads only marked DF destinations and still observes recursive additions in scan order', () => {
    const g = grid(), mask = new Uint8Array(g.width * g.height);
    mask[12 * g.width + 10] = 1;
    const reads = vi.spyOn(g, 'getCell'), built: number[] = [];
    const result = fillSpawnMap(g, DungeonLayer.SURFACE, TerrainType.BLOOD, mask, false, false, pos => {
        built.push(pos.x);
        if (pos.x === 10) mask[12 * g.width + 11] = 1;
    });
    expect(result.accomplishedSomething).toBe(true);
    expect(built).toEqual([10, 11]);
    expect(reads.mock.calls.length).toBeLessThanOrEqual(8);
    expect(g.getCell(11, 12)!.layers[DungeonLayer.SURFACE]).toBe(TerrainType.BLOOD);
});

it('does not expose cached loop rows and observes terrain changes in the same turn', () => {
    const g = grid();
    const first = analyzeLoopMap(g), expected = structuredClone(first);
    first[0]![0] = !first[0]![0];
    expect(analyzeLoopMap(g)).toEqual(expected);
    g.setTerrain(35, 14, TerrainType.WALL);
    g.setTerrain(36, 14, TerrainType.PLAIN_FIRE);
    const fresh = grid();
    fresh.setTerrain(35, 14, TerrainType.WALL);
    fresh.setTerrain(36, 14, TerrainType.PLAIN_FIRE);
    expect(analyzeLoopMap(g)).toEqual(analyzeLoopMap(fresh));
});


it('bounds scoped empty occupancy queries independently of monster count and discards the index', () => {
    let reads = 0;
    const creatures = Array.from({ length: 46 }, (_, x) => ({
        loc: { get x() { reads++; return x; }, y: 4 },
        get x() { return this.loc.x; }, get y() { return this.loc.y; }, hp: 10, deathProcessed: false,
    })) as Monster[];
    withMonsterLookup(creatures, () => {
        const afterBuild = reads;
        for (let i = 0; i < 10000; i++) expect(monsterAt(creatures, 50, 20)).toBeUndefined();
        expect(reads).toBe(afterBuild);
        expect(monsterAt(creatures, 2, 4)).toBe(creatures[2]);
    });
    creatures[2]!.loc = { x: 60, y: 20 };
    expect(monsterAt(creatures, 2, 4)).toBeUndefined();
    expect(monsterAt(creatures, 60, 20)).toBe(creatures[2]);
    expect(() => withMonsterLookup(creatures, () => { throw new Error('scope exit'); })).toThrow('scope exit');
    creatures.length = 0;
    expect(monsterAt(creatures, 60, 20)).toBeUndefined();
});
