/** C4 bounded supplemental scene. Controlled arena, real body damage; not a natural route. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {boot,write,stats} from './ext-perf-common.mjs';
const output=process.argv[2];assert.ok(output);
const {server,load}=await boot();
try{
 const {createWorldHarness,worldHarnessGame}=await load('ext/testing/worldHarness.ts');
 const {TerrainType:T,DungeonLayer:L}=await load('engine/Map/Grid.ts');
 const {EnvironmentManager}=await load('engine/Environment/Gas.ts');
 const {WaypointSystem}=await load('engine/Map/WaypointMap.ts');
 const {rng}=await load('engine/Random.ts');
 const {getNextEntityId}=await load('entities/Creature.ts');
 const {readLootGameView}=await load('ext/modules/loot/gameView.ts');
 const {auditFullObjectGraph}=await load('test/support/fullGenerationCheckpointOracle.ts');
 const runs=[];
 for(let round=1;round<=3;round++){
  const h=createWorldHarness({seed:51020001,mode:'wizard',modules:['loot','giants']}),g=worldHarnessGame(h),r=g.extensionRuntime;
  g.monsters=[];g.dormantMonsters=[];g.items=[];
  for(let y=0;y<g.grid.height;y++)for(let x=0;x<g.grid.width;x++){
   g.grid.setTerrain(x,y,x===0||y===0||x===g.grid.width-1||y===g.grid.height-1?T.WALL:T.FLOOR);
   for(const layer of [L.LIQUID,L.SURFACE,L.GAS])g.grid.setTerrainLayer(x,y,layer,T.NOTHING);
   g.grid.getCell(x,y).machineNumber=0;
  }
  g.environment=new EnvironmentManager(g.grid);g.waypoints=new WaypointSystem();g.bindDungeonFeatureEffects();
  let transactions=0;const tx=r.transaction;r.transaction=function(...args){transactions++;return tx.apply(this,args);};
  const cold=performance.now();readLootGameView(g,null,[]);const coldMs=performance.now()-cold;
  const audit=auditFullObjectGraph([g,rng]),id=getNextEntityId(),before=transactions,times=[];
  for(let n=0;n<100;n++){const t=performance.now();readLootGameView(g,null,[]);times.push(performance.now()-t);}
  assert.deepEqual(audit.differences(),[]);assert.equal(getNextEntityId(),id);assert.equal(transactions,before);const queryTransactions=transactions-before;
  const eventBefore=r.snapshot().foundation.itemDrops.nextEventId,breaks=[],breakTimings=[];
  for(const [body,n] of [['giants.shale-weaver-body',8],['giants.copper-tendril-body',4]]){
   const core=g.createCompositeMonster(body,{x:14,y:12},undefined,'natural');assert.ok(core);
   const group=g.bodyGroups.find(row=>row.coreId===core.id);
   const parts=group.members.filter(row=>row.entityId!==core.id).map(row=>row.partId).reverse(),durations=[];
   for(const part of parts){
    const actor=g.monsters.find(m=>m.spatial?.bodyMember?.groupId===core.id&&m.spatial.bodyMember.partId===part);assert.ok(actor);
    const cause=r.causality.create('melee',g.player.id);
    const start=performance.now();r.causality.withOrigin(cause,()=>actor.takeDamage(1000,true,g.grid,undefined,'physical'));durations.push(performance.now()-start);
    assert.ok(!r.snapshot().foundation.itemDrops.parts[core.id].remaining.includes(part));
    // Same retired entity cannot mint another fact.
    const watermark=r.snapshot().foundation.itemDrops.nextEventId;actor.takeDamage(1000,true,g.grid,undefined,'physical');assert.equal(r.snapshot().foundation.itemDrops.nextEventId,watermark);
   }
   assert.equal(group.appliedBreaks.length,n);breaks.push(n);breakTimings.push({body,coldMs:durations[0],hot:stats(durations.slice(1)),eachMs:durations});g.killMonster(core,true);
  }
  const counts={transactions,queryTransactions,reads:100,directBreaks:breaks.reduce((a,b)=>a+b,0),dropAttempts:r.snapshot().foundation.itemDrops.nextEventId-eventBefore,items:g.items.length};
  assert.equal(counts.directBreaks,12);assert.equal(counts.dropAttempts,12);
  const result={round,coldMs,hot:stats(times),breakTimings,counts,rng:rng.getState(),memory:process.memoryUsage()};
  if(runs.length){assert.deepEqual(result.counts,runs[0].counts);assert.deepEqual(result.rng,runs[0].rng);}
  runs.push(result);h.dispose();
 }
 write(output,{status:'pass',scope:'Controlled two-body 12 direct breaks and duplicate retired inputs; 100 pure reads. Natural/replay/transition cases are separate tests.',runs});
}finally{await server.close();}
