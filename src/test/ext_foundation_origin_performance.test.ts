import { writeFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { ExtensionRegistry } from '../ext/registry';
import * as catalog from '../ext/catalog';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
afterEach(() => vi.restoreAllMocks());
it('ORIGIN failed synchronous commands never project or clone the cached native world; measured 1/8 depth boundary', () => {
  const registry = new ExtensionRegistry(), original = new Error('bounded rollback');
  registry.register('atomic','1.0.0',()=>({id:'atomic',version:'1.0.0',initialState:()=>({}),
    validateState:(x):x is any=>!!x&&typeof x==='object',commands:{fail(_p,c){c.setState({paid:true});throw original;}}}));
  vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(registry);
  const measurements: {depths:number;p50:number;p95:number;max:number}[]=[];
  for (const depths of [1,8]) {
    const g=createHeadlessGame(717,'test');g.startNewGame({seed:717,mode:'test',ruleSet:'extended',extensions:['atomic']});g.animationEnabled=false;
    // Real native generation and caching, controlled first-visit preparation.
    for(let depth=2;depth<=depths;depth++){g.depth=depth;(g as any).generateDepth(false,false);}
    while(logger.pendingAcknowledgment)logger.acknowledgeNext();
    const random=rng.getState(), saved=g.toSaveSnapshot(), rt=g.extensionRuntime, input=JSON.stringify({module:'atomic',action:'fail',payload:null});
    const projected=vi.spyOn(g as any,'projectWholeRun').mockImplementation(()=>{throw new Error('unbounded native projection on failure hot path');});
    const times:number[]=[];
    for(let n=0;n<60;n++){
      const start=performance.now();try{g.executeCommand('ext:command',input);expect.unreachable();}catch(error){expect(error).toBe(original);}
      const elapsed=performance.now()-start;if(n>=10)times.push(elapsed);
      expect(g.hasCompleteRecording).toBe(true);expect(g.extensionRuntime).toBe(rt);
    }
    expect(projected).not.toHaveBeenCalled();projected.mockRestore();
    expect(rng.getState()).toEqual(random);const after=g.toSaveSnapshot();after.savedAt=saved.savedAt;expect(after).toEqual(saved);
    times.sort((a,b)=>a-b);measurements.push({depths,p50:times[25]!,p95:times[47]!,max:times[49]!});
  }
  // This is structural protection plus measured timings, not a new relaxed wall-time gate.
  if(process.env.FOUNDATION_ORIGIN_PERF_OUT)writeFileSync(process.env.FOUNDATION_ORIGIN_PERF_OUT,JSON.stringify({runtime:process.version,measurements},null,2)+'\n');
});
