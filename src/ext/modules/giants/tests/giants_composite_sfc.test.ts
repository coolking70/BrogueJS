import { afterEach, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import i18next from 'i18next';
import '../../../../i18n';
import locale from '../locales/zh_CN.json';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
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
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); vi.unstubAllGlobals(); });

// Client render hosts only, without a browser CSS layout/real touch engine.
it.each([320,390])('body HUD renders core HP, complete/partial member knowledge and ACK hiding at host width %i', async width => {
  vi.stubGlobal('window',{innerWidth:width,innerHeight:844});
  i18next.addResourceBundle(i18next.language,'translation',locale,true,true);
  const model=Vue.ref<BossHudModel>({id:1,name:'页岩织兽',hp:96,maxHp:96,color:'#fff',members:{alive:8,broken:0}});
  const hidden=Vue.ref(false),harness=createSfcHarness({baseURL:import.meta.url});
  const component=await harness.load('../ui/BossHud.vue'),root=node('root','',width);
  const app=renderer.createApp({render:()=>Vue.h(component,{model:model.value,presentationHidden:hidden.value})});apps.push(app);app.mount(root);await Vue.nextTick();
  expect(text(root)).toContain('96 / 96');expect(text(root)).toContain('8 存活 / 0 折断');
  model.value={...model.value,hp:93,members:{alive:7,broken:1}};await Vue.nextTick();expect(text(root)).toContain('93 / 96');expect(text(root)).toContain('7 存活 / 1 折断');
  model.value={...model.value,members:{alive:2}};await Vue.nextTick();expect(text(root)).toContain('可见外围：2');expect(text(root)).not.toContain('折断');
  hidden.value=true;await Vue.nextTick();expect(all(root).some(n=>String(n.props.class).includes('presentation-hidden'))).toBe(true);
});
