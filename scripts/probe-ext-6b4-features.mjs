/** Controlled micro-scenes, not natural gameplay or a replacement for P0.
 * Three identical inputs per scene; queries must open no transactions. */
import assert from 'node:assert/strict';
import {boot,write,hash} from './ext-perf-common.mjs';
const [out]=process.argv.slice(2);assert.ok(out);Date.now=()=>1792112400000;
const {server,load,logger}=await boot();
try{
 const {createWorldHarness,worldHarnessGame}=await load('ext/testing/worldHarness.ts');
 const {resolveLootCatalog}=await load('ext/modules/loot/session.ts'),{deriveNativeFacts}=await load('ext/modules/loot/item.ts');
 const {assembleDropItem}=await load('engine/Items/FixedItemAssembly.ts'),{ItemLoader}=await load('engine/Items/ItemLoader.ts');
 const {nativeStat}=await load('engine/Stats/NativeStatSources.ts'),{rng}=await load('engine/Random.ts');
 const {Monster}=await load('entities/Monster.ts'),monsters=(await load('data/monsters.json')).default;
 const {auditFullObjectGraph}=await load('test/support/fullGenerationCheckpointOracle.ts');const results={};
 for(const scene of ['enhance','refine','effect','query']){
  const runs=[];
  for(let run=0;run<3;run++){
   const h=createWorldHarness({seed:42,mode:'easy',modules:['growth','loot']}),g=worldHarnessGame(h),r=g.extensionRuntime,c=resolveLootCatalog(r.queryOptional.bind(r));
   const a=c.affixes.find(a=>a.rune?.runicType==='absorption');
   const d={v:2,baseId:'leather_armor',ilvl:40,rarity:'magic',uniqueId:null,setId:null,affixes:[{id:'loot.affix.reinforced',tier:1,values:[1000],known:false},{id:a.id,tier:1,values:a.tiers[0].ranges.map(r=>r[0]),known:false}],corrupted:false,enhancement:scene==='refine'?8:7,sockets:0,socketed:[],nameParts:null,origin:{source:'floor',depth:1}},n=deriveNativeFacts(d,c);
   const item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:false,identified:false,familiarityRemaining:1000},moduleData:{loot:d}});g.player.inventory.addItem(item);r.bindItemData(item);g.player.equip(item);
   const counts={};for(const [object,key]of [[r,'transaction'],[r,'itemCommandTransaction'],[g,'collectExtensionComponents']]){const original=object[key];assert.equal(typeof original,'function');counts[key]=0;object[key]=function(...args){counts[key]++;return original.apply(this,args);};}
   while(logger.pendingAcknowledgment)logger.acknowledgeNext();
   nativeStat(g.player,'native.armor-runic-power');r.stats.hypothetical(g.player.id,{},true);const random=rng.getState(),audit=scene==='query'?auditFullObjectGraph([g,rng]):null;
   if(scene==='query'){for(let i=0;i<100;i++){nativeStat(g.player,'native.armor-runic-power');r.stats.hypothetical(g.player.id,{},true);r.itemEnhancementLimit(item);}assert.deepEqual(audit.differences(),[]);assert.deepEqual(counts,{transaction:0,itemCommandTransaction:0,collectExtensionComponents:0});}
   else if(scene==='effect'){const target=new Monster(g.player.x+1,g.player.y,monsters.find(m=>m.id==='rat'));g.monsters.push(target);r.attachCreature(target);assert.ok(g.tryTriggerArmorRunic(target,10,true)<10);assert.equal(item.moduleData.loot.affixes[1].known,true);}
   else{const scroll=ItemLoader.spawnScroll('scroll_of_enchantment',-1,-1);g.player.inventory.addItem(scroll);ItemLoader.identifyItemKind(scroll);g.executeItemCommand('read',scroll);assert.equal(g.pendingEnchantment,true);g.executeItemCommand('enchant',item);assert.equal(g.player.inventory.items.includes(scroll),false);assert.equal(item.timesEnchanted,1);assert.equal(item.moduleData.loot.enhancement,8);}
   const end=rng.getState();runs.push({counts,substantiveDraws:end.randomNumbersGenerated-random.randomNumbersGenerated,cosmeticDraws:end.cosmeticNumbersGenerated-random.cosmeticNumbersGenerated,itemHash:hash(item.moduleData)});h.dispose();
  }
  assert.deepEqual(runs[1],runs[0]);assert.deepEqual(runs[2],runs[0]);results[scene]=runs;
 }
 write(out,results);console.log(JSON.stringify(results));
}finally{await server.close();}
