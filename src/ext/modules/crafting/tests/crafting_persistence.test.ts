import { describe, expect, it } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { WorldHarness } from '../../../worldSdk';
import { useCraftingUi } from '../ui/useCraftingUi';
import { rng } from '../../../../engine/Random';
import { add, amount, arena, cancel, craft, game, harvest, mechanics, moveNodeBeside, node, place, read, staged, waitTicks } from './runtimeHelpers';

/** Keep the control digest before replay, since the real harness replaces its live game. */
function continueAcrossSaveReplaySeek(h: WorldHarness, continuation: (h: WorldHarness) => void) {
  const point = h.save(), pointDigest = h.digest(), cursor = game(h).recordedInputEvents.length;
  continuation(h);
  const expected = h.digest(), inventory = read(h).inventory, world = h.world5(), recording = h.exportRecording();
  h.load(point);
  expect(h.digest()).toBe(pointDigest);
  continuation(h);
  expect(h.digest()).toBe(expected);
  expect(read(h).inventory).toEqual(inventory);
  expect(h.world5()).toEqual(world);
  expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
  expect(h.digest()).toBe(expected);
  h.seek(recording, cursor);
  expect(h.digest()).toBe(pointDigest);
  h.load(h.save());
  continuation(h);
  expect(h.digest()).toBe(expected);
  expect(h.world5()).toEqual(world);
  const continued = h.exportRecording();
  expect(h.replay(continued)).toEqual({ ok: true, firstMismatch: null });
  expect(h.digest()).toBe(expected);
}
function supply(g: ReturnType<typeof game>) {
  arena(g); add(g, 'wood', 30); add(g, 'stone', 20); add(g, 'fiber', 10);
  moveNodeBeside(g);
}

describe('crafting T12 save/load, replay, seek and continuation', () => {
  it('persists a working five-batch ticket between batches and continues identically', () => {
    const h = staged(supply);
    expect(craft(h, 'make-table-kit', 5).error).toBeNull();
    expect(read(h).activeTicket).toMatchObject({ completedBatches: 1, status: 'working', bundleActionId: null });
    expect(game(h).toSnapshot().run.autoAction).toEqual({ kind: 'auto_work', ticketId: read(h).activeTicket!.ticketId });
    continueAcrossSaveReplaySeek(h, h => { expect(h.runAutoUntilIdle(6)).toBe(4); expect(amount(h, 'kit-table')).toBe(5); });
  });

  it('persists a placed table and continues an equipment/furniture batch', () => {
    const h = staged(supply);
    expect(place(h).error).toBeNull();
    continueAcrossSaveReplaySeek(h, h => {
      expect(craft(h, 'make-bed-kit', 2).error).toBeNull();
      expect(h.runAutoUntilIdle(3)).toBe(1);
      expect(amount(h, 'kit-bed')).toBe(2);
    });
  });

  it('persists a declined tool-break confirmation and later accepts it consistently', () => {
    const h = staged(g => {
      // Build the same D2 scene before the shared helper captures every initial root.
      g.depth = 2;
      (g as unknown as { generateDepth(): void }).generateDepth();
      arena(g); add(g, 'pick', 1);
      g.player.inventory.items.find(i => i.worldItem?.definitionId === 'crafting.pick')!.worldItem!.toolDurability = 1;
      moveNodeBeside(g, 'metal-node');
    });
    expect(harvest(h, 'metal-node', [false])).toEqual({ recorded: true, error: null });
    expect(amount(h, 'metal')).toBe(0);
    continueAcrossSaveReplaySeek(h, h => {
      expect(harvest(h, 'metal-node', [true])).toEqual({ recorded: true, error: null });
      expect(amount(h, 'metal')).toBe(1);
      expect(read(h).inventory.find(i => i.definitionId === 'crafting.pick')!.toolDurability).toBe(0);
    });
  });

  it('persists cancellation and never reissues its escrow refund', () => {
    const h = staged(supply);
    expect(craft(h, 'make-table-kit', 5).error).toBeNull();
    expect(cancel(h).error).toBeNull();
    expect(read(h).activeTicket).toBeNull();
    continueAcrossSaveReplaySeek(h, h => {
      expect(craft(h, 'make-pick').error).toBeNull();
      expect(amount(h, 'kit-table')).toBe(1);
      expect(amount(h, 'pick')).toBe(1);
      expect(game(h).worldWorkFacts!.filter(f => f.operation === 'cancel')).toHaveLength(1);
    });
  });

  it('persists partially harvested wood and its regeneration remainder', () => {
    const h = staged(supply);
    expect(harvest(h).error).toBeNull(); waitTicks(h, 500);
    expect(harvest(h).error).toBeNull();
    expect(node(h).remaining).toBeLessThan(node(h).capacity);
    expect(node(h).regenRemainder).toBe(600);
    continueAcrossSaveReplaySeek(h, h => { waitTicks(h, 1400); expect(harvest(h).error).toBeNull(); });
  });

  it('repeated real UI open/close/tab changes preserve digest, clocks, inventory and both RNG streams', async () => {
    const h = staged(supply), scope = effectScope();
    const before = h.digest(), random = rng.getState(), roots = mechanics(h);
    const ui = scope.run(() => useCraftingUi({ game: () => game(h), tick: ref(0), immersive: ref(false),
      canOpenPanel: () => true, canPresentInteraction: () => true, isPresentationBusy: () => false,
      beforeOpenPanel: () => {}, afterClosePanel: () => {}
    }, async () => ({ render: () => null })))!;
    try {
      for (let i = 0; i < 5; i++) {
        ui.commands.value[0]!.invoke();
        await nextTick(); await nextTick();
        expect(ui.panelOpen.value).toBe(true);
        for (const tab of ['harvest', 'craft', 'station', 'work']) {
          (ui.panel.value!.props.onTab as (tab: string) => void)(tab);
          ui.refresh();
        }
        ui.close();
        expect(ui.panelOpen.value).toBe(false);
      }
      expect(h.digest()).toBe(before);
      expect(rng.getState()).toEqual(random);
      expect(mechanics(h)).toEqual(roots);
    } finally { scope.stop(); }
  });
});
