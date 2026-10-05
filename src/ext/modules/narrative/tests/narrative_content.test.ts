import { describe, expect, it } from 'vitest';
import { createExtensionRegistry, getInstalledModuleDescriptors } from '../../../catalog';
import type { Game, GameRecording } from '../../../../engine/Core/Game';
import { logger } from '../../../../engine/Systems/Logger';
import { createHeadlessGame } from '../../../../test/harness';
import type { NarrativeState } from '../state';
import { buildNarrativeUiCommand, readNarrativeUiView } from '../ui/view';

const clone = <T>(value: T): T => structuredClone(value);
const combinations = [['narrative'], ...(getInstalledModuleDescriptors().some(module => module.id === 'growth')
    ? [['growth', 'narrative']] : [])];
const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
const narrative = (game: Game) => game.extensionRuntime!.snapshot().modules.narrative as unknown as NarrativeState;

// The real default packs place all three NPCs next to the D1 entrance for this
// normal-generation seed. No edited snapshots, teleports, test-mode map, custom
// narrative pack or mocked optional provider are used anywhere in this suite.
function newGame(ids: readonly string[]): Game {
    const seed = 8201, registry = createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(ids)).flatMap(module => module.initialCommand
        ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
    const game = createHeadlessGame(seed, 'normal');
    game.startNewGame({ seed, mode: 'normal', ruleSet: 'extended', extensions: ids, initialCommands });
    game.animationEnabled = false; acknowledge();
    expect(game.depth).toBe(1);
    expect(game.extensionRuntime!.snapshot().foundation.world.entities.map(entity => entity.contentId))
        .toEqual(['archive.keeper', 'bell.mender', 'wick.listener']);
    for (const entity of game.extensionRuntime!.snapshot().foundation.world.entities) {
        expect(game.extensionRuntime!.nearbyInteractables('narrative').some(nearby => nearby.id === entity.id)).toBe(true);
    }
    return game;
}
function target(game: Game, npcId: string): number {
    const entity = game.extensionRuntime!.snapshot().foundation.world.entities.find(entity => entity.contentId === npcId)!;
    expect(entity, npcId).toBeDefined();
    return entity.id;
}
/** Strip presentation/recording bookkeeping only; retain the full generated
 * world, actor resources, RNG, clocks, module state, placements and receipts. */
function world(game: Game) {
    const { savedAt: _savedAt, run, ...snapshot } = game.toSnapshot();
    const { recordedInputEvents: _events, recordedInputIndex: _index, logger: _logger,
        recordingOrigin: _origin, ...mechanicalRun } = run;
    return clone({ ...snapshot, run: mechanicalRun });
}
function command(game: Game, action: 'open' | 'choose' | 'close', id?: string | number): string {
    acknowledge();
    const view = readNarrativeUiView(game)!;
    const data = buildNarrativeUiCommand(game, view, action, id);
    expect(data, `${action} ${id ?? ''} at ${view.active?.nodeId ?? 'closed'}`).not.toBeNull();
    const count = game.recordedInputEvents.length, turn = game.absoluteTurnNumber;
    game.executeCommand('ext:command', data);
    expect(game.recordedInputEvents).toHaveLength(count + 1);
    expect(game.absoluteTurnNumber).toBe(turn);
    expect(game.hasPendingConfirmation).toBe(false);
    return data!;
}
function open(game: Game, npcId: string): void { command(game, 'open', target(game, npcId)); }
function choose(game: Game, choiceId: string): void { command(game, 'choose', choiceId); }
function rejectedChoice(game: Game, choiceId: string): void {
    const view = readNarrativeUiView(game)!, active = narrative(game).active!;
    expect(buildNarrativeUiCommand(game, view, 'choose', choiceId)).toBeNull();
    const before = world(game), events = clone(game.recordedInputEvents);
    acknowledge();
    game.executeCommand('ext:command', JSON.stringify({ module: 'narrative', action: 'choose',
        payload: { v: 2, revision: narrative(game).revision, sessionId: active.sessionId, nodeId: active.nodeId, choiceId } }));
    expect(world(game)).toEqual(before); expect(game.recordedInputEvents).toEqual(events);
    acknowledge();
}
function play(game: Game): void {
    acknowledge(); const turn = game.absoluteTurnNumber, count = game.recordedInputEvents.length;
    game.executeCommand('wait');
    expect(game.absoluteTurnNumber).toBeGreaterThan(turn);
    expect(game.recordedInputEvents).toHaveLength(count + 1);
    expect(game.isGameOver).toBe(false);
}
function verifyReplay(game: Game, recording: GameRecording, endpoint: ReturnType<typeof world>): void {
    expect(game.loadReplay(clone(recording))).toBe(true); game.animationEnabled = false;
    for (const event of recording.events) {
        game.replayStep(true);
        expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(event.index + 1);
        const snapshot = game.toSnapshot();
        expect(snapshot.extensions).toEqual(event.extensions); expect(snapshot.rngState).toEqual(event.rng);
        expect(snapshot.run.absoluteTurnNumber).toBe(event.turn); expect(snapshot.run.currentTick).toBe(event.tick);
    }
    expect(game.replayStatus).toBe('finished'); expect(world(game)).toEqual(endpoint);
}
const endings = [
    { npc: 'bell.mender', prefix: 'bell', intro: 'ask-bell', decision: 'decision', verdict: 'toll', settle: 'bell-toll', finish: 'finish-toll', recall: 'recall-bell', closeRecall: 'finish-remember' },
    { npc: 'bell.mender', prefix: 'bell', intro: 'ask-bell', decision: 'decision', verdict: 'hush', settle: 'bell-hush', finish: 'finish-hush', recall: 'recall-bell', closeRecall: 'finish-remember' },
    { npc: 'wick.listener', prefix: 'wick', intro: 'listen-wick', decision: 'memory', verdict: 'keep', settle: 'wick-keep', finish: 'finish-keep', recall: 'recall-wick', closeRecall: 'finish-wick-remember' },
    { npc: 'wick.listener', prefix: 'wick', intro: 'listen-wick', decision: 'memory', verdict: 'release', settle: 'wick-release', finish: 'finish-release', recall: 'recall-wick', closeRecall: 'finish-wick-remember' },
] as const;
type Ending = typeof endings[number];
function assertEnding(game: Game, ending: Ending, reason: 'absent' | 'disabled'): void {
    const state = narrative(game);
    expect(state.flags).toEqual({ 'bonfire.rested': false, 'archive.read': false, 'bell.verdict': ending.prefix === 'bell' ? ending.verdict : 'unresolved',
        'wick.verdict': ending.prefix === 'wick' ? ending.verdict : 'unresolved' });
    expect(state.counters).toEqual({});
    expect(state.journal).toEqual([{ entryId: `${ending.prefix}.${ending.verdict}.note`, order: 1 }]);
    expect(state.rewardReceipts).toEqual([{ id: `${ending.prefix}.reward`, instanceKey: `narrative.${ending.prefix}.reward.run`, result: 'skipped', reason }]);
    expect(state.triggerReceipts).toHaveLength(1);
    expect(state.triggerReceipts[0]).toMatchObject({ triggerId: `${ending.prefix}.reward`, scopeKey: 'run', firings: 1 });
}
function storyProgress(game: Game) {
    const state = narrative(game);
    return clone({ flags: state.flags, counters: state.counters, journal: state.journal,
        triggerReceipts: state.triggerReceipts, rewardReceipts: state.rewardReceipts });
}

describe.each(combinations)('CONTENT-1 default narrative endings with %j', (...ids: string[]) => {
    for (const ending of endings) {
        it(`${ending.npc} ${ending.verdict}: plays opening to ending and exactly continues every save through recall, replay and seek`, () => {
            const game = newGame(ids), reason = ids.includes('growth') ? 'disabled' : 'absent';
            const origin = clone(game.toSaveSnapshot().run.recordingOrigin!.initial);
            const cuts: { name: string; next: number; save: ReturnType<Game['toSaveSnapshot']>; world: ReturnType<typeof world>; recording: GameRecording }[] = [];
            function step(index: number): void {
                if (index === 0) {
                    open(game, ending.npc);
                    expect(narrative(game).active?.nodeId).toBe('hello');
                    expect(readNarrativeUiView(game)!.active!.choices.find(choice => choice.id === ending.recall)?.enabled).toBe(false);
                    rejectedChoice(game, ending.recall);
                } else if (index === 1) {
                    choose(game, ending.intro); expect(narrative(game).active?.nodeId).toBe(ending.decision);
                } else if (index === 2) {
                    const before = game.extensionRuntime!.snapshot(), turn = game.absoluteTurnNumber;
                    const data = command(game, 'choose', ending.settle);
                    expect(narrative(game).active?.nodeId).toBe(`${ending.verdict}-ending`);
                    assertEnding(game, ending, reason);
                    // The choice root then its derived story fact are consumed in
                    // the same command boundary; the actual trigger proves emission.
                    expect(game.extensionRuntime!.snapshot().foundation.nextFactId).toBe(before.foundation.nextFactId + 2);
                    expect(game.extensionRuntime!.snapshot().foundation.pendingStoryFacts).toEqual([]);
                    expect(narrative(game).lastFactId).toBe(before.foundation.nextFactId + 1);
                    expect(narrative(game).triggerReceipts[0]).toEqual({ triggerId: `${ending.prefix}.reward`, scopeKey: 'run', firings: 1,
                        lastTurn: turn, lastFactId: before.foundation.nextFactId + 1 });
                    if (ids.includes('growth')) {
                        expect(game.extensionRuntime!.snapshot().modules.growth).toEqual(before.modules.growth);
                        expect(game.extensionRuntime!.snapshot().components).toEqual(before.components);
                    }
                    const committed = world(game), events = clone(game.recordedInputEvents);
                    acknowledge(); game.executeCommand('ext:command', data);
                    expect(world(game)).toEqual(committed); expect(game.recordedInputEvents).toEqual(events);
                } else if (index === 3) {
                    choose(game, ending.finish); expect(narrative(game).active).toBeNull();
                    expect(game.extensionRuntime!.interactionActive).toBe(false);
                } else if (index === 4) {
                    open(game, ending.npc);
                    expect(readNarrativeUiView(game)!.active!.choices.find(choice => choice.id === ending.intro))
                        .toMatchObject({ enabled: false, unavailableKey: `ext.narrative.choice.${ending.prefix}.settled` });
                    rejectedChoice(game, ending.intro);
                } else if (index === 5) {
                    choose(game, ending.recall); expect(narrative(game).active?.nodeId).toBe('remember');
                } else if (index === 6) choose(game, ending.closeRecall);
                else play(game);
                if (index >= 2) assertEnding(game, ending, reason);
            }
            function capture(name: string, next: number): void {
                cuts.push({ name, next, save: clone(game.toSaveSnapshot()), world: world(game), recording: clone(game.exportRecording()) });
            }
            capture('before-open', 0);
            for (let index = 0; index < 8; index++) {
                step(index);
                if (index < 4) capture(['opening', 'decision', 'ending', 'closed'][index]!, index + 1);
            }
            const endpoint = world(game), recording = clone(game.exportRecording());
            expect(narrative(game).active).toBeNull();
            for (const cut of cuts) {
                expect(game.loadSnapshot(clone(cut.save)), cut.name).toBe(true); game.animationEnabled = false;
                expect(game.hasCompleteRecording, cut.name).toBe(true);
                expect(world(game), cut.name).toEqual(cut.world);
                expect(game.exportRecording().events, cut.name).toEqual(cut.recording.events);
                for (let index = cut.next; index < 8; index++) step(index);
                expect(world(game), cut.name).toEqual(endpoint);
                const { recordedAt: _originalTime, ...original } = recording;
                const { recordedAt: _continuedTime, ...continued } = game.exportRecording();
                expect(continued, cut.name).toEqual(original);
            }
            verifyReplay(game, recording, endpoint);
            for (const cut of [...cuts].reverse().concat(cuts)) {
                const index = cut.recording.events.length;
                game.replaySeek(index); expect(game.replayError, cut.name).toBeNull(); expect(game.replayCursor).toBe(index);
                expect(world(game), cut.name).toEqual(cut.world);
            }
            game.replaySeek(0); expect(game.replayError).toBeNull();
            expect(game.toSnapshot().extensions).toEqual(origin.extensions); expect(game.toSnapshot().rngState).toEqual(origin.rng);
            game.replaySeek(recording.events.length); expect(game.replayError).toBeNull(); expect(world(game)).toEqual(endpoint);
        }, 60000);
    }

    it('rejects the unmet archive clue, unlocks it by real reading, and follows both information loops without settling a verdict', () => {
        const game = newGame(ids);
        open(game, 'bell.mender'); choose(game, 'ask-bell');
        expect(readNarrativeUiView(game)!.active!.choices.find(choice => choice.id === 'read-inscription'))
            .toMatchObject({ enabled: false, unavailableKey: 'ext.narrative.choice.bell.need_archive' });
        rejectedChoice(game, 'read-inscription');
        choose(game, 'leave-decision');
        open(game, 'archive.keeper'); choose(game, 'read-note');
        const progress = storyProgress(game);
        open(game, 'bell.mender'); choose(game, 'ask-bell');
        for (let count = 0; count < 2; count++) {
            choose(game, 'read-inscription'); expect(narrative(game).active?.nodeId).toBe('inscription');
            choose(game, 'return-decision'); expect(narrative(game).active?.nodeId).toBe('decision');
        }
        choose(game, 'leave-decision');
        open(game, 'wick.listener'); choose(game, 'listen-wick');
        for (let count = 0; count < 2; count++) {
            choose(game, 'ask-listener'); expect(narrative(game).active?.nodeId).toBe('reason');
            choose(game, 'return-memory'); expect(narrative(game).active?.nodeId).toBe('memory');
        }
        choose(game, 'leave-memory');
        expect(storyProgress(game)).toEqual(progress); expect(narrative(game).active).toBeNull();
        const saved = clone(game.toSaveSnapshot()); expect(game.loadSnapshot(saved)).toBe(true); game.animationEnabled = false;
        expect(storyProgress(game)).toEqual(progress); play(game);
        const recording = clone(game.exportRecording()), endpoint = world(game);
        verifyReplay(game, recording, endpoint);
        game.replaySeek(0); game.replaySeek(recording.events.length);
        expect(game.replayError).toBeNull(); expect(world(game)).toEqual(endpoint);
    }, 60000);

    it('takes every no-effect early exit without granting a verdict, journal or reward', () => {
        const game = newGame(ids);
        open(game, 'archive.keeper'); choose(game, 'read-note');
        const progress = storyProgress(game);
        const paths = [
            { npc: 'bell.mender', choices: ['leave-bell'] },
            { npc: 'bell.mender', choices: ['ask-bell', 'leave-decision'] },
            { npc: 'bell.mender', choices: ['ask-bell', 'read-inscription', 'leave-inscription'] },
            { npc: 'wick.listener', choices: ['leave-wick'] },
            { npc: 'wick.listener', choices: ['listen-wick', 'leave-memory'] },
            { npc: 'wick.listener', choices: ['listen-wick', 'ask-listener', 'leave-reason'] },
        ];
        for (const path of paths) {
            open(game, path.npc);
            for (const choice of path.choices) choose(game, choice);
            expect(narrative(game).active, path.choices.join(' / ')).toBeNull();
            expect(game.extensionRuntime!.interactionActive).toBe(false);
            expect(storyProgress(game)).toEqual(progress);
        }
        play(game);
        const recording = clone(game.exportRecording()), endpoint = world(game);
        verifyReplay(game, recording, endpoint);
    }, 60000);

    it('retains independent outcomes and one receipt per NPC when both stories finish in the same real run', () => {
        const game = newGame(ids);
        for (const ending of [endings[0], endings[3]]) {
            open(game, ending.npc); choose(game, ending.intro); choose(game, ending.settle); choose(game, ending.finish);
        }
        expect(narrative(game).flags).toEqual({ 'archive.read': false, 'bell.verdict': 'toll', 'wick.verdict': 'release', 'bonfire.rested': false });
        expect(narrative(game).journal).toEqual([{ entryId: 'bell.toll.note', order: 1 }, { entryId: 'wick.release.note', order: 2 }]);
        expect(narrative(game).rewardReceipts.map(receipt => receipt.id)).toEqual(['bell.reward', 'wick.reward']);
        expect(narrative(game).triggerReceipts.map(receipt => [receipt.triggerId, receipt.firings])).toEqual([['bell.reward', 1], ['wick.reward', 1]]);
        const progress = storyProgress(game), saved = clone(game.toSaveSnapshot()), prior = clone(game.exportRecording());
        expect(game.loadSnapshot(saved)).toBe(true); game.animationEnabled = false;
        for (const ending of [endings[3], endings[0]]) {
            open(game, ending.npc); rejectedChoice(game, ending.intro); choose(game, ending.recall); choose(game, ending.closeRecall);
        }
        expect(storyProgress(game)).toEqual(progress); play(game);
        const continued = clone(game.exportRecording()), endpoint = world(game);
        expect(continued.events.slice(0, prior.events.length)).toEqual(prior.events);
        verifyReplay(game, continued, endpoint);
        game.replaySeek(prior.events.length); expect(storyProgress(game)).toEqual(progress);
        game.replaySeek(0); game.replaySeek(continued.events.length);
        expect(game.replayError).toBeNull(); expect(world(game)).toEqual(endpoint);
    }, 60000);
});
