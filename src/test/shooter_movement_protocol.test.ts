import { describe, expect, it } from 'vitest';
import { ShooterSession, replayShooter } from '../products/shooter/ShooterSession';
import { idleInput } from '../products/shooter/input/InputFrame';
import { InputFrameAssembler } from '../products/shooter/input/InputFrameAssembler';
import { KeyboardMovement, gamepadMovement, touchMovement, normalizeStick } from '../products/shooter/input/MovementAdapters';
import { createShooterArena } from '../products/shooter/ShooterArena';
import { gridEnvironmentContacts } from '../engine/Movement/KinematicSpatial';
import { worldToCell } from '../engine/Movement/WorldUnits';

const directions = [['KeyD'], ['KeyD', 'KeyS'], ['KeyS'], ['KeyA'], ['KeyW', 'KeyA'], ['KeyW'], []];
const vectors = [[1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1], [-1, 0], [-Math.SQRT1_2, -Math.SQRT1_2], [0, -1], [0, 0]];
function frame(tick: number) { const v = vectors[Math.floor(tick / 31) % vectors.length]!;
    const p = normalizeStick(v[0]!, v[1]!); return { ...idleInput(tick), moveX: p.x, moveY: p.y }; }
function relocate(session: ShooterSession, x: number, y: number) {
    const snapshot = session.snapshot(), a = snapshot.actors[0]!; a.pose.x = x; a.pose.y = y;
    a.loc = worldToCell(a.pose); a.contacts = gridEnvironmentContacts(createShooterArena(), a.pose, a.radius);
    return ShooterSession.fromSnapshot(snapshot);
}
describe('S1 device adapters and input lifetime', () => {
    it('produces the same InputFrames and complete mechanical trajectory from keyboard, standard pad and touch', () => {
        const sessions = [new ShooterSession(314, { modules: [] }), new ShooterSession(314, { modules: [] }), new ShooterSession(314, { modules: [] })];
        const assemblers = sessions.map(() => new InputFrameAssembler()), keyboard = new KeyboardMovement();
        for (let tick = 1; tick <= 1500; tick++) {
            const segment = Math.floor(tick / 31) % directions.length, vector = vectors[segment]!;
            keyboard.clear(); for (const key of directions[segment]!) keyboard.key(key, true);
            const samples = [keyboard.sample(), gamepadMovement({ connected: true, mapping: 'standard', axes: vector }),
                touchMovement(vector[0]! * 40, vector[1]! * 40, 40)];
            const frames = samples.map((sample, i) => { assemblers[i]!.setMovement(sample.x, sample.y); return assemblers[i]!.next(tick); });
            expect(frames[0]).toEqual(frames[1]); expect(frames[1]).toEqual(frames[2]);
            sessions.forEach((session, i) => session.advanceTick(frames[i]!));
            expect(sessions[0]!.snapshot().actors).toEqual(sessions[1]!.snapshot().actors);
            expect(sessions[1]!.snapshot().actors).toEqual(sessions[2]!.snapshot().actors);
        }
        expect(sessions[0]!.snapshot()).toEqual(sessions[2]!.snapshot());
    });
    it('handles deadzone, disconnected/unmapped pads, non-finite samples and opposing keys', () => {
        expect(normalizeStick(.05, -.05)).toEqual({ x: 0, y: 0 }); expect(normalizeStick(NaN, 1)).toEqual({ x: 0, y: 0 });
        expect(normalizeStick(.6, 0).x).toBeGreaterThan(0); expect(normalizeStick(.6, 0).x).toBeLessThan(127);
        expect(gamepadMovement({ connected: false, mapping: 'standard', axes: [1, 1] })).toEqual({ x: 0, y: 0 });
        expect(gamepadMovement({ connected: true, mapping: '', axes: [1, 1] })).toEqual({ x: 0, y: 0 });
        const keyboard = new KeyboardMovement(); keyboard.key('KeyA', true); keyboard.key('KeyD', true);
        expect(keyboard.sample()).toEqual({ x: 0, y: 0 }); keyboard.key('KeyD', false); expect(keyboard.sample().x).toBe(-127);
        keyboard.clear(); expect(keyboard.sample()).toEqual({ x: 0, y: 0 });
    });
    it('holds movement across ticks while consuming a pulse once; clear removes both', () => {
        const a = new InputFrameAssembler(); a.setMovement(80, -20); a.requestFireTap();
        expect(a.next(1)).toMatchObject({ moveX: 80, moveY: -20, buttons: 1 });
        expect(a.next(2)).toMatchObject({ moveX: 80, moveY: -20, buttons: 0 });
        a.clear(); expect(a.next(3)).toEqual(idleInput(3));
        for (const x of [128, -.5, Infinity]) expect(() => a.setMovement(x, 0)).toThrow();
    });
});
describe('S1 exact position persistence and objective terrain clock', () => {
    it.each([1, 18, 47, 79, 113, 199])('saves fractional velocity, contacts, actions and exact position at tick %i', at => {
        const a = new ShooterSession(518, { modules: [] });
        while (a.tick < at) a.advanceTick(frame(a.tick + 1));
        const snapshot = JSON.parse(JSON.stringify(a.snapshot())), b = ShooterSession.fromSnapshot(snapshot);
        expect(b.snapshot()).toEqual(snapshot);
        while (a.tick < 420) { a.advanceTick(frame(a.tick + 1)); b.advanceTick(frame(b.tick + 1)); }
        expect(b.snapshot()).toEqual(a.snapshot());
        expect(replayShooter(JSON.parse(JSON.stringify(b.exportReplay()))).snapshot()).toEqual(a.snapshot());
    });
    it('rejects old S0, invalid position mirrors, penetration, map revision and forged contacts', () => {
        const session = new ShooterSession(7301, { modules: [] }); session.advanceTick(frame(1)); const before = session.snapshot();
        for (const mutate of [
            (s: any) => { s.format = 'broguejs-shooter-s0'; s.version = 1; },
            (s: any) => { s.arena = 'foreign'; }, (s: any) => { s.actors[0].loc.x++; },
            (s: any) => { s.actors[0].pose.x += .1; }, (s: any) => { s.actors[0].radius = 0; },
            (s: any) => { s.actors[0].motionCredit.x = 65536; }, (s: any) => { s.actors[0].contacts = []; },
            (s: any) => { s.actors[0].contactTicks.fire = 100; },
            (s: any) => { const a = s.actors[0]; a.pose.x = 12800; a.pose.y = 3584; a.loc = worldToCell(a.pose); },
        ]) { const bad = structuredClone(before); mutate(bad); expect(() => ShooterSession.fromSnapshot(bad)).toThrow(); }
        expect(session.snapshot()).toEqual(before);
    });
    it('rejects moved input or position/credit corruption in a recorded run', () => {
        const session = new ShooterSession(7301, { modules: [] }); for (let tick = 1; tick <= 100; tick++) session.advanceTick(frame(tick));
        for (const mutate of [
            (r: any) => { r.frames[0].moveX = -127; },
            (r: any) => { r.final.actors[0].pose.x++; },
            (r: any) => { r.final.actors[0].motionCredit.x++; },
        ]) { const r = session.exportReplay(); mutate(r); expect(() => replayShooter(r)).toThrow(); }
    });
    it('applies water slowdown once and measures standing fire/gas per tick, independent of overlapping cell count', () => {
        const base = new ShooterSession(7301, { modules: [] }), water = relocate(base, 8192, 11264), dry = relocate(base, 16384, 15360);
        water.advanceTick({ ...idleInput(1), moveX: 127 }); dry.advanceTick({ ...idleInput(1), moveX: 127 });
        expect(water.snapshot().actors[0]!.pose.x - 8192).toBe(80);
        expect(dry.snapshot().actors[0]!.pose.x - 16384).toBe(160);
        const fire = relocate(base, 17408, 11264), gas = relocate(base, 8192, 18432);
        for (let tick = 1; tick <= 90; tick++) { fire.advanceTick(idleInput(tick)); gas.advanceTick(idleInput(tick)); }
        expect(fire.snapshot().actors[0]!.contactTicks.fire).toBe(90);
        expect(gas.snapshot().actors[0]!.contactTicks.gas).toBe(90);
        expect(fire.snapshot().actors[0]!.contacts.filter(c => c.fire).length).toBeGreaterThan(1);
        expect(replayShooter(fire.exportReplay()).snapshot()).toEqual(fire.snapshot());
    });
});
