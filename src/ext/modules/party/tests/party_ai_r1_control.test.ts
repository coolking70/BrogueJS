import { afterEach, expect, it, vi } from 'vitest';
import '../../../../i18n';
import { Game } from '../../../../engine/Core/Game';
import { logger } from '../../../../engine/Systems/Logger';
import { timeSystem } from '../../../../engine/Systems/Time';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { mechanicalDigest } from '../../../../engine/Core/RecordingDigest';
import type { PartyAiInput } from '../../../partyAi';
const games: Game[] = [];
const clear = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
function fresh() { const g = new Game({ seed: 1 }); games.push(g); return g; }
function start(n = 1) {
  const g = fresh();
  g.startNewGame({ seed: 42, ruleSet: 'extended', extensions: ['party'],
    extensionConfigurations: { party: { schema: 1, members: n } },
    initialCommands: [JSON.stringify({ module: 'party', action: 'create', payload: { schema: 1, members: n } })] });
  g.animationEnabled = false; clear(); return g;
}
function control(g: Game, id: number, kind: 'human' | 'ai') {
  clear(); const change: PartyAiInput['change'] = { kind: 'controller', actorId: id,
    expectedEpoch: g.party!.state.members.find(m => m.actorId === id)!.controlEpoch,
    controller: kind === 'human' ? { kind, slot: 'local:0' } : { kind, policyId: 'party-ai-v1' } };
  g.executeCommand('party:ai', { kind: 'party:ai', schema: 1, expectedRevision: g.party!.state.revision, issuerSlot: 'local:0', change });
}
const digest = (g: Game) => mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState());
function noOp(g: Game, action: () => void) {
  const before = digest(g), random = rng.getState(), allocator = getNextEntityId(), events = structuredClone(g.exportRecording().events);
  action(); expect(digest(g)).toEqual(before); expect(rng.getState()).toEqual(random);
  expect(getNextEntityId()).toBe(allocator); expect(g.exportRecording().events).toEqual(events);
}
/** Genuine seed replay. Diagnostic items, when needed, are installed before the
 * recording origin by the same deterministic fixture on every new-game path. */
function lifecycle(g: Game, finish: (g: Game) => void, nativeModal = false) {
  const mid = digest(g), index = g.exportRecording().events.length;
  // P1a intentionally forbids saving native single-step modals. Preserve that gate.
  if (nativeModal) { expect(() => g.toSaveSnapshot()).toThrow('DECISION_REQUIRED'); expect(digest(g)).toEqual(mid); }
  const save = nativeModal ? null : JSON.parse(JSON.stringify(g.toSaveSnapshot()));
  clear(); finish(g); const expected = digest(g);
  const load = save ?? JSON.parse(JSON.stringify(g.toSaveSnapshot()));
  const h = fresh(); expect(h.loadSnapshot(load)).toBe(true);
  if (save) { expect(digest(h)).toEqual(mid); h.animationEnabled = false; clear(); finish(h); }
  expect(digest(h)).toEqual(expected);
  const recording = h.exportRecording(); expect(recording.events.length).toBeGreaterThan(index);
  expect(h.loadReplay(recording)).toBe(true);
  while (h.replayCursor < recording.events.length && !h.replayError) { const cursor = h.replayCursor; clear(); h.replayStep(true); expect(h.replayCursor).toBeGreaterThan(cursor); }
  expect(h.replayError).toBeNull(); expect(digest(h)).toEqual(expected);
  h.replaySeek(index); expect(h.replayError).toBeNull(); expect(digest(h)).toEqual(mid);
  h.replaySeek(recording.events.length); expect(h.replayError).toBeNull(); expect(digest(h)).toEqual(expected);
}
function originItem(kind: 'wand' | 'identify' | 'enchant' | 'poison') {
  const original = (Game.prototype as any).initializeParty;
  vi.spyOn(Game.prototype as any, 'initializeParty').mockImplementation(function(this: Game) {
    original.call(this);
    if (!this.party) return;
    for (const a of this.controlledActors) {
      if (kind === 'identify') a.inventory.addItem(ItemLoader.spawnWand('wand_of_teleportation', -1, -1)!);
      if (kind === 'poison') { a.inventory.addItem(ItemLoader.spawnPotion('potion_of_poison', -1, -1)!); ItemLoader.identifiedItems.add('potion_of_poison'); continue; }
      a.inventory.addItem(kind === 'wand'
      ? ItemLoader.spawnWand('wand_of_teleportation', -1, -1)!
      : ItemLoader.spawnScroll(kind === 'identify' ? 'scroll_of_identify' : 'scroll_of_enchantment', -1, -1)!);
    }
  });
}
afterEach(() => { games.splice(0).forEach(g => g.disposeRecording()); clear(); vi.restoreAllMocks(); });
it.each([1, 2])('N1 target modal defers AI through cursor input and zero-time escape, %i members, lifecycle', count => {
  originItem('wand'); const g = start(count), actor = g.controlledActors[count - 1]!;
  if (count === 2) g.submitPartyIntent({ kind: 'wait' }, g.player.id);
  const wand = actor.inventory.items.find(i => i.identityId === 'wand_of_teleportation')!;
  g.submitPartyIntent({ kind: 'item', operation: 'use', itemId: wand.id, target: null }, actor.id);
  expect(g.party!.native[actor.id]!.modal).toBe(true); expect(g.party!.state.window.decision).toBeNull();
  control(g, actor.id, 'ai');
  const member = g.party!.state.members[count - 1]!;
  expect(member.controller.kind).toBe('human'); expect(member.pendingController?.kind).toBe('ai');
  noOp(g, () => control(g, actor.id, 'ai'));
  g.executeCommand('move', { x: 0, y: 1 }); expect(member.controller.kind).toBe('human');
  lifecycle(g, h => {
    const tick = timeSystem.currentTick; h.executeCommand('escape');
    expect(timeSystem.currentTick).toBe(tick); expect(h.party!.native[actor.id]!.modal).toBe(false);
    expect(h.party!.state.members[count - 1]).toMatchObject({ controller: { kind: 'ai' }, pendingController: null });
  }, true);
});
it.each(['cancel', 'confirm'])('N1 starting dart target %s retains authority, natural seed replay', answer => {
  const g = start(), id = g.player.id, dart = g.player.inventory.items.find(i => i.identityId === 'dart')!;
  g.executeItemCommand('throw', dart); expect(g.party!.native[id]!.modal).toBe(true);
  control(g, id, 'ai');
  lifecycle(g, h => {
    if (answer === 'cancel') h.executeCommand('escape');
    else h.executeCommand('mouse_travel', { x: h.player.x + 1, y: h.player.y });
    expect(h.party!.native[id]!.modal).toBe(false);
    expect(h.party!.state.members[0]).toMatchObject({ controller: { kind: 'ai' }, pendingController: null }); }, true);
});
it.each(['identify', 'enchant'] as const)('N1 %s inventory answer applies pending AI after modal completion', kind => {
  originItem(kind); const g = start(), id = g.player.id;
  const scroll = g.player.inventory.items.find(i => i.consumableId === (kind === 'identify' ? 'scroll_of_identify' : 'scroll_of_enchantment'))!;
  g.executeItemCommand('read', scroll); expect(g.party!.native[id]!.modal).toBe(true); control(g, id, 'ai');
  expect(g.party!.state.members[0]!.controller.kind).toBe('human');
  lifecycle(g, h => {
    const item = h.player.inventory.items.find(i => kind === 'identify' ? i.identityId === 'wand_of_teleportation' : i.identityId === 'dagger')!;
    h.executeItemCommand(kind, item); expect(h.party!.native[id]!.modal).toBe(false);
    expect(h.party!.state.members[0]).toMatchObject({ controller: { kind: 'ai' }, pendingController: null });
  }, true);
});
it('N3 temporary AI pending human is idempotent, last accepted switch wins, natural lifecycle', () => {
  const g = start(2), [a, b] = g.controlledActors, food = b!.inventory.items.find(i => i.consumableId === 'ration_of_food')!;
  g.submitPartyWindow({ kind: 'party:window', schema: 2, seq: 1, expectedRevision: g.party!.state.revision,
    issuerSlot: 'local:0', startTick: timeSystem.currentTick, length: { kind: 'ticks', ticks: 300 }, fineActorId: null,
    automatic: false, trigger: 'manual', plans: [
      { actorId: a!.id, controllerSlot: 'local:0', update: 'replace', plan: { kind: 'ai-this-window' } },
      { actorId: b!.id, controllerSlot: 'local:0', update: 'replace', plan: { kind: 'queue', actions: [{ kind: 'item', operation: 'use', itemId: food.id, target: null }] } }
    ] });
  expect(g.party!.state.window.phase).toBe('awaiting-decision');
  const member = g.party!.state.members[0]!, before = member.controlEpoch;
  control(g, a!.id, 'human'); expect(member.controlEpoch).toBe(before + 1);
  expect(member.temporaryAiSeq).toBe(1); expect(member.pendingController?.kind).toBe('human');
  noOp(g, () => control(g, a!.id, 'human'));
  control(g, a!.id, 'ai'); noOp(g, () => control(g, a!.id, 'ai'));
  control(g, a!.id, 'human'); noOp(g, () => control(g, a!.id, 'human'));
  expect(member.temporaryAiSeq).toBe(1); expect(member.controlEpoch).toBe(before + 3);
  lifecycle(g, h => {
    noOp(h, () => control(h, a!.id, 'human')); h.choosePartyDecision('no');
    expect(h.party!.state.members[0]!.temporaryAiSeq).toBeNull();
    clear(); h.submitPartyWindow({ kind: 'party:window', schema: 2, seq: h.party!.state.window.seq + 1, expectedRevision: h.party!.state.revision, issuerSlot: 'local:0', startTick: timeSystem.currentTick, length: { kind: 'ticks', ticks: 100 }, fineActorId: null, automatic: false, trigger: 'manual', plans: h.controlledActors.map(actor => ({ actorId: actor.id, controllerSlot: 'local:0', update: 'replace', plan: { kind: 'queue', actions: [{ kind: 'wait' }] } })) });
    expect(h.party!.state.members[0]).toMatchObject({ controller: { kind: 'human' }, pendingController: null, temporaryAiSeq: null });
    expect(h.party!.state.window.decision).toBeNull();
  });
});

it('N1 native harmful-item confirmation cancels at zero time and switches, lifecycle', () => {
  originItem('poison'); const g = start(), id = g.player.id, potion = g.player.inventory.items.find(i => i.consumableId === 'potion_of_poison')!;
  g.executeItemCommand('quaff', potion); expect(g.party!.native[id]!.modal).toBe(true); control(g, id, 'ai');
  lifecycle(g, h => { const tick = timeSystem.currentTick; h.executeItemCommand('cancel'); expect(timeSystem.currentTick).toBe(tick); expect(h.party!.native[id]!.modal).toBe(false); expect(h.party!.state.members[0]).toMatchObject({ controller: { kind: 'ai' }, pendingController: null }); }, true);
});
