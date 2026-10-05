import { describe, expect, it, vi } from 'vitest';
import { ShooterSession, replayShooter, type ShooterSnapshot } from '../../../../products/shooter/ShooterSession';
import { idleInput } from '../../../../products/shooter/input/InputFrame';
import { gridEnvironmentContacts } from '../../../../engine/Movement/KinematicSpatial';
import { worldToCell } from '../../../../engine/Movement/WorldUnits';
import { createShooterArena } from '../../../../products/shooter/ShooterArena';
import { getNextEntityId } from '../../../../entities/CreatureBase';
import type { HordeState } from '../state';
import { getRealtimeModules } from '../../../realtimeCatalog';
const horde = (s: ShooterSnapshot) => s.moduleStates.hordes as HordeState;
function relocate(s: ShooterSnapshot, id: number, x: number, y: number) {
    const a = s.actors[id - 1]!; a.pose = { x, y, facing: 0 }; a.loc = worldToCell(a.pose);
    a.contacts = gridEnvironmentContacts(createShooterArena(), a.pose, a.radius);
    const full = horde(s).full.find(f => f.id === id); if (full) full.creature.loc = { ...a.loc };
}
function eliteScene(id = 202) {
    const s = new ShooterSession(7301, { modules: ['hordes'] }).snapshot(), p = s.actors[0]!.pose;
    relocate(s, id, p.x + (id === 210 ? 2600 : 1600), p.y);
    return ShooterSession.fromSnapshot(s);
}
function run(s: ShooterSession, count: number, move = false) {
    for (let n = 0; n < count; n++) { const tick = s.tick + 1; s.advanceTick({ ...idleInput(tick), moveY: move ? -127 : 0 }); }
}
describe('S3 real 200 + 8 + 1 simulation', () => {
    it('starts the actual mixed cohort and keeps no-module and horde-only products playable', () => {
        const s = new ShooterSession(7, { modules: ['hordes'] }), before = s.snapshot();
        expect(before.actors).toHaveLength(210); expect(before.population).toMatchObject({ swarm: 200, elites: 8, bosses: 1, spawned: 209 });
        expect(horde(before).full).toHaveLength(9); expect(before.actors[209]!.radius).toBe(1024); expect(before.ranged).toBeNull();
        run(s, 30, true); expect(s.snapshot().actors[0]!.pose.y).toBeLessThan(before.actors[0]!.pose.y);
        expect(() => s.advanceTick(idleInput(31), [{ tick: 31, kind: 'reload' }])).toThrow();
        const empty = new ShooterSession(7, { modules: [] }); run(empty, 2); expect(empty.snapshot().population).toBeNull();
    });
    it('persists a telegraphed elite action and releases damage at its real scheduler boundary', () => {
        const s = eliteScene(); run(s, 1); const checkpoint = s.snapshot();
        expect(checkpoint.population!.telegraphs.some(t => t.id === 202)).toBe(true);
        expect(horde(checkpoint).actions.bundles.some(b => b.decisionOwnerId === 202)).toBe(true);
        const restored = ShooterSession.fromSnapshot(JSON.parse(JSON.stringify(checkpoint)));
        run(s, 23); run(restored, 23); expect(restored.snapshot()).toEqual(s.snapshot());
        expect(s.snapshot().stats.damageTaken).toBeGreaterThanOrEqual(16);
        expect(replayShooter(restored.exportReplay()).snapshot()).toEqual(s.snapshot());
    });
    it('allows the player to dodge a locked ground attack and saves a multi-segment Boss action', () => {
        const s = eliteScene(210); run(s, 1); const first = s.snapshot();
        expect(first.population!.telegraphs.some(t => t.id === 210)).toBe(true);
        const boss = horde(first).actions.bundles.find(b => b.decisionOwnerId === 210)!;
        expect(boss.subactions[0]!.phases.filter(p => p.segmentIndex !== null)).toHaveLength(2);
        run(s, 40, true); const restored = ShooterSession.fromSnapshot(s.snapshot());
        run(s, 20, true); run(restored, 20, true); expect(restored.snapshot()).toEqual(s.snapshot());
        expect(s.snapshot().effects.filter(e => e.radius === 1900).every(e => !e.hit)).toBe(true);
    });
    it('replenishes a killed slot on director ticks, increments generation, and preserves the queue through a checkpoint', () => {
        const snap = new ShooterSession(2, { modules: ['hordes'] }).snapshot();
        snap.damage.actors[1]!.hp = 0; snap.actors[1]!.respawnTick = 90;
        horde(snap).units[0]!.hp = 0; horde(snap).units[0]!.readyTick = 120;
        snap.population!.swarm--; snap.population!.pending++;
        const s = ShooterSession.fromSnapshot(snap); run(s, 119); const other = ShooterSession.fromSnapshot(s.snapshot());
        run(s, 16); run(other, 16); expect(other.snapshot()).toEqual(s.snapshot());
        expect(horde(s.snapshot()).units[0]).toMatchObject({ generation: 1, readyTick: 0 });
        expect(s.snapshot().population!.spawned).toBe(210);
        const body = s.snapshot().actors[1]!, player = s.snapshot().actors[0]!;
        expect((body.pose.x - player.pose.x) ** 2 + (body.pose.y - player.pose.y) ** 2).toBeGreaterThanOrEqual(8192 ** 2);
    });
    it('accepts optional ranged damage through the shared authority and interrupts an elite windup', () => {
        const ranged = getRealtimeModules().find(d => d.kind === 'ranged');
        if (!ranged) {
            const independent = new ShooterSession(7, { modules: ['hordes'] }); run(independent, 1);
            expect(independent.snapshot().population!.elites).toBe(8); expect(independent.snapshot().ranged).toBeNull(); return;
        }
        const snap = new ShooterSession(7301, { modules: [ranged.id, 'hordes'] }).snapshot(), p = snap.actors[0]!.pose;
        relocate(snap, 202, p.x + 1600, p.y); const s = ShooterSession.fromSnapshot(snap);
        for (let tick = 1; tick <= 19; tick++) s.advanceTick({ ...idleInput(tick), buttons: [1, 10, 19].includes(tick) ? 1 : 0 });
        const final = s.snapshot(), elite = horde(final).full[0]!;
        expect(final.damage.actors[201]!.hp).toBe(164); expect(elite.creature.statusDurations).toEqual({ paralyzed: 15 });
        expect(elite.action).toBeNull(); expect(elite.creature.ticksUntilTurn).toBe(0);
        expect(ShooterSession.fromSnapshot(final).snapshot()).toEqual(final);
        expect(replayShooter(s.exportReplay()).snapshot()).toEqual(final);
    });
    it('rejects wrong full-actor HP/clock, population mirrors, rules, and S2 format', () => {
        const s = eliteScene(); run(s, 1); const good = s.snapshot();
        for (const mutate of [(v: any) => v.moduleStates.hordes.full[0].creature.hp--,
            (v: any) => v.moduleStates.hordes.full[0].creature.ticksUntilTurn++, (v: any) => v.population.swarm--,
            (v: any) => v.moduleStates.hordes.spawned++, (v: any) => v.moduleStates.hordes.actions.bundles[0].subactions[0].phases[0].durationTicks++,
            (v: any) => v.format = 'broguejs-shooter-s2', (v: any) => v.modules[0].rules.fingerprint = 'changed']) {
            const bad = structuredClone(good); mutate(bad); expect(() => ShooterSession.fromSnapshot(bad)).toThrow();
        }
        expect(() => ShooterSession.fromSnapshot(good, getRealtimeModules().filter(d => d.id !== 'hordes'))).toThrow('Missing');
        expect(s.snapshot()).toEqual(good);
    });
    it('runs interleaved rooms and replay without clocks, random numbers, or global entity allocation', () => {
        const nextId = getNextEntityId();
        const now = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('wall clock'); });
        const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('global RNG'); });
        try {
            const a = new ShooterSession(17, { modules: ['hordes'] }), b = new ShooterSession(18, { modules: ['hordes'] });
            for (let n = 0; n < 180; n++) { run(a, 1, true); run(b, 1); }
            expect(replayShooter(a.exportReplay()).snapshot()).toEqual(a.snapshot()); expect(getNextEntityId()).toBe(nextId);
        } finally { now.mockRestore(); random.mockRestore(); }
    });
});
