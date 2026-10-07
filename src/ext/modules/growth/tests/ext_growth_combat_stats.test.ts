import { extensionDigest, checkpointExtensionDigest } from '../../../../test/support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import data from '../data/definitions.json';
import { GROWTH_VERSION, parseGrowthDefinitionPack } from '../definitions';
import { mapGrowthCombatCapacity } from '../combatStats';
import { createGrowthGameplay } from '../module';
import type { GrowthDefinitionPack, GrowthModifier, GrowthSkill, GrowthTimedEffect } from '../types';
import { initialGrowthAttributes, growthRuleActor } from '../attributes';
import { initialGrowthProgression } from '../experience';
import { initialGrowthIdentityBuild } from '../identities';
import { initialGrowthSkillBuild, createGrowthEffectInstance } from '../skills';
import { initialGrowthState, type GrowthState } from '../state';
import type { Json } from '../../../types';
import { createGrowthStatSources } from '../statSources';
import { StatPipeline } from '../../../../engine/Stats/StatPipeline';
import { NATIVE_STAT_KEYS } from '../../../../engine/Stats/NativeStatKeys';
import type { StatKeyDeclaration } from '../../../stats';
const COMBAT_STAT_KEYS:readonly StatKeyDeclaration[]=['stamina-capacity','poise-capacity','stamina-regen','poise-recovery','native-attack-cost'].map(id=>({id:`combat.${id}`,owner:'combat',unit:'resource',kind:id.endsWith('capacity')?'materialized':'query',minimum:id.endsWith('capacity')?1:0,maximum:1_000_000,rounding:'floor',categories:['flat','increased','more','clamp'],increased:{minimum:-9000,maximum:50000},moreSlots:[{id:'growth.slot.final',minimum:-10000,maximum:30000}]}));
import type { StatActorFacts, StatSourceContext } from '../../../stats';
import { extensionDataFingerprint } from '../../../fingerprint';
import { canonical } from '../../../json';
import { createHeadlessGame } from '../../../../test/harness';
import { ExtensionRegistry } from '../../../registry';
import * as catalog from '../../../catalog';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import type { Game } from '../../../../engine/Core/Game';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { markCreatureBirth } from '../../../birth';

const con = 'growth.attribute.constitution', will = 'growth.attribute.will';
const fresh = (): GrowthDefinitionPack => structuredClone(data) as unknown as GrowthDefinitionPack;
const parse = (pack: GrowthDefinitionPack) => parseGrowthDefinitionPack(pack,{moduleVersion:pack.moduleVersion,hasText:()=>true});
function freeze<T>(value: T): T {
    if (value && typeof value === 'object') {Object.values(value).forEach(freeze);Object.freeze(value);} return value;
}
function fixture(change: (pack: GrowthDefinitionPack) => void = () => undefined, npc = false) {
    const data = fresh(); change(data); const pack = parse(data), provider = createGrowthStatSources(pack);
    const progression = initialGrowthProgression(pack.config.levels), attributes = initialGrowthAttributes(pack);
    const identity = initialGrowthIdentityBuild(), build = initialGrowthSkillBuild();
    if (npc) identity.templateId = pack.config.monsters.defaultTemplateId;
    const state = {...initialGrowthState(),created:true,playerId:1,revision:1};
    const components: Record<string, unknown> = {progression,attributes,identity,'skill-build':build};
    const actor:StatActorFacts={id:npc?2:1,player:!npc,monsterId:npc?'rat':null,name:'',hp:10,maxHp:10,x:1,y:1,allied:!npc,hostile:npc,statuses:[],tags:[]};
    const base=(key:string)=>key==='combat.stamina-capacity'?100:key==='combat.poise-capacity'?60:key==='native.strength'?12:key==='native.max-hp'?10:provider.keys?.find(k=>k.id===key)?.base??0;
    const context = ():StatSourceContext => freeze({playerId:1,state:structuredClone(state) as unknown as Json,facts:{},equippedItems:()=>[],base,
        getComponent:(_id:number,name:string)=>components[name]===undefined?undefined:freeze(structuredClone(components[name])) as Json});
    const pipeline=new StatPipeline({actor:()=>actor,revision:()=>0,base:(_id,key)=>base(key),collect:()=>provider.collect(actor,context()).map(r=>({...r,owner:'growth'}))},[...NATIVE_STAT_KEYS,...COMBAT_STAT_KEYS,...provider.keys!]);
    const query=()=>{pipeline.clear();return {staminaCapacity:pipeline.value(actor.id,'combat.stamina-capacity'),poiseCapacity:pipeline.value(actor.id,'combat.poise-capacity')};};
    return {data,pack,provider,progression,attributes,identity,build,state,components,context,query};
}
const modifier = (port: 'staminaCapacity' | 'poiseCapacity', amount: number): GrowthModifier => ({kind:'modifier',port,operation:'add',slot:null,
    magnitude:{source:{kind:'constant'},coefficient:amount,divisor:1,rounding:'floor',min:amount,max:amount},conditions:[]});
afterEach(() => vi.restoreAllMocks());

describe('EXT-3g growth actor-scoped combat capacity provider', () => {
    it('uses independent configurable maps, baseline, floor and exact large rational arithmetic', () => {
        const f = fixture(pack => {
            pack.config.combatStats!.stamina = {...pack.config.combatStats!.stamina,baseline:1,coefficient:2,denominator:3};
            pack.config.combatStats!.poise = {...pack.config.combatStats!.poise,coefficient:5,denominator:2};
        });
        f.attributes.values[con]=6; f.attributes.values[will]=3;
        expect(f.query()).toMatchObject({staminaCapacity:103,poiseCapacity:67});
        const map = {...f.pack.config.combatStats!.stamina,baseline:0,coefficient:Number.MAX_SAFE_INTEGER,denominator:Number.MAX_SAFE_INTEGER};
        expect(mapGrowthCombatCapacity(100,7,map)).toBe(107);
        expect(mapGrowthCombatCapacity(100,0,{...map,baseline:3})).toBe(100);
        expect(mapGrowthCombatCapacity(100,8,{...map,denominator:1})).toBe(map.max);
        expect(mapGrowthCombatCapacity(1,0,{...map,min:7})).toBe(7);
    });
    it('is repeatable, frozen, zero-tick and returns only capacities with an exact effective-input fingerprint', () => {
        const f=fixture(), before=canonical({state:f.state,components:f.components}), random=rng.getState(), tick=timeSystem.currentTick;
        const result=f.query(); for(let n=0;n<25;n++) expect(f.query()).toEqual(result);
        expect(Object.keys(result).sort()).toEqual(['poiseCapacity','staminaCapacity']);
        f.state.objectiveClock++; f.state.revision++; expect(f.query()).toEqual(result);
        f.state.objectiveClock--; f.state.revision--; expect(canonical({state:f.state,components:f.components})).toBe(before);
        f.attributes.values[con]=1;expect(f.query().staminaCapacity).not.toBe(result.staminaCapacity);
        f.attributes.values[con]=0;expect(f.query()).toEqual(result);
        expect(rng.getState()).toEqual(random);expect(timeSystem.currentTick).toBe(tick);
    });
    it('uses the same trusted protocol for NPC templates and keeps unsupported actors explicit', () => {
        const f=fixture(undefined,true);f.attributes.values[con]=3;f.attributes.values[will]=2;
        expect(f.query()).toMatchObject({staminaCapacity:106,poiseCapacity:62});
        const unsupported=fixture(pack=>{pack.config.combatStats!.allowedTemplateIds=[];},true);
        expect(unsupported.query()).toEqual({staminaCapacity:100,poiseCapacity:60});
        const disabled=fixture(pack=>{pack.config.combatStats=null;});expect(disabled.query()).toEqual({staminaCapacity:100,poiseCapacity:60});
        const playerDisabled=fixture(pack=>{pack.config.combatStats!.playerEnabled=false;});expect(playerDisabled.query()).toEqual({staminaCapacity:100,poiseCapacity:60});
        delete f.components.progression;delete f.components.attributes;delete f.components.identity;expect(f.query()).toEqual({staminaCapacity:100,poiseCapacity:60});
        f.components.attributes=initialGrowthAttributes(f.pack);expect(f.query()).toEqual({staminaCapacity:100,poiseCapacity:60});
    });
    it('reads only its own actor components and does not reinstate the retired protocol',()=>{
        const f=fixture();expect(f.provider.keys!.every(key=>key.id.startsWith('growth.'))).toBe(true);
        expect(createGrowthGameplay(f.pack,undefined).optionalActorQueries).toBeUndefined();
        const context=f.context();expect(Object.isFrozen(context)).toBe(true);expect('actorId' in context.facts).toBe(false);
    });
    it('validates references, integer coefficients, baseline and bounds while explicit null disables every map', () => {
        for(const mutate of [
            (p:GrowthDefinitionPack)=>{p.config.combatStats!.stamina.attributeId='growth.attribute.unknown';},
            (p:GrowthDefinitionPack)=>{p.config.combatStats!.stamina.coefficient=0.5;},
            (p:GrowthDefinitionPack)=>{p.config.combatStats!.stamina.denominator=0;},
            (p:GrowthDefinitionPack)=>{p.config.combatStats!.stamina.baseline=9;},
            (p:GrowthDefinitionPack)=>{p.config.combatStats!.poise.min=0;},
            (p:GrowthDefinitionPack)=>{p.config.combatStats!.poise.max=1000001;},
            (p:GrowthDefinitionPack)=>{p.config.combatStats!.allowedTemplateIds=['growth.template.unknown'];},
        ]) {const pack=fresh();mutate(pack);expect(()=>parse(pack)).toThrow();}
        const pack=fresh();pack.config.combatStats=null;expect(()=>parse(pack)).not.toThrow();
    });
    it('applies existing timed scopes repeatedly without stacking, and expires purely without consuming effects', () => {
        const f=fixture(pack=>{
            const skill=pack.definitions.find(d=>d.id==='growth.skill.brace') as GrowthSkill;
            const effect=skill.effects[0] as GrowthTimedEffect;
            effect.modifiers=[modifier('staminaCapacity',12),modifier('poiseCapacity',-7)];
            pack.config.combatStats!.stamina.max=108;pack.config.combatStats!.poise.min=55;
        });
        const base=f.query(),skill=f.pack.definitions.find(d=>d.id==='growth.skill.brace') as GrowthSkill;
        const effect=skill.effects[0] as GrowthTimedEffect,actor=growthRuleActor(1,f.progression,f.attributes);
        const instance=createGrowthEffectInstance(f.pack,skill,effect,actor,f.build,0,1,1);
        for(let cycle=0;cycle<8;cycle++) {
            f.build.effects=[structuredClone(instance)];const before=canonical(f.build);
            const active=f.query();expect(active).toMatchObject({staminaCapacity:108,poiseCapacity:55});
            expect(active).not.toEqual(base);
            for(let read=0;read<5;read++) expect(f.query()).toEqual(active);
            expect(canonical(f.build)).toBe(before);
            f.state.objectiveClock=instance.expiresAt!;expect(f.query()).toEqual(base);expect(canonical(f.build)).toBe(before);
            f.build.effects=[];f.state.objectiveClock=0;expect(f.query()).toEqual(base);
        }
    });
});

function runtimeFixture(change: (pack:GrowthDefinitionPack)=>void = () => undefined) {
    const pack=fresh();pack.config.levels.attributePoints={kind:'periodic',firstLevel:1,every:1,amount:20};
    pack.config.levels.skillPoints={kind:'periodic',firstLevel:1,every:1,amount:20};
    pack.config.experience.sources.firstVisits=false;
    pack.config.respec={enabled:true,cost:{resource:'gold',amount:0},refundBasisPoints:10000,clearCooldowns:false};change(pack);
    const parsed=parse(pack),identity={schema:1,version:pack.moduleVersion,fingerprint:extensionDataFingerprint(pack)};
    vi.spyOn(catalog,'createExtensionRegistry').mockImplementation(()=>{
        const registry=new ExtensionRegistry();registry.register('growth',pack.moduleVersion,()=>createGrowthGameplay(parsed,identity),identity);registry.register('combat','1.6.0',()=>({id:'combat',version:'1.6.0',initialState:()=>({}),validateState:(v):v is Json=>!!v,statSources:{keys:COMBAT_STAT_KEYS.map(k=>({...k,base:k.id==='combat.stamina-capacity'?100:k.id==='combat.poise-capacity'?60:0})),collect:()=>[]}}));return registry;
    });
    const game=createHeadlessGame(77031,'test');game.startNewGame({seed:77031,mode:'test',ruleSet:'extended',extensions:['growth','combat']});
    const state=()=>game.extensionRuntime!.snapshot().modules.growth as unknown as GrowthState;
    const command=(action:string,payload:Record<string,unknown>={})=>{
        game.executeCommand('ext:command',JSON.stringify({module:'growth',action,payload:{revision:state().revision,...payload}}));
        while(game.isAdvancing)game.stepAdvancement();expect(game.lastAdvancementError).toBeNull();
    };
    command('create-character',{revision:0});
    return {game,command,pack};
}
const queryPlayer=(game:Game)=>({staminaCapacity:game.extensionRuntime!.stats.value(game.player.id,'combat.stamina-capacity'),poiseCapacity:game.extensionRuntime!.stats.value(game.player.id,'combat.poise-capacity')});

describe('EXT-3g growth combat provider actual commands and reconstruction',()=>{
    it('queries actual allocation and respec without mutation and restores exact results on repeated load and replay',()=>{
        const {game,command}=runtimeFixture(),base=queryPlayer(game);
        const random=rng.getState(),tick=timeSystem.currentTick;
        command('allocate',{attributes:{[con]:3,[will]:2}});
        const increased=queryPlayer(game);expect(increased).toMatchObject({staminaCapacity:106,poiseCapacity:62});
        const saved=game.toSaveSnapshot(),snapshot=game.extensionRuntime!.snapshot();
        for(let i=0;i<20;i++)expect(queryPlayer(game)).toEqual(increased);
        expect(game.extensionRuntime!.snapshot()).toEqual(snapshot);expect(rng.getState()).toEqual(random);expect(timeSystem.currentTick).toBe(tick);
        for(let i=0;i<3;i++){expect(game.loadSnapshot(saved)).toBe(true);expect(queryPlayer(game)).toEqual(increased);expect(game.extensionRuntime!.snapshot()).toEqual(snapshot);}
        const replay=game.exportRecording(),loaded=createHeadlessGame(2,'test');expect(loaded.loadReplay(replay)).toBe(true);
        loaded.animationEnabled=false;
        for(const _event of replay.events){loaded.replayStep(true);expect(loaded.replayError).toBeNull();}
        expect(queryPlayer(loaded)).toEqual(increased);
        for(const index of [1,replay.events.length,1,replay.events.length]) {
            loaded.replaySeek(index);expect(loaded.replayError).toBeNull();expect(queryPlayer(loaded)).toEqual(index===1 ? base : increased);
        }
        command('respec');expect(queryPlayer(game)).toEqual(base);
        const old=structuredClone(saved);old.extensions!.manifest.modules.find(m=>m.id==='growth')!.version='1.7.0';
        const current=game.extensionRuntime;expect(game.loadSnapshot(old)).toBe(false);expect(game.extensionRuntime).toBe(current);
        expect(GROWTH_VERSION).toBe('1.8.0');
    });
    it('repeated real temporary casts expire without accumulating capacity or changing the saved effect on reads',()=>{
        const skillId='growth.skill.brace';
        const {game,command}=runtimeFixture(pack=>{
            const skill=pack.definitions.find(d=>d.id===skillId) as GrowthSkill;
            skill.prerequisites=[];skill.focusCost=0;skill.cooldown=0;
            const effect=skill.effects[0] as GrowthTimedEffect;
            effect.duration={kind:'objective-blocks',blocks:3,cap:3};
            effect.consume={event:'none',count:0,phase:'per-resolution-commit',includesShieldAbsorbed:false};
            effect.modifiers=[modifier('staminaCapacity',9),modifier('poiseCapacity',-4)];
        });
        command('learn-skill',{skillId});command('equip-skills',{active:[skillId],passive:[]});
        const base=queryPlayer(game);
        for(let cycle=0;cycle<3;cycle++) {
            command('use-skill',{skillId,target:{kind:'self'}});
            const active=queryPlayer(game);expect(active).toMatchObject({staminaCapacity:109,poiseCapacity:56});
            const saved=game.toSaveSnapshot();
            for(let n=0;n<8;n++)expect(queryPlayer(game)).toEqual(active);
            expect(extensionDigest(game.extensionRuntime!.snapshot() ?? null)).toBe(checkpointExtensionDigest(saved));
            expect(game.loadSnapshot(saved)).toBe(true);expect(queryPlayer(game)).toEqual(active);
            for(let n=0;n<3;n++) {game.executeCommand('wait');while(game.isAdvancing)game.stepAdvancement();}
            expect(queryPlayer(game)).toEqual(base);
        }
    });
    it('uses live NPC facts and keeps the retired optional capability absent',()=>{
        const {game}=runtimeFixture(),monster=new Monster(game.player.x+2,game.player.y,(monsters as MonsterData[]).find(m=>m.id==='rat')!);
        markCreatureBirth(monster,'test');game.monsters.push(monster);game.extensionRuntime!.attachCreature(monster);
        expect(game.extensionRuntime!.stats.value(monster.id,'combat.stamina-capacity')).toBe(100);
        expect(game.extensionRuntime!.stats.value(monster.id,'combat.poise-capacity')).toBe(60);
        expect(game.extensionRuntime!.queryOptionalActor('growth.combat-stats.v1',monster,{v:1})).toEqual({status:'unavailable',reason:'absent'});
        expect(()=>game.extensionRuntime!.stats.value(Number.MAX_SAFE_INTEGER,'combat.stamina-capacity')).toThrow();
    });
});
