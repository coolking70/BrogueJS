import { afterEach, expect, it, vi } from 'vitest';
import '../i18n';
import { installProductionBody, emptyProductionArena, startProductionGame, PRODUCTION_BODY_ID } from './support/productionComposite';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { CombatSystem } from '../engine/Combat/Combat';
import { TerrainType as T, DungeonLayer as L } from '../engine/Map/Grid';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
import type { Game } from '../engine/Core/Game';
import type { Item } from '../engine/Items/Item';
afterEach(()=>{vi.restoreAllMocks();logger.reset();});
function equipped(game:Game,id:string) {
    const item=ItemLoader.spawnWeapon(id,-1,-1)!;item.enchantment=0;item.runicType=undefined;game.player.inventory.addItem(item);game.player.equippedWeapon=item;game.player.strength=30;return item;
}
function fire(game:Game,item:Item,target:{x:number;y:number}) {
    game.player.inventory.addItem(item);const charges=item.charges!;game.executeItemCommand('use',item);game.executeCommand('mouse_travel',target);expect(item.charges).toBe(charges-1);
}
it.each([['body-fixture'],['body-fixture','growth'],['body-fixture','combat'],['body-fixture','growth','combat']] as const)
('real axe sweep and paralysis rune run once per leg, with one-quarter transfer and no core combat replay: %j',(...ids)=>{
    Object.assign(installProductionBody().leg,{hp:80});const game=startProductionGame(ids);emptyProductionArena(game);const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!,legs=game.monsters.slice(1);
    core.applyStatus('paralyzed',1000);legs.forEach(a=>{a.defense=0;});equipped(game,'axe').runicType='paralysis';
    commitCreatureAnchor(game.player,{x:14,y:10});const hp=core.hp,old=legs.map(a=>a.hp),damage=vi.spyOn(core,'takeDamage'),attack=vi.spyOn(CombatSystem,'attack');
    vi.spyOn(rng,'randPercent').mockReturnValue(true);game.executeCommand('move',{x:0,y:1});
    const hits=attack.mock.calls.filter(([a])=>a===game.player);expect(hits.map(([,d])=>d.id).sort()).toEqual([legs[0]!.id,legs[1]!.id].sort());
    expect(attack.mock.results.filter(result=>result.type==='return' && result.value.triggeredRunic==='paralysis')).toHaveLength(2);expect(core.hp).toBe(hp-legs.reduce((sum,a,i)=>sum+Math.floor((old[i]!-a.hp)/4),0));expect(damage).not.toHaveBeenCalled();
    expect(game.lastAdvancementError).toBeNull();expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});
it('a real lightning staff crosses three distinct legs once each, applying shield before the capped quarter transfer',()=>{
    installProductionBody();const game=startProductionGame();emptyProductionArena(game);const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;core.applyStatus('paralyzed',1000);
    const legs=game.monsters.slice(1);legs[0]!.applyShield(100);commitCreatureAnchor(game.player,{x:11,y:11});
    const hp=core.hp,old=legs.map(a=>a.hp),damage=vi.spyOn(core,'takeDamage');fire(game,ItemLoader.spawnStaff('staff_of_lightning',-1,-1)!,{x:22,y:11});
    expect(legs.filter((a,i)=>a.hp<old[i]!)).toHaveLength(3);expect(core.hp).toBe(hp-legs.reduce((sum,a,i)=>sum+Math.floor((old[i]!-a.hp)/4),0));expect(damage).not.toHaveBeenCalled();
});
it('real explosive terrain covers two parts once each and does not turn overkill or member retirement into another death',()=>{
    installProductionBody();const game=startProductionGame();emptyProductionArena(game);const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;core.applyStatus('paralyzed',1000);
    const [a,b]=game.monsters.slice(1),hp=core.hp;a!.hp=b!.hp=10;for(const part of [a!,b!])for(const p of footprintOf(part))game.grid.setTerrainLayer(p.x,p.y,L.SURFACE,T.GAS_EXPLOSION);
    const damage=vi.spyOn(core,'takeDamage');game.executeCommand('wait');
    expect(a!.hp).toBe(0);expect(b!.hp).toBe(0);expect(core.hp).toBe(hp-4);expect(damage).not.toHaveBeenCalled();expect(game.bodyGroups![0]!.appliedBreaks).toHaveLength(2);
    expect(game.extensionRuntime!.snapshot().foundation.deaths[String(a!.id)]).toBeUndefined();
});
it('real healing, empowerment and negation aimed at one leg use body identity and clear every local magic exactly once',()=>{
    installProductionBody();const game=startProductionGame();emptyProductionArena(game);const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;
    core.applyStatus('paralyzed',1000);core.hp=80;const leg=game.monsters[1]!;leg.hp=10;commitCreatureAnchor(game.player,{x:11,y:11});
    const heal=vi.spyOn(core,'heal');fire(game,ItemLoader.spawnStaff('staff_of_healing',-1,-1)!,leg.loc);
    expect(heal).toHaveBeenCalledTimes(1);expect(core.hp).toBeGreaterThan(80);expect(leg.hp).toBe(10);
    const empower=ItemLoader.spawnWand('wand_of_empowerment',-1,-1)!,max=core.maxHp,legMax=leg.maxHp;fire(game,empower,leg.loc);
    expect(core.maxHp).toBeGreaterThan(max);expect(leg.maxHp).toBe(legMax);
    core.applyStatus('paralyzed',1000);for(const actor of game.monsters)actor.applyShield(1000);
    fire(game,ItemLoader.spawnWand('wand_of_negation',-1,-1)!,leg.loc);
    expect(game.monsters.every(a=>!a.hasStatus('shielded'))).toBe(true);expect(core.hasStatus('paralyzed')).toBe(true); // CE paralysis is non-negatable.
});
it('a real discord staff and discord scroll affect the shared mind once, keeping physical health local',()=>{
    installProductionBody();const game=startProductionGame();emptyProductionArena(game);const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;
    core.applyStatus('paralyzed',1000);commitCreatureAnchor(game.player,{x:11,y:11});const leg=game.monsters[1]!,old=game.monsters.map(a=>a.hp);
    const status=vi.spyOn(core,'setStatusDuration');fire(game,ItemLoader.spawnStaff('staff_of_discord',-1,-1)!,{x:22,y:11});
    expect(status.mock.calls.filter(([id])=>id==='discordant')).toHaveLength(1);expect(leg.statusDurations.discordant).toBeUndefined();
    const areaStatus=vi.spyOn(core,'applyStatus');const scroll=ItemLoader.spawnScroll('scroll_of_discord',-1,-1)!;game.player.inventory.addItem(scroll);game.onConfirmRequest=()=>true;
    while(logger.pendingAcknowledgment)logger.acknowledgeNext();game.executeItemCommand('read',scroll);
    expect(areaStatus.mock.calls.filter(([id])=>id==='discordant')).toHaveLength(1);expect(game.monsters.map(a=>a.hp)).toEqual(old);
});
