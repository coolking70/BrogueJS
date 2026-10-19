import { validateController, validateAiState, type PartyController, type PartyAiState, type CompanionOrder } from './partyAi';
import { validateWindowState, type PartyWindowState } from './partyWindow';
/** P1a finite input contract. No engine objects, UI focus, plans or AI state. */
import { c5Canonical } from './worldJson';
import type { Json } from './types';
import type { LevelRef } from './world5';

export const PARTY_SCHEMA = 1 as const;
export const PARTY_LIMIT = 4;
export type PartyError = 'PARTY_DISABLED' | 'BAD_PAYLOAD' | 'VERSION_MISMATCH' |
  'STALE_REVISION' | 'BAD_SEQUENCE' | 'BAD_ACTOR' | 'NOT_CONTROLLER' | 'ACTOR_FROZEN' |
  'ACTOR_BUSY' | 'PLAN_LIMIT' | 'INVALID_TARGET' | 'ITEM_NOT_OWNED' | 'NO_SPACE' |
  'TRAVEL_NOT_READY' | 'STALE_DECISION' | 'DECISION_REQUIRED' | 'ZERO_TIME_LOOP' |
  'BUDGET_EXCEEDED' | 'INTERNAL_FAILURE';
export class PartyFailure extends Error {
  constructor(readonly code: PartyError) { super(code); }
}
export interface MemberState {
  actorId: number;
  life: 'active' | 'frozen' | 'dead';
  level: LevelRef;
  controller: PartyController;
  pendingController: PartyController | null;
  controlEpoch: number;
  temporaryAiSeq: number | null;
  ai: PartyAiState;
}
export interface PartyState {
  schema: 3;
  companionOrders: CompanionOrder[];
  window: PartyWindowState;
  revision: number;
  primaryActorId: number;
  leaderActorId: number;
  members: MemberState[];
}
export type ActorIntent =
  | { kind: 'move'; dx: number; dy: number }
  | { kind: 'wait' | 'search' }
  | { kind: 'attack'; targetId: number }
  | { kind: 'item'; operation: 'use' | 'equip' | 'unequip' | 'drop' | 'throw'; itemId: number; target: { x: number; y: number } | null }
  | { kind: 'exchange'; toActorId: number; itemId: number; quantity: number }
  | { kind: 'module'; owner: string; commandId: string; payload: Json };
export type SingleStepControl =
  | { kind: 'exit-party' }
  | { kind: 'leader'; actorId: number }
  | { kind: 'travel-party'; destination: LevelRef; leavingBehind: number[] }
  | { kind: 'recover-level'; destination: LevelRef };
interface InputHeader { schema: 1; expectedRevision: number; issuerSlot: string; actorId: number }
export type PartyInput = InputHeader & (
  { kind: 'party:actor-step'; intent: ActorIntent } |
  { kind: 'party:control'; change: SingleStepControl }
);

const fail = (): never => { throw new PartyFailure('BAD_PAYLOAD'); };
function keys(value: unknown, expected: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== expected.split(',').sort().join(',')) fail();
}
function integer(value: unknown, minimum = 0): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) fail();
}
function slot(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,63}$/.test(value)) fail();
}
function level(value: unknown): asserts value is LevelRef {
  // P1a has no site entry. Accepting a future shape would silently promise it.
  keys(value, 'kind,depth');
  if (value.kind !== 'dungeon') fail();
  integer(value.depth, 1);
  if (value.depth > 40) fail();
}
export function validateActorIntent(value: unknown): asserts value is ActorIntent {
  if (!value || typeof value !== 'object') fail();
  const row = value as Record<string, unknown>;
  switch (row.kind) {
    case 'wait': case 'search': keys(row, 'kind'); return;
    case 'move':
      keys(row, 'kind,dx,dy');
      if (![row.dx,row.dy].every(v => Number.isInteger(v) && Math.abs(v as number) <= 1) || (!row.dx && !row.dy)) fail();
      return;
    case 'attack': keys(row, 'kind,targetId'); integer(row.targetId, 1); return;
    case 'exchange':
      keys(row, 'kind,toActorId,itemId,quantity');
      integer(row.toActorId, 1); integer(row.itemId, 1); integer(row.quantity, 1); return;
    case 'item':
      keys(row, 'kind,operation,itemId,target'); integer(row.itemId, 1);
      if (!['use','equip','unequip','drop','throw'].includes(row.operation as string)) fail();
      if (row.target !== null) { keys(row.target, 'x,y'); integer(row.target.x); integer(row.target.y); }
      if (row.operation === 'throw' ? row.target === null : row.operation !== 'use' && row.target !== null) fail();
      return;
    case 'module':
      keys(row, 'kind,owner,commandId,payload'); slot(row.owner); slot(row.commandId); return;
    default: fail();
  }
}
/** Validate data before reading any discriminator, rejecting getters/prototypes. */
export function parsePartyInput(value: unknown): PartyInput {
  try { if(c5Canonical(value).length>16384)throw new PartyFailure('BUDGET_EXCEEDED'); } catch(error) { if(error instanceof PartyFailure)throw error;return fail(); }
  if (!value || typeof value !== 'object') fail();
  const row = value as Record<string, unknown>;
  if (row.kind !== 'party:actor-step' && row.kind !== 'party:control') fail();
  keys(row, `kind,schema,expectedRevision,issuerSlot,actorId,${row.kind === 'party:actor-step' ? 'intent' : 'change'}`);
  if (row.schema !== PARTY_SCHEMA) throw new PartyFailure('VERSION_MISMATCH');
  integer(row.expectedRevision); integer(row.actorId, 1); slot(row.issuerSlot);
  if (row.kind === 'party:actor-step') validateActorIntent(row.intent);
  else {
    const change = row.change as Record<string, unknown>;
    if (!change || typeof change !== 'object') fail();
    if(change.kind==='exit-party')keys(change,'kind');
    else if (change.kind === 'leader') { keys(change, 'kind,actorId'); integer(change.actorId, 1); }
    else if (change.kind === 'travel-party' || change.kind === 'recover-level') {
      keys(change, change.kind === 'travel-party' ? 'kind,destination,leavingBehind' : 'kind,destination');
      level(change.destination);
      if (change.kind === 'travel-party') {
        if (!Array.isArray(change.leavingBehind) || change.leavingBehind.length >= PARTY_LIMIT ||
          new Set(change.leavingBehind).size !== change.leavingBehind.length) fail();
        (change.leavingBehind as unknown[]).forEach(id => integer(id, 1));
      }
    } else fail();
  }
  return structuredClone(row) as unknown as PartyInput;
}
export function validatePartyState(value: unknown): asserts value is PartyState {
  try { c5Canonical(value); } catch { return fail(); }
  keys(value, 'schema,revision,primaryActorId,leaderActorId,members,window,companionOrders');
  if (value.schema !== 3) throw new PartyFailure('VERSION_MISMATCH');
  integer(value.revision); integer(value.primaryActorId, 1); integer(value.leaderActorId, 1);
  if (!Array.isArray(value.members) || !value.members.length || value.members.length > PARTY_LIMIT) fail();
  let previous = 0;
  const members = value.members as unknown[];
  for (const member of members) {
    keys(member, 'actorId,life,level,controller,pendingController,controlEpoch,temporaryAiSeq,ai'); integer(member.actorId, previous + 1); previous = member.actorId;
    if (!['active','frozen','dead'].includes(member.life as string)) fail();
    level(member.level); validateController(member.controller);
    if(member.pendingController!==null)validateController(member.pendingController);integer(member.controlEpoch);validateAiState(member.ai);
    if(member.temporaryAiSeq!==null){integer(member.temporaryAiSeq,1);if(member.temporaryAiSeq!==(value.window as PartyWindowState).seq||(value.window as PartyWindowState).phase!=='awaiting-decision'||member.life!=='active')fail();}
  }
  if (![value.primaryActorId,value.leaderActorId].every(id => (members as MemberState[]).some(m => m.actorId === id))) fail();
  if(!Array.isArray(value.companionOrders)||value.companionOrders.length>64)fail();
  let previousCompanion=0;for(const row of value.companionOrders as unknown[]){keys(row,'actorId,level,ai');integer(row.actorId,previousCompanion+1);previousCompanion=row.actorId;integer(row.level,1);if(row.level>40||(members as MemberState[]).some(m=>m.actorId===row.actorId))fail();validateAiState(row.ai);}
  validateWindowState(value.window,value as unknown as PartyState);
  const active = (members as MemberState[]).filter(m => m.life === 'active');
  if (active.some((m: MemberState) => c5Canonical(m.level) !== c5Canonical(active[0]!.level))) fail();
}

/** Authorization is engine-owned; the asserted issuer is never its own credential. */
export function authorizePartyInput(state: PartyState | undefined, input: PartyInput, authenticatedSlot: string, internal = false): MemberState {
  if (!state) throw new PartyFailure('PARTY_DISABLED');
  if (input.expectedRevision !== state.revision) throw new PartyFailure('STALE_REVISION');
  const member = state.members.find(m => m.actorId === input.actorId);
  if (!member || member.life === 'dead') throw new PartyFailure('BAD_ACTOR');
  if (input.issuerSlot !== authenticatedSlot || authenticatedSlot !== 'local:0' || input.kind === 'party:actor-step' && !internal && (member.controller.kind !== 'human' || member.controller.slot !== authenticatedSlot)) throw new PartyFailure('NOT_CONTROLLER');
  if (member.life === 'frozen' && !(input.kind === 'party:control' && input.change.kind === 'recover-level')) throw new PartyFailure('ACTOR_FROZEN');
  return member;
}
