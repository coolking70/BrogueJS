import { afterEach, describe, expect, it, vi } from 'vitest';
import { Graphics } from 'pixi.js';
import { effectScope, ref } from 'vue';
import { DialogService } from '../../../../ui/dialogService';
import { useCombatUi } from '../ui/useCombatUi';
import { Game } from '../../../../engine/Core/Game';
import { createActorActionBundle } from '../../../../engine/Core/ActorActionScheduler';
import { squareDisplayScene } from '../../../../test/support/squareDisplayScene';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import { observeDisplayFrame } from '../../../../ui/displayProjection';
import { readPublicCombatTelegraphs, paintCombatTelegraphs, telegraphsAt, type DisplayTelegraph } from '../../../../ui/combatDrawing';
import { displayedFrame, PresentationTimeline } from '../../../../ui/presentationTimeline';
import { observePresentation } from '../../../../engine/Core/PresentationObserver';
import type { Json } from '../../../types';
import { installCombatDiagnostics, placeCombatTelegraphFixture } from '../ui/diagnostics';
import { loadCombatDefinitionPack } from '../definitions';
import { combatAttackDefinitions, initialProductionCombatState } from '../production';
import { projectCombatView } from '../view';

const disposers: (() => void)[] = [];
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); vi.restoreAllMocks(); vi.unstubAllGlobals(); logger.observeMessages(null); logger.presentAcknowledgments(null); });
function scene() {
    const game = new Game(); game.startNewGame({ seed: 403003, mode: 'test', ruleSet: 'extended', extensions: [] });
    const monster = squareDisplayScene(game);
    const state = { schema: 1, telegraphs: [{ actionId: 1, sourceSubactionId: 1, sourceEntityId: monster.id,
        phase: 'windup', parryable: false, remainingTicks: 50,
        cells: [{ x: 15, y: 11 }, { x: 15, y: 12 }, { x: 15, y: 13 }] }] };
    const read = vi.spyOn(game.extensionRuntime!, 'readModuleView').mockImplementation(id => id === 'combat'
        ? { session: {}, state: state as unknown as Record<string, Json>, definitions: {}, playerId: game.player.id, components: {}, canManageCharacter: true } : null);
    return { game, monster, state, read };
}
const warning = (actionId: number, phase: DisplayTelegraph['phase'], cells = [{ x: 1, y: 1 }]): DisplayTelegraph =>
    ({ actionId, phase, cells, sourceSubactionId: 1, sourceEntityId: 1 });

describe('EXT-3b public telegraph projection and drawing', () => {
    it('projects only the current segment property and authoritative remaining time without future definitions or RNG', () => {
        const definitions = structuredClone(combatAttackDefinitions(loadCombatDefinitionPack()));
        const attack = definitions.attacks.find(attack => attack.id === 'fixture.double-thrust')!;
        attack.segments[0]!.parryable = false; attack.segments[1]!.parryable = true;
        const state = initialProductionCombatState();
        const bundle = createActorActionBundle({owner:'combat',  actionId: 1, depth: 1, decisionOwnerId: 10, timeChargeOwnerId: 10,
            subactions: [{ sourceEntityId: 10, sourcePartId: 'body', sourceFootprintVersion: 'fixture-v1',
                phases: [{ kind: 'windup', durationTicks: attack.windupTicks, segmentIndex: 0 },
                    { kind: 'inter-segment', durationTicks: attack.segments[1]!.delayTicks, segmentIndex: 1 },
                    { kind: 'recovery', durationTicks: attack.recoveryTicks, segmentIndex: null }] }] });
        const source = bundle.subactions[0]!, segment = attack.segments[0]!;
        const bundles=[bundle];
        state.actions.push({ actionId: 1, profileId: definitions.playerProfileId, paidCost: attack.cost,
            subactions: [{ sourceSubactionId: source.sourceSubactionId, attackId: attack.id, facing: 'e',
                lockedCells: [{ x: 11, y: 10 }], approvedRisks: [],
                shape: { schema: 1, kind: 'footprint-offset-union', offsets: structuredClone(segment.shape.offsets.e),
                    selfExclusion: segment.shape.selfExclusion } }] });
        source.phaseRemainingTicks = 17;
        const project = (depth = 1) => projectCombatView(state as unknown as Json, definitions, depth, 1,undefined,undefined, bundles) as { telegraphs: Json[] };
        const before = { state: structuredClone(state), definitions: structuredClone(definitions), rng: rng.getState() };
        const current = project().telegraphs;
        const first = { actionId: 1, sourceSubactionId: source.sourceSubactionId, sourceEntityId: 10,
            cells: [{ x: 11, y: 10 }], phase: 'windup', parryable: false, remainingTicks: 17 };
        expect(current).toEqual([first]); expect(project(2).telegraphs).toEqual([]);
        for (let i = 0; i < 5; i++) expect(project().telegraphs).toEqual(current);
        expect({ state, definitions, rng: rng.getState() }).toEqual(before);
        source.phaseIndex = 1; source.phaseRemainingTicks = 9;
        state.actions[0]!.subactions[0]!.lockedCells[0]!.x = 12;
        expect(project().telegraphs).toEqual([{ ...first, cells: [{ x: 12, y: 10 }],
            phase: 'inter-segment', parryable: true, remainingTicks: 9 }]);
        expect(current).toEqual([first]); // Prior warning remains a detached snapshot.
        source.phaseIndex = 2; expect(project().telegraphs).toEqual([]);
    });
    it('copies and freezes only current visible cells, with no hidden source or remembered terrain leak', () => {
        const { game, monster, state } = scene();
        game.grid.getCell(15, 12)!.isVisible = false;
        state.telegraphs[0]!.cells.push({ x: 15, y: 11 }, { x: -1, y: 0 });
        const result = readPublicCombatTelegraphs(game);
        expect(result).toHaveLength(1); expect(result[0]!.cells).toEqual([{ x: 15, y: 11 }, { x: 15, y: 13 }]);
        expect(result[0]).toMatchObject({ parryable: false, remainingTicks: 50 });
        expect(Object.isFrozen(result)).toBe(true); expect(Object.isFrozen(result[0])).toBe(true);
        expect(Object.isFrozen(result[0]!.cells[0])).toBe(true);
        state.telegraphs[0]!.cells[0]!.x = 16;
        state.telegraphs[0]!.parryable = true; state.telegraphs[0]!.remainingTicks = 1;
        expect(result[0]!.cells[0]!.x).toBe(15); expect(result[0]).toMatchObject({ parryable: false, remainingTicks: 50 });
        monster.setStatusDuration('invisible', 10); game.player.setStatusDuration('telepathy', 10);
        expect(readPublicCombatTelegraphs(game)).toEqual([]);
        monster.setStatusDuration('invisible', 0);
        for (const cell of game.footprintOf(monster)) game.grid.getCell(cell.x, cell.y)!.isVisible = false;
        expect(readPublicCombatTelegraphs(game)).toEqual([]);
    });
    it('keeps absent or malformed warning metadata unknown without discarding visible geometry', () => {
        const { game, state } = scene();
        const source = state.telegraphs[0]! as unknown as Record<string, unknown>;
        for (const [parryable, remainingTicks] of [[undefined, undefined], [null, null], ['false', '50'],
            [0, -1], [1, Infinity], [{}, 1.5], [[], Number.MAX_SAFE_INTEGER + 1]]) {
            Object.assign(source, { parryable, remainingTicks });
            const result = readPublicCombatTelegraphs(game);
            expect(result).toHaveLength(1); expect(result[0]!.cells).toHaveLength(3);
            expect(result[0]).not.toHaveProperty('parryable'); expect(result[0]).not.toHaveProperty('remainingTicks');
        }
        delete source.parryable; delete source.remainingTicks;
        expect(readPublicCombatTelegraphs(game)[0]).not.toHaveProperty('parryable');
        expect(readPublicCombatTelegraphs(game)[0]).not.toHaveProperty('remainingTicks');
        Object.assign(source, { parryable: true, remainingTicks: 0 });
        expect(readPublicCombatTelegraphs(game)[0]).toMatchObject({ parryable: true, remainingTicks: 0 });
        source.parryable = false; source.remainingTicks = undefined;
        expect(readPublicCombatTelegraphs(game)[0]).toMatchObject({ parryable: false });
        expect(readPublicCombatTelegraphs(game)[0]).not.toHaveProperty('remainingTicks');
    });
    it('accepts a partially visible body source without revealing its hidden cells or unreleased phases', () => {
        const { game, monster, state } = scene();
        for (const cell of game.footprintOf(monster)) game.grid.getCell(cell.x, cell.y)!.isVisible = false;
        game.grid.getCell(14, 13)!.isVisible = true;
        expect(readPublicCombatTelegraphs(game)).toHaveLength(1);
        state.telegraphs[0]!.phase = 'recovery'; expect(readPublicCombatTelegraphs(game)).toEqual([]);
        state.telegraphs[0]!.phase = 'complete'; expect(readPublicCombatTelegraphs(game)).toEqual([]);
        state.telegraphs[0]!.phase = 'inter-segment'; expect(readPublicCombatTelegraphs(game)[0]!.phase).toBe('inter-segment');
    });
    it('old ACK frames retain old telegraphs while the live source moves, changes phase and clears', () => {
        const { game, state, read } = scene();
        logger.presentAcknowledgments(() => true);
        const timeline = new PresentationTimeline(game, logger); disposers.push(() => timeline.dispose());
        logger.log('telegraph fixture', '#fff', { acknowledge: true });
        const historical = displayedFrame(game)!;
        expect(historical.telegraphs).toHaveLength(1);
        state.telegraphs[0]!.cells = [{ x: 20, y: 20 }]; state.telegraphs[0]!.phase = 'inter-segment';
        state.telegraphs[0]!.remainingTicks = 9; state.telegraphs[0]!.parryable = true;
        observePresentation(game, 'command-complete');
        expect(displayedFrame(game)).toBe(historical);
        const capturedCalls = read.mock.calls.length;
        const graphics = new Graphics(); paintCombatTelegraphs(graphics, displayedFrame(game)!.telegraphs, 16); graphics.destroy();
        expect(read).toHaveBeenCalledTimes(capturedCalls);
        expect(displayedFrame(game)!.telegraphs[0]!.cells).toEqual([{ x: 15, y: 11 }, { x: 15, y: 12 }, { x: 15, y: 13 }]);
        expect(displayedFrame(game)!.telegraphs[0]).toMatchObject({ remainingTicks: 50, parryable: false });
        state.telegraphs = []; observePresentation(game, 'command-complete');
        expect(timeline.acknowledge(timeline.acknowledgment!)).toBe(true);
        expect(displayedFrame(game)).toBeUndefined(); expect(observeDisplayFrame(game, logger).telegraphs).toEqual([]);
        expect(historical.telegraphs[0]).toMatchObject({ phase: 'windup', remainingTicks: 50, parryable: false });
    });
    it('captures detached public module resources in old ACK frames without future stamina or session capabilities', () => {
        const game = new Game(); game.startNewGame({ seed: 403003, mode: 'test', ruleSet: 'extended', extensions: ['combat'] });
        squareDisplayScene(game); game.monsters = []; game.monsterListsChanged();
        const binding = game.extensionRuntime!.actorActionBinding()!;
        const row = { actorId: game.player.id, profileId: binding.definition.playerProfileId, stamina: 17,
            regenRemainder: 0, regenDelayRemaining: 13, dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0, poise:12,poiseRecoveryRemainder:0,poiseRecoveryDelayRemaining:0,parryRemainingTicks:0,parryRecoveryRemainingTicks:0,parryFacing:null,staggerRemainingTicks:0 };
        binding.state.actors.push(row);
        logger.presentAcknowledgments(() => true);
        const timeline = new PresentationTimeline(game, logger); disposers.push(() => timeline.dispose());
        logger.log('stamina history fixture', '#fff', { acknowledge: true });
        const historical = displayedFrame(game)!;
        expect(historical.moduleViews.combat!.resources).toMatchObject({ stamina: 17, capacity: 24, regenDelayRemaining: 13 });
        expect(Object.isFrozen(historical.moduleViews.combat!.resources)).toBe(true);
        expect(Object.keys(historical.moduleViews.combat!)).not.toContain('session');
        expect(Object.keys(historical.moduleViews.combat!)).not.toContain('actors');
        const dialogs = new DialogService(), scope = effectScope();
        disposers.push(() => { scope.stop(); dialogs.dispose(); });
        const ui = scope.run(() => useCombatUi({ game: () => game, dialogs, tick: ref(0), immersive: ref(false),
            readDisplayFrame: () => displayedFrame(game) ?? observeDisplayFrame(game, logger),
            isPresentationBusy: () => timeline.busy, canOpenPanel: () => true, beforeOpenPanel: () => {}, afterClosePanel: () => {},
        }))!;
        row.stamina = 2; row.regenDelayRemaining = 35; observePresentation(game, 'command-complete');
        const read = vi.spyOn(game.extensionRuntime!, 'readModuleView'); ui.refresh();
        expect(read).not.toHaveBeenCalled();
        expect(ui.hud.value!.props.resources).toMatchObject({ stamina: 17, regenDelayRemaining: 13 });
        expect(displayedFrame(game)).toBe(historical);
        expect(timeline.acknowledge(timeline.acknowledgment!)).toBe(true); ui.refresh();
        expect(ui.hud.value!.props.resources).toMatchObject({ stamina: 2, regenDelayRemaining: 35 });
        expect(historical.moduleViews.combat!.resources).toMatchObject({ stamina: 17, regenDelayRemaining: 13 });
    });
    it('stable overlap priority draws once per cell and retains the ordered inspection list', () => {
        const later = warning(8, 'inter-segment'), first = warning(9, 'windup'), next = warning(1, 'windup');
        const traces: unknown[] = [];
        for (const list of [[later, first, next], [next, later, first]]) {
            const graphics = new Graphics(); paintCombatTelegraphs(graphics, list, 16);
            const instructions = graphics.context.instructions;
            expect(instructions.filter(entry => entry.action === 'fill')).toHaveLength(1);
            expect(instructions.filter(entry => entry.action === 'stroke')).toHaveLength(2);
            traces.push(instructions.map(entry => entry.action === 'fill' || entry.action === 'stroke'
                ? { action: entry.action, color: entry.data.style.color, alpha: entry.data.style.alpha, path: entry.data.path.instructions } : entry.action));
            graphics.destroy();
        }
        expect(traces[0]).toEqual(traces[1]);
        expect(telegraphsAt([later, first, next], { x: 1, y: 1 }).map(entry => entry.actionId)).toEqual([1, 9, 8]);
        expect(telegraphsAt([later, first], { x: 2, y: 2 })).toEqual([]);
    });
    it('repeated capture/drawing never changes either rule RNG, ticks, module state or native HP', () => {
        const { game, state } = scene();
        const before = { rng: rng.getState(), turn: game.absoluteTurnNumber, hp: game.player.hp,
            tick: game.player.ticksUntilTurn, state: JSON.stringify(state) };
        for (let i = 0; i < 10; i++) {
            const frame = observeDisplayFrame(game, logger), graphics = new Graphics();
            paintCombatTelegraphs(graphics, frame.telegraphs, 16); graphics.destroy();
        }
        expect({ rng: rng.getState(), turn: game.absoluteTurnNumber, hp: game.player.hp,
            tick: game.player.ticksUntilTurn, state: JSON.stringify(state) }).toEqual(before);
    });
    it('missing combat and malformed public entries produce no unsafe geometry', () => {
        const { game, state, read } = scene();
        state.telegraphs[0]!.cells = [{ x: Infinity, y: 1 }, { x: 1.5, y: 1 }];
        expect(readPublicCombatTelegraphs(game)).toEqual([]);
        read.mockReturnValue(null); expect(readPublicCombatTelegraphs(game)).toEqual([]);
        const graphics = new Graphics(); paintCombatTelegraphs(graphics, [], 16);
        expect(graphics.context.instructions).toEqual([]); graphics.destroy();
    });
});


describe('EXT-3b development warning fixture', () => {
    it('keeps the fixture export guard until a validated new run retires it, including a reused Game', () => {
        const game = new Game(); game.startNewGame({ seed: 403003, mode: 'test', ruleSet: 'extended', extensions: ['combat'] });
        squareDisplayScene(game); game.monsters = []; game.monsterListsChanged();
        placeCombatTelegraphFixture(game, 'stomp');
        expect(() => game.toSaveSnapshot()).toThrow('fixture');
        expect(() => game.startNewGame({ ruleSet: 'extended', extensions: ['missing-module'] })).toThrow();
        expect(() => game.exportRecording()).toThrow('fixture');

        const fresh = new Game();
        expect(() => fresh.startNewGame({ seed: 403004, mode: 'test', ruleSet: 'extended', extensions: ['combat'] })).not.toThrow();
        expect(() => fresh.toSaveSnapshot()).not.toThrow();
        expect(() => game.toSaveSnapshot()).toThrow('fixture');

        expect(() => game.startNewGame({ seed: 403004, mode: 'test', ruleSet: 'extended', extensions: ['combat'] })).not.toThrow();
        game.animationEnabled = false;
        game.executeCommand('wait');
        expect(() => game.toSaveSnapshot()).not.toThrow();
        expect(() => game.exportRecording()).not.toThrow();
    });
    it('places a real two-square source on safe floor, starts its genuine NPC windup and blocks exports', () => {
        const game = new Game(); game.startNewGame({ seed: 403003, mode: 'test', ruleSet: 'extended', extensions: ['combat'] });
        squareDisplayScene(game); game.monsters = []; game.monsterListsChanged();
        vi.stubGlobal('window', {}); const remove = installCombatDiagnostics(game); disposers.push(remove);
        const fixture = (window as unknown as { debug_combat_telegraphs: typeof run }).debug_combat_telegraphs('stomp');
        function run(attack?: 'parryable' | 'stomp') { return placeCombatTelegraphFixture(game, attack); }
        expect(fixture.size).toBe(2); expect(fixture.sourceCells).toHaveLength(4);
        expect(fixture.telegraphs).toHaveLength(1); expect(fixture.telegraphs[0]).toMatchObject({ sourceEntityId: fixture.sourceEntityId,
            phase: 'windup', parryable: false, remainingTicks: 50 });
        expect(fixture.telegraphs[0]!.cells).toContainEqual({ ...game.player.loc });
        for (const name of ['toSnapshot', 'toSaveSnapshot', 'exportRecording'] as const) expect(() => game[name]()).toThrow('fixture');
        remove(); expect((window as unknown as Record<string, unknown>).debug_combat_telegraphs).toBeUndefined();
    });
    it('real active warning survives attack direction confirmation and Cancel with exact mechanical state and RNG', () => {
        const game = new Game(); game.startNewGame({ seed: 403003, mode: 'test', ruleSet: 'extended', extensions: ['combat'] });
        squareDisplayScene(game); game.monsters = []; game.monsterListsChanged();
        const fixture = placeCombatTelegraphFixture(game, 'stomp'); expect(fixture.telegraphs).toHaveLength(1);
        const dialogs = new DialogService(), scope = effectScope();
        disposers.push(() => { scope.stop(); dialogs.dispose(); });
        const ui = scope.run(() => useCombatUi({ game: () => game, dialogs, tick: ref(0), immersive: ref(false),
            readDisplayFrame: () => observeDisplayFrame(game, logger), isPresentationBusy: () => false,
            canOpenPanel: () => true, beforeOpenPanel: () => {}, afterClosePanel: () => {},
        }))!;
        const checkpoint = () => ({ turn: game.absoluteTurnNumber, inputs: game.recordedInputEvents.length,
            hp: game.player.hp, nutrition: game.player.nutrition, loc: { ...game.player.loc }, ticks: game.player.ticksUntilTurn,
            state: JSON.stringify(game.extensionRuntime!.actorActionBinding()!.state), rng: rng.getState(),
            pending: game.pendingCommandConfirmation, acknowledgment: logger.pendingAcknowledgment });
        const before = checkpoint(), command = vi.spyOn(game, 'executeCommand');
        const warnings = ui.hud.value!.props.entries;
        (ui.bar.value!.props.onAttack as (id: string) => void)('fixture.slash');
        expect(ui.hud.value!.props.entries).toEqual(warnings);
        game.updateHover(30, 25); // A map cell outside this source's locked ring.
        expect(fixture.telegraphs[0]!.cells).not.toContainEqual({ x: 30, y: 25 });
        expect(dialogs.answer(dialogs.current!.token, 'choice:e')).toBe(true);
        expect(ui.hud.value!.props.entries).toEqual(warnings);
        expect(dialogs.answer(dialogs.current!.token, 'close')).toBe(true); ui.refresh();
        expect(ui.hud.value!.props.entries).toEqual(warnings);
        expect(ui.hud.value!.props.focused).toBe(false);
        expect(command).not.toHaveBeenCalled(); expect(checkpoint()).toEqual(before);
        expect(readPublicCombatTelegraphs(game)).toEqual(fixture.telegraphs);
    });
    it('rejects unavailable module and no-space before changing RNG or blocking exports', () => {
        const game = new Game(); game.startNewGame({ seed: 403003, mode: 'test', ruleSet: 'extended', extensions: [] });
        expect(() => placeCombatTelegraphFixture(game)).toThrow('Enable combat');
        game.startNewGame({ seed: 403003, mode: 'test', ruleSet: 'extended', extensions: ['combat'] });
        squareDisplayScene(game); game.monsters = []; game.monsterListsChanged();
        for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) game.grid.getCell(x, y)!.isVisible = false;
        const before = rng.getState(), count = game.monsters.length;
        expect(() => placeCombatTelegraphFixture(game)).toThrow('No safe visible adjacent floor');
        expect(rng.getState()).toEqual(before); expect(game.monsters).toHaveLength(count);
        expect(() => game.exportRecording()).not.toThrow();
    });
});
