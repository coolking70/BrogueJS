import { isIncapacitated } from '../Status/Incapacitation';
import {createActorActionsRoot} from './ActorActionsRoot';
import { actorActionRecord } from './ActorActionData';
import { markActorActionFixture } from './ActorActionSession';
import type { Game, ControlledActionRisk } from './Game';
import type { Creature } from '../../entities/Creature';
import { Monster, MonsterState } from '../../entities/Monster';
import { deepFreeze } from '../Movement/SpatialSchema';
import { projectAttackShape, sourceFootprintVersion, validateAttackShapeRequest, type AttackShapeRequest } from '../Movement/AttackShape';
import { assertActorActionScope, assertNativeActorDecisionScope, type ActorActionScope, type ActorActionOrigin } from './ActorActionScope';
import { createActorActionBundle, type ActorActionBundle } from './ActorActionScheduler';

/** Foundation fixture protocol, not a registered user command or combat data
 * format. Opening production actions requires the module's lifecycle in 3b. */
export interface ActorActionRequest {
    schema: 1; kind: 'phased-native'; origin: ActorActionOrigin;
    sourceEntityId: number; decisionOwnerId: number; timeChargeOwnerId: number;
    cost: number; windupTicks: number; recoveryTicks: number; shape: AttackShapeRequest;
}
export interface ActorActionResources { schema: 1; revision: number; nextActionId: number; stamina: number }
export interface ActorActionPlan {
    readonly request: ActorActionRequest; readonly revision: number; readonly sessionRevision: number;
    readonly sourceFootprintVersion: string; readonly depth: number;
    readonly lockedCells: readonly Readonly<{ x: number; y: number }>[];
    readonly risks: readonly ControlledActionRisk[]; readonly bundle: ActorActionBundle;
}
export type ActorActionPreparation = { status: 'ready'; plan: ActorActionPlan }
    | { status: 'rejected'; reason: 'ineligible' | 'insufficient-resource' };
export interface ActorActionSink { isBusy(ownerId: number): boolean; commitBundle(bundle: ActorActionBundle): void }
const finite = (value: unknown, min = 0, max = 1_000_000): value is number => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
export function validateActorActionResources(value: unknown): asserts value is ActorActionResources {
    actorActionRecord(value, ['schema', 'revision', 'nextActionId', 'stamina']);
    const s = value as unknown as ActorActionResources;
    if (Object.keys(s).sort().join(',') !== 'nextActionId,revision,schema,stamina' || s.schema !== 1
        || !finite(s.revision, 0, Number.MAX_SAFE_INTEGER - 1) || !finite(s.nextActionId, 1, Number.MAX_SAFE_INTEGER - 1)
        || !finite(s.stamina)) throw new Error('Invalid actor action resources');
}
function readRequest(value: unknown): ActorActionRequest {
    actorActionRecord(value, ['schema', 'kind', 'origin', 'sourceEntityId', 'decisionOwnerId', 'timeChargeOwnerId', 'cost', 'windupTicks', 'recoveryTicks', 'shape']);
    const r = value as unknown as ActorActionRequest;
    if (Object.keys(r).sort().join(',') !== 'cost,decisionOwnerId,kind,origin,recoveryTicks,schema,shape,sourceEntityId,timeChargeOwnerId,windupTicks'
        || r.schema !== 1 || r.kind !== 'phased-native' || !['player-command', 'npc-scheduler'].includes(r.origin)
        || !finite(r.sourceEntityId, 1, Number.MAX_SAFE_INTEGER) || r.decisionOwnerId !== r.sourceEntityId
        || r.timeChargeOwnerId !== r.decisionOwnerId || !finite(r.cost) || !finite(r.windupTicks, 1)
        || !finite(r.recoveryTicks, 1)) throw new Error('Invalid or unopened actor action request');
    validateAttackShapeRequest(r.shape);
    return structuredClone(r);
}
/** Session authority holds only issued-plan capabilities, never mechanical
 * countdown/resources. Fresh state and geometry are compared before any write. */
export class ActorActionAuthority {
    private readonly issued = new WeakMap<ActorActionPlan, { source: Creature; grid: object; runtime: object | null; facts: string }>();
    private readonly consumed = new WeakSet<ActorActionPlan>();
    private sessionRevision = 1;
    private closed = false;
    private readonly actionRoot;
    constructor(private readonly game: Game, private readonly resources: ActorActionResources, private readonly sink: ActorActionSink) {
        validateActorActionResources(resources);this.actionRoot=game.actorActions??createActorActionsRoot();this.actionRoot.nextActionId=Math.max(this.actionRoot.nextActionId,resources.nextActionId);
    }
    private actor(id: number): Creature | undefined { return id === this.game.player.id ? this.game.player : this.game.monsters.find(m => m.id === id); }
    private facts(source: Creature): string {
        return JSON.stringify({ hp: source.hp, statuses: source.statusDurations, timer: source.ticksUntilTurn,
            gameOver: this.game.isGameOver, depth: this.game.depth, resources: this.resources,
            footprint: sourceFootprintVersion(this.game.spatialOf(source)),
            monsters: this.game.monsters.map(m => [m.id, m.hp, m.loc, m.isAlly, m.isCaged, m.statusDurations]),
            weapon: this.game.player.equippedWeapon, armor: this.game.player.equippedArmor });
    }
    prepareActorAction(value: unknown): ActorActionPreparation {
        if (this.closed) throw new Error('Closed actor action authority');
        const request = readRequest(value); validateActorActionResources(this.resources);
        const source = this.actor(request.sourceEntityId), isPlayer = source === this.game.player;
        if (!source || source.hp <= 0 || this.game.isGameOver || this.game.interactionActive
            || (isPlayer ? request.origin !== 'player-command' : request.origin !== 'npc-scheduler')
            || source.ticksUntilTurn > 0 || isIncapacitated(source) || source.hasStatus('entranced') || source.hasStatus('confused')
            || (source instanceof Monster && (source.isCaged || source.isDormant || source.deathProcessed || source.state === MonsterState.ASLEEP || source.hasBehavior('MONST_IMMOBILE')
                || source.hasBehavior('MONST_GETS_TURN_ON_ACTIVATION')))
            || this.sink.isBusy(source.id)) return { status: 'rejected', reason: 'ineligible' };
        if (this.resources.stamina < request.cost) return { status: 'rejected', reason: 'insufficient-resource' };
        const view = this.game.spatialOf(source);
        const lockedCells = projectAttackShape(view, view.cells, request.shape, {
            contains: p => this.game.grid.isValidPos(p.x, p.y),
            lineOfEffect: (a, b) => this.game.hasLineOfSight(a.x, a.y, b.x, b.y),
        });
        const plan: ActorActionPlan = deepFreeze({ request, revision: this.resources.revision,
            sessionRevision: this.sessionRevision, sourceFootprintVersion: sourceFootprintVersion(view), depth: this.game.depth,
            lockedCells, risks: this.game.prepareActorAttackRisks(source.id, lockedCells),
            bundle: createActorActionBundle({owner:'combat',  actionId: this.actionRoot.nextActionId, depth: this.game.depth, decisionOwnerId: source.id,
                timeChargeOwnerId: source.id, subactions: [{ sourceEntityId: source.id, sourcePartId: view.partId ?? 'body', sourceFootprintVersion: sourceFootprintVersion(view),
                    phases: [{ kind: 'windup', durationTicks: request.windupTicks, segmentIndex: 0 },
                        { kind: 'recovery', durationTicks: request.recoveryTicks, segmentIndex: null }] }] }) });
        this.issued.set(plan, { source, grid: this.game.grid, runtime: this.game.extensionRuntime, facts: this.facts(source) });
        return { status: 'ready', plan };
    }
    commitActorAction(scope: ActorActionScope, plan: ActorActionPlan,
        suppliedAnswers: readonly { risk: ControlledActionRisk; decision: boolean }[] = []): { status: 'committed'; actionId: number } | { status: 'declined' } {
        assertActorActionScope(scope, this.game, plan.request.decisionOwnerId, plan.request.origin);
        if (plan.request.origin === 'npc-scheduler') assertNativeActorDecisionScope(scope, this.game, plan.request.decisionOwnerId);
        const issued = this.issued.get(plan);
        if (this.closed || !issued || this.consumed.has(plan) || issued.grid !== this.game.grid
            || issued.runtime !== this.game.extensionRuntime || this.actor(plan.request.sourceEntityId) !== issued.source
            || issued.facts !== this.facts(issued.source) || plan.sessionRevision !== this.sessionRevision)
            throw new Error('Stale actor action plan');
        const fresh = this.prepareActorAction(plan.request);
        if (fresh.status !== 'ready' || JSON.stringify(fresh.plan) !== JSON.stringify(plan)) throw new Error('Stale actor action plan');
        if (plan.request.origin === 'npc-scheduler' && suppliedAnswers.length) throw new Error('NPC cannot consume player decisions');
        if (this.resources.revision >= Number.MAX_SAFE_INTEGER - 1 || this.resources.nextActionId >= Number.MAX_SAFE_INTEGER - 1)
            throw new Error('Actor action identity budget exhausted');
        markActorActionFixture(this.game);
        if (plan.request.origin === 'player-command') {
            if (!this.game.consumeActorActionAnswers(scope, plan.request.decisionOwnerId, plan.risks, suppliedAnswers)) {
                this.consumed.add(plan); return { status: 'declined' };
            }
        }
        const before = { ...this.resources },nextActionId=this.actionRoot.nextActionId;
        this.consumed.add(plan);
        try {
            this.resources.stamina -= plan.request.cost;
            this.resources.revision++;this.actionRoot.nextActionId++;this.resources.nextActionId=this.actionRoot.nextActionId;
            this.sink.commitBundle(structuredClone(plan.bundle));
            this.sessionRevision++;
            return { status: 'committed', actionId: plan.bundle.actionId };
        } catch (error) {
            Object.assign(this.resources, before);this.actionRoot.nextActionId=nextActionId; this.closed = true;
            // No world-resolution callback has run at this commit point. The
            // scheduler must validate/commit its own bounded timer write atomically.
            throw error;
        }
    }
    close(): void { this.closed = true; this.sessionRevision++; }
}
