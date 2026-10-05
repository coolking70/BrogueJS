#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createServer,preview} from 'vite';
import {chromium} from 'playwright';
import {missionPilot} from './shooter-mission-route.mjs';
const args=process.argv.slice(2), output=resolve(args.includes('--output')?args[args.indexOf('--output')+1]:'../shooter-s5-evidence');mkdirSync(output,{recursive:true});
const report={schema:1,node:process.version,engine:[],browser:[]};let source,server,browser;
try{
 source=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'error',optimizeDeps:{noDiscovery:true,include:[]}});
 const api=await source.ssrLoadModule('/src/products/shooter/ShooterSession.ts'),arena=await source.ssrLoadModule('/src/products/shooter/ShooterArena.ts');
 const catalog=await source.ssrLoadModule('/src/ext/realtimeCatalog.ts'),scenario=catalog.getRealtimeModules().find(d=>d.kind==='mission').scenario;
 const {moveCircle}=await source.ssrLoadModule('/src/engine/Movement/KinematicCollision.ts'),{SpatialHash}=await source.ssrLoadModule('/src/engine/Movement/SpatialHash.ts'),{raycast}=await source.ssrLoadModule('/src/engine/Movement/SpatialQuery.ts');
 if(!args.includes('--browser-only')){
  const s=new api.ShooterSession(7301),grid=arena.createScenarioArena(scenario),pilot=missionPilot(s,grid,{optional:false,raycast,moveCircle,SpatialHash}),counts=[0,0,0,0],cpu=[];
  while(!s.finished){
   const state=s.snapshot(),p=state.actors[0].pose,input=pilot(state),tick=input.frame.tick;
   if(state.damage.actors[0].hp){
    for(const slot of [0,1,3]) if(state.support.abilities[slot].remaining===0){input.commands.push({tick,kind:'support',slot,x:p.x,y:p.y});counts[slot]++;}
    if(state.support.abilities[2].remaining===0){
     const target=state.actors.filter(a=>a.id!==1&&state.damage.actors[a.id-1].hp&&a.kind!=='objective'&&(a.pose.x-p.x)**2+(a.pose.y-p.y)**2>5120**2&&(a.pose.x-p.x)**2+(a.pose.y-p.y)**2<11264**2&&grid.getCell(Math.floor(a.pose.x/1024),Math.floor(a.pose.y/1024))?.isPassable)
      .sort((a,b)=>a.id-b.id)[0];
     if(target){input.commands.push({tick,kind:'support',slot:2,x:target.pose.x,y:target.pose.y});counts[2]++;}
    }
    if(state.support.nearbySupply && !input.commands.some(c=>c.kind==='interact'))input.commands.push({tick,kind:'interact'});
   }
   const start=performance.now();s.advanceTick(input.frame,input.commands);s.snapshot();cpu.push(performance.now()-start);
   if(s.tick%3000===0)console.log(JSON.stringify({tick:s.tick,stats:s.snapshot().stats,calls:counts}));
  }
  const final=s.snapshot(),replay=s.exportReplay();writeFileSync(join(output,'mission-replay.json'),JSON.stringify(replay));assert.equal(final.mission.status,'success');assert.ok(s.tick>=18000&&s.tick<=27000);assert.ok(counts.every(n=>n>0));
  assert.equal(api.canonicalState(api.replayShooter(replay).snapshot()),api.canonicalState(final));assert.equal(api.canonicalState(api.ShooterSession.fromSnapshot(final).snapshot()),api.canonicalState(final));
  cpu.sort((a,b)=>a-b);report.engine.push({fullDefaultMission:true,ticks:s.tick,seconds:s.tick/30,stats:final.stats,calls:counts,reward:final.mission.reward,exactRestoreReplay:true,cpuMs:Object.fromEntries([50,95,99].map(n=>['p'+n,cpu[Math.floor(cpu.length*n/100)]]))});
  writeFileSync(join(output,'engine.json'),JSON.stringify(report.engine,null,2));
 }
 if(!args.includes('--engine-only')){
  server=await preview({configFile:false,root:process.cwd(),logLevel:'error',preview:{host:'127.0.0.1',port:0}});
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const viewport of [{width:1440,height:1100},{width:390,height:844}]){
   const page=await browser.newPage({viewport,hasTouch:viewport.width<600}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/shooter.html`,{waitUntil:'networkidle'});if(await page.getByTestId('training').count())await page.getByTestId('training').click(); await page.waitForSelector('canvas');await page.locator('.diagnostics summary').click();
   // A support-only authored lab is selected through the ordinary module UI.
   for(const d of catalog.getRealtimeModules())await page.getByTestId('module-'+d.id).setChecked(d.kind==='support'||d.kind==='ranged');
   await page.getByTestId('restart').click();await page.getByTestId('toggle').click();
   await page.getByTestId('movement-canvas').scrollIntoViewIfNeeded();let rect=await page.getByTestId('movement-canvas').boundingBox();
   await page.mouse.move(rect.x+rect.width*.7,rect.y+rect.height*.5);await page.mouse.down();await page.waitForTimeout(90);await page.mouse.up();
   if(viewport.width>600)await page.keyboard.press('Digit5');else await page.getByTestId('support-0').tap();
   await page.getByTestId('movement-canvas').scrollIntoViewIfNeeded();rect=await page.getByTestId('movement-canvas').boundingBox();
   const ground=await page.getByTestId('movement-canvas').evaluate(el=>({x:5632*Number(el.dataset.cameraScaleX)+Number(el.dataset.cameraX),y:10752*Number(el.dataset.cameraScaleY)+Number(el.dataset.cameraY)}));
   // The player spawn projects through the actual, clamped camera.
   if(viewport.width>600)await page.mouse.click(rect.x+ground.x,rect.y+ground.y);else await page.touchscreen.tap(rect.x+ground.x,rect.y+ground.y);
   assert.equal(await page.getByTestId('support-confirm').isEnabled(),true);
   if(viewport.width>600)await page.keyboard.press('KeyF');else await page.getByTestId('support-confirm').tap();
   await page.waitForFunction(()=>document.querySelector('[data-testid="support-notice"]')?.textContent.includes('已确认'));
   if(viewport.width>600)await page.keyboard.press('KeyR');else await page.getByTestId('reload').tap();
   await page.waitForSelector('[data-testid="player-progress-reload"]');
   const overlap=(a,b)=>a&&b&&Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);
   await page.waitForTimeout(80);assert.equal(overlap(await page.getByTestId('player-progress-reload').boundingBox(),await page.getByTestId('support-world-1').boundingBox()),false,'Support arrival label must not hide reload progress');
   await page.getByTestId('movement-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:join(output,`inbound-${viewport.width}.png`)});
   await page.waitForFunction(()=>document.querySelector('[data-testid="interact-control"]')?.textContent.includes('领取补给'),null,{timeout:8000});
   rect=await page.getByTestId('movement-canvas').boundingBox();await page.mouse.click(rect.x+rect.width*.7,rect.y+rect.height*.5);
   if(viewport.width>600)await page.keyboard.press('KeyE');else await page.getByTestId('interact-control').tap();
   await page.waitForFunction(()=>document.querySelector('[data-testid="support-notice"]')?.textContent.includes('已领取'));
   await page.getByTestId('support-1').click();await page.getByTestId('support-cancel').click();assert.equal(await page.getByTestId('support-target-controls').count(),0);
   await page.getByTestId('support-2').click();assert.match(await page.getByTestId('support-target-controls').textContent(),/伤到自己/);await page.getByTestId('support-cancel').click();
   // Standard mapping: LB selects next available, right stick aims, RB confirms.
   await page.evaluate(()=>{window.__s5pad={connected:true,mapping:'standard',axes:[0,0,1,0],buttons:Array.from({length:8},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.__s5pad]});window.__s5pad.buttons[4]={pressed:true,value:1};});
   await page.waitForSelector('[data-testid="support-target-controls"]');await page.evaluate(()=>{window.__s5pad.buttons[4]={pressed:false,value:0};window.__s5pad.buttons[5]={pressed:true,value:1};});
   await page.waitForFunction(()=>!document.querySelector('[data-testid="support-target-controls"]'));await page.evaluate(()=>{window.__s5pad.connected=false;});
   await page.getByTestId('support-3').click();await page.getByTestId('support-confirm').click();await page.waitForTimeout(1150);
   assert.equal(overlap(await page.getByTestId('support-world-2').boundingBox(),await page.getByTestId('support-world-3').boundingBox()),false,'Coincident turret and scan labels must stack');
   await page.getByTestId('toggle').click();await page.getByTestId('save').click();const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('broguejs-shooter-s6-checkpoint-v7')));
   assert.ok(saved.support.deployments.some(d=>d.slot===3));assert.equal(saved.support.deployments.find(d=>d.slot===0).charges,1);
   const download=page.waitForEvent('download');await page.getByTestId('export').click();const replay=JSON.parse(readFileSync(await(await download).path(),'utf8'));
   assert.equal(api.canonicalState(api.replayShooter(replay).snapshot()),api.canonicalState(saved));
   await page.getByTestId('step').click();await page.getByTestId('load').click();await page.getByTestId('verify').click();assert.match(await page.getByTestId('message').textContent(),/重放验证通过/);
   await page.locator('input[type=file]').setInputFiles({name:'support.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(replay))});await page.waitForFunction(()=>document.querySelector('[data-testid="message"]')?.textContent.includes('录像已验证'));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await page.getByTestId('movement-canvas').scrollIntoViewIfNeeded();await page.screenshot({path:join(output,`support-${viewport.width}.png`),fullPage:true});
   report.browser.push({viewport,keyboardOrTouchSelection:true,groundTarget:true,supplyPickup:true,cancel:true,dangerWarning:true,standardPadCall:true,scan:true,labelsAvoidReload:true,coincidentLabelsStack:true,exactCheckpointReplayImport:true,noOverflow:true,errors});await page.close();
  }
 }
 report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack??error);console.error(error);process.exitCode=1;}
finally{writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server?.httpServer?server.httpServer.close(r):r());await source?.close();}
