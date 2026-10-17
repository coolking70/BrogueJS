import {withPartyActor} from './PartyRuntime';
import { isIncapacitated } from '../Status/Incapacitation';
import { bodyDecisionActor } from '../Status/BodyStatuses';
import i18next from 'i18next';
import { logger } from '../Systems/Logger';
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
    const actor=game.controlledActors.find(a=>a.id===active.actorId);if(!actor)throw new Error("Unknown resting actor");sources.set(game,{runtime:game.extensionRuntime!,actionId:active.actionId,actor,revision:actorSourceRevision(actor)});
}
function revision(game: Game): void {
    const state = binding(game)!.state;
    if (state.revision >= Number.MAX_SAFE_INTEGER - 1) throw new Error('Rest revision exhausted');
    state.revision++;
}
function threat(game: Game): boolean {
    return game.monsters.some(monster => monster.hp > 0 && monstersAreEnemies(monster,game.commandActor) && !monster.isDormant && !monster.deathProcessed
        && !bodyDecisionActor(monster).isCaged && canDirectlySeeMonster(game.commandActor, game.grid, monster));
}
function incapacitated(game: Game): boolean {
    return game.commandActor.seized || isIncapacitated(game.commandActor) || (['entranced', 'confused', 'stuck', 'nauseous'] as const).some(status => game.commandActor.hasStatus(status))
        || (game.commandActor.spatial?.actionLockInTicks ?? 0) > 0;
}
/** Pure advisory. The command repeats all checks after canonical confirmation. */
export function worldRestUnavailable(game: Game, bonfireId: number): WorldRestUnavailableReason | null {
    const selected = binding(game), ledger = selected?.state.bonfires;
    if (!selected?.definition.bonfires || !ledger || !ledger.bindings[String(bonfireId)]) return 'unavailable';
    const placement=ledger.placements.find(row=>row.instanceKey===ledger.bindings[String(bonfireId)]!.instanceKey);
    if(!placement||placement.visits>=Number.MAX_SAFE_INTEGER||game.actorActions!.nextActionId>=Number.MAX_SAFE_INTEGER
        ||selected.state.revision>=Number.MAX_SAFE_INTEGER-1)return 'unavailable';
    // Elapsed resource recovery can materialize implicit partial pools for any
    // active actor. Reserve that bounded ledger room before accepting time.
    const materialized=new Set(selected.state.actors.map(actor=>actor.actorId));
    const needed=[...game.activeControlledActors,...game.monsters].filter(actor=>{
        if(actor.hp<=0||materialized.has(actor.id)||actor instanceof Monster&&(actor.isDormant||actor.deathProcessed))return false;
        const profileId=actor instanceof Monster?selected.definition.nativeProfiles.find(row=>row.monsterId===actor.typeId)?.profileId:undefined;
        const profile=selected.definition.profiles.find(row=>row.id===(profileId??selected.definition.playerProfileId))!;
        const policy=selected.definition.resourcePolicies.find(row=>row.id===profile.resourcePolicyId)!;
        return policy.initialStamina<policy.staminaCapacity;
    }).length;
    if(game.actorActions!.bundles.length>=MAX_ACTOR_ACTION_BUNDLES||selected.state.actors.length+needed>MAX_ACTOR_ACTION_BUNDLES)
        return 'unavailable';
    if (game.isGameOver || game.commandActor.hp <= 0 || incapacitated(game)) return 'unavailable';
    if (game.interactionActive) return 'gate';
    if (ledger.active || game.commandActor.ticksUntilTurn > 0 || isActorStaggered(game, game.commandActor.id)
        || game.actorActions!.bundles.some(bundle => bundle.decisionOwnerId === game.commandActor.id)
        || selected.state.actors.some(actor => actor.actorId === game.commandActor.id && (actor.dodgeRecoveryRemainingTicks || actor.parryRecoveryRemainingTicks || actor.staggerRemainingTicks)))
        return 'busy';
    if (!game.extensionRuntime!.nearbyInteractables(selected.moduleId).some(entity => entity.id === bonfireId)) return 'distance';
    if(game.party){const target=game.extensionRuntime!.nearbyInteractables(selected.moduleId).find(e=>e.id===bonfireId)!;if(game.activeControlledActors.some(a=>a.ticksUntilTurn>0||isIncapacitated(a)||productionActorActionScheduler(game)!.isBusy(a.id)))return 'busy';if(game.activeControlledActors.some(a=>distanceToFootprint(a,target)>target.interactionDistance||!hasInteractionLine(game.grid,a.loc,target)))return 'distance';}
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
        restTicks: definition.restTicks, revision: state.revision, sessionRevision:sessionRevision(game), sourceRevision:actorSourceRevision(game.commandActor), sourceVersion: sourceFootprintVersion(game.spatialOf(game.commandActor)),
        facts: canonical({ state, target: game.extensionRuntime!.worldRestTarget(selected.moduleId, input.payload.bonfireId),
            hp: game.commandActor.hp, maxHp: game.commandActor.maxHp, statuses: game.commandActor.statusDurations, depth: game.depth, loc: game.commandActor.loc }) });
}
export function commitWorldRest(game: Game, plan: WorldRestPlan): boolean {
    const current = prepareWorldRest(game, JSON.stringify({ module: plan.moduleId, action: 'rest', payload: { bonfireId: plan.bonfireId } }));
    if (!current || canonical(current) !== canonical(plan)) throw new Error('Stale rest preparation');
    const selected = binding(game)!, state = selected.state, ledger = state.bonfires!, scheduler = productionActorActionScheduler(game)!;
    if (game.actorActions!.nextActionId >= Number.MAX_SAFE_INTEGER || state.revision >= Number.MAX_SAFE_INTEGER - 1) throw new Error('Rest identity exhausted');
    const placement = ledger.placements.find(entry => entry.instanceKey === plan.instanceKey)!;
    if (!placement || placement.visits >= Number.MAX_SAFE_INTEGER) throw new Error('Rest visit identity exhausted');
    const bundle = createActorActionBundle({owner:'combat',  actionId: game.actorActions!.nextActionId, depth: game.depth, decisionOwnerId: game.commandActor.id, timeChargeOwnerId: game.commandActor.id,
        subactions: [{ sourceEntityId: game.commandActor.id, sourcePartId: game.spatialOf(game.commandActor).partId ?? 'body', sourceFootprintVersion: plan.sourceVersion,
            phases: [{ kind: 'recovery', durationTicks: plan.restTicks, segmentIndex: null }] }] });
    const rootCheckpoint=actorActionIdentityCheckpoint(game.actorActions as unknown as Json);const checkpoint = actorActionIdentityCheckpoint(state as unknown as Json), ticks = game.commandActor.ticksUntilTurn;
    return withActorActionScope(game, 'player-command', game.commandActor.id, () => {
        try {
            placement.visits++;
            ledger.active = { actionId: game.actorActions!.nextActionId++, bonfireId: plan.bonfireId, definitionId: plan.definitionId, instanceKey: plan.instanceKey,
                visit: placement.visits, actorId: game.commandActor.id, depth: game.depth, startHp: game.commandActor.hp, anchor: { ...game.commandActor.loc }, interrupted: null, phase: 'resting' };
            revision(game); scheduler.commitBundle(bundle); bindWorldRestSource(game);
            if(game.party)for(const actor of game.activeControlledActors)if(actor!==game.commandActor){actor.ticksUntilTurn=plan.restTicks;game.party.native[actor.id]!.pendingTurn=true;}return true;
        } catch (error) {
            checkpoint.restore();rootCheckpoint.restore(); game.commandActor.ticksUntilTurn = ticks;
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
    if ((actor === game.commandActor||!!game.party&&game.activeControlledActors.includes(actor as any)) && hpLost > 0) interruptWorldRest(game, actor.hp <= 0 ? 'dead' : 'damage');
}
export function worldRestSourceChanged(game: Game, actorId: number): void {
    if (actorId === game.commandActor.id) interruptWorldRest(game, game.commandActor.hp <= 0 ? 'dead' : 'moved');
}
export function finishWorldRestClock(game: Game, bundle: ReadonlyActorActionBundle, reason: 'completed' | 'source-invalid'): boolean {
    const active = binding(game)?.state.bonfires?.active;
    if (!active || active.actionId !== bundle.actionId) return false;
    if (reason !== 'completed') interruptWorldRest(game, game.commandActor.hp <= 0 ? 'dead' : 'invalid');
    active.phase = 'settling'; revision(game); return true;
}
function interruption(game: Game): BonfireInterruptReason | null {
    const selected = binding(game), active = selected?.state.bonfires?.active;
    if (!active) return null;
    if (game.commandActor.hp <= 0 || game.isGameOver) return 'dead';
    if (active.interrupted) return active.interrupted;
    const source=sources.get(game);
    if(source&&(source.actor!==game.commandActor||source.revision!==actorSourceRevision(game.commandActor)))return 'moved';
    if (game.depth !== active.depth) return 'level-exit';
    if (game.commandActor.x !== active.anchor.x || game.commandActor.y !== active.anchor.y) return 'moved';
    if (game.commandActor.hp < active.startHp) return 'damage';
    if (incapacitated(game) || isActorStaggered(game, game.commandActor.id)) return 'incapacitated';
    const target = game.extensionRuntime!.worldRestTarget(selected!.moduleId, active.bonfireId);
    if (!target || !selected!.state.bonfires!.bindings[String(target.id)]) return 'target-removed';
    if (distanceToFootprint(game.commandActor, target) > target.interactionDistance || !hasInteractionLine(game.grid, game.commandActor.loc, target)) return 'moved';
    if (threat(game)) return 'threat';
    return null;
}
/** Called after ALL due native actors and environment, and again at the terminal
 * command boundary. No UI callback or wall-clock can complete or cancel a rest. */
export function settleWorldRest(game: Game, allowRecovery = true): void {
    const active=binding(game)?.state.bonfires?.active;
    if(!active)return;
    const owner=game.controlledActors.find(a=>a.id===active.actorId);
    const work=()=>owner?withPartyActor(game,owner,()=>settleWorldRestCommitted(game,allowRecovery)):settleWorldRestCommitted(game,allowRecovery);
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
    const checkpoint = actorActionIdentityCheckpoint(selected.state as unknown as Json), hp = game.commandActor.hp, ticks=game.commandActor.ticksUntilTurn;
    try {
        if (!active.interrupted) {
            // Authoritative current capacities, never the values when the dialog opened.
            for(const actor of game.party?game.activeControlledActors:[game.commandActor])withPartyActor(game,actor,()=>{if(definition.restorePolicy.hp==='full')actor.hp=actor.maxHp;restoreActorRestResources(game,definition.restorePolicy);});
            ledger.placements.find(entry => entry.instanceKey === active.instanceKey)!.completedRests++;
        }
        const { startHp: _hp, anchor: _anchor, interrupted, phase: _phase, ...identity } = active;
        ledger.receipts.push({ ...identity, result: interrupted ? 'interrupted' : 'completed', reason: interrupted });
        ledger.receipts.splice(0, Math.max(0, ledger.receipts.length - selected.definition.bonfires!.limits.maxRestReceipts));
        ledger.active = null;
        const row=selected.state.actors.find(row=>row.actorId===active.actorId);
        if(row&&row.poise===0){row.staggerRemainingTicks=selected.definition.breakRecoveryTicks;game.commandActor.ticksUntilTurn=row.staggerRemainingTicks;}
        revision(game);
        if(!interrupted)game.extensionRuntime!.commitCombatEvent(game.commandActor,{eventKind:'rest-completed',actionId:active.actionId,
            sourceSubactionId:null,segmentIndex:null,resolutionId:null,bonfireId:active.bonfireId,visit:active.visit,hitCount:0,hpLost:0});
        logger.log(interrupted
            ? i18next.t('world_rest.interrupted', { defaultValue: 'Your bonfire rest is interrupted; you receive no bonfire recovery.' })
            : i18next.t('world_rest.completed', { defaultValue: 'Your bonfire rest is complete.' }), interrupted ? '#ffaa44' : '#88ccff');
    } catch (error) {
        checkpoint.restore(); game.commandActor.hp = hp;game.commandActor.ticksUntilTurn=ticks;
        invalidateProductionActorActionSession(game);game.invalidateActorActionRun(error instanceof Error?error:new Error(String(error)));
        throw error;
    }
}
