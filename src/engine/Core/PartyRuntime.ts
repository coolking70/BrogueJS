import { ControlledActor } from '../../entities/ControlledActor';
import type { Game } from './Game';
import { PartyFailure, type PartyState } from '../../ext/party';
import { assertPartyOwnership, type PartyActorPort, type PartyWorldRead } from './PartyState';

/** Secondary members share native capabilities, not the unique Player class. */
export class PartyMember extends ControlledActor {
  public get isAlly(): true { return true; }
}
export interface PartyRuntime {
  state: PartyState;
  /** Only non-primary entities are owned here. The primary remains Game.player. */
  actors: Map<number, PartyMember>;
  native: Record<number, { modal:boolean;falling:boolean;pendingTurn:boolean; poisonedDuringTurn:boolean; searchingCharge:number; justSearched:boolean; justRested:boolean; lastDamageSource:string; receivedLevitationWarning:boolean }>;
}
/** Transient trusted execution scope. UI focus is intentionally a different map. */
const scopes = new WeakMap<object, ControlledActor>();
const focus = new WeakMap<object, number>();
export function currentPartyActor(owner: object): ControlledActor | undefined { return scopes.get(owner); }
export function withPartyActor<T>(owner: object, actor: ControlledActor, perform: () => T): T {
  const previous=scopes.get(owner);
  scopes.set(owner, actor);
  try {
    const result = perform();
    if (result && typeof (result as {then?: unknown}).then === 'function') throw new PartyFailure('INTERNAL_FAILURE');
    return result;
  } finally { if(previous)scopes.set(owner,previous);else scopes.delete(owner); }
}
export function resetPartySession(owner: object): void { scopes.delete(owner); focus.delete(owner); }
export function setPartyFocus(owner: object, state: PartyState, id: number): void {
  if (!state.members.some(m => m.actorId === id)) throw new PartyFailure('BAD_ACTOR');
  focus.set(owner, id);
}
export function partyFocus(owner: object, state: PartyState): number {
  return focus.get(owner) ?? state.members.find(m => m.life === 'active')?.actorId ?? state.primaryActorId;
}
/** Pure adapter for ownership/readiness, also usable during detached decode. */
export function partyWorldRead(game: Pick<Game, 'player' | 'depth'> & Partial<Pick<Game,'world5'>>, root: PartyRuntime,
  busy: (id: number) => boolean = () => false): PartyWorldRead {
  return {
    level: {kind:'dungeon',depth:game.depth},
    actor(id): PartyActorPort | undefined {
      const entity = id === game.player.id ? game.player : root.actors.get(id);
      if (!entity) return;
      return { entity, busy:busy(id), resident:game.world5?.residents.some(r=>r.actorId===id)??false, raider:game.world5?.raidCamps.some(c=>c.event?.actorIds.includes(id))??false, temporary:entity.hasStatus('lifespan_remaining'),
        singleCell:!entity.spatial };
    }
  };
}
export function assertPartyRuntime(game: Pick<Game, 'player' | 'depth'> & Partial<Pick<Game,'world5'>>, root: PartyRuntime): void {
  if (root.state.primaryActorId !== game.player.id || root.actors.has(game.player.id) ||
    root.actors.size !== root.state.members.length - 1 ||
    [...root.actors.keys()].some(id => !root.state.members.some(m => m.actorId === id))) throw new PartyFailure('BAD_ACTOR');
  assertPartyOwnership(root.state, partyWorldRead(game,root));
}
