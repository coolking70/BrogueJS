/** Bounded C1 supplement; controlled legal items, never a natural-loot witness.
 * Cloud runner only in the formal gate. Does not replace complete classic/all. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {boot,write,stats} from './ext-perf-common.mjs';
const out=process.argv[2];assert.ok(out);
const {server,load}=await boot();
try {
 const {getInstalledModuleDescriptors}=await load('ext/catalog.ts');
 const descriptor=getInstalledModuleDescriptors().find(d=>d.id==='loot');assert.ok(descriptor);
 // The same C1 scene runs on C1 or C2 sources; only its native data version
 // changes. Unknown schemas fail closed instead of weakening item validation.
 const itemVersion={'0.6.0':3,'0.7.0':4,'0.8.0':5,'0.9.0':6,'0.9.1':6}[descriptor.version];assert.ok(itemVersion,'Unsupported loot fixture version');
 const {createWorldHarness,worldHarnessGame}=await load('ext/testing/worldHarness.ts');
 const {loadLootPack}=await load('ext/modules/loot/definitions.ts');
 const {buildEffectiveLootCatalog}=await load('ext/modules/loot/catalog.ts');
 const {deriveNativeFacts}=await load('ext/modules/loot/item.ts');
 const {assembleDropItem}=await load('engine/Items/FixedItemAssembly.ts');
 const {readLootGameView}=await load('ext/modules/loot/gameView.ts');
 const {rng}=await load('engine/Random.ts');
 const {getNextEntityId}=await load('entities/Creature.ts');
 const {auditFullObjectGraph}=await load('test/support/fullGenerationCheckpointOracle.ts');
 const catalog=buildEffectiveLootCatalog(loadLootPack(),{combat:null,growth:null,giants:null}),runs=[];
 for(let round=1;round<=3;round++){
  let collections=0,rows=0;
  const measured={...descriptor,create:()=>{const module=descriptor.create(),provider=module.statSources;return {...module,statSources:{...provider,collect:(...args)=>{collections++;const result=provider.collect(...args);rows+=result.length;return result;}}};}};
  const h=createWorldHarness({seed:42,mode:'easy',modules:['loot']},[measured]),g=worldHarnessGame(h),runtime=g.extensionRuntime;
  const add=id=>{const {setId,piece:p}=catalog.piecesById['loot.piece.'+id],data={v:itemVersion,baseId:p.baseId,ilvl:20,rarity:'set',uniqueId:null,setId,pieceId:p.id,identityKnown:true,affixes:p.rows.map(r=>({id:r.rowId,tier:0,values:r.ranges.map(v=>v[0]),known:true})),corrupted:false,enhancement:0,sockets:0,socketed:[],nameParts:null,origin:{source:'floor',depth:14}},n=deriveNativeFacts(data,catalog);
   const item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:1000},moduleData:{loot:data}});assert.ok(g.player.inventory.addItem(item));runtime.bindItemData(item);return item;};
  const items=['wanderer.blade','wanderer.coat','wanderer.lamp','wanderer.watch'].map(add),mixed=add('bastion.guard');
  let transactions=0;const original=runtime.transaction;runtime.transaction=function(...args){transactions++;return original.apply(this,args);};
  const reads=[],counts=[];
  // 1→2→3→4→3→2→1→2→3→4, followed by both mixed-ring comparisons.
  const transitions=[['equip',0],['equip',1],['equip',2],['equip',3],['unequip',3],['unequip',2],['unequip',1],['equip',1],['equip',2],['equip',3]];
  for(const [action,index]of transitions){
   g.executeItemCommand(action,items[index]);
   const coldCollections=collections,coldRows=rows,d={...runtime.stats.diagnostics},t=performance.now();readLootGameView(g,mixed.id,[]);const coldMs=performance.now()-t;
   const hotCollections=collections,hotRows=rows,warm={...runtime.stats.diagnostics},before=auditFullObjectGraph([g,rng]),id=getNextEntityId(),tx=transactions,hot=[];
   for(let n=0;n<100;n++){const start=performance.now();readLootGameView(g,mixed.id,[]);hot.push(performance.now()-start);}
   assert.deepEqual(before.differences(),[]);assert.equal(getNextEntityId(),id);assert.equal(transactions,tx);
   counts.push({coldCollections:hotCollections-coldCollections,coldRows:hotRows-coldRows,hotCollections:collections-hotCollections,hotRows:rows-hotRows,coldMisses:warm.misses-d.misses,hotMisses:runtime.stats.diagnostics.misses-warm.misses,hotHits:runtime.stats.diagnostics.hits-warm.hits,queryTransactions:transactions-tx});
   reads.push({coldMs,hot:stats(hot)});
  }
  const result={round,scale:{slots:4,pieces:5,transitions:10,hotReadsPerTransition:100},counts,transactions,reads,memory:process.memoryUsage()};
  if(runs.length){assert.deepEqual(result.counts,runs[0].counts);assert.equal(result.transactions,runs[0].transactions);}
  runs.push(result);h.dispose();
 }
 write(out,{status:'pass',kind:'controlled C1 supplement',runs});
}finally{await server.close();}
