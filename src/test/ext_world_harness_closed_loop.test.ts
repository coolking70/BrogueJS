import { describe, it, expect } from 'vitest';
import { createWorldHarness } from '../ext/testing/worldHarness';
describe('C5 real harness', () => {
  it('startup, material ownership, save/load, native replay and seek', () => {
    const h = createWorldHarness({
      seed: 51020001,
      modules: [],
      fixtures: ['crafting-skeleton', 'world-work-basic']
    });
    const context = h.readWorkContext('craftskel', { kind: 'inventory' });
    expect(context.ok).toBe(true);
    if (!context.ok) return;
    expect(
      context.value.inventory.filter((i) => i.definitionId?.startsWith('craftskel.'))
    ).toHaveLength(3);
    const before = h.digest(),
      save = h.save();
    h.load(save);
    expect(h.digest()).toBe(before);
    h.command('escape');
    const recording = h.exportRecording();
    const final = h.digest();
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(final);
    h.seek(recording, 1);
    expect(h.digest()).toBe(final);
    h.dispose();
  });
  it('real multi-batch escrow, tool confirmation, cancellation and continuation', () => {
    const h = createWorldHarness({
      seed: 51020001,
      modules: [],
      fixtures: ['crafting-skeleton', 'world-work-basic']
    });
    const read = () => {
      const r = h.readWorkContext('craftskel', { kind: 'inventory' });
      if (!r.ok) throw new Error(r.code);
      return r.value;
    };
    const before = read(),
      station = before.stations.find((s) =>
        s.workPositions.some((p) => p.x === before.at.x && p.y === before.at.y)
      )!;
    expect(station).toBeDefined();
    const payload = {
      v: 1,
      recipeId: 'craftskel.dagger-recipe',
      batchCount: 2,
      stationId: station.interactableId,
      stationRevision: station.revision,
      sourceContainerId: null,
      sourceRevision: null,
      inventoryStamp: before.inventoryStamp
    };
    const original = h.digest();
    expect(h.ext('craftskel', 'craft', payload, [false])).toEqual({ recorded: true, error: null });
    expect(h.world5()!.tickets).toHaveLength(0);
    const no = h.exportRecording();
    expect(h.replay(no).ok).toBe(true);
    h.seek(no, 1);
    const save = h.save();
    h.load(save);
    expect(h.ext('craftskel', 'craft', payload, [true])).toEqual({ recorded: true, error: null });
    expect(read().activeTicket?.completedBatches).toBe(1);
    expect(read().activeTicket?.remainingTicks).toBe(100);
    const between = h.save();
    h.load(between);
    expect(h.runAutoUntilIdle(5)).toBe(1);
    expect(read().activeTicket).toBeNull();
    expect(h.world5()!.terminalTickets[0]!.status).toBe('completed');
    expect(h.world5()!.terminalTickets[0]!.completedBatches).toBe(2);
    expect(h.digest()).not.toBe(original);
    const recording = h.exportRecording(),
      end = h.digest();
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(end);
    h.seek(recording, 2);
    expect(read().activeTicket?.completedBatches).toBe(1);
    h.dispose();
  });
});
describe('C5 first verifiable replay mismatch', () => {
  it('a valid rechained semantic divergence reports the actual first command', async () => {
    const h = createWorldHarness({ seed: 51020001, modules: [], fixtures: [] });
    h.command('escape');
    h.command('escape');
    const recording = JSON.parse(h.exportRecording());
    recording.events[0].action = 'wait';
    const { rechain } = await import('./support/recordingV4');
    rechain(recording);
    expect(h.replay(JSON.stringify(recording))).toEqual({ ok: false, firstMismatch: 1 });
    h.dispose();
  });
});
describe('C5 all four commands and changed continuation', () => {
  it('harvest → kit station → craft → cancel → save/load/replay/seek/continue', async () => {
    const { installRecordingScene } = await import('./support/recordingV4');
    const { clearWorldCell } = await import('../engine/Core/WorldWorkWorld');
    installRecordingScene((g) => {
      const n = g.world5?.nodes.find((n) => n.owner === 'craftskel');
      if (!n) return;
      const cells = [-1, 0, 1].flatMap((dy) =>
        [-1, 0, 1].map((dx) => ({ x: g.player.x + dx, y: g.player.y + dy }))
      );
      const at = cells.find((p) => clearWorldCell(g, p))!;
      n.at = { ...at };
      const e = g.extensionRuntime!.worldWorkEntities().find((e) => e.id === n.interactableId)!;
      Object.assign(e, at);
    });
    try {
      const h = createWorldHarness({
          seed: 51020001,
          modules: [],
          fixtures: ['crafting-skeleton']
        }),
        read = () => {
          const r = h.readWorkContext('craftskel', { kind: 'inventory' });
          if (!r.ok) throw new Error(r.code);
          return r.value;
        };
      const n = h.world5()!.nodes.find((n) => n.owner === 'craftskel')!,
        initial = read();
      expect(
        h.ext('craftskel', 'harvest', {
          v: 1,
          nodeId: n.interactableId,
          nodeRevision: n.revision,
          destinationId: null,
          destinationRevision: null,
          inventoryStamp: initial.inventoryStamp
        }).error
      ).toBeNull();
      const { worldHarnessGame } = await import('../ext/testing/worldHarness'),
        g = worldHarnessGame(h),
        r = read(),
        at = [-1, 0, 1]
          .flatMap((dy) => [-1, 0, 1].map((dx) => ({ x: r.at.x + dx, y: r.at.y + dy })))
          .find((p) => clearWorldCell(g, p))!;
      expect(
        h.ext('craftskel', 'place-station', {
          v: 1,
          definitionId: 'craftskel.table',
          x: at.x,
          y: at.y,
          inventoryStamp: r.inventoryStamp
        }).error
      ).toBeNull();
      const c = read(),
        s = c.stations.find((s) => s.definitionId === 'craftskel.table')!;
      expect(
        h.ext(
          'craftskel',
          'craft',
          {
            v: 1,
            recipeId: 'craftskel.dagger-recipe',
            batchCount: 2,
            stationId: s.interactableId,
            stationRevision: s.revision,
            sourceContainerId: null,
            sourceRevision: null,
            inventoryStamp: c.inventoryStamp
          },
          [true]
        ).error
      ).toBeNull();
      const ticket = read().activeTicket!;
      expect(
        h.ext('craftskel', 'cancel-work', {
          v: 1,
          ticketId: ticket.ticketId,
          ticketRevision: ticket.revision
        }).error
      ).toBeNull();
      expect(read().activeTicket).toBeNull();
      const final = h.digest(),
        saved = h.save();
      h.load(saved);
      expect(h.digest()).toBe(final);
      const recording = h.exportRecording();
      expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
      expect(h.digest()).toBe(final);
      h.seek(recording, 3);
      expect(read().activeTicket!.completedBatches).toBe(1);
      h.load(h.save());
      expect(h.runAutoUntilIdle(3)).toBe(1);
      expect(h.world5()!.terminalTickets[2]!.status).toBe('completed');
      const next = h.exportRecording();
      expect(h.replay(next).ok).toBe(true);
      h.dispose();
    } finally {
      const { vi } = await import('vitest');
      vi.restoreAllMocks();
    }
  });
});
