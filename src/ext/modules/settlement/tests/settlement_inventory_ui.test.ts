import {afterAll,beforeAll,it,expect,vi} from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {inventoryStamp} from '../../../../engine/Core/RecordingDigest';
import {createSfcHarness} from '../../../../test/support/sfcHarness';
import {useModuleUi} from '../../../ui/useModuleUi';
import type {ModuleUiHost} from '../../../ui/types';
import {DialogService,dialogServiceKey,presentationTimeline} from '../../../../ui/dialogService';
import {bindDialogAcknowledgments,bindDialogCommands} from '../../../../ui/dialogAcknowledgments';
import {logger} from '../../../../engine/Systems/Logger';
import {ItemLoader} from '../../../../engine/Items/ItemLoader';
import route from './natural-route.json';
// Client SFC event closures, not browser geometry or physical touch evidence.
type N={tag:string;text:string;props:Record<string,any>;children:N[];parent:N|null};
const node=(tag='',text=''):N=>({tag,text,props:{},children:[],parent:null});
const renderer=Vue.createRenderer<N,N>({
 createElement:tag=>node(tag),createText:t=>node('',t),createComment:()=>node(),
 insert(child,parent,anchor){child.parent?.children.splice(child.parent.children.indexOf(child),1);const i=anchor?parent.children.indexOf(anchor):-1;parent.children.splice(i<0?parent.children.length:i,0,child);child.parent=parent;},
 remove(child){child.parent?.children.splice(child.parent.children.indexOf(child),1);child.parent=null;},
 setText(n,t){n.text=t;},setElementText(n,t){n.text=t;n.children=[];},
 parentNode:n=>n.parent,nextSibling:n=>n.parent?.children[n.parent.children.indexOf(n)+1]??null,
 patchProp(n,k,_old,v){n.props[k]=v;}
});
const all=(n:N):N[]=>[n,...n.children.flatMap(all)];
const browser=Object.assign(new EventTarget(),{innerWidth:390,innerHeight:844});
let input:typeof import('../../../../engine/Input').inputManager;
let install:typeof import('../../../../ui/canvasGameInput').installCanvasGameInput;
let dialogInput:typeof import('../../../../ui/dialogInput').dialogInput;
beforeAll(async()=>{
 vi.stubGlobal('window',browser);
 vi.stubGlobal('document',{addEventListener(){},removeEventListener(){},activeElement:null,querySelector(){return null;}});
 ({inputManager:input}=await import('../../../../engine/Input'));
 ({installCanvasGameInput:install}=await import('../../../../ui/canvasGameInput'));
 ({dialogInput}=await import('../../../../ui/dialogInput'));
});
afterAll(()=>{vi.unstubAllGlobals();});
async function setup() {
 const h=createWorldHarness({seed:28,mode:'normal',modules:['settlement']}),g=worldHarnessGame(h);
 for(const m of route.moves)h.command('move',m.data);
 expect(g.player.loc).toEqual({x:67,y:5});
 const food=g.player.inventory.items.find(i=>i.consumableId==='ration_of_food')!;expect(food.quantity).toBe(2);
 expect(h.ext('settlement','establish',{v:1,stateRevision:g.extensionRuntime!.worldCampState('settlement').revision,inventoryStamp:inventoryStamp(g.player.inventory.items),...route.campTarget,bounds:{x:64,y:1,width:9,height:9},sourceContainerId:null,sourceRevision:null,materials:[{itemDefinitionId:'settlement.wood',count:4},{itemDefinitionId:'settlement.stone',count:2}],food:[{itemId:food.id,quantity:2}]}).error).toBeNull();
 const tick=Vue.ref(0),gameStarted=Vue.ref(true),menuOpen=Vue.ref(false),creationTransition=Vue.ref(false),dialogs=new DialogService(),scope=Vue.effectScope();
 // Match App's real shell refs and native Game predicates. Game fields are not Vue refs.
 const host:ModuleUiHost={game:()=>g,tick,immersive:Vue.ref(false),dialogs,
  isPresentationBusy:()=>!!presentationTimeline(g)?.busy||!!logger.pendingAcknowledgment,
  canOpenPanel:()=>!(g.interactionActive||creationTransition.value||menuOpen.value||g.isInventoryOpen||g.isThrowing||g.pendingArcana||g.pendingEnchantment||g.pendingIdentify||g.pendingUseConfirm||logger.pendingAcknowledgment||g.referenceScreen||g.isGameOver||g.isAdvancing||g.isInputLocked()),
  canPresentInteraction:()=>gameStarted.value&&!menuOpen.value&&!creationTransition.value&&!g.isInventoryOpen&&!g.referenceScreen&&!g.pendingArcana,
  beforeOpenPanel(){ui.closePanels();},afterClosePanel(){},registerKeyHandler:(fn,p)=>input.registerModalKeyHandler(fn,p)};
 const ui=scope.run(()=>useModuleUi(host))!;ui.refresh();install(g,()=>false);
 const polls:Array<()=>void>=[];
 const harness=createSfcHarness({baseURL:import.meta.url,stubs:{'../../../../engine/Core/Game.ts':{activeGame:g}},
  globals:{setInterval(fn:()=>void){polls.push(fn);return polls.length;},clearInterval(){}}});
 const Inventory=await harness.load('../../../../components/InventoryOverlay.vue');
 const Bar=await harness.load('../../../../components/CommandBar.vue');
 const root=node(),app=renderer.createApp({setup(){Vue.provide(dialogServiceKey,dialogs);return()=>Vue.h('div',[Vue.h(Bar,{mode:'portrait',moduleCommands:ui.commands.value}),Vue.h(Inventory)]);}});
 app.use(I18NextVue,{i18next});app.mount(root);await Vue.nextTick();
 const find=(action:string)=>{const result=all(root).find(n=>n.props['data-action']===action);expect(result).toBeDefined();return result!;};
 const advance=async()=>{tick.value++;polls.forEach(fn=>fn());await Vue.nextTick();};
 const observations:unknown[]=[];
 function observe(stage:string){observations.push({stage,inventory:g.isInventoryOpen,canOpen:host.canOpenPanel(),canPresent:host.canPresentInteraction!(),
  commandDisabled:ui.commands.value.find(c=>c.id==='settlement.open')!.disabled,buttonDisabled:find('settlement.open').props.disabled,
  overlayMounted:all(root).some(n=>n.props.class==='inventory-overlay'),recorded:g.recordedInputEvents.length,turn:g.absoluteTurnNumber,
  confirmation:dialogs.current?.kind??null,reference:g.referenceScreen,presentationBusy:host.isPresentationBusy!()});}
 function click(action:string){const button=find(action);expect(button.props.disabled).not.toBe(true);button.props.onClick();}
 async function open(){click('settlement.open');await Vue.nextTick();expect(ui.panelOpen.value).toBe(true);}
 function escape(){browser.dispatchEvent(Object.assign(new Event('keydown',{cancelable:true}),{key:'Escape',code:'Escape'}));browser.dispatchEvent(Object.assign(new Event('keyup'),{key:'Escape',code:'Escape'}));}
 function dispose(name:string){
  const out=process.env.SETTLEMENT_INVENTORY_UI_OUT;
  if(out){mkdirSync(out,{recursive:true});writeFileSync(out+'/'+name+'.json',JSON.stringify(observations,null,2)+'\n');}
  app.unmount();scope.stop();dialogs.dispose();h.dispose();input.setCallback(()=>{});
 }
 return {g,h,ui,host,dialogs,find,root,advance,observe,click,open,escape,dispose};
}
it.each(['right-upper-X','Escape'] as const)('native inventory %s closes and normally refreshed CommandBar can reopen settlement',async close=>{
 const s=await setup();
 try{
  await s.open();s.ui.closePanels();await s.advance();s.observe('camp-opened-and-closed');
  const events=s.g.recordedInputEvents.length,turn=s.g.absoluteTurnNumber;
  s.click('toggle_inventory');await s.advance();
  expect(s.g.isInventoryOpen).toBe(true);expect(s.find('settlement.open').props.disabled).toBe(true);s.observe('inventory-open-computed-evaluated');
  expect(s.g.recordedInputEvents.length).toBe(events+1);
  if(close==='Escape')s.escape();else{
   const button=all(s.root).find(n=>n.tag==='button'&&n.props.class==='close-btn');expect(button).toBeDefined();expect(button!.props.disabled).not.toBe(true);button!.props.onClick();
  }
  await s.advance();s.observe('inventory-closed-normal-refresh');
  expect(s.g.isInventoryOpen).toBe(false);expect(s.host.canOpenPanel()).toBe(true);expect(s.host.canPresentInteraction!()).toBe(true);
  expect(s.g.recordedInputEvents.length).toBe(events+2);expect(s.g.absoluteTurnNumber).toBe(turn);
  expect(s.find('settlement.open').props.disabled).toBe(false);
  // Keep polling ordinary shell boundaries; no reactive menu toggle or forced invoke.
  for(let n=0;n<80;n++)await s.advance();s.observe('80-normal-polls');
  expect(s.find('settlement.open').props.disabled).toBe(false);await s.open();s.observe('normal-button-reopened-camp');
 }finally{s.dispose(close);}
});
it('native inventory malevolent-use Confirm stays disabled and cancellation permits normal reopen',async()=>{
 const s=await setup();
 try{
  // Controlled confirmation precondition only; not a new natural-food proof.
  const potion=ItemLoader.spawnPotion('potion_of_darkness',-1,-1)!;expect(potion).toBeDefined();s.g.player.inventory.addItem(potion);ItemLoader.detectMagicOnItem(potion);
  expect(s.g.requiresMalevolentUseConfirmation(potion)).toBe(true);
  s.click('toggle_inventory');await s.advance();expect(s.find('settlement.open').props.disabled).toBe(true);
  s.g.executeItemCommand('quaff',potion);s.dialogs.sync();await s.advance();
  expect(s.g.pendingUseConfirm).toBe(potion);expect(s.dialogs.current?.kind).toBe('confirm');
  expect(s.find('settlement.open').props.disabled).toBe(true);s.observe('native-use-Confirm');
  expect(s.dialogs.answer(s.dialogs.current!.token,'no')).toBe(true);await s.advance();
  expect(s.g.pendingUseConfirm).toBeNull();expect(s.g.player.inventory.items).toContain(potion);
  expect(s.g.isInventoryOpen).toBe(true);expect(s.find('settlement.open').props.disabled).toBe(true);
  s.escape();await s.advance();expect(s.find('settlement.open').props.disabled).toBe(false);await s.open();
 }finally{s.dispose('Confirm');}
});
it('real ACK and native reference screen retain their barriers then restore normally',async()=>{
 const s=await setup();const removeCommands=bindDialogCommands(s.dialogs,s.g),removeAck=bindDialogAcknowledgments(s.dialogs,s.g,logger);
 const detach=dialogInput.attach({service:s.dialogs,contains:()=>false,hint(){},blocked:()=>!!presentationTimeline(s.g)?.busy});
 try{
  logger.log('R2 controlled acknowledgment','#ffffff',{acknowledge:true});s.dialogs.sync();await s.advance();
  expect(s.dialogs.current?.kind).toBe('acknowledgment');expect(s.find('settlement.open').props.disabled).toBe(true);s.observe('real-ACK');
  const events=s.g.recordedInputEvents.length,turn=s.g.absoluteTurnNumber;input.triggerAction('move',1);
  expect(s.g.recordedInputEvents.length).toBe(events);expect(s.g.absoluteTurnNumber).toBe(turn);
  expect(s.dialogs.answer(s.dialogs.current!.token,'more')).toBe(true);await s.advance();
  expect(s.find('settlement.open').props.disabled).toBe(false);await s.open();s.ui.closePanels();
  input.triggerAction('help');await s.advance();expect(s.g.referenceScreen).toBe('help');expect(s.find('settlement.open').props.disabled).toBe(true);s.observe('native-reference');
  s.escape();await s.advance();expect(s.g.referenceScreen).toBeNull();expect(s.find('settlement.open').props.disabled).toBe(false);await s.open();
 }finally{detach();removeAck();removeCommands();s.dispose('ACK-reference');}
});
