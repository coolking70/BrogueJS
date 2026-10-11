import { describe, expect, it, vi } from 'vitest';
import type { ExtensionContext, Json, WorldInteractable } from '../../../types';
import { loadNarrativeDefinitionPack } from '../definitions';
import { commitNarrativePlan, planNarrativeChoice, planNarrativeFact } from '../effects';
import { initialNarrativeState, validateNarrativeState, type NarrativeState } from '../state';
import { planNarrativeCommand } from '../sessions';
import { projectNarrativeView } from '../view';
import { NarrativeError } from '../errors';

const pack = loadNarrativeDefinitionPack();
const rows = [
    ['cord.mender', 'splice', 'sever', 'archive.keeper'],
    ['cistern.listener', 'mark', 'erase', 'cord.mender'],
    ['bone.clerk', 'blank', 'number', 'archive.keeper'],
    ['salt.warden', 'share', 'keep', 'cistern.listener'],
    ['letter.carrier', 'return', 'wait', 'bone.clerk'],
] as const;
const clone = <T>(value: T): T => structuredClone(value);
const progress = (state: NarrativeState) => clone({ flags: state.flags, counters: state.counters, journal: state.journal,
    rewardReceipts: state.rewardReceipts, triggerReceipts: state.triggerReceipts });

/** Pure command/planner fixture with a validated synthetic binding. This proves
 * graph semantics; it is deliberately not natural placement or real Game evidence. */
function fixture(npcId: string, unlock = false) {
    const npc = pack.npcs.find(n => n.id === npcId)!, placement = npc.placements[0]!;
    let state = initialNarrativeState(pack);
    if (unlock) {
        const prerequisite = rows.find(r => r[0] === npcId)![3];
        const dialogueId = prerequisite === 'archive.keeper' ? 'archive.greeting' : `${prerequisite}.greeting`;
        const selections = prerequisite === 'archive.keeper' ? [['hello', 'read-note']]
            : [['hello', 'ask'], ['account', 'consider'], ['decision', 'choose-a'], ['a', 'leave-a']];
        for (const [nodeId, choiceId] of selections) {
            const plan = planNarrativeChoice(pack, state, { kind: 'dialogue-choice', dialogueId, choiceId,
                factId: state.lastFactId + 1, depth: placement.minDepth, turn: 0 }, { dialogueId, nodeId: nodeId!, choiceId: choiceId!, transitions: 0 });
            state = commitNarrativePlan(pack, state, plan);
        }
    }
    const binding = { npcId, placementId: placement.id, instanceKey: `${placement.id}.slot.1` };
    state.revision++; // Synthetic placement is an already-committed fixture state.
    state.npcBindings['10'] = binding;
    state.placementReceipts = [{ ...binding, depth: placement.minDepth, result: 'placed' }];
    state = validateNarrativeState(state, pack);
    const entity: WorldInteractable = { id: 10, owner: 'narrative', contentId: npcId, instanceKey: binding.instanceKey,
        depth: placement.minDepth, x: 2, y: 1, nameKey: npc.nameKey, descriptionKey: npc.descriptionKey,
        glyph: npc.glyph, color: npc.color, priority: 0, interactionDistance: 1 };
    const randomInt = vi.fn(), message = vi.fn();
    const context = { moduleId: 'narrative', playerId: 1, turn: 0, depth: placement.minDepth,
        get nextFactId() { return state.lastFactId + 1; }, get state() { return clone(state) as unknown as Json; },
        creature: () => ({ id: 1, hp: 20, maxHp: 20, x: 1, y: 1 }), interactionTarget: (id: number) => id === 10 ? entity : null,
        queryOptional: () => ({ status: 'unavailable', reason: 'absent' }),
        prepareOptionalReward: () => ({ status: 'skipped', reason: 'absent' }), randomInt, message,
    } as unknown as ExtensionContext;
    const input = (action: 'open' | 'choose' | 'close', choiceId?: string) => ({ module: 'narrative', action,
        payload: { v: 2, revision: state.revision, ...(action === 'open' ? { targetEntityId: 10 }
            : { sessionId: state.active!.sessionId, ...(action === 'choose' ? { nodeId: state.active!.nodeId, choiceId } : {}) }) } });
    const execute = (raw: unknown) => { state = planNarrativeCommand(pack, raw, context).nextState; };
    return { input, execute, randomInt, message, state: () => clone(state),
        open() { execute(input('open')); }, choose(id: string) { execute(input('choose', id)); },
        project: () => projectNarrativeView(pack, { state: clone(state) as unknown as Json, depth: placement.minDepth, turn: 0,
            visibleInteractables: [entity], nearbyInteractables: [entity], queryOptional: context.queryOptional }) as Record<string, any>,
    };
}

describe('N2-GRAPH five independent nine-node dialogues (pure validated fixtures)', () => {
    for (const [npc, a, b] of rows) for (const [suffix, verdict, other] of [['a', a, b], ['b', b, a]]) {
        it(`${npc}/${verdict} settles independently, reopens only its matching recall and rejects stale/forged input`, () => {
            const f = fixture(npc); f.open();
            expect(f.project().active.choices.map((c: any) => c.id)).toEqual(['ask', 'leave-hello']);
            f.choose('ask'); f.choose('detail'); f.choose('back-detail'); f.choose('consider');
            const before = f.state(), old = f.input('choose', `choose-${suffix}`);
            f.execute(old);
            expect(f.state().active!.nodeId).toBe(suffix);
            expect(f.state().flags).toEqual({ ...before.flags, [`${npc}.verdict`]: verdict });
            expect(f.state().journal).toEqual([{ entryId: `${npc}.${verdict}.note`, order: 1 }]);
            expect(f.state().journal.some(j => j.entryId === `${npc}.${other}.note`)).toBe(false);
            expect(f.state().rewardReceipts).toEqual([{ id: `${npc}.reward.receipt`, instanceKey: `narrative.${npc}.reward.receipt.run`, result: 'skipped', reason: 'absent' }]);
            expect(f.state().triggerReceipts).toHaveLength(1); expect(f.state().triggerReceipts[0]).toMatchObject({ triggerId: `${npc}.reward`, scopeKey: 'run', firings: 1 });
            const settled = f.state(); expect(() => f.execute(old)).toThrowError(expect.objectContaining({ code: 'STALE_PLAN' })); expect(f.state()).toEqual(settled);
            expect(() => f.choose(`choose-${suffix === 'a' ? 'b' : 'a'}`)).toThrow(NarrativeError); expect(f.state()).toEqual(settled);
            f.choose(`leave-${suffix}`); expect(f.state().active).toBeNull(); f.open();
            const view = f.project();
            expect(view.active.choices.map((c: any) => c.id)).toEqual(['ask', `recall-${suffix}`, 'leave-hello']);
            expect(view.active.choices[0]).toMatchObject({ enabled: false, unavailableKey: `ext.narrative.n2.${npc}.settled` });
            const reopened = f.state();
            for (const choice of ['ask', 'made-up', `recall-${suffix === 'a' ? 'b' : 'a'}`]) {
                expect(() => f.choose(choice)).toThrow(NarrativeError); expect(f.state()).toEqual(reopened);
            }
            f.choose(`recall-${suffix}`); expect(f.state().active!.nodeId).toBe(`recall-${suffix}`); f.choose(`leave-recall-${suffix}`);
            expect(f.state().active).toBeNull(); expect(progress(f.state())).toEqual(progress(settled));
            const repeat = planNarrativeFact(pack, f.state(), { kind: 'story', eventId: `${npc}.settled`, depth: 10, turn: 0, factId: f.state().lastFactId });
            expect(commitNarrativePlan(pack, f.state(), repeat)).toEqual(f.state());
            const fresh = planNarrativeFact(pack, f.state(), { kind: 'story', eventId: `${npc}.settled`, depth: 10, turn: 0, factId: f.state().lastFactId + 1 });
            expect(progress(commitNarrativePlan(pack, f.state(), fresh))).toEqual(progress(f.state()));
            f.open(); const close = f.input('close'); f.execute(close); expect(() => f.execute(close)).toThrow(NarrativeError);
            expect(f.randomInt).not.toHaveBeenCalled(); expect(f.message).not.toHaveBeenCalled();
        });
    }
    it.each(rows)('%s clue is unavailable until the actual prerequisite choice effects commit; information loops do not award', (npc) => {
        const locked = fixture(npc); locked.open(); locked.choose('ask');
        expect(locked.project().active.choices.find((c: any) => c.id === 'clue')).toMatchObject({ enabled: false, unavailableKey: `ext.narrative.n2.${npc}.clueLocked` });
        const before = locked.state(); expect(() => locked.choose('clue')).toThrowError(expect.objectContaining({ code: 'CONDITION_UNAVAILABLE' })); expect(locked.state()).toEqual(before);
        const f = fixture(npc, true), prior = progress(f.state()); f.open(); f.choose('ask');
        expect(f.project().active.choices.find((c: any) => c.id === 'clue')).toMatchObject({ enabled: true, unavailableKey: null });
        for (let i = 0; i < 3; i++) { f.choose('detail'); f.choose('back-detail'); f.choose('clue'); f.choose('back-clue'); }
        expect(progress(f.state())).toEqual(prior); f.choose('leave-account'); expect(f.state().active).toBeNull(); expect(progress(f.state())).toEqual(prior);
    });
    it.each(rows)('%s visits all nine nodes and every unconditional exit preserves story progress', (npc) => {
        const paths: Record<string, string[]> = {
            hello: [], account: ['ask'], detail: ['ask', 'detail'], clue: ['ask', 'clue'], decision: ['ask', 'consider'],
            a: ['ask', 'consider', 'choose-a'], b: ['ask', 'consider', 'choose-b'],
            'recall-a': ['ask', 'consider', 'choose-a', 'leave-a', 'open', 'recall-a'],
            'recall-b': ['ask', 'consider', 'choose-b', 'leave-b', 'open', 'recall-b'],
        };
        expect(Object.keys(paths)).toEqual(pack.dialogues.find(d => d.id === `${npc}.greeting`)!.nodes.map(n => n.id));
        for (const [node, path] of Object.entries(paths)) {
            const f = fixture(npc, true); f.open();
            for (const choice of path) choice === 'open' ? f.open() : f.choose(choice);
            expect(f.state().active!.nodeId).toBe(node);
            const before = progress(f.state()); f.choose(`leave-${node}`);
            expect(f.state().active).toBeNull(); expect(progress(f.state())).toEqual(before);
        }
    });
    it('refuses stale pure plans after a newer command and older fact IDs without changing state', () => {
        const state = initialNarrativeState(pack), fact = { kind: 'dialogue-choice', dialogueId: 'cord.mender.greeting', choiceId: 'ask', factId: 1, depth: 2, turn: 0 } as const;
        const selection = { dialogueId: fact.dialogueId, nodeId: 'hello', choiceId: 'ask', transitions: 0 };
        const plan = planNarrativeChoice(pack, state, fact, selection), next = commitNarrativePlan(pack, state, plan), snapshot = clone(next);
        expect(() => commitNarrativePlan(pack, next, plan)).toThrowError(expect.objectContaining({ code: 'STALE_PLAN' }));
        expect(() => planNarrativeChoice(pack, next, fact, selection)).toThrowError(expect.objectContaining({ code: 'INVALID_FACT' })); expect(next).toEqual(snapshot);
    });
});
