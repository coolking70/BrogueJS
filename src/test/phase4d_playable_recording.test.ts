import { afterEach, expect, it, vi } from 'vitest';
import '../i18n';

import { startProductionGame, emptyProductionArena } from './support/productionComposite';
import { commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { ItemLoader } from '../engine/Items/ItemLoader';

import { MonsterState } from '../entities/Monster';
import { logger } from '../engine/Systems/Logger';

import { writeFileSync } from 'node:fs';
afterEach(()=>{vi.restoreAllMocks();logger.reset();});

function ack(){while(logger.pendingAcknowledgment)logger.acknowledgeNext();}
/** Fixed initialization is deliberately applied on start AND replay restart.
 * This is a functional encounter fixture, not natural generation evidence. */

it('normal finite equipment defeats the independent weaver fixture through public commands',()=>{
    // Loadout and open encounter initialization are a functional fixture. The
    // giants-owned seed7309 test covers the real generated arena and natural birth.
    const game=startProductionGame(['body-fixture'],7326,'normal');emptyProductionArena(game);
    game.player.hp=game.player.maxHp=30;
    const core=game.createCompositeMonster('body-fixture.shale-weaver-body',{x:20,y:12})!;
    core.state=MonsterState.HUNTING;core.givenUpOnScent=true;game.player.strength=17;
    const axe=ItemLoader.spawnWeapon('axe',-1,-1)!;axe.enchantment=3;game.player.inventory.addItem(axe);game.player.equippedWeapon=axe;
    const armor=ItemLoader.spawnArmor('chain_mail',-1,-1)!;armor.enchantment=3;game.player.inventory.addItem(armor);game.player.equippedArmor=armor;
    const potions=Array.from({length:2},()=>ItemLoader.spawnPotion('potion_of_healing',-1,-1)!);potions.forEach(p=>game.player.inventory.addItem(p));
    commitCreatureAnchor(game.player,{x:18,y:10});(game as any).updateVision();game.onConfirmRequest=()=>true;let used=0,commands=0;
    for(;commands<240&&core.hp>0&&!game.isGameOver;commands++){
        if(game.player.hp<game.player.maxHp/2&&used<potions.length){game.executeItemCommand('quaff',potions[used++]!);ack();continue;}
        const cells=game.monsters.filter(m=>m.spatial?.bodyMember?.groupId===core.id&&m.hp>0).flatMap(m=>footprintOf(m));
        const at=game.player.loc,contact=cells.filter(p=>Math.max(Math.abs(p.x-at.x),Math.abs(p.y-at.y))===1).sort((a,b)=>a.y-b.y||a.x-b.x)[0];
        const target=contact??cells.sort((a,b)=>Math.max(Math.abs(a.x-at.x),Math.abs(a.y-at.y))-Math.max(Math.abs(b.x-at.x),Math.abs(b.y-at.y)))[0]!;
        game.executeCommand('move',{x:Math.sign(target.x-at.x),y:Math.sign(target.y-at.y)});ack();
    }
    writeFileSync('/private/tmp/p4d-complete-normal-encounter.json',JSON.stringify({seed:7326,mode:game.mode,modules:['body-fixture'],commands,remainingHp:game.player.hp,maxHp:game.player.maxHp,usedHealingPotions:used,totalHealingPotions:2,weapon:'+3 axe',armor:'+3 chain mail',coreHp:core.hp,breaks:core.spatial?.bodyMember?8:undefined},null,2)+'\n');
    expect(game.isGameOver).toBe(false);expect(core.hp).toBe(0);expect(game.player.hp).toBeGreaterThan(0);expect(used).toBeLessThanOrEqual(2);expect(game.lastAdvancementError).toBeNull();
});
