import { it, expect, vi } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import route from './resident-natural-route.json';
import { current } from './helpers';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import { payload } from './residentProductionHelpers';
import { residentOrder } from '../../../../engine/Core/ResidentOrders';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { worldWorkLastError } from '../../../../engine/Core/WorldWork';
it('normal captured public resident prefix → new hunter order → physical meat → save/replay/seek/continuation', () => {
  vi.restoreAllMocks();
  const h = createWorldHarness({ seed: route.seed, mode: 'normal', modules: ['settlement'] }),
    g = worldHarnessGame(h);
  try {
    let executed = 0;
    const prefix = 398;
    outer: for (const step of route.steps)
      for (let n = 0; n < step.count; n++) {
        if (executed >= prefix) break outer;
        executed++;
        const decisions = [...step.decisions];
        g.onConfirmRequest = () => decisions.shift() ?? true;
        h.command(step.action, step.data);
        while (g.pendingCommandConfirmation)
          g.resolveCommandDecision(g.pendingCommandConfirmation.token, decisions.shift() ?? true);
        if (step.action === 'ext:command') expect(worldWorkLastError(g)).toBeNull();
      }
    const a = g.monsters.find((a) => a.id === route.actorId)!;
    expect(a).toBeDefined();
    const c = current(g),
      r = residentComponent(g, a.id)!;
    expect(
      h.ext('settlement', 'set-schedule', {
        v: 1,
        stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
        campId: c.regionId,
        campRevision: c.revision,
        targetId: a.id,
        targetRevision: r.revision,
        schedule: [30, 1, 1]
      }).error
    ).toBeNull();
    expect(
      h.ext('settlement', 'order-work', payload(g, a.id, 'settlement.hunt', 2)).error
    ).toBeNull();
    const source = residentOrder(g, a.id)!.production!.destinationId;
    for (
      let n = 0;
      n < 140 &&
      !containerItems(g, source).some((i) => i.worldItem?.definitionId === 'settlement.meat') &&
      !g.isGameOver;
      n++
    )
      h.command('wait');

    expect(g.isGameOver).toBe(false);
    expect(
      containerItems(g, source).some((i) => i.worldItem?.definitionId === 'settlement.meat')
    ).toBe(true);
    const recording = h.exportRecording(),
      digest = h.digest(),
      events = g.recordedInputEvents.length;
    h.load(h.save());
    expect(h.digest()).toBe(digest);
    h.command('wait');
    expect(h.replay(h.exportRecording())).toEqual({ ok: true, firstMismatch: null });
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(digest);
    for (const cursor of [prefix, prefix + 2, events - 1, events]) {
      h.seek(recording, cursor);
      const before = h.digest();
      h.load(h.save());
      expect(h.digest()).toBe(before);
    }
  } finally {
    h.dispose();
  }
});
