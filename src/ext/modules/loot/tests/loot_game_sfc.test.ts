import '../../../../i18n';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { useLootUi } from '../gameSession';
import { timeSystem } from '../../../../engine/Systems/Time';
type N = { tag: string; text: string; props: Record<string, any>; children: N[]; parent: N | null;
  readonly tagName: string; readonly options: N[]; addEventListener(): void; removeEventListener(): void };
const node = (tag = '', text = ''): N => ({ tag, text, props: {}, children: [], parent: null,
  get tagName() { return tag.toUpperCase(); }, get options() { return this.children.filter(n => n.tag === 'option'); },
  addEventListener() {}, removeEventListener() {} });
const body = node('body');
const all = (n: N): N[] => [n, ...n.children.flatMap(all)];
const text = (n: N): string => n.text + n.children.map(text).join('');
const renderer = Vue.createRenderer<N, N>({
  createElement: tag => node(tag), createText: t => node('', t), createComment: () => node(),
  insert(child, parent, anchor) {
    child.parent?.children.splice(child.parent.children.indexOf(child), 1);
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child); child.parent = parent;
  },
  remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
  setText(n, t) { n.text = t; }, setElementText(n, t) { n.text = t; n.children = []; },
  parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  patchProp(n, k, _old, value) { n.props[k] = value; if (['value', 'type', 'multiple'].includes(k)) Reflect.set(n, k, value); }, querySelector: () => body
});

let Panel:Vue.Component;
beforeAll(async()=>{vi.stubGlobal('document',{activeElement:null,addEventListener(){},removeEventListener(){},querySelector(){return null;}});Panel=await createSfcHarness({baseURL:import.meta.url}).load('../ui/game/LootGamePanel.vue');});
afterAll(()=>vi.unstubAllGlobals());
it('real mounted game shell opens native comparison and applies one filter command, preserving a draft across polling',async()=>{
 const h=createWorldHarness({seed:42,mode:'easy',modules:['loot']}),g=worldHarnessGame(h),scope=Vue.effectScope();
 const session=scope.run(()=>useLootUi({game:()=>g,tick:Vue.ref(0),immersive:Vue.ref(false),canOpenPanel:()=>true,beforeOpenPanel(){},afterClosePanel(){}}))!;
 session.commands.value[0]!.invoke();const root=node();const app=renderer.createApp({setup:()=>()=>session.panel.value?Vue.h(Panel,session.panel.value.props):null});app.use(I18NextVue,{i18next});app.mount(root);
 const click=async(label:string)=>{const b=all(body).find(n=>n.tag==='button'&&text(n).includes(label));expect(b,label).toBeDefined();expect(b!.props.disabled).not.toBe(true);b!.props.onClick?.({target:b,currentTarget:b,preventDefault(){},stopPropagation(){}});await Vue.nextTick();};
 try{
  await click('匕首');await click('比较');expect(text(body)).toContain('伤害');await click('自动拾取过滤');
  await click('稀有');session.refresh();await Vue.nextTick();const form=all(body).find(n=>n.tag==='form')!;
  const tick=timeSystem.currentTick,count=g.recordedInputEvents.length;form.props.onSubmit({preventDefault(){},stopPropagation(){}});await Vue.nextTick();
  expect(g.recordedInputEvents).toHaveLength(count+1);expect(timeSystem.currentTick).toBe(tick);expect(text(body)).toContain('操作已完成');
  expect((session.panel.value!.props.view as {filter:{minRarity:string}}).filter.minRarity).toBe('rare');
 }finally{app.unmount();scope.stop();h.dispose();body.children=[];}
});
it('R1-F2 mounted ring buttons fill only the actual empty slot and replace either full slot',async()=>{
 const {assembleNativeTemplate}=await import('../../../../engine/Items/FixedItemAssembly');
 const {nativeStat}=await import('../../../../engine/Stats/NativeStatSources');
 const h=createWorldHarness({seed:42,mode:'easy',modules:['loot']}),g=worldHarnessGame(h),scope=Vue.effectScope();
 const ring=()=>{const i=assembleNativeTemplate('ring_of_regeneration');i.enchantment=2;g.player.inventory.addItem(i);return i;};
 const left=ring(),right=ring(),replacement=ring();g.player.equip(left);
 const session=scope.run(()=>useLootUi({game:()=>g,tick:Vue.ref(0),immersive:Vue.ref(false),canOpenPanel:()=>true,beforeOpenPanel(){},afterClosePanel(){},beforeOpenItemPanel:()=>true}))!;
 session.itemActions!(right.id)[0]!.invoke();
 const app=renderer.createApp({setup:()=>()=>session.panel.value?Vue.h(Panel,session.panel.value.props):null});app.use(I18NextVue,{i18next});app.mount(node());
 const button=(label:string)=>all(body).find(n=>n.tag==='button'&&text(n)===label);
 const click=async(label:string)=>{const b=button(label);expect(b,label).toBeDefined();expect(b!.props.disabled).not.toBe(true);b!.props.onClick({preventDefault(){},stopPropagation(){}});await Vue.nextTick();};
 try{
  expect(button('替换左戒')).toBeUndefined();expect(button('替换右戒')).toBeUndefined();expect(button('佩戴到左戒槽')).toBeUndefined();
  await click('佩戴到右戒槽');expect(g.player.ringLeft?.id).toBe(left.id);expect(g.player.ringRight?.id).toBe(right.id);expect(nativeStat(g.player,'native.regeneration-bonus')).toBe(4);
  session.close();session.itemActions!(replacement.id)[0]!.invoke();await Vue.nextTick();
  expect(button('替换左戒')).toBeDefined();expect(button('替换右戒')).toBeDefined();expect(button('佩戴到右戒槽')).toBeUndefined();
  await click('替换左戒');expect(g.player.ringLeft?.id).toBe(replacement.id);expect(g.player.ringRight?.id).toBe(right.id);expect(nativeStat(g.player,'native.regeneration-bonus')).toBe(4);
  expect(button('替换左戒')).toBeUndefined();expect(button('替换右戒')).toBeUndefined();
 }finally{app.unmount();scope.stop();h.dispose();body.children=[];}
});
