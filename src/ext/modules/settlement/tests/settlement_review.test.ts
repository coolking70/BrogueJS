import { it, expect } from 'vitest';
import { effectScope, ref } from 'vue';
import { setup, establish, build, base, current } from './helpers';
import { inventoryStamp } from '../../../../engine/Core/RecordingDigest';
import { TerrainType } from '../../../../engine/Map/Grid';
import { useSettlementUi } from '../ui/useSettlementUi';
function session(g: ReturnType<typeof setup>['g']) {
  const scope = effectScope();
  let key: (e: KeyboardEvent) => boolean = () => false;
  const host = { game: () => g, tick: ref(0), immersive: ref(false), canOpenPanel: () => true,
    beforeOpenPanel() {}, afterClosePanel() {},
    registerKeyHandler(handler: typeof key) { key = handler; return () => {}; },
    selectMapCells() { return () => {}; } };
  const s = scope.run(() => useSettlementUi(host))!;
  s.commands.value[0]!.invoke();
  return {scope,s, props: () => s.panel.value!.props as any, key: (name: string) => key({key:name,preventDefault(){}} as KeyboardEvent)};
}
it('non-selection settlement drawer lets native movement keys through without closing', () => {
  const {h,g}=setup(); expect(h.ext('settlement','establish',establish(g)).error).toBeNull();
  const u=session(g);expect(u.key('ArrowRight')).toBe(false);expect(u.s.panelOpen.value).toBe(true);u.scope.stop();
});
it('formal UI rest starts native automation with strict payload and positive hunger/time, then interrupts', () => {
  const {h,g}=setup();expect(h.ext('settlement','establish',establish(g)).error).toBeNull();
  expect(h.ext('settlement','build',build(g)).error).toBeNull();
  const u=session(g), before=g.world5!.simulationTicks, hunger=g.player.nutrition;
  g.player.hp=g.player.maxHp-5;
  u.props().onRest(g.world5!.restPoints[0]!.interactableId);
  expect(g.hasFoundationRestPoint()).toBe(true);
  expect(JSON.parse(g.recordedInputEvents[g.recordedInputEvents.length - 1]!.data as string).payload).not.toHaveProperty('inventoryStamp');
  expect(u.s.panelOpen.value).toBe(false);
  for(let n=0;n<3&&g.isAutoTraveling();n++)h.command('auto_step');
  expect(g.world5!.simulationTicks).toBeGreaterThan(before);expect(g.player.nutrition).toBeLessThan(hunger);
  h.command('escape');expect(g.hasFoundationRestPoint()).toBe(false);u.scope.stop();
});
it('UI rest No keeps panel open and no-op, then Yes starts rest', () => {
  const {h,g}=setup();expect(h.ext('settlement','establish',establish(g)).error).toBeNull();
  expect(h.ext('settlement','build',build(g)).error).toBeNull();
  const u=session(g), before=g.world5!.simulationTicks;
  g.onConfirmRequest=()=>false;u.props().onRest(g.world5!.restPoints[0]!.interactableId);
  expect(g.hasFoundationRestPoint()).toBe(false);expect(u.s.panelOpen.value).toBe(true);expect(g.world5!.simulationTicks).toBe(before);
  g.onConfirmRequest=()=>true;u.props().onRest(g.world5!.restPoints[0]!.interactableId);
  expect(g.hasFoundationRestPoint()).toBe(true);expect(u.s.panelOpen.value).toBe(false);u.scope.stop();
});
it('management can surround occluded rock while actual marker remains visible and legal', () => {
  const {h,g}=setup();for(let y=8;y<17;y++)for(const x of [17,18])g.grid.setTerrain(x,y,TerrainType.WALL);
  (g as any).updateVision();expect(g.grid.getCell(17,12)!.isVisible).toBe(false);expect(g.grid.getCell(21,12)!.isVisible).toBe(true);
  expect(h.ext('settlement','establish',establish(g)).error).toBeNull();
});
it('a completed wall does not require its occluded management cells to be visible for expansion', () => {
  const {h,g}=setup();expect(h.ext('settlement','establish',establish(g)).error).toBeNull();
  expect(h.ext('settlement','build',build(g,'wood-wall',{x:20,y:13})).error).toBeNull();
  (g as any).updateVision();expect(g.grid.getCell(20,15)!.isVisible).toBe(false);
  const r=g.extensionRuntime!.worldStructureRegions().find(r=>r.id===current(g).regionId)!;
  expect(h.ext('settlement','expand',{...base(g),regionId:r.id,regionRevision:r.revision,sourceContainerId:null,sourceRevision:null,
    materials:[{itemDefinitionId:'settlement.wood',count:2},{itemDefinitionId:'settlement.stone',count:2}],bounds:{...r.bounds,width:10}}).error).toBeNull();
});

it('camp page owns its target independently of build cursor, preview and paid command agree', () => {
  const {g}=setup();const u=session(g);
  u.props().onTab('build');u.props().onCursor(-1,1);u.props().onTab('camp');
  expect(u.props().campTarget).toEqual({x:21,y:12});
  u.props().onCampTarget(20,13);
  expect(u.props().campBounds).toEqual({x:16,y:9,width:9,height:9});
  u.props().onFood(g.player.inventory.items.find(i=>i.consumableId==='ration_of_food')!.id,2);
  const preview={...u.props().campTarget},bounds={...u.props().campBounds};u.props().onEstablish();
  const p=JSON.parse(g.recordedInputEvents[g.recordedInputEvents.length - 1]!.data as string).payload;
  expect(p).toMatchObject({...preview,bounds});
  const c=current(g),marker=g.extensionRuntime!.worldWorkEntities().find(e=>e.id===c.markerId)!;
  expect({x:marker.x,y:marker.y}).toEqual(preview);u.scope.stop();
});
it('camp target is bounded and a failed visible target does not spend food/material/time', () => {
  const {g}=setup();const u=session(g);u.props().onCampTarget(1000,-1000);
  expect(u.props().campTarget).toEqual({x:77,y:1});
  u.props().onCampTarget(22,12);g.grid.getCell(22,12)!.isVisible=false;
  const food=g.player.inventory.items.find(i=>i.consumableId==='ration_of_food')!;
  u.props().onFood(food.id,2);const ticks=g.world5!.simulationTicks,inventory=inventoryStamp(g.player.inventory.items);
  u.props().onEstablish();expect(g.world5!.simulationTicks).toBe(ticks);
  expect(inventoryStamp(g.player.inventory.items)).toBe(inventory);expect(u.s.panelOpen.value).toBe(true);u.scope.stop();
});
it('collapsed selection does not claim movement, while expanded selection consumes only arrows', () => {
  const {g}=setup();const u=session(g);u.props().onTab('build');
  expect(u.key('ArrowDown')).toBe(true);expect(u.key('k')).toBe(false);
  u.props().onCollapse();expect(u.props().collapsed).toBe(true);expect(u.key('ArrowDown')).toBe(false);
  expect(u.s.panelOpen.value).toBe(true);u.scope.stop();
});
it('unseen actual marker/build requests deny generically, surrounding hidden machines reveal no detail', () => {
  const {h,g}=setup();g.grid.getCell(21,12)!.isVisible=false;
  expect(h.ext('settlement','establish',establish(g)).error).toBe('C5_BLOCKED');
  g.grid.getCell(21,12)!.machineNumber=99;
  expect(h.ext('settlement','establish',establish(g)).error).toBe('C5_BLOCKED');
  g.grid.getCell(21,12)!.machineNumber=0;g.grid.getCell(21,12)!.isVisible=true;
  g.grid.getCell(18,9)!.isVisible=false;g.grid.getCell(18,9)!.machineNumber=99;
  expect(h.ext('settlement','establish',establish(g)).error).toBeNull();
  g.grid.getCell(20,13)!.isVisible=false;
  expect(h.ext('settlement','build',build(g)).error).toBe('C5_BLOCKED');
  g.grid.getCell(20,13)!.machineNumber=99;
  expect(h.ext('settlement','build',build(g)).error).toBe('C5_BLOCKED');
});
it('formal rest waits for native pending confirmation and keeps No/rejected attempts visible', () => {
  const {h,g}=setup();expect(h.ext('settlement','establish',establish(g)).error).toBeNull();
  expect(h.ext('settlement','build',build(g)).error).toBeNull();const u=session(g),id=g.world5!.restPoints[0]!.interactableId;
  g.onCommandConfirmRequest=()=>{};u.props().onRest(id);
  expect(g.hasPendingConfirmation).toBe(true);expect(u.s.panelOpen.value).toBe(true);expect(g.hasFoundationRestPoint()).toBe(false);
  g.resolveCommandDecision(g.pendingCommandConfirmation!.token,false);u.s.refresh();
  expect(u.s.panelOpen.value).toBe(true);expect(g.hasFoundationRestPoint()).toBe(false);
  u.props().onRest(id);g.resolveCommandDecision(g.pendingCommandConfirmation!.token,true);u.s.refresh();
  expect(g.hasFoundationRestPoint()).toBe(true);expect(u.s.panelOpen.value).toBe(false);
  h.command('escape');u.s.commands.value[0]!.invoke();g.player.loc={x:25,y:12};u.s.refresh();
  u.props().onRest(id);expect(g.hasPendingConfirmation).toBe(false);expect(g.hasFoundationRestPoint()).toBe(false);
  expect(u.s.panelOpen.value).toBe(true);expect(u.props().model.lastError).toBe('C5_DISTANCE');u.scope.stop();
});
it('native panel renders the selected camp target, bounds and editable coordinates', async () => {
  const {g}=setup();const u=session(g);u.props().onCampTarget(20,13);
  const [{createSSRApp},{renderToString},{default:I18NextVue},{default:i18next},{default:Panel},{default:locale}]=await Promise.all([
    import('vue'),import('@vue/server-renderer'),import('i18next-vue'),import('i18next'),import('../ui/SettlementPanel.vue'),import('../locales/zh_CN.json')]);
  i18next.addResourceBundle('en','translation',locale,true,true);
  const app=createSSRApp(Panel,u.props());app.use(I18NextVue,{i18next});
  const html=await renderToString(app);
  // The panel teleports to body; server-renderer context carries its actual DOM.
  const ctx: {teleports?:Record<string,string>}={};await renderToString(app,ctx);
  const body=ctx.teleports?.body??html;
  expect(body).toContain('value="20"');expect(body).toContain('value="13"');
  expect(body).toContain('20');expect(body).toContain('9×9');
  expect(body).toContain('data-action="toggle-drawer"');u.scope.stop();
});
it('management still rejects same-level region conflicts atomically', () => {
  const {h,g}=setup();expect(h.ext('settlement','establish',establish(g)).error).toBeNull();
  const ticks=g.world5!.simulationTicks,inventory=inventoryStamp(g.player.inventory.items),regions=structuredClone(g.extensionRuntime!.worldStructureRegions());
  const second={...establish(g),x:20,y:13};
  expect(h.ext('settlement','establish',second).error).toBe('C5_OVERLAP');
  expect(g.extensionRuntime!.worldStructureRegions()).toEqual(regions);expect(g.world5!.simulationTicks).toBe(ticks);
  expect(inventoryStamp(g.player.inventory.items)).toBe(inventory);
});
it('a boundary that cuts a hidden work footprint reports only a generic denial', () => {
  const {h,g}=setup();g.extensionRuntime!.worldWorkPlace({owner:'settlement',depth:1,x:16,y:12,
    instanceKey:'cut-boundary',contentId:'settlement.wood-node',nameKey:'ext.settlement.wood-node.name',descriptionKey:'ext.settlement.wood-node.description',glyph:'木',color:'#aaaaaa',interactionDistance:1,priority:0});
  g.grid.getCell(16,12)!.isVisible=false;expect(h.ext('settlement','establish',establish(g)).error).toBe('C5_BLOCKED');
  for(let y=11;y<=13;y++)for(let x=15;x<=17;x++)g.grid.getCell(x,y)!.isVisible=true;
  expect(h.ext('settlement','establish',establish(g)).error).toBe('C5_PROTECTED');
});
