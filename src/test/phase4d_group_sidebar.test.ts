import { afterEach, expect, it, vi } from 'vitest';
import '../i18n';
import { productionBodyScene } from './support/productionComposite';
import { publicSidebarEntityRows, bodyMemberSummary } from '../engine/UI/MonsterGroups';
import { sidebarEntityRows } from '../engine/UI/MonsterSidebar';
import { nearbyDetail } from '../ui/nearbyInspection';
import { observeDisplayFrame } from '../ui/displayProjection';
import { footprintOf } from '../engine/Movement/CreatureSpatial';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import * as Vue from 'vue';
import i18next from 'i18next';
import I18NextVue from 'i18next-vue';
import { createSfcHarness } from './support/sfcHarness';
const mounted: Array<{ unmount(): void }> = [];
afterEach(() => { mounted.splice(0).forEach(app => app.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); logger.reset(); });

function scene() {
  const { game } = productionBodyScene();
  // Exercise installed formal content, including the reported two-body case.
  game.monsters = []; game.bodyGroups = [];
  const a = game.createCompositeMonster('giants.shale-weaver-body', { x: 14, y: 12 })!;
  const b = game.createCompositeMonster('giants.shale-weaver-body', { x: 24, y: 12 })!;
  for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
    const c = game.grid.getCell(x, y)!; c.isVisible = c.isDiscovered = true; c.isClairvoyantVisible = false;
  }
  return { game, a, b, leg: game.monsters.find(m => m.spatial?.bodyMember?.groupId === a.id && m.id !== a.id)! };
}

it('two formal bodies occupy two rows with core HP, while native leg identity and focus survive', () => {
  const { game, a, b, leg } = scene(); game.hoveredCell = { ...leg.loc };
  expect(sidebarEntityRows(game.player, game.grid, game.monsters, []).filter(r => r.kind === 'monster')).toHaveLength(18);
  const rows = publicSidebarEntityRows(game).filter(r => r.kind === 'monster');
  expect(rows.map(r => r.id)).toEqual([a.id, b.id]);
  expect(rows[0]).toMatchObject({ hp: 96, maxHp: 96, focused: true });
  expect(bodyMemberSummary(rows[0]!.bodyGroup!)).toBe('成员存活 8 · 破坏 0');
  expect(game.getMonsterAt(leg.x, leg.y)).toBe(leg);
  const before = rng.getState(); game.handleInspectAt(leg.x, leg.y);
  expect(game.inspectTarget?.name).toBe(leg.name);
  expect(game.inspectTarget?.sections.some(s => s.header === '可见成员')).toBe(false);
  game.handleInspectAt(a.x, a.y);
  expect(game.inspectTarget?.sections.find(s => s.header === '可见成员')?.lines).toHaveLength(9);
  expect(rng.getState()).toEqual(before);
});

it('broken slots update the group row and core inspection, leaving frozen history unchanged', () => {
  const { game, a, leg } = scene();
  const frame = observeDisplayFrame(game, logger), old = JSON.stringify(frame);
  leg.takeDamage(leg.hp, true);
  const row = publicSidebarEntityRows(game).find(r => r.kind === 'monster' && r.id === a.id)!;
  expect(row.kind === 'monster' && bodyMemberSummary(row.bodyGroup!)).toBe('成员存活 7 · 破坏 1');
  expect(row.kind === 'monster' && row.hp).toBe(93);
  const detail = nearbyDetail(game, row)!;
  expect(detail.sections.find(s => s.header === '可见成员')?.lines).toHaveLength(8);
  expect(JSON.stringify(frame)).toBe(old);
  expect(frame.rows.filter(r => r.kind === 'monster')).toHaveLength(2);
});

it('partial visibility reveals no hidden member HP/ID or precise break count, and hidden core is not grouped', () => {
  const { game, a, leg } = scene();
  game.grid.getCell(leg.x, leg.y)!.isVisible = false;
  let row = publicSidebarEntityRows(game).find(r => r.kind === 'monster' && r.id === a.id)!;
  expect(row.kind === 'monster' && bodyMemberSummary(row.bodyGroup!)).toBe('可见成员 7');
  expect(row.kind === 'monster' && row.bodyGroup?.members.some(m => m.entityId === leg.id)).toBe(false);
  expect(nearbyDetail(game, row)?.sections.find(s => s.header === '可见成员')?.lines).toHaveLength(8);
  for (const p of footprintOf(a)) game.grid.getCell(p.x, p.y)!.isVisible = false;
  const rows = publicSidebarEntityRows(game).filter(r => r.kind === 'monster');
  expect(rows.some(r => r.id === a.id)).toBe(false);
  expect(rows.filter(r => r.bodyGroup)).toHaveLength(1);
  expect(rows.filter(r => !r.bodyGroup)).toHaveLength(7);
  expect(nearbyDetail(game, row)).toBeNull();
});

it('hallucination does not publish membership; stale limb rows remain independently visibility checked', () => {
  const { game, leg } = scene();
  const row = sidebarEntityRows(game.player, game.grid, game.monsters, []).find(r => r.id === leg.id)!;
  expect(nearbyDetail(game, row)?.name).toBe(leg.name);
  game.grid.getCell(leg.x, leg.y)!.isVisible = false;
  expect(nearbyDetail(game, row)).toBeNull();
  game.player.applyStatus('hallucinating', 10);
  expect(publicSidebarEntityRows(game).some(r => r.kind === 'monster' && r.bodyGroup)).toBe(false);
});

interface Node { type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null; focus(): void }
const node = (type: string, text = ''): Node => ({ type, text, props: {}, children: [], parent: null, focus() {} });
const renderer = Vue.createRenderer<Node, Node>({
  createElement: type => node(type), createText: text => node('text', text), createComment: () => node('comment'),
  insert(child, parent, anchor) { child.parent?.children.splice(child.parent.children.indexOf(child), 1);
    const i = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(i < 0 ? parent.children.length : i, 0, child); child.parent = parent; },
  remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
  setText: (n, text) => { n.text = text; }, setElementText: (n, text) => { n.text = text; n.children = []; },
  parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  patchProp: (n, key, _old, value) => { n.props[key] = value; }
});
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const content = (n: Node): string => n.text + n.children.map(content).join('');

// Real scripts, templates, lifecycle and click/keyboard controls. This host
// verifies client rendering; it does not implement browser CSS or touch layout.
it.each([[320,'theme/ThemeNearby'],[390,'theme/ThemeNearby'],[320,'ContextPanel'],[390,'ContextPanel']] as const)
('nearby client at width %i in %s renders two group rows, inspects members and polls frozen frames', async (width, componentName) => {
  const { game, a, leg } = scene();
  let frame = observeDisplayFrame(game, logger);
  const callbacks: Array<() => void> = [];
  vi.stubGlobal('window', { innerWidth: width, innerHeight: 844, setInterval: (fn: () => void) => { callbacks.push(fn); return 1; }, clearInterval() {} });
  const harness = createSfcHarness({ baseURL: import.meta.url, stubs: {
    '../engine/Core/Game.ts': { activeGame: game },
    '../ui/useGameHud.ts': { displayedFrame: () => frame, useGameHud: () => ({ hoverText: Vue.ref('') }) }
  } });
  const component = await harness.load(`../components/${componentName}.vue`), inspect = vi.fn(), root = node('root');
  const app = renderer.createApp(component, { onInspect: inspect }); app.use(I18NextVue, { i18next }); mounted.push(app); app.mount(root); await Vue.nextTick();
  const buttons = () => all(root).filter(n => n.type === 'button' && n.props['data-entity-kind'] === 'monster');
  expect(buttons()).toHaveLength(2); expect(content(root)).toContain('成员存活 8 · 破坏 0'); expect(content(root)).toContain('96/96');
  const button = buttons().find(n => n.props['data-entity-id'] === a.id)!;
  const random = rng.getState(), execute = vi.spyOn(game, 'executeCommand');
  button.props.onClick({ currentTarget: button });
  expect(inspect).toHaveBeenCalledOnce(); expect(inspect.mock.calls[0]![0].sections.find((s: { header?: string }) => s.header === '可见成员').lines).toHaveLength(9);
  const stop = vi.fn(); button.props.onKeydown({ stopPropagation: stop }); expect(stop).toHaveBeenCalledOnce();
  expect(execute).not.toHaveBeenCalled(); expect(rng.getState()).toEqual(random);
  leg.takeDamage(12, true); callbacks.forEach(fn => fn()); await Vue.nextTick();
  expect(content(root)).toContain('96/96'); expect(content(root)).toContain('成员存活 8 · 破坏 0');
  frame = observeDisplayFrame(game, logger); callbacks.forEach(fn => fn()); await Vue.nextTick();
  expect(content(root)).toContain('93/96'); expect(content(root)).toContain('成员存活 7 · 破坏 1'); expect(buttons()).toHaveLength(2);
});
