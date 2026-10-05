import { describe, expect, it, vi } from 'vitest';
import { DamageResolutionAuthority, mayDamage, type DamageIntent } from '../engine/Combat/DamageResolution';
import { angleVector } from '../engine/Movement/QuantizedAngle';
import { raycast } from '../engine/Movement/SpatialQuery';
import { SpatialHash } from '../engine/Movement/SpatialHash';
import { Grid, TerrainType } from '../engine/Map/Grid';
import { gamepadAim, gamepadButton, mouseAim, stickAim, touchAim } from '../products/shooter/input/AimAdapters';
import { InputFrameAssembler } from '../products/shooter/input/InputFrameAssembler';

const health = () => new DamageResolutionAuthority({ schema: 1, nextResolutionId: 1, actors: [
    { id: 1, team: 0, hp: 100, maxHp: 100, revision: 0 }, { id: 2, team: 1, hp: 70, maxHp: 70, revision: 0 },
] });
const intent: DamageIntent = { sourceId: 1, targetId: 2, amount: 32, kind: 'kinetic', friendlyFire: 'none' };
describe('Shared authoritative damage', () => {
    it('prepares without mutation and commits a single authenticated bounded HP write', () => {
        const a = health(), before = a.snapshot(), plan = a.prepareDamageResolution(intent)!;
        expect(a.snapshot()).toEqual(before); expect(Object.isFrozen(plan.intent)).toBe(true);
        expect(a.commitDamageResolution(plan)).toMatchObject({ applied: 32, killed: false, resolutionId: 1 });
        expect(a.read(2)!.hp).toBe(38); expect(() => a.commitDamageResolution(plan)).toThrow();
        expect(() => health().commitDamageResolution(plan)).toThrow();
        expect(a.commitDamageResolution(a.prepareDamageResolution({ ...intent, amount: 100 })!)!.applied).toBe(38);
        expect(a.read(2)!.hp).toBe(0); expect(a.prepareDamageResolution(intent)).toBeNull();
    });
    it('rejects stale plans after another hit or a respawn and detaches all reads', () => {
        const a = health(), p = a.prepareDamageResolution(intent)!;
        a.commitDamageResolution(a.prepareDamageResolution(intent)!); expect(a.commitDamageResolution(p)).toBeNull();
        const q = a.prepareDamageResolution(intent)!; a.restoreHealth(2); expect(a.commitDamageResolution(q)).toBeNull();
        const copy = a.snapshot(); copy.actors[1]!.hp = 0; expect(a.read(2)!.hp).toBe(70);
    });
    it('opens five explicit damage kinds and distinguishes no/team/all friendly fire', () => {
        for (const kind of ['kinetic', 'explosive', 'fire', 'electric', 'toxic'] as const) expect(health().prepareDamageResolution({ ...intent, kind })).not.toBeNull();
        const source = { id: 1, team: 0 }, friend = { id: 3, team: 0 }, foe = { id: 2, team: 1 };
        expect(['none', 'team', 'all'].map(p => [mayDamage(source, source, p as any), mayDamage(source, friend, p as any), mayDamage(source, foe, p as any)]))
            .toEqual([[false, false, true], [false, true, true], [true, true, true]]);
    });
    it('rejects malformed and accessor intents before mutation or getter execution', () => {
        const a = health(), before = a.snapshot(), getter = vi.fn(() => 32), accessor = { ...intent };
        Object.defineProperty(accessor, 'amount', { get: getter, enumerable: true });
        for (const bad of [accessor, { ...intent, amount: -1 }, { ...intent, amount: Infinity }, { ...intent, kind: 'magic' }, { ...intent, extra: 1 }]) expect(() => a.prepareDamageResolution(bad)).toThrow();
        expect(getter).not.toHaveBeenCalled(); expect(a.snapshot()).toEqual(before);
    });
});
describe('Quantized aiming and long spatial traces', () => {
    it('records identical mouse, standard gamepad and touch aim/trigger trajectories', () => {
        for (let angle = 0; angle < 4096; angle += 128) {
            const x = Math.cos(angle / 4096 * Math.PI * 2), y = Math.sin(angle / 4096 * Math.PI * 2);
            const pad = { connected: true, mapping: 'standard', axes: [0, 0, x, y], buttons: Array.from({ length: 8 }, (_, i) => ({ pressed: i === 7, value: i === 7 ? 1 : 0 })) };
            const values = [mouseAim(x * 400, y * 400), gamepadAim(pad), touchAim(x * 40, y * 40, 40)]; expect(values).toEqual([angle, angle, angle]);
            const frames = values.map(v => { const a = new InputFrameAssembler(); a.setAim(v!); a.setFire(true); return a.next(1); });
            expect(frames[0]).toEqual(frames[1]); expect(frames[1]).toEqual(frames[2]); expect(gamepadButton(pad, 7)).toBe(true);
        }
        expect(stickAim(.04, -.05)).toBeNull(); expect(mouseAim(NaN, 2)).toBeNull();
        expect(gamepadAim({ connected: false, mapping: 'standard', axes: [0, 0, 1, 1], buttons: [] })).toBeNull();
    });
    it('uses integer cardinal vectors and bounded, symmetric quantized directions', () => {
        expect([0, 1024, 2048, 3072].map(a => angleVector(a, 1000))).toEqual([{ x: 1000, y: 0 }, { x: 0, y: 1000 }, { x: -1000, y: 0 }, { x: 0, y: -1000 }]);
        for (let a = 0; a < 2048; a += 13) { const p = angleVector(a, 20000), opposite = angleVector(a + 2048, 20000);
            expect(p.x + opposite.x).toBe(0); expect(p.y + opposite.y).toBe(0); expect(Math.abs(Math.hypot(p.x, p.y) - 20000)).toBeLessThan(2); }
    });
    it('hits beyond 4096 WU, stops at embedded origins, and never shoots through nearer terrain', () => {
        const grid = new Grid(40, 10), bodies = new SpatialHash();
        for (let y = 0; y < 10; y++) for (let x = 0; x < 40; x++) grid.setTerrain(x, y, TerrainType.FLOOR);
        bodies.upsert({ id: 2, pose: { x: 16000, y: 5000, facing: 0 }, radius: 280 });
        expect(raycast({ grid, bodies }, { x: 3000, y: 5000 }, { x: 20000, y: 0 })?.bodyId).toBe(2);
        grid.setTerrain(10, 4, TerrainType.WALL);
        expect(raycast({ grid, bodies }, { x: 3000, y: 5000 }, { x: 20000, y: 0 })?.tile).toEqual({ x: 10, y: 4 });
        expect(raycast({ grid, bodies }, { x: 10500, y: 5000 }, { x: 20000, y: 0 })?.time).toBe(0);
        expect(raycast({ grid, bodies }, { x: 16000, y: 5000 }, { x: 10, y: 0 })?.time).toBe(0);
        expect(() => raycast({ grid }, { x: 3000, y: 5000 }, { x: 65537, y: 0 })).toThrow();
    });
    it('retains ordered discrete commands separately from InputFrames and clears once', () => {
        const a = new InputFrameAssembler(); a.requestEquip(2); a.requestReload();
        expect(Object.keys(a.next(1)).sort()).toEqual(['aimAngle', 'buttons', 'moveX', 'moveY', 'tick']);
        expect(a.nextCommands(1)).toEqual([{ tick: 1, kind: 'equip', slot: 2 }, { tick: 1, kind: 'reload' }]); expect(a.nextCommands(2)).toEqual([]);
    });
});
