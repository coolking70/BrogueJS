import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../engine/Core/Game';
import { Grid, TerrainType as T, DungeonLayer } from '../engine/Map/Grid';
import { Pathfind } from '../engine/Map/Pathfind';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import { Player } from '../entities/Player';
import { dyingMonsters } from '../engine/Core/MonsterLifecycle';
import { rng } from '../engine/Random';
import monsters from '../data/monsters.json';
import type { Pos } from '../types';

type SearchAccess = {
 findPlayerPath(game:Game,canPass:(x:number,y:number)=>boolean):Pos[]|null;
 canEnterMovementTerrain(game:Game,x:number,y:number):boolean;
 canEnterWaterTerrain(game:Game,x:number,y:number):boolean;
};
const access=(m:Monster)=>m as unknown as SearchAccess;
const mob=(id='rat',x=1,y=5)=>{const m=new Monster(x,y,(monsters as MonsterData[]).find(m=>m.id===id)!);m.state=MonsterState.HUNTING;return m;};
function scene(m=mob(),corridor=false){
 const grid=new Grid(13,11);
 for(let x=0;x<13;x++)for(let y=0;y<11;y++)grid.setTerrain(x,y,x===0||x===12||y===0||y===10||(corridor&&y!==5)?T.WALL:T.FLOOR);
 const game={grid,player:new Player(11,5),monsters:[m],dormantMonsters:[],getMonsterAt:Game.prototype.getMonsterAt} as unknown as Game;
 return {game,m};
}
/** Frozen pre-cache predicates, including the hostile branch's redundant water
 * check. Compare full results and query order, rather than inventing new rules. */
function uncached(game:Game,m:Monster,hostile:boolean){
 return (x:number,y:number)=>{
  if(hostile){if(!game.grid.getCell(x,y))return false;if(!access(m).canEnterWaterTerrain(game,x,y))return false;}
  return access(m).canEnterMovementTerrain(game,x,y)&&!game.getMonsterAt(x,y);
 };
}
function compare(game:Game,m:Monster,hostile:boolean){
 const before=rng.getState(),trace:string[]=[];
 const original=Pathfind.findPath;
 const spy=vi.spyOn(Pathfind,'findPath').mockImplementation((grid,sx,sy,gx,gy,canPass,canStep)=>original.call(Pathfind,grid,sx,sy,gx,gy,(x,y)=>{const result=canPass(x,y);trace.push(`${x},${y}:${result}`);return result;},canStep));
 try{
  const expected=Pathfind.findPath(game.grid,m.x,m.y,game.player.x,game.player.y,uncached(game,m,hostile));
  const expectedTrace=[...trace];trace.length=0;
  const evaluations=new Map<string,number>(),pass=uncached(game,m,hostile);
  const result=access(m).findPlayerPath(game,(x,y)=>{const key=`${x},${y}`;evaluations.set(key,(evaluations.get(key)??0)+1);return pass(x,y);});
  expect(result).toEqual(expected);expect(trace).toEqual(expectedTrace);
  expect([...evaluations.values()].every(n=>n===1)).toBe(true);expect(rng.getState()).toEqual(before);
  return result;
 }finally{spy.mockRestore();}
}
afterEach(()=>vi.restoreAllMocks());
describe('Per-search monster passability memoization',()=>{
 it('matches both original predicates for every catalog creature on open, barrier and corner maps',()=>{
  for(const data of monsters)for(const pattern of ['open','barrier','corners']){
   const {game,m}=scene(mob(data.id));
   if(pattern==='barrier')for(let y=1;y<10;y++)game.grid.setTerrain(6,y,T.WALL);
   if(pattern==='corners')for(let x=2;x<11;x++)for(let y=2;y<9;y++)if((x+y)%3===0)game.grid.setTerrain(x,y,T.WALL);
   for(const hostile of [false,true])compare(game,m,hostile);
  }
 });
 it('preserves water, web bridges, secret doors, fire and corridor-avoiding pack queries',()=>{
  for(const terrain of [T.WATER_DEEP,T.CHASM,T.LAVA,T.PLAIN_FIRE,T.SECRET_DOOR,T.LOCKED_DOOR,T.PRESSURE_PLATE,T.POISON_GAS,T.FOLIAGE,T.STAIRS_UP]){
   for(const id of ['rat','eel','spider','dragon','ogre','wraith']){
    const {game,m}=scene(mob(id),true);game.grid.setTerrain(6,5,terrain);
    game.grid.getCell(6,5)!.layers[DungeonLayer.SURFACE]=T.WEB;
    m.abilityFlags.add('MA_AVOID_CORRIDORS');const follower=mob('rat',2,5);follower.leader=m;game.monsters.push(follower);
    compare(game,m,true);(m.statusDurations as Record<string,number>).burning=10;m.statusDurations.immune_fire=10;compare(game,m,false);
   }
  }
 });
 it('refreshes after terrain, occupants, status, immunity, position and allegiance change',()=>{
  const {game,m}=scene(mob(),true);
  expect(compare(game,m,true)).not.toBeNull();game.grid.setTerrain(6,5,T.PLAIN_FIRE);expect(compare(game,m,true)).toBeNull();
  m.statusDurations.immune_fire=10;expect(compare(game,m,true)).not.toBeNull();m.statusDurations.immune_fire=0;expect(compare(game,m,true)).toBeNull();
  game.grid.setTerrain(6,5,T.WATER_DEEP);m.behaviorFlags.add('MONST_IMMUNE_TO_WATER');expect(compare(game,m,true)).not.toBeNull();m.behaviorFlags.delete('MONST_IMMUNE_TO_WATER');expect(compare(game,m,true)).toBeNull();
  game.grid.setTerrain(6,5,T.FLOOR);const blocker=mob('rat',6,5);game.monsters.push(blocker);expect(compare(game,m,true)).toBeNull();
  blocker.hp=0;dyingMonsters.add(blocker);expect(game.getMonsterAt(6,5)).toBe(blocker);expect(compare(game,m,true)).toBeNull();
  blocker.deathProcessed=true;expect(compare(game,m,true)).not.toBeNull();dyingMonsters.delete(blocker);
  blocker.hp=6;blocker.deathProcessed=false;game.monsters=[m];game.dormantMonsters=[blocker];expect(compare(game,m,true)).not.toBeNull();
  m.loc.x=2;game.player.loc.x=10;compare(game,m,true);
  game.grid.setTerrain(10,5,T.LAVA);m.isAlly=false;compare(game,m,true);m.isAlly=true;compare(game,m,false);
 });
 it('does not share a cache between monsters or make an occupied origin passable',()=>{
  const {game,m}=scene(mob(),true),flying=mob('wraith');flying.statusDurations.levitating=10;game.grid.setTerrain(6,5,T.CHASM);
  expect(compare(game,m,true)).toBeNull();game.monsters=[flying];expect(compare(game,flying,true)).not.toBeNull();
  game.player.loc={...flying.loc};expect(compare(game,flying,true)).toBeNull();
 });
 it('caches rejection too, preserves goal precheck and propagates first-query errors',()=>{
  const {game,m}=scene(),calls=new Map<string,number>();
  access(m).findPlayerPath(game,(x,y)=>{const key=`${x},${y}`;calls.set(key,(calls.get(key)??0)+1);return x!==6;});
  expect([...calls.values()].every(n=>n===1)).toBe(true);expect(calls.has('6,5')).toBe(true);
  const error=new Error('original predicate failure');expect(()=>access(m).findPlayerPath(game,()=>{throw error;})).toThrow(error);
  game.player.loc.x=-1;let evaluated=false;expect(access(m).findPlayerPath(game,()=>{evaluated=true;return true;})).toBeNull();expect(evaluated).toBe(false);
 });
});
