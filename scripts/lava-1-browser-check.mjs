/** Real Vue/Pixi controls. Revealed terrain and removed enemies isolate geometry; no screenshots are committed. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const out=process.env.LAVA1_OUTPUT ?? '/tmp/broguejs-lava-fix/browser'; await fs.mkdir(out,{recursive:true});
const b=await chromium.launch({headless:true});const page=await b.newPage({viewport:{width:1440,height:900}});const errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_CERT_AUTHORITY_INVALID'))errors.push(m.text());});
try {
await page.goto(process.env.LAVA1_URL ?? 'http://127.0.0.1:5395');await page.locator('.title-action.primary-action').click();await page.locator('input[inputmode="numeric"]').fill('437995121');await page.locator('.begin-button').click();await page.waitForFunction(()=>window.render_game_to_text&&document.querySelector('canvas'));
const setup=await page.evaluate(async()=>{
 const {TerrainType:T}=await import('/src/engine/Map/Grid.ts');const {rng}=await import('/src/engine/Random.ts');const {logger}=await import('/src/engine/Systems/Logger.ts');const {timeSystem}=await import('/src/engine/Systems/Time.ts');window.lavaTest={T,rng,logger,timeSystem};const g=window.activeGame;
 for(let d=2;d<=4;d++){g.depth=d;g.generateDepth(false,false);}g.monsters=[];g.dormantMonsters=[];g.items=[];g.visibleMonsters.clear();g.visibleItems.clear();g.player.hp=g.player.maxHp=500;
 for(let x=0;x<g.grid.width;x++)for(let y=0;y<g.grid.height;y++){const c=g.grid.getCell(x,y);c.isVisible=c.hasMemory=c.isExplored=c.isDiscovered=true;c.rememberedLayers=[...c.layers];}
 logger.reset();g.needsRender=true;return {start:g.player.loc,target:g.levelSeeds[3].downStairsLoc,seed:g.levelSeeds[3].levelSeed};
});
await page.waitForTimeout(250);await page.screenshot({path:out+'/d4-before.png'});
async function clickCell(p){const view=await page.evaluate(()=>JSON.parse(window.render_game_to_text()).mapLayout);const box=await page.locator('canvas').boundingBox();await page.mouse.click(box.x+view.offsetX+(p.x+.5)*view.tile*view.scaleX,box.y+view.offsetY+(p.y+.5)*view.tile*view.scaleY);}
await clickCell(setup.target);await page.waitForFunction(target=>{const g=window.activeGame;return g.depth===5;},setup.target,{timeout:60000});
await page.waitForTimeout(250);const after=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));assert.equal(after.depth,5);assert.equal(after.player.hp,500);await fs.writeFile(out+'/d4-after.json',JSON.stringify(after,null,2));await page.screenshot({path:out+'/d4-after.png'});
await page.evaluate(()=>{const {T,logger}=window.lavaTest;const g=window.activeGame;g.stopAutoTravel();g.monsters=[];g.dormantMonsters=[];g.items=[];g.visibleMonsters.clear();g.visibleItems.clear();g.player.loc={x:10,y:10};for(let x=7;x<15;x++)for(let y=7;y<15;y++)g.grid.setTerrain(x,y,T.FLOOR);g.grid.setTerrain(11,10,T.WALL);g.grid.setTerrain(10,11,T.LAVA);g.updateVision();logger.reset();g.needsRender=true;});
const state=()=>page.evaluate(()=>{const g=window.activeGame,{rng,timeSystem}=window.lavaTest;return {loc:{...g.player.loc},turn:g.absoluteTurnNumber,tick:timeSystem.currentTick,rng:rng.getState()};});const before=await state();await page.keyboard.press('n');assert.deepEqual(await state(),before);
await page.evaluate(()=>{const g=window.activeGame;g.grid.setTerrain(11,10,window.lavaTest.T.FLOOR);g.updateVision();g.needsRender=true;});await page.keyboard.press('n');assert.deepEqual((await state()).loc,{x:11,y:11});
await page.waitForTimeout(250);await page.screenshot({path:out+'/corner-unblocked.png'});await fs.writeFile(out+'/results.json',JSON.stringify({setup,arrived:{depth:after.depth,player:after.player},blockedCommandPreservedState:true,lavaDiagonalWithoutWallAllowed:true,errors},null,2));assert.deepEqual(errors,[]);
console.log(JSON.stringify({setup,arrived:{depth:after.depth,x:after.player.x,y:after.player.y},errors}));
} catch(error) {await page.screenshot({path:out+'/failure.png'});await fs.writeFile(out+'/failure.json',await page.evaluate(()=>JSON.stringify({view:JSON.parse(window.render_game_to_text()),path:window.activeGame.autoPath,disturbed:window.activeGame.disturbed,logs:window.lavaTest.logger.messages},null,2)));throw error;} finally {await b.close();}
