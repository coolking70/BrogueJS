/** Engine-owned authority for native melee and bounded locked body segments.
 * Nothing installs this on Game or changes ordinary CombatSystem.attack calls.
 * Mechanical data is caller-owned and explicitly exportable; only prepared
 * identity/scope capabilities are session-local. No extension callback receives
 * a creature, a writable Game, or an actor action scope through this API. */
import type { Creature } from '../../entities/Creature';
import { Monster, MonsterState, monstersAreEnemies } from '../../entities/Monster';
import { Player } from '../../entities/Player';
import type { Game, ControlledActionRisk } from '../Core/Game';
import type { Pos } from '../../types';
import { actorActionArray } from '../Core/ActorActionData';
import { assertActorActionScope, type ActorActionScope } from '../Core/ActorActionScope';
import { isProductionActorActionSession, markActorActionFixture } from '../Core/ActorActionSession';
import { assertNativeSpatial, footprintOf, squareAnchorRevision } from '../Movement/CreatureSpatial';
import { playerTravelDiagonalBlocked } from '../Movement/PlayerTravel';
import { canObserveBoltCreature } from './BoltTargeting';
import { CombatSystem, type AttackResult } from './Combat';
import { bodyRayContact, withBodyAttackContact, type BodyAttackContact } from './BodyCombat';
import { projectAttackShape, sourceFootprintVersion, validateAttackShapeRequest, type AttackShapeRequest } from '../Movement/AttackShape';

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
/** Only native physical damage is open: no arbitrary damage, lunge, projectile,
 * environment, user callback, composite body, or custom damage profile. */
export interface NativeMeleeResolutionIntent {
    kind: 'native-melee';
    depth: number;
    sourceEntityId: number;
    targetEntityId: number;
    dodgeable: boolean;
    parryable: boolean;
}
/** Engine-persisted approval, scoped to the same independent entity identity.
 * Replacements allocate a fresh entity ID. Zones/composite generations remain
 * closed by assertNativeSpatial until their foundation integration is opened. */
export interface ActorAttackRiskApproval {
    readonly targetId: number;
    readonly risks: readonly ControlledActionRisk[];
}
export interface LockedBodySegmentIntent {
    kind: 'locked-body-segment'; depth: number; sourceEntityId: number;
    sourceFootprintVersion: string; shape: AttackShapeRequest;
    lockedCells: readonly Readonly<Pos>[];
    approvedRisks: readonly ActorAttackRiskApproval[];
    dodgeable: boolean; parryable: boolean;
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
export function validateLockedBodySegmentIntent(value: unknown): asserts value is LockedBodySegmentIntent {
    fields(value, ['kind', 'depth', 'sourceEntityId', 'sourceFootprintVersion', 'shape', 'lockedCells', 'approvedRisks', 'dodgeable', 'parryable']);
    if (value.kind !== 'locked-body-segment' || !integer(value.depth, 1, 40) || !id(value.sourceEntityId)
        || typeof value.sourceFootprintVersion !== 'string' || value.sourceFootprintVersion.length < 1
        || value.sourceFootprintVersion.length > 128 || typeof value.dodgeable !== 'boolean'
        || typeof value.parryable !== 'boolean') fail('unsupported locked segment');
    validateAttackShapeRequest(value.shape);
    actorActionArray(value.lockedCells, 0, 1024);
    const seenCells = new Set<string>();
    for (const cell of value.lockedCells) {
        fields(cell, ['x', 'y']);
        const key = `${cell.x},${cell.y}`;
        if (!integer(cell.x, -32768, 32767) || !integer(cell.y, -32768, 32767) || seenCells.has(key)) fail('invalid locked cell');
        seenCells.add(key);
    }
    actorActionArray(value.approvedRisks, 0, 1024);
    const seenTargets = new Set<number>();
    for (const approval of value.approvedRisks) {
        fields(approval, ['targetId', 'risks']);
        if (!id(approval.targetId) || seenTargets.has(approval.targetId)) fail('invalid target risk approval');
        seenTargets.add(approval.targetId); actorActionArray(approval.risks, 0, 2);
        const kinds = new Set<string>();
        for (const risk of approval.risks) {
            fields(risk, ['kind', 'target', 'message']); fields(risk.target, ['kind', 'id']);
            if (!['acid', 'ally'].includes(risk.kind as string) || kinds.has(risk.kind as string)
                || risk.target.kind !== 'creature' || risk.target.id !== approval.targetId
                || typeof risk.message !== 'string' || risk.message.length > 4096) fail('invalid approved attack risk');
            kinds.add(risk.kind as string);
        }
    }
}
function immutable<T>(value: T): Readonly<T> {
    if (value && typeof value === 'object') { Object.values(value).forEach(immutable); Object.freeze(value); }
    return value;
}
type PreparedBinding = {
    attacker: Creature; defender: Creature; state?: string;
    sourceVersion: string; targetVersion: string; sourceRevision: number; targetRevision: number;
    sourceForm: string; targetForm: string;
    contact: BodyAttackContact; segment?: Readonly<LockedBodySegmentIntent>;
    sourceBreaks?: string;
    targetZoneId?: string;
};

export class ActorCombatResolutionAuthority {
    private readonly plans = new WeakMap<PreparedNativeMelee, PreparedBinding>();
    private readonly player: Player;
    private readonly grid: Game['grid'];
    private readonly depth: number;
    private readonly cohort = new Map<number, Creature>();
    private resolving = false;
    private failed = false;

    constructor(private readonly game: Game, private readonly state: ActorCombatResolutionState,
        private readonly options: { production: true } | undefined = undefined) {
        if (options && !isProductionActorActionSession(game)) fail('production authority requires a bound engine session');
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
        if (this.options && !isProductionActorActionSession(this.game)) fail('production authority session closed');
    }
    private liveActor(actorId: number): Creature | undefined {
        const actor = this.game.player.id === actorId ? this.game.player : this.game.monsters.find(m => m.id === actorId);
        return actor && actor === this.cohort.get(actorId) ? actor : undefined;
    }
    private defense(actorId: number): ActorDefenseState | undefined {
        return this.state.actors.find(actor => actor.actorId === actorId && actor.depth === this.game.depth);
    }
    private sourceVersion(actor: Creature): string { return sourceFootprintVersion(this.game.spatialOf(actor)); }
    private formIdentity(actor: Creature): string { return actor instanceof Monster ? `${actor.typeId}:${actor.polymorphed}` : 'player'; }
    private bind(intent: NativeMeleeResolutionIntent, attacker: Creature, defender: Creature,
        contact: BodyAttackContact, segment?: Readonly<LockedBodySegmentIntent>): PreparedNativeMelee {
        const plan = immutable({ intent: { ...intent } });
        this.plans.set(plan, { attacker, defender, ...(segment ? { segment } : { state: JSON.stringify(this.state) }),
            ...(attacker.spatial?.zoneState ? { sourceBreaks: JSON.stringify(attacker.spatial.zoneState.filter(z => z.broken).map(z => z.zoneId)) } : {}),
            ...(defender.spatial?.zoneState ? { targetZoneId: footprintOf(defender).find(p => p.x === contact.to.x && p.y === contact.to.y)?.zoneId } : {}),
            sourceVersion: this.sourceVersion(attacker), targetVersion: this.sourceVersion(defender),
            sourceForm: this.formIdentity(attacker), targetForm: this.formIdentity(defender),
            sourceRevision: squareAnchorRevision(attacker), targetRevision: squareAnchorRevision(defender), contact });
        return plan;
    }
    /** No mutation, native hooks, counters or RNG, including invalid intents. */
    prepareNativeMelee(value: unknown): PreparedNativeMelee | null {
        this.assertUsable(); validateNativeMeleeResolutionIntent(value); validateActorCombatResolutionState(this.state);
        const pair = this.eligible(value);
        if (!pair) return null;
        const contact = this.game.meleeContact(pair[0], pair[1]);
        return contact ? this.bind(value, ...pair, contact) : null;
    }
    /** Freeze one independent segment's D08 part contacts in the foundation's
     * order. No later hit may append a new target. A subsequent segment calls
     * this again with a fresh scope, rather than sharing whole-action dedup. */
    prepareLockedBodySegment(value: unknown): readonly PreparedNativeMelee[] {
        this.assertUsable(); validateLockedBodySegmentIntent(value); validateActorCombatResolutionState(this.state);
        const segment = immutable(structuredClone(value));
        const source = this.liveActor(segment.sourceEntityId);
        if (!source || this.sourceVersion(source) !== segment.sourceFootprintVersion) return Object.freeze([]);
        assertNativeSpatial(source);
        // An illegal early body cell must not consume its part key before a
        // later legal contact is considered. Geometry filtering precedes D08.
        const cells = this.currentSegmentCells(source, segment).filter(to => this.projectedContact(source, to, segment) !== null);
        const plans: PreparedNativeMelee[] = [];
        for (const target of this.game.collectBodyTargets(cells, { effect: 'area-damage' }, new Set<string>())) {
            const intent: NativeMeleeResolutionIntent = { kind: 'native-melee', depth: segment.depth,
                sourceEntityId: source.id, targetEntityId: target.entityId, dodgeable: segment.dodgeable, parryable: segment.parryable };
            const pair = this.eligible(intent, segment);
            if (!pair) continue;
            const contact = this.segmentContact(source, target.entity, target.contact, segment);
            if (contact) plans.push(this.bind(intent, ...pair, contact, segment));
        }
        return Object.freeze(plans);
    }
    private currentSegmentCells(source: Creature, segment: Readonly<LockedBodySegmentIntent>): readonly Readonly<Pos>[] {
        const view = this.game.spatialOf(source), locked = new Set(segment.lockedCells.map(p => `${p.x},${p.y}`));
        // Projection may shrink when a wall appears, but a removed wall never
        // grows the hit area beyond cells that were actually telegraphed.
        return projectAttackShape(view, view.cells, segment.shape, {
            contains: p => this.game.grid.isValidPos(p.x, p.y),
            lineOfEffect: (a, b) => this.game.hasLineOfSight(a.x, a.y, b.x, b.y),
        }).filter(p => locked.has(`${p.x},${p.y}`));
    }
    private projectedContact(source: Creature, to: Readonly<Pos>,
        segment: Readonly<LockedBodySegmentIntent>): BodyAttackContact | null {
        for (const from of footprintOf(source)) {
            const dx = to.x - from.x, dy = to.y - from.y, distance = Math.max(Math.abs(dx), Math.abs(dy));
            if (!segment.shape.offsets.some(p => p.x === dx && p.y === dy)
                || !this.game.grid.getCell(from.x, from.y)?.isPassable || !this.game.grid.getCell(to.x, to.y)?.isPassable
                || !this.game.hasLineOfSight(from.x, from.y, to.x, to.y)
                || (distance === 1 && playerTravelDiagonalBlocked(this.game.grid, from, to, false))) continue;
            return immutable({ from: { ...from }, to: { ...to, zoneId: 'body' }, distance });
        }
        return null;
    }
    private segmentContact(source: Creature, target: Creature, to: Readonly<Pos>,
        segment: Readonly<LockedBodySegmentIntent>): BodyAttackContact | null {
        if (!this.currentSegmentCells(source, segment).some(p => p.x === to.x && p.y === to.y)
            || !footprintOf(target).some(p => p.x === to.x && p.y === to.y)) return null;
        const contact = this.projectedContact(source, to, segment);
        if (!contact) return null;
        const dx = to.x - contact.from.x, dy = to.y - contact.from.y;
        // Collinear thrusts use the foundation's actual first body ray
        // contact. Non-ray area cells retain their exact projected contact.
        if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) {
            const ray = bodyRayContact(source, target, Math.sign(dx), Math.sign(dy), contact.distance, contact.from);
            if (ray.to.x === to.x && ray.to.y === to.y) return ray;
        }
        return contact;
    }
    private eligible(intent: NativeMeleeResolutionIntent, segment?: Readonly<LockedBodySegmentIntent>): [Creature, Creature] | null {
        if (this.game.isGameOver || this.game.player !== this.player || this.game.grid !== this.grid
            || this.game.depth !== this.depth || intent.depth !== this.game.depth) return null;
        const a = this.liveActor(intent.sourceEntityId), d = this.liveActor(intent.targetEntityId);
        if (!a || !d || a === d || a.hp <= 0 || d.hp <= 0 || (a.spatial?.actionLockInTicks ?? 0) > 0 || a.hasStatus('paralyzed') || a.hasStatus('entranced')
            || a.hasStatus('confused') || (this.defense(a.id)?.staggerRemainingTicks ?? 0) > 0) return null;
        // Independent native bodies include rigid masks and authorized fixed
        // zones. Composite members remain rejected, never point-reduced.
        assertNativeSpatial(a); assertNativeSpatial(d);
        if (a instanceof Monster && (a.isDormant || a.deathProcessed || a.isCaged || a.state === MonsterState.ASLEEP
            || a.hasBehavior('MONST_IMMOBILE') || a.hasBehavior('MONST_TURRET')
            || a.hasBehavior('MONST_GETS_TURN_ON_ACTIVATION'))) return null;
        if (d instanceof Monster && (d.isDormant || d.deathProcessed || d.isCaged)) return null;
        if (!monstersAreEnemies(a, d)) return null;
        if (!segment && !this.game.meleeContact(a, d)) return null;
        if (segment && this.sourceVersion(a) !== segment.sourceFootprintVersion) return null;
        if (a instanceof Player) {
            if (!canObserveBoltCreature(a, this.game.grid, d)) return null;
            const risks = this.game.prepareActorAttackRisks(a.id, [...footprintOf(d)]);
            const approved = segment?.approvedRisks.find(approval => approval.targetId === d.id)?.risks ?? [];
            if (risks.some(risk => !approved.some(prior => prior.kind === risk.kind
                && prior.target.kind === 'creature' && prior.target.id === d.id))) return null;
        }
        return [a, d];
    }
    commitNativeMelee(scope: ActorActionScope, plan: PreparedNativeMelee): ActorMeleeResolution | null {
        this.assertUsable();
        const saved = this.plans.get(plan);
        if (!saved) fail('unrecognized or consumed melee plan');
        assertActorActionScope(scope, this.game, plan.intent.sourceEntityId,
            saved.attacker === this.game.player ? 'player-command' : 'npc-scheduler');
        validateActorCombatResolutionState(this.state);
        const pair = this.eligible(plan.intent, saved.segment);
        this.plans.delete(plan);
        if (!pair || pair[0] !== saved.attacker || pair[1] !== saved.defender
            || (saved.sourceBreaks !== undefined && saved.sourceBreaks !== JSON.stringify(pair[0].spatial?.zoneState?.filter(z => z.broken).map(z => z.zoneId)))
            || (saved.targetZoneId !== undefined && pair[1].spatial?.zoneState?.some(z => z.zoneId === saved.targetZoneId && z.broken))
            || (saved.state !== undefined && JSON.stringify(this.state) !== saved.state)
            || this.sourceVersion(pair[0]) !== saved.sourceVersion || this.sourceVersion(pair[1]) !== saved.targetVersion
            || this.formIdentity(pair[0]) !== saved.sourceForm || this.formIdentity(pair[1]) !== saved.targetForm
            || squareAnchorRevision(pair[0]) !== saved.sourceRevision || squareAnchorRevision(pair[1]) !== saved.targetRevision) return null;
        const contact = saved.segment ? this.segmentContact(...pair, saved.contact.to, saved.segment)
            : this.game.meleeContact(...pair);
        if (!contact || JSON.stringify(contact) !== JSON.stringify(saved.contact)) return null;
        if (this.state.nextResolutionId >= Number.MAX_SAFE_INTEGER - 1) fail('resolution identity budget exhausted');
        const [attacker, defender] = pair, defense = this.defense(defender.id);
        const defenseActive = defender.hp > 0 && !defender.hasStatus('paralyzed') && !defender.hasStatus('entranced')
            && !(defender instanceof Monster && (defender.isCaged || defender.state === MonsterState.ASLEEP))
            && (defense?.staggerRemainingTicks ?? 0) === 0;
        const dodged = defenseActive && plan.intent.dodgeable && (defense?.dodgeRemainingTicks ?? 0) > 0;
        const parried = !dodged && defenseActive && plan.intent.parryable && (defense?.parryRemainingTicks ?? 0) > 0
            && Math.sign(contact.from.x - contact.to.x) === defense!.parryFacing.x
            && Math.sign(contact.from.y - contact.to.y) === defense!.parryFacing.y;
        if (parried && !this.defense(attacker.id) && (defense!.parryPoiseDamage > 0 || defense!.parryStaggerTicks > 0))
            fail('parry consequence requires a bound source resource owner');
        const resolutionId = this.state.nextResolutionId;
        if (!this.options) markActorActionFixture(this.game);
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
            const attack = withBodyAttackContact(attacker, defender, contact, () => this.options
                ? this.game.resolveActorNativeMelee(scope, attacker, defender)
                : CombatSystem.attack(attacker, defender, { grid: this.game.grid, itemGenerationDepth: this.game.depth }));
            this.state.nextResolutionId++;
            return { kind: 'native', resolutionId, attack };
        } catch (error) {
            // The native attack may already have emitted HP/status/causal writes.
            // No partial rollback or retry is represented as success. The
            // production session owner must also invalidate its action/recording
            // on this exception; fixture worlds are already export-blocked.
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
        if (!this.options) markActorActionFixture(this.game);
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
        if (!this.options) markActorActionFixture(this.game);
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
