import {arena,add,place,harness,game} from '../../crafting/tests/runtimeHelpers';
import {ItemLoader} from '../../../../engine/Items/ItemLoader';
import {logger} from '../../../../engine/Systems/Logger';
import '../../../../i18n';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { useLootUi } from '../gameSession';
import { readFileSync } from 'node:fs';
import { compileStyle, parse } from '@vue/compiler-sfc';
import { timeSystem } from '../../../../engine/Systems/Time';
type N = { tag: string; text: string; props: Record<string, any>; children: N[]; parent: N | null;
  readonly tagName: string; readonly options: N[]; addEventListener(): void; removeEventListener(): void; focus():void; querySelector(selector:string):N|null; querySelectorAll(selector:string):N[]; matches(selector:string):boolean };
const node = (tag = '', text = ''): N => Vue.markRaw<N>({ tag, text, props: {}, children: [], parent: null,
  get tagName() { return tag.toUpperCase(); }, get options() { return this.children.filter((n:N) => n.tag === 'option'); },
  addEventListener() {}, removeEventListener() {}, focus(){Reflect.set(document,'activeElement',this);},
  matches(selector){return selector==='[data-preset]'?this.props['data-preset']!==undefined:false;},
  querySelector(selector){const m=/\[data-preset="([^"]+)"\]/.exec(selector);return all(this).find(n=>m?n.props['data-preset']===m[1]:false)??null;},
  querySelectorAll(){return all(this).filter(n=>n.tag==='button'&&!n.props.disabled&&n.props.tabindex!==-1);} });
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
beforeAll(async()=>{vi.stubGlobal('window',{addEventListener(){},removeEventListener(){},localStorage:{getItem(){return null;},setItem(){}}});vi.stubGlobal('document',{documentElement:{dataset:{},style:{setProperty(){}}},activeElement:null,addEventListener(){},removeEventListener(){},querySelector(){return null;}});Panel=await createSfcHarness({baseURL:import.meta.url}).load('../ui/game/LootGamePanel.vue');});
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
it.each(['tick','settled'] as const)('D7 clean growth+loot shell opens from the real command bar and recovers via %s',async(release)=>{
 const {useModuleUi}=await import('../../../ui/useModuleUi');
 const {DialogService}=await import('../../../../ui/dialogService');
 const {auditFullObjectGraph}=await import('../../../../test/support/fullGenerationCheckpointOracle');
 const {rng}=await import('../../../../engine/Random');
 const h=createWorldHarness({seed:42,mode:'easy',modules:['growth','loot']}),g=worldHarnessGame(h),scope=Vue.effectScope(),tick=Vue.ref(0);
 let busy=false;let ui!:ReturnType<typeof useModuleUi>;
 const host={game:()=>g,tick,immersive:Vue.ref(false),dialogs:new DialogService(),canOpenPanel:()=>true,canPresentInteraction:()=>true,isPresentationBusy:()=>busy,beforeOpenPanel(){ui.closePanels();},afterClosePanel(){}};
 const Bar=await createSfcHarness({baseURL:import.meta.url}).load('../../../../components/CommandBar.vue');
 const app=renderer.createApp({setup:()=>{ui=useModuleUi(host);ui.refresh();return ()=>Vue.h('div',[Vue.h(Bar,{mode:'desktop',moduleCommands:ui.commands.value}),...ui.panelSlots.value.map(slot=>Vue.h(Panel,slot.props))]);}});app.use(I18NextVue,{i18next});const root=node();app.mount(root);
 const open=async()=>{const b=all(root).find(n=>n.tag==='button'&&text(n).includes('战利品'))!;expect(b).toBeDefined();b.props.onClick();await Vue.nextTick();};
 try{
  const audit=auditFullObjectGraph([g,rng]);await open();
  expect(ui.panelOpen.value).toBe(true);expect(all(body).some(n=>String(n.props.class).includes('loot-game-panel'))).toBe(true);expect(text(body)).toContain('匕首');expect(audit.differences()).toEqual([]);
  ui.closePanels();await Vue.nextTick();
  host.beforeOpenPanel=()=>{ui.closePanels();busy=true;};await open();
  expect(ui.panelOpen.value).toBe(true);expect(ui.panelSlots.value).toHaveLength(1);expect(text(body)).toContain('正在加载');
  tick.value++;await Vue.nextTick();expect(ui.panelSlots.value[0]!.props.presentationHidden).toBe(true);
  busy=false;if(release==='tick')tick.value++;else host.dialogs.sync();await Vue.nextTick();
  expect(text(body)).toContain('匕首');expect(text(body)).not.toContain('正在加载');expect(audit.differences()).toEqual([]);
 }finally{app.unmount();scope.stop();h.dispose();body.children=[];}
});

it('D7 creation is a body modal and focuses the selected preset after the previous-step lock',async()=>{
 const Creation=await createSfcHarness({baseURL:import.meta.url}).load('../ui/creation/LootCreationStep.vue');
 const props=Vue.reactive({submitting:true,error:null as string|null}),complete=vi.fn(),cancel=vi.fn();
 const root=node(),app=renderer.createApp({setup:()=>()=>Vue.h(Creation,{...props,onComplete:complete,onCancel:cancel})});app.use(I18NextVue,{i18next});app.mount(root);
 try{
  await Vue.nextTick();const overlay=all(body).find(n=>n.props.class==='loot-creation')!;expect(overlay).toBeDefined();
  const modal=all(body).find(n=>n.props.role==='dialog'&&n.props['aria-modal']==='true');expect(modal).toBeDefined();
  props.submitting=false;await Vue.nextTick();await Vue.nextTick();
  expect((document.activeElement as unknown as N)?.props['data-preset']).toBe('standard');
  const b=all(body).find(n=>n.props['data-action']==='cancel')!;expect(b).toBeDefined();b.props.onClick();await Vue.nextTick();expect(cancel).toHaveBeenCalledTimes(1);expect(complete).not.toHaveBeenCalled();
 }finally{app.unmount();body.children=[];}
});
it.each(['Enter',' '])('D7 creation keyboard %s confirms exactly once and ignores held repeat',async(key)=>{
 const Creation=await createSfcHarness({baseURL:import.meta.url}).load('../ui/creation/LootCreationStep.vue');const complete=vi.fn();
 const app=renderer.createApp(Creation,{submitting:false,error:null,onComplete:complete});app.use(I18NextVue,{i18next});app.mount(node());
 try{
  await Vue.nextTick();await Vue.nextTick();const overlay=all(body).find(n=>n.props.class==='loot-creation')!;expect(overlay).toBeDefined();
  const selected=all(body).find(n=>n.props['data-preset']==='standard')!;
  const event=(repeat=false)=>({key,repeat,target:selected,preventDefault:vi.fn(),stopPropagation:vi.fn()});
  overlay.props.onKeydownCapture(event());overlay.props.onKeydownCapture(event(true));overlay.props.onKeydownCapture(event());
  expect(complete).toHaveBeenCalledTimes(1);expect(JSON.parse(complete.mock.calls[0]![0][0])).toMatchObject({module:'loot',action:'create',payload:{presetId:'standard'}});
 }finally{app.unmount();body.children=[];}
});
it('D7 creation compiled layout is viewport anchored with a scrollable body and reachable actions',()=>{
 const filename=new URL('../ui/creation/LootCreationStep.vue',import.meta.url),sfc=parse(readFileSync(filename,'utf8')).descriptor;
 const css=sfc.styles.map(s=>compileStyle({filename:filename.pathname,id:'d7',source:s.content,scoped:s.scoped}).code).join('\n');
 expect(css).toMatch(/\.loot-creation\s*\{[^}]*position:\s*fixed/);expect(css).toMatch(/inset:\s*0/);expect(css).toMatch(/z-index:\s*2200/);
 expect(css).toMatch(/max-height:\s*calc\(100dvh - 32px\)/);expect(css).toMatch(/overflow-y:\s*auto/);expect(css).toMatch(/width:\s*min\(940px,100%\)/);
});
it('D7 engine advancement deferred on open completes on the host poll; close/load revoke pending panels',async()=>{
 const {useModuleUi}=await import('../../../ui/useModuleUi');
 const h=createWorldHarness({seed:42,mode:'easy',modules:['growth','loot']}),g=worldHarnessGame(h),tick=Vue.ref(0);
 let ui!:ReturnType<typeof useModuleUi>;const root=node();
 const app=renderer.createApp({setup(){ui=useModuleUi({game:()=>g,tick,immersive:Vue.ref(false),canOpenPanel:()=>true,canPresentInteraction:()=>true,
  beforeOpenPanel(){ui.closePanels();g.animationEnabled=true;g.executeCommand('wait');},afterClosePanel(){}});ui.refresh();return ()=>Vue.h('div',ui.panelSlots.value.map(s=>Vue.h(Panel,s.props)));}});app.use(I18NextVue,{i18next});app.mount(root);
 const open=()=>ui.commands.value.find(c=>c.id==='loot:panel')!.invoke();
 const settle=()=>{for(let i=0;i<1000&&g.isAdvancing;i++)g.stepAdvancement();expect(g.isAdvancing).toBe(false);};
 try{
  const events=g.recordedInputEvents.length;open();expect(g.isAdvancing).toBe(true);await Vue.nextTick();expect(text(body)).toContain('正在加载');
  settle();tick.value++;await Vue.nextTick();expect(text(body)).toContain('匕首');expect(g.recordedInputEvents).toHaveLength(events+1);
  ui.closePanels();open();ui.closePanels();settle();tick.value++;await Vue.nextTick();expect(ui.panelSlots.value).toEqual([]);
  open();settle();expect(g.loadSnapshot(g.toSnapshot())).toBe(true);tick.value++;await Vue.nextTick();expect(ui.panelOpen.value).toBe(false);expect(ui.panelSlots.value).toEqual([]);
 }finally{app.unmount();h.dispose();body.children=[];}
});
it('D7 growth confirmation hands the real menu to a focused loot modal, Escape returns, retry starts once',async()=>{
 vi.useFakeTimers();
 const harness=createSfcHarness({baseURL:import.meta.url});
 const Growth=await harness.load('../../growth/ui/GrowthCreationStep.vue'),Loot=await harness.load('../ui/creation/LootCreationStep.vue');
 const creation=await import('../../../ui/creation');
 const Empty=Vue.defineComponent({render:()=>null});
 const Menu=await createSfcHarness({baseURL:import.meta.url,components:{'../../../../components/theme/TitleFx.vue':Empty,'../../../../components/MapTileLegend.vue':Empty},stubs:{'../../../ui/creation':{...creation,
  prepareModuleCreation(ids:readonly string[]){const plan=creation.prepareModuleCreation(ids);return {...plan,steps:plan.steps.map(step=>({...step,load:undefined,component:step.moduleId==='growth'?Growth:Loot}))};}
 }}}).load('../../../../components/MainMenu.vue');
 const submitted=vi.fn(),root=node(),app=renderer.createApp(Menu,{inGame:false,hasSave:false,hasReplay:false,saveInfo:null,replayInfo:null,onNewGame:submitted});app.use(I18NextVue,{i18next});app.mount(root);
 const flush=async()=>{await Vue.nextTick();await Vue.nextTick();};
 const find=(prop:string,value:string,where=body)=>all(where).find(n=>n.props[prop]===value)!;
 const click=async(b:N)=>{expect(b).toBeDefined();expect(b.props.disabled).not.toBe(true);b.props.onClick?.({detail:1,preventDefault(){},stopPropagation(){}});await flush();};
 const button=(label:string)=>all(root).find(n=>n.tag==='button'&&text(n).includes(label))!;
 const reachLoot=async()=>{
  await click(button(i18next.t('title.begin')));await flush();
  for(let i=0;i<3;i++){await click(find('data-creation','next'));vi.advanceTimersByTime(600);await flush();}
  await click(find('data-creation','submit'));await flush();vi.advanceTimersByTime(600);await flush();
  expect(find('class','loot-creation')).toBeDefined();expect((document.activeElement as unknown as N)?.props['data-preset']).toBe('standard');
 };
 try{
  await click(button(i18next.t('menu.actions.new_game')));
  find('data-testid','rule-set',root).props['onUpdate:modelValue']('extended');await flush();
  find('data-module','loot',root).props.onChange({target:{checked:true}});await flush();
  await reachLoot();expect(submitted).not.toHaveBeenCalled();
  const title=all(root).find(n=>String(n.props.class).includes('title-screen'))!;expect(title.props.inert).toBe(true);
  find('class','loot-creation').props.onKeydownCapture({key:'Escape',preventDefault(){},stopPropagation(){}});await flush();
  expect(find('class','loot-creation')).toBeUndefined();expect(title.props.inert).toBe(false);expect(document.activeElement).toBe(title);
  await reachLoot();await click(find('data-preset','scarce'));await click(find('data-action','confirm'));
  expect(submitted).toHaveBeenCalledTimes(1);const payload=submitted.mock.calls[0]![0];
  expect(payload.extensions).toEqual(['growth','loot']);expect(payload.extensionConfigurations.loot).toEqual({presetId:'scarce'});
  expect(payload.initialCommands.map((s:string)=>JSON.parse(s).module)).toEqual(['growth','loot']);
  const {Game}=await import('../../../../engine/Core/Game');const g=new Game();
  try{g.startNewGame({...payload,seed:42});expect(g.depth).toBe(1);expect(g.extensionRuntime!.manifest.modules.map(m=>m.id)).toEqual(['growth','loot']);}
  finally{g.disposeRecording();}
 }finally{app.unmount();body.children=[];vi.useRealTimers();}
});
it('D7 preset Tab stays in the modal and a rejected start allows retry without losing the choice',async()=>{
 const Creation=await createSfcHarness({baseURL:import.meta.url}).load('../ui/creation/LootCreationStep.vue');
 const props=Vue.reactive({submitting:false,error:null as string|null}),complete=vi.fn(()=>{props.error='ext.creation.start_failed';});
 const app=renderer.createApp({setup:()=>()=>Vue.h(Creation,{...props,onComplete:complete})});app.use(I18NextVue,{i18next});app.mount(node());
 try{
  await Vue.nextTick();await Vue.nextTick();const overlay=all(body).find(n=>n.props.class==='loot-creation')!,confirm=all(body).find(n=>n.props['data-action']==='confirm')!,cancel=all(body).find(n=>n.props['data-action']==='cancel')!;
  const tab=(shiftKey=false)=>overlay.props.onKeydownCapture({key:'Tab',shiftKey,target:document.activeElement,preventDefault(){},stopPropagation(){}});
  tab();expect(document.activeElement).toBe(confirm);tab();expect(document.activeElement).toBe(cancel);tab(true);expect(document.activeElement).toBe(confirm);
  all(body).find(n=>n.props['data-preset']==='scarce')!.props.onClick();await Vue.nextTick();
  for(let i=1;i<=2;i++){confirm.props.onClick();await Vue.nextTick();await Vue.nextTick();await Vue.nextTick();expect(complete).toHaveBeenCalledTimes(i);expect(confirm.props.disabled).toBe(false);expect((document.activeElement as unknown as N).props['data-preset']).toBe('scarce');}
 }finally{app.unmount();body.children=[];}
});

it('native inventory close cancels a deferred enhancement without spending its scroll or turn',async()=>{
 const h=createWorldHarness({seed:42,mode:'easy',modules:['loot']}),g=worldHarnessGame(h);let app:ReturnType<typeof renderer.createApp>|undefined;
 try{
  while(logger.pendingAcknowledgment)logger.acknowledgeNext();const scroll=ItemLoader.spawnScroll('scroll_of_enchantment',-1,-1)!;g.player.inventory.addItem(scroll);ItemLoader.identifyItemKind(scroll);g.executeItemCommand('read',scroll);
  expect(g.canCancelEnchantment).toBe(true);const tick=timeSystem.currentTick,submit=vi.spyOn(g,'executeCommand');
  const Inventory=await createSfcHarness({baseURL:import.meta.url,stubs:{'../../../../engine/Core/Game':{activeGame:g}},stubComponents:Vue.defineComponent({render:()=>null})}).load('../../../../components/InventoryOverlay.vue');
  const root=node();app=renderer.createApp(Inventory);app.use(I18NextVue,{i18next});app.mount(root);await Vue.nextTick();
  const close=all(root).find(n=>n.props.class==='close-btn')!;expect(close).toBeDefined();expect(close.props.disabled).toBe(false);close.props.onClick();await Vue.nextTick();
  expect(submit).toHaveBeenCalledWith('escape');expect(g.pendingEnchantment).toBe(false);expect(g.player.inventory.items).toContain(scroll);expect(timeSystem.currentTick).toBe(tick);
 }finally{app?.unmount();h.dispose();vi.restoreAllMocks();}
});

it('C2 mounted socket choices submit through the host, cancel without cost and replace rune rows with the word',async()=>{
 const {assembleDropItem}=await import('../../../../engine/Items/FixedItemAssembly');
 const {assembleWorldItem}=await import('../../../../engine/Items/WorldItems');
 const {itemDefinition}=await import('../../../../engine/Core/WorldWorkWorld');
 const {loadLootPack}=await import('../definitions');const {buildEffectiveLootCatalog}=await import('../catalog');const {deriveNativeFacts}=await import('../item');
 const h=createWorldHarness({seed:42,mode:'easy',modules:['loot']}),g=worldHarnessGame(h),scope=Vue.effectScope();
 const catalog=buildEffectiveLootCatalog(loadLootPack(),{combat:null,growth:null,giants:null});
 const data:import('../types').LootItemDataV1={v:6,baseId:'leather_armor',ilvl:20,rarity:'normal',uniqueId:null,setId:null,pieceId:null,identityKnown:false,affixes:[],corrupted:false,enhancement:0,sockets:2,socketed:[],nameParts:null,origin:{source:'floor',depth:14}};
 const n=deriveNativeFacts(data,catalog),item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:999},moduleData:{loot:data as unknown as import('../../../types').Json}});g.extensionRuntime!.bindItemData(item);expect(g.player.inventory.addItem(item)).toBe(true);
 const materials=['ka','ul'].map(id=>{const m=assembleWorldItem(itemDefinition(g,`loot.rune.${id}`),1);expect(g.player.inventory.addItem(m)).toBe(true);return m;});
 const session=scope.run(()=>useLootUi({game:()=>g,tick:Vue.ref(0),immersive:Vue.ref(false),canOpenPanel:()=>true,beforeOpenPanel(){},afterClosePanel(){},beforeOpenItemPanel:()=>true}))!;
 session.itemActions!(item.id)[0]!.invoke();const app=renderer.createApp({setup:()=>()=>session.panel.value?Vue.h(Panel,session.panel.value.props):null});app.use(I18NextVue,{i18next});app.mount(node());
 const button=(name:string)=>all(body).find(n=>n.tag==='button'&&text(n).includes(name))!;
 const click=async(name:string)=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();const b=button(name);expect(b).toBeDefined();expect(b.props.disabled).not.toBe(true);b.props.onClick();await Vue.nextTick();};
 const decide=async(yes:boolean)=>{expect(g.pendingCommandConfirmation).not.toBeNull();g.resolveCommandDecision(g.pendingCommandConfirmation!.token,yes);session.refresh();await Vue.nextTick();};
 try{
  expect(text(body)).toContain('余烬');expect(text(body)).toContain('100');expect(text(body)).toContain('取回');const tick=timeSystem.currentTick;
  await click('镶嵌 卡');await decide(false);expect(timeSystem.currentTick).toBe(tick);expect(materials[0]!.quantity).toBe(1);expect(text(body)).toContain('已取消');
  await click('镶嵌 卡');const count=g.recordedInputEvents.length;(session.panel.value!.props.onSocket as (id:number)=>void)(materials[0]!.id);expect(g.recordedInputEvents).toHaveLength(count);await decide(true);
  expect(timeSystem.currentTick-tick).toBe(100);expect(text(body)).toContain('不能强化');expect(button('镶嵌 乌尔')).toBeDefined();
  await click('镶嵌 乌尔');await decide(true);expect(timeSystem.currentTick-tick).toBe(200);expect(item.moduleData!.loot).toMatchObject({rarity:'runeword',identityKnown:false,socketed:['loot.rune.ka','loot.rune.ul']});
  expect(item.identified).toBe(false);expect(all(body).filter(n=>n.tag==='button'&&text(n).startsWith('镶嵌'))).toEqual([]);expect(text(body)).toContain('余烬');expect(text(body)).toContain('20');
 }finally{app.unmount();scope.stop();h.dispose();body.children=[];}
});

it('C3 R1 mounted reforge button names the sorted row and submits its stable ID exactly once',async()=>{
 const {assembleDropItem}=await import('../../../../engine/Items/FixedItemAssembly');
 const h=harness({seed:51020001,mode:'easy',modules:['loot','crafting']}),g=game(h),scope=Vue.effectScope();
 arena(g);add(g,'stone',6);add(g,'metal',4);add(g,'loot.shard',10);expect(place(h,'forge').error).toBeNull();
 const data={v:6,baseId:'dagger',ilvl:20,rarity:'magic',uniqueId:null,setId:null,pieceId:null,identityKnown:true,
  affixes:[{id:'loot.affix.precise',tier:1,values:[1200],known:true},{id:'loot.affix.keen',tier:1,values:[2500],known:true}],
  corrupted:false,enhancement:0,sockets:0,socketed:[],nameParts:null,origin:{source:'floor',depth:14}};
 const item=assembleDropItem({native:{kind:'dagger',category:'weapon',enchantment:0,runicType:null,isCursed:false,identified:true,familiarityRemaining:0},moduleData:{loot:data}});
 expect(g.player.inventory.addItem(item)).toBe(true);g.extensionRuntime!.bindItemData(item);
 const session=scope.run(()=>useLootUi({game:()=>g,tick:Vue.ref(0),immersive:Vue.ref(false),canOpenPanel:()=>true,beforeOpenPanel(){},afterClosePanel(){},beforeOpenItemPanel:()=>true}))!;
 session.itemActions!(item.id)[0]!.invoke();
 const app=renderer.createApp({setup:()=>()=>session.panel.value?Vue.h(Panel,session.panel.value.props):null});app.use(I18NextVue,{i18next});app.mount(node());
 const execute=vi.spyOn(g,'executeCommand');
 try {
  const buttons=all(body).filter(n=>n.tag==='button'&&text(n).startsWith('重铸'));
  expect(buttons).toHaveLength(2);
  expect(text(buttons[0]!)).toContain(i18next.t('ext.loot.affix.keen'));
  expect(text(buttons[1]!)).toContain(i18next.t('ext.loot.affix.precise'));
  expect(text(buttons[0]!)).not.toContain('第 1 行');
  const tick=timeSystem.currentTick,click=buttons[0]!.props.onClick;
  while(logger.pendingAcknowledgment)logger.acknowledgeNext();
  click();click();await Vue.nextTick();
  const submitted=execute.mock.calls.filter(call=>call[0]==='ext:command').map(call=>JSON.parse(call[1] as string));
  expect(submitted).toHaveLength(1);expect(submitted[0].payload.rowId).toBe('loot.affix.keen');
  expect(submitted[0].payload).not.toHaveProperty('rowIndex');
  if(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);
  expect(timeSystem.currentTick-tick).toBe(100);
  expect((item.moduleData!.loot as any).affixes[0]).toEqual(data.affixes[0]);
  expect((item.moduleData!.loot as any).affixes[1]).not.toEqual(data.affixes[1]);
 }finally{app.unmount();scope.stop();body.children=[];}
});
