import { afterEach, describe, expect, it, vi } from 'vitest';
import { rng } from '../../../../engine/Random';
import type { Game } from '../../../../engine/Core/Game';
import { readNarrativeUiView } from '../ui/view';
import { continuingPrefix, checkpointExtensionDigest, extensionDigest } from '../../../../test/support/recordingV4';
import { N2_CASES, clone, startDiagnostic, narrative, fullWorld, progress, open, choose, reject, rejectChoice, unlockClue } from './narrative2_rewardFixture';

// These real-Game graph probes intentionally compress placements to D1. The
// separate narrative2_trace/lifecycle suites own production-depth evidence.
afterEach(() => vi.restoreAllMocks());

function replay(game: Game): void {
    const endpoint = fullWorld(game), messages = clone(game.toSnapshot().run.logger), recording = clone(game.exportRecording());
    expect(game.loadReplay(recording)).toBe(true); game.animationEnabled = false;
    // Avoid toSnapshot between events: it refreshes presentation visibility.
    // Frozen Game.completeReplayEvent (Core/Game.ts:4530–4552) validates tick,
    // depth/player HP/location, inventory/decisions, both RNG streams and all
    // required checkpoints before advancing the cursor. No-OOS/cursor assertions
    // preserve those checks without a side-effecting observation of currentTick.
    for (const event of recording.events) {
        game.replayStep(true);
        expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(event.index + 1);
        expect(rng.getState()).toEqual(event.rng);
        expect(extensionDigest(game.extensionRuntime?.snapshot() ?? null)).toEqual(checkpointExtensionDigest(event));
        expect(game.absoluteTurnNumber).toBe(event.turn);
    }
    expect(fullWorld(game)).toEqual(endpoint);
    expect(game.toSnapshot().run.logger).toEqual(messages);
}

describe('N2-GRAPH / N2-GAME real Game diagnostic placement, production dialogue', () => {
    for (const row of N2_CASES) {
        it(`${row.npc}: rejects locked information, unlocks it by real conversation, and executes all nine node exits`, () => {
            const { game, content } = startDiagnostic({ npcs: [row.npc, row.clueNpc] });
            const visited = new Set<string>(), initial = progress(game);
            const leave = (node: string) => {
                expect(narrative(game).active?.nodeId).toBe(node); visited.add(node);
                const before = progress(game);
                choose(game, `leave-${node}`);
                expect(narrative(game).active).toBeNull(); expect(game.interactionActive).toBe(false);
                expect(progress(game)).toEqual(before);
            };
            open(game, row.npc);
            expect(readNarrativeUiView(game)!.active!.choices.map(choice => choice.id)).toEqual(['ask', 'leave-hello']);
            rejectChoice(game, 'recall-a'); rejectChoice(game, 'recall-b'); leave('hello');
            open(game, row.npc); choose(game, 'ask');
            expect(readNarrativeUiView(game)!.active!.choices.find(choice => choice.id === 'clue'))
                .toMatchObject({ enabled: false, unavailableKey: `ext.narrative.n2.${row.npc}.clueLocked` });
            rejectChoice(game, 'clue'); leave('account');
            open(game, row.npc); choose(game, 'ask'); choose(game, 'detail');
            const beforeLoop = progress(game); visited.add('detail');
            choose(game, 'back-detail'); choose(game, 'detail');
            expect(progress(game)).toEqual(beforeLoop); leave('detail');
            open(game, row.npc); choose(game, 'ask'); choose(game, 'consider'); leave('decision');
            expect(progress(game)).toEqual(initial);
            unlockClue(game, row);
            const clueProgress = progress(game);
            open(game, row.npc); choose(game, 'ask');
            expect(readNarrativeUiView(game)!.active!.choices.find(choice => choice.id === 'clue')).toMatchObject({ enabled: true, unavailableKey: null });
            choose(game, 'clue'); visited.add('clue'); choose(game, 'back-clue'); choose(game, 'clue');
            expect(progress(game)).toEqual(clueProgress); leave('clue');
            const beforeEnding = clone(game.toSaveSnapshot());
            expect(beforeEnding.run.recordingOrigin).toBeDefined();
            for (const ending of ['a', 'b'] as const) {
                expect(game.loadSnapshot(clone(beforeEnding))).toBe(true); game.animationEnabled = false;
                const original = clone(game.exportRecording());
                open(game, row.npc); choose(game, 'ask'); choose(game, 'consider');
                const before = game.extensionRuntime!.snapshot(), old = clone(narrative(game));
                const turn = game.absoluteTurnNumber, data = choose(game, `choose-${ending}`), verdict = row[ending];
                const state = narrative(game);
                expect(state.flags).toEqual({ ...old.flags, [`${row.npc}.verdict`]: verdict });
                expect(state.journal).toEqual([...old.journal, { entryId: `${row.npc}.${verdict}.note`, order: old.journal.length + 1 }]);
                expect(state.rewardReceipts).toContainEqual({ id: `${row.npc}.reward.receipt`, instanceKey: `narrative.${row.npc}.reward.receipt.run`, result: 'skipped', reason: 'absent' });
                expect(state.triggerReceipts).toContainEqual({ triggerId: `${row.npc}.reward`, scopeKey: 'run', firings: 1,
                    lastTurn: turn, lastFactId: before.foundation.nextFactId + 1 });
                expect(state.lastFactId).toBe(before.foundation.nextFactId + 1);
                expect(game.extensionRuntime!.snapshot().foundation.nextFactId).toBe(before.foundation.nextFactId + 2);
                expect(game.extensionRuntime!.snapshot().foundation.pendingStoryFacts).toEqual([]);
                expect(state.placementReceipts).toEqual(old.placementReceipts); expect(state.npcBindings).toEqual(old.npcBindings);
                reject(game, data); rejectChoice(game, `choose-${ending === 'a' ? 'b' : 'a'}`);
                leave(ending);
                const settled = progress(game);
                open(game, row.npc);
                expect(readNarrativeUiView(game)!.active!.choices.map(choice => choice.id)).toEqual(['ask', `recall-${ending}`, 'leave-hello']);
                rejectChoice(game, 'ask'); rejectChoice(game, `recall-${ending === 'a' ? 'b' : 'a'}`);
                choose(game, `recall-${ending}`); leave(`recall-${ending}`);
                expect(progress(game)).toEqual(settled);
                expect(game.exportRecording().events.slice(0, original.events.length)).toEqual(continuingPrefix(original));
                // The full formal save is also accepted after each distinct
                // branch; no flag rewrite is used to fabricate its sibling.
                const saved = clone(game.toSaveSnapshot()), expected = fullWorld(game);
                expect(game.loadSnapshot(saved)).toBe(true); game.animationEnabled = false;
                expect(fullWorld(game)).toEqual(expected); expect(game.hasCompleteRecording).toBe(true);
                replay(game);
            }
            expect([...visited].sort()).toEqual(['hello', 'account', 'detail', 'clue', 'decision', 'a', 'b', 'recall-a', 'recall-b'].sort());
            expect(content.dialogues.find(dialogue => dialogue.id === `${row.npc}.greeting`)!.nodes).toHaveLength(9);
        }, 60000);

        it(`${row.npc}: both conclusions work independently without any previous NPC's clue`, () => {
            const { game } = startDiagnostic({ npcs: [row.npc] }), initial = clone(game.toSaveSnapshot());
            for (const ending of ['a', 'b'] as const) {
                expect(game.loadSnapshot(clone(initial))).toBe(true); game.animationEnabled = false;
                open(game, row.npc); choose(game, 'ask'); rejectChoice(game, 'clue'); choose(game, 'consider'); choose(game, `choose-${ending}`);
                expect(narrative(game).flags[`${row.npc}.verdict`]).toBe(row[ending]);
                expect(narrative(game).journal).toEqual([{ entryId: `${row.npc}.${row[ending]}.note`, order: 1 }]);
                choose(game, `leave-${ending}`);
            }
        }, 30000);
    }
});
