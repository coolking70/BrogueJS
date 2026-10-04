import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { DCOLS, DROWS, TerrainType } from '../../../../engine/Map/Grid';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import data from '../data/definitions.json';
import type { GrowthDefinitionPack, GrowthSkill } from '../types';
import type { GrowthState } from '../state';
import type { GrowthAttributes, GrowthFocus, GrowthProgression, GrowthSkills } from '../components';
import type { GrowthSkillBuild } from '../skills';
import type { GrowthIdentityBuild, GrowthIdentitySelection } from '../identities';
import { createGrowthGameplay } from '../module';
import { parseGrowthDefinitionPack } from '../definitions';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { ExtensionRegistry } from '../../../../ext/registry';
import type { ExtensionVersion } from '../../../../ext/types';
import * as catalog from '../../../../ext/catalog';

function selection(profession='guardian',lineage='human',faith='unaffiliated'): GrowthIdentitySelection {
    return {professionId:`growth.profession.${profession}`,lineageId:`growth.lineage.${lineage}`,faithId:`growth.faith.${faith}`,
        choices:lineage==='human'?[{identityId:'growth.lineage.human',choiceIndex:0,attributes:{'growth.attribute.agility':1}}]:[]};
}
const createCommand = (chosen: unknown, revision=0) => JSON.stringify({module:'growth',action:'create-character',payload:{revision,...chosen as object}});
const state = (game: Game) => game.extensionRuntime!.snapshot().modules.growth as unknown as GrowthState;
const component = <T>(game: Game,name: string) => game.extensionRuntime!.snapshot().components[game.player.id]![`growth:${name}`] as unknown as T;
function finish(game: Game) {
    for(let steps=0;steps<200 && game.isAdvancing;steps++) game.stepAdvancement();
    expect(game.isAdvancing).toBe(false);expect(game.lastAdvancementError).toBeNull();
}
function command(game: Game,action: string,payload: Record<string,unknown>={}) {
    game.executeCommand('ext:command',JSON.stringify({module:'growth',action,payload:{revision:state(game).revision,...payload}}));finish(game);
}
function scene(chosen=selection(),mode:'test'|'normal'='test',seed=348913) {
    const game=createHeadlessGame(seed,'test');
    game.startNewGame({seed,mode,ruleSet:'extended',initialCommands:[createCommand(chosen)]});finish(game);return game;
}
function configured(change: (pack: GrowthDefinitionPack)=>void) {
    const pack=structuredClone(data) as unknown as GrowthDefinitionPack;change(pack);
    const parsed=parseGrowthDefinitionPack(pack,{moduleVersion:pack.moduleVersion,hasText:()=>true});
    const rules={schema:1,version:pack.moduleVersion,fingerprint:extensionDataFingerprint(pack)};
    vi.spyOn(catalog,'createExtensionRegistry').mockImplementation(()=> {
        const registry=new ExtensionRegistry();registry.register('growth',pack.moduleVersion,()=>createGrowthGameplay(parsed,rules),rules);return registry;
    });
    return parsed;
}
function projection(game: Game) {
    return {extensions:game.extensionRuntime!.snapshot(),rng:rng.getState(),tick:timeSystem.currentTick,
        turn:game.absoluteTurnNumber,turns:game.stats.turns,hp:game.player.hp,maxHp:game.player.maxHp,loc:{...game.player.loc}};
}
function standOn(game: Game,terrain: TerrainType) {
    for(let x=0;x<DCOLS;x++) for(let y=0;y<DROWS;y++) if(game.grid.getCell(x,y)!.layers.includes(terrain)) {game.player.loc={x,y};return;}
    throw new Error('Expected generated stairs');
}
afterEach(()=>vi.restoreAllMocks());

describe('EXT-1e selected identity engine creation and durable commands',()=> {
    it.each([
        ['guardian','human','unaffiliated'],['scout','stoneborn','watch'],['explorer','duskborn','path'],['skirmisher','reedfolk','restraint'],
    ])('commits %s / %s / %s with one recorded command and gifts exactly once', (profession,lineage,faith)=> {
        const chosen=selection(profession,lineage,faith), game=scene(chosen);
        expect(state(game).created).toBe(true);expect(component<GrowthIdentityBuild>(game,'identity')).toEqual({...chosen,templateId:null});
        expect(game.recordedInputEvents).toHaveLength(1);expect(game.recordedInputEvents[0]!.data).toBe(createCommand(chosen));
        const build=component<GrowthSkillBuild>(game,'skill-build');expect(build.gifted).toHaveLength(2);expect(build.learned).toEqual(build.gifted);
        expect(component<GrowthProgression>(game,'progression').skillPoints).toBe(0);expect(game.player.hp).toBe(game.player.maxHp);
        const before=projection(game);game.executeCommand('ext:command',createCommand(chosen));finish(game);
        expect(projection(game)).toEqual(before);expect(game.recordedInputEvents).toHaveLength(1);expect(()=>game.toSaveSnapshot()).not.toThrow();
    });
    it('preserves player L1 unspent grants for neutral and selected creation while identity ranks/gifts stay free and NPC/clone templates start at zero',()=> {
        configured(pack=> {
            pack.config.levels.attributePoints={kind:'periodic',firstLevel:1,every:1,amount:20};
            pack.config.levels.skillPoints={kind:'periodic',firstLevel:1,every:1,amount:4};
        });
        const selected=scene();
        expect(component<GrowthProgression>(selected,'progression')).toEqual({level:1,experience:0,attributePoints:20,skillPoints:4});
        const selectedAttributes=component<GrowthAttributes>(selected,'attributes');
        expect(selectedAttributes.values['growth.attribute.constitution']).toBe(2);expect(selectedAttributes.values['growth.attribute.agility']).toBe(1);
        expect(Object.values(selectedAttributes.allocated).every(value=>value===0)).toBe(true);
        expect(component<GrowthSkillBuild>(selected,'skill-build').gifted).toHaveLength(2);
        selected.clearRecording();
        const npc=new Monster(selected.player.x+1,selected.player.y,(monsters as MonsterData[]).find(monster=>monster.id==='rat')!);selected.monsters.push(npc);
        const npcProgression=()=>selected.extensionRuntime!.snapshot().components[npc.id]!['growth:progression'];
        expect(npcProgression()).toEqual({level:1,experience:0,attributePoints:0,skillPoints:0});
        const clone=selected.cloneMonster(npc)!;expect(clone).toBeDefined();
        expect(selected.extensionRuntime!.snapshot().components[clone.id]!['growth:progression']).toEqual({level:1,experience:0,attributePoints:0,skillPoints:0});
        const neutral=createHeadlessGame(21871,'test');neutral.startNewGame({seed:21871,mode:'test',ruleSet:'extended',initialCommands:[createCommand({})]});
        expect(component<GrowthProgression>(neutral,'progression')).toEqual({level:1,experience:0,attributePoints:20,skillPoints:4});
        expect(Object.values(component<GrowthAttributes>(neutral,'attributes').values).every(value=>value===0)).toBe(true);
        expect(component<GrowthSkillBuild>(neutral,'skill-build').gifted).toEqual([]);
    });
    it('rejects missing, stale and invalid explicit selections before replacing a live run or either RNG stream',()=> {
        const game=scene(selection('guardian','stoneborn','watch'));game.executeCommand('wait');finish(game);
        const before=projection(game),events=structuredClone(game.recordedInputEvents),player=game.player;
        for(const initialCommands of [[],[createCommand(selection(),1)],[createCommand({...selection(),choices:[]})],
            [createCommand({...selection(),professionId:'growth.profession.missing'})],
            [createCommand({...selection(),choices:[{identityId:'growth.lineage.human',choiceIndex:0,attributes:{'growth.attribute.agility':8}}]})],
            [createCommand(selection()),createCommand(selection())]]) {
            expect(()=>game.startNewGame({seed:777,mode:'test',ruleSet:'extended',initialCommands})).toThrow();
            expect(projection(game)).toEqual(before);expect(game.recordedInputEvents).toEqual(events);expect(game.player).toBe(player);
        }
    });
    it('keeps half-created and explicit legacy neutral contracts separate from selected creation',()=> {
        const game=createHeadlessGame(4123,'test');game.startNewGame({seed:4123,mode:'test',ruleSet:'extended'});
        const before=projection(game);game.executeCommand('wait');finish(game);expect(projection(game)).toEqual(before);expect(()=>game.toSaveSnapshot()).toThrow();
        for(const payload of [{...selection(),revision:1},{...selection(),revision:0,actorId:game.player.id},{...selection(),revision:0,choices:[]}]) {
            game.executeCommand('ext:command',JSON.stringify({module:'growth',action:'create-character',payload}));finish(game);expect(projection(game)).toEqual(before);
        }
        command(game,'create-character',{revision:0});expect(state(game).created).toBe(true);
        expect(component<GrowthIdentityBuild>(game,'identity')).toEqual({professionId:null,lineageId:null,faithId:null,choices:[],templateId:null});
        expect(component<GrowthSkillBuild>(game,'skill-build').gifted).toEqual([]);
    });
    it.each(['none','soft','hard'] as const)('executes the declared global %s lock policy through learn-skill commands',mode=> {
        configured(pack=> {
            pack.config.levels.skillPoints={kind:'periodic',firstLevel:1,every:1,amount:5};pack.config.skills.lockMode=mode;
            const row=pack.definitions.find(d=>d.id==='growth.skill.measured-strike') as GrowthSkill;
            row.lock={mode:'hard',professionIds:['growth.profession.scout'],lineageIds:[],faithIds:[]};
        });
        const game=scene(),before=projection(game);command(game,'learn-skill',{skillId:'growth.skill.measured-strike'});
        if(mode==='hard') expect(projection(game)).toEqual(before);
        else {expect(component<GrowthSkillBuild>(game,'skill-build').learned).toContain('growth.skill.measured-strike');expect(component<GrowthProgression>(game,'progression').skillPoints).toBe(3);}
        const scout=scene(selection('scout','duskborn'));command(scout,'learn-skill',{skillId:'growth.skill.measured-strike'});
        expect(component<GrowthSkillBuild>(scout,'skill-build').learned).toContain('growth.skill.measured-strike');
    });
    it('records stoneborn/watch duration and cooldown through native brace, then replays/seeks/saves/resumes exactly',()=> {
        const game=scene(selection('guardian','stoneborn','watch')),initial=state(game).objectiveClock;
        command(game,'use-skill',{skillId:'growth.skill.brace',target:{kind:'self'}});
        const effect=component<GrowthSkillBuild>(game,'skill-build').effects[0]!;
        expect(effect.expiresAt!-effect.startedAt).toBe(3);expect(effect.taggedSources).toContain('growth.faith.watch');
        expect(component<GrowthSkills>(game,'skills').readyAt['growth.skill.brace']).toBe(initial+12);
        const saved=game.toSaveSnapshot(),recording=game.exportRecording(),expected=projection(game);
        const replay=createHeadlessGame(992,'test');expect(replay.loadReplay(recording)).toBe(true);
        while(replay.replayCursor<recording.events.length && !replay.replayError) replay.replayStep(true);
        expect(replay.replayError).toBeNull();expect(projection(replay)).toEqual(expected);
        replay.replaySeek(1);while(replay.replayCursor<recording.events.length && !replay.replayError) replay.replayStep(true);
        expect(replay.replayError).toBeNull();expect(projection(replay)).toEqual(expected);
        const loaded=createHeadlessGame(993,'test');expect(loaded.loadSnapshot(saved)).toBe(true);expect(projection(loaded)).toEqual(expected);
        loaded.executeCommand('wait');finish(loaded);const resumed=loaded.exportRecording(),final=projection(loaded),check=createHeadlessGame(994,'test');
        expect(check.loadReplay(resumed)).toBe(true);while(check.replayCursor<resumed.events.length && !check.replayError) check.replayStep(true);
        expect(check.replayError).toBeNull();expect(projection(check)).toEqual(final);
        expect(component<GrowthSkillBuild>(check,'skill-build').gifted).toEqual(component<GrowthSkillBuild>(game,'skill-build').gifted);
    });
    it('pays path first-visit focus with XP off, saves its receipt, and does not pay again after revisiting',()=> {
        configured(pack=> {pack.config.experience.sources.firstVisits=false;pack.config.focus.recoveryInterval=1000;});
        const game=scene(selection('guardian','human','path'),'normal');game.clearRecording();
        command(game,'use-skill',{skillId:'growth.skill.brace',target:{kind:'self'}});
        const before=component<GrowthFocus>(game,'focus').current;expect(before).toBe(4);
        standOn(game,TerrainType.STAIRS_DOWN);game.executeCommand('stairs_down');finish(game);expect(game.depth).toBe(2);
        expect(component<GrowthFocus>(game,'focus').current).toBe(before+1);expect(component<GrowthProgression>(game,'progression').experience).toBe(0);
        const receipt=`growth.effect.path-focus:${game.player.id}:2`;expect(state(game).resourceReceipts).toContain(receipt);
        const snapshot=game.toSaveSnapshot(),expected=game.extensionRuntime!.snapshot(),beforeLoad=projection(game);
        const other=Object.entries(expected.components).find(([id,components])=>Number(id)!==game.player.id && components['growth:reward'])![0];
        for(const forged of ['garbage',`growth.effect.unknown:${game.player.id}:2`,`growth.effect.brace:${game.player.id}:2`,
            `growth.effect.path-focus:0:2`,`growth.effect.path-focus:9007199254740992:2`,
            `growth.effect.path-focus:${game.player.id}:1`,`growth.effect.path-focus:${game.player.id}:3`,
            `growth.effect.path-focus:${other}:2`]) {
            const corrupt=structuredClone(snapshot);(corrupt.extensions!.modules.growth as unknown as GrowthState).resourceReceipts=[forged];
            expect(game.loadSnapshot(corrupt)).toBe(false);expect(projection(game)).toEqual(beforeLoad);
        }
        expect(game.loadSnapshot(snapshot)).toBe(true);
        expect(game.extensionRuntime!.snapshot()).toEqual(expected);
        standOn(game,TerrainType.STAIRS_UP);game.executeCommand('stairs_up');finish(game);expect(game.depth).toBe(1);
        standOn(game,TerrainType.STAIRS_DOWN);game.executeCommand('stairs_down');finish(game);expect(game.depth).toBe(2);
        expect(component<GrowthFocus>(game,'focus').current).toBe(before+1);expect(state(game).resourceReceipts.filter(value=>value===receipt)).toHaveLength(1);
    });
    it('retains a first-visit receipt after a real NPC body is collected and does not re-grant on load',()=> {
        configured(pack=> {pack.config.experience.sources.firstVisits=false;pack.config.monsters.templates[0]!.faithId='growth.faith.path';});
        const game=scene(selection(),'normal');game.clearRecording();
        standOn(game,TerrainType.STAIRS_DOWN);game.executeCommand('stairs_down');finish(game);expect(game.depth).toBe(2);
        const npc=game.monsters.find(monster=>state(game).resourceReceipts.includes(`growth.effect.path-focus:${monster.id}:2`))!;
        expect(npc).toBeDefined();const receipt=`growth.effect.path-focus:${npc.id}:2`;
        game.killMonster(npc,true);game.executeCommand('wait');finish(game);
        expect(game.extensionRuntime!.snapshot().components[npc.id]).toBeUndefined();expect(state(game).resourceReceipts).toContain(receipt);
        const saved=game.toSaveSnapshot(),before=projection(game);expect(game.loadSnapshot(saved)).toBe(true);expect(projection(game)).toEqual(before);
    });
    it('rejects previous growth manifest versions and same-version fingerprint changes in selected saves and recordings without retiring the live run',()=> {
        const game=scene(selection('guardian','stoneborn','watch'));command(game,'use-skill',{skillId:'growth.skill.brace',target:{kind:'self'}});
        const saved=game.toSaveSnapshot(),recording=game.exportRecording(),before=projection(game),player=game.player,runtime=game.extensionRuntime;
        const events=structuredClone(game.recordedInputEvents), original=saved.extensions!.manifest.modules.find(module=>module.id==='growth')!;
        expect(original.version).toBe(data.moduleVersion);expect(original.rules!.version).toBe(data.rulesVersion);
        const mutations: ((module: ExtensionVersion)=>void)[]=[
            module=>{module.version='1.5.0';},module=>{module.rules!.version='1.5.0';},
            module=>{module.version='1.5.0';module.rules!.version='1.5.0';},
            module=>{module.version='1.4.0';},module=>{module.rules!.version='1.4.0';},
            module=>{module.version='1.4.0';module.rules!.version='1.4.0';},
            module=>{module.version='1.3.0';},module=>{module.rules!.version='1.3.0';},
            module=>{module.version='1.3.0';module.rules!.version='1.3.0';},
            module=>{module.rules!.fingerprint=`sha256:${'0'.repeat(64)}`;},
        ];
        for(const mutate of mutations) {
            const corruptSave=structuredClone(saved),savedModule=corruptSave.extensions!.manifest.modules.find(module=>module.id==='growth')!;
            mutate(savedModule);expect(game.loadSnapshot(corruptSave)).toBe(false);
            expect(projection(game)).toEqual(before);expect(game.player).toBe(player);expect(game.extensionRuntime).toBe(runtime);expect(game.recordedInputEvents).toEqual(events);
            const corruptRecording=structuredClone(recording),recordedModule=corruptRecording.extensions!.modules.find(module=>module.id==='growth')!;
            mutate(recordedModule);expect(game.loadReplay(corruptRecording)).toBe(false);
            expect(projection(game)).toEqual(before);expect(game.player).toBe(player);expect(game.extensionRuntime).toBe(runtime);expect(game.recordedInputEvents).toEqual(events);
        }
    });
    it('rejects forged identity choices, missing gift provenance, and timed source identity swaps before retiring a valid run',()=> {
        const game=scene(selection('guardian','stoneborn','watch'));command(game,'use-skill',{skillId:'growth.skill.brace',target:{kind:'self'}});
        const saved=game.toSaveSnapshot(),before=projection(game),id=game.player.id;
        for(const mutate of [
            (snapshot: typeof saved)=>{(snapshot.extensions!.components[id]!['growth:identity'] as unknown as GrowthIdentityBuild).lineageId='growth.lineage.duskborn';},
            (snapshot: typeof saved)=>{(snapshot.extensions!.components[id]!['growth:skill-build'] as unknown as GrowthSkillBuild).gifted=[];},
            (snapshot: typeof saved)=>{const build=snapshot.extensions!.components[id]!['growth:skill-build'] as unknown as GrowthSkillBuild;build.effects[0]!.taggedSources=build.effects[0]!.taggedSources.filter(value=>value!=='growth.faith.watch');},
        ]) {const corrupt=structuredClone(saved);mutate(corrupt);expect(game.loadSnapshot(corrupt)).toBe(false);expect(projection(game)).toEqual(before);}
    });
});
