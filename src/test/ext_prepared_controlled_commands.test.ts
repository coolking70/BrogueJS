import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { ExtensionRegistry } from '../ext/registry';
import * as catalog from '../ext/catalog';
import type { ControlledActionRequest, ControlledCommandPreparationContext, ExtensionContext, Json } from '../ext/types';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { TerrainType, DungeonLayer } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';
import { LightKind } from '../engine/Map/LightCatalog';
import { logger } from '../engine/Systems/Logger';

function fixture(options: { prepare?: boolean; handler?: 'skip' | 'different'; inspect?(context: ControlledCommandPreparationContext): void } = {}) {
    let retained: ControlledCommandPreparationContext | null = null;
    let commandContext: ExtensionContext | null = null;
    const beforeCommit = vi.fn(), afterResolve = vi.fn(), handler = vi.fn();
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry();
        registry.register('prepared', '1.0.0', () => ({
            id: 'prepared', version: '1.0.0', initialState: () => ({ revision: 1, paid: 0 }),
            validateState: (value): value is Json => !!value && typeof value === 'object',
            ...(options.prepare === false ? {} : { prepareControlledCommand(_action: string, payload: Json, context: ControlledCommandPreparationContext) {
                retained = context; options.inspect?.(context);
                return { revision: (context.state as { revision: number }).revision, request: payload as unknown as ControlledActionRequest };
            } }),
            commands: { run(payload, context) {
                handler(); commandContext = context;
                if (options.handler === 'skip') { context.setState({ revision: 2, paid: 1 }); return; }
                context.executeAction(options.handler === 'different' ? { actorId: context.playerId, action: 'wait', target: { kind: 'self' } }
                    : payload as unknown as ControlledActionRequest, {
                    beforeCommit(fresh) { beforeCommit(); fresh.setState({ revision: 2, paid: 1 }); },
                    afterResolve(result) { afterResolve(result); },
                });
            } },
        }));
        return registry;
    });
    const game = createHeadlessGame(91240, 'test');
    game.startNewGame({ seed: 91240, mode: 'test', ruleSet: 'extended', extensions: ['prepared'] });
    game.animationEnabled = false; game.monsters = []; game.dormantMonsters = []; game.items = [];
    const target = { kind: 'cell' as const, x: game.player.x + 1, y: game.player.y };
    game.grid.setTerrain(target.x, target.y, TerrainType.PLAIN_FIRE);
    Object.assign(game.grid.getCell(target.x, target.y)!, { isVisible: true, hasMemory: true });
    const request: ControlledActionRequest = { actorId: game.player.id, action: 'move', target };
    const data = JSON.stringify({ module: 'prepared', action: 'run', payload: request });
    game.onCommandConfirmRequest = () => {};
    game.onConfirmRequest = () => { throw new Error('Must never use synchronous fallback'); };
    return { game, data, request, handler, beforeCommit, afterResolve,
        retained: () => retained!, commandContext: () => commandContext!,
        state: () => game.extensionRuntime!.snapshot().modules.prepared,
        run: () => game.executeCommand('ext:command', data),
    };
}
function answer(f: ReturnType<typeof fixture>, decision: boolean) {
    expect(f.game.pendingCommandConfirmation).not.toBeNull();
    f.game.resolveCommandDecision(f.game.pendingCommandConfirmation!.token, decision);
}
afterEach(() => { vi.restoreAllMocks(); logger.reset(); });

describe('prepared controlled command foundation contract', () => {
    it('returns only detached frozen JSON and revokes every preparation capability before returning', () => {
        const f = fixture({ inspect(context) {
            expect(Object.keys(context).sort()).toEqual(['canManageCharacter', 'creature', 'getComponent', 'playerId', 'state', 'validateAction']);
            expect('setState' in context).toBe(false); expect('executeAction' in context).toBe(false);
            (context.state as { paid: number }).paid = 80;
            expect(Object.isFrozen(context.creature(context.playerId))).toBe(true);
        } });
        const before = f.game.extensionRuntime!.snapshot(), random = rng.getState();
        const plan = f.game.extensionRuntime!.prepareControlledCommand(f.data)!;
        expect(plan).toEqual({ command: f.data, revision: 1, request: f.request });
        expect(Object.isFrozen(plan)).toBe(true); expect(Object.isFrozen(plan.request.target)).toBe(true);
        expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
        expect(f.game.extensionRuntime!.snapshot()).toEqual(before); expect(rng.getState()).toEqual(random);
        const ctx = f.retained();
        for (const read of [() => ctx.playerId, () => ctx.state, () => ctx.creature(f.game.player.id),
            () => ctx.getComponent(f.game.player.id, 'anything'), () => ctx.canManageCharacter(), () => ctx.validateAction(f.request)])
            expect(read).toThrow('Closed controlled preparation context');
        expect(f.handler).not.toHaveBeenCalled();
    });

    it.each([false, true])('keeps handlers/scopes/recorder closed throughout preparation, then invokes once for %s', decision => {
        const f = fixture(), runtime = f.game.extensionRuntime!;
        const execute = vi.spyOn(runtime, 'command'), prefix = vi.spyOn(f.game as any, 'finishTransientDisplay');
        const random = rng.getState(), tick = timeSystem.currentTick, count = f.game.recordedInputEvents.length;
        f.run();
        const plan = (f.game as any).prepareControlledCommand(f.data);
        expect(plan.risks).toEqual([{ kind: 'fire', target: f.request.target, message: 'Venture into flame?' }]);
        expect(Object.isFrozen(plan.risks[0].target)).toBe(true);
        expect((runtime as any).activeScope).toBeNull(); expect((runtime as any).commandModule).toBeNull();
        expect(() => f.retained().state).toThrow('Closed controlled preparation context');
        expect(execute).not.toHaveBeenCalled(); expect(f.handler).not.toHaveBeenCalled();
        expect(f.state()).toEqual({ revision: 1, paid: 0 }); expect(rng.getState()).toEqual(random);
        expect(timeSystem.currentTick).toBe(tick); expect(f.game.recordedInputEvents).toHaveLength(count);
        expect((f.game as any).commandDecisions).toBeNull();
        const prefixCalls = prefix.mock.calls.length;
        answer(f, decision);
        expect(execute).toHaveBeenCalledTimes(1); expect(f.handler).toHaveBeenCalledTimes(1);
        expect(prefix).toHaveBeenCalledTimes(prefixCalls);
        expect(f.beforeCommit).toHaveBeenCalledTimes(decision ? 1 : 0);
        expect(f.afterResolve).toHaveBeenCalledTimes(decision ? 1 : 0);
        expect(f.game.recordedInputEvents[count]!.decisions).toEqual([decision]);
        expect(() => f.commandContext().setState({ paid: 80, revision: 80 })).toThrow('outside lifecycle');
        if (!decision) { expect(f.state()).toEqual({ revision: 1, paid: 0 }); expect(rng.getState()).toEqual(random); expect(timeSystem.currentTick).toBe(tick); }
    });

    it('preserves unsampled cosmetic flare normalization once while leaving substantive RNG and cancellation untouched', () => {
        const sync = fixture();
        sync.game.createFlare(sync.game.player.x, sync.game.player.y, LightKind.SCROLL_ENCHANTMENT_LIGHT);
        sync.game.onCommandConfirmRequest = null; sync.game.onConfirmRequest = () => false;
        const initial = rng.getState(); sync.run(); const expected = rng.getState();
        expect(expected.streams[0]).toEqual(initial.streams[0]); expect(expected.streams[1]).not.toEqual(initial.streams[1]);
        vi.restoreAllMocks();
        const f = fixture(); f.game.createFlare(f.game.player.x, f.game.player.y, LightKind.SCROLL_ENCHANTMENT_LIGHT);
        f.run(); expect(rng.getState()).toEqual(expected); expect(f.handler).not.toHaveBeenCalled();
        const prefix = vi.spyOn(f.game as any, 'finishTransientDisplay');
        answer(f, false); expect(rng.getState()).toEqual(expected);
        expect(prefix).not.toHaveBeenCalled(); expect(f.beforeCommit).not.toHaveBeenCalled();
        expect(f.game.recordedInputEvents[0]!.decisions).toEqual([false]);
    });

    it('keeps the next prepared question pending if its UI notifier disappears', () => {
        const f = fixture();
        const target = f.request.target as { x: number; y: number };
        f.game.grid.setTerrainLayer(target.x, target.y, DungeonLayer.DUNGEON, TerrainType.PRESSURE_PLATE);
        f.run();
        expect(f.game.pendingCommandConfirmation?.message).toBe('Venture into flame?');
        f.game.onCommandConfirmRequest = null;
        answer(f, true);
        expect(f.game.pendingCommandConfirmation?.message).toBe('Step onto the pressure plate?');
        expect(f.handler).not.toHaveBeenCalled();
        answer(f, false);
        expect(f.handler).toHaveBeenCalledTimes(1); expect(f.beforeCommit).not.toHaveBeenCalled();
        expect(f.game.recordedInputEvents[0]!.decisions).toEqual([true, false]);
    });

    it.each(['seized', 'web', 'vomit'] as const)('preserves a committed %s interruption, including its risk ordering', kind => {
        const play = (async: boolean) => {
            const f = fixture(); const origin = { ...f.game.player.loc };
            if (kind === 'seized') {
                const m = new Monster(origin.x, origin.y + 1, monsters.find(row => row.id === 'rat')! as MonsterData);
                m.state = MonsterState.ASLEEP; m.hp = m.maxHp = 1000; m.ticksUntilTurn = 10000;
                m.abilityFlags.add('MA_SEIZES'); m.seizing = true; f.game.monsters.push(m);
                f.game.grid.setTerrain(m.x, m.y, TerrainType.FLOOR);
                f.game.extensionRuntime!.attachCreature(m); f.game.player.seized = true;
            }
            if (kind === 'web') { f.game.grid.setTerrain(origin.x, origin.y, TerrainType.WEB); f.game.player.setStatusDuration('stuck', 3); }
            if (kind === 'vomit') { f.game.player.setStatusDuration('nauseous', 10); vi.spyOn(rng, 'randPercent').mockReturnValue(true); }
            const ask = vi.fn(() => true);
            if (!async) { f.game.onCommandConfirmRequest = null; f.game.onConfirmRequest = ask; }
            f.run();
            if (async && kind !== 'seized') {
                expect(f.game.pendingCommandConfirmation?.message).toBe('Venture into flame?');
                expect(f.handler).not.toHaveBeenCalled(); answer(f, true);
            }
            expect(f.game.hasPendingConfirmation).toBe(false);
            expect(f.beforeCommit).toHaveBeenCalledTimes(1); expect(f.afterResolve).toHaveBeenCalledTimes(1);
            expect(f.afterResolve.mock.calls[0]![0]).toMatchObject({ action: 'move', moved: false });
            expect(f.game.player.loc).toEqual(origin);
            return { extension: f.game.extensionRuntime!.snapshot(), rng: rng.getState(), tick: timeSystem.currentTick,
                loc: f.game.player.loc, status: f.game.player.statusDurations, decisions: f.game.recordedInputEvents[0]!.decisions };
        };
        const sync = play(false); vi.restoreAllMocks();
        expect(play(true)).toEqual(sync);
    });

    it('rejects a whip ray substituting another target before asking or charging', () => {
        const f = fixture(), origin = f.game.player.loc;
        const targets = [1, 2].map(dx => {
            f.game.grid.setTerrain(origin.x + dx, origin.y, TerrainType.FLOOR);
            const m = new Monster(origin.x + dx, origin.y, monsters.find(row => row.id === 'rat')! as MonsterData);
            m.state = MonsterState.ASLEEP; m.hp = m.maxHp = 1000; m.ticksUntilTurn = 10000;
            f.game.monsters.push(m); f.game.extensionRuntime!.attachCreature(m); return m;
        });
        f.game.player.equippedWeapon!.flags = ['ITEM_ATTACKS_EXTEND'];
        targets[0]!.setStatusDuration('invisible', 20);
        f.game.grid.getCell(targets[0]!.x, targets[0]!.y)!.layers[DungeonLayer.GAS] = TerrainType.CONFUSION_GAS;
        const request = { actorId: f.game.player.id, action: 'attack' as const, target: { kind: 'creature' as const, id: targets[0]!.id } };
        expect(f.game.validateControlledAction(request)).toBe(true);
        const before = f.game.extensionRuntime!.snapshot(), random = rng.getState(), tick = timeSystem.currentTick;
        f.game.executeCommand('ext:command', JSON.stringify({ module: 'prepared', action: 'run', payload: request }));
        expect(f.game.hasPendingConfirmation).toBe(false); expect(f.handler).toHaveBeenCalledTimes(1);
        expect(f.beforeCommit).not.toHaveBeenCalled(); expect(f.game.extensionRuntime!.snapshot()).toEqual(before);
        expect(rng.getState()).toEqual(random); expect(timeSystem.currentTick).toBe(tick);
        expect(f.game.recordedInputEvents[0]!.decisions).toEqual([]);
    });

    it('rejects prepared waiting through the legacy synchronous system helper without asking or recording', () => {
        const f = fixture();
        expect(() => f.game.handlePlayerAction('ext:command', f.data, 'system')).toThrow('Prepared confirmation requires executeCommand');
        expect(f.handler).not.toHaveBeenCalled(); expect(f.beforeCommit).not.toHaveBeenCalled();
        expect(f.game.recordedInputEvents).toHaveLength(0); expect(f.state()).toEqual({ revision: 1, paid: 0 });
    });

    it('retains synchronous acid callback timing before evaluating ally facts', () => {
        const f = fixture(), x = f.game.player.x + 1, y = f.game.player.y;
        f.game.grid.setTerrain(x, y, TerrainType.FLOOR);
        const target = new Monster(x, y, monsters.find(row => row.id === 'acid_mound')! as MonsterData);
        f.game.monsters.push(target); f.game.player.equippedWeapon!.isProtected = false;
        f.game.player.equippedWeapon!.runicType = undefined;
        f.game.onCommandConfirmRequest = null;
        const messages: string[] = [];
        f.game.onConfirmRequest = message => {
            messages.push(message);
            if (messages.length === 1) { target.isAlly = true; target.setStatusDuration('discordant', 100); return true; }
            return false;
        };
        expect((f.game as any).abortPlayerAttack([target])).toBe(true);
        expect(messages).toHaveLength(2); expect(messages[0]).toContain('Degrade your'); expect(messages[1]).toContain('Are you sure');
        expect(f.beforeCommit).not.toHaveBeenCalled();
    });

    it('retains synchronous movement callback timing for later burning-sensitive risks', () => {
        const f = fixture(), target = f.request.target as { x: number; y: number };
        f.game.grid.setTerrainLayer(target.x, target.y, DungeonLayer.LIQUID, TerrainType.CHASM);
        f.game.grid.setTerrainLayer(target.x, target.y, DungeonLayer.GAS, TerrainType.CONFUSION_GAS);
        f.game.grid.setTerrainLayer(target.x, target.y, DungeonLayer.DUNGEON, TerrainType.PRESSURE_PLATE);
        f.game.grid.getCell(target.x, target.y)!.isDiscovered = true;
        f.game.onCommandConfirmRequest = null;
        const messages: string[] = [];
        f.game.onConfirmRequest = message => {
            messages.push(message);
            if (messages.length === 1) { (f.game as any).setBurningDuration(f.game.player, 100); return true; }
            return false;
        };
        expect((f.game as any).confirmPlayerMove(target.x, target.y)).toBe(false);
        expect(messages).toEqual(['Dive into the depths?', 'Step onto the pressure plate?']);
        expect(f.beforeCommit).not.toHaveBeenCalled();
    });

    it('rejects a different primitive instead of applying approval to it', () => {
        const f = fixture({ handler: 'different' }); f.run();
        expect(() => answer(f, true)).toThrow('Unplanned controlled action');
        expect(f.beforeCommit).not.toHaveBeenCalled(); expect(f.state()).toEqual({ revision: 1, paid: 0 });
        expect(f.game.recordedInputEvents).toHaveLength(0);
    });

    it('rejects leftover supplied decisions inside the original command transaction', () => {
        const f = fixture({ handler: 'skip' }); f.run();
        expect(() => answer(f, true)).toThrow('Unused supplied confirmation decision');
        expect(f.state()).toEqual({ revision: 1, paid: 0 }); expect(f.beforeCommit).not.toHaveBeenCalled();
        expect(f.game.recordedInputEvents).toHaveLength(0);
    });

    it('rejects missing or reordered risk facts without silently approving or charging', () => {
        const f = fixture();
        vi.spyOn(f.game as any, 'prepareControlledActionRisks').mockReturnValue([]);
        expect(f.run).toThrow('Unplanned or missing supplied confirmation decision');
        expect(f.state()).toEqual({ revision: 1, paid: 0 }); expect(f.beforeCommit).not.toHaveBeenCalled();
        expect(f.game.recordedInputEvents).toHaveLength(0);
    });

    it('rejects a module without pure preparation at an unplanned live risk; headless behavior is unchanged', () => {
        const f = fixture({ prepare: false });
        expect(f.run).toThrow('Controlled confirmation requires pure command preparation');
        expect(f.state()).toEqual({ revision: 1, paid: 0 }); expect(f.beforeCommit).not.toHaveBeenCalled();
        f.game.onCommandConfirmRequest = null; f.game.onConfirmRequest = () => false;
        expect(f.run).not.toThrow(); expect(f.state()).toEqual({ revision: 1, paid: 0 });
    });
});
