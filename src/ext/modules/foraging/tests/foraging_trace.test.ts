import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { captureNatural } from './naturalCapture';
import { executeTraceCommand, foragingFinal, startNatural, type TraceCommand } from './traceHelpers';
import { worldHarnessGame } from '../../../testing/worldHarness';

type Trace={seed:number;mode:'normal';modules:string[];commands:TraceCommand[];final:ReturnType<typeof foragingFinal>};
function load(name:string):Trace {return JSON.parse(readFileSync(new URL(`../data/${name}`,import.meta.url),'utf8'));}
function run(h:ReturnType<typeof startNatural>,trace:Trace,from=0,until=trace.commands.length){
 for(let i=from;i<until;i++){
  const c=trace.commands[i]!,g=worldHarnessGame(h),before=g.recordedInputEvents.length;
  const snapshot=c.action==='item:execute'&&c.data?.toString().startsWith('eat|')?{items:JSON.stringify(g.player.inventory.items),nutrition:g.player.nutrition,tick:g.toSnapshot().run.currentTick,turn:g.absoluteTurnNumber}:null;
  expect(executeTraceCommand(h,c),`command ${i+1}`).toEqual(c.expect);
  expect(g.recordedInputEvents.length-before).toBe(c.expect.recorded?1:0);
  if(c.answers)expect(g.recordedInputEvents[before]!.decisions).toEqual(c.answers);
  if(snapshot&&c.answers?.[0]===false)expect({items:JSON.stringify(g.player.inventory.items),nutrition:g.player.nutrition,tick:g.toSnapshot().run.currentTick,turn:g.absoluteTurnNumber}).toEqual(snapshot);
 }
}
describe('foraging T-TRACE natural public-command evidence',()=>{
 it.each([['A','natural-trace.json'],['B','natural-trace-hearth.json']] as const)('%s reproduces exact commands, decisions and final state',(kind,name)=>{
  if(process.env.FORAGING_CAPTURE_DIRECTORY){captureNatural(kind,`${process.env.FORAGING_CAPTURE_DIRECTORY}/${name}`);return;}
  const trace=load(name),h=startNatural(trace.seed,trace.modules);
  try{run(h,trace);expect(foragingFinal(h)).toEqual(trace.final);const rec=JSON.parse(h.exportRecording());expect(rec.version).toBe(4);
   if(kind==='A'){const eats=rec.events.filter((e:{action:string;data:unknown})=>e.action==='item:execute'&&String(e.data).startsWith('eat|'));expect(eats.slice(0,2).map((e:{decisions:boolean[]})=>e.decisions)).toEqual([[false],[true]]);expect(worldHarnessGame(h).depth).toBe(2);}
   expect(h.replay(JSON.stringify(rec))).toEqual({ok:true,firstMismatch:null});expect(foragingFinal(h)).toEqual(trace.final);
  }finally{h.dispose();}
 });
 it.each(['natural-trace.json','natural-trace-hearth.json'])('%s save/load, seek and authentic continued recording',(name)=>{
  if(process.env.FORAGING_CAPTURE_DIRECTORY)return;
  const trace=load(name),h=startNatural(trace.seed,trace.modules);
  try{
   const mid=Math.floor(trace.commands.length/2);run(h,trace,0,mid);const before=foragingFinal(h);h.load(h.save());expect(foragingFinal(h)).toEqual(before);run(h,trace,mid);expect(foragingFinal(h)).toEqual(trace.final);
   const recording=h.exportRecording();
   for(const index of [0,mid,trace.commands.length]){h.seek(recording,index);expect(worldHarnessGame(h).replayCursor).toBe(index);h.load(h.save());run(h,trace,index);expect(foragingFinal(h)).toEqual(trace.final);expect(h.replay(h.exportRecording())).toEqual({ok:true,firstMismatch:null});}
  }finally{h.dispose();}
 });
});
