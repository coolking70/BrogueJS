/** Trusted data-driven executor. Optional content supplies finite definitions only. */
import type { Game, ControlledActionRisk } from './Game';
import type { Creature } from '../../entities/Creature';
import { Monster, MonsterState, monstersAreEnemies } from '../../entities/Monster';
import type { ActorAttackDefinitions, ProductionActorAttackState, ActorAttackFacing, ActorAttackMetadata, ActorAttackDefinition } from '../../ext/actorActions';
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
import { advanceActorResources, chargeActorResources } from './ActorResources';
import { bindNativeAttackWorld } from './NativeAttackTransaction';
import type { ActorResourcePhase } from '../../ext/actorActions';
import { TerrainType } from '../Map/Grid';

type Session={state:ProductionActorAttackState;definitions:ActorAttackDefinitions;scheduler:ActorActionScheduler;runtime:object;moduleId:string;sessionRevision:number;defenseSources:Map<number,{actor:Creature;revision:number;depth:number}>};
const sessions=new WeakMap<Game,Session>();
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
    return projectAttackShape(view,view.cells,shape,{contains:p=>game.grid.isValidPos(p.x,p.y),lineOfEffect:(a,b)=>game.hasLineOfSight(a.x,a.y,b.x,b.y)}).map(p=>({...p}));
}
function eligible(game:Game,source:Creature,session:Session):boolean {
    if (game.isGameOver||game.interactionActive||source.hp<=0||source.ticksUntilTurn>0||session.scheduler.isBusy(source.id)
        || (source.spatial?.actionLockInTicks ?? 0) > 0
        ||['paralyzed','entranced','confused'].some(status=>source.hasStatus(status as 'paralyzed'))) return false;
    if (source instanceof Monster && (source.isCaged||source.isDormant||source.deathProcessed||source.state===MonsterState.ASLEEP
        ||source.state===MonsterState.FLEEING||source.hasBehavior('MONST_IMMOBILE')||source.hasBehavior('MONST_GETS_TURN_ON_ACTIVATION'))) return false;
    const view=game.spatialOf(source);
    return view.groupId===source.id; // Current production bodies are independent native/square actors.
}
function profileId(session:Session,game:Game,source:Creature):string|undefined {
    return source===game.player?session.definitions.playerProfileId:source instanceof Monster?
        session.definitions.nativeProfiles.find(binding=>binding.monsterId===source.typeId)?.profileId:undefined;
}
/** Resource policy is independent of whether the actor has a phased attack profile. */
function resourcesFor(game:Game, session:Session, source:Creature) {
    const profile=session.definitions.profiles.find(p=>p.id===(profileId(session,game,source)??session.definitions.playerProfileId))!;
    const policy=session.definitions.resourcePolicies.find(p=>p.id===profile.resourcePolicyId)!;
    const row=session.state.actors.find(a=>a.actorId===source.id);
    return {profile,policy,row};
}
function initialResource(actorId:number,profileId:string,stamina:number):ProductionActorAttackState['actors'][number] {
    return {actorId,profileId,stamina,regenRemainder:0,regenDelayRemaining:0,dodgeRemainingTicks:0,dodgeRecoveryRemainingTicks:0};
}
function pay(game:Game,session:Session,source:Creature,cost:number):boolean {
    const {profile,policy,row}=resourcesFor(game,session,source);
    if(!row&&session.state.actors.length>=4096)return false;
    const resource=row??initialResource(source.id,profile.id,policy.initialStamina);
    // A form can change during a native turn, before settlement/GC. Normalize
    // the old pool against the new policy at this same payment commit.
    const input=resource.profileId===profile.id?resource:{...resource,stamina:Math.min(resource.stamina,policy.staminaCapacity),
        regenRemainder:0,regenDelayRemaining:Math.min(resource.regenDelayRemaining,policy.regenDelayTicks)};
    const next=chargeActorResources(input,policy,cost);if(!next)return false;
    Object.assign(resource,next);resource.profileId=profile.id;
    if(!row){session.state.actors.push(resource);session.state.actors.sort((a,b)=>a.actorId-b.actorId);}
    bumpRevision(session.state);return true;
}
export function canPayNativeActorAttack(game:Game,actorId:number):boolean {
    bindPhasedAttackProduction(game);
    const session=sessions.get(game),source=actor(game,actorId);if(!session)return true;if(!source)return false;
    const {policy,row}=resourcesFor(game,session,source);
    return (!!row||session.state.actors.length<4096)&&Math.min(row?.stamina??policy.initialStamina,policy.staminaCapacity)>=policy.nativeAttackCost;
}
export function chargeNativeActorAttack(game:Game,actorId:number):boolean {
    bindPhasedAttackProduction(game);
    const session=sessions.get(game),source=actor(game,actorId);if(!session)return true;if(!source)return false;
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
    // An implicit initial pool is equivalent to a stored pool. Materialize it
    // when elapsed recovery can change it, including an initially empty NPC.
    for(const source of [game.player,...game.monsters]){
        if(source.hp<=0||(source instanceof Monster&&(source.isDormant||source.deathProcessed)))continue;
        const {profile,policy,row}=resourcesFor(game,session,source);
        if(!row&&policy.initialStamina<policy.staminaCapacity){
            if(session.state.actors.length>=4096)throw new Error('Actor resource budget exhausted');
            session.state.actors.push(initialResource(source.id,profile.id,policy.initialStamina));
        }
    }
    session.state.actors.sort((a,b)=>a.actorId-b.actorId);
    for(const row of session.state.actors){
        const source=actor(game,row.actorId);if(!source||source.hp<=0)continue; // Cached layers freeze.
        const bundle=session.state.scheduler.bundles.find(b=>b.decisionOwnerId===source.id&&b.depth===game.depth);
        const current=resourcesFor(game,session,source);
        if(!bundle&&row.profileId!==current.profile.id){
            row.profileId=current.profile.id;row.stamina=Math.min(row.stamina,current.policy.staminaCapacity);
            row.regenRemainder=0;row.regenDelayRemaining=Math.min(row.regenDelayRemaining,current.policy.regenDelayTicks);
        }
        const policy=session.definitions.resourcePolicies.find(p=>p.id===session.definitions.profiles.find(p=>p.id===row.profileId)!.resourcePolicyId)!;
        const phases:ActorResourcePhase[]=bundle?bundle.subactions.flatMap(s=>s.phases[s.phaseIndex]?[s.phases[s.phaseIndex]!.kind]:[]):[];
        if(row.dodgeRemainingTicks&&!isActorDodgeProtected(game,source.id))row.dodgeRemainingTicks=0;
        // Native status/catch-up clocks may exceed dodge recovery. Split the
        // resource interval so differing idle/recovery policies stay additive.
        const recovery=phases.length?0:Math.min(delta,row.dodgeRecoveryRemainingTicks);
        if(recovery)Object.assign(row,advanceActorResources(row,policy,recovery,['recovery']));
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
    const policy=session.definitions.resourcePolicies.find(p=>p.id===profile.resourcePolicyId)!;
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
        facts:canonical({resource:resource??null,weapon:game.player.equippedWeapon,armor:game.player.equippedArmor,depth:game.depth,grid:game.grid.width,sourceHp:source.hp,status:source.statusDurations,
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
function resolve(game:Game,session:Session,boundary:Readonly<ActorActionBoundary>):void {
    const source=actor(game,boundary.sourceEntityId),metadata=session.state.actions.find(a=>a.actionId===boundary.actionId);
    const sub=metadata?.subactions.find(s=>s.sourceSubactionId===boundary.sourceSubactionId);
    if(!source||!sub)return;
    const attack=session.definitions.attacks.find(a=>a.id===sub.attackId)!,segment=attack.segments[boundary.segmentIndex]!;
    const bundle=session.state.scheduler.bundles.find(b=>b.actionId===boundary.actionId)!,child=bundle.subactions.find(s=>s.sourceSubactionId===boundary.sourceSubactionId)!;
    const authority=new ActorCombatResolutionAuthority(game,{schema:1,nextResolutionId:1,actors:[]},{production:true,dodgeProtected:id=>isActorDodgeProtected(game,id)});
    const plans=authority.prepareLockedBodySegment({kind:'locked-body-segment',depth:boundary.depth,sourceEntityId:source.id,
        sourceFootprintVersion:child.sourceFootprintVersion,shape:sub.shape,lockedCells:sub.lockedCells,
        approvedRisks:sub.approvedRisks,dodgeable:segment.dodgeable,parryable:segment.parryable});
    withActorActionScope(game,source===game.player?'player-command':'npc-scheduler',source.id,scope=>{
        for(const plan of plans){if(source.hp<=0||game.isGameOver)break;authority.commitNativeMelee(scope,plan);}
    });
    if(boundary.segmentIndex+1<attack.segments.length&&source.hp>0&&sourceFootprintVersion(game.spatialOf(source))===child.sourceFootprintVersion){
        sub.shape=shapeFor(attack,boundary.segmentIndex+1,sub.facing);sub.lockedCells=cellsFor(game,source,sub.shape);
    }else sub.lockedCells=[];
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
        elapsed:delta=>advanceResources(game,session,delta),
        inputLocked:()=>session.state.actors.some(row=>row.actorId===game.player.id&&row.dodgeRecoveryRemainingTicks>0),
        resumeResources:()=>{for(const row of session.state.actors){const source=actor(game,row.actorId);if(source&&row.dodgeRecoveryRemainingTicks>0)source.ticksUntilTurn=row.dodgeRecoveryRemainingTicks;}},
        sourceChanged:id=>{const row=session.state.actors.find(r=>r.actorId===id);if(row?.dodgeRemainingTicks){row.dodgeRemainingTicks=0;bumpRevision(session.state);}},
        leftDepth:()=>{if(session.state.actors.some(row=>row.dodgeRemainingTicks>0))bumpRevision(session.state);for(const row of session.state.actors)row.dodgeRemainingTicks=0;},
        interrupted:(source,bundle,reason)=>{bumpRevision(session.state);const metadata=session.state.actions.find(a=>a.actionId===bundle.actionId);if(metadata&&reason==='layer-change')metadata.suppressTerminalSweep=true;const sub=metadata?.subactions.find(s=>s.sourceSubactionId===source.sourceSubactionId);if(sub)sub.lockedCells=[];},
        shouldSweep:bundle=>!session.state.actions.find(action=>action.actionId===bundle.actionId)?.suppressTerminalSweep,
        finishAction:bundle=>{bumpRevision(session.state);session.state.actions=session.state.actions.filter(a=>a.actionId!==bundle.actionId);},
        select:(id,scope)=>{
            const source=actor(game,id);if(!(source instanceof Monster)||!eligible(game,source,session))return 'native-fallback';
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
            for(const attackId of profile.attackIds){const plan=prepare(game,source,attackId,facing);if(!plan)continue;
                if(!game.collectBodyTargets(plan.cells,{effect:'area-damage'},new Set()).some(hit=>hit.entity===target))continue;
                commit(game,plan,scope);return 'handled';}
            return 'native-fallback';
        }});
    sessions.set(game,session);
    for(const row of session.state.actors){const source=actor(game,row.actorId);if(source&&row.dodgeRemainingTicks)session.defenseSources.set(source.id,{actor:source,revision:actorSourceRevision(source),depth:game.depth});}
}
/** Whole-body sources use every zone; targets use only pending locked cells. */
export function cancelPhasedAttacksAtZone(game: Game, target: Creature, zoneId: string): void {
    const session = sessions.get(game); if (!session) return;
    const cells = new Set(game.footprintOf(target).filter(p => p.zoneId === zoneId).map(p => `${p.x},${p.y}`));
    const sources = new Set<number>([target.id]);
    for (const bundle of session.state.scheduler.bundles) {
        const metadata = session.state.actions.find(a => a.actionId === bundle.actionId);
        for (const child of bundle.subactions) {
            const sub = metadata?.subactions.find(s => s.sourceSubactionId === child.sourceSubactionId);
            if (sub?.lockedCells.some(p => cells.has(`${p.x},${p.y}`))) sources.add(child.sourceEntityId);
        }
    }
    for (const id of sources) notifyProductionActorSourceChanged(game, id);
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
    session.state.actors=session.state.actors.filter(row=>keep.has(row.actorId));
    for (const row of session.state.actors) {
        if(row.dodgeRemainingTicks&&!isActorDodgeProtected(game,row.actorId))row.dodgeRemainingTicks=0;
        const source=reachable.find(actor=>actor.id===row.actorId);
        if(source&&source.hp<=0){row.dodgeRemainingTicks=0;row.dodgeRecoveryRemainingTicks=0;}
        const next=source && (profileId(session,game,source)??session.definitions.playerProfileId);
        if(!next || next===row.profileId || session.state.scheduler.bundles.some(bundle=>bundle.decisionOwnerId===row.actorId))continue;
        const profile=session.definitions.profiles.find(profile=>profile.id===next)!;
        const policy=session.definitions.resourcePolicies.find(policy=>policy.id===profile.resourcePolicyId)!;
        bumpRevision(session.state);row.profileId=next;row.stamina=Math.min(row.stamina,policy.staminaCapacity);row.regenRemainder=0;row.regenDelayRemaining=Math.min(row.regenDelayRemaining,policy.regenDelayTicks);
    }
}

/** Candidate-world geometry validation ignores current occlusion (a wall may
 * legitimately have appeared since warning), but rejects invented/off-map cells. */
export function validatePhasedAttackGeometry(state:ProductionActorAttackState, definitions:ActorAttackDefinitions, creatures:readonly Creature[], contains:(depth:number,x:number,y:number)=>boolean,activeActorIds?:ReadonlySet<number>):void {
    const actors=new Map(creatures.map(actor=>[actor.id,actor]));
    for(const row of state.actors){
        const source=actors.get(row.actorId);
        if(row.dodgeRemainingTicks>0&&activeActorIds&&!activeActorIds.has(row.actorId))throw new Error('Cached actor retains dodge protection');
        if(row.dodgeRecoveryRemainingTicks>0 && (!source||source.hp<=0||source.ticksUntilTurn!==row.dodgeRecoveryRemainingTicks||!dodgeBodySupported(source)))throw new Error('Invalid dodge recovery mirror');
    }
    for(const bundle of state.scheduler.bundles) {
        const metadata=state.actions.find(action=>action.actionId===bundle.actionId);
        if(!metadata)throw new Error('Missing action metadata');
        for(const child of bundle.subactions) {
            const sub=metadata.subactions.find(sub=>sub.sourceSubactionId===child.sourceSubactionId),source=actors.get(child.sourceEntityId);
            if(!sub||!source)throw new Error('Invalid action source metadata');
            const pending=child.phases.slice(child.phaseIndex).some(phase=>phase.segmentIndex!==null);
            const expected=source instanceof Monster?definitions.nativeProfiles.find(binding=>binding.monsterId===source.typeId)?.profileId:definitions.playerProfileId;
            if(pending && (expected!==metadata.profileId || source.hasStatus('paralyzed') || source.hasStatus('entranced') || (source instanceof Monster && source.isCaged)))
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
    const {row,policy}=resourcesFor(game,session,source),dodge=session.definitions.dodge;
    if((!row&&session.state.actors.length>=4096)||Math.min(row?.stamina??policy.initialStamina,policy.staminaCapacity)<dodge.cost
        ||(row?.dodgeRecoveryRemainingTicks??0)>0)return null;
    const direction=directionVectors[facing],to={x:source.x+direction.x,y:source.y+direction.y};
    if(!game.canActorDodgeStep(source,to))return null;
    const cells=game.footprintOf(source).map(p=>({x:p.x+direction.x,y:p.y+direction.y}));
    if(cells.some(p=>game.grid.getCell(p.x,p.y)!.layers.some(t=>[TerrainType.STAIRS_UP,TerrainType.STAIRS_DOWN,TerrainType.DUNGEON_PORTAL,TerrainType.ALTAR].includes(t))))return null;
    const movement=game.prepareActorDodgeRisks(source.id,to);if(movement.certainDeath)return null;
    return deepFreeze({moduleId:session.moduleId,sourceEntityId:source.id,facing,to,revision:session.state.revision,
        sessionRevision:session.sessionRevision,sourceRevision:actorSourceRevision(source),risks:structuredClone(movement.risks),
        facts:canonical({row:row??null,hp:source.hp,status:source.statusDurations,depth:game.depth,
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
