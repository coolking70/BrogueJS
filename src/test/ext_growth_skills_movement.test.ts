import { afterEach, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import data from '../ext/modules/growth/definitions.json';
import { parseGrowthDefinitionPack } from '../ext/modules/growth/definitions';
import { createGrowthGameplay } from '../ext/modules/growth/module';
import type { GrowthDefinitionPack, GrowthSkill } from '../ext/modules/growth/types';
import type { GrowthState } from '../ext/modules/growth/state';
import type { GrowthSkillBuild } from '../ext/modules/growth/skills';
import { extensionDataFingerprint } from '../ext/fingerprint';
import { ExtensionRegistry } from '../ext/registry';
import * as catalog from '../ext/catalog';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { TerrainType } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';

afterEach(()=>vi.restoreAllMocks());
it.each(['seized','web','vomit','moved'] as const)('gates a renamed movement skill result on real native displacement: %s',outcome=> {
    const skillId='growth.skill.test-step';
    const pack=JSON.parse(JSON.stringify(data).split('growth.skill.withdraw').join(skillId)) as GrowthDefinitionPack;
    const skill=pack.definitions.find(d=>d.id===skillId) as GrowthSkill;skill.prerequisites=[];
    // A longer test-only duration keeps a successful effect inspectable after the first native block.
    const effect=skill.effects[0]!;if(effect.kind!=='timed'||effect.duration.kind!=='objective-blocks')throw Error();effect.duration.blocks=3;effect.duration.cap=3;
    pack.config.levels.skillPoints={kind:'periodic',firstLevel:1,every:1,amount:2};pack.config.experience.sources.firstVisits=false;
    const parsed=parseGrowthDefinitionPack(pack,{moduleVersion:pack.moduleVersion,hasText:()=>true}),identity={schema:1,version:pack.moduleVersion,fingerprint:extensionDataFingerprint(pack)};
    vi.spyOn(catalog,'createExtensionRegistry').mockImplementation(()=> {const registry=new ExtensionRegistry();registry.register('growth',pack.moduleVersion,()=>createGrowthGameplay(parsed,identity),identity);return registry;});
    const game=createHeadlessGame(775541,'test');game.startNewGame({seed:775541,mode:'test',ruleSet:'extended'});
    const state=()=>game.extensionRuntime!.snapshot().modules.growth as unknown as GrowthState;
    const command=(action:string,payload:Record<string,unknown>)=> {game.executeCommand('ext:command',JSON.stringify({module:'growth',action,payload:{revision:state().revision,...payload}}));while(game.isAdvancing)game.stepAdvancement();expect(game.lastAdvancementError).toBeNull();};
    command('create-character',{revision:0});command('learn-skill',{skillId});command('equip-skills',{active:[skillId],passive:[]});
    const origin={...game.player.loc},target={kind:'cell',x:origin.x,y:origin.y+1};
    if(outcome==='seized') {const seizer=new Monster(origin.x+1,origin.y,(monsters as MonsterData[]).find(m=>m.id==='rat')!);seizer.abilityFlags.add('MA_SEIZES');seizer.seizing=true;seizer.ticksUntilTurn=10000;game.monsters.push(seizer);game.player.seized=true;}
    if(outcome==='web') {game.grid.setTerrain(origin.x,origin.y,TerrainType.WEB);game.player.setStatusDuration('stuck',3);}
    if(outcome==='vomit') {game.player.setStatusDuration('nauseous',10);vi.spyOn(rng,'randPercent').mockReturnValue(true);}
    const tick=timeSystem.currentTick,clock=state().objectiveClock,count=game.recordedInputEvents.length;
    command('use-skill',{skillId,target});
    const components=game.extensionRuntime!.snapshot().components[game.player.id]!,build=components['growth:skill-build'] as unknown as GrowthSkillBuild;
    expect(timeSystem.currentTick-tick).toBe(100);expect(game.recordedInputEvents).toHaveLength(count+1);
    expect(components['growth:focus']).toMatchObject({current:5});expect(components['growth:skills']).toEqual({readyAt:{[skillId]:clock+skill.cooldown}});
    expect(game.player.loc).toEqual(outcome==='moved'?{x:target.x,y:target.y}:origin);expect(build.effects).toHaveLength(outcome==='moved'?1:0);
    expect(game.extensionRuntime!.readyToSave).toBe(true);
});
