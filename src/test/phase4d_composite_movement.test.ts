import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { compositeScene, SPIDER_LEGS } from './support/compositeScene';
import { CompositeMovement, COMPOSITE_MOVEMENT_LIMITS, type CompositeMovePlan } from '../engine/Movement/CompositeMovement';
import { bodyConstraintOrder, bodyConstraintsSatisfied, clearBodyLink } from '../engine/Movement/BodyConstraints';
import { trajectoriesCollide, trajectoryConstraintSatisfied, type BodyTrajectory } from '../engine/Movement/BodyTrajectory';
import { commitCreatureAnchor, CreatureSpatial } from '../engine/Movement/CreatureSpatial';
import { SpatialCatalog, type BodyDefinition } from '../engine/Movement/SpatialSchema';
import { TerrainType as T } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { getNextEntityId } from '../entities/Creature';
import { entityCodecDeps, restoreEntityGraph, serializeMonsterRow } from '../engine/Core/EntitySnapshot';
import { decodeWholeRunWorld, snapshotNativeSpatialWorld } from '../engine/Core/WholeRunSnapshot';
import { createHeadlessGame } from './harness';
import type { Pos } from '../types';

const next = (scene: ReturnType<typeof compositeScene>, dx = 1, dy = 0): CompositeMovePlan => {
    const result = scene.movement.planStep(scene.core.id, { x: scene.core.x + dx, y: scene.core.y + dy });
    expect(result.status, JSON.stringify(result)).toBe('planned');
    if (result.status !== 'planned') throw new Error('Expected a fixture movement plan');
    return result.plan;
};
const mechanical = (s: ReturnType<typeof compositeScene>) => JSON.stringify({ rows: s.actors.map(serializeMonsterRow), groups: s.spatial.groups,
    random: rng.getState(), nextId: getNextEntityId() });
const normalize = (plan: CompositeMovePlan) => plan.trajectories.map(t => ({ partId: t.partId, path: t.path }));

/** Independent dense sampler of translating tile-square interiors and nearest
 * Chebyshev distances; no production interval/trajectory helper is used. */
function samplePlan(s: ReturnType<typeof compositeScene>, plan: CompositeMovePlan): void {
    const cellsAt = (t: CompositeMovePlan['trajectories'][number], time: number) => {
        const index = Math.floor(time), fraction = time - index;
        const from = t.path[Math.min(index, t.path.length - 1)]!, to = t.path[Math.min(index + 1, t.path.length - 1)]!;
        return s.catalog.cells(t.footprintId, t.pose).map(p => ({ x: p.x + from.x + (to.x - from.x) * fraction,
            y: p.y + from.y + (to.y - from.y) * fraction }));
    };
    for (let step = 0; step <= 80; step++) {
        const time = step / 40;
        for (let a = 0; a < plan.trajectories.length; a++) for (let b = a + 1; b < plan.trajectories.length; b++) {
            for (const p of cellsAt(plan.trajectories[a]!, time)) for (const q of cellsAt(plan.trajectories[b]!, time)) {
                expect(Math.abs(p.x - q.x) >= 1 - 1e-10 || Math.abs(p.y - q.y) >= 1 - 1e-10).toBe(true);
            }
        }
        for (const c of s.definition.constraints) {
            const parent = plan.trajectories.find(t => t.partId === c.parentPartId)!, child = plan.trajectories.find(t => t.partId === c.childPartId)!;
            const distance = Math.min(...cellsAt(parent, time).flatMap(p => cellsAt(child, time).map(q => Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)))));
            expect(distance).toBeGreaterThanOrEqual(c.minDistance - 1e-10);
            expect(distance).toBeLessThanOrEqual(c.maxDistance + 1e-10);
        }
    }
}

describe('4d-0 bounded diagnostic group locomotion', () => {
    it('eight legs move with the 2x2 core, retain stable slots and consume no clock/RNG/ID', () => {
        const s = compositeScene(), before = mechanical(s), plan = next(s);
        expect(mechanical(s)).toBe(before);
        expect(plan.trajectories).toHaveLength(9);
        expect(plan.costTicks).toBe(s.core.movementSpeed);
        expect(plan.branchNodes).toBeLessThanOrEqual(128);
        expect(normalize(plan)).toEqual([
            { partId: 'core', path: [{ x: 14, y: 12 }, { x: 15, y: 12 }] },
            ...SPIDER_LEGS.map((p, i) => ({ partId: `limb${String(i).padStart(2, '0')}`, path: i === 3
                ? [{ x: 14 + p.x, y: 12 + p.y }, { x: 15 + p.x, y: 12 + p.y }] : [{ x: 14 + p.x, y: 12 + p.y }] })),
        ]);
        expect(Object.isFrozen(plan.trajectories[1]!.path[0])).toBe(true);
        expect(Object.isFrozen(s.core.loc)).toBe(false);
        samplePlan(s, plan);
        const old = { x: s.core.x, y: s.core.y }, group = structuredClone(s.group), random = rng.getState(), id = getNextEntityId();
        const clocks = s.actors.map(c => c.ticksUntilTurn), revisions = s.actors.map(c => c.loc);
        expect(s.movement.commit(plan)).toBe(true);
        expect(s.movement.commit(plan)).toBe(false);
        expect(s.core.loc).toEqual({ x: old.x + 1, y: old.y });
        expect(s.actors.map(c => c.loc)).toEqual(revisions); // original references are mutated, never replaced
        expect(s.actors.map(c => c.ticksUntilTurn)).toEqual(clocks);
        expect(s.group).toEqual(group);
        expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(id);
    });
    it('an explicit core-plus-legs trajectory stays deterministic for repeated movement', () => {
        const route = [[1, 0], [1, 0], [0, 1], [0, 1], [-1, 0], [0, -1]] as const;
        const capture = () => {
            const s = compositeScene(), frames = [];
            for (const [dx, dy] of route) {
                const plan = next(s, dx, dy); samplePlan(s, plan);
                frames.push(normalize(plan)); expect(s.movement.commit(plan)).toBe(true);
            }
            return frames;
        };
        expect(capture()).toEqual(capture());
    });
    it('partId tree order is stable under definition, table and entity-list permutations', () => {
        const a = compositeScene(), b = compositeScene();
        b.group.members.reverse(); b.world.monsters.reverse(); b.spatial.replaceWorld(b.world);
        expect(normalize(next(a))).toEqual(normalize(next(b)));
        const shuffled = structuredClone(a.definition); shuffled.parts = [...shuffled.parts].reverse(); shuffled.constraints = [...shuffled.constraints].reverse();
        expect(bodyConstraintOrder(shuffled)).toEqual(bodyConstraintOrder(a.definition));
    });
    it('a multihead fixture and a five-segment chain have complete deterministic trajectories', () => {
        const heads = compositeScene([{ x: -1, y: 0 }, { x: 0, y: -1 }, { x: 2, y: 1 }]);
        const plan = next(heads); samplePlan(heads, plan); expect(heads.movement.commit(plan)).toBe(true);
        const chain = compositeScene(Array.from({ length: 5 }, (_, i) => ({ x: -i - 1, y: 0 })), { coreSize: 1, chain: true, maxDistance: 1 });
        for (let i = 0; i < 4; i++) {
            const before = chain.actors.map(c => ({ ...c.loc })), move = next(chain); samplePlan(chain, move);
            expect(chain.movement.commit(move)).toBe(true);
            expect(chain.actors.map(c => c.loc)).toEqual(before.map(p => ({ x: p.x + 1, y: p.y })));
        }
    });
    it('a front leg vacates before the core occupies its final tile; a stationary leg may stay', () => {
        const s = compositeScene(), plan = next(s);
        const front = plan.trajectories.find(t => t.partId === 'limb03')!;
        expect(front.path.length).toBeGreaterThan(1);
        expect(plan.trajectories.slice(1).some(t => t.path.length === 1)).toBe(true);
        samplePlan(s, plan);
    });
    it('no two-step leg endpoint can teleport across a wall', () => {
        const s = compositeScene([{ x: 1, y: 0 }], { coreSize: 1, maxDistance: 3 });
        s.grid.setTerrain(s.core.x + 2, s.core.y, T.WALL);
        const before = mechanical(s), result = s.movement.planStep(s.core.id, { x: s.core.x + 1, y: s.core.y }, {
            allowsTerrain: (_id, p) => p.y === s.core.y && s.grid.getCell(p.x, p.y)?.isPassable === true,
        });
        expect(result).toMatchObject({ status: 'blocked', reason: 'constraints', costTicks: 100 });
        expect(mechanical(s)).toBe(before);
    });
    it('a retained stationary member still needs legal standing terrain and region', () => {
        const s = compositeScene(), leg = s.actors[1]!, before = mechanical(s);
        expect(s.movement.planStep(s.core.id, { x: s.core.x + 1, y: s.core.y }, {
            allowsTerrain: id => id !== leg.id,
        })).toMatchObject({ status: 'blocked', reason: 'terrain', costTicks: 100 });
        expect(mechanical(s)).toBe(before);
        leg.spatial!.movementRegionId = 99;
        Object.assign(s.world, { inRegion: () => true }); s.spatial.replaceWorld(s.world);
        const withRegion = mechanical(s);
        expect(s.movement.planStep(s.core.id, { x: s.core.x + 1, y: s.core.y }, { inRegion: () => false })).toMatchObject({ status: 'blocked', reason: 'terrain' });
        expect(mechanical(s)).toBe(withRegion);
    });
    it('tail terrain, diagonal sweep, active outsiders and dormant reservations block the whole plan', () => {
        const s = compositeScene(), target = { x: s.core.x + 1, y: s.core.y + 1 };
        s.grid.setTerrain(s.core.x + 2, s.core.y, T.WALL);
        expect(s.movement.planStep(s.core.id, target)).toMatchObject({ status: 'blocked', reason: 'terrain' });
        s.grid.setTerrain(s.core.x + 2, s.core.y, T.FLOOR);
        const outsider = compositeScene([{ x: -1, y: 0 }], { coreSize: 1 }).core;
        delete outsider.spatial; commitCreatureAnchor(outsider, { x: s.core.x + 2, y: s.core.y + 1 }, 'mutate', true);
        s.world.monsters.push(outsider); s.spatial.replaceWorld(s.world);
        expect(s.movement.planStep(s.core.id, { x: s.core.x + 1, y: s.core.y })).toMatchObject({ status: 'blocked', reason: 'terrain' });
        s.world.monsters.pop(); outsider.isDormant = true; s.world.dormantMonsters.push(outsider); s.spatial.replaceWorld(s.world);
        expect(s.movement.planStep(s.core.id, { x: s.core.x + 1, y: s.core.y })).toMatchObject({ status: 'blocked', reason: 'terrain' });
    });
    it('32 candidates / 128 nodes degrade to blocked with a positive cost, without writes', () => {
        const s = compositeScene([{ x: -1, y: -1 }, { x: -1, y: 1 }, { x: -2, y: 0 }, { x: 1, y: 0 }], { coreSize: 1, maxDistance: 4 });
        s.actors[4]!.setStatusDuration('stuck', 10);
        const before = mechanical(s), result = s.movement.planStep(s.core.id, { x: s.core.x + 1, y: s.core.y });
        expect(result).toMatchObject({ status: 'blocked', reason: 'budget', branchNodes: 128, costTicks: 100 });
        expect(mechanical(s)).toBe(before);
        expect(COMPOSITE_MOVEMENT_LIMITS).toEqual({ candidates: 32, branchNodes: 128, memberStep: 2 });
        expect(s.movement.planStep(s.core.id, { x: s.core.x + 1, y: s.core.y }, { branchBudget: 2 })).toMatchObject({ status: 'blocked', branchNodes: 2 });
        for (const branchBudget of [0, 129, 1.5]) expect(() => s.movement.planStep(s.core.id, { x: s.core.x + 1, y: s.core.y }, { branchBudget })).toThrow('budget');
    });
    it('an immobile support definition and a locked core return positive-cost blocked', () => {
        const s = compositeScene(); s.core.spatial!.actionLockInTicks = 15;
        expect(s.movement.planStep(s.core.id, { x: s.core.x + 1, y: s.core.y })).toMatchObject({ status: 'blocked', reason: 'immobile', costTicks: 100 });
        const catalog = new SpatialCatalog(true);
        catalog.registerForm({ id: 'single', owner: 'foundation', footprintId: 'builtin:single' });
        const def = { ...structuredClone(s.definition), id: 'no-support', parts: s.definition.parts.map(p => ({ ...p, providesSupport: false, formId: 'single' })) };
        catalog.registerBody(def);
        s.group.bodyDefinitionId = def.id;
        for (const actor of s.actors) actor.spatial!.footprintId = 'builtin:single';
        const spatial = new CreatureSpatial(s.world, catalog); spatial.groups.push(s.group);
        delete s.core.spatial!.actionLockInTicks;
        expect(new CompositeMovement(spatial).planStep(s.core.id, { x: s.core.x + 1, y: s.core.y })).toMatchObject({ status: 'blocked', reason: 'immobile' });
    });
    it.each(['terrain', 'source', 'away-back', 'table', 'hp', 'clock', 'status', 'frozen', 'outsider'] as const)('stale %s plans cannot publish any final anchors', kind => {
        const s = compositeScene(), plan = next(s);
        switch (kind) {
            case 'terrain': s.grid.setTerrain(1, 1, T.WALL); break;
            case 'source': commitCreatureAnchor(s.actors[1]!, { x: s.actors[1]!.x - 1, y: s.actors[1]!.y }, 'mutate', true); break;
            case 'away-back': {
                const c = s.actors[1]!, original = { ...c.loc }; commitCreatureAnchor(c, { x: c.x - 1, y: c.y }, 'mutate', true); commitCreatureAnchor(c, original, 'mutate', true); break;
            }
            case 'table': s.group.members[1]!.readyInTicks++; break;
            case 'hp': s.actors[1]!.hp--; break;
            case 'clock': s.core.ticksUntilTurn++; break;
            case 'status': s.actors[1]!.setStatusDuration('stuck', 5); break;
            case 'frozen': Object.freeze(s.actors[1]!.loc); break;
            case 'outsider': {
                const outsider = compositeScene([{ x: -1, y: 0 }], { coreSize: 1 }).core;
                delete outsider.spatial; commitCreatureAnchor(outsider, { x: s.core.x + 3, y: s.core.y }, 'mutate', true);
                s.world.monsters.push(outsider); s.spatial.replaceWorld(s.world); break;
            }
        }
        const before = mechanical(s); expect(s.movement.commit(plan)).toBe(false); expect(mechanical(s)).toBe(before);
    });
    it('changed engine terrain/region predicates are rechecked, and forged plans have no authority', () => {
        const s = compositeScene(); let allowed = true;
        const result = s.movement.planStep(s.core.id, { x: s.core.x + 1, y: s.core.y }, { allowsTerrain: () => allowed });
        if (result.status !== 'planned') throw new Error('Expected plan');
        expect(s.movement.commit(structuredClone(result.plan))).toBe(false);
        allowed = false; const before = mechanical(s); expect(s.movement.commit(result.plan)).toBe(false); expect(mechanical(s)).toBe(before);
    });
    it('session retirement and new cross-group ownership invalidate old plans', () => {
        const retired = compositeScene(), old = next(retired);
        retired.spatial.dispose(); expect(retired.movement.commit(old)).toBe(false);
        const shared = compositeScene(), plan = next(shared), duplicate = structuredClone(shared.group);
        duplicate.groupId += 10000; duplicate.coreId += 10000; shared.spatial.groups.push(duplicate);
        const before = mechanical(shared); expect(shared.movement.commit(plan)).toBe(false); expect(mechanical(shared)).toBe(before);
    });
    it('strictly rejects steps, unopened retired members, mirrors and >2-member-step declarations', () => {
        const s = compositeScene();
        for (const at of [{ ...s.core.loc }, { x: s.core.x + 2, y: s.core.y }, { x: NaN, y: 0 }]) expect(() => s.movement.planStep(s.core.id, at)).toThrow('step');
        const bad = compositeScene(SPIDER_LEGS, { maxStep: 3 }); expect(() => next(bad)).toThrow('budget');
        s.group.members[1]!.life = 'removed'; s.group.members[1]!.entityId = null; expect(() => next(s)).toThrow('member');
    });
    it('17 total members have a measured plan+commit trace (fixture, not native commands)', () => {
        const offsets = Array.from({ length: 16 }, (_, i) => ({ x: (i % 8) - 3, y: i < 8 ? -3 : 4 }));
        const s = compositeScene(offsets, { maxDistance: 6 }), samples = [];
        for (let i = 0; i < 20; i++) {
            const before = mechanical(s), start = performance.now();
            const result = s.movement.planStep(s.core.id, { x: s.core.x + (i < 10 ? 1 : -1), y: s.core.y });
            const committed = result.status === 'planned' && s.movement.commit(result.plan), ms = performance.now() - start;
            if (result.status === 'planned') expect(committed).toBe(true);
            else { expect(result.costTicks).toBeGreaterThan(0); expect(mechanical(s)).toBe(before); }
            samples.push({ ms, nodes: result.status === 'planned' ? result.plan.branchNodes : result.branchNodes, status: result.status });
        }
        const ordered = samples.slice(1).map(v => v.ms).sort((a, b) => a - b);
        const measured = { label: '17-member fixture plan+commit, not executeCommand', coldMs: samples[0]!.ms,
            warmP50Ms: ordered[Math.floor(ordered.length / 2)], warmP95Ms: ordered[Math.ceil(ordered.length * .95) - 1], maxNodes: Math.max(...samples.map(v => v.nodes)),
            planned: samples.filter(v => v.status === 'planned').length, blocked: samples.filter(v => v.status === 'blocked').length };
        if (process.env.BROGUE_CAPTURE_COMPOSITE_PERF) writeFileSync(process.env.BROGUE_CAPTURE_COMPOSITE_PERF, JSON.stringify({ measured, samples }, null, 2) + '\n');
        expect(measured.maxNodes).toBeLessThanOrEqual(128);
        expect(measured.planned).toBeGreaterThan(0);
    });
});

describe('continuous member collision / tether / link geometry', () => {
    const catalog = new SpatialCatalog(true);
    const path = (points: Pos[]): BodyTrajectory => ({ anchor: points[0]!, footprintId: 'builtin:single', pose: 'r0', path: points });
    it('rejects swaps and diagonal crossing but permits a straight chain following vacated cells', () => {
        expect(trajectoriesCollide(catalog, path([{ x: 0, y: 0 }, { x: 1, y: 0 }]), path([{ x: 1, y: 0 }, { x: 0, y: 0 }]))).toBe(true);
        expect(trajectoriesCollide(catalog, path([{ x: 0, y: 0 }, { x: 1, y: 1 }]), path([{ x: 1, y: 0 }, { x: 0, y: 1 }]))).toBe(true);
        expect(trajectoriesCollide(catalog, path([{ x: 0, y: 0 }, { x: 1, y: 0 }]), path([{ x: -1, y: 0 }, { x: 0, y: 0 }]))).toBe(false);
    });
    it('distance constraints include transient collisions and a delayed second substep', () => {
        const s = compositeScene([{ x: -1, y: 0 }], { coreSize: 1 }), c = { ...s.definition.constraints[0]!, minDistance: 1, maxDistance: 1 };
        expect(trajectoryConstraintSatisfied(catalog, c, path([{ x: 1, y: 1 }, { x: 0, y: 0 }]), path([{ x: 0, y: 1 }, { x: 1, y: 0 }]), s.grid)).toBe(false);
        expect(trajectoryConstraintSatisfied(catalog, c, path([{ x: 1, y: 0 }, { x: 2, y: 0 }]), path([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]), s.grid)).toBe(false);
    });
    it('solid links and their intermediate sweep cannot cut through walls', () => {
        const s = compositeScene([{ x: 3, y: 0 }], { coreSize: 1, maxDistance: 4, clearLink: true });
        const from = { ...s.core.loc }, to = { ...s.actors[1]!.loc };
        expect(clearBodyLink(s.grid, from, to)).toBe(true);
        s.grid.setTerrain(from.x + 1, from.y, T.WALL); expect(clearBodyLink(s.grid, from, to)).toBe(false);
        expect(() => next(s)).toThrow('constraints');
        s.grid.setTerrain(from.x + 1, from.y, T.FLOOR);
        const c = s.definition.constraints[0]!;
        s.grid.setTerrain(from.x + 1, from.y + 1, T.WALL);
        expect(trajectoryConstraintSatisfied(s.catalog, c, path([from, { x: from.x, y: from.y + 1 }]), path([to, { x: to.x, y: to.y + 1 }]), s.grid)).toBe(false);
    });
    it('uses actual masked body cells, rather than an anchor distance or bounding box', () => {
        const s = compositeScene([{ x: 3, y: 0 }], { coreSize: 3, maxDistance: 1 });
        const poses = new Map(s.actors.map((c, i) => [s.definition.parts[i]!.partId, { anchor: c.loc, footprintId: c.spatial!.footprintId, pose: c.spatial!.pose }]));
        expect(bodyConstraintsSatisfied(s.catalog, s.definition, poses, s.grid)).toBe(true);
        const plan = next(s); samplePlan(s, plan); expect(s.movement.commit(plan)).toBe(true);
    });
    it('nearest cell switches cannot hide a transient max-distance violation in a U mask', () => {
        const s = compositeScene([{ x: -1, y: 0 }], { coreSize: 1 });
        s.catalog.registerFootprint({ id: 'fixture:U', owner: 'foundation', poses: ['r0'], geometry: { kind: 'mask', cells: [
            { x: 0, y: 0 }, { x: 0, y: 1 }, ...Array.from({ length: 5 }, (_, x) => ({ x, y: 2 })), { x: 4, y: 1 }, { x: 4, y: 0 },
        ] } });
        const parent = path([{ x: 11, y: 9 }, { x: 12, y: 9 }]), child = { ...path([{ x: 10, y: 10 }, { x: 9, y: 10 }]), footprintId: 'fixture:U' };
        const constraint = { ...s.definition.constraints[0]!, minDistance: 1, maxDistance: 1 };
        for (const tick of [0, 1]) {
            expect(bodyConstraintsSatisfied(s.catalog, { constraints: [constraint] }, new Map([
                ['core', { ...parent, anchor: parent.path[tick]! }], ['limb00', { ...child, anchor: child.path[tick]! }],
            ]), s.grid)).toBe(true);
        }
        expect(trajectoryConstraintSatisfied(s.catalog, constraint, parent, child, s.grid)).toBe(false);
    });
    it('all single-cell unit velocities agree with independent time samples for collision and tether bounds', () => {
        const s = compositeScene([{ x: -1, y: 0 }], { coreSize: 1 });
        const velocities = Array.from({ length: 9 }, (_, i) => ({ x: i % 3 - 1, y: Math.floor(i / 3) - 1 }));
        for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) for (const a of velocities) for (const b of velocities) {
            const startA = { x: 12, y: 12 }, startB = { x: 12 + x, y: 12 + y };
            const p = path([startA, { x: startA.x + a.x, y: startA.y + a.y }]), q = path([startB, { x: startB.x + b.x, y: startB.y + b.y }]);
            const samples = Array.from({ length: 33 }, (_, i) => {
                const time = i / 32; return { x: Math.abs(x + (b.x - a.x) * time), y: Math.abs(y + (b.y - a.y) * time) };
            });
            expect(trajectoriesCollide(catalog, p, q)).toBe(samples.some(v => v.x < 1 && v.y < 1));
            const constraint = { ...s.definition.constraints[0]!, minDistance: 1, maxDistance: 2 };
            expect(trajectoryConstraintSatisfied(catalog, constraint, p, q, s.grid)).toBe(samples.every(v => Math.max(v.x, v.y) >= 1 && Math.max(v.x, v.y) <= 2));
        }
    });
});

describe('group codec / production admission remain explicit', () => {
    it('movement round-trips through entity and group codec, with no RNG or shared containers', () => {
        const s = compositeScene(), plan = next(s); expect(s.movement.commit(plan)).toBe(true);
        const rows = JSON.parse(JSON.stringify(s.actors.map(serializeMonsterRow))), root = s.spatial.snapshotWorld()!, random = rng.getState(), id = getNextEntityId();
        const restored = restoreEntityGraph(rows, [], [], [], { ...entityCodecDeps, spatialCatalog: s.catalog });
        const actors = rows.map((r: { id: number }) => restored.monsters.get(r.id)!);
        const spatial = new CreatureSpatial({ grid: s.grid, monsters: actors }, s.catalog); spatial.restoreWorld(root);
        expect(spatial.snapshotWorld()).toEqual(root); expect(actors[1]!.spatial).not.toBe(s.actors[1]!.spatial);
        const loaded = new CompositeMovement(spatial), target = { x: s.core.x + 1, y: s.core.y };
        const a = s.movement.planStep(s.core.id, target), b = loaded.planStep(s.core.id, target);
        expect(a.status).toBe('planned'); expect(b.status).toBe('planned');
        if (a.status === 'planned' && b.status === 'planned') expect(normalize(a.plan)).toEqual(normalize(b.plan));
        expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(id);
    });
    it('full fixture world decode rejects detached tethers without replacing the previous graph', () => {
        const s = compositeScene(), game = createHeadlessGame(7301, 'test'), saved = JSON.parse(JSON.stringify(game.toSnapshot()));
        saved.player.loc = { x: 30, y: 20 }; saved.monsters = s.actors.map(serializeMonsterRow); saved.dormantMonsters = [];
        saved.entityGraph.monsters = []; saved.visibleMonsterIds = [];
        saved.run.spatialWorld = snapshotNativeSpatialWorld(new Map([[saved.depth, s.spatial]]));
        const random = rng.getState(), decoded = decodeWholeRunWorld(saved, { ...entityCodecDeps, spatialCatalog: s.catalog });
        expect(decoded.spatialLevels!.get(saved.depth)!.membersOf(s.core.id)).toHaveLength(9);
        const bad = structuredClone(saved); bad.monsters[1].loc.x = 45;
        expect(() => decodeWholeRunWorld(bad, { ...entityCodecDeps, spatialCatalog: s.catalog })).toThrow('constraints');
        expect(rng.getState()).toEqual(random); expect(s.spatial.membersOf(s.core.id)).toHaveLength(9);
    });
    it('bad tree/17-member/64-cell definitions reject, and production cannot obtain or load groups', () => {
        const s = compositeScene(), bad: BodyDefinition = structuredClone(s.definition); bad.id = 'bad';
        bad.constraints[1]!.parentPartId = bad.constraints[1]!.childPartId;
        expect(() => s.catalog.registerBody(bad)).toThrow('Cyclic');
        expect(() => compositeScene(Array.from({ length: 17 }, (_, x) => ({ x: x + 3, y: 0 })), { maxDistance: 30 })).toThrow('definition');
        const huge = structuredClone(s.definition); huge.id = 'huge'; huge.parts = huge.parts.map(p => ({ ...p, formId: 'fixture:core' }));
        // Nine 3x3 parts exceed 64 occupied cells.
        s.catalog.registerForm({ id: 'large', owner: 'foundation', footprintId: 'builtin:square-3' }); huge.parts = huge.parts.map(p => ({ ...p, formId: 'large' }));
        expect(() => s.catalog.registerBody(huge)).toThrow('budget');
        const game = createHeadlessGame(7301, 'test'), previous = game.player, random = rng.getState();
        expect(() => new CompositeMovement(new CreatureSpatial({ grid: game.grid, monsters: [] }))).toThrow('not open');
        expect(() => game.monsters.push(s.core)).toThrow('not open');
        const snapshot = JSON.parse(JSON.stringify(game.toSnapshot()));
        snapshot.monsters = s.actors.map(serializeMonsterRow); snapshot.dormantMonsters = []; snapshot.run.spatialWorld = snapshotNativeSpatialWorld(new Map([[snapshot.depth, s.spatial]]));
        expect(game.loadSnapshot(snapshot)).toBe(false); expect(game.player).toBe(previous); expect(rng.getState()).toEqual(random);
        expect(readFileSync('src/engine/Core/TimeCoordinator.ts', 'utf8')).not.toContain('CompositeMovement');
    });
});
