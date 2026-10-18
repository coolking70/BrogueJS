import { afterEach, beforeAll, it, expect, vi } from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import '../../../../i18n';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import { Game } from '../../../../engine/Core/Game';
import { logger } from '../../../../engine/Systems/Logger';
import { usePartyUi } from '../ui/usePartyUi';
type N = {
  tag: string;
  text: string;
  props: Record<string, any>;
  children: N[];
  parent: N | null;
  readonly tagName: string;
  readonly options: N[];
  addEventListener(): void;
  removeEventListener(): void;
  focus(): void;
  querySelector(selector: string): N | null;
  querySelectorAll(selector: string): N[];
  matches(selector: string): boolean;
};
const node = (tag = '', text = ''): N =>
  Vue.markRaw<N>({
    tag,
    text,
    props: {},
    children: [],
    parent: null,
    get tagName() {
      return tag.toUpperCase();
    },
    get options() {
      return this.children.filter((n: N) => n.tag === 'option');
    },
    addEventListener() {},
    removeEventListener() {},
    focus() {
      Reflect.set(document, 'activeElement', this);
    },
    matches(selector) {
      return selector === '[data-preset]' ? this.props['data-preset'] !== undefined : false;
    },
    querySelector(selector) {
      const m = /\[data-preset="([^"]+)"\]/.exec(selector);
      return all(this).find((n) => (m ? n.props['data-preset'] === m[1] : false)) ?? null;
    },
    querySelectorAll() {
      return all(this).filter(
        (n) => n.tag === 'button' && !n.props.disabled && n.props.tabindex !== -1
      );
    }
  });
const body = node('body');
const all = (n: N): N[] => [n, ...n.children.flatMap(all)];
const text = (n: N): string => n.text + n.children.map(text).join('');
const renderer = Vue.createRenderer<N, N>({
  createElement: (tag) => node(tag),
  createText: (t) => node('', t),
  createComment: () => node(),
  insert(child, parent, anchor) {
    child.parent?.children.splice(child.parent.children.indexOf(child), 1);
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child);
    child.parent = parent;
  },
  remove(child) {
    child.parent?.children.splice(child.parent.children.indexOf(child), 1);
    child.parent = null;
  },
  setText(n, t) {
    n.text = t;
  },
  setElementText(n, t) {
    n.text = t;
    n.children = [];
  },
  parentNode: (n) => n.parent,
  nextSibling: (n) => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  patchProp(n, k, _old, value) {
    n.props[k] = value;
    if (['value', 'type', 'multiple'].includes(k)) Reflect.set(n, k, value);
  },
  querySelector: () => body
});

let Panel: Vue.Component;
beforeAll(async () => {
  vi.stubGlobal('document', { activeElement: null });
  Panel = await createSfcHarness({ baseURL: import.meta.url }).load(
    '../ui/PartyWindowPanel.vue'
  );
});
afterEach(() => {
  body.children = [];
});
it.each([2, 4])(
  'real %i-member panel plans, previews, submits once, and invalidates stale callbacks',
  async (count) => {
    const g = new Game({ seed: 1 });
    g.startNewGame({
      seed: 42,
      ruleSet: 'extended',
      extensions: ['party'],
      extensionConfigurations: { party: { schema: 1, members: count } },
      initialCommands: [
        JSON.stringify({
          module: 'party',
          action: 'create',
          payload: { schema: 1, members: count }
        })
      ]
    });
    g.animationEnabled = false;
    while (logger.pendingAcknowledgment) logger.acknowledgeNext();
    let current = g;
    const tick = Vue.ref(0),
      ui = usePartyUi({
        game: () => current,
        tick,
        immersive: Vue.ref(false),
        canOpenPanel: () => true,
        beforeOpenPanel() {},
        afterClosePanel() {}
      });
    const app = renderer.createApp({
      render: () => Vue.h(Panel, ui.hud.value!.props.windowProps as any)
    });
    app.use(I18NextVue, { i18next });
    app.mount(body);
    const button = (key: string) =>
      all(body).find((n) => n.tag === 'button' && text(n) === i18next.t(key))!;
    const click = async (n: N) => {
      expect(n).toBeTruthy();
      expect(n.props.disabled).not.toBe(true);
      await n.props.onClick({ preventDefault() {}, stopPropagation() {} });
      await Vue.nextTick();
    };
    try {
      const revision = g.party!.state.revision;
      await click(button('ext.party.plan.wait'));
      expect(g.party!.state.revision).toBe(revision);
      expect(g.partyPlanner()!.drafts.get(g.player.id)).toEqual({
        kind: 'queue',
        actions: [{ kind: 'wait' }]
      });
      await click(button('ext.party.window.preview'));
      expect(all(body).some((n) => n.props['data-party-preview-result'] !== undefined)).toBe(true);
      expect(g.party!.state.revision).toBe(revision);
      const submit = all(body).find((n) => n.props['data-party-advance'] !== undefined)!.props
        .onClick;
      await Promise.all([submit(), submit()]);
      await Vue.nextTick();
      expect(g.party!.state.window.seq).toBe(1);
      expect(g.recordedInputEvents.filter((e) => e.action === 'party:window')).toHaveLength(1);
      const old = ui.hud.value!.props.windowProps as any;
      current = new Game({ seed: 3 });
      old.append('wait');
      expect(g.partyPlanner()!.drafts.size).toBe(0);
      current.disposeRecording();
    } finally {
      app.unmount();
      g.disposeRecording();
      while (logger.pendingAcknowledgment) logger.acknowledgeNext();
    }
  }
);
