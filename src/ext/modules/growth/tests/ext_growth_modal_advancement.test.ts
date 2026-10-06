import { extensionDigest } from '../../../../test/support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createHeadlessGame } from '../../../../test/harness';
import { readGrowthCharacterView } from '../view';
import data from '../data/definitions.json';
import type { GrowthDefinitionPack } from '../types';
import { createGrowthGameplay } from '../module';
import { parseGrowthDefinitionPack } from '../definitions';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { ExtensionRegistry } from '../../../../ext/registry';
import * as catalog from '../../../../ext/catalog';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import type { Game } from '../../../../engine/Core/Game';
import { displayedFrame, presentationTimeline } from '../../../../ui/presentationTimeline';
import { HUNGER_THRESHOLD } from '../../../../entities/Player';
import { DialogService } from '../../../../ui/dialogService';
import { bindDialogAcknowledgments } from '../../../../ui/dialogAcknowledgments';
import { dialogInput } from '../../../../ui/dialogInput';

/** Execute GameCanvas's actual displayFrame closure, not a duplicate timing helper.
 * PIXI rasterization is replaced with a render sink; native Game advancement is real. */
function modalDisplayLoop(game: Game) {
    const source = readFileSync(new URL('../../../../components/GameCanvas.vue', import.meta.url), 'utf8');
    const start = source.indexOf('    let pathingTimer = 0;'), end = source.indexOf('    const resetDisplayClock =', start);
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    const render = vi.fn(), request = vi.fn(), syncHeld = vi.fn(), flush = vi.fn((paint: () => void) => paint());
    const loop = new Function('game', 'props', 'logger', 'syncHeldInputContext', 'renders', 'render', 'frameProfile', 'document', 'displayedFrame', 'presentationTimeline', 'dialogInput',
        `${code}; return displayFrame;`)(game, { displayModalOpen: true }, logger, syncHeld, { flush, request }, render, null, { hidden: false }, displayedFrame, presentationTimeline, dialogInput) as (elapsedMs: number, animationMs?: number) => void;
    return { loop, render, flush, syncHeld };
}
function setup() {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.levels.skillPoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 10 };
    for (const definition of pack.definitions) if (definition.kind === 'skill') definition.prerequisites = [];
    const parsed = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    const identity = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry(); registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(parsed, identity), identity); return registry;
    });
    const game = createHeadlessGame(6721, 'test'); game.startNewGame({ seed: 6721, mode: 'test', ruleSet: 'extended' });
    const command = (action: string, payload: object) => game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action,
        payload: { revision: readGrowthCharacterView(game)?.revision ?? 0, ...payload } }));
    command('create-character', { revision: 0 }); game.monsters = []; game.dormantMonsters = [];
    command('learn-skill', { skillId: 'growth.skill.brace' }); command('learn-skill', { skillId: 'growth.skill.survey' });
    return { game, command };
}
afterEach(() => { vi.restoreAllMocks(); logger.reset(); });

describe('EXT-1d actual canvas display loop while the skill modal remains open', () => {
    it('finishes a committed animated equip once, including checkpoint, without waiting for the panel to close', () => {
        const { game, command } = setup(); game.animationEnabled = true;
        const frames = modalDisplayLoop(game), count = game.recordedInputEvents.length, turns = game.stats.turns;
        const replay = vi.spyOn(game, 'tickReplay'), auto = vi.spyOn(game, 'stepAutoPath');
        command('equip-skills', { active: ['growth.skill.brace'], passive: [] }); expect(game.isAdvancing).toBe(true);
        for (let index = 0; index < 20 && game.isAdvancing; index++) frames.loop(16, 16);
        expect(game.isAdvancing).toBe(false); expect(game.isInputLocked()).toBe(false); expect(game.stats.turns).toBe(turns + 1);
        expect(game.recordedInputEvents).toHaveLength(count + 1);
        expect(game.recordedInputEvents[count]!.checkpoint!.domains.extensions).toBe(extensionDigest(game.extensionRuntime!.snapshot() ?? null));
        expect(replay).not.toHaveBeenCalled(); expect(auto).not.toHaveBeenCalled(); expect(frames.flush).toHaveBeenCalled();
        const state = game.extensionRuntime!.snapshot(), random = rng.getState();
        for (let index = 0; index < 20; index++) frames.loop(1000, 16);
        expect(game.extensionRuntime!.snapshot()).toEqual(state); expect(rng.getState()).toEqual(random);
        expect(game.stats.turns).toBe(turns + 1); expect(game.recordedInputEvents).toHaveLength(count + 1);
    });
    it.each(['brace', 'survey'])('settles one animated %s skill and its final recording while keeping automatic actions frozen', suffix => {
        const { game, command } = setup();
        command('equip-skills', { active: [`growth.skill.${suffix}`], passive: [] });
        game.animationEnabled = true; game.player.setStatusDuration('slowed', 20);
        const frames = modalDisplayLoop(game), count = game.recordedInputEvents.length, turns = game.stats.turns;
        const replay = vi.spyOn(game, 'tickReplay'), auto = vi.spyOn(game, 'stepAutoPath');
        command('use-skill', { skillId: `growth.skill.${suffix}`, target: { kind: 'self' } }); expect(game.isAdvancing).toBe(true);
        for (let index = 0; index < 100 && game.isAdvancing; index++) frames.loop(1000, 16);
        expect(game.isAdvancing).toBe(false); expect(game.lastAdvancementError).toBeNull();
        expect(game.stats.turns).toBe(turns + 1); expect(game.recordedInputEvents).toHaveLength(count + 1);
        expect(game.recordedInputEvents[count]!.checkpoint!.domains.extensions).toBe(extensionDigest(game.extensionRuntime!.snapshot() ?? null));
        expect(replay).not.toHaveBeenCalled(); expect(auto).not.toHaveBeenCalled();
    });
    it('drains native hunger ACK-following display delays while the character panel stays open', () => {
        const { game, command } = setup();
        command('equip-skills', { active: ['growth.skill.brace'], passive: [] });
        const service = new DialogService(), unbind = bindDialogAcknowledgments(service, game, logger);
        try {
            const timeline = presentationTimeline(game)!;
            game.player.inventory.items = []; game.player.nutrition = HUNGER_THRESHOLD + 1;
            game.player.setStatusDuration('slowed', 20); game.animationEnabled = true;
            const frames = modalDisplayLoop(game), replay = vi.spyOn(game, 'tickReplay'), auto = vi.spyOn(game, 'stepAutoPath');
            command('use-skill', { skillId: 'growth.skill.brace', target: { kind: 'self' } });
            for (let index = 0; index < 100 && game.isAdvancing; index++) frames.loop(16, 16);
            expect(game.isAdvancing).toBe(false); expect(service.current?.kind).toBe('acknowledgment');
            expect(timeline.pendingEvents.some(event => event.kind === 'animation-delay')).toBe(true);
            const snapshot = game.extensionRuntime!.snapshot(), random = rng.getState(), events = game.recordedInputEvents.length;
            service.answer(service.current!.token, 'more');
            expect(service.current).toBeUndefined(); expect(timeline.busy).toBe(true);
            for (let index = 0; index < 1000 && timeline.busy; index++) frames.loop(16, 16);
            expect(timeline.busy).toBe(false);
            expect(game.extensionRuntime!.snapshot()).toEqual(snapshot); expect(rng.getState()).toEqual(random);
            expect(game.recordedInputEvents).toHaveLength(events);
            expect(replay).not.toHaveBeenCalled(); expect(auto).not.toHaveBeenCalled();
        } finally { unbind(); service.dispose(); }
    });
    it('does not advance a read-only replay, even if it has a pending native action', () => {
        const { game } = setup(); game.animationEnabled = true; game.executeCommand('wait'); expect(game.isAdvancing).toBe(true);
        // Model an already-running replay at the canvas boundary without inventing a new replay input.
        Object.defineProperty(game, 'replayRecording', { configurable: true, value: {} });
        const frames = modalDisplayLoop(game), advancement = vi.spyOn(game, 'tickAdvancement'), replay = vi.spyOn(game, 'tickReplay');
        for (let index = 0; index < 5; index++) frames.loop(1000, 1000);
        expect(advancement).not.toHaveBeenCalled(); expect(replay).not.toHaveBeenCalled(); expect(game.isAdvancing).toBe(true);
        game.discardInFlightAdvancement();
    });
});
