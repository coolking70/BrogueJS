import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createRenderer, h, nextTick, ref, type App, type Component } from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { readFileSync } from 'node:fs';
import { compileStyle, parse } from '@vue/compiler-sfc';
import postcss, { type AnyNode } from 'postcss';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import { rng } from '../../../../engine/Random';
import type { NarrativeUiView } from '../ui/view';
import { createNarrativePortraitResolver, narrativePortraitDisplayVersion, resolveNarrativePortrait, type NarrativePortraitView } from '../ui/portraits';
import manifest from '../data/portraits.json';
import locale from '../locales/zh_CN.json';

interface Node {
    type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null;
    style: Record<string | symbol, any>; scrollTop: number;
}
const node = (type: string, text = ''): Node => ({ type, text, props: {}, children: [], parent: null, style: {}, scrollTop: 0 });
const renderer = createRenderer<Node, Node>({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    insert(child, parent, anchor) {
        if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = parent;
        const index = anchor ? parent.children.indexOf(anchor) : -1;
        parent.children.splice(index < 0 ? parent.children.length : index, 0, child);
    },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
    setText(n, text) { n.text = text; }, setElementText(n, text) { n.text = text; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp(n, key, _old, value) { n.props[key] = value; },
});
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const text = (n: Node): string => n.text + n.children.map(text).join('');
const byTestId = (root: Node, id: string): Node => all(root).find(n => n.props['data-testid'] === id)!;
const byAction = (root: Node, action: string): Node => all(root).find(n => n.props['data-dialog-action'] === action)!;
let Dialogue: Component, Portrait: Component;
const mounted: App[] = [];
function mount(component: Component, props: () => Record<string, unknown>) {
    const root = node('root'), app = renderer.createApp({ render: () => h(component, props()) });
    app.use(I18NextVue, { i18next }); app.mount(root); mounted.push(app);
    return root;
}
function model(readOnly = false): NarrativeUiView {
    return { session: {}, revision: 3, readOnly, nearby: [], journal: [{ entryId: 'note', order: 1,
        titleKey: 'ext.narrative.journal.note.title', textKey: 'ext.narrative.journal.note.body' }],
        active: { sessionId: 7, targetEntityId: 21, nodeId: 'hello', speakerNameKey: 'ext.narrative.npc.keeper.name',
            textKey: 'ext.narrative.dialogue.keeper.hello', portraitId: 'archive.keeper.neutral', transitionLimitReached: false,
            choices: [{ id: 'read-note', textKey: 'ext.narrative.choice.read', enabled: true, unavailableKey: null },
                { id: 'leave', textKey: 'ext.narrative.choice.leave', enabled: false, unavailableKey: 'ext.narrative.choice.already_read' }] } };
}
beforeAll(async () => {
    await i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: locale } }, initImmediate: false });
    const harness = createSfcHarness({ baseURL: import.meta.url });
    Dialogue = await harness.load('../ui/NarrativeDialogue.vue');
    Portrait = await harness.load('../ui/NarrativePortrait.vue');
});
afterEach(() => { for (const app of mounted.splice(0)) app.unmount(); });

describe('EXT-2d pure portrait presentation', () => {
    it('uses the validated display manifest separately from simulation identity and resolves local placeholders', () => {
        const before = rng.getState();
        const portrait = resolveNarrativePortrait('archive.keeper.neutral');
        expect(narrativePortraitDisplayVersion).toBe('1.0.0');
        expect(portrait).toMatchObject({ id: 'archive.keeper.neutral', url: null, fallbackGlyph: '人', width: 240, height: 320 });
        expect(Object.isFrozen(portrait)).toBe(true);
        expect(resolveNarrativePortrait('unknown')).toBe(resolveNarrativePortrait(null));
        expect(rng.getState()).toEqual(before);
    });
    it('shows the placeholder while loading and only the matching load event reveals the image', async () => {
        const portrait = ref({ ...resolveNarrativePortrait('archive.keeper.neutral'), url: '/assets/a.webp' });
        const root = mount(Portrait, () => ({ portrait: portrait.value }));
        const before = rng.getState();
        const first = all(root).find(n => n.type === 'img')!;
        expect(byTestId(root, 'narrative-portrait').props['data-portrait-fallback']).toBe(true);
        portrait.value = { ...portrait.value, url: '/assets/b.webp' }; await nextTick();
        first.props.onLoad(); await nextTick();
        expect(byTestId(root, 'narrative-portrait').props['data-portrait-fallback']).toBe(true);
        all(root).find(n => n.type === 'img')!.props.onLoad(); await nextTick();
        expect(byTestId(root, 'narrative-portrait').props['data-portrait-fallback']).toBe(false);
        expect(rng.getState()).toEqual(before);
    });
    it('resolves only finite local assets and preserves missing-file fallback without weakening manifest validation', () => {
        const data = structuredClone(manifest); data.portraits[0]!.asset = 'keeper/neutral.webp' as any;
        const path = '../assets/portraits/keeper/neutral.webp';
        const available = createNarrativePortraitResolver(data, { [path]: '/assets/neutral-hash.webp' });
        expect(available.resolve('archive.keeper.neutral').url).toBe('/assets/neutral-hash.webp');
        expect(createNarrativePortraitResolver(data, { '../assets/elsewhere/neutral.webp': '/wrong.webp' }).resolve('archive.keeper.neutral').url).toBeNull();
        expect(Object.isFrozen(available.manifest)).toBe(true);
        for (const invalid of ['https://example.test/keeper.png', '../keeper.png', '/keeper.png', 'data:image/png;base64,a', 'keeper.svg']) {
            data.portraits[0]!.asset = invalid as any;
            expect(() => createNarrativePortraitResolver(data, {}), invalid).toThrow();
        }
        data.portraits[0]!.asset = null;
        data.portraits[0]!.width = 8193;
        expect(() => createNarrativePortraitResolver(data, {})).toThrow();
    });
    it('keeps an image error local, falls back, and ignores a late previous-image error', async () => {
        const before = rng.getState();
        const portrait = ref<NarrativePortraitView>({ ...resolveNarrativePortrait('archive.keeper.neutral'), url: '/assets/a.webp' });
        const root = mount(Portrait, () => ({ portrait: portrait.value }));
        const oldImage = all(root).find(n => n.type === 'img')!;
        expect(oldImage.props).toMatchObject({ src: '/assets/a.webp', width: 240, height: 320, draggable: 'false' });
        expect(oldImage.props.alt).toBe(locale['ext.narrative.portrait.keeper']);
        portrait.value = { ...portrait.value, url: '/assets/b.png' }; await nextTick();
        oldImage.props.onError(); await nextTick();
        const currentImage = all(root).find(n => n.type === 'img')!;
        expect(currentImage.props.src).toBe('/assets/b.png');
        currentImage.props.onError(); await nextTick();
        expect(all(root).some(n => n.type === 'img')).toBe(false);
        expect(byTestId(root, 'narrative-portrait').props['data-portrait-fallback']).toBe(true);
        expect(text(root)).toContain('人');
        expect(rng.getState()).toEqual(before);
    });
});

describe('EXT-2d pure shared-host dialogue content', () => {
    it('renders only its projected text, known reasons and semantic actions with no private command handlers', () => {
        const input = model(), before = JSON.stringify(input), random = rng.getState();
        const root = mount(Dialogue, () => ({ model: input }));
        expect(text(byTestId(root, 'narrative-body'))).toBe(locale['ext.narrative.dialogue.keeper.hello']);
        expect(text(root)).toContain(locale['ext.narrative.choice.already_read']);
        expect(byAction(root, 'choice:read-note').props.disabled).toBe(false);
        expect(byAction(root, 'choice:leave').props.disabled).toBe(true);
        expect(byAction(root, 'close').props.disabled).toBe(false);
        expect(byAction(root, 'journal')).toBeDefined();
        expect(byAction(root, 'portrait')).toBeDefined();
        expect(all(root).some(n => n.props.role === 'dialog' || n.props.role === 'alertdialog')).toBe(false);
        expect(all(root).filter(n => n.type === 'button').every(n => !n.props.onClick && !n.props.onKeydown)).toBe(true);
        expect(JSON.stringify(input)).toBe(before); expect(rng.getState()).toEqual(random);
    });
    it('keeps dialogue and journal scroll positions while switching the same modal subpage', async () => {
        const page = ref<'dialogue' | 'journal' | 'portrait'>('dialogue');
        const root = mount(Dialogue, () => ({ model: model(), page: page.value }));
        const body = byTestId(root, 'narrative-body'), journal = byTestId(root, 'narrative-journal-body');
        body.scrollTop = 135; journal.scrollTop = 87;
        page.value = 'journal'; await nextTick();
        expect(byTestId(root, 'narrative-dialogue-page').style.display).toBe('none');
        expect(byTestId(root, 'narrative-journal-page').style.display).not.toBe('none');
        expect(text(journal)).toContain(locale['ext.narrative.journal.note.body']);
        expect(byAction(root, 'back')).toBeDefined();
        page.value = 'portrait'; await nextTick();
        expect(byTestId(root, 'narrative-portrait-page').style.display).not.toBe('none');
        page.value = 'dialogue'; await nextTick();
        expect(byTestId(root, 'narrative-body')).toBe(body);
        expect(byTestId(root, 'narrative-journal-body')).toBe(journal);
        expect(body.scrollTop).toBe(135); expect(journal.scrollTop).toBe(87);
    });
    it('starts a changed dialogue node at the top while subpage navigation keeps the old body', async () => {
        const current = ref(model());
        const root = mount(Dialogue, () => ({ model: current.value }));
        const old = byTestId(root, 'narrative-body'); old.scrollTop = 135;
        current.value = { ...current.value, active: { ...current.value.active!, nodeId: 'next' } };
        await nextTick();
        expect(byTestId(root, 'narrative-body')).not.toBe(old);
        expect(byTestId(root, 'narrative-body').scrollTop).toBe(0);
    });
    it('disables mutations during submission and offers a display-only close in replay or ended views', async () => {
        const view = ref(model()), submitting = ref(true);
        const root = mount(Dialogue, () => ({ model: view.value, submitting: submitting.value }));
        expect(byAction(root, 'choice:read-note').props.disabled).toBe(true);
        expect(byAction(root, 'close').props.disabled).toBe(true);
        view.value = model(true); submitting.value = false; await nextTick();
        expect(byAction(root, 'choice:read-note').props.disabled).toBe(true);
        expect(byAction(root, 'close')).toBeUndefined();
        expect(byAction(root, 'view-close').props.disabled).toBeUndefined();
        expect(text(byTestId(root, 'narrative-read-only'))).toBe(locale['ext.narrative.ui.read_only']);
    });
    it('bounds long speaker captions and lets the mobile row grow when its text wraps', async () => {
        // Compile the real scoped styles and inspect their width-dependent cascade.
        // The custom DOM renderer has no layout engine: these are CSS/DOM contract
        // assertions, with actual clipping and pixel bounds verified in browser QA.
        const source = readFileSync(new URL('../ui/NarrativeDialogue.vue', import.meta.url), 'utf8');
        const style = parse(source).descriptor.styles[0]!;
        const id = 'data-v-narrative-caption-regression';
        const compiled = compileStyle({ source: style.content, filename: 'NarrativeDialogue.vue', id, scoped: true });
        expect(compiled.errors).toEqual([]);
        const css = postcss.parse(compiled.code);
        const declarations = (selector: string, width: number, height: number) => {
            const values: Record<string, string> = {};
            css.walkRules(rule => {
                if (!rule.selectors.includes(`${selector}[${id}]`)) return;
                for (let parent: AnyNode | undefined = rule.parent; parent; parent = parent.parent) {
                    if (parent.type !== 'atrule') continue;
                    if (parent.name !== 'media') continue;
                    const max = /^\(max-(width|height):\s*(\d+)px\)$/.exec(parent.params);
                    if (!max) throw new Error(`Unhandled media condition: ${parent.params}`);
                    if ((max[1] === 'width' ? width : height) > Number(max[2])) return;
                }
                rule.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
            });
            return values;
        };
        for (const width of [1440, 390, 320]) {
            const caption = declarations('.narrative-caption', width, 844);
            expect(caption).toMatchObject({ 'min-width': '0', 'max-width': '100%', 'overflow-wrap': 'anywhere' });
            if (width > 700) continue;
            // Zero basis assigns only the row's remaining width to the caption;
            // stretched children inherit that finite width and can wrap normally.
            expect(caption).toMatchObject({ flex: '1 1 0', 'align-items': 'stretch' });
            const speaker = declarations('.narrative-speaker', width, 844);
            expect(speaker).toMatchObject({ flex: '0 0 auto', 'min-height': width === 320 ? '64px' : '96px' });
            expect(speaker['flex-basis']).toBeUndefined();
            expect(speaker.height).toBeUndefined();
        }
        const longName = 'The Keeper of the Forgotten Northern Archives';
        const input = model();
        i18next.addResourceBundle('en', 'translation', { ...locale, [input.active!.speakerNameKey]: longName });
        await i18next.changeLanguage('en');
        try {
            const root = mount(Dialogue, () => ({ model: input }));
            const caption = all(root).find(n => n.props.class === 'narrative-caption')!;
            expect(caption.parent?.props.class).toBe('narrative-speaker');
            expect(caption.children.find(n => n.type === 'strong')?.text).toBe(longName);
            expect(caption.children.find(n => n.type === 'span')?.text).toBe(locale['ext.narrative.ui.portrait_open']);
        } finally {
            await i18next.changeLanguage('zh_CN');
            i18next.removeResourceBundle('en', 'translation');
        }
    });
    it('uses bounded responsive geometry and isolated body/choice scrollers without an independent overlay', () => {
        const source = readFileSync(new URL('../ui/NarrativeDialogue.vue', import.meta.url), 'utf8');
        expect(source).not.toMatch(/Teleport|activeGame|executeCommand|addEventListener/);
        expect(source).toContain('grid-template-columns:240px minmax(0,1fr)');
        expect(source).toContain('max-width:920px');
        expect(source).toContain('width:72px;height:96px');
        expect(source).toContain('width:48px;height:64px');
        expect(source).toContain('min-height:44px');
        expect(source).toContain('overscroll-behavior:contain');
        expect(source).toContain('white-space:pre-wrap');
        const portraits = readFileSync(new URL('../ui/portraits.ts', import.meta.url), 'utf8');
        expect(portraits).toContain("import.meta.glob<string>('../assets/portraits/**/*.{png,webp}'");
        expect(portraits).not.toMatch(/fetch\(|Game|\.\/definitions/);
    });
});
