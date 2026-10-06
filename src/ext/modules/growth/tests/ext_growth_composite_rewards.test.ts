import { installedModuleSubsets } from '../../../../test/support/installedExtensions';
import { afterEach, expect, it, vi } from 'vitest';
import { installProductionBody, emptyProductionArena, startProductionGame, PRODUCTION_BODY_ID } from '../../../../test/support/productionComposite';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { logger } from '../../../../engine/Systems/Logger';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import { extensionDataFingerprint } from '../../../fingerprint';
import { createGrowthGameplay } from '../module';
import { loadGrowthDefinitionPack, parseGrowthDefinitionPack } from '../definitions';
import type { GrowthDefinitionPack } from '../types';
afterEach(()=>{vi.restoreAllMocks();logger.reset();});
function positiveQuoteScene(combat:boolean) {
    installProductionBody();const installed=catalog.createExtensionRegistry(),descriptors=catalog.getInstalledModuleDescriptors();
    const pack=structuredClone(loadGrowthDefinitionPack({hasText:()=>true})) as GrowthDefinitionPack;
    pack.config.experience.kills.monsterQuotes.push({monsterId:'body-fixture.fixture-core',threatRank:6,amount:27},{monsterId:'body-fixture.fixture-leg',threatRank:6,amount:13});
    const parsed=parseGrowthDefinitionPack(pack,{moduleVersion:pack.moduleVersion,hasText:()=>true});
    const registry=registryFromDescriptors(descriptors.map(d=>{
        const base=installed.create(installed.manifest([d.id]))[0]!;if(d.id!=='growth')return {...d,rules:base.rules,create:()=>base};
        const rules={...base.rules!,fingerprint:extensionDataFingerprint(pack)};return {...d,rules,create:()=>createGrowthGameplay(parsed,rules)};
    }));vi.mocked(catalog.createExtensionRegistry).mockReturnValue(registry);
    const game=startProductionGame(combat?['body-fixture','growth','combat']:['body-fixture','growth']);emptyProductionArena(game);
    const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12},undefined,'natural')!;core.applyStatus('paralyzed',1000);const weapon=ItemLoader.spawnWeapon('dagger',-1,-1)!;game.player.inventory.addItem(weapon);game.player.equippedWeapon=weapon;game.player.strength=30;
    return {game,core,xp:()=>((game.extensionRuntime!.snapshot().components[game.player.id]!['growth:progression']) as {experience:number}).experience};
}
it.each(installedModuleSubsets(['combat']).map(ids => ids.includes('combat')))('positive immutable growth quotes award 27 once for the original core, zero for quoted legs and whole clones (combat=%s)',combat=>{
    const {game,core,xp}=positiveQuoteScene(combat),before=xp(),clone=game.cloneMonster(core)!;
    const reward=game.extensionRuntime!.snapshot().components[core.id]!['growth:reward'] as {amount:number};expect(reward.amount).toBe(27);
    for(const leg of game.monsters.filter(a=>a.spatial?.bodyMember?.groupId===core.id&&a!==core))leg.takeDamage(100,true);
    expect(xp()).toBe(before);clone.hp=1;clone.defense=0;commitCreatureAnchor(game.player,{x:clone.x-1,y:clone.y});
    for(let n=0;n<12&&clone.hp>0;n++)game.executeCommand('move',{x:1,y:0});expect(clone.hp).toBe(0);expect(xp()).toBe(before);
    core.hp=1;core.defense=0;commitCreatureAnchor(game.player,{x:core.x-1,y:core.y});for(let n=0;n<12&&core.hp>0;n++)game.executeCommand('move',{x:1,y:0});
    expect(core.hp).toBe(0);expect(xp()).toBe(before+27);game.killMonster(core);expect(xp()).toBe(before+27);
    expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});
