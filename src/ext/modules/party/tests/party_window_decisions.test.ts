import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '../../../../i18n';
import { Game } from '../../../../engine/Core/Game';
import { timeSystem } from '../../../../engine/Systems/Time';
import { logger } from '../../../../engine/Systems/Logger';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { withPartyActor } from '../../../../engine/Core/PartyRuntime';
import { mechanicalDigest } from '../../../../engine/Core/RecordingDigest';
import { startDiagnostic } from '../../narrative/tests/narrative2_rewardFixture';
import { buildNarrativeUiCommand, readNarrativeUiView } from '../../narrative/ui/view';
import type { ActorIntent } from '../../../party';
const games: Game[] = [];
const clear = () => {
  while (logger.pendingAcknowledgment) logger.acknowledgeNext();
};
const window = (g: Game, actorId: number, intent: ActorIntent) => {
  clear();
  g.submitPartyWindow({
    kind: 'party:window',
    schema: 2,
    seq: g.party!.state.window.seq + 1,
    expectedRevision: g.party!.state.revision,
    issuerSlot: 'local:0',
    startTick: timeSystem.currentTick,
    length: { kind: 'ticks', ticks: 100 },
    fineActorId: null,
    automatic: false,
    trigger: 'manual',
    plans: [
      {
        actorId,
        controllerSlot: 'local:0',
        update: 'replace',
        plan: { kind: 'queue', actions: [intent] }
      }
    ]
  });
};
beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(1792252800000));
afterEach(() => {
  games.splice(0).forEach((g) => g.disposeRecording());
  vi.restoreAllMocks();
  clear();
});
it('secondary native target modal persists and cancellation resumes the original segment', () => {
  const g = new Game({ seed: 1 });
  games.push(g);
  g.startNewGame({
    seed: 42,
    extensions: ['party'],
    ruleSet: 'extended',
    initialCommands: [
      JSON.stringify({ module: 'party', action: 'create', payload: { schema: 1, members: 2 } })
    ]
  });
  g.animationEnabled = false;
  const actor = g.controlledActors[1]!,
    wand = ItemLoader.spawnWand('wand_of_teleportation', 0, 0)!;
  expect(wand).toBeTruthy();
  actor.inventory.addItem(wand);
  window(g, actor.id, { kind: 'item', operation: 'use', itemId: wand.id, target: null });
  expect(g.party!.state.window.decision).toMatchObject({ actorId: actor.id, kind: 'modal' });
  expect(g.party!.native[actor.id]!.modal).toBe(true);
  const save = JSON.parse(JSON.stringify(g.toSaveSnapshot())),
    seq = g.party!.state.window.seq;
  clear();
  g.choosePartyDecision('cancel');
  expect(g.party!.state.window.seq).toBe(seq);
  expect(g.party!.state.window.segment).toBe(1);
  expect(g.party!.state.window.decision).toBeNull();
  expect(g.party!.native[actor.id]!.modal).toBe(false);
  const expected = mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState());
  const h = new Game({ seed: 1 });
  games.push(h);
  expect(h.loadSnapshot(save, (message) => console.error(message))).toBe(true);
  h.focusPartyMember(h.player.id);
  clear();
  h.choosePartyDecision('cancel');
  expect(mechanicalDigest(h.toSnapshot(), (h as any).recordingInputState())).toEqual(expected);
});
it('secondary real narrative choices survive a pending save and reject stale decisions', () => {
  const { game: g } = startDiagnostic({ npcs: ['cord.mender'], extensions: ['party'] });
  games.push(g);
  const actor = g.controlledActors[1]!,
    target = g
      .extensionRuntime!.snapshot()
      .foundation.world.entities.find((e) => e.contentId === 'cord.mender')!;
  const oldLocation = { ...actor.loc };
  actor.loc = { ...g.player.loc };
  g.player.loc = oldLocation;
  g.focusPartyMember(actor.id);
  (g as any).updateVision();
  const command = withPartyActor(g, actor, () =>
    buildNarrativeUiCommand(g, readNarrativeUiView(g)!, 'open', target.id)
  );
  expect(command).toBeTruthy();
  const input = JSON.parse(command!);
  window(g, actor.id, {
    kind: 'module',
    owner: 'narrative',
    commandId: 'open',
    payload: input.payload
  });
  expect(g.party!.state.window.decision).toMatchObject({ actorId: actor.id, kind: 'dialogue' });
  expect(g.party!.state.window.decision!.allowedChoiceIds).toContain('choice:ask');
  const save = JSON.parse(JSON.stringify(g.toSaveSnapshot())),
    old = structuredClone(g.party!.state.window.decision!);
  clear();
  g.choosePartyDecision('choice:ask');
  expect(g.party!.state.window.segment).toBe(1);
  expect(g.party!.state.window.decision!.id).not.toBe(old.id);
  const before = JSON.stringify(g.toSnapshot());
  expect(() =>
    g.executeCommand('party:decision', {
      kind: 'party:decision',
      schema: 1,
      expectedRevision: g.party!.state.revision,
      issuerSlot: 'local:0',
      actorId: actor.id,
      decisionId: old.id,
      choiceId: 'close'
    })
  ).toThrow('STALE_DECISION');
  expect(JSON.stringify(g.toSnapshot())).toBe(before);
  const expected = mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState()),
    h = new Game({ seed: 1 });
  games.push(h);
  expect(h.loadSnapshot(save, (message) => console.error(message))).toBe(true);
  h.focusPartyMember(h.player.id);
  clear();
  h.choosePartyDecision('choice:ask');
  expect(mechanicalDigest(h.toSnapshot(), (h as any).recordingInputState())).toEqual(expected);
  clear();
  h.choosePartyDecision('close');
  expect(h.party!.state.window.decision).toBeNull();
});
