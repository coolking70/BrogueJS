import { afterEach, expect, it, vi } from 'vitest';
import '../../../../i18n';
import { Game } from '../../../../engine/Core/Game';
import { logger } from '../../../../engine/Systems/Logger';
import { timeSystem } from '../../../../engine/Systems/Time';
import { rng } from '../../../../engine/Random';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { mechanicalDigest } from '../../../../engine/Core/RecordingDigest';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { installProductionBody, emptyProductionArena, PRODUCTION_BODY_ID } from '../../../../test/support/productionComposite';
const games: Game[] = [];
const clear = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
function fresh() { const g = new Game({ seed: 1 }); games.push(g); return g; }
const digest = (g: Game) => mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState());
function window(g: Game) {
  clear(); g.submitPartyWindow({ kind: 'party:window', schema: 2, seq: g.party!.state.window.seq + 1,
    expectedRevision: g.party!.state.revision, issuerSlot: 'local:0', startTick: timeSystem.currentTick,
    length: { kind: 'ticks', ticks: 100 }, fineActorId: null, automatic: false, trigger: 'manual', plans: [] });
}
// Fixed diagnostic arena is established before the genuine recording origin,
// and regenerated on seed replay. No recording/checkpoint/digest is patched.
function setup(type: string, combat = false, body: boolean | 'square' = false) {
  if (body) installProductionBody();
  const original = (Game.prototype as any).initializeParty;
  vi.spyOn(Game.prototype as any, 'initializeParty').mockImplementation(function(this: Game) {
    original.call(this); if (!this.party) return;
    emptyProductionArena(this); commitCreatureAnchor(this.player, { x: 21, y: 12 });
    const ally = body === 'square' ? this.createModuleMonster('body-fixture.ridgeback', { x: 14, y: 12 })! : body ? this.createCompositeMonster(PRODUCTION_BODY_ID, { x: 14, y: 12 })!
      : new Monster(14, 12, (monsters as MonsterData[]).find(m => m.id === type)!);
    if (!body) this.monsters.push(ally);
    for (const a of this.monsters) { a.isAlly = true; a.state = MonsterState.WANDERING; a.ticksUntilTurn = 0; if (body) a.behaviorFlags.add(type); }
    const enemy = new Monster(body === 'square' ? 16 : body ? 17 : 15, 12, (monsters as MonsterData[]).find(m => m.id === 'rat')!);
    enemy.hp = enemy.maxHp = 10000; enemy.ticksUntilTurn = 10000; this.monsters.push(enemy);
    (this as any).updateVision();
  });
  const g = fresh(); g.startNewGame({ seed: 42, ruleSet: 'extended',
    extensions: body ? ['body-fixture', 'party'] : combat ? ['combat', 'party'] : ['party'],
    extensionConfigurations: { party: { schema: 1, members: 1 } },
    initialCommands: [JSON.stringify({ module: 'party', action: 'create', payload: { schema: 1, members: 1 } })] });
  g.animationEnabled = false; clear(); return g;
}
function order(g: Game, attack: boolean) {
  const actor = g.monsters.find(m => m.isAlly && g.isBodyDecisionOwner(m.id))!, target = g.monsters.find(m => !m.isAlly)!;
  clear(); g.executeCommand('party:ai', { kind: 'party:ai', schema: 1, issuerSlot: 'local:0', expectedRevision: g.party!.state.revision,
    change: { kind: 'order', actorIds: [actor.id], order: attack ? { kind: 'attack', targetId: target.id }
      : { kind: 'guard', level: g.depth, x: actor.x, y: actor.y + 2 } } });
}
function lifecycle(g: Game) {
  const save = JSON.parse(JSON.stringify(g.toSaveSnapshot())), mid = digest(g), index = g.exportRecording().events.length;
  window(g); const expected = digest(g), random = rng.getState();
  const h = fresh(); expect(h.loadSnapshot(save)).toBe(true); expect(digest(h)).toEqual(mid);
  h.animationEnabled = false; window(h); expect(digest(h)).toEqual(expected); expect(rng.getState()).toEqual(random);
  const recording = h.exportRecording(); expect(h.loadReplay(recording)).toBe(true);
  while (h.replayCursor < recording.events.length && !h.replayError) { const cursor = h.replayCursor; clear(); h.replayStep(true); expect(h.replayCursor).toBeGreaterThan(cursor); }
  expect(h.replayError).toBeNull(); expect(digest(h)).toEqual(expected);
  h.replaySeek(index); expect(h.replayError).toBeNull(); expect(digest(h)).toEqual(mid);
  h.replaySeek(recording.events.length); expect(h.replayError).toBeNull(); expect(digest(h)).toEqual(expected);
}
afterEach(() => { games.splice(0).forEach(g => g.disposeRecording()); clear(); vi.restoreAllMocks(); });
it.each([
  { type: 'phoenix_egg', combat: false }, { type: 'arrow_turret', combat: false },
  { type: 'phoenix_egg', combat: true }, { type: 'arrow_turret', combat: true }
])('N2 $type uses one native prelude/remainder with combat=$combat; lifecycle', ({ type, combat }) => {
  const g = setup(type, combat), ally = g.monsters.find(m => m.isAlly)!, at = { ...ally.loc };
  const prelude = vi.spyOn(ally, 'prepareNativeDecision'), native = vi.spyOn(ally, 'takeNativeDecision');
  const magic = vi.spyOn(ally as any, 'tryUseBolt');
  order(g, false); window(g);
  const decisions = type === 'arrow_turret' ? 1 : 2; // arrow bolt pays 250 ticks, egg idle pays native 100
  expect(ally.loc).toEqual(at); expect(prelude).toHaveBeenCalledTimes(decisions); expect(native).toHaveBeenCalledTimes(decisions);
  expect(magic).toHaveBeenCalledTimes(decisions); expect(ally.ticksUntilTurn).toBe(type === 'arrow_turret' ? 150 : 100);
  if (type === 'arrow_turret') expect(g.monsters.find(m => !m.isAlly)!.hp).toBeLessThan(10000);
  expect(g.party!.state.companionOrders[0]!.ai.ordinal).toBe(0);
  // The same restriction applies to attack orders and the direct adapter.
  const target = g.monsters.find(m => !m.isAlly)!, hp = target.hp, random = rng.getState();
  g.commitPartyCompanionIntent(ally, { kind: 'move', dx: 0, dy: 1 });
  g.commitPartyCompanionIntent(ally, { kind: 'attack', targetId: target.id });
  ally.commitPartyOrderAttack(g, target);
  expect(ally.loc).toEqual(at); expect(target.hp).toBe(hp); expect(rng.getState()).toEqual(random);
  order(g, true); lifecycle(g);
});
it.each([
  { flag: 'MONST_IMMOBILE', shape: true }, { flag: 'MONST_TURRET', shape: true },
  { flag: 'MONST_IMMOBILE', shape: 'square' as const }, { flag: 'MONST_TURRET', shape: 'square' as const }
])('N2 spatial shape=$shape retains $flag constraints and lifecycle', ({ flag, shape }) => {
  const g = setup(flag, false, shape), body = g.monsters.filter(m => m.isAlly), positions = body.map(a => ({ ...a.loc }));
  const target = g.monsters.find(m => !m.isAlly)!, hp = target.hp;
  order(g, false); window(g); expect(body.map(a => a.loc)).toEqual(positions);
  expect(body[0]!.ticksUntilTurn).toBeGreaterThan(0); expect(target.hp).toBe(hp);
  expect(g.party!.state.companionOrders[0]!.ai.ordinal).toBe(0);
  order(g, true); lifecycle(g); expect(body.map(a => a.loc)).toEqual(positions); expect(target.hp).toBe(hp);
});
