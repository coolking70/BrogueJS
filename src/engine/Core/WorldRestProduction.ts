import { bodyDecisionActor } from '../Status/BodyStatuses';
/** Foundation-owned timed rest. Content owns finite definitions/receipts; the
 * existing actor scheduler remains the sole mechanical clock. */
import type { Game } from './Game';
import type { Creature } from '../../entities/Creature';
import { Monster, monstersAreEnemies } from '../../entities/Monster';
import type { BonfireInterruptReason, WorldRestUnavailableReason } from '../../ext/worldRest';
import type { ReadonlyActorActionBundle } from './ActorActionScheduler';
import { createActorActionBundle, MAX_ACTOR_ACTION_BUNDLES } from './ActorActionScheduler';
import { productionActorActionScheduler } from './ActorActionProduction';
import { bindPhasedAttackProduction, isActorStaggered, restoreActorRestResources } from './PhasedAttackProduction';
import { withActorActionScope } from './ActorActionScope';
import { sourceFootprintVersion } from '../Movement/AttackShape';
import { hasInteractionLine } from '../../ext/worldSpatial';
import { actorSourceRevision, distanceToFootprint } from '../Movement/CreatureSpatial';
import { canDirectlySeeMonster } from '../UI/MonsterVisibility';
import { canonical } from '../../ext/json';
import { actorActionIdentityCheckpoint } from '../../ext/actorActionIdentity';
import type { Json } from '../../ext/types';
import { invalidateProductionActorActionSession } from './ActorActionSession';
import { deepFreeze } from '../Movement/SpatialSchema';

const binding = (game: Game) => game.extensionRuntime?.actorActionBinding();
let nextSession=1;
const restSessions=new WeakMap<Game,{runtime:object;revision:number}>();
function sessionRevision(game:Game):number {
    let session=restSessions.get(game);
    if(session?.runtime!==game.extensionRuntime){session={runtime:game.extensionRuntime!,revision:nextSession++};restSessions.set(game,session);}
    return session.revision;
}
const sources = new WeakMap<Game, {runtime:object;actionId:number;actor:Creature;revision:number}>();
/** Session-only displacement token; load rebinds after validating persistent geometry. */
export function bindWorldRestSource(game:Game):void {
    const active=binding(game)?.state.bonfires?.active,previous=sources.get(game);
    if(!active){sources.delete(game);return;}
    if(previous?.runtime===game.extensionRuntime&&previous.actionId===active.actionId)return;
    sources.set(game,{runtime:game.extensionRuntime!,actionId:active.actionId,actor:game.player,revision:actorSourceRevision(game.player)});
}
function revision(game: Game): void {
    const state = binding(game)!.state;
    if (state.revision >= Number.MAX_SAFE_INTEGER - 1) throw new Error('Rest revision exhausted');
    state.revision++;
}
function threat(game: Game): boolean {
    return game.monsters.some(monster => monster.hp > 0 && monstersAreEnemies(monster,game.player) && !monster.isDormant && !monster.deathProcessed
        && !bodyDecisionActor(monster).isCaged && canDirectlySeeMonster(game.player, game.grid, monster));
}
function incapacitated(game: Game): boolean {
    return game.player.seized || ['paralyzed', 'entranced', 'confused', 'stuck', 'nauseous'].some(status => game.player.hasStatus(status as 'paralyzed'))
        || (game.player.spatial?.actionLockInTicks ?? 0) > 0;
}
/** Pure advisory. The command repeats all checks after canonical confirmation. */
export function worldRestUnavailable(game: Game, bonfireId: number): WorldRestUnavailableReason | null {
    const selected = binding(game), ledger = selected?.state.bonfires;
    if (!selected?.definition.bonfires || !ledger || !ledger.bindings[String(bonfireId)]) return 'unavailable';
    const placement=ledger.placements.find(row=>row.instanceKey===ledger.bindings[String(bonfireId)]!.instanceKey);
    if(!placement||placement.visits>=Number.MAX_SAFE_INTEGER||selected.state.nextActionId>=Number.MAX_SAFE_INTEGER
        ||selected.state.revision>=Number.MAX_SAFE_INTEGER-1)return 'unavailable';
    // Elapsed resource recovery can materialize implicit partial pools for any
    // active actor. Reserve that bounded ledger room before accepting time.
    const materialized=new Set(selected.state.actors.map(actor=>actor.actorId));
    const needed=[game.player,...game.monsters].filter(actor=>{
        if(actor.hp<=0||materialized.has(actor.id)||actor instanceof Monster&&(actor.isDormant||actor.deathProcessed))return false;
        const profileId=actor instanceof Monster?selected.definition.nativeProfiles.find(row=>row.monsterId===actor.typeId)?.profileId:undefined;
        const profile=selected.definition.profiles.find(row=>row.id===(profileId??selected.definition.playerProfileId))!;
        const policy=selected.definition.resourcePolicies.find(row=>row.id===profile.resourcePolicyId)!;
        return policy.initialStamina<policy.staminaCapacity;
    }).length;
    if(selected.state.scheduler.bundles.length>=MAX_ACTOR_ACTION_BUNDLES||selected.state.actors.length+needed>MAX_ACTOR_ACTION_BUNDLES)
        return 'unavailable';
    if (game.isGameOver || game.player.hp <= 0 || incapacitated(game)) return 'unavailable';
    if (game.interactionActive) return 'gate';
    if (ledger.active || game.player.ticksUntilTurn > 0 || isActorStaggered(game, game.player.id)
        || selected.state.scheduler.bundles.some(bundle => bundle.decisionOwnerId === game.player.id)
        || selected.state.actors.some(actor => actor.actorId === game.player.id && (actor.dodgeRecoveryRemainingTicks || actor.parryRecoveryRemainingTicks || actor.staggerRemainingTicks)))
        return 'busy';
    if (!game.extensionRuntime!.nearbyInteractables(selected.moduleId).some(entity => entity.id === bonfireId)) return 'distance';
    if (threat(game)) return 'threatened';
    return null;
}
export interface WorldRestPlan {
    moduleId: string; bonfireId: number; definitionId: string; instanceKey: string;
    restTicks: number; revision: number; sessionRevision:number; sourceVersion: string; sourceRevision:number; facts: string;
}
export function isWorldRestCommand(game: Game, data: unknown): boolean {
    if (typeof data !== 'string') return false;
    try { const input = JSON.parse(data), selected = binding(game); return !!selected?.definition.bonfires && input.module === selected.moduleId && input.action === 'rest'; }
    catch { return false; }
}
export function prepareWorldRest(game: Game, data: unknown): WorldRestPlan | null {
    bindPhasedAttackProduction(game);
    if (typeof data !== 'string') throw new Error('Invalid rest command');
    const input = JSON.parse(data);
    if (!input || Object.keys(input).sort().join(',') !== 'action,module,payload' || !isWorldRestCommand(game, data)
        || !input.payload || Object.keys(input.payload).join(',') !== 'bonfireId'
        || !Number.isSafeInteger(input.payload.bonfireId) || input.payload.bonfireId < 1) throw new Error('Invalid rest input');
    if (worldRestUnavailable(game, input.payload.bonfireId)) return null;
    const selected = binding(game)!, state = selected.state, entry = state.bonfires!.bindings[String(input.payload.bonfireId)]!;
    const definition = selected.definition.bonfires!.definitions.find(definition => definition.id === entry.definitionId)!;
    return deepFreeze({ moduleId: selected.moduleId, bonfireId: input.payload.bonfireId, definitionId: definition.id, instanceKey: entry.instanceKey,
        restTicks: definition.restTicks, revision: state.revision, sessionRevision:sessionRevision(game), sourceRevision:actorSourceRevision(game.player), sourceVersion: sourceFootprintVersion(game.spatialOf(game.player)),
        facts: canonical({ state, target: game.extensionRuntime!.worldRestTarget(selected.moduleId, input.payload.bonfireId),
            hp: game.player.hp, maxHp: game.player.maxHp, statuses: game.player.statusDurations, depth: game.depth, loc: game.player.loc }) });
}
export function commitWorldRest(game: Game, plan: WorldRestPlan): boolean {
    const current = prepareWorldRest(game, JSON.stringify({ module: plan.moduleId, action: 'rest', payload: { bonfireId: plan.bonfireId } }));
    if (!current || canonical(current) !== canonical(plan)) throw new Error('Stale rest preparation');
    const selected = binding(game)!, state = selected.state, ledger = state.bonfires!, scheduler = productionActorActionScheduler(game)!;
    if (state.nextActionId >= Number.MAX_SAFE_INTEGER || state.revision >= Number.MAX_SAFE_INTEGER - 1) throw new Error('Rest identity exhausted');
    const placement = ledger.placements.find(entry => entry.instanceKey === plan.instanceKey)!;
    if (!placement || placement.visits >= Number.MAX_SAFE_INTEGER) throw new Error('Rest visit identity exhausted');
    const bundle = createActorActionBundle({ actionId: state.nextActionId, depth: game.depth, decisionOwnerId: game.player.id, timeChargeOwnerId: game.player.id,
        subactions: [{ sourceEntityId: game.player.id, sourcePartId: game.spatialOf(game.player).partId ?? 'body', sourceFootprintVersion: plan.sourceVersion,
            phases: [{ kind: 'recovery', durationTicks: plan.restTicks, segmentIndex: null }] }] });
    const checkpoint = actorActionIdentityCheckpoint(state as unknown as Json), ticks = game.player.ticksUntilTurn;
    return withActorActionScope(game, 'player-command', game.player.id, () => {
        try {
            placement.visits++;
            ledger.active = { actionId: state.nextActionId++, bonfireId: plan.bonfireId, definitionId: plan.definitionId, instanceKey: plan.instanceKey,
                visit: placement.visits, actorId: game.player.id, depth: game.depth, startHp: game.player.hp, anchor: { ...game.player.loc }, interrupted: null, phase: 'resting' };
            revision(game); scheduler.commitBundle(bundle); bindWorldRestSource(game); return true;
        } catch (error) {
            checkpoint.restore(); game.player.ticksUntilTurn = ticks;
            invalidateProductionActorActionSession(game);game.invalidateActorActionRun(error instanceof Error?error:new Error(String(error)));
            throw error;
        }
    });
}
export function interruptWorldRest(game: Game, reason: BonfireInterruptReason): void {
    const active = binding(game)?.state.bonfires?.active;
    if (active && !active.interrupted) { active.interrupted = reason; revision(game); }
}
/** Every committed positive HP loss cancels recovery, even if healed later in the same tick. */
export function worldRestDamage(game: Game, actor: Creature, hpLost: number): void {
    if (actor === game.player && hpLost > 0) interruptWorldRest(game, actor.hp <= 0 ? 'dead' : 'damage');
}
export function worldRestSourceChanged(game: Game, actorId: number): void {
    if (actorId === game.player.id) interruptWorldRest(game, game.player.hp <= 0 ? 'dead' : 'moved');
}
export function finishWorldRestClock(game: Game, bundle: ReadonlyActorActionBundle, reason: 'completed' | 'source-invalid'): boolean {
    const active = binding(game)?.state.bonfires?.active;
    if (!active || active.actionId !== bundle.actionId) return false;
    if (reason !== 'completed') interruptWorldRest(game, game.player.hp <= 0 ? 'dead' : 'invalid');
    active.phase = 'settling'; revision(game); return true;
}
function interruption(game: Game): BonfireInterruptReason | null {
    const selected = binding(game), active = selected?.state.bonfires?.active;
    if (!active) return null;
    if (game.player.hp <= 0 || game.isGameOver) return 'dead';
    if (active.interrupted) return active.interrupted;
    const source=sources.get(game);
    if(source&&(source.actor!==game.player||source.revision!==actorSourceRevision(game.player)))return 'moved';
    if (game.depth !== active.depth) return 'level-exit';
    if (game.player.x !== active.anchor.x || game.player.y !== active.anchor.y) return 'moved';
    if (game.player.hp < active.startHp) return 'damage';
    if (incapacitated(game) || isActorStaggered(game, game.player.id)) return 'incapacitated';
    const target = game.extensionRuntime!.worldRestTarget(selected!.moduleId, active.bonfireId);
    if (!target || !selected!.state.bonfires!.bindings[String(target.id)]) return 'target-removed';
    if (distanceToFootprint(game.player, target) > target.interactionDistance || !hasInteractionLine(game.grid, game.player.loc, target)) return 'moved';
    if (threat(game)) return 'threat';
    return null;
}
/** Called after ALL due native actors and environment, and again at the terminal
 * command boundary. No UI callback or wall-clock can complete or cancel a rest. */
export function settleWorldRest(game: Game, allowRecovery = true): void {
    const active=binding(game)?.state.bonfires?.active;
    if(!active)return;
    const work=()=>settleWorldRestCommitted(game,allowRecovery);
    // Only successful final settlement can publish a fact. Resting/interrupted
    // checks keep their original narrow transaction and do not snapshot the world.
    if(game.extensionRuntime&&active.phase==='settling'&&!active.interrupted&&allowRecovery)
        game.extensionRuntime.withCommittedFacts(work,['rest-completed']);
    else work();
}
function settleWorldRestCommitted(game: Game, allowRecovery: boolean): void {
    const selected = binding(game), ledger = selected?.state.bonfires, active = ledger?.active;
    if (!selected || !ledger || !active) return;
    const reason = interruption(game);
    if (reason) {
        interruptWorldRest(game, reason);
        if (active.phase === 'resting') productionActorActionScheduler(game)!.retireBundle(active.actionId);
    }
    if (active.phase !== 'settling' || (!active.interrupted && !allowRecovery)) return;
    const definition = selected.definition.bonfires!.definitions.find(definition => definition.id === active.definitionId)!;
    const checkpoint = actorActionIdentityCheckpoint(selected.state as unknown as Json), hp = game.player.hp, ticks=game.player.ticksUntilTurn;
    try {
        if (!active.interrupted) {
            // Authoritative current capacities, never the values when the dialog opened.
            if (definition.restorePolicy.hp === 'full') game.player.hp = game.player.maxHp;
            restoreActorRestResources(game, definition.restorePolicy);
            ledger.placements.find(entry => entry.instanceKey === active.instanceKey)!.completedRests++;
        }
        const { startHp: _hp, anchor: _anchor, interrupted, phase: _phase, ...identity } = active;
        ledger.receipts.push({ ...identity, result: interrupted ? 'interrupted' : 'completed', reason: interrupted });
        ledger.receipts.splice(0, Math.max(0, ledger.receipts.length - selected.definition.bonfires!.limits.maxRestReceipts));
        ledger.active = null;
        const row=selected.state.actors.find(row=>row.actorId===active.actorId);
        if(row&&row.poise===0){row.staggerRemainingTicks=selected.definition.breakRecoveryTicks;game.player.ticksUntilTurn=row.staggerRemainingTicks;}
        revision(game);
        if(!interrupted)game.extensionRuntime!.commitCombatEvent(game.player,{eventKind:'rest-completed',actionId:active.actionId,
            sourceSubactionId:null,segmentIndex:null,resolutionId:null,bonfireId:active.bonfireId,visit:active.visit,hitCount:0,hpLost:0});
    } catch (error) {
        checkpoint.restore(); game.player.hp = hp;game.player.ticksUntilTurn=ticks;
        invalidateProductionActorActionSession(game);game.invalidateActorActionRun(error instanceof Error?error:new Error(String(error)));
        throw error;
    }
}
