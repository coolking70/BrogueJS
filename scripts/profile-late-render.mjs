/** CPU-only rendering preparation on real replay snapshots; excludes GPU/DOM layout. */
import { createServer } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Session } from 'node:inspector';
const [output, ...inputs] = process.argv.slice(2);
const server = await createServer({configFile:false, optimizeDeps:{noDiscovery:true,include:[]}, server:{middlewareMode:true,hmr:false},appType:'custom'});
const stats = values => { const a=values.toSorted((a,b)=>a-b);return {median:a[Math.floor(a.length/2)],p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1)}; };
const session = new Session();
const post = method => new Promise((resolve,reject)=>session.post(method,(e,r)=>e?reject(e):resolve(r)));
try {
    await server.ssrLoadModule('/src/i18n.ts');
    const { Game } = await server.ssrLoadModule('/src/engine/Core/Game.ts');
    const { observeDisplayFrame } = await server.ssrLoadModule('/src/ui/displayProjection.ts');
    const { logger, foldCombatMessages } = await server.ssrLoadModule('/src/engine/Systems/Logger.ts');
    const { rng } = await server.ssrLoadModule('/src/engine/Random.ts');
    const { LightMap } = await server.ssrLoadModule('/src/engine/Lighting/LightMap.ts');
    const originalBatch = LightMap.prototype.paintLights;
    let captured=[];
    LightMap.prototype.paintLights=function(sources) {captured=sources;return originalBatch.call(this,sources);};
    const game = new Game(), results=[];
    for (const input of inputs) {
        assert.equal(game.loadSnapshot(JSON.parse(readFileSync(input,'utf8'))),true);
        const sources=captured, queries={sequential:0,batch:0};
        for(const mode of ['sequential','batch']) {
            const callbacks=new Map(), measured=sources.map(source=>{
                if(!source.hasCreatureAt)return source;
                if(!callbacks.has(source.hasCreatureAt))callbacks.set(source.hasCreatureAt,(x,y)=>{queries[mode]++;return source.hasCreatureAt(x,y);});
                return {...source,hasCreatureAt:callbacks.get(source.hasCreatureAt)};
            });
            const light=new LightMap(game.grid);
            if(mode==='batch')originalBatch.call(light,measured);else for(const source of measured)light.paintLight(source);
        }
        const before = rng.getState(), samples={dance:[],projection:[],fold:[]};
        let frame;
        for(let i=0;i<80;i++) {
            if (process.env.CPU_PROFILE && i===20) {session.connect();await post('Profiler.enable');await post('Profiler.start');}
            let start=performance.now();game.danceLighting();const dance=performance.now()-start;
            start=performance.now();frame=observeDisplayFrame(game,logger,frame);const projection=performance.now()-start;
            start=performance.now();foldCombatMessages(logger.messages);const fold=performance.now()-start;
            if(i>=20) {samples.dance.push(dance);samples.projection.push(projection);samples.fold.push(fold);}
        }
        if(process.env.CPU_PROFILE) {const {profile}=await post('Profiler.stop');writeFileSync(`${output}.cpuprofile`,JSON.stringify(profile));session.disconnect();}
        assert.deepEqual(rng.getState(),before,'Rendering consumed simulation RNG');
        results.push({input,depth:game.depth,monsters:game.monsters.length,messages:logger.messages.length,lightSources:sources.length,occupancyQueries:queries,visibleTiles:frame.map.columns.flat().filter(Boolean).length,...Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,stats(v)]))});
    }
    writeFileSync(output,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
} finally {await server.close();}
