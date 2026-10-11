import { afterEach, expect, it, vi } from 'vitest';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import { extensionDataFingerprint } from '../../../fingerprint';
import type { ActorFacts, ExtensionContext, Json } from '../../../types';
import { createGrowthGameplay } from '../module';
import { loadGrowthDefinitionPack, parseGrowthDefinitionPack } from '../definitions';
import type { GrowthDefinitionPack } from '../types';
import type { GrowthState } from '../state';
import { installBodyFixture, startProductionGame, emptyProductionArena } from '../../../../test/support/productionComposite';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';

afterEach(()=>{vi.restoreAllMocks();logger.reset();logger.onDisturb=null;});
it.each([undefined,42])('SDK2 strict producer projects ActorFacts (movementRegionId=%s), preserving origin/admin and rejecting forged DTO fields',movementRegionId=>{
    const registry=catalog.createExtensionRegistry(), module=registry.create(registry.manifest(['growth']))[0]!;
    let saved=module.initialState();
    const context={get state(){return structuredClone(saved);},setState(next:Json){expect(module.validateState(next),'closed death DTO').toBe(true);saved=structuredClone(next);}};
    const actor:ActorFacts={id:2,name:'regional actor',hp:0,maxHp:10,x:5,y:5,player:false,allied:false,hostile:true,monsterId:'rat',
        ...(movementRegionId===undefined?{}:{movementRegionId})};
    const origin={effectId:1,rootEffectId:1,actorId:1,creditActorId:1,creditPartyId:'player:1:actor:1:relation:0',kind:'melee' as const,parentEffectId:null};
    module.hooks!.deathCaptured!({actor,origin,administrative:true},context as ExtensionContext);
    expect((saved as unknown as GrowthState).pending).toEqual([{kind:'kill',actor:{id:2,name:actor.name,hp:0,maxHp:10,x:5,y:5,player:false,allied:false,hostile:true,monsterId:'rat'},origin,administrative:true}]);
    for(const field of ['movementRegionId','extra']){const forged=structuredClone(saved) as unknown as GrowthState;
        Object.assign((forged.pending[0] as any).actor,{[field]:42});expect(module.validateState(forged)).toBe(false);}
    module.hooks!.deathCaptured!({actor,origin,administrative:false,rewardEligible:false},context as ExtensionContext);
    expect((saved as unknown as GrowthState).pending).toHaveLength(1);
});

function scene() {
    const descriptors=installBodyFixture(), pack=structuredClone(loadGrowthDefinitionPack({hasText:()=>true})) as GrowthDefinitionPack;
    for(const monsterId of ['body-fixture.ridgeback','body-fixture.spine-crawler','body-fixture.shale-weaver'])
        pack.config.experience.kills.monsterQuotes.push({monsterId,threatRank:6,amount:27});
    const parsed=parseGrowthDefinitionPack(pack,{moduleVersion:pack.moduleVersion,hasText:()=>true});
    const registry=registryFromDescriptors(descriptors.map(d=>{if(d.id!=='growth')return d;
        const rules={...d.create().rules!,fingerprint:extensionDataFingerprint(pack)};return {...d,rules,create:()=>createGrowthGameplay(parsed,rules)};}));
    vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(registry);
    const game=startProductionGame(['body-fixture','growth'], 73118);emptyProductionArena(game);game.clearRecording();
    const runtime=game.extensionRuntime!,token=runtime.beginGeneration('regional death fixture');
    const region=runtime.installOwnedRegions(token,'body-fixture',[{instanceKey:'death.region.1',bounds:{x:8,y:3,width:30,height:20}}],game.grid)[0]!;
    runtime.commitGeneration(token);
    return {game,runtime,region};
}
for(const form of ['square','fixed-zone','composite-core'] as const)
it.each(['player','ally','administrative'] as const)(`SDK2 regional ${form} death from %s retains rewards, receipts, GC and real save/load`,sourceKind=>{
    const {game,runtime,region}=scene();
    const target=form==='composite-core'?game.createCompositeMonster('body-fixture.shale-weaver-body',{x:20,y:12},region.id,'natural')!:
        game.createModuleMonster(form==='square'?'body-fixture.ridgeback':'body-fixture.spine-crawler',{x:20,y:12},region.id,'natural')!;
    expect(target).not.toBeNull();expect(target.spatial!.movementRegionId).toBe(region.id);
    const source=sourceKind==='ally'?new Monster(40,15,monsters.find(m=>m.id==='rat')! as MonsterData):game.player;
    if(source instanceof Monster){source.isAlly=true;game.monsters.push(source);runtime.attachCreature(source);}
    const xp=(id=game.player.id)=>(runtime.snapshot().components[id]!['growth:progression'] as {experience:number}).experience;
    const before=xp(),sourceBefore=xp(source.id),origin=runtime.causality.create('melee',source.id,source.id,source.extensionHooks!.partyId(source));
    if(sourceKind==='administrative')runtime.causality.withOrigin(origin,()=>game.killMonster(target,true));
    else runtime.causality.withOrigin(origin,()=>target.takeDamage(10000,true));
    const pending=(runtime.snapshot().modules.growth as unknown as GrowthState).pending.filter(p=>p.kind==='kill');
    const death=pending.find(p=>p.kind==='kill'&&p.actor.id===target.id)!;
    expect(death).toMatchObject({kind:'kill',origin:sourceKind==='administrative'?null:origin,administrative:sourceKind==='administrative'});
    expect(Object.keys((death as any).actor).sort()).toEqual(['id','name','hp','maxHp','x','y','player','monsterId','allied','hostile'].sort());
    const flush=()=>game.executeCommand('sdk-death-fixture',undefined,()=>undefined);
    const random=rng.getState();flush();expect(rng.getState()).toEqual(random);
    expect(xp()).toBe(before+(sourceKind==='player'?27:sourceKind==='ally'?21:0));
    if(sourceKind==='ally')expect(xp(source.id)).toBe(sourceBefore+6);
    expect((runtime.snapshot().modules.growth as unknown as GrowthState).rewardReceipts).toContain(`birth:${target.id}`);
    game.killMonster(target);(game as any).removeDeadMonsters();flush();
    const once=runtime.snapshot();(game as any).collectExtensionComponents();expect(runtime.snapshot()).toEqual(once);
    expect(xp()).toBe(before+(sourceKind==='player'?27:sourceKind==='ally'?21:0));
    (game as any).updateVision();
    const saved=game.toSaveSnapshot();expect(game.loadSnapshot(saved)).toBe(true);
    const after=game.toSaveSnapshot();after.savedAt=saved.savedAt;expect(after).toEqual(saved);
});
