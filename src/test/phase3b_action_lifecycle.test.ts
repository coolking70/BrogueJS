import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { createActorActionBundle, createActorActionScheduler, validateActorActionSchedulerState, type ActorActionSchedulerState } from '../engine/Core/ActorActionScheduler';
import { productionActorActionScheduler, reconcileProductionActorActions, validateProductionActorActionState } from '../engine/Core/ActorActionProduction';
import { preparePhasedAttackCommand, commitPhasedAttackCommand } from '../engine/Core/PhasedAttackProduction';
import { commitCreatureAnchor } from '../engine/Movement/CreatureSpatial';
import { TerrainType } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import type { ProductionActorAttackState } from '../ext/actorActions';
import { selectNativeActorAction } from '../engine/Core/ActorActionSession';
import { bindPresentationObserver } from '../engine/Core/PresentationObserver';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';

const attackCommand = JSON.stringify({module:'combat',action:'attack',payload:{attackId:'fixture.double-thrust',facing:'e'}});
function scene(mode: 'test'|'normal'='test') {
    const game=createHeadlessGame(7397,mode);
    game.startNewGame({seed:7397,mode,ruleSet:'extended',extensions:['combat']});
    game.animationEnabled=false; game.monsters=[]; game.items=[];
    for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++)if(game.grid.isValidPos(game.player.x+dx,game.player.y+dy))game.grid.setTerrain(game.player.x+dx,game.player.y+dy,TerrainType.FLOOR);
    game.player.ticksUntilTurn=0;
    const state=game.extensionRuntime!.actorActionBinding()!.state as unknown as ProductionActorAttackState;
    const plan=preparePhasedAttackCommand(game,attackCommand); expect(plan).not.toBeNull();
    expect(commitPhasedAttackCommand(game,plan!)).toBe(true);
    return {game,state,scheduler:productionActorActionScheduler(game)!};
}
afterEach(()=>{vi.restoreAllMocks();logger.reset();});

describe('3b production action lifetime',()=>{
    it('binds a module-owned busy action on load without time, RNG, cost, or a release',()=>{
        const {game,state}=scene(), snapshot=game.toSnapshot(), before=structuredClone(state), random=rng.getState();
        expect(game.loadSnapshot(snapshot)).toBe(true);
        const loaded=game.extensionRuntime!.actorActionBinding()!.state;
        expect(loaded).toEqual(before); expect(rng.getState()).toEqual(random);
        expect(productionActorActionScheduler(game)!.isBusy(game.player.id)).toBe(true);
        expect(game.toSnapshot().extensions!.modules.combat).toEqual(snapshot.extensions!.modules.combat);
    });
    it.each([0,1,2])('resumes saved player phase %s on the next update, with no extra input, fee or prelude',phaseIndex=>{
        const {game,state,scheduler}=scene();
        for(let index=0;index<phaseIndex;index++){
            const ticks=scheduler.nextActionBoundary()!;scheduler.advanceActionTime(ticks);scheduler.dispatchActorBoundary(game.player.id);
        }
        const stamina=state.actors[0]!.stamina, snapshot=game.toSnapshot(),random=rng.getState(),before=structuredClone(state),turn=game.stats.turns;
        expect(game.loadSnapshot(snapshot)).toBe(true);expect(rng.getState()).toEqual(random);
        expect(game.extensionRuntime!.actorActionBinding()!.state).toEqual(before);expect(game.isInputLocked()).toBe(true);
        const start={...game.player.loc};game.executeCommand('move',{x:1,y:0});expect(game.player.loc).toEqual(start);
        const prelude=vi.spyOn(game as any,'playerTurnEnded');const sweep=vi.spyOn(game as any,'sweepDeepWaterItem');
        game.update();
        const loaded=game.extensionRuntime!.actorActionBinding()!.state as unknown as ProductionActorAttackState;
        expect(loaded.scheduler.bundles).toEqual([]);expect(loaded.actors[0]!.stamina).toBe(stamina);expect(prelude).not.toHaveBeenCalled();
        expect(game.stats.turns).toBe(turn+1);expect(sweep.mock.calls.filter(call=>call[0]===game.player)).toHaveLength(1);
        expect(game.isInputLocked()).toBe(false);game.update();expect(game.stats.turns).toBe(turn+1);
    });
    it('rejects a bad native clock before retiring the live world or session',()=>{
        const {game}=scene(), snapshot=game.toSnapshot(), oldPlayer=game.player, oldRuntime=game.extensionRuntime, oldScheduler=productionActorActionScheduler(game), random=rng.getState();
        snapshot.player.ticksUntilTurn++;
        expect(game.loadSnapshot(snapshot)).toBe(false);
        expect(game.player).toBe(oldPlayer); expect(game.extensionRuntime).toBe(oldRuntime); expect(productionActorActionScheduler(game)).toBe(oldScheduler);
        expect(rng.getState()).toEqual(random);
    });
    it.each(['paralyzed','entranced'] as const)('rejects an unreleased %s source before replacing the current run',status=>{
        const {game}=scene(),snapshot=game.toSnapshot(),player=game.player,runtime=game.extensionRuntime;
        snapshot.player.statusDurations[status]=4;
        expect(game.loadSnapshot(snapshot)).toBe(false);expect(game.player).toBe(player);expect(game.extensionRuntime).toBe(runtime);
    });
    it('turns forced source displacement into one positive recovery without releasing old cells',()=>{
        const {game,state,scheduler}=scene(), source=state.scheduler.bundles[0]!.subactions[0]!;
        scheduler.advanceActionTime(7);
        const cost=state.actors[0]!.stamina, random=rng.getState();
        commitCreatureAnchor(game.player,{x:game.player.x,y:game.player.y+1});
        reconcileProductionActorActions(game);
        expect(source.phases[source.phaseIndex]!.kind).toBe('break-recovery');
        expect(source.phaseRemainingTicks).toBe(50); expect(game.player.ticksUntilTurn).toBe(50);
        expect(state.actions[0]!.subactions[0]!.lockedCells).toEqual([]);
        expect(state.actors[0]!.stamina).toBe(cost); expect(rng.getState()).toEqual(random);
        validateActorActionSchedulerState(state.scheduler);
        scheduler.advanceActionTime(13); reconcileProductionActorActions(game);
        expect(source.phaseRemainingTicks).toBe(37);
        const snapshot=game.toSnapshot(); expect(game.loadSnapshot(snapshot)).toBe(true);
        expect((game.extensionRuntime!.actorActionBinding()!.state as unknown as ProductionActorAttackState).scheduler).toEqual(state.scheduler);
    });
    it('does not revive a pending attack after a source moves away and back before reconciliation',()=>{
        const {game,state}=scene(),origin={...game.player.loc},version=state.scheduler.bundles[0]!.subactions[0]!.sourceFootprintVersion;
        commitCreatureAnchor(game.player,{x:origin.x,y:origin.y+1});commitCreatureAnchor(game.player,origin);
        reconcileProductionActorActions(game);
        const child=state.scheduler.bundles[0]!.subactions[0]!;
        expect(child.sourceFootprintVersion).toBe(version);expect(child.phases[child.phaseIndex]!.kind).toBe('break-recovery');
        expect(state.actions[0]!.subactions[0]!.lockedCells).toEqual([]);
    });
    it('cancels a native single-cell polymorph even when its spatial fingerprint is unchanged',()=>{
        const {game,state}=scene();
        const monster=new Monster(game.player.x+1,game.player.y,(monsters as MonsterData[]).find(row=>row.id==='rat')!);
        monster.state=MonsterState.HUNTING;monster.ticksUntilTurn=0;game.monsters.push(monster);game.extensionRuntime!.attachCreature(monster);
        expect(selectNativeActorAction(game,monster.id)).toBe('handled');
        const bundle=state.scheduler.bundles.find(row=>row.decisionOwnerId===monster.id)!,child=bundle.subactions[0]!;
        const geometry=JSON.stringify(game.spatialOf(monster));
        (game as any).polymorphBoltTarget(monster);
        expect(monster.typeId).not.toBe('rat');expect(JSON.stringify(game.spatialOf(monster))).toBe(geometry);
        expect(child.phases[child.phaseIndex]!.kind).toBe('break-recovery');expect(child.phaseRemainingTicks).toBe(50);expect(monster.ticksUntilTurn).toBe(50);
        expect(state.actions.find(row=>row.actionId===bundle.actionId)!.subactions[0]!.lockedCells).toEqual([]);
        expect(game.loadSnapshot(game.toSnapshot())).toBe(true);
    });
    it('preserves actual elapsed time and performs one terminal sweep on interruption',()=>{
        const {game,state,scheduler}=scene();
        const sweep=vi.spyOn(game as any,'sweepDeepWaterItem');
        scheduler.advanceActionTime(11);
        game.player.setStatusDuration('paralyzed',10);
        reconcileProductionActorActions(game);
        scheduler.advanceActionTime(50);
        expect(scheduler.dispatchActorBoundary(game.player.id)).toBe('native-fallback');
        expect(sweep).toHaveBeenCalledExactlyOnceWith(game.player,61);
        expect(state.scheduler.bundles).toEqual([]); expect(state.actions).toEqual([]);
    });
    it('retires a dead owner without a terminal sweep or delayed release',()=>{
        const {game,state,scheduler}=scene(),sweep=vi.spyOn(game as any,'sweepDeepWaterItem');
        game.player.hp=0; scheduler.cancelDeadActions();
        expect(state.scheduler.bundles).toEqual([]); expect(state.actions).toEqual([]);
        expect(sweep).not.toHaveBeenCalled(); expect(scheduler.nextActionBoundary()).toBeNull();
    });
    it('cancels active releases on real floor departure and freezes cached recovery through return',()=>{
        const {game,state,scheduler}=scene('normal');
        const monster=new Monster(game.player.x+1,game.player.y,(monsters as MonsterData[]).find(row=>row.id==='rat')!);
        monster.state=MonsterState.HUNTING;monster.ticksUntilTurn=0;game.monsters.push(monster);game.extensionRuntime!.attachCreature(monster);
        expect(selectNativeActorAction(game,monster.id)).toBe('handled');
        const bundle=state.scheduler.bundles.find(row=>row.decisionOwnerId===monster.id)!;
        scheduler.advanceActionTime(7);
        game.depth=2;(game as any).generateDepth(false,false);
        expect(game.levels.get(1)!.monsters).toContain(monster);
        expect(bundle.subactions[0]!.phases[bundle.subactions[0]!.phaseIndex]!.kind).toBe('break-recovery');
        expect(bundle.subactions[0]!.phaseRemainingTicks).toBe(50);expect(bundle.elapsedActionTicks).toBe(7);
        expect(state.actions.find(row=>row.actionId===bundle.actionId)!.subactions[0]!.lockedCells).toEqual([]);
        scheduler.advanceActionTime(9);
        expect(bundle.subactions[0]!.phaseRemainingTicks).toBe(50);expect(monster.ticksUntilTurn).toBe(50);
        game.depth=1;(game as any).generateDepth(true,false);
        expect(game.monsters).toContain(monster);expect(bundle.subactions[0]!.phaseRemainingTicks).toBe(50);
        scheduler.advanceActionTime(5);expect(bundle.subactions[0]!.phaseRemainingTicks).toBe(45);
        const snapshot=game.toSnapshot();expect(game.loadSnapshot(snapshot)).toBe(true);
    });
    it('restores busy action state and a fresh session after a failed floor transaction',()=>{
        const {game,state}=scene('normal'),before=structuredClone(state),random=rng.getState(),runtime=game.extensionRuntime!;
        const emit=runtime.emit.bind(runtime);
        const spy=vi.spyOn(runtime,'emit').mockImplementation((name,event)=>{if(name==='enteredLevel')throw new Error('entry failure');return emit(name,event);});
        game.depth=2;expect(()=>(game as any).generateDepth(false,false)).toThrow('entry failure');spy.mockRestore();
        expect(game.depth).toBe(1);expect(runtime.actorActionBinding()!.state).toEqual(before);expect(rng.getState()).toEqual(random);
        expect(productionActorActionScheduler(game)!.isBusy(game.player.id)).toBe(true);
        expect(()=>game.toSnapshot()).not.toThrow();
    });
    it.each([false,true])('finishes carried recovery after a player fall without stranding its mirror (animated=%s)',animated=>{
        const {game,state}=scene();game.animationEnabled=animated;game.player.hp=100;game.player.maxHp=100;
        const turn=game.stats.turns,sweep=vi.spyOn(game as any,'sweepDeepWaterItem');(game as any).playerFalling=true;
        (game as any).playerTurnEnded();
        while(game.isAdvancing)game.tickAdvancement(1000);
        expect(game.depth).toBe(2);expect(game.isInputLocked()).toBe(false);expect(game.player.ticksUntilTurn).toBe(0);
        expect(state.scheduler.bundles).toEqual([]);expect(state.actions).toEqual([]);expect(game.stats.turns).toBe(turn+1);
        expect(sweep.mock.calls.filter(call=>call[0]===game.player)).toHaveLength(0);
        expect(()=>game.toSnapshot()).not.toThrow();
    });
    it('invalidates a faulted recording and allows recovery only by loading a validated prior state',()=>{
        const {game,scheduler}=scene(),valid=game.toSnapshot();
        vi.spyOn(game,'finishActorActionSweep').mockImplementation(()=>{throw new Error('terminal sweep fault');});
        const drain=()=>{let boundary;while((boundary=scheduler.nextActionBoundary())!==null){scheduler.advanceActionTime(boundary);scheduler.dispatchActorBoundary(game.player.id);}};
        expect(drain).toThrow('terminal sweep fault');
        expect(game.hasCompleteRecording).toBe(false);expect(game.isInputLocked()).toBe(true);expect(()=>game.exportRecording()).toThrow();expect(()=>game.toSnapshot()).toThrow('terminal sweep fault');
        expect(game.loadSnapshot(valid)).toBe(true);expect(productionActorActionScheduler(game)!.isBusy(game.player.id)).toBe(true);
    });
    it('captures detached settled phase boundaries while display observes no random draws',()=>{
        const {game,state}=scene(), phases:string[]=[], randomStates:ReturnType<typeof rng.getState>[]=[];
        const unbind=bindPresentationObserver(game,{reset(){},blocked(){return false;},observe(){
            const source=state.scheduler.bundles[0]?.subactions[0];
            phases.push(source?.phases[source.phaseIndex]?.kind??'idle');
            const before=rng.getState(); game.extensionRuntime!.readModuleView('combat'); randomStates.push(rng.getState()); expect(rng.getState()).toEqual(before);
        }});
        (game as any).playerTurnEnded();
        unbind();
        expect(phases).toContain('inter-segment');expect(phases).toContain('recovery');expect(phases[phases.length - 1]).toBe('idle');expect(randomStates.length).toBeGreaterThan(2);
    });
    it('refuses pending attacks on cached layers even if the timer mirror matches',()=>{
        const {game,state}=scene();
        expect(()=>validateProductionActorActionState(state.scheduler,{depth:2,player:game.player,levels:[]})).toThrow();
    });
});

describe('3b single-clock cached scheduler policy',()=>{
    it('freezes cached recovery while current owners advance, then resumes the same remaining ticks',()=>{
        const state:ActorActionSchedulerState={schema:1,bundles:[]};
        const actors=new Map([[1,{alive:true,ticksUntilTurn:0,depth:1}],[2,{alive:true,ticksUntilTurn:0,depth:2}]]);
        let currentDepth=1;
        const scheduler=createActorActionScheduler(state,{
            decisionOwnerId:id=>id,readActor:id=>actors.get(id)??null,actorDepth:id=>actors.get(id)?.depth??null,
            writeOwnerTicks:(id,ticks)=>{actors.get(id)!.ticksUntilTurn=ticks;},isDepthActive:depth=>depth===currentDepth,
            isSourceValid:()=>true,resolveSegment:()=>{},finishAction:()=>{},onFault:error=>{throw error;},
        });
        for(const [id,actor] of actors)scheduler.commitBundle(createActorActionBundle({actionId:id,depth:actor.depth,decisionOwnerId:id,timeChargeOwnerId:id,
            subactions:[{sourceEntityId:id,sourcePartId:'body',sourceFootprintVersion:'test',phases:[{kind:'recovery',durationTicks:50,segmentIndex:null}]}]}));
        scheduler.advanceActionTime(17);
        expect(actors.get(1)!.ticksUntilTurn).toBe(33); expect(actors.get(2)!.ticksUntilTurn).toBe(50);
        currentDepth=2;scheduler.advanceActionTime(9);
        expect(actors.get(1)!.ticksUntilTurn).toBe(33); expect(actors.get(2)!.ticksUntilTurn).toBe(41);
        expect(state.bundles.map(bundle=>bundle.elapsedActionTicks)).toEqual([17,9]);
        expect(scheduler.snapshot()).toEqual(state);
    });
});
