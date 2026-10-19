/** P1c finite control protocol and detached policy capability. No engine objects. */
import { PartyFailure, validateActorIntent, type ActorIntent } from './party';
import { windowExact as exact, windowInt as integer } from './partyWindow';
import { c5Canonical } from './worldJson';
export const PARTY_AI_RULES = Object.freeze({
  policyId: 'party-ai-v1',
  keyVersion: 1,
  nodes: 4096,
  defaultTactic: 'follow',
  avoidDanger: true,
  autoPickup: false,
  consumables: false,
  healPercent: 25,
  recovery: ['potion_of_life', 'potion_of_healing', 'ration_of_food', 'mango'],
  priority: ['safety', 'recovery', 'order', 'tactic', 'pickup', 'wait'],
  switch: 'last-accepted-next-idle-clear-tail-human-clears-temporary',
  idle: 'window-and-native-modal-answered-zero-time-settlement',
  duplicateControl: 'effective-pending-first-temporary-human-only',
  companionCapabilities: 'immobile-turret-native-remainder-single-prelude',
  temporary: 'same-seq-pause-tail',
  still: 'defend-recover-no-displacement',
  exploration: 'known-down-stair-then-safe-frontier',
  guard: 'target-or-corner-safe-adjacent-if-occupied',
  rally: 'known-diagonal-clear-gather-guard-retreat',
  path: 'cardinal-stable-bfs-aggregate-budget',
  expectedFailure: 'rollback-then-one-normal-wait',
  pickup: 'active-target-filter-and-avoids-revalidated-ai-walk-respects-avoids-native-incidental-pickup',
  selection: 'stable-candidates-derived-fnv1a'
});
export type PartyController =
  | { kind: 'human'; slot: 'local:0' }
  | { kind: 'ai'; policyId: 'party-ai-v1' };
export type PartyTactic = 'follow' | 'attack' | 'distance' | 'defend' | 'still';
export interface PartyAiSettings {
  tactic: PartyTactic;
  avoidDanger: boolean;
  autoPickup: boolean;
  consumables: boolean;
}
export type PartyOrder =
  | { kind: 'gather' | 'guard' | 'retreat'; level: number; x: number; y: number }
  | { kind: 'attack'; targetId: number }
  | { kind: 'explore'; level: number };
export interface PartyAiState {
  settings: PartyAiSettings;
  order: PartyOrder | null;
  ordinal: number;
  diagnostic: string;
}
export const defaultPartyAi = (): PartyAiState => ({
  settings: { tactic: 'follow', avoidDanger: true, autoPickup: false, consumables: false },
  order: null,
  ordinal: 0,
  diagnostic: 'idle'
});
export interface CompanionOrder {
  actorId: number;
  level: number;
  ai: PartyAiState;
}
export interface PartyAiInput {
  kind: 'party:ai';
  schema: 1;
  expectedRevision: number;
  issuerSlot: 'local:0';
  change:
    | { kind: 'controller'; actorId: number; expectedEpoch: number; controller: PartyController }
    | { kind: 'settings'; actorId: number; expectedEpoch: number; settings: PartyAiSettings }
    | { kind: 'order'; actorIds: number[]; order: PartyOrder | null };
}
export function validateController(v: unknown): asserts v is PartyController {
  if ((v as PartyController)?.kind === 'human') {
    exact(v, 'kind,slot');
    if (v.slot !== 'local:0') throw new PartyFailure('NOT_CONTROLLER');
  } else {
    exact(v, 'kind,policyId');
    if (v.kind !== 'ai' || v.policyId !== 'party-ai-v1') throw new PartyFailure('BAD_PAYLOAD');
  }
}
export function validateAiSettings(v: unknown): asserts v is PartyAiSettings {
  exact(v, 'tactic,avoidDanger,autoPickup,consumables');
  if (
    !['follow', 'attack', 'distance', 'defend', 'still'].includes(v.tactic as string) ||
    [v.avoidDanger, v.autoPickup, v.consumables].some((x) => typeof x !== 'boolean')
  )
    throw new PartyFailure('BAD_PAYLOAD');
}
export function validatePartyOrder(v: unknown): asserts v is PartyOrder | null {
  if (v === null) return;
  const kind = (v as PartyOrder)?.kind;
  if (kind === 'attack') {
    exact(v, 'kind,targetId');
    integer(v.targetId, 1);
    return;
  }
  if (kind === 'explore') exact(v, 'kind,level');
  else {
    exact(v, 'kind,level,x,y');
    if (!['gather', 'guard', 'retreat'].includes(kind)) throw new PartyFailure('BAD_PAYLOAD');
    integer(v.x);
    integer(v.y);
    if (v.x > 1024 || v.y > 1024) throw new PartyFailure('BAD_PAYLOAD');
  }
  integer(v.level, 1);
  if (v.level > 40) throw new PartyFailure('BAD_PAYLOAD');
}
export function validateAiState(v: unknown): asserts v is PartyAiState {
  exact(v, 'settings,order,ordinal,diagnostic');
  validateAiSettings(v.settings);
  validatePartyOrder(v.order);
  integer(v.ordinal);
  if (
    ![
      'idle',
      'wait',
      'follow-unavailable',
      'target-lost',
      'no-route',
      'budget',
      'move',
      'attack',
      'recover',
      'pickup',
      'explore-complete',
      'no-ranged',
      'hold'
    ].includes(v.diagnostic as string)
  )
    throw new PartyFailure('BAD_PAYLOAD');
}
export function parsePartyAiInput(v: unknown): PartyAiInput {
  try {
    if (c5Canonical(v).length > 16384) throw new Error();
  } catch {
    throw new PartyFailure('BAD_PAYLOAD');
  }
  exact(v, 'kind,schema,expectedRevision,issuerSlot,change');
  if (v.kind !== 'party:ai' || v.schema !== 1) throw new PartyFailure('VERSION_MISMATCH');
  integer(v.expectedRevision);
  if (v.issuerSlot !== 'local:0') throw new PartyFailure('NOT_CONTROLLER');
  const c = v.change as PartyAiInput['change'];
  if (c?.kind === 'order') {
    exact(c, 'kind,actorIds,order');
    if (
      !Array.isArray(c.actorIds) ||
      !c.actorIds.length ||
      c.actorIds.length > 64 ||
      new Set(c.actorIds).size !== c.actorIds.length
    )
      throw new PartyFailure('BAD_PAYLOAD');
    c.actorIds.forEach((id) => integer(id, 1));
    validatePartyOrder(c.order);
  } else {
    if (c?.kind === 'controller') {
      exact(c, 'kind,actorId,expectedEpoch,controller');
      validateController(c.controller);
    } else {
      exact(c, 'kind,actorId,expectedEpoch,settings');
      if (c.kind !== 'settings') throw new PartyFailure('BAD_PAYLOAD');
      validateAiSettings(c.settings);
    }
    integer(c.actorId, 1);
    integer(c.expectedEpoch);
  }
  return structuredClone(v) as unknown as PartyAiInput;
}
export interface PartyAiView {
  seed: string;
  fingerprint: string;
  actorId: number;
  ordinal: number;
  level: number;
  at: { x: number; y: number };
  hp: number;
  maxHp: number;
  leader: { x: number; y: number } | null;
  cells: readonly {
    x: number;
    y: number;
    passable: boolean;
    danger: boolean;
    stairs: boolean;
    downStairs?: boolean;
    blocksDiagonal?: boolean;
  }[];
  occupied: readonly { x: number; y: number }[];
  enemies: readonly {
    id: number;
    x: number;
    y: number;
    attackable: boolean;
    ranged: boolean;
    adjacent?: boolean;
  }[];
  recovery: readonly number[];
  rangedItem: number | null;
  pickups: readonly { id: number; x: number; y: number }[];
  settings: PartyAiSettings;
  order: PartyOrder | null;
}
export interface PartyAiDecision {
  intent: ActorIntent;
  diagnostic: string;
  nodes: number;
}
export function validAiDecision(v: unknown): v is PartyAiDecision {
  try {
    exact(v, 'intent,diagnostic,nodes');
    validateActorIntent(v.intent);
    integer(v.nodes);
    validateAiState({ ...defaultPartyAi(), diagnostic: v.diagnostic });
    return v.nodes <= 4096;
  } catch {
    return false;
  }
}
