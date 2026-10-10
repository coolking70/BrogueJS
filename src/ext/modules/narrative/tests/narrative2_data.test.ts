import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { registryFromDescriptors } from '../../../descriptor';
import { extensionDataFingerprint } from '../../../fingerprint';
import definitions from '../data/definitions.json';
import portraits from '../data/portraits.json';
import locale from '../locales/zh_CN.json';
import { descriptor } from '../descriptor';
import { getNarrativePackIdentity, loadNarrativeDefinitionPack, NARRATIVE_VERSION } from '../definitions';
import { createNarrativeModuleFromPack } from '../module';
import { loadNarrativePack, NARRATIVE_LIMITS } from '../schema';
import { NarrativeError } from '../errors';

// Independent authoring contract; these values are not derived from the compiler.
const rows = [
    ['cord.mender', '缝绳人', 2, 3, 'splice', 'sever', 'cord.settled', '绳', '#b08b5c'],
    ['cistern.listener', '听水员', 3, 4, 'mark', 'erase', 'cistern.settled', '滴', '#657484'],
    ['bone.clerk', '拾骨书记', 4, 6, 'blank', 'number', 'bone.settled', '骨', '#dcbd93'],
    ['salt.warden', '盐灯看守', 6, 8, 'share', 'keep', 'salt.settled', '盐', '#daa267'],
    ['letter.carrier', '末班递信人', 8, 10, 'return', 'wait', 'letter.settled', '函', '#b67932'],
] as const;
const text = locale as Record<string, string>;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('N2-DATA exact additive content and identities', () => {
    it('has exactly five additional NPCs, 45 nodes and ten journal entries', () => {
        const pack = loadNarrativeDefinitionPack();
        expect([pack.npcs.length, pack.dialogues.length, pack.dialogues.reduce((n, d) => n + d.nodes.length, 0),
            pack.journal.length, pack.flags.length, pack.storyEvents.length, pack.triggers.length]).toEqual([8, 8, 59, 15, 9, 8, 9]);
        expect(pack.npcs.slice(3).map(n => n.id)).toEqual(rows.map(r => r[0]));
        expect(pack.dialogues.slice(3).map(d => d.nodes.length)).toEqual([9, 9, 9, 9, 9]);
        expect(pack.journal.slice(5).map(j => j.id)).toEqual(rows.flatMap(([id, , , , a, b]) => [`${id}.${a}.note`, `${id}.${b}.note`]));
    });
    it('retains every original mechanical array prefix and all author budgets byte-for-byte as JSON values', () => {
        // Captured from fixed code baseline 59b9ba691daf66819eeea0299a0539f3641ad208.
        const prefixes = [
            ['flags', 4, '224fc4f70892550520cbfd86ee9b0241f027577307a5a792c40653c7a190ae75'],
            ['counters', 0, '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
            ['npcs', 3, '4c4ca912392b4eb25722f55cb2a3c003ae173cfa5a79d4d5adbc2bba6d03c90c'],
            ['dialogues', 3, '431251904f86de74bf6f57a5b34ec8ff34460e620698a9d632b9b44d2bdd011a'],
            ['journal', 5, 'fa7d217943d91d3f20ccc239244d76bd6a0c85d20a981dedd1683d27ab236f33'],
            ['storyEvents', 3, 'babbd692c2bdd98198c39ff2b6babee4cbd8fec0170320bcb9bd84cb4006e557'],
            ['triggers', 4, 'd8085218ce56f50b3bfd4e51bb35be784ce8a220597a9c24ca0ae381c6a0e7ee'],
        ] as const;
        for (const [key, length, hash] of prefixes) expect(digest(definitions[key].slice(0, length)), key).toBe(hash);
        expect(digest(definitions.config)).toBe('2cc50609aa85302a54de984271ad6f3d667aba2ec739d536cb5705e7c1ed30f4');
        expect(definitions.config).toEqual({ timePolicy: 'free-frozen', closePolicy: 'close-session', limits: {
            conditionDepth: 8, conditionOpsPerCommand: 256, effectsPerCommand: 64, eventsPerCommand: 32,
            transitionsPerSession: 128, maxActiveNpcs: 32, maxJournalEntries: 256, maxReceipts: 4096,
        } });
        expect(NARRATIVE_LIMITS).toEqual({ conditionDepth: 16, conditionOpsPerCommand: 1024, effectsPerCommand: 256,
            eventsPerCommand: 128, transitionsPerSession: 1024, maxActiveNpcs: 256, maxJournalEntries: 4096,
            maxReceipts: 65536, maxWorldDepth: 40, maxDefinitions: 4096, maxJsonDepth: 64, maxJsonValues: 4_000_000,
            maxPublicActorTags: 32, maxStringLength: 16384, maxPortraitDimension: 8192, maxDistance: 256, maxInteractionDistance: 16 });
    });
    it.each(rows)('%s matches its independent placement, verdict, journal and reward contract', (id, name, minDepth, maxDepth, a, b, rewardId, glyph, color) => {
        const pack = loadNarrativeDefinitionPack(), npc = pack.npcs.find(n => n.id === id)!;
        expect(npc).toEqual({ id, nameKey: `ext.narrative.n2.${id}.name`, descriptionKey: `ext.narrative.n2.${id}.description`,
            glyph, color, portraitId: `${id}.neutral`, dialogueId: `${id}.greeting`, presence: 'stationary-interactable', interactionDistance: 1,
            placements: [{ id: `${id}.first`, minDepth, maxDepth, maxPerRun: 1, maxPerDepth: 1, minStairDistance: 1, maxEntranceDistance: 8, onNoSpace: 'defer' }] });
        expect(text[npc.nameKey]).toBe(name);
        expect(pack.flags.find(f => f.id === `${id}.verdict`)).toEqual({ id: `${id}.verdict`, type: 'string',
            initial: 'unresolved', min: null, max: null, values: ['unresolved', a, b] });
        const dialogue = pack.dialogues.find(d => d.id === npc.dialogueId)!;
        expect(dialogue.entry).toBe('hello');
        expect(dialogue.nodes.map(n => n.id)).toEqual(['hello', 'account', 'detail', 'clue', 'decision', 'a', 'b', 'recall-a', 'recall-b']);
        for (const [suffix, verdict] of [['a', a], ['b', b]]) {
            const choice = dialogue.nodes.find(n => n.id === 'decision')!.choices.find(c => c.id === `choose-${suffix}`)!;
            expect(choice.condition).toEqual({ op: 'flag', id: `${id}.verdict`, equals: 'unresolved' });
            expect(choice.next).toBe(suffix);
            expect(choice.effects).toEqual([{ kind: 'set-flag', id: `${id}.verdict`, value: verdict },
                { kind: 'journal', entryId: `${id}.${verdict}.note` }, { kind: 'emit-story', eventId: `${id}.settled` }]);
        }
        expect(pack.triggers.find(t => t.id === `${id}.reward`)).toEqual({ id: `${id}.reward`, on: { kind: 'story', eventId: `${id}.settled` },
            priority: 0, condition: { op: 'not', arg: { op: 'flag', id: `${id}.verdict`, equals: 'unresolved' } },
            repeat: { kind: 'once-per-run' }, effects: [{ kind: 'optional-reward', capability: 'growth.story-reward.v1', rewardId,
                receiptId: `${id}.reward.receipt`, onUnavailable: 'skip' }] });
    });
    it('has complete literal locale and portrait closure without metadata or reward amount leakage', () => {
        const pack = loadNarrativeDefinitionPack();
        const check = (value: unknown): void => {
            if (Array.isArray(value)) { value.forEach(check); return; }
            if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
                if (['nameKey', 'descriptionKey', 'textKey', 'titleKey', 'altKey', 'unavailableKey'].includes(key) && child !== null) {
                    expect(child).toMatch(/^ext\.narrative\.[a-zA-Z0-9_.-]+$/); expect(text[String(child)]?.trim()).toBeTruthy();
                }
                check(child);
            }
        };
        check(pack); check(portraits);
        expect(portraits.schema).toBe(1); expect(portraits.displayVersion).toBe('1.3.0'); expect(portraits.portraits).toHaveLength(8);
        for (const npc of pack.npcs) {
            const portrait = portraits.portraits.find(p => p.id === npc.portraitId)!;
            expect(portrait).toBeDefined(); expect([portrait.width, portrait.height, portrait.fit, portrait.anchor]).toEqual([48, 64, 'contain', 'bottom-center']);
        }
        for (const key of ['recruitable', 'eligibility', 'targetPhase', 'suggestedXp', 'amount', 'art']) expect(JSON.stringify(pack)).not.toContain(`"${key}"`);
        for (const node of pack.dialogues.slice(3).flatMap(d => d.nodes)) {
            expect(node.choices.some(c => c.condition.op === 'true' && c.next === null && c.effects.length === 0)).toBe(true);
        }
    });
    it('rejects malformed newcomer references, exits, enums, receipts and automatic cycles with the unchanged loader', () => {
        const corruptions: [string, (raw: any) => void][] = [
            ['UNKNOWN_REFERENCE', raw => { raw.npcs[3].dialogueId = 'missing.dialogue'; }],
            ['DUPLICATE_ID', raw => { raw.npcs[4].id = raw.npcs[3].id; }],
            ['FLAG_VALUE', raw => { raw.flags[4].initial = 'not-a-verdict'; }],
            ['UNREACHABLE_NODE', raw => { const d = raw.dialogues[3]; d.nodes.push({ ...structuredClone(d.nodes[5]), id: 'unreachable',
                choices: [{ ...structuredClone(d.nodes[5].choices[0]), id: 'leave-unreachable' }] }); }],
            ['MISSING_EXIT', raw => { raw.dialogues[3].nodes[5].choices[0].next = 'a'; }],
            ['DUPLICATE_RECEIPT', raw => { raw.triggers[5].effects[0].receiptId = raw.triggers[4].effects[0].receiptId; }],
            ['AUTOMATIC_CYCLE', raw => { raw.triggers[4].effects.push({ kind: 'emit-story', eventId: 'cord.mender.settled' }); }],
            ['UNKNOWN_KEY', raw => { raw.triggers[4].effects[0].amount = 5; }],
        ];
        for (const [code, mutate] of corruptions) {
            const raw = structuredClone(definitions); mutate(raw);
            expect(() => loadNarrativePack(raw, portraits, locale), code).toThrowError(expect.objectContaining({ code }));
        }
    });
    it('keeps exact module identity in descriptor and factory, rejecting old versions and wrong fingerprints', () => {
        const pack = loadNarrativeDefinitionPack(), identity = getNarrativePackIdentity();
        expect(NARRATIVE_VERSION).toBe('1.5.0'); expect([pack.schema, pack.stateVersion, pack.inputVersion]).toEqual([1, 4, 2]);
        expect(identity).toEqual({ schema: 1, version: '1.5.0', fingerprint: 'sha256:c22c646d3b86ee57ab3d36069992e317bf355f8d105bacc92114a67176f04beb' });
        expect(descriptor.rules).toEqual(identity); expect(createNarrativeModuleFromPack(pack).rules).toEqual(identity);
        const registry = registryFromDescriptors([descriptor]), manifest = registry.manifest(['narrative']);
        expect(registry.create(manifest)).toHaveLength(1);
        for (const field of ['moduleVersion', 'rulesVersion']) {
            expect(() => loadNarrativePack({ ...definitions, [field]: '1.4.0' }, portraits, locale)).toThrow(NarrativeError);
        }
        for (const mutate of [(m: typeof manifest) => { m.modules[0]!.version = '1.4.0'; },
            (m: typeof manifest) => { m.modules[0]!.rules = { ...identity, fingerprint: `sha256:${'0'.repeat(64)}` }; }]) {
            const bad = structuredClone(manifest); mutate(bad); expect(() => registry.create(bad)).toThrow();
        }
        const changedText = { ...locale, 'ext.narrative.n2.cord.mender.name': '临时显示名' };
        expect(extensionDataFingerprint(loadNarrativePack(definitions, { ...portraits, displayVersion: '9.0.0' }, changedText))).toBe(identity.fingerprint);
        expect(() => loadNarrativePack({ ...definitions, npcs: definitions.npcs.map((n, i) => i === 3 ? { ...n, recruitable: true } : n) }, portraits, locale))
            .toThrowError(expect.objectContaining({ code: 'UNKNOWN_KEY', path: '$.npcs[3].recruitable' }));
    });
});
