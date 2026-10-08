import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import '../../../../i18n';
import { arriveNatural, settle, world } from './giants2NaturalFixture';
import { footprintOf, commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { withBodyContact } from '../../../../engine/Combat/BodyCombat';
import { observeDisplayFrame, type DisplayFrame } from '../../../../ui/displayProjection';
import { PresentationTimeline } from '../../../../ui/presentationTimeline';
import { observePresentation } from '../../../../engine/Core/PresentationObserver';
import { selectBossHud } from '../ui/view';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { targetingState } from '../../../../ui/targeting';
import { MonsterState } from '../../../../entities/Monster';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import type { Game } from '../../../../engine/Core/Game';

interface Node {
  type: string;
  text: string;
  props: Record<string, unknown>;
  children: Node[];
  parent: Node | null;
  clientWidth: number;
}
const node = (type = '', text = '', width = 320): Node => ({
  type,
  text,
  props: {},
  children: [],
  parent: null,
  clientWidth: width
});
const renderer = Vue.createRenderer<Node, Node>({
  createElement: (type) => node(type),
  createText: (text) => node('text', text),
  createComment: () => node('comment'),
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
  setText: (n, text) => {
    n.text = text;
  },
  setElementText: (n, text) => {
    n.text = text;
    n.children = [];
  },
  parentNode: (n) => n.parent,
  nextSibling: (n) => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  patchProp: (n, key, _old, value) => {
    n.props[key] = value;
  }
});
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const text = (n: Node): string => n.text + n.children.map(text).join('');
const apps: ReturnType<typeof renderer.createApp>[] = [];
afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  targetingState.aim = null;
  logger.observeMessages(null);
  logger.presentAcknowledgments(null);
  logger.reset();
});

/** Explicit diagnostic visibility/HP setup, not natural-trace evidence.
 * Both actors originate from untouched production generation. */
function show(game: Game) {
  for (let y = 0; y < game.grid.height; y++)
    for (let x = 0; x < game.grid.width; x++) {
      const cell = game.grid.getCell(x, y)!;
      cell.isVisible = true;
      cell.isClairvoyantVisible = false;
    }
}
// Read through a function so prior null assignments do not narrow a later method-populated property.
const inspectedName = (game: Game) => game.inspectTarget?.name;
function captureFrames() {
  const { game, boss } = arriveNatural('lantern', 1);
  commitCreatureAnchor(game.player, { x: boss.x - 2, y: boss.y });
  show(game);
  const mantle = footprintOf(boss).find((p) => p.zoneId === 'mantle')!;
  targetingState.aim = { x: mantle.x, y: mantle.y };
  game.updateHover(mantle.x, mantle.y);
  game.handleInspectAt(mantle.x, mantle.y);
  expect(inspectedName(game)).toContain('盲灯蜷兽');
  expect(game.hoveredText).toContain('灯褶');
  const intact = observeDisplayFrame(game, logger);
  expect(selectBossHud(intact)).toMatchObject({
    name: '盲灯蜷兽',
    hp: 84,
    zone: { id: 'mantle', hp: 18, broken: false }
  });
  const t = new PresentationTimeline(game, logger);
  logger.presentAcknowledgments(() => true);
  logger.log('giants2 historical fixture', '#fff', { acknowledge: true });
  const acknowledgment = t.acknowledgment!;
  expect(acknowledgment).toBeDefined();
  withBodyContact(boss, mantle, () => boss.takeDamage(100, true, game.grid, undefined, 'physical'));
  show(game);
  const broken = observeDisplayFrame(game, logger);
  expect(selectBossHud(broken)).toMatchObject({
    hp: 66,
    zone: { id: 'mantle', hp: 0, broken: true }
  });
  observePresentation(game, 'command-complete');
  expect(selectBossHud(t.projection!)).toMatchObject({ hp: 84, zone: { hp: 18, broken: false } });
  const randomAtAck = rng.getState(),
    worldAtAck = world(game);
  expect(t.acknowledge(acknowledgment)).toBe(true);
  expect(world(game)).toBe(worldAtAck);
  expect(rng.getState()).toEqual(randomAtAck);
  t.dispose();
  game.inspectTarget = null;
  targetingState.aim = null;
  boss.hp = 42;
  boss.state = MonsterState.HUNTING;
  boss.ticksUntilTurn = 0;
  game.executeCommand('wait');
  settle(game);
  show(game);
  expect(boss.typeId).toBe('giants.blind-lantern-open');
  const opened = observeDisplayFrame(game, logger);
  expect(selectBossHud(opened)).toMatchObject({ id: boss.id, name: '展躯盲灯兽', hp: 42 });
  expect(selectBossHud(opened)?.zone?.id).toBe('wick');
  game.handleInspectAt(boss.x, boss.y);
  expect(inspectedName(game)).toContain('展躯盲灯兽');
  expect(selectBossHud(intact)?.name).toBe('盲灯蜷兽');
  const before = world(game),
    random = rng.getState();
  for (let i = 0; i < 5; i++) {
    observeDisplayFrame(game, logger);
    selectBossHud(intact);
    selectBossHud(broken);
    selectBossHud(opened);
  }
  expect(world(game)).toBe(before);
  expect(rng.getState()).toEqual(random);

  const copper = arriveNatural('copper', 2);
  const body = copper.boss,
    cg = copper.game;
  commitCreatureAnchor(cg.player, { x: body.x - 3, y: body.y });
  show(cg);
  const complete = observeDisplayFrame(cg, logger),
    group = cg.bodyGroups!.find((g) => g.coreId === body.id)!;
  expect(selectBossHud(complete)).toMatchObject({
    name: '铜须伏螯',
    hp: 108,
    members: { alive: 4, broken: 0 }
  });
  expect(
    complete.rows.filter((r) => r.kind === 'monster' && r.bodyGroup?.groupId === group.groupId)
  ).toHaveLength(1);
  cg.handleInspectAt(body.x, body.y);
  expect(JSON.stringify(cg.inspectTarget)).toContain('伏螯节须');
  const limb = cg.monsters.find(
    (m) => m.spatial?.bodyMember?.groupId === body.id && m.id !== body.id
  )!;
  const other = cg.monsters.find(
    (m) => m.spatial?.bodyMember?.groupId === body.id && m.id !== body.id && m !== limb
  )!;
  limb.takeDamage(100, true, cg.grid);
  show(cg);
  const severed = observeDisplayFrame(cg, logger);
  expect(selectBossHud(severed)).toMatchObject({ hp: 104, members: { alive: 3, broken: 1 } });
  for (const p of footprintOf(other)) cg.grid.getCell(p.x, p.y)!.isVisible = false;
  const partial = observeDisplayFrame(cg, logger);
  expect(selectBossHud(partial)?.members).toEqual({ alive: 2 });
  expect(partial.bodyGroups![0]!.members.some((m) => m.entityId === other.id)).toBe(false);
  for (const p of footprintOf(body)) cg.grid.getCell(p.x, p.y)!.isVisible = false;
  const hidden = observeDisplayFrame(cg, logger);
  expect(selectBossHud(hidden)).toBeNull();
  expect(hidden.rows.some((r) => r.kind === 'monster' && r.id === body.id && r.hp > 0)).toBe(false);
  show(cg);
  cg.player.applyStatus('hallucinating', 10);
  const hallucinated = observeDisplayFrame(cg, logger);
  expect(selectBossHud(hallucinated)).toBeNull();
  expect(hallucinated.bodyGroups).toEqual([]);
  const state = world(cg),
    streams = rng.getState();
  for (let i = 0; i < 5; i++) {
    observeDisplayFrame(cg, logger);
    selectBossHud(complete);
    selectBossHud(severed);
    selectBossHud(partial);
  }
  expect(world(cg)).toBe(state);
  expect(rng.getState()).toEqual(streams);
  expect(selectBossHud(complete)).toMatchObject({ hp: 108, members: { alive: 4, broken: 0 } });
  return { game: cg, intact, broken, opened, complete, severed, partial, hidden, hallucinated };
}
let cached: ReturnType<typeof captureFrames> | undefined;
const frames = () => (cached ??= captureFrames());

describe('G2-UI real DisplayFrame to client SFC (component host; not CSS/browser matrix)', () => {
  it('captures actual intact/broken/phase/body visibility and ACK histories without changing either simulation RNG', () => {
    frames();
  }, 300000);
  it.each([1440, 390, 320])(
    'actual HUD and sidebar render real historic states at host width %i',
    async (width) => {
      const f = frames(),
        current = Vue.shallowRef<DisplayFrame>(f.intact),
        hidden = Vue.ref(false);
      const polls: (() => void)[] = [];
      const win = Object.assign(new EventTarget(), {
        innerWidth: width,
        innerHeight: width === 1440 ? 900 : 844,
        setInterval: (callback: () => void) => {
          polls.push(callback);
          return 0;
        }
      });
      vi.stubGlobal('window', win);
      const harness = createSfcHarness({
        baseURL: import.meta.url,
        stubs: {
          '../../../../engine/Core/Game': { activeGame: f.game },
          '../../../../ui/useGameHud': {
            displayedFrame: () => current.value,
            playerHudStatusRows: () => []
          }
        }
      });
      const Hud = await harness.load('../ui/BossHud.vue'),
        Sidebar = await harness.load('../../../../components/Sidebar.vue');
      const root = node('root', '', width);
      const app = renderer.createApp({
        render: () =>
          Vue.h('section', {}, [
            selectBossHud(current.value)
              ? Vue.h(Hud, {
                  model: selectBossHud(current.value)!,
                  presentationHidden: hidden.value
                })
              : null,
            Vue.h(Sidebar, { variant: width < 600 ? 'drawer' : 'panel' })
          ])
      });
      app.use(I18NextVue, { i18next });
      apps.push(app);
      app.mount(root);
      polls.forEach((poll) => poll());
      await Vue.nextTick();
      expect(text(root)).toContain('盲灯蜷兽');
      expect(text(root)).toContain('灯褶 18 / 18');
      const set = async (frame: DisplayFrame) => {
        current.value = frame;
        polls.forEach((poll) => poll());
        await Vue.nextTick();
      };
      await set(f.broken);
      expect(text(root)).toContain('灯褶 0 / 18 已破坏');
      await set(f.opened);
      expect(text(root)).toContain('展躯盲灯兽');
      expect(
        text(all(root).find((n) => String(n.props.class).includes('giants-boss-hud'))!)
      ).not.toContain('灯褶');
      await set(f.complete);
      expect(text(root)).toContain('铜须伏螯');
      expect(text(root)).toContain('4 存活 / 0 折断');
      expect(
        all(root).filter((n) => n.props['data-entity-id'] === selectBossHud(f.complete)!.id)
      ).toHaveLength(1);
      await set(f.severed);
      expect(text(root)).toContain('3 存活 / 1 折断');
      await set(f.partial);
      expect(text(root)).toContain('可见外围：2');
      expect(
        text(all(root).find((n) => String(n.props.class).includes('giants-boss-hud'))!)
      ).not.toContain('折断');
      await set(f.hidden);
      expect(all(root).some((n) => String(n.props.class).includes('giants-boss-hud'))).toBe(false);
      await set(f.hallucinated);
      expect(all(root).some((n) => String(n.props.class).includes('giants-boss-hud'))).toBe(false);
      await set(f.intact);
      expect(text(root)).toContain('盲灯蜷兽');
      expect(text(root)).toContain('84 / 84');
      hidden.value = true;
      await Vue.nextTick();
      expect(all(root).some((n) => String(n.props.class).includes('presentation-hidden'))).toBe(
        true
      );
    },
    300000
  );
});
