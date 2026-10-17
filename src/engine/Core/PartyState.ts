/** Foundation-owned roster and single-clock readiness. Entity and timer fields
 * are deliberately read from their owners rather than copied into the roster. */
import { PartyFailure, validatePartyState, type MemberState, type PartyState } from '../../ext/party';
import type { Creature } from '../../entities/Creature';
import type { LevelRef } from '../../ext/world5';

export interface PartyActorPort {
  readonly entity: Creature;
  readonly busy: boolean;
  readonly resident: boolean;
  readonly raider: boolean;
  readonly temporary: boolean;
  readonly singleCell: boolean;
}
export interface PartyWorldRead {
  actor(id: number): PartyActorPort | undefined;
  readonly level: LevelRef;
}
export const samePartyLevel = (a: LevelRef, b: LevelRef): boolean =>
  a.kind === b.kind && (a.kind === 'dungeon' ? a.depth === (b as typeof a).depth : a.id === (b as typeof a).id);

/** A same-ID conversion seam, intentionally with no resident/raid recruitment
 * entry in P1a. The caller must complete an atomic identity handoff first. */
export function assertMemberEligibility(actor: PartyActorPort): void {
  if (!actor.singleCell || actor.resident || actor.raider || actor.temporary || actor.entity.hp <= 0)
    throw new PartyFailure('BAD_ACTOR');
}
export function assertPartyOwnership(state: PartyState, world: PartyWorldRead): void {
  validatePartyState(state);
  const entities = new Set<Creature>();
  for (const row of state.members) {
    const actor = world.actor(row.actorId);
    if (!actor || actor.entity.id !== row.actorId || entities.has(actor.entity) ||
      !actor.singleCell || actor.resident || actor.raider || actor.temporary ||
      (row.life === 'dead') !== (actor.entity.hp <= 0) ||
      (row.life === 'active' && !samePartyLevel(row.level, world.level)))
      throw new PartyFailure('BAD_ACTOR');
    if(row.life!=='dead')assertMemberEligibility(actor);
    entities.add(actor.entity);
  }
}
/** Stable member order applies only to newly available controlled decisions;
 * the native monster scheduler retains its existing ordering. */
export function readyPartyMember(state: PartyState, world: PartyWorldRead): MemberState | undefined {
  return state.members.find(row => {
    if (row.life !== 'active' || !samePartyLevel(row.level, world.level)) return false;
    const actor = world.actor(row.actorId);
    return !!actor && actor.entity.hp > 0 && actor.entity.ticksUntilTurn <= 0 && !actor.busy &&
      !actor.entity.hasStatus('paralyzed') && !actor.entity.hasStatus('slumber') && !actor.entity.hasStatus('entranced');
  });
}
export function nextPartyBoundary(state: PartyState, world: PartyWorldRead): number | null {
  let next = Infinity;
  for (const row of state.members) {
    if (row.life !== 'active' || !samePartyLevel(row.level, world.level)) continue;
    const actor = world.actor(row.actorId);
    if (actor && actor.entity.hp > 0 && !actor.busy) next = Math.min(next, Math.max(0, actor.entity.ticksUntilTurn));
  }
  return Number.isFinite(next) ? next : null;
}
/** Called once for a positive world-clock delta. Scheduler-owned busy timers
 * are mirrors and never charged here. No environment, NPC or resident work. */
export function advancePartyTimers(state: PartyState, world: PartyWorldRead, elapsed: number): void {
  if (!Number.isSafeInteger(elapsed) || elapsed <= 0) throw new PartyFailure('BAD_PAYLOAD');
  const actors = state.members.filter(row => row.life === 'active' && samePartyLevel(row.level, world.level))
    .map(row => world.actor(row.actorId)).filter((actor): actor is PartyActorPort => !!actor && actor.entity.hp > 0 && !actor.busy);
  if (actors.some(actor => !Number.isSafeInteger(actor.entity.ticksUntilTurn) || actor.entity.ticksUntilTurn < elapsed))
    throw new PartyFailure('BAD_SEQUENCE');
  for (const actor of actors) actor.entity.ticksUntilTurn -= elapsed;
}
/** Integer pool allocation precedes each recipient's XP multiplier. A dead
 * historical participant keeps its terminal receipt share; no redistribution. */
export function splitPartyPool(amount: number, participants: readonly number[]): readonly { actorId: number; amount: number }[] {
  if (!Number.isSafeInteger(amount) || amount < 0 || participants.some(id => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(participants).size !== participants.length) throw new PartyFailure('BAD_PAYLOAD');
  const ids = [...participants].sort((a,b) => a-b);
  if (!ids.length) return [];
  const share = Math.floor(amount / ids.length), remainder = amount % ids.length;
  return ids.map((actorId, index) => ({ actorId, amount: share + Number(index < remainder) }));
}
/** M10: translate absolute deadlines by the inactive interval. Run this inside
 * the owner's transaction; validation completes before any field is changed. */
export function thawPartyDeadlines(frozenAt: number, now: number, deadlines: readonly number[]): readonly number[] {
  if (!Number.isSafeInteger(frozenAt) || frozenAt < 0 || !Number.isSafeInteger(now) || now < frozenAt)
    throw new PartyFailure('BAD_PAYLOAD');
  const elapsed = now - frozenAt;
  return deadlines.map(deadline => {
    if (!Number.isSafeInteger(deadline) || deadline < 0 || !Number.isSafeInteger(deadline + elapsed))
      throw new PartyFailure('BUDGET_EXCEEDED');
    return deadline + elapsed;
  });
}
