import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createHeadlessGame } from './harness';
import { setupDialogD3Scene } from './support/dialogD3Scene';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
import { observePresentation, bindPresentationObserver } from '../engine/Core/PresentationObserver';
import { DialogService } from '../ui/dialogService';
import { bindDialogAcknowledgments, bindDialogCommands } from '../ui/dialogAcknowledgments';
import { displayedFrame, presentationTimeline } from '../ui/presentationTimeline';
import { observeDisplayFrame } from '../ui/displayProjection';
import { HUNGER_THRESHOLD } from '../entities/Player';
import { ItemCategory } from '../engine/Items/Item';
import { TerrainType as T } from '../engine/Map/Grid';
import { stepCadence, AUTO_ACTION_INTERVAL_MS } from '../engine/UI/ActionCadence';
import type { Game } from '../engine/Core/Game';

const last = <T>(array: readonly T[]) => array[array.length - 1];
const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); vi.restoreAllMocks(); logger.observeMessages(null); logger.presentAcknowledgments(null); });
function mount(game: Game) {
    const service = new DialogService();
    cleanups.push(bindDialogAcknowledgments(service, game, logger));
    const timeline = presentationTimeline(game)!;
    return { service, timeline };
}
function settleWorld(game: Game) { for (let i = 0; game.isAdvancing && i < 100; i++) game.tickAdvancement(25); expect(game.isAdvancing).toBe(false); }
function playAll(game: Game, service: DialogService, milliseconds = 25) {
    const timeline = presentationTimeline(game)!;
    for (let i = 0; timeline.busy && i < 10000; i++) {
        service.sync();
        if (service.current) service.answer(service.current.token, 'more');
        else timeline.tick(milliseconds);
    }
    expect(timeline.busy).toBe(false);
}
function finalWorld(game: Game) { return { snapshot: game.toSnapshot(), random: rng.getState(), events: structuredClone(game.recordedInputEvents) }; }
function live(animation: boolean, automatic = false, ui = true) {
    const game = createHeadlessGame(33421);
    setupDialogD3Scene(game, animation);
    const mounted = ui ? mount(game) : undefined;
    if (automatic) {
        game.autoPath = [{ x: 11, y: 10 }];
        game.executeCommand('auto_step');
    } else game.executeCommand('move', { x: 1, y: 0 });
    settleWorld(game);
    return { game, ...mounted };
}

// AST inventory pins the existing 21 production sites, not archive IDs. The
// shared log seam is exercised for every source key, alongside live producers.
function ackSources() {
    const result: string[] = [];
    for (const path of ['../engine/Core/Game.ts', '../engine/Core/TimeCoordinator.ts']) {
        const ast = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
        const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node) && node.expression.getText(ast) === 'logger.log'
                && node.arguments[2]?.getText(ast).includes('acknowledge:')) {
                const text = node.arguments[0]!.getText(ast);
                result.push(text.match(/i18next\.t\('([^']+)'/)?.[1] ?? text.match(/'([^']+)'/)![1]!);
            }
            ts.forEachChild(node, visit);
        };
        visit(ast);
    }
    return result;
}

describe('D3 observation and ordered projection', () => {
    it('all 21 unchanged ACK sources share the archive-before-observation seam', () => {
        const sources = ackSources(); expect(sources).toHaveLength(21);
        const game = createHeadlessGame(33421); const { service, timeline } = mount(game);
        for (const source of sources) logger.log(source, '#fff', { acknowledge: true });
        expect(logger.pendingAcknowledgments).toHaveLength(21);
        for (const source of sources) {
            expect(service.current?.text).toBe(source);
            expect(displayedFrame(game)?.logs.find(message => message.text === source)).toBeDefined();
            expect(service.answer(service.current!.token, 'more')).toBe(true);
        }
        expect(timeline.busy).toBe(false);
    });
    it('102 repeated occurrences retain their own sequence/frame while archive count caps at 100', () => {
        const game = createHeadlessGame(33421); const { service, timeline } = mount(game);
        for (let i = 0; i < 102; i++) logger.log('same warning', '#fff', { acknowledge: true });
        expect(last(logger.messages)?.count).toBe(100);
        const suffix = timeline.pendingEvents;
        expect(new Set(suffix.map(event => event.sequence)).size).toBe(suffix.length);
        for (let i = 0; i < 102; i++) {
            expect(service.current?.text).toBe('same warning');
            expect(last(displayedFrame(game)?.logs ?? [])?.count).toBe(Math.min(100, i + 1));
            const token = service.current!.token;
            service.answer(token, 'more'); expect(service.answer(token, 'more')).toBe(false);
        }
        expect(timeline.busy).toBe(false); expect(last(logger.messages)?.count).toBe(100);
    });
    it('observation is copied, immutable, knowledge-safe and never flushes combat or commits discovery', () => {
        const game = createHeadlessGame(33421); setupDialogD3Scene(game, false);
        const unknown = game.grid.getCell(70, 20)!;
        unknown.isVisible = false; unknown.hasMemory = false; unknown.isExplored = false; unknown.isMagicMapped = false;
        const before = JSON.stringify({ cells: (game.grid as any).cells, player: game.player, stats: game.stats });
        const random = rng.getState(); const logCount = logger.messages.length;
        logger.combat('unflushed combat');
        const prohibited = ['toSnapshot', 'updateVision', 'prepareFlareKnowledge'] as const;
        const spies = prohibited.map(name => vi.spyOn(game as any, name).mockImplementation(() => { throw new Error(name); }));
        const archive = vi.spyOn(logger, 'getState').mockImplementation(() => { throw new Error('getState'); });
        const first = observeDisplayFrame(game, logger); const second = observeDisplayFrame(game, logger, first);
        expect(first.map.columns[70]![20]).toBeNull();
        expect(Object.isFrozen(first)).toBe(true); expect(Object.isFrozen(first.player)).toBe(true);
        expect(Object.isFrozen(first.map.columns[10])).toBe(true);
        expect(second.map.columns[70]).toBe(first.map.columns[70]);
        expect(() => { first.player.hp = -999; }).toThrow();
        expect(JSON.stringify({ cells: (game.grid as any).cells, player: game.player, stats: game.stats })).toBe(before);
        expect(rng.getState()).toEqual(random); expect(logger.messages).toHaveLength(logCount);
        for (const spy of [...spies, archive]) expect(spy).not.toHaveBeenCalled();
        logger.flushCombat(); expect(last(logger.messages)?.text).toBe('unflushed combat');
    });
    it('headless capture is absent and broken observers never affect commands or their recording', () => {
        const game = createHeadlessGame(33421);
        expect(presentationTimeline(game)).toBeUndefined();
        const dispose = bindPresentationObserver(game, { observe() { throw new Error('display'); }, reset() {}, blocked() { return false; } });
        logger.observeMessages(() => { throw new Error('display'); });
        expect(() => game.executeCommand('wait')).not.toThrow();
        expect(game.recordedInputEvents).toHaveLength(1); dispose();
    });
    it('ACK before a classic confirmation is displayed first, then resumes the original command', () => {
        const game = createHeadlessGame(33421); const { service, timeline } = mount(game);
        cleanups.push(bindDialogCommands(service, game));
        const food = game.player.inventory.items.find(item => item.category === ItemCategory.FOOD)!;
        const stages = (game as any).applyCommandStages.bind(game);
        vi.spyOn(game as any, 'applyCommandStages').mockImplementation(function* (...args: unknown[]) {
            logger.log('earlier warning', '#fff', { acknowledge: true });
            yield* stages(...args);
        });
        const quantity = food.quantity;
        game.executeItemCommand('eat', food);
        expect(game.hasPendingConfirmation).toBe(true);
        expect(service.current?.text).toBe('earlier warning');
        expect(food.quantity).toBe(quantity);
        service.answer(service.current!.token, 'more');
        expect(service.current?.kind).toBe('confirm');
        service.answer(service.current!.token, 'no');
        expect(game.hasPendingConfirmation).toBe(false);
        expect(last(game.recordedInputEvents)?.decisions).toEqual([false]);
        expect(food.quantity).toBe(quantity); expect(timeline.busy).toBe(false);
    });
    it('memory pressure coalesces optional animation only, preserving ACK frames and terminal', () => {
        const game = createHeadlessGame(33421); const { service, timeline } = mount(game);
        logger.log('first', '#fff', { acknowledge: true });
        for (let i = 0; i < 150; i++) observePresentation(game, 'turn', 25);
        logger.log('last', '#fff', { acknowledge: true });
        game.triggerGameOver(false);
        expect(timeline.diagnostics.suppressedFrames).toBeGreaterThan(0);
        playAll(game, service, 1000);
        expect(timeline.terminalReady).toBe(true); expect(logger.pendingAcknowledgment).toBeUndefined();
        expect(logger.messages.slice(-2).map(message => message.text)).toEqual(['first', 'last']);
    });
});

describe('D3 real pressure plate → paralysis gas → attacks → death', () => {
    it.each([false, true])('animation=%s: first warning shows its own map/HUD/HP and waits indefinitely', animation => {
        const { game, service, timeline } = live(animation);
        expect(game.isGameOver).toBe(true); expect(game.player.hp).toBe(0);
        expect(service!.current?.text).toContain('pressure plate');
        const first = displayedFrame(game)!;
        expect(first.player.hp).toBe(36); expect(first.terminal).toBe(false);
        expect(first.map.columns[11]![10]?.semantic.id).toContain('GAS_TRAP_PARALYSIS');
        expect(first.logs.some(message => message.text.includes('paralyzed'))).toBe(false);
        const finalRandom = rng.getState(); const events = structuredClone(game.recordedInputEvents);
        timeline!.tick(60_000); expect(displayedFrame(game)).toBe(first);
        expect(timeline!.diagnostics.displayTurn).toBeLessThan(timeline!.diagnostics.simulationTurn);
        game.executeCommand('wait'); game.handlePlayerAction('wait', undefined, 'system'); game.stepAutoPath();
        expect(game.recordedInputEvents).toEqual(events); expect(rng.getState()).toEqual(finalRandom);
        service!.answer(service!.current!.token, 'more');
        expect(displayedFrame(game)).not.toBe(first);
        expect(service!.current?.text).toContain('paralyzed');
        expect(displayedFrame(game)!.player.hp).toBeGreaterThan(0);
        playAll(game, service!);
        expect(timeline!.terminalReady).toBe(true); expect(displayedFrame(game)!.player.hp).toBe(0);
        expect(rng.getState()).toEqual(finalRandom); expect(game.recordedInputEvents).toEqual(events);
    });
    it.each([false, true])('animation=%s: explicit results keep every unread occurrence and allow a final save immediately', animation => {
        const { game, timeline, service } = live(animation);
        const archive = structuredClone(logger.messages); const pending = logger.pendingAcknowledgments.map(message => ({ ...message }));
        const random = rng.getState(); expect(timeline!.showResult()).toBe(true); service!.sync();
        expect(service!.current).toBeUndefined(); expect(logger.unreadAcknowledgments).toEqual(pending);
        expect(logger.messages).toEqual(archive); expect(rng.getState()).toEqual(random);
        expect(() => game.toSaveSnapshot()).not.toThrow();
        logger.log('late warning', '#fff', { acknowledge: true });
        expect(service!.current).toBeUndefined(); expect(last(logger.unreadAcknowledgments)?.text).toBe('late warning');
        service!.reset(); expect(timeline!.busy).toBe(false); expect(displayedFrame(game)).toBeUndefined();
        expect(logger.unreadAcknowledgments).toHaveLength(0);
    });
    it.each([false, true])('automatic=%s: varied display waits/frame rates/animation match the entire headless world and both RNGs', automatic => {
        vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
        const expectedRun = live(false, automatic, false); const expected = finalWorld(expectedRun.game);
        for (const animation of [false, true]) for (const frameMs of [1, 25, 1000]) {
            const run = live(animation, automatic);
            run.timeline!.tick(10_000); playAll(run.game, run.service!, frameMs);
            expect(finalWorld(run.game)).toEqual(expected);
            cleanups.pop()!();
        }
    });
    it('new game and snapshot load retire the old cursor and stale answers', () => {
        const game = createHeadlessGame(33421); const saved = game.toSnapshot();
        const { service, timeline } = mount(game);
        logger.log('old warning', '#fff', { acknowledge: true }); const old = service.current!.token;
        game.startNewGame({ seed: 33421 }); service.sync();
        expect(service.answer(old, 'more')).toBe(false); expect(timeline.busy).toBe(false);
        logger.log('other warning', '#fff', { acknowledge: true }); const next = service.current!.token;
        game.loadSnapshot(saved); service.sync();
        expect(service.answer(next, 'more')).toBe(false); expect(displayedFrame(game)).toBeUndefined();
    });
    it('replay loaded/step/playing/seek/restart remain silent with a mounted timeline', () => {
        const game = createHeadlessGame(33421); game.executeCommand('wait'); game.executeCommand('wait');
        const recording = game.exportRecording(); const { service, timeline } = mount(game);
        logger.log('old', '#fff', { acknowledge: true }); game.loadReplay(recording); service.sync();
        expect(service.current).toBeUndefined(); game.replayStep();
        logger.log('replay ACK', '#fff', { acknowledge: true });
        expect(timeline.busy).toBe(false); expect(service.current).toBeUndefined();
        game.replayPlay(); game.tickReplay(1000); expect(game.replayError).toBeNull();
        game.replayRestart(); game.replaySeek(2); expect(game.replayCursor).toBe(2); expect(game.replayError).toBeNull();
        expect(timeline.busy).toBe(false); expect(logger.pendingAcknowledgment).toBeUndefined();
    });
    it('forced food ACK precedes the original consumption and nested turn', () => {
        const game = createHeadlessGame(33421); setupDialogD3Scene(game, false); game.monsters = [];
        game.grid.setTerrain(11, 10, T.FLOOR); game.player.nutrition = 1;
        const { service } = mount(game); const food = game.player.inventory.items.find(item => item.category === ItemCategory.FOOD)!;
        let quantity = -1;
        const consume = game.player.inventory.consumeOne.bind(game.player.inventory);
        const spy = vi.spyOn(game.player.inventory, 'consumeOne').mockImplementation(item => {
            if (item === food) quantity = displayedFrame(game)!.player.nutrition;
            return consume(item);
        });
        game.executeCommand('wait'); expect(service.current?.text).toContain('hunger'); expect(quantity).toBe(0);
        spy.mockRestore();
    });
});


describe('D3 autonomous admission across all existing modes', () => {
    for (const mode of ['auto_explore', 'mouse_travel', 'auto_rest', 'run', 'search_long']) it(`${mode} cannot accrue automatic commands while its display waits`, () => {
        const game = createHeadlessGame(33421); setupDialogD3Scene(game, false);
        game.monsters = []; game.grid.setTerrain(11, 10, T.FLOOR); game.grid.setTerrain(11, 9, T.FLOOR);
        const { service, timeline } = mount(game);
        game.executeCommand(mode, mode === 'mouse_travel' ? { x: 15, y: 10 } : mode === 'run' ? 3 : undefined);
        logger.log('mode warning', '#fff', { acknowledge: true });
        const before = finalWorld(game), step = vi.fn(() => game.stepAutoPath());
        let accumulated = AUTO_ACTION_INTERVAL_MS - 1;
        const allowed = () => !timeline.busy;
        for (let i = 0; i < 50; i++) accumulated = stepCadence(accumulated, 250, AUTO_ACTION_INTERVAL_MS, allowed, step);
        game.stepAutoPath();
        expect(accumulated).toBe(0); expect(step).not.toHaveBeenCalled();
        // Snapshot timestamps are metadata; compare all actual checkpoint fields.
        const after = finalWorld(game); after.snapshot.savedAt = before.snapshot.savedAt;
        expect(after).toEqual(before);
        service.answer(service.current!.token, 'more');
        accumulated = stepCadence(accumulated, 1, AUTO_ACTION_INTERVAL_MS, allowed, step);
        expect(accumulated).toBe(1); expect(step).not.toHaveBeenCalled();
    });
});


describe('D3 slow animation continues while the display waits', () => {
    it('drains the original iterator before a long reading interval and keeps its final checkpoint', () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
        const setup = (animation: boolean) => {
            const game = createHeadlessGame(33421); setupDialogD3Scene(game, animation);
            game.monsters = []; game.grid.setTerrain(11, 10, T.FLOOR); game.grid.setTerrain(11, 9, T.FLOOR);
            game.player.inventory.items = []; game.player.nutrition = HUNGER_THRESHOLD + 1;
            game.player.setStatusDuration('slowed', 100);
            return game;
        };
        const reference = setup(false); reference.executeCommand('wait'); const expected = finalWorld(reference);
        const game = setup(true); const { service, timeline } = mount(game);
        game.executeCommand('wait'); expect(game.isAdvancing).toBe(true);
        game.tickAdvancement(25); expect(game.isAdvancing).toBe(true);
        expect(timeline.acknowledgment).toBeDefined();
        const first = displayedFrame(game)!;
        for (let i = 0; i < 5; i++) { game.tickAdvancement(25); timeline.tick(25); }
        expect(game.isAdvancing).toBe(false); expect(displayedFrame(game)).toBe(first);
        vi.spyOn(Date, 'now').mockReturnValue(1_800_000_060_000);
        timeline.tick(60_000); expect(displayedFrame(game)).toBe(first);
        expect(game.lastAdvancementError).toBeNull();
        playAll(game, service);
        const actual = finalWorld(game); actual.snapshot.savedAt = expected.snapshot.savedAt;
        expect(actual).toEqual(expected);
    });
});


describe('extension-neutral world marker projection', () => {
    it('captures visible interactable DTOs and marker precedence without future-state reads or rule RNG', () => {
        const game = createHeadlessGame(33421);
        setupDialogD3Scene(game, false);
        const marker = { id: 71, owner: 'fixture', depth: 1, x: 9, y: 10,
            nameKey: 'fixture.name', descriptionKey: 'fixture.description', glyph: '人', color: '#c3ad80',
            interactionDistance: 1, priority: 0 };
        const read = vi.spyOn(game, 'readVisibleInteractables').mockReturnValue([marker]);
        const before = rng.getState();
        const frame = observeDisplayFrame(game, logger);
        expect(read).toHaveBeenCalledTimes(1);
        expect(frame.interactables).toEqual([marker]);
        expect(frame.map.entities.some(entity => entity.x === 9 && entity.y === 10 && entity.semantic.original === '人')).toBe(true);
        marker.x = 13;
        expect(frame.interactables[0]?.x).toBe(9);
        expect(Object.isFrozen(frame.interactables[0])).toBe(true);
        expect(rng.getState()).toEqual(before);
        marker.x = 12; // The visible goblin has precedence over the marker.
        expect(observeDisplayFrame(game, logger).map.entities.some(entity => entity.x === 12 && entity.y === 10 && entity.semantic.original === '人')).toBe(false);
    });
});


describe('transactional presentation rollback', () => {
    it('restores frozen acknowledgment identity and the queued presentation after a failed producer', () => {
        const game = createHeadlessGame(33421);
        setupDialogD3Scene(game, false);
        const { service, timeline } = mount(game);
        logger.log('committed warning', '#fff', { acknowledge: true });
        const occurrence = logger.pendingAcknowledgment!;
        const token = service.current!.token;
        const frame = timeline.projection;
        const before = timeline.diagnostics;
        const restore = logger.checkpoint();
        logger.log('failed warning', '#fff', { acknowledge: true });
        observePresentation(game, 'command-complete');
        expect(timeline.pendingEvents.length).toBeGreaterThan(0);
        restore();
        expect(timeline.diagnostics).toEqual(before);
        expect(timeline.projection).toBe(frame);
        expect(logger.pendingAcknowledgment).toBe(occurrence);
        expect(service.current?.token).toBe(token);
        expect(service.answer(token, 'more')).toBe(true);
        expect(timeline.busy).toBe(false);
        expect(logger.messages.some(message => message.text === 'failed warning')).toBe(false);
        expect(service.current).toBeUndefined();
    });
});
