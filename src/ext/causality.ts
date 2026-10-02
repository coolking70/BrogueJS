import { isJson } from './json';

export type EffectKind = 'melee' | 'projectile' | 'bolt' | 'status' | 'reflection' | 'reprisal'
    | 'transference' | 'displacement' | 'terrain' | 'death-effect' | 'negation' | 'lifespan' | 'administrative';
export type DamageKind = 'physical' | 'fire' | 'poison' | 'other';
export type OwnedStatus = 'poisoned' | 'burning';
/** Detached causal evidence, never a live actor or a promise of reward eligibility. */
export interface EffectOrigin {
    readonly effectId: number;
    readonly rootEffectId: number;
    readonly actorId: number | null;
    readonly creditActorId: number | null;
    readonly creditPartyId: string | null;
    readonly kind: EffectKind;
    readonly parentEffectId: number | null;
}
export interface DamageFact {
    readonly targetId: number;
    readonly hpBefore: number;
    readonly hpLost: number;
    readonly origin: EffectOrigin | null;
    readonly damageKind: DamageKind;
}
export interface CausalitySnapshot {
    nextEffectId: number;
    statusOrigins: Record<string, Partial<Record<OwnedStatus, EffectOrigin | null>>>;
    fatalOrigins: Record<string, EffectOrigin | null>;
    pendingDisplacements: Record<string, EffectOrigin | null>;
}
const kinds: readonly string[] = ['melee', 'projectile', 'bolt', 'status', 'reflection', 'reprisal',
    'transference', 'displacement', 'terrain', 'death-effect', 'negation', 'lifespan', 'administrative'];
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const idOrNull = (value: unknown): boolean => value === null || positiveId(value);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function validEffectOrigin(value: unknown, nextEffectId = Number.MAX_SAFE_INTEGER): value is EffectOrigin {
    if (!record(value) || !isJson(value) || Object.keys(value).length !== 7) return false;
    const { effectId, rootEffectId, actorId, creditActorId, creditPartyId, kind, parentEffectId } = value;
    return positiveId(effectId) && effectId < nextEffectId && positiveId(rootEffectId) && rootEffectId <= effectId
        && idOrNull(actorId) && idOrNull(creditActorId)
        && (creditPartyId === null || (typeof creditPartyId === 'string' && creditPartyId.length > 0))
        && (creditActorId !== null || creditPartyId === null)
        && typeof kind === 'string' && kinds.includes(kind)
        && (parentEffectId === null ? rootEffectId === effectId
            : positiveId(parentEffectId) && rootEffectId <= parentEffectId && parentEffectId < effectId);
}

/** Extension-only synchronous causal scopes. Explicit null always masks a parent.
 * Persistent sources contain IDs only, so a departed/dead actor is still identifiable. */
export class EffectCausality {
    private data: CausalitySnapshot = { nextEffectId: 1, statusOrigins: {}, fatalOrigins: {}, pendingDisplacements: {} };
    private origin: EffectOrigin | null = null;
    private immediateTerrain: EffectOrigin | null = null;
    constructor(snapshot?: CausalitySnapshot) { if (snapshot) this.restore(snapshot); }
    get current(): EffectOrigin | null { return this.origin; }
    get terrainOrigin(): EffectOrigin | null { return this.immediateTerrain; }
    create(kind: EffectKind, actorId: number | null, creditActorId: number | null = actorId,
        creditPartyId: string | null = null, parent: EffectOrigin | null = this.current): EffectOrigin {
        const effectId = this.data.nextEffectId;
        const origin = { effectId, rootEffectId: parent?.rootEffectId ?? effectId,
            actorId, creditActorId, creditPartyId, kind, parentEffectId: parent?.effectId ?? null };
        if (!validEffectOrigin(origin) || effectId >= Number.MAX_SAFE_INTEGER - 1) throw new Error('Invalid effect origin');
        this.data.nextEffectId++;
        return Object.freeze(origin);
    }
    withOrigin<T>(origin: EffectOrigin | null, resolve: () => T): T {
        const previous = this.origin;
        this.origin = origin;
        try {
            const result = resolve();
            if (result && typeof (result as { then?: unknown }).then === 'function') {
                void Promise.resolve(result).catch(() => undefined);
                throw new Error('Async effect scopes are forbidden');
            }
            return result;
        } finally { this.origin = previous; }
    }
    /** Only displacement landing and the death DF's synchronous explosion enter this scope. */
    withImmediateTerrain<T>(origin: EffectOrigin | null, resolve: () => T): T {
        const previous = this.immediateTerrain;
        this.immediateTerrain = origin;
        try { return this.withOrigin(origin, resolve); }
        finally { this.immediateTerrain = previous; }
    }
    recordDamage(targetId: number, hpBefore: number, hpAfter: number, damageKind: DamageKind = 'other'): DamageFact {
        const fact = Object.freeze({ targetId, hpBefore, hpLost: Math.max(0, Math.min(hpBefore, hpBefore - hpAfter)),
            origin: this.current, damageKind });
        if (hpBefore > 0 && hpAfter <= 0) this.terminal(targetId);
        return fact;
    }
    terminal(targetId: number, origin: EffectOrigin | null = this.current): void {
        this.data.fatalOrigins[targetId] = origin === null ? null : structuredClone(origin);
    }
    /** A stored null is a known unowned death, never a reason to use an outer attack. */
    deathOrigin(targetId: number): EffectOrigin | null {
        return Object.prototype.hasOwnProperty.call(this.data.fatalOrigins, targetId) ? this.data.fatalOrigins[targetId]! : this.current;
    }
    clearTerminal(targetId: number): void { delete this.data.fatalOrigins[targetId]; }
    statusChanged(targetId: number, status: OwnedStatus, before: number, after: number): void {
        if (after <= 0) { this.clearStatus(targetId, status); return; }
        // Countdown and ineffective reapplication never steal ownership.
        if (after <= before) return;
        (this.data.statusOrigins[targetId] ??= {})[status] = this.current === null ? null : structuredClone(this.current);
    }
    statusOrigin(targetId: number, status: OwnedStatus): EffectOrigin | null {
        return this.data.statusOrigins[targetId]?.[status] ?? null;
    }
    clearStatus(targetId: number, status: OwnedStatus): void {
        const statuses = this.data.statusOrigins[targetId];
        if (!statuses) return;
        delete statuses[status];
        if (!Object.keys(statuses).length) delete this.data.statusOrigins[targetId];
    }
    markDisplacement(targetId: number, origin: EffectOrigin | null = this.terrainOrigin): void {
        this.data.pendingDisplacements[targetId] = origin === null ? null : structuredClone(origin);
    }
    consumeDisplacement(targetId: number): EffectOrigin | null {
        const origin = this.data.pendingDisplacements[targetId] ?? null;
        delete this.data.pendingDisplacements[targetId];
        return origin;
    }
    clearCreature(targetId: number): void {
        delete this.data.statusOrigins[targetId]; delete this.data.fatalOrigins[targetId]; delete this.data.pendingDisplacements[targetId];
    }
    retainCreatures(ids: ReadonlySet<number>): void {
        for (const key of new Set([...Object.keys(this.data.statusOrigins), ...Object.keys(this.data.fatalOrigins),
            ...Object.keys(this.data.pendingDisplacements)])) if (!ids.has(Number(key))) this.clearCreature(Number(key));
    }
    snapshot(): CausalitySnapshot { return structuredClone(this.data); }
    restore(snapshot: CausalitySnapshot): void {
        if (!EffectCausality.validateSnapshot(snapshot)) throw new Error('Invalid effect causality snapshot');
        this.data = structuredClone(snapshot);
    }
    static validateSnapshot(value: unknown): value is CausalitySnapshot {
        if (!record(value) || !isJson(value) || Object.keys(value).length !== 4 || !positiveId(value.nextEffectId)
            || !record(value.statusOrigins) || !record(value.fatalOrigins) || !record(value.pendingDisplacements)) return false;
        const next = value.nextEffectId;
        const validOrigin = (origin: unknown) => origin === null || validEffectOrigin(origin, next);
        const validKey = (id: string) => /^[1-9]\d*$/.test(id) && positiveId(Number(id));
        for (const [id, statuses] of Object.entries(value.statusOrigins)) {
            if (!validKey(id) || !record(statuses) || !Object.keys(statuses).length) return false;
            for (const [status, origin] of Object.entries(statuses)) {
                if (!['poisoned', 'burning'].includes(status) || !validOrigin(origin)) return false;
            }
        }
        return [value.fatalOrigins, value.pendingDisplacements].every(entries =>
            Object.entries(entries).every(([id, origin]) => validKey(id) && validOrigin(origin)));
    }
}
