import { describe, expect, it, vi } from 'vitest';
import { Grid, TerrainType } from '../../../../engine/Map/Grid';
import { SpatialHash } from '../../../../engine/Movement/SpatialHash';
import { DamageResolutionAuthority } from '../../../../engine/Combat/DamageResolution';
import type { CombatEffect, RangedHost, WeaponCommand } from '../../../../engine/Simulation/RangedRuntime';
import { createFirearms } from '../module';
import { loadWeapons, WEAPONS, FIREARMS_RULES } from '../definitions';
import data from '../data/definitions.json';
import { shotRandom } from '../firing';
import { explode } from '../ballistics';

function fixture() {
    const grid = new Grid(40, 28), bodies = new SpatialHash();
    for (let y = 0; y < 28; y++) for (let x = 0; x < 40; x++) grid.setTerrain(x, y, x === 0 || y === 0 || x === 39 || y === 27 ? TerrainType.WALL : TerrainType.FLOOR);
    const actors = [{ id: 1, pose: { x: 3500, y: 5500, facing: 0 }, radius: 280, team: 0 }, { id: 2, pose: { x: 8000, y: 5500, facing: 0 }, radius: 280, team: 1 }];
    actors.forEach(a => bodies.upsert(a));
    const damage = new DamageResolutionAuthority({ schema: 1, nextResolutionId: 1, actors: actors.map(a => ({ id: a.id, team: a.team, hp: 10000, maxHp: 10000, revision: 0 })) });
    let tick = 0; const effects: CombatEffect[] = [];
    const host: RangedHost = { ownerId: 1, seed: 456, world: { grid, bodies }, tick: () => tick, health: id => damage.read(id),
        bodies: () => actors.map(a => ({ ...a, hp: damage.read(a.id)!.hp })), emit: e => effects.push(e),
        damage: intent => { const p = damage.prepareDamageResolution(intent); return p && damage.commitDamageResolution(p); } };
    let runtime = createFirearms(host);
    return { grid, actors, bodies, damage, effects, host, get runtime() { return runtime; },
        restore: () => { runtime = createFirearms(host, JSON.parse(JSON.stringify(runtime.snapshot()))); },
        step: (fire = false, commands: WeaponCommand[] = [], aimAngle = 0) => { tick++; runtime.advance({ tick, actorId: 1, fire, aimAngle, moving: false }, commands); }, get tick() { return tick; } };
}
describe('Firearms owned rules and deterministic shot identities', () => {
    it('strictly loads the versioned pack and rejects unsupported rules', () => {
        expect(WEAPONS.map(w => [w.trigger, w.ballistic])).toEqual([['semi', 'hitscan'], ['auto', 'hitscan'], ['semi', 'hitscan'], ['semi', 'projectile']]);
        expect(FIREARMS_RULES.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
        for (const change of [(v: any) => v.weapons[0].damage = -1, (v: any) => v.weapons[0].trigger = 'burst', (v: any) => v.weapons[3].speed = 0, (v: any) => v.weapons[1].pellets = 100, (v: any) => v.extra = true]) {
            const bad = structuredClone(data); change(bad); expect(() => loadWeapons(bad)).toThrow();
        }
    });
    it('keeps pellet randomness independent of iteration order and global random state', () => {
        const rng = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Global RNG'); });
        try {
            const identities: [number, number, number, number, number][] = [[9, 1, 1, 2, 0], [9, 2, 1, 2, 0], [9, 1, 3, 2, 7]];
            const values = identities.map(args => shotRandom(...args));
            expect([...identities].reverse().map(args => shotRandom(...args)).reverse()).toEqual(values); expect(new Set(values).size).toBe(3);
            const f = fixture(); f.step(true); expect(f.runtime.view().shots).toBe(1);
        } finally { rng.mockRestore(); }
    });
});
describe('Firearms scheduler, magazine and trigger lifecycle', () => {
    it('fires semi once per press and consumes a busy edge without a deferred shot', () => {
        const f = fixture(); f.step(true); for (let i = 0; i < 20; i++) f.step(true);
        expect(f.runtime.view().shots).toBe(1); f.step(false); f.step(true); expect(f.runtime.view().shots).toBe(2);
        f.step(false); f.step(true); for (let i = 0; i < 20; i++) f.step(false); expect(f.runtime.view().shots).toBe(2);
    });
    it('fires rifle every three ticks, stops at empty, reloads for 60 ticks and resumes held fire', () => {
        const f = fixture(); f.step(true, [{ tick: 1, kind: 'equip', slot: 1 }]);
        for (let t = 2; t <= 120; t++) f.step(true);
        expect(f.effects.filter(e => e.kind === 'tracer').map(e => e.tick)).toEqual(Array.from({ length: 30 }, (_, i) => 1 + i * 3));
        expect(f.runtime.view().weapons[1]!.ammo).toBe(0);
        f.step(true, [{ tick: 121, kind: 'reload' }]); expect(f.runtime.view().reloadRemaining).toBe(59);
        for (let t = 122; t <= 179; t++) f.step(true);
        expect(f.runtime.view().weapons[1]!.ammo).toBe(0); f.restore(); f.step(true);
        expect(f.runtime.view().weapons[1]!.ammo).toBe(30); f.step(true); expect(f.runtime.view().shots).toBe(31);
    });
    it('retains one reload command through firing recovery and checkpoints that pending request', () => {
        const f = fixture(); f.step(true); f.step(false, [{ tick: 2, kind: 'reload' }]); f.restore();
        for (let tick = 3; tick <= 9; tick++) f.step(false);
        expect(f.runtime.view().reloadRemaining).toBe(0); f.restore(); f.step(false);
        expect(f.runtime.view().reloadRemaining).toBe(35);
    });
    it('switching cancels reload without free ammo and cannot bypass firing cooldown', () => {
        const f = fixture(); f.step(true); f.step(false, [{ tick: 2, kind: 'equip', slot: 1 }]); f.step(true);
        expect(f.runtime.view().shots).toBe(1); for (let t = 4; t <= 9; t++) f.step(false);
        f.step(false, [{ tick: 10, kind: 'equip', slot: 0 }, { tick: 10, kind: 'reload' }]); expect(f.runtime.view().reloadRemaining).toBe(35);
        f.step(false, [{ tick: 11, kind: 'equip', slot: 2 }]); expect(f.runtime.view().reloadRemaining).toBe(0);
        expect(f.runtime.view().weapons[0]!.ammo).toBe(11); f.restore(); f.step(true); expect(f.runtime.view().shots).toBe(2);
    });
    it('fires eight distinct shotgun pellets for one round and recovers recoil', () => {
        const f = fixture(); f.step(true, [{ tick: 1, kind: 'equip', slot: 2 }]); const tracers = f.effects.filter(e => e.kind === 'tracer');
        expect(tracers).toHaveLength(8); expect(new Set(tracers.map(e => JSON.stringify(e.to))).size).toBeGreaterThan(1);
        expect(f.runtime.view().weapons[2]!.ammo).toBe(5); expect(f.runtime.view().recoil).toBe(65);
        for (let t = 2; t <= 30; t++) f.step(false); expect(f.runtime.view().recoil).toBe(0);
    });
    it('rejects ammo, timer, identity and projectile corruption on restore', () => {
        const f = fixture(); f.step(true);
        for (const change of [(s: any) => s.weapons[0].ammo = 13, (s: any) => s.timer++, (s: any) => s.ownerId = 2,
            (s: any) => s.actions.bundles[0].subactions[0].sourceFootprintVersion = 'foreign', (s: any) => s.actions.bundles[0].subactions[0].phases[0].durationTicks++,
            (s: any) => s.projectiles.push({ id: 1, sourceId: 1, slot: 0, pose: { x: 0, y: 0 }, angle: 0, remainingTicks: 2 })]) {
            const bad = structuredClone(f.runtime.snapshot()); change(bad); expect(() => createFirearms(f.host, bad)).toThrow();
        }
    });
});
describe('Hitscan and mechanical grenade ballistics', () => {
    it('resolves hitscan instantly without bullet entities; walls block damage', () => {
        const open = fixture(); open.step(true); expect(open.damage.read(2)!.hp).toBe(9968); expect(open.runtime.view().projectiles).toEqual([]);
        const wall = fixture(); wall.grid.setTerrain(6, 5, TerrainType.WALL); wall.step(true); expect(wall.damage.read(2)!.hp).toBe(10000); expect(wall.effects[0]!.to.x).toBeLessThanOrEqual(6144);
    });
    it('persists a traveling grenade and detonates once on swept contact', () => {
        const f = fixture(); f.step(true, [{ tick: 1, kind: 'equip', slot: 3 }]); expect(f.runtime.view().projectiles).toHaveLength(1); expect(f.effects).toHaveLength(0);
        f.step(false); expect(f.runtime.view().projectiles[0]!.pose.x).toBeGreaterThan(3500); f.restore();
        for (let t = 3; t <= 60; t++) f.step(false);
        expect(f.runtime.view().projectiles).toEqual([]); expect(f.effects.filter(e => e.kind === 'explosion')).toHaveLength(1); expect(f.damage.read(2)!.hp).toBeLessThan(10000);
    });
    it('expires the exact fuse and retains a grenade after its source dies', () => {
        const f = fixture(); f.actors[1]!.pose.y = 12000; f.bodies.upsert(f.actors[1]!); f.step(true, [{ tick: 1, kind: 'equip', slot: 3 }]);
        const death = f.damage.prepareDamageResolution({ sourceId: 2, targetId: 1, amount: 10000, kind: 'kinetic', friendlyFire: 'none' })!; f.damage.commitDamageResolution(death);
        for (let t = 2; t <= 36; t++) f.step(false); expect(f.runtime.view().projectiles).toHaveLength(1); f.step(false);
        expect(f.effects.filter(e => e.kind === 'explosion')).toHaveLength(1);
    });
    it('applies radial falloff and friendly fire once per entity with wall occlusion', () => {
        const f = fixture(); f.actors[1]!.pose = { x: 5200, y: 5500, facing: 0 }; f.bodies.upsert(f.actors[1]!);
        explode(f.host, { id: 1, sourceId: 1, slot: 3, pose: { x: 4000, y: 5500 }, angle: 0, remainingTicks: 1 });
        expect(f.damage.read(1)!.hp).toBeLessThan(f.damage.read(2)!.hp); expect(f.damage.snapshot().nextResolutionId).toBe(3);
        const wall = fixture(); wall.grid.setTerrain(6, 5, TerrainType.WALL); wall.actors[1]!.pose = { x: 7400, y: 5500, facing: 0 }; wall.bodies.upsert(wall.actors[1]!);
        explode(wall.host, { id: 1, sourceId: 1, slot: 3, pose: { x: 6000, y: 5500 }, angle: 0, remainingTicks: 1 }); expect(wall.damage.read(2)!.hp).toBe(10000);
    });
});
