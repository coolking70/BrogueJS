import { isPartyAi } from './PartyAi';
import type { PartyAiDecision } from '../../ext/partyAi';
import { PartyFailure, type ActorIntent, type PartyState } from '../../ext/party';
import {
  SOFT_INTERRUPTS,
  type InterruptFact,
  type InterruptKind,
  type PendingPartyDecision,
  type PartyPlan,
  type WindowBatch,
  type WindowDecision,
  type WindowReceipt
} from '../../ext/partyWindow';

export interface WindowActorView {
  id: number;
  hp: number;
  maxHp: number;
  depth: number;
  active: boolean;
  at: { x: number; y: number };
  remaining: number;
  busy: boolean;
  statuses: Record<string, number>;
  hostiles: number[];
  telegraphs: string[];
  site: string | null;
  hazard: boolean;
}
export interface WindowAttempt {
  rejected?: boolean;
  chargedTicks: number;
  actionId: number | null;
  pending?: { kind: 'confirm' | 'modal' | 'dialogue'; choices: string[]; prompt: string };
  cancelled?: boolean;
}
export interface PartyWindowPort {
  state: PartyState;
  tick(): number;
  ended(): boolean;
  actors(): WindowActorView[];
  ready(): number | null;
  validate(actorId: number, intent: ActorIntent, staticOnly: boolean): void;
  travel(
    actorId: number,
    plan: Extract<PartyPlan, { kind: 'travel' }>,
    staticOnly: boolean
  ): ActorIntent | null;
  attempt(actorId: number, intent: ActorIntent, answers: boolean[]): WindowAttempt;
  modalIntent(d: PendingPartyDecision, choice: string): ActorIntent;
  advance(): void;
  decide?(id:number): PartyAiDecision;
}
/** A call-stack capability only; never reconstruct mechanical state from this map. */
const running = new WeakMap<
  object,
  {
    remaining(): number;
    stop(): boolean;
    fact(
      kind: 'damage' | 'negative-status' | 'low-hp' | 'displacement',
      actorId: number,
      status?: string
    ): void;
    checkpoint(): () => void;
  }
>();
export function windowClock(owner: object) {
  return running.get(owner);
}
export function validateWindowAcceptance(
  p: PartyWindowPort,
  input: WindowBatch | WindowDecision
): void {
  const state = p.state,
    w = state.window;
  if (input.expectedRevision !== state.revision) throw new PartyFailure('STALE_REVISION');
  if (w.phase === 'failed') throw new PartyFailure('INTERNAL_FAILURE');
  if (w.phase === 'running') throw new PartyFailure('ACTOR_BUSY');
  if (input.issuerSlot !== 'local:0') throw new PartyFailure('NOT_CONTROLLER');
  if (input.kind === 'party:decision') {
    const d = w.decision;
    if (
      !d ||
      w.phase !== 'awaiting-decision' ||
      input.decisionId !== d.id ||
      input.actorId !== d.actorId ||
      d.worldRevision !== state.revision ||
      !d.allowedChoiceIds.includes(input.choiceId)
    )
      throw new PartyFailure('STALE_DECISION');
    return;
  }
  if (w.decision) throw new PartyFailure('DECISION_REQUIRED');
  if(input.trigger==='single-step'){
    if(input.automatic||input.length.kind!=='ticks'||input.length.ticks!==1000||input.plans.length||input.fineActorId!==null)throw new PartyFailure('BAD_PAYLOAD');
    if(!state.members.some(m=>m.life==='active'&&(m.pendingController??m.controller).kind==='human'))throw new PartyFailure('NOT_CONTROLLER');
    if(w.members.some(m=>m.plan?.kind==='travel'||m.plan?.kind==='queue'&&m.cursor<m.plan.actions.length))throw new PartyFailure('ACTOR_BUSY');
  }
  if (p.ended()) throw new PartyFailure('BAD_SEQUENCE');
  if (
    input.seq !== w.seq + 1 ||
    input.startTick !== p.tick() ||
    !Number.isSafeInteger(p.tick() + 1000)
  )
    throw new PartyFailure('BAD_SEQUENCE');
  if (!state.members.some((m) => m.life === 'active')) throw new PartyFailure('BAD_ACTOR');
  if (
    input.fineActorId !== null &&
    !state.members.some((m) => m.actorId === input.fineActorId && m.life === 'active')
  )
    throw new PartyFailure('BAD_ACTOR');
  for (const row of input.plans) {
    const member = state.members.find((m) => m.actorId === row.actorId);
    if (!member || member.life !== 'active') throw new PartyFailure('BAD_ACTOR');
    if (row.controllerSlot !== input.issuerSlot || row.update==='replace' && member.controller.kind!=='human')
      throw new PartyFailure('NOT_CONTROLLER');
    if (row.plan?.kind === 'queue')
      row.plan.actions.forEach((intent) => p.validate(row.actorId, intent, true));
    else if (row.plan?.kind === 'travel') p.travel(row.actorId, row.plan, true);
  }
}
const negative = new Set([
  'poisoned',
  'burning',
  'paralyzed',
  'slumber',
  'entranced',
  'confused',
  'hallucinating',
  'slowed',
  'weakened',
  'discordant',
  'nauseous',
  'stuck',
  'darkness'
]);
export function executePartyWindow(
  owner: object,
  p: PartyWindowPort,
  input: WindowBatch | WindowDecision
): WindowReceipt {
  validateWindowAcceptance(p, input);
  const state = p.state,
    w = state.window,
    start = p.tick();
  const decision = w.decision;
  let pendingIntent: { actorId: number; intent: ActorIntent; answers: boolean[] } | null = null;
  if (input.kind === 'party:window') {
    const threatened = p
      .actors()
      .some((a) => a.active && (a.hostiles.length || a.telegraphs.length || a.hazard));
    w.singleStep=input.trigger==='single-step';
    w.seq = input.seq;
    w.segment = 0;
    w.startedAt = start;
    w.elapsed = 0;
    w.length = structuredClone(input.length);
    w.automatic = input.automatic;
    w.budget =
      input.length.kind === 'fine'
        ? 1000
        : input.automatic
          ? threatened || w.quietWindows < 3
            ? 100
            : 1000
          : input.length.ticks;
    w.fineActorId = input.fineActorId;
    w.fineStarted =
      input.fineActorId !== null &&
      p.actors().some((a) => a.id === input.fineActorId && (a.busy || a.remaining > 0));
    w.nextOrdinal = 0;
    for (const row of input.plans)
      if (row.update === 'replace') {
        const m = w.members.find((m) => m.actorId === row.actorId)!;
        if(row.plan?.kind==='ai-this-window'){state.members.find(m=>m.actorId===row.actorId)!.temporaryAiSeq=w.seq;}else{m.plan = structuredClone(row.plan);m.cursor = 0;}
      }
  } else {
    w.segment++;
    pendingIntent = {
      actorId: decision!.actorId,
      intent:
        decision!.kind === 'confirm' ? decision!.intent : p.modalIntent(decision!, input.choiceId),
      answers: decision!.kind === 'confirm' ? [...decision!.answers, input.choiceId === 'yes'] : []
    };
  }
  w.phase = 'running';
  w.decision = null;
  state.revision++;
  const receipt: WindowReceipt = {
    seq: w.seq,
    segment: w.segment,
    startTick: start,
    endTick: start,
    reason: 'budget',
    trace: [],
    interrupts: []
  };
  w.receipt = receipt;
  let before = p.actors(),
    depths = new Map(before.map((a) => [a.id, a.depth]));
  // Opening visibility is a baseline. Existing enemies do not interrupt again.
  if (input.kind === 'party:window')
    for (const a of before) {
      const m = w.members.find((m) => m.actorId === a.id)!;
      m.seenHostileIds = [...new Set([...m.seenHostileIds, ...a.hostiles])].sort((a, b) => a - b);
      m.lastDecisionSite = a.site;
    }
  const fact = (kind: InterruptKind, id: number | null, source: number | null = null) => {
    const f: InterruptFact = {
      kind,
      tick: p.tick(),
      actorId: id,
      sourceId: source,
      detailKey: 'ext.party.interrupt.' + kind
    };
    if (
      !receipt.interrupts.some(
        (old) =>
          old.kind === kind && old.actorId === id && old.sourceId === source && old.tick === f.tick
      )
    )
      receipt.interrupts.push(f);
  };
  let processedSoft=new Set<string>();
  const observe = () => {
    const after = p.actors();
    for (const a of after) {
      const b = before.find((b) => b.id === a.id),
        m = w.members.find((m) => m.actorId === a.id)!;
      if (!b) continue;
      if (b.hp > 0 && a.hp <= 0) {
        fact('member-death', a.id);
        m.plan = null;
        m.cursor = 0;
      }
      if (a.depth !== depths.get(a.id) || (a.active !== b.active && a.hp > 0))
        fact('level-transfer', a.id);
      if (!a.active) continue;
      if (a.hp < b.hp) fact('damage', a.id);
      if (Object.entries(a.statuses).some(([k, n]) => negative.has(k) && n > (b.statuses[k] ?? 0)))
        fact('negative-status', a.id);
      const low = a.hp * 100 <= a.maxHp * 25;
      if (low && !m.lowHpLatched) fact('low-hp', a.id);
      m.lowHpLatched = low;
      for (const id of a.hostiles)
        if (!m.seenHostileIds.includes(id)) {
          fact('new-hostile', a.id, id);
          m.seenHostileIds.push(id);
        }
      m.seenHostileIds.sort((a, b) => a - b);
      for (const key of a.telegraphs)
        if (!m.seenTelegraphKeys.includes(key)) fact('telegraph', a.id);
      m.seenTelegraphKeys = [...a.telegraphs];
      if (a.site !== m.lastDecisionSite) {
        if (a.site) fact(a.site.startsWith('stairs:') ? 'stairs' : 'trap-warning', a.id);
        m.lastDecisionSite = a.site;
      }
    }
    before = after;
    if (p.ended()) fact('game-ended', null);
    else if (!after.some((a) => a.active && a.hp > 0)) fact('no-active-member', null);
    w.elapsed = p.tick() - w.startedAt;
    const stopped=receipt.interrupts.some(
      (f) =>
        !SOFT_INTERRUPTS.includes(f.kind as (typeof SOFT_INTERRUPTS)[number]) ||
        w.members.find((m) => m.actorId === f.actorId)?.reactions[
          f.kind as (typeof SOFT_INTERRUPTS)[number]
        ] === 'stop'
    );
    if(!stopped)for(const f of receipt.interrupts){const key=JSON.stringify(f);if(processedSoft.has(key))continue;processedSoft.add(key);const m=state.members.find(m=>m.actorId===f.actorId),wm=w.members.find(m=>m.actorId===f.actorId);if(m?.life==='active'&&SOFT_INTERRUPTS.includes(f.kind as typeof SOFT_INTERRUPTS[number])&&wm?.reactions[f.kind as typeof SOFT_INTERRUPTS[number]]==='ai-this-window')m.temporaryAiSeq=w.seq;}
    return stopped;
  };
  running.set(owner, {
    remaining: () => Math.max(0, w.budget - (p.tick() - w.startedAt)),
    stop: observe,
    fact: (kind, actorId, status) => {
      if (!state.members.some((m) => m.actorId === actorId && m.life === 'active')) return;
      if (kind === 'negative-status' && (!status || !negative.has(status))) return;
      if (kind === 'low-hp') {
        const member = w.members.find((m) => m.actorId === actorId)!;
        if (member.lowHpLatched) return;
        member.lowHpLatched = true;
      }
      fact(kind, actorId);
    },
    // Native transactions can observe a boundary before rolling back. Restore
    // the comparison baseline as well as their owned receipt/state graph.
    checkpoint: () => {
      const savedBefore = before,savedSoft=new Set(processedSoft);
      return () => {
        before = savedBefore;processedSoft=savedSoft;
      };
    }
  });
  try {
    for (let decisions = 0; ; ) {
      if (observe() && !pendingIntent) {
        receipt.reason = p.ended() ? 'terminal' : 'interrupt';
        break;
      }
      const fine = p.actors().find((a) => a.id === w.fineActorId);
      if (
        !pendingIntent &&
        w.fineActorId !== null &&
        w.fineStarted &&
        fine &&
        !fine.busy &&
        fine.remaining <= 0
      ) {
        receipt.reason = 'fine-action';
        break;
      }
      if (!pendingIntent && w.elapsed >= w.budget) break;
      const id = pendingIntent?.actorId ?? p.ready();
      if (id === null) {
        const old = p.tick();
        p.advance();
        if (p.tick() === old && !p.ready() && !observe()) {
          fact('zero-time-loop', null);
          receipt.reason = 'interrupt';
          break;
        }
        continue;
      }
      if(w.singleStep&&!isPartyAi(state.members.find(m=>m.actorId===id)!,w.seq)){receipt.reason='fine-action';break;}
      if (decisions++ >= 1024) {
        fact('budget-exceeded', id);
        receipt.reason = 'interrupt';
        break;
      }
      const member = w.members.find((m) => m.actorId === id)!;
      const control=state.members.find(m=>m.actorId===id)!, ai=isPartyAi(control,w.seq);
      let aiDecision:PartyAiDecision|undefined;
      let intent: ActorIntent | null = null,
        answers: boolean[] = [];
      try {
        if (pendingIntent) {
          intent = pendingIntent.intent;
          answers = pendingIntent.answers;
          pendingIntent = null;
        } else if(ai){if(!p.decide)throw new PartyFailure('INTERNAL_FAILURE');aiDecision=p.decide(id);intent=aiDecision.intent;} else if (member.plan?.kind === 'queue')
          intent = member.plan.actions[member.cursor] ?? null;
        else if (member.plan?.kind === 'travel') {
          intent = p.travel(id, member.plan, false);
          if (!intent) {
            member.plan = null;
            member.cursor = 0;
          }
        }
        if (!intent) {
          if (member.emptyPlan === 'interrupt') {
            fact('plan-invalid', id);
            receipt.reason = 'interrupt';
            break;
          }
          intent = { kind: 'wait' };
        }
        try{p.validate(id, intent, false);}catch(error){if(!ai||!(error instanceof PartyFailure)||error.code==='INTERNAL_FAILURE')throw error;intent={kind:'wait'};aiDecision={intent,diagnostic:'no-route',nodes:aiDecision?.nodes??0};p.validate(id,intent,false);}
        const tick = p.tick();
        let result = p.attempt(id, intent, answers);
        if(ai&&result.rejected){
          intent={kind:'wait'};aiDecision={intent,diagnostic:'no-route',nodes:aiDecision?.nodes??0};
          p.validate(id,intent,false);result=p.attempt(id,intent,[]);
          if(result.rejected||result.pending||result.cancelled)throw new PartyFailure('INTERNAL_FAILURE');
        }
        if (result.pending) {
          w.decision = {
            id: w.nextDecisionId++,
            actorId: id,
            intentOrdinal: w.nextOrdinal,
            worldRevision: state.revision,
            kind: result.pending.kind,
            requestKey: 'ext.party.decision.' + result.pending.kind,
            prompt: result.pending.prompt,
            allowedChoiceIds: result.pending.choices,
            intent: structuredClone(intent),
            answers
          };
          w.phase = 'awaiting-decision';
          fact('decision-required', id);
          receipt.reason = 'decision';
          break;
        }
        receipt.trace.push({
          ordinal: w.nextOrdinal++,
          tick,
          actorId: id,
          intent: structuredClone(intent),
          outcome: result.rejected ? 'rejected' : 'accepted',
          actionId: result.actionId,
          chargedTicks: result.chargedTicks,
          decisions: answers.map((a) => (a ? 'yes' : 'no'))
        });
        if (result.rejected) {
          fact('plan-invalid', id);
          receipt.reason = 'interrupt';
          break;
        }
        if(ai&&!result.cancelled){control.ai.ordinal++;control.ai.diagnostic=aiDecision?.diagnostic??'wait';}
        if (!ai && member.plan?.kind === 'queue' && member.cursor < member.plan.actions.length)
          member.cursor++;
        if (id === w.fineActorId) w.fineStarted = true;
        if (result.cancelled) {
          fact('plan-invalid', id);
          receipt.reason = 'interrupt';
          break;
        }
        // A zero-cost accepted action cannot spin or consume an arbitrary suffix.
        if (result.chargedTicks === 0 && p.tick() === tick) {
          fact('zero-time-loop', id);
          receipt.reason = 'interrupt';
          break;
        }
      } catch (error) {
        if (!(error instanceof PartyFailure) || error.code === 'INTERNAL_FAILURE') throw error;
        if (intent)
          receipt.trace.push({
            ordinal: w.nextOrdinal++,
            tick: p.tick(),
            actorId: id,
            intent: structuredClone(intent),
            outcome: 'rejected',
            actionId: null,
            chargedTicks: 0,
            decisions: []
          });
        fact('plan-invalid', id);
        receipt.reason = 'interrupt';
        break;
      }
    }
    observe();
    w.elapsed = p.tick() - w.startedAt;
    receipt.endTick = p.tick();
    receipt.interrupts.sort(
      (a, b) =>
        a.tick - b.tick ||
        (a.actorId ?? 0) - (b.actorId ?? 0) ||
        a.kind.localeCompare(b.kind) ||
        (a.sourceId ?? 0) - (b.sourceId ?? 0)
    );
    if (w.phase === 'running')
      w.phase =
        receipt.reason === 'interrupt' || receipt.reason === 'terminal'
          ? 'interrupted'
          : 'planning';
    if (w.phase !== 'awaiting-decision') {
      for(const m of state.members)m.temporaryAiSeq=null;
      const threat = p
        .actors()
        .some((a) => a.active && (a.hostiles.length || a.telegraphs.length || a.hazard));
      w.quietWindows =
        !threat && !receipt.interrupts.length && receipt.reason === 'budget'
          ? Math.min(3, w.quietWindows + 1)
          : 0;
    }
    state.revision++;
    if (w.decision) w.decision.worldRevision = state.revision;
    return receipt;
  } catch (error) {
    w.phase = 'failed';
    state.revision++;
    throw error;
  } finally {
    running.delete(owner);
  }
}
/** Nested native helpers consume the same replayable answer cursor as the
 * outer generator. A request escapes to the intent transaction, never to UI. */
export class WindowQuestion extends Error {
  constructor(readonly prompt: string) {
    super('DECISION_REQUIRED');
  }
}
const answerScopes = new WeakMap<object, { answers: boolean[]; cursor: number }>();
export function withWindowAnswers<T>(owner: object, answers: boolean[], run: () => T): T {
  answerScopes.set(owner, { answers, cursor: 0 });
  try {
    return run();
  } finally {
    answerScopes.delete(owner);
  }
}
export function answerWindowQuestion(owner: object, prompt: string): boolean | undefined {
  const scope = answerScopes.get(owner);
  if (!scope) return undefined;
  if (scope.cursor >= scope.answers.length) throw new WindowQuestion(prompt);
  return scope.answers[scope.cursor++]!;
}
export type PartyWindowEvent = {
  kind:
    | 'window-accepted'
    | 'actor-intent-resolved'
    | 'decision-requested'
    | 'interrupted'
    | 'finished';
  seq: number;
  segment: number;
  receipt: Readonly<WindowReceipt>;
};
const observers = new WeakMap<object, Set<(event: PartyWindowEvent) => void>>(),
  publishing = new WeakSet<object>();
export function observePartyWindows(
  owner: object,
  observer: (event: PartyWindowEvent) => void
): () => void {
  let set = observers.get(owner);
  if (!set) {
    set = new Set();
    observers.set(owner, set);
  }
  set.add(observer);
  return () => set!.delete(observer);
}
export function isPublishingPartyWindow(owner: object) {
  return publishing.has(owner);
}
export function publishPartyWindow(owner: object, receipt: WindowReceipt, accepted: boolean): void {
  const list = observers.get(owner);
  if (!list?.size) return;
  const kinds: PartyWindowEvent['kind'][] = [
    ...(accepted ? ['window-accepted' as const] : []),
    ...receipt.trace.map(() => 'actor-intent-resolved' as const),
    receipt.reason === 'decision'
      ? 'decision-requested'
      : receipt.reason === 'interrupt' || receipt.reason === 'terminal'
        ? 'interrupted'
        : 'finished'
  ];
  publishing.add(owner);
  try {
    for (const kind of kinds)
      for (const observer of list) {
        try {
          observer({
            kind,
            seq: receipt.seq,
            segment: receipt.segment,
            receipt: structuredClone(receipt)
          });
        } catch {
          /* Optional presentation consumers cannot invalidate a committed segment. */
        }
      }
  } finally {
    publishing.delete(owner);
  }
}
