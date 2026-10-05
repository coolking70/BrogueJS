import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import '../../../../i18n';
import locale from '../locales/zh_CN.json';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import { targetingState } from '../../../../ui/targeting';
import type { BossHudModel } from '../ui/view';

interface Node { type: string; text: string; props: Record<string, unknown>; children: Node[]; parent: Node | null; clientWidth: number }
const node = (type = '', text = '', width = 320): Node => ({ type, text, props: {}, children: [], parent: null, clientWidth: width });
const renderer = Vue.createRenderer<Node, Node>({
    createElement: type => node(type), createText: text => node('text', text), createComment: () => node('comment'),
    insert(child, parent, anchor) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); const index = anchor ? parent.children.indexOf(anchor) : -1;
        parent.children.splice(index < 0 ? parent.children.length : index, 0, child); child.parent = parent; },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
    setText: (n, text) => { n.text = text; }, setElementText: (n, text) => { n.text = text; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp: (n, key, _old, value) => { n.props[key] = value; }
});
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const text = (n: Node): string => n.text + n.children.map(text).join('');
const apps: ReturnType<typeof renderer.createApp>[] = [];
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.unstubAllGlobals(); targetingState.aim = null; });

// Client render functions at both phone host sizes. This host has no CSS
// layout engine; real-browser overlap/screenshots are a separate acceptance.
describe('4c public zone client SFC rendering', () => {
    it.each([320, 390])('boss HUD renders frozen HP, break/weakpoint text and presentation hiding at host width %i', async width => {
        vi.stubGlobal('window', { innerWidth: width, innerHeight: 844 });
        i18next.addResourceBundle(i18next.language, 'translation', locale, true, true);
        const model = Vue.ref<BossHudModel>({ id: 1, name: '棘脊爬兽', hp: 150, maxHp: 150, color: '#fff', zone: {
            id: 'shell', name: '棘甲', cells: [{ x: 1, y: 1 }], hp: 30, maxHp: 30, broken: false, weak: false } });
        const hidden = Vue.ref(false), harness = createSfcHarness({ baseURL: import.meta.url });
        const component = await harness.load('../ui/BossHud.vue'), root = node('root', '', width);
        const app = renderer.createApp({ render: () => Vue.h(component, { model: model.value, presentationHidden: hidden.value }) });
        app.use(I18NextVue, { i18next }); apps.push(app); app.mount(root); await Vue.nextTick();
        expect(text(root)).toContain('棘甲 30 / 30');
        model.value = { ...model.value, hp: 120, zone: { ...model.value.zone!, hp: 0, broken: true } }; await Vue.nextTick();
        expect(text(root)).toContain('棘甲 0 / 30 已破坏');
        model.value = { ...model.value, zone: { ...model.value.zone!, id: 'head', name: '头部', hp: 120, maxHp: 150, broken: false, weak: true } }; await Vue.nextTick();
        expect(text(root)).toContain('头部 120 / 150 弱点');
        hidden.value = true; await Vue.nextTick(); expect(all(root).some(n => String(n.props.class).includes('presentation-hidden'))).toBe(true);
        model.value = { ...model.value, zone: undefined }; await Vue.nextTick(); expect(all(root).some(n => n.props.class === 'boss-zone')).toBe(false);
    });
    it.each([320, 390])('target bar removes destroyed selection and disables confirmation at host width %i', async width => {
        const hud = { targeting: Vue.ref('throw'), targetName: Vue.ref('飞镖'), targetZone: Vue.ref('棘甲 30 / 30'), targetAim: Vue.ref<{x:number;y:number} | null>({ x: 1, y: 1 }) };
        const dispatch = vi.fn(), travelTo = vi.fn(); targetingState.aim = { x: 1, y: 1 };
        const harness = createSfcHarness({ baseURL: import.meta.url, stubs: {
            '../../../../ui/useGameHud': { useGameHud: () => hud }, '../../../../ui/commands': { dispatch, travelTo }
        } });
        const component = await harness.load('../../../../components/TargetBar.vue'), root = node('root', '', width), app = renderer.createApp(component);
        app.use(I18NextVue, { i18next }); apps.push(app); app.mount(root); await Vue.nextTick();
        expect(text(root)).toContain('棘甲 30 / 30');
        const confirm = () => all(root).find(n => n.type === 'button' && String(n.props.class).includes('primary'))!;
        expect(confirm().props.disabled).toBe(false);
        hud.targetZone.value = ''; hud.targetAim.value = null; await Vue.nextTick();
        expect(all(root).some(n => n.props.class === 'target-zone')).toBe(false); expect(confirm().props.disabled).toBe(true);
        expect(dispatch).not.toHaveBeenCalled(); expect(travelTo).not.toHaveBeenCalled();
    });
});
