import { installRecordingScene } from '../../../../test/support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import { Game } from '../../../../engine/Core/Game';
import { prepareActorParry,prepareActorParryCommand,commitActorParry,commitActorParryCommand,tryActorParry,applyActorPoiseDamage,isActorStaggered,preparePhasedAttackCommand,commitPhasedAttackCommand } from '../../../../engine/Core/PhasedAttackProduction';
import { withNativeActorDecisionScope } from '../../../../engine/Core/ActorActionScope';
import { selectNativeActorAction } from '../../../../engine/Core/ActorActionSession';
import { withNativeAttackAction } from '../../../../engine/Core/NativeAttackTransaction';
import { productionActorActionScheduler } from '../../../../engine/Core/ActorActionProduction';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { EnvironmentManager } from '../../../../engine/Environment/Gas';
import { WaypointSystem } from '../../../../engine/Map/WaypointMap';
import { DungeonLayer,TerrainType as T } from '../../../../engine/Map/Grid';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import { logger } from '../../../../engine/Systems/Logger';
import { Monster,MonsterState,type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import * as catalog from '../../../catalog';
import type { ActorAttackFacing } from '../../../actorActions';
const json = <V>(value: V): V => JSON.parse(JSON.stringify(value));
const command = (facing: ActorAttackFacing = 'e') => JSON.stringify({ module: 'combat', action: 'parry', payload: { facing } });
const state = (game: Game) => game.extensionRuntime!.actorActionBinding()!.state;
const resource = (game: Game, actorId = game.player.id) => state(game).actors.find(actor => actor.actorId === actorId)!;
const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
function start(seed = 73073, mode: 'normal' | 'test' = 'test'): Game {
    const game = createHeadlessGame(seed, 'test'), registry = catalog.createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(['combat'])).flatMap(module => module.initialCommand
        ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
    game.startNewGame({ seed, mode, ruleSet: 'extended', extensions: ['combat'], initialCommands });
    game.animationEnabled = false;
    return game;
}
function arena(game: Game) {
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        for (const layer of [DungeonLayer.DUNGEON, DungeonLayer.LIQUID, DungeonLayer.SURFACE, DungeonLayer.GAS])
            game.grid.setTerrainLayer(x, y, layer, layer === DungeonLayer.DUNGEON
                ? x === 0 || y === 0 || x === game.grid.width - 1 || y === game.grid.height - 1 ? T.WALL : T.FLOOR : T.NOTHING);
        game.grid.getCell(x, y)!.machineNumber = 0;
    }
    commitCreatureAnchor(game.player, { x: 20, y: 15 });
    game.player.hp = game.player.maxHp = 1000; game.player.ticksUntilTurn = 0;
    game.environment = new EnvironmentManager(game.grid); game.waypoints = new WaypointSystem();
    (game as any).machineCells = new Set(); (game as any).bindDungeonFeatureEffects(); (game as any).updateVision();
}
function scene() { const game = start(); arena(game); return game; }
function npc(game: Game, size: 1 | 2 | 3 = 1, at = { x: 24, y: 15 }) {
    const data = monsters.find(monster => monster.id === 'rat')! as MonsterData;
    const source = size === 1 ? new Monster(at.x, at.y, data) : game.createSquareMonster(data, size, at)!;
    if (size === 1) { game.monsters.push(source); game.extensionRuntime!.attachCreature(source); }
    source.state = MonsterState.HUNTING; source.ticksUntilTurn = 0; source.hp = source.maxHp = 1000;
    source.regenTurns = 0; source.defense = -10000;
    return source;
}
function parry(game:Game,facing:ActorAttackFacing='e') { const plan=prepareActorParryCommand(game,command(facing));expect(plan).not.toBeNull();expect(commitActorParryCommand(game,plan!)).toBe(true); }
function advance(game:Game,delta:number) { productionActorActionScheduler(game)!.advanceActionTime(delta);for(const source of [game.player,...game.monsters])source.ticksUntilTurn=Math.max(0,source.ticksUntilTurn-delta); }
function mechanical(game:Game){const snap=json(game.toSnapshot());snap.savedAt=0;return snap;}
afterEach(()=>{vi.restoreAllMocks();acknowledge();});
describe('3d production deterministic parry and poise',()=>{
    it('logs one successful player parry, with no message for failed or already-consumed contacts',()=>{
        const game=scene(),east=npc(game,1,{x:21,y:15}),west=npc(game,1,{x:19,y:15});parry(game);
        const before=logger.messages.length;
        expect(tryActorParry(game,west.id,game.player.id,game.meleeContact(west,game.player)!)).toBe(false);
        expect(logger.messages).toHaveLength(before);
        expect(tryActorParry(game,east.id,game.player.id,game.meleeContact(east,game.player)!)).toBe(true);
        expect(logger.messages.slice(before)).toEqual([expect.objectContaining({text:'You successfully parry the attack.',color:'#88ccff',count:1})]);
        expect(tryActorParry(game,east.id,game.player.id,game.meleeContact(east,game.player)!)).toBe(false);
        game.update();expect(logger.messages).toHaveLength(before+1);
    });
    it('pure prepare and stale commit preserve both RNGs, resources and time',()=>{
        const game=scene(),before={state:json(state(game)),rng:rng.getState(),tick:timeSystem.currentTick};
        const plan=prepareActorParryCommand(game,command())!;expect(plan).not.toBeNull();
        expect({state:json(state(game)),rng:rng.getState(),tick:timeSystem.currentTick}).toEqual(before);
        commitCreatureAnchor(game.player,{x:19,y:15});
        expect(()=>commitActorParryCommand(game,plan)).toThrow('Stale');expect(state(game)).toEqual(before.state);expect(rng.getState()).toEqual(before.rng);
    });
    it('one paid exact-facing native parry consumes no attack dice, breaks source and never counterattacks',()=>{
        const game=scene(),source=npc(game,1,{x:21,y:15});parry(game);
        const random=rng.getState(),hp=source.hp;
        const result=CombatSystem.attack(source,game.player,{grid:game.grid});
        expect(result).toMatchObject({hit:false,damage:0,parried:true});expect(rng.getState()).toEqual(random);
        expect(source.hp).toBe(hp);expect(game.player.hp).toBe(1000);
        expect(resource(game)).toMatchObject({stamina:21,parryRemainingTicks:0,parryFacing:null,parryRecoveryRemainingTicks:100});
        expect(resource(game,source.id)).toMatchObject({stamina:22,poise:0,staggerRemainingTicks:50});
        expect(CombatSystem.attack(source,game.player,{grid:game.grid}).staggerBlocked).toBe(true);
        expect(resource(game,source.id).stamina).toBe(22);
    });
    it.each([59,60,61])('window endpoint at elapsed %s is exclusive and never refunded',elapsed=>{
        const game=scene(),source=npc(game,1,{x:21,y:15});parry(game);advance(game,elapsed);
        expect(tryActorParry(game,source.id,game.player.id,game.meleeContact(source,game.player)!)).toBe(elapsed<60);
        expect(resource(game).parryRecoveryRemainingTicks).toBe(100-elapsed);
        expect(resource(game).stamina).toBe(21+Math.floor(Math.max(0,elapsed-40)/20));
    });
    it('wrong facing and noncontact do not consume window; two attackers at one tick consume it once',()=>{
        const game=scene(),east=npc(game,1,{x:21,y:15}),west=npc(game,1,{x:19,y:15});parry(game);
        expect(tryActorParry(game,west.id,game.player.id,game.meleeContact(west,game.player)!)).toBe(false);
        expect(tryActorParry(game,east.id,game.player.id,{from:{x:22,y:15},to:{x:20,y:15}})).toBe(false);
        expect(resource(game).parryRemainingTicks).toBe(60);
        expect(tryActorParry(game,east.id,game.player.id,game.meleeContact(east,game.player)!)).toBe(true);
        expect(tryActorParry(game,west.id,game.player.id,game.meleeContact(east,game.player)!)).toBe(false);
    });
    it('forced out-and-back displacement cancels protection without refunding recovery',()=>{
        const game=scene(),source=npc(game,1,{x:21,y:15});parry(game);
        commitCreatureAnchor(game.player,{x:19,y:15});commitCreatureAnchor(game.player,{x:20,y:15});
        expect(tryActorParry(game,source.id,game.player.id,game.meleeContact(source,game.player)!)).toBe(false);
        expect(resource(game).stamina).toBe(21);expect(resource(game).parryRecoveryRemainingTicks).toBe(100);
    });
    it.each([1,2,3] as const)('NPC and ally %s-square use the same contact, pool and one clock',size=>{
        const game=scene(),source=npc(game,size,{x:21,y:15});source.isAlly=true;
        const plan=prepareActorParry(game,source.id,'w')!;expect(plan).not.toBeNull();
        withNativeActorDecisionScope(game,source.id,scope=>commitActorParry(game,plan,scope));
        expect(resource(game,source.id)).toMatchObject({stamina:21,parryRemainingTicks:60,parryRecoveryRemainingTicks:100});
        expect(tryActorParry(game,game.player.id,source.id,game.meleeContact(game.player,source)!)).toBe(true);
        expect(resource(game).poise).toBe(0);expect(resource(game).staggerRemainingTicks).toBe(50);
    });
    it('break is once per recovery, does not extend under repeated hits, restores positive poise',()=>{
        const game=scene();applyActorPoiseDamage(game,game.player.id,12);
        expect(resource(game)).toMatchObject({poise:0,staggerRemainingTicks:50});advance(game,25);
        applyActorPoiseDamage(game,game.player.id,999);expect(resource(game).staggerRemainingTicks).toBe(25);
        advance(game,25);expect(resource(game)).toMatchObject({poise:12,staggerRemainingTicks:0});
        expect(prepareActorParryCommand(game,command())).not.toBeNull();
    });
    it('break cancels pending attack segments and owns recovery only in scheduler',()=>{
        const game=scene(),plan=preparePhasedAttackCommand(game,JSON.stringify({module:'combat',action:'attack',payload:{attackId:'fixture.double-thrust',facing:'e'}}))!;
        expect(plan).not.toBeNull();commitPhasedAttackCommand(game,plan);
        applyActorPoiseDamage(game,game.player.id,12);
        const bundle=game.actorActions!.bundles[0]!;
        expect(bundle.subactions[0]!.phases[bundle.subactions[0]!.phaseIndex]!.kind).toBe('break-recovery');
        expect(resource(game).staggerRemainingTicks).toBe(0);expect(isActorStaggered(game,game.player.id)).toBe(true);
        expect(state(game).actions[0]!.subactions[0]!.lockedCells).toEqual([]);
        const saved=game.toSaveSnapshot(),loaded=createHeadlessGame(89,'test');expect(loaded.loadSnapshot(saved)).toBe(true);
        loaded.animationEnabled=false;loaded.update();expect(isActorStaggered(loaded,loaded.player.id)).toBe(false);expect(resource(loaded).poise).toBe(12);
    });
    it('save/load active window binds lazily, rejects malformed facing and resumes once',()=>{
        const game=scene();parry(game);const saved=game.toSaveSnapshot(),random=rng.getState();
        const loaded=createHeadlessGame(92,'test');expect(loaded.loadSnapshot(saved)).toBe(true);loaded.animationEnabled=false;
        expect(state(loaded)).toEqual(state(game));expect(rng.getState()).toEqual(random);expect(loaded.isInputLocked()).toBe(true);
        loaded.update();expect(resource(loaded)).toMatchObject({stamina:24,parryRemainingTicks:0,parryRecoveryRemainingTicks:0,parryFacing:null});expect(loaded.isInputLocked()).toBe(false);
        const bad=json(saved);const serialized=JSON.stringify(bad);expect(serialized).toContain('parryFacing');
        const corrupt=JSON.parse(serialized.replace('"parryFacing":"e"','"parryFacing":null'));
        const oldPlayer=loaded.player;expect(loaded.loadSnapshot(corrupt)).toBe(false);expect(loaded.player).toBe(oldPlayer);
    });
    it('real commands replay checkpoints, bidirectional seek and saved continuation with exact RNG',()=>{
        installRecordingScene((game) => {if(game.extensionRuntime?.actorActionBinding())arena(game);});
        const game=start(),expected:ReturnType<typeof mechanical>[]=[],saves:ReturnType<Game['toSaveSnapshot']>[]=[];
        for(const facing of ['e','s','w','n'] as const){acknowledge();game.executeCommand('ext:command',command(facing));expected.push(mechanical(game));saves.push(json(game.toSaveSnapshot()));}
        const recording=json(game.exportRecording()),replay=createHeadlessGame(94,'test');expect(replay.loadReplay(recording)).toBe(true);replay.animationEnabled=false;
        for(const checkpoint of expected){replay.replayStep(true);expect(replay.replayError).toBeNull();expect(mechanical(replay)).toEqual(checkpoint);}
        for(const index of [1,3,2,4]){replay.replaySeek(index);expect(replay.replayError).toBeNull();expect(mechanical(replay)).toEqual(expected[index-1]);}
        const loaded=createHeadlessGame(95,'test');expect(loaded.loadSnapshot(saves[1]!)).toBe(true);loaded.animationEnabled=false;
        for(const facing of ['w','n'] as const){acknowledge();loaded.executeCommand('ext:command',command(facing));}
        expect(mechanical(loaded)).toEqual(expected[3]);expect(loaded.exportRecording().events).toEqual(recording.events);
    });
});

describe('3d native scheduling and visible defensive decisions',()=>{
    it.each([25,100,180])('NPC native attack epilogue preserves max stagger/attack recovery (%s ticks)',nativeTicks=>{
        const game=scene(),source=npc(game,1,{x:21,y:15});parry(game);
        withNativeAttackAction(game,source,()=>{expect(CombatSystem.attack(source,game.player,{grid:game.grid}).parried).toBe(true);source.ticksUntilTurn=nativeTicks;});
        expect(source.ticksUntilTurn).toBe(Math.max(50,nativeTicks));expect(resource(game,source.id).staggerRemainingTicks).toBe(source.ticksUntilTurn);
        expect(()=>game.toSaveSnapshot()).not.toThrow();
    });
    it('native player attack recovery uses max rather than adding stagger twice',()=>{
        const game=scene();applyActorPoiseDamage(game,game.player.id,12);
        (game as any).playerRecoversFromAttacking(false);
        expect(game.player.ticksUntilTurn).toBe(100);expect(resource(game).staggerRemainingTicks).toBe(100);expect(()=>game.toSaveSnapshot()).not.toThrow();
    });
    it('visible imminent committed warning causes deterministic paid NPC parry',()=>{
        const game=scene(),source=npc(game,1,{x:21,y:15});
        const plan=preparePhasedAttackCommand(game,JSON.stringify({module:'combat',action:'attack',payload:{attackId:'fixture.slash',facing:'e'}}))!;
        commitPhasedAttackCommand(game,plan);const random=rng.getState();
        expect(selectNativeActorAction(game,source.id)).toBe('handled');
        expect(resource(game,source.id)).toMatchObject({stamina:21,parryRemainingTicks:60,parryFacing:'w'});expect(rng.getState()).toEqual(random);
        expect(game.actorActions!.bundles).toHaveLength(1);
        advance(game,50);productionActorActionScheduler(game)!.dispatchActorBoundary(game.player.id);
        expect(resource(game).poise).toBe(0);expect(resource(game,source.id).parryRemainingTicks).toBe(0);
        expect(game.actorActions!.bundles[0]!.subactions[0]!.phases.slice(-1)[0]!.kind).toBe('break-recovery');
        expect(()=>game.toSaveSnapshot()).not.toThrow();
    });
    it('NPC does not defend against uncommitted player intent or unseen warnings',()=>{
        const game=scene(),source=npc(game,1,{x:21,y:15});
        preparePhasedAttackCommand(game,JSON.stringify({module:'combat',action:'attack',payload:{attackId:'fixture.slash',facing:'e'}}));
        expect(selectNativeActorAction(game,source.id)).toBe('handled');expect(resource(game,source.id).parryRemainingTicks).toBe(0);
        const other=scene(),enemy=npc(other,1,{x:21,y:15});const plan=preparePhasedAttackCommand(other,JSON.stringify({module:'combat',action:'attack',payload:{attackId:'fixture.slash',facing:'e'}}))!;
        commitPhasedAttackCommand(other,plan);vi.spyOn(other,'hasLineOfSight').mockReturnValue(false);
        expect(selectNativeActorAction(other,enemy.id)).toBe('native-fallback');expect(state(other).actors.some(row=>row.actorId===enemy.id)).toBe(false);
    });
    it('successful parry publishes distinct causal fact and no physical resolution',()=>{
        const game=scene(),source=npc(game,1,{x:21,y:15}),runtime=game.extensionRuntime!;
        const fact=vi.spyOn(runtime,'notifyActorParried'),physical=vi.spyOn(source.extensionHooks!,'physicalResolved');
        parry(game);const next=runtime.causality.snapshot().nextEffectId;
        CombatSystem.attack(source,game.player,{grid:game.grid});
        expect(fact).toHaveBeenCalledExactlyOnceWith(source.id,game.player.id,game.depth);
        expect(physical).not.toHaveBeenCalled();expect(runtime.causality.snapshot().nextEffectId).toBe(next+1);
    });
});

describe('3d defended facts replay through native NPC windups',()=>{
    it('successful parries retain exact causal IDs, RNG, checkpoints and saved continuation',()=>{
        installRecordingScene((game) => {
            if(game.extensionRuntime?.actorActionBinding()){arena(game);npc(game,1,{x:21,y:15});}
        });
        const game=start(),expected:ReturnType<typeof mechanical>[]=[],saves:ReturnType<Game['toSaveSnapshot']>[]=[];
        const firstFact=game.extensionRuntime!.causality.snapshot().nextEffectId,parries=vi.spyOn(game.extensionRuntime!,'notifyActorParried');
        for(let index=0;index<3;index++){acknowledge();game.executeCommand('ext:command',command('e'));expected.push(mechanical(game));saves.push(json(game.toSaveSnapshot()));}
        expect(parries).toHaveBeenCalledTimes(3);expect(game.player.hp).toBe(1000);expect(game.extensionRuntime!.causality.snapshot().nextEffectId).toBeGreaterThan(firstFact);
        expect(state(game).actors.some(actor=>actor.actorId!==game.player.id)).toBe(true);
        const recording=json(game.exportRecording()),replay=createHeadlessGame(143,'test');expect(replay.loadReplay(recording)).toBe(true);replay.animationEnabled=false;
        for(const checkpoint of expected){replay.replayStep(true);expect(replay.replayError).toBeNull();expect(mechanical(replay)).toEqual(checkpoint);}
        for(const index of [2,1,3]){replay.replaySeek(index);expect(replay.replayError).toBeNull();expect(mechanical(replay)).toEqual(expected[index-1]);}
        const loaded=createHeadlessGame(144,'test');expect(loaded.loadSnapshot(saves[0]!)).toBe(true);loaded.animationEnabled=false;
        for(let index=0;index<2;index++){acknowledge();loaded.executeCommand('ext:command',command('e'));}
        expect(mechanical(loaded)).toEqual(expected[2]);expect(loaded.exportRecording().events).toEqual(recording.events);
    });
});
