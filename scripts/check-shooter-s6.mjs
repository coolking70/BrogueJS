#!/usr/bin/env node
// Repository QA: canonical engine-generated campaign checkpoints in the built UI.
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createServer,preview} from 'vite';
import {chromium} from 'playwright';
import {missionPilot} from './shooter-mission-route.mjs';
const args=process.argv.slice(2),output=resolve(args.includes('--output')?args[args.indexOf('--output')+1]:'../shooter-s6-evidence');mkdirSync(output,{recursive:true});
const report={schema:1,engine:[],browser:[]},checkpoints=[];
let source,server,browser;
try{
    source=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error',optimizeDeps:{noDiscovery:true,include:[]}});
    const {CampaignSession}=await source.ssrLoadModule('/src/products/shooter/CampaignSession.ts');
    const api=await source.ssrLoadModule('/src/products/shooter/ShooterSession.ts');
    const {createScenarioArena}=await source.ssrLoadModule('/src/products/shooter/ShooterArena.ts');
    const catalog=await source.ssrLoadModule('/src/ext/realtimeCatalog.ts');const mission=catalog.getRealtimeModules().find(d=>d.kind==='mission');
    const {raycast}=await source.ssrLoadModule('/src/engine/Movement/SpatialQuery.ts');
    const c=new CampaignSession();c.execute({kind:'start',region:0,difficulty:0});
    for(let index=0;index<3;index++){
        const {ticket,setup}=c.deploy();const s=new api.ShooterSession(ticket.seed,{modules:['firearms','missions','support'],setup});
        const scenario=mission.configure(setup).scenario,pilot=missionPilot(s,createScenarioArena(scenario),{optional:true,raycast});
        while(!s.finished){const state=s.snapshot(),input=pilot(state);s.advanceTick(input.frame,input.commands);}
        const terminal=s.snapshot();assert.equal(terminal.mission.status,'success');
        assert.equal(api.canonicalState(api.ShooterSession.fromSnapshot(terminal).snapshot()),api.canonicalState(terminal));
        assert.equal(api.canonicalState(api.replayShooter(s.exportReplay()).snapshot()),api.canonicalState(terminal));
        const checkpoint={campaign:c.snapshot(),ticket,battle:terminal};checkpoints.push(checkpoint);
        writeFileSync(join(output,`mission-${index+1}.json`),JSON.stringify(checkpoint));
        c.settle(ticket,terminal.mission);assert.throws(()=>c.settle(ticket,terminal.mission));
        report.engine.push({index:index+1,variant:setup.variant,seed:ticket.seed,ticks:s.tick,reward:terminal.mission.reward,exactRestoreAndReplay:true,uniqueSettlement:true});
        if(index===0){c.execute({kind:'purchase',type:'support',slot:1});c.execute({kind:'purchase',type:'support',slot:0});}
        if(index===1){c.execute({kind:'purchase',type:'weapon',slot:2});c.execute({kind:'equip',slots:[0,2]});}
    }
    assert.equal(c.view().operation.status,'complete');assert.equal(c.view().meta.completed,1);assert.equal(c.view().meta.difficulty,1);report.final=c.view();
    // Default four-module battlefield with the first operation's starter loadout.
    const {moveCircle}=await source.ssrLoadModule('/src/engine/Movement/KinematicCollision.ts');
    const {SpatialHash}=await source.ssrLoadModule('/src/engine/Movement/SpatialHash.ts');
    const setup={variant:0,difficulty:0,weapons:[0,1],support:[0,-1,-1,0]},battle=new api.ShooterSession(checkpoints[0].ticket.seed,{setup});
    const pilot=missionPilot(battle,createScenarioArena(mission.configure(setup).scenario),{optional:false,raycast,moveCircle,SpatialHash});
    while(!battle.finished){const p=battle.snapshot(),input=pilot(p),supply=p.support.abilities.find(a=>a.slot===0),scan=p.support.abilities.find(a=>a.slot===3);
        if(p.damage.actors[0].hp>0){if(p.damage.actors[0].hp<70&&supply.remaining===0)input.commands.push({tick:input.frame.tick,kind:'support',slot:0,x:p.actors[0].pose.x,y:p.actors[0].pose.y});
            if(scan.remaining===0)input.commands.push({tick:input.frame.tick,kind:'support',slot:3,x:p.actors[0].pose.x,y:p.actors[0].pose.y});
            if(p.support.nearbySupply!==null&&p.damage.actors[0].hp<100&&!input.commands.some(c=>c.kind==='interact'))input.commands.push({tick:input.frame.tick,kind:'interact'});}
        battle.advanceTick(input.frame,input.commands);
    }
    const full=battle.snapshot();assert.equal(full.mission.status,'success');assert.equal(api.canonicalState(api.ShooterSession.fromSnapshot(full).snapshot()),api.canonicalState(full));assert.equal(api.canonicalState(api.replayShooter(battle.exportReplay()).snapshot()),api.canonicalState(full));
    report.defaultMission={ticks:battle.tick,stats:full.stats,status:full.mission.status,starterLoadout:true,exactRestoreAndReplay:true};
    // All variants and difficulty levels retain exact saves/replays and actual limits.
    report.variants=[];for(let variant=0;variant<3;variant++)for(let difficulty=0;difficulty<3;difficulty++){
        const setup={variant,difficulty,weapons:[0,1],support:[2,-1,-1,0]},s=new api.ShooterSession(7301,{setup});
        for(let tick=1;tick<=30;tick++)s.advanceTick({tick,moveX:0,moveY:0,aimAngle:0,buttons:0});const p=s.snapshot();
        assert.equal(p.mission.lives,6-difficulty);assert.equal(api.canonicalState(api.ShooterSession.fromSnapshot(p).snapshot()),api.canonicalState(p));assert.equal(api.canonicalState(api.replayShooter(s.exportReplay()).snapshot()),api.canonicalState(p));
        report.variants.push({variant,difficulty,lives:p.mission.lives,population:p.population.swarm,saveReplay:true});
    }
    server=await preview({configFile:false,root:process.cwd(),logLevel:'error',preview:{host:'127.0.0.1',port:0}});
    browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??(existsSync("/usr/bin/chromium")?"/usr/bin/chromium":undefined),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const url=`http://127.0.0.1:${server.httpServer.address().port}/shooter.html`;
    for(const viewport of [{width:1440,height:1100},{width:390,height:844}]){
        const page=await browser.newPage({viewport,hasTouch:viewport.width<600}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
        await page.goto(url,{waitUntil:'networkidle'});await page.getByTestId('command-center').waitFor();
        assert.match(await page.getByTestId('account').textContent(),/100 点数/);assert.equal(await page.locator('canvas').count(),0);
        await page.getByTestId('armory-weapon-2').getByRole('button').click();assert.match(await page.getByTestId('account').textContent(),/20 点数/);
        await page.reload({waitUntil:'networkidle'});assert.match(await page.getByTestId('account').textContent(),/20 点数/);
        await page.getByTestId('region-1').click();await page.getByTestId('operation-start').click();await page.getByTestId('deploy').click();await page.waitForSelector('canvas');
        await page.getByTestId('toggle').click();await page.waitForFunction(()=>Number(document.querySelector('[data-testid="tick"]').textContent)>=4);await page.getByTestId('toggle').click();await page.getByTestId('save').click();
        const tick=Number(await page.getByTestId('tick').textContent());await page.reload({waitUntil:'networkidle'});await page.getByTestId('deploy').click();await page.waitForSelector('canvas');assert.equal(Number(await page.getByTestId('tick').textContent()),tick);
        assert.equal(await page.getByTestId('support-1').count(),0);assert.equal(await page.getByTestId('weapon-2').count(),0);
        await page.locator('.diagnostics summary').click();await page.getByTestId('toggle').click();await page.getByTestId('abort').click();await page.getByTestId('sortie-settle').click();await page.getByTestId('command-center').waitFor();assert.match(await page.getByTestId('operation-status').textContent(),/行动中止/);
        for(let index=0;index<3;index++){
            await page.evaluate(data=>localStorage.setItem('broguejs-shooter-s6-campaign-v1',JSON.stringify(data)),checkpoints[index]);await page.reload({waitUntil:'networkidle'});await page.getByTestId('deploy').click();await page.getByTestId('mission-result').waitFor();
            await page.getByTestId('sortie-settle').click();const account=await page.getByTestId('account').textContent();await page.reload({waitUntil:'networkidle'});assert.equal(await page.getByTestId('account').textContent(),account);assert.equal(await page.getByTestId('sortie-settle').count(),0);
            if(index===2){assert.match(await page.getByTestId('operation-status').textContent(),/行动完成/);assert.equal(await page.getByTestId('difficulty').locator('option').nth(1).isDisabled(),false);}
        }
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await page.screenshot({path:join(output,`command-${viewport.width}.png`),fullPage:true});
        report.browser.push({viewport,accountPersistence:true,deploymentCheckpoint:true,lockedSlotsAbsent:true,failureRetention:true,threeSettlements:true,noDuplicateOnRefresh:true,nextDifficulty:true,noOverflow:true,errors});await page.close();
    }
    report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack??error);console.error(error);process.exitCode=1;}
finally{writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server?.httpServer?server.httpServer.close(r):r());await source?.close();}
