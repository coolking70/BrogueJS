import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CreatureSpatial, commitCreatureAnchor, distanceBetweenFootprints, EFFECT_TARGET_POLICY } from '../engine/Movement/CreatureSpatial';
import { SpatialCatalog, compileFootprint, validateSpatialComponent, type FootprintDefinition, type BodyDefinition, type BodyGroupState } from '../engine/Movement/SpatialSchema';
import { Grid, TerrainType as T } from '../engine/Map/Grid';
import { Monster, type MonsterData } from '../entities/Monster';
import { Player } from '../entities/Player';
import { rng } from '../engine/Random';
import { entityCodecDeps, serializeMonsterRow, restoreEntityGraph } from '../engine/Core/EntitySnapshot';
import { decodeWholeRunWorld, isWholeRunSnapshot, snapshotNativeSpatialWorld } from '../engine/Core/WholeRunSnapshot';
import monsterData from '../data/monsters.json';
import { createHeadlessGame } from './harness';

const rat = (x = 3, y = 3) => new Monster(x, y, (monsterData as MonsterData[]).find(m => m.id === 'rat')!);
const shape = (id: string, cells: { x: number; y: number }[]): FootprintDefinition => ({ id, owner: 'foundation', geometry: { kind: 'mask', cells }, poses: ['r0', 'r90', 'r180', 'r270'] });
function scene() {
    const grid = new Grid(18, 18);
    for (let x = 0; x < 18; x++) for (let y = 0; y < 18; y++) grid.setTerrain(x, y, T.FLOOR);
    const catalog = new SpatialCatalog(true), monster = rat();
    monster.spatial = { schema: 1, footprintId: 'builtin:square-2', pose: 'r0' };
    const world = { grid, monsters: [monster], dormantMonsters: [] as Monster[], inDeathWindow: (c: any) => c.hp === 0 && !c.deathProcessed };
    const facade = new CreatureSpatial(world, catalog);
    return { grid, catalog, monster, world, facade };
}
const L = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
const cross = [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }];
const ring = Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => ({ x, y }))).flat().filter(p => p.x !== 1 || p.y !== 1);

describe('4a0 native geometry/identity fixtures (no production body actions)', () => {
    it.each([2, 3])('all %s-square cells hit one entity/body/implicit group', size => {
        const { monster: m, facade: f } = scene(); f.setSpatial(m, { schema: 1, footprintId: `builtin:square-${size}`, pose: 'r0' });
        expect(f.hasIndex).toBe(false);
        const cells = f.footprintOf(m); expect(cells).toHaveLength(size * size);
        for (const p of cells) expect(f.creatureAtCell(p)).toBe(m);
        expect(f.hasIndex).toBe(true);
        for (const dedup of ['entity', 'part', 'group'] as const) {
            const hits = f.collectBodyTargets(cells, { dedup }); expect(hits).toHaveLength(1);
            expect(hits[0]).toMatchObject({ entityId: m.id, groupId: m.id, partId: null, zoneId: 'body', contact: cells[0] });
        }
        const view = f.spatialOf(m.id); expect(Object.isFrozen(view.cells[0])).toBe(true); expect(Object.isFrozen(m)).toBe(false);
        expect(f.membersOf(m.id)).toEqual([view]);
    });
    it.each([['L', L, { x: 1, y: 1 }], ['cross', cross, { x: 1, y: 1 }], ['hole', ring, { x: 1, y: 1 }]] as const)('%s mask keeps its empty cell empty', (id, cells, hole) => {
        const { catalog, monster: m, facade: f } = scene(); catalog.registerFootprint(shape(id, [...cells]));
        f.setSpatial(m, { schema: 1, footprintId: id, pose: 'r0' });
        expect(f.creatureAtCell({ x: m.x + hole.x, y: m.y + hole.y })).toBeUndefined();
        for (const p of cells) expect(f.creatureAtCell({ x: m.x + p.x, y: m.y + p.y })).toBe(m);
    });
    it('pose rotates labels around the anchor without bounding-box translation', () => {
        const { catalog, monster: m, facade: f } = scene(); catalog.registerFootprint(shape('L', L));
        f.setSpatial(m, { schema: 1, footprintId: 'L', pose: 'r90' });
        expect(f.footprintOf(m).map(p => ({ x: p.x - m.x, y: p.y - m.y }))).toEqual([{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }]);
        expect(() => f.planPlacement([{ creature: m, at: m.loc, pose: 'r180' }])).toThrow('Rotation');
    });
    it('self-overlap is legal, tail terrain/diagonal blockers and other creatures are not', () => {
        const { facade: f, monster: m, world, grid } = scene(); const at = { x: 4, y: 3 };
        expect(f.canFitAt(m, at)).toBe(true);
        grid.setTerrain(5, 4, T.WALL); expect(f.canFitAt(m, at)).toBe(false); grid.setTerrain(5, 4, T.FLOOR);
        const blocker = rat(5, 4); world.monsters.push(blocker); f.replaceWorld(world); expect(f.canFitAt(m, at)).toBe(false);
        world.monsters.pop(); f.replaceWorld(world); grid.setTerrain(5, 3, T.WALL);
        expect(f.canStepFootprint(m, { x: 4, y: 4 })).toBe(false);
    });
    it('active, reserved and death-contact windows differ without stale eligibility', () => {
        const { facade: f, monster: m, world } = scene(); const sleeper = rat(3, 3); sleeper.isDormant = true;
        world.dormantMonsters.push(sleeper); f.replaceWorld(world);
        expect(f.occupantsAtCell(m.loc)).toHaveLength(1); expect(f.occupantsAtCell(m.loc, 'active-or-reserved')).toHaveLength(2);
        m.hp = 0; expect(f.creatureAtCell(m.loc)).toBeUndefined(); expect(f.creatureAtCell(m.loc, 'death-contact')).toBe(m);
        expect(f.creatureAtCell(m.loc, 'active-or-reserved')).toBe(sleeper);
        m.deathProcessed = true; expect(f.creatureAtCell(m.loc, 'death-contact')).toBeUndefined();
    });
    it('plans atomically revalidate identity, terrain revision and live reservations; no RNG', () => {
        const { facade: f, monster: m, world, grid } = scene(); const sleeper = rat(5, 4), before = rng.getState();
        const plan = f.planPlacement([{ creature: m, at: { x: 4, y: 3 } }])!;
        grid.setTerrain(10, 10, T.WALL); expect(f.commitPlacement(plan)).toBe(false); expect(m.loc).toEqual({ x: 3, y: 3 });
        const next = f.planPlacement([{ creature: m, at: { x: 4, y: 3 } }])!;
        world.dormantMonsters.push(sleeper); f.replaceWorld(world); expect(f.commitPlacement(next)).toBe(false);
        world.dormantMonsters.pop(); f.replaceWorld(world);
        const valid = f.planPlacement([{ creature: m, at: { x: 4, y: 3 } }])!;
        expect(f.commitPlacement(valid)).toBe(true); expect(f.commitPlacement(valid)).toBe(false);
        expect(f.creatureAtCell({ x: 3, y: 3 })).toBeUndefined(); expect(f.creatureAtCell({ x: 5, y: 4 })).toBe(m);
        expect(rng.getState()).toEqual(before);
    });
    it('two planned entities may exchange old cells, never share final cells or mutate a frozen loc', () => {
        const { world, catalog, grid } = scene(); const a = rat(3, 3), b = rat(4, 3); world.monsters = [a, b];
        const f = new CreatureSpatial({ ...world, grid }, catalog);
        expect(f.hasIndex).toBe(false);
        const swap = f.planPlacement([{ creature: a, at: { ...b.loc } }, { creature: b, at: { ...a.loc } }])!;
        expect(f.commitPlacement(swap)).toBe(true); expect([a.x, b.x]).toEqual([4, 3]); expect(f.hasIndex).toBe(false);
        expect(f.planPlacement([{ creature: a, at: { x: 5, y: 5 } }, { creature: b, at: { x: 5, y: 5 } }])).toBeNull();
        Object.freeze(b.loc); expect(f.planPlacement([{ creature: a, at: { x: 6, y: 5 } }, { creature: b, at: { x: 7, y: 5 } }])).toBeNull();
    });
    it('publication rejects duplicate IDs/ownership and cannot ignore a stationary obstacle', () => {
        const { facade: f, world, monster: m } = scene(); const blocker = rat(5, 4);
        f.replaceWorld({ ...world, monsters: [m, blocker] });
        expect(f.planPlacement([{ creature: m, at: { x: 4, y: 3 } }], { ignore: new Set([blocker]) })).toBeNull();
        expect(() => f.replaceWorld({ ...world, monsters: [m], dormantMonsters: [m] })).toThrow('ownership');
        blocker.id = m.id; expect(() => f.replaceWorld({ ...world, monsters: [m, blocker] })).toThrow('ID');
    });
    it('publication invalidates lazily and releases the last-user index', () => {
        const { facade: f, monster: m } = scene(); f.creatureAtCell(m.loc); expect(f.hasIndex).toBe(true);
        commitCreatureAnchor(m, { x: 6, y: 6 }, 'replace', true); expect(f.hasIndex).toBe(false);
        expect(f.creatureAtCell({ x: 7, y: 7 })).toBe(m);
        f.setSpatial(m); expect(Object.prototype.hasOwnProperty.call(m, 'spatial')).toBe(false); expect(f.capabilityUsers).toBe(0); expect(f.hasIndex).toBe(false);
        f.creatureAtCell(m.loc); expect(f.hasIndex).toBe(false); expect(f.snapshotWorld()).toBeUndefined();
    });
    it('native entity and spatial-world codec rebuild index and clone independent containers', () => {
        const { facade: f, monster: m, catalog, world } = scene();
        catalog.registerFootprint(shape('hole', ring)); f.setSpatial(m, { schema: 1, footprintId: 'hole', pose: 'r0' });
        const row = JSON.parse(JSON.stringify(serializeMonsterRow(m))), root = f.snapshotWorld()!;
        expect(() => restoreEntityGraph([row])).toThrow('footprint');
        const restored = restoreEntityGraph([row], [], [], [], { ...entityCodecDeps, spatialCatalog: catalog }).monsters.get(m.id)!;
        const loaded = new CreatureSpatial({ ...world, monsters: [restored] }, catalog); expect(loaded.hasIndex).toBe(false); loaded.restoreWorld(root);
        expect(loaded.creatureAtCell({ x: 5, y: 5 })).toBe(restored); expect(loaded.creatureAtCell({ x: 4, y: 4 })).toBeUndefined();
        const clone = m.copyForClone(); expect(clone.spatial).toEqual(m.spatial); expect(clone.spatial).not.toBe(m.spatial);
        const ordinary = rat(); expect(Object.prototype.hasOwnProperty.call(ordinary, 'spatial')).toBe(false); expect(Object.prototype.hasOwnProperty.call(serializeMonsterRow(ordinary), 'spatial')).toBe(false);
        ordinary.spatial = undefined; expect(() => serializeMonsterRow(ordinary)).toThrow('omit the property');
        const wrong = structuredClone(root); wrong.definitions.footprints[0]!.owner = 'missing-module'; expect(() => loaded.restoreWorld(wrong)).toThrow('identity');
    });
    it('D08 defaults and repeated scope distinguish entity/part/group', () => {
        expect(EFFECT_TARGET_POLICY).toMatchObject({ 'area-damage': 'part', geometry: 'part', mental: 'group', environment: 'entity', death: 'group' });
        const { facade: f, monster: m, catalog } = scene();
        const d = shape('zones', L); d.zones = ['head', 'tail'].map(id => ({ id, nameKey: id, health: { kind: 'native' }, armor: 0, damageMultiplier: { numerator: 1, denominator: 1 }, breakRuleId: 'foundation:keep-zone' }));
        d.zoneCells = [{ x: 0, y: 0, zoneId: 'head' }, { x: 1, y: 0, zoneId: 'tail' }, { x: 0, y: 1, zoneId: 'tail' }];
        catalog.registerFootprint(d); f.setSpatial(m, { schema: 1, footprintId: d.id, pose: 'r0' });
        const cells = f.footprintOf(m), scope = new Set<string>();
        expect(f.collectBodyTargets(cells, { effect: 'area-damage' }, scope)).toHaveLength(2); expect(f.collectBodyTargets(cells, {}, scope)).toHaveLength(0);
        expect(f.collectBodyTargets(cells, { dedup: 'entity' })).toHaveLength(1); expect(f.collectBodyTargets(cells, { effect: 'mental' })).toHaveLength(1);
    });
});

describe('4a0 strict schema and unopened capabilities', () => {
    it.each([
        [], [{ x: 0, y: 0 }, { x: 0, y: 0 }], [{ x: 1, y: 0 }], [{ x: 0, y: 0 }, { x: 2, y: 0 }],
        [{ x: 0, y: 0 }, { x: .5, y: 0 }], Array.from({ length: 17 }, (_, x) => ({ x, y: 0 })),
    ].map(cells => ({ cells })))('rejects malformed mask %#', ({ cells }) => expect(() => compileFootprint(shape('bad', cells))).toThrow());
    it('rejects unknown fields, poses, owners, zones, ratios and local HP', () => {
        const { catalog } = scene(); const d = shape('local', L);
        d.zones = [{ id: 'head', nameKey: 'head', health: { kind: 'local', maxHp: 10, ownerTransfer: { numerator: 1, denominator: 2 } }, armor: 0, damageMultiplier: { numerator: 1, denominator: 1 }, breakRuleId: 'foundation:keep-zone' }];
        d.zoneCells = [{ x: 0, y: 0, zoneId: 'head' }]; catalog.registerFootprint(d);
        const state = { schema: 1, footprintId: 'local', pose: 'r0', zoneState: [{ zoneId: 'head', hp: 10, broken: false, generation: 0 }] };
        expect(() => validateSpatialComponent(state, catalog, false)).not.toThrow();
        for (const bad of [{ ...state, other: true }, { ...state, pose: 'unknown' }, { ...state, footprintId: 'missing' },
            { ...state, zoneState: [{ ...state.zoneState[0], hp: 11 }] }, { ...state, zoneState: [{ ...state.zoneState[0], regenerateInTicks: 1 }] }]) {
            expect(() => validateSpatialComponent(bad, catalog, false)).toThrow();
        }
        const ratio = structuredClone(d); (ratio.zones![0]!.damageMultiplier.denominator) = 0; expect(() => compileFootprint(ratio)).toThrow('ratio');
        const labels = structuredClone(d); labels.zoneCells = [{ x: 1, y: 1, zoneId: 'head' }]; expect(() => compileFootprint(labels)).toThrow('zone cell');
        expect(() => catalog.registerFootprint({ ...shape('unknown-owner', L), owner: 'giants' })).toThrow('owner');
    });
    it('production creates/loads/commands reject components before replacing the old run', () => {
        const g = createHeadlessGame(7301, 'test'); g.animationEnabled = false;
        const saved = JSON.parse(JSON.stringify(g.toSnapshot())), previous = g.player, before = rng.getState();
        const bad = structuredClone(saved); bad.player.spatial = { schema: 1, footprintId: 'builtin:square-2', pose: 'r0' };
        expect(g.loadSnapshot(bad)).toBe(false); expect(g.player).toBe(previous); expect(rng.getState()).toEqual(before);
        const unopened = structuredClone(saved); unopened.run.spatialWorld = { schema: 1, definitions: { footprints: [], bodies: [] }, groups: [] }; expect(g.loadSnapshot(unopened)).toBe(false);
        const old = structuredClone(saved); old.version = 2; expect(g.loadSnapshot(old)).toBe(false);
        const recording = g.exportRecording(); expect(recording.version).toBe(4); (recording as any).version = 2; expect(g.loadReplay(recording)).toBe(false);
        const m = rat(); m.spatial = { schema: 1, footprintId: 'builtin:square-2', pose: 'r0', actionLockInTicks: 0 }; expect(() => g.monsters.push(m)).toThrow('not open'); expect(g.monsters).not.toContain(m);
        g.player.spatial = m.spatial; const tick = g.absoluteTurnNumber; expect(() => g.executeCommand('wait')).toThrow('not open'); expect(g.absoluteTurnNumber).toBe(tick); delete g.player.spatial;
        expect(Object.prototype.hasOwnProperty.call(g.toSnapshot().run, 'spatialWorld')).toBe(false);
    });
    it('stage3 facade returns implicit identities, nearest contact and single-cell targets', () => {
        const g = createHeadlessGame(7301, 'test'), m = rat(g.player.x + 1, g.player.y); g.monsters = [m];
        expect(g.spatialOf(m.id)).toMatchObject({ entityId: m.id, groupId: m.id, partId: null, footprintId: 'builtin:single', pose: 'r0' });
        expect(g.nearestContact(g.player.id, m.id).distance).toBe(1); expect(distanceBetweenFootprints(g.player, m)).toBe(1);
        expect(g.collectBodyTargets([m.loc, m.loc], { effect: 'area-damage' })).toHaveLength(1);
        expect(g.canStepFootprint(g.player.id, m.loc)).toBe(false);
    });
    it('native whole-run root round-trips current/cached footprints without ExtensionRuntime', () => {
        const game = createHeadlessGame(7301, 'test');
        expect(game.extensionRuntime).toBeNull();
        const saved = JSON.parse(JSON.stringify(game.toSnapshot()));
        const catalog = new SpatialCatalog(true), a = rat(20, 10), b = rat(20, 10);
        catalog.registerFootprint(shape('fixture-square', [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]));
        for (const c of [a, b]) c.spatial = { schema: 1, footprintId: 'fixture-square', pose: 'r0' };
        const f = new CreatureSpatial({ grid: game.grid, monsters: [a] }, catalog);
        const cached = new CreatureSpatial({ grid: game.grid, monsters: [b] }, catalog);
        saved.monsters = [serializeMonsterRow(a)]; saved.dormantMonsters = [];
        // Same coordinates on a detached cached layer are legal.
        saved.levels = [{ ...structuredClone(saved), depth: 2, monsters: [serializeMonsterRow(b)] }];
        saved.levelSeeds[1].visited = true;
        saved.run.spatialWorld = snapshotNativeSpatialWorld(new Map([[1, f], [2, cached]]));
        expect(isWholeRunSnapshot(saved)).toBe(false); expect(isWholeRunSnapshot(saved, catalog)).toBe(true);
        expect(() => decodeWholeRunWorld(saved, entityCodecDeps)).toThrow('not open');
        const before = rng.getState();
        const loaded = decodeWholeRunWorld(saved, { ...entityCodecDeps, spatialCatalog: catalog });
        expect(loaded.spatialLevels?.size).toBe(2);
        expect(loaded.spatialLevels!.get(1)!.creatureAtCell({ x: 21, y: 11 })!.id).toBe(a.id);
        expect(loaded.spatialLevels!.get(2)!.creatureAtCell({ x: 21, y: 11 })!.id).toBe(b.id);
        expect(snapshotNativeSpatialWorld(loaded.spatialLevels!)).toEqual(saved.run.spatialWorld);
        expect(rng.getState()).toEqual(before);
        for (const mutate of [(s: typeof saved) => { s.levels[0].monsters = [serializeMonsterRow(a)]; },
            (s: typeof saved) => { s.run.spatialWorld.definitions.footprints.push(s.run.spatialWorld.definitions.footprints[0]); },
            (s: typeof saved) => { s.monsters[0].spatial.movementRegionId = 12; },
            (s: typeof saved) => { s.monsters[0].loc.x = -1; }]) {
            const bad = structuredClone(saved); mutate(bad);
            expect(() => decodeWholeRunWorld(bad, { ...entityCodecDeps, spatialCatalog: catalog })).toThrow();
        }
        expect(snapshotNativeSpatialWorld(new Map())).toBeUndefined();
    });
    it('all production creature writes use the primitive; construction/codec and items stay point-based', () => {
        for (const path of ['src/entities/Monster.ts', 'src/engine/Core/Game.ts', 'src/engine/Core/GenerationCoordinator.ts', 'src/engine/Movement/LevelTravel.ts']) {
            const text = readFileSync(path, 'utf8');
            expect(text).not.toMatch(/\b(?:this\.player|ports\.player|this|m|mon|monst|target|caster|ally|passenger|occupant|candidate|guardian|clone)\.loc(?:\.[xy])?\s*=(?!=)/);
        }
        const player = new Player(3, 3), { grid, catalog } = scene(); player.spatial = { schema: 1, footprintId: 'builtin:square-2', pose: 'r0' };
        expect(() => new CreatureSpatial({ grid, player, monsters: [] }, catalog)).toThrow('Player');
    });
});

const bodyDefinition = (): BodyDefinition => ({ id: 'fixture-body', owner: 'foundation', minSupportParts: 1, noSupport: 'immobile', coreDeath: 'remove-members', statusProfileId: 'foundation:native',
    parts: ['core', 'leg'].map(partId => ({ partId, role: partId === 'core' ? 'core' : 'support', providesSupport: true, formId: 'fixture-form', preferredOffset: { x: partId === 'core' ? 0 : 1, y: 0 }, attackProfileIds: [], coreTransfer: { numerator: 1, denominator: 2 }, breakRuleId: 'foundation:keep-zone', statusProfileId: 'foundation:native' })),
    constraints: [{ childPartId: 'leg', parentPartId: 'core', kind: 'tether', minDistance: 1, maxDistance: 3, maxStepPerAction: 1, requiresClearLink: false }] });
describe('native body identity graph fixtures (no scheduling or body combat)', () => {
    it('persists stable group/part keys and rejects orphan/shared/core/cyclic/ownership/overlap errors', () => {
        const { grid, catalog } = scene(); const core = rat(3, 3), leg = rat(4, 3); catalog.registerForm({ id: 'fixture-form', owner: 'foundation', footprintId: 'builtin:single' }); catalog.registerBody(bodyDefinition());
        for (const [c, partId] of [[core, 'core'], [leg, 'leg']] as const) c.spatial = { schema: 1, footprintId: 'builtin:single', pose: 'r0', bodyMember: { groupId: core.id, partId } };
        const f = new CreatureSpatial({ grid, monsters: [core, leg] }, catalog);
        const group: BodyGroupState = { schema: 1, groupId: core.id, coreId: core.id, bodyDefinitionId: 'fixture-body', members: [core, leg].map((c, i) => ({ partId: i ? 'leg' : 'core', entityId: c.id, life: 'active', generation: 0, readyInTicks: 0 })), appliedBreaks: [] };
        f.groups.push(group); const saved = f.snapshotWorld()!; f.restoreWorld(saved);
        expect(f.membersOf(core.id).map(v => v.entityId)).toEqual([core.id, leg.id]);
        expect(() => f.planPlacement([{ creature: leg, at: { x: 5, y: 3 } }])).toThrow('Composite');
        expect(f.collectBodyTargets([core.loc, leg.loc], { dedup: 'part' })).toHaveLength(2); expect(f.collectBodyTargets([core.loc, leg.loc], { dedup: 'group' })).toHaveLength(1);
        for (const mutate of [(s: typeof saved) => { s.groups[0]!.coreId++; }, (s: typeof saved) => { s.groups[0]!.members[1]!.entityId = core.id; },
            (s: typeof saved) => { s.groups[0]!.members[0]!.entityId = null; }, (s: typeof saved) => { s.groups = []; }]) {
            const bad = structuredClone(saved); mutate(bad); expect(() => f.restoreWorld(bad)).toThrow(); expect(f.snapshotWorld()).toEqual(saved);
        }
        const unknownForm = bodyDefinition(); unknownForm.id = 'unknown-form-body';
        unknownForm.parts = unknownForm.parts.map(p => ({ ...p, formId: 'missing-form' })); expect(() => catalog.registerBody(unknownForm)).toThrow('Unknown spatial form');
        const unknownBreak = bodyDefinition(); unknownBreak.id = 'unknown-break-body';
        unknownBreak.parts = unknownBreak.parts.map(p => ({ ...p, breakRuleId: 'missing-break' })); expect(() => catalog.registerBody(unknownBreak)).toThrow('break rule');
        const unknownStatus = bodyDefinition(); unknownStatus.id = 'unknown-status-body'; unknownStatus.statusProfileId = 'missing-status'; expect(() => catalog.registerBody(unknownStatus)).toThrow('status profile');
        const whole = JSON.parse(JSON.stringify(createHeadlessGame(7301, 'test').toSnapshot()));
        whole.player.loc = { x: 14, y: 12 };
        whole.monsters = [core, leg].map(serializeMonsterRow); whole.dormantMonsters = []; whole.entityGraph.monsters = []; whole.visibleMonsterIds = [];
        whole.run.spatialWorld = snapshotNativeSpatialWorld(new Map([[whole.depth, f]]));
        const decoded = decodeWholeRunWorld(whole, { ...entityCodecDeps, spatialCatalog: catalog });
        expect(decoded.spatialLevels!.get(whole.depth)!.membersOf(core.id).map(v => v.entityId)).toEqual([core.id, leg.id]);
        expect(snapshotNativeSpatialWorld(decoded.spatialLevels!)).toEqual(whole.run.spatialWorld);
        const clone = leg.copyForClone(); expect(clone.spatial!.bodyMember).toEqual(leg.spatial!.bodyMember); expect(clone.spatial!.bodyMember).not.toBe(leg.spatial!.bodyMember);
        const cyclic = bodyDefinition(); cyclic.id = 'cyclic'; cyclic.constraints = [...cyclic.constraints, { ...cyclic.constraints[0]!, childPartId: 'core', parentPartId: 'leg' }]; expect(() => catalog.registerBody(cyclic)).toThrow();
        const split = new CreatureSpatial({ grid, monsters: [core], dormantMonsters: [leg] }, catalog); expect(() => split.restoreWorld(saved)).toThrow('ownership');
        commitCreatureAnchor(leg, { ...core.loc }, 'replace', true); expect(() => f.creatureAtCell(core.loc)).toThrow('Overlapping');
    });
});
