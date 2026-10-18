import { PartyFailure, type ActorIntent, type PartyState } from '../../ext/party';
import {
  parseWindowInput,
  validatePartyPlan,
  type PartyPlan,
  type WindowBatch,
  type WindowLength,
  type WindowTrigger
} from '../../ext/partyWindow';
/** Product-only state. Ownership/root+revision invalidation also covers new game/load. */
export class PartyPlanningSession {
  readonly drafts = new Map<number, PartyPlan | null>();
  ready = false;
  submitted = false;
  deadline: number | null = null;
  generation = 0;
  preview: PartyPreviewResult | null = null;
  constructor(
    readonly root: PartyState,
    public baseRevision = root.revision
  ) {}
  sync() {
    if (this.baseRevision !== this.root.revision) {
      this.baseRevision = this.root.revision;
      this.ready = false;
      this.submitted = false;
      this.deadline = null;
      this.preview = null;
      this.drafts.clear();
      this.generation++;
    }
  }
  edit(id: number, plan: PartyPlan | null) {
    this.sync();
    if (
      !this.root.members.some(
        (m) => m.actorId === id && m.life === 'active' && m.controller.slot === 'local:0'
      )
    )
      throw new PartyFailure('NOT_CONTROLLER');
    validatePartyPlan(plan);
    this.drafts.set(id, structuredClone(plan));
    this.submitted = false;
    this.ready = false;
    this.deadline = null;
    this.preview = null;
    this.generation++;
  }
  append(id: number, intent: ActorIntent) {
    this.sync();
    const previous = this.drafts.get(id);
    const accepted = this.root.window.members.find((m) => m.actorId === id);
    const plan = previous === undefined ? accepted?.plan : previous;
    const actions =
      plan?.kind === 'queue'
        ? plan.actions.slice(previous === undefined ? accepted!.cursor : 0)
        : [];
    this.edit(id, { kind: 'queue', actions: [...actions, structuredClone(intent)] });
  }
  keep(id: number) {
    this.sync();
    this.drafts.delete(id);
    this.submitted = false;
    this.ready = false;
    this.deadline = null;
    this.preview = null;
    this.generation++;
  }
  cancel() {
    this.drafts.clear();
    this.ready = false;
    this.submitted = false;
    this.deadline = null;
    this.preview = null;
    this.generation++;
  }
  markReady() {
    this.sync();
    this.ready = true;
  }
  armDeadline(now: () => number, delay: number) {
    this.sync();
    if (!Number.isFinite(delay) || delay < 0) throw new PartyFailure('BAD_PAYLOAD');
    this.deadline = now() + delay;
    return this.generation;
  }
  batch(
    tick: number,
    length: WindowLength,
    fineActorId: number | null,
    automatic = false,
    trigger: WindowTrigger = 'manual'
  ): WindowBatch {
    this.sync();
    return parseWindowInput({
      kind: 'party:window',
      schema: 1,
      seq: this.root.window.seq + 1,
      expectedRevision: this.baseRevision,
      issuerSlot: 'local:0',
      startTick: tick,
      length,
      fineActorId,
      automatic,
      trigger,
      plans: this.root.members
        .filter((m) => m.life === 'active')
        .map((m) => ({
          actorId: m.actorId,
          controllerSlot: m.controller.slot,
          update: this.drafts.has(m.actorId) ? 'replace' : 'keep',
          plan: this.drafts.get(m.actorId) ?? null
        }))
    }) as WindowBatch;
  }
  /** At most one attempt per generation. Rejection needs a deliberate edit/cancel. */
  submit(batch: WindowBatch, send: (batch: WindowBatch) => void) {
    this.sync();
    if (this.submitted) throw new PartyFailure('BAD_SEQUENCE');
    if (batch.expectedRevision !== this.baseRevision) throw new PartyFailure('STALE_REVISION');
    this.submitted = true;
    this.ready = false;
    this.deadline = null;
    send(batch);
  }
  expire(
    now: () => number,
    token: number,
    batch: () => WindowBatch,
    send: (batch: WindowBatch) => void
  ): boolean {
    this.sync();
    if (
      token !== this.generation ||
      this.deadline === null ||
      now() < this.deadline ||
      this.submitted
    )
      return false;
    this.submit(batch(), send);
    return true;
  }
  async rehearse(view: KnownPartyWorld, batch: WindowBatch): Promise<PartyPreviewResult | null> {
    this.sync();
    const generation = this.generation,
      revision = this.baseRevision;
    const result = await Promise.resolve().then(() =>
      previewPartyWindow(structuredClone(view), structuredClone(batch))
    );
    this.sync();
    if (this.generation !== generation || this.baseRevision !== revision) return null;
    this.preview = result;
    return result;
  }
}
const sessions = new WeakMap<object, PartyPlanningSession>();
export function partyPlanning(owner: object, state: PartyState): PartyPlanningSession | undefined {
  const s = sessions.get(owner);
  if (s?.root !== state) {
    sessions.delete(owner);
    return;
  }
  s.sync();
  return s;
}
export function enablePartyPlanning(owner: object, state: PartyState) {
  let s = partyPlanning(owner, state);
  if (!s) {
    s = new PartyPlanningSession(state);
    sessions.set(owner, s);
  }
  return s;
}
export function disablePartyPlanning(owner: object) {
  sessions.delete(owner);
}
export interface KnownPartyWorld {
  baseRevision: number;
  level: number;
  cells: { x: number; y: number; passable: boolean; hazard: boolean }[];
  members: {
    id: number;
    x: number;
    y: number;
    moveTicks: number;
    remaining: number;
    plan: PartyPlan | null;
    cursor: number;
  }[];
  enemies: { id: number; x: number; y: number }[];
}
export interface PartyPreviewResult {
  baseRevision: number;
  model: 'known-world-v1';
  uncertain: true;
  members: { id: number; x: number; y: number; actions: number; blocked: boolean }[];
  warnings: ('enemy' | 'unknown' | 'unsupported' | 'hazard')[];
}
/** Isolated known-world simulator: no Game, global services, storage, callbacks,
 * RNG, entity allocator or hidden AI are reachable from this engine container. */
export function previewPartyWindow(view: KnownPartyWorld, batch: WindowBatch): PartyPreviewResult {
  if (view.baseRevision !== batch.expectedRevision) throw new PartyFailure('STALE_REVISION');
  const cells = new Map(view.cells.map((c) => [`${c.x},${c.y}`, c]));
  const warnings = new Set<PartyPreviewResult['warnings'][number]>();
  if (view.enemies.length) warnings.add('enemy');
  const members = view.members.map((m) => {
    const row = batch.plans.find((p) => p.actorId === m.id),
      plan = row?.update === 'replace' ? row.plan : m.plan;
    return {
      ...m,
      plan,
      cursor: row?.update === 'replace' ? 0 : m.cursor,
      actions: 0,
      blocked: false,
      next: m.remaining
    };
  });
  const budget = batch.length.kind === 'ticks' ? batch.length.ticks : 1000;
  for (let decisions = 0; decisions < 1024; decisions++) {
    const m = members
      .filter((m) => !m.blocked && m.next < budget)
      .sort((a, b) => a.next - b.next || a.id - b.id)[0];
    if (!m) break;
    if (
      batch.length.kind === 'fine' &&
      members.some((a) => a.id === batch.fineActorId && a.actions > 0 && a.next <= m.next)
    )
      break;
    let intent: ActorIntent = { kind: 'wait' };
    if (m.plan?.kind === 'queue') intent = m.plan.actions[m.cursor++] ?? intent;
    if (m.plan?.kind === 'travel') {
      if (m.x === m.plan.target.x && m.y === m.plan.target.y) m.plan = null;
      else {
        const path = [{ x: m.x, y: m.y, dx: 0, dy: 0 }],
          seen = new Set([`${m.x},${m.y}`]);
        let found: ActorIntent | null = null;
        for (let i = 0; i < path.length && !found; i++) {
          const p = path[i]!;
          for (const [dx, dy] of [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0]
          ]) {
            const x = p.x + dx!,
              y = p.y + dy!,
              key = `${x},${y}`;
            if (seen.has(key) || !cells.get(key)?.passable) continue;
            seen.add(key);
            const step = { x, y, dx: p.dx || p.dy ? p.dx : dx!, dy: p.dx || p.dy ? p.dy : dy! };
            if (x === m.plan.target.x && y === m.plan.target.y) {
              found = { kind: 'move', dx: step.dx, dy: step.dy };
              break;
            }
            path.push(step);
          }
        }
        if (!found) {
          warnings.add('unknown');
          m.blocked = true;
          continue;
        }
        intent = found;
      }
    }
    if (intent.kind === 'move') {
      const x = m.x + intent.dx,
        y = m.y + intent.dy,
        c = cells.get(`${x},${y}`);
      if (!c) {
        warnings.add('unknown');
        m.blocked = true;
        continue;
      }
      if (
        !c.passable ||
        members.some((a) => a.id !== m.id && a.x === x && a.y === y) ||
        view.enemies.some((a) => a.x === x && a.y === y)
      ) {
        m.blocked = true;
        continue;
      }
      if (c.hazard) warnings.add('hazard');
      m.x = x;
      m.y = y;
    } else if (intent.kind !== 'wait' && intent.kind !== 'search') {
      warnings.add('unsupported');
      m.blocked = true;
      continue;
    }
    m.actions++;
    m.next += Math.max(1, m.moveTicks);
  }
  return {
    baseRevision: view.baseRevision,
    model: 'known-world-v1',
    uncertain: true,
    members: members.map(({ id, x, y, actions, blocked }) => ({ id, x, y, actions, blocked })),
    warnings: [...warnings].sort()
  };
}
