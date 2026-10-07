import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import { installProductionBody, emptyProductionArena, startProductionGame, PRODUCTION_BODY_ID } from '../../../../test/support/productionComposite';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { auditFullObjectGraph, fullGenerationRoots } from '../../../../test/support/fullGenerationCheckpointOracle';
import { selectNativeActorAction } from '../../../../engine/Core/ActorActionSession';
import { Item, ItemCategory } from '../../../../engine/Items/Item';
import { withBodyContact } from '../../../../engine/Combat/BodyCombat';
import type { Game } from '../../../../engine/Core/Game';
import { chargeNativeActorAttack, collectPhasedAttackActors, prepareActorParryCommand, commitActorParryCommand,
    preparePhasedAttackCommand, commitPhasedAttackCommand, applyActorPoiseDamage, tryActorParry,
    validateActorCombatCapacities } from '../../../../engine/Core/PhasedAttackProduction';
import { productionActorActionScheduler } from '../../../../engine/Core/ActorActionProduction';
import { prepareWorldRest, commitWorldRest, settleWorldRest, interruptWorldRest } from '../../../../engine/Core/WorldRestProduction';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import { getNextEntityId, type Creature } from '../../../../entities/Creature';
import monsters from '../../../../data/monsters.json';
import { TerrainType, DungeonLayer } from '../../../../engine/Map/Grid';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { EnvironmentManager } from '../../../../engine/Environment/Gas';
import { WaypointSystem } from '../../../../engine/Map/WaypointMap';
import { logger } from '../../../../engine/Systems/Logger';
import { rng, RNGType } from '../../../../engine/Random';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import { extensionDataFingerprint } from '../../../fingerprint';
import { isJson } from '../../../json';
import type { CombatEventFact, ExtensionModule, Json } from '../../../types';
import { markStatsDirty } from '../../../../engine/Stats/NativeStatSources';
import { loadCombatDefinitionPack } from '../definitions';
import { combatAttackDefinitions } from '../production';
import { validateProductionActorAttackState } from '../../../actorActionValidation';

const state=(game:Game)=>game.extensionRuntime!.actorActionBinding()!.state;
const row=(game:Game,id=game.player.id)=>state(game).actors.find(value=>value.actorId===id)!;
const command=(action:string,payload:object)=>JSON.stringify({module:'combat',action,payload});
const revision=(capacity:number)=>extensionDataFingerprint({capacity});
const supported=(staminaCapacity=30,poiseCapacity=18)=>({status:'supported',staminaCapacity,poiseCapacity,revision:revision(staminaCapacity)}) as Json;
const events=(game:Game)=>(game.extensionRuntime!.snapshot().modules.narrative as unknown as {events:CombatEventFact[]}).events;
const installed=new Set(catalog.getInstalledModuleDescriptors().map(module=>module.id));
type ConsumerObserver={prepare:()=>void;commit:()=>void};
function setup(options:{observe?:ConsumerObserver;query?:(actorId:number,playerId:number)=>Json;events?:boolean;fail?:()=>boolean;bodyAttacks?:boolean}={}) {
    const previous=catalog.createExtensionRegistry();
    const descriptors=catalog.getInstalledModuleDescriptors().map(descriptor=>{
        const module=previous.create(previous.manifest([descriptor.id]))[0]!;
        if(descriptor.id==='combat'){
            const actorActions=structuredClone(module.actorActions!);
            if(options.bodyAttacks)(actorActions.definitions as unknown as import('../../../actorActions').ActorAttackDefinitions).nativeProfiles.push({monsterId:'body-fixture.fixture-leg',profileId:'combat.follow-thrust'});
            const rules=options.bodyAttacks?{...module.rules!,fingerprint:extensionDataFingerprint(actorActions.definitions)}:module.rules;
            return {...descriptor,rules,create:()=>({...module,rules,actorActions,statSources:{...module.statSources,collect:(actor,context)=>{const result=options.query?.(actor.id,context.playerId) as {status:string;staminaCapacity:number;poiseCapacity:number}|undefined;if(!result||result.status==='unsupported')return [];return [{stat:'combat.stamina-capacity',value:result.staminaCapacity-context.base('combat.stamina-capacity'),category:'flat',layer:'temporary',sourceId:'combat.fixture.stamina',sourceKind:'fixture'},{stat:'combat.poise-capacity',value:result.poiseCapacity-context.base('combat.poise-capacity'),category:'flat',layer:'temporary',sourceId:'combat.fixture.poise',sourceKind:'fixture'}];}}} as ExtensionModule)};
        }
        if(descriptor.id==='narrative'&&options.events)return {...descriptor,create:()=>({id:descriptor.id,version:descriptor.version,rules:descriptor.rules,
            initialState:()=>({events:[]}),validateState:isJson,committedFacts:{'combat.event.v1':{maxDerivedFacts:0,
                prepare:fact=>{options.observe?.prepare();return structuredClone(fact);},commit:(fact,context)=>{
                    options.observe?.commit();
                    if(options.fail?.())throw new Error('fixture consumer failure');
                    const value=structuredClone(context.state) as {events:Json[]};value.events.push(fact as Json);context.setState(value);
                }}}} as ExtensionModule)};
        return {...descriptor,rules:module.rules,create:()=>module};
    });
    vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(registryFromDescriptors(descriptors));
}
function scene(eventConsumer=false){
    const game=createHeadlessGame(8201,'test');
    game.startNewGame({seed:8201,mode:'test',ruleSet:'extended',extensions:eventConsumer?['combat','narrative']:['combat']});
    game.animationEnabled=false;game.monsters=[];game.dormantMonsters=[];game.items=[];
    for(let y=0;y<game.grid.height;y++)for(let x=0;x<game.grid.width;x++){
        game.grid.setTerrain(x,y,x===0||y===0||x===game.grid.width-1||y===game.grid.height-1?TerrainType.WALL:TerrainType.FLOOR);
        for(const layer of [DungeonLayer.LIQUID,DungeonLayer.SURFACE,DungeonLayer.GAS])game.grid.setTerrainLayer(x,y,layer,TerrainType.NOTHING);
        game.grid.getCell(x,y)!.machineNumber=0;
    }
    game.environment=new EnvironmentManager(game.grid);game.waypoints=new WaypointSystem();
    commitCreatureAnchor(game.player,{x:20,y:15});game.player.hp=game.player.maxHp=1000;game.player.ticksUntilTurn=0;
    (game as any).updateVision();while(logger.pendingAcknowledgment)logger.acknowledgeNext();return game;
}
function npc(game:Game){
    const actor=new Monster(21,15,monsters.find(value=>value.id==='rat')! as unknown as MonsterData);
    actor.state=MonsterState.HUNTING;actor.ticksUntilTurn=10000;actor.hp=actor.maxHp=1000;actor.defense=-10000;
    game.monsters.push(actor);game.extensionRuntime!.attachCreature(actor);(game as any).updateVision();return actor;
}
function sync(game:Game){for(const a of [game.player,...game.monsters])markStatsDirty(a);collectPhasedAttackActors(game,[game.player,...game.monsters]);}
function parry(game:Game){const plan=prepareActorParryCommand(game,command('parry',{facing:'e'}));expect(plan).not.toBeNull();commitActorParryCommand(game,plan!);}
function release(game:Game){const scheduler=productionActorActionScheduler(game)!;scheduler.advanceActionTime(scheduler.nextActionBoundary()!);scheduler.dispatchActorBoundary(game.player.id);}
afterEach(()=>{vi.restoreAllMocks();logger.reset();logger.onDisturb=null;});
it.each(['single','core','leg'] as const)('backstab of a busy %s survives scheduler mirrors, save/load and real elapsed time',kind=>{
    if(kind!=='single')installProductionBody();setup({bodyAttacks:kind!=='single'});
    const game=kind==='single'?scene():startProductionGame(['body-fixture','combat']);
    if(kind!=='single')emptyProductionArena(game);
    const owner=kind==='single'?npc(game):game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;
    owner.hp=owner.maxHp=1000;owner.state=MonsterState.HUNTING;owner.ticksUntilTurn=0;
    if(kind!=='single')commitCreatureAnchor(game.player,{x:14,y:10});
    expect(selectNativeActorAction(game,owner.id)).toBe('handled');
    const target=kind==='leg'?game.monsters.find(m=>m.spatial?.bodyMember?.groupId===owner.id&&m!==owner)!:owner;
    owner.state=MonsterState.WANDERING;target.hp=target.maxHp=1000;
    const bundle=game.actorActions!.bundles.find(b=>b.decisionOwnerId===owner.id)!;
    const before=owner.ticksUntilTurn,tails=bundle.subactions.map(c=>c.phases[c.phases.length - 1]!.durationTicks),delay=Math.max(target.movementSpeed,target.attackSpeed);
    game.executeCommand('fixture:backstab',undefined,()=>{
        expect(CombatSystem.attack(game.player,target,{grid:game.grid}).backstab).toBe(true);
    });
    productionActorActionScheduler(game)!.refreshMirrors();
    expect(owner.ticksUntilTurn).toBe(before);
    for(const [i,child] of bundle.subactions.entries()){
        expect(child.nativeRecoveryDelayTicks).toBe(delay);expect(child.phases[child.phases.length - 1]!.durationTicks).toBe(tails[i]!+delay);
    }
    const saved=game.toSaveSnapshot();
    for(const patch of ['receipt','duration'] as const){
        const bad=structuredClone(saved);
        const child=bad.run.actorActions!.bundles.find(b=>b.decisionOwnerId===owner.id)!.subactions[0]!;
        if(patch==='receipt')child.nativeRecoveryDelayTicks!++;else child.phases[child.phases.length - 1]!.durationTicks++;
        expect(game.loadSnapshot(bad)).toBe(false);
    }
    expect(game.loadSnapshot(saved)).toBe(true);
    const loaded=game.monsters.find(m=>m.id===owner.id)!;
    game.executeCommand('wait');
    expect(productionActorActionScheduler(game)!.isBusy(loaded.id)).toBe(true);
    expect(game.actorActions!.bundles.find(b=>b.decisionOwnerId===loaded.id)!.elapsedActionTicks).toBe(100);
    if(kind==='single')expect(loaded.spatial).toBeUndefined();
    expect(game.lastAdvancementError).toBeNull();
});

describe('3g strict optional combat capacity consumer',()=>{
    it('keeps capacities in the foundation ledger and rejects the retired actor field',()=>{
        setup({query:()=>supported()});const game=scene();chargeNativeActorAttack(game,game.player.id);
        expect('combatStats' in row(game)).toBe(false);
        const bad=structuredClone(state(game));Object.assign(bad.actors[0]!,{combatStats:{staminaCapacity:30,poiseCapacity:18}});
        expect(()=>validateProductionActorAttackState(bad,combatAttackDefinitions(loadCombatDefinitionPack()))).toThrow();
    });
    it('applies repeated up/down temporary capacities without refill, clock change, or fractional loss',()=>{
        let capacity=30;setup({query:()=>supported(capacity,capacity/2)});const game=scene();
        expect(chargeNativeActorAttack(game,game.player.id)).toBe(true);
        const resource=row(game);Object.assign(resource,{stamina:18,poise:9,regenRemainder:13,poiseRecoveryRemainder:17,
            regenDelayRemaining:20,poiseRecoveryDelayRemaining:30});
        for(const next of [60,10,40,10,60]){
            const before=structuredClone(resource),random=rng.getState();capacity=next;game.extensionRuntime!.stats.clear();
            prepareActorParryCommand(game,command('parry',{facing:'e'}));game.extensionRuntime!.readModuleView('combat');
            expect(resource).toEqual(before);expect(rng.getState()).toEqual(random);
            sync(game);
            expect(resource.stamina).toBe(Math.min(before.stamina,next));expect(resource.poise).toBe(Math.min(before.poise,next/2));
            expect(resource).toMatchObject({regenRemainder:13,poiseRecoveryRemainder:17,regenDelayRemaining:20,poiseRecoveryDelayRemaining:30});
            expect(game.extensionRuntime!.stats.value(game.player.id,'combat.stamina-capacity')).toBe(next);expect(game.extensionRuntime!.stats.value(game.player.id,'combat.poise-capacity')).toBe(next/2);
            expect(()=>validateProductionActorAttackState(state(game),combatAttackDefinitions(loadCombatDefinitionPack()))).not.toThrow();
        }
    });
    it('keeps accepted paid plan and defense window stable across capacity change',()=>{
        let capacity=30;setup({query:()=>supported(capacity,12)});const game=scene();
        parry(game);const before=structuredClone(row(game));capacity=50;sync(game);
        expect(row(game)).toMatchObject({stamina:before.stamina,poise:before.poise,parryRemainingTicks:60,parryRecoveryRemainingTicks:100,parryFacing:'e'});
        game.player.ticksUntilTurn=0;Object.assign(row(game),{parryRemainingTicks:0,parryRecoveryRemainingTicks:0,parryFacing:null});
        const plan=preparePhasedAttackCommand(game,command('attack',{attackId:'fixture.double-thrust',facing:'e'}))!;commitPhasedAttackCommand(game,plan);
        const actions=structuredClone(state(game).actions),scheduler=structuredClone(game.actorActions!),balance=row(game).stamina;
        capacity=8;sync(game);expect(state(game).actions).toEqual(actions);expect(game.actorActions!).toEqual(scheduler);
        expect(row(game).stamina).toBe(Math.min(balance,8));
    });
    it('retains a begun stagger when capacities rise and never restores poise through the adapter',()=>{
        let capacity=24;setup({query:()=>supported(capacity,12)});const game=scene();applyActorPoiseDamage(game,game.player.id,12);
        const ticks=row(game).staggerRemainingTicks;capacity=60;sync(game);
        expect(row(game)).toMatchObject({poise:0,staggerRemainingTicks:ticks});expect(game.player.ticksUntilTurn).toBe(ticks);
    });
    it('uses real NPC scope and falls back for an unsupported actor independently',()=>{
        let npcSupported=true;const seen:number[]=[];
        setup({query:(id,playerId)=>{seen.push(id);return id===playerId?supported(30,18):npcSupported?supported(40,20):{status:'unsupported'};}});
        const game=scene(),target=npc(game);chargeNativeActorAttack(game,target.id);
        expect(row(game,target.id)).toMatchObject({stamina:22,poise:12});
        expect(seen).toContain(target.id);npcSupported=false;sync(game);
        expect(game.extensionRuntime!.stats.applied(target.id,'combat.stamina-capacity')).toBe(0);expect(row(game,target.id).stamina).toBe(22);
        expect(game.extensionRuntime!.stats.value(game.player.id,'combat.stamina-capacity')).toBe(30);
    });
    it('rejects an inflated saved balance without changing the candidate',()=>{
        setup({query:()=>supported()});const game=scene();chargeNativeActorAttack(game,game.player.id);
        const binding=game.extensionRuntime!.actorActionBinding()!,copy=structuredClone(binding.state);
        const query=()=>({staminaCapacity:30,poiseCapacity:18});
        expect(()=>validateActorCombatCapacities(copy,binding.definition,[game.player],query)).not.toThrow();
        copy.actors[0]!.stamina=999;const before=structuredClone(copy);
        expect(()=>validateActorCombatCapacities(copy,binding.definition,[game.player],query)).toThrow();expect(copy).toEqual(before);
    });
    it('rejects another valid template profile even when its capacities and revision exactly match',()=>{
        setup({query:()=>supported()});const game=scene();chargeNativeActorAttack(game,game.player.id);
        const binding=game.extensionRuntime!.actorActionBinding()!,saved=game.toSaveSnapshot(),runtime=game.extensionRuntime!,player=game.player;
        const query=(_actor:Creature,_input:Json)=>({staminaCapacity:30,poiseCapacity:18});
        const candidate=structuredClone(binding.state);candidate.actors.find(actor=>actor.actorId===player.id)!.profileId='combat.follow-thrust';
        expect(()=>validateProductionActorAttackState(candidate,binding.definition)).not.toThrow();
        expect(()=>validateActorCombatCapacities(candidate,binding.definition,[player],query)).toThrow('actor template');
        const corrupt=structuredClone(saved);
        (corrupt.extensions!.modules.combat as unknown as typeof candidate).actors.find(actor=>actor.actorId===player.id)!.profileId='combat.follow-thrust';
        expect(game.loadSnapshot(corrupt)).toBe(false);expect(game.player).toBe(player);expect(game.extensionRuntime).toBe(runtime);
    });
    it('attests idle native and declared profile selection while retaining only metadata-bound paid pins',()=>{
        setup({query:()=>supported()});const game=scene(),target=npc(game);chargeNativeActorAttack(game,target.id);
        const binding=game.extensionRuntime!.actorActionBinding()!,query=(_actor:Creature,_input:Json)=>({staminaCapacity:30,poiseCapacity:18});
        const verify=(candidate=state(game),body?:{declared:readonly string[];available:readonly string[]})=>validateActorCombatCapacities(candidate,binding.definition,
            [game.player,target],query,actor=>actor===target?body:undefined,game.actorActions);
        expect(row(game,target.id).profileId).toBe('combat.fan-edge');expect(()=>verify()).not.toThrow();
        const forged=structuredClone(state(game));forged.actors.find(actor=>actor.actorId===target.id)!.profileId='combat.shock-ring';
        expect(()=>verify(forged)).toThrow('actor template');
        const body={declared:['combat.fan-edge','combat.shock-ring'],available:['combat.shock-ring']};
        expect(()=>verify(state(game),body)).toThrow('actor template');
        target.ticksUntilTurn=0;expect(selectNativeActorAction(game,target.id)).toBe('handled');
        expect(()=>verify(state(game),body)).not.toThrow();
        target.typeId='ogre';expect(()=>verify()).toThrow('actor template');
        const bundle=game.actorActions!.bundles.find(bundle=>bundle.decisionOwnerId===target.id)!;
        const child=bundle.subactions[0]!,sub=state(game).actions.find(action=>action.actionId===bundle.actionId)!.subactions[0]!;
        child.phases=[{kind:'break-recovery',durationTicks:50,segmentIndex:null}];child.phaseIndex=0;child.phaseRemainingTicks=50;sub.lockedCells=[];
        expect(()=>validateProductionActorAttackState(state(game),binding.definition)).not.toThrow();
        expect(()=>verify()).not.toThrow();
        const mismatched=structuredClone(state(game));mismatched.actions.find(action=>action.actionId===bundle.actionId)!.profileId='combat.shock-ring';
        expect(()=>verify(mismatched)).toThrow('actor template');
    });
    it('propagates provider exceptions and invalid available values before charging',()=>{
        let invalid=false;setup({query:()=>{if(invalid)throw new Error('provider broken');return supported();}});const game=scene();
        const before=structuredClone(state(game));invalid=true;game.extensionRuntime!.stats.clear();
        expect(()=>chargeNativeActorAttack(game,game.player.id)).toThrow('provider broken');expect(state(game)).toEqual(before);
    });
});

describe.skipIf(!installed.has('narrative'))('3g four committed combat fact producers',()=>{
    it('rolls back the success log along with a parry when the committed consumer rejects it',()=>{
        let fail=false;setup({events:true,fail:()=>fail});const game=scene(true),target=npc(game);parry(game);
        const before=logger.getState();fail=true;
        expect(()=>tryActorParry(game,target.id,game.player.id,game.meleeContact(target,game.player)!)).toThrow('fixture consumer failure');
        expect(logger.getState()).toEqual(before);
    });
    it('emits one fact per resolved segment, with no fact during windup',()=>{
        setup({events:true});const game=scene(true),target=npc(game);
        const plan=preparePhasedAttackCommand(game,command('attack',{attackId:'fixture.double-thrust',facing:'e'}))!;commitPhasedAttackCommand(game,plan);
        expect(events(game)).toEqual([]);release(game);release(game);
        const facts=events(game).filter(fact=>fact.eventKind==='attack-resolved');
        expect(facts.map(fact=>[fact.actionId,fact.sourceSubactionId,fact.segmentIndex])).toEqual([[1,1,0],[1,1,1]]);
        expect(facts.every(fact=>fact.actor.entityId===game.player.id&&fact.hitCount===1&&fact.hpLost>0)).toBe(true);
        expect(target.hp).toBeLessThan(1000);expect(new Set(facts.map(fact=>fact.factId)).size).toBe(2);
    });
    it('emits a stagger start once and a parry with the actual defended resolution identity',()=>{
        setup({events:true});const game=scene(true),target=npc(game);parry(game);
        const method=game.extensionRuntime!.notifyActorParried.bind(game.extensionRuntime!),ids:number[]=[];
        vi.spyOn(game.extensionRuntime!,'notifyActorParried').mockImplementation((...args)=>{const id=method(...args);ids.push(id as number);return id;});
        expect(tryActorParry(game,target.id,game.player.id,game.meleeContact(target,game.player)!)).toBe(true);
        applyActorPoiseDamage(game,target.id,20);
        expect(events(game).map(fact=>fact.eventKind)).toEqual(['staggered','parried']);
        expect(events(game)[1]!.resolutionId).toBe(ids[0]);expect(events(game)[1]!.actor.entityId).toBe(game.player.id);
    });
    it.each([false,true])('rest completion publishes only after final recovery (interrupted=%s)',interrupted=>{
        setup({events:true});const game=scene(true),fire=game.extensionRuntime!.snapshot().foundation.world.entities.find(entity=>entity.owner==='combat')!;
        commitCreatureAnchor(game.player,{x:fire.x,y:fire.y});(game as any).updateVision();game.player.hp=100;
        const plan=prepareWorldRest(game,command('rest',{bonfireId:fire.id}))!;expect(plan).not.toBeNull();commitWorldRest(game,plan);
        expect(events(game)).toEqual([]);if(interrupted)interruptWorldRest(game,'damage');
        release(game);expect(events(game)).toEqual([]);settleWorldRest(game);
        expect(events(game)).toHaveLength(interrupted?0:1);
        if(!interrupted){expect(game.player.hp).toBe(game.player.maxHp);expect(events(game)[0]).toMatchObject({eventKind:'rest-completed',actionId:1,bonfireId:fire.id,visit:1});}
    });
    it('rolls back successful parry, stagger, native time, IDs and both RNGs if a consumer fails',()=>{
        let fail=false;setup({events:true,fail:()=>fail});const game=scene(true),target=npc(game);parry(game);
        const before=game.extensionRuntime!.snapshot(),random=rng.getState(),ticks=[game.player.ticksUntilTurn,target.ticksUntilTurn];fail=true;
        expect(()=>tryActorParry(game,target.id,game.player.id,game.meleeContact(target,game.player)!)).toThrow('fixture consumer failure');
        expect(game.extensionRuntime!.snapshot()).toEqual(before);expect(rng.getState()).toEqual(random);
        expect([game.player.ticksUntilTurn,target.ticksUntilTurn]).toEqual(ticks);
    });
    it('rolls back an entire segment boundary and permits one clean retry after consumer failure',()=>{
        let fail=false;setup({events:true,fail:()=>fail});const game=scene(true),target=npc(game);
        const plan=preparePhasedAttackCommand(game,command('attack',{attackId:'fixture.double-thrust',facing:'e'}))!;commitPhasedAttackCommand(game,plan);
        const scheduler=productionActorActionScheduler(game)!;scheduler.advanceActionTime(scheduler.nextActionBoundary()!);
        const before=game.extensionRuntime!.snapshot(),hp=target.hp,random=rng.getState(),bundle=game.actorActions!.bundles[0]!,child=bundle.subactions[0]!;
        fail=true;expect(()=>scheduler.dispatchActorBoundary(game.player.id)).toThrow('fixture consumer failure');
        expect(game.extensionRuntime!.snapshot()).toEqual(before);expect(target.hp).toBe(hp);expect(rng.getState()).toEqual(random);
        expect(game.actorActions!.bundles[0]).toBe(bundle);expect(bundle.subactions[0]).toBe(child);
        fail=false;expect(()=>scheduler.dispatchActorBoundary(game.player.id)).not.toThrow();
        expect(events(game).filter(event=>event.eventKind==='attack-resolved')).toHaveLength(1);expect(target.hp).toBeLessThan(hp);
    });
    it('rolls back final rest recovery and receipt, then completes the same visit once',()=>{
        let fail=false;setup({events:true,fail:()=>fail});const game=scene(true),fire=game.extensionRuntime!.snapshot().foundation.world.entities.find(entity=>entity.owner==='combat')!;
        commitCreatureAnchor(game.player,{x:fire.x,y:fire.y});(game as any).updateVision();game.player.hp=100;
        commitWorldRest(game,prepareWorldRest(game,command('rest',{bonfireId:fire.id}))!);release(game);
        const before=game.extensionRuntime!.snapshot(),random=rng.getState();fail=true;
        expect(()=>settleWorldRest(game)).toThrow('fixture consumer failure');expect(game.extensionRuntime!.snapshot()).toEqual(before);
        expect(game.player.hp).toBe(100);expect(rng.getState()).toEqual(random);fail=false;settleWorldRest(game);
        expect(events(game)).toHaveLength(1);expect(state(game).bonfires!.receipts.filter(receipt=>receipt.result==='completed')).toHaveLength(1);
    });

});


describe.skipIf(!installed.has('giants')||!installed.has('narrative'))('3g composite capacity and event ownership',()=>{
    function body(realGrowth=false,fail?:()=>boolean,sockets=false,observe?:ConsumerObserver){
        const data=installProductionBody(8,undefined,undefined,true);
        if(sockets){
            const rule={id:'body-fixture.fixture-socket-break',owner:'body-fixture',trigger:'hp-zero' as const,disposition:'keep-zone' as const,
                modifiers:[{kind:'balance-loss' as const,amount:4,fallbackStunTicks:40}]};
            Object.assign(data.leg,{breakRules:[rule],footprint:{geometry:{kind:'rect',width:1,height:1},poses:['r0'],
                zones:[{id:'socket',nameKey:'ext.body-fixture.socket.name',health:{kind:'local',maxHp:8,ownerTransfer:{numerator:1,denominator:1}},armor:0,
                    damageMultiplier:{numerator:1,denominator:1},breakRuleId:rule.id}],zoneCells:[{x:0,y:0,zoneId:'socket'}]}});
        }
        setup({query:realGrowth?undefined:()=>supported(40,20),events:true,bodyAttacks:true,fail,observe});
        const ids=realGrowth?['combat','giants','body-fixture','growth','narrative']:['combat','giants','body-fixture','narrative'];
        const registry=catalog.createExtensionRegistry(),initialCommands=registry.create(registry.manifest(ids)).flatMap(module=>module.initialCommand?[JSON.stringify({module:module.id,...module.initialCommand})]:[]);
        const game=createHeadlessGame(7307,'test');game.startNewGame({seed:7307,mode:'wizard',ruleSet:'extended',extensions:ids,initialCommands});
        emptyProductionArena(game);const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;
        core.state=MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');core.givenUpOnScent=true;
        commitCreatureAnchor(game.player,{x:14,y:10});(game as any).updateVision();while(logger.pendingAcknowledgment)logger.acknowledgeNext();
        return {game,core,legs:game.monsters.filter(actor=>actor!==core)};
    }
    it('keeps core decision/time/poise ownership and makes each attacking member pay its own stamina',()=>{
        const {game,core,legs}=body();core.ticksUntilTurn=0;
        expect(selectNativeActorAction(game,core.id)).toBe('handled');
        const bundle=game.actorActions!.bundles[0]!;expect(bundle).toMatchObject({decisionOwnerId:core.id,timeChargeOwnerId:core.id});
        expect(bundle.subactions.length).toBeGreaterThan(0);expect(row(game,core.id).stamina).toBe(24);
        for(const sub of bundle.subactions){expect(row(game,sub.sourceEntityId).stamina).toBe(18);expect(game.extensionRuntime!.stats.value(sub.sourceEntityId,'combat.stamina-capacity')).toBe(40);expect(game.extensionRuntime!.stats.value(sub.sourceEntityId,'combat.poise-capacity')).toBe(20);}
        const member=legs.find(actor=>bundle.subactions.some(sub=>sub.sourceEntityId===actor.id))!;
        const before=row(game,member.id).poise;applyActorPoiseDamage(game,member.id,3);
        expect(row(game,core.id).poise).toBe(9);expect(row(game,member.id).poise).toBe(before);
    });
    it('publishes the resolved member identity after real armor reprisal retires its source',()=>{
        const {game,core,legs}=body(),armor=new Item('fixture armor',']',0xcccccc,ItemCategory.ARMOR);
        armor.armor=0;armor.enchantment=20;armor.strengthRequired=0;armor.runicType='reprisal';game.player.equippedArmor=armor;game.player.inventory.addItem(armor);
        game.player.strength=30;
        for(const leg of legs){leg.hp=1;leg.accuracy=10000;leg.damageString='20';}
        core.ticksUntilTurn=0;expect(selectNativeActorAction(game,core.id)).toBe('handled');
        const scheduler=productionActorActionScheduler(game)!,sourceIds=game.actorActions!.bundles[0]!.subactions.map(sub=>sub.sourceEntityId);
        scheduler.advanceActionTime(scheduler.nextActionBoundary()!);expect(()=>scheduler.dispatchActorBoundary(core.id)).not.toThrow();
        const resolved=events(game).filter(event=>event.eventKind==='attack-resolved');expect(resolved.length).toBeGreaterThan(0);
        expect(resolved.every(event=>sourceIds.includes(event.actor.entityId)&&event.actor.partId?.startsWith('leg')&&event.actor.generation===0)).toBe(true);
        expect(sourceIds.some(id=>!game.monsters.some(actor=>actor.id===id))).toBe(true);
    });
    it.skipIf(!installed.has('growth'))('part-break consumes actual growth actor stats and publishes one core stagger after committed retirement',()=>{
        const {game,core,legs}=body(true),leg=legs[0]!;
        expect(game.extensionRuntime!.stats.value(core.id,'combat.stamina-capacity')).toBe(24);expect(game.extensionRuntime!.stats.value(core.id,'combat.poise-capacity')).toBe(12);
        withBodyContact(leg,leg.loc,()=>leg.takeDamage(100,true,game.grid,undefined,'physical'));
        expect(row(game,core.id).poise).toBe(0);expect(game.extensionRuntime!.stats.value(core.id,'combat.stamina-capacity')).toBe(24);expect(game.extensionRuntime!.stats.value(core.id,'combat.poise-capacity')).toBe(12);
        const stagger=events(game).filter(event=>event.eventKind==='staggered');expect(stagger).toHaveLength(1);
        expect(stagger[0]!.actor.entityId).toBe(core.id);expect(stagger[0]!.actor.partId).toBe('core');
        withBodyContact(legs[1]!,legs[1]!.loc,()=>legs[1]!.takeDamage(100,true,game.grid,undefined,'physical'));
        expect(events(game).filter(event=>event.eventKind==='staggered')).toHaveLength(1);
    });
    it('part-break consumer failure restores retired member, core pool, receipt and original native identities',()=>{
        let fail=false;const {game,core,legs}=body(false,()=>fail),leg=legs[0]!;
        const before=game.extensionRuntime!.snapshot(),native=structuredClone(game.bodyGroups),hp=leg.hp,random=rng.getState();fail=true;
        expect(()=>withBodyContact(leg,leg.loc,()=>leg.takeDamage(100,true,game.grid,undefined,'physical'))).toThrow('fixture consumer failure');
        expect(game.extensionRuntime!.snapshot()).toEqual(before);expect(game.monsters).toContain(leg);expect(leg.hp).toBe(hp);
        expect(game.bodyGroups).toEqual(native);expect(rng.getState()).toEqual(random);expect(row(game,core.id)).toBeUndefined();
        fail=false;expect(()=>withBodyContact(leg,leg.loc,()=>leg.takeDamage(100,true,game.grid,undefined,'physical'))).not.toThrow();
        expect(events(game).filter(event=>event.eventKind==='staggered')).toHaveLength(1);
    });

    it('does not publish staggered when the same member-breaking contact kills its core',()=>{
        const {game,core,legs}=body(),leg=legs[0]!;core.hp=1;
        expect(()=>withBodyContact(leg,leg.loc,()=>leg.takeDamage(100,true,game.grid,undefined,'physical'))).not.toThrow();
        expect(core.hp).toBe(0);expect(game.monsters).not.toContain(leg);
        expect(events(game).filter(event=>event.eventKind==='staggered')).toEqual([]);
    });

    it('defers socket-break consumers through native damage epilogue and fully restores a post-transfer failure',()=>{
        const consumer={prepare:vi.fn(),commit:vi.fn()}, {game,core,legs}=body(false,undefined,true,consumer),leg=legs[0]!;
        applyActorPoiseDamage(game,core.id,11);expect(row(game,core.id).poise).toBe(1);
        leg.applyShield(10);leg.isAbsorbing=true;
        const runtime=game.extensionRuntime!,nativeEmit=runtime.emit.bind(runtime),members=game.monsters,group=game.bodyGroups![0]!,slot=group.members[1]!;
        const pool=row(game,core.id),spatial=leg.spatial!,zone=spatial.zoneState![0]!,hp=core.hp,legHp=leg.hp;
        const moduleBefore=runtime.snapshot(),random=rng.getState(),allocator=getNextEntityId(),log=logger.getState();
        const audit=auditFullObjectGraph(fullGenerationRoots(game),[runtime]);let reached=false;
        const fault=vi.spyOn(runtime,'emit').mockImplementation((name,event)=>{
            if(name==='damage'&&(event as {creature?:{id:number}}).creature?.id===leg.id){
                reached=true;expect(zone).toMatchObject({hp:0,broken:true});expect(leg.hp).toBe(legHp-8);expect(core.hp).toBe(hp-2);
                expect(pool.poise).toBe(0);expect(leg.getStatusDuration('shielded')).toBe(0);expect(leg.isAbsorbing).toBe(false);
                expect(consumer.prepare).not.toHaveBeenCalled();expect(consumer.commit).not.toHaveBeenCalled();
                logger.log('fixture post-transfer damage failure');rng.randRange(1,9);rng.setRNG(RNGType.RNG_COSMETIC);rng.randRange(1,9);
                throw new Error('fixture post-transfer damage failure');
            }
            nativeEmit(name,event);
        });
        expect(()=>withBodyContact(leg,leg.loc,()=>leg.takeDamage(100,false,game.grid,undefined,'physical'))).toThrow('fixture post-transfer damage failure');
        fault.mockRestore();expect(reached).toBe(true);expect(consumer.prepare).not.toHaveBeenCalled();expect(consumer.commit).not.toHaveBeenCalled();
        expect(audit.differences()).toEqual([]);expect(runtime.snapshot()).toEqual(moduleBefore);expect(rng.getState()).toEqual(random);
        expect(getNextEntityId()).toBe(allocator);expect(logger.getState()).toEqual(log);expect(leg.getStatusDuration('shielded')).toBe(10);expect(leg.isAbsorbing).toBe(true);
        expect(game.monsters).toBe(members);expect(game.bodyGroups![0]).toBe(group);expect(group.members[1]).toBe(slot);
        expect(row(game,core.id)).toBe(pool);expect(leg.spatial).toBe(spatial);expect(spatial.zoneState![0]).toBe(zone);
        expect(()=>withBodyContact(leg,leg.loc,()=>leg.takeDamage(100,false,game.grid,undefined,'physical'))).not.toThrow();
        expect(consumer.prepare).toHaveBeenCalledOnce();expect(consumer.commit).toHaveBeenCalledOnce();
        expect(events(game).filter(event=>event.eventKind==='staggered')).toHaveLength(1);
        expect(leg.hp).toBe(legHp-8);expect(core.hp).toBe(hp-2);expect(pool.poise).toBe(0);expect(zone).toMatchObject({hp:0,broken:true});
    });
    it('suppresses a queued socket stagger when the subsequent same-contact transfer kills its core',()=>{
        const consumer={prepare:vi.fn(),commit:vi.fn()},{game,core,legs}=body(false,undefined,true,consumer),leg=legs[0]!;
        applyActorPoiseDamage(game,core.id,11);core.hp=1;const zone=leg.spatial!.zoneState![0]!;
        const runtime=game.extensionRuntime!,publish=runtime.commitCombatEvent.bind(runtime),stagedAtHp:number[]=[];
        vi.spyOn(runtime,'commitCombatEvent').mockImplementation((actor,payload)=>{
            if(actor===core&&payload.eventKind==='staggered')stagedAtHp.push(core.hp);
            publish(actor,payload);
        });
        expect(()=>withBodyContact(leg,leg.loc,()=>leg.takeDamage(8,true,game.grid,undefined,'physical'))).not.toThrow();
        expect(stagedAtHp).toEqual([1]);
        expect(zone).toMatchObject({hp:0,broken:true});expect(core.hp).toBe(0);expect(game.monsters).not.toContain(leg);
        expect(events(game).filter(event=>event.eventKind==='staggered')).toEqual([]);
        expect(consumer.prepare).not.toHaveBeenCalled();expect(consumer.commit).not.toHaveBeenCalled();
    });

});
