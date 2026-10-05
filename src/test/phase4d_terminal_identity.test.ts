import { afterEach, expect, it, vi } from 'vitest';
import '../i18n';
import { productionBodyScene } from './support/productionComposite';
import { commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { TerrainType as T, DungeonLayer as L } from '../engine/Map/Grid';
import { logger } from '../engine/Systems/Logger';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
afterEach(()=>{vi.restoreAllMocks();logger.reset();});
it.each(['melee','throw','fire-bolt','poison','burning','explosion','lava','fall'] as const)
('actual %s termination owns one core death and one carried item, with no member death facts',cause=>{
    const {game,core,actors}=productionBodyScene();core.hp=1;core.applyStatus('paralyzed',1000);
    const death=vi.spyOn(game.extensionRuntime!,'captureDeath'),drop=vi.spyOn(game,'makeMonsterDropItem'),loot=ItemLoader.spawnFood('ration_of_food',-1,-1)!;core.carriedItem=loot;
    commitCreatureAnchor(game.player,{x:core.x-3,y:core.y-1});game.onConfirmRequest=()=>true;
    if(cause==='melee'){
        commitCreatureAnchor(game.player,{x:core.x-2,y:core.y-1});const axe=ItemLoader.spawnWeapon('axe',-1,-1)!;axe.damage='30-30';game.player.inventory.addItem(axe);game.player.equippedWeapon=axe;game.player.strength=30;
        game.executeCommand('move',{x:1,y:0});
    }else if(cause==='throw'||cause==='fire-bolt'){
        const item=cause==='throw'?ItemLoader.spawnWeapon('dart',-1,-1)!:ItemLoader.spawnStaff('staff_of_fire',-1,-1)!;
        if(cause==='throw')item.damage='30-30';game.player.inventory.addItem(item);game.player.strength=30;
        game.executeItemCommand(cause==='throw'?'throw':'use',item);game.executeCommand('mouse_travel',{x:core.x-1,y:core.y-1});
    }else{
        if(cause==='poison')core.addPoison(5,2);
        if(cause==='burning')for(const p of footprintOf(core))game.grid.setTerrainLayer(p.x,p.y,L.SURFACE,T.PLAIN_FIRE);
        if(cause==='explosion')for(const p of footprintOf(core))game.grid.setTerrainLayer(p.x,p.y,L.SURFACE,T.GAS_EXPLOSION);
        if(cause==='lava')for(const p of footprintOf(core))game.grid.setTerrainLayer(p.x,p.y,L.LIQUID,T.LAVA);
        if(cause==='fall')for(const a of actors)for(const p of footprintOf(a))game.grid.setTerrainLayer(p.x,p.y,L.LIQUID,T.CHASM);
        for(let n=0;n<4&&core.hp>0;n++)game.executeCommand('wait');
    }
    expect(core.hp).toBe(0);expect(death.mock.calls.map(([a])=>a.id)).toEqual([core.id]);expect(game.bodyGroups).toBeUndefined();
    expect(actors.slice(1).every(a=>a.deathProcessed&&a.administrativeDeath)).toBe(true);
    const facts=game.extensionRuntime!.snapshot().foundation.deaths;for(const member of actors.slice(1))expect(facts[String(member.id)]).toBeUndefined();
    expect(drop.mock.calls.filter(([a])=>a===core)).toHaveLength(1);const remaining=game.items.filter(i=>i===loot).length;
    // Native lava destroys food; a chasm transfers dropped floor items.
    expect(remaining).toBe(cause==='lava'||cause==='fall'?0:1);game.killMonster(core);expect(death).toHaveBeenCalledOnce();expect(game.items.filter(i=>i===loot)).toHaveLength(remaining);
});
it('retirement clears external carrier/leader/seize references while retaining one authoritative core budget',()=>{
    const {game,core,actors}=productionBodyScene(),leg=actors[1]!;
    const other=new Monster(30,12,monsters.find(m=>m.id==='rat') as MonsterData);game.monsters.push(other);other.leader=leg;other.carriedMonster=leg;
    leg.seizing=true;game.player.seized=true;const carried=ItemLoader.spawnFood('ration_of_food',-1,-1)!;core.carriedItem=carried;
    leg.takeDamage(100,true);expect(other.leader).toBeNull();expect(other.carriedMonster).toBeNull();expect(game.player.seized).toBe(false);
    expect(core.carriedItem).toBe(carried);expect(game.monsters.filter(a=>a.carriedItem===carried)).toEqual([core]);
    other.carriedMonster=core;game.killMonster(core);expect(other.carriedMonster).toBeNull();
});
