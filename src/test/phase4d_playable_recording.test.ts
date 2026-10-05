import { afterEach, expect, it, vi } from 'vitest';
import '../i18n';
import { Game } from '../engine/Core/Game';
import { installProductionAttackBody, startProductionGame, emptyProductionArena, PRODUCTION_BODY_ID } from './support/productionComposite';
import { commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { ItemCategory } from '../engine/Items/Item';
import { MonsterState } from '../entities/Monster';
import { logger } from '../engine/Systems/Logger';
import { canonical } from '../ext/json';
import { writeFileSync } from 'node:fs';
afterEach(()=>{vi.restoreAllMocks();logger.reset();});
const detached=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const mechanics=(game:Game)=>{const s=detached(game.toSnapshot());s.savedAt=0;s.run.recordedInputEvents=[];s.run.recordedInputIndex=0;return canonical(s);};
function ack(){while(logger.pendingAcknowledgment)logger.acknowledgeNext();}
/** Fixed initialization is deliberately applied on start AND replay restart.
 * This is a functional encounter fixture, not natural generation evidence. */
function fixedStart(rest=false) {
    installProductionAttackBody();const native=Game.prototype.startNewGame;
    vi.spyOn(Game.prototype,'startNewGame').mockImplementation(function(this:Game,options){
        native.call(this,options);if(!options?.extensions?.includes('giants'))return;
        emptyProductionArena(this);this.onConfirmRequest=()=>true;
        const fire=this.extensionRuntime!.snapshot().foundation.world.entities.find(e=>e.owner==='combat'&&e.depth===this.depth)!;
        const at=rest?{x:Math.min(Math.max(fire.x+4,5),this.grid.width-5),y:Math.min(Math.max(fire.y,5),this.grid.height-5)}:{x:14,y:12};
        const core=this.createCompositeMonster(PRODUCTION_BODY_ID,at)!;
        core.state=rest?MonsterState.ASLEEP:MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');core.givenUpOnScent=true;
        commitCreatureAnchor(this.player,rest?{x:fire.x,y:fire.y}:{x:14,y:10});
        if(rest){core.setStatusDuration('invisible',1);this.player.hp=10;}
        else {for(const member of this.monsters.slice(1))member.setStatusDuration('stuck',1000);
            const axe=ItemLoader.spawnWeapon('axe',-1,-1)!;axe.damage='30-30';axe.enchantment=8;this.player.strength=30;this.player.inventory.addItem(axe);this.player.equippedWeapon=axe;
            const staff=ItemLoader.spawnStaff('staff_of_discord',-1,-1)!;this.player.inventory.addItem(staff);}
        (this as any).updateVision();ack();
    });
    return ()=>startProductionGame(['giants','combat'],7318,rest?'normal':'wizard');
}
function verifyReplay(fresh:()=>Game,recording:ReturnType<Game['exportRecording']>,points:Map<number,string>) {
    const replay=fresh();expect(replay.loadReplay(recording)).toBe(true);replay.animationEnabled=false;
    while(replay.replayCursor<recording.events.length){replay.replayStep(true);expect(replay.replayError).toBeNull();const wanted=points.get(replay.replayCursor);if(wanted)expect(mechanics(replay)).toBe(wanted);}
    for(const [index,wanted] of [...points].reverse()){replay.replaySeek(index);expect(replay.replayError).toBeNull();expect(replay.replayCursor).toBe(index);expect(mechanics(replay)).toBe(wanted);}
}
it('actual paid member windup, axe break and shared discord save, continue, replay and seek with fixed initialization',()=>{
    const fresh=fixedStart(),game=fresh(),core=game.monsters[0]!,points=new Map<number,string>();
    game.executeCommand('wait');const state=game.extensionRuntime!.actorActionBinding()!.state;
    expect(state.scheduler.bundles[0]!.subactions).toHaveLength(2);expect(state.actions[0]!.paidCost).toBeGreaterThan(0);
    points.set(game.exportRecording().events.length,mechanics(game));game.executeCommand('move',{x:0,y:1});ack();
    expect(game.bodyGroups![0]!.appliedBreaks.length).toBeGreaterThan(0);expect(core.hp).toBeGreaterThan(0);
    points.set(game.exportRecording().events.length,mechanics(game));const save=detached(game.toSaveSnapshot());
    const staff=game.player.inventory.items.find(i=>i.category===ItemCategory.STAFF)!;
    const target=game.monsters.find(m=>m!==core)!;game.executeItemCommand('use',staff);game.executeCommand('mouse_travel',{...target.loc});ack();
    expect(core.hasStatus('discordant')).toBe(true);points.set(game.exportRecording().events.length,mechanics(game));
    game.executeCommand('wait');ack();const recording=detached(game.exportRecording()),final=mechanics(game);points.set(recording.events.length,final);
    const loaded=fresh();expect(loaded.loadSnapshot(save)).toBe(true);loaded.animationEnabled=false;
    for(const event of recording.events.slice(save.run.recordedInputIndex)){loaded.executeCommand(event.action,event.data);ack();}
    expect(mechanics(loaded)).toBe(final);expect(loaded.exportRecording().events).toEqual(recording.events);
    verifyReplay(fresh,recording,points);
});
it('a real bonfire rest interrupted by the emerging body records its decision and replays/seeks the exact receipt',()=>{
    const fresh=fixedStart(true),game=fresh(),fire=game.extensionRuntime!.snapshot().foundation.world.entities.find(e=>e.owner==='combat'&&e.depth===1)!;
    game.executeCommand('ext:command',JSON.stringify({module:'combat',action:'rest',payload:{bonfireId:fire.id}}));ack();
    expect(game.extensionRuntime!.actorActionBinding()!.state.bonfires!.receipts[0]).toMatchObject({result:'interrupted',reason:'threat'});
    const recording=detached(game.exportRecording());expect(recording.events).toHaveLength(1);expect(recording.events[0]!.decisions).toEqual([true]);
    verifyReplay(fresh,recording,new Map([[1,mechanics(game)]]));
});
it('normal finite D15 equipment defeats the unmodified formal shale weaver through public commands',()=>{
    // Loadout and open encounter initialization are a functional fixture. The
    // separate seed7309 test covers the real generated arena and natural birth.
    const game=startProductionGame(['giants'],7326,'normal');emptyProductionArena(game);
    game.player.hp=game.player.maxHp=30;
    const core=game.createCompositeMonster('giants.shale-weaver-body',{x:20,y:12})!;
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
    writeFileSync('/private/tmp/p4d-complete-normal-encounter.json',JSON.stringify({seed:7326,mode:game.mode,modules:['giants'],commands,remainingHp:game.player.hp,maxHp:game.player.maxHp,usedHealingPotions:used,totalHealingPotions:2,weapon:'+3 axe',armor:'+3 chain mail',coreHp:core.hp,breaks:core.spatial?.bodyMember?8:undefined},null,2)+'\n');
    expect(game.isGameOver).toBe(false);expect(core.hp).toBe(0);expect(game.player.hp).toBeGreaterThan(0);expect(used).toBeLessThanOrEqual(2);expect(game.lastAdvancementError).toBeNull();
});
