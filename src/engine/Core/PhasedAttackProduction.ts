import { timeSystem } from '../Systems/Time';
import { bindWorldRestSource, finishWorldRestClock, interruptWorldRest, settleWorldRest, worldRestSourceChanged } from './WorldRestProduction';
/** Trusted data-driven executor. Optional content supplies finite definitions only. */
import type { Game, ControlledActionRisk } from './Game';
import type { Creature } from '../../entities/Creature';
import { Monster, MonsterState, monstersAreEnemies } from '../../entities/Monster';
import type { ActorAttackDefinitions, ProductionActorAttackState, ActorAttackFacing, ActorAttackMetadata, ActorAttackDefinition, ActorResourcePolicy } from '../../ext/actorActions';
import { validateActorAttackDefinitions, validateProductionActorAttackState } from '../../ext/actorActionValidation';
import { canonical } from '../../ext/json';
import { projectAttackShape,sourceFootprintVersion,type AttackShapeRequest } from '../Movement/AttackShape';
import { createActorActionBundle,type ActorActionScheduler,type ActorActionBoundary } from './ActorActionScheduler';
import { invalidateProductionActorActionSession } from './ActorActionSession';
import { createProductionActorActionSession, productionActorActionScheduler, notifyProductionActorSourceChanged } from './ActorActionProduction';
import { assertActorActionScope,assertNativeActorDecisionScope,withActorActionScope,type ActorActionScope } from './ActorActionScope';
import { ActorCombatResolutionAuthority } from '../Combat/ActorCombatResolution';
import { actorSourceRevision, spatialOf } from '../Movement/CreatureSpatial';
import { deepFreeze } from '../Movement/SpatialSchema';
import { nativeZoneAttackAvailable } from '../Combat/FixedZoneHealth';
import { blinkAllyFlees, allyShouldPursue, monsterBlinkAvoids } from '../Combat/MonsterBlink';
import { bodySightContact } from '../Combat/BodyPerception';
import { advanceActorResources, chargeActorResources, initialActorResources } from './ActorResources';
import { bindNativeAttackWorld } from './NativeAttackTransaction';
import type { ActorResourcePhase } from '../../ext/actorActions';
import { TerrainType } from '../Map/Grid';
import { resolveCombatStats, combatCapacityPolicy } from '../../ext/combatStats';
import type { ActorCombatStats } from '../../ext/actorActions';
import type { Json, OptionalQueryResult, CombatEventPayload } from '../../ext/types';

type Session={state:ProductionActorAttackState;definitions:ActorAttackDefinitions;scheduler:ActorActionScheduler;runtime:object;moduleId:string;sessionRevision:number;defenseSources:Map<number,{actor:Creature;revision:number;depth:number}>};
const sessions=new WeakMap<Game,Session>();
function combatEvent(game:Game,source:Creature,eventKind:CombatEventPayload['eventKind'],detail:Partial<Omit<CombatEventPayload,'eventKind'>>={}):void {
    game.extensionRuntime?.commitCombatEvent(source,{eventKind,actionId:0,sourceSubactionId:null,segmentIndex:null,
        resolutionId:null,bonfireId:null,visit:null,hitCount:0,hpLost:0,...detail});
}
function committed<T>(game:Game,work:()=>T,eventKinds:readonly CombatEventPayload['eventKind'][]):T {
    return game.extensionRuntime&&sessions.has(game)?game.extensionRuntime.withCommittedFacts(work,eventKinds):work();
}

/** Body rollback retains live defense bindings, independently of the saved ledger. */
export function checkpointPhasedAttackSources(game: Game): () => void {
    const session = sessions.get(game); if (!session) return () => {};
    const entries = [...session.defenseSources];
    return () => { session.defenseSources.clear(); for (const [id, value] of entries) session.defenseSources.set(id, value); };
}
let nextSessionRevision=1;
function bumpRevision(state:ProductionActorAttackState):void {
    if(!Number.isSafeInteger(state.revision)||state.revision>=Number.MAX_SAFE_INTEGER-1)throw new Error('Action revision exhausted');
    state.revision++;
}
const facings:ActorAttackFacing[]=['n','ne','e','se','s','sw','w','nw'];
const actor=(game:Game,id:number):Creature|undefined=>id===game.player.id?game.player:game.monsters.find(m=>m.id===id);
function shapeFor(attack:ActorAttackDefinition,index:number,facing:ActorAttackFacing):AttackShapeRequest {
    const shape=attack.segments[index]!.shape;
    return {schema:1,kind:'footprint-offset-union',offsets:shape.offsets[facing].map(p=>({...p})),selfExclusion:shape.selfExclusion};
}
function cellsFor(game:Game,source:Creature,shape:AttackShapeRequest) {
    const view=game.spatialOf(source);
    const groupCells=source.spatial?.bodyMember?game.monsters.filter(c=>c.hp>0&&c.spatial?.bodyMember?.groupId===view.groupId).flatMap(c=>game.footprintOf(c)):view.cells;
    return projectAttackShape(view,groupCells,shape,{contains:p=>game.grid.isValidPos(p.x,p.y),lineOfEffect:(a,b)=>game.hasLineOfSight(a.x,a.y,b.x,b.y)}).map(p=>({...p}));
}
function eligible(game:Game,source:Creature,session:Session):boolean {
    const owner=source.spatial?.bodyMember?actor(game,source.spatial.bodyMember.groupId):source;
    const slot=source.spatial?.bodyMember?game.bodyGroups?.find(g=>g.coreId===owner?.id)?.members.find(s=>s.entityId===source.id):undefined;
    if (!owner||owner.hp<=0 || source.spatial?.bodyMember && (!(source instanceof Monster) || !game.ownsBodyMember(source) || !slot || slot.readyInTicks>0)) return false;
    if (game.isGameOver||game.interactionActive||source.hp<=0||owner.ticksUntilTurn>0||session.scheduler.isBusy(owner.id)
        || isActorStaggered(game,source.id) || nativeRecovery(session.state.actors.find(row=>row.actorId===source.id))>0
        || (source.spatial?.actionLockInTicks ?? 0) > 0
        ||['paralyzed','entranced','confused'].some(status=>source.hasStatus(status as 'paralyzed'))) return false;
    if (source instanceof Monster && (source.isCaged||source.isDormant||source.deathProcessed
        ||owner instanceof Monster&&(owner.state===MonsterState.ASLEEP||owner.state===MonsterState.FLEEING)
        ||!source.spatial?.bodyMember&&(source.hasBehavior('MONST_IMMOBILE')||source.hasBehavior('MONST_GETS_TURN_ON_ACTIVATION')))) return false;
    return true;
}
function profileId(session:Session,game:Game,source:Creature):string|undefined {
    return source===game.player?session.definitions.playerProfileId:source instanceof Monster?
        session.definitions.nativeProfiles.find(binding=>binding.monsterId===source.typeId)?.profileId:undefined;
}
/** Resource policy is independent of whether the actor has a phased attack profile. */
function capacities(game:Game,source:Creature,base:ActorResourcePolicy):ActorCombatStats|undefined {
    const result=game.extensionRuntime!.queryOptionalActor('growth.combat-stats.v1',source,
        {v:1,baseStaminaCapacity:base.staminaCapacity,basePoiseCapacity:base.poiseCapacity});
    return resolveCombatStats(result);
}
function resourcesFor(game:Game, session:Session, source:Creature, pinnedProfileId?:string) {
    const profile=session.definitions.profiles.find(p=>p.id===(pinnedProfileId??profileId(session,game,source)??session.definitions.playerProfileId))!;
    const base=session.definitions.resourcePolicies.find(p=>p.id===profile.resourcePolicyId)!;
    const stats=capacities(game,source,base),policy=combatCapacityPolicy(base,stats);
    const row=session.state.actors.find(a=>a.actorId===source.id);
    return {profile,base,policy,stats,row};
}
/** First materialization retains the template's initial absolute balances. */
function initialResource(actorId:number,profileId:string,base:ActorResourcePolicy,stats?:ActorCombatStats):ProductionActorAttackState['actors'][number] {
    const policy=combatCapacityPolicy(base,stats),result={actorId,profileId,...initialActorResources(base)};
    result.stamina=Math.min(result.stamina,policy.staminaCapacity);result.poise=Math.min(result.poise,policy.poiseCapacity);
    return {...result,...(stats?{combatStats:stats}:{})};
}
function synchronizeResource(row:ProductionActorAttackState['actors'][number],profile:string,policy:ActorResourcePolicy,stats?:ActorCombatStats):boolean {
    const before=canonical(row);
    if(row.profileId!==profile){
        row.profileId=profile;row.regenRemainder=0;row.regenDelayRemaining=Math.min(row.regenDelayRemaining,policy.regenDelayTicks);
        row.poiseRecoveryRemainder=0;row.poiseRecoveryDelayRemaining=Math.min(row.poiseRecoveryDelayRemaining,policy.poiseRecoveryDelayTicks);
    }
    row.stamina=Math.min(row.stamina,policy.staminaCapacity);row.poise=Math.min(row.poise,policy.poiseCapacity);
    if(stats)row.combatStats={...stats};else delete row.combatStats;
    // Capacity-only changes retain delays, fractional balances and accepted
    // windows. A later real resource tick/payment owns normal full-pool clearing.
    return canonical(row)!==before;
}
/** Candidate-load verification: a decoded, trusted actor world supplies the
 * query. No attach/load/query may normalize or fill a saved resource pool. */
export function validateActorCombatCapacities(state:ProductionActorAttackState,definitions:ActorAttackDefinitions,
    creatures:readonly Creature[],query:(actor:Creature,input:Json)=>OptionalQueryResult):void {
    for(const row of state.actors){
        const source=creatures.find(actor=>actor.id===row.actorId);
        if(!source)throw new Error('Unknown combat resource actor');
        const profile=definitions.profiles.find(profile=>profile.id===row.profileId)!;
        const base=definitions.resourcePolicies.find(policy=>policy.id===profile.resourcePolicyId)!;
        const stats=resolveCombatStats(query(source,{v:1,baseStaminaCapacity:base.staminaCapacity,basePoiseCapacity:base.poiseCapacity}));
        if(canonical(row.combatStats)!==canonical(stats))throw new Error('Stale combat capacity revision');
        const policy=combatCapacityPolicy(base,stats);
        if(row.stamina>policy.staminaCapacity||row.poise>policy.poiseCapacity)throw new Error('Invalid effective combat resource balance');
    }
}
function pay(game:Game,session:Session,source:Creature,cost:number):boolean {
    const {profile,base,policy,stats,row}=resourcesFor(game,session,source);
    if(!row&&session.state.actors.length>=4096)return false;
    const resource=row??initialResource(source.id,profile.id,base,stats);
    // A form can change during a native turn, before settlement/GC. Normalize
    // the old pool against the new policy at this same payment commit.
    const input=resource.profileId===profile.id?resource:{...resource,stamina:Math.min(resource.stamina,policy.staminaCapacity),
        regenRemainder:0,regenDelayRemaining:Math.min(resource.regenDelayRemaining,policy.regenDelayTicks),
        poise:Math.min(resource.poise,policy.poiseCapacity),poiseRecoveryRemainder:0,poiseRecoveryDelayRemaining:Math.min(resource.poiseRecoveryDelayRemaining,policy.poiseRecoveryDelayTicks)};
    const next=chargeActorResources(input,policy,cost);if(!next)return false;
    Object.assign(resource,next);resource.profileId=profile.id;
    if(stats)resource.combatStats={...stats};else delete resource.combatStats;
    if(!row){session.state.actors.push(resource);session.state.actors.sort((a,b)=>a.actorId-b.actorId);}
    bumpRevision(session.state);return true;
}
export function canPayNativeActorAttack(game:Game,actorId:number):boolean {
    bindPhasedAttackProduction(game);
    const session=sessions.get(game),source=actor(game,actorId);if(!session)return true;if(!source||isActorStaggered(game,actorId))return false;
    const {policy,row}=resourcesFor(game,session,source);
    return (!!row||session.state.actors.length<4096)&&Math.min(row?.stamina??policy.initialStamina,policy.staminaCapacity)>=policy.nativeAttackCost;
}
export function chargeNativeActorAttack(game:Game,actorId:number):boolean {
    bindPhasedAttackProduction(game);
    const session=sessions.get(game),source=actor(game,actorId);if(!session)return true;if(!source||isActorStaggered(game,actorId))return false;
    return pay(game,session,source,resourcesFor(game,session,source).policy.nativeAttackCost);
}
/** Source revision cancels protection even after an out-and-back forced move. */
export function isActorDodgeProtected(game:Game,actorId:number):boolean {
    const session=sessions.get(game),source=actor(game,actorId);if(!session||!source)return false;
    const row=session.state.actors.find(r=>r.actorId===actorId),bound=session.defenseSources.get(actorId);
    return !!row&&row.dodgeRemainingTicks>0&&source.hp>0&&!source.hasStatus('paralyzed')&&!source.hasStatus('entranced')
        &&!(source instanceof Monster&&(source.isCaged||source.state===MonsterState.ASLEEP))
        &&!!bound&&bound.actor===source&&bound.depth===game.depth&&bound.revision===actorSourceRevision(source);
}
function advanceResources(game:Game,session:Session,delta:number):void {
    const resolved=new Map<Creature,ReturnType<typeof resourcesFor>>([game.player,...game.monsters].filter(source=>source.hp>0).map(source=>{
        const row=session.state.actors.find(row=>row.actorId===source.id);
        const busy=session.state.scheduler.bundles.some(bundle=>bundle.depth===game.depth&&(bundle.decisionOwnerId===source.id
            ||bundle.subactions.some(child=>child.sourceEntityId===source.id&&child.phaseIndex<child.phases.length)));
        return [source,resourcesFor(game,session,source,busy?row?.profileId:undefined)] as const;
    }));
    const missing=[...resolved].filter(([source,current])=>!(source instanceof Monster&&(source.isDormant||source.deathProcessed))
        &&!current.row&&(current.policy.initialStamina<current.policy.staminaCapacity||!!current.stats)).length;
    if(session.state.actors.length+missing>4096)throw new Error('Actor resource budget exhausted');
    // An implicit initial pool is equivalent to a stored pool. Materialize it
    // when elapsed recovery can change it, including an initially empty NPC.
    for(const source of [game.player,...game.monsters]){
        if(source.hp<=0||(source instanceof Monster&&(source.isDormant||source.deathProcessed)))continue;
        const {profile,base,policy,stats,row}=resolved.get(source)!;
        if(!row&&(policy.initialStamina<policy.staminaCapacity||!!stats)){
            if(session.state.actors.length>=4096)throw new Error('Actor resource budget exhausted');
            session.state.actors.push(initialResource(source.id,profile.id,base,stats));
        }
    }
    session.state.actors.sort((a,b)=>a.actorId-b.actorId);
    for(const row of session.state.actors){
        const source=actor(game,row.actorId);if(!source||source.hp<=0)continue; // Cached layers freeze.
        const bundle=session.state.scheduler.bundles.find(b=>(b.decisionOwnerId===source.id||b.subactions.some(s=>s.sourceEntityId===source.id&&s.phaseIndex<s.phases.length))&&b.depth===game.depth);
        const current=resolved.get(source)!;
        synchronizeResource(row,current.profile.id,current.policy,current.stats);
        const policy=current.policy;
        const phases:ActorResourcePhase[]=bundle?bundle.subactions.filter(s=>s.sourceEntityId===source.id||bundle.decisionOwnerId===source.id).flatMap(s=>s.phases[s.phaseIndex]?[s.phases[s.phaseIndex]!.kind]:[]):[];
        if(!defenseSourceValid(game,session,source)){row.dodgeRemainingTicks=0;row.parryRemainingTicks=0;row.parryFacing=null;}
        // Native status/catch-up clocks may exceed dodge recovery. Split the
        // resource interval so differing idle/recovery policies stay additive.
        const recovery=phases.length?0:Math.min(delta,nativeRecovery(row));
        if(recovery)Object.assign(row,advanceActorResources(row,policy,recovery,[row.staggerRemainingTicks>0?'break-recovery':'recovery']));
        if(delta>recovery)Object.assign(row,advanceActorResources(row,policy,delta-recovery,phases.length?phases:['idle']));
    }
    bumpRevision(session.state);
}
export interface PhasedAttackPlan {
    moduleId:string;sourceEntityId:number;attackId:string;facing:ActorAttackFacing;revision:number;sessionRevision:number;
    sourceVersion:string;facts:string;profileId:string;cost:number;shape:AttackShapeRequest;cells:{x:number;y:number}[];
    risks:ControlledActionRisk[];approvedRisks:{targetId:number;risks:ControlledActionRisk[]}[];
}
function prepare(game:Game,source:Creature,attackId:string,facing:ActorAttackFacing):PhasedAttackPlan|null {
    const session=sessions.get(game); if (!session||!eligible(game,source,session)) return null;
    const profile=session.definitions.profiles.find(p=>p.id===profileId(session,game,source));
    const attack=session.definitions.attacks.find(a=>a.id===attackId);
    if (!profile||!attack||!profile.attackIds.includes(attackId)||!facings.includes(facing)||!nativeZoneAttackAvailable(source,attackId)) return null;
    const {policy}=resourcesFor(game,session,source);
    const resource=session.state.actors.find(a=>a.actorId===source.id);
    if (Math.min(resource?.stamina??policy.initialStamina,policy.staminaCapacity)<attack.cost || (!resource && session.state.actors.length>=4096)) return null;
    const shape=shapeFor(attack,0,facing),cells=cellsFor(game,source,shape);
    const approvedRisks:PhasedAttackPlan['approvedRisks']=[];
    if(source===game.player) {
        const allCells=attack.segments.flatMap((_,index)=>cellsFor(game,source,shapeFor(attack,index,facing)));
        for(const target of game.collectBodyTargets(allCells,{effect:'area-damage'},new Set())) {
            if(target.entity===source || approvedRisks.some(approval => approval.targetId === target.entityId)) continue;
            const risks=game.prepareActorAttackRisks(source.id,[target.contact]).filter(risk=>risk.target.kind==='creature'&&risk.target.id===target.entity.id);
            approvedRisks.push({targetId:target.entity.id,risks:structuredClone(risks) as ControlledActionRisk[]});
        }
    }
    return deepFreeze({moduleId:session.moduleId,sessionRevision:session.sessionRevision,sourceEntityId:source.id,attackId,facing,revision:session.state.revision,
        sourceVersion:sourceFootprintVersion(game.spatialOf(source)),profileId:profile.id,cost:attack.cost,shape,cells,
        facts:canonical({resource:resource??null,capacities:capacities(game,source,session.definitions.resourcePolicies.find(p=>p.id===profile.resourcePolicyId)!)??null,weapon:game.player.equippedWeapon,armor:game.player.equippedArmor,depth:game.depth,grid:game.grid.width,sourceHp:source.hp,status:source.statusDurations,
            actors:[game.player,...game.monsters].map(a=>({id:a.id,form:a instanceof Monster?a.typeId:'player',hp:a.hp,loc:a.loc,sourceRevision:actorSourceRevision(a),status:a.statusDurations,spatial:sourceFootprintVersion(game.spatialOf(a)),...(a.spatial?.zoneState?{zones:a.spatial.zoneState}:{})}))}),
        risks:approvedRisks.flatMap(target=>target.risks),approvedRisks});
}
function commit(game:Game,plan:PhasedAttackPlan,scope:ActorActionScope):boolean {
    const session=sessions.get(game),source=actor(game,plan.sourceEntityId);
    if (!session||!source||session.runtime!==game.extensionRuntime) throw new Error('Stale phased attack session');
    assertActorActionScope(scope,game,source.id,source===game.player?'player-command':'npc-scheduler');
    if(source!==game.player)assertNativeActorDecisionScope(scope,game,source.id);
    const current=prepare(game,source,plan.attackId,plan.facing);
    if(!current||canonical(current)!==canonical(plan))throw new Error('Stale phased attack preparation');
    const {state,definitions}=session,attack=definitions.attacks.find(a=>a.id===plan.attackId)!;
    if(state.nextActionId>=Number.MAX_SAFE_INTEGER||state.revision>=Number.MAX_SAFE_INTEGER-1)throw new Error('Phased attack identity exhausted');
    const profile=definitions.profiles.find(p=>p.id===plan.profileId)!;
    const bundle=createActorActionBundle({actionId:state.nextActionId,depth:game.depth,decisionOwnerId:source.id,timeChargeOwnerId:source.id,
        subactions:[{sourceEntityId:source.id,sourcePartId:game.spatialOf(source).partId??'body',sourceFootprintVersion:plan.sourceVersion,
            phases:[{kind:'windup',durationTicks:attack.windupTicks,segmentIndex:0},...attack.segments.slice(1).map((segment,index)=>({kind:'inter-segment' as const,durationTicks:segment.delayTicks,segmentIndex:index+1})),
                {kind:'recovery',durationTicks:attack.recoveryTicks,segmentIndex:null}]}]});
    const metadata:ActorAttackMetadata={actionId:bundle.actionId,profileId:profile.id,paidCost:attack.cost,subactions:[{
        sourceSubactionId:1,attackId:attack.id,facing:plan.facing,shape:structuredClone(plan.shape),lockedCells:structuredClone(plan.cells),approvedRisks:structuredClone(plan.approvedRisks)}]};
    const before=structuredClone(state);
    try {
        if(!pay(game,session,source,attack.cost))throw new Error('Insufficient action stamina');
        state.nextActionId++;state.actions.push(metadata);
        session.scheduler.commitBundle(bundle);
    }catch(error){
        Object.assign(state,before);
        invalidateProductionActorActionSession(game);
        game.invalidateActorActionRun(error instanceof Error?error:new Error(String(error)));
        throw error;
    }
    game.extensionRuntime?.notifyCommittedAction({actorId:source.id,action:'attack'});
    return true;
}
/** One core decision, independent source payments and scopes, one max-duration
 * bundle. All sources are revalidated before the first mechanical write. */
function commitBody(game:Game,core:Monster,plans:readonly PhasedAttackPlan[],scope:ActorActionScope):void {
    const session=sessions.get(game)!;
    assertNativeActorDecisionScope(scope,game,core.id);
    if (!plans.length||plans.length>4||!plans.every(plan=>{
        const source=actor(game,plan.sourceEntityId);
        return source?.spatial?.bodyMember?.groupId===core.id&&canonical(prepare(game,source,plan.attackId,plan.facing))===canonical(plan);
    })) throw new Error('Stale composite attack preparation');
    const group=game.bodyGroups!.find(g=>g.coreId===core.id)!,{state,definitions}=session;
    if(state.nextActionId>=Number.MAX_SAFE_INTEGER||state.revision>=Number.MAX_SAFE_INTEGER-6)throw new Error('Phased attack identity exhausted');
    const bundle=createActorActionBundle({actionId:state.nextActionId,depth:game.depth,decisionOwnerId:core.id,timeChargeOwnerId:core.id,
        subactions:plans.map(plan=>{const attack=definitions.attacks.find(a=>a.id===plan.attackId)!;
            return {sourceEntityId:plan.sourceEntityId,sourcePartId:game.spatialOf(actor(game,plan.sourceEntityId)!).partId!,sourceGeneration:0,sourceFootprintVersion:plan.sourceVersion,
                phases:[{kind:'windup' as const,durationTicks:attack.windupTicks+attack.segments[0]!.delayTicks,segmentIndex:0},
                    ...attack.segments.slice(1).map((segment,index)=>({kind:'inter-segment' as const,durationTicks:segment.delayTicks,segmentIndex:index+1})),
                    {kind:'recovery' as const,durationTicks:attack.recoveryTicks,segmentIndex:null}]};})});
    const own=resourcesFor(game,session,core),missing=new Set([core.id,...plans.map(p=>p.sourceEntityId)].filter(id=>!state.actors.some(r=>r.actorId===id)));
    if(state.actors.length+missing.size>4096)throw new Error('Actor resource budget exhausted');
    const metadata:ActorAttackMetadata={actionId:bundle.actionId,profileId:own.profile.id,paidCost:plans.reduce((n,p)=>n+p.cost,0),
        subactions:bundle.subactions.map(child=>{const plan=plans.find(p=>p.sourceEntityId===child.sourceEntityId)!;
            return {sourceSubactionId:child.sourceSubactionId,profileId:plan.profileId,attackId:plan.attackId,facing:plan.facing,
                shape:structuredClone(plan.shape),lockedCells:structuredClone(plan.cells),approvedRisks:[]};})};
    const before=structuredClone(state),cooldowns=group.members.map(s=>s.readyInTicks);
    try {
        if(!own.row)state.actors.push(initialResource(core.id,own.profile.id,own.base,own.stats));
        for(const plan of plans)if(!pay(game,session,actor(game,plan.sourceEntityId)!,plan.cost))throw new Error('Insufficient source stamina');
        state.actors.sort((a,b)=>a.actorId-b.actorId);
        state.nextActionId++;state.actions.push(metadata);
        session.scheduler.commitBundle(bundle);
        for(const child of bundle.subactions)group.members.find(s=>s.entityId===child.sourceEntityId)!.readyInTicks=
            child.phases.reduce((sum,phase)=>sum+phase.durationTicks,0);
    }catch(error){Object.assign(state,before);group.members.forEach((s,i)=>{s.readyInTicks=cooldowns[i]!;});
        invalidateProductionActorActionSession(game);game.invalidateActorActionRun(error instanceof Error?error:new Error(String(error)));throw error;}
    for(const plan of plans)game.extensionRuntime!.notifyCommittedAction({actorId:plan.sourceEntityId,action:'attack'});
}
function selectBody(game:Game,session:Session,core:Monster,scope:ActorActionScope):'handled'|'native-fallback' {
    if(!eligible(game,core,session)||core.hasStatus('confused')||core.hasStatus('magical_fear')||core.state!==MonsterState.HUNTING&&!core.isAlly)return 'native-fallback';
    const group=game.bodyGroups!.find(g=>g.coreId===core.id)!,plans:PhasedAttackPlan[]=[];
    const targets=[game.player,...game.monsters].filter(target=>target.hp>0&&target.spatial?.bodyMember?.groupId!==core.id&&monstersAreEnemies(core,target));
    targets.sort((a,b)=>game.nearestContact(core,a).distance-game.nearestContact(core,b).distance||a.id-b.id);
    for(const slot of [...group.members].sort((a,b)=>a.partId<b.partId?-1:a.partId>b.partId?1:0)){
        if(plans.length===4)break;
        const source=actor(game,slot.entityId??0);if(!source||slot.life!=='active'||!eligible(game,source,session))continue;
        const profile=session.definitions.profiles.find(p=>p.id===profileId(session,game,source));if(!profile)continue;
        for(const target of targets){
            if(!bodySightContact(game.grid,source,target,(x,y,tx,ty)=>game.hasLineOfSight(x,y,tx,ty)))continue;
            const contact=game.nearestContact(source,target);if(!contact)continue;
            const dx=Math.sign(contact.to.x-contact.from.x),dy=Math.sign(contact.to.y-contact.from.y);
            const facing=facings.find(f=>directionVectors[f].x===dx&&directionVectors[f].y===dy);if(!facing)continue;
            const plan=profile.attackIds.map(id=>prepare(game,source,id,facing)).find(plan=>plan&&game.collectBodyTargets(plan.cells,{effect:'area-damage'},new Set()).some(hit=>hit.entity===target));
            if(plan){plans.push(plan);break;}
        }
    }
    if(!plans.length)return 'native-fallback';commitBody(game,core,plans,scope);return 'handled';
}
function resolve(game:Game,session:Session,boundary:Readonly<ActorActionBoundary>):void {
    committed(game,()=>resolveCommitted(game,session,boundary),['attack-resolved','staggered','parried']);
}
function resolveCommitted(game:Game,session:Session,boundary:Readonly<ActorActionBoundary>):void {
    const source=actor(game,boundary.sourceEntityId),metadata=session.state.actions.find(a=>a.actionId===boundary.actionId);
    const sub=metadata?.subactions.find(s=>s.sourceSubactionId===boundary.sourceSubactionId);
    if(!source||!sub)return;
    const attack=session.definitions.attacks.find(a=>a.id===sub.attackId)!,segment=attack.segments[boundary.segmentIndex]!;
    const bundle=session.state.scheduler.bundles.find(b=>b.actionId===boundary.actionId)!,child=bundle.subactions.find(s=>s.sourceSubactionId===boundary.sourceSubactionId)!;
    const authority=new ActorCombatResolutionAuthority(game,{schema:1,nextResolutionId:1,actors:[]},{production:true,dodgeProtected:id=>isActorDodgeProtected(game,id),tryParry:(a,d,c)=>tryActorParry(game,a,d,c),poiseDamage:segment.poiseDamage});
    const plans=authority.prepareLockedBodySegment({kind:'locked-body-segment',depth:boundary.depth,sourceEntityId:source.id,
        sourceFootprintVersion:child.sourceFootprintVersion,shape:sub.shape,lockedCells:sub.lockedCells,
        approvedRisks:sub.approvedRisks,dodgeable:segment.dodgeable,parryable:segment.parryable});
    let hitCount=0,hpLost=0;
    withActorActionScope(game,source===game.player?'player-command':'npc-scheduler',source.id,scope=>{
        for(const plan of plans){
            if(source.hp<=0||game.isGameOver||isActorStaggered(game,source.id))break;
            const target=actor(game,plan.intent.targetEntityId);
            const healthOwners=[...new Set([target,target?.spatial?.bodyMember?actor(game,target.spatial.bodyMember.groupId):undefined])]
                .filter((value):value is Creature=>!!value).map(actor=>({actor,hp:actor.hp}));
            const result=authority.commitNativeMelee(scope,plan);
            if(result?.kind==='native'&&result.attack.hit)hitCount++;
            hpLost=Math.min(1_000_000,hpLost+healthOwners.reduce((sum,{actor,hp})=>sum+Math.max(0,hp-actor.hp),0));
        }
    });
    if(boundary.segmentIndex+1<attack.segments.length&&source.hp>0&&!isActorStaggered(game,source.id)&&sourceFootprintVersion(game.spatialOf(source))===child.sourceFootprintVersion){
        sub.shape=shapeFor(attack,boundary.segmentIndex+1,sub.facing);sub.lockedCells=cellsFor(game,source,sub.shape);
    }else sub.lockedCells=[];
    combatEvent(game,source,'attack-resolved',{actionId:boundary.actionId,sourceSubactionId:boundary.sourceSubactionId,
        segmentIndex:boundary.segmentIndex,hitCount,hpLost});
}
export function bindPhasedAttackProduction(game:Game):void {
    bindNativeAttackWorld(game);
    const binding=game.extensionRuntime?.actorActionBinding();
    if(!binding){sessions.delete(game);return;}
    if((sessions.get(game)?.state as unknown)===binding.state && productionActorActionScheduler(game)===sessions.get(game)?.scheduler)return;
    validateActorAttackDefinitions(binding.definition);validateProductionActorAttackState(binding.state,binding.definition);
    const session={state:binding.state,definitions:binding.definition,runtime:game.extensionRuntime!,moduleId:binding.moduleId,sessionRevision:nextSessionRevision++,defenseSources:new Map()} as unknown as Session;
    session.scheduler=createProductionActorActionSession(game,{state:session.state.scheduler,
        resolveSegment:boundary=>resolve(game,session,boundary),breakRecoveryTicks:()=>session.definitions.breakRecoveryTicks,
        elapsed:delta=>{if(session.state.bonfires?.active?.phase==='resting')timeSystem.currentTick+=delta;advanceResources(game,session,delta);},
        handlesInterruption:bundle=>session.state.bonfires?.active?.actionId===bundle.actionId,
        inputLocked:()=>session.state.actors.some(row=>row.actorId===game.player.id&&nativeRecovery(row)>0),
        resumeResources:()=>{for(const row of session.state.actors){const source=actor(game,row.actorId);if(source&&nativeRecovery(row)>0)source.ticksUntilTurn=nativeRecovery(row);}},
        sourceChanged:id=>{worldRestSourceChanged(game,id);const row=session.state.actors.find(r=>r.actorId===id);if(row&&(row.dodgeRemainingTicks||row.parryRemainingTicks)){row.dodgeRemainingTicks=0;row.parryRemainingTicks=0;row.parryFacing=null;bumpRevision(session.state);}
            if(!actor(game,id)||actor(game,id)!.hp<=0)for(const bundle of session.state.scheduler.bundles)
                for(const child of bundle.subactions)if(child.sourceEntityId===id){const sub=session.state.actions.find(a=>a.actionId===bundle.actionId)?.subactions.find(s=>s.sourceSubactionId===child.sourceSubactionId);if(sub)sub.lockedCells=[];}},
        leftDepth:()=>{interruptWorldRest(game,'level-exit');settleWorldRest(game);bumpRevision(session.state);for(const row of session.state.actors){row.dodgeRemainingTicks=0;row.parryRemainingTicks=0;row.parryFacing=null;}},
        interrupted:(source,bundle,reason)=>{bumpRevision(session.state);const metadata=session.state.actions.find(a=>a.actionId===bundle.actionId);if(metadata&&reason==='layer-change')metadata.suppressTerminalSweep=true;const sub=metadata?.subactions.find(s=>s.sourceSubactionId===source.sourceSubactionId);if(sub)sub.lockedCells=[];},
        shouldSweep:bundle=>!session.state.actions.find(action=>action.actionId===bundle.actionId)?.suppressTerminalSweep,
        finishAction:(bundle,reason)=>{if(finishWorldRestClock(game,bundle,reason))return;const row=session.state.actors.find(row=>row.actorId===bundle.decisionOwnerId);
            if(row&&row.poise===0&&bundle.subactions.some(child=>child.phases.some(phase=>phase.kind==='break-recovery'))){const source=actor(game,row.actorId);if(source){const policy=resourcesFor(game,session,source).policy;row.poise=policy.poiseBreakRecoveryValue;row.poiseRecoveryRemainder=0;}}bumpRevision(session.state);session.state.actions=session.state.actions.filter(a=>a.actionId!==bundle.actionId);},
        select:(id,scope)=>{
            const source=actor(game,id);if(!(source instanceof Monster)||!eligible(game,source,session))return 'native-fallback';
            if(source.spatial?.bodyMember)return selectBody(game,session,source,scope);
            // Native survival, corpse learning and spells keep their existing priority.
            if (source.bolts.length || source.hasAbility('MA_CAST_SUMMON') || source.targetCorpseLoc
                || source.hasStatus('magical_fear') || (!source.isAlly && source.state!==MonsterState.HUNTING)
                || game.footprintOf(source).some(cell=>monsterBlinkAvoids(game,source,cell))) return 'native-fallback';
            const profile=session.definitions.profiles.find(p=>p.id===profileId(session,game,source));if(!profile)return 'native-fallback';
            const targets=source.isAlly?game.monsters.filter(target=>target!==source&&monstersAreEnemies(source,target)):[game.player];
            const target=targets.find(target=>target.hp>0&&bodySightContact(game.grid,source,target,(x,y,tx,ty)=>game.hasLineOfSight(x,y,tx,ty)));if(!target)return 'native-fallback';
            if (source.isAlly && target instanceof Monster && (blinkAllyFlees(game,source,target) || !allyShouldPursue(game,source,target))) return 'native-fallback';
            const dx=Math.sign(target.loc.x-source.loc.x),dy=Math.sign(target.loc.y-source.loc.y);
            const facing=({'0,-1':'n','1,-1':'ne','1,0':'e','1,1':'se','0,1':'s','-1,1':'sw','-1,0':'w','-1,-1':'nw'} as Record<string,ActorAttackFacing>)[`${dx},${dy}`];
            if(!facing)return 'native-fallback';
            // Only visible, already committed telegraphs inform defense. Stable
            // action/source order and no random draw; no future player input.
            for(const bundle of [...session.state.scheduler.bundles].sort((a,b)=>a.decisionOwnerId-b.decisionOwnerId)){
                const threat=actor(game,bundle.decisionOwnerId);
                if(!threat||threat===source||!(threat===game.player?!source.isAlly:threat instanceof Monster&&monstersAreEnemies(source,threat)))continue;
                if(!bodySightContact(game.grid,source,threat,(x,y,tx,ty)=>game.hasLineOfSight(x,y,tx,ty)))continue;
                const contact=game.meleeContact(threat,source);if(!contact)continue;
                const metadata=session.state.actions.find(action=>action.actionId===bundle.actionId);
                const imminent=bundle.subactions.some(child=>{
                    const phase=child.phases[child.phaseIndex],sub=metadata?.subactions.find(sub=>sub.sourceSubactionId===child.sourceSubactionId);
                    if(!phase||phase.segmentIndex===null||phase.durationTicks<=0||child.phaseRemainingTicks<=0||child.phaseRemainingTicks>=session.definitions.parry.windowTicks||!sub)return false;
                    const segment=session.definitions.attacks.find(attack=>attack.id===sub.attackId)?.segments[phase.segmentIndex];
                    return segment?.parryable&&sub.lockedCells.some(cell=>game.footprintOf(source).some(own=>own.x===cell.x&&own.y===cell.y));
                });
                if(!imminent)continue;
                const defenseFacing=facings.find(face=>directionVectors[face].x===Math.sign(contact.from.x-contact.to.x)&&directionVectors[face].y===Math.sign(contact.from.y-contact.to.y));
                const plan=defenseFacing&&prepareActorParry(game,source.id,defenseFacing);
                if(plan){commitActorParry(game,plan,scope);return 'handled';}
            }
            for(const attackId of profile.attackIds){const plan=prepare(game,source,attackId,facing);if(!plan)continue;
                if(!game.collectBodyTargets(plan.cells,{effect:'area-damage'},new Set()).some(hit=>hit.entity===target))continue;
                commit(game,plan,scope);return 'handled';}
            return 'native-fallback';
        }});
    sessions.set(game,session);
    bindWorldRestSource(game);
    for(const row of session.state.actors){const source=actor(game,row.actorId);if(source&&(row.dodgeRemainingTicks||row.parryRemainingTicks))session.defenseSources.set(source.id,{actor:source,revision:actorSourceRevision(source),depth:game.depth});}
}
/** Whole-body sources use every zone; targets use only pending locked cells. */
export function cancelPhasedAttacksAtZone(game: Game, target: Creature, zoneId: string, defer = false): void {
    const session = sessions.get(game); if (!session) return;
    reconcileActorNativeRecovery(game,target.id);
    const cells = new Set(game.footprintOf(target).filter(p => p.zoneId === zoneId).map(p => `${p.x},${p.y}`));
    const sources = new Set<number>([target.id]);
    for (const bundle of session.state.scheduler.bundles) {
        const metadata = session.state.actions.find(a => a.actionId === bundle.actionId);
        for (const child of bundle.subactions) {
            const sub = metadata?.subactions.find(s => s.sourceSubactionId === child.sourceSubactionId);
            if (sub?.lockedCells.some(p => cells.has(`${p.x},${p.y}`))) sources.add(child.sourceEntityId);
        }
    }
    for (const id of sources) notifyProductionActorSourceChanged(game, id, defer);
}
export function isPhasedAttackCommand(game:Game,data:unknown):boolean {
    if(typeof data!=='string')return false;
    try{const input=JSON.parse(data),binding=game.extensionRuntime?.actorActionBinding();return !!binding&&input.module===binding.moduleId&&input.action==='attack';}catch{return false;}
}
export function preparePhasedAttackCommand(game:Game,data:unknown):PhasedAttackPlan|null {
    bindPhasedAttackProduction(game);
    if(typeof data!=='string')throw new Error('Invalid phased attack command');
    const input=JSON.parse(data);
    if(Object.keys(input).sort().join(',')!=='action,module,payload'||!isPhasedAttackCommand(game,data)
        ||!input.payload||Object.keys(input.payload).sort().join(',')!=='attackId,facing'
        ||typeof input.payload.attackId!=='string'||!facings.includes(input.payload.facing))throw new Error('Invalid phased attack input');
    return prepare(game,game.player,input.payload.attackId,input.payload.facing);
}
export function commitPhasedAttackCommand(game:Game,plan:PhasedAttackPlan):boolean {
    return withActorActionScope(game,'player-command',game.player.id,scope=>commit(game,plan,scope));
}

/** Safe-boundary GC never pins dead or observation-only actors. */
export function collectPhasedAttackActors(game:Game,reachable:readonly Creature[]):void {
    const session=sessions.get(game);if(!session)return;
    const keep=new Set(reachable.filter(actor=>actor.hp>0||actor===game.player).map(actor=>actor.id));
    const resolved=new Map(reachable.filter(source=>keep.has(source.id)).map(source=>{
        const row=session.state.actors.find(row=>row.actorId===source.id);
        const busy=session.state.scheduler.bundles.some(bundle=>bundle.decisionOwnerId===source.id
            ||bundle.subactions.some(child=>child.sourceEntityId===source.id&&child.phaseIndex<child.phases.length));
        return [source,resourcesFor(game,session,source,busy?row?.profileId:undefined)] as const;
    }));
    const missing=[...resolved].filter(([source,current])=>source.hp>0&&!!current.stats&&!current.row).length;
    if(session.state.actors.filter(row=>keep.has(row.actorId)).length+missing>4096)throw new Error('Actor resource budget exhausted');
    session.state.actors=session.state.actors.filter(row=>keep.has(row.actorId));
    for(const source of reachable){
        if(source.hp<=0||session.state.actors.some(row=>row.actorId===source.id))continue;
        const current=resolved.get(source)!;
        if(!current.stats)continue;
        if(session.state.actors.length>=4096)throw new Error('Actor resource budget exhausted');
        session.state.actors.push(initialResource(source.id,current.profile.id,current.base,current.stats));
        bumpRevision(session.state);
    }
    session.state.actors.sort((a,b)=>a.actorId-b.actorId);
    for (const row of session.state.actors) {
        if(row.dodgeRemainingTicks&&!isActorDodgeProtected(game,row.actorId))row.dodgeRemainingTicks=0;
        const source=reachable.find(actor=>actor.id===row.actorId);
        if(row.parryRemainingTicks&&(!source||!defenseSourceValid(game,session,source))){row.parryRemainingTicks=0;row.parryFacing=null;}
        if(source&&source.hp<=0){row.dodgeRemainingTicks=0;row.dodgeRecoveryRemainingTicks=0;row.parryRemainingTicks=0;row.parryFacing=null;row.parryRecoveryRemainingTicks=0;row.staggerRemainingTicks=0;row.poise=resourcesFor(game,session,source).policy.poiseBreakRecoveryValue;row.poiseRecoveryRemainder=0;}
        if(!source)continue;
        const current=resolved.get(source)!;
        if(synchronizeResource(row,current.profile.id,current.policy,current.stats))bumpRevision(session.state);
    }
}
/** Administrative retirement removes the source's ledger only after its child
 * is inert. An indivisible resolver may defer that cancellation to its return. */
export function retirePhasedAttackSource(game:Game,id:number):void {
    const session=sessions.get(game);if(!session||session.state.scheduler.bundles.some(bundle=>bundle.subactions.some(child=>child.sourceEntityId===id&&child.phaseIndex<child.phases.length)))return;
    if(session.state.actors.some(row=>row.actorId===id)){session.state.actors=session.state.actors.filter(row=>row.actorId!==id);bumpRevision(session.state);}
    session.defenseSources.delete(id);
}

/** Candidate-world geometry validation ignores current occlusion (a wall may
 * legitimately have appeared since warning), but rejects invented/off-map cells. */
export function validatePhasedAttackGeometry(state:ProductionActorAttackState, definitions:ActorAttackDefinitions, creatures:readonly Creature[], contains:(depth:number,x:number,y:number)=>boolean,activeActorIds?:ReadonlySet<number>):void {
    const actors=new Map(creatures.map(actor=>[actor.id,actor]));
    for(const row of state.actors){
        const source=actors.get(row.actorId);
        if(row.parryRemainingTicks>0&&(!source||source.hp<=0||source.hasStatus('paralyzed')||source.hasStatus('entranced')
            ||(source instanceof Monster&&(source.isCaged||source.state===MonsterState.ASLEEP))
            ||(activeActorIds&&!activeActorIds.has(row.actorId))))throw new Error('Invalid parry source');
        if((row.parryRecoveryRemainingTicks>0||row.staggerRemainingTicks>0)&&(!source||source.hp<=0||source.ticksUntilTurn!==nativeRecovery(row)))throw new Error('Invalid defense recovery mirror');
        if(row.dodgeRemainingTicks>0&&activeActorIds&&!activeActorIds.has(row.actorId))throw new Error('Cached actor retains dodge protection');
        if(row.dodgeRecoveryRemainingTicks>0 && (!source||source.hp<=0||source.ticksUntilTurn!==row.dodgeRecoveryRemainingTicks||!dodgeBodySupported(source)))throw new Error('Invalid dodge recovery mirror');
    }
    for(const bundle of state.scheduler.bundles) {
        const metadata=state.actions.find(action=>action.actionId===bundle.actionId);
        if(state.bonfires?.active?.actionId===bundle.actionId) {
            const rest=state.bonfires.active,source=actors.get(rest.actorId);
            if(rest.phase!=='resting'||!source||source.hp<=0||source.loc.x!==rest.anchor.x||source.loc.y!==rest.anchor.y
                ||bundle.subactions[0]!.sourceFootprintVersion!==sourceFootprintVersion(spatialOf(source))
                ||bundle.subactions[0]!.sourcePartId!==(spatialOf(source).partId??'body')
                || source.hp<rest.startHp && !rest.interrupted || rest.actorId!==bundle.decisionOwnerId
                || (activeActorIds&&!activeActorIds.has(rest.actorId)))throw new Error('Invalid rest source');
            continue;
        }
        if(!metadata)throw new Error('Missing action metadata');
        for(const child of bundle.subactions) {
            const sub=metadata.subactions.find(sub=>sub.sourceSubactionId===child.sourceSubactionId),source=actors.get(child.sourceEntityId);
            if(!sub)throw new Error('Invalid action source metadata');
            if(child.cancelled&&child.phaseIndex===child.phases.length){if(sub.lockedCells.length)throw new Error('Retired source retains attack cells');continue;}
            if(!source)throw new Error('Invalid action source metadata');
            const pending=child.phases.slice(child.phaseIndex).some(phase=>phase.segmentIndex!==null);
            const expected=source instanceof Monster?definitions.nativeProfiles.find(binding=>binding.monsterId===source.typeId)?.profileId:definitions.playerProfileId;
            if(pending && (expected!==(sub.profileId??metadata.profileId) || source.hasStatus('paralyzed') || source.hasStatus('entranced') || (source instanceof Monster && source.isCaged)))
                throw new Error('Invalid pending source profile or eligibility');
            if(!sub.lockedCells.length)continue;
            const footprint=spatialOf(source).cells, own=new Set(footprint.map(cell=>`${cell.x},${cell.y}`));
            const legal=new Set(footprint.flatMap(from=>sub.shape.offsets.map(offset=>`${from.x+offset.x},${from.y+offset.y}`)));
            if(sub.lockedCells.some(cell=>!contains(bundle.depth,cell.x,cell.y)||own.has(`${cell.x},${cell.y}`)||!legal.has(`${cell.x},${cell.y}`)))
                throw new Error('Invalid locked action geometry');
        }
    }
}


const directionVectors:Record<ActorAttackFacing,{x:number;y:number}>={n:{x:0,y:-1},ne:{x:1,y:-1},e:{x:1,y:0},se:{x:1,y:1},s:{x:0,y:1},sw:{x:-1,y:1},w:{x:-1,y:0},nw:{x:-1,y:-1}};
export interface ActorDodgePlan {
    moduleId:string;sourceEntityId:number;facing:ActorAttackFacing;to:{x:number;y:number};
    revision:number;sessionRevision:number;sourceRevision:number;facts:string;risks:ControlledActionRisk[];
}
/** Keep this capability gate even when broader foundation bodies are enabled. */
function dodgeBodySupported(source:Creature):boolean {
    const body=source.spatial;
    return !body || (['builtin:single','builtin:square-2','builtin:square-3'].includes(body.footprintId)
        && body.pose==='r0' && Object.keys(body).every(key=>['schema','footprintId','pose','movementRegionId'].includes(key)));
}
export function prepareActorDodge(game:Game,sourceId:number,facing:ActorAttackFacing):ActorDodgePlan|null {
    bindPhasedAttackProduction(game);
    const session=sessions.get(game),source=actor(game,sourceId);
    if(!session||!source||!facings.includes(facing)||!dodgeBodySupported(source)||!eligible(game,source,session)
        ||source.hasStatus('stuck')||source.hasStatus('nauseous'))return null;
    const {row,policy,stats}=resourcesFor(game,session,source),dodge=session.definitions.dodge;
    if((!row&&session.state.actors.length>=4096)||Math.min(row?.stamina??policy.initialStamina,policy.staminaCapacity)<dodge.cost
        ||(row?.dodgeRecoveryRemainingTicks??0)>0)return null;
    const direction=directionVectors[facing],to={x:source.x+direction.x,y:source.y+direction.y};
    if(!game.canActorDodgeStep(source,to))return null;
    const cells=game.footprintOf(source).map(p=>({x:p.x+direction.x,y:p.y+direction.y}));
    if(cells.some(p=>game.grid.getCell(p.x,p.y)!.layers.some(t=>[TerrainType.STAIRS_UP,TerrainType.STAIRS_DOWN,TerrainType.DUNGEON_PORTAL,TerrainType.ALTAR].includes(t))))return null;
    const movement=game.prepareActorDodgeRisks(source.id,to);if(movement.certainDeath)return null;
    return deepFreeze({moduleId:session.moduleId,sourceEntityId:source.id,facing,to,revision:session.state.revision,
        sessionRevision:session.sessionRevision,sourceRevision:actorSourceRevision(source),risks:structuredClone(movement.risks),
        facts:canonical({row:row??null,policy,combatStats:stats??null,hp:source.hp,status:source.statusDurations,depth:game.depth,
            footprint:sourceFootprintVersion(game.spatialOf(source)),cells:cells.map(p=>game.grid.getCell(p.x,p.y)?.layers)})});
}
/** Caller supplies only a trusted synchronous authority, never a module callback. */
export function commitActorDodge(game:Game,plan:ActorDodgePlan,scope:ActorActionScope):boolean {
    const session=sessions.get(game),source=actor(game,plan.sourceEntityId);
    if(!session||!source||session.runtime!==game.extensionRuntime)throw new Error('Stale dodge session');
    assertActorActionScope(scope,game,source.id,source===game.player?'player-command':'npc-scheduler');
    if(source!==game.player)assertNativeActorDecisionScope(scope,game,source.id);
    const current=prepareActorDodge(game,source.id,plan.facing);
    if(!current||canonical(current)!==canonical(plan))throw new Error('Stale dodge preparation');
    if(!pay(game,session,source,session.definitions.dodge.cost))return false;
    const row=session.state.actors.find(r=>r.actorId===source.id)!;
    // Accepted resource, relocation and window are one synchronous commit. Native
    // entry effects follow; they never inherit physical dodge immunity.
    try {
        game.commitActorDodgePosition(scope,source.id,plan.to);
        row.dodgeRemainingTicks=session.definitions.dodge.windowTicks;
        row.dodgeRecoveryRemainingTicks=session.definitions.dodge.recoveryTicks;
        source.ticksUntilTurn=session.definitions.dodge.recoveryTicks;
        session.defenseSources.set(source.id,{actor:source,revision:actorSourceRevision(source),depth:game.depth});
        game.finishActorDodgeEntry(scope,source.id);
        game.extensionRuntime?.notifyCommittedAction({actorId:source.id,action:'move'});
    }catch(error){invalidateProductionActorActionSession(game);game.invalidateActorActionRun(error instanceof Error?error:new Error(String(error)));throw error;}
    return true;
}
export function isActorDodgeCommand(game:Game,data:unknown):boolean {
    if(typeof data!=='string')return false;
    try{const input=JSON.parse(data),binding=game.extensionRuntime?.actorActionBinding();return !!binding&&input.module===binding.moduleId&&input.action==='dodge';}catch{return false;}
}
export function prepareActorDodgeCommand(game:Game,data:unknown):ActorDodgePlan|null {
    if(typeof data!=='string')throw new Error('Invalid dodge command');
    const input=JSON.parse(data);
    if(Object.keys(input).sort().join(',')!=='action,module,payload'||!isActorDodgeCommand(game,data)
        ||!input.payload||Object.keys(input.payload).join(',')!=='facing'||!facings.includes(input.payload.facing))throw new Error('Invalid dodge input');
    return prepareActorDodge(game,game.player.id,input.payload.facing);
}
export function commitActorDodgeCommand(game:Game,plan:ActorDodgePlan):boolean {
    return withActorActionScope(game,'player-command',game.player.id,scope=>commitActorDodge(game,plan,scope));
}

function nativeRecovery(row:ProductionActorAttackState['actors'][number]|undefined):number {
    return row?Math.max(row.dodgeRecoveryRemainingTicks,row.parryRecoveryRemainingTicks,row.staggerRemainingTicks):0;
}
function defenseSourceValid(game:Game,session:Session,source:Creature):boolean {
    const bound=session.defenseSources.get(source.id);
    return source.hp>0&&!source.hasStatus('paralyzed')&&!source.hasStatus('entranced')
        &&!(source instanceof Monster&&(source.isCaged||source.state===MonsterState.ASLEEP))
        &&!!bound&&bound.actor===source&&bound.depth===game.depth&&bound.revision===actorSourceRevision(source);
}
/** Shared core-owned stagger eligibility, with the scheduler owning bundle recovery. */
export function isActorStaggered(game:Game,actorId:number):boolean {
    const session=sessions.get(game);if(!session)return false;
    const sourceId=actorId,member=actor(game,actorId)?.spatial?.bodyMember;
    actorId=member?.groupId??actorId;
    const row=session.state.actors.find(row=>row.actorId===actorId);
    return (row?.staggerRemainingTicks??0)>0 || (!!row&&row.poise===0)
        ||session.state.scheduler.bundles.some(bundle=>bundle.decisionOwnerId===actorId&&bundle.subactions.some(child=>(!member||child.sourceEntityId===sourceId)&&child.phases[child.phaseIndex]?.kind==='break-recovery'));
}
export function nativeActorPoiseDamage(game:Game,actorId:number):number {
    const session=sessions.get(game),source=actor(game,actorId);
    return session&&source?resourcesFor(game,session,source).policy.nativePoiseDamage:0;
}
/** Once per positive physical strike. No status/DOT, invented hit or extra die. */
export function applyActorPoiseDamage(game:Game,targetId:number,amount:number):void {
    committed(game,()=>applyActorPoiseDamageCommitted(game,targetId,amount),['staggered']);
}
function applyActorPoiseDamageCommitted(game:Game,targetId:number,amount:number):void {
    const session=sessions.get(game);if(!session)return;
    targetId=actor(game,targetId)?.spatial?.bodyMember?.groupId??targetId;
    const source=actor(game,targetId);
    if(!session||!source||source.hp<=0||!Number.isSafeInteger(amount)||amount<=0||amount>1_000_000)return;
    const existing=session.state.actors.find(row=>row.actorId===source.id);
    const busy=session.state.scheduler.bundles.some(bundle=>bundle.decisionOwnerId===source.id);
    const {profile,base,policy,stats}=resourcesFor(game,session,source,busy?existing?.profileId:undefined);
    if(existing&&synchronizeResource(existing,profile.id,policy,stats))bumpRevision(session.state);
    if(policy.poiseImmune||isActorStaggered(game,targetId))return;
    if(!existing&&session.state.actors.length>=4096)throw new Error('Actor resource budget exhausted');
    const row=existing??initialResource(source.id,profile.id,base,stats);
    if(!existing){session.state.actors.push(row);session.state.actors.sort((a,b)=>a.actorId-b.actorId);}
    row.poise=Math.max(0,Math.min(row.poise,policy.poiseCapacity)-amount);
    row.poiseRecoveryDelayRemaining=policy.poiseRecoveryDelayTicks;row.poiseRecoveryRemainder=0;
    if(row.poise===0){
        const recovery=Math.max(nativeRecovery(row),session.definitions.breakRecoveryTicks);
        row.dodgeRemainingTicks=row.parryRemainingTicks=0;row.parryFacing=null;
        row.dodgeRecoveryRemainingTicks=row.parryRecoveryRemainingTicks=0;
        if(session.state.scheduler.bundles.some(bundle=>bundle.decisionOwnerId===source.id)){
            // Existing production interruption is deferred through the indivisible
            // native hit; pending later segments cannot resume after this strike.
            const bundle=session.state.scheduler.bundles.find(bundle=>bundle.decisionOwnerId===source.id)!;
            for(const child of bundle.subactions)notifyProductionActorSourceChanged(game,child.sourceEntityId);
        }else{row.staggerRemainingTicks=Math.max(source.ticksUntilTurn,recovery);source.ticksUntilTurn=row.staggerRemainingTicks;}
    }
    bumpRevision(session.state);
    if(row.poise===0)combatEvent(game,source,'staggered',{
        actionId:session.state.scheduler.bundles.find(bundle=>bundle.decisionOwnerId===source.id)?.actionId??0});
}
/** Deterministic exact-facing contact, consumed before any native probability roll. */
export function tryActorParry(game:Game,attackerId:number,defenderId:number,contact:{from:{x:number;y:number};to:{x:number;y:number}}):boolean {
    return committed(game,()=>tryActorParryCommitted(game,attackerId,defenderId,contact),['parried','staggered']);
}
function tryActorParryCommitted(game:Game,attackerId:number,defenderId:number,contact:{from:{x:number;y:number};to:{x:number;y:number}}):boolean {
    const session=sessions.get(game),defender=actor(game,defenderId),attacker=actor(game,attackerId);
    if(!session||!defender||!attacker||!defenseSourceValid(game,session,defender)||isActorStaggered(game,defenderId))return false;
    const row=session.state.actors.find(row=>row.actorId===defenderId);
    if(!row||row.parryRemainingTicks<=0||!row.parryFacing)return false;
    const dx=contact.from.x-contact.to.x,dy=contact.from.y-contact.to.y,face=directionVectors[row.parryFacing];
    if(Math.max(Math.abs(dx),Math.abs(dy))>session.definitions.parry.contactRange
        ||Math.sign(dx)!==face.x||Math.sign(dy)!==face.y)return false;
    row.parryRemainingTicks=0;row.parryFacing=null;bumpRevision(session.state);
    try {
        applyActorPoiseDamage(game,attackerId,session.definitions.parry.poiseDamage);
        const resolutionId=game.extensionRuntime!.notifyActorParried(attackerId,defenderId,game.depth);
        if(game.extensionRuntime!.hasCommittedFactConsumer('combat.event.v1')){
            if(typeof resolutionId!=='number'||!Number.isSafeInteger(resolutionId)||resolutionId<1)throw new Error('Missing real parry resolution identity');
            combatEvent(game,defender,'parried',{resolutionId,
                actionId:session.state.scheduler.bundles.find(bundle=>bundle.subactions.some(child=>child.sourceEntityId===attackerId))?.actionId??0});
        }
    }catch(error){invalidateProductionActorActionSession(game);game.invalidateActorActionRun(error instanceof Error?error:new Error(String(error)));throw error;}
    return true;
}
export interface ActorParryPlan {
    moduleId:string;sourceEntityId:number;facing:ActorAttackFacing;revision:number;sessionRevision:number;
    sourceRevision:number;facts:string;
}
export function prepareActorParry(game:Game,sourceId:number,facing:ActorAttackFacing):ActorParryPlan|null {
    bindPhasedAttackProduction(game);
    const session=sessions.get(game),source=actor(game,sourceId);
    if(!session||!source||source.spatial?.bodyMember&&source.spatial.bodyMember.groupId!==source.id||!facings.includes(facing)||!eligible(game,source,session))return null;
    const {policy,row,stats}=resourcesFor(game,session,source);
    if((!row&&session.state.actors.length>=4096)||Math.min(row?.stamina??policy.initialStamina,policy.staminaCapacity)<session.definitions.parry.cost)return null;
    return deepFreeze({moduleId:session.moduleId,sourceEntityId:source.id,facing,revision:session.state.revision,
        sessionRevision:session.sessionRevision,sourceRevision:actorSourceRevision(source),
        facts:canonical({row:row??null,policy,combatStats:stats??null,hp:source.hp,status:source.statusDurations,depth:game.depth,
            footprint:sourceFootprintVersion(game.spatialOf(source))})});
}
export function commitActorParry(game:Game,plan:ActorParryPlan,scope:ActorActionScope):boolean {
    const session=sessions.get(game),source=actor(game,plan.sourceEntityId);
    if(!session||!source||session.runtime!==game.extensionRuntime)throw new Error('Stale parry session');
    assertActorActionScope(scope,game,source.id,source===game.player?'player-command':'npc-scheduler');
    if(source!==game.player)assertNativeActorDecisionScope(scope,game,source.id);
    const current=prepareActorParry(game,source.id,plan.facing);
    if(!current||canonical(current)!==canonical(plan))throw new Error('Stale parry preparation');
    if(!pay(game,session,source,session.definitions.parry.cost))return false;
    const row=session.state.actors.find(row=>row.actorId===source.id)!;
    row.parryRemainingTicks=session.definitions.parry.windowTicks;row.parryFacing=plan.facing;
    row.parryRecoveryRemainingTicks=session.definitions.parry.recoveryTicks;
    source.ticksUntilTurn=session.definitions.parry.recoveryTicks;
    session.defenseSources.set(source.id,{actor:source,revision:actorSourceRevision(source),depth:game.depth});
    game.extensionRuntime?.notifyCommittedAction({actorId:source.id,action:'parry'});
    return true;
}
export function isActorParryCommand(game:Game,data:unknown):boolean {
    if(typeof data!=='string')return false;
    try{const input=JSON.parse(data),binding=game.extensionRuntime?.actorActionBinding();return !!binding&&input.module===binding.moduleId&&input.action==='parry';}catch{return false;}
}
export function prepareActorParryCommand(game:Game,data:unknown):ActorParryPlan|null {
    if(typeof data!=='string')throw new Error('Invalid parry command');
    const input=JSON.parse(data);
    if(Object.keys(input).sort().join(',')!=='action,module,payload'||!isActorParryCommand(game,data)
        ||!input.payload||Object.keys(input.payload).join(',')!=='facing'||!facings.includes(input.payload.facing))throw new Error('Invalid parry input');
    return prepareActorParry(game,game.player.id,input.payload.facing);
}
export function commitActorParryCommand(game:Game,plan:ActorParryPlan):boolean {
    return withActorActionScope(game,'player-command',game.player.id,scope=>commitActorParry(game,plan,scope));
}

/** Native attack epilogues and poise break share max recovery, never add a second fee or clock. */
export function reconcileActorNativeRecovery(game:Game,actorId:number):void {
    const session=sessions.get(game);if(!session)return;
    const source=actor(game,actorId),row=session.state.actors.find(row=>row.actorId===actorId);
    if(!source||!row||row.staggerRemainingTicks<=0)return;
    row.staggerRemainingTicks=Math.max(row.staggerRemainingTicks,source.ticksUntilTurn);
    source.ticksUntilTurn=row.staggerRemainingTicks;
}

/** Trusted completed-rest resource commit, with current authoritative policy. */
export function restoreActorRestResources(game:Game,restore:{stamina:string;poise:string}):void {
    const session=sessions.get(game);if(!session)throw new Error('Missing rest resource session');
    const {profile,base,policy,stats,row}=resourcesFor(game,session,game.player);
    // An unchanged implicit full pool remains implicit; no budget slot is needed.
    if(!row&&!stats&&(restore.stamina!=='full'||policy.initialStamina===policy.staminaCapacity))return;
    if(!row&&session.state.actors.length>=4096)throw new Error('Actor resource budget exhausted');
    const resource=row??initialResource(game.player.id,profile.id,base,stats);
    synchronizeResource(resource,profile.id,policy,stats);
    if(restore.stamina==='full'){resource.stamina=policy.staminaCapacity;resource.regenRemainder=0;resource.regenDelayRemaining=0;}
    if(restore.poise==='full'){resource.poise=policy.poiseCapacity;resource.poiseRecoveryRemainder=0;resource.poiseRecoveryDelayRemaining=0;}
    if(!row){session.state.actors.push(resource);session.state.actors.sort((a,b)=>a.actorId-b.actorId);}
    bumpRevision(session.state);
}
