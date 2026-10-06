import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import { Game } from '../../../../engine/Core/Game';
import { EnvironmentManager } from '../../../../engine/Environment/Gas';
import { WaypointSystem } from '../../../../engine/Map/WaypointMap';
import { DungeonLayer, TerrainType as T } from '../../../../engine/Map/Grid';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { logger } from '../../../../engine/Systems/Logger';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { rng } from '../../../../engine/Random';
import * as catalog from '../../../catalog';
import { placeCombatTelegraphFixture } from '../ui/diagnostics';
import { createCombatDiagnosticTrace } from '../ui/diagnosticTrace';
import { readPublicCombatTelegraphs } from '../../../../ui/combatDrawing';
import { productionActorActionScheduler } from '../../../../engine/Core/ActorActionProduction';
import { bindDialogAcknowledgments } from '../../../../ui/dialogAcknowledgments';
import { PresentationTimeline, presentationTimeline } from '../../../../ui/presentationTimeline';
import { effectScope, ref, nextTick } from 'vue';
import { DialogService } from '../../../../ui/dialogService';
import { useCombatUi } from '../ui/useCombatUi';
import type { Facing } from '../types';
import { timeSystem } from '../../../../engine/Systems/Time';
import { observeDisplayFrame } from '../../../../ui/displayProjection';
const state = (game: Game) => game.extensionRuntime!.actorActionBinding()!.state;
const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
function start(seed = 73073, mode: 'normal' | 'test' = 'test'): Game {
    const game = createHeadlessGame(seed, 'test'), registry = catalog.createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(['combat'])).flatMap(module => module.initialCommand
        ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
    game.startNewGame({ seed, mode, ruleSet: 'extended', extensions: ['combat'], initialCommands });
    game.animationEnabled = false;
    return game;
}
function arena(game: Game) {
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        for (const layer of [DungeonLayer.DUNGEON, DungeonLayer.LIQUID, DungeonLayer.SURFACE, DungeonLayer.GAS])
            game.grid.setTerrainLayer(x, y, layer, layer === DungeonLayer.DUNGEON
                ? x === 0 || y === 0 || x === game.grid.width - 1 || y === game.grid.height - 1 ? T.WALL : T.FLOOR : T.NOTHING);
        game.grid.getCell(x, y)!.machineNumber = 0;
    }
    commitCreatureAnchor(game.player, { x: 20, y: 15 });
    game.player.hp = game.player.maxHp = 1000; game.player.ticksUntilTurn = 0;
    game.environment = new EnvironmentManager(game.grid); game.waypoints = new WaypointSystem();
    (game as any).machineCells = new Set(); (game as any).bindDungeonFeatureEffects(); (game as any).updateVision();
}
function scene(seed = 73073) { const game = start(seed); arena(game); return game; }

const json = <V>(value: V): V => JSON.parse(JSON.stringify(value));
const resource = (game: Game, id = game.player.id) => state(game).actors.find(a => a.actorId === id)!;
const parry = (facing = 'e') => JSON.stringify({ module: 'combat', action: 'parry', payload: { facing } });
function rat(game: Game) {
    const source = new Monster(21, 15, monsters.find(m => m.id === 'rat')! as MonsterData);
    source.state = MonsterState.HUNTING; source.hp = source.maxHp = 1000; source.regenTurns = 0;
    game.monsters.push(source); (game as any).updateVision();
    // Keep the constructor's native readiness. Never force elapsed or a boundary.
    return source;
}
function warning(game: Game, id: number) {
    const result = readPublicCombatTelegraphs(game).find(w => w.sourceEntityId === id)!;
    expect(result).toBeDefined();
    expect(result.cells).toContainEqual({ ...game.player.loc });
    expect(game.isInputLocked()).toBe(false);
    return state(game).scheduler.bundles.find(b => b.decisionOwnerId === id)!.subactions[0]!;
}
function mechanical(game: Game) {
    const snapshot = json(game.toSnapshot()); snapshot.savedAt = 0;

    return snapshot;
}
afterEach(() => { vi.restoreAllMocks(); acknowledge(); });


/** Same simulation/presentation ordering and modal condition as GameCanvas.
 * No direct stepAdvancement, clock writes, forced finish, or timeout bypass. */
const frameServices = new WeakMap<PresentationTimeline, DialogService>();
function canvasFrames(game: Game, timeline: PresentationTimeline, modalOpen = false) {
    let frames = 0;
    while (game.isAdvancing || timeline.busy) {
        expect(++frames).toBeLessThan(1000);
        if (!modalOpen || (game.isAdvancing && !game.replayRecording)) game.tickAdvancement(16);
        timeline.tick(16);
        // Explicit acknowledgment, equivalent to the user pressing MORE.
        if (timeline.acknowledgment) {
            const service = frameServices.get(timeline)!; service.sync();
            expect(service.current?.kind).toBe('acknowledgment');
            expect(service.answer(service.current!.token, 'more')).toBe(true);
        }
    }
    expect(game.lastAdvancementError).toBeNull();
    expect(game.isInputLocked()).toBe(false);
    return frames;
}
function uiSession(game: Game) {
    const dialogs = new DialogService(), scope = effectScope();
    const removeAcknowledgments = bindDialogAcknowledgments(dialogs, game, logger);
    const timeline = presentationTimeline(game)!; frameServices.set(timeline, dialogs);
    const ui = scope.run(() => useCombatUi({ game: () => game, tick: ref(0), immersive: ref(false), dialogs,
        readDisplayFrame: () => timeline.projection ?? observeDisplayFrame(game, logger),
        isPresentationBusy: () => timeline.busy,
        canOpenPanel: () => !game.isAdvancing && !game.isInputLocked(),
        canOpenInteraction: () => !dialogs.current && !timeline.busy,
        beforeOpenPanel: () => {}, afterClosePanel: () => {},
    }))!;
    return { ui, dialogs, timeline, async submit(action: 'parry' | 'dodge', facing: Facing) {
        ui.refresh(); (ui.bar.value!.props.onAttack as (id: string) => void)(action);
        expect(dialogs.answer(dialogs.current!.token, `choice:${facing}`)).toBe(true);
        const token = dialogs.current!.token;
        expect(dialogs.answer(token, 'choice:confirm')).toBe(true);
        expect(dialogs.answer(token, 'choice:confirm')).toBe(false);
        await nextTick();
    }, dispose() { scope.stop(); removeAcknowledgments(); dialogs.dispose(); } };
}

describe('animated defense uses the real UI command and frame advancement', () => {
    it.each([{ seed: 73073, size: 2 }, { seed: 73074, size: 2 }, { seed: 73075, size: 2 }, { seed: 73073, size: 1 }])('DEV NW parries resolve successive action identities, then an undefended wait can hurt ($seed / $size)', async ({ seed, size }) => {
        const game = scene(seed);
        commitCreatureAnchor(game.player, { x: 38, y: 20 });
        game.player.hp = game.player.maxHp = 30;
        // Reproduce the reported bookkeeping tick700 using ordinary commands.
        for (let n = 0; n < 7; n++) game.executeCommand('wait');
        if (size === 1) {
            // A visible four-cell room admits only the diagnostic's supported 1x1
            // fallback, matching player(38,20)/source(37,19), without timer edits.
            for (let x = 35; x <= 41; x++) for (let y = 17; y <= 23; y++)
                game.grid.setTerrain(x, y, (x === 38 && (y === 19 || y === 20)) || (x === 37 && (y === 19 || y === 20)) ? T.FLOOR : T.WALL);
        }
        (game as any).updateVision();
        game.animationEnabled = true;
        const ui = uiSession(game), timeline = ui.timeline;
        try {
            const fixture = placeCombatTelegraphFixture(game);
            expect(fixture.size).toBe(size);
            canvasFrames(game, timeline);
            const source = game.monsters.find(m => m.id === fixture.sourceEntityId)!;
            expect(readPublicCombatTelegraphs(game).find(t => t.sourceEntityId === source.id))
                .toMatchObject({ parryable: true, remainingTicks: 10 });
            expect(warning(game, source.id).phaseRemainingTicks).toBe(10);
            const defended = vi.spyOn(game.extensionRuntime!, 'notifyActorParried');
            const sourceHp = source.hp;
            expect(timeSystem.currentTick).toBe(700);
            expect(resource(game).stamina).toBe(22);
            for (let count = 1; count <= 2; count++) {
                const retainedState = state(game), retainedSource = source;
                const retainedBundle = retainedState.scheduler.bundles.find(b => b.decisionOwnerId === source.id)!;
                const old = json(retainedBundle);
                const scheduler = productionActorActionScheduler(game)!;
                const advance = vi.spyOn(scheduler, 'advanceActionTime');
                const tick = timeSystem.currentTick, turn = game.stats.turns, inputs = game.recordedInputEvents.length;
                const stamina = resource(game)?.stamina ?? 24;
                await ui.submit('parry', 'nw');
                expect(game.isAdvancing).toBe(true); expect(game.isInputLocked()).toBe(true);
                expect(resource(game).stamina).toBe(stamina - 3);
                expect(resource(game).parryRemainingTicks).toBe(60);
                expect(game.recordedInputEvents).toHaveLength(inputs + 1);
                game.executeCommand('ext:command', parry('nw')); // Locked repeated input costs nothing.
                expect(game.recordedInputEvents).toHaveLength(inputs + 1);
                canvasFrames(game, timeline, count === 2); // Same in-flight path under an open shell modal.
                expect(advance.mock.calls.reduce((sum, [delta]) => sum + delta, 0)).toBe(100);
                advance.mockRestore();
                expect(state(game)).toBe(retainedState);
                expect(game.monsters.find(m => m.id === source.id)).toBe(retainedSource);
                expect(state(game).scheduler.bundles).not.toContain(retainedBundle);
                expect(old.subactions[0]!.phaseRemainingTicks).toBe(10); // Detached historical data stays unchanged.
                expect(retainedBundle.subactions[0]!.phaseRemainingTicks).toBe(0); // Retired live bundle did advance.
                expect(source.ticksUntilTurn).toBe(10);
                expect(defended).toHaveBeenCalledTimes(count);
                expect(defended).toHaveBeenLastCalledWith(source.id, game.player.id, game.depth);
                expect(game.player.hp).toBe(30); expect(source.hp).toBe(sourceHp);
                expect(timeSystem.currentTick).toBe(tick + 100); expect(game.stats.turns).toBe(turn + 1);
                const next = state(game).scheduler.bundles.find(b => b.decisionOwnerId === source.id)!;
                expect(next.actionId).toBeGreaterThan(old.actionId);
                expect(next.elapsedActionTicks).toBe(40);
                expect(next.subactions[0]).toMatchObject({ phaseIndex: 0, phaseRemainingTicks: 10 });
                expect(resource(game)).toMatchObject({ parryRemainingTicks: 0, parryRecoveryRemainingTicks: 0, parryFacing: null, poise: 12 });
                expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]).toMatchObject({ tick: timeSystem.currentTick, turn: game.absoluteTurnNumber });
            }
            game.executeCommand('wait'); canvasFrames(game, timeline);
            expect(defended).toHaveBeenCalledTimes(2);
            expect(game.player.hp).toBeLessThan(30);
        } finally { ui.dispose(); timeline.dispose(); }
    });
    it.each(['parry', 'dodge'] as const)('%s has identical animated UI/headless results, RNG and final recording checkpoints', async action => {
        async function run(animated: boolean, delayed = false, traced = false) {
            const game = scene(), source = rat(game);
            game.animationEnabled = animated;
            const ui = uiSession(game), timeline = ui.timeline;
            const originalNotify = game.extensionRuntime!.notifyActorParried;
            const trace = traced ? createCombatDiagnosticTrace(game) : undefined;
            try {
                acknowledge(); game.executeCommand('wait'); canvasFrames(game, timeline);
                expect(warning(game, source.id).phaseRemainingTicks).toBe(50);
                const tick = timeSystem.currentTick, turn = game.stats.turns, inputs = game.recordedInputEvents.length;
                const randomBefore = rng.getState(), stamina = resource(game)?.stamina ?? 24;
                await ui.submit(action, action === 'parry' ? 'e' : 'w');
                if (animated) {
                    expect(game.isAdvancing).toBe(true); expect(game.isInputLocked()).toBe(true);
                    expect(resource(game).stamina).toBe(stamina - (action === 'parry' ? 3 : 4));
                    expect(rng.getState()).toEqual(randomBefore); // Input/payment has no dice.
                }
                const clock = delayed ? vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6000) : null;
                try { canvasFrames(game, timeline); } finally { clock?.mockRestore(); }
                expect(game.recordedInputEvents).toHaveLength(inputs + 1);
                expect(timeSystem.currentTick).toBe(tick + (action === 'parry' ? 100 : 80));
                expect(game.stats.turns).toBe(turn + 1);
                expect(resource(game)).toMatchObject({ parryRemainingTicks: 0, parryRecoveryRemainingTicks: 0,
                    dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 });
                if (trace) {
                    expect(trace.read().current.defendedCount).toBe(action === 'parry' ? 1 : 0);
                    trace.stop();
                    expect(game.extensionRuntime!.notifyActorParried).toBe(originalNotify);
                }
                const recording = json(game.exportRecording()); recording.recordedAt = 0;
                return { world: mechanical(game), rng: json(rng.getState()), recording };
            } finally { trace?.stop(); ui.dispose(); timeline.dispose(); }
        }
        const baseline = await run(false);
        expect(await run(true)).toEqual(baseline);
        expect(await run(true, true)).toEqual(baseline);
        expect(await run(true, false, true)).toEqual(baseline);
    });
    it('DEV observation is bounded, detached, restores callbacks, and never advances the game', () => {
        const game = scene(), runtime = game.extensionRuntime!;
        const source = game.createSquareMonster(monsters.find(monster => monster.id === 'rat')! as MonsterData, 2, { x: 21, y: 15 })!;
        source.state = MonsterState.HUNTING; source.hp = source.maxHp = 1000;
        (game as any).updateVision(); game.executeCommand('wait');
        expect(source.spatial!.footprintId).toBe('builtin:square-2');
        const original = runtime.notifyActorParried;
        let callback: FrameRequestCallback | undefined;
        let handle = 0;
        vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => { callback = next; return ++handle; });
        const cancel = vi.fn(); vi.stubGlobal('cancelAnimationFrame', cancel);
        const before = mechanical(game), random = json(rng.getState());
        const trace = createCombatDiagnosticTrace(game);
        try {
            for (let n = 0; n < 300; n++) callback!(n * 16);
            source.spatial!.footprintId = 'builtin:square-3';
            expect(trace.read().samples[255].sources[0].spatial.footprintId).toBe('builtin:square-2');
            source.spatial!.footprintId = 'builtin:square-2';
            const result = trace.read();
            expect(result.samples).toHaveLength(256);
            expect(result.current.frame).toBe(300);
            result.current.player.hp = -99;
            expect(trace.read().current.player.hp).toBe(1000);
            expect(mechanical(game)).toEqual(before); expect(rng.getState()).toEqual(random);
            trace.stop(); expect(runtime.notifyActorParried).toBe(original);
            expect(cancel).toHaveBeenCalledWith(handle);
            callback!(9999); expect(trace.read().current.frame).toBe(300);
        } finally { trace.stop(); vi.unstubAllGlobals(); }
    });
    it('repeated DEV start and out-of-order stop leave only the newest observer active', () => {
        const game = scene(), runtime = game.extensionRuntime!, native = runtime.notifyActorParried;
        const a = createCombatDiagnosticTrace(game), retired = runtime.notifyActorParried;
        const b = createCombatDiagnosticTrace(game), current = runtime.notifyActorParried;
        try {
            expect(a.read().current.running).toBe(false);
            a.stop(); expect(runtime.notifyActorParried).toBe(current);
            retired.call(runtime, 21, 1, 1);
            expect(a.read().current.defendedCount).toBe(0);
            runtime.notifyActorParried(21, 1, 1);
            expect(a.read().current.defendedCount).toBe(0);
            expect(b.read().current.defendedCount).toBe(1);
            b.stop(); expect(runtime.notifyActorParried).toBe(native);
            a.stop(); b.stop(); expect(runtime.notifyActorParried).toBe(native);
        } finally { a.stop(); b.stop(); }
    });
    it('DEV defense observer preserves the original receiver, arguments, result and exceptions', () => {
        const game = scene(), runtime = game.extensionRuntime!;
        const native = runtime.notifyActorParried;
        const receiver = {} as typeof runtime, error = new Error('native observer test');
        const original = vi.fn(function (this: typeof runtime, ...args: number[]) {
            expect(this).toBe(receiver); expect(args).toEqual([21, 1, 1]);
            if (original.mock.calls.length > 1) throw error;
            return undefined;
        });
        runtime.notifyActorParried = original;
        const trace = createCombatDiagnosticTrace(game);
        try {
            expect(runtime.notifyActorParried.call(receiver, 21, 1, 1)).toBeUndefined();
            expect(trace.read().current.defendedCount).toBe(1);
            expect(() => runtime.notifyActorParried.call(receiver, 21, 1, 1)).toThrow(error);
            expect(trace.read().current.defendedCount).toBe(1);
            trace.stop(); expect(runtime.notifyActorParried).toBe(original);
        } finally { trace.stop(); runtime.notifyActorParried = native; }
    });
    it.each(['parry', 'dodge'] as const)('%s completes accepted work after a wall-clock-only six-second frame gap', async action => {
        const game = scene(), source = rat(game); game.animationEnabled = true;
        const ui = uiSession(game), timeline = ui.timeline;
        try {
            game.executeCommand('wait'); canvasFrames(game, timeline);
            expect(warning(game, source.id).phaseRemainingTicks).toBe(50);
            const defended = vi.spyOn(game.extensionRuntime!, 'notifyActorParried');
            await ui.submit(action, action === 'parry' ? 'e' : 'w');
            expect(game.isAdvancing).toBe(true);
            logger.log('Diagnostic acknowledgment during accepted defense', '#ffffff', { acknowledge: true });
            expect(timeline.acknowledgment).toBeDefined();
            expect(ui.dialogs.current?.kind).toBe('acknowledgment');
            const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6000);
            try {
                game.tickAdvancement(16); // First ordinary visible frame after browser/background stall.
            } finally { now.mockRestore(); }
            canvasFrames(game, timeline);
            expect(game.hasCompleteRecording).toBe(true);
            if (action === 'parry') expect(defended).toHaveBeenCalledExactlyOnceWith(source.id, game.player.id, game.depth);
            expect(resource(game)).toMatchObject({ parryRecoveryRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 });
        } finally { ui.dispose(); }
    });

    it('expires after a real slow-turn yield without losing its objective block or repeating epilogue/checkpoint', () => {
        function run(animated: boolean) {
            const game = scene(); game.animationEnabled = animated;
            game.player.setStatusDuration('slowed', 5);
            const ui = uiSession(game), timeline = ui.timeline;
            try {
                const inputs = game.recordedInputEvents.length, turns = game.stats.turns;
                game.executeCommand('wait');
                if (animated) {
                    game.tickAdvancement(16);
                    expect(game.isAdvancing).toBe(true);
                    expect(game.pendingPauseMs).toBe(Game.ANIMATION_PAUSE_MS);
                    expect(game.stats.turns).toBe(turns); // Epilogue is still pending.
                    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6000);
                    try { canvasFrames(game, timeline); } finally { now.mockRestore(); }
                } else canvasFrames(game, timeline);
                expect(game.stats.turns).toBe(turns + 1);
                expect(game.recordedInputEvents).toHaveLength(inputs + 1);
                expect(game.hasCompleteRecording).toBe(true);
                const recording = json(game.exportRecording()); recording.recordedAt = 0;
                return { world: mechanical(game), rng: json(rng.getState()), recording };
            } finally { ui.dispose(); }
        }
        expect(run(true)).toEqual(run(false));
    });
    it('expired-branch scheduler exceptions retain the normal error/unlock/single-epilogue safeguard', () => {
        const game = scene(); game.animationEnabled = true;
        const ui = uiSession(game), timeline = ui.timeline;
        try {
            const turns = game.stats.turns, inputs = game.recordedInputEvents.length;
            game.executeCommand('wait');
            const error = new Error('diagnostic expired-branch scheduler failure');
            vi.spyOn(productionActorActionScheduler(game)!, 'advanceActionTime').mockImplementationOnce(() => { throw error; });
            const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6000);
            try { game.tickAdvancement(16); } finally { now.mockRestore(); }
            expect(game.lastAdvancementError).toBe(error);
            expect(game.isAdvancing).toBe(false); expect(game.isInputLocked()).toBe(false);
            expect(game.stats.turns).toBe(turns + 1); expect(game.recordedInputEvents).toHaveLength(inputs + 1);
            expect(game.hasCompleteRecording).toBe(false);
            while (timeline.busy) {
                timeline.tick(16);
                if (ui.dialogs.current?.kind === 'acknowledgment') ui.dialogs.answer(ui.dialogs.current.token, 'more');
            }
            game.tickAdvancement(16);
            expect(game.stats.turns).toBe(turns + 1); expect(game.recordedInputEvents).toHaveLength(inputs + 1);
        } finally { ui.dispose(); }
    });

});
