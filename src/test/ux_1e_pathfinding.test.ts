import { describe, expect, it } from 'vitest';
import { Pathfind } from '../engine/Map/Pathfind';
import { PathFrontier } from '../engine/Map/PathFrontier';
import { LegacyPathfind } from './support/legacyPathfind';
import type { Grid } from '../engine/Map/Grid';
import type { Pos } from '../types';
import { rng } from '../engine/Random';

type Finder = Pick<typeof Pathfind, 'findPath'>;
interface Scene { width: number; height: number; blocked: Set<number>; start: Pos; goal: Pos; dynamic?: boolean; restrictDiagonals?: boolean }
function observe(finder: Finder, scene: Scene) {
    const trace: string[] = [];
    let passCalls = 0, stepCalls = 0;
    const visits = new Map<number, number>();
    const grid = { isValidPos(x: number, y: number) {
        const result = x >= 0 && y >= 0 && x < scene.width && y < scene.height;
        trace.push(`valid:${x},${y}:${result}`); return result;
    } } as Grid;
    const canPass = (x: number, y: number) => {
        const key = y * scene.width + x, n = (visits.get(key) ?? 0) + 1;
        visits.set(key, n); passCalls++;
        let result = !scene.blocked.has(key);
        // Callback state changes with invocation order, not game RNG. The goal's
        // first check remains possible; later visits may open or close a tile.
        if (scene.dynamic && passCalls > 1 && (passCalls % 11 === 0 || n % 4 === 0)) result = !result;
        trace.push(`pass:${x},${y}:${result}`); return result;
    };
    const canStep = (from: Pos, to: Pos) => {
        stepCalls++;
        const result = (!scene.restrictDiagonals || from.x === to.x || from.y === to.y)
            && (!scene.dynamic || stepCalls % 13 !== 0);
        // Also guard against exposing heap metadata through public callbacks.
        trace.push(`step:${from.x},${from.y}>${to.x},${to.y}:${Object.keys(from).join(',')}:${result}`);
        return result;
    };
    const path = finder.findPath(grid, scene.start.x, scene.start.y, scene.goal.x, scene.goal.y, canPass,
        scene.restrictDiagonals || scene.dynamic ? canStep : undefined);
    return { path, trace, passCalls, stepCalls };
}
function compare(scene: Scene, label: string) {
    expect(observe(Pathfind, scene), label).toEqual(observe(LegacyPathfind, scene));
}
function generator(seed: number) {
    let value = seed >>> 0;
    return () => (value = (Math.imul(value, 1664525) + 1013904223) >>> 0);
}

describe('UX-1E stable A* frontier', () => {
    it('retains insertion order on equal f after decrease-key, and resets it on reopening', () => {
        const frontier = new PathFrontier();
        const a = { x: 1, y: 1 }, b = { x: 2, y: 1 }, c = { x: 3, y: 1 };
        frontier.improve('a', a, 5); frontier.improve('b', b, 5); frontier.improve('c', c, 3);
        frontier.improve('b', { ...b }, 3);
        expect(frontier.pop()).toBe(b); // Earlier b must beat later c at the new tie.
        frontier.improve('a', { ...a }, 3);
        expect(frontier.pop()).toBe(a); // Still retains a's original object/order.
        frontier.improve('b', b, 3);
        expect(frontier.pop()).toBe(c); // Reopened b is now later than c.
        expect(frontier.pop()).toBe(b); expect(frontier.length).toBe(0);
    });

    it('matches an independent ordered array through 4000 mixed insert/decrease/pop operations', () => {
        const random = generator(9283), frontier = new PathFrontier();
        const oracle: Array<{ key: string; pos: Pos; f: number }> = [];
        const pop = () => {
            let best = 0;
            for (let i = 1; i < oracle.length; i++) if (oracle[i]!.f < oracle[best]!.f) best = i;
            expect(frontier.pop()).toBe(oracle.splice(best, 1)[0]!.pos);
        };
        for (let turn = 0; turn < 4000; turn++) {
            if (oracle.length && random() % 3 === 0) pop();
            else {
                const key = String(random() % 64), entry = oracle.find(entry => entry.key === key);
                const pos = { x: Number(key), y: 0 }, f = entry ? entry.f - random() % 3 : random() % 20;
                if (entry) entry.f = f; else oracle.push({ key, pos, f });
                frontier.improve(key, pos, f);
            }
            expect(frontier.length).toBe(oracle.length);
        }
        while (oracle.length) pop();
    });
});

describe('UX-1E independent legacy path and callback oracle', () => {
    it('matches all 512 obstacle masks on a 3×3 grid in both travel directions, with and without diagonals', () => {
        const randomState = rng.getState();
        for (let mask = 0; mask < 512; mask++) {
            const blocked = new Set<number>();
            for (let bit = 0; bit < 9; bit++) if (mask & (1 << bit)) blocked.add(bit);
            for (const reverse of [false, true]) for (const restrictDiagonals of [false, true]) {
                compare({ width: 3, height: 3, blocked, start: reverse ? { x: 2, y: 2 } : { x: 0, y: 0 },
                    goal: reverse ? { x: 0, y: 0 } : { x: 2, y: 2 }, restrictDiagonals }, `mask=${mask} reverse=${reverse} cardinal=${restrictDiagonals}`);
            }
        }
        expect(rng.getState()).toEqual(randomState);
    });

    it('matches 600 varied small grids and 600 callback-stateful variants, including unreachable goals', () => {
        const randomState = rng.getState();
        for (let seed = 1; seed <= 600; seed++) {
            const random = generator(seed), width = 4 + random() % 12, height = 4 + random() % 10;
            const blocked = new Set<number>();
            for (let cell = 0; cell < width * height; cell++) if (random() % 100 < 30) blocked.add(cell);
            const start = { x: random() % width, y: random() % height }, goal = { x: random() % width, y: random() % height };
            blocked.delete(goal.y * width + goal.x);
            for (const dynamic of [false, true]) compare({ width, height, start, goal, blocked, dynamic,
                restrictDiagonals: seed % 3 === 0 }, `seed=${seed} dynamic=${dynamic}`);
        }
        expect(rng.getState()).toEqual(randomState);
    });

    it('preserves identical-start, blocked-goal, out-of-bounds and public callback exceptions', () => {
        for (const goal of [{ x: 1, y: 1 }, { x: -1, y: 1 }, { x: 4, y: 4 }, { x: 2, y: 2 }]) {
            compare({ width: 4, height: 4, start: { x: 1, y: 1 }, goal, blocked: new Set([10]) }, JSON.stringify(goal));
        }
        const grid = { isValidPos: () => true } as unknown as Grid;
        for (const finder of [LegacyPathfind, Pathfind]) {
            const error = new Error('callback fixture');
            expect(() => finder.findPath(grid, 0, 0, 1, 1, () => { throw error; })).toThrow(error);
            expect(() => finder.findPath(grid, 0, 0, 1, 1, () => true, () => { throw error; })).toThrow(error);
        }
    });
});
