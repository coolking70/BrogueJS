import { createRenderer, h, type App, type Component } from 'vue';
import i18next from 'i18next';
import locale from '../locales/zh_CN.json';

const translation = i18next.createInstance();
void translation.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: locale } }, initImmediate: false });

export interface UiNode {
    type: string; text: string; props: Record<string, unknown>; children: UiNode[]; parent: UiNode | null;
    style: Record<string | symbol, unknown>; scrollTop: number;
}
const node = (type: string, text = ''): UiNode => ({ type, text, props: {}, children: [], parent: null, style: {}, scrollTop: 0 });
const renderer = createRenderer<UiNode, UiNode>({
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
const mounted: App[] = [];
export const all = (n: UiNode): UiNode[] => [n, ...n.children.flatMap(all)];
export const text = (n: UiNode): string => n.text + n.children.map(text).join('');
export const byTestId = (root: UiNode, id: string): UiNode => all(root).find(n => n.props['data-testid'] === id)!;
export const byAction = (root: UiNode, action: string): UiNode | undefined => all(root).find(n => n.props['data-dialog-action'] === action);
export function mount(component: Component, props: () => Record<string, unknown>) {
    const root = node('root'), app = renderer.createApp({ render: () => h(component, props()) });
    app.config.globalProperties.$t = translation.t.bind(translation);
    app.mount(root); mounted.push(app);
    return root;
}
export const unmountAll = () => { for (const app of mounted.splice(0)) app.unmount(); };
export function imageEvent(image: UiNode, kind: 'onLoad' | 'onError'): void {
    const callback = image.props[kind];
    if (typeof callback !== 'function') throw new Error(`Missing ${kind} image handler`);
    callback();
}
