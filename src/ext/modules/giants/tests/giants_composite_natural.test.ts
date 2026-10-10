import { expect, it } from 'vitest';
import { startGiants, giantsState, walkNaturalToDepth, json } from './naturalFixture';
import { readCreatureBirth } from '../../../birth';
import { footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import type { Game } from '../../../../engine/Core/Game';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { logger } from '../../../../engine/Systems/Logger';
import { writeFileSync } from 'node:fs';
import { cellTerrainFlags } from '../../../../engine/Map/DungeonFeature';
import { T_OBSTRUCTS_DIAGONAL_MOVEMENT, T_IS_FIRE } from '../../../../engine/Map/TerrainCatalog';
import { canonical } from '../../../json';

// 整合新增生成数据后7309在D12无安全路线；仅回退definitions的原路线反事实通过。
// 相邻种子搜索选定7322，保留原公开路线、全部断言及800/600/480000边界。
/** Only read-only route choice; all movement, searches and stairs are recorded
 * commands. Avoid optional large bosses en route rather than repeatedly hitting
 * a spine crawler's armored shell with the naturally acquired distant weapon. */
function descend(game: Game, depth: number) {
  for (let n = 0; n < 800 && game.depth < depth && !game.isGameOver; n++) {
    const at = game.player.loc, target = game.levelSeeds[game.depth - 1]!.downStairsLoc;
    const key = (p: {x:number;y:number}) => `${p.x},${p.y}`;
    const bodies = new Set(game.monsters.filter(m => m.hp > 0 && m.spatial).flatMap(m => footprintOf(m).map(key)));
    const valid = (p: {x:number;y:number}) => {
      const c = game.grid.getCell(p.x, p.y);
      return !!c && !bodies.has(key(p)) && (c.isPassable || [T.DOOR,T.SECRET_DOOR].includes(c.terrain))
        && !c.layers.some(t => [T.LAVA,T.CHASM,T.WATER_DEEP].includes(t)) && !(cellTerrainFlags(game.grid,p.x,p.y)&T_IS_FIRE);
    };
    const queue = [{...at}], previous = new Map<string, {x:number;y:number}|null>([[key(at),null]]);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!; if (key(p) === key(target)) break;
      for (const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[-1,1],[1,-1],[1,1]]) {
        const next = {x:p.x+dx!,y:p.y+dy!};
        if (valid(next) && (!dx || !dy || valid({x:p.x+dx!,y:p.y}) && valid({x:p.x,y:p.y+dy!})
            && !(cellTerrainFlags(game.grid,p.x+dx!,p.y)&T_OBSTRUCTS_DIAGONAL_MOVEMENT)
            && !(cellTerrainFlags(game.grid,p.x,p.y+dy!)&T_OBSTRUCTS_DIAGONAL_MOVEMENT))
            && !previous.has(key(next))) { previous.set(key(next),p); queue.push(next); }
      }
    }
    if (!previous.has(key(target))) throw Error(`No safe natural stair route D${game.depth}`);
    let next = target, p = target;
    while (previous.get(key(p))) { next=p; p=previous.get(key(p))!; }
    if (game.grid.getCell(next.x,next.y)!.terrain === T.SECRET_DOOR) game.executeCommand('search');
    else if (key(next) === key(at)) game.executeCommand('stairs_down');
    else game.executeCommand('move',{x:next.x-at.x,y:next.y-at.y});
    if (game.pendingCommandConfirmation) game.resolveCommandDecision(game.pendingCommandConfirmation.token,true);
    while (logger.pendingAcknowledgment) logger.acknowledgeNext();
  }
  if (game.depth !== depth) {
    writeFileSync('/private/tmp/p4d3-natural-stuck.json', JSON.stringify(game.toSnapshot()));
    throw Error(`Natural shale route failed D${game.depth}; at ${JSON.stringify(game.player.loc)}; statuses ${JSON.stringify(game.player.statusDurations)}`);
  }
}

function approach(game: Game, id: number) {
  const target=game.monsters.find(m=>m.id===id)!, wanted=footprintOf(target), at=game.player.loc;
  const touch=wanted.find(p=>Math.max(Math.abs(p.x-at.x),Math.abs(p.y-at.y))===1
    && (!((p.x-at.x)&&(p.y-at.y)) || game.grid.getCell(p.x,at.y)?.isPassable && game.grid.getCell(at.x,p.y)?.isPassable));
  if(touch) return {x:touch.x-at.x,y:touch.y-at.y};
  const key=(p:{x:number;y:number})=>`${p.x},${p.y}`;
  const occupied=new Set(game.monsters.filter(m=>m.hp>0&&m.spatial).flatMap(m=>footprintOf(m).map(key)));
  const valid=(p:{x:number;y:number})=>{const c=game.grid.getCell(p.x,p.y);return !!c&&!occupied.has(key(p))
    &&(c.isPassable||[T.DOOR,T.SECRET_DOOR].includes(c.terrain))&&!c.layers.some(t=>[T.LAVA,T.CHASM,T.WATER_DEEP].includes(t));};
  const q=[{...at}],prev=new Map<string,{x:number;y:number}|null>([[key(at),null]]);let goal;
  for(let i=0;i<q.length;i++) {
    const p=q[i]!;if(wanted.some(c=>Math.abs(c.x-p.x)+Math.abs(c.y-p.y)===1)){goal=p;break;}
    for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const n={x:p.x+dx!,y:p.y+dy!};
      if(valid(n)&&(!dx||!dy||valid({x:p.x+dx!,y:p.y})&&valid({x:p.x,y:p.y+dy!})
          &&!(cellTerrainFlags(game.grid,p.x+dx!,p.y)&T_OBSTRUCTS_DIAGONAL_MOVEMENT)
          &&!(cellTerrainFlags(game.grid,p.x,p.y+dy!)&T_OBSTRUCTS_DIAGONAL_MOVEMENT))&&!prev.has(key(n))){prev.set(key(n),p);q.push(n);}
    }
  }
  if(!goal) throw Error('No natural member/core approach');
  let next=goal,p=goal;while(prev.get(key(p))){next=p;p=prev.get(key(p))!;}
  if(game.grid.getCell(next.x,next.y)!.terrain===T.SECRET_DOOR){game.executeCommand('search');return {x:0,y:0};}
  return {x:next.x-at.x,y:next.y-at.y};
}
const world=(game:Game)=>{const s=json(game.toSnapshot());s.savedAt=0;return canonical(s);};

function captureNaturalBody() {
  const game = startGiants(['giants'], 7322, 'wizard');
  let core;
  for (let depth = 2; depth <= 20; depth++) {
    if (depth <= 11) walkNaturalToDepth(game, depth, true); else descend(game, depth);
    if (depth < 15) continue;
    core = game.monsters.find(m => m.typeId === 'giants.shale-weaver');
    if (core) break;
  }
  expect(core).toBeTruthy();
  const group = game.bodyGroups!.find(g => g.coreId === core!.id)!;
  expect(group.members).toHaveLength(9);
  expect(group.members.filter(s => s.life === 'active')).toHaveLength(9);
  for (const s of group.members) expect(readCreatureBirth(game.monsters.find(m => m.id === s.entityId)!)).toMatchObject({ creationReason: 'natural' });
  expect(giantsState(game).bosses.find(b => b.primaryId === core!.id)?.status).toBe('alive');
  const arrived=game.exportRecording().events.length, arrivedWorld=world(game), id=core!.id, depth=game.depth;
  let brokenSave:ReturnType<Game['toSaveSnapshot']>|undefined, breakEvent=0, brokenWorld:string|undefined;
  for(let n=0;n<600&&core!.hp>0&&!game.isGameOver;n++) {
    const target=game.monsters.filter(m=>m.spatial?.bodyMember?.groupId===id&&m.id!==id)
      .sort((a,b)=>Math.max(Math.abs(a.x-game.player.x),Math.abs(a.y-game.player.y))-Math.max(Math.abs(b.x-game.player.x),Math.abs(b.y-game.player.y))||a.id-b.id)[0] ?? core!;
    const direction=approach(game,target.id);game.executeCommand(direction.x||direction.y?'move':'wait',direction);
    if(game.pendingCommandConfirmation)game.resolveCommandDecision(game.pendingCommandConfirmation.token,true);
    while(logger.pendingAcknowledgment)logger.acknowledgeNext();
    if(!brokenSave&&group.appliedBreaks.length) {
      brokenSave=json(game.toSaveSnapshot());breakEvent=game.exportRecording().events.length;brokenWorld=world(game);
      expect(core!.hp).toBeGreaterThan(0);expect(group.members.some(s=>s.life==='removed')).toBe(true);
      if(game.player.equippedWeapon?.flags?.includes('ITEM_ATTACKS_EXTEND'))game.executeItemCommand('unequip',game.player.equippedWeapon);
    }
  }
  expect(brokenSave).toBeTruthy();expect(core!.hp).toBe(0);
  expect(giantsState(game).bosses.find(b=>b.primaryId===id)!.status).toBe('defeated');
  expect(game.monsters.some(m=>m.spatial?.bodyMember?.groupId===id)).toBe(false);
  const recording=json(game.exportRecording()), final=world(game), last=recording.events.length;
  writeFileSync('/private/tmp/p4d3-natural-acceptance.json',JSON.stringify({seed:7322,mode:'wizard',modules:['giants'],depth,arrived,breakEvent,last,coreId:id,broken:group.appliedBreaks.length,finalHp:core!.hp},null,2)+'\n');
  expect(brokenWorld).toBeDefined();
  // Cache only detached artifacts captured by public commands from a real run.
  // Each acceptance case loads its own Game; no shared live world or injected arena.
  return {recording, brokenSave:brokenSave!, arrived, breakEvent, last,
    arrivedWorld, brokenWorld:brokenWorld!, final};
}
let captured:ReturnType<typeof captureNaturalBody>|undefined;
const acceptance=()=>captured??=captureNaturalBody();
const freshGame=()=>{const game=startGiants(['giants'],7322,'wizard');game.animationEnabled=false;return game;};

it('only giants seed7322 naturally defeats the original body; the first broken-leg save continues with exact events', () => {
  const {recording,brokenSave,breakEvent,final}=acceptance(), game=freshGame();
  expect(game.loadSnapshot(brokenSave)).toBe(true);game.animationEnabled=false;
  for(const event of recording.events.slice(breakEvent)) {
    game.executeCommand(event.action,event.data);
    if(game.pendingCommandConfirmation)for(const decision of event.decisions??[])game.resolveCommandDecision(game.pendingCommandConfirmation.token,decision);
    while(logger.pendingAcknowledgment)logger.acknowledgeNext();
  }
  expect(world(game)).toBe(final);expect(game.exportRecording().events).toEqual(recording.events);
},480000);

it('the actual original-body recording replays every event without OOS and reaches the exact defeated world', () => {
  const {recording,last,final}=acceptance(), game=freshGame();
  expect(game.loadReplay(recording)).toBe(true);game.animationEnabled=false;
  while(game.replayCursor<last){game.replayStep(true);expect(game.replayError).toBeNull();}
  expect(world(game)).toBe(final);
},480000);

it.each(['broken','arrived','last'] as const)('a fresh original-body replay seeks to %s and matches the exact captured world', point => {
  const data=acceptance(), game=freshGame();
  const index=point==='broken'?data.breakEvent:point==='arrived'?data.arrived:data.last;
  const expected=point==='broken'?data.brokenWorld:point==='arrived'?data.arrivedWorld:data.final;
  expect(game.loadReplay(data.recording)).toBe(true);game.animationEnabled=false;
  game.replaySeek(index);expect(game.replayCursor).toBe(index);expect(game.replayError).toBeNull();
  expect(world(game)).toBe(expected);
},480000);
