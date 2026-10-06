import { extensionDigest, checkpointExtensionDigest } from '../../../../test/support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import { logger } from '../../../../engine/Systems/Logger';
import { ExtensionRegistry } from '../../../registry';
import { extensionDataFingerprint } from '../../../fingerprint';
import * as catalog from '../../../catalog';
import data from '../data/definitions.json';
import locale from '../locales/zh_CN.json';
import { createGrowthGameplay } from '../module';
import { parseGrowthDefinitionPack } from '../definitions';
import type { GrowthDefinitionPack } from '../types';
import type { GrowthProgression } from '../components';

const installed = catalog.getInstalledModuleDescriptors().find(item => item.id === 'narrative');
const modes = installed ? ['ready', 'unsupported-key'] as const : [];
const clone = <T>(value: T): T => structuredClone(value);
function narrative(game: Game) {
    return game.extensionRuntime!.snapshot().modules.narrative as unknown as {
        revision: number; active: { sessionId: number; nodeId: string } | null;
        rewardReceipts: { id: string; result: string; reason?: string }[];
    };
}
const xp = (game: Game) => (game.extensionRuntime!.snapshot().components[game.player.id]!['growth:progression'] as GrowthProgression).experience;
function command(game: Game, action: string, fields: object) {
    while (logger.pendingAcknowledgment) logger.acknowledgeNext();
    const before = game.recordedInputEvents.length;
    game.executeCommand('ext:command', JSON.stringify({ module: 'narrative', action,
        payload: { v: 2, revision: narrative(game).revision, ...fields } }));
    expect(game.recordedInputEvents).toHaveLength(before + 1);
}
function choose(game: Game, choiceId: string) {
    const active = narrative(game).active!;
    command(game, 'choose', { sessionId: active.sessionId, nodeId: active.nodeId, choiceId });
}
function start(kind: typeof modes[number]) {
    const pack = clone(data) as unknown as GrowthDefinitionPack;
    pack.config.experience.sources.story = true;
    if (kind === 'unsupported-key') pack.config.experience.story.rewards = [];
    const text: Record<string, string> = locale;
    const parsed = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: key => typeof text[key] === 'string' });
    const identity = { schema: 1, version: pack.rulesVersion, fingerprint: extensionDataFingerprint(pack) };
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry();
        registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(parsed, identity), identity);
        registry.register(installed!.id, installed!.version, installed!.create, installed!.rules);
        return registry;
    });
    const game = createHeadlessGame(8201, 'normal'), ids = ['growth', 'narrative'], registry = catalog.createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(ids)).flatMap(module => module.initialCommand
        ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
    game.startNewGame({ seed: 8201, mode: 'normal', ruleSet: 'extended', extensions: ids, initialCommands });
    game.animationEnabled = false;
    return game;
}
afterEach(() => vi.restoreAllMocks());

describe('content expansion growth-owned configuration', () => {
    it('keeps story opt-in and owns two small independently configurable quotes without any narrative installation', () => {
        expect(data.config.experience.sources.story).toBe(false);
        expect(data.config.experience.story.rewards).toEqual([
            { id: 'bell.settled', amount: 5, reasonKey: 'ext.growth.story.bell_settled' },
            { id: 'wick.settled', amount: 5, reasonKey: 'ext.growth.story.wick_settled' },
        ]);
        const changed = clone(data);
        changed.config.experience.sources.story = true;
        changed.config.experience.story.rewards[0]!.amount = 3;
        const text: Record<string, string> = locale;
        const parsed = parseGrowthDefinitionPack(changed, { moduleVersion: changed.moduleVersion,
            hasText: key => typeof text[key] === 'string' });
        expect(parsed.config.experience.story.rewards.map(quote => quote.amount)).toEqual([3, 5]);
        expect(extensionDataFingerprint(changed)).not.toBe(extensionDataFingerprint(data));
        expect(data.config.experience.sources.story).toBe(false);
        expect(data.config.experience.story.rewards[0]!.amount).toBe(5);
    });
});

describe.each(modes)('content expansion real optional growth %s', kind => {
    it.each([
        ['bell.mender', 'ask-bell', 'bell-toll', 'finish-toll', 'bell.reward'],
        ['bell.mender', 'ask-bell', 'bell-hush', 'finish-hush', 'bell.reward'],
        ['wick.listener', 'listen-wick', 'wick-keep', 'finish-keep', 'wick.reward'],
        ['wick.listener', 'listen-wick', 'wick-release', 'finish-release', 'wick.reward'],
    ])('persists exactly one configured quote for %s / %s / %s', (npc, ask, ending, finish, receiptId) => {
        const game = start(kind);
        const target = game.extensionRuntime!.snapshot().foundation.world.entities.find(entity => entity.contentId === npc)!;
        expect(target).toBeDefined();
        command(game, 'open', { targetEntityId: target.id }); choose(game, ask);
        const before = xp(game), save = clone(game.toSaveSnapshot());
        choose(game, ending);
        expect(xp(game) - before).toBe(kind === 'ready' ? 5 : 0);
        expect(narrative(game).rewardReceipts).toEqual([expect.objectContaining({ id: receiptId,
            result: kind === 'ready' ? 'applied' : 'skipped', ...(kind === 'ready' ? {} : { reason: kind }) })]);
        choose(game, finish);
        const expected = clone(game.extensionRuntime!.snapshot()), recording = clone(game.exportRecording());
        expect(game.loadSnapshot(save)).toBe(true); game.animationEnabled = false;
        choose(game, ending); choose(game, finish);
        expect(game.extensionRuntime!.snapshot()).toEqual(expected);
        expect(game.exportRecording().events).toEqual(recording.events);
        command(game, 'open', { targetEntityId: target.id });
        choose(game, npc === 'bell.mender' ? 'recall-bell' : 'recall-wick');
        choose(game, npc === 'bell.mender' ? 'finish-remember' : 'finish-wick-remember');
        expect(xp(game) - before).toBe(kind === 'ready' ? 5 : 0);
        const final = clone(game.extensionRuntime!.snapshot()), replay = clone(game.exportRecording());
        expect(game.loadReplay(replay)).toBe(true); game.animationEnabled = false;
        for (const event of replay.events) {
            game.replayStep(true); expect(game.replayError).toBeNull();
            expect(extensionDigest(game.extensionRuntime!.snapshot() ?? null)).toBe(checkpointExtensionDigest(event));
            expect(game.toSnapshot().rngState).toEqual(event.rng);
        }
        expect(game.extensionRuntime!.snapshot()).toEqual(final);
        game.replaySeek(recording.events.length); expect(game.replayError).toBeNull();
        expect(game.extensionRuntime!.snapshot()).toEqual(expected);
        game.replaySeek(replay.events.length); expect(game.replayError).toBeNull();
        expect(game.extensionRuntime!.snapshot()).toEqual(final);
    }, 60000);
});
