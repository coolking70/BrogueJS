import { describe, it, expect } from 'vitest';
import { effectScope, ref, nextTick } from 'vue';
import { setup, establish } from './helpers';
import { useSettlementUi } from '../ui/useSettlementUi';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
function ui(g: ReturnType<typeof setup>['g'], isPresentationBusy = () => false) {
  const scope = effectScope(),
    tick = ref(0);
  let map: (at: { x: number; y: number }) => void = () => {},
    keys: (e: KeyboardEvent) => boolean = () => false;
  const session = scope.run(() =>
    useSettlementUi({
      game: () => g,
      tick,
      immersive: ref(false),
      isPresentationBusy,
      canOpenPanel: () => true,
      beforeOpenPanel() {},
      afterClosePanel() {},
      selectMapCells(_owner, select) {
        map = select;
        return () => {};
      },
      registerKeyHandler(handler) {
        keys = handler;
        return () => {};
      }
    })
  )!;
  session.commands.value[0]!.invoke();
  const props = () => session.panel.value!.props as any;
  return {
    scope,
    session,
    tick,
    props,
    select: (at: { x: number; y: number }) => map(at),
    keys: (e: KeyboardEvent) => keys(e)
  };
}
describe('settlement disposable construction UI', () => {
  it('pauses a suspended confirmation queue across ACK without reading the future model', async () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    let busy = false;
    const u = ui(g, () => busy);
    u.props().onTab('build');
    for (const x of [20, 21]) {
      u.select({ x, y: 13 });
      u.props().onAppend();
    }
    g.onCommandConfirmRequest = () => {};
    const tick = g.world5!.simulationTicks;
    u.props().onConstruct();
    expect(g.hasPendingConfirmation).toBe(true);
    const displayed = u.props().model;
    busy = true;
    g.resolveCommandDecision(g.pendingCommandConfirmation!.token, true);
    u.session.refresh();
    await nextTick();
    expect(u.session.panelOpen.value).toBe(true);
    expect(u.props().model).toBe(displayed);
    expect(u.props().draft).toHaveLength(1);
    expect(g.world5!.structures).toHaveLength(1);
    expect(g.hasPendingConfirmation).toBe(false);
    busy = false;
    u.session.refresh();
    await nextTick();
    expect(g.hasPendingConfirmation).toBe(true);
    g.resolveCommandDecision(g.pendingCommandConfirmation!.token, true);
    for (let k = 0; k < 3; k++) {
      await nextTick();
      u.session.refresh();
    }
    expect(g.world5!.structures).toHaveLength(2);
    expect(g.world5!.simulationTicks - tick).toBe(200);
    expect(u.props().draft).toEqual([]);
    u.scope.stop();
  });
  it('caps zero-time drafts at 16, sends each build separately and stops at the first distance failure', async () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    const u = ui(g);
    u.props().onTab('build');
    const state = structuredClone(g.world5),
      random = rng.getState(),
      id = getNextEntityId();
    for (let k = 0; k < 17; k++) {
      u.select({ x: 21 + (k % 5), y: 13 + Math.floor(k / 5) });
      u.props().onAppend();
    }
    expect(u.props().draft).toHaveLength(16);
    expect(g.world5).toEqual(state);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
    const before = g.recordedInputEvents.length;
    u.props().onConstruct();
    for (let i = 0; i < 8; i++) {
      await nextTick();
      u.session.refresh();
    }
    expect(g.world5!.structures).toHaveLength(1);
    expect(g.world5!.simulationTicks - state!.simulationTicks).toBe(100);
    expect(g.recordedInputEvents.length - before).toBe(2);
    expect(u.props().draft).toEqual([]);
    u.scope.stop();
  });
  it('confirmation No/blur clear the queue and never restore it after reopening', async () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    const u = ui(g);
    u.props().onTab('build');
    u.select({ x: 21, y: 13 });
    u.props().onAppend();
    const tick = g.world5!.simulationTicks;
    g.onConfirmRequest = () => false;
    u.props().onConstruct();
    await nextTick();
    u.session.refresh();
    expect(g.world5!.structures).toEqual([]);
    expect(g.world5!.simulationTicks).toBe(tick);
    expect(u.props().draft).toEqual([]);
    u.props().onClose();
    expect(u.session.panelOpen.value).toBe(false);
    u.session.commands.value[0]!.invoke();
    expect(u.props().draft).toEqual([]);
    u.scope.stop();
  });
  it('keyboard cursor changes are display-only and session replacement retires old actions', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    const u = ui(g);
    u.props().onTab('build');
    const before = structuredClone(g.world5);
    let prevented = false;
    u.keys({
      key: 'ArrowDown',
      preventDefault() {
        prevented = true;
      }
    } as KeyboardEvent);
    expect(prevented).toBe(true);
    expect(g.world5).toEqual(before);
    h.load(h.save());
    u.session.refresh();
    expect(u.session.panelOpen.value).toBe(false);
    u.scope.stop();
  });
});
