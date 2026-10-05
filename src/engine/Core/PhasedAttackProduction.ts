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

type Session={state:ProductionActorAttackState;definitions:ActorAttackDefinitions;scheduler:ActorActionScheduler;runtime:object;moduleId:string;sessionRevision:number};
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
    const profile=definitions.profiles.find(p=>p.id===plan.profileId)!,policy=definitions.resourcePolicies.find(p=>p.id===profile.resourcePolicyId)!;
    const bundle=createActorActionBundle({actionId:state.nextActionId,depth:game.depth,decisionOwnerId:source.id,timeChargeOwnerId:source.id,
        subactions:[{sourceEntityId:source.id,sourcePartId:game.spatialOf(source).partId??'body',sourceFootprintVersion:plan.sourceVersion,
            phases:[{kind:'windup',durationTicks:attack.windupTicks,segmentIndex:0},...attack.segments.slice(1).map((segment,index)=>({kind:'inter-segment' as const,durationTicks:segment.delayTicks,segmentIndex:index+1})),
                {kind:'recovery',durationTicks:attack.recoveryTicks,segmentIndex:null}]}]});
    const metadata:ActorAttackMetadata={actionId:bundle.actionId,profileId:profile.id,paidCost:attack.cost,subactions:[{
        sourceSubactionId:1,attackId:attack.id,facing:plan.facing,shape:structuredClone(plan.shape),lockedCells:structuredClone(plan.cells),approvedRisks:structuredClone(plan.approvedRisks)}]};
    let resource=state.actors.find(a=>a.actorId===source.id);
    const before=structuredClone(state);
    try {
        if(!resource){resource={actorId:source.id,profileId:profile.id,stamina:policy.initialStamina};state.actors.push(resource);state.actors.sort((a,b)=>a.actorId-b.actorId);}
        resource.profileId=profile.id;resource.stamina=Math.min(resource.stamina,policy.staminaCapacity)-attack.cost;state.nextActionId++;bumpRevision(state);state.actions.push(metadata);
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
    const authority=new ActorCombatResolutionAuthority(game,{schema:1,nextResolutionId:1,actors:[]},{production:true});
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
    const binding=game.extensionRuntime?.actorActionBinding();
    if(!binding){sessions.delete(game);return;}
    if((sessions.get(game)?.state as unknown)===binding.state && productionActorActionScheduler(game)===sessions.get(game)?.scheduler)return;
    validateActorAttackDefinitions(binding.definition);validateProductionActorAttackState(binding.state,binding.definition);
    const session={state:binding.state,definitions:binding.definition,runtime:game.extensionRuntime!,moduleId:binding.moduleId,sessionRevision:nextSessionRevision++} as unknown as Session;
    session.scheduler=createProductionActorActionSession(game,{state:session.state.scheduler,
        resolveSegment:boundary=>resolve(game,session,boundary),breakRecoveryTicks:()=>session.definitions.breakRecoveryTicks,
        elapsed:()=>bumpRevision(session.state),
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
        const source=reachable.find(actor=>actor.id===row.actorId);
        const next=source && profileId(session,game,source);
        if(!next || next===row.profileId || session.state.scheduler.bundles.some(bundle=>bundle.decisionOwnerId===row.actorId))continue;
        const profile=session.definitions.profiles.find(profile=>profile.id===next)!;
        const policy=session.definitions.resourcePolicies.find(policy=>policy.id===profile.resourcePolicyId)!;
        bumpRevision(session.state);row.profileId=next;row.stamina=Math.min(row.stamina,policy.staminaCapacity);
    }
}

/** Candidate-world geometry validation ignores current occlusion (a wall may
 * legitimately have appeared since warning), but rejects invented/off-map cells. */
export function validatePhasedAttackGeometry(state:ProductionActorAttackState, definitions:ActorAttackDefinitions, creatures:readonly Creature[], contains:(depth:number,x:number,y:number)=>boolean):void {
    const actors=new Map(creatures.map(actor=>[actor.id,actor]));
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
