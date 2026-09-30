/** Behavior + latency check for search-local monster passability memoization.
 * node scripts/profile-monster-search.mjs [/tmp/brogue-monster-search.json]
 * Uses real commands and naturally generated floors, with synthetic depth entry
 * and the existing HP=10000 survival fixture. No renderer or user save storage.
 * A baseline adapter calls the unchanged A* directly with the same predicate.
 */
import { createServer } from 'vite';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stats=values=>{const a=[...values].sort((a,b)=>a-b);return {n:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.ceil(a.length*.95)-1],max:a.at(-1)}};
try {
 const {createHeadlessGame}=await server.ssrLoadModule('/src/test/harness.ts');
 const {Monster}=await server.ssrLoadModule('/src/entities/Monster.ts');
 const {Pathfind}=await server.ssrLoadModule('/src/engine/Map/Pathfind.ts');
 const {rng}=await server.ssrLoadModule('/src/engine/Random.ts');
 const {logger}=await server.ssrLoadModule('/src/engine/Systems/Logger.ts');
 const optimized=Monster.prototype.findPlayerPath;
 assert.equal(typeof optimized,'function');
 const baseline=function(game,canPass){return Pathfind.findPath(game.grid,this.x,this.y,game.player.x,game.player.y,canPass);};
 const rawFind=Pathfind.findPath;
 // Compare the local PERF-2 Map adapter against the compact branch table.
 const mapCache=function(game,canPass){
  const passable=new Map();
  return Pathfind.findPath(game.grid,this.x,this.y,game.player.x,game.player.y,(x,y)=>{
   const key=y*game.grid.width+x,cached=passable.get(key);
   if(cached!==undefined)return cached;
   const result=canPass(x,y);passable.set(key,result);return result;
  });
 };
 let pathRows=null,stallCheckpoint=null,targetMetadata=null,largestQueryCount=0;
 // Capture queries returned to A*, not the intentionally fewer underlying reads.
 Pathfind.findPath=function(...args){
  if(!pathRows)return rawFind.apply(this,args);
  const original=args[5],trace=createHash('sha256');let queries=0;
  args[5]=(x,y)=>{const allowed=original(x,y);queries++;trace.update(`${x},${y}:${allowed};`);return allowed;};
  const path=rawFind.apply(this,args);
  pathRows.push({start:[args[1],args[2]],goal:[args[3],args[4]],path,queries,trace:trace.digest('hex')});return path;
 };
 const worldHash=g=>{const snapshot=g.toSnapshot();snapshot.savedAt=0;return hash(snapshot);};
 function sequence(method,selectTarget=false){
  Monster.prototype.findPlayerPath=method;
  const floors=[];
  for(const seed of [27027,33008]){
   const g=createHeadlessGame(seed);g.animationEnabled=false;g.onRenderRequested=()=>{};
   for(let depth=1;depth<=5;depth++){
    if(depth>1){g.depth=depth;g.generateDepth(false,false);g.update();}
    if(![1,3,4,5].includes(depth))continue;
    g.player.hp=g.player.maxHp=10000;
    const commands=[];let nonturn=0;
    for(let i=0;i<180&&!g.isGameOver;i++){
     while(logger.pendingAcknowledgment)logger.acknowledgeNext();
     const action=g.isAutoTraveling()?'auto_step':nonturn>=2?'wait':'auto_explore',turnBefore=g.absoluteTurnNumber;
     let before=null;
     if(seed===33008&&depth===3&&action==='auto_step'
       &&(selectTarget||turnBefore===targetMetadata?.turnBefore)){
      before=g.toSnapshot();before.savedAt=0;
      if(!selectTarget)assert.equal(hash(before),hash(JSON.parse(stallCheckpoint)),'Pre-stall full world differs');
     }
     const paths=[];pathRows=paths;g.executeCommand(action);g.update();pathRows=null;
     const queries=paths.reduce((n,p)=>n+p.queries,0);
     if(selectTarget&&before&&queries>largestQueryCount){
      largestQueryCount=queries;stallCheckpoint=JSON.stringify(before);
      targetMetadata={seed,depth,action,turnBefore,turnAfter:g.absoluteTurnNumber,queries,paths:paths.length};
     }
     commands.push({action,turnBefore,turnAfter:g.absoluteTurnNumber,position:{...g.player.loc},hp:g.player.hp,nutrition:g.player.nutrition,
      rng:rng.getState(),monsters:g.monsters.map(m=>[m.id,m.typeId,m.loc.x,m.loc.y,m.hp,{...m.statusDurations}]),paths,
      recordedEvent:g.recordedInputEvents.at(-1)});
     nonturn=g.absoluteTurnNumber===turnBefore?nonturn+1:0;
     if(g.depth!==depth)break;
    }
    floors.push({seed,depth,commands,worldHash:worldHash(g)});
   }
  }
  return floors;
 }
 const old=sequence(baseline,true),current=sequence(optimized);
 assert.deepEqual(current,old,'Commands, exact paths/query traces, events, or complete world checkpoints differ');
 const commandCount=current.reduce((n,f)=>n+f.commands.length,0),pathCount=current.reduce((n,f)=>n+f.commands.reduce((n,c)=>n+c.paths.length,0),0);
 console.log(JSON.stringify({commandCount,pathCount,stallCheckpoint:!!stallCheckpoint,floors:current.map(f=>({seed:f.seed,depth:f.depth,commands:f.commands.length,worldHash:f.worldHash}))}));
 // LAVA-1 generation prerequisite, attributed by reverting only its three
 // production files: original 1326 commands/204 paths; corrected 1309/212.
 assert.equal(commandCount,1309);assert.equal(pathCount,212);assert.ok(stallCheckpoint);
 // Alternate variants to reduce warmup/order bias. Restore and full-world hashing
 // occur outside the measured command+update interval.
 const game=createHeadlessGame(1),samples={baseline:[],mapCache:[],optimized:[]};let expectedWorld=null;
 for(let sample=0;sample<23;sample++)for(const variant of sample%2?['optimized','mapCache','baseline']:['baseline','mapCache','optimized']){
  Monster.prototype.findPlayerPath=variant==='optimized'?optimized:variant==='mapCache'?mapCache:baseline;
  assert.equal(game.loadSnapshot(JSON.parse(stallCheckpoint)),true);
  game.animationEnabled=false;game.onRenderRequested=()=>{};
  assert.equal(game.absoluteTurnNumber,targetMetadata.turnBefore);assert.equal(game.depth,targetMetadata.depth);assert.equal(game.isAutoTraveling(),true);
  const start=performance.now();game.executeCommand(targetMetadata.action);game.update();const elapsed=performance.now()-start;
  const actual=worldHash(game);if(expectedWorld===null)expectedWorld=actual;assert.equal(actual,expectedWorld);assert.equal(game.absoluteTurnNumber,targetMetadata.turnAfter);
  if(sample>=3)samples[variant].push(elapsed);
 }
 Monster.prototype.findPlayerPath=optimized;Pathfind.findPath=rawFind;
 const result={runtime:process.version,method:'Real engine commands, no renderer. Two seeds; D1/D3/D4/D5 generated naturally with synthetic entry and HP10000 survival fixture. Same-checkpoint latency alternates variants after 3 warmups, 20 measured each.',
  matchedCommands:commandCount,matchedExactPathsAndQueryTraces:pathCount,matchedFullWorldCheckpoints:current.map(f=>({seed:f.seed,depth:f.depth,hash:f.worldHash})),
  target:{...targetMetadata,fullWorldHash:expectedWorld,baseline:stats(samples.baseline),mapCache:stats(samples.mapCache),optimized:stats(samples.optimized)},samples};
 const output=process.argv[2]??'/tmp/brogue-monster-search.json';await writeFile(output,JSON.stringify(result,null,2));process.stdout.write(JSON.stringify(result,null,2)+'\n');
} finally {await server.close();}
