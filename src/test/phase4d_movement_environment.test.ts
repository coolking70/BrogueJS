import { afterEach, expect, it, vi } from 'vitest';
import { installProductionBody, productionBodyScene, startProductionGame, emptyProductionArena, PRODUCTION_BODY_ID } from './support/productionComposite';
import { auditFullObjectGraph, fullGenerationRoots } from './support/fullGenerationCheckpointOracle';
import { commitCompositeAnchors, CreatureSpatial, footprintOf } from '../engine/Movement/CreatureSpatial';
import { CompositeMovement } from '../engine/Movement/CompositeMovement';
import { bodyConstraintsSatisfied } from '../engine/Movement/BodyConstraints';
import { monsterCanSubmergeNow, hiddenBySubmersion, surfaceOnDryLand, isSubmerged } from '../engine/Movement/Submersion';
import { TerrainType as T, DungeonLayer as L } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { getNextEntityId } from '../entities/Creature';
import { logger } from '../engine/Systems/Logger';
afterEach(()=>{vi.restoreAllMocks();logger.reset();});
function twoStepScene() {
    const data=installProductionBody();data.definition.parts[1]!.preferredOffset={x:-5,y:0};data.definition.constraints[0]!.maxDistance=6;
    const game=startProductionGame();emptyProductionArena(game);const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!,leg=game.monsters[1]!;
    commitCompositeAnchors(game.monsters.map(creature=>({creature,at:creature===leg?{x:8,y:12}:creature.loc})));
    return {game,core,leg,group:game.bodyGroups![0]!};
}
it('production publishes a complete cohort at each of two member steps, with one shared environment scope',()=>{
    const {game,core,leg,group}=twoStepScene(), visits:number[]=[],scopes=new Set<unknown>();
    const native=(game as any).applyEnvironmentalEffects.bind(game);
    vi.spyOn(game as any,'applyEnvironmentalEffects').mockImplementation((...args: any[])=>{
        if(args[0]===leg){visits.push(leg.x);scopes.add(args[2]);expect(bodyConstraintsSatisfied(game.spatialCatalog,game.spatialCatalog.body(group.bodyDefinitionId),
            new Map(game.monsters.map(a=>[a.spatial!.bodyMember!.partId,{anchor:a.loc,footprintId:a.spatial!.footprintId,pose:a.spatial!.pose}])),game.grid)).toBe(true);}
        return native(...args);
    });
    expect((game as any).tryMoveBodyCore(core,{x:15,y:12})).toBe(true);
    expect(visits).toEqual([9,10]);expect(scopes.size).toBe(1);expect(core.ticksUntilTurn).toBe(100);
});
it.each(['break','warp'] as const)('a first-substep %s prevents old second-step contact',kind=>{
    const {game,core,leg}=twoStepScene(),visits:number[]=[];let fired=false;
    const native=(game as any).applyEnvironmentalEffects.bind(game);
    vi.spyOn(game as any,'applyEnvironmentalEffects').mockImplementation((...args:any[])=>{
        native(...args);if(args[0]!==leg)return;visits.push(leg.x);
        if(!fired&&leg.x===9){fired=true;if(kind==='break')leg.takeDamage(leg.hp,true);else expect(game.placeCreature(core,{x:30,y:12})).toBe(true);}
    });
    expect((game as any).tryMoveBodyCore(core,{x:15,y:12})).toBe(true);
    expect(fired).toBe(true);expect(visits).not.toContain(10);
    if(kind==='break')expect(game.monsters).not.toContain(leg);else expect(core.x).toBe(30);
});
it('environment failure after terrain, status, HP and revision writes restores the independently audited graph and the next move',()=>{
    const {game,core,leg}=twoStepScene();const native=(game as any).applyEnvironmentalEffects.bind(game);
    const before=game.toSaveSnapshot(),random=rng.getState(),id=getNextEntityId(),audit=auditFullObjectGraph(fullGenerationRoots(game),[game.extensionRuntime!]);
    const fail=vi.spyOn(game as any,'applyEnvironmentalEffects').mockImplementation((...args:any[])=>{
        native(...args);if(args[0]===leg){game.grid.setTerrainLayer(10,12,L.SURFACE,T.WEB);leg.addPoison(4);leg.takeDamage(4,true);rng.randRange(1,5);throw Error('substep fault');}
    });
    expect(()=>(game as any).tryMoveBodyCore(core,{x:15,y:12})).toThrow('substep fault');fail.mockRestore();
    expect(audit.differences()).toEqual([]);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(id);
    expect((game as any).tryMoveBodyCore(core,{x:15,y:12})).toBe(true);const expected=game.toSaveSnapshot();
    expect(game.loadSnapshot(before)).toBe(true);expect((game as any).tryMoveBodyCore(game.monsters.find(a=>a.id===core.id),{x:15,y:12})).toBe(true);
    const actual=game.toSaveSnapshot();actual.savedAt=expected.savedAt;expect(actual).toEqual(expected);
});
it('actual web contact at the intermediate foot stops its remaining displacement and only binds that foot',()=>{
    const {game,core,leg}=twoStepScene();const native=(game as any).applyEnvironmentalEffects.bind(game);
    vi.spyOn(game as any,'applyEnvironmentalEffects').mockImplementation((...args:any[])=>{
        if(args[0]===core)game.grid.setTerrainLayer(leg.x,leg.y,L.SURFACE,T.WEB);
        return native(...args);
    });
    expect((game as any).tryMoveBodyCore(core,{x:15,y:12})).toBe(true);
    expect(leg.x).toBe(9);
    expect(leg.hasStatus('stuck')).toBe(true);expect(core.hasStatus('stuck')).toBe(false);
    // Terrain appears after planning, as it can after a machine/DF contact.
    expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});
it('rotation of a declared rigid member uses the core clock and rejects a swept wall',()=>{
    const data=installProductionBody();delete (data.leg as {size?:number}).size;
    Object.assign(data.leg,{footprint:{geometry:{kind:'mask',cells:[{x:0,y:0},{x:-1,y:0}]},poses:['r0','r90','r180','r270']}});
    // Keep the larger members mutually disjoint in a wide star.
    const offsets=[{x:-5,y:-4},{x:0,y:-4},{x:5,y:-4},{x:5,y:0},{x:5,y:4},{x:0,y:4},{x:-5,y:4},{x:-5,y:0}];
    data.definition.parts.forEach((p,i)=>{if(i)p.preferredOffset=offsets[i-1]!;});data.definition.constraints.forEach(e=>{e.maxDistance=7;e.minDistance=0;});
    const game=startProductionGame();emptyProductionArena(game);const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:20,y:12})!,leg=game.monsters[1]!,clock=leg.ticksUntilTurn;
    expect(game.rotateSpatialActor(leg,1)).toBe(true);expect(leg.spatial!.pose).toBe('r90');expect(core.ticksUntilTurn).toBe(100);expect(leg.ticksUntilTurn).toBe(clock);
    const spatial=new CreatureSpatial(game,game.spatialCatalog);spatial.groups.push(game.bodyGroups![0]!);
    const result=new CompositeMovement(spatial).planStep(core.id,{x:21,y:12});expect(result.status).toBe('planned');spatial.dispose();
    game.grid.setTerrain(leg.x+1,leg.y,T.WALL);const random=rng.getState();expect(game.rotateSpatialActor(leg,1)).toBe(false);expect(leg.spatial!.pose).toBe('r90');expect(rng.getState()).toEqual(random);
});
it('a declared rigid core rotates and keeps the full tree valid through subsequent whole movement',()=>{
    const data=installProductionBody();delete (data.core as {size?:number}).size;
    Object.assign(data.core,{footprint:{geometry:{kind:'mask',cells:[{x:0,y:0},{x:1,y:0}]},poses:['r0','r90','r180','r270']}});
    const offsets=[{x:-5,y:-4},{x:0,y:-4},{x:5,y:-4},{x:5,y:0},{x:5,y:4},{x:0,y:4},{x:-5,y:4},{x:-5,y:0}];
    data.definition.parts.forEach((p,i)=>{if(i)p.preferredOffset=offsets[i-1]!;});data.definition.constraints.forEach(e=>{e.maxDistance=7;e.minDistance=0;});
    const game=startProductionGame();emptyProductionArena(game);const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:20,y:12})!,clocks=game.monsters.slice(1).map(a=>a.ticksUntilTurn);
    expect(game.rotateSpatialActor(core,1)).toBe(true);expect(core.spatial!.pose).toBe('r90');expect(core.ticksUntilTurn).toBe(100);
    expect(game.monsters.slice(1).map(a=>a.ticksUntilTurn)).toEqual(clocks);expect((game as any).tryMoveBodyCore(core,{x:21,y:12})).toBe(true);
    expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});
it('a web struggle and its subsequent failed environment restore the pre-attempt local status and terrain',()=>{
    const {game,core,leg}=twoStepScene();leg.setStatusDuration('stuck',1);game.grid.setTerrainLayer(leg.x,leg.y,L.SURFACE,T.WEB);
    const before=game.toSaveSnapshot(),random=rng.getState(),native=(game as any).applyEnvironmentalEffects.bind(game);
    const fail=vi.spyOn(game as any,'applyEnvironmentalEffects').mockImplementation((...args:any[])=>{native(...args);throw Error('after struggle');});
    expect(()=>(game as any).tryMoveBodyCore(core,{x:15,y:12})).toThrow('after struggle');fail.mockRestore();
    expect(leg.getStatusDuration('stuck')).toBe(1);expect(game.grid.getCell(leg.x,leg.y)!.layers[L.SURFACE]).toBe(T.WEB);expect(rng.getState()).toEqual(random);
    const after=game.toSaveSnapshot();after.savedAt=before.savedAt;expect(after).toEqual(before);
});
it('a real gas pressure trap rolls back its DF, machine, gas, status and contact ledger after an injected environment fault',()=>{
    const {game,core,leg}=twoStepScene();for(const y of [11,12,13]){game.grid.setTerrainLayer(9,y,L.SURFACE,T.GAS_TRAP_PARALYSIS);game.grid.getCell(9,y)!.machineNumber=7;}
    game.grid.setTerrainLayer(9,14,L.SURFACE,T.MACHINE_PARALYSIS_VENT);game.grid.getCell(9,14)!.machineNumber=7;
    const before=game.toSaveSnapshot(),ext=JSON.stringify(game.extensionRuntime!.snapshot()),random=rng.getState(),audit=auditFullObjectGraph(fullGenerationRoots(game),[game.extensionRuntime!]);
    const native=(game as any).applyEnvironmentalEffects.bind(game);let fired=false;
    const fail=vi.spyOn(game as any,'applyEnvironmentalEffects').mockImplementation((...args:any[])=>{native(...args);if(args[0]===leg){
        expect((game as any).displacementTrapDepressions.get(game.grid).has(leg.y*game.grid.width+leg.x)).toBe(true);
        expect(game.grid.getCell(9,14)!.layers[L.GAS]).toBe(T.PARALYSIS_GAS);fired=true;throw Error('trap fault');}});
    expect(()=>(game as any).tryMoveBodyCore(core,{x:15,y:12},undefined,false,true)).toThrow('trap fault');fail.mockRestore();expect(fired).toBe(true);
    expect(audit.differences()).toEqual([]);expect(JSON.stringify(game.extensionRuntime!.snapshot())).toBe(ext);expect(rng.getState()).toEqual(random);
    expect([11,12,13].some(y=>(game as any).displacementTrapDepressions?.get(game.grid)?.has(y*game.grid.width+9))).toBe(false);
    expect((game as any).tryMoveBodyCore(core,{x:15,y:12},undefined,false,true)).toBe(true);expect(game.grid.getCell(9,14)!.layers[L.GAS]).toBe(T.PARALYSIS_GAS);
    expect(game.loadSnapshot(before)).toBe(true);expect((game as any).tryMoveBodyCore(game.monsters.find(m=>m.id===core.id),{x:15,y:12},undefined,false,true)).toBe(true);
});
it('a pending whole-body landing fault restores the queue and permits the next identical retry without a second fall injury',()=>{
    const {game,core,actors}=productionBodyScene();core.applyStatus('paralyzed',1000);
    for(const actor of actors)for(const p of footprintOf(actor))game.grid.setTerrainLayer(p.x,p.y,L.LIQUID,T.CHASM);
    game.executeCommand('wait');expect((game as any).pendingFallenByDepth.get(2)).toHaveLength(9);const hp=core.hp;
    game.depth=2;emptyProductionArena(game);const random=rng.getState(),audit=auditFullObjectGraph(fullGenerationRoots(game),[game.extensionRuntime!]);
    const native=(game as any).applyEnvironmentalEffects.bind(game),fail=vi.spyOn(game as any,'applyEnvironmentalEffects').mockImplementation((...args:any[])=>{native(...args);throw Error('landing fault');});
    expect(()=>(game as any).retrySquareLandings()).toThrow('landing fault');fail.mockRestore();expect(audit.differences()).toEqual([]);expect(rng.getState()).toEqual(random);
    expect((game as any).pendingFallenByDepth.get(2)).toEqual(actors);expect(core.hp).toBe(hp);
    (game as any).retrySquareLandings();expect(game.monsters).toEqual(actors);expect(core.hp).toBe(hp);expect((game as any).pendingFallenByDepth.has(2)).toBe(false);
});
it('a real whole fall region-exit failure restores the old owned bindings before a one-injury retry',()=>{
    const {game,core,actors}=productionBodyScene(),runtime=game.extensionRuntime!,token=runtime.beginGeneration('fall-region-fixture');
    const region=runtime.installOwnedRegions(token,'giants',[{instanceKey:'fall-region-fixture',bounds:{x:5,y:5,width:30,height:17}}],game.grid)[0]!;
    runtime.commitGeneration(token);for(const actor of actors)actor.spatial!.movementRegionId=region.id;
    const hp=core.hp,random=rng.getState(),audit=auditFullObjectGraph(fullGenerationRoots(game),[runtime]);
    const native=runtime.releaseFallenMovementRegion.bind(runtime);let exited=false;
    const fail=vi.spyOn(runtime,'releaseFallenMovementRegion').mockImplementation((actor,depth)=>{
        native(actor,depth);if(actor===actors[1]){exited=true;expect(actor.spatial!.movementRegionId).toBeUndefined();throw Error('fall region fault');}
    });
    expect(()=>(game as any).fallWholeBody(core)).toThrow('fall region fault');fail.mockRestore();expect(exited).toBe(true);
    expect(audit.differences()).toEqual([]);expect(rng.getState()).toEqual(random);expect(actors.every(a=>a.spatial!.movementRegionId===region.id)).toBe(true);
    (game as any).fallWholeBody(core);expect((game as any).pendingFallenByDepth.get(2)).toHaveLength(9);
    expect(core.hp).toBeGreaterThanOrEqual(hp-12);expect(core.hp).toBeLessThanOrEqual(hp-6);
    expect(actors.every(a=>a.spatial!.movementRegionId===undefined)).toBe(true);
});
it('submersion is an all-parts predicate, one core draw, shared hidden state and immediate dry-foot surfacing',()=>{
    const {game,core,actors}=productionBodyScene();
    for(const actor of actors){actor.behaviorFlags.add('MONST_SUBMERGES');for(const p of footprintOf(actor))game.grid.setTerrainLayer(p.x,p.y,L.LIQUID,T.WATER_DEEP);}
    expect(monsterCanSubmergeNow(core,game.grid)).toBe(true);
    const roll=vi.spyOn(rng,'randPercent').mockReturnValue(true);actors.forEach(a=>a.updateSubmersion(game.grid));expect(roll).toHaveBeenCalledOnce();
    expect(actors.every(isSubmerged)).toBe(true);expect(hiddenBySubmersion(game.grid,actors[1]!,game.player)).toBe(true);
    const foot=actors[1]!;game.grid.setTerrainLayer(foot.x,foot.y,L.LIQUID,T.NOTHING);surfaceOnDryLand(foot,game.grid);
    expect(actors.some(isSubmerged)).toBe(false);expect(monsterCanSubmergeNow(core,game.grid)).toBe(false);
});
it('one flying foot cannot grant whole-group flight, while a grounded support keeps a core over the pit',()=>{
    const {game,core,actors}=productionBodyScene();for(const a of actors)for(const p of footprintOf(a))game.grid.setTerrain(p.x,p.y,T.CHASM);
    actors[1]!.applyStatus('levitating',20);expect((game as any).creatureShouldFall(core)).toBe(true);
    game.grid.setTerrain(actors[2]!.x,actors[2]!.y,T.FLOOR);expect((game as any).creatureShouldFall(core)).toBe(false);
});
