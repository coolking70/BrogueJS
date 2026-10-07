import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { ActorActionAuthority, validateActorActionResources, type ActorActionRequest } from '../engine/Core/ActorActionAuthority';
import { assertActorActionScope, withActorActionScope, type ActorActionScope } from '../engine/Core/ActorActionScope';
import { projectAttackShape, sourceFootprintVersion } from '../engine/Movement/AttackShape';
import { commitCreatureAnchor } from '../engine/Movement/CreatureSpatial';
import { withActorActionScheduler } from '../engine/Core/ActorActionSession';
import { createActorActionScheduler, type ActorActionSchedulerState } from '../engine/Core/ActorActionScheduler';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { rng } from '../engine/Random';
import { TerrainType } from '../engine/Map/Grid';
import { timeSystem } from '../engine/Systems/Time';
import { logger } from '../engine/Systems/Logger';

function fixture() {
    const game = createHeadlessGame(7301, 'test'); game.animationEnabled = false; game.monsters = []; game.items = [];
    for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++)
        if (game.grid.isValidPos(game.player.x + dx, game.player.y + dy)) game.grid.setTerrain(game.player.x + dx, game.player.y + dy, TerrainType.FLOOR);
    const state: ActorActionSchedulerState = { schema: 1, bundles: [] };
    const resources = { schema: 1 as const, revision: 0, nextActionId: 1, stamina: 50 };
    const resolve = vi.fn(), finish = vi.fn(), fault = vi.fn();
    const actor = (id: number) => id === game.player.id ? game.player : game.monsters.find(m => m.id === id);
    const scheduler = createActorActionScheduler(state, {
        decisionOwnerId: id => id,
        readActor: id => { const a = actor(id); return a ? { ticksUntilTurn: a.ticksUntilTurn, alive: a.hp > 0 } : null; },
        writeOwnerTicks: (id, ticks) => { actor(id)!.ticksUntilTurn = ticks; },
        resolveSegment: resolve, finishAction: finish, onFault: fault,
        isSourceValid: source => !!actor(source.sourceEntityId),
    });
    const authority = new ActorActionAuthority(game, resources, scheduler);
    const request: ActorActionRequest = { schema: 1, kind: 'phased-native', origin: 'player-command',
        sourceEntityId: game.player.id, decisionOwnerId: game.player.id, timeChargeOwnerId: game.player.id,
        cost: 7, windupTicks: 17, recoveryTicks: 23,
        shape: { schema: 1, kind: 'footprint-offset-union', offsets: [{ x: 1, y: 0 }], selfExclusion: 'whole-group' } };
    const plan = () => { const result = authority.prepareActorAction(request); if (result.status !== 'ready') throw new Error(result.reason); return result.plan; };
    return { game, state, resources, scheduler, authority, request, plan, resolve, finish, fault };
}
afterEach(() => { vi.restoreAllMocks(); logger.reset(); });

describe('3a0 engine actor preparation and synchronous authority', () => {
    it('prepares immutable finite data without RNG, fee, timer or action allocation', () => {
        const f = fixture(), random = rng.getState(), before = f.game.toSnapshot(), p = f.plan();
        expect(Object.isFrozen(p)).toBe(true); expect(Object.isFrozen(p.request.shape.offsets)).toBe(true);
        expect(p.bundle.actionId).toBe(1); expect(p.sourceFootprintVersion).toBe(sourceFootprintVersion(f.game.spatialOf(f.game.player)));
        expect(f.resources).toEqual({ schema: 1, revision: 0, nextActionId: 1, stamina: 50 });
        expect(f.state.bundles).toEqual([]); expect(rng.getState()).toEqual(random);
        const after = f.game.toSnapshot(); before.savedAt = after.savedAt; expect(after).toEqual(before);
    });
    it('commits through a genuine Game input once, then drains phases before input returns', () => {
        const f = fixture(), p = f.plan();
        withActorActionScheduler(f.game, f.scheduler, () => {
            f.game.executeCommand('fixture:actor-action', undefined, () => withActorActionScope(f.game, 'player-command', f.game.player.id, scope => {
                expect(f.authority.commitActorAction(scope, p)).toEqual({ status: 'committed', actionId: 1 });
                expect(() => f.authority.commitActorAction(scope, p)).toThrow('Stale');
                (f.game as any).playerTurnEnded();
            }));
        });
        expect(f.resolve).toHaveBeenCalledTimes(1); expect(f.finish).toHaveBeenCalledTimes(1);
        expect(f.finish.mock.calls[0]![0].elapsedActionTicks).toBe(40);
        expect(f.resources).toEqual({ schema: 1, revision: 1, nextActionId: 2, stamina: 43 });
        expect(f.state.bundles).toEqual([]); expect(f.game.player.ticksUntilTurn).toBe(0);
        expect(() => f.game.toSnapshot()).toThrow('fixture');
        expect(() => f.game.exportRecording()).toThrow('fixture');
    });
    it('rejects stale world, runtime, timer and source plans before fee or ID writes', () => {
        const f = fixture(), p = f.plan(), old = f.game.player.loc;
        commitCreatureAnchor(f.game.player, { x: old.x, y: old.y + 1 });
        expect(() => withActorActionScope(f.game, 'player-command', f.game.player.id,
            scope => f.authority.commitActorAction(scope, p))).toThrow('Stale');
        expect(f.resources.nextActionId).toBe(1); expect(f.resources.stamina).toBe(50);
    });
    it('does not allow NPC requests to impersonate player commands', () => {
        const f = fixture(); f.request.origin = 'npc-scheduler';
        expect(f.authority.prepareActorAction(f.request)).toEqual({ status: 'rejected', reason: 'ineligible' });
        expect(() => f.authority.commitActorAction({} as ActorActionScope, {} as never)).toThrow();
    });
    it('runs NPC prelude once before a handled action, never at its intermediate phase', () => {
        const f = fixture();
        const monster = new Monster(f.game.player.x + 2, f.game.player.y, (monsters as MonsterData[]).find(m => m.id === 'rat')!);
        monster.state = MonsterState.HUNTING; monster.ticksUntilTurn = 0; f.game.monsters.push(monster);
        const prelude = vi.spyOn(monster, 'prepareNativeDecision'), native = vi.spyOn(monster, 'takeNativeDecision');
        const request = { ...f.request, origin: 'npc-scheduler' as const, sourceEntityId: monster.id,
            decisionOwnerId: monster.id, timeChargeOwnerId: monster.id };
        let selections = 0;
        f.resolve.mockImplementation(() => { expect(prelude).toHaveBeenCalledTimes(1); expect(native).not.toHaveBeenCalled(); });
        withActorActionScheduler(f.game, f.scheduler, () => {
            f.game.executeCommand('fixture:npc-action', undefined, () => {
                f.game.player.ticksUntilTurn = 40; (f.game as any).playerTurnEnded();
            });
        }, (id, scope) => {
            expect(id).toBe(monster.id); selections++;
            if (selections > 1) return 'native-fallback';
            const result = f.authority.prepareActorAction(request);
            expect(result.status).toBe('ready');
            if (result.status === 'ready') f.authority.commitActorAction(scope, result.plan);
            return 'handled';
        });
        expect(f.resolve).toHaveBeenCalledTimes(1); expect(f.resources.stamina).toBe(43);
        expect(prelude).toHaveBeenCalledTimes(2); expect(native).toHaveBeenCalledTimes(1);
    });
    it('fails closed when a selector starts a bundle then falsely requests native fallback', () => {
        const f = fixture();
        const monster = new Monster(f.game.player.x + 2, f.game.player.y, (monsters as MonsterData[]).find(m => m.id === 'rat')!);
        monster.state = MonsterState.HUNTING; monster.ticksUntilTurn = 0; f.game.monsters.push(monster);
        const native = vi.spyOn(monster, 'takeNativeDecision');
        expect(() => withActorActionScheduler(f.game, f.scheduler, () => {
            f.game.executeCommand('fixture:npc-action', undefined, () => { f.game.player.ticksUntilTurn = 40; (f.game as any).playerTurnEnded(); });
        }, (_id, scope) => {
            const result = f.authority.prepareActorAction({ ...f.request, origin: 'npc-scheduler', sourceEntityId: monster.id,
                decisionOwnerId: monster.id, timeChargeOwnerId: monster.id });
            if (result.status === 'ready') f.authority.commitActorAction(scope, result.plan);
            return 'native-fallback';
        })).toThrow('Busy actor');
        expect(native).not.toHaveBeenCalled(); expect(monster.ticksUntilTurn).toBe(17);
        expect(() => f.game.exportRecording()).toThrow('fixture');
    });
    it('keeps asleep, dormant, retired and activation-gated NPCs outside action selection', () => {
        const f = fixture();
        const monster = new Monster(f.game.player.x + 2, f.game.player.y, (monsters as MonsterData[]).find(m => m.id === 'rat')!);
        f.game.monsters.push(monster); monster.ticksUntilTurn = 0;
        const request = { ...f.request, origin: 'npc-scheduler' as const, sourceEntityId: monster.id, decisionOwnerId: monster.id, timeChargeOwnerId: monster.id };
        monster.state = MonsterState.ASLEEP;
        expect(f.authority.prepareActorAction(request)).toMatchObject({ status: 'rejected' });
        const select = vi.fn(() => 'native-fallback' as const);
        withActorActionScheduler(f.game, f.scheduler, () => {
            f.game.executeCommand('fixture:npc-gate', undefined, () => { f.game.player.ticksUntilTurn = 1; (f.game as any).playerTurnEnded(); });
        }, select);
        expect(select).not.toHaveBeenCalled();
        monster.state = MonsterState.HUNTING; monster.ticksUntilTurn = 0;
        for (const key of ['isDormant', 'deathProcessed', 'isCaged'] as const) {
            monster[key] = true; expect(f.authority.prepareActorAction(request)).toMatchObject({ status: 'rejected' }); monster[key] = false;
        }
        const result = f.authority.prepareActorAction(request); expect(result.status).toBe('ready');
        if (result.status === 'ready') expect(() => withActorActionScope(f.game, 'npc-scheduler', monster.id,
            scope => f.authority.commitActorAction(scope, result.plan))).toThrow('prelude');
    });
    it('rejects accessor DTOs without invoking them, and refuses exhausted IDs before recording', () => {
        const f = fixture(), getter = vi.fn(() => 1);
        const malicious = { ...f.request }; Object.defineProperty(malicious, 'cost', { enumerable: true, get: getter });
        expect(() => f.authority.prepareActorAction(malicious)).toThrow(); expect(getter).not.toHaveBeenCalled();
        const offset = { x: 1, y: 0 }; Object.defineProperty(offset, 'x', { enumerable: true, get: getter });
        expect(() => f.authority.prepareActorAction({ ...f.request, shape: { ...f.request.shape, offsets: [offset] } })).toThrow();
        expect(getter).not.toHaveBeenCalled();
        f.resources.nextActionId = Number.MAX_SAFE_INTEGER - 1; const p = f.plan();
        expect(() => withActorActionScope(f.game, 'player-command', f.game.player.id,
            scope => f.authority.commitActorAction(scope, p))).toThrow('budget exhausted');
        expect(f.resources.stamina).toBe(50); expect(f.state.bundles).toHaveLength(0);
    });
    it('revokes authority on synchronous exit and rejects thenables', () => {
        const owner = {}, seen: ActorActionScope[] = [];
        withActorActionScope(owner, 'npc-scheduler', 1, scope => { seen.push(scope); assertActorActionScope(scope, owner, 1); });
        expect(() => assertActorActionScope(seen[0]!, owner, 1)).toThrow('Closed');
        expect(() => withActorActionScope(owner, 'player-command', 1, () => Promise.resolve())).toThrow('await');
    });
    it('keeps malformed, unknown, unbounded and insufficient-resource requests inert', () => {
        const f = fixture();
        for (const patch of [{ schema: 2 }, { kind: 'dodge' }, { cost: -1 }, { windupTicks: 0 }, { recoveryTicks: Infinity }, { extra: true }, { timeChargeOwnerId: 999 }])
            expect(() => f.authority.prepareActorAction({ ...f.request, ...patch })).toThrow();
        f.request.cost = 51; expect(f.authority.prepareActorAction(f.request)).toMatchObject({ reason: 'insufficient-resource' });
        expect(() => validateActorActionResources({ ...f.resources, sessionRevision: 1 })).toThrow();
        expect(f.resources.revision).toBe(0);
    });
    it('No consumes one native decision, no charge, time, RNG or new action', () => {
        const f = fixture();
        const monster = new Monster(f.game.player.x + 1, f.game.player.y,
            (monsters as MonsterData[]).find(m => m.id === 'rat')!);
        monster.isAlly = true; monster.setStatusDuration('discordant', 5); f.game.monsters.push(monster);
        f.game.grid.getCell(monster.x, monster.y)!.isVisible = true;
        const p = f.plan(), random = rng.getState(), tick = timeSystem.currentTick;
        expect(p.risks.map(risk => risk.kind)).toEqual(['ally']);
        f.game.executeCommand('fixture:actor-action', undefined, () => withActorActionScope(f.game, 'player-command', f.game.player.id, scope => {
            expect(f.authority.commitActorAction(scope, p, [{ risk: p.risks[0]!, decision: false }])).toEqual({ status: 'declined' });
            expect(() => f.authority.commitActorAction(scope, p, [])).toThrow('Stale');
        }));
        expect(f.game.recordedInputEvents[f.game.recordedInputEvents.length - 1]!.decisions).toEqual([false]);
        expect(f.resources.stamina).toBe(50); expect(f.resources.nextActionId).toBe(1);
        expect(timeSystem.currentTick).toBe(tick); expect(rng.getState()).toEqual(random); expect(f.state.bundles).toHaveLength(0);
    });
    it.each(['missing', 'extra', 'reversed'] as const)('rejects %s supplied answers before any native decision or charge', mode => {
        const f = fixture();
        const target = new Monster(f.game.player.x + 1, f.game.player.y, (monsters as MonsterData[]).find(m => m.id === 'rat')!);
        target.isAlly = true; target.setStatusDuration('discordant', 5); target.behaviorFlags.add('MONST_DEFEND_DEGRADE_WEAPON');
        f.game.monsters.push(target); f.game.grid.getCell(target.x, target.y)!.isVisible = true;
        const p = f.plan(); expect(p.risks.map(risk => risk.kind)).toEqual(['acid', 'ally']);
        const supplied = p.risks.map(risk => ({ risk, decision: true }));
        if (mode === 'missing') supplied.pop(); else if (mode === 'extra') supplied.push(supplied[0]!); else supplied.reverse();
        expect(() => f.game.executeCommand('fixture:actor-action', undefined, () => withActorActionScope(f.game, 'player-command', f.game.player.id,
            scope => f.authority.commitActorAction(scope, p, supplied)))).toThrow('answers');
        expect(f.resources.stamina).toBe(50); expect(f.resources.nextActionId).toBe(1); expect(f.state.bundles).toHaveLength(0);
    });
    it('never exports an active fixture as a supported production save', () => {
        const f = fixture();
        withActorActionScheduler(f.game, f.scheduler, () => {
            expect(() => f.game.toSnapshot()).toThrow('fixture'); expect(() => f.game.exportRecording()).toThrow('fixture');
        });
        expect(() => f.game.toSnapshot()).toThrow('fixture');
        expect(() => f.game.exportRecording()).toThrow('fixture');
        expect(createHeadlessGame(7301, 'test').toSnapshot().version).toBe(5);
    });
    it('rolls back fee/ID on bounded sink failure and revokes the authority', () => {
        const f = fixture(); vi.spyOn(f.scheduler, 'commitBundle').mockImplementation(() => { throw new Error('Injected commit failure'); });
        const p = f.plan();
        expect(() => f.game.executeCommand('fixture:actor-action', undefined, () => withActorActionScope(f.game, 'player-command', f.game.player.id,
            scope => f.authority.commitActorAction(scope, p)))).toThrow('Injected');
        expect(f.resources).toEqual({ schema: 1, revision: 0, nextActionId: 1, stamina: 50 });
        expect(() => f.plan()).toThrow('Closed');
    });
});

describe('3a0 foundation footprint-relative projection', () => {
    it('projects the initiating member, uses whole group only for exclusion, and deduplicates in y/x order', () => {
        const f = fixture(), view = f.game.spatialOf(f.game.player);
        const member = { ...view, cells: [{ x: 1, y: 1, zoneId: 'body' }, { x: 2, y: 1, zoneId: 'body' }] };
        const shape = { schema: 1 as const, kind: 'footprint-offset-union' as const, offsets: [{ x: 0, y: 1 }, { x: 1, y: 1 }], selfExclusion: 'whole-group' as const };
        const cells = projectAttackShape(member, [...member.cells, { x: 10, y: 10 }, { x: 3, y: 2 }], shape,
            { contains: () => true, lineOfEffect: () => true });
        expect(cells).toEqual([{ x: 1, y: 2 }, { x: 2, y: 2 }]); expect(Object.isFrozen(cells[0])).toBe(true);
    });
    it('rejects duplicate offsets/unknown policies and applies bounds/occlusion before publishing', () => {
        const f = fixture(), view = f.game.spatialOf(f.game.player), world = { contains: () => false, lineOfEffect: () => true };
        expect(projectAttackShape(view, view.cells, f.request.shape, world)).toEqual([]);
        expect(() => projectAttackShape(view, view.cells, { ...f.request.shape, offsets: [{ x: 1, y: 0 }, { x: 1, y: 0 }] }, world)).toThrow('offset');
    });
});
