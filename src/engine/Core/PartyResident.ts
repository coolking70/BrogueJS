/** Trusted resident handoff. The roster kernel owns the surrounding native transaction
 * and moves the same ControlledActor between actors and stationed. */
import type { Game } from './Game';
import { ControlledActor } from '../../entities/ControlledActor';
import type { PartyResidentMemory } from '../../ext/partyRoster';
export type { PartyResidentMemory } from '../../ext/partyRoster';
import type { ResidentComponent } from '../../ext/residentSdk';
import type { CampRecord } from '../../ext/structureSdk';
import {
  activeResidentActors, residentRecord, residentComponent, candidateSource,
  residentEligible, residentDisabled, residentActorVisible, residentCamp,
  residentBedIds, residentRations, inResidentCamp, publishResident, failResident
} from './ResidentWorld';
import { settleResidentNeeds, freezeResidentCamps } from './ResidentNeeds';
import { initialResidentNeed } from './ResidentEconomy';
import { removeResident } from './ResidentProduction';
import { productionActorActionScheduler } from './ActorActionProduction';
import { residentOrderTicket } from './ResidentOrders';
import { hasInteractionLine } from '../../ext/worldSpatial';
import { checkedAdd } from '../../ext/worldBasics';
import { triggerActorNeeds } from './ActorNeeds';
import { updateWorldReasons } from './WorldWorkWorld';
import { markRecordingRoot } from '../../ext/recordingRevisions';
import { edibleState } from './EdibleState';
import { invalidateNeeds } from './ActorNeeds';
import { terminateResidentSource } from './ResidentProduction';

export interface PartyStationPlan { actorId:number; owner:string; campId:number; stateRevision:number; campRevision:number; bedId:number }
function contact(g:Game, actor:ControlledActor | import('../../entities/Monster').Monster):void {
  if(!residentActorVisible(g,actor) || Math.max(Math.abs(actor.x-g.commandActor.x),Math.abs(actor.y-g.commandActor.y))>1
    || !hasInteractionLine(g.grid,g.commandActor.loc,actor.loc))failResident('C5_DISTANCE');
  if(residentDisabled(actor)||residentDisabled(g.commandActor))failResident('C5_BUSY');
}
function campFor(g:Game,id:number):{owner:string;camp:CampRecord} {
  for(const owner of g.extensionRuntime?.residentOwners()??[]){
    const camp=g.extensionRuntime!.worldCampRecord(owner,id);if(camp)return {owner,camp};
  }
  return failResident('C5_BAD_REFERENCE','camp');
}
function bumpCamp(g:Game,owner:string,id:number):void {
  const state=g.extensionRuntime!.worldCampState(owner),camp=state.camps.find(c=>c.regionId===id);
  if(!camp)failResident('C5_BAD_REFERENCE','camp');
  camp!.revision=checkedAdd(camp!.revision,1);state.revision=checkedAdd(state.revision,1);
  g.extensionRuntime!.worldCampReplace(owner,state);
  g.world5!.revision=checkedAdd(g.world5!.revision,1);
  updateWorldReasons(g);freezeResidentCamps(g,camp!.depth);markRecordingRoot(g.world5!);
}
export function preparePartyStation(g:Game,actor:ControlledActor,campId:number):PartyStationPlan {
  if(!g.party||!g.world5||actor===g.player||actor.hp<=0||actor.spatial||actor.hasStatus('lifespan_remaining')
    ||g.party.state.leaderActorId===actor.id||!g.party.state.members.some(m=>m.actorId===actor.id&&m.life==='active')
    ||residentRecord(g,actor.id))failResident('C5_GATE');
  contact(g,actor);
  if(productionActorActionScheduler(g)?.isBusy(actor.id)||g.world5!.tickets.some(t=>t.actorId===actor.id))failResident('C5_BUSY');
  const {owner,camp}=campFor(g,campId),state=g.extensionRuntime!.worldCampState(owner);
  if(camp.depth!==g.depth||!inResidentCamp(g,camp,actor.loc))failResident('C5_WRONG_LEVEL');
  const rows=g.world5!.residents.filter(r=>r.owner===owner&&r.campSlotId===camp.slot);
  if(g.world5!.residents.length>=64||rows.length>=16)failResident('C5_BUDGET');
  const used=rows.map(r=>residentComponent(g,r.actorId)?.bedId);
  const bedId=residentBedIds(g,camp).find(id=>!used.includes(id));if(bedId===undefined)failResident('C5_ROOM');
  if(residentRations(g,camp).reduce((n,r)=>n+r.quantity,0)<rows.length+1)failResident('C5_INPUT');
  if([...g.visibleMonsters].some(m=>m.hp>0&&!m.isAlly&&!m.isCaged))failResident('C5_THREAT');
  return {actorId:actor.id,owner,campId,stateRevision:state.revision,campRevision:camp.revision,bedId:bedId!};
}
/** Call while actor is still in the roster, before moving its authoritative root. */
export function commitPartyStation(g:Game,actor:ControlledActor,plan:PartyStationPlan,memory?:PartyResidentMemory):PartyResidentMemory {
  const check=preparePartyStation(g,actor,plan.campId);
  if(JSON.stringify(check)!==JSON.stringify(plan))failResident('C5_STALE');
  settleResidentNeeds(g,true);
  // Settlement can expire beds, residents, or reservations; repeat all predicates.
  const fresh=preparePartyStation(g,actor,plan.campId);
  const camp=residentCamp(g,plan.owner,plan.campId);
  const need=memory?structuredClone(memory.need):initialResidentNeed(actor.id);
  if(need.actorId!==actor.id||!need.alive||need.departed)failResident('C5_BAD_REFERENCE','needs');
  // Preserve shortages; low native nutrition can only worsen the first handoff.
  const shortage=actor.nutrition<=0?3:actor.nutrition<=150?2:actor.nutrition<=350?1:0;
  need.foodShortage=Math.max(need.foodShortage,shortage) as 0|1|2|3;
  const source=candidateSource(g,actor.id);
  if(source&&!source.source.consumed){source.source.consumed=true;source.source.revision=checkedAdd(source.source.revision,1);
    g.extensionRuntime!.replaceResidentComponent(source.owner,actor.id,'source',source.source);}
  const component:ResidentComponent={schema:1,campId:camp.regionId,campOrdinal:camp.ordinal,revision:0,mode:'stay',
    bedId:fresh.bedId,schedule:[16,8,8],job:{kind:'idle'},stopReason:null};
  g.world5!.residents.push({actorId:actor.id,owner:plan.owner,campSlotId:camp.slot as 0,levelRef:{kind:'dungeon',depth:camp.depth},revision:0});
  g.world5!.residents.sort((a,b)=>a.actorId-b.actorId);
  const ledger=g.world5!.offline.find(l=>l.campSlotId===camp.slot);if(!ledger)failResident('C5_BAD_REFERENCE','ledger');
  ledger!.residentStates.push(need);
  publishResident(g,plan.owner,actor.id,component);
  bumpCamp(g,plan.owner,plan.campId);
  return {actorId:actor.id,need:structuredClone(need),source:source?structuredClone(source):null};
}
/** After the caller moves the owner root, refresh only derived/qualification state. */
export function finishPartyStation(g:Game,actor:ControlledActor):void {
  triggerActorNeeds(g,[actor],'resident-changed');
  freezeResidentCamps(g,g.depth);
}
export function preparePartyResidentRelease(g:Game,id:number):void {
  const actor=activeResidentActors(g).find(a=>a.id===id),row=residentRecord(g,id),component=residentComponent(g,id);
  if(!g.party||!actor||!row||!component||!residentEligible(g,actor))failResident('C5_GATE');
  contact(g,actor!);
  if(row!.levelRef.kind!=='dungeon'||row!.levelRef.depth!==g.depth)failResident('C5_WRONG_LEVEL');
  const orderTicket=residentOrderTicket(g,id);
  if(g.world5!.tickets.some(t=>t.actorId===id&&t!==orderTicket))failResident('C5_RESERVED');
  if(productionActorActionScheduler(g)?.isBusy(id)
    &&!g.world5!.residentJobs.some(j=>j.actorId===id)&&!orderTicket)failResident('C5_BUSY');
}
/** Returns the settled history for the roster's persistent memory. No source is
 * deleted: spawn slots and consumed rescue provenance remain authoritative. */
export function commitPartyResidentRelease(g:Game,id:number):PartyResidentMemory {
  preparePartyResidentRelease(g,id);settleResidentNeeds(g,true);preparePartyResidentRelease(g,id);
  const row=residentRecord(g,id)!,component=residentComponent(g,id)!;
  const need=g.world5!.offline.flatMap(l=>l.residentStates).find(n=>n.actorId===id);
  if(!need)failResident('C5_BAD_REFERENCE','needs');
  const memory:PartyResidentMemory={actorId:id,need:structuredClone(need!),source:structuredClone(candidateSource(g,id)??null)};
  removeResident(g,id,'party-join',false);
  if(g.world5!.tickets.some(t=>t.actorId===id)||g.world5!.residentJobs.some(j=>j.actorId===id)||g.world5!.orders.some(o=>o.actorId===id))
    failResident('C5_RESERVED');
  bumpCamp(g,row.owner,component.campId);
  return memory;
}
export function applyPartyResidentNutrition(actor:ControlledActor,memory:PartyResidentMemory):void {
  const ceiling=[actor.maxNutrition,350,150,0][memory.need.foodShortage]!;
  actor.nutrition=Math.min(actor.nutrition,ceiling);actor.refreshHungerState();
}

/** Terminal residents remain historical entities. Administrative departure keeps
 * HP; death keeps zero HP. Neither path leaves an economic or controllable owner. */
export function retireStationedResident(g:Game,id:number,reason:string,residencyRemoved=false,occurredTick?:number):void {
  const root=g.party,actor=root?.stationed.get(id);if(!root||!actor||root.state.retired.some(r=>r.actorId===id))return;
  const record=residentRecord(g,id),last=[...root.state.transfers].reverse().find(r=>r.actorId===id&&r.kind==='station');
  const level=record?.levelRef??last?.level;
  if(!level||level.kind!=='dungeon')failResident('C5_BAD_REFERENCE','retirement-level');
  const items=level!.kind==='dungeon'&&level!.depth===g.depth?g.items:g.levels.get((level as {depth:number}).depth)?.items;
  if(!items)failResident('C5_BAD_REFERENCE','retirement-items');
  if(!residencyRemoved)removeResident(g,id,reason,false,occurredTick);
  if(root.state.retired.some(r=>r.actorId===id))return;
  actor.equippedWeapon=actor.equippedArmor=actor.ringLeft=actor.ringRight=null;
  for(const item of actor.inventory.items.slice()){
    if(items!.some(i=>i.id===item.id))failResident('C5_BAD_REFERENCE','retirement-item-owner');
    actor.inventory.removeItem(item);item.loc={...actor.loc};items!.push(item);
  }
  const state=edibleState(g.extensionRuntime!);
  if(state.actorNeeds)state.actorNeeds.rows=state.actorNeeds.rows.filter(r=>r.actorId!==id);
  if(state.timedStats)state.timedStats.rows=state.timedStats.rows.filter(r=>r.actorId!==id);
  if(state.departures)state.departures.active=state.departures.active.filter(r=>r.actorId!==id);
  terminateResidentSource(g,id);
  if(actor.hp<=0)g.extensionRuntime!.captureDeath(actor,false,g.extensionRuntime!.causality.deathOrigin(actor.id));
  actor.ticksUntilTurn=0;actor.seized=false;
  root.state.retired.push({actorId:id,reason,tick:occurredTick??g.world5!.simulationTicks,level:structuredClone(level!)});
  root.state.retired.sort((a,b)=>a.actorId-b.actorId);root.state.revision=checkedAdd(root.state.revision,1);
  root.state.companionOrders=root.state.companionOrders.filter(o=>o.actorId!==id);
  invalidateNeeds(g);markRecordingRoot(g.world5!);g.requestEdibleRender();
}
