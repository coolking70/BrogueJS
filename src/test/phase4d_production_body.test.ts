import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyProductionArena, installProductionBody, productionBodyScene, PRODUCTION_BODY_ID, startProductionGame } from './support/productionComposite';
import { getNextEntityId } from '../entities/Creature';
import { rng } from '../engine/Random';
import { TerrainType as T } from '../engine/Map/Grid';
import { bodyMoveTicks, validateBodyGroup } from '../engine/Movement/BodyGroups';
import { commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { CombatSystem } from '../engine/Combat/Combat';
import { withBodyContact } from '../engine/Combat/BodyCombat';
import { logger } from '../engine/Systems/Logger';
import { MonsterState } from '../entities/Monster';
import { writeFileSync } from 'node:fs';
import { auditFullObjectGraph, fullGenerationRoots } from './support/fullGenerationCheckpointOracle';
import { Monster } from '../entities/Monster';
import { nativeFormData, nativeFormSpatial } from '../ext/nativeForms';

afterEach(() => { vi.restoreAllMocks(); logger.reset(); });
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const mechanical = (g: import('../engine/Core/Game').Game) => JSON.stringify({ groups: g.bodyGroups,
    actors: g.monsters.map(c => ({ id: c.id, hp: c.hp, loc: c.loc, spatial: c.spatial, ticks: c.ticksUntilTurn })), rng: rng.getState() });
describe('4d production composite birth, native owner, member damage and tombstones', () => {
    it('creates one authoritative group, independent entities/HP, and rejects an unavailable catalog', () => {
        const { game, core, group, actors } = productionBodyScene();
        expect(game.spatialCatalog.fixture).toBe(false); expect(actors).toHaveLength(9);
        expect(new Set(actors.map(c => c.id)).size).toBe(9); expect(group.groupId).toBe(core.id);
        validateBodyGroup(group, game.spatialCatalog, id => actors.find(c => c.id === id));
        expect(actors.map(c => game.isBodyDecisionOwner(c.id))).toEqual([true, ...Array(8).fill(false)]);
        const other = startProductionGame([], 7307); expect(() => other.createCompositeMonster(PRODUCTION_BODY_ID, { x: 14, y: 12 })).toThrow('Unavailable');
        expect(() => other.monsters.push(core)).toThrow('not open');
    });
    it('rejects a member using fixed-zone self identity at declaration and invalid live HP at group validation', () => {
        const {game, core, group} = productionBodyScene();
        const definition = json(game.spatialCatalog.body(PRODUCTION_BODY_ID)); definition.id = 'body-fixture.invalid-self';
        definition.parts[1]!.partId = 'self'; definition.constraints[0]!.childPartId = 'self';
        expect(() => game.spatialCatalog.registerBody(definition)).toThrow('Reserved');
        const hp = core.hp; core.hp = NaN;
        expect(() => validateBodyGroup(group, game.spatialCatalog, id => game.monsters.find(c => c.id === id))).toThrow('Invalid');
        core.hp = hp;
    });
    it('preflights the whole formation before IDs/RNG and rolls failed birth publication back atomically', () => {
        let fail = false;
        installProductionBody(8, undefined, () => { if (fail) throw new Error('birth rejection'); });
        const game = startProductionGame(['body-fixture'], 7307, 'wizard'); emptyProductionArena(game);
        game.grid.setTerrain(13, 11, T.WALL);
        const id = getNextEntityId(), random = rng.getState(), ext = json(game.extensionRuntime!.snapshot());
        expect(game.createCompositeMonster(PRODUCTION_BODY_ID, { x: 14, y: 12 })).toBeNull();
        expect(getNextEntityId()).toBe(id); expect(rng.getState()).toEqual(random); expect(game.bodyGroups).toBeUndefined();
        game.grid.setTerrain(13, 11, T.FLOOR); fail = true;
        const lists = game.monsters;
        expect(() => game.createCompositeMonster(PRODUCTION_BODY_ID, { x: 14, y: 12 })).toThrow('birth rejection');
        expect(game.monsters).toBe(lists); expect(game.monsters).toHaveLength(0); expect(game.bodyGroups).toBeUndefined();
        expect(getNextEntityId()).toBe(id); expect(rng.getState()).toEqual(random); expect(game.extensionRuntime!.snapshot()).toEqual(ext);
    });
    it('failed second-group publication agrees with the independent full-object rollback audit, including existing tombstones', () => {
        let fail = false;
        installProductionBody(8, undefined, () => { if (fail) throw new Error('second group rejection'); });
        const game = startProductionGame(); emptyProductionArena(game);
        game.createCompositeMonster(PRODUCTION_BODY_ID, {x:14,y:12});
        game.monsters[1]!.takeDamage(100, true);
        const group = game.bodyGroups![0]!, list = game.monsters, runtime = game.extensionRuntime!;
        const before = json(runtime.snapshot()), id = getNextEntityId(), random = rng.getState();
        const graph = auditFullObjectGraph(fullGenerationRoots(game), [runtime]);
        fail = true;
        expect(() => game.createCompositeMonster(PRODUCTION_BODY_ID, {x:30,y:12})).toThrow('second group rejection');
        expect(graph.differences()).toEqual([]); expect(game.monsters).toBe(list); expect(game.bodyGroups![0]).toBe(group);
        expect(runtime.snapshot()).toEqual(before); expect(getNextEntityId()).toBe(id); expect(rng.getState()).toEqual(random);
    });
    it('registered member geometry alone cannot grant an orphan publication or clone a slot', () => {
        const {game} = productionBodyScene();
        const form = game.extensionRuntime!.nativeForms().find(f => f.id === 'body-fixture.fixture-leg')!;
        const orphan = new Monster(30, 12, nativeFormData(form)); orphan.spatial = nativeFormSpatial(form);
        orphan.spatial.bodyMember = {groupId: 999999, partId: 'leg00'};
        expect(() => game.monsters.push(orphan)).toThrow('Unowned');
        expect(game.publishSquareMonster(orphan)).toBe(false);
        expect(game.cloneMonster(orphan)).toBeNull();
        const member = game.monsters[1]!, before = {...member.loc};
        expect(() => commitCreatureAnchor(member, {x:member.x + 1,y:member.y})).toThrow('whole-group');
        expect(member.loc).toEqual(before);
        const other = productionBodyScene().game;
        expect(() => other.monsters.push(member)).toThrow('Cross-session');
    });
    it.each([false, true])('real executeCommand advances only the core and elapsed slot cooldowns (combat=%s)', combat => {
        const { game, core, group, actors } = productionBodyScene(8, combat);
        const before = { ...core.loc }, memberTimers = actors.slice(1).map(c => c.ticksUntilTurn);
        group.members[1]!.readyInTicks = 350;
        for (let i = 0; i < 4; i++) game.executeCommand('wait');
        expect(core.loc).not.toEqual(before); expect(group.members[1]!.readyInTicks).toBe(0);
        expect(actors.slice(1).map(c => c.ticksUntilTurn)).toEqual(memberTimers); expect(core.ticksUntilTurn).toBeGreaterThan(0);
        validateBodyGroup(group, game.spatialCatalog, id => game.monsters.find(c => c.id === id));
    });
    it('hits distinct members once, transfers floor(min(post-shield damage, positive HP)/4), and never calls core takeDamage', () => {
        const { game, core, actors, group } = productionBodyScene();
        const a = actors[1]!, b = actors[2]!, spy = vi.spyOn(core, 'takeDamage'), hp = core.hp;
        const die = vi.spyOn(a as any, 'die');
        a.statusDurations.shielded = 40; a.maxShield = 40;
        a.takeDamage(12); expect(a.hp).toBe(12); expect(core.hp).toBe(hp - 2);
        const targets = game.collectBodyTargets([...footprintOf(a), ...footprintOf(b), ...footprintOf(a)], { effect: 'area-damage' });
        expect(targets).toHaveLength(2);
        for (const hit of targets) withBodyContact(hit.entity, hit.contact, () => hit.entity.takeDamage(100, true));
        expect(core.hp).toBe(hp - 2 - 3 - 5); expect(spy).not.toHaveBeenCalled();
        expect(group.appliedBreaks).toHaveLength(2); expect(group.members.filter(s => s.life === 'removed')).toHaveLength(2);
        expect(game.monsters).not.toContain(a); expect(game.monsters).not.toContain(b);
        expect(die).not.toHaveBeenCalled();
        expect(game.extensionRuntime!.snapshot().foundation.deaths[String(a.id)]).toBeUndefined();
        expect(bodyMoveTicks(game.spatialCatalog.body(group.bodyDefinitionId), group, game.spatialCatalog, 100)).toBe(127);
        const saved = json(game.toSaveSnapshot()); expect(game.loadSnapshot(saved)).toBe(true);
        expect(game.bodyGroups![0]).toEqual(group); expect(game.bodyGroups![0]).not.toBe(group);
    });
    it('whole mental collection deduplicates by group, while a direct core hit is only one HP loss', () => {
        const { game, core, actors } = productionBodyScene();
        expect(game.collectBodyTargets(actors.flatMap(c => footprintOf(c)), { effect: 'mental' })).toHaveLength(1);
        const hp = core.hp; core.takeDamage(17, true); expect(core.hp).toBe(hp - 17);
    });
    it('parallel immediate member attacks use separate scopes/cooldowns and charge max elapsed time', () => {
        const { game, core, group, actors } = productionBodyScene();
        commitCreatureAnchor(game.player, { x: 14, y: 10 });
        actors[1]!.attackSpeed = 70; actors[2]!.attackSpeed = 130;
        const attack = vi.spyOn(CombatSystem, 'attack');
        game.executeCommand('wait');
        expect(attack.mock.calls.map(([actor]) => actor.id)).toEqual([actors[1]!.id, actors[2]!.id]);
        expect(core.ticksUntilTurn).toBe(130);
        expect(group.members[1]!.readyInTicks).toBe(70); expect(group.members[2]!.readyInTicks).toBe(130);
        game.executeCommand('wait');
        expect(core.ticksUntilTurn).toBe(30);
        expect(group.members[1]!.readyInTicks).toBe(0); expect(group.members[2]!.readyInTicks).toBe(30);
        expect(actors[1]!.ticksUntilTurn).toBe(100); expect(actors[2]!.ticksUntilTurn).toBe(100);
    });
    it('at most four sources attack in a production core activation', () => {
        const data = installProductionBody();
        const around = [{x:3,y:-1},{x:4,y:-1},{x:5,y:-1},{x:3,y:0},{x:5,y:0},{x:3,y:1},{x:4,y:1},{x:5,y:1}];
        data.definition.parts.forEach((part, i) => { if (i) part.preferredOffset = around[i - 1]!; });
        data.definition.constraints.forEach(edge => { edge.maxDistance = 6; });
        const game = startProductionGame(['body-fixture'], 7307, 'wizard'); emptyProductionArena(game);
        const core = game.createCompositeMonster(PRODUCTION_BODY_ID, {x:14,y:12})!;
        core.behaviorFlags.add('MONST_ALWAYS_HUNTING'); core.state = MonsterState.HUNTING;
        commitCreatureAnchor(game.player, {x:18,y:12});
        const attack = vi.spyOn(CombatSystem, 'attack'); game.executeCommand('wait');
        expect(attack).toHaveBeenCalledTimes(4);
        expect(game.bodyGroups![0]!.members.filter(s => s.readyInTicks > 0)).toHaveLength(4);
    });
    it.each(['handled', 'fallback', 'throws'] as const)('member break provider is atomic and exclusive (%s)', mode => {
        const commit = vi.fn((_request: import('../ext/partBreak').PartBreakRequest, _plan: import('../ext/types').ReadonlyJson, context: import('../ext/partBreak').PartBreakCommitContext) => {
            context.setState({ ...context.state as object, revision: 99 } as import('../ext/types').Json);
            if (mode === 'throws') throw new Error('member provider failure');
        });
        const prepare = vi.fn((_request: import('../ext/partBreak').PartBreakRequest) => mode === 'fallback' ? { status: 'unsupported' as const, reason: 'unsupported-target' as const }
            : { status: 'ready' as const, plan: {} });
        installProductionBody(8, { prepare, commit }, undefined, true);
        const game = startProductionGame(['body-fixture'], 7307, 'wizard'); emptyProductionArena(game);
        const core = game.createCompositeMonster(PRODUCTION_BODY_ID, {x:14,y:12})!, leg = game.monsters[1]!;
        leg.statusDurations.shielded = 40; leg.maxShield = 40;
        const before = mechanical(game), extension = json(game.extensionRuntime!.snapshot());
        const hit = () => withBodyContact(leg, leg.loc, () => leg.takeDamage(100));
        if (mode === 'throws') {
            expect(hit).toThrow('member provider failure');
            expect(mechanical(game)).toBe(before); expect(leg.statusDurations.shielded).toBe(40); expect(leg.maxShield).toBe(40);
            expect(game.extensionRuntime!.snapshot()).toEqual(extension);
        } else {
            hit();
            expect(game.monsters).not.toContain(leg); expect(game.bodyGroups![0]!.appliedBreaks).toHaveLength(1);
            expect(core.spatial!.actionLockInTicks).toBe(mode === 'handled' ? undefined : 40);
            expect(commit).toHaveBeenCalledTimes(mode === 'handled' ? 1 : 0);
        }
        expect(prepare.mock.calls[0]![0]).toMatchObject({ actorId: core.id, groupId: core.id, partId: 'leg00', zoneId: 'body', generation: 0 });
    });
    it('fatal transfer attributes the core terminal once to the original hit without a second damage event', () => {
        const { game, core, actors } = productionBodyScene(); core.hp = 5;
        const runtime = game.extensionRuntime!, origin = runtime.causality.create('melee', game.player.id);
        const emit = vi.spyOn(runtime, 'emit');
        runtime.causality.withOrigin(origin, () => actors[1]!.takeDamage(100, true));
        const kills = emit.mock.calls.filter(([name]) => name === 'kill'); expect(kills).toHaveLength(1);
        expect(kills[0]![1]).toMatchObject({ creature: {id:core.id}, origin: { actorId: game.player.id } });
        expect(emit.mock.calls.filter(([name]) => name === 'damage')).toHaveLength(1);
        expect(game.bodyGroups).toBeUndefined(); expect(game.monsters).toEqual([core]);
    });
    it('all supports removed block movement but retain the core native attack; core death emits one terminal fact', () => {
        const { game, core, actors, group } = productionBodyScene();
        for (const leg of actors.slice(1)) leg.takeDamage(100, true);
        expect(game.monsters).toEqual([core]); expect(group.appliedBreaks).toHaveLength(8);
        const before = { ...core.loc }; game.executeCommand('wait'); expect(core.loc).toEqual(before); expect(core.ticksUntilTurn).toBeGreaterThan(0);
        commitCreatureAnchor(game.player, { x: core.x + 2, y: core.y }); core.accuracy = 10000;
        const attack = vi.spyOn(CombatSystem, 'attack'); for (let i = 0; i < 3; i++) game.executeCommand('wait'); expect(attack).toHaveBeenCalledWith(core, game.player, expect.anything());
        const kills = vi.spyOn(game.extensionRuntime!, 'emit'); core.takeDamage(10000, true);
        expect(game.bodyGroups).toBeUndefined();
        expect(kills.mock.calls.filter(([name]) => name === 'kill')).toHaveLength(1);
        game.killMonster(core); expect(kills.mock.calls.filter(([name]) => name === 'kill')).toHaveLength(1);
    });
    it('breaking a chain parent retires the subtree with one receipt, one transfer and no descendant damage/death hook', () => {
        const data = installProductionBody(); data.definition.constraints[1]!.parentPartId = 'leg00';
        const game = startProductionGame(); emptyProductionArena(game);
        const core = game.createCompositeMonster(PRODUCTION_BODY_ID, {x:14,y:12})!, parent = game.monsters[1]!, child = game.monsters[2]!;
        const emit = vi.spyOn(game.extensionRuntime!, 'emit'), hp = core.hp;
        parent.takeDamage(100, true);
        expect(core.hp).toBe(hp - 5); expect(game.monsters).not.toContain(parent); expect(game.monsters).not.toContain(child);
        expect(game.bodyGroups![0]!.appliedBreaks).toEqual([{partId:'leg00',zoneId:'body',generation:0}]);
        expect(game.bodyGroups![0]!.members.filter(s => s.life === 'removed').map(s => s.partId)).toEqual(['leg00','leg01']);
        expect(emit.mock.calls.filter(([name]) => name === 'damage')).toHaveLength(1);
        expect(emit.mock.calls.filter(([name]) => name === 'kill')).toHaveLength(0);
        expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    });
    it('group roots are global while cached-layer and dormant ownership remains a whole physical cohort', () => {
        const {game, group} = productionBodyScene();
        const saved = json(game.toSaveSnapshot());
        const cached = {...saved, depth:2, monsters:saved.monsters, dormantMonsters:[], visibleMonsterIds:[]};
        saved.monsters = []; saved.visibleMonsterIds = []; saved.levels.push(cached); saved.levelSeeds[1]!.visited = true;
        expect(game.loadSnapshot(saved)).toBe(true); expect(game.monsters).toHaveLength(0);
        expect(game.levels.get(2)!.monsters).toHaveLength(9); expect(game.bodyGroups![0]).toEqual(group);
        expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
        const foreground = json(game.toSaveSnapshot()), layer = foreground.levels[0]!;
        layer.dormantMonsters = layer.monsters; layer.monsters = [];
        for (const actor of layer.dormantMonsters) actor.isDormant = true;
        expect(game.loadSnapshot(foreground)).toBe(true);
        expect(game.levels.get(2)!.dormantMonsters).toHaveLength(9);
    });
    it('load rejects changed declarations, forged receipts, orphan/split ownership without changing the live run', () => {
        const { game, group } = productionBodyScene();
        const saved = json(game.toSaveSnapshot()); expect(game.loadSnapshot(saved)).toBe(true);
        for (const edit of [
            (s: typeof saved) => { s.run.spatialWorld!.definitions.bodies[0]!.parts[1]!.coreTransfer.denominator = 3; },
            (s: typeof saved) => { s.run.spatialWorld!.groups[0]!.appliedBreaks.push({ partId: 'core', zoneId: 'body', generation: 0 }); },
            (s: typeof saved) => { s.run.spatialWorld!.groups[0]!.members[1]!.entityId = group.coreId; },
            (s: typeof saved) => { s.run.spatialWorld!.groups = []; },
            (s: typeof saved) => { s.dormantMonsters.push(s.monsters.splice(1, 1)[0]!); },
        ]) {
            const bad = json(saved); edit(bad); const before = mechanical(game), id = getNextEntityId();
            expect(game.loadSnapshot(bad)).toBe(false); expect(mechanical(game)).toBe(before); expect(getNextEntityId()).toBe(id);
        }
    });
    it('save/load restores independently owned group state and reproduces later command trajectories/RNG', () => {
        const { game } = productionBodyScene(); game.executeCommand('wait');
        const saved = json(game.toSaveSnapshot());
        const states: string[] = []; for (let i = 0; i < 3; i++) { game.executeCommand('wait'); states.push(mechanical(game)); }
        expect(game.loadSnapshot(saved)).toBe(true);
        for (let i = 0; i < 3; i++) { game.executeCommand('wait'); expect(mechanical(game)).toBe(states[i]); }
    });
    it('records real executeCommand timings for one core + 16 independent members', () => {
        const { game, actors } = productionBodyScene(16); expect(actors).toHaveLength(17);
        const timings: number[] = []; let moves = 0;
        for (let i = 0; i < 20; i++) { const at = {...actors[0]!.loc}, start = performance.now(); game.executeCommand('wait'); timings.push(performance.now() - start);
            if (at.x !== actors[0]!.x || at.y !== actors[0]!.y) moves++; }
        const sorted = timings.slice(1).sort((a, b) => a - b);
        const report = { entities: 17, commands: 20, commandsWithMovement: moves, coldMs: timings[0],
            warmP50Ms: sorted[Math.floor(sorted.length / 2)], warmP95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: Math.max(...timings) };
        console.info('P4D1_REAL_COMMAND_PERF', JSON.stringify(report));
        if (process.env.BROGUE_CAPTURE_BODY_COMMAND_PERF) writeFileSync(process.env.BROGUE_CAPTURE_BODY_COMMAND_PERF, JSON.stringify(report, null, 2) + '\n');
        expect(timings.every(Number.isFinite)).toBe(true);
    });
});
