import { describe, expect, it, vi } from 'vitest';
import { workGame } from './support/worldWorkFixture';
import { createHeadlessGame } from './harness';
import { readWorkContext } from '../engine/Core/WorldWorkWorld';
import type { Game } from '../engine/Core/Game';
vi.mock('../engine/Input', () => ({ inputManager: { triggerAction() {} } }));
const read = (g: Game) => {
  const r = readWorkContext(g, 'craftskel', { kind: 'inventory' });
  if (!r.ok) throw new Error(r.code);
  return r.value;
};
const begin = (g: Game) => {
  const r = read(g),
    s = r.stations.find((s) => s.workPositions.some((p) => p.x === r.at.x && p.y === r.at.y))!;
  g.executeCommand(
    'ext:command',
    JSON.stringify({
      module: 'craftskel',
      action: 'craft',
      payload: {
        v: 1,
        recipeId: 'craftskel.dagger-recipe',
        batchCount: 2,
        stationId: s.interactableId,
        stationRevision: s.revision,
        sourceContainerId: null,
        sourceRevision: null,
        inventoryStamp: r.inventoryStamp
      }
    })
  );
  while (g.pendingCommandConfirmation)
    g.resolveCommandDecision(g.pendingCommandConfirmation.token, true);
};
describe('C5 neutral root and recorded auto_work interruption', () => {
  it('root presence is determined by enabled capabilities and owner clocks are neutral', () => {
    const g = createHeadlessGame(1);
    expect(g).not.toHaveProperty('actorActions');
    expect(g.toSnapshot().run).not.toHaveProperty('actorActions');
    const w = workGame();
    expect(w.actorActions).toEqual({ schema: 1, nextActionId: 1, bundles: [] });
    begin(w);
    expect(w.actorActions!.nextActionId).toBe(2);
    expect(w.extensionRuntime!.snapshot().modules.craftskel).not.toHaveProperty('scheduler');
  });
  it('bad root presence, owner, ID and ticket mirrors reject before retiring the old Game', () => {
    const g = workGame();
    const old = g.player,
      base = g.toSnapshot();
    for (const mutate of [
      (s: typeof base) => {
        delete s.run.actorActions;
      },
      (s: typeof base) => {
        (s.run.actorActions as any).extra = 1;
      },
      (s: typeof base) => {
        s.run.actorActions!.nextActionId = 0;
      }
    ] as any[]) {
      const s = structuredClone(base);
      mutate(s);
      expect(g.loadSnapshot(s)).toBe(false);
      expect(g.player).toBe(old);
    }
    begin(g);
    const saved = g.toSnapshot();
    saved.run.world5!.tickets[0]!.actorId = 999999;
    expect(g.loadSnapshot(saved)).toBe(false);
    expect(g.player).toBe(old);
  });
  it('all non-command travel entries leave a live auto_work world unchanged', () => {
    const g = workGame();
    begin(g);
    expect(g.hasWorldAutoWork()).toBe(true);
    for (const call of [
      () => g.setAutoPath(g.player.x + 1, g.player.y),
      () => (g as any).handleAutoExplore(),
      () => g.handleMouseTravel(g.player.x + 1, g.player.y),
      () => (g as any).recomputeExplorePath(),
      () => (g as any).autoTravelDisturbed()
    ]) {
      const before = g.toSnapshot();
      before.savedAt = 0;
      expect(call).not.toThrow();
      const after = g.toSnapshot();
      after.savedAt = 0;
      expect(after).toEqual(before);
      expect(g.hasWorldAutoWork()).toBe(true);
    }
    expect(() => (g as any).stopAutoTravel()).toThrow('outside recorded command');
    expect(g.hasWorldAutoWork()).toBe(true);
  });
  it.each(['escape', 'move', 'auto_explore', 'mouse_travel', 'rest', 'item:command'])(
    '%s cancels and refunds once within the recorded command',
    (action) => {
      const g = workGame();
      begin(g);
      const data =
        action === 'move'
          ? { x: 0, y: 0 }
          : action === 'mouse_travel'
            ? { x: g.player.x, y: g.player.y }
            : action === 'item:command'
              ? 'use|' +
                g.player.inventory.items.find(
                  (i) => i.worldItem?.definitionId === 'craftskel.fiber'
                )!.inventoryLetter +
                '|'
              : undefined;
      g.executeCommand(action, data);
      expect(g.hasWorldAutoWork()).toBe(false);
      expect(g.world5!.terminalTickets[0]!.status).toBe('cancelled');
      expect(
        g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'craftskel.fiber')!
          .quantity
      ).toBe(19);
      expect(g.worldWorkFacts!.filter((f) => f.operation === 'cancel')).toHaveLength(1);
      g.executeCommand('escape');
      expect(g.worldWorkFacts!.filter((f) => f.operation === 'cancel')).toHaveLength(1);
      const recording = g.exportRecording();
      expect(g.loadReplay(recording)).toBe(true);
      while (g.replayCursor < g.replayEvents.length && !g.replayError) g.replayStep(true);
      expect(g.replayError).toBeNull();
    }
  );
  it('UI travel cancels work in its single recorded mouse command', () => {
    const g = workGame();
    begin(g);
    const tick = g.world5!.simulationTicks,
      index = g.recordedInputEvents.length;
    g.executeCommand('mouse_travel', { x: g.player.x, y: g.player.y });
    expect(g.recordedInputEvents[index]!.action).toBe('mouse_travel');
    expect(g.world5!.simulationTicks).toBe(tick);
    expect(g.hasWorldAutoWork()).toBe(false);
    expect(g.recordedInputEvents).toHaveLength(index + 1);
  });
});

it('combat-only load rejects a foundation bundle before retiring the current Game', async () => {
  const { createActorActionBundle } = await import('../engine/Core/ActorActionScheduler');
  const g = createHeadlessGame(51020001, 'wizard');
  g.startNewGame({ seed: 51020001, mode: 'wizard', ruleSet: 'extended', extensions: ['combat'] });
  const old = g.player,
    s = g.toSnapshot();
  s.run.actorActions!.nextActionId = 2;
  s.run.actorActions!.bundles.push(
    createActorActionBundle({
      owner: 'foundation',
      actionId: 1,
      depth: 1,
      decisionOwnerId: g.player.id,
      timeChargeOwnerId: g.player.id,
      subactions: [
        {
          sourceEntityId: g.player.id,
          sourcePartId: 'body',
          sourceFootprintVersion: 'fixture',
          phases: [{ kind: 'recovery', durationTicks: 100, segmentIndex: null }]
        }
      ]
    })
  );
  expect(g.loadSnapshot(s)).toBe(false);
  expect(g.player).toBe(old);
});
