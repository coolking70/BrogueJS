import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ShooterSession, replayShooter, type ShooterReplay } from '../../../../products/shooter/ShooterSession';
import { idleInput } from '../../../../products/shooter/input/InputFrame';
import { mouseAim } from '../../../../products/shooter/input/AimAdapters';
import { SimulationHost } from '../../../../engine/Simulation/SimulationHost';
import { RealtimeSimulationDriver } from '../../../../engine/Simulation/RealtimeSimulationDriver';
import { getRealtimeModules } from '../../../realtimeCatalog';
import type { WeaponCommand } from '../../../../engine/Simulation/RangedRuntime';
import { rng } from '../../../../engine/Random';
import { createShooterArena } from '../../../../products/shooter/ShooterArena';
import { gridEnvironmentContacts } from '../../../../engine/Movement/KinematicSpatial';
import { worldToCell } from '../../../../engine/Movement/WorldUnits';

function controls(s: ShooterSession) {
    const tick = s.tick + 1, snapshot = s.snapshot(), player = snapshot.actors[0]!, slot = Math.floor((tick - 1) / 300) % 4;
    const target = snapshot.actors.slice(1).filter(a => snapshot.damage.actors[a.id - 1]!.hp > 0).sort((a, b) =>
        ((a.pose.x - player.pose.x) ** 2 + (a.pose.y - player.pose.y) ** 2) - ((b.pose.x - player.pose.x) ** 2 + (b.pose.y - player.pose.y) ** 2))[0];
    const aim = target ? mouseAim(target.pose.x - player.pose.x, target.pose.y - player.pose.y) ?? 0 : 0;
    const v = [[127, 0], [0, 127], [-127, 0], [0, -127]][Math.floor((tick - 1) % 480 / 120)]!;
    const frame = { ...idleInput(tick), moveX: v[0]!, moveY: v[1]!, aimAngle: aim, buttons: slot === 1 || tick % 12 !== 0 ? 1 : 0 };
    const commands: WeaponCommand[] = [];
    if ((tick - 1) % 300 === 0) commands.push({ tick, kind: 'equip', slot });
    if (snapshot.ranged!.weapons[slot]!.ammo === 0 && !snapshot.ranged!.reloadRemaining) commands.push({ tick, kind: 'reload' });
    return { frame, commands };
}
function run(s: ShooterSession, until: number) { while (s.tick < until) { const c = controls(s); s.advanceTick(c.frame, c.commands); } }

describe('S2 real Shooter gunplay persistence', () => {
    it.each([1, 7, 25, 87, 125, 306, 393, 613, 907, 916])('roundtrips full world and weapon continuation from tick %i', at => {
        const a = new ShooterSession(919, { modules: ['firearms'] }); run(a, at);
        const checkpoint = JSON.parse(JSON.stringify(a.snapshot())), b = ShooterSession.fromSnapshot(checkpoint);
        expect(b.snapshot()).toEqual(checkpoint); run(a, at + 120); run(b, at + 120);
        expect(b.snapshot()).toEqual(a.snapshot()); expect(replayShooter(b.exportReplay()).snapshot()).toEqual(a.snapshot());
    });
    it('keeps reload movement active and saves a grenade in flight', () => {
        const s = new ShooterSession(7301, { modules: ['firearms'] }); s.advanceTick({ ...idleInput(1), buttons: 1 });
        for (let tick = 2; tick <= 9; tick++) s.advanceTick(idleInput(tick));
        const before = s.snapshot().actors[0]!.pose;
        s.advanceTick({ ...idleInput(10), moveY: 127 }, [{ tick: 10, kind: 'reload' }]);
        expect(s.snapshot().actors[0]!.pose.y).toBeGreaterThan(before.y); expect(s.snapshot().ranged!.reloadRemaining).toBe(35);
        s.advanceTick({ ...idleInput(11), buttons: 1 }, [{ tick: 11, kind: 'equip', slot: 3 }]);
        expect(s.snapshot().ranged!.projectiles).toHaveLength(1);
        const b = ShooterSession.fromSnapshot(s.snapshot());
        for (let tick = 12; tick <= 70; tick++) { s.advanceTick(idleInput(tick)); b.advanceTick(idleInput(tick)); }
        expect(b.snapshot()).toEqual(s.snapshot());
    });
    it('respawns at a deterministic free fallback when a frozen enemy occupies the player spawn', () => {
        const snapshot = new ShooterSession(7301, { modules: ['firearms'] }).snapshot(), enemy = snapshot.actors[1]!;
        snapshot.damage.actors[0]!.hp = 0; snapshot.damage.actors[0]!.revision = 1;
        snapshot.actors[0]!.respawnTick = 90; snapshot.stats.deaths = 1;
        enemy.pose = { ...snapshot.actors[0]!.pose }; enemy.loc = worldToCell(enemy.pose);
        enemy.contacts = gridEnvironmentContacts(createShooterArena(), enemy.pose, enemy.radius);
        const s = ShooterSession.fromSnapshot(snapshot);
        for (let tick = 1; tick <= 89; tick++) s.advanceTick(idleInput(tick));
        expect(s.snapshot().damage.actors[0]!.hp).toBe(0); s.advanceTick(idleInput(90));
        expect(s.snapshot().damage.actors[0]!.hp).toBe(100); expect(s.snapshot().actors[0]!.pose).not.toEqual(snapshot.actors[0]!.pose);
        expect(replayShooter(s.exportReplay()).snapshot()).toEqual(s.snapshot());
    });
    it('rejects missing/version-changed rules, incompatible S1 saves and tampered command streams', () => {
        const s = new ShooterSession(7301, { modules: ['firearms'] }); run(s, 400); const before = s.snapshot();
        expect(() => ShooterSession.fromSnapshot(before, [])).toThrow('Missing');
        for (const mutate of [(v: any) => v.version = 2, (v: any) => v.modules[0].rules.fingerprint = 'foreign',
            (v: any) => v.modules[0].version = '99.0.0', (v: any) => v.ranged.shots++, (v: any) => v.moduleStates.unknown = {}]) {
            const bad = structuredClone(before); mutate(bad); expect(() => ShooterSession.fromSnapshot(bad)).toThrow();
        }
        for (const mutate of [(r: any) => r.commands = [], (r: any) => r.commands[0].slot = 3,
            (r: any) => r.commands[1].tick = -1, (r: any) => r.frames[0].aimAngle = 2048, (r: any) => r.final.stats.kills++]) {
            const bad = s.exportReplay(); mutate(bad); expect(() => replayShooter(bad), mutate.toString()).toThrow();
        }
        expect(s.snapshot()).toEqual(before);
    });
    it('rejects malformed commands before mutation and supports the empty runtime subset', () => {
        const s = new ShooterSession(7301, { modules: ['firearms'] }), before = s.snapshot();
        for (const commands of [[{ tick: 2, kind: 'reload' }], [{ tick: 1, kind: 'equip', slot: 99 }], [{ tick: 1, kind: 'reload', extra: true }]])
            expect(() => s.advanceTick(idleInput(1), commands as WeaponCommand[])).toThrow();
        expect(s.snapshot()).toEqual(before);
        const empty = new ShooterSession(1, { modules: [] }); empty.advanceTick({ ...idleInput(1), moveX: 127 });
        expect(empty.snapshot().ranged).toBeNull(); expect(replayShooter(empty.exportReplay(), []).snapshot()).toEqual(empty.snapshot());
        expect(getRealtimeModules().map(d => d.id)).toContain('firearms');
    });
});

describe('S2 five-minute combat / rendering independence', () => {
    let replay: ShooterReplay;
    beforeAll(() => { const s = new ShooterSession(123, { modules: ['firearms'] }); run(s, 9000); replay = s.exportReplay(); });
    it.each([30, 60, 144])('matches every state at %i render FPS including command timing and projectiles', fps => {
        const s = ShooterSession.fromSnapshot(replay.initial); let cursor = 0;
        const host = new SimulationHost({ get tick() { return s.tick; }, snapshot: () => s.snapshot(), advanceTick: (frame: typeof replay.frames[number]) => {
            const batch: WeaponCommand[] = []; while (replay.commands[cursor]?.tick === frame.tick) batch.push(replay.commands[cursor++]!); s.advanceTick(frame, batch);
        } });
        const driver = new RealtimeSimulationDriver({ id: 'test', ticksPerSecond: 30 }, () => host.step(replay.frames[host.tick]!));
        driver.pump(0); let peak = 0;
        for (let f = 1; f <= 300 * fps; f++) peak = Math.max(peak, driver.pump(Math.round(f * 1e6 / fps)).backlogTicks);
        expect(s.snapshot()).toEqual(replay.final); expect(peak).toBe(0);
        expect(replay.final.ranged!.shots).toBeGreaterThan(400); expect(replay.final.stats.kills).toBeGreaterThan(10);
        const states = replay.final.moduleStates.firearms as any; expect(states.weapons.every((w: any) => w.shotSequence > 0)).toBe(true);
    });
    it('replays independently of global RNG, wall clocks, and a second interleaved room', () => {
        const before = rng.getState(), a = new ShooterSession(123, { modules: ['firearms'] }), b = new ShooterSession(5, { modules: ['firearms'] });
        const date = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Wall clock'); });
        const perf = vi.spyOn(performance, 'now').mockImplementation(() => { throw new Error('Performance clock'); });
        try {
            let cursor = 0;
            for (const frame of replay.frames) {
                const batch: WeaponCommand[] = []; while (replay.commands[cursor]?.tick === frame.tick) batch.push(replay.commands[cursor++]!);
                a.advanceTick(frame, batch); b.advanceTick(idleInput(frame.tick));
            }
            expect(a.snapshot()).toEqual(replay.final); expect(rng.getState()).toEqual(before);
            expect(replayShooter(JSON.parse(JSON.stringify(replay))).snapshot()).toEqual(replay.final);
        } finally { date.mockRestore(); perf.mockRestore(); }
    });
});
