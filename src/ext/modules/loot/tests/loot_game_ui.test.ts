import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import '../../../../i18n';
import { afterEach, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { useLootUi } from '../gameSession';
import { readLootGameView } from '../gameView';
import { getLootUiFixture } from '../tools/preview/fixtures';
import { deriveNativeFacts } from '../item';
import { resolveLootCatalog } from '../session';
import { assembleDropItem } from '../../../../engine/Items/FixedItemAssembly';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import { getNextEntityId } from '../../../../entities/Creature';
import { nativeStatRevision } from '../../../../engine/Stats/NativeStatSources';
const handles:ReturnType<typeof createWorldHarness>[]=[],scopes:ReturnType<typeof effectScope>[]=[];
afterEach(()=>{scopes.splice(0).forEach(s=>s.stop());handles.splice(0).forEach(h=>h.dispose());vi.restoreAllMocks();});
function setup(){const h=createWorldHarness({seed:42,mode:'easy',modules:['loot']});handles.push(h);const g=worldHarnessGame(h);let handler:((e:KeyboardEvent)=>boolean)|undefined;
 const scope=effectScope();scopes.push(scope);const session=scope.run(()=>useLootUi({game:()=>g,tick:ref(0),immersive:ref(false),canOpenPanel:()=>true,beforeOpenPanel(){},afterClosePanel(){},beforeOpenItemPanel:()=>true,registerKeyHandler:fn=>{handler=fn;return()=>{handler=undefined;};}}))!;
 return {g,h,session,handler:()=>handler,props:()=>session.panel.value!.props as any};}
function decide(g:ReturnType<typeof worldHarnessGame>,accept:boolean){while(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,accept);}
function add(g:ReturnType<typeof worldHarnessGame>,id:Parameters<typeof getLootUiFixture>[0]){const data=getLootUiFixture(id).data,c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),n=deriveNativeFacts(data,c);const i=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:20},moduleData:{loot:JSON.parse(JSON.stringify(data))}});g.player.inventory.addItem(i);g.extensionRuntime!.bindItemData(i);return i;}
it('real session read, native mixed comparison, hidden DTO and refresh are pure',()=>{
 const {g,session,props}=setup(),item=add(g,'R07');const before=auditFullObjectGraph([g,rng]),id=getNextEntityId(),revision=nativeStatRevision(g.player);
 session.itemActions!(item.id)[0]!.invoke();const view=props().view;expect(view.selected.name).toBeTruthy();expect(view.card.baseStats).toEqual([]);expect(view.compare.columns).toHaveLength(1);
 expect(JSON.stringify(view)).not.toContain('loot.affix.brutal');expect(view.compare.columns[0].rows.some((r:any)=>r.key==='native.regeneration')).toBe(true);
 for(let i=0;i<4;i++)session.refresh();expect(props().view).toBe(view);expect(before.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);expect(nativeStatRevision(g.player)).toBe(revision);
});
it('session filter uses a single zero-tick command and keeps result feedback',()=>{
 const {g,session,props}=setup();session.commands.value[0]!.invoke();const tick=timeSystem.currentTick,events=g.recordedInputEvents.length;
 props().onFilter({v:1,minRarity:'rare',classes:['weapon'],autoPickupGold:false});expect(timeSystem.currentTick).toBe(tick);expect(g.recordedInputEvents).toHaveLength(events+1);expect(props().view.filter.minRarity).toBe('rare');expect(props().feedback).toContain('已完成');const feedback=props().feedback;
 session.refresh();expect(props().feedback).toBe(feedback);
});
it('actual batch unique No/Yes, identify and rejected repeated action are visible',()=>{
 const {g,session,props}=setup(),unique=add(g,'R12'),ring=add(g,'R05');session.commands.value[0]!.invoke();props().onBatch([unique.id]);g.onConfirmRequest=()=>false;const tick=timeSystem.currentTick;props().onSalvage();decide(g,false);session.refresh();expect(g.player.inventory.items).toContain(unique);expect(timeSystem.currentTick).toBe(tick);expect(props().feedback).toContain('取消');
 props().onBatch([unique.id]);g.onConfirmRequest=()=>true;props().onSalvage();decide(g,true);session.refresh();expect(g.player.inventory.items).not.toContain(unique);expect(props().view.shards).toBe(80);props().onSelect(ring.id);props().onIdentify();expect(ring.isIdentified).toBe(true);expect(props().view.shards).toBe(70);props().onIdentify();expect(props().feedback).toContain('未完成');expect(props().view.shards).toBe(70);
});
it('all game keys are claimed, Esc returns by layer, load revokes old callbacks',()=>{
 const {g,session,props,handler}=setup(),ring=add(g,'R05');session.itemActions!(ring.id)[0]!.invoke();const events=g.recordedInputEvents.length;
 for(const key of ['ArrowUp','i','d','a','j','.','x','Tab','Enter',' '])expect(handler()!({key,preventDefault(){}} as KeyboardEvent)).toBe(true);
 expect(g.recordedInputEvents).toHaveLength(events);handler()!({key:'Escape',preventDefault(){}} as KeyboardEvent);expect(props().view.selected).toBeNull();
 const stale=props().onFilter;expect(g.loadSnapshot(g.toSnapshot())).toBe(true);session.refresh();expect(session.panelOpen.value).toBe(false);const now=g.recordedInputEvents.length;stale({v:1,minRarity:'unique',classes:[],autoPickupGold:false});expect(g.recordedInputEvents).toHaveLength(now);
});
it('floor projection has no hidden rows or phantom comparison, hallucination has no floor entries',()=>{
 const {g}=setup(),item=g.items.find(i=>i.moduleData?.loot)!;g.grid.getCell(item.x,item.y)!.isVisible=true;
 const v=readLootGameView(g,item.id,[]);expect(v.selected?.location).toBe('floor');expect(v.selected?.known?.affixes).toEqual([]);expect(v.compare).toBeNull();g.player.applyStatus('hallucinating',10);expect(readLootGameView(g,item.id,[]).selected).toBeNull();
});
it('enhancement button closes the panel into native selection, submits once, and refreshes actual level',()=>{
 const {g,session,props}=setup(),item=add(g,'R07'),scroll=ItemLoader.spawnScroll('scroll_of_enchantment',-1,-1)!;
 g.player.inventory.addItem(scroll);ItemLoader.identifyItemKind(scroll);session.itemActions!(item.id)[0]!.invoke();const p=props(),tick=timeSystem.currentTick,submit=vi.spyOn(g,'executeItemCommand');
 expect(p.view.selected.enhancement).toMatchObject({level:0,cap:6,allowed:true,scroll:true});p.onEnchant();p.onEnchant();
 expect(submit).toHaveBeenCalledTimes(1);expect(session.panel.value).toBeNull();expect(g.pendingEnchantment).toBe(true);expect(g.player.inventory.items).toContain(scroll);expect(timeSystem.currentTick).toBe(tick);
 g.executeItemCommand('enchant',item);expect(g.player.inventory.items).not.toContain(scroll);session.itemActions!(item.id)[0]!.invoke();expect(props().view.selected.enhancement.level).toBe(1);
});

it('disabled native rune is marked inactive in the live card without exposing unknown rows',()=>{
 const {g}=setup(),item=add(g,'R17');item.runicType=undefined;
 expect(JSON.stringify(readLootGameView(g,item.id,[]).card)).not.toContain('符文已失效');
 ItemLoader.identifyInstance(item);const view=readLootGameView(g,item.id,[]);
 expect(view.card!.rows.flatMap(r=>r.lines).filter(l=>l.runic).every(l=>l.value.includes('符文已失效'))).toBe(true);
 expect(view.card!.rows.flatMap(r=>r.lines).filter(l=>l.runic)).toHaveLength(1);
 const audit=auditFullObjectGraph([g,rng]);readLootGameView(g,item.id,[]);expect(audit.differences()).toEqual([]);
});
