import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { Game } from '../engine/Core/Game';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { rng } from '../engine/Random';
import { markCreatureBirth } from '../ext/birth';
import type { GrowthState } from '../ext/modules/growth/state';
import type { GrowthProgression } from '../ext/modules/growth/components';
import data from '../ext/modules/growth/definitions.json';
import type { GrowthDefinitionPack } from '../ext/modules/growth/types';
import { createGrowthGameplay, splitGrowthReward } from '../ext/modules/growth/module';
import { parseGrowthDefinitionPack } from '../ext/modules/growth/definitions';
import { extensionDataFingerprint } from '../ext/fingerprint';
import { ExtensionRegistry } from '../ext/registry';
import * as catalog from '../ext/catalog';

const create = (game: Game) => game.executeCommand('ext:command',JSON.stringify({module:'growth',action:'create-character',payload:{revision:0}}));
function game(seed = 4801, mode: 'test'|'normal' = 'test'): Game {
    const game = createHeadlessGame(seed,'test'); game.startNewGame({seed,mode,ruleSet:'extended'}); return game;
}
const state = (game: Game) => game.extensionRuntime!.snapshot().modules.growth as unknown as GrowthState;
const progression = (game: Game,id = game.player.id) => game.extensionRuntime!.snapshot().components[id]!['growth:progression'] as GrowthProgression;
function victim(game: Game, reason: Parameters<typeof markCreatureBirth>[1] = 'natural', species='rat'): Monster {
    const target = new Monster(game.player.x+2,game.player.y,(monsters as MonsterData[]).find(monster => monster.id===species)!);
    markCreatureBirth(target,reason); game.monsters.push(target); return target;
}
function kill(game: Game,target: Monster,source = game.player,administrative = false): void {
    const runtime = game.extensionRuntime!, origin = runtime.causality.create('melee',source.id,source.id,source.extensionHooks?.partyId(source)??null);
    runtime.causality.withOrigin(origin,() => game.killMonster(target,administrative));
}
function flush(game: Game): void { game.executeCommand('growth-test-checkpoint',undefined,() => undefined); }
function configured(change: (pack: GrowthDefinitionPack)=>void): void {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack; change(pack);
    const validated = parseGrowthDefinitionPack(pack,{moduleVersion:pack.moduleVersion,hasText:()=>true});
    const identity = {schema:1,version:pack.moduleVersion,fingerprint:extensionDataFingerprint(pack)};
    vi.spyOn(catalog,'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry(); registry.register('growth',pack.moduleVersion,()=>createGrowthGameplay(validated,identity),identity); return registry;
    });
}
afterEach(() => vi.restoreAllMocks());

describe('EXT-1a creation, XP and durable contracts',() => {
    it('defaults to growth and requires a real neutral creation command before action or durable save',() => {
        const g = game(), before = rng.getState();
        expect(g.extensionRuntime!.manifest.modules.map(module=>module.id)).toEqual(['growth']);
        expect(state(g).created).toBe(false); expect(()=>g.toSaveSnapshot()).toThrow();
        const player = {...g.player.loc}; g.executeCommand('wait');
        expect(g.recordedInputEvents).toHaveLength(0); expect(g.player.loc).toEqual(player); expect(rng.getState()).toEqual(before);
        create(g); expect(state(g).created).toBe(true); expect(progression(g).level).toBe(1); expect(rng.getState()).toEqual(before);
        expect(g.recordedInputEvents.map(event=>event.action)).toEqual(['ext:command']);
        const snapshot = g.extensionRuntime!.snapshot(); create(g);
        expect(g.extensionRuntime!.snapshot()).toEqual(snapshot); expect(g.recordedInputEvents).toHaveLength(1);
        expect(()=>g.toSaveSnapshot()).not.toThrow();
    });
    it('explicit example still starts, saves, loads and replays while classic never constructs an extension',() => {
        const g=createHeadlessGame(4901,'test');
        g.startNewGame({seed:4901,mode:'test',ruleSet:'extended',extensions:['example']});g.executeCommand('wait');
        expect(g.extensionRuntime!.manifest.modules.map(module=>module.id)).toEqual(['example']);
        const saved=g.toSaveSnapshot(),recording=g.exportRecording();
        const restored=createHeadlessGame(4902,'test');expect(restored.loadSnapshot(saved)).toBe(true);expect(restored.extensionRuntime!.snapshot()).toEqual(saved.extensions);
        expect(restored.loadReplay(recording)).toBe(true);restored.replayStep(true);expect(restored.replayError).toBeNull();
        expect(restored.extensionRuntime!.snapshot()).toEqual(saved.extensions);
        const factory=vi.spyOn(catalog,'createExtensionRegistry');const classic=createHeadlessGame(4903,'test');classic.executeCommand('wait');
        expect(factory).not.toHaveBeenCalled();expect(classic.extensionRuntime).toBeNull();expect(classic.toSnapshot().extensions).toBeUndefined();
    });
    it('reads configurable kill switches, creation eligibility, fixed quote override and ally fraction',() => {
        configured(pack=>{pack.config.experience.sources.identification=false;pack.config.experience.sources.firstVisits=false;
            pack.config.experience.kills.eligibleCreationReasons=['summoned'];pack.config.experience.kills.monsterQuotes.find(quote=>quote.monsterId==='rat')!.amount=37;
            pack.config.experience.allySplit.playerBasisPoints=2500;pack.config.experience.allySplit.rounding='ceil';});
        const g=game();create(g);const ally=victim(g,'scripted');g.becomeAllyWith(ally);kill(g,victim(g,'natural'),ally as never);flush(g);
        expect(progression(g).experience).toBe(0);kill(g,victim(g,'summoned'),ally as never);flush(g);
        expect(progression(g).experience).toBe(10);expect(progression(g,ally.id).experience).toBe(27);
        vi.restoreAllMocks();configured(pack=>{pack.config.experience.sources.kills=false;});const off=game();create(off);const target=victim(off);kill(off,target);flush(off);
        expect(progression(off).experience).toBe(0);expect(state(off).rewardReceipts).toContain(`birth:${target.id}`);
    });
    it('rejects invalid revision/extra actor fields without mutation or recorder loss',() => {
        const g=game(), before=g.extensionRuntime!.snapshot();
        for (const payload of [{revision:1},{revision:0,actorId:g.player.id},{},null])
            g.executeCommand('ext:command',JSON.stringify({module:'growth',action:'create-character',payload}));
        expect(g.extensionRuntime!.snapshot()).toEqual(before); expect(g.recordedInputEvents).toHaveLength(0);
        create(g); expect(g.hasCompleteRecording).toBe(true);
    });
    it('queues true causal death until the safe command boundary, pays fixed birth quote once',() => {
        const g=game(); create(g); const rat=victim(g); const before=progression(g).experience;
        const quote=(g.extensionRuntime!.snapshot().components[rat.id]!['growth:reward'] as {amount:number}).amount;
        rat.maxHp=900; kill(g,rat); expect(progression(g).experience).toBe(before);
        flush(g); expect(progression(g).experience).toBe(before+quote); expect(state(g).rewardReceipts).toContain(`birth:${rat.id}`);
        rat.deathProcessed=false; rat.hp=10; kill(g,rat); flush(g); expect(progression(g).experience).toBe(before+quote);
    });
    it('never rewards natural unowned damage, administrative removal or default excluded births',() => {
        const g=game(); create(g); const before=progression(g).experience;
        const natural=victim(g); g.extensionRuntime!.causality.withOrigin(null,()=>g.killMonster(natural));
        kill(g,victim(g),g.player,true);
        for (const reason of ['summoned','split','clone','periodic','scripted','test'] as const) kill(g,victim(g,reason));
        flush(g); expect(progression(g).experience).toBe(before);
    });
    it('uses birth type quote through transformation and denies targets converted to allies',() => {
        const g=game(); create(g); const original=victim(g), converted=victim(g);
        const quote=(g.extensionRuntime!.snapshot().components[original.id]!['growth:reward'] as {amount:number}).amount;
        original.typeId='dragon'; g.becomeAllyWith(converted);
        kill(g,original); kill(g,converted); flush(g); expect(progression(g).experience).toBe(quote);
    });
    it('splits allied lethal responsibility exactly and invalidates old relation after unally/really',() => {
        const g=game(); create(g); const ally=victim(g,'summoned'); g.becomeAllyWith(ally);
        const target=victim(g), quote=(g.extensionRuntime!.snapshot().components[target.id]!['growth:reward'] as {amount:number}).amount;
        kill(g,target,ally as never); flush(g);
        const [playerPart,allyPart]=splitGrowthReward(quote,8000,'floor');
        expect(progression(g).experience).toBe(playerPart); expect(progression(g,ally.id).experience).toBe(allyPart);
        const runtime=g.extensionRuntime!, old=runtime.causality.create('status',ally.id,ally.id,ally.extensionHooks!.partyId(ally));
        ally.isAlly=false; ally.extensionHooks!.relationshipChanged!(ally); g.becomeAllyWith(ally);
        runtime.causality.withOrigin(old,()=>g.killMonster(victim(g))); flush(g);
        expect(progression(g).experience).toBe(playerPart);
    });
    it('tracks actual kind knowledge, never pickup/detection/repeated kind, with a configurable cap',() => {
        configured(pack=>{pack.config.experience.identification.perKind=7;pack.config.experience.identification.totalCap=10;});
        const g=game(); create(g); const before=progression(g).experience;
        const potion=ItemLoader.spawnPotion('potion_of_strength',0,0)!;
        g.extensionRuntime!.emit('itemPickedUp',{creature:{id:g.player.id,name:'p',hp:g.player.hp,maxHp:g.player.maxHp,x:0,y:0,player:true},item:{id:potion.id,quantity:1,category:potion.category}});
        flush(g); expect(progression(g).experience).toBe(before);
        ItemLoader.identifyItemKind(potion); flush(g); expect(progression(g).experience).toBe(before+7);
        ItemLoader.identifyInstance(potion); flush(g); expect(progression(g).experience).toBe(before+7);
        ItemLoader.identifyItemKind(ItemLoader.spawnPotion('potion_of_life',0,0)!); flush(g); expect(progression(g).experience).toBe(before+10);
    });
    it('replays neutral creation and configured D1 multi-level award, save/load/seek/resume preserves pools and deltas',() => {
        configured(pack=>{pack.config.experience.firstVisits.minDepth=1;pack.config.experience.firstVisits.base=300;pack.config.experience.firstVisits.perDepth=0;});
        const g=game(); create(g); g.executeCommand('wait');
        expect(progression(g).level).toBeGreaterThan(1);
        const saved=g.toSaveSnapshot(), recording=g.exportRecording();
        const restored=createHeadlessGame(9,'test'); expect(restored.loadSnapshot(saved)).toBe(true);
        expect(restored.extensionRuntime!.snapshot()).toEqual(saved.extensions);
        const hp=restored.player.maxHp; restored.executeCommand('wait'); expect(restored.player.maxHp).toBe(hp);
        expect(restored.hasCompleteRecording).toBe(true);
        const replay=createHeadlessGame(10,'test'); expect(replay.loadReplay(recording)).toBe(true);
        while(replay.replayCursor<recording.events.length&&!replay.replayError)replay.replayStep(true);
        expect(replay.replayError).toBeNull(); expect(replay.extensionRuntime!.snapshot()).toEqual(saved.extensions);
        replay.replaySeek(0); expect(replay.replayError).toBeNull();
        while(replay.replayCursor<recording.events.length&&!replay.replayError)replay.replayStep(true);
        expect(replay.extensionRuntime!.snapshot()).toEqual(saved.extensions);
    });
    it('rejects missing/repeated creation in recordings before replacing an active game',() => {
        const g=game();create(g);g.executeCommand('wait');const recording=g.exportRecording(), player=g.player,runtime=g.extensionRuntime;
        const empty=structuredClone(recording);empty.events=[];expect(g.loadReplay(empty)).toBe(false);
        const missing=structuredClone(recording);missing.events[0]!.action='wait';missing.events[0]!.data=null;expect(g.loadReplay(missing)).toBe(false);
        const duplicate=structuredClone(recording);duplicate.events[1]!.action='ext:command';duplicate.events[1]!.data=duplicate.events[0]!.data;expect(g.loadReplay(duplicate)).toBe(false);
        expect(g.player).toBe(player);expect(g.extensionRuntime).toBe(runtime);
    });
    it('rejects invalid cross-component state and old version without retiring the live game',() => {
        const g=game();create(g);const saved=g.toSaveSnapshot(),player=g.player,runtime=g.extensionRuntime;
        for(const mutate of [(s:typeof saved)=>{s.extensions!.manifest.modules[0]!.version='1.0.0';},
            (s:typeof saved)=>{(s.extensions!.components[g.player.id]!['growth:progression'] as GrowthProgression).level=10;},
            (s:typeof saved)=>{s.extensions!.components[g.player.id]!['growth:derived']={appliedStrength:0,appliedMaxHp:99};},
            (s:typeof saved)=>{s.extensions!.components['999999']=s.extensions!.components[g.player.id]!;delete s.extensions!.components[g.player.id];}]){
            const bad=structuredClone(saved);mutate(bad);expect(g.loadSnapshot(bad)).toBe(false);expect(g.player).toBe(player);expect(g.extensionRuntime).toBe(runtime);
        }
    });
});
