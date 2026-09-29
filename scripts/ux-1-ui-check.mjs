/** Narrow DOM regression harness: real Vue components / real DOM keyboard and touch events.
 * Game generation is replaced with a controlled UI port; engine semantics have their own suites.
 * Run: node scripts/ux-1-ui-check.mjs [--baseline]
 */
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium } from 'playwright';

const baseline = process.argv.includes('--baseline');
const fakeGame = `
export const activeGame = {
  player: { inventory: {items: []}, effectiveStrength: 12, hp: 1, maxHp: 20, nutrition: 1000, maxNutrition: 2000,
    equippedWeapon:null, equippedArmor:null, ringLeft:null, ringRight:null },
  isInventoryOpen:false, inventoryAction:null, pendingIdentify:false, pendingEnchantment:false,
  pendingUseConfirm:null, replayRecording:null, isAdvancing:false, isGameOver:false,
  gameOverWon:false, gameOverReason:'Death fixture', gameOverScore:10, gameOverInventory:[],
  stats:{kills:0,gold:0,turns:1,maxDepth:4}, absoluteTurnNumber:1, commands:[],
  malevolentUseConfirmPrompt:()=> 'Confirm fixture', itemCallMode:()=> 'kind', canEnchantTarget:item=>item.category===0,
  chooseEnchantTarget(item) { if(this.canEnchantTarget(item)) this.pendingEnchantment=false; },
  executeItemCommand(action,item,data,perform) {
    if(item && !this.player.inventory.items.includes(item)) throw new Error('Stale inventory item reference');
    this.commands.push([action,item?.inventoryLetter,data]);
    if(perform) perform();
    if(action==='identify' && item?.canBeIdentified) this.pendingIdentify=false;
    if(action==='cancel'||action==='confirm') this.pendingUseConfirm=null;
    if(action==='equip' && item?.category===8 && data) this.player.ringLeft=item;
  },
  handlePlayerAction(action,data) {
    if(this.isAdvancing) return;
    this.commands.push([action,data]);
    if(action==='toggle_inventory') this.isInventoryOpen=!this.isInventoryOpen;
    if(action==='escape'&&!this.pendingIdentify&&!this.pendingEnchantment) {this.isInventoryOpen=false;this.inventoryAction=null;}
    if(action==='inventory_action') {this.isInventoryOpen=true;this.inventoryAction=data;}
  }
};`;
const harness = `
import {createApp,h,reactive} from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import {inputManager} from '/src/engine/Input.ts';
import {activeGame} from '/src/engine/Core/Game';
import {logger} from '/src/engine/Systems/Logger.ts';
import {Item,ItemCategory} from '/src/engine/Items/Item.ts';
import Inventory from '/src/components/InventoryOverlay.vue';
import End from '/src/components/GameEndOverlay.vue';
import Ack from '/src/components/MessageAcknowledgment.vue';
import Detail from '/src/components/DetailPanel.vue';
import '/src/assets/main.css';
await i18next.init({lng:'en',resources:{},initImmediate:false});
const props=reactive({canSaveReplay:true,replayBusy:false,replayFeedback:''});
const events=[];
inputManager.setCallback((action,data)=>activeGame.handlePlayerAction(action,data));
const app=createApp({render:()=>h('div',[h(Inventory),h(End,{...props,
 onReturnToTitle:()=>{events.push('return');activeGame.isGameOver=false;},
 onSaveReplay:()=>events.push('save'),onExportReplayJson:()=>events.push('export')}),h(Ack),h(Detail)])});
app.use(I18NextVue,{i18next});app.mount('#app');
function reset(mode=null) {
 activeGame.commands=[];activeGame.isInventoryOpen=true;activeGame.inventoryAction=mode;
 activeGame.inspectTarget=null;activeGame.pendingIdentify=false;activeGame.pendingEnchantment=false;activeGame.pendingUseConfirm=null;
 activeGame.isGameOver=false;activeGame.isAdvancing=false;activeGame.player.equippedWeapon=null;activeGame.player.ringLeft=null;activeGame.player.ringRight=null;
 logger.reset();
 activeGame.player.inventory.items='abcdefghijklmnopqrstuvwxyz'.split('').map(letter=>{
   const item=new Item('Item '+letter,')',0xffffff,ItemCategory.WEAPON);item.inventoryLetter=letter;item.canBeIdentified=true;return item;
 });
}
window.ux={game:activeGame,logger,props,events,reset,app,ItemCategory};
`;
const server = await createServer({configFile:false,plugins:[{
 name:'ux1-ui-controlled-game',enforce:'pre',
 resolveId(id){if(id.endsWith('/Core/Game')||id.endsWith('/Core/Game.ts'))return '\0ux1-game';if(id==='/ux1-harness.js')return '\0ux1-harness';},
 load(id){if(id==='\0ux1-game')return fakeGame;if(id==='\0ux1-harness')return harness;},
 configureServer(server){server.middlewares.use((req,res,next)=>{
 if(req.url==='/ux1-ui'){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="app"></div><script type="module" src="/ux1-harness.js"></script>');}else next();
 });}
},vue()],server:{host:'127.0.0.1',port:0}});
await server.listen();
const browser = await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const page=await context.newPage();
const touchSession=await context.newCDPSession(page);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=server.resolvedUrls.local[0]+'ux1-ui';
const commands=()=>page.evaluate(()=>window.ux.game.commands);
const reset=async mode=>{await page.evaluate(mode=>window.ux.reset(mode),mode);await page.waitForTimeout(150);};
try {
 await page.goto(url);await page.waitForFunction(()=>!!window.ux);
 await reset();await page.keyboard.press('d');await page.waitForTimeout(150);
 if(baseline){
  assert.equal(await page.locator('.selected-row').count(),0);
  assert.deepEqual(await commands(),[['inventory_action','drop']]);
  await page.evaluate(()=>{window.ux.game.isInventoryOpen=false;window.ux.game.isGameOver=true;window.ux.logger.log('Long warning '.repeat(1000),'#fff',{acknowledge:true});});
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.game-end-overlay').count(),1);
  assert.equal(await page.locator('.message-ack-backdrop').count(),1);
  const touch=await page.locator('.message-ack-backdrop').evaluate(el=>getComputedStyle(el).touchAction);
  assert.equal(touch,'none');
  console.log(JSON.stringify({baseline:{inventoryCommands:await commands(),endAndAckOverlap:true,ackTouchAction:touch},errors}));
 } else {
  assert.deepEqual(await commands(),[]);assert.equal(await page.locator('.selected-row .item-letter').textContent(),'d)');
  // Release before a second press: details actions target the selected item.
  await page.keyboard.press('d');assert.deepEqual((await commands())[0],['drop','d',undefined]);
  for(const letter of ['a','e','i','h','j','k','l','x']){
   await reset();await page.keyboard.press(letter);
   assert.equal(await page.locator('.selected-row .item-letter').textContent(),letter+')');assert.deepEqual(await commands(),[]);
  }
  await reset();await page.keyboard.down('d');await page.keyboard.down('d');await page.keyboard.up('d');
  assert.deepEqual(await commands(),[]);
  await page.keyboard.press('Escape');assert.equal(await page.locator('.selected-row').count(),0);
  await page.keyboard.press('Escape');await page.waitForTimeout(150);assert.equal(await page.locator('.inventory-overlay').count(),0);
  await page.keyboard.press('d');assert.deepEqual((await commands()).at(-1),['inventory_action','drop']);
  await reset('drop');await page.keyboard.press('h');assert.deepEqual((await commands())[0],['drop','h',undefined]);
  await reset();await page.evaluate(()=>{window.ux.game.pendingIdentify=true;window.ux.game.player.inventory.items[3].canBeIdentified=false;});
  await page.keyboard.press('d');assert.deepEqual(await commands(),[]);await page.keyboard.press('h');assert.equal((await commands())[0][0],'identify');
  await reset();await page.evaluate(()=>window.ux.game.pendingEnchantment=true);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.ux.game.isInventoryOpen),true);
  await page.keyboard.press('d');assert.deepEqual((await commands())[0],['enchant','d',undefined]);
  await reset('equip');await page.evaluate(()=>{const g=window.ux.game;for(const i of [0,1,3])g.player.inventory.items[i].category=8;g.player.ringLeft=g.player.inventory.items[0];g.player.ringRight=g.player.inventory.items[1];});
  await page.keyboard.press('d');await page.keyboard.press('a');assert.deepEqual((await commands()).filter(c=>c[0]==='equip'),[['equip','d',undefined],['equip','d','a']]);
  await reset();await page.keyboard.press('d');await page.keyboard.press('c');
  await page.locator('.call-input').fill('adhijk');await page.keyboard.press('Enter');assert.deepEqual((await commands())[0],['call','d','adhijk']);
  await reset();await page.evaluate(()=>window.ux.game.inspectTarget={name:'Detail fixture',char:')',color:0xffffff,sections:[]});
  await page.keyboard.press('x');assert.deepEqual(await commands(),[]);assert.equal(await page.locator('.selected-row .item-letter').textContent(),'x)');
  await page.evaluate(()=>window.ux.game.inspectTarget={name:'Detail fixture',char:')',color:0xffffff,sections:[]});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.ux.game.inspectTarget),null);assert.equal(await page.evaluate(()=>window.ux.game.isInventoryOpen),true);
  // Loading a saved pack replaces Player and Item objects but retains item ids.
  // Neither selected/call references nor a deferred close may cross that boundary.
  await reset();await page.keyboard.press('d');await page.keyboard.press('c');
  const replacePlayer=async()=>page.evaluate(()=>{const g=window.ux.game;const items=g.player.inventory.items.map(item=>Object.assign(Object.create(Object.getPrototypeOf(item)),item));g.player={...g.player,inventory:{items}};});
  await replacePlayer();await page.waitForTimeout(150);
  assert.equal(await page.locator('.selected-row').count(),0);assert.equal(await page.locator('.call-input').count(),0);
  await page.keyboard.press('d');await page.keyboard.press('d');assert.deepEqual((await commands())[0],['drop','d',undefined]);
  await reset();await page.evaluate(()=>window.ux.game.isAdvancing=true);await page.locator('.close-btn').click();
  await replacePlayer();await page.evaluate(()=>window.ux.game.isAdvancing=false);await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>window.ux.game.isInventoryOpen),true);assert.deepEqual(await commands(),[]);
  // Confirmation capture remains higher priority than the modal, even though Input registered first.
  await reset();await page.evaluate(()=>window.ux.logger.log('Warning','#fff',{acknowledge:true}));await page.waitForTimeout(75);
  await page.keyboard.press('d');assert.deepEqual(await commands(),[]);assert.equal(await page.locator('.selected-row').count(),0);
  for(const viewport of [{width:390,height:844},{width:844,height:390}]){
   await page.setViewportSize(viewport);
   await page.evaluate(()=>{const {game,logger}=window.ux;game.isInventoryOpen=false;game.isGameOver=true;game.gameOverInventory=Array.from({length:30},(_,i)=>({name:'Inventory '+i,category:0,enchantment:0,color:0xffffff}));logger.log('Long warning '.repeat(1000),'#fff',{acknowledge:true});logger.log('Second warning','#fff',{acknowledge:true});});
   await page.waitForTimeout(250);assert.equal(await page.locator('.game-end-overlay').count(),0);
   assert.notEqual(await page.locator('.message-ack-backdrop').evaluate(el=>getComputedStyle(el).touchAction),'none');
   const paragraph=page.locator('.message-ack p');const paragraphBox=await paragraph.boundingBox();
   const touchX=paragraphBox.x+paragraphBox.width/2, touchY=paragraphBox.y+Math.min(paragraphBox.height-5,120);
   await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchX,y:touchY}]});
   for(let step=1;step<=5;step++){
    await touchSession.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchX,y:touchY-step*16}]});
    await page.waitForTimeout(20);
   }
   await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(120);
   assert.ok(await paragraph.evaluate(el=>el.scrollTop)>0,'Long acknowledgment must scroll by touch');
   const ack=page.locator('.message-ack button');const box=await ack.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=viewport.height);
   await ack.tap();await ack.tap();await page.waitForTimeout(250);assert.equal(await page.locator('.game-end-overlay').count(),1);
   await page.locator('.save-replay-btn').tap();await page.locator('.export-replay-btn').tap();
   await page.evaluate(()=>window.ux.props.replayBusy=true);assert.equal(await page.locator('.save-replay-btn').isDisabled(),true);assert.equal(await page.locator('.return-btn').isDisabled(),true);
   await page.evaluate(()=>{window.ux.props.replayBusy=false;window.ux.props.canSaveReplay=false;});assert.equal(await page.locator('.export-replay-btn').isDisabled(),true);
   await page.evaluate(()=>window.ux.props.canSaveReplay=true);
   await page.locator('.return-btn').tap();await page.waitForTimeout(250);assert.equal(await page.locator('.game-end-overlay').count(),0);
  }
  assert.deepEqual(await page.evaluate(()=>window.ux.events),['save','export','return','save','export','return']);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'passed',viewports:['390x844','844x390'],checks:'inventory routing, held key, forced selections, ring replacement, text entry, ack priority, long message reachability, replay emits and disabled state, return',errors}));
 }
} finally {await browser.close();await server.close();}
