import { describe, expect, it } from 'vitest';
import { canonicalState, replayShooter, ShooterSession } from '../products/shooter/ShooterSession';
import { idleInput } from '../products/shooter/input/InputFrame';

function run(session: ShooterSession, to: number) {
    while (session.tick < to) {
        const tick = session.tick + 1;
        session.advanceTick({ ...idleInput(tick), moveX: tick % 47 === 1 ? 20 : 0, buttons: tick % 47 === 1 ? 1 : 0 });
    }
}
describe('S0 checkpoint and replay protocol', () => {
    it('replays ten minutes through the same tick entry and compares full action and RNG state', () => {
        const session = new ShooterSession(555, { modules: [] }); run(session, 18_000);
        const json = JSON.parse(JSON.stringify(session.exportReplay()));
        expect(replayShooter(json).snapshot()).toEqual(session.snapshot());
        expect(json.frames).toHaveLength(18_000);
    });
    it.each([1, 6, 8, 9, 12, 27, 29, 30, 60, 61])('resumes exact phases from tick %i and records a checkpoint-origin replay', tick => {
        const session = new ShooterSession(19, { modules: [] }); run(session, tick);
        const snapshot = JSON.parse(JSON.stringify(session.snapshot()));
        const restored = ShooterSession.fromSnapshot(snapshot);
        expect(restored.snapshot()).toEqual(snapshot);
        run(session, 137); run(restored, 137);
        expect(restored.snapshot()).toEqual(session.snapshot());
        const continuation = restored.exportReplay();
        expect(continuation.initial.tick).toBe(tick);
        expect(continuation.frames).toHaveLength(137 - tick);
        expect(replayShooter(continuation).snapshot()).toEqual(session.snapshot());
    });
    it('rejects foreign formats, incompatible profiles and corrupt mirrors before replacing a live session', () => {
        const session = new ShooterSession(7301, { modules: [] }); run(session, 3);
        const before = session.snapshot();
        const mutations = [
            (s: any) => { s.format = 'brogue-turn'; }, (s: any) => { s.version = 99; },
            (s: any) => { s.simulation = 'brogue-turn'; }, (s: any) => { s.ticksPerSecond = 60; },
            (s: any) => { s.modules = ['growth']; }, (s: any) => { s.seed = 0; },
            (s: any) => { s.actors[0].attackReadyTick = 999; }, (s: any) => { s.damage.actors[0].hp = 101; },
            (s: any) => { s.damage.actors[0].revision = -1; }, (s: any) => { s.actors[0].respawnTick = 99; },
        ];
        for (const mutate of mutations) {
            const bad = structuredClone(before); mutate(bad);
            expect(() => ShooterSession.fromSnapshot(bad)).toThrow();
            expect(session.snapshot()).toEqual(before);
        }
        expect(() => ShooterSession.fromSnapshot({ version: 2, extensions: {} })).toThrow();
    });
    it('detects truncated, reordered, modified inputs and final-state corruption', () => {
        const session = new ShooterSession(7301, { modules: [] }); run(session, 131);
        const good = session.exportReplay();
        for (const mutate of [
            (r: any) => r.frames.pop(),
            (r: any) => { r.frames[0].moveX = 0; },
            (r: any) => { [r.frames[0], r.frames[1]] = [r.frames[1], r.frames[0]]; },
            (r: any) => { r.final.damage.actors[0].revision++; },
            (r: any) => { r.final.actors[0].lastHitTick++; },
        ]) {
            const bad = structuredClone(good); mutate(bad);
            expect(() => replayShooter(bad)).toThrow();
        }
        expect(session.exportReplay()).toEqual(good);
    });
    it('compares JSON independent of property order and does not leak mutable snapshot/history references', () => {
        const session = new ShooterSession(7301, { modules: [] }); run(session, 7);
        const replay = session.exportReplay(), expected = canonicalState(session.snapshot());
        replay.final = Object.fromEntries(Object.entries(replay.final).reverse()) as typeof replay.final;
        expect(canonicalState(replayShooter(replay).snapshot())).toBe(expected);
        replay.frames[0] = idleInput(1); replay.initial.actors[0]!.lastHitTick = 999;
        const copy = session.snapshot(); copy.actors[0]!.lastHitTick = 999;
        expect(canonicalState(session.snapshot())).toBe(expected);
        expect(session.exportReplay().frames[0]!.buttons).toBe(1);
    });
});
