/** P1d authority adapters. External payloads supply references, never eligibility. */
import { worldText } from '../../ext/worldText';
import type { Game } from './Game';
import { Monster } from '../../entities/Monster';
import { PartyMember, withPartyActor } from './PartyRuntime';
import { PartyFailure } from '../../ext/party';
import type { PartySource, PartyRosterInput } from '../../ext/partyRoster';
import { hasInteractionLine } from '../../ext/worldSpatial';
import { actorActionSchedulerFor } from './ActorActionSession';
import { isIncapacitated } from '../Status/Incapacitation';
import { residentRecord, candidateSource } from './ResidentWorld';
import { preparePartyResidentRelease, preparePartyStation } from './PartyResident';
import { isDeparting } from './ActorDeparture';
import { copyFields, CREATURE_FIELDS } from './EntitySnapshot';
import { getNextEntityId, restoreNextEntityId } from '../../entities/Creature';
import { peekEdibleState, edibleState } from './EdibleState';
import { needDeclarations, projectNeed, invalidateNeeds } from './ActorNeeds';
import { World5Error } from '../../ext/worldBasics';
import { canSeeMonster } from '../UI/MonsterVisibility';

export function recordPartyRescue(g:Game,actor:Monster,wasCaged:boolean):void {
  if(!g.party||!wasCaged||actor.isCaged||!actor.isAlly||g.party.state.rescued.some(r=>r.actorId===actor.id))return;
  if(g.party.state.rescued.length>=128)return;
  g.party.state.rescued.push({actorId:actor.id,template:actor.typeId,key:`rescue:${actor.id}`});
  g.party.state.rescued.sort((a,b)=>a.actorId-b.actorId);g.party.state.revision++;
}
export function partySource(g:Game,id:number):PartySource|null {
  const root=g.party,rt=g.extensionRuntime;if(!root||!rt)return null;
  const old=root.state.sources.find(s=>s.actorId===id);
  if(root.state.retired.some(r=>r.actorId===id))return null;
  if(root.stationed.has(id)&&residentRecord(g,id))return old??null;
  const monster=g.monsters.find(m=>m.id===id);
  if(monster){
    const resident=residentRecord(g,id),source=candidateSource(g,id);
    const rescue=root.state.rescued.find(s=>s.actorId===id&&s.template===monster.typeId);
    if(rescue)return {...rescue,kind:'rescue'};
    if(resident&&source?.source.consumed)return {actorId:id,kind:'resident',key:source.source.key,template:monster.typeId};
  }
  const entity=rt.worldWorkEntities().find(e=>e.id===id&&e.owner==='narrative'&&e.depth===g.depth);
  if(entity){const answer=rt.queryOptional('narrative.party-source.v1',{actorId:id});if(answer.status==='available'&&answer.value){
    const proof=answer.value as unknown as {actorId:number;key:string;template:string};
    if(proof.actorId===id&&proof.key===entity.instanceKey&&proof.template===entity.contentId)return {...proof,kind:'narrative'};
  }}
  return null;
}
export function preparePartyRoster(g:Game,input:PartyRosterInput):PartySource|null {
  const root=g.party;if(!root)throw new PartyFailure('PARTY_DISABLED');
  if(input.expectedRevision!==root.state.revision)throw new PartyFailure('STALE_REVISION');
  if(input.issuerSlot!=='local:0')throw new PartyFailure('NOT_CONTROLLER');
  const actor=g.controlledActors.find(a=>a.id===input.actorId),member=root.state.members.find(m=>m.actorId===input.actorId);
  if(!actor||!member||member.life!=='active'||actor.hp<=0||g.isGameOver)throw new PartyFailure('BAD_ACTOR');
  if(input.level.kind!=='dungeon'||input.level.depth!==g.depth)throw new PartyFailure('INVALID_TARGET');
  if(g.interactionActive||g.hasPendingConfirmation||root.state.window.decision||Object.values(root.native).some(n=>n.modal))throw new PartyFailure('DECISION_REQUIRED');
  if(root.state.window.phase==='failed')throw new PartyFailure('INTERNAL_FAILURE');
  if(root.state.window.phase==='running'||root.state.window.phase==='interrupted'&&root.state.window.elapsed<root.state.window.budget||root.state.window.members.some(m=>m.plan?.kind==='travel'||m.plan?.kind==='queue'&&m.cursor<m.plan.actions.length)||g.activeControlledActors.some(a=>a.ticksUntilTurn>0||actorActionSchedulerFor(g)?.isBusy(a.id)||isIncapacitated(a)))throw new PartyFailure('ACTOR_BUSY');
  if(root.state.transfers.length+1+root.state.members.filter(m=>m.life!=='dead').length+(input.operation==='join'?1:-1)>1024||root.state.sources.length>=128&&!root.state.sources.some(s=>s.actorId===input.targetId))throw new PartyFailure('BUDGET_EXCEEDED');
  if(input.operation==='station'){
    const target=root.actors.get(input.targetId);if(!target||target.id===root.state.leaderActorId||root.state.members.filter(m=>m.life!=='dead').length<=1)throw new PartyFailure('BAD_ACTOR');
    withPartyActor(g,actor,()=>preparePartyStation(g,target,input.campId!));return null;
  }
  if(root.state.members.some(m=>m.actorId===input.targetId))throw new PartyFailure('BAD_ACTOR');
  if(root.state.members.filter(m=>m.life!=='dead').length>=4)throw new PartyFailure('NO_SPACE');
  const source=partySource(g,input.targetId);if(!source)throw new PartyFailure('INVALID_TARGET');
  const target=root.stationed.get(input.targetId)??g.monsters.find(m=>m.id===input.targetId)??g.extensionRuntime!.worldWorkEntities().find(e=>e.id===input.targetId);
  if(!target||Math.max(Math.abs(target.x-actor.x),Math.abs(target.y-actor.y))>1||!hasInteractionLine(g.grid,actor.loc,{x:target.x,y:target.y}))throw new PartyFailure('INVALID_TARGET');
  if(target instanceof Monster){
    if(!canSeeMonster(actor,g.grid,target))throw new PartyFailure('INVALID_TARGET');
    if(target.hp<=0||!target.isAlly||target.isCaged||target.isClone||target.spatial||target.carriedMonster||target.mutation||target.polymorphed||target.wasNegated||target.newPowerCount||target.absorptionFlags||target.hasStatus('lifespan_remaining')||isDeparting(g,target.id)||g.world5?.raidCamps.some(c=>c.event?.actorIds.includes(target.id)))throw new PartyFailure('BAD_ACTOR');
    if(!['goblin','settlement.wayfarer','settlement.gardener'].includes(target.typeId))throw new PartyFailure('BAD_ACTOR');
    if(isIncapacitated(target)||target.hasStatus('discordant')||target.hasStatus('confused')||actorActionSchedulerFor(g)?.isBusy(target.id)&&!residentRecord(g,target.id))throw new PartyFailure('ACTOR_BUSY');
  }
  if(residentRecord(g,input.targetId))withPartyActor(g,actor,()=>preparePartyResidentRelease(g,input.targetId));
  else if(g.world5?.tickets.some(t=>t.actorId===input.targetId))throw new PartyFailure('ACTOR_BUSY');
  return source;
}
/** Resident removal may requalify a rescued actor for native needs. Transfer
 * those rows for both first conversion and rejoining the same controlled entity. */
function transferPartyNeeds(g:Game,actor:PartyMember):void {
  const state=peekEdibleState(g.extensionRuntime!),rows=state.actorNeeds?.rows.filter(r=>r.actorId===actor.id)??[];
  for(const row of rows){const d=needDeclarations(g).find(d=>d.id===row.needId);if(!d)throw new PartyFailure('BAD_ACTOR');const settled=projectNeed(row,d,g.world5!.simulationTicks);actor.nutrition=Math.min(actor.nutrition,Math.floor(actor.maxNutrition*settled.value/d.initial));}
  if(rows.length){edibleState(g.extensionRuntime!).actorNeeds!.rows=state.actorNeeds!.rows.filter(r=>r.actorId!==actor.id);invalidateNeeds(g);}
  actor.refreshHungerState();
}
export function convertPartyActor(g:Game,source:PartySource):PartyMember {
  const existing=g.party!.stationed.get(source.actorId);if(existing){transferPartyNeeds(g,existing);return existing;}
  const monster=g.monsters.find(m=>m.id===source.actorId),entity=g.extensionRuntime!.worldWorkEntities().find(e=>e.id===source.actorId);
  if(!monster&&!entity)throw new PartyFailure('BAD_ACTOR');
  const next=getNextEntityId();let actor:PartyMember;try{actor=new PartyMember((monster??entity)!.x,(monster??entity)!.y);}finally{restoreNextEntityId(next);}
  actor.id=source.actorId;
  if(monster){
    const residentSource=candidateSource(g,monster.id);
    if(residentSource&&!residentSource.source.consumed){residentSource.source.consumed=true;residentSource.source.revision++;g.extensionRuntime!.replaceResidentComponent(residentSource.owner,monster.id,'source',residentSource.source);}
    Object.assign(actor,copyFields(monster,CREATURE_FIELDS));actor.statusImmunities=new Set(monster.statusImmunities);
    actor.partyProfile={template:monster.typeId,accuracy:monster.accuracy,defense:monster.defense,damage:monster.damageString,regenTurns:monster.regenTurns,bloodType:monster.bloodType,penetrate:monster.hasAbility('MA_ATTACKS_PENETRATE')};
    actor.regenCarry=monster.regenTurns>0?Math.max(0,Math.min(1,monster.regenCounter/monster.regenTurns)):0;
    if(monster.carriedItem){if(!actor.inventory.addItem(monster.carriedItem))throw new PartyFailure('NO_SPACE');monster.carriedItem=null;}
    // A declared native need transfers once into controlled nutrition; it must not run twice.
    transferPartyNeeds(g,actor);
  }else{
    actor.name=worldText(entity!.nameKey);actor.hp=actor.maxHp=20;actor.partyProfile={template:'cord.mender',accuracy:80,defense:0,damage:'1-3',regenTurns:20,bloodType:23,penetrate:false};
  }
  return actor;
}
export function visiblePartyCandidates(g:Game):{id:number;name:string;source:'rescue'|'narrative'|'resident';reason:string|null}[]{
  if(!g.party)return [];
  const ids=new Set([...g.monsters.filter(m=>g.activeControlledActors.some(a=>canSeeMonster(a,g.grid,m))).map(m=>m.id),...[...g.party.stationed.values()].filter(a=>g.world5?.residents.some(r=>r.actorId===a.id&&r.levelRef.kind==='dungeon'&&r.levelRef.depth===g.depth)&&g.grid.getCell(a.x,a.y)?.isVisible).map(a=>a.id),...g.extensionRuntime!.worldWorkEntities().filter(e=>e.owner==='narrative'&&e.depth===g.depth&&g.grid.getCell(e.x,e.y)?.isVisible).map(e=>e.id)]);
  return [...ids].sort((a,b)=>a-b).flatMap(id=>{const source=partySource(g,id);if(!source||source.kind==='creation'&&!g.party!.stationed.has(id))return [];
    const actor=g.party!.stationed.get(id)??g.monsters.find(m=>m.id===id),entity=g.extensionRuntime!.worldWorkEntities().find(e=>e.id===id);
    let reason:string|null=null;try{preparePartyRoster(g,{kind:'party:roster',schema:1,issuerSlot:'local:0',expectedRevision:g.party!.state.revision,actorId:g.focusedActor.id,targetId:id,operation:'join',campId:null,level:{kind:'dungeon',depth:g.depth}});}catch(e){reason=e instanceof PartyFailure||e instanceof World5Error?e.code:'ACTOR_BUSY';}
    return [{id,name:actor?.name??(entity?worldText(entity.nameKey):''),source:residentRecord(g,id)?'resident' as const:source.kind as 'rescue'|'narrative',reason}];
  });
}
