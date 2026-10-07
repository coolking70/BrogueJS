import { it, expect, afterEach, vi } from 'vitest';
import { structureHarness, createCamp, build, fixture } from './support/structureFixture';
import { worldWorkLastError } from '../engine/Core/WorldWork';
afterEach(() => vi.restoreAllMocks());
it.each([[], ['combat', 'giants']].map((modules) => ({ modules })))(
  'structure fixture + %j real new/play/save/load/replay/seek/resume',
  ({ modules }) => {
    const { g, h } = structureHarness(modules);
    createCamp(g);
    for (const part of ['floor', 'roof', 'door', 'bed']) build(g, part);
    expect(worldWorkLastError(g)).toBeNull();
    const door = g.world5!.structures[0]!.barrier!;
    fixture(g, 'structure', { kind: 'door', componentId: door.id, revision: 0, open: true });
    const rest = g.world5!.restPoints[0]!;
    fixture(g, 'rest', { restPointId: rest.interactableId, revision: 0 });
    expect(worldWorkLastError(g)).toBeNull();
    h.command('auto_step');
    const prefix = g.recordedInputEvents.length;
    h.load(h.save());
    expect(h.runAutoUntilIdle(6)).toBe(2);
    const digest = h.digest(),
      recording = h.exportRecording();
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(digest);
    h.seek(recording, prefix);
    h.load(h.save());
    expect(h.runAutoUntilIdle(6)).toBe(2);
    expect(h.digest()).toBe(digest);
    const count = JSON.parse(h.exportRecording()).events.length;
    h.command('escape');
    expect(JSON.parse(h.exportRecording()).events).toHaveLength(count + 1);
    h.dispose();
  }
);
