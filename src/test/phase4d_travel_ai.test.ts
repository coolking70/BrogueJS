import { afterEach, expect, it, vi } from 'vitest';
import '../i18n';
import { productionBodyScene, installProductionAttackBody, startProductionGame, emptyProductionArena, PRODUCTION_BODY_ID } from './support/productionComposite';
import { commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { MonsterState } from '../entities/Monster';
import { TerrainType as T } from '../engine/Map/Grid';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
import { getNextEntityId } from '../entities/Creature';
import { auditFullObjectGraph, fullGenerationRoots } from './support/fullGenerationCheckpointOracle';
afterEach(()=>{vi.restoreAllMocks();logger.reset();});
const json=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
it('a core routes around a wide wall on finite far paths and a sealed formation pays positive wait time',()=>{
    const {game,core}=productionBodyScene();commitCreatureAnchor(game.player,{x:32,y:12});
    for(let y=6;y<=18;y++)game.grid.setTerrain(22,y,T.WALL);
    for(let i=0;i<50&&core.x<25;i++)game.executeCommand('wait');
    expect(core.x).toBeGreaterThanOrEqual(25);expect(game.lastAdvancementError).toBeNull();
    for(let x=core.x-4;x<=core.x+5;x++){game.grid.setTerrain(x,core.y-4,T.WALL);game.grid.setTerrain(x,core.y+5,T.WALL);}
    for(let y=core.y-4;y<=core.y+5;y++){game.grid.setTerrain(core.x-4,y,T.WALL);game.grid.setTerrain(core.x+5,y,T.WALL);}
    for(let i=0;i<5;i++)game.executeCommand('wait');expect(core.ticksUntilTurn).toBeGreaterThan(0);expect(game.lastAdvancementError).toBeNull();
});
it('native ally follow and fear retreat use the core decision without selecting own members as enemies',()=>{
    const {game,core,actors}=productionBodyScene();game.becomeAllyWith(actors[1]!);const start=core.x;
    for(let i=0;i<5;i++)game.executeCommand('wait');expect(core.x).toBeGreaterThan(start);expect(actors.every(a=>a.hp===a.maxHp)).toBe(true);
    core.isAlly=false;core.leader=null;core.state=MonsterState.FLEEING;core.applyStatus('magical_fear',20);commitCreatureAnchor(game.player,{x:core.x+4,y:core.y});
    const before=Math.abs(core.x-game.player.x);game.executeCommand('wait');expect(Math.abs(core.x-game.player.x)).toBeGreaterThan(before);
});
it('core native magic precedes declared member attacks and pays only the core cast clock',()=>{
    installProductionAttackBody();const game=startProductionGame(['giants','combat']);emptyProductionArena(game);
    const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!,clocks=game.monsters.slice(1).map(a=>a.ticksUntilTurn);
    core.state=MonsterState.HUNTING;core.givenUpOnScent=true;core.bolts=['FIRE'];core.behaviorFlags.add('MONST_ALWAYS_HUNTING');core.behaviorFlags.add('MONST_ALWAYS_USE_ABILITY');
    commitCreatureAnchor(game.player,{x:22,y:12});const cast=vi.spyOn(game,'castMonsterBolt');game.executeCommand('wait');
    expect(cast).toHaveBeenCalledOnce();expect(cast.mock.calls[0]![0]).toBe(core);expect(cast.mock.calls[0]![1]).toBe(game.player);
    expect(game.extensionRuntime!.actorActionBinding()!.state.scheduler.bundles).toEqual([]);expect(game.monsters.slice(1).map(a=>a.ticksUntilTurn)).toEqual(clocks);expect(core.ticksUntilTurn).toBeGreaterThan(0);
});
it('maintaining distance, confusion and an actual seizer keep positive group time without independent leg motion',()=>{
    const {game,core,actors}=productionBodyScene();core.behaviorFlags.add('MONST_MAINTAINS_DISTANCE');commitCreatureAnchor(game.player,{x:18,y:12});const at={...core.loc};game.executeCommand('wait');expect(core.loc).toEqual(at);
    core.setStatusDuration('confused',5);const draw=vi.spyOn(rng,'randRange');game.executeCommand('wait');expect(core.ticksUntilTurn).toBeGreaterThan(0);expect(draw.mock.calls.some(([min])=>min===0)).toBe(true);
    core.setStatusDuration('confused',0);const foot=actors[1]!,seizer=game.player;commitCreatureAnchor(seizer,{x:foot.x-1,y:foot.y});
    seizer.seizing=true;foot.seized=true;const positions=actors.map(a=>({...a.loc}));expect((game as any).tryMoveBodyCore(core,{x:core.x+1,y:core.y})).toBe(false);expect(actors.map(a=>a.loc)).toEqual(positions);
});
it('member-visible native awareness makes exactly one group roll and wakes only the core',()=>{
    const {game,core,actors}=productionBodyScene();core.behaviorFlags.delete('MONST_ALWAYS_HUNTING');core.state=MonsterState.ASLEEP;
    const leg=actors[1]!;commitCreatureAnchor(game.player,{x:leg.x-2,y:leg.y});
    for(const p of footprintOf(core))game.grid.getCell(p.x,p.y)!.isVisible=false;game.grid.getCell(leg.x,leg.y)!.isVisible=true;
    const roll=vi.spyOn(rng,'randPercent').mockReturnValue(true),timers=actors.slice(1).map(a=>a.ticksUntilTurn);
    expect(core.prepareNativeDecision(game,10)).toBe(true);expect(core.state).toBe(MonsterState.HUNTING);expect(roll.mock.calls.filter(([chance])=>chance===25)).toHaveLength(1);
    expect(actors.slice(1).map(a=>a.ticksUntilTurn)).toEqual(timers);
});
it('whole displacement aimed at a leg translates all parts, keeps member timers and rejects an occupied tail',()=>{
    const {game,core,actors}=productionBodyScene(),leg=actors[1]!,timers=actors.slice(1).map(a=>a.ticksUntilTurn),before=actors.map(a=>({...a.loc}));
    expect(game.placeCreature(leg,{x:leg.x+8,y:leg.y+2})).toBe(true);
    actors.forEach((a,i)=>expect(a.loc).toEqual({x:before[i]!.x+8,y:before[i]!.y+2}));expect(actors.slice(1).map(a=>a.ticksUntilTurn)).toEqual(timers);
    game.grid.setTerrain(actors[actors.length-1]!.x+5,actors[actors.length-1]!.y,T.WALL);const random=rng.getState(),positions=actors.map(a=>({...a.loc}));
    expect(game.placeCreature(core,{x:core.x+5,y:core.y})).toBe(false);expect(actors.map(a=>a.loc)).toEqual(positions);expect(rng.getState()).toEqual(random);
});
it('whole teleport has full-mask no-fit purity and an unexpected commit failure restores both RNG streams and identities',()=>{
    const {game,core}=productionBodyScene();for(let y=1;y<game.grid.height-1;y++)if(y!==20)game.grid.setTerrain(30,y,T.WALL);
    const before=game.toSaveSnapshot(),id=getNextEntityId(),random=rng.getState();
    const audit=auditFullObjectGraph(fullGenerationRoots(game),[game.extensionRuntime!]);
    const fail=vi.spyOn(game.extensionRuntime!,'commitGeneration').mockImplementation(()=>{throw Error('warp fault');});
    expect(()=>(game as any).teleportCreature(core)).toThrow('warp fault');fail.mockRestore();expect(audit.differences()).toEqual([]);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(id);
    expect((game as any).teleportCreature(core)).toBe(true);expect(core.loc).not.toEqual(before.monsters.find(a=>a.id===core.id)!.loc);
    expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
    // A corridor admits a core mask but no complete nine-part landing.
    for(let y=1;y<game.grid.height-1;y++)for(let x=1;x<game.grid.width-1;x++)game.grid.setTerrain(x,y,T.WALL);
    const current=game.monsters;for(const a of current)for(const p of footprintOf(a))game.grid.setTerrain(p.x,p.y,T.FLOOR);
    const c=current.find(a=>a.id===core.id)!;for(let y=c.y-1;y<=c.y+2;y++)for(let x=c.x-1;x<=c.x+2;x++)game.grid.setTerrain(x,y,T.FLOOR);
    const snapshot=json(game.toSaveSnapshot()),r=rng.getState();expect((game as any).teleportCreature(current.find(a=>a.id===core.id)!)).toBe(false);
    expect(rng.getState()).toEqual(r);const after=json(game.toSaveSnapshot());after.savedAt=snapshot.savedAt;expect(after).toEqual(snapshot);
});
it('beckoning routes a member target through swept whole-body steps and leaves every member native clock alone',()=>{
    const {game,core,actors}=productionBodyScene();commitCreatureAnchor(game.player,{x:28,y:12});const clocks=actors.slice(1).map(a=>a.ticksUntilTurn);
    const before=core.x;(game as any).beckonCreature(actors[1],game.player);
    expect(core.x).toBeGreaterThan(before);expect(actors.slice(1).map(a=>a.ticksUntilTurn)).toEqual(clocks);expect(core.ticksUntilTurn).toBeGreaterThan(game.player.attackSpeed);
    expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});
it('a real staircase schedules and migrates the whole allied formation; save/load preserves its single owner',()=>{
    const {game,core,actors}=productionBodyScene();game.becomeAllyWith(core);
    game.grid.setTerrain(game.player.x,game.player.y,T.STAIRS_DOWN);game.levelSeeds[0]!.downStairsLoc={...game.player.loc};
    game.executeCommand('stairs_down');expect(game.depth).toBe(2);const old=game.levels.get(1)!;
    expect(old.monsters.filter(a=>a.spatial?.bodyMember?.groupId===core.id)).toHaveLength(9);
    expect(actors.every(a=>a.entersLevelIn===core.entersLevelIn && a.approaching===core.approaching)).toBe(true);
    for(let i=0;i<150&&old.monsters.includes(core);i++)game.executeCommand('wait');
    expect(old.monsters.some(a=>a.spatial?.bodyMember?.groupId===core.id)).toBe(false);expect(game.monsters.filter(a=>a.spatial?.bodyMember?.groupId===core.id)).toHaveLength(9);
    expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});
it('a real staircase follower migration cancels previously paid member shapes and preserves loadable source ledgers',()=>{
    installProductionAttackBody();const game=startProductionGame(['giants','combat']);emptyProductionArena(game);
    const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;core.state=MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');commitCreatureAnchor(game.player,{x:14,y:10});
    game.executeCommand('wait');const initial=game.extensionRuntime!.actorActionBinding()!.state;
    expect(initial.actions[0]!.paidCost).toBeGreaterThan(0);const paidId=initial.actions[0]!.actionId;
    game.becomeAllyWith(core);game.grid.setTerrain(game.player.x,game.player.y,T.STAIRS_DOWN);game.levelSeeds[0]!.downStairsLoc={...game.player.loc};
    game.executeCommand('stairs_down');const source=game.levels.get(1)!;
    for(let n=0;n<150&&source.monsters.includes(core);n++)game.executeCommand('wait');
    expect(source.monsters.some(a=>a.spatial?.bodyMember?.groupId===core.id)).toBe(false);expect(game.monsters.filter(a=>a.spatial?.bodyMember?.groupId===core.id)).toHaveLength(9);
    const state=game.extensionRuntime!.actorActionBinding()!.state;
    expect(state.actions.filter(a=>a.actionId===paidId).flatMap(a=>a.subactions).every(s=>s.lockedCells.length===0)).toBe(true);
    expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);game.executeCommand('wait');expect(game.lastAdvancementError).toBeNull();
});
it('a failed whole staircase restores a paid session and can execute the old plan after the fault is removed',()=>{
    installProductionAttackBody();const game=startProductionGame(['giants','combat']);emptyProductionArena(game);
    const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;core.state=MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');commitCreatureAnchor(game.player,{x:14,y:10});
    game.executeCommand('wait');expect(game.extensionRuntime!.actorActionBinding()!.state.actions[0]!.paidCost).toBeGreaterThan(0);
    game.grid.setTerrain(game.player.x,game.player.y,T.STAIRS_DOWN);game.levelSeeds[0]!.downStairsLoc={...game.player.loc};
    const saved=game.toSaveSnapshot(),native=json(game.extensionRuntime!.actorActionBinding()!.state),random=rng.getState(),beforeDepth=game.depth;
    const fail=vi.spyOn(game.extensionRuntime!,'commitGeneration').mockImplementation(()=>{throw Error('stairs fault');});
    expect(()=>game.executeCommand('stairs_down')).toThrow('stairs fault');fail.mockRestore();
    expect(game.depth).toBe(beforeDepth);expect(game.extensionRuntime!.actorActionBinding()!.state).toEqual(native);expect(rng.getState()).toEqual(random);
    game.executeCommand('wait');expect(game.lastAdvancementError).toBeNull();const expected=json(game.toSaveSnapshot());
    expect(game.loadSnapshot(saved)).toBe(true);game.executeCommand('wait');const actual=json(game.toSaveSnapshot());actual.savedAt=expected.savedAt;
    // The generic thrown command invalidates recording provenance. Compare
    // its complete mechanical world; successful recording paths are separate.
    delete expected.run.recordingOrigin;delete actual.run.recordingOrigin;expect(actual).toEqual(expected);
});
it('a follower with no whole landing retains all old-layer anchors and shows the group reason',()=>{
    const {game,core,actors}=productionBodyScene();game.becomeAllyWith(core);const source=(game as any).activeLevelState(),positions=actors.map(a=>({...a.loc}));
    game.monsters=[];game.levels.set(2,source);
    for(let y=0;y<game.grid.height;y++)for(let x=0;x<game.grid.width;x++)game.grid.setTerrain(x,y,T.WALL);
    core.entersLevelIn=1;(game as any).enterWholeBodyFollower(core,source,{x:20,y:12},false);
    expect(source.monsters).toEqual(actors);expect(actors.map(a=>a.loc)).toEqual(positions);expect(core.entersLevelIn).toBe(1);expect(game.monsters).toEqual([]);
    expect(logger.messages.some(m=>m.text.includes('没有整组落脚'))).toBe(true);
});
