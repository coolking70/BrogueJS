import { afterEach, describe, expect, it, vi } from 'vitest';
import { naturalSpine, startGiants, json } from './naturalFixture';
import { loadGiantsDefinitionPack } from '../definitions';
import { isGiantsPack } from '../schema';
import { createGiantsModuleFromPack } from '../module';
import { rigidFootprint, RIGID_POSES } from '../../../../engine/Movement/RigidFootprint';
import { CreatureSpatial, footprintOf, commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { TerrainType as T, DungeonLayer as Layer } from '../../../../engine/Map/Grid';
import { EnvironmentManager } from '../../../../engine/Environment/Gas';
import { WaypointSystem } from '../../../../engine/Map/WaypointMap';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import { getNextEntityId } from '../../../../entities/Creature';
import species from '../../../../data/monsters.json';
import { rng } from '../../../../engine/Random';
import { readCreatureBirth } from '../../../birth';
import { Game } from '../../../../engine/Core/Game';
import { selectBossHud } from '../ui/view';
import { observeDisplayFrame } from '../../../../ui/displayProjection';
import { logger } from '../../../../engine/Systems/Logger';

const world=(g:Game)=>{const s=json(g.toSnapshot());s.savedAt=0;s.run.recordedInputEvents=[];s.run.recordedInputIndex=0;return s;};
afterEach(()=>vi.restoreAllMocks());
function diagnostic() {
  const g=startGiants(['giants'],44004,'wizard');g.monsters=[];g.dormantMonsters=[];g.items=[];
  for(let y=0;y<g.grid.height;y++)for(let x=0;x<g.grid.width;x++) {
    g.grid.setTerrain(x,y,x===0||y===0||x===g.grid.width-1||y===g.grid.height-1?T.WALL:T.FLOOR);
    for(const layer of [Layer.LIQUID,Layer.SURFACE,Layer.GAS])g.grid.setTerrainLayer(x,y,layer,T.NOTHING);
    g.grid.getCell(x,y)!.machineNumber=0;
  }
  g.environment=new EnvironmentManager(g.grid);g.waypoints=new WaypointSystem();commitCreatureAnchor(g.player,{x:65,y:14});g.player.hp=g.player.maxHp=100000;
  const m=g.createModuleMonster('giants.spine-crawler',{x:12,y:12})!;m.spatial!.pose='r270';m.state=MonsterState.HUNTING;m.behaviorFlags.add('MONST_ALWAYS_HUNTING');m.givenUpOnScent=true;return {g,m};
}

describe('giants 4b original four-cell spine crawler',()=>{
  it('trusted data installs four rotations; budgets/disconnection/mirrors/sweep overflow fail at data boundary',()=>{
    const original=loadGiantsDefinitionPack();expect(original.forms[2]!.footprint?.poses).toEqual(RIGID_POSES);
    for(const change of [null,
      {geometry:{kind:'mask',cells:[{x:0,y:0},{x:2,y:0}]},poses:RIGID_POSES},
      {geometry:{kind:'mask',cells:Array.from({length:17},(_,x)=>({x,y:0}))},poses:['r0']},
      {geometry:{kind:'mask',cells:[{x:0,y:0},{x:1,y:0}]},poses:['r0','m0']},
      {geometry:{kind:'mask',cells:[{x:0,y:0},{x:1,y:0}]},poses:['r0','r90']},
      {geometry:{kind:'mask',cells:Array.from({length:16},(_,x)=>({x,y:0}))},poses:RIGID_POSES}
    ]) {
      const bad=json(original);bad.forms[2]={...bad.forms[2]!,footprint:change as any};expect(isGiantsPack(bad)).toBe(false);expect(()=>createGiantsModuleFromPack(bad)).toThrow();
    }
    const fixed=json(original);fixed.forms[2]={...fixed.forms[2]!,footprint:{geometry:{kind:'mask',cells:Array.from({length:16},(_,x)=>({x,y:0}))},poses:['r0']}};expect(isGiantsPack(fixed)).toBe(true);
  });
  it('creation preflight checks actual terminal pose; failure consumes no ID or RNG; no cross-session authority',()=>{
    const {g,m}=diagnostic();g.grid.setTerrain(23,12,T.WALL);const id=getNextEntityId(),random=rng.getState();
    expect(g.createModuleMonster(m.typeId,{x:20,y:12})).toBeNull();expect(getNextEntityId()).toBe(id);expect(rng.getState()).toEqual(random);
    const other=startGiants([],44005);expect(()=>other.monsters.push(m)).toThrow();expect(()=>other.createModuleMonster(m.typeId,{x:20,y:12})).toThrow('Unavailable');
    const unknown=new Monster(20,12,species[0] as MonsterData);unknown.spatial={schema:1,footprintId:m.typeId,pose:'r0'};expect(()=>other.monsters.push(unknown)).toThrow();
  });
  it('all four poses save/load; saved geometry and wrong form/pose reject without retiring old run',()=>{
    const {g,m}=diagnostic();
    for(const pose of RIGID_POSES) {
      m.spatial!.pose=pose;const saved=json(g.toSaveSnapshot());expect(g.loadSnapshot(saved)).toBe(true);
      const restored=g.monsters.find(c=>c.id===m.id)!;expect(restored.spatial!.pose).toBe(pose);expect(footprintOf(restored)).toHaveLength(4);
      const mutate=(edit:(s:typeof saved)=>void)=>{const bad=json(saved);edit(bad);const before=world(g),random=rng.getState(),id=getNextEntityId();expect(g.loadSnapshot(bad)).toBe(false);expect(world(g)).toEqual(before);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(id);};
      mutate(s=>{s.monsters.find(c=>c.id===m.id)!.spatial!.pose='m0';});
      mutate(s=>{s.run.spatialWorld!.definitions.footprints[0]!.geometry={kind:'mask',cells:[{x:0,y:0}]};});
      mutate(s=>{s.monsters.find(c=>c.id===m.id)!.spatial!.footprintId='builtin:square-2';});
      mutate(s=>{const row=s.monsters.find(c=>c.id===m.id)!;row.typeId='rat';row.form.id='rat';});
      m.spatial=restored.spatial; // continue with the current canonical component
    }
  });
  it('sample polymorph is native and atomic, resets unsupported poses and never allocates an ID',()=>{
    const {g,m}=diagnostic(),index=g.extensionRuntime!.nativeForms().findIndex(f=>f.id===m.typeId),id=getNextEntityId();
    const rat=new Monster(30,12,(species as MonsterData[]).find(f=>f.id==='rat')!);g.monsters.push(rat);const allocated=getNextEntityId();
    const draw=vi.spyOn(rng,'randRange').mockReturnValue(species.length+index+1);
    expect((g as any).polymorphBoltTarget(rat)).toBe(true);expect(rat.typeId).toBe(m.typeId);expect(rat.spatial).toMatchObject({footprintId:m.typeId,pose:'r0'});expect(getNextEntityId()).toBe(allocated);expect(allocated).toBe(id+1);
    draw.mockReturnValue(1);expect((g as any).polymorphBoltTarget(m)).toBe(true);expect(m.typeId).toBe(species[0]!.id);expect(m.spatial).toBeUndefined();
    const before=JSON.stringify(rat),anchor=footprintOf(rat);
    for(let y=0;y<g.grid.height;y++)for(let x=0;x<g.grid.width;x++)g.grid.setTerrain(x,y,anchor.some(p=>p.x===x&&p.y===y)?T.FLOOR:T.WALL);
    // Sampling a larger builtin form cannot fit in the thin existing body.
    draw.mockReturnValue(species.length+2);expect((g as any).polymorphBoltTarget(rat)).toBe(false);expect(JSON.stringify(rat)).toBe(before);expect(getNextEntityId()).toBe(allocated);
  });
  it('r270 pending fall and cached layer validate full masks; retry after terrain change preserves pose and one fall damage',()=>{
    const {g,m}=diagnostic();g.mode='normal';(g as any).currentLevelDepth=1;m.behaviorFlags.add('MONST_WILL_NOT_USE_STAIRS');
    g.depth=2;(g as any).generateDepth(false);g.monsters=[];g.dormantMonsters=[];
    for(let y=0;y<g.grid.height;y++)for(let x=0;x<g.grid.width;x++)g.grid.setTerrain(x,y,T.WALL);
    g.depth=1;(g as any).generateDepth(true);const original=g.monsters.find(c=>c.id===m.id)!;original.falling=true;(g as any).monstersFall();
    expect((g as any).pendingFallenByDepth.get(2)).toContain(original);const hp=original.hp,saved=json(g.toSaveSnapshot());
    const bad=json(saved);bad.pendingFallenByDepth[0]!.monsters[0]!.loc={x:0,y:0};const before=world(g);expect(g.loadSnapshot(bad)).toBe(false);expect(world(g)).toEqual(before);
    const cached=json(saved),row=json(saved.pendingFallenByDepth[0]!.monsters[0]!);row.loc={x:0,y:0};cached.pendingFallenByDepth=[];cached.levels[0]!.monsters.push(row);expect(g.loadSnapshot(cached)).toBe(false);expect(world(g)).toEqual(before);
    expect(g.loadSnapshot(saved)).toBe(true);g.depth=2;(g as any).generateDepth(false);const pending=(g as any).pendingFallenByDepth.get(2)[0] as Monster;expect(pending.spatial!.pose).toBe('r270');
    for(let y=10;y<=17;y++)for(let x=10;x<=17;x++)g.grid.setTerrain(x,y,T.FLOOR);
    g.executeCommand('wait');expect(g.monsters).toContain(pending);expect(pending.hp).toBe(hp);expect(pending.spatial!.pose).toBe('r270');expect((g as any).pendingFallenByDepth.has(2)).toBe(false);
  });
  it('real NPC r270 recording survives checkpoint, each replay event, seek and continuation',()=>{
    const start=Game.prototype.startNewGame;
    vi.spyOn(Game.prototype,'startNewGame').mockImplementation(function(this:Game,...args){start.apply(this,args);if(!this.extensionRuntime)return;
      this.monsters=[];this.dormantMonsters=[];this.items=[];
      for(let y=0;y<this.grid.height;y++)for(let x=0;x<this.grid.width;x++){this.grid.setTerrain(x,y,x===0||y===0||x===this.grid.width-1||y===this.grid.height-1?T.WALL:T.FLOOR);this.grid.getCell(x,y)!.machineNumber=0;}
      this.environment=new EnvironmentManager(this.grid);this.waypoints=new WaypointSystem();commitCreatureAnchor(this.player,{x:65,y:14});
      const m=this.createModuleMonster('giants.spine-crawler',{x:12,y:12})!;m.spatial!.pose='r270';m.state=MonsterState.HUNTING;m.behaviorFlags.add('MONST_ALWAYS_HUNTING');m.givenUpOnScent=true;
    });
    const g=startGiants(['giants'],44004,'wizard'),states=[];let checkpoint:ReturnType<Game['toSaveSnapshot']>|undefined;
    for(let i=0;i<6;i++){g.executeCommand('wait');states.push(world(g));if(i===2)checkpoint=json(g.toSaveSnapshot());}
    const recording=json(g.exportRecording());expect(g.loadSnapshot(checkpoint!)).toBe(true);g.animationEnabled=false;
    for(let i=3;i<6;i++){g.executeCommand('wait');expect(world(g)).toEqual(states[i]);}expect(g.exportRecording().events).toEqual(recording.events);
    expect(g.loadReplay(recording)).toBe(true);g.animationEnabled=false;
    for(let i=0;i<6;i++){g.replayStep(true);expect(g.replayError).toBeNull();expect(world(g)).toEqual(states[i]);}
    for(const i of [3,6,1,5]){g.replaySeek(i);expect(g.replayError).toBeNull();expect(world(g)).toEqual(states[i-1]);}
  },60000);
  it('natural seed reaches a four-pose arena, native birth and live boss HUD',()=>{
    const {game,boss,state}=naturalSpine(),region=game.extensionRuntime!.ownedRegion(boss.spatial!.movementRegionId!,game.depth)!;
    expect(readCreatureBirth(boss)).toMatchObject({creationReason:'natural'});expect(region.bounds).toMatchObject({width:16,height:12});
    expect(state.placements.some(p=>p.result==='placed'&&p.templateId==='giants.spine-chamber')).toBe(true);
    const service=new CreatureSpatial({grid:game.grid,monsters:[boss],inRegion:(id,p)=>id===region.id&&p.x>=region.bounds.x&&p.y>=region.bounds.y&&p.x<region.bounds.x+region.bounds.width&&p.y<region.bounds.y+region.bounds.height},game.extensionRuntime!.spatialCatalog);
    try {const shape=rigidFootprint(service.catalog,boss.typeId);for(const pose of shape.poses)expect(service.canFitTerrainAt(boss,boss.spawnLoc,{},pose)).toBe(true);for(const turn of [-1,1] as const)expect(service.canRotateBetween(boss,boss.spawnLoc,'r0',turn,{},true)).toBe(true);}finally{service.dispose();}
    // HUD diagnostic only; the natural trace below never relocates the player.
    commitCreatureAnchor(game.player,{x:boss.x-2,y:boss.y});(game as any).updateVision();expect(selectBossHud(observeDisplayFrame(game,logger))?.id).toBe(boss.id);
  },60000);
  it('natural commands save/load, replay/seek and continue with trusted shape+region truth',()=>{
    const {game,boss}=naturalSpine(),saved=json(game.toSaveSnapshot()),recording=json(game.exportRecording()),expected=world(game);
    expect(game.loadSnapshot(saved)).toBe(true);game.animationEnabled=false;expect(world(game)).toEqual(expected);expect(game.monsters.find(c=>c.id===boss.id)!.spatial).toEqual(boss.spatial);
    game.executeCommand('wait');const continued=world(game),continuation=json(game.exportRecording());expect(continuation.events.slice(0,recording.events.length)).toEqual(recording.events);
    expect(game.loadReplay(recording)).toBe(true);game.animationEnabled=false;
    while(game.replayCursor<recording.events.length){game.replayStep(true);expect(game.replayError).toBeNull();}expect(world(game)).toEqual(expected);
    for(const i of [0,Math.floor(recording.events.length/2),recording.events.length]){game.replaySeek(i);expect(game.replayCursor).toBe(i);expect(game.replayError).toBeNull();}
    expect(game.loadReplay(continuation)).toBe(true);game.animationEnabled=false;
    while(game.replayCursor<continuation.events.length){game.replayStep(true);expect(game.replayError).toBeNull();}expect(world(game)).toEqual(continued);
  },300000); // 1174-command natural route; slower CI hosts measured ~152s

});
