import { describe, expect, it } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import { useForagingUi } from '../ui/useForagingUi';
import { makeHarness, scene, addFood, addAlly, eat, feed, roast, hearth, saveContinue, moveNodeBeside, harvest, waitTurns, state, rng, mechanics } from './mechanicsHelpers';

/** Scene edits are not fabricated recording events. Natural replay/seek origins are covered by T-TRACE. */
describe('foraging T-PERSIST staged effect save/load continuations', () => {
  it.each(['eat', 'roast', 'explosion', 'feed', 'strength', 'slumber', 'partial-node'] as const)('%s state persists and continuing actual public commands matches the unsaved control', kind => {
    const h = makeHarness(51020001, kind === 'roast' || kind === 'explosion' ? ['crafting', 'foraging'] : ['foraging']), g = scene(h);
    if (kind === 'eat') eat(h, addFood(h, 'venom', 2));
    if (kind === 'roast' || kind === 'explosion') { hearth(h); expect(roast(h, addFood(h, kind === 'explosion' ? 'blast' : 'mend', kind === 'explosion' ? 3 : 2)).error).toBeNull(); }
    if (kind === 'feed') expect(feed(h, addAlly(h), addFood(h, 'might'), [true]).error).toBeNull();
    if (kind === 'strength') eat(h, addFood(h, 'might'));
    if (kind === 'slumber') { eat(h, addFood(h, 'drowse')); g.player.setStatusDuration('slumber', 7); h.command('escape'); }
    if (kind === 'partial-node') { const n = moveNodeBeside(h); expect(harvest(h, n).error).toBeNull(); waitTurns(h, 5); expect(harvest(h, n).error).toBeNull(); expect(n.remaining).toBe(1); expect(n.regenRemainder).toBe(600); }
    const expectedState = state(h); const save = h.save(), digest = h.digest(); h.load(save);
    expect(h.digest()).toBe(digest); expect(state(h)).toEqual(expectedState);
    saveContinue(h, () => { h.command('wait'); h.command('wait'); });
  });
  it.each(['overflow', 'history-order', 'extra-key'] as const)('bad module state %s is rejected without retiring the current run', mode => {
    const h = makeHarness(), g = scene(h); eat(h, addFood(h, 'mend', 2)); eat(h, addFood(h, 'blast', 2));
    const save = JSON.parse(h.save());
    if (mode === 'overflow') save.extensions.modules.foraging.totals.eaten = Number.MAX_SAFE_INTEGER + 1;
    if (mode === 'history-order') save.extensions.modules.foraging.history.reverse();
    if (mode === 'extra-key') save.extensions.modules.foraging.hiddenKind = 'blast';
    const live = g.extensionRuntime, before = h.digest(), random = rng.getState();
    expect(g.loadSnapshot(save)).toBe(false); expect(g.extensionRuntime).toBe(live); expect(h.digest()).toBe(before); expect(rng.getState()).toEqual(random);
  });
  it('repeated real UI open/close/tab changes leave digest, both streams and every mechanical root unchanged', async () => {
    const h = makeHarness(), g = scene(h); addFood(h, 'mend'); moveNodeBeside(h);
    const scope = effectScope(), before = h.digest(), random = rng.getState(), roots = mechanics(h);
    const ui = scope.run(() => useForagingUi({ game: () => g, tick: ref(0), immersive: ref(false), canOpenPanel: () => true, canPresentInteraction: () => true, isPresentationBusy: () => false, beforeOpenPanel: () => {}, afterClosePanel: () => {} }, async () => ({ render: () => null })))!;
    try {
      for (let i = 0; i < 5; i++) {
        ui.commands.value[0]!.invoke(); await nextTick(); await nextTick(); expect(ui.panelOpen.value).toBe(true);
        for (const tab of ['harvest', 'roast', 'feed']) { (ui.panel.value!.props.onTab as (tab: string) => void)(tab); ui.refresh(); }
        ui.close(); expect(ui.panelOpen.value).toBe(false);
      }
      expect(h.digest()).toBe(before); expect(rng.getState()).toEqual(random); expect(mechanics(h)).toEqual(roots);
    } finally { scope.stop(); }
  });
});
