import { installedOptionalModules } from '../../../../test/support/installedExtensions';
import { describe, expect, it, vi } from 'vitest';
import type { Json } from '../../../types';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import { createHeadlessGame } from '../../../../test/harness';
import { logger } from '../../../../engine/Systems/Logger';
import { createNarrativeModuleFromPack } from '../module';
import { buildNarrativeUiCommand, readNarrativeUiView } from '../ui/view';
import { newBudget, routeStep } from './narrative2_naturalFixture';
import recruitment from '../data/recruitment.json';
import definitions from '../data/definitions.json';
import portraits from '../data/portraits.json';
import locale from '../locales/zh_CN.json';
import { getNarrativePackIdentity, loadNarrativeDefinitionPack } from '../definitions';
import { NarrativeError, type NarrativeErrorCode } from '../errors';
import { loadNarrativeRecruitment } from '../recruitment';
import { loadNarrativePack } from '../schema';
import { initialNarrativeState } from '../state';
import { projectNarrativeView } from '../view';
import { commitNarrativePlan, planNarrativeChoice } from '../effects';

const pack = loadNarrativeDefinitionPack();
const fresh = (): any => structuredClone(recruitment);
function rejects(raw: unknown, code: NarrativeErrorCode, path?: string): void {
    let error: unknown;
    try { loadNarrativeRecruitment(raw, pack); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(NarrativeError);
    const diagnostic = error as NarrativeError;
    expect(diagnostic.code).toBe(code); expect(diagnostic.path).toMatch(/^\$recruitment(?:\.|$)/);
    if (path) expect(diagnostic.path).toBe(path);
    expect(diagnostic.textKey).toBe(`ext.narrative.error.${code}`);
    expect((locale as Record<string, string>)[diagnostic.textKey]?.trim()).toBeTruthy();
}

describe('N2-META author-only future recruitment metadata', () => {
    it('has exactly four candidates and one explicit noncandidate, with no inferred rows for the original three', () => {
        expect(loadNarrativeRecruitment(recruitment, pack)).toEqual({ schema: 1, targetPhase: '5D3', npcs: [
            { npcId: 'cord.mender', recruitable: true, eligibility: { flagId: 'cord.mender.verdict', anyOf: ['splice'] } },
            { npcId: 'cistern.listener', recruitable: true, eligibility: { flagId: 'cistern.listener.verdict', anyOf: ['mark'] } },
            { npcId: 'bone.clerk', recruitable: true, eligibility: { flagId: 'bone.clerk.verdict', anyOf: ['blank'] } },
            { npcId: 'salt.warden', recruitable: false, eligibility: null },
            { npcId: 'letter.carrier', recruitable: true, eligibility: { flagId: 'letter.carrier.verdict', anyOf: ['return'] } },
        ] });
    });
    it('clones and deeply freezes every returned object and array without freezing the input', () => {
        const raw = fresh(), loaded = loadNarrativeRecruitment(raw, pack);
        const frozen = (value: unknown): void => { if (value && typeof value === 'object') {
            expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(frozen);
        } };
        frozen(loaded); expect(loaded).not.toBe(raw); expect(loaded.npcs).not.toBe(raw.npcs);
        expect(Object.isFrozen(raw)).toBe(false); expect(Object.isFrozen(raw.npcs[0].eligibility.anyOf)).toBe(false);
        raw.npcs[0].eligibility.anyOf[0] = 'sever'; raw.npcs.reverse();
        expect(loaded.npcs[0]!.eligibility!.anyOf).toEqual(['splice']);
        expect(() => (loaded.npcs[0]!.eligibility!.anyOf as string[]).push('sever')).toThrow();
    });
    const mutations: [string, (raw: any) => void, NarrativeErrorCode, string][] = [
        ['unknown root key', r => { r.recruit = true; }, 'UNKNOWN_KEY', '$recruitment.recruit'],
        ['missing schema', r => { delete r.schema; }, 'INVALID_TYPE', '$recruitment.schema'],
        ['wrong schema', r => { r.schema = 2; }, 'INVALID_VERSION', '$recruitment.schema'],
        ['string schema', r => { r.schema = '1'; }, 'INVALID_VERSION', '$recruitment.schema'],
        ['wrong phase', r => { r.targetPhase = '5D2'; }, 'INVALID_VERSION', '$recruitment.targetPhase'],
        ['missing phase', r => { delete r.targetPhase; }, 'INVALID_TYPE', '$recruitment.targetPhase'],
        ['nonarray rows', r => { r.npcs = {}; }, 'INVALID_TYPE', '$recruitment.npcs'],
        ['missing row', r => { r.npcs.pop(); }, 'INVALID_RANGE', '$recruitment.npcs'],
        ['extra row', r => { r.npcs.push({ npcId: 'archive.keeper', recruitable: false, eligibility: null }); }, 'INVALID_RANGE', '$recruitment.npcs'],
        ['null row', r => { r.npcs[0] = null; }, 'INVALID_TYPE', '$recruitment.npcs[0]'],
        ['unknown row key', r => { r.npcs[0].jobId = 'builder'; }, 'UNKNOWN_KEY', '$recruitment.npcs[0].jobId'],
        ['missing npcId', r => { delete r.npcs[0].npcId; }, 'INVALID_TYPE', '$recruitment.npcs[0].npcId'],
        ['missing recruitable', r => { delete r.npcs[0].recruitable; }, 'INVALID_TYPE', '$recruitment.npcs[0].recruitable'],
        ['missing flagId', r => { delete r.npcs[0].eligibility.flagId; }, 'INVALID_TYPE', '$recruitment.npcs[0].eligibility.flagId'],
        ['missing anyOf', r => { delete r.npcs[0].eligibility.anyOf; }, 'INVALID_TYPE', '$recruitment.npcs[0].eligibility.anyOf'],
        ['missing eligibility', r => { delete r.npcs[0].eligibility; }, 'INVALID_TYPE', '$recruitment.npcs[0].eligibility'],
        ['invalid ID', r => { r.npcs[0].npcId = 'cord_mender'; }, 'INVALID_ID', '$recruitment.npcs[0].npcId'],
        ['oversize ID', r => { r.npcs[0].npcId = 'a'.repeat(129); }, 'INVALID_ID', '$recruitment.npcs[0].npcId'],
        ['forbidden ID', r => { r.npcs[0].npcId = 'constructor'; }, 'INVALID_ID', '$recruitment.npcs[0].npcId'],
        ['unknown NPC', r => { r.npcs[0].npcId = 'missing.npc'; }, 'UNKNOWN_REFERENCE', '$recruitment.npcs[0].npcId'],
        ['old NPC replaces newcomer', r => { r.npcs[0].npcId = 'archive.keeper'; }, 'UNKNOWN_REFERENCE', '$recruitment.npcs[0].npcId'],
        ['duplicate NPC', r => { r.npcs[1].npcId = r.npcs[0].npcId; }, 'DUPLICATE_ID', '$recruitment.npcs[1].npcId'],
        ['truthy recruitable', r => { r.npcs[0].recruitable = 1; }, 'INVALID_TYPE', '$recruitment.npcs[0].recruitable'],
        ['string recruitable', r => { r.npcs[0].recruitable = 'true'; }, 'INVALID_TYPE', '$recruitment.npcs[0].recruitable'],
        ['true with null', r => { r.npcs[0].eligibility = null; }, 'INVALID_TYPE', '$recruitment.npcs[0].eligibility'],
        ['false with object', r => { r.npcs[3].eligibility = { flagId: 'salt.warden.verdict', anyOf: ['share'] }; }, 'INVALID_TYPE', '$recruitment.npcs[3].eligibility'],
        ['unknown eligibility key', r => { r.npcs[0].eligibility.cost = 0; }, 'UNKNOWN_KEY', '$recruitment.npcs[0].eligibility.cost'],
        ['invalid flag ID', r => { r.npcs[0].eligibility.flagId = 'bad id'; }, 'INVALID_ID', '$recruitment.npcs[0].eligibility.flagId'],
        ['unknown flag', r => { r.npcs[0].eligibility.flagId = 'missing.flag'; }, 'UNKNOWN_REFERENCE', '$recruitment.npcs[0].eligibility.flagId'],
        ['boolean flag', r => { r.npcs[0].eligibility.flagId = 'archive.read'; }, 'INVALID_TYPE', '$recruitment.npcs[0].eligibility.flagId'],
        ['nonarray anyOf', r => { r.npcs[0].eligibility.anyOf = 'splice'; }, 'INVALID_TYPE', '$recruitment.npcs[0].eligibility.anyOf'],
        ['empty anyOf', r => { r.npcs[0].eligibility.anyOf = []; }, 'INVALID_RANGE', '$recruitment.npcs[0].eligibility.anyOf'],
        ['duplicate anyOf', r => { r.npcs[0].eligibility.anyOf = ['splice', 'splice']; }, 'DUPLICATE_ID', '$recruitment.npcs[0].eligibility.anyOf[1]'],
        ['wrong enum value', r => { r.npcs[0].eligibility.anyOf = ['return']; }, 'FLAG_VALUE', '$recruitment.npcs[0].eligibility.anyOf[0]'],
        ['unresolved is not eligibility', r => { r.npcs[0].eligibility.anyOf = ['unresolved']; }, 'FLAG_VALUE', '$recruitment.npcs[0].eligibility.anyOf[0]'],
        ['nonstring anyOf', r => { r.npcs[0].eligibility.anyOf = [true]; }, 'INVALID_TYPE', '$recruitment.npcs[0].eligibility.anyOf[0]'],
    ];
    it.each(mutations)('rejects %s with a stable localized code and exact path', (_name, mutate, code, path) => {
        const raw = fresh(); mutate(raw); rejects(raw, code, path);
    });
    it('rejects unsafe JSON without evaluating accessors or accepting exotic prototypes, sparse arrays or cycles', () => {
        const getter = vi.fn(() => true), accessor = fresh();
        Object.defineProperty(accessor.npcs[0], 'recruitable', { get: getter, enumerable: true });
        rejects(accessor, 'INVALID_JSON', '$recruitment.npcs[0].recruitable'); expect(getter).not.toHaveBeenCalled();
        const inherited = fresh(); Object.setPrototypeOf(inherited.npcs[0], { surprise: true }); rejects(inherited, 'INVALID_JSON');
        const cycle = fresh(); cycle.npcs[0].eligibility.anyOf = [cycle]; rejects(cycle, 'INVALID_JSON');
        const sparse = fresh(); delete sparse.npcs[0]; rejects(sparse, 'INVALID_JSON');
        const hidden = fresh(); Object.defineProperty(hidden, 'secret', { value: 1 }); rejects(hidden, 'INVALID_JSON');
        const symbol = fresh(); symbol[Symbol('bad')] = true; rejects(symbol, 'INVALID_JSON');
        const arrayPrototype = fresh(); Object.setPrototypeOf(arrayPrototype.npcs, null); rejects(arrayPrototype, 'INVALID_JSON');
        for (const key of ['__proto__', 'constructor', 'prototype']) {
            const unsafe = fresh(); Object.defineProperty(unsafe, key, { value: {}, enumerable: true }); rejects(unsafe, 'INVALID_JSON');
        }
        for (const value of [undefined, () => true, new Date(), new Map()]) rejects(value, 'INVALID_JSON');
        for (const value of [null, [], true]) rejects(value, 'INVALID_TYPE');
    });
    it('requires a real loaded rules pack and verifies that every listed NPC still exists in it', () => {
        expect(() => loadNarrativeRecruitment(recruitment, structuredClone(pack))).toThrowError(expect.objectContaining({ code: 'INVALID_STATE', path: '$pack' }));
        const raw = structuredClone(definitions); raw.npcs = raw.npcs.filter(n => n.id !== 'cord.mender');
        const missingNpc = loadNarrativePack(raw, portraits, locale);
        expect(() => loadNarrativeRecruitment(recruitment, missingNpc)).toThrowError(expect.objectContaining({ code: 'UNKNOWN_REFERENCE', path: '$recruitment.npcs[0].npcId' }));
    });
    it('changing the actual imported metadata cannot affect a real Game, player, settlement, reward or continuation recording', () => {
        // DIAGNOSTIC placement only: cord is moved to D1 through a formally
        // loaded rules pack. All dialogue/effects and settlement are production.
        // This does not claim a natural-depth route or recruitment gameplay.
        const raw = structuredClone(definitions);
        const cord = raw.npcs.find(npc => npc.id === 'cord.mender')!;
        cord.placements = cord.placements.map(p => ({ ...p, minDepth: 1, maxDepth: 1 }));
        const diagnostic = loadNarrativePack(raw, portraits, locale), module = createNarrativeModuleFromPack(diagnostic);
        const registry = registryFromDescriptors(catalog.getInstalledModuleDescriptors().map(descriptor => descriptor.id === 'narrative'
            ? { ...descriptor, rules: module.rules, create: () => createNarrativeModuleFromPack(diagnostic) } : descriptor));
        const spy = vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry), originalMetadata = fresh();
        try {
            const ids = installedOptionalModules(['narrative', 'settlement']);
            const initialCommands = registry.create(registry.manifest(ids)).flatMap(m => m.initialCommand
                ? [JSON.stringify({ module: m.id, ...m.initialCommand })] : []);
            const game = createHeadlessGame(8201, 'test');
            game.startNewGame({ seed: 8201, mode: 'wizard', ruleSet: 'extended', extensions: ids, initialCommands });
            game.animationEnabled = false;
            const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
            acknowledge();
            const target = game.extensionRuntime!.snapshot().foundation.world.entities.find(entity => entity.contentId === 'cord.mender')!;
            expect(target).toBeDefined();
            const budget = newBudget();
            while (!game.extensionRuntime!.nearbyInteractables('narrative').some(entity => entity.id === target.id)) routeStep(game, budget, target);
            acknowledge();
            expect(readNarrativeUiView(game)!.nearby.some(entity => entity.targetEntityId === target.id)).toBe(true);
            const normalizeSave = (snapshot: ReturnType<typeof game.toSaveSnapshot>) => {
                const saved = structuredClone(snapshot); saved.savedAt = 0;
                if (saved.run.recordingOrigin) saved.run.recordingOrigin.header.recordedAt = 0;
                return saved;
            };
            const recording = () => ({ ...structuredClone(game.exportRecording()), recordedAt: 0 });
            const visible = () => { const { session: _opaque, ...view } = readNarrativeUiView(game)!; return structuredClone(view); };
            const snapshot = () => normalizeSave(game.toSaveSnapshot());
            const command = (action: 'open' | 'choose', id: number | string) => {
                acknowledge(); const value = buildNarrativeUiCommand(game, readNarrativeUiView(game)!, action, id);
                expect(value).not.toBeNull(); const length = game.recordedInputEvents.length;
                game.executeCommand('ext:command', value); acknowledge();
                expect(game.recordedInputEvents).toHaveLength(length + 1);
            };
            const suffix = () => {
                command('open', target.id); command('choose', 'ask'); command('choose', 'consider'); command('choose', 'choose-a');
                command('choose', 'leave-a'); command('open', target.id); command('choose', 'recall-a'); command('choose', 'leave-recall-a');
                const length = game.recordedInputEvents.length; game.executeCommand('wait'); acknowledge();
                expect(game.recordedInputEvents).toHaveLength(length + 1);
            };
            const genuine = structuredClone(game.toSaveSnapshot()), before = snapshot(), identity = getNarrativePackIdentity();
            expect(genuine.run.recordingOrigin).toBeDefined(); if (ids.includes('settlement')) expect(genuine.extensions!.modules.settlement).toBeDefined();
            else expect(genuine.extensions!.modules.settlement).toBeUndefined();
            suffix(); const expected = snapshot(), expectedRecording = recording(), expectedView = visible();
            expect((expected.extensions!.modules.narrative as any).rewardReceipts).toContainEqual({ id: 'cord.mender.reward.receipt',
                instanceKey: 'narrative.cord.mender.reward.receipt.run', result: 'skipped', reason: 'absent' });
            // Mutate the imported module object, not a detached validator argument:
            // any accidental runtime import would now observe the altered table.
            recruitment.npcs[0]!.eligibility!.anyOf = ['sever'];
            recruitment.npcs[1]!.recruitable = false; recruitment.npcs[1]!.eligibility = null;
            recruitment.npcs[3]!.recruitable = true; recruitment.npcs[3]!.eligibility = { flagId: 'salt.warden.verdict', anyOf: ['share'] };
            expect(loadNarrativeRecruitment(recruitment, diagnostic)).not.toEqual(originalMetadata);
            expect(snapshot()).toEqual(expected); expect(recording()).toEqual(expectedRecording); expect(getNarrativePackIdentity()).toEqual(identity);
            expect(game.loadSnapshot(structuredClone(genuine))).toBe(true); game.animationEnabled = false; acknowledge();
            expect(game.hasCompleteRecording).toBe(true); expect(snapshot()).toEqual(before);
            suffix(); expect(snapshot()).toEqual(expected); expect(recording()).toEqual(expectedRecording);
            expect(visible()).toEqual(expectedView);
            expect(snapshot().player).toEqual(expected.player);
            expect(snapshot().extensions!.modules.settlement).toEqual(expected.extensions!.modules.settlement);
            expect(snapshot().rngState).toEqual(expected.rngState);
        } finally {
            Object.assign(recruitment, originalMetadata);
            spy.mockRestore();
        }
        expect(recruitment).toEqual(originalMetadata);
    }, 60000);
    it('authoring changes cannot alter current rules, initial state, public projection or reward results', () => {
        const identity = getNarrativePackIdentity(), before = initialNarrativeState(pack);
        const project = () => projectNarrativeView(pack, { state: before as unknown as Json, depth: 2, turn: 0,
            visibleInteractables: [], nearbyInteractables: [], queryOptional: () => ({ status: 'unavailable', reason: 'absent' }) });
        const reward = () => {
            const plan = planNarrativeChoice(pack, before, { kind: 'dialogue-choice', dialogueId: 'cord.mender.greeting', choiceId: 'choose-a', factId: 1, depth: 2, turn: 0 },
                { dialogueId: 'cord.mender.greeting', nodeId: 'decision', choiceId: 'choose-a', transitions: 0 });
            return commitNarrativePlan(pack, before, plan);
        };
        const view = project(), result = reward(), changed = fresh();
        changed.npcs[0].eligibility.anyOf = ['sever']; changed.npcs[1].recruitable = false; changed.npcs[1].eligibility = null;
        expect(loadNarrativeRecruitment(changed, pack)).not.toEqual(loadNarrativeRecruitment(recruitment, pack));
        expect(getNarrativePackIdentity()).toEqual(identity); expect(initialNarrativeState(pack)).toEqual(before);
        expect(project()).toEqual(view); expect(reward()).toEqual(result);
        for (const key of ['recruitable', 'eligibility', 'targetPhase', 'resident', 'jobId']) {
            expect(JSON.stringify([pack, before, view, result])).not.toContain(`"${key}"`);
        }
    });
});
