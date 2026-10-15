import '../../../../i18n';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import foundationLocale from '../../../../locales/zh_CN.json';
import locale from '../locales/zh_CN.json';
import errorLabels from '../data/ui-errors.json';
import { readFileSync } from 'node:fs';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import { setup, establish, current } from './helpers';
import { residentScene } from './residentHelpers';
import { useSettlementUi } from '../ui/useSettlementUi';
import { MonsterState } from '../../../../entities/Monster';
import { Item, ItemCategory } from '../../../../engine/Items/Item';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { worldWorkLastError } from '../../../../engine/Core/WorldWork';

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
let Panel: Vue.Component;
beforeAll(async () => { vi.stubGlobal('document', { activeElement: null, addEventListener() {}, removeEventListener() {}, querySelector() { return null; } }); Panel = await createSfcHarness({ baseURL: import.meta.url }).load('../ui/SettlementPanel.vue'); });
afterAll(() => vi.unstubAllGlobals());
async function mount(g: ReturnType<typeof setup>['g']) {
  i18next.addResourceBundle(i18next.language, 'translation', { ...foundationLocale, ...locale }, true, true);
  const scope = Vue.effectScope();
  const session = scope.run(() => useSettlementUi({ game: () => g, tick: Vue.ref(0), immersive: Vue.ref(false),
    canOpenPanel: () => true, beforeOpenPanel() {}, afterClosePanel() {} }))!;
  session.commands.value[0]!.invoke();
  const props = () => session.panel.value!.props as any;
  const root = node();
  const app = renderer.createApp({ setup: () => () => session.panel.value ? Vue.h(Panel, props()) : null });
  app.use(I18NextVue, { i18next }); app.mount(root); await Vue.nextTick();
  const button = (label: string) => {
    const result = all(body).find(n => n.tag === 'button' && text(n).includes(label));
    expect(result, label).toBeDefined(); return result!;
  };
  async function click(label: string) {
    const b = button(label); expect(b.props.disabled).not.toBe(true); b.props.onClick(); await Vue.nextTick();
  }
  async function refresh() { session.refresh(); await Vue.nextTick(); }
  return { props, session, button, click, refresh, text: () => text(body),
    dispose() { app.unmount(); scope.stop(); body.children = []; } };
}
function mango(g: ReturnType<typeof setup>['g'], quantity: number) {
  const item = new Item('mango', '%', 0xffffff, ItemCategory.FOOD);
  item.consumableId = 'mango'; item.quantity = quantity;
  // Put mango before ration to prove priority is semantic, not array order.
  g.player.inventory.items.unshift(item); return item;
}
function unchanged(g: ReturnType<typeof setup>['g']) {
  return { world: structuredClone(g.world5), inventory: structuredClone(g.player.inventory.items),
    random: rng.getState(), id: getNextEntityId(), events: g.recordedInputEvents.length, turn: g.absoluteTurnNumber };
}
it('client SFC defaults two rations, preserves manual input on ordinary polls, and refills on food changes/reopen', async () => {
  const { g } = setup(); const fruit = mango(g, 2);
  const ration = g.player.inventory.items.find(i => i.consumableId === 'ration_of_food')!;
  const before = unchanged(g), u = await mount(g);
  try {
    expect(u.props().food).toEqual({ [ration.id]: 2 });
    const input = all(body).find(n => n.tag === 'input' && n.props.value === 2)!;
    input.props.onInput({ target: { value: '1' } }); await Vue.nextTick();
    expect(u.props().food).toEqual({ [ration.id]: 1 });
    for (let i = 0; i < 5; i++) await u.refresh();
    expect(u.props().food).toEqual({ [ration.id]: 1 });
    expect(u.text()).toContain('还缺 1 份口粮或芒果');
    expect(u.button('建营地 ·').props.disabled).toBe(true);
    expect(unchanged(g)).toEqual(before);
    // Non-food inventory changes must not overwrite the manual draft.
    g.player.inventory.items.find(i => i.worldItem?.definitionId === 'settlement.wood')!.quantity--;
    await u.refresh(); expect(u.props().food).toEqual({ [ration.id]: 1 });
    ration.quantity = 1; await u.refresh();
    expect(u.props().food).toEqual({ [ration.id]: 1, [fruit.id]: 1 });
    u.props().onFood(fruit.id, 0); await u.refresh(); expect(u.props().food[fruit.id]).toBe(0);
    u.session.close(); u.session.commands.value[0]!.invoke(); await Vue.nextTick();
    expect(u.props().food).toEqual({ [ration.id]: 1, [fruit.id]: 1 });
    g.player.inventory.items.splice(g.player.inventory.items.indexOf(ration), 1); await u.refresh();
    expect(u.props().food).toEqual({ [fruit.id]: 2 });
    fruit.quantity = 1; await u.refresh(); expect(u.text()).toContain('还缺 1 份口粮或芒果');
    g.player.inventory.items.splice(g.player.inventory.items.indexOf(fruit), 1); await u.refresh();
    expect(u.props().food).toEqual({}); expect(u.text()).toContain('还缺 2 份口粮或芒果');
  } finally { u.dispose(); }
});
it.each([2, 1, 0])('default food with %i rations locks exactly two native food units through the real command', async rations => {
  const { g } = setup(['settlement'], 1, 2);
  const ration = g.player.inventory.items.find(i => i.consumableId === 'ration_of_food')!;
  if (rations) ration.quantity = rations;
  else g.player.inventory.items.splice(g.player.inventory.items.indexOf(ration), 1);
  if (rations < 2) mango(g, 2 - rations);
  const u = await mount(g);
  try {
    await u.click('建营地 ·');
    expect(current(g).locked.reduce((sum, item) => sum + item.quantity, 0)).toBe(2);
    expect(worldWorkLastError(g)).toBeNull();
  } finally { u.dispose(); }
});
it.each([
  ['materials', 'C5_INPUT', '材料不足。'],
  ['distance', 'C5_DISTANCE', '距离太远。'],
  ['target', 'C5_BLOCKED', '目标位置无法使用。'],
  ['enemy', 'C5_THREAT', '附近有敌人。']
])('real establish rejection %s renders the SDK reason without spending time, inventory or RNG', async (kind, code, label) => {
  const { g } = setup();
  if (kind === 'materials') g.player.inventory.items.find(i => i.worldItem?.definitionId === 'settlement.wood')!.quantity = 1;
  if (kind === 'target') { Object.assign(g.lightMap.lightAt(21, 12)!, { r: 0, g: 0, b: 0 }); g.grid.getCell(21, 12)!.isVisible = false; }
  if (kind === 'enemy') { const m = g.monsters.find(m => !m.isAlly)!; m.loc = { x: 20, y: 13 }; (g as any).updateVision(false); }
  const u = await mount(g);
  try {
    if (kind === 'distance') u.props().onCampTarget(24, 12);
    if (kind === 'materials') expect(u.text()).toContain('建材不足：木材 1/4');
    const before = unchanged(g);
    await u.click('建营地 ·');
    expect(worldWorkLastError(g)).toBe(code); expect(u.text()).toContain(label);
    expect(u.text()).not.toContain(locale['ext.settlement.ui.rejected']);
    expect(unchanged(g)).toEqual({ ...before, events: before.events + 1 });
  } finally { u.dispose(); }
});
it('build, storage and harvest show actual SDK failures; disabled draft/reserve actions explain why', async () => {
  const { g, h } = setup(); expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  const u = await mount(g);
  try {
    await u.click('建造'); expect(u.text()).toContain('请先选择目标格并加入施工草稿');
    expect(u.button('确认逐格施工').props.disabled).toBe(true);
    u.props().onCursor(3, 0); await u.click('加入草稿'); await u.click('确认逐格施工');
    expect(worldWorkLastError(g)).toBe('C5_DISTANCE'); expect(u.text()).toContain('距离太远。');
    await u.click('库存'); expect(u.text()).toContain('建营储粮不可取出，撤营时退还。');
    expect(u.button('取出 ·').props.disabled).toBe(true);
    const c = current(g);
    // Exercise a stale/forced public attempt too; UI gating is not the authority.
    u.props().onTransfer(c.supplyId, c.locked[0]!.itemId, 1, 'withdraw'); await Vue.nextTick();
    expect(worldWorkLastError(g)).toBe('C5_RESERVED'); expect(u.text()).toContain('资源已被预留。');
    const n = g.world5!.nodes[0]!; g.player.loc = { x: n.at.x + 2, y: n.at.y };
    (g as any).updateVision(false); await u.refresh(); await u.click('采集');
    expect(u.props().model.nodes.some((row: any) => row.interactableId === n.interactableId)).toBe(true);
    u.props().onHarvest(n.interactableId); await Vue.nextTick();
    expect(worldWorkLastError(g)).toBe('C5_DISTANCE'); expect(u.text()).toContain('距离太远。');
  } finally { u.dispose(); }
});
it('no camp, draft limit, excess food actions have visible disabled explanations', async () => {
  const { g } = setup(); const fruit = mango(g, 2); const u = await mount(g);
  try {
    u.props().onFood(fruit.id, 2); await Vue.nextTick();
    expect(u.text()).toContain('需恰好存入 2 份'); expect(u.button('建营地 ·').props.disabled).toBe(true);
    await u.click('建造'); expect(u.text()).toContain('请先在当前层建立营地');
    expect(u.button('加入草稿').props.disabled).toBe(true);
    await u.click('营地'); u.props().onFood(fruit.id, 0); await Vue.nextTick(); await u.click('建营地 ·');
    await u.click('建造');
    for (let i = 0; i < 16; i++) { u.props().onCursor(1, 0); u.props().onAppend(); }
    await Vue.nextTick(); expect(u.button('加入草稿').props.disabled).toBe(true);
    expect(u.text()).toContain('施工草稿已达 16 格上限');
  } finally { u.dispose(); }
});

it('replay remains readonly with a visible explanation and no state/RNG/recording writes', async () => {
  const { g } = setup(); expect(g.loadReplay(g.exportRecording())).toBe(true);
  const before = unchanged(g), u = await mount(g);
  try {
    expect(u.text()).toContain('回放只读'); expect(u.button('建营地 ·').props.disabled).toBe(true);
    await u.refresh(); expect(unchanged(g)).toEqual(before);
  } finally { u.dispose(); }
});

it('SDK error vocabulary maps completely to existing foundation translations', () => {
  const sdk = readFileSync(new URL('../../../worldSdk.ts', import.meta.url), 'utf8');
  const codes = [...sdk.split('export type WorldErrorCode =')[1]!.split(';')[0]!.matchAll(/'(C5_[A-Z_]+)'/g)].map(m => m[1]);
  expect(errorLabels.map(row => row.code)).toEqual(codes);
  for (const row of errorLabels) expect(foundationLocale[row.reasonKey as keyof typeof foundationLocale]).toBeTruthy();
});

it('resident buttons explain their distance and missing selection gates in the actual child SFC', async () => {
  const { g, a } = residentScene();
  g.player.loc = { x: 19, y: 15 }; g.refreshStructureDerivedState();
  const before = unchanged(g), u = await mount(g);
  try {
    await u.click('居民');
    const select = all(body).find(n => n.props['data-select-resident'] === a.id)!;
    expect(select).toBeDefined(); select.props.onClick(); await Vue.nextTick();
    expect(u.text()).toContain('距离太远。');
    expect(u.text()).toContain('请选择源箱和目的箱');
    expect(u.text()).toContain('需要选择 1–6 块种植床');
    expect(u.button('下单生产').props.disabled).toBe(true);
    expect(unchanged(g)).toEqual(before);
  } finally { u.dispose(); }
});

it('construction keeps the failed suffix and precise numbered reason across polls and tabs, then resumes an edited draft', async () => {
  const { g, h } = setup(); expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  const u = await mount(g);
  try {
    await u.click('建造');
    u.props().onCursor(0, 1); await u.click('加入草稿'); // (21,13), in reach
    u.props().onCursor(1, 0); await u.click('加入草稿'); // (22,13), too far
    u.props().onCursor(1, 0); await u.click('加入草稿'); // (23,13), unattempted
    const events = g.recordedInputEvents.length, tick = g.world5!.simulationTicks;
    await u.click('确认逐格施工');
    for (let n = 0; n < 5; n++) await u.refresh();
    expect(g.world5!.structures).toHaveLength(1);
    expect(g.recordedInputEvents.length - events).toBe(2);
    expect(g.world5!.simulationTicks - tick).toBe(100);
    expect(u.props().draft.map((p: any) => [p.x, p.y])).toEqual([[22, 13], [23, 13]]);
    expect(u.text()).toContain('第 2 格 (22,13) 未施工：距离太远。');
    await u.click('库存');
    const wood = g.player.inventory.items.find(i => i.worldItem?.definitionId === 'settlement.wood')!;
    u.props().onTransfer(current(g).supplyId, wood.id, 1, 'deposit'); await u.refresh();
    expect(worldWorkLastError(g)).toBeNull();
    await u.click('建造');
    expect(u.text()).toContain('第 2 格 (22,13) 未施工：距离太远。');
    await u.click('移出草稿'); await u.click('移出草稿');
    u.props().onCursor(-3, 0); await u.click('加入草稿'); // corrected to (20,13)
    await u.click('确认逐格施工');
    for (let n = 0; n < 3; n++) await u.refresh();
    expect(g.world5!.structures).toHaveLength(2);
    expect(u.props().draft).toEqual([]);
    expect(u.text()).not.toContain('未施工：');
  } finally { u.dispose(); }
});
it.each(['materials', 'cancel', 'sleeping-threat'] as const)('first-cell %s stop persists without consuming the unfinished draft', async kind => {
  const { g, h } = setup(); expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  if (kind === 'materials') g.player.inventory.items.find(i => i.worldItem?.definitionId === 'settlement.wood')!.quantity = 0;
  else if (kind === 'cancel') g.onConfirmRequest = () => false;
  else {
    const monster = g.monsters.find(m => !m.isAlly)!;
    monster.loc = { x: 20, y: 13 }; monster.state = MonsterState.ASLEEP;
    (g as any).updateVision(false);
  }
  const u = await mount(g);
  try {
    await u.click('建造'); u.props().onCursor(0, 1); await u.click('加入草稿');
    const tick = g.world5!.simulationTicks;
    await u.click('确认逐格施工');
    for (let n = 0; n < 5; n++) await u.refresh();
    expect(u.props().draft).toHaveLength(1);
    expect(g.world5!.simulationTicks).toBe(tick);
    expect(g.world5!.structures).toEqual([]);
    expect(u.text()).toContain('第 1 格 (21,13) 未施工：' + (kind === 'materials' ? '材料不足。' : kind === 'cancel' ? '已取消确认。' : '附近有敌人。'));
  } finally { u.dispose(); }
});
