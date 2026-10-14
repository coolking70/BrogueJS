/** Bounded real-host C6 measurements, outside test manifests. */
import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
import os from 'node:os';
import assert from 'node:assert/strict';
assert.equal(process.version,'v24.19.0');assert.equal(process.env.NODE_OPTIONS,'--max-old-space-size=3072');
const server=await createServer({root:process.cwd(),configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false,ws:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]}});
const load=p=>server.ssrLoadModule(p), stats=times=>{times.sort((a,b)=>a-b);return {samples:times.length,medianMs:times[Math.floor(times.length/2)],p95Ms:times[Math.ceil(times.length*.95)-1],maxMs:times.at(-1)};};
function bench(fn,n=500,warm=50){for(let i=0;i<warm;i++)fn();const times=[];for(let i=0;i<n;i++){const t=performance.now();fn();times.push(performance.now()-t);}return stats(times);}
try{
 const {createItemHarness}=await load('/src/ext/testing/itemHarness.ts'),{completeDescriptor,createItemCompleteFixture}=await load('/src/ext/testing/fixtures/itemFixture/index.ts');
 const {assembleDropItem}=await load('/src/engine/Items/FixedItemAssembly.ts'),{Monster}=await load('/src/entities/Monster.ts'),{markCreatureBirth}=await load('/src/ext/birth.ts'),{default:monsters}=await load('/src/data/monsters.json');
 const spec=(kind='dagger',category='weapon')=>({native:{kind,category,enchantment:0,runicType:null,isCursed:false,identified:false,familiarityRemaining:20},moduleData:{c6fixture:{v:1,known:false,power:1}}});
 let providerCollects=0;
 const h=createItemHarness({seed:42,mode:'easy'},[{...completeDescriptor,create:()=>{const m=createItemCompleteFixture();return {...m,statSources:{...m.statSources,collect(...args){providerCollects++;return m.statSources.collect(...args);}},itemDrops:{...m.itemDrops,sources:['kill'],roll:(_e,c)=>({v:1,converted:true,items:Array.from({length:8},(_,i)=>{c.beginItem(i);c.randomInt(1,3);return spec();}),gold:0,uniqueIds:Array(8).fill(null)})}};}}]),g=h.game();
 const items=[assembleDropItem(spec()),assembleDropItem(spec('leather_armor','armor')),assembleDropItem(spec('ring_of_regeneration','ring')),assembleDropItem(spec('ring_of_regeneration','ring')),assembleDropItem(spec())];
 for(const i of items)g.player.inventory.addItem(i);for(const i of items.slice(0,4))g.player.equip(i);g.player.setStatusDuration('donning',0);const r=g.extensionRuntime;
 const cached=bench(()=>r.stats.value(g.player.id,'native.damage-min'));
 const uncached=bench(()=>{r.stats.clear();r.stats.value(g.player.id,'native.damage-min');});
 const hypothetical=bench(()=>r.stats.hypothetical(g.player.id,{unequip:items[0].id,equip:items[4].id},true),100,10);
 const beforeCollects=providerCollects;r.stats.hypothetical(g.player.id,{unequip:items[0].id,equip:items[4].id},true);const collectsPerComparison=providerCollects-beforeCollects;
 const {ItemLoader}=await load('/src/engine/Items/ItemLoader.ts');
 r.bindItemData(items[1]);ItemLoader.identifyInstance(items[1]);items[1].charges=100000;
 const countdown=assembleDropItem(spec('leather_armor','armor'));countdown.charges=100000;g.player.inventory.addItem(countdown);r.bindItemData(countdown);
 let familiarityCheckpoints=0;const checkpoint=g.checkpointCombatFactWorld.bind(g);g.checkpointCombatFactWorld=(...args)=>{familiarityCheckpoints++;return checkpoint(...args);};
 const familiarityNoop=bench(()=>assert.equal(ItemLoader.decrementWornFamiliarity(items[1]),null));
 const familiarityCountdown=bench(()=>assert.equal(ItemLoader.decrementWornFamiliarity(countdown),null));assert.equal(familiarityCheckpoints,0);g.checkpointCombatFactWorld=checkpoint;
 const phases={checkpoint:0,drop:0},phaseSamples={checkpoint:[],drop:[]};
 for(const [method,key] of [['checkpointCombatFactWorld','checkpoint'],['spawnExtensionDrop','drop']]){const original=g[method].bind(g);g[method]=(...args)=>{const t=performance.now();try{return original(...args);}finally{phases[key]+=performance.now()-t;}};}
 const victim=new Monster(g.player.x+1,g.player.y,monsters.find(m=>m.id==='rat'));markCreatureBirth(victim,'natural');g.monsters.push(victim);r.attachCreature(victim);const saved=g.toSnapshot(),times=[];
 for(let i=0;i<28;i++){const m=g.monsters.find(m=>m.id===victim.id),before=g.items.length;phases.checkpoint=phases.drop=0;const t=performance.now();g.killMonster(m);const duration=performance.now()-t;assert.equal(g.items.length-before,8);if(i>=3){times.push(duration);phaseSamples.checkpoint.push(phases.checkpoint);phaseSamples.drop.push(phases.drop);}assert.ok(g.loadSnapshot(saved));}
 const result={node:process.version,cpu:os.cpus()[0].model,platform:`${os.platform()}-${os.arch()}`,cached,uncached,hypothetical,collectsPerComparison,familiarityNoop,familiarityCountdown,familiarityCheckpoints,eightItemDeathCommit:stats(times),phaseWallTime:{checkpoint:stats(phaseSamples.checkpoint),dropService:stats(phaseSamples.drop)},scope:'4 C6 equipped items; one owner. Cached/uncached values include signature validation; hypothetical all keys known-only. 8-drop includes real Game death checkpoint, 8 draws, schema/owner validation, placement, assembly, acceptance, settlement and publication; reset/load outside timer. Pure loot catalog generation absent. No isolated-machine guarantee.'};
 const output='/private/tmp/phase6a1-perf.json';await writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({output,...result}));h.dispose();
}finally{await server.close();}
