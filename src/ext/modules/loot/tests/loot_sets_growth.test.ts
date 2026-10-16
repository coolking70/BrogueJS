import {expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
it('current loot+growth identity crosses digest/snapshot boundaries and continues recording',async()=>{
 const h=createWorldHarness({seed:42,mode:'easy',modules:['loot','growth']});
 try{
  const g=worldHarnessGame(h);
  for(let n=g.recordedInputEvents.length;n<2049;n++){g.executeCommand('escape');if(g.recordingInputBlocked)await g.flushRecording();}
  const recording=await g.exportRecordingAsync(),save=h.save(),digest=h.digest();
  expect(recording.events[255]!.fullCheckpoint).not.toBeNull();expect(recording.snapshots.map(s=>s.afterCommand)).toEqual([2048]);
  h.load(save);expect(h.digest()).toBe(digest);expect(h.replay(JSON.stringify(recording))).toEqual({ok:true,firstMismatch:null});
  for(const index of [255,256,257,2047,2048,2049])h.seek(JSON.stringify(recording),index);
  expect(h.digest()).toBe(digest);h.load(save);h.command('escape');const continued=h.exportRecording();expect(h.replay(continued).ok).toBe(true);
  if(process.env.PHASE6C1_EXPORT){writeFileSync(process.env.PHASE6C1_EXPORT+'-save.json',save);writeFileSync(process.env.PHASE6C1_EXPORT+'-recording.json',continued);}
 }finally{h.dispose();}
},60000);
