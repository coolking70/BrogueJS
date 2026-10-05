import { describe, expect, it } from 'vitest';
import { ShooterSession, replayShooter } from '../../../../products/shooter/ShooterSession';
import { idleInput } from '../../../../products/shooter/input/InputFrame';
import { InputFrameAssembler } from '../../../../products/shooter/input/InputFrameAssembler';
import { getRealtimeModules } from '../../../realtimeCatalog';
import { RealtimeSimulationDriver } from '../../../../engine/Simulation/RealtimeSimulationDriver';
import { MISSION_DATA as d } from '../definitions';
import type { MissionState } from '../state';
import { createScenarioArena } from '../../../../products/shooter/ShooterArena';
import { gridEnvironmentContacts } from '../../../../engine/Movement/KinematicSpatial';
import { worldToCell } from '../../../../engine/Movement/WorldUnits';
function placed(id: string) {
    const snap = new ShooterSession(7, { modules: ['missions'] }).snapshot(), n = [...d.nodes, ...d.pois].find(n => n.id === id)!;
    snap.actors[0]!.pose = { ...n.pose, facing: 0 }; snap.actors[0]!.loc = worldToCell(n.pose);
    snap.actors[0]!.contacts = gridEnvironmentContacts(createScenarioArena(d.scenario), n.pose, 280);
    snap.mission!.nearby = id;
    return ShooterSession.fromSnapshot(snap);
}
function run(s: ShooterSession, count: number) { for (let n = 0; n < count; n++) s.advanceTick(idleInput(s.tick + 1)); }
describe('S4 product authority, persistence and terminal clock', () => {
    it('provides a mission-only product and rejects commands for missing providers before mutating', () => {
        const s = new ShooterSession(7, { modules: ['missions'] }); expect(s.snapshot().actors).toHaveLength(4);
        expect(s.snapshot().mission!.markers).toHaveLength(12); expect(s.snapshot().arena).toBe(d.scenario.id);
        const empty = new ShooterSession(7, { modules: [] }), before = empty.snapshot();
        expect(() => empty.advanceTick(idleInput(1), [{ tick: 1, kind: 'interact' }])).toThrow('mission'); expect(empty.snapshot()).toEqual(before);
    });
    it('restores a running scan and samples through the same recorded command and continuation entry', () => {
        const s = placed('scan-a'); s.advanceTick(idleInput(1), [{ tick: 1, kind: 'interact' }]); run(s, 67);
        const restore = ShooterSession.fromSnapshot(JSON.parse(JSON.stringify(s.snapshot()))); run(s, 20); run(restore, 20);
        expect(restore.snapshot()).toEqual(s.snapshot()); expect(replayShooter(restore.exportReplay()).snapshot()).toEqual(s.snapshot());
        expect((s.snapshot().moduleStates.missions as MissionState).nodes[0]!.progress).toBe(88);
        const poi = placed('sample-a'); poi.advanceTick(idleInput(1), [{ tick: 1, kind: 'interact' }]);
        expect(poi.snapshot().mission!.samples).toBe(3); expect(replayShooter(poi.exportReplay()).snapshot()).toEqual(poi.snapshot());
    });
    it('stops within a catch-up pump at the actual terminal tick, saves results and never generates an extra world tick', () => {
        const s = new ShooterSession(7, { modules: ['missions'] });
        const driver = new RealtimeSimulationDriver({ id: 's4', ticksPerSecond: 30 }, () => s.advanceTick(idleInput(s.tick + 1), [{ tick: s.tick + 1, kind: 'abort' }]), 8, () => s.finished);
        driver.pump(0); expect(driver.pump(1_000_000)).toMatchObject({ paused: true, steps: 1, backlogTicks: 0 }); expect(s.tick).toBe(1);
        expect(ShooterSession.fromSnapshot(s.snapshot()).snapshot()).toEqual(s.snapshot()); expect(replayShooter(s.exportReplay()).snapshot()).toEqual(s.snapshot());
        expect(() => s.advanceTick(idleInput(2))).toThrow('finished');
    });
    it('prevents early nest damage and rejects moved objective identities', () => {
        const ranged = getRealtimeModules().find(d => d.kind === 'ranged');
        const s = new ShooterSession(7, { modules: ranged ? ['missions', ranged.id] : ['missions'] }), snap = s.snapshot(), target = snap.actors[1]!;
        snap.actors[0]!.pose = { x: target.pose.x - 1500, y: target.pose.y, facing: 0 };
        snap.actors[0]!.loc = worldToCell(snap.actors[0]!.pose);
        snap.actors[0]!.contacts = gridEnvironmentContacts(createScenarioArena(d.scenario), snap.actors[0]!.pose, 280);
        snap.mission!.nearby = null;
        const scene = ShooterSession.fromSnapshot(snap);
        scene.advanceTick({ ...idleInput(1), buttons: 1 }); run(scene, 10);
        expect(scene.snapshot().damage.actors[1]!.hp).toBe(900); expect(scene.snapshot().stats.damageDealt).toBe(0);
        if (ranged) expect(scene.snapshot().ranged!.shots).toBe(1);
        const bad = scene.snapshot(); bad.actors[1]!.pose.x += 1024; bad.actors[1]!.loc = worldToCell(bad.actors[1]!.pose);
        expect(() => ShooterSession.fromSnapshot(bad)).toThrow();
    });
    it('starts a paced encounter through an optional population provider and preserves dormant slots', () => {
        const population = getRealtimeModules().find(d => d.kind === 'population');
        const ids = population ? ['missions', population.id] : ['missions'];
        const s = new ShooterSession(7, { modules: ids }), initial = s.snapshot();
        if (population) expect(initial.population).toMatchObject({ swarm: 32, elites: 2, bosses: 0, spawned: 34 });
        else expect(initial.population).toBeNull();
        run(s, 60); const saved = s.snapshot();
        expect(ShooterSession.fromSnapshot(saved).snapshot()).toEqual(saved);
        expect(replayShooter(s.exportReplay()).snapshot()).toEqual(saved);
    });
    it('records all three device interaction commands once and clears them on blur', () => {
        const a = new InputFrameAssembler(); a.requestInteract(); expect(a.nextCommands(1)).toEqual([{ tick: 1, kind: 'interact' }]);
        expect(a.nextCommands(2)).toEqual([]); a.requestAbort(); a.clear(); expect(a.nextCommands(3)).toEqual([]);
    });
    it('rejects missing missions, foreign scenario, forged mirrors and S3 formats while preserving the active run', () => {
        const s = placed('scan-a'); s.advanceTick(idleInput(1), [{ tick: 1, kind: 'interact' }]); const good = s.snapshot();
        for (const change of [(v: any) => v.mission.samples++, (v: any) => v.moduleStates.missions.nodes[1].progress = 1,
            (v: any) => v.arena = 's3-horde-lab-v1', (v: any) => v.format = 'broguejs-shooter-s3', (v: any) => v.version = 4]) {
            const bad = structuredClone(good); change(bad); expect(() => ShooterSession.fromSnapshot(bad)).toThrow();
        }
        expect(() => ShooterSession.fromSnapshot(good, getRealtimeModules().filter(d => d.id !== 'missions'))).toThrow('Missing');
        expect(s.snapshot()).toEqual(good);
    });
});
