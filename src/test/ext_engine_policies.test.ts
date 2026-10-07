import type { StatModifierRow, StatSourceProvider } from '../ext/stats';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateMonsterDetail } from '../engine/UI/DetailGenerator';
import { CombatSystem } from '../engine/Combat/Combat';
import { rng } from '../engine/Random';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import { Player } from '../entities/Player';
import { Item, ItemCategory } from '../engine/Items/Item';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import type { ExtensionModule, Json } from '../ext/types';
import monsters from '../data/monsters.json';
import mutations from '../data/mutations.json';
import { createHeadlessGame } from './harness';
import * as catalog from '../ext/catalog';

afterEach(() => vi.restoreAllMocks());
function monster(id = 'rat'): Monster {
    const actor = new Monster(5, 4, (monsters as MonsterData[]).find(row => row.id === id)!);
    actor.state = MonsterState.HUNTING; actor.hp = actor.maxHp = 100;
    return actor;
}
const flat=(stat:string,value:number,category:StatModifierRow['category']='flat'):StatModifierRow=>({stat,value,category,layer:'temporary',sourceKind:'fixture',sourceId:`policy-test.${stat}`});
function factory(statSources:StatSourceProvider={collect:()=>[]},extra:Partial<ExtensionModule>={}):ExtensionModule{return {id:'policy-test',version:'1.0.0',initialState:()=>({}),validateState:(v):v is Json=>!!v&&typeof v==='object',statSources,...extra};}
function runtime(player:Player,provider:StatSourceProvider={collect:()=>[]},extra:Partial<ExtensionModule>={}):ExtensionRuntime {
 for(const item of [player.equippedWeapon,player.equippedArmor,player.ringLeft,player.ringRight])if(item&&!player.inventory.items.includes(item))player.inventory.items.push(item);
 const registry=new ExtensionRegistry();registry.register('policy-test','1.0.0',()=>factory(provider,extra));
 const result=new ExtensionRuntime(registry,registry.manifest(['policy-test']),{depth:()=>1,playerId:()=>player.id,randomInt:()=>{throw Error('Unexpected source RNG');},message:()=>undefined});result.attachCreature(player);return result;
}
function weapon(damage = '10'): Item {
    const item = new Item('test', ')', 0xffffff, ItemCategory.WEAPON);
    item.damage = damage; item.strengthRequired = 12; return item;
}
describe('foundation production stat source consumers',()=>{
 it('combines physical sources after native roll and before shield with frozen facts',()=>{
  const player=new Player(4,4),target=monster();player.equippedWeapon=weapon('10');
  const ext=runtime(player,{collect(actor,context){expect(Object.isFrozen(context)).toBe(true);expect(Object.isFrozen(context.facts)).toBe(true);expect('randomInt' in context).toBe(false);return actor.player?[flat('native.physical-damage-dealt',-1000,'increased')]:[];}});ext.attachCreature(target);target.setStatusDuration('shielded',50);vi.spyOn(rng,'randPercent').mockReturnValue(true);
  const result=CombatSystem.attack(player,target);expect(result.damage).toBe(9);expect(target.hp).toBe(96);
 });
 it('preserves skipped and rolled guarantees at native RNG positions',()=>{
  const player=new Player(4,4),target=monster();player.equippedWeapon=weapon();const ext=runtime(player,{collect:()=>[flat('native.hit-chance',5000,'override')]});ext.attachCreature(target);
  const percent=vi.spyOn(rng,'randPercent').mockReturnValue(true);target.setStatusDuration('stuck',5);CombatSystem.attack(player,target);expect(percent).not.toHaveBeenCalled();
  target.setStatusDuration('stuck',0);target.seized=player.seizing=true;target.hp=100;CombatSystem.attack(player,target);expect(percent.mock.calls).toEqual([[100]]);
 });
 it('preserves thrown slaying guarantees and stuck-target skipped rolls',()=>{
  const player=new Player(4,4),target=monster(),missile=weapon();missile.runicType='slaying';missile.vorpalEnemy='animal';target.hp=1;
  const ext=runtime(player);ext.attachCreature(target);const percent=vi.spyOn(rng,'randPercent').mockReturnValue(true);CombatSystem.resolveThrownWeapon(player,target,missile);expect(percent.mock.calls).toEqual([[100]]);
  target.hp=100;target.setStatusDuration('stuck',3);percent.mockClear();CombatSystem.resolveThrownWeapon(player,target,weapon());expect(percent).not.toHaveBeenCalled();
 });
 it('truncates basis points only at the native percent-roll boundary for melee and thrown',()=>{
  const player=new Player(4,4),target=monster();player.equippedWeapon=weapon();target.defense=30;
  const ext=runtime(player,{collect:actor=>actor.player?[flat('native.hit-chance',6549,'override')]:[]});ext.attachCreature(target);const percent=vi.spyOn(rng,'randPercent').mockReturnValue(false);
  CombatSystem.attack(player,target);CombatSystem.resolveThrownWeapon(player,target,weapon());expect(percent.mock.calls).toEqual([[65],[65]]);
 });
 it('keeps poison duration and direct elemental damage outside the physical pair',()=>{
  const player=new Player(4,4),snake=monster('pink_jelly');snake.damageString='10';snake.abilityFlags.add('MA_POISONS');
  const ext=runtime(player,{collect:actor=>actor.player?[]:[flat('native.physical-damage-dealt',10000,'increased')]});ext.attachCreature(snake);vi.spyOn(rng,'randPercent').mockReturnValue(true);CombatSystem.attack(snake,player);expect(player.getStatusDuration('poisoned')).toBe(10);
  const before=player.hp;player.takeDamage(2,true,undefined,undefined,'fire');player.takeDamage(2,true,undefined,undefined,'poison');expect(player.hp).toBe(before-4);
 });
 it('rejects async, nonfinite and mutating providers deterministically',()=>{
  for(const collect of [()=>Promise.resolve([]),()=>[flat('native.search-strength',NaN)],(_a:unknown,c:unknown)=>{(c as {state:{changed:boolean}}).state.changed=true;return [];}])expect(()=>runtime(new Player(4,4),{collect:collect as never}).stats.value(1,'native.search-strength')).toThrow();
 });
 it('shares pure hit forecasts with actual resolution and preserves guarantees',()=>{
  const player=new Player(4,4),target=monster();player.equippedWeapon=weapon();target.defense=30;const ext=runtime(player,{collect:actor=>actor.player?[flat('native.hit-chance',6549,'override')]:[]});ext.attachCreature(target);
  const before=rng.getState(),snapshot=ext.snapshot();const detail=()=>generateMonsterDetail(target,player.hp,player.effectiveStrength,0,[10,10],0,12,0,0,0,false,0,false,direction=>direction==='outgoing'?CombatSystem.previewHitChance(player,target):CombatSystem.previewHitChance(target,player));
  expect(JSON.stringify(detail())).toContain('65%');expect(detail()).toEqual(detail());expect(rng.getState()).toEqual(before);expect(ext.snapshot()).toEqual(snapshot);const percent=vi.spyOn(rng,'randPercent').mockReturnValue(false);CombatSystem.attack(player,target);expect(percent).toHaveBeenCalledWith(65);target.state=MonsterState.ASLEEP;expect(CombatSystem.previewHitChance(player,target)).toBe(100);percent.mockClear();CombatSystem.attack(player,target);expect(percent).not.toHaveBeenCalled();
 });
 it('rolls back module, ledger and character resources when a later settlement hook fails',()=>{
  const player=new Player(4,4),registry=new ExtensionRegistry();let gold=20;
  registry.register('a','1.0.0',()=>({...factory(),id:'a',resourceCommits:true,hooks:{simulationSettled(_e,ctx){const old=ctx.characterResources(player.id);ctx.commitCharacterResources(player.id,{expectedStrength:old.strength,strength:old.strength!+2,expectedGold:old.gold,gold:old.gold!-7});ctx.setState({changed:true});}}}));
  registry.register('b','1.0.0',()=>({...factory(),id:'b',hooks:{simulationSettled(){throw Error('later failure');}}}));const ext=new ExtensionRuntime(registry,registry.manifest(['a','b']),{depth:()=>1,playerId:()=>player.id,randomInt:()=>0,message:()=>undefined,gold:()=>gold,setGold:v=>{gold=v;}});ext.attachCreature(player);const before=ext.snapshot(),strength=player.strength;
  expect(()=>ext.settle([player])).toThrow('later failure');expect(ext.snapshot()).toEqual(before);expect(player.strength).toBe(strength);expect(gold).toBe(20);
 });
 it('rejects a bad second resource proposal and restores every first write',()=>{
  const player=new Player(4,4),hp=player.hp,maximum=player.maxHp,strength=player.strength;
  const ext=runtime(player,undefined,{resourceCommits:true,commands:{fail(_payload,ctx){ctx.setState({changed:true});ctx.setComponent(player.id,'probe',{changed:true});const old=ctx.characterResources(player.id);ctx.commitCharacterResources(player.id,{expectedStrength:old.strength,strength:old.strength!+1,expectedGold:old.gold,gold:old.gold});ctx.commitResources(player.id,{expectedHp:hp,expectedMaxHp:maximum,hp,maxHp:maximum+3});ctx.commitResources(player.id,{expectedHp:-1,expectedMaxHp:maximum+3,hp,maxHp:maximum+4});}}});const before=ext.snapshot();expect(()=>ext.command(JSON.stringify({module:'policy-test',action:'fail',payload:null}))).toThrow('Invalid extension resource commit');expect(ext.snapshot()).toEqual(before);expect([player.hp,player.maxHp,player.strength]).toEqual([hp,maximum,strength]);
 });
 it('rejects equal-priority overrides from two owners before actor publication',()=>{
  const registry=new ExtensionRegistry();for(const id of ['a','b'])registry.register(id,'1.0.0',()=>({...factory({collect:()=>[{...flat('native.hit-chance',5000,'override'),sourceId:`${id}.hit`}]}),id}));const ext=new ExtensionRuntime(registry,registry.manifest(['a','b']),{depth:()=>1,playerId:()=>1,randomInt:()=>0,message:()=>undefined});expect(()=>ext.attachCreature(new Player(4,4))).toThrow();
 });
});

describe('EXT-1b native maximum transformation boundaries', () => {
    function built() {
        const player = new Player(4, 4), actor = monster(); actor.maxHp = 100; actor.hp = 100;
        const ext=runtime(player,{collect:()=>[flat('native.max-hp',7)]});
        ext.attachCreature(actor); return { actor, ext };
    }
    it('empower preserves one growth bonus and heals only native transformed HP', () => {
        const { actor } = built(); actor.hp = 50;
        expect(actor.empower()).toBe(true); expect(actor.maxHp).toBe(119); expect(actor.hp).toBe(112);
        actor.empower(); expect(actor.maxHp).toBe(131); expect(actor.hp).toBe(124);
    });
    it('mutation multiplies native maximum only and reapplies the same bonus once', () => {
        const { actor } = built(); const mutation = { ...mutations[0]!, healthFactor: 2 };
        actor.mutate(mutation); expect(actor.maxHp).toBe(207); expect(actor.hp).toBe(200);
    });
    it('polymorph uses the exact native HP transform and random stream before one bonus reapplication', () => {
        const { actor } = built(), native = monster(); actor.hp = native.hp = 40;
        const state = rng.getState(); native.polymorph(() => undefined); const after = rng.getState();
        rng.setState(state); actor.polymorph(() => undefined);
        expect(actor.typeId).toBe(native.typeId); expect(actor.maxHp).toBe(native.maxHp + 7);
        expect(actor.hp).toBe(native.hp); expect(rng.getState()).toEqual(after);
    });
    it.each([0, 7])('preserves native overhealth through polymorph with %i growth maximum', bonus => {
        const player = new Player(4, 4), actor = monster(), native = monster();
        actor.hp = 120 + bonus; actor.maxHp = 100 + bonus; native.hp = 120;
        actor.maxHp=100;const ext=runtime(player,{collect:()=>bonus?[flat('native.max-hp',bonus)]:[]});ext.attachCreature(actor);
        const state = rng.getState(); native.polymorph(() => undefined); const after = rng.getState();
        rng.setState(state); actor.polymorph(() => undefined);
        expect(actor.hp).toBe(native.hp); expect(actor.maxHp).toBe(native.maxHp + bonus); expect(rng.getState()).toEqual(after);
    });
    it('retains the accepted extended restored-form health cap independently of polymorph overhealth', () => {
        const { actor } = built(); actor.hp = 120;
        const form = (monsters as MonsterData[]).find(row => row.id === 'vampire')!;
        actor.restoreSummonerForm(form); expect(actor.maxHp).toBe(form.hp + 7); expect(actor.hp).toBe(actor.maxHp);
    });
    it('summoner restoration reapplies once and never grants extra current HP', () => {
        const { actor } = built(); actor.hp = 15;
        const form = (monsters as MonsterData[]).find(row => row.id === 'vampire')!;
        actor.restoreSummonerForm(form); expect(actor.maxHp).toBe(form.hp + 7); expect(actor.hp).toBe(15);
    });
});

describe('Game stat assembly',()=>{
 it('rejects an impossible native strength base before retiring the live world',()=>{
  const registry=new ExtensionRegistry();registry.register('policy-test','1.0.0',()=>factory({collect:()=>[flat('native.strength',5)]}));vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(registry);
  const game=createHeadlessGame(9304,'test');game.startNewGame({seed:9304,mode:'test',ruleSet:'extended',extensions:['policy-test']});const forged=game.toSnapshot();forged.player.strength=5;const player=game.player,runtime=game.extensionRuntime,before=rng.getState();expect(game.loadSnapshot(forged)).toBe(false);expect(game.player).toBe(player);expect(game.extensionRuntime).toBe(runtime);expect(rng.getState()).toEqual(before);
 });
 it('rebinds sources on load and retires them on classic restart',()=>{
  const registry=new ExtensionRegistry();registry.register('policy-test','1.0.0',()=>factory({collect:()=>[flat('native.search-strength',16),flat('native.stealth-range',-2)]}));vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(registry);const game=createHeadlessGame(9302,'test'),classic=game.toSnapshot();game.startNewGame({seed:9302,mode:'test',ruleSet:'extended',extensions:['policy-test']});const snapshot=game.toSnapshot(),other=createHeadlessGame(9303,'test');expect(other.loadSnapshot(snapshot)).toBe(true);expect(other.extensionRuntime!.stats.value(other.player.id,'native.search-strength',{baseValue:30,mode:'automatic'})).toBe(46);expect(other.loadSnapshot(classic)).toBe(true);expect(other.extensionRuntime).toBeNull();
 });
});
