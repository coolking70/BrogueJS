import { installBodyFixture } from '../../../../test/support/productionComposite';
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import { Game } from '../../../../engine/Core/Game';
import { withBodyContact } from '../../../../engine/Combat/BodyCombat';
import { ActorCombatResolutionAuthority } from '../../../../engine/Combat/ActorCombatResolution';
import { withActorActionScope } from '../../../../engine/Core/ActorActionScope';
import { productionActorActionScheduler } from '../../../../engine/Core/ActorActionProduction';
import { preparePhasedAttackCommand,commitPhasedAttackCommand,applyActorPoiseDamage } from '../../../../engine/Core/PhasedAttackProduction';
import { selectNativeActorAction } from '../../../../engine/Core/ActorActionSession';
import { commitCreatureAnchor,footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { TerrainType as T,DungeonLayer as L } from '../../../../engine/Map/Grid';
import { EnvironmentManager } from '../../../../engine/Environment/Gas';
import { WaypointSystem } from '../../../../engine/Map/WaypointMap';
import species from '../../../../data/monsters.json';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { Monster,MonsterState,type MonsterData } from '../../../../entities/Monster';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import { extensionDataFingerprint } from '../../../fingerprint';
import type { ActorAttackDefinitions } from '../../../actorActions';
import type { Json } from '../../../types';
import type { PartBreakCommitContext,PartBreakProvider } from '../../../partBreak';
const json=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const command=JSON.stringify({module:'combat',action:'attack',payload:{attackId:'fixture.slash',facing:'s'}});
const state=(game:Game)=>game.extensionRuntime!.actorActionBinding()!.state;
const row=(game:Game,id:number)=>state(game).actors.find(row=>row.actorId===id)!;
function configure(mode:'normal'|'throw'|'invalid'|'async'|'unsupported'|'absent'='normal',sourceProfile=false){
    let captured:PartBreakCommitContext|undefined;
    const registry=registryFromDescriptors(catalog.getInstalledModuleDescriptors().map(d=>{
        if(d.id!=='combat')return d;
        const base=d.create(),original=base.optionalPartBreaks!['combat.part-break.v1']!;
        const definitions=json(base.actorActions!.definitions) as unknown as ActorAttackDefinitions;
        if(sourceProfile)definitions.nativeProfiles.push({monsterId:'body-fixture.spine-crawler',profileId:'combat.shock-ring'});
        const provider:PartBreakProvider={prepare:(request,context)=>mode==='unsupported'?{status:'unsupported',reason:'unsupported-target'}:original.prepare(request,context),
            commit:(request,plan,context)=>{captured=context;original.commit(request,plan,context);
                if(mode==='throw')throw new Error('after combat state');
                if(mode==='invalid')return 'invalid' as never;
                if(mode==='async')return Promise.resolve() as never;
            }};
        const rules={...base.rules!,fingerprint:extensionDataFingerprint(definitions)};
        return {...d,rules,create:()=>({...base,rules,actorActions:{...base.actorActions!,definitions:definitions as unknown as Json},optionalPartBreaks:mode==='absent'?undefined:{'combat.part-break.v1':provider}})};
    }));vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(registry);
    return ()=>captured;
}
function scene(ids=['combat','body-fixture']){
    const game=createHeadlessGame(44206,'wizard');game.startNewGame({seed:44206,mode:'wizard',ruleSet:'extended',extensions:ids});
    game.animationEnabled=false;game.monsters=[];game.dormantMonsters=[];game.items=[];
    for(let y=0;y<game.grid.height;y++)for(let x=0;x<game.grid.width;x++){
        game.grid.setTerrain(x,y,x===0||y===0||x===game.grid.width-1||y===game.grid.height-1?T.WALL:T.FLOOR);
        for(const layer of [L.LIQUID,L.SURFACE,L.GAS])game.grid.setTerrainLayer(x,y,layer,T.NOTHING);
        game.grid.getCell(x,y)!.machineNumber=0;
    }
    game.environment=new EnvironmentManager(game.grid);game.waypoints=new WaypointSystem();commitCreatureAnchor(game.player,{x:22,y:11});
    const boss=game.createModuleMonster('body-fixture.spine-crawler',{x:20,y:12})!;
    boss.state=MonsterState.HUNTING;boss.ticksUntilTurn=1000;boss.defense=-1000;(game as any).updateVision();return{game,boss};
}
function hit(game:Game,boss:Monster){const cell=footprintOf(boss).find(p=>p.zoneId==='shell')!;
    return withBodyContact(boss,cell,()=>boss.takeDamage(60,true,game.grid,undefined,'physical'));}
function pending(game:Game){const plan=preparePhasedAttackCommand(game,command)!;expect(plan).not.toBeNull();commitPhasedAttackCommand(game,plan);return state(game).scheduler.bundles[0]!;}
// The independent foundation fixture preserves the historical zone geometry and values.
beforeEach(() => installBodyFixture());
afterEach(()=>{vi.restoreAllMocks();logger.reset();});
describe('3d production part-break integration with independent fixed-zone content',()=>{
    it.each(['normal','throw'] as const)('3e successive rest receipts keep distinct identities through %s provider adoption',mode=>{
        configure(mode);const {game,boss}=scene();boss.isAlly=true;boss.ticksUntilTurn=100000;
        const camp=game.extensionRuntime!.snapshot().foundation.world.entities.find(entity=>entity.owner==='combat')!;
        expect(camp).toBeDefined();commitCreatureAnchor(game.player,{x:camp.x,y:camp.y});(game as any).updateVision();
        const rest=JSON.stringify({module:'combat',action:'rest',payload:{bonfireId:camp.id}});
        for(let i=0;i<2;i++){while(logger.pendingAcknowledgment)logger.acknowledgeNext();game.executeCommand('ext:command',rest);}
        const ledger=state(game).bonfires!,receipts=ledger.receipts,first=receipts[0]!,second=receipts[1]!;
        expect(receipts.map(receipt=>receipt.visit)).toEqual([1,2]);expect(first).not.toBe(second);
        const before=json(state(game));
        if(mode==='throw'){expect(()=>hit(game,boss)).toThrow('after combat state');expect(state(game)).toEqual(before);}
        else hit(game,boss);
        expect(state(game).bonfires).toBe(ledger);expect(ledger.receipts).toBe(receipts);
        expect(receipts[0]).toBe(first);expect(receipts[1]).toBe(second);
        expect(receipts).toEqual(before.bonfires!.receipts);expect(()=>game.toSaveSnapshot()).not.toThrow();
        const saved=json(game.toSaveSnapshot());expect(game.loadSnapshot(saved)).toBe(true);
        expect(state(game).bonfires!.receipts).toEqual(before.bonfires!.receipts);
    });

    it('core poise loss replaces fallback and native receipt prevents repeat consumption',()=>{
        const {game,boss}=scene();hit(game,boss);
        expect(boss.spatial!.actionLockInTicks).toBeUndefined();expect(row(game,boss.id)).toMatchObject({poise:6,staggerRemainingTicks:0});
        const revision=state(game).revision;hit(game,boss);expect(row(game,boss.id).poise).toBe(6);expect(state(game).revision).toBe(revision);
        expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    });
    it.each(['absent','unsupported'] as const)('%s provider uses only native fallback',mode=>{
        if(mode==='unsupported')configure('unsupported');const {game,boss}=scene(mode==='absent'?['body-fixture']:undefined);hit(game,boss);
        expect(boss.spatial!.actionLockInTicks).toBe(50);if(mode==='unsupported')expect(state(game).actors).toEqual([]);
    });
    it('core break mirrors max native recovery without stacking fallback, and survives load',()=>{
        const {game,boss}=scene();boss.ticksUntilTurn=20;applyActorPoiseDamage(game,boss.id,7);hit(game,boss);
        expect(row(game,boss.id)).toMatchObject({poise:0,staggerRemainingTicks:50});expect(boss.ticksUntilTurn).toBe(50);expect(boss.spatial!.actionLockInTicks).toBeUndefined();
        const saved=json(game.toSaveSnapshot()),loaded=createHeadlessGame(12,'test');expect(loaded.loadSnapshot(saved,message=>{throw new Error(message);})).toBe(true);expect(row(loaded,boss.id).staggerRemainingTicks).toBe(50);
    });
    it.each(['throw','invalid','async'] as const)('%s after provider setState restores exact active graph and native state',mode=>{
        configure(mode);const {game,boss}=scene(),bundle=pending(game),child=bundle.subactions[0]!,phases=child.phases,phase=phases[0]!;
        const live=state(game),scheduler=productionActorActionScheduler(game),before=json(live),hp=boss.hp,spatial=boss.spatial,zone=spatial!.zoneState![0]!;
        const zoneBefore=json(zone),random=rng.getState(),clocks=[game.player.ticksUntilTurn,boss.ticksUntilTurn];
        expect(()=>hit(game,boss)).toThrow();expect(state(game)).toBe(live);expect(state(game)).toEqual(before);
        expect(productionActorActionScheduler(game)).toBe(scheduler);expect(live.scheduler.bundles[0]).toBe(bundle);expect(bundle.subactions[0]).toBe(child);expect(child.phases).toBe(phases);expect(phases[0]).toBe(phase);
        expect(boss.hp).toBe(hp);expect(boss.spatial).toBe(spatial);expect(spatial!.zoneState![0]).toBe(zone);expect(zone).toEqual(zoneBefore);
        expect([game.player.ticksUntilTurn,boss.ticksUntilTurn]).toEqual(clocks);expect(rng.getState()).toEqual(random);expect(()=>game.toSaveSnapshot()).not.toThrow();
    });
    it('failed provider preserves a prepared native authority plan; success invalidates it',()=>{
        configure('throw');const {game,boss}=scene();const authority=new ActorCombatResolutionAuthority(game,{schema:1,nextResolutionId:1,actors:[]},{production:true});
        const plan=authority.prepareNativeMelee({kind:'native-melee',depth:game.depth,sourceEntityId:game.player.id,targetEntityId:boss.id,dodgeable:true,parryable:true})!;
        expect(plan).not.toBeNull();expect(()=>hit(game,boss)).toThrow('after combat state');
        const native=vi.spyOn(game,'resolveActorNativeMelee').mockReturnValue({hit:false,damage:0,backstab:false});
        expect(withActorActionScope(game,'player-command',game.player.id,scope=>authority.commitNativeMelee(scope,plan))).not.toBeNull();expect(native).toHaveBeenCalledOnce();
    });
    it('mechanical post-provider fault rolls back cancellation, timers, speed and state identities',()=>{
        const {game,boss}=scene(),bundle=pending(game),child=bundle.subactions[0]!,live=state(game),before=json(live),hp=boss.hp,zone=json(boss.spatial);
        const next=vi.spyOn(game,'footprintOf').mockImplementation(()=>{throw new Error('zone cancellation fault');});
        expect(()=>hit(game,boss)).toThrow('zone cancellation fault');next.mockRestore();
        expect(state(game)).toBe(live);expect(state(game)).toEqual(before);expect(live.scheduler.bundles[0]).toBe(bundle);expect(bundle.subactions[0]).toBe(child);
        expect(boss.hp).toBe(hp);expect(boss.spatial).toEqual(zone);expect(boss.movementSpeed).toBe(100);expect(game.player.ticksUntilTurn).toBe(50);expect(boss.ticksUntilTurn).toBe(1000);
        expect(()=>game.toSaveSnapshot()).not.toThrow();
    });
    it('success cancels locked target warning and preserves current graph identities',()=>{
        const {game,boss}=scene(),bundle=pending(game),child=bundle.subactions[0]!,live=state(game);hit(game,boss);
        expect(state(game)).toBe(live);expect(live.scheduler.bundles[0]).toBe(bundle);expect(bundle.subactions[0]).toBe(child);
        expect(child.phases[child.phaseIndex]!.kind).toBe('break-recovery');expect(live.actions[0]!.subactions[0]!.lockedCells).toEqual([]);expect(()=>game.toSaveSnapshot()).not.toThrow();
    });
    it('commit capabilities expire after the synchronous provider call',()=>{
        const captured=configure(),{game,boss}=scene();hit(game,boss);const before=json(state(game));
        expect(()=>captured()!.setState(before as unknown as Json)).toThrow('Expired');expect(state(game)).toEqual(before);
    });
    it('provider breaks an active source without replacing its scheduler graph',()=>{
        configure('normal',true);const{game,boss}=scene();boss.ticksUntilTurn=0;expect(selectNativeActorAction(game,boss.id)).toBe('handled');
        const bundle=state(game).scheduler.bundles.find(bundle=>bundle.decisionOwnerId===boss.id)!,child=bundle.subactions[0]!;
        applyActorPoiseDamage(game,boss.id,7);hit(game,boss);
        expect(state(game).scheduler.bundles.find(b=>b.actionId===bundle.actionId)).toBe(bundle);expect(bundle.subactions[0]).toBe(child);
        expect(child.phases[child.phaseIndex]!.kind).toBe('break-recovery');expect(row(game,boss.id)).toMatchObject({poise:0,staggerRemainingTicks:0});expect(()=>game.toSaveSnapshot()).not.toThrow();
    });
    it('real native release handles two simultaneously due owners without weakening save codec',()=>{
        const {game,boss}=scene(),rat=new Monster(22,10,species.find(species=>species.id==='rat')! as MonsterData);
        rat.state=MonsterState.HUNTING;rat.ticksUntilTurn=0;rat.hp=rat.maxHp=1000;game.monsters.push(rat);game.extensionRuntime!.attachCreature(rat);
        const weapon=ItemLoader.spawnWeapon('dagger',-1,-1)!;weapon.damage='60-60';weapon.strengthRequired=game.player.effectiveStrength;weapon.enchantment=0;weapon.flags=[];game.player.equippedWeapon=weapon;game.player.inventory.addItem(weapon);
        expect(selectNativeActorAction(game,rat.id)).toBe('handled');pending(game);boss.setStatusDuration('paralyzed',10);
        const scheduler=productionActorActionScheduler(game)!;scheduler.advanceActionTime(50);
        expect(state(game).scheduler.bundles.filter(bundle=>bundle.subactions[0]!.phaseRemainingTicks===0)).toHaveLength(2);
        expect(()=>scheduler.dispatchActorBoundary(game.player.id)).not.toThrow();expect(boss.spatial!.zoneState![0]!.broken).toBe(true);
        expect(()=>scheduler.dispatchActorBoundary(rat.id)).not.toThrow();expect(()=>game.toSaveSnapshot()).not.toThrow();
    });
    it('provider-inserted recovery at the resolving source boundary is not advanced away',()=>{
        configure('normal',true);const {game,boss}=scene();boss.ticksUntilTurn=0;expect(selectNativeActorAction(game,boss.id)).toBe('handled');
        const scheduler=productionActorActionScheduler(game)!,bundle=state(game).scheduler.bundles[0]!,child=bundle.subactions[0]!;
        scheduler.advanceActionTime(scheduler.nextActionBoundary()!);applyActorPoiseDamage(game,boss.id,7);
        vi.spyOn(game,'resolveActorNativeMelee').mockImplementation(()=>{hit(game,boss);return{hit:false,damage:0,backstab:false};});
        expect(scheduler.dispatchActorBoundary(boss.id)).toBe('handled');
        expect(child.phases[child.phaseIndex]!.kind).toBe('break-recovery');expect(child.phaseRemainingTicks).toBe(50);expect(boss.ticksUntilTurn).toBe(50);
        expect(row(game,boss.id)).toMatchObject({poise:0,staggerRemainingTicks:0});expect(()=>game.toSaveSnapshot()).not.toThrow();
    });

    it.each(['absent','unsupported'] as const)('%s with combat installed rolls back a cancellation-budget fault',mode=>{
        configure(mode);const {game,boss}=scene(),bundle=pending(game),child=bundle.subactions[0]!,phase=child.phases[0]!,live=state(game);
        live.revision=Number.MAX_SAFE_INTEGER-1;const before=json(live),hp=boss.hp,spatial=json(boss.spatial),clock=game.player.ticksUntilTurn;
        expect(()=>hit(game,boss)).toThrow('Action revision exhausted');
        expect(state(game)).toBe(live);expect(live).toEqual(before);expect(live.scheduler.bundles[0]).toBe(bundle);expect(bundle.subactions[0]).toBe(child);expect(child.phases[0]).toBe(phase);
        expect(boss.hp).toBe(hp);expect(boss.spatial).toEqual(spatial);expect(game.player.ticksUntilTurn).toBe(clock);expect(boss.movementSpeed).toBe(100);
        expect(()=>game.toSaveSnapshot()).not.toThrow();
    });

    it('rollback also restores a dormant zone owner from the authoritative world cohort',()=>{
        configure('absent');const {game,boss}=scene(),bundle=pending(game),child=bundle.subactions[0]!;
        game.monsters=[];game.dormantMonsters.push(boss);boss.isDormant=true;
        state(game).revision=Number.MAX_SAFE_INTEGER-1;const before=json(state(game)),spatial=json(boss.spatial),hp=boss.hp;
        expect(()=>hit(game,boss)).toThrow('Action revision exhausted');
        expect(state(game)).toEqual(before);expect(bundle.subactions[0]).toBe(child);expect(child.phases[0]!.kind).toBe('windup');
        expect(boss.hp).toBe(hp);expect(boss.spatial).toEqual(spatial);expect(boss.movementSpeed).toBe(100);expect(boss.ticksUntilTurn).toBe(1000);
    });

});
