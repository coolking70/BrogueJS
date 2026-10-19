/** P1b data-only, finite window protocol. Session drafts and clocks never enter it. */
import { PartyFailure, validateActorIntent, type ActorIntent, type PartyState } from './party';
import { c5Canonical } from './worldJson';
import type { LevelRef } from './world5';
export const PARTY_WINDOW_RULES = Object.freeze({
  schema: 2,
  inputMaxBytes: 262144,
  stateMaxBytes: 4194304,
  queueLimit: 32,
  batchLimit: 128,
  decisionLimit: 1024,
  fineLimit: 1000,
  lowHpPercent: 25,
  quietWindows: 3,
  defaultSoftReaction: 'stop',
  defaultEmptyPlan: 'wait'
});
export const SOFT_INTERRUPTS = [
  'new-hostile',
  'damage',
  'negative-status',
  'low-hp',
  'telegraph'
] as const;
export type SoftInterrupt = (typeof SOFT_INTERRUPTS)[number];
export type InterruptKind =
  | SoftInterrupt
  | 'plan-invalid'
  | 'decision-required'
  | 'stairs'
  | 'trap-warning'
  | 'member-death'
  | 'level-transfer'
  | 'displacement'
  | 'no-active-member'
  | 'game-ended'
  | 'budget-exceeded'
  | 'zero-time-loop';
export type PartyPlan =
  | { kind: 'queue'; actions: ActorIntent[] }
  | { kind: 'travel'; level: LevelRef; target: { x: number; y: number } }
  | { kind: 'ai-this-window' };
export type WindowLength = { kind: 'fine' } | { kind: 'ticks'; ticks: 100 | 300 | 1000 };
export type WindowTrigger = 'manual' | 'all-ready' | 'deadline' | 'single-step';
export interface WindowBatch {
  kind: 'party:window';
  schema: 2;
  seq: number;
  expectedRevision: number;
  issuerSlot: string;
  startTick: number;
  length: WindowLength;
  fineActorId: number | null;
  automatic: boolean;
  trigger: WindowTrigger;
  plans: {
    actorId: number;
    controllerSlot: string;
    update: 'replace' | 'keep';
    plan: PartyPlan | null;
  }[];
}
export interface WindowDecision {
  kind: 'party:decision';
  schema: 1;
  expectedRevision: number;
  issuerSlot: string;
  actorId: number;
  decisionId: number;
  choiceId: string;
}
export interface InterruptFact {
  kind: InterruptKind;
  tick: number;
  actorId: number | null;
  sourceId: number | null;
  detailKey: string;
}
export interface WindowTrace {
  ordinal: number;
  tick: number;
  actorId: number;
  intent: ActorIntent;
  outcome: 'accepted' | 'rejected';
  actionId: number | null;
  chargedTicks: number;
  decisions: string[];
}
export interface WindowReceipt {
  seq: number;
  segment: number;
  startTick: number;
  endTick: number;
  reason: 'budget' | 'fine-action' | 'interrupt' | 'decision' | 'terminal';
  trace: WindowTrace[];
  interrupts: InterruptFact[];
}
export interface PendingPartyDecision {
  id: number;
  actorId: number;
  intentOrdinal: number;
  worldRevision: number;
  kind: 'confirm' | 'modal' | 'dialogue';
  requestKey: string;
  prompt: string;
  allowedChoiceIds: string[];
  intent: ActorIntent;
  answers: boolean[];
}
export interface WindowMember {
  actorId: number;
  plan: PartyPlan | null;
  cursor: number;
  emptyPlan: 'wait' | 'interrupt';
  reactions: Record<SoftInterrupt, 'stop' | 'continue' | 'ai-this-window'>;
  seenHostileIds: number[];
  lowHpLatched: boolean;
  seenTelegraphKeys: string[];
  lastDecisionSite: string | null;
}
export interface PartyWindowState {
  singleStep:boolean;
  seq: number;
  segment: number;
  phase: 'planning' | 'running' | 'interrupted' | 'awaiting-decision' | 'failed';
  startedAt: number;
  elapsed: number;
  budget: number;
  length: WindowLength;
  fineActorId: number | null;
  fineStarted: boolean;
  automatic: boolean;
  quietWindows: number;
  nextOrdinal: number;
  nextDecisionId: number;
  members: WindowMember[];
  decision: PendingPartyDecision | null;
  receipt: WindowReceipt | null;
}
export function newPartyWindow(ids: number[]): PartyWindowState {
  return {
    singleStep:false,
    seq: 0,
    segment: 0,
    phase: 'planning',
    startedAt: 0,
    elapsed: 0,
    budget: 100,
    length: { kind: 'ticks', ticks: 100 },
    fineActorId: null,
    fineStarted: false,
    automatic: false,
    quietWindows: 0,
    nextOrdinal: 0,
    nextDecisionId: 1,
    members: ids.map((actorId) => ({
      actorId,
      plan: null,
      cursor: 0,
      emptyPlan: 'wait',
      reactions: Object.fromEntries(
        SOFT_INTERRUPTS.map((k) => [k, 'stop'])
      ) as WindowMember['reactions'],
      seenHostileIds: [],
      lowHpLatched: false,
      seenTelegraphKeys: [],
      lastDecisionSite: null
    })),
    decision: null,
    receipt: null
  };
}
export function windowExact(v: unknown, fields: string): asserts v is Record<string, unknown> {
  if (
    !v ||
    typeof v !== 'object' ||
    Array.isArray(v) ||
    Object.keys(v).sort().join(',') !== fields.split(',').sort().join(',')
  )
    throw new PartyFailure('BAD_PAYLOAD');
}
export function windowInt(v: unknown, min = 0): asserts v is number {
  if (!Number.isSafeInteger(v) || Number(v) < min) throw new PartyFailure('BAD_PAYLOAD');
}
function json(v: unknown, max: number = PARTY_WINDOW_RULES.inputMaxBytes) {
  try {
    if (new TextEncoder().encode(c5Canonical(v)).byteLength > max) throw new Error();
  } catch {
    throw new PartyFailure('BAD_PAYLOAD');
  }
}
function length(v: unknown): asserts v is WindowLength {
  if ((v as WindowLength)?.kind === 'fine') windowExact(v, 'kind');
  else {
    windowExact(v, 'kind,ticks');
    if (v.kind !== 'ticks' || ![100, 300, 1000].includes(v.ticks as number))
      throw new PartyFailure('BAD_PAYLOAD');
  }
}
export function validatePartyPlan(v: unknown): asserts v is PartyPlan | null {
  if (v === null) return;
  if((v as PartyPlan)?.kind==='ai-this-window'){windowExact(v,'kind');return;}
  if ((v as PartyPlan)?.kind === 'queue') {
    windowExact(v, 'kind,actions');
    if (!Array.isArray(v.actions) || v.actions.length > 32) throw new PartyFailure('PLAN_LIMIT');
    v.actions.forEach(validateActorIntent);
  } else {
    windowExact(v, 'kind,level,target');
    if (v.kind !== 'travel') throw new PartyFailure('BAD_PAYLOAD');
    windowExact(v.level, 'kind,depth');
    if (v.level.kind !== 'dungeon') throw new PartyFailure('BAD_PAYLOAD');
    windowInt(v.level.depth, 1);
    if (v.level.depth > 40) throw new PartyFailure('BAD_PAYLOAD');
    windowExact(v.target, 'x,y');
    windowInt(v.target.x);
    windowInt(v.target.y);
  }
}
export function parseWindowInput(value: unknown): WindowBatch | WindowDecision {
  json(value);
  const row = value as WindowBatch | WindowDecision;
  if (row?.kind === 'party:decision') {
    windowExact(row, 'kind,schema,expectedRevision,issuerSlot,actorId,decisionId,choiceId');
    windowInt(row.actorId, 1);
    windowInt(row.decisionId, 1);
    if (typeof row.choiceId !== 'string' || row.choiceId.length > 128)
      throw new PartyFailure('BAD_PAYLOAD');
  } else {
    windowExact(
      row,
      'kind,schema,seq,expectedRevision,issuerSlot,startTick,length,fineActorId,automatic,trigger,plans'
    );
    if (row.kind !== 'party:window') throw new PartyFailure('BAD_PAYLOAD');
    windowInt(row.seq, 1);
    windowInt(row.startTick);
    length(row.length);
    if (
      typeof row.automatic !== 'boolean' ||
      !['manual', 'all-ready', 'deadline', 'single-step'].includes(row.trigger)
    )
      throw new PartyFailure('BAD_PAYLOAD');
    if (row.length.kind === 'fine') {
      windowInt(row.fineActorId, 1);
      if (row.automatic) throw new PartyFailure('BAD_PAYLOAD');
    } else if (row.fineActorId !== null) throw new PartyFailure('BAD_PAYLOAD');
    if (!Array.isArray(row.plans) || row.plans.length > 4) throw new PartyFailure('PLAN_LIMIT');
    const ids = new Set<number>();
    let total = 0;
    for (const p of row.plans) {
      windowExact(p, 'actorId,controllerSlot,update,plan');
      windowInt(p.actorId, 1);
      if (
        ids.has(p.actorId) ||
        !['replace', 'keep'].includes(p.update) ||
        p.controllerSlot !== 'local:0' ||
        (p.update === 'keep' && p.plan !== null)
      )
        throw new PartyFailure('BAD_PAYLOAD');
      ids.add(p.actorId);
      validatePartyPlan(p.plan);
      total += p.plan?.kind === 'queue' ? p.plan.actions.length : 0;
    }
    if (total > 128) throw new PartyFailure('PLAN_LIMIT');
  }
  if (row.schema !== (row.kind==='party:window'?2:1)) throw new PartyFailure('VERSION_MISMATCH');
  windowInt(row.expectedRevision);
  if (row.issuerSlot !== 'local:0') throw new PartyFailure('NOT_CONTROLLER');
  return structuredClone(row);
}
export function validateWindowState(
  v: unknown,
  state: Pick<PartyState, 'members' | 'revision'>
): asserts v is PartyWindowState {
  json(v, PARTY_WINDOW_RULES.stateMaxBytes);
  windowExact(
    v,
    'singleStep,seq,segment,phase,startedAt,elapsed,budget,length,fineActorId,fineStarted,automatic,quietWindows,nextOrdinal,nextDecisionId,members,decision,receipt'
  );
  const w = v as unknown as PartyWindowState;
  for (const n of [w.seq, w.segment, w.startedAt, w.elapsed, w.nextOrdinal, w.quietWindows])
    windowInt(n);
  windowInt(w.nextDecisionId, 1);
  length(w.length);
  if (
    !['planning', 'interrupted', 'awaiting-decision', 'failed'].includes(w.phase) ||
    ![100, 300, 1000].includes(w.budget) ||
    w.elapsed > w.budget ||
    typeof w.automatic !== 'boolean' || typeof w.singleStep !== 'boolean' ||
    typeof w.fineStarted !== 'boolean' ||
    w.quietWindows > 3
  )
    throw new PartyFailure('BAD_PAYLOAD');
  if(w.singleStep&&(w.length.kind!=='ticks'||w.length.ticks!==1000||w.budget!==1000||w.automatic||w.fineActorId!==null))throw new PartyFailure('BAD_PAYLOAD');
  if (w.fineActorId !== null && !state.members.some((m) => m.actorId === w.fineActorId))
    throw new PartyFailure('BAD_ACTOR');
  if (!Array.isArray(w.members) || w.members.length !== state.members.length)
    throw new PartyFailure('BAD_PAYLOAD');
  w.members.forEach((m, i) => {
    windowExact(
      m,
      'actorId,plan,cursor,emptyPlan,reactions,seenHostileIds,lowHpLatched,seenTelegraphKeys,lastDecisionSite'
    );
    if (m.actorId !== state.members[i]?.actorId) throw new PartyFailure('BAD_ACTOR');
    validatePartyPlan(m.plan);
    windowInt(m.cursor);
    if (
      m.cursor > (m.plan?.kind === 'queue' ? m.plan.actions.length : 0) ||
      !['wait', 'interrupt'].includes(m.emptyPlan) ||
      typeof m.lowHpLatched !== 'boolean'
    )
      throw new PartyFailure('BAD_PAYLOAD');
    windowExact(m.reactions, SOFT_INTERRUPTS.join(','));
    if (Object.values(m.reactions).some((v) => v !== 'stop' && v !== 'continue' && v !== 'ai-this-window'))
      throw new PartyFailure('BAD_PAYLOAD');
    if (
      !Array.isArray(m.seenHostileIds) ||
      new Set(m.seenHostileIds).size !== m.seenHostileIds.length ||
      !Array.isArray(m.seenTelegraphKeys) ||
      m.seenTelegraphKeys.some((k) => typeof k !== 'string') ||
      (m.lastDecisionSite !== null && typeof m.lastDecisionSite !== 'string')
    )
      throw new PartyFailure('BAD_PAYLOAD');
    m.seenHostileIds.forEach((n) => windowInt(n, 1));
  });
  if ((w.phase === 'awaiting-decision') !== (w.decision !== null))
    throw new PartyFailure('BAD_PAYLOAD');
  if (w.decision) {
    const d = w.decision;
    windowExact(
      d,
      'id,actorId,intentOrdinal,worldRevision,kind,requestKey,prompt,allowedChoiceIds,intent,answers'
    );
    windowInt(d.id, 1);
    windowInt(d.intentOrdinal);
    if (
      d.intentOrdinal !== w.nextOrdinal ||
      d.id >= w.nextDecisionId ||
      d.worldRevision !== state.revision ||
      !state.members.some((m) => m.actorId === d.actorId && m.life === 'active') ||
      !['confirm', 'modal', 'dialogue'].includes(d.kind) ||
      d.requestKey !== 'ext.party.decision.' + d.kind ||
      typeof d.prompt !== 'string' ||
      d.prompt.length > 8192 ||
      !Array.isArray(d.answers) ||
      d.answers.some((a) => typeof a !== 'boolean') ||
      d.answers.length > 32 ||
      !Array.isArray(d.allowedChoiceIds) ||
      !d.allowedChoiceIds.length ||
      new Set(d.allowedChoiceIds).size !== d.allowedChoiceIds.length ||
      d.allowedChoiceIds.some((c) => typeof c !== 'string' || c.length > 128)
    )
      throw new PartyFailure('BAD_PAYLOAD');
    validateActorIntent(d.intent);
    if (d.kind === 'confirm' && d.allowedChoiceIds.join(',') !== 'yes,no')
      throw new PartyFailure('BAD_PAYLOAD');
  }
  if (w.receipt) {
    const r = w.receipt;
    windowExact(r, 'seq,segment,startTick,endTick,reason,trace,interrupts');
    windowInt(r.startTick);
    windowInt(r.endTick);
    if (
      r.seq !== w.seq ||
      r.segment !== w.segment ||
      r.endTick !== w.startedAt + w.elapsed ||
      r.startTick < w.startedAt ||
      r.startTick > r.endTick ||
      !['budget', 'fine-action', 'interrupt', 'decision', 'terminal'].includes(r.reason) ||
      !Array.isArray(r.trace) ||
      r.trace.length > 1024 ||
      !Array.isArray(r.interrupts)
    )
      throw new PartyFailure('BAD_PAYLOAD');
    let last = -1;
    for (const t of r.trace) {
      windowExact(t, 'ordinal,tick,actorId,intent,outcome,actionId,chargedTicks,decisions');
      windowInt(t.ordinal, last + 1);
      last = t.ordinal;
      windowInt(t.tick);
      windowInt(t.chargedTicks);
      if (t.tick < r.startTick || t.tick > r.endTick || t.ordinal >= w.nextOrdinal)
        throw new PartyFailure('BAD_PAYLOAD');
      if (t.actionId !== null) windowInt(t.actionId, 1);
      if (
        !state.members.some((m) => m.actorId === t.actorId) ||
        !['accepted', 'rejected'].includes(t.outcome) ||
        !Array.isArray(t.decisions) ||
        t.decisions.some((v) => typeof v !== 'string')
      )
        throw new PartyFailure('BAD_PAYLOAD');
      validateActorIntent(t.intent);
    }
    for (const f of r.interrupts) {
      windowExact(f, 'kind,tick,actorId,sourceId,detailKey');
      windowInt(f.tick);
      if (f.tick < r.startTick || f.tick > r.endTick) throw new PartyFailure('BAD_PAYLOAD');
      if (
        ![
          ...SOFT_INTERRUPTS,
          'plan-invalid',
          'decision-required',
          'stairs',
          'trap-warning',
          'member-death',
          'level-transfer',
          'displacement',
          'no-active-member',
          'game-ended',
          'budget-exceeded',
          'zero-time-loop'
        ].includes(f.kind) ||
        f.detailKey !== 'ext.party.interrupt.' + f.kind ||
        (f.actorId !== null && !state.members.some((m) => m.actorId === f.actorId))
      )
        throw new PartyFailure('BAD_PAYLOAD');
      if (f.sourceId !== null) windowInt(f.sourceId, 1);
    }
  }
}
/** Separate new control protocol; P1a party:control schema1 is unchanged. */
export interface WindowPolicy {
  kind: 'party:policy';
  schema: 2;
  expectedRevision: number;
  issuerSlot: string;
  actorId: number;
  change:
    | {
        kind: 'reactions';
        emptyPlan: 'wait' | 'interrupt';
        values: Record<SoftInterrupt, 'stop' | 'continue' | 'ai-this-window'>;
      }
    | { kind: 'single-step' };
}
export function parseWindowPolicy(value: unknown): WindowPolicy {
  json(value);
  windowExact(value, 'kind,schema,expectedRevision,issuerSlot,actorId,change');
  if (value.kind !== 'party:policy' || value.schema !== 2)
    throw new PartyFailure('VERSION_MISMATCH');
  windowInt(value.expectedRevision);
  windowInt(value.actorId, 1);
  if (value.issuerSlot !== 'local:0') throw new PartyFailure('NOT_CONTROLLER');
  if ((value.change as { kind: string })?.kind === 'single-step') windowExact(value.change, 'kind');
  else {
    windowExact(value.change, 'kind,emptyPlan,values');
    if (
      value.change.kind !== 'reactions' ||
      !['wait', 'interrupt'].includes(value.change.emptyPlan as string)
    )
      throw new PartyFailure('BAD_PAYLOAD');
    windowExact(value.change.values, SOFT_INTERRUPTS.join(','));
    if (Object.values(value.change.values).some((v) => v !== 'stop' && v !== 'continue' && v !== 'ai-this-window'))
      throw new PartyFailure('BAD_PAYLOAD');
  }
  return structuredClone(value) as unknown as WindowPolicy;
}
