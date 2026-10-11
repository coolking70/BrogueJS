import { afterEach, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as catalog from '../ext/catalog';
import { registryFromDescriptors, FOUNDATION_PROTOCOL, type ModuleDescriptor } from '../ext/descriptor';
import { actorActionProtocolFixture } from './fixtures/actorActionProtocol';
import { startProductionGame, emptyProductionArena } from './support/productionComposite';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
import { productionActorActionScheduler } from '../engine/Core/ActorActionProduction';
import { preparePhasedAttackCommand, commitPhasedAttackCommand, phasedAttackBoundaryIdentity } from '../engine/Core/PhasedAttackProduction';
import { prepareWorldRest, commitWorldRest, settleWorldRest } from '../engine/Core/WorldRestProduction';
import { selectNativeActorAction } from '../engine/Core/ActorActionSession';
import { commitCreatureAnchor } from '../engine/Movement/CreatureSpatial';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
import type { Game } from '../engine/Core/Game';
import { createHeadlessGame } from './harness';

afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
// Always use the independent protocol descriptor, including when combat is
// installed. These root regressions survive physical content-package removal.
function scene(seed = 7397) {
    let fail = false;
    const fault: ModuleDescriptor = { id:'generation-fault', version:'1.0.0', foundation:FOUNDATION_PROTOCOL,
        labelKey:'ext.generation-fault.label', create:()=>({id:'generation-fault',version:'1.0.0',initialState:()=>({count:0}),
            validateState:(v):v is any=>!!v&&typeof v==='object'&&'count' in v,
            hooks:{generationCommitted:(_e,c)=>{c.setState({count:(c.state as {count:number}).count+1});if(fail)throw new Error('other module publication');}}}) };
    const descriptors = [actorActionProtocolFixture, fault];
    vi.spyOn(catalog,'getInstalledModuleDescriptors').mockReturnValue(descriptors);
    vi.spyOn(catalog,'createExtensionRegistry').mockImplementation(()=>registryFromDescriptors(descriptors));
    const game = startProductionGame(['combat','generation-fault'], seed, 'normal');
    emptyProductionArena(game); game.player.ticksUntilTurn = 0;
    return {game, fail:()=>{fail=true;}};
}
function attack(game: Game) {
    const command=JSON.stringify({module:'combat',action:'attack',payload:{attackId:'fixture.double-thrust',facing:'e'}});
    const plan=preparePhasedAttackCommand(game,command); expect(plan).not.toBeNull();
    expect(commitPhasedAttackCommand(game,plan!)).toBe(true);
}
function retained(game: Game) {
    const runtime=game.extensionRuntime!, ledger=runtime.actorActionBinding()!.state;
    const value=structuredClone(ledger), graph=auditFullObjectGraph(ledger), random=rng.getState();
    const scheduler=productionActorActionScheduler(game), root=game.actorActions;
    return () => {
        expect(runtime.actorActionBinding()!.state).toBe(ledger);
        expect(ledger).toEqual(value); expect(graph.differences()).toEqual([]);
        expect(productionActorActionScheduler(game)).toBe(scheduler); expect(game.actorActions).toBe(root);
        expect(rng.getState()).toEqual(random);
    };
}
function finish(game: Game) {
    const scheduler=productionActorActionScheduler(game)!;
    for(let n=0;n<30&&scheduler.nextActionBoundary()!==null;n++) {
        scheduler.advanceActionTime(scheduler.nextActionBoundary()!);
        for(const bundle of [...game.actorActions!.bundles]) scheduler.dispatchActorBoundary(bundle.decisionOwnerId);
    }
    settleWorldRest(game);
    expect(game.actorActions!.bundles).toEqual([]);
    expect(game.extensionRuntime!.actorActionBinding()!.state.actions).toEqual([]);
    expect(game.lastAdvancementError).toBeNull();
    // Diagnostic geometry/anchor edits need the same native vision refresh as
    // a real command before taking a complete persistence oracle.
    (game as any).updateVision();
    const save=game.toSaveSnapshot(); expect(game.loadSnapshot(save)).toBe(true);
    const after=game.toSaveSnapshot(); after.savedAt=save.savedAt; expect(after).toEqual(save);
}
it.each(['noop-child','changed-child','child-commit-parent-rollback','other-module-failure'] as const)
('SDK1 preserves the entire live ledger graph through %s and later finish/save/load', kind => {
    const {game,fail}=scene(); attack(game); const check=retained(game), runtime=game.extensionRuntime!;
    const otherBefore=runtime.snapshot().modules['generation-fault'];
    const outer=runtime.beginGeneration('floor'), child=runtime.beginGeneration('blueprint');
    if(kind!=='noop-child') {
        const ledger=runtime.actorActionBinding()!.state;
        ledger.revision++; ledger.actors[0]!.stamina--;
        ledger.actions[0]!.subactions[0]!.lockedCells.push({x:3,y:3});
        // Replacement/removal must restore original arrays and their children.
        ledger.actors=structuredClone(ledger.actors); ledger.actions=[];
    }
    if(kind==='child-commit-parent-rollback'||kind==='other-module-failure') {
        runtime.commitGeneration(child);
        if(kind==='other-module-failure') {fail();expect(()=>runtime.commitGeneration(outer)).toThrow('other module publication');}
        runtime.rollbackGeneration(outer);
        expect(runtime.snapshot().modules['generation-fault']).toEqual(otherBefore);
    } else {runtime.rollbackGeneration(child); runtime.commitGeneration(outer);}
    check(); finish(game);
});
it('SDK1 retains concurrent paid NPC and player actions/resources after nested rollback',()=>{
    const {game}=scene();
    const rat=new Monster(game.player.x+1,game.player.y,monsters.find(m=>m.id==='rat')! as MonsterData);
    rat.state=MonsterState.HUNTING;rat.ticksUntilTurn=0;game.monsters.push(rat);game.extensionRuntime!.attachCreature(rat);
    expect(selectNativeActorAction(game,rat.id)).toBe('handled'); attack(game);
    expect(game.actorActions!.bundles).toHaveLength(2);
    const check=retained(game),runtime=game.extensionRuntime!,parent=runtime.beginGeneration('floor'),child=runtime.beginGeneration('blueprint');
    runtime.rollbackGeneration(child);runtime.commitGeneration(parent);check();finish(game);
});
it('SDK1 retains the live rest graph, completes once and preserves its receipt through save/load',()=>{
    const {game}=scene(), runtime=game.extensionRuntime!;
    const fire=runtime.snapshot().foundation.world.entities.find(e=>e.depth===game.depth)!;
    commitCreatureAnchor(game.player,fire);game.player.hp=300;
    const plan=prepareWorldRest(game,JSON.stringify({module:'combat',action:'rest',payload:{bonfireId:fire.id}}));
    expect(plan).not.toBeNull();expect(commitWorldRest(game,plan!)).toBe(true);
    const check=retained(game),parent=runtime.beginGeneration('floor'),child=runtime.beginGeneration('blueprint');
    runtime.rollbackGeneration(child);runtime.commitGeneration(parent);check();finish(game);
    const bonfires=game.extensionRuntime!.actorActionBinding()!.state.bonfires!;
    expect(bonfires.receipts).toHaveLength(1);expect(bonfires.receipts[0]!.result).toBe('completed');
    expect(game.player.hp).toBe(game.player.maxHp);
});
it('SDK1 keeps cached NPC recovery frozen across rollback, then finishes on return',()=>{
    const {game}=scene(), runtime=game.extensionRuntime!;
    const rat=new Monster(game.player.x+1,game.player.y,monsters.find(m=>m.id==='rat')! as MonsterData);
    rat.state=MonsterState.HUNTING;rat.ticksUntilTurn=0;game.monsters.push(rat);runtime.attachCreature(rat);
    expect(selectNativeActorAction(game,rat.id)).toBe('handled');
    const scheduler=productionActorActionScheduler(game)!,bundle=game.actorActions!.bundles[0]!;
    scheduler.advanceActionTime(7);game.depth=2;(game as any).generateDepth(false,false);
    expect(bundle.subactions[0]!.phases[bundle.subactions[0]!.phaseIndex]!.kind).toBe('break-recovery');
    const check=retained(game),parent=runtime.beginGeneration('floor'),child=runtime.beginGeneration('blueprint');
    runtime.rollbackGeneration(child);runtime.commitGeneration(parent);check();
    scheduler.advanceActionTime(9);expect(bundle.subactions[0]!.phaseRemainingTicks).toBe(50);
    expect(rat.ticksUntilTurn).toBe(50);expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
    game.depth=1;(game as any).generateDepth(true,false);finish(game);
});
it('SDK1 measures bounded nested checkpoint/rollback without projecting the cached native world',()=>{
    const {game}=scene();attack(game);const runtime=game.extensionRuntime!,check=retained(game);
    const projection=vi.spyOn(game as any,'projectWholeRun').mockImplementation(()=>{throw new Error('native projection');});
    const times:number[]=[];
    for(let n=0;n<60;n++){const start=performance.now(),parent=runtime.beginGeneration('floor'),child=runtime.beginGeneration('blueprint');
        runtime.rollbackGeneration(child);runtime.commitGeneration(parent);if(n>=10)times.push(performance.now()-start);}
    expect(projection).not.toHaveBeenCalled();projection.mockRestore();check();finish(game);
    times.sort((a,b)=>a-b);
    if(process.env.SDK_GENERATION_PERF_OUT)writeFileSync(process.env.SDK_GENERATION_PERF_OUT,JSON.stringify({runtime:process.version,p50:times[25],p95:times[47],max:times[49]})+'\n');
});
it('SDK1 measures actual native floor generation and retains complete deterministic floor snapshots',()=>{
    const measurements:{seed:number;depth:number;milliseconds:number;fullSnapshotDigest:string}[]=[];
    for(const seed of [23,118,7397]) {
        const {game}=scene(seed);
        for(let depth=2;depth<=4;depth++) {
            const start=performance.now();game.depth=depth;(game as any).generateDepth(false,false);
            const milliseconds=performance.now()-start;
            expect(game.lastAdvancementError).toBeNull();
            const snapshot=game.toSnapshot();snapshot.savedAt=0;
            measurements.push({seed,depth,milliseconds,fullSnapshotDigest:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')});
        }
        vi.restoreAllMocks();logger.reset();logger.onDisturb=null;
    }
    if(process.env.SDK_NATIVE_GENERATION_PERF_OUT)writeFileSync(process.env.SDK_NATIVE_GENERATION_PERF_OUT,JSON.stringify({runtime:process.version,measurements})+'\n');
});
it('SDK1 isolated protocol fixtures cannot make the real installed registry accept their save or recording',()=>{
    const descriptors=[actorActionProtocolFixture];
    vi.spyOn(catalog,'getInstalledModuleDescriptors').mockReturnValue(descriptors);
    vi.spyOn(catalog,'createExtensionRegistry').mockImplementation(()=>registryFromDescriptors(descriptors));
    const game=startProductionGame(['combat'],7397,'normal'),saved=game.toSaveSnapshot(),recording=game.exportRecording();
    vi.restoreAllMocks();
    const real=createHeadlessGame(302,'test'),player=real.player;
    expect(real.loadSnapshot(saved)).toBe(false);expect(real.player).toBe(player);
    expect(real.loadReplay(recording)).toBe(false);expect(real.player).toBe(player);
});
it('SDK1 real seed23 floor generation retains the native session ledger and both departure/entry revisions',()=>{
    const {game}=scene(23),runtime=game.extensionRuntime!;
    for(let depth=2;depth<=4;depth++) {
        const ledger=runtime.actorActionBinding()!.state,revision=ledger.revision;
        expect((phasedAttackBoundaryIdentity(game)[0] as {state:unknown}).state).toBe(ledger);
        game.depth=depth;(game as any).generateDepth(false,false);
        expect(runtime.actorActionBinding()!.state).toBe(ledger);
        expect((phasedAttackBoundaryIdentity(game)[0] as {state:unknown}).state).toBe(ledger);
        // The real native leftDepth callback and the independent protocol's
        // enteredLevel placement each increment this same live revision once.
        expect(ledger.revision).toBe(revision+2);
    }
    const saved=game.toSaveSnapshot();expect(game.loadSnapshot(saved)).toBe(true);
    const after=game.toSaveSnapshot();after.savedAt=saved.savedAt;expect(after).toEqual(saved);
});
