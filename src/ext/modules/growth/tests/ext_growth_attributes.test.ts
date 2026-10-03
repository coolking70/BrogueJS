import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import { markCreatureBirth } from '../../../../ext/birth';
import data from '../data/definitions.json';
import type { GrowthDefinitionPack } from '../types';
import type { GrowthAttributes, GrowthDerived, GrowthProgression } from '../components';
import type { GrowthState } from '../state';
import { createGrowthGameplay } from '../module';
import { parseGrowthDefinitionPack } from '../definitions';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { ExtensionRegistry } from '../../../../ext/registry';
import * as catalog from '../../../../ext/catalog';

const con = 'growth.attribute.constitution', str = 'growth.attribute.strength-training', will = 'growth.attribute.will';
const state = (game: Game) => game.extensionRuntime!.snapshot().modules.growth as unknown as GrowthState;
const component = <T>(game: Game,name: string,id = game.player.id) => game.extensionRuntime!.snapshot().components[id]![`growth:${name}`] as T;
function command(game: Game,action: string,payload: unknown): void { game.executeCommand('ext:command',JSON.stringify({module:'growth',action,payload})); }
function allocate(game: Game,attributes: Record<string,number>): void { command(game,'allocate',{revision:state(game).revision,attributes}); }
function respec(game: Game): void { command(game,'respec',{revision:state(game).revision}); }
function configured(change?: (pack: GrowthDefinitionPack) => void): void {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.levels.attributePoints = {kind:'periodic',firstLevel:1,every:1,amount:20};
    pack.config.levels.skillPoints = {kind:'periodic',firstLevel:1,every:1,amount:4};
    pack.config.experience.sources.firstVisits = false;
    change?.(pack);
    const parsed = parseGrowthDefinitionPack(pack,{moduleVersion:pack.moduleVersion,hasText:()=>true});
    const identity = {schema:1,version:pack.moduleVersion,fingerprint:extensionDataFingerprint(pack)};
    vi.spyOn(catalog,'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry(); registry.register('growth',pack.moduleVersion,()=>createGrowthGameplay(parsed,identity),identity); return registry;
    });
}
function game(): Game {
    const result = createHeadlessGame(6721,'test'); result.startNewGame({seed:6721,mode:'test',ruleSet:'extended'});
    command(result,'create-character',{revision:0}); return result;
}
afterEach(() => vi.restoreAllMocks());

describe('EXT-1b configured attributes and atomic commands',() => {
    it('allocates through the recorded command, spends configured prices once, preserves wounds and both RNG streams',() => {
        configured(); const g = game(), maximum = g.player.maxHp, strength = g.player.strength;
        g.player.hp -= 7;
        const hp = g.player.hp, random = rng.getState(), tick = timeSystem.currentTick;
        allocate(g,{[con]:2,[str]:1,[will]:2});
        expect(g.player.maxHp).toBe(maximum+6); expect(g.player.hp).toBe(hp); expect(g.player.strength).toBe(strength+1);
        expect(component<GrowthProgression>(g,'progression').attributePoints).toBe(13);
        expect(component<GrowthDerived>(g,'derived')).toEqual({appliedStrength:1,appliedMaxHp:6});
        expect(component<{current:number}>(g,'focus').current).toBe(8);
        expect(timeSystem.currentTick).toBe(tick); expect(rng.getState()).toEqual(random);
        expect(g.recordedInputEvents.map(event=>event.action)).toEqual(['ext:command','ext:command']);
        const saved = g.toSaveSnapshot(), loaded = createHeadlessGame(9,'test');
        expect(loaded.loadSnapshot(saved)).toBe(true); expect(loaded.player.maxHp).toBe(g.player.maxHp);
        expect(loaded.player.strength).toBe(g.player.strength); expect(loaded.player.hp).toBe(hp);
        expect(loaded.extensionRuntime!.snapshot()).toEqual(saved.extensions);
        expect(loaded.loadSnapshot(saved)).toBe(true); expect(loaded.player.maxHp).toBe(maximum+6);
    });
    it.each([
        ['unknown attribute',{unknown:1}],['negative',{[con]:-1}],['fraction',{[con]:0.5}],
        ['over cap',{[con]:9}],['over budget',{[str]:4,[con]:8,[will]:1}],['empty',{}],
    ])('rejects %s with no spending, recording, time, or randomness',(_name,attributes) => {
        configured(); const g=game(), snapshot=g.extensionRuntime!.snapshot(), random=rng.getState(), tick=timeSystem.currentTick;
        allocate(g,attributes as Record<string,number>);
        expect(g.extensionRuntime!.snapshot()).toEqual(snapshot); expect(g.recordedInputEvents).toHaveLength(1);
        expect(timeSystem.currentTick).toBe(tick); expect(rng.getState()).toEqual(random);
    });
    it('rejects stale revision, actor forgery, learning and commands while a native modal is pending',() => {
        configured(); const g=game(); allocate(g,{[con]:1});
        const snapshot=g.extensionRuntime!.snapshot();
        command(g,'allocate',{revision:1,attributes:{[con]:1}});
        command(g,'allocate',{revision:state(g).revision,attributes:{[con]:1},actorId:g.player.id});
        command(g,'allocate',{revision:state(g).revision,attributes:{[con]:1},learn:[]});
        g.pendingIdentify = true;
        allocate(g,{[con]:1}); g.pendingIdentify=false;
        expect(g.extensionRuntime!.snapshot()).toEqual(snapshot); expect(g.recordedInputEvents).toHaveLength(2);
    });
    it('uses configurable attributes, coefficients, total cap and training enablement',() => {
        configured(pack => {
            pack.config.attributeTotalCap=2; pack.config.strengthTraining.enabled=false;
            const attribute=pack.config.attributes.find(attribute=>attribute.id===con)!;
            attribute.effects[0]!.magnitude.coefficient=5;
        });
        const g=game(), maximum=g.player.maxHp;
        allocate(g,{[str]:1}); expect(component<GrowthProgression>(g,'progression').attributePoints).toBe(20);
        allocate(g,{[con]:2}); expect(g.player.maxHp).toBe(maximum+10);
        const snapshot=g.extensionRuntime!.snapshot(); allocate(g,{[will]:1}); expect(g.extensionRuntime!.snapshot()).toEqual(snapshot);
    });
    it('enforces a training cap lower than its general attribute cap without losing points',() => {
        configured(pack=>{pack.config.strengthTraining.cap=1;});const g=game();
        allocate(g,{[str]:2});expect(component<GrowthProgression>(g,'progression').attributePoints).toBe(20);
        allocate(g,{[str]:1});expect(component<GrowthProgression>(g,'progression').attributePoints).toBe(17);
        const snapshot=g.extensionRuntime!.snapshot();allocate(g,{[str]:1});expect(g.extensionRuntime!.snapshot()).toEqual(snapshot);
    });
    it.each(['gold','attribute-points','skill-points','focus'] as const)('atomically respecs with a %s cost and partial refund',resource => {
        configured(pack=>{pack.config.respec={enabled:true,cost:{resource,amount:2},refundBasisPoints:5000,clearCooldowns:false};});
        const g=game(), maximum=g.player.maxHp, strength=g.player.strength;
        g.stats.gold=5; allocate(g,{[con]:2,[str]:1});
        g.player.hp=maximum+2;
        const random=rng.getState(); respec(g);
        expect(g.player.maxHp).toBe(maximum); expect(g.player.hp).toBe(maximum); expect(g.player.strength).toBe(strength);
        const progression=component<GrowthProgression>(g,'progression');
        expect(progression.attributePoints).toBe(resource==='attribute-points'?15:17);
        expect(progression.skillPoints).toBe(resource==='skill-points'?2:4);
        expect(g.stats.gold).toBe(resource==='gold'?3:5);
        expect(component<{current:number}>(g,'focus').current).toBe(resource==='focus'?6:8);
        expect(rng.getState()).toEqual(random); expect(g.toSaveSnapshot().extensions).toEqual(g.extensionRuntime!.snapshot());
    });
    it('rejects disabled or unaffordable respec without partial native or component writes',() => {
        configured(pack=>{pack.config.respec={enabled:true,cost:{resource:'gold',amount:100},refundBasisPoints:10000,clearCooldowns:false};});
        const g=game(); allocate(g,{[con]:2,[str]:1}); const saved=g.toSaveSnapshot(), before=state(g).revision;
        respec(g); expect(state(g).revision).toBe(before); expect(g.extensionRuntime!.snapshot()).toEqual(saved.extensions);
        expect(g.player.maxHp).toBe(saved.player.maxHp); expect(g.player.strength).toBe(saved.player.strength);
    });
    it('rejects forged point budgets, attributes and derived delta before retiring the live run',() => {
        configured(); const g=game(); allocate(g,{[con]:2}); const saved=g.toSaveSnapshot(), player=g.player,runtime=g.extensionRuntime;
        for(const mutate of [
            (bad:typeof saved)=>{(bad.extensions!.components[g.player.id]!['growth:progression'] as GrowthProgression).attributePoints++;},
            (bad:typeof saved)=>{(bad.extensions!.components[g.player.id]!['growth:attributes'] as GrowthAttributes).values[con]!++;},
            (bad:typeof saved)=>{(bad.extensions!.components[g.player.id]!['growth:derived'] as GrowthDerived).appliedMaxHp++;},
        ]) {const bad=structuredClone(saved);mutate(bad);expect(g.loadSnapshot(bad)).toBe(false);expect(g.player).toBe(player);expect(g.extensionRuntime).toBe(runtime);}
    });
    it('replays allocation and respec through seek and save/load continuation without drift',() => {
        configured(pack=>{pack.config.respec.enabled=true;}); const g=game();
        allocate(g,{[con]:2,[str]:1});respec(g);allocate(g,{[will]:2});
        const saved=g.toSaveSnapshot(),recording=g.exportRecording(), replay=createHeadlessGame(23,'test');
        expect(replay.loadReplay(recording)).toBe(true);
        while(replay.replayCursor<recording.events.length&&!replay.replayError)replay.replayStep(true);
        expect(replay.replayError).toBeNull();expect(replay.extensionRuntime!.snapshot()).toEqual(saved.extensions);
        replay.replaySeek(1);while(replay.replayCursor<recording.events.length&&!replay.replayError)replay.replayStep(true);
        expect(replay.replayError).toBeNull();expect(replay.extensionRuntime!.snapshot()).toEqual(saved.extensions);
        const loaded=createHeadlessGame(24,'test');expect(loaded.loadSnapshot(saved)).toBe(true);allocate(loaded,{[con]:1});
        expect(loaded.hasCompleteRecording).toBe(true);expect(loaded.player.maxHp).toBe(g.player.maxHp+3);
    });
    it('clones inherit attribute combat build but retain level-one experience, no unspent points and a fresh item ledger',() => {
        configured(pack=>{pack.config.attributes.find(attribute=>attribute.id===con)!.initial=2;});
        const g=game(), species=(monsters as MonsterData[]).find(monster=>monster.id==='goblin')!;
        const monster=new Monster(g.player.x+3,g.player.y,species);markCreatureBirth(monster,'natural');g.monsters.push(monster);
        const clone=g.cloneMonster(monster)!;expect(clone).not.toBeNull();
        expect(component<GrowthAttributes>(g,'attributes',clone.id).values[con]).toBe(2);
        expect(component<GrowthProgression>(g,'progression',clone.id)).toEqual({level:1,experience:0,attributePoints:0,skillPoints:0});
        expect(component<GrowthDerived>(g,'derived',clone.id).appliedMaxHp).toBe(6);
        expect(clone.maxHp).toBe(species.hp+6);expect(component(g,'items',clone.id)).toEqual({awarded:{}});
    });
    it.each([false,true])('configured clone progression accounts for withheld birth grants and inherited points=%s',inheritUnspentPoints => {
        configured(pack=>{pack.config.monsters.clone.progression=true;pack.config.monsters.clone.inheritUnspentPoints=inheritUnspentPoints;
            // 1e complete template birth balances replace the former implicit NPC L1 grants (20 / 4).
            pack.config.monsters.templates[0]!.unspentAttributePoints=20;pack.config.monsters.templates[0]!.unspentSkillPoints=4;
            pack.config.levels.experience={kind:'curve',base:1,linear:0,quadratic:0};});
        const g=game(), species=(monsters as MonsterData[]).find(monster=>monster.id==='goblin')!;
        const source=new Monster(g.player.x+3,g.player.y,species);markCreatureBirth(source,'natural');g.monsters.push(source);
        const clone=g.cloneMonster(source)!;
        expect(component<GrowthProgression>(g,'progression',clone.id).attributePoints).toBe(inheritUnspentPoints?20:0);
        const target=new Monster(g.player.x+5,g.player.y,(monsters as MonsterData[]).find(monster=>monster.id==='rat')!);
        markCreatureBirth(target,'natural');g.monsters.push(target);
        const runtime=g.extensionRuntime!,origin=runtime.causality.create('melee',clone.id,clone.id,clone.extensionHooks!.partyId(clone));
        runtime.causality.withOrigin(origin,()=>g.killMonster(target));
        g.executeCommand('growth-fixture-settle',undefined,()=>undefined);
        const progression=component<GrowthProgression>(g,'progression',clone.id);
        expect(progression.level).toBeGreaterThan(1);
        expect(progression.attributePoints).toBe((progression.level-1)*20+(inheritUnspentPoints?20:0));
        const saved=g.toSaveSnapshot(),loaded=createHeadlessGame(45,'test');expect(loaded.loadSnapshot(saved)).toBe(true);
        expect(loaded.extensionRuntime!.snapshot()).toEqual(saved.extensions);
    });
    it('respec preserves configured initial ranks and clone inheritance records the actual source balance',() => {
        configured(pack=>{pack.config.attributes.find(attribute=>attribute.id===con)!.initial=2;
            pack.config.respec.enabled=true;pack.config.monsters.clone.inheritUnspentPoints=true;});
        const g=game(), initial=g.player.maxHp;allocate(g,{[con]:1,[str]:1});
        const sourcePoints=component<GrowthProgression>(g,'progression').attributePoints;
        expect(sourcePoints).toBe(16);
        const clone=g.cloneMonster(g.player,undefined,{creationReason:'summoned',initiallyAllied:true})!;
        expect(component<GrowthProgression>(g,'progression',clone.id).attributePoints).toBe(sourcePoints);
        expect(component<GrowthAttributes>(g,'attributes',clone.id).inheritedAttributePoints).toBe(sourcePoints);
        respec(g);expect(g.player.maxHp).toBe(initial);expect(component<GrowthAttributes>(g,'attributes').values[con]).toBe(2);
        const saved=g.toSaveSnapshot(),loaded=createHeadlessGame(46,'test');expect(loaded.loadSnapshot(saved)).toBe(true);
        expect(loaded.extensionRuntime!.snapshot()).toEqual(saved.extensions);
    });
});
