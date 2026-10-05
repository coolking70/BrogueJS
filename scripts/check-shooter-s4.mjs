#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createServer, preview } from 'vite';
import { chromium } from 'playwright';
import { missionPilot } from './shooter-mission-route.mjs';
const args=process.argv.slice(2),output=resolve(args.includes('--output')?args[args.indexOf('--output')+1]:'../shooter-s4-evidence');mkdirSync(output,{recursive:true});
const report={schema:1,node:process.version,engine:[],browser:[]};let source,server,browser;
try {
    source=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error',optimizeDeps:{noDiscovery:true,include:[]}});
    const api=await source.ssrLoadModule('/src/products/shooter/ShooterSession.ts'), arena=await source.ssrLoadModule('/src/products/shooter/ShooterArena.ts');
    const catalog=await source.ssrLoadModule('/src/ext/realtimeCatalog.ts'),scenario=catalog.getRealtimeModules().find(d=>d.kind==='mission').scenario;
    const { moveCircle }=await source.ssrLoadModule('/src/engine/Movement/KinematicCollision.ts');
    const { SpatialHash }=await source.ssrLoadModule('/src/engine/Movement/SpatialHash.ts');
    const { raycast }=await source.ssrLoadModule('/src/engine/Movement/SpatialQuery.ts');
    const driverApi=await source.ssrLoadModule('/src/engine/Simulation/RealtimeSimulationDriver.ts');
    if(!args.includes('--browser-only'))for(const modules of (args.includes('--main-only')?[['firearms','hordes','missions']]:args.includes('--optional-only')?[['missions']]:[['missions'],['firearms','hordes','missions']])){
        const session=new api.ShooterSession(7301,{modules}),pilot=missionPilot(session,arena.createScenarioArena(scenario),{optional:modules.length===1,raycast,moveCircle,SpatialHash}),durations=[];
        let scanCheckpoint=null, approach=null;
        while(!session.finished){
            const state=session.snapshot(),input=pilot(state);
            if(!approach&&input.commands.some(c=>c.kind==='interact')&&state.mission.nearby==='scan-a'){approach=state;writeFileSync(join(output,`approach-${modules.length}.json`),JSON.stringify(state));}
            const start=performance.now();session.advanceTick(input.frame,input.commands);session.snapshot();durations.push(performance.now()-start);
            if(!scanCheckpoint&&state.mission.markers[0].status==='active'){scanCheckpoint=session.snapshot();writeFileSync(join(output,`scan-${modules.length}.json`),JSON.stringify(scanCheckpoint));}
            if(session.tick%3000===0)console.log(JSON.stringify({modules,tick:session.tick,stats:session.snapshot().stats,progress:session.snapshot().mission.markers.map(m=>[m.id,m.status,m.progress])}));
        }
        const final=session.snapshot(),replay=session.exportReplay();writeFileSync(join(output,`mission-${modules.length}-replay.json`),JSON.stringify(replay));
        assert.equal(final.mission.status,'success',`Pilot failed: ${JSON.stringify(final.mission)}`);
        assert.ok(session.tick>=18000&&session.tick<=27000,`Complete mission must take 10–15 minutes, actual ${session.tick/30}s`);
        assert.equal(api.canonicalState(api.replayShooter(JSON.parse(JSON.stringify(replay))).snapshot()),api.canonicalState(final));
        assert.equal(api.canonicalState(api.ShooterSession.fromSnapshot(final).snapshot()),api.canonicalState(final));
        const cadences=[];
        for(const fps of [30,60,144]){
            const other=api.ShooterSession.fromSnapshot(replay.initial);let cursor=0;
            const driver=new driverApi.RealtimeSimulationDriver({id:'s4',ticksPerSecond:30},()=>{const f=replay.frames[other.tick],batch=[];while(replay.commands[cursor]?.tick===f.tick)batch.push(replay.commands[cursor++]);other.advanceTick(f,batch);},8,()=>other.finished);
            driver.pump(0);let peak=0;
            for(let frame=1;!other.finished;frame++)peak=Math.max(peak,driver.pump(Math.round(frame*1e6/fps)).backlogTicks);
            assert.equal(api.canonicalState(other.snapshot()),api.canonicalState(final));assert.equal(peak,0);cadences.push({fps,ticks:other.tick,peakBacklog:peak,exact:true});
        }
        durations.sort((a,b)=>a-b);report.engine.push({modules,status:'passed',ticks:session.tick,seconds:session.tick/30,stats:final.stats,reward:final.mission.reward,shots:final.ranged?.shots??0,cadences,cpuMs:Object.fromEntries([50,95,99].map(p=>[`p${p}`,durations[Math.floor(durations.length*p/100)]]))});
    }
    if(!args.includes('--engine-only')){
        server=await preview({configFile:false,root:process.cwd(),logLevel:'error',preview:{host:'127.0.0.1',port:0}});
        browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
        const url=`http://127.0.0.1:${server.httpServer.address().port}/shooter.html`;
        for(const viewport of [{width:1440,height:1100},{width:390,height:844}]){
            const page=await browser.newPage({viewport,hasTouch:viewport.width<600}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
            await page.goto(url,{waitUntil:'networkidle'});await page.waitForSelector('canvas');
            await page.screenshot({path:join(output,`briefing-${viewport.width}.png`),fullPage:true});
            await page.locator('.diagnostics summary').click();
            await page.getByTestId('module-hordes').setChecked(false);await page.getByTestId('module-firearms').setChecked(false);await page.getByTestId('restart').click();
            const checkpoint=JSON.parse(readFileSync(join(output,'approach-1.json'),'utf8'));
            // Use an actual engine-produced checkpoint through the ordinary UI.
            await page.evaluate(s=>localStorage.setItem('broguejs-shooter-s4-checkpoint-v5',JSON.stringify(s)),checkpoint);
            await page.reload({waitUntil:'networkidle'});await page.getByTestId('load').click();await page.getByTestId('toggle').click();
            if(viewport.width>600)await page.keyboard.press('KeyE');else await page.getByTestId('interact').tap();
            const at=checkpoint.tick;await page.waitForFunction(t=>Number(document.querySelector('[data-testid="tick"]').textContent)>t+15,at);
            await page.getByTestId('toggle').click();
            if(viewport.width>600){
                await page.evaluate(s=>localStorage.setItem('broguejs-shooter-s4-checkpoint-v5',JSON.stringify(s)),checkpoint);
                await page.getByTestId('load').click();
                await page.evaluate(()=>{window.__missionPad={connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:8},(_,i)=>({pressed:i===0,value:i===0?1:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__missionPad]});});
                await page.getByTestId('toggle').click();await page.waitForFunction(t=>Number(document.querySelector('[data-testid="tick"]').textContent)>t+15,at);
                await page.evaluate(()=>{window.__missionPad.connected=false;});await page.getByTestId('toggle').click();
            }
            await page.getByTestId('save').click();
            const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('broguejs-shooter-s4-checkpoint-v5')));assert.ok(saved.moduleStates.missions.nodes[0].progress>checkpoint.moduleStates.missions.nodes[0].progress);
            const download=page.waitForEvent('download');await page.getByTestId('export').click();const recording=JSON.parse(readFileSync(await(await download).path(),'utf8'));
            assert.equal(api.canonicalState(api.replayShooter(recording).snapshot()),api.canonicalState(saved));
            await page.getByTestId('verify').click();assert.match(await page.getByTestId('message').textContent(),/重放验证通过/);
            await page.locator('input[type=file]').setInputFiles({name:'completed.json',mimeType:'application/json',buffer:readFileSync(join(output,'mission-1-replay.json'))});
            await page.waitForFunction(()=>document.querySelector('[data-testid="mission-result"]')?.textContent.includes('撤离成功'),null,{timeout:30000});
            assert.match(await page.getByTestId('mission-reward').textContent(),/样本 8/);
            assert.equal(await page.getByTestId('toggle').isDisabled(),true);
            await page.screenshot({path:join(output,`success-${viewport.width}.png`),fullPage:true});
            await page.getByTestId('mission-restart').click();await page.getByTestId('toggle').click();await page.locator('.diagnostics summary').click();await page.getByTestId('abort').click();
            await page.waitForFunction(()=>document.querySelector('[data-testid="mission-result"]')?.textContent.includes('行动失败'));
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);report.browser.push({viewport,keyboardOrTouchInteraction:true,standardPadInteraction:viewport.width>600,checkpoint:true,replay:true,successReward:true,abortFailure:true,noOverflow:true,errors});await page.close();
        }
    }
    report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack??error);console.error(error);process.exitCode=1;}
finally{writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server?.httpServer?server.httpServer.close(r):r());await source?.close();}
