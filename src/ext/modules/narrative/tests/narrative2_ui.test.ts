import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, shallowRef, type Component } from 'vue';
import { readFileSync } from 'node:fs';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import { DialogService } from '../../../../ui/dialogService';
import type { ModuleUiHost } from '../../../ui/types';
import { useNarrativeUi } from '../ui/useNarrativeUi';
import { buildNarrativeUiCommand, readNarrativeUiView } from '../ui/view';
import { resolveNarrativePortrait } from '../ui/portraits';
import { N2_CASES, clone, startDiagnostic, observed, narrative, open, choose, unlockClue, translate } from './narrative2_rewardFixture';
import { all, text, byTestId, byAction, mount, unmountAll, imageEvent } from './narrative2_uiFixture';

let Dialogue: Component, ControlledDialogue: Component;
beforeAll(async () => {
    Dialogue = await createSfcHarness({ baseURL: import.meta.url }).load('../ui/NarrativeDialogue.vue');
    // Failure transport only: speaker/portrait identity, dimensions and alt still
    // come from the real public Game projection and production manifest.
    ControlledDialogue = await createSfcHarness({ baseURL: import.meta.url, stubs: {
        '../ui/portraits': { resolveNarrativePortrait: (id: string | null) => ({ ...resolveNarrativePortrait(id), url: id ? `/controlled/${id}.png` : null }) },
    } }).load('../ui/NarrativeDialogue.vue');
});
afterEach(() => { unmountAll(); vi.restoreAllMocks(); });

describe('N2-UI actual public Game projection into compiled SFC (no browser-layout claim)', () => {
    for (const row of N2_CASES) {
        it(`${row.npc}: renders the real nine-node story, filtered choices, both exclusive journals, identity and alt`, async () => {
            const { game } = startDiagnostic({ npcs: [row.npc, row.clueNpc] });
            open(game, row.npc);
            const model = shallowRef(readNarrativeUiView(game)!), page = ref<'dialogue' | 'journal' | 'portrait'>('dialogue');
            const root = mount(Dialogue, () => ({ model: model.value, page: page.value }));
            const refresh = async () => { model.value = readNarrativeUiView(game)!; await nextTick(); };
            const check = async (node: string) => {
                await refresh();
                expect(model.value.active?.nodeId).toBe(node);
                expect(text(byTestId(root, 'narrative-body'))).toBe(translate(model.value.active!.textKey));
                expect(all(root).find(n => n.type === 'h2')?.text).toBe(row.name);
                for (const choice of model.value.active!.choices) {
                    const button = byAction(root, `choice:${choice.id}`)!;
                    expect(button).toBeDefined(); expect(text(button)).toContain(translate(choice.textKey));
                    expect(button.props.disabled).toBe(!choice.enabled);
                    if (!choice.enabled && choice.unavailableKey) expect(text(button)).toContain(translate(choice.unavailableKey));
                }
                expect(all(root).filter(n => n.props['data-narrative-choice']).map(n => n.props['data-narrative-choice']))
                    .toEqual(model.value.active!.choices.map(choice => choice.id));
                const portrait = byTestId(root, 'narrative-portrait');
                expect(portrait.props['data-portrait-id']).toBe(`${row.npc}.neutral`);
                const expectedAlt = `${row.name}像素立绘`, images = all(root).filter(n => n.type === 'img');
                for (const img of images) expect(img.props).toMatchObject({ alt: expectedAlt, width: 48, height: 64 });
                const fallback = all(portrait).find(n => n.props.role === 'img');
                if (fallback) expect(fallback.props['aria-label']).toBe(expectedAlt);
                // No future entry or recruitment/reward internals cross the DTO.
                expect(text(root)).not.toMatch(/reward\.receipt|recruitable|eligibleVerdicts|5D3/);
            };
            await check('hello');
            expect(byAction(root, 'choice:recall-a')).toBeUndefined(); expect(byAction(root, 'choice:recall-b')).toBeUndefined();
            for (const ending of ['a', 'b'] as const) expect(text(root)).not.toContain(translate(`ext.narrative.n2.${row.npc}.journal.${row[ending]}.body`));
            choose(game, 'ask'); await check('account');
            expect(byAction(root, 'choice:clue')!.props.disabled).toBe(true);
            expect(text(byAction(root, 'choice:clue')!)).toContain(translate(`ext.narrative.n2.${row.npc}.clueLocked`));
            expect(text(root)).not.toContain(translate(`ext.narrative.n2.${row.npc}.text.clue`));
            choose(game, 'detail'); await check('detail'); choose(game, 'back-detail'); choose(game, 'leave-account');
            unlockClue(game, row); open(game, row.npc); choose(game, 'ask'); choose(game, 'clue'); await check('clue');
            choose(game, 'back-clue'); choose(game, 'leave-account');
            const unresolved = clone(game.toSaveSnapshot());
            for (const ending of ['a', 'b'] as const) {
                expect(game.loadSnapshot(clone(unresolved))).toBe(true); game.animationEnabled = false;
                open(game, row.npc); choose(game, 'ask'); choose(game, 'consider'); await check('decision');
                choose(game, `choose-${ending}`); await check(ending);
                const other = ending === 'a' ? 'b' : 'a';
                const published = all(root).filter(n => n.props['data-narrative-journal']);
                expect(published.map(n => n.props['data-narrative-journal'])).toEqual(model.value.journal.map(entry => entry.entryId));
                expect(text(root)).toContain(translate(`ext.narrative.n2.${row.npc}.journal.${row[ending]}.title`));
                expect(text(root)).toContain(translate(`ext.narrative.n2.${row.npc}.journal.${row[ending]}.body`));
                expect(text(root)).not.toContain(translate(`ext.narrative.n2.${row.npc}.journal.${row[other]}.body`));
                const before = observed(game), body = byTestId(root, 'narrative-body'), journal = byTestId(root, 'narrative-journal-body');
                body.scrollTop = 121; journal.scrollTop = 73;
                for (let iteration = 0; iteration < 3; iteration++) {
                    for (const next of ['journal', 'portrait', 'dialogue'] as const) {
                        page.value = next; await refresh();
                        for (const img of all(root).filter(n => n.type === 'img')) imageEvent(img, 'onLoad');
                        await nextTick();
                    }
                }
                expect(byTestId(root, 'narrative-body')).toBe(body); expect(body.scrollTop).toBe(121);
                expect(byTestId(root, 'narrative-journal-body')).toBe(journal); expect(journal.scrollTop).toBe(73);
                expect(observed(game)).toEqual(before);
                choose(game, `leave-${ending}`); open(game, row.npc); choose(game, `recall-${ending}`); await check(`recall-${ending}`);
                choose(game, `leave-recall-${ending}`);
            }
        }, 60000);
    }

    it('keeps real conversations usable during delayed/failed images and ignores removed URL events', async () => {
        const { game } = startDiagnostic({ npcs: ['cord.mender', 'letter.carrier'] });
        open(game, 'cord.mender');
        const model = shallowRef(readNarrativeUiView(game)!), root = mount(ControlledDialogue, () => ({ model: model.value }));
        const old = all(root).find(n => n.type === 'img')!;
        const beforeLoad = observed(game);
        expect(byTestId(root, 'narrative-portrait').props['data-portrait-fallback']).toBe(true);
        await nextTick(); expect(observed(game)).toEqual(beforeLoad);
        choose(game, 'leave-hello'); open(game, 'letter.carrier'); model.value = readNarrativeUiView(game)!; await nextTick();
        const before = observed(game);
        imageEvent(old, 'onLoad'); imageEvent(old, 'onError'); await nextTick();
        const current = all(root).find(n => n.type === 'img')!;
        expect(current.props.src).toBe('/controlled/letter.carrier.neutral.png');
        expect(byTestId(root, 'narrative-portrait').props['data-portrait-fallback']).toBe(true);
        imageEvent(current, 'onLoad'); await nextTick();
        expect(byTestId(root, 'narrative-portrait').props['data-portrait-fallback']).toBe(false);
        imageEvent(old, 'onError'); await nextTick();
        expect(byTestId(root, 'narrative-portrait').props['data-portrait-fallback']).toBe(false);
        imageEvent(current, 'onError'); await nextTick();
        expect(byTestId(root, 'narrative-portrait').props['data-portrait-fallback']).toBe(true);
        expect(text(byTestId(root, 'narrative-portrait'))).toContain('函');
        expect(byAction(root, 'choice:ask')!.props.disabled).toBe(false);
        expect(observed(game)).toEqual(before);
        choose(game, 'ask'); choose(game, 'leave-account'); expect(narrative(game).active).toBeNull();
    }, 30000);

    it('uses a real shared-host token for double activation, display pages, close and replay read-only projection', async () => {
        const { game } = startDiagnostic({ npcs: ['letter.carrier'] }), dialogs = new DialogService(), scope = effectScope();
        const host: ModuleUiHost = { dialogs, game: () => game, tick: ref(0), immersive: ref(false), canOpenPanel: () => true, beforeOpenPanel: () => {}, afterClosePanel: () => {} };
        const ui = scope.run(() => useNarrativeUi(host))!;
        try {
            const bar = ui.bar.value!.props, target = readNarrativeUiView(game)!.nearby[0]!.targetEntityId;
            (bar.onOpen as (id: number) => void)(target); await nextTick();
            const openingEvents = game.recordedInputEvents.length;
            (bar.onOpen as (id: number) => void)(target); expect(game.recordedInputEvents).toHaveLength(openingEvents);
            const token = dialogs.current!.token;
            expect(dialogs.answer(token, 'choice:ask')).toBe(true);
            expect(dialogs.answer(token, 'choice:ask')).toBe(false); await nextTick();
            expect(game.recordedInputEvents).toHaveLength(openingEvents + 1);
            const before = observed(game);
            for (const action of ['journal', 'back', 'portrait', 'back'] as const) expect(dialogs.answer(dialogs.current!.token, action)).toBe(true);
            expect(observed(game)).toEqual(before);
            expect(dialogs.answer(dialogs.current!.token, 'close')).toBe(true); await nextTick();
            expect(narrative(game).active).toBeNull(); expect(game.interactionActive).toBe(false);
            const recording = clone(game.exportRecording());
            expect(game.loadReplay(recording)).toBe(true); game.animationEnabled = false; game.replaySeek(1); ui.refresh();
            const model = readNarrativeUiView(game)!;
            expect(model.readOnly).toBe(true); expect(model.active?.speakerNameKey).toBe('ext.narrative.n2.letter.carrier.name');
            expect(dialogs.queueLength).toBe(0); expect(buildNarrativeUiCommand(game, model, 'choose', 'ask')).toBeNull();
            const root = mount(Dialogue, () => ({ model }));
            expect(byAction(root, 'view-close')).toBeDefined(); expect(byAction(root, 'choice:ask')!.props.disabled).toBe(true);
            for (const index of [recording.events.length, 0, 2, 1, recording.events.length]) {
                game.replaySeek(index); ui.refresh(); expect(game.replayError).toBeNull(); expect(dialogs.queueLength).toBe(0);
                expect(readNarrativeUiView(game)!.journal).toEqual([]);
            }
        } finally { scope.stop(); dialogs.dispose(); }
    }, 30000);

    it('keeps the exact pixel scaling CSS contract without claiming browser geometry', () => {
        const portrait = readFileSync(new URL('../ui/NarrativePortrait.vue', import.meta.url), 'utf8');
        const dialogue = readFileSync(new URL('../ui/NarrativeDialogue.vue', import.meta.url), 'utf8');
        expect(portrait).toContain('image-rendering:crisp-edges;image-rendering:pixelated');
        expect(portrait).toContain('background:var(--bg-deep,#11130f)'); expect(portrait).not.toMatch(/gradient\(/);
        expect(dialogue).toContain('max-width:384px'); expect(dialogue).not.toContain('max-width:420px');
        for (const geometry of ['width:240px;height:320px', 'width:72px;height:96px', 'width:48px;height:64px', 'min-height:44px']) expect(dialogue).toContain(geometry);
    });
});
