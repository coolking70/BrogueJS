import { describe, expect, it, vi } from 'vitest';
import type { Monster } from '../entities/Monster';
import { getNextEntityId } from '../entities/Creature';
import { CreatureSpatial, assertNativeSpatial } from '../engine/Movement/CreatureSpatial';
import { SpatialCatalog, compileFootprint, validateSpatialComponent, type FootprintDefinition, type PartBreakRule } from '../engine/Movement/SpatialSchema';
import { advanceFixedZoneLock, fixedZoneAttackAvailable, fixedZoneBreaks, fixedZoneDamageMultiplier,
    fixedZoneMoveTicks, initialLocalZoneState, resolveFixedZoneHit } from '../engine/Combat/FixedZoneHealth';
import { rng } from '../engine/Random';
import { entityCodecDeps, restoreEntityGraph, serializeMonsterRow } from '../engine/Core/EntitySnapshot';
import { decodeWholeRunWorld, isWholeRunSnapshot, snapshotNativeSpatialWorld } from '../engine/Core/WholeRunSnapshot';
import { createHeadlessGame } from './harness';
import { definition, fixedZoneScene, ratio, rules } from './fixtures/fixedZones';


describe('4c-0 fixed local zone fixture health and D08', () => {
    it('folds repeated same-zone cells within a segment and permits a fresh segment', () => {
        const { spatial, actor, input } = fixedZoneScene(), scope = new Set<string>();
        const cells = spatial.footprintOf(actor).filter(p => p.zoneId === 'shell');
        const targets = spatial.collectBodyTargets([...cells, ...cells, ...cells], { effect: 'geometry' }, scope);
        expect(targets).toHaveLength(1);
        expect(resolveFixedZoneHit(spatial, targets[0]!, input(6))).toMatchObject({ postProtectionDamage: 4, localHpLost: 4, nativeHpLost: 4 });
        expect(spatial.collectBodyTargets(cells, { effect: 'geometry' }, scope)).toHaveLength(0);
        expect(actor.hp).toBe(96);
        const next = spatial.collectBodyTargets(cells, { effect: 'geometry' });
        resolveFixedZoneHit(spatial, next[0]!, input(6, 2)); expect(actor.hp).toBe(92);
    });
    it.each(['geometry', 'area-damage'] as const)('%s hits two local zones once each (intentional two transfers)', effect => {
        const { spatial, actor, input } = fixedZoneScene(), cells = spatial.footprintOf(actor).filter(p => ['shell', 'leg'].includes(p.zoneId));
        const targets = spatial.collectBodyTargets([...cells, ...cells], { effect }); expect(targets.map(t => t.zoneId)).toEqual(['shell', 'leg']);
        const results = targets.map(t => resolveFixedZoneHit(spatial, t, input(6)));
        expect(results.map(r => r.localHpLost)).toEqual([4, 6]); expect(actor.hp).toBe(90);
    });
    it.each(['mental', 'identity', 'healing', 'death'] as const)('%s keeps a single group key', effect => {
        const { spatial, actor } = fixedZoneScene();
        expect(spatial.collectBodyTargets(spatial.footprintOf(actor), { effect })).toHaveLength(1);
    });
    it.each(['core', 'body'])('direct %s uses native HP exactly once without local/self transfer', zoneId => {
        const { spatial, actor, target, input } = fixedZoneScene(), before = structuredClone(actor.spatial!.zoneState);
        expect(resolveFixedZoneHit(spatial, target(zoneId), input(7))).toMatchObject({ localHpLost: 0, nativeHpLost: 7, breakReceipt: null });
        expect(actor.hp).toBe(93); expect(actor.spatial!.zoneState).toEqual(before);
    });
    it('ordinary unzoned creatures keep spatial absence and a single native HP subtraction', () => {
        const { actor, spatial, input } = fixedZoneScene(); spatial.setSpatial(actor);
        const target = spatial.collectBodyTargets([actor.loc])[0]!;
        expect(resolveFixedZoneHit(spatial, target, input(7))).toMatchObject({ nativeHpLost: 7, localHpLost: 0, breakReceipt: null });
        expect(actor.hp).toBe(93); expect(actor).not.toHaveProperty('spatial'); expect(serializeMonsterRow(actor)).not.toHaveProperty('spatial');
    });
    it('caps local loss AND 1:1 owner conduction at pre-hit positive local HP, preserving footprint', () => {
        const { spatial, actor, target, input, catalog } = fixedZoneScene(), body = spatial.footprintOf(actor);
        const result = resolveFixedZoneHit(spatial, target(), input(100));
        expect(result).toMatchObject({ postProtectionDamage: 98, localHpLost: 12, nativeHpLost: 12,
            breakReceipt: { groupId: actor.id, partId: 'self', zoneId: 'shell', generation: 0 }, breakHandling: 'fallback' });
        expect(actor.hp).toBe(88); expect(actor.spatial!.zoneState![0]).toMatchObject({ hp: 0, broken: true });
        expect(actor.spatial!.actionLockInTicks).toBe(25); expect(spatial.footprintOf(actor)).toEqual(body);
        const again = resolveFixedZoneHit(spatial, target(), input(100, 2));
        expect(again).toMatchObject({ postProtectionDamage: 0, localHpLost: 0, nativeHpLost: 0, breakReceipt: null });
        expect(fixedZoneBreaks(actor, catalog)).toHaveLength(1); expect(Object.isFrozen(result.breakReceipt)).toBe(true);
    });
    it('caps owner loss at remaining native HP without pretending local HP is native HP', () => {
        const { spatial, actor, target, input } = fixedZoneScene(); actor.hp = 3;
        expect(resolveFixedZoneHit(spatial, target(), input(100))).toMatchObject({ localHpLost: 12, nativeHpLost: 3 });
        expect(actor.hp).toBe(0); expect(actor.deathProcessed).toBe(false);
    });
    it('applies zone armor then integer multiplier once; misses and armor absorption cause no loss', () => {
        const { spatial, actor, target, input } = fixedZoneScene();
        expect(resolveFixedZoneHit(spatial, target(), { ...input(0), hit: false }).nativeHpLost).toBe(0);
        expect(resolveFixedZoneHit(spatial, target(), input(2)).postProtectionDamage).toBe(0);
        expect(resolveFixedZoneHit(spatial, target(), { ...input(2), kind: 'other' }).localHpLost).toBe(2);
        expect(actor.hp).toBe(98);
    });
    it('floors fractional zone damage once and transfers that amount without applying protection again', () => {
        const { spatial, actor, catalog, input } = fixedZoneScene(), d = definition();
        d.id = 'fixture:fractional'; d.zones![0]!.damageMultiplier = ratio(3, 2); catalog.registerFootprint(d);
        spatial.setSpatial(actor, { schema: 1, footprintId: d.id, pose: 'r0', zoneState: initialLocalZoneState(catalog, d.id) });
        const target = spatial.collectBodyTargets([actor.loc])[0]!;
        expect(resolveFixedZoneHit(spatial, target, input(5))).toMatchObject({ postProtectionDamage: 4, localHpLost: 4, nativeHpLost: 4 });
        expect(actor.hp).toBe(96); expect(actor.spatial!.zoneState![0]!.hp).toBe(8);
    });
    it('does not invoke native damage/attack/physicalResolved hooks, allocate IDs, or take either RNG', () => {
        const { spatial, actor, target, input } = fixedZoneScene(), takeDamage = vi.spyOn(actor, 'takeDamage');
        const before = { rng: rng.getState(), next: getNextEntityId(), death: actor.deathProcessed,
            carried: actor.carriedItem, extension: actor.extensionHooks };
        resolveFixedZoneHit(spatial, target(), input(14));
        expect(takeDamage).not.toHaveBeenCalled();
        expect({ rng: rng.getState(), next: getNextEntityId(), death: actor.deathProcessed,
            carried: actor.carriedItem, extension: actor.extensionHooks }).toEqual(before);
    });
    it('derives exposure, attack removal and speed idempotently; two exposure declarations use the largest ratio', () => {
        const { spatial, actor, target, input, catalog } = fixedZoneScene();
        expect(fixedZoneAttackAvailable(actor, 'smash', catalog)).toBe(true); expect(fixedZoneMoveTicks(actor, 101, catalog)).toBe(101);
        resolveFixedZoneHit(spatial, target(), input());
        for (let i = 0; i < 3; i++) {
            expect(fixedZoneMoveTicks(actor, 101, catalog)).toBe(152);
            expect(fixedZoneDamageMultiplier(actor, 'core', catalog)).toEqual(ratio(2));
            expect(fixedZoneAttackAvailable(actor, 'smash', catalog)).toBe(false);
        }
        expect(fixedZoneAttackAvailable(actor, 'bite', catalog)).toBe(true);
        expect(resolveFixedZoneHit(spatial, target('core'), input(5)).nativeHpLost).toBe(10);
        resolveFixedZoneHit(spatial, target('leg'), input(10, 3));
        expect(fixedZoneDamageMultiplier(actor, 'core', catalog)).toEqual(ratio(3)); expect(fixedZoneMoveTicks(actor, 101, catalog)).toBe(303);
    });
    it('keeps a longer existing lock, decrements by objective fixture ticks and removes only the expired lock', () => {
        const { spatial, actor, target, input, catalog } = fixedZoneScene(); actor.spatial!.actionLockInTicks = 30;
        resolveFixedZoneHit(spatial, target(), input()); expect(actor.spatial!.actionLockInTicks).toBe(30);
        advanceFixedZoneLock(actor, 7, catalog); expect(actor.spatial!.actionLockInTicks).toBe(23);
        advanceFixedZoneLock(actor, 30, catalog); expect(actor.spatial).not.toHaveProperty('actionLockInTicks');
        expect(fixedZoneBreaks(actor, catalog)).toHaveLength(1);
    });
    it('labels and local state follow four orientations, including negative offsets, without relocating the anchor', () => {
        const { spatial, actor, target, input } = fixedZoneScene(); resolveFixedZoneHit(spatial, target(), input(6));
        const state = structuredClone(actor.spatial!.zoneState), anchor = { ...actor.loc };
        for (const pose of ['r0', 'r90', 'r180', 'r270'] as const) {
            spatial.setSpatial(actor, { ...actor.spatial!, pose });
            expect(spatial.footprintOf(actor).filter(p => p.zoneId === 'shell')).toHaveLength(2);
            expect(actor.loc).toEqual(anchor); expect(actor.spatial!.zoneState).toEqual(state);
        }
    });
});

describe('4c-0 strict fixed zone boundary and fixture persistence', () => {
    it.each([
        (d: FootprintDefinition) => { d.zoneCells = [...d.zoneCells!, { x: 8, y: 8, zoneId: 'shell' }]; },
        (d: FootprintDefinition) => { d.zoneCells = [...d.zoneCells!, d.zoneCells![0]!]; },
        (d: FootprintDefinition) => { d.zoneCells![0]!.zoneId = 'missing'; },
        (d: FootprintDefinition) => { d.zones![0]!.damageMultiplier.denominator = 0; },
        (d: FootprintDefinition) => { Object.assign(d.zones![0]!.health, { regenerateInTicks: 1 }); },
        (d: FootprintDefinition) => { Object.assign(d.zones![0]!, { generation: 1 }); },
        (d: FootprintDefinition) => { Object.assign(d.zones![0]!.health, { maxCycles: 1 }); },
    ])('rejects malformed label/ratio/regeneration definition %#', mutate => {
        const d = definition(); mutate(d); expect(() => compileFootprint(d)).toThrow();
    });
    it.each([
        (r: PartBreakRule) => { r.regenerate = { delayTicks: 3, formId: 'x', maxCycles: 1 }; },
        (r: PartBreakRule) => { r.replacementFootprintId = 'builtin:single'; },
        (r: PartBreakRule) => { r.disposition = 'remove'; },
        (r: PartBreakRule) => { r.modifiers = [{ kind: 'locomotion', mode: 'flying' }]; },
        (r: PartBreakRule) => { r.modifiers = [{ kind: 'move-ticks-multiplier', numerator: 0, denominator: 1 }]; },
        (r: PartBreakRule) => { r.modifiers = [r.modifiers[0]!, r.modifiers[0]!]; },
    ])('rejects unopened break declarations %#', mutate => {
        const r = rules()[0]!; mutate(r); expect(() => new SpatialCatalog(true).registerBreakRule(r)).toThrow();
    });
    it('requires known self exposure targets and fixed 1:1 transmission before enabling fixture damage', () => {
        const cat = new SpatialCatalog(true), r = rules()[0]!;
        r.modifiers = [{ kind: 'expose-zone', partId: 'self', zoneId: 'missing', damageMultiplier: ratio(2) }];
        cat.registerBreakRule(r); cat.registerBreakRule(rules()[1]!); expect(() => cat.registerFootprint(definition())).toThrow('exposure reference');
        const d = definition(); Object.assign(d.zones![0]!.health, { ownerTransfer: ratio(1, 4) });
        const other = new SpatialCatalog(true); rules().forEach(r => other.registerBreakRule(r)); other.registerFootprint(d);
        expect(() => initialLocalZoneState(other, d.id)).toThrow('1:1');
    });
    it.each([
        (s: NonNullable<Monster['spatial']>) => { s.zoneState![0]!.hp = -1; },
        (s: NonNullable<Monster['spatial']>) => { s.zoneState![0]!.hp = 13; },
        (s: NonNullable<Monster['spatial']>) => { s.zoneState![0]!.hp = .5; },
        (s: NonNullable<Monster['spatial']>) => { s.zoneState![0]!.hp = 0; },
        (s: NonNullable<Monster['spatial']>) => { s.zoneState![0]!.broken = true; },
        (s: NonNullable<Monster['spatial']>) => { s.zoneState![0]!.zoneId = 'core'; },
        (s: NonNullable<Monster['spatial']>) => { s.zoneState!.push(s.zoneState![0]!); },
        (s: NonNullable<Monster['spatial']>) => { s.zoneState!.pop(); },
        (s: NonNullable<Monster['spatial']>) => { s.zoneState![0]!.generation = 1; },
        (s: NonNullable<Monster['spatial']>) => { s.zoneState![0]!.regenerateInTicks = 0; },
        (s: NonNullable<Monster['spatial']>) => { Object.assign(s.zoneState![0]!, { maxCycles: 1 }); },
    ])('rejects bad local HP/label/generation/load state before allocation %#', mutate => {
        const { actor, catalog } = fixedZoneScene(), row = serializeMonsterRow(actor); mutate(row.spatial!);
        const allocateMonster = vi.fn(entityCodecDeps.allocateMonster);
        expect(() => restoreEntityGraph([row], [], [], [], { ...entityCodecDeps, spatialCatalog: catalog, allocateMonster })).toThrow();
        expect(allocateMonster).not.toHaveBeenCalled();
    });
    it('round-trips broken state/definition closure in entity and whole-world fixture codecs without applying modifiers twice', () => {
        const { actor, catalog, spatial, target, input, grid } = fixedZoneScene(); resolveFixedZoneHit(spatial, target(), input());
        const row = serializeMonsterRow(actor), root = spatial.snapshotWorld()!;
        const m = restoreEntityGraph([row], [], [], [], { ...entityCodecDeps, spatialCatalog: catalog }).monsters.get(actor.id)!;
        const loaded = new CreatureSpatial({ grid, monsters: [m] }, catalog); loaded.restoreWorld(root);
        expect(m.spatial).toEqual(actor.spatial); expect(m.spatial!.zoneState).not.toBe(actor.spatial!.zoneState);
        for (let i = 0; i < 3; i++) { loaded.restoreWorld(root); expect(fixedZoneMoveTicks(m, 100, catalog)).toBe(150); }
        const snapshot = JSON.parse(JSON.stringify(createHeadlessGame(7301, 'test').toSnapshot()));
        snapshot.player.loc = { x: 14, y: 12 }; snapshot.monsters = [row]; snapshot.dormantMonsters = [];
        snapshot.entityGraph.monsters = []; snapshot.visibleMonsterIds = [];
        snapshot.run.spatialWorld = snapshotNativeSpatialWorld(new Map([[snapshot.depth, loaded]]));
        expect(isWholeRunSnapshot(snapshot, catalog)).toBe(true);
        const decoded = decodeWholeRunWorld(snapshot, { ...entityCodecDeps, spatialCatalog: catalog });
        const decodedActor = decoded.spatialLevels!.get(snapshot.depth)!.creatureAtCell(actor.loc)!;
        expect(decodedActor.spatial).toEqual(actor.spatial); expect(fixedZoneMoveTicks(decodedActor, 100, catalog)).toBe(150);
        expect(snapshotNativeSpatialWorld(decoded.spatialLevels!)).toEqual(snapshot.run.spatialWorld);
        const old = structuredClone(row); resolveFixedZoneHit(loaded, loaded.collectBodyTargets([{ x: m.x + 2, y: m.y }])[0]!, input(5, 2));
        expect(old.hp).toBe(88); expect(m.hp).toBe(78);
    });
    it('rejects altered break table/exposure in saved closure; cloning owns independent state and modifiers are read-only', () => {
        const { actor, catalog, spatial, target, input } = fixedZoneScene(); resolveFixedZoneHit(spatial, target(), input());
        const saved = spatial.snapshotWorld()!, before = serializeMonsterRow(actor), rngBefore = rng.getState();
        const bad = structuredClone(saved); bad.definitions.breakRules!.find(r => r.id === 'fixture:shell-break')!.modifiers = [];
        expect(() => spatial.restoreWorld(bad)).toThrow('closure');
        const copy = actor.copyForClone(); expect(copy.spatial).toEqual(actor.spatial); expect(copy.spatial!.zoneState![0]).not.toBe(actor.spatial!.zoneState![0]);
        expect(fixedZoneBreaks(copy, catalog)[0]!.groupId).toBe(copy.id);
        fixedZoneMoveTicks(actor, 100, catalog); fixedZoneDamageMultiplier(actor, 'core', catalog); fixedZoneAttackAvailable(actor, 'smash', catalog);
        expect(serializeMonsterRow(actor)).toEqual(before); expect(rng.getState()).toEqual(rngBefore);
    });
    it('keeps production Game creation, loading and attack capability closed for local zones', () => {
        const { actor, catalog, spatial, target, input } = fixedZoneScene();
        expect(() => assertNativeSpatial(actor, catalog)).toThrow('not open');
        expect(() => new SpatialCatalog().registerBreakRule(rules()[0]!)).toThrow('unopened');
        expect(() => validateSpatialComponent(actor.spatial, catalog)).toThrow('not open');
        expect(() => restoreEntityGraph([serializeMonsterRow(actor)])).toThrow();
        const native = new CreatureSpatial({ grid: spatial.grid, monsters: [] });
        expect(() => resolveFixedZoneHit(native, target(), input())).toThrow('production');
    });
    it('rejects stale or group-routed contacts without mutation', () => {
        const { actor, spatial, input } = fixedZoneScene(), stale = spatial.collectBodyTargets([{ x: actor.x + 1, y: actor.y }])[0]!;
        spatial.setSpatial(actor, { ...actor.spatial!, pose: 'r180' }); const before = serializeMonsterRow(actor);
        expect(() => resolveFixedZoneHit(spatial, stale, input())).toThrow('contact');
        const group = spatial.collectBodyTargets(spatial.footprintOf(actor), { effect: 'mental' })[0]!;
        expect(() => resolveFixedZoneHit(spatial, group, input())).toThrow('contact'); expect(serializeMonsterRow(actor)).toEqual(before);
    });
});
