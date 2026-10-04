/** 3a0 fixture-only authority for direct, adjacent native melee.
 * Nothing installs this on Game or changes ordinary CombatSystem.attack calls.
 * Mechanical data is caller-owned and explicitly exportable; only prepared
 * identity/scope capabilities are session-local. No extension callback receives
 * a creature, a writable Game, or an actor action scope through this API. */
import type { Creature } from '../../entities/Creature';
import { Monster, MonsterState, monstersAreEnemies } from '../../entities/Monster';
import { Player } from '../../entities/Player';
import type { Game } from '../Core/Game';
import { assertActorActionScope, type ActorActionScope } from '../Core/ActorActionScope';
import { markActorActionFixture } from '../Core/ActorActionSession';
import { assertNativeSpatial, distanceBetweenFootprints } from '../Movement/CreatureSpatial';
import { SpatialValidationError } from '../Movement/SpatialSchema';
import { playerTravelDiagonalBlocked } from '../Movement/PlayerTravel';
import { canObserveBoltCreature } from './BoltTargeting';
import { CombatSystem, type AttackResult } from './Combat';

export const ACTOR_DEFENSE_LIMITS = Object.freeze({ actors: 128, quantity: 1_000_000 });
export interface ActorDefenseState {
    actorId: number;
    depth: number;
    poise: number;
    poiseCapacity: number;
    staggerRemainingTicks: number;
    dodgeRemainingTicks: number;
    parryRemainingTicks: number;
    /** Frozen stance, not the actor's current/automatic facing. */
    parryFacing: { x: number; y: number };
    parryPoiseDamage: number;
    parryStaggerTicks: number;
}
export interface ActorCombatResolutionState {
    schema: 1;
    /** Fixture resolution identities; independent of native causal effect IDs. */
    nextResolutionId: number;
    actors: ActorDefenseState[];
}
/** Only this whitelist is open: no arbitrary damage, lunge, projectile,
 * environment, beforeDamage callback, body/group, or custom damage profile. */
export interface NativeMeleeResolutionIntent {
    kind: 'native-melee';
    depth: number;
    sourceEntityId: number;
    targetEntityId: number;
    dodgeable: boolean;
    parryable: boolean;
}
export interface PreparedNativeMelee {
    readonly intent: Readonly<NativeMeleeResolutionIntent>;
}
export interface DefendedFact {
    readonly kind: 'defended';
    readonly resolutionId: number;
    readonly depth: number;
    readonly sourceEntityId: number;
    readonly targetEntityId: number;
    readonly defense: 'dodge' | 'parry';
}
export interface ParrySourceInterruption {
    readonly kind: 'cancel-pending-source';
    readonly sourceEntityId: number;
    readonly breakRecoveryTicks: number;
}
export type ActorMeleeResolution =
    | { readonly kind: 'defended'; readonly fact: DefendedFact; readonly sourceInterruption?: Readonly<ParrySourceInterruption> }
    | { readonly kind: 'native'; readonly resolutionId: number; readonly attack: AttackResult };

function fail(message: string): never { throw new Error(`Actor combat resolution: ${message}`); }
function fields(value: unknown, names: readonly string[]): asserts value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('expected a plain finite DTO');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(value).length !== names.length || names.some(name => !descriptors[name]
        || !descriptors[name]!.enumerable || !('value' in descriptors[name]!))) fail('unknown or missing DTO fields');
}
const integer = (v: unknown, min = 0, max: number = ACTOR_DEFENSE_LIMITS.quantity): v is number =>
    Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
const id = (v: unknown): v is number => integer(v, 1, Number.MAX_SAFE_INTEGER - 1);
function direction(value: unknown): void {
    fields(value, ['x', 'y']);
    if (!integer(value.x, -1, 1) || !integer(value.y, -1, 1) || (!value.x && !value.y)) fail('invalid stance direction');
}
export function validateActorCombatResolutionState(value: unknown): asserts value is ActorCombatResolutionState {
    fields(value, ['schema', 'nextResolutionId', 'actors']);
    if (value.schema !== 1 || !id(value.nextResolutionId) || !Array.isArray(value.actors)
        || value.actors.length > ACTOR_DEFENSE_LIMITS.actors || Object.keys(value.actors).length !== value.actors.length
        || Reflect.ownKeys(value.actors).length !== value.actors.length + 1
        || Object.entries(Object.getOwnPropertyDescriptors(value.actors)).some(([name, descriptor]) =>
            name !== 'length' && (!descriptor.enumerable || !('value' in descriptor))))
        fail('invalid state envelope');
    const seen = new Set<number>();
    for (const actor of value.actors) {
        fields(actor, ['actorId', 'depth', 'poise', 'poiseCapacity', 'staggerRemainingTicks',
            'dodgeRemainingTicks', 'parryRemainingTicks', 'parryFacing', 'parryPoiseDamage', 'parryStaggerTicks']);
        if (!id(actor.actorId) || seen.has(actor.actorId) || !integer(actor.depth, 1, 40)
            || !integer(actor.poiseCapacity, 1) || !integer(actor.poise, 0, actor.poiseCapacity)
            || !integer(actor.staggerRemainingTicks) || !integer(actor.dodgeRemainingTicks)
            || !integer(actor.parryRemainingTicks) || !integer(actor.parryPoiseDamage) || !integer(actor.parryStaggerTicks))
            fail('invalid defense actor');
        direction(actor.parryFacing); seen.add(actor.actorId);
    }
}
export function validateNativeMeleeResolutionIntent(value: unknown): asserts value is NativeMeleeResolutionIntent {
    fields(value, ['kind', 'depth', 'sourceEntityId', 'targetEntityId', 'dodgeable', 'parryable']);
    if (value.kind !== 'native-melee' || !integer(value.depth, 1, 40) || !id(value.sourceEntityId)
        || !id(value.targetEntityId) || value.sourceEntityId === value.targetEntityId
        || typeof value.dodgeable !== 'boolean' || typeof value.parryable !== 'boolean') fail('unsupported melee intent');
}
function immutable<T>(value: T): Readonly<T> {
    if (value && typeof value === 'object') { Object.values(value).forEach(immutable); Object.freeze(value); }
    return value;
}
type PreparedBinding = {
    attacker: Creature; defender: Creature; state: string;
    attackerX: number; attackerY: number; defenderX: number; defenderY: number;
};

export class ActorCombatResolutionAuthority {
    private readonly plans = new WeakMap<PreparedNativeMelee, PreparedBinding>();
    private readonly player: Player;
    private readonly grid: Game['grid'];
    private readonly depth: number;
    private readonly cohort = new Map<number, Creature>();
    private resolving = false;
    private failed = false;

    constructor(private readonly game: Game, private readonly state: ActorCombatResolutionState) {
        validateActorCombatResolutionState(state);
        this.player = game.player; this.grid = game.grid; this.depth = game.depth;
        for (const actor of [game.player, ...game.monsters]) {
            if (this.cohort.has(actor.id)) fail('duplicate world actor identity');
            this.cohort.set(actor.id, actor);
        }
        for (const actor of state.actors) {
            if (actor.depth === game.depth && !this.cohort.has(actor.actorId)) fail('unbound defense actor');
        }
    }
    /** Export/rebind is inert: no recovery, facts, dice, or resubmitted attacks. */
    snapshot(): ActorCombatResolutionState {
        this.assertUsable(); validateActorCombatResolutionState(this.state);
        return structuredClone(this.state);
    }
    get invalidated(): boolean { return this.failed; }
    private assertUsable(): void {
        if (this.failed) fail('authority invalidated after incomplete resolution; fixture must stop');
        if (this.resolving) fail('reentrant resolution is forbidden');
    }
    private liveActor(actorId: number): Creature | undefined {
        const actor = this.game.player.id === actorId ? this.game.player : this.game.monsters.find(m => m.id === actorId);
        return actor && actor === this.cohort.get(actorId) ? actor : undefined;
    }
    private defense(actorId: number): ActorDefenseState | undefined {
        return this.state.actors.find(actor => actor.actorId === actorId && actor.depth === this.game.depth);
    }
    /** No mutation, native hooks, counters or RNG, including invalid intents. */
    prepareNativeMelee(value: unknown): PreparedNativeMelee | null {
        this.assertUsable(); validateNativeMeleeResolutionIntent(value); validateActorCombatResolutionState(this.state);
        const pair = this.eligible(value);
        if (!pair) return null;
        const [attacker, defender] = pair;
        const plan = immutable({ intent: { ...value } });
        this.plans.set(plan, { attacker, defender, state: JSON.stringify(this.state), attackerX: attacker.x,
            attackerY: attacker.y, defenderX: defender.x, defenderY: defender.y });
        return plan;
    }
    private eligible(intent: NativeMeleeResolutionIntent): [Creature, Creature] | null {
        if (this.game.isGameOver || this.game.player !== this.player || this.game.grid !== this.grid
            || this.game.depth !== this.depth || intent.depth !== this.game.depth) return null;
        const a = this.liveActor(intent.sourceEntityId), d = this.liveActor(intent.targetEntityId);
        if (!a || !d || a === d || a.hp <= 0 || d.hp <= 0 || a.hasStatus('paralyzed') || a.hasStatus('entranced')
            || a.hasStatus('confused') || (this.defense(a.id)?.staggerRemainingTicks ?? 0) > 0) return null;
        // The production spatial boundary remains closed. Never quietly treat
        // an unopened body/group component as one native point.
        assertNativeSpatial(a); assertNativeSpatial(d);
        // 4a-1 opened square bodies for movement/placement only. Actor-action
        // combat stays single-cell until body targeting (4a-2/3b) is wired.
        if (a.spatial || d.spatial) throw new SpatialValidationError('Actor-action spatial capability is not open');
        if (a instanceof Monster && (a.isDormant || a.deathProcessed || a.isCaged || a.state === MonsterState.ASLEEP
            || a.hasBehavior('MONST_IMMOBILE') || a.hasBehavior('MONST_TURRET')
            || a.hasBehavior('MONST_GETS_TURN_ON_ACTIVATION'))) return null;
        if (d instanceof Monster && (d.isDormant || d.deathProcessed || d.isCaged)) return null;
        if (!monstersAreEnemies(a, d) || distanceBetweenFootprints(a, d) !== 1) return null;
        if (a instanceof Player && (!canObserveBoltCreature(a, this.game.grid, d)
            // A synchronous actor scope is not approval of an acid/other risk.
            // Risk-authorized delayed targets need a linked approved action
            // payload, which is intentionally not open in this fixture seam.
            || this.game.prepareActorAttackRisks(a.id, [...this.game.footprintOf(d)]).length > 0)) return null;
        const throughWall = d instanceof Monster && d.hasBehavior('MONST_ATTACKABLE_THRU_WALLS');
        if (!throughWall && (!this.game.grid.getCell(d.x, d.y)?.isPassable
            || !this.game.grid.getCell(a.x, a.y)?.isPassable
            || playerTravelDiagonalBlocked(this.game.grid, a.loc, d.loc, false))) return null;
        return [a, d];
    }
    commitNativeMelee(scope: ActorActionScope, plan: PreparedNativeMelee): ActorMeleeResolution | null {
        this.assertUsable();
        const saved = this.plans.get(plan);
        if (!saved) fail('unrecognized or consumed melee plan');
        assertActorActionScope(scope, this.game, plan.intent.sourceEntityId,
            saved.attacker === this.game.player ? 'player-command' : 'npc-scheduler');
        validateActorCombatResolutionState(this.state);
        const pair = this.eligible(plan.intent);
        this.plans.delete(plan);
        if (!pair || pair[0] !== saved.attacker || pair[1] !== saved.defender || JSON.stringify(this.state) !== saved.state
            || pair[0].x !== saved.attackerX || pair[0].y !== saved.attackerY
            || pair[1].x !== saved.defenderX || pair[1].y !== saved.defenderY) return null;
        if (this.state.nextResolutionId >= Number.MAX_SAFE_INTEGER - 1) fail('resolution identity budget exhausted');
        const [attacker, defender] = pair, defense = this.defense(defender.id);
        const defenseActive = defender.hp > 0 && !defender.hasStatus('paralyzed') && !defender.hasStatus('entranced')
            && !(defender instanceof Monster && (defender.isCaged || defender.state === MonsterState.ASLEEP))
            && (defense?.staggerRemainingTicks ?? 0) === 0;
        const dodged = defenseActive && plan.intent.dodgeable && (defense?.dodgeRemainingTicks ?? 0) > 0;
        const parried = !dodged && defenseActive && plan.intent.parryable && (defense?.parryRemainingTicks ?? 0) > 0
            && Math.sign(attacker.x - defender.x) === defense!.parryFacing.x
            && Math.sign(attacker.y - defender.y) === defense!.parryFacing.y;
        if (parried && !this.defense(attacker.id) && (defense!.parryPoiseDamage > 0 || defense!.parryStaggerTicks > 0))
            fail('parry consequence requires a bound source resource owner');
        const resolutionId = this.state.nextResolutionId;
        markActorActionFixture(this.game);
        this.resolving = true;
        try {
            if (dodged || parried) {
                if (parried) {
                    defense!.parryRemainingTicks = 0;
                    const source = this.defense(attacker.id);
                    if (source) {
                        source.poise = Math.max(0, source.poise - defense!.parryPoiseDamage);
                        source.staggerRemainingTicks = Math.max(source.staggerRemainingTicks, defense!.parryStaggerTicks);
                        // Cancel active defenses immediately; the caller's
                        // action scheduler owns cancellation of pending attacks.
                        source.dodgeRemainingTicks = source.parryRemainingTicks = 0;
                    }
                }
                this.state.nextResolutionId++;
                return immutable({ kind: 'defended', fact: { kind: 'defended', resolutionId, depth: this.game.depth,
                    sourceEntityId: attacker.id, targetEntityId: defender.id, defense: dodged ? 'dodge' : 'parry' },
                    ...(parried ? { sourceInterruption: { kind: 'cancel-pending-source' as const,
                        sourceEntityId: attacker.id, breakRecoveryTicks: defense!.parryStaggerTicks } } : {}) });
            }
            // Only native CombatSystem may run hit/damage/armor/shield/causality
            // and physicalResolved. A defended fact never enters this path.
            const attack = CombatSystem.attack(attacker, defender, { grid: this.game.grid, itemGenerationDepth: this.game.depth });
            this.state.nextResolutionId++;
            return { kind: 'native', resolutionId, attack };
        } catch (error) {
            // The native attack may already have emitted HP/status/causal writes.
            // No partial rollback or retry is represented as success. Production
            // recording integration remains closed until its world transaction
            // is wired by a later slice; markActorActionFixture already blocks
            // native save/recording exports from this changed fixture world.
            this.failed = true; throw error;
        } finally { this.resolving = false; }
    }
    /** The engine advances elapsed time before resolving same-tick contacts.
     * The actor scope prevents an unrelated actor from aging another window. */
    advanceDefenseTime(scope: ActorActionScope, actorId: number, elapsedTicks: number): void {
        this.assertUsable(); assertActorActionScope(scope, this.game, actorId);
        if (this.game.player !== this.player || this.game.grid !== this.grid || this.game.depth !== this.depth)
            fail('stale defense world binding');
        validateActorCombatResolutionState(this.state);
        if (!integer(elapsedTicks, 1)) fail('elapsed time must be positive bounded ticks');
        const actor = this.defense(actorId);
        if (!actor || !this.liveActor(actorId)) fail('unbound defense clock');
        markActorActionFixture(this.game);
        actor.dodgeRemainingTicks = Math.max(0, actor.dodgeRemainingTicks - elapsedTicks);
        actor.parryRemainingTicks = Math.max(0, actor.parryRemainingTicks - elapsedTicks);
        actor.staggerRemainingTicks = Math.max(0, actor.staggerRemainingTicks - elapsedTicks);
    }
    /** Explicit event-owner seam for movement, death, layer exit and interruption. */
    cancelDefense(scope: ActorActionScope, actorId: number): void {
        this.assertUsable(); assertActorActionScope(scope, this.game, actorId);
        if (this.game.player !== this.player || this.game.grid !== this.grid || this.game.depth !== this.depth)
            fail('stale defense world binding');
        validateActorCombatResolutionState(this.state);
        const actor = this.defense(actorId);
        if (!actor) fail('unbound defense cancellation');
        markActorActionFixture(this.game);
        actor.dodgeRemainingTicks = actor.parryRemainingTicks = 0;
    }
}

export interface PartBreakConsequenceRequest {
    resolutionId: number;
    breakReceipt: string;
    groupId: number;
    sourcePartId: string;
    generation: number;
    balanceLoss: number;
    fallbackStunTicks: number;
}
export type PartBreakProviderResult =
    | { status: 'unavailable' }
    | { status: 'handled'; poiseLoss: number; staggerTicks: number };
export type PartBreakConsequence =
    | { readonly kind: 'source-cancel'; readonly sourcePartId: string; readonly generation: number }
    | { readonly kind: 'combat-handled'; readonly groupId: number; readonly sourcePartId: string; readonly generation: number;
        readonly poiseLoss: number; readonly staggerTicks: number }
    | { readonly kind: 'native-fallback'; readonly groupId: number; readonly sourcePartId: string; readonly generation: number;
        readonly actionLockInTicks: number };
/** Pure contract fixture only. This does not install a provider, accept a body
 * transition receipt as authentic, or mutate the unopened spatial world. A
 * future body-transaction owner must authenticate/deduplicate the receipt before
 * applying exactly one branch; provider exceptions must abort that transaction. */
export function selectPartBreakConsequence(request: unknown, response?: unknown): Readonly<PartBreakConsequence> {
    fields(request, ['resolutionId', 'breakReceipt', 'groupId', 'sourcePartId', 'generation', 'balanceLoss', 'fallbackStunTicks']);
    const identity = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$/.test(v);
    if (!id(request.resolutionId) || !id(request.groupId) || !identity(request.breakReceipt) || !identity(request.sourcePartId)
        || !integer(request.generation, 1) || !integer(request.balanceLoss) || !integer(request.fallbackStunTicks)) fail('invalid part-break request');
    const source = { sourcePartId: request.sourcePartId, generation: request.generation };
    if (request.balanceLoss === 0) {
        if (response !== undefined) fail('no part-break provider response is permitted without balance loss');
        return immutable({ kind: 'source-cancel', ...source });
    }
    if (response === undefined) response = { status: 'unavailable' };
    const status = response && typeof response === 'object' ? Object.getOwnPropertyDescriptor(response, 'status') : undefined;
    if (!status || !('value' in status)) fail('invalid optional part-break response');
    if (status.value === 'handled') {
        fields(response, ['status', 'poiseLoss', 'staggerTicks']);
        if (!integer(response.poiseLoss) || !integer(response.staggerTicks)) fail('invalid handled part-break consequence');
        return immutable({ kind: 'combat-handled', groupId: request.groupId, ...source,
            poiseLoss: response.poiseLoss, staggerTicks: response.staggerTicks });
    }
    fields(response, ['status']);
    if (response.status !== 'unavailable') fail('invalid optional part-break response');
    return immutable({ kind: 'native-fallback', groupId: request.groupId, ...source, actionLockInTicks: request.fallbackStunTicks });
}
