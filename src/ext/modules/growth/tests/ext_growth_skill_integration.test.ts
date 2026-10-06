import { extensionDigest } from '../../../../test/support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import data from '../data/definitions.json';
import type { GrowthDefinitionPack } from '../types';
import type { GrowthState } from '../state';
import { createGrowthGameplay } from '../module';
import { parseGrowthDefinitionPack } from '../definitions';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { ExtensionRegistry } from '../../../../ext/registry';
import * as catalog from '../../../../ext/catalog';

const id = (suffix: string) => `growth.skill.${suffix}`;
const attribute = (suffix: string) => `growth.attribute.${suffix}`;
const state = (game: Game) => game.extensionRuntime!.snapshot().modules.growth as unknown as GrowthState;
function configured(change?: (pack: GrowthDefinitionPack) => void) {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.levels.attributePoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 20 };
    pack.config.levels.skillPoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 30 };
    pack.config.skills.activeSlots = 6;
    pack.config.experience.sources.firstVisits = false;
    change?.(pack);
    const parsed = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    const identity = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry();
        registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(parsed, identity), identity);
        return registry;
    });
    return pack;
}
function finish(game: Game) {
    for (let steps = 0; steps < 200 && game.isAdvancing; steps++) game.stepAdvancement();
    expect(game.isAdvancing).toBe(false); expect(game.lastAdvancementError).toBeNull();
}
function command(game: Game, action: string, payload: Record<string, unknown>) {
    game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action, payload: { revision: state(game).revision, ...payload } }));
    finish(game);
}
function scene(animated = false): Game {
    const game = createHeadlessGame(671234, 'test');
    game.startNewGame({ seed: 671234, mode: 'test', ruleSet: 'extended' });
    game.animationEnabled = animated;
    command(game, 'create-character', { revision: 0 });
    command(game, 'allocate', { attributes: Object.fromEntries(['constitution', 'agility', 'will', 'perception'].map(name => [attribute(name), 2])) });
    for (const name of ['brace', 'hold-breath', 'survey', 'withdraw', 'measured-strike', 'composure']) command(game, 'learn-skill', { skillId: id(name) });
    command(game, 'equip-skills', { active: ['brace', 'hold-breath', 'survey', 'withdraw', 'measured-strike'].map(id), passive: [id('composure')] });
    return game;
}
function use(game: Game, skill: string, target: object = { kind: 'self' }) { command(game, 'use-skill', { skillId: id(skill), target }); }
function play(game: Game) {
    use(game, 'hold-breath');
    use(game, 'withdraw', { kind: 'cell', x: 3, y: 3 });
    for (let index = 0; index < 24; index++) { game.executeCommand('wait'); finish(game); }
    use(game, 'survey');
    for (let index = 0; index < 24; index++) { game.executeCommand('wait'); finish(game); }
    use(game, 'brace');
}
function projection(game: Game) {
    return { extension: game.extensionRuntime!.snapshot(), rng: rng.getState(), tick: timeSystem.currentTick,
        turn: game.absoluteTurnNumber, turns: game.stats.turns, hp: game.player.hp, maxHp: game.player.maxHp, loc: { ...game.player.loc } };
}
afterEach(() => vi.restoreAllMocks());

describe('EXT-1d native skill command replay and scheduling integration', () => {
    it('produces the same final native world and extension clock in synchronous and frame-stepped modes', () => {
        configured();
        const sync = scene(); play(sync); const expected = projection(sync), inputs = sync.exportRecording().events;
        expect(inputs.filter(event => event.action === 'ext:command' && String(event.data).includes('use-skill'))).toHaveLength(4);
        const animated = scene(true); play(animated);
        expect(projection(animated)).toEqual(expected);
        expect(animated.exportRecording().events).toEqual(inputs);
    });
    it('replays an unmodified real command prefix, seeks and resumes a saved skilled actor without re-grants or OOS', () => {
        configured(); const game = scene(); play(game);
        const expected = projection(game), saved = game.toSaveSnapshot(), recording = game.exportRecording();
        expect(game.hasCompleteRecording).toBe(true);
        const replay = createHeadlessGame(99, 'test');
        expect(replay.loadReplay(recording)).toBe(true);
        while (replay.replayCursor < recording.events.length && !replay.replayError) replay.replayStep(true);
        expect(replay.replayError).toBeNull(); expect(projection(replay)).toEqual(expected);
        replay.replaySeek(4);
        while (replay.replayCursor < recording.events.length && !replay.replayError) replay.replayStep(true);
        expect(replay.replayError).toBeNull(); expect(projection(replay)).toEqual(expected);
        const loaded = createHeadlessGame(100, 'test');
        expect(loaded.loadSnapshot(saved)).toBe(true); expect(projection(loaded)).toEqual(expected);
        const prefixLength = loaded.recordedInputEvents.length;
        loaded.executeCommand('wait'); finish(loaded);
        expect(loaded.hasCompleteRecording).toBe(true); expect(loaded.recordedInputEvents).toHaveLength(prefixLength + 1);
        const resumed = loaded.exportRecording(), final = projection(loaded), checker = createHeadlessGame(101, 'test');
        expect(checker.loadReplay(resumed)).toBe(true);
        while (checker.replayCursor < resumed.events.length && !checker.replayError) checker.replayStep(true);
        expect(checker.replayError).toBeNull(); expect(projection(checker)).toEqual(final);
    });
    it('keeps a single pending animated command until advancement settles, then records exactly one extension checkpoint', () => {
        configured(); const game = scene(true), before = game.recordedInputEvents.length;
        game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action: 'use-skill', payload: {
            revision: state(game).revision, skillId: id('brace'), target: { kind: 'self' } } }));
        expect(game.isAdvancing).toBe(true);
        expect(game.recordedInputEvents).toHaveLength(before + 1);
        const pending = game.recordedInputEvents[before]!;
        finish(game);
        expect(game.recordedInputEvents[before]).toBe(pending);
        expect(game.recordedInputEvents).toHaveLength(before + 1);
        expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.checkpoint!.domains.extensions).toBe(extensionDigest(game.extensionRuntime!.snapshot() ?? null));
        const snapshot = game.extensionRuntime!.snapshot(); finish(game);
        expect(game.extensionRuntime!.snapshot()).toEqual(snapshot); expect(game.recordedInputEvents).toHaveLength(before + 1);
    });
    it('uses configured objective tick-to-block conversion and does not equate commands with blocks', () => {
        configured(pack => { pack.config.focus.objectiveTicksPerBlock = 250; });
        const game = scene(), before = state(game);
        game.executeCommand('wait'); finish(game);
        const after = state(game);
        expect(after.objectiveClock * 250 + after.objectiveRemainder - before.objectiveClock * 250 - before.objectiveRemainder).toBe(100);
        const unchanged = projection(game), count = game.recordedInputEvents.length;
        command(game, 'use-skill', { skillId: id('withdraw'), target: { kind: 'cell', x: -1, y: -1 } });
        expect(projection(game)).toEqual(unchanged); expect(game.recordedInputEvents).toHaveLength(count);
    });
});
