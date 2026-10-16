import assert from 'node:assert/strict';
import {RouteRecovery,nextRouteStep,retryEntryDelay} from './ext-perf-route-recovery.mjs';

// An indefinitely healing blocker must not cause indefinitely repeated attacks.
const r=new RouteRecovery();
for(let i=0;i<24;i++){r.observe(6,31,21);r.attempted({x:-1,y:0});}
assert.equal(r.stairsOnly,true);
for(let i=0;i<24;i++){r.observe(6,31,21);r.attempted({x:-1,y:0});}
assert.equal(r.allows(31,21,-1,0),false);
assert.equal(r.allows(31,21,1,0),true);
assert.equal(r.allows(30,21,1,0),true,'Only the failed directed edge is excluded');
r.observe(7,31,21);
assert.equal(r.stairsOnly,false);assert.equal(r.blocked.size,0);
const cycle=new RouteRecovery();
for(let i=0;i<48;i++)cycle.observe(6,i%2,0);
assert.equal(cycle.stairsOnly,true,'Moving back and forth is not progress');
const detour=new RouteRecovery();
for(let i=0;i<512;i++)detour.observe(6,i,0);
assert.equal(detour.stairsOnly,true,'Optional moving detours are bounded');

const flags={T_LAVA_INSTA_DEATH:1,T_AUTO_DESCENT:2,T_ENTANGLES:4};
const TerrainType={STAIRS_DOWN:10,SECRET_DOOR:11};
function scene() {
 const cells=Array.from({length:5},(_,x)=>Array.from({length:3},(_,y)=>({isPassable:y===1,layers:[],flags:0})));
 cells[4][1].layers=[10];
 const monsters=new Set(),recovery=new RouteRecovery();recovery.observe(1,2,1);
 const g={grid:{width:5,height:3,getCell:(x,y)=>cells[x]?.[y]},player:{x:2,y:1,strength:18,equippedWeapon:{damage:'1d2'}},items:[],getMonsterAt:(x,y)=>monsters.has(`${x},${y}`)};
 return {g,cells,monsters,recovery,score:i=>Number(i?.damage?.match(/d(\d+)/)?.[1]??0),TerrainType,flags,cellTerrainFlags:(grid,x,y)=>grid.getCell(x,y).flags};
}
const s=scene();
s.g.items=[{category:0,damage:'1d9',loc:{x:0,y:1}}];s.monsters.add('1,1');
assert.deepEqual(nextRouteStep(s),{x:1,y:0},'Skip loot behind a monster; take reachable stairs');
s.monsters.clear();s.cells[1][1].isPassable=false;
assert.deepEqual(nextRouteStep(s),{x:1,y:0},'Unreachable optional target cannot prevent descent');
s.g.items=[];s.cells[3][1].flags=4;
assert.deepEqual(nextRouteStep(s),{x:1,y:0},'Allow web crossing only if no safer path exists');
s.cells[3][0].isPassable=s.cells[2][0].isPassable=s.cells[4][0].isPassable=true;
assert.deepEqual(nextRouteStep(s),{x:1,y:-1},'Prefer a dry detour over a web chokepoint');
s.cells[3][1].flags=1;s.cells[3][0].isPassable=false;
assert.throws(()=>nextRouteStep(s),e=>e.routeBlocked===true,'Never route through lethal lava');
const blocked=scene();blocked.cells[3][1].isPassable=false;
assert.throws(()=>nextRouteStep(blocked),e=>e.routeBlocked===true,'No path requests a bounded fresh-route retry');
assert.deepEqual(nextRouteStep(scene()),nextRouteStep(scene()),'Stable BFS direction order');
const delays=new Map(),noPath=Object.assign(Error('no path'),{routeBlocked:true});
assert.equal(retryEntryDelay(delays,6,0,noPath),1);
assert.equal(retryEntryDelay(delays,6,1,noPath),2);
assert.equal(retryEntryDelay(delays,9,2,noPath),1);
assert.equal(delays.get(6),2,'Retain prior depth timing when retrying a later depth');
assert.throws(()=>retryEntryDelay(delays,6,15,noPath),e=>e===noPath,'Bound retries');
const oos=Error('OOS');
assert.throws(()=>retryEntryDelay(delays,6,0,oos),e=>e===oos,'Do not mask non-route failures');
console.log('Route recovery: healing blocker, cycles, detours, depth reset, unreachable loot, hazards and no-path passed');
