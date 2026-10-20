/** Diagnostic-only Vite instrumentation. No source file or mechanical root is
 * modified. Hooks are active only around measured public roster commands. */
import assert from 'node:assert/strict';
import {hash} from './ext-perf-common.mjs';
export const ROSTER_WORK_HOOK='party-roster-economic-work-v1';
const hook=(key,amount='1')=>`globalThis[Symbol.for('${ROSTER_WORK_HOOK}')]?.('${key}',${amount});`;
export const ROSTER_WORK_UNITS=Object.freeze({settleCalls:'settleResidentNeeds function entries',needsPlanCalls:'validated planResidentNeeds calls',residentInputRows:'sum of resident rows supplied to needs planners (not unique actors)',economicEpochIntervals:'sum floor(toTick/1000)-floor(fromTick/1000) across needs planner calls',cancelWorkCalls:'cancelResidentWork function entries',cancelJobRows:'nonempty work jobs selected for cancellation',retireBundleCalls:'retireBundle invocations for selected canceled jobs'});
const inserts={
 'ResidentNeeds.ts':[['export function settleResidentNeeds(g: Game, force = false): void {',hook('settleCalls')]],
 'ResidentEconomy.ts':[['  assertResidentNeedsInput(input);',hook('needsPlanCalls')+hook('residentInputRows','input.residents.length')+hook('economicEpochIntervals','Math.floor(input.toTick/1000)-Math.floor(input.fromTick/1000)')]],
 'ResidentJobs.ts':[
  ['export function cancelResidentWork(g: Game, id: number, reason: string,occurredTick?:number): void {',hook('cancelWorkCalls')],
  ['  const j = work(g, id);\n  if (!j) return;',hook('cancelJobRows')],
  ['    j.actionId = null;',"if(actionId!==null&&productionActorActionScheduler(g))"+hook('retireBundleCalls')]
 ]
};
export function instrumentRosterEconomy(source,id){
 const name=Object.keys(inserts).find(name=>id.split('?')[0].replaceAll('\\','/').endsWith('/src/engine/Core/'+name));
 if(!name)return null;let code=source;
 for(const [anchor,insertion]of inserts[name]){assert.equal(code.split(anchor).length,2,`Review changed economic observer anchor: ${name}`);code=code.replace(anchor,anchor+'\n'+insertion);}
 return {code,identity:ROSTER_WORK_HOOK,sourceHash:hash(source),instrumentedHash:hash(code),file:name};
}
export function rosterEconomyPlugin(evidence){return {name:ROSTER_WORK_HOOK,enforce:'pre',transform(source,id){const result=instrumentRosterEconomy(source,id);if(!result)return null;evidence[result.file]={identity:result.identity,sourceHash:result.sourceHash,instrumentedHash:result.instrumentedHash};return {code:result.code,map:null};}};}
export function startRosterWorkObservation(){
 const symbol=Symbol.for(ROSTER_WORK_HOOK);assert.equal(globalThis[symbol],undefined,'Concurrent roster work observation');
 const counts=Object.fromEntries(Object.keys(ROSTER_WORK_UNITS).map(key=>[key,0]));
 globalThis[symbol]=(key,n)=>{assert.ok(Object.hasOwn(counts,key));assert.ok(Number.isSafeInteger(n)&&n>=0);counts[key]+=n;};
 return ()=>{delete globalThis[symbol];return counts;};
}
