import { StatValidationError, isStatJson } from '../../ext/stats';
import type { StatPipeline } from './StatPipeline';
import { compareCodePoints } from '../../ext/worldJson';
export interface AppliedStat { actorId:number; key:string; bonus:number }
export interface MaterializedStatSnapshot {schema:1;applied:AppliedStat[]}
export const MATERIALIZED_KEYS=Object.freeze(['native.max-hp','native.strength','combat.stamina-capacity','combat.poise-capacity','growth.focus-capacity']);
export function validateMaterializedStats(v:unknown):asserts v is MaterializedStatSnapshot{
 if(!isStatJson(v)||!v||typeof v!=='object'||Array.isArray(v))throw new StatValidationError('source');
 const s=v as MaterializedStatSnapshot;
 if(Object.keys(s).sort().join(',')!=='applied,schema'||s.schema!==1||!Array.isArray(s.applied)||!s.applied.length)throw new StatValidationError('source');
 let previous='';
 for(const r of s.applied){const id=`${r.actorId}\u0000${r.key}`;if(!r||Object.keys(r).sort().join(',')!=='actorId,bonus,key'||!Number.isSafeInteger(r.actorId)||r.actorId<1||!MATERIALIZED_KEYS.includes(r.key)||!Number.isSafeInteger(r.bonus)||r.bonus===0||previous&&compareCodePoints(previous,id)>=0)throw new StatValidationError('source');previous=id;}
}
/** Persisted applied deltas only. Values and source rows are always recomputed. */
export class MaterializedStats {
 private rows:AppliedStat[]=[];
 constructor(private readonly changed:()=>void=()=>{}){}
 bonus(actorId:number,key:string):number{return this.rows.find(r=>r.actorId===actorId&&r.key===key)?.bonus??0;}
 restore(value?:MaterializedStatSnapshot):void{
  if(value)validateMaterializedStats(value);const rows=value?.applied??[];
  if(rows.length===this.rows.length&&rows.every((r,i)=>r.actorId===this.rows[i]!.actorId&&r.key===this.rows[i]!.key&&r.bonus===this.rows[i]!.bonus))return;
  this.rows=structuredClone(rows);this.changed();
 }
 snapshot():MaterializedStatSnapshot|undefined{return this.rows.length?{schema:1,applied:structuredClone(this.rows)}:undefined;}
 set(actorId:number,key:string,bonus:number):void{
  if(!Number.isSafeInteger(bonus))throw new StatValidationError('source');
  if(this.bonus(actorId,key)===bonus)return;
  this.rows=this.rows.filter(r=>r.actorId!==actorId||r.key!==key);
  if(bonus)this.rows.push({actorId,key,bonus});
  this.rows.sort((a,b)=>compareCodePoints(String(a.actorId),String(b.actorId))||compareCodePoints(a.key,b.key));
  this.changed();
 }
 remove(actorId:number):void{const rows=this.rows.filter(r=>r.actorId!==actorId);if(rows.length===this.rows.length)return;this.rows=rows;this.changed();}
 reconcile(actorId:number,pipeline:StatPipeline,read:(key:string)=>number|undefined,write:(key:string,value:number,refill:number)=>void):void{
  const next=MATERIALIZED_KEYS.filter(k=>pipeline.keys.has(k)).map(key=>{const breakdown=pipeline.breakdown(actorId,key);if(typeof breakdown.base!=='number')throw new StatValidationError('source');return {key,breakdown,current:read(key)};});
  // Evaluate and validate the whole write set before writing even the first field.
  for(const {key,breakdown} of next){const bonus=breakdown.value-(breakdown.base as number);
   // Resource owners explicitly propose permanent recovery. The total bonus
   // also contains equipment/auras and cannot identify a permanent increment.
   this.set(actorId,key,bonus);write(key,breakdown.value,0);
  }
  pipeline.clear(actorId);
 }
 assert(actorIds:readonly number[],pipeline:StatPipeline,read:(actorId:number,key:string)=>number|undefined):void{
  for(const actorId of actorIds){pipeline.clear(actorId);for(const key of MATERIALIZED_KEYS){if(!pipeline.keys.has(key))continue;const b=pipeline.breakdown(actorId,key);if(typeof b.base!=='number'||((key==='native.strength'||key==='native.max-hp')&&b.base<1)||this.bonus(actorId,key)!==b.value-b.base)throw new StatValidationError('source');const current=read(actorId,key);if(current!==undefined&&current!==b.value)throw new StatValidationError('source');}}
  if(this.rows.some(r=>!actorIds.includes(r.actorId)||!pipeline.keys.has(r.key)))throw new StatValidationError('source');
 }
}
