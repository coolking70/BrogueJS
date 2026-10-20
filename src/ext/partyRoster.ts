import {validResidentSource} from './residentSchema';
/** P1d: source and lifecycle records belong only to effective party runs. */
import { PartyFailure, type PartyState } from './party';
import { c5Canonical } from './worldJson';
import { windowExact, windowInt } from './partyWindow';
import type { LevelRef } from './world5';
export interface PartyResidentMemory {
  actorId: number;
  need: import('./world5').OfflineResidentState;
  source: { owner: string; source: import('./residentSdk').ResidentSource } | null;
}
export interface PartySource { actorId: number; kind: 'creation'|'rescue'|'narrative'|'resident'; key: string; template: string }
export interface PartyTransfer { seq:number; actorId:number; kind:'join'|'station'|'death'; sourceKey:string; level:LevelRef; tick:number }
export interface PartyRescue { actorId:number; template:string; key:string }
export interface PartyRosterInput { kind:'party:roster'; schema:1; expectedRevision:number; issuerSlot:string; actorId:number; targetId:number; operation:'join'|'station'; campId:number|null; level:LevelRef }
export const PARTY_ROSTER_RULES=Object.freeze({schema:1,limit:4,historyLimit:128,primary:'permanent',boundary:'idle-adjacent-corner-safe',ticks:0,controller:'local:0',narrative:['cord.mender:splice'],rescue:['goblin'],resident:['settlement.wayfarer','settlement.gardener'],growth:'neutral-once-no-kit'});
const fail=():never=>{throw new PartyFailure('BAD_PAYLOAD');};
export function parsePartyRosterInput(raw:unknown):PartyRosterInput {
  try { if(c5Canonical(raw).length>4096)fail(); } catch { fail(); }
  windowExact(raw,'kind,schema,expectedRevision,issuerSlot,actorId,targetId,operation,campId,level');
  if(raw.kind!=='party:roster'||raw.schema!==1||!['join','station'].includes(String(raw.operation)))fail();
  windowInt(raw.expectedRevision);windowInt(raw.actorId,1);windowInt(raw.targetId,1);
  if(raw.issuerSlot!=='local:0')throw new PartyFailure('NOT_CONTROLLER');
  windowExact(raw.level,'kind,depth');if(raw.level.kind!=='dungeon')fail();windowInt(raw.level.depth,1);if(raw.level.depth>40)fail();
  if(raw.operation==='station')windowInt(raw.campId,1);else if(raw.campId!==null)fail();
  return structuredClone(raw) as unknown as PartyRosterInput;
}
export function validatePartyRoster(state:PartyState):void {
  if(!Array.isArray(state.initialActorIds)||!state.initialActorIds.length||state.initialActorIds.length>4||state.initialActorIds[0]!==state.primaryActorId)fail();
  let prev=0;for(const id of state.initialActorIds){windowInt(id,prev+1);prev=id;}
  if(!Array.isArray(state.sources)||state.sources.length>128||!Array.isArray(state.transfers)||state.transfers.length>1024||!Array.isArray(state.rescued)||state.rescued.length>128||!Array.isArray(state.residentMemories))fail();
  const active=new Set(state.initialActorIds),sources=new Map<number,PartySource>();prev=0;
  for(const source of state.sources){windowExact(source,'actorId,kind,key,template');windowInt(source.actorId,prev+1);prev=source.actorId;
    if(!['creation','rescue','narrative','resident'].includes(source.kind)||typeof source.key!=='string'||!source.key.length||source.key.length>256||typeof source.template!=='string'||!source.template.length||source.template.length>128)fail();
    const index=state.initialActorIds.indexOf(source.actorId);
    if(source.kind==='rescue'&&!PARTY_ROSTER_RULES.rescue.includes(source.template)||source.kind==='resident'&&!PARTY_ROSTER_RULES.resident.includes(source.template)||source.kind==='narrative'&&(source.template!=='cord.mender'||source.key!=='cord.mender.first.slot.1'))fail();
    if(index>=0?(source.kind!=='creation'||source.key!==`creation:${index}`||source.template!=='party-member'):source.kind==='creation')fail();sources.set(source.actorId,source);
  }
  if(state.initialActorIds.some(id=>!sources.has(id)))fail();
  const joined=new Set(state.initialActorIds),living=new Set(state.initialActorIds),dead=new Set<number>();let tick=0;
  state.transfers.forEach((row,index)=>{windowExact(row,'seq,actorId,kind,sourceKey,level,tick');if(row.seq!==index+1)fail();windowInt(row.actorId,1);windowInt(row.tick,tick);tick=row.tick;
    windowExact(row.level,'kind,depth');if(row.level.kind!=='dungeon')return fail();windowInt(row.level.depth,1);if(row.level.depth>40)fail();
    if(!sources.has(row.actorId)||sources.get(row.actorId)!.key!==row.sourceKey)fail();
    if(row.kind==='join'){if(active.has(row.actorId)||dead.has(row.actorId)||living.size>=4)fail();active.add(row.actorId);living.add(row.actorId);joined.add(row.actorId);}
    else if(row.kind==='station'){if(!living.delete(row.actorId)||!active.delete(row.actorId)||row.actorId===state.primaryActorId)fail();}
    else if(row.kind==='death'){if(!active.has(row.actorId)||!living.delete(row.actorId))fail();dead.add(row.actorId);}else fail();
  });
  if(sources.size!==joined.size||state.members.length!==active.size||state.members.some(m=>!active.has(m.actorId)||(m.life==='dead')!==dead.has(m.actorId)))fail();
  if(state.members.filter(m=>m.life!=='dead').length>4)throw new PartyFailure('NO_SPACE');
  if(!Array.isArray(state.retired)||state.retired.length>128)fail();
  const retired=new Set<number>();for(const row of state.retired){windowExact(row,'actorId,reason,tick,level');windowInt(row.actorId,1);windowInt(row.tick);windowExact(row.level,'kind,depth');if(row.level.kind!=='dungeon'||!Number.isSafeInteger((row.level as {depth:number}).depth)||typeof row.reason!=='string'||!row.reason.length||row.reason.length>128||active.has(row.actorId)||!sources.has(row.actorId)||retired.has(row.actorId))fail();retired.add(row.actorId);}
  const memories=new Set<number>();for(const row of state.residentMemories){windowExact(row,'actorId,need,source');windowInt(row.actorId,1);if(memories.has(row.actorId)||!sources.has(row.actorId))fail();memories.add(row.actorId);
    windowExact(row.need,'actorId,alive,foodShortage,housingShortage,unfedDays,departed');windowInt(row.need.unfedDays);if(row.need.actorId!==row.actorId||typeof row.need.alive!=='boolean'||typeof row.need.departed!=='boolean'||![0,1,2,3].includes(row.need.foodShortage)||![0,1,2,3].includes(row.need.housingShortage))fail();
    if(row.source!==null){windowExact(row.source,'owner,source');if(typeof row.source.owner!=='string'||!validResidentSource(row.source.source)||!row.source.source.consumed)fail();}
  }
  prev=0;for(const proof of state.rescued){windowExact(proof,'actorId,template,key');windowInt(proof.actorId,prev+1);prev=proof.actorId;if(proof.key!==`rescue:${proof.actorId}`||typeof proof.template!=='string')fail();}
  for(const source of state.sources)if(source.kind==='resident'&&!state.residentMemories.some(m=>m.actorId===source.actorId&&m.source?.source.key===source.key))fail();
  for(const source of state.sources)if(source.kind==='rescue'&&!state.rescued.some(r=>r.actorId===source.actorId&&r.template===source.template&&r.key===source.key))fail();
}

export interface PartyNativeProfile {template:string; accuracy:number; defense:number; damage:string; regenTurns:number; bloodType:number; penetrate:boolean}
export function validPartyNativeProfile(raw:unknown):raw is PartyNativeProfile {
  try {windowExact(raw,'template,accuracy,defense,damage,regenTurns,bloodType,penetrate');}catch{return false;}
  return ['goblin','settlement.wayfarer','settlement.gardener','cord.mender'].includes(String(raw.template))&&[raw.accuracy,raw.defense,raw.regenTurns,raw.bloodType].every(n=>Number.isSafeInteger(n)&&Number(n)>=0)&&typeof raw.damage==='string'&&/^(?:[1-9][0-9]*d[1-9][0-9]*(?:\+[0-9]+)?|[0-9]+-[0-9]+)$/.test(raw.damage)&&typeof raw.penetrate==='boolean'&&(raw.template==='goblin'||!raw.penetrate);
}
