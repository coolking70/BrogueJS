import { afterEach, describe, expect, it } from 'vitest';
import traceData from '../data/natural-trace.json';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import type { WorldHarness } from '../../../worldSdk';
import { craftingFinal, executeTraceCommand, type TraceCommand } from './traceHelpers';

const trace = traceData as unknown as {
  seed: number;
  mode: 'normal';
  modules: string[];
  commands: TraceCommand[];
  final: ReturnType<typeof craftingFinal>;
};
const harnesses: WorldHarness[] = [];
function start() {
  const h = createWorldHarness({ seed: trace.seed, mode: trace.mode, modules: trace.modules });
  harnesses.push(h);
  return h;
}
afterEach(() => harnesses.splice(0).forEach((h) => h.dispose()));
function run(h: WorldHarness, from = 0, until = trace.commands.length) {
  for (let index = from; index < until; index++) {
    const command = trace.commands[index]!;
    const before = worldHarnessGame(h).recordedInputEvents.length;
    expect(executeTraceCommand(h, command), `command ${index + 1}: ${command.action}`).toEqual(
      command.expect
    );
    expect(
      worldHarnessGame(h).recordedInputEvents.length - before,
      `recorded delta for command ${index + 1}`
    ).toBe(command.expect.recorded ? 1 : 0);
    if (command.action !== 'ext:command') expect(Object.keys(command.expect)).toEqual(['recorded']);
  }
}

describe('crafting T15 natural public-command golden trace', () => {
  it('reproduces every command receipt and exact final inventory, nodes, module state and digest', () => {
    expect(trace.mode).toBe('normal');
    expect(trace.modules).toEqual(['crafting']);
    expect(trace.commands.length).toBeGreaterThan(0);
    expect(
      trace.commands.every((c) =>
        ['move', 'travel_stairs', 'stairs_down', 'auto_step', 'ext:command'].includes(c.action)
      )
    ).toBe(true);
    const h = start();
    expect(h.world5()!.startupGrants).toEqual([
      expect.objectContaining({ owner: 'crafting', result: 'granted' })
    ]);
    const nodes = h.world5()!.nodes;
    for (const [id, count] of [
      ['wood-node', 2],
      ['stone-node', 2],
      ['fiber-node', 2],
      ['hide-cache', 1]
    ] as const)
      expect(nodes.filter((n) => n.definitionId === `crafting.${id}`)).toHaveLength(count);
    run(h);
    expect(worldHarnessGame(h).depth).toBe(2);
    expect(worldHarnessGame(h).isGameOver).toBe(false);
    expect(craftingFinal(h)).toEqual(trace.final);
    // These facts establish the requested crafting progression independently of the final hash.
    const state = trace.final.state as unknown as {
      history: { operation: string; definitionId: string; result: string }[];
    };
    for (const recipe of [
      'make-pick',
      'make-table-kit',
      'make-leather-armor',
      'make-bed-kit',
      'make-chest-kit',
      'make-dagger'
    ])
      expect(
        state.history.some(
          (f) =>
            f.operation === 'craft-batch' &&
            f.definitionId === `crafting.${recipe}` &&
            f.result === 'completed'
        )
      ).toBe(true);
    expect(h.world5()!.stations.filter((s) => s.definitionId === 'crafting.table')).toHaveLength(2);
    expect(h.world5()!.stations.filter((s) => s.definitionId === 'crafting.hearth')).toHaveLength(
      1
    );
    expect(h.world5()!.nodes.find((n) => n.definitionId === 'crafting.metal-node')!.remaining).toBe(
      16
    );
    expect(
      trace.final.inventory.find((i) => i.definitionId === 'crafting.pick')!.toolDurability
    ).toBe(36);
  });

  it('preserves the natural run through save/load and full v4 replay', () => {
    const h = start();
    const midpoint = Math.floor(trace.commands.length / 2);
    run(h, 0, midpoint);
    const middle = craftingFinal(h),
      saved = h.save();
    h.load(saved);
    expect(craftingFinal(h)).toEqual(middle);
    run(h, midpoint);
    expect(craftingFinal(h)).toEqual(trace.final);
    const recording = h.exportRecording();
    expect(JSON.parse(recording).version).toBe(4);
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(craftingFinal(h)).toEqual(trace.final);
  });

  it('seeks to the initial, intermediate and final boundaries and continues the authentic prefix', () => {
    const h = start();
    run(h);
    const recording = h.exportRecording();
    for (const index of [0, Math.floor(trace.commands.length / 2), trace.commands.length]) {
      h.seek(recording, index);
      expect(worldHarnessGame(h).replayCursor).toBe(index);
      expect(worldHarnessGame(h).replayError).toBeNull();
      h.load(h.save());
      run(h, index);
      expect(craftingFinal(h)).toEqual(trace.final);
      expect(h.replay(h.exportRecording())).toEqual({ ok: true, firstMismatch: null });
      expect(craftingFinal(h)).toEqual(trace.final);
    }
  });
});
