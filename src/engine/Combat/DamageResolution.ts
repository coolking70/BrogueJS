import { dataArray, integer, record } from '../Simulation/Protocol';

export type DamageKind = 'kinetic' | 'explosive' | 'fire' | 'electric' | 'toxic';
export type FriendlyFire = 'none' | 'team' | 'all';
export interface HealthActor { id: number; team: number; hp: number; maxHp: number; revision: number }
export interface DamageState { schema: 1; nextResolutionId: number; actors: HealthActor[] }
export interface DamageIntent { sourceId: number; targetId: number; amount: number; kind: DamageKind; friendlyFire: FriendlyFire }
export interface DamageReceipt extends DamageIntent { resolutionId: number; applied: number; killed: boolean }
export interface PreparedDamage { readonly intent: Readonly<DamageIntent> }

export function validateDamageState(value: unknown): asserts value is DamageState {
    if (!record(value, ['schema', 'nextResolutionId', 'actors']) || value.schema !== 1 || !integer(value.nextResolutionId, 1)
        || !dataArray(value.actors, 1024)) throw new Error('Invalid damage state');
    let previous = 0;
    for (const a of value.actors) {
        if (!record(a, ['id', 'team', 'hp', 'maxHp', 'revision']) || !integer(a.id, previous + 1)
            || !integer(a.team, 0, 255) || !integer(a.maxHp, 1, 1_000_000) || !integer(a.hp, 0, a.maxHp)
            || !integer(a.revision, 0)) throw new Error('Invalid health actor');
        previous = a.id;
    }
}
export function mayDamage(source: Pick<HealthActor, 'id' | 'team'>, target: Pick<HealthActor, 'id' | 'team'>, policy: FriendlyFire): boolean {
    return policy === 'all' || (source.id !== target.id && (policy === 'team' || source.team !== target.team));
}
/** Shared authority owns every HP write. Plans are instance-bound, single-use,
 * and stale after any target/source revision change. Projectile sources may be
 * dead: eligibility was established at launch; team identity still applies.
 * S2 opens entity damage only; body/group targeting needs its own future port. */
export class DamageResolutionAuthority {
    private readonly state: DamageState;
    private readonly actors: Map<number, HealthActor>;
    private readonly plans = new WeakMap<PreparedDamage, { source: number; target: number }>();
    constructor(state: DamageState) { validateDamageState(state); this.state = structuredClone(state); this.actors = new Map(this.state.actors.map(a => [a.id, a])); }
    snapshot(): DamageState { return structuredClone(this.state); }
    read(id: number): Readonly<HealthActor> | undefined {
        const a = this.actors.get(id); return a ? Object.freeze({ ...a }) : undefined;
    }
    prepareDamageResolution(value: unknown): PreparedDamage | null {
        if (!record(value, ['sourceId', 'targetId', 'amount', 'kind', 'friendlyFire'])
            || !integer(value.sourceId, 1) || !integer(value.targetId, 1) || !integer(value.amount, 1, 1_000_000)
            || !['kinetic', 'explosive', 'fire', 'electric', 'toxic'].includes(value.kind as string)
            || !['none', 'team', 'all'].includes(value.friendlyFire as string)) throw new Error('Invalid damage intent');
        const intent = value as unknown as DamageIntent, s = this.read(intent.sourceId), t = this.read(intent.targetId);
        if (!s || !t || t.hp === 0 || !mayDamage(s, t, intent.friendlyFire)) return null;
        const plan = Object.freeze({ intent: Object.freeze({ ...intent }) });
        this.plans.set(plan, { source: s.revision, target: t.revision }); return plan;
    }
    commitDamageResolution(plan: PreparedDamage): Readonly<DamageReceipt> | null {
        const binding = this.plans.get(plan);
        if (!binding) throw new Error('Unknown or consumed damage plan');
        this.plans.delete(plan);
        const s = this.read(plan.intent.sourceId), t = this.actors.get(plan.intent.targetId);
        if (!s || !t || t.hp === 0 || s.revision !== binding.source || t.revision !== binding.target) return null;
        const applied = Math.min(t.hp, plan.intent.amount);
        t.hp -= applied; t.revision++;
        return Object.freeze({ ...plan.intent, resolutionId: this.state.nextResolutionId++, applied, killed: t.hp === 0 });
    }
    /** Explicit training/respawn lifecycle, never exposed to rule modules. */
    restoreHealth(id: number): void {
        const a = this.actors.get(id);
        if (!a) throw new Error('Unknown health actor');
        a.hp = a.maxHp; a.revision++;
    }
}
