import { installedOptionalModules } from '../../../../test/support/installedExtensions';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rng } from '../../../../engine/Random';
import { readNarrativeUiView, buildNarrativeUiCommand } from '../ui/view';
import { checkpointExtensionDigest, extensionDigest, continuingPrefix } from '../../../../test/support/recordingV4';
import { N2_CASES, clone, startDiagnostic, createN2RewardProvider, narrative, fullWorld, observed, progress,
    open, choose, decide, reject, rejectChoice, acknowledge } from './narrative2_rewardFixture';

// Placement compression is diagnostic; installed production/natural behavior is
// covered separately. Actual growth is discovered only through the catalog.
afterEach(() => vi.restoreAllMocks());

describe('N2-REWARD real Game independent quotes, two endings and durable once-only results', () => {
    for (const row of N2_CASES) {
        for (const requestedMode of ['absent', 'disabled', 'unsupported-key', 'ready'] as const) {
            const mode = requestedMode === 'disabled' && !installedOptionalModules(['growth']).length ? 'absent' : requestedMode;
            it(`${row.npc}: ${requestedMode === 'disabled' && mode === 'absent' ? 'growth physically absent; ' : ''}both endings produce ${mode === 'ready' ? 'fixture applied 5' : mode + ' skipped'} in the same command`, () => {
                const provider = mode === 'ready' || mode === 'unsupported-key' ? createN2RewardProvider(mode) : undefined;
                const { game } = startDiagnostic({ npcs: [row.npc], growth: mode === 'disabled', provider });
                const initial = clone(game.toSaveSnapshot());
                for (const ending of ['a', 'b'] as const) {
                    if (provider) provider.control.mode = mode as 'ready' | 'unsupported-key';
                    expect(game.loadSnapshot(clone(initial))).toBe(true); game.animationEnabled = false;
                    open(game, row.npc); choose(game, 'ask'); choose(game, 'consider');
                    const before = game.extensionRuntime!.snapshot(), calls = provider?.commit.mock.calls.length ?? 0;
                    const data = choose(game, `choose-${ending}`), state = narrative(game);
                    expect(state.flags[`${row.npc}.verdict`]).toBe(row[ending]);
                    expect(state.active?.nodeId).toBe(ending);
                    expect(state.journal).toEqual([{ entryId: `${row.npc}.${row[ending]}.note`, order: 1 }]);
                    expect(state.triggerReceipts).toEqual([{ triggerId: `${row.npc}.reward`, scopeKey: 'run', firings: 1,
                        lastTurn: game.absoluteTurnNumber, lastFactId: before.foundation.nextFactId + 1 }]);
                    expect(state.rewardReceipts).toEqual([{ id: `${row.npc}.reward.receipt`, instanceKey: `narrative.${row.npc}.reward.receipt.run`,
                        result: mode === 'ready' ? 'applied' : 'skipped', reason: mode === 'ready' ? null : mode }]);
                    expect(game.extensionRuntime!.snapshot().foundation.pendingStoryFacts).toEqual([]);
                    expect(game.extensionRuntime!.snapshot().foundation.nextFactId).toBe(before.foundation.nextFactId + 2);
                    if (mode === 'ready') {
                        expect(provider!.commit).toHaveBeenCalledTimes(calls + 1);
                        expect(provider!.commit.mock.calls[provider!.commit.mock.calls.length - 1]![0]).toMatchObject({ rewardId: row.reward, instanceId: `narrative.${row.npc}.reward.receipt.run` });
                        expect(game.extensionRuntime!.snapshot().modules['n2-reward-fixture']).toEqual({ total: 5, receipts: [`narrative.${row.npc}.reward.receipt.run`] });
                        expect(game.extensionRuntime!.snapshot().components[game.player.id]!['n2-reward-fixture:character']).toEqual({ xp: 5 });
                    } else {
                        expect(game.extensionRuntime!.snapshot().components).toEqual(before.components);
                        if (provider) expect(provider.commit).toHaveBeenCalledTimes(calls);
                        if (mode === 'disabled') expect(game.extensionRuntime!.snapshot().modules.growth).toEqual(before.modules.growth);
                    }
                    // A stale repeat and a sibling choice cannot make a second
                    // payment. Making the diagnostic provider available later
                    // must not turn a recorded skip into deferred credit.
                    reject(game, data); rejectChoice(game, `choose-${ending === 'a' ? 'b' : 'a'}`);
                    const committed = progress(game), count = provider?.commit.mock.calls.length ?? 0;
                    if (provider) provider.control.mode = 'ready';
                    choose(game, `leave-${ending}`);
                    const saved = clone(game.toSaveSnapshot()), prefix = clone(game.exportRecording());
                    expect(game.loadSnapshot(saved)).toBe(true); game.animationEnabled = false;
                    open(game, row.npc); rejectChoice(game, 'ask'); choose(game, `recall-${ending}`); choose(game, `leave-recall-${ending}`);
                    expect(progress(game)).toEqual(committed);
                    if (provider) expect(provider.commit).toHaveBeenCalledTimes(count);
                    const endpoint = fullWorld(game), recording = clone(game.exportRecording());
                    expect(recording.events.slice(0, prefix.events.length)).toEqual(continuingPrefix(prefix));
                    // The provider policy is part of this fixture's rules, so
                    // restore its original policy before replay reconstruction.
                    if (provider) provider.control.mode = mode as 'ready' | 'unsupported-key';
                    expect(game.loadReplay(recording)).toBe(true); game.animationEnabled = false;
                    // Avoid toSnapshot between events: it refreshes presentation
                    // visibility and can conceal a deep replay discrepancy. The
                    // frozen Game.completeReplayEvent (Core/Game.ts:4530–4552)
                    // validates tick/depth/player HP/location, inventory and
                    // decisions, both RNG streams and required checkpoints before
                    // cursor advancement; no-OOS/cursor checks retain that gate.
                    for (const event of recording.events) {
                        game.replayStep(true); expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(event.index + 1);
                        expect(game.absoluteTurnNumber).toBe(event.turn);
                        expect(rng.getState()).toEqual(event.rng);
                        expect(extensionDigest(game.extensionRuntime?.snapshot() ?? null)).toEqual(checkpointExtensionDigest(event));
                    }
                    expect(fullWorld(game)).toEqual(endpoint);
                    const decision = recording.events.findIndex(event => String(event.data).includes('"choiceId":"choose-'));
                    for (const index of [recording.events.length, 0, decision, decision + 1, prefix.events.length, recording.events.length]) {
                        game.replaySeek(index); expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(index);
                        if (mode === 'ready') expect((game.extensionRuntime!.snapshot().modules['n2-reward-fixture'] as { total: number }).total).toBe(index > decision ? 5 : 0);
                    }
                    expect(fullWorld(game)).toEqual(endpoint); expect(narrative(game).rewardReceipts).toHaveLength(1);
                }
            }, 60000);
        }
    }
});

describe('N2-ATOMIC complete world/message/recording rollback at the real Game boundary', () => {
    for (const row of N2_CASES) {
        for (const failure of ['failPrepare', 'malformedPrepare', 'failCommit', 'failSettlement'] as const) {
            it(`${row.npc}: ${failure} cannot leave a partial story, payment or broken recording origin`, () => {
                const provider = createN2RewardProvider(), { game } = startDiagnostic({ npcs: [row.npc], provider });
                open(game, row.npc); choose(game, 'ask'); choose(game, 'consider');
                const data = buildNarrativeUiCommand(game, readNarrativeUiView(game)!, 'choose', 'choose-a')!;
                expect(data).toBeTypeOf('string');
                provider.control[failure] = true;
                acknowledge(); const before = observed(game), player = game.player, runtime = game.extensionRuntime;
                if (failure === 'failPrepare' || failure === 'malformedPrepare') reject(game, data);
                else expect(() => game.executeCommand('ext:command', data)).toThrow(failure === 'failCommit'
                    ? 'N2 fixture commit failed after writes' : 'N2 fixture settlement failed after reward');
                expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime);
                const after = observed(game);
                expect(after.world).toEqual(before.world); expect(after.random).toEqual(before.random);
                expect(after.messages).toEqual(before.messages); expect(after.recording).toEqual(before.recording);
                expect(after.cursor).toBe(before.cursor);
                expect(narrative(game).active?.nodeId).toBe('decision');
                expect(narrative(game).flags[`${row.npc}.verdict`]).toBe('unresolved');
                expect(narrative(game).journal).toEqual([]); expect(narrative(game).rewardReceipts).toEqual([]);
                expect(narrative(game).triggerReceipts).toEqual([]);
                expect(game.extensionRuntime!.snapshot().modules['n2-reward-fixture']).toEqual({ total: 0, receipts: [] });
                expect(after.hasCompleteRecording, 'a rolled-back optional reward must preserve recording eligibility').toBe(before.hasCompleteRecording);
                expect(after.canExportRecording).toBe(before.canExportRecording);
                expect(after.recordingOrigin).toEqual(before.recordingOrigin);
                provider.control[failure] = false;
                // The same active session and public choice must be retryable;
                // loading a save or restarting cannot conceal an atomicity gap.
                choose(game, 'choose-a');
                expect(narrative(game).rewardReceipts).toEqual([{ id: `${row.npc}.reward.receipt`, instanceKey: `narrative.${row.npc}.reward.receipt.run`, result: 'applied', reason: null }]);
                expect(game.extensionRuntime!.snapshot().modules['n2-reward-fixture']).toEqual({ total: 5, receipts: [`narrative.${row.npc}.reward.receipt.run`] });
            }, 30000);
        }

        it(`${row.npc}: an exhausted effect budget refuses the entire causal chain`, () => {
            const provider = createN2RewardProvider(), { game } = startDiagnostic({ npcs: [row.npc], provider,
                change: raw => { raw.config.limits.effectsPerCommand = 3; } });
            open(game, row.npc); choose(game, 'ask'); choose(game, 'consider');
            const data = buildNarrativeUiCommand(game, readNarrativeUiView(game)!, 'choose', 'choose-a')!;
            expect(data).toBeTypeOf('string'); reject(game, data);
            expect(provider.commit).not.toHaveBeenCalled(); expect(narrative(game).flags[`${row.npc}.verdict`]).toBe('unresolved');
        }, 30000);
    }

    it('five independent diagnostic transactions cap the shared fixture quote total at 25, with no copied reward IDs', () => {
        const observedQuotes: { rewardId: string; amount: number }[] = [];
        for (const row of N2_CASES) {
            const provider = createN2RewardProvider(), { game } = startDiagnostic({ npcs: [row.npc], provider });
            decide(game, row.npc, 'a');
            const [, plan] = provider.commit.mock.calls[provider.commit.mock.calls.length - 1]!;
            observedQuotes.push({ rewardId: provider.commit.mock.calls[provider.commit.mock.calls.length - 1]![0].rewardId, amount: (plan as { amount: number }).amount });
        }
        expect(observedQuotes).toEqual(N2_CASES.map(row => ({ rewardId: row.reward, amount: 5 })));
        expect(new Set(observedQuotes.map(quote => quote.rewardId)).size).toBe(5);
        expect(observedQuotes.reduce((sum, quote) => sum + quote.amount, 0)).toBe(25);
    }, 60000);
});
