import { installRecordingScene } from '../../../../test/support/recordingV4';
import { afterEach, expect, it, vi } from 'vitest';
import "../../../../i18n";
import { Game } from '../../../../engine/Core/Game';
import { installProductionAttackBody, startProductionGame, emptyProductionArena, PRODUCTION_BODY_ID } from '../../../../test/support/productionComposite';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { ItemCategory } from '../../../../engine/Items/Item';
import { MonsterState } from '../../../../entities/Monster';
import { logger } from '../../../../engine/Systems/Logger';
import { canonical } from '../../../json';

afterEach(()=>{vi.restoreAllMocks();logger.reset();});
const detached=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const mechanics=(game:Game)=>{const s=detached(game.toSnapshot());s.savedAt=0;return canonical(s);};
function ack(){while(logger.pendingAcknowledgment)logger.acknowledgeNext();}
/** Fixed initialization is deliberately applied on start AND replay restart.
 * This is a functional encounter fixture, not natural generation evidence. */
function fixedStart(rest=false) {
    installProductionAttackBody();
    installRecordingScene((game) => {
        if(!game.extensionRuntime?.manifest.modules.some(m => m.id === 'body-fixture'))return;
        emptyProductionArena(game);game.onConfirmRequest=()=>true;
        const fire=game.extensionRuntime!.snapshot().foundation.world.entities.find(e=>e.owner==='combat'&&e.depth===game.depth)!;
        const at=rest?{x:Math.min(Math.max(fire.x+4,5),game.grid.width-5),y:Math.min(Math.max(fire.y,5),game.grid.height-5)}:{x:14,y:12};
        const core=game.createCompositeMonster(PRODUCTION_BODY_ID,at)!;
        core.state=rest?MonsterState.ASLEEP:MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');core.givenUpOnScent=true;
        commitCreatureAnchor(game.player,rest?{x:fire.x,y:fire.y}:{x:14,y:10});
        if(rest){core.setStatusDuration('invisible',1);game.player.hp=10;}
        else {for(const member of game.monsters.slice(1))member.setStatusDuration('stuck',1000);
            const axe=ItemLoader.spawnWeapon('axe',-1,-1)!;axe.damage='30-30';axe.enchantment=8;game.player.strength=30;game.player.inventory.addItem(axe);game.player.equippedWeapon=axe;
            const staff=ItemLoader.spawnStaff('staff_of_discord',-1,-1)!;game.player.inventory.addItem(staff);}
        (game as any).updateVision();ack();
    });
    return ()=>startProductionGame(['body-fixture','combat'],7318,rest?'normal':'wizard');
}
function verifyReplay(fresh:()=>Game,recording:ReturnType<Game['exportRecording']>,points:Map<number,string>) {
    const replay=fresh();expect(replay.loadReplay(recording)).toBe(true);replay.animationEnabled=false;
    while(replay.replayCursor<recording.events.length){replay.replayStep(true);expect(replay.replayError).toBeNull();const wanted=points.get(replay.replayCursor);if(wanted)expect(mechanics(replay)).toBe(wanted);}
    for(const [index,wanted] of [...points].reverse()){replay.replaySeek(index);expect(replay.replayError).toBeNull();expect(replay.replayCursor).toBe(index);expect(mechanics(replay)).toBe(wanted);}
}
it('actual paid member windup, axe break and shared discord save, continue, replay and seek with fixed initialization',()=>{
    const fresh=fixedStart(),game=fresh(),core=game.monsters[0]!,points=new Map<number,string>();
    game.executeCommand('wait');const state=game.extensionRuntime!.actorActionBinding()!.state;
    expect(game.actorActions!.bundles[0]!.subactions).toHaveLength(2);expect(state.actions[0]!.paidCost).toBeGreaterThan(0);
    points.set(game.exportRecording().events.length,mechanics(game));game.executeCommand('move',{x:0,y:1});ack();
    expect(game.bodyGroups![0]!.appliedBreaks.length).toBeGreaterThan(0);expect(core.hp).toBeGreaterThan(0);
    points.set(game.exportRecording().events.length,mechanics(game));const save=detached(game.toSaveSnapshot());
    const staff=game.player.inventory.items.find(i=>i.category===ItemCategory.STAFF)!;
    const target=game.monsters.find(m=>m!==core)!;game.executeItemCommand('use',staff);game.executeCommand('mouse_travel',{...target.loc});ack();
    expect(core.hasStatus('discordant')).toBe(true);points.set(game.exportRecording().events.length,mechanics(game));
    game.executeCommand('wait');ack();const recording=detached(game.exportRecording()),final=mechanics(game);points.set(recording.events.length,final);
    const loaded=fresh();expect(loaded.loadSnapshot(save)).toBe(true);loaded.animationEnabled=false;
    for(const event of recording.events.slice(save.run.recordingOrigin!.events.length)){loaded.executeCommand(event.action,event.data);ack();}
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
