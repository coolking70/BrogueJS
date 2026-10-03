import { afterEach, describe, expect, it, vi } from 'vitest';
import data from '../ext/modules/growth/definitions.json';
import { loadGrowthDefinitionPack, parseGrowthDefinitionPack } from '../ext/modules/growth/definitions';
import type { GrowthDefinitionPack, GrowthRuleActor, GrowthSkill } from '../ext/modules/growth/types';
import { initialGrowthSkillBuild, growthSkillDefinition, growthSkillScopes, growthSkillScalar, growthSkillCooldown,
    canLearnGrowthSkill, growthTaggedProperty, createGrowthEffectInstance, advanceGrowthFocus, isGrowthSkillBuild, growthLearnedCost,
    type GrowthSkillBuild } from '../ext/modules/growth/skills';
import { evaluateGrowthPort, evaluateGrowthPhysicalDamage } from '../ext/modules/growth/evaluator';
import { createGrowthGameplay } from '../ext/modules/growth/module';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import { Player } from '../entities/Player';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { Item, ItemCategory } from '../engine/Items/Item';
import { CombatSystem } from '../engine/Combat/Combat';
import { rng } from '../engine/Random';
import { extensionDataFingerprint } from '../ext/fingerprint';
import type { GrowthAttributes, GrowthProgression } from '../ext/modules/growth/components';
import { growthRuleActor } from '../ext/modules/growth/attributes';
import { markCreatureBirth } from '../ext/birth';
import type { GrowthState } from '../ext/modules/growth/state';
import type { ControlledActionRequest, ExtensionContext, Json } from '../ext/types';

const pack = loadGrowthDefinitionPack({hasText:()=>true}), skill = (suffix:string) => growthSkillDefinition(pack,`growth.skill.${suffix}`)!;
const actor: GrowthRuleActor = {id:1,level:4,attributes:Object.fromEntries(pack.config.attributes.map(a=>[a.id,0]))};
const input = {actor,target:{...actor,id:2},baseValue:5000,actionId:1,resolutionId:1,tags:[],attackKind:'melee' as const,
    damageKind:'physical' as const,direct:true,adjacent:true,rollMode:'roll-probability' as const};
const equipped = (...suffixes:string[]): GrowthSkillBuild => ({...initialGrowthSkillBuild(),learned:suffixes.map(s=>skill(s).id).sort(),
    passive:suffixes.filter(s=>skill(s).mode==='passive').map(s=>skill(s).id),active:suffixes.filter(s=>skill(s).mode==='active').map(s=>skill(s).id)});
afterEach(()=>vi.restoreAllMocks());

describe('EXT-1d generic skill definitions and P03/P07 pure state',()=> {
    it('loads exactly six active and six passive definitions without executing any query',()=> {
        const before=rng.getState(); expect(pack.definitions.filter(d=>d.kind==='skill'&&d.mode==='active')).toHaveLength(6);
        expect(pack.definitions.filter(d=>d.kind==='skill'&&d.mode==='passive')).toHaveLength(6);expect(rng.getState()).toEqual(before);
    });
    it('evaluates every passive in its declared scope and leaves learned-but-un-equipped inert',()=> {
        const empty=equipped(); empty.learned=[skill('steady-hand').id];
        expect(evaluateGrowthPort(pack,'hitChance',{...input,attackKind:'thrown'},growthSkillScopes(pack,empty))).toBe(5000);
        expect(evaluateGrowthPort(pack,'hitChance',{...input,attackKind:'thrown'},growthSkillScopes(pack,equipped('steady-hand')))).toBe(5500);
        expect(evaluateGrowthPort(pack,'hitChance',input,growthSkillScopes(pack,equipped('steady-hand')))).toBe(5000);
        expect(evaluateGrowthPort(pack,'hitChance',input,growthSkillScopes(pack,equipped('close-guard'),0,'target'))).toBe(4700);
        expect(evaluateGrowthPort(pack,'hitChance',{...input,adjacent:false},growthSkillScopes(pack,equipped('close-guard'),0,'target'))).toBe(5000);
        expect(evaluateGrowthPort(pack,'stealthRange',{...input,baseValue:10,nativeMinimum:2,invisible:false},growthSkillScopes(pack,equipped('careful-step')))).toBe(9);
        expect(evaluateGrowthPort(pack,'searchStrength',{...input,baseValue:10,mode:'manual'},growthSkillScopes(pack,equipped('methodical')))).toBe(15);
        expect(evaluateGrowthPort(pack,'searchStrength',{...input,baseValue:10,mode:'automatic'},growthSkillScopes(pack,equipped('methodical')))).toBe(10);
        expect(growthSkillScalar(pack,'focusRecoveryInterval',actor,equipped('composure'),8)).toBe(7);
        expect(evaluateGrowthPhysicalDamage(pack,{...input,baseValue:100,immune:false},growthSkillScopes(pack,equipped('weapon-familiarity')))).toBe(105);
        expect(evaluateGrowthPhysicalDamage(pack,{...input,baseValue:100,attackKind:'thrown',immune:false},growthSkillScopes(pack,equipped('weapon-familiarity')))).toBe(100);
    });
    it('checks AND prerequisites, learned duplication, and min(global, per-skill) lock severity',()=> {
        const mutable=structuredClone(data) as unknown as GrowthDefinitionPack, row=mutable.definitions.find(d=>d.id===skill('measured-strike').id) as GrowthSkill;
        row.lock={mode:'hard',professionIds:['growth.profession.guardian'],lineageIds:[],faithIds:[]};
        mutable.config.skills.lockMode='soft';const soft=parseGrowthDefinitionPack(mutable,{moduleVersion:mutable.moduleVersion,hasText:()=>true});
        expect(canLearnGrowthSkill(soft,row,actor,initialGrowthSkillBuild())).toBe(true);
        mutable.config.skills.lockMode='hard';const hard=parseGrowthDefinitionPack(mutable,{moduleVersion:mutable.moduleVersion,hasText:()=>true});
        expect(canLearnGrowthSkill(hard,row,actor,initialGrowthSkillBuild())).toBe(false);
        expect(canLearnGrowthSkill(hard,row,actor,initialGrowthSkillBuild(),{professionId:'growth.profession.guardian'})).toBe(true);
        expect(canLearnGrowthSkill(pack,skill('pressure'),actor,initialGrowthSkillBuild())).toBe(false);
        expect(canLearnGrowthSkill(pack,skill('measured-strike'),actor,equipped('measured-strike'))).toBe(false);
    });
    it('normalizes elapsed recovery credit exactly once after interval reduction and respects full/reset policies',()=> {
        const focus={current:2,remainder:7};
        expect(advanceGrowthFocus(pack,focus,8,7,0)).toEqual({current:3,remainder:0});
        expect(advanceGrowthFocus(pack,advanceGrowthFocus(pack,focus,8,7,0),8,7,0)).toEqual({current:3,remainder:0});
        expect(advanceGrowthFocus(pack,{current:7,remainder:6},8,7,4)).toEqual({current:8,remainder:0});
        const keep=structuredClone(data) as unknown as GrowthDefinitionPack;keep.config.focus.resetRemainderWhenFull=false;
        expect(advanceGrowthFocus(keep,{current:7,remainder:6},8,7,4)).toEqual({current:8,remainder:3});
        expect(focus).toEqual({current:2,remainder:7});
    });
    it('applies tagged duration before cap, intensity after magnitude clamps, cooldown before its generic port',()=> {
        const mutable=structuredClone(data) as unknown as GrowthDefinitionPack;
        const passive=mutable.definitions.find(d=>d.id===skill('composure').id) as GrowthSkill;
        const watch=mutable.definitions.find(d=>d.id==='growth.faith.watch')!;
        if(watch.kind==='skill')throw Error();passive.effects.push(...watch.oaths.flatMap(o=>o.effects));
        const lineage=mutable.definitions.find(d=>d.id==='growth.lineage.stoneborn')!;
        if(lineage.kind==='skill')throw Error();passive.effects.push(...lineage.effects);
        const custom=parseGrowthDefinitionPack(mutable,{moduleVersion:mutable.moduleVersion,hasText:()=>true}), build=equipped('composure','brace');
        const brace=growthSkillDefinition(custom,skill('brace').id)!,effect=brace.effects.find(e=>e.kind==='timed')!;
        if(effect.kind!=='timed')throw Error();
        const instance=createGrowthEffectInstance(custom,brace,effect,actor,build,4,1,1);expect(instance.expiresAt).toBe(7);build.effects=[instance];
        expect(evaluateGrowthPhysicalDamage(custom,{...input,baseValue:100,immune:false},growthSkillScopes(custom,build,4,'target'))).toBe(75);
        expect(growthSkillCooldown(custom,brace,actor,build,4)).toBe(12);
        expect(growthTaggedProperty(custom,'duration',3,effect.tags,actor,passive.effects)).toBe(4);
    });
    it('follows renamed and modified definitions without relying on any sample skill ID',()=> {
        const renamed=JSON.parse(JSON.stringify(data).split('growth.skill.careful-step').join('growth.skill.custom-movement')) as GrowthDefinitionPack;
        const row=renamed.definitions.find(d=>d.id==='growth.skill.custom-movement') as GrowthSkill;
        const effect=row.effects[0]!;if(effect.kind!=='modifier')throw Error();effect.magnitude.coefficient=-3;effect.magnitude.min=-3;effect.magnitude.max=-3;
        const custom=parseGrowthDefinitionPack(renamed,{moduleVersion:renamed.moduleVersion,hasText:()=>true});
        const build={...initialGrowthSkillBuild(),learned:[row.id],passive:[row.id]};
        expect(growthSkillScalar(custom,'stealthRange',actor,build,10)).toBe(7);
        expect(growthLearnedCost(custom,build)).toBe(row.cost);
    });
    it('rejects missing trigger combinations rather than silently accepting inert skill effects',()=> {
        for(const mode of ['active','passive'] as const) {
            const mutable=structuredClone(data) as unknown as GrowthDefinitionPack;
            const row=mutable.definitions.find(d=>d.kind==='skill'&&d.mode===mode) as GrowthSkill;
            row.effects=[structuredClone(mode==='active' ? skill('careful-step').effects[0]! : skill('brace').effects[0]!) as GrowthSkill['effects'][number]];
            expect(()=>parseGrowthDefinitionPack(mutable,{moduleVersion:mutable.moduleVersion,hasText:()=>true})).toThrow();
        }
    });
    it('accepts slot order and rejects corrupt effect deadlines, IDs, source facts and transient scopes',()=> {
        const build=equipped('survey','brace'); expect(isGrowthSkillBuild(build,pack,actor.id,0,1)).toBe(true);
        const brace=skill('brace'),effect=brace.effects[0]!;if(effect.kind!=='timed')throw Error();
        build.effects=[createGrowthEffectInstance(pack,brace,effect,actor,build,0,1,1)];
        expect(isGrowthSkillBuild(build,pack,actor.id,0,2)).toBe(true);
        for(const corrupt of [ (b:GrowthSkillBuild)=>b.active.push(b.active[0]!), (b:GrowthSkillBuild)=>{b.effects[0]!.expiresAt=100;},
            (b:GrowthSkillBuild)=>{b.effects[0]!.actionId=1;},(b:GrowthSkillBuild)=>{b.effects[0]!.remaining=0;},
            (b:GrowthSkillBuild)=>{(b.effects[0]!.source.attributes as Record<string,number>)['unknown']=1;},
            (b:GrowthSkillBuild)=>{b.effects[0]!.skillId='growth.skill.unknown';}]) {
            const copy=structuredClone(build);corrupt(copy);expect(isGrowthSkillBuild(copy,pack,actor.id,0,2)).toBe(false);
        }
    });
});

function combatHarness(zeroDamage=false, configure?: (pack:GrowthDefinitionPack)=>void) {
    const mutable=structuredClone(data) as unknown as GrowthDefinitionPack;
    mutable.config.levels.skillPoints={kind:'periodic',firstLevel:1,every:1,amount:30};
    // Equivalent NPC birth budget; template initialization no longer implicitly copies the L1 player grant.
    mutable.config.monsters.templates[0]!.unspentSkillPoints=30;
    for(const definition of mutable.definitions)if(definition.kind==='skill')definition.prerequisites=[];
    configure?.(mutable);
    const custom=parseGrowthDefinitionPack(mutable,{moduleVersion:mutable.moduleVersion,hasText:()=>true});
    const player=new Player(4,4), enemy=new Monster(5,4,(monsters as MonsterData[]).find(m=>m.id==='rat')!);
    enemy.state=MonsterState.HUNTING;enemy.defense=30;enemy.damageString='20';enemy.hp=enemy.maxHp=100;player.hp=player.maxHp=100;
    const weapon=new Item('test',')',0xffffff,ItemCategory.WEAPON);weapon.damage='20';weapon.strengthRequired=player.effectiveStrength;player.equippedWeapon=weapon;
    const identity={schema:1,version:custom.moduleVersion,fingerprint:extensionDataFingerprint(custom as never)};
    const seed=(payload:Json,context:ExtensionContext) => {
        const p=payload as {actorId:number;passive:string[];timed:string[]};const build=initialGrowthSkillBuild();
        build.learned=[...new Set([...p.passive,...p.timed])].sort();build.passive=p.passive;
        const state=context.state as unknown as GrowthState,progression=context.getComponent(p.actorId,'progression') as GrowthProgression;
        progression.skillPoints-=growthLearnedCost(custom,build);context.setComponent(p.actorId,'progression',progression);
        const source=growthRuleActor(p.actorId,progression,context.getComponent(p.actorId,'attributes') as GrowthAttributes);
        for(const id of p.timed){const s=growthSkillDefinition(custom,id)!;for(const e of s.effects)if(e.kind==='timed'&&e.duration.kind==='objective-blocks'){
            build.effects.push(createGrowthEffectInstance(custom,s,e,source,build,state.objectiveClock,1,state.nextEffectId++));}}
        context.setComponent(p.actorId,'skill-build',build as unknown as Json);context.setState(state as unknown as Json);
    };
    const registry=new ExtensionRegistry();registry.register('growth',custom.moduleVersion,()=> {
        const module=createGrowthGameplay(custom,identity);return {...module,commands:{...module.commands,'test-loadout':seed,'test-focus':(payload,context)=>context.setComponent(context.playerId,'focus',payload)}};
    },identity);
    let runtime: ExtensionRuntime;
    const ports={depth:()=>1,playerId:()=>player.id,randomInt:()=>{throw Error('No module RNG');},message:()=>undefined,
        validateAction:(request:ControlledActionRequest)=>request.actorId===player.id && (request.action==='attack' ? request.target.kind==='creature'&&request.target.id===enemy.id : request.target.kind==='self'),
        executeAction:(request:ControlledActionRequest, callbacks:{beforeCommit():void;afterResolve(outcome:{moved:boolean}):void})=> {
            runtime.emit('committedAction',{actorId:request.actorId,action:request.action});callbacks.beforeCommit();
            if(request.action==='attack')CombatSystem.attack(player,enemy,zeroDamage ? {beforeDamage:()=>0} : undefined);callbacks.afterResolve({moved:false});return true;
        }};
    runtime=new ExtensionRuntime(registry,registry.manifest(['growth']),ports);runtime.newGame();runtime.attachCreature(player);
    runtime.command(JSON.stringify({module:'growth',action:'create-character',payload:{revision:0}}));runtime.attachCreature(enemy);
    const load=(id:number,passive:string[]=[],timed:string[]=[])=>runtime.command(JSON.stringify({module:'growth',action:'test-loadout',payload:{actorId:id,
        passive:passive.map(s=>skill(s).id),timed:timed.map(s=>skill(s).id)}}));
    const build=(id:number)=>runtime.snapshot().components[id]!['growth:skill-build'] as unknown as GrowthSkillBuild;
    const command=(action:string,payload:Record<string,Json>)=>runtime.command(JSON.stringify({module:'growth',action,payload:{revision:(runtime.snapshot().modules.growth as unknown as GrowthState).revision,...payload}}));
    return {player,enemy,runtime,load,build,registry,ports,command};
}
describe('EXT-1d NPC common policies and real per-resolution commits',()=> {
    it('uses equipped NPC outgoing damage and target hit defense in real combat; pure forecasts never consume',()=> {
        const {player,enemy,runtime,load,build}=combatHarness();load(enemy.id,['weapon-familiarity','close-guard']);
        const before=runtime.snapshot(),random=rng.getState();for(let i=0;i<10;i++)CombatSystem.previewHitChance(player,enemy);
        expect(runtime.snapshot()).toEqual(before);expect(rng.getState()).toEqual(random);expect(build(enemy.id).passive).toHaveLength(2);
        const percent=vi.spyOn(rng,'randPercent').mockReturnValue(true),hit=CombatSystem.attack(enemy,player);
        expect(hit.damage).toBe(21);expect(percent).toHaveBeenCalled();
        const chance=CombatSystem.previewHitChance(player,enemy);load(player.id);expect(chance).toBeLessThan(100);
    });
    it('consumes NPC brace before shield even at zero hpLost and the next strike is unmodified',()=> {
        const {player,enemy,load,build}=combatHarness();load(enemy.id,[],['brace']);enemy.setStatusDuration('shielded',500);
        vi.spyOn(rng,'randPercent').mockReturnValue(true);const first=CombatSystem.attack(player,enemy),second=CombatSystem.attack(player,enemy);
        expect(first.damage).toBe(16);expect(second.damage).toBe(20);expect(enemy.hp).toBe(100);expect(build(enemy.id).effects).toHaveLength(0);
    });
    it('keeps NPC pressure on guarantee short-circuits but consumes the next real probability resolution',()=> {
        const {player,enemy,load,build}=combatHarness();load(enemy.id,[],['pressure']);
        player.setStatusDuration('stuck',3);vi.spyOn(rng,'randPercent').mockReturnValue(true);CombatSystem.attack(enemy,player);
        expect(build(enemy.id).effects).toHaveLength(1);player.setStatusDuration('stuck',0);CombatSystem.attack(enemy,player);
        expect(build(enemy.id).effects).toHaveLength(0);
    });
    it('persists NPC timed/passive components, reloads without reapplying, then expires from objective time',()=> {
        const {player,enemy,runtime,load,build,registry,ports}=combatHarness();load(enemy.id,['close-guard'],['brace']);
        const snapshot=runtime.snapshot();expect(()=>new ExtensionRuntime(registry,snapshot.manifest,ports,snapshot)).not.toThrow();
        runtime.emit('objectiveTime',{ticks:100,mode:'realtime',actorIds:[player.id,enemy.id]});expect(build(enemy.id).effects).toHaveLength(1);
        runtime.emit('objectiveTime',{ticks:100,mode:'realtime',actorIds:[player.id,enemy.id]});expect(build(enemy.id).effects).toHaveLength(0);
        expect(build(enemy.id).passive).toEqual([skill('close-guard').id]);
    });
});


describe('EXT-1d skill atomic commits, result facts and temporary scope',()=> {
    it('learns with exact configured costs and rejects duplicate, forged actor, stale revision and oversized slots atomically',()=> {
        const {player,runtime,build,command}=combatHarness();const point=()=> (runtime.snapshot().components[player.id]!['growth:progression'] as GrowthProgression).skillPoints;
        expect(point()).toBe(30);command('learn-skill',{skillId:skill('brace').id});expect(point()).toBe(28);expect(build(player.id).active).toEqual([]);
        const before=runtime.snapshot();
        for(const call of [()=>command('learn-skill',{skillId:skill('brace').id}),()=>command('learn-skill',{skillId:skill('survey').id,actorId:player.id}),
            ()=>command('equip-skills',{active:[skill('brace').id,skill('brace').id],passive:[]}),
            ()=>command('equip-skills',{active:[skill('survey').id],passive:[]}),()=>runtime.command(JSON.stringify({module:'growth',action:'learn-skill',payload:{revision:1,skillId:skill('survey').id}}))]) {
            expect(call).toThrow();expect(runtime.snapshot()).toEqual(before);
        }
        command('equip-skills',{active:[skill('brace').id],passive:[]});expect(build(player.id).active).toEqual([skill('brace').id]);
    });
    it('charges a legal measured miss, writes absolute per-skill cooldown, and clears action effects immediately',()=> {
        const {player,enemy,runtime,build,command}=combatHarness();command('learn-skill',{skillId:skill('measured-strike').id});
        command('equip-skills',{active:[skill('measured-strike').id],passive:[]});vi.spyOn(rng,'randPercent').mockReturnValue(false);
        command('use-skill',{skillId:skill('measured-strike').id,target:{kind:'creature',id:enemy.id}});
        expect((runtime.snapshot().components[player.id]!['growth:focus'] as {current:number}).current).toBe(6);
        expect(runtime.snapshot().components[player.id]!['growth:skills']).toEqual({readyAt:{[skill('measured-strike').id]:6}});
        expect(build(player.id).effects).toEqual([]);const before=runtime.snapshot();
        expect(()=>command('use-skill',{skillId:skill('measured-strike').id,target:{kind:'creature',id:enemy.id}})).toThrow();expect(runtime.snapshot()).toEqual(before);
        command('equip-skills',{active:[],passive:[]});command('equip-skills',{active:[skill('measured-strike').id],passive:[]});
        expect(runtime.snapshot().components[player.id]!['growth:skills']).toEqual(before.components[player.id]!['growth:skills']);
        expect(runtime.snapshot().components[player.id]!['growth:focus']).toEqual(before.components[player.id]!['growth:focus']);
    });
    it.each(['miss','shield','zero','immune','damage'] as const)('applies pressure only on actual hit AND hpLost: %s',outcome=> {
        const {player,enemy,runtime,build,command}=combatHarness(outcome==='zero');command('learn-skill',{skillId:skill('pressure').id});
        command('equip-skills',{active:[skill('pressure').id],passive:[]});
        if(outcome==='shield')enemy.setStatusDuration('shielded',500);
        if(outcome==='immune')enemy.behaviorFlags.add('MONST_IMMUNE_TO_WEAPONS');
        vi.spyOn(rng,'randPercent').mockReturnValue(outcome!=='miss');
        command('use-skill',{skillId:skill('pressure').id,target:{kind:'creature',id:enemy.id}});
        expect(build(enemy.id).effects).toHaveLength(outcome==='damage'?1:0);expect(build(player.id).effects).toEqual([]);
        expect((runtime.snapshot().components[player.id]!['growth:focus'] as {current:number}).current).toBe(5);
    });
    it('starts persistent self effect after core, then interrupts only a committed action fact, never queries',()=> {
        const {player,runtime,build,command}=combatHarness();command('learn-skill',{skillId:skill('hold-breath').id});
        command('equip-skills',{active:[skill('hold-breath').id],passive:[]});command('use-skill',{skillId:skill('hold-breath').id,target:{kind:'self'}});
        expect(build(player.id).effects).toHaveLength(1);expect(runtime.rule('stealthRange',{actorId:player.id,targetId:null,baseValue:8,nativeMinimum:2,invisible:false})).toBe(6);
        const before=runtime.snapshot();for(let i=0;i<5;i++)runtime.rule('stealthRange',{actorId:player.id,targetId:null,baseValue:8,nativeMinimum:2,invisible:false});expect(runtime.snapshot()).toEqual(before);
        runtime.emit('committedAction',{actorId:player.id,action:'wait'});expect(build(player.id).effects).toHaveLength(1);
        runtime.emit('committedAction',{actorId:player.id,action:'throw'});expect(build(player.id).effects).toHaveLength(0);
    });
});


describe('EXT-1d configurable equip and native-resource reconciliation',()=> {
    it.each([true,false])('reads equip preservation policies: preserve=%s',preserve=> {
        const {player,enemy,runtime,command}=combatHarness(false,p=>{p.config.skills.equipPreservesFocus=preserve;p.config.skills.equipPreservesCooldowns=preserve;});
        command('learn-skill',{skillId:skill('measured-strike').id});command('equip-skills',{active:[skill('measured-strike').id],passive:[]});
        vi.spyOn(rng,'randPercent').mockReturnValue(false);command('use-skill',{skillId:skill('measured-strike').id,target:{kind:'creature',id:enemy.id}});
        command('equip-skills',{active:[],passive:[]});
        expect((runtime.snapshot().components[player.id]!['growth:focus'] as {current:number}).current).toBe(preserve?6:8);
        expect(runtime.snapshot().components[player.id]!['growth:skills']).toEqual({readyAt:{[skill('measured-strike').id]:preserve?6:0}});
    });
    it('commits reduced recovery interval credit once on equip, keeping cooldowns and preserving the remaining credit on unequip',()=> {
        const {player,runtime,command}=combatHarness();command('learn-skill',{skillId:skill('composure').id});
        runtime.command(JSON.stringify({module:'growth',action:'test-focus',payload:{current:2,remainder:7}}));
        command('equip-skills',{active:[],passive:[skill('composure').id]});
        expect(runtime.snapshot().components[player.id]!['growth:focus']).toEqual({current:3,remainder:0});
        command('equip-skills',{active:[],passive:[]});expect(runtime.snapshot().components[player.id]!['growth:focus']).toEqual({current:3,remainder:0});
    });
    it('reconciles generic passive HP, strength and focus ports on equip/unequip with no implicit healing',()=> {
        const {player,runtime,command}=combatHarness(false,p=> {
            const row=p.definitions.find(d=>d.id===skill('careful-step').id) as GrowthSkill;
            row.effects=[['maxHpBonus',5],['strengthBonus',2],['focusCapacity',2]].map(([port,value])=> ({kind:'modifier',port,operation:'add',slot:null,
                magnitude:{source:{kind:'constant'},coefficient:value,divisor:1,rounding:'floor',min:value,max:value},conditions:[]})) as GrowthSkill['effects'];
        });
        const hp=player.hp,maxHp=player.maxHp,strength=player.strength;command('learn-skill',{skillId:skill('careful-step').id});
        command('equip-skills',{active:[],passive:[skill('careful-step').id]});
        expect(player.maxHp).toBe(maxHp+5);expect(player.hp).toBe(hp);expect(player.strength).toBe(strength+2);
        expect((runtime.snapshot().components[player.id]!['growth:focus'] as {current:number}).current).toBe(8);
        command('equip-skills',{active:[],passive:[]});expect(player.maxHp).toBe(maxHp);expect(player.hp).toBe(hp);expect(player.strength).toBe(strength);
    });
    it('removes timed native bonuses at absolute deadline and does not refill inactive NPC focus',()=> {
        const {player,enemy,runtime,command}=combatHarness(false,p=> {
            const row=p.definitions.find(d=>d.id===skill('brace').id) as GrowthSkill,effect=row.effects[0]!;if(effect.kind!=='timed')throw Error();
            effect.modifiers.push({kind:'modifier',port:'maxHpBonus',operation:'add',slot:null,
                magnitude:{source:{kind:'constant'},coefficient:5,divisor:1,rounding:'floor',min:5,max:5},conditions:[]});
        });
        command('learn-skill',{skillId:skill('brace').id});command('equip-skills',{active:[skill('brace').id],passive:[]});const maxHp=player.maxHp;
        command('use-skill',{skillId:skill('brace').id,target:{kind:'self'}});expect(player.maxHp).toBe(maxHp+5);
        const npcFocus=runtime.snapshot().components[enemy.id]!['growth:focus'];
        runtime.emit('objectiveTime',{ticks:200,mode:'realtime',actorIds:[player.id]});expect(player.maxHp).toBe(maxHp);
        expect(runtime.snapshot().components[enemy.id]!['growth:focus']).toEqual(npcFocus);
    });
});


describe('EXT-1d clone learned build provenance',()=> {
    it.each([false,true])('copies configured learned/equipped build only when inheritBuild=%s; no transient effects or duplicate paid points',inherit=> {
        const {player,enemy,runtime,load,build,registry,ports,command}=combatHarness(false,p=>{p.config.monsters.clone.inheritBuild=inherit;});
        command('learn-skill',{skillId:skill('brace').id});command('learn-skill',{skillId:skill('close-guard').id});
        command('equip-skills',{active:[skill('brace').id],passive:[skill('close-guard').id]});
        command('use-skill',{skillId:skill('brace').id,target:{kind:'self'}});
        const clone=new Monster(6,4,(monsters as MonsterData[]).find(m=>m.id==='rat')!);clone.hp=player.hp;clone.maxHp=player.maxHp;
        markCreatureBirth(clone,'clone',player.id);runtime.attachCreature(clone);
        expect(build(clone.id).learned).toEqual(inherit?build(player.id).learned:[]);
        expect(build(clone.id).inherited).toEqual(inherit?build(player.id).learned:[]);
        expect(build(clone.id).active).toEqual(inherit?build(player.id).active:[]);expect(build(clone.id).passive).toEqual(inherit?build(player.id).passive:[]);
        expect(build(clone.id).effects).toEqual([]);expect(runtime.snapshot().components[clone.id]!['growth:skills']).toEqual({readyAt:{}});
        expect((runtime.snapshot().components[clone.id]!['growth:progression'] as GrowthProgression).skillPoints).toBe(0);
        const snapshot=runtime.snapshot();expect(()=>new ExtensionRuntime(registry,snapshot.manifest,ports,snapshot)).not.toThrow();
        load(enemy.id);expect(growthLearnedCost(pack,build(clone.id))).toBe(0);
    });
});


describe('EXT-1d action-start target contract',()=> {
    it('applies an adjacent target-scoped action-start modifier to the requested NPC and clears it before returning',()=> {
        const {player,enemy,runtime,build,command}=combatHarness(false,p=> {
            const row=p.definitions.find(d=>d.id===skill('measured-strike').id) as GrowthSkill,effect=row.effects[0]!;if(effect.kind!=='timed')throw Error();
            effect.recipient='target';effect.conditions=[{kind:'role',value:'target'},{kind:'adjacent',value:true}];
            effect.modifiers=[{kind:'modifier',port:'receivedPhysicalDamage',operation:'add',slot:null,
                magnitude:{source:{kind:'constant'},coefficient:-2000,divisor:1,rounding:'floor',min:-2000,max:-2000},conditions:[{kind:'role',value:'target'}]}];
        });
        command('learn-skill',{skillId:skill('measured-strike').id});command('equip-skills',{active:[skill('measured-strike').id],passive:[]});
        vi.spyOn(rng,'randPercent').mockReturnValue(true);const hp=enemy.hp;
        command('use-skill',{skillId:skill('measured-strike').id,target:{kind:'creature',id:enemy.id}});
        expect(enemy.hp).toBe(hp-16);expect(build(enemy.id).effects).toEqual([]);expect(build(player.id).effects).toEqual([]);expect(runtime.readyToSave).toBe(true);
    });
});


describe('EXT-1d full focus recovery credit save invariant',()=> {
    it.each([true,false])('checks full-pool persisted credit using resetRemainderWhenFull=%s without weakening the focus substrate',reset=> {
        const {player,runtime,registry,ports}=combatHarness(false,p=>{p.config.focus.resetRemainderWhenFull=reset;});
        const snapshot=runtime.snapshot();snapshot.components[player.id]!['growth:focus']={current:8,remainder:7};
        if(reset)expect(()=>new ExtensionRuntime(registry,snapshot.manifest,ports,snapshot)).toThrow();
        else {
            const loaded=new ExtensionRuntime(registry,snapshot.manifest,ports,snapshot);
            expect(loaded.snapshot()).toEqual(snapshot);expect(loaded.snapshot().components[player.id]!['growth:focus']).toEqual({current:8,remainder:7});
        }
    });
});
