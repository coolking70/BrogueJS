import { afterEach, beforeAll, it, expect, vi } from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import '../../../../i18n';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import { Game } from '../../../../engine/Core/Game';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { usePartyUi } from '../ui/usePartyUi';
import { World5Error } from '../../../worldBasics';
type N = {
  tag: string;
  text: string;
  props: Record<string, any>;
  style: Record<string,string>;
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
    style: {},
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
  vi.restoreAllMocks();
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
it('isolates old focus callbacks and maps known travel targets without a command or RNG advance', async () => {
  const g = new Game({seed:1});
  g.startNewGame({seed:42,ruleSet:'extended',extensions:['party']});
  while(logger.pendingAcknowledgment) logger.acknowledgeNext();
  const callbacks: ((at:{x:number;y:number})=>void)[]=[];
  const ui=usePartyUi({game:()=>g,tick:Vue.ref(0),immersive:Vue.ref(false),canOpenPanel:()=>true,beforeOpenPanel(){},afterClosePanel(){},selectMapCells(_owner, select){callbacks.push(select);return ()=>{};}});
  try {
    const old=ui.hud.value!.props as any;
    old.windowProps.pickTravel();
    const second=g.party!.state.members[1]!.actorId;
    old.focus(second);
    const fresh=ui.hud.value!.props as any;
    fresh.windowProps.pickTravel();
    const revision=g.party!.state.revision, prefix=g.recordedInputEvents.length, random=rng.getState();
    old.windowProps.append('wait');
    callbacks[0]!({...g.focusedActor.loc});
    expect(g.partyPlanner()!.drafts.size).toBe(0);
    callbacks[1]!({...g.focusedActor.loc});
    expect(g.partyPlanner()!.drafts.get(second)).toMatchObject({kind:'travel',target:{...g.focusedActor.loc}});
    expect(g.party!.state.revision).toBe(revision);
    expect(g.recordedInputEvents.length).toBe(prefix);
    expect(rng.getState()).toEqual(random);
  } finally {ui.close();g.disposeRecording();while(logger.pendingAcknowledgment)logger.acknowledgeNext();}
});
it('renders complete HUD with member strip, compact advance, drawer editing and actor status',async()=>{
  const Hud=await createSfcHarness({baseURL:import.meta.url}).load('../ui/PartyHud.vue');
  const g=new Game({seed:1});g.startNewGame({seed:42,ruleSet:'extended',extensions:['party']});
  while(logger.pendingAcknowledgment)logger.acknowledgeNext();
  const ui=usePartyUi({game:()=>g,tick:Vue.ref(0),immersive:Vue.ref(false),canOpenPanel:()=>true,beforeOpenPanel(){},afterClosePanel(){}});
  const app=renderer.createApp({render:()=>Vue.h(Hud,ui.hud.value!.props)});app.use(I18NextVue,{i18next});app.mount(body);
  try{
    expect(all(body).filter(n=>n.props['data-party-actor']!==undefined)).toHaveLength(2);
    expect(text(body)).toContain(i18next.t('ext.party.source.initial'));
    expect(all(body).filter(n=>n.props['data-party-advance']!==undefined)).toHaveLength(1);
    await all(body).find(n=>n.props['data-party-drawer-toggle']!==undefined)!.props.onClick();await Vue.nextTick();
    expect(all(body).find(n=>n.props['data-party-editor']!==undefined)!.props.class).toContain('open');
    expect(all(body).some(n=>n.props['data-party-travel']!==undefined)).toBe(true);
    expect(all(body).some(n=>n.props['data-party-ai']!==undefined)).toBe(true);
    await all(body).find(n=>n.props['data-party-drawer-close']!==undefined)!.props.onClick();await Vue.nextTick();
    expect(all(body).find(n=>n.props['data-party-editor']!==undefined)!.props.class).not.toContain('open');
  }finally{app.unmount();ui.close();g.disposeRecording();while(logger.pendingAcknowledgment)logger.acknowledgeNext();}
});
it('roster UI displays authoritative rejection and dispatches only explicit selected candidate/camp',async()=>{
 const Roster=await createSfcHarness({baseURL:import.meta.url}).load('../ui/PartyRosterPanel.vue');
 const join=vi.fn(),station=vi.fn();
 const props=Vue.reactive({settlementAvailable:true,candidates:[{id:42,name:'known rescue',source:'rescue',reason:null},{id:43,name:'known resident',source:'resident',reason:'NO_SPACE'}],camps:[{id:7,name:'known camp'}],focused:18,stationReason:null,join,station});
 const app=renderer.createApp({render:()=>Vue.h(Roster,props)});app.use(I18NextVue,{i18next});app.mount(body);
 try {
  const accepted=all(body).find(n=>n.props['data-party-candidate']===42)!;
  const rejected=all(body).find(n=>n.props['data-party-candidate']===43)!;
  expect(text(rejected)).toContain(i18next.t('ext.party.error.NO_SPACE'));
  expect(all(rejected).find(n=>n.tag==='button')!.props.disabled).toBe(true);
  await all(accepted).find(n=>n.tag==='button')!.props.onClick();expect(join).toHaveBeenCalledExactlyOnceWith(42);
  await all(body).find(n=>n.tag==='button'&&text(n)===i18next.t('ext.party.roster.stationAction'))!.props.onClick();expect(station).toHaveBeenCalledExactlyOnceWith(7);
  props.settlementAvailable=false;await Vue.nextTick();expect(all(body).some(n=>n.tag==='fieldset')).toBe(false);
 } finally {app.unmount();}
});
it.each(['C5_ROOM','C5_INPUT','C5_RESERVED'] as const)('translates %s for resident candidates and command failures without diagnostics',async(code)=>{
 const Roster=await createSfcHarness({baseURL:import.meta.url}).load('../ui/PartyRosterPanel.vue');
 const g=new Game({seed:1});g.startNewGame({seed:42,ruleSet:'extended',extensions:['party']});
 while(logger.pendingAcknowledgment)logger.acknowledgeNext();
 const ui=usePartyUi({game:()=>g,tick:Vue.ref(0),immersive:Vue.ref(false),canOpenPanel:()=>true,beforeOpenPanel(){},afterClosePanel(){}});
 const label=i18next.t('ext.foundation.world.error.'+code.slice(3).toLowerCase());
 expect(label).not.toContain('ext.foundation');
 const props={settlementAvailable:true,candidates:[{id:42,name:'known resident',source:'resident',reason:code}],camps:[{id:7,name:'known camp'}],focused:g.player.id,stationReason:code,join:vi.fn(),station:vi.fn()};
 const app=renderer.createApp({render:()=>Vue.h(Roster,props)});app.use(I18NextVue,{i18next});app.mount(body);
 try{
  expect(text(body)).toContain(label);
  expect(text(body)).not.toContain('ext.party.error.C5_');
  vi.spyOn(g,'executeCommand').mockImplementation(()=>{throw new World5Error(code,'private diagnostic sentinel');});
  (ui.hud.value!.props.rosterProps as any).station(7);
  expect(ui.hud.value!.props.feedback).toBe(label);
  expect(ui.hud.value!.props.feedback).not.toContain('sentinel');
  vi.mocked(g.executeCommand).mockImplementation(()=>{throw new Error('private diagnostic sentinel');});
  (ui.hud.value!.props.rosterProps as any).station(7);
  expect(ui.hud.value!.props.feedback).toBe(i18next.t('ext.party.error.INTERNAL_FAILURE'));
 }finally{app.unmount();ui.close();g.disposeRecording();while(logger.pendingAcknowledgment)logger.acknowledgeNext();}
});
