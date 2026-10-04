import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { createHeadlessGame } from './harness';
import { setupDialogD4Scene } from './support/dialogD4Scene';
import { Game } from '../engine/Core/Game';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';
import { TerrainType as T } from '../engine/Map/Grid';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { LightKind } from '../engine/Map/LightCatalog';
import { DialogService } from '../ui/dialogService';
import { bindDialogCommands } from '../ui/dialogAcknowledgments';
import { recordingJsonAtBoundary } from '../ui/recordingExport';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function arrange(g: Game, animated = false) {
    const result = setupDialogD4Scene(g, animated);
    // Test-only seed reconstruction below reproduces this diagnostic world.
    // The browser fixture itself always revokes complete-recording eligibility.
    (g as any).recordingFromNewGame = true;
    return result;
}
function scene(animated = false) {
    const g = createHeadlessGame(33441);
    const result = arrange(g, animated);
    g.executeItemCommand('use', result.item);
    for (let i = 0; i < 10; i++) g.executeCommand('move', { x: 1, y: 0 });
    expect(g.pendingArcana?.cursor).toEqual(result.aim);
    expect(g.getArcanaPreview()?.risk).toBe('possible');
    return { g, ...result };
}
function world(g: Game) {
    return structuredClone({ loc: g.player.loc, hp: g.player.hp, nutrition: g.player.nutrition,
        inventory: g.player.inventory.items.map(item => ({ ...item })),
        tick: timeSystem.currentTick, turn: g.absoluteTurnNumber, rng: rng.getState() });
}
function drain(g: Game) { while (g.isAdvancing) g.tickAdvancement(25); }
function answer(g: Game, decision: boolean) {
    const token = g.pendingCommandConfirmation!.token;
    expect(g.resolveCommandDecision(token, decision)).toBe(true);
    expect(g.resolveCommandDecision(token, !decision)).toBe(false);
}
function reconstruct(g: Game) {
    const start = g.startNewGame.bind(g);
    vi.spyOn(g, 'startNewGame').mockImplementation(options => { const animated = g.animationEnabled; start(options); arrange(g, animated); });
}

describe('D4 blink command continuation and protocol', () => {
    it.each([false, true])('answer %s resumes the real command once and records only the risk action', decision => {
        const { g, item, landing } = scene();
        const before = world(g), index = g.recordedInputEvents.length;
        const prefix = vi.spyOn(g as any, 'finishTransientDisplay');
        const zap = vi.spyOn(g, 'zapBoltFromPlayer');
        g.onCommandConfirmRequest = () => {};
        g.onConfirmRequest = () => { throw new Error('native resolver'); };
        g.executeCommand('confirm_target');
        expect(g.pendingCommandConfirmation?.message).toBe('Blink across lava with unknown range?');
        expect(g.recordedInputEvents).toHaveLength(index);
        expect(world(g)).toEqual(before);
        g.executeCommand('wait'); g.handlePlayerAction('escape', undefined, 'system'); g.stepAutoPath();
        g.tickAdvancement(6000);
        expect(world(g)).toEqual(before);
        expect(prefix).toHaveBeenCalledTimes(1);
        answer(g, decision); drain(g);
        expect(prefix).toHaveBeenCalledTimes(1);
        expect(g.pendingArcana).toBeNull(); expect(g.hasPendingConfirmation).toBe(false);
        expect(g.recordedInputEvents).toHaveLength(index + 1);
        expect(g.recordedInputEvents[index]).toMatchObject({ action: 'arcana:risk-confirm', data: null, decisions: [decision] });
        expect(zap).toHaveBeenCalledTimes(decision ? 1 : 0);
        if (decision) {
            expect(item.charges).toBe(1); expect(g.player.loc).toEqual(landing);
            expect(g.absoluteTurnNumber).toBe(before.turn + 1);
            expect(timeSystem.currentTick).toBe(before.tick + g.player.movementSpeed);
        } else expect(world(g)).toEqual(before);
    });
    it.each([false, true])('map point selection preserves its ray/data and original justRested prefix for answer %s', decision => {
        const { g, item, aim } = scene();
        g.executeCommand('cancel_target'); g.executeCommand('wait');
        expect(g.toSaveSnapshot().run.justRested).toBe(true);
        g.executeItemCommand('use', item); g.onCommandConfirmRequest = () => {};
        g.executeCommand('mouse_travel', aim); answer(g, decision);
        const expected = g.toSaveSnapshot().run.justRested;
        expect(expected).toBe(true);
        expect(g.recordedInputEvents[g.recordedInputEvents.length - 1]).toMatchObject({ action: 'arcana:risk-confirm', data: aim, decisions: [decision] });
        const recording = g.exportRecording(); reconstruct(g);
        expect(g.loadReplay(recording)).toBe(true); g.replaySeek(recording.events.length);
        expect(g.replayError).toBeNull(); expect(g.pendingArcana).toBeNull();
        expect(g.toSaveSnapshot().run.justRested).toBe(expected);
    });
    it.each([false, true])('answer %s loaded step, playing, restart/seek and save continuation have zero OOS and no UI', decision => {
        const { g } = scene(true); g.onCommandConfirmRequest = () => {};
        g.executeCommand('confirm_target'); answer(g, decision); drain(g);
        const expected = world(g), recording = g.exportRecording(), save = g.toSaveSnapshot();
        expect(recording.version).toBe(3); expect(save.version).toBe(3);
        reconstruct(g);
        g.onCommandConfirmRequest = () => { expect(g.pendingCommandConfirmation).toBeNull(); };
        g.onConfirmRequest = () => { throw new Error('replay resolver'); };
        expect(g.loadReplay(recording)).toBe(true);
        while (g.replayCursor < recording.events.length && !g.replayError) { g.replayStep(); drain(g); }
        expect(g.replayError).toBeNull(); expect(world(g)).toEqual(expected);
        g.replayRestart(); g.replaySeek(recording.events.length);
        expect(g.replayError).toBeNull(); expect(world(g)).toEqual(expected);
        g.replayRestart(); g.replayPlay();
        for (let i = 0; i < 1000 && g.replayStatus !== 'finished' && !g.replayError; i++) { g.tickReplay(250); drain(g); }
        expect(g.replayStatus).toBe('finished'); expect(g.replayError).toBeNull(); expect(world(g)).toEqual(expected);
        expect(g.loadSnapshot(save)).toBe(true); expect(g.hasCompleteRecording).toBe(true);
        g.onCommandConfirmRequest = () => {}; g.animationEnabled = false;
        g.executeItemCommand('use', g.player.inventory.items[0]!);
        g.executeCommand('move', { x: decision ? -1 : 1, y: 0 });
        g.executeCommand('confirm_target');
        if (g.hasPendingConfirmation) answer(g, false);
        drain(g);
        const resumed = g.exportRecording();
        expect(resumed.events.slice(0, recording.events.length)).toEqual(recording.events);
        expect(g.loadReplay(resumed)).toBe(true); g.replaySeek(resumed.events.length);
        expect(g.replayError).toBeNull(); expect(g.replayCursor).toBe(resumed.events.length);
    });
    it.each(['missing', 'surplus'])('new action rejects %s answers as OOS without Host', kind => {
        const { g } = scene(); g.onConfirmRequest = () => false; g.executeCommand('confirm_target');
        const recording = g.exportRecording(); recording.events[recording.events.length - 1]!.decisions = kind === 'missing' ? [] : [false, true];
        reconstruct(g); g.onConfirmRequest = () => { throw new Error('replay resolver'); };
        g.onCommandConfirmRequest = () => { expect(g.pendingCommandConfirmation).toBeNull(); };
        expect(g.loadReplay(recording)).toBe(true); g.replaySeek(recording.events.length);
        expect(g.replayError).toContain(`OOS at command ${recording.events.length}`);
        expect(g.replayCursor).toBe(recording.events.length - 1);
    });
    it.each(['step', 'seek', 'playing'])('old approved confirm_target retains its answerless interpretation in %s', mode => {
        const { g } = scene(); g.onConfirmRequest = () => true; g.executeCommand('confirm_target');
        const recording = g.exportRecording();
        Object.assign(recording.events[recording.events.length - 1]!, { action: 'confirm_target', decisions: [] });
        const expected = world(g); reconstruct(g);
        g.onConfirmRequest = () => { throw new Error('historical UI'); };
        g.onCommandConfirmRequest = () => { expect(g.pendingCommandConfirmation).toBeNull(); };
        expect(g.loadReplay(recording)).toBe(true);
        if (mode === 'seek') g.replaySeek(recording.events.length);
        else {
            if (mode === 'playing') g.replayPlay();
            while (g.replayCursor < recording.events.length && !g.replayError) g.replayStep();
        }
        expect(g.replayError).toBeNull(); expect(world(g)).toEqual(expected);
        expect(recording.events[recording.events.length - 1]!.decisions).toEqual([]);
    });
    it('old cancellation remains an information gap; no checkpoint inference or manufactured answer', () => {
        const { g } = scene(); g.onConfirmRequest = () => false; g.executeCommand('confirm_target');
        const recording = g.exportRecording(); Object.assign(recording.events[recording.events.length - 1]!, { action: 'confirm_target', decisions: [] });
        reconstruct(g); expect(g.loadReplay(recording)).toBe(true); g.replaySeek(recording.events.length);
        expect(g.replayError).toContain('OOS'); expect(recording.events[recording.events.length - 1]!.decisions).toEqual([]);
    });
    it('P0 unsampled flare uses only the same cosmetic prefix as synchronous refusal, never a second prefix', () => {
        const sync = scene(); sync.g.createFlare(10, 10, LightKind.SCROLL_ENCHANTMENT_LIGHT);
        const initial = rng.getState(); sync.g.onConfirmRequest = () => false;
        sync.g.executeCommand('confirm_target'); const expected = world(sync.g);
        expect(expected.rng.streams[0]).toEqual(initial.streams[0]);
        expect(expected.rng.streams[1]).not.toEqual(initial.streams[1]);
        const { g } = scene(); g.createFlare(10, 10, LightKind.SCROLL_ENCHANTMENT_LIGHT);
        g.onCommandConfirmRequest = () => {}; g.executeCommand('confirm_target');
        expect(world(g)).toEqual(expected); answer(g, false); expect(world(g)).toEqual(expected);
    });
    it.each(['safe', 'certain'])('%s target retains confirm_target without a new answer', kind => {
        const { g, item } = scene();
        if (kind === 'safe') g.grid.setTerrain(13, 10, T.FLOOR);
        else { item.maxChargesKnown = true; g.grid.setTerrain(16, 10, T.LAVA); }
        g.onCommandConfirmRequest = () => {}; const charges = item.charges;
        g.executeCommand('confirm_target');
        expect(g.hasPendingConfirmation).toBe(false);
        expect(g.recordedInputEvents[g.recordedInputEvents.length - 1]).toMatchObject({ action: 'confirm_target', decisions: [] });
        expect(item.charges).toBe(charges! - (kind === 'safe' ? 1 : 0));
    });
    it.each(['cursor', 'selection', 'item', 'far-path', 'hidden-path', 'kind', 'range', 'knowledge'])('a changed %s invalidates the waiting approval', kind => {
        const { g, item } = scene();
        if (kind === 'hidden-path') g.grid.getCell(24, 10)!.hasMemory = g.grid.getCell(24, 10)!.isVisible = false;
        g.onCommandConfirmRequest = () => {}; g.executeCommand('confirm_target');
        const index = g.recordedInputEvents.length, token = g.pendingCommandConfirmation!.token;
        if (kind === 'cursor') g.pendingArcana!.cursor.x++;
        if (kind === 'selection') g.pendingArcana = { ...g.pendingArcana! };
        if (kind === 'item') item.charges!--;
        if (kind === 'far-path' || kind === 'hidden-path') g.grid.setTerrain(24, 10, T.GRANITE);
        if (kind === 'kind') (item as any).identityId = 'staff_of_fire';
        if (kind === 'range') item.maxChargesKnown = true;
        if (kind === 'knowledge') ItemLoader.identifiedItems.delete('staff_of_blinking');
        const before = world(g); expect(g.resolveCommandDecision(token, true)).toBe(true);
        expect(world(g)).toEqual(before); expect(g.recordedInputEvents).toHaveLength(index);
        expect(g.hasPendingConfirmation).toBe(false); expect(g.hasCompleteRecording).toBe(false);
    });
    it.each(['new', 'load', 'cancel'])('%s invalidates the old blink capability without manufacturing No', lifecycle => {
        const { g, item } = scene(), save = g.toSaveSnapshot();
        g.onCommandConfirmRequest = () => {}; g.executeCommand('confirm_target');
        const token = g.pendingCommandConfirmation!.token, index = g.recordedInputEvents.length;
        if (lifecycle === 'new') g.startNewGame({ seed: 33442 });
        if (lifecycle === 'load') expect(g.loadSnapshot(save)).toBe(true);
        if (lifecycle === 'cancel') g.cancelPendingCommand();
        expect(g.resolveCommandDecision(token, true)).toBe(false); expect(g.hasPendingConfirmation).toBe(false);
        expect(item.charges).toBe(2); expect(g.recordedInputEvents).toHaveLength(lifecycle === 'new' ? 0 : index);
    });
    it('headless null resolver drives the same risk stage synchronously with one recorded Yes', () => {
        const { g, item } = scene(); g.onConfirmRequest = null; g.executeCommand('confirm_target');
        expect(item.charges).toBe(1); expect(g.hasPendingConfirmation).toBe(false);
        expect(g.recordedInputEvents[g.recordedInputEvents.length - 1]).toMatchObject({ action: 'arcana:risk-confirm', decisions: [true] });
    });
    it('save/export waits for the same command beyond six seconds', async () => {
        vi.useFakeTimers(); vi.stubGlobal('window', { setTimeout: globalThis.setTimeout });
        const { g } = scene(); const service = new DialogService(), unbind = bindDialogCommands(service, g);
        g.executeCommand('confirm_target'); expect(service.current?.text).toBe('Blink across lava with unknown range?');
        expect(() => g.toSaveSnapshot()).toThrow('during a command'); expect(g.canExportRecording).toBe(false);
        let completed = false;
        const exported = recordingJsonAtBoundary(g, () => true).then(raw => { completed = true; return JSON.parse(raw); });
        await vi.advanceTimersByTimeAsync(6000); expect(completed).toBe(false); expect(g.hasPendingConfirmation).toBe(true);
        service.answer(service.current!.token, 'no'); await vi.advanceTimersByTimeAsync(25);
        expect((await exported).events.at(-1)).toMatchObject({ action: 'arcana:risk-confirm', decisions: [false] });
        unbind(); service.dispose();
    });
    it('production has no native confirmation call, and App delegates to the mounted Host', () => {
        function files(dir: string): string[] {
            return readdirSync(dir, { withFileTypes: true }).flatMap(entry => ['test', 'tests'].includes(entry.name) ? []
                : entry.isDirectory() ? files(resolve(dir, entry.name)) : /\.(ts|vue)$/.test(entry.name) ? [resolve(dir, entry.name)] : []);
        }
        for (const path of files(resolve('src'))) {
            const source = readFileSync(path, 'utf8');
            const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
            const calls: string[] = [];
            const visit = (node: ts.Node) => {
                if (ts.isCallExpression(node) && /^(?:(?:window|globalThis|self)\s*(?:\.|\[))?confirm(?:\b|['"])/.test(node.expression.getText(ast))) calls.push(node.getText(ast));
                ts.forEachChild(node, visit);
            };
            visit(ast); expect(calls, path).toEqual([]);
            expect(source, path).not.toMatch(/window\s*(?:\.\s*confirm|\[\s*['"]confirm['"]\s*\])/);
        }
        const app = readFileSync('src/App.vue', 'utf8');
        expect(app).toContain('<DialogHost'); expect(app).not.toContain('wireConfirmRequest');
    });
});
