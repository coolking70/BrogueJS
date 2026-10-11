// Foundation owner: real native maps/commands, no optional module imports.
import {afterEach,expect,it,vi} from 'vitest';
import {createHeadlessGame} from './harness';
import {Game,type GameSnapshot} from '../engine/Core/Game';
import {TerrainType as T} from '../engine/Map/Grid';
import {logger} from '../engine/Systems/Logger';
import {rng} from '../engine/Random';
import {getNextEntityId} from '../entities/Creature';
import {continuingPrefix} from './support/recordingV4';
const clone=<V>(v:V):V=>JSON.parse(JSON.stringify(v));
const full=(g:Game)=>{const v=clone(g.toSnapshot());v.savedAt=0;return v;};
const ack=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
// Independent display write-set oracle; full world comparisons below retain
// BOTH visibility flags as well. No snapshot field is dropped there.
const cellState=(g:Game)=>[g.grid,...[...g.levels.values()].map(level=>level.grid)].map(grid=>
 Array.from({length:grid.width},(_,x)=>Array.from({length:grid.height},(_,y)=>
  clone(Object.fromEntries(Object.entries(grid.getCell(x,y)!).filter(([key])=>!['isVisible','isClairvoyantVisible'].includes(key)))))));
afterEach(()=>{vi.restoreAllMocks();logger.reset();logger.onDisturb=null;});
function route(g:Game,target:T){
 const key=(p:{x:number;y:number})=>p.y*g.grid.width+p.x,queue=[{...g.player.loc}],previous=new Map<number,{x:number;y:number}|null>([[key(g.player.loc),null]]);
 let goal:{x:number;y:number}|undefined;
 for(let i=0;i<queue.length&&!goal;i++){
  const p=queue[i]!;if(g.grid.getCell(p.x,p.y)!.terrain===target){goal=p;break;}
  for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
   const q={x:p.x+dx!,y:p.y+dy!},c=g.grid.getCell(q.x,q.y);
   if(!c||previous.has(key(q))||(!c.isPassable&&![T.DOOR,T.SECRET_DOOR,target].includes(c.terrain))||
    c.layers.some(t=>[T.LAVA,T.WATER_DEEP,T.PLAIN_FIRE,...(target===T.CHASM?[]:[T.CHASM])].includes(t)))continue;
   previous.set(key(q),p);queue.push(q);
  }
 }
 expect(goal,'fixed original seed has a reachable real native fall/stair').toBeDefined();
 if(key(goal!)===key(g.player.loc))return null;
 let next=goal!;while(previous.get(key(next))&&key(previous.get(key(next))!)!==key(g.player.loc))next=previous.get(key(next))!;
 return next;
}
it.each([{seed:3,render:false},{seed:3,render:true},{seed:47,render:false},{seed:47,render:true}])('native seed$seed render=$render fall/stair retains every cached field through seek and continuation',({seed,render})=>{
 const g=createHeadlessGame(seed,'test'),proto=Game.prototype as unknown as {makeRecordingHeader():unknown};
 const native=proto.makeRecordingHeader;let zero:ReturnType<typeof full>|undefined;
 const spy=vi.spyOn(proto,'makeRecordingHeader').mockImplementation(function(this:Game){const h=native.call(this);zero=full(this);return h;});
 g.startNewGame({seed,mode:'wizard',ruleSet:'classic'});spy.mockRestore();g.animationEnabled=false;g.onConfirmRequest=()=>true;
 expect(zero).toBeDefined();const truth=new Map([[0,zero!]]),saves=new Map<number,GameSnapshot>();
 function step(action:string,data?:unknown){
  ack();g.executeCommand(action,data);expect(g.lastAdvancementError).toBeNull();expect(g.isAdvancing).toBe(false);
  if(render)g.tickFlareAnimation(10);
  const random=rng.getState(),allocator=getNextEntityId(),snapshot=full(g);
  // Native descent emits a real flare: its one-time knowledge preparation
  // belongs to the captured physical boundary. Repeated observation is pure.
  expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(allocator);
  const cells=cellState(g);expect(full(g)).toEqual(snapshot);expect(cellState(g)).toEqual(cells);
  expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(allocator);truth.set(g.recordedInputEvents.length,snapshot);
 }
 const walk=(target:T,depth:number)=>{
  for(let n=0;n<1000&&g.depth===depth;n++){
   const next=route(g,target);
   if(!next){step(target===T.STAIRS_UP?'stairs_up':'stairs_down');}
   else if(g.grid.getCell(next.x,next.y)!.terrain===T.SECRET_DOOR)step('search');
   else step('move',{x:next.x-g.player.x,y:next.y-g.player.y});
  }
  expect(g.depth).not.toBe(depth);
 };
 walk(T.CHASM,1);expect(g.depth).toBe(2);saves.set(g.recordedInputEvents.length,clone(g.toSaveSnapshot()));
 walk(T.STAIRS_UP,2);expect(g.depth).toBe(1);saves.set(g.recordedInputEvents.length,clone(g.toSaveSnapshot()));
 const recording=clone(g.exportRecording()),end=recording.events.length,final=full(g),middle=[...saves.keys()][0]!;
 expect(final.levels.length).toBeGreaterThan(0);
 const replay=createHeadlessGame(901,'test');expect(replay.loadReplay(recording)).toBe(true);replay.animationEnabled=false;
 while(replay.replayCursor<end){replay.replayStep(true);expect(replay.replayError).toBeNull();expect(full(replay)).toEqual(truth.get(replay.replayCursor));}
 for(const index of [end,0,middle,1,end]){replay.replaySeek(index);expect(replay.replayError).toBeNull();expect(replay.replayCursor).toBe(index);expect(full(replay)).toEqual(truth.get(index));}
 for(const [index,save] of saves){const loaded=createHeadlessGame(902,'test');expect(loaded.loadSnapshot(save)).toBe(true);expect(full(loaded)).toEqual(truth.get(index));}
 const continued=createHeadlessGame(903,'test');expect(continued.loadSnapshot(saves.get(end)!)).toBe(true);continued.animationEnabled=false;continued.onConfirmRequest=()=>true;
 ack();continued.executeCommand('wait');expect(continued.lastAdvancementError).toBeNull();const recording2=clone(continued.exportRecording()),wanted=full(continued);
 expect(recording2.events.slice(0,end)).toEqual(continuingPrefix(recording));expect(replay.loadReplay(recording2)).toBe(true);replay.animationEnabled=false;
 while(replay.replayCursor<recording2.events.length){replay.replayStep(true);expect(replay.replayError).toBeNull();}
 expect(full(replay)).toEqual(wanted);
},900000);
it('empty display queue normalizes only the two FOV flags, with the complete native world unchanged',()=>{
 const g=createHeadlessGame(3,'test');g.startNewGame({seed:3,mode:'wizard',ruleSet:'classic'});g.animationEnabled=false;
 const before=full(g),cell=g.grid.getCell(g.player.x,g.player.y)!;
 expect(cell.isVisible).toBe(true);expect(cell.isClairvoyantVisible).toBe(false);
 expect((g as unknown as {activeFlares?:unknown[]}).activeFlares??[]).toHaveLength(0);
 // Controlled stale display state, distinct from the genuine routes above.
 // No physical state, lighting, terrain or knowledge is fabricated.
 cell.isVisible=false;cell.isClairvoyantVisible=true;
 const random=rng.getState(),allocator=getNextEntityId(),cells=cellState(g);
 const after=full(g);expect(after).toEqual(before);expect(cellState(g)).toEqual(cells);
 expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(allocator);
});
