// Copy to src/test/giants2_sdk_acceptance.test.ts and register in the normal suite when adopting.
// Diagnostic setup is intentionally separate from natural recordings.
import {afterEach,expect,it} from 'vitest';
import {createHeadlessGame} from './harness';
import {createExtensionRegistry} from '../ext/catalog';
import {Monster,MonsterState} from '../entities/Monster';
import monsters from '../data/monsters.json';
import {applyActorPoiseDamage} from '../engine/Core/PhasedAttackProduction';
import {logger} from '../engine/Systems/Logger';
function start(ids:readonly string[]){
 const game=createHeadlessGame(1,'test'),registry=createExtensionRegistry();
 const initialCommands=registry.create(registry.manifest(ids)).flatMap(m=>m.initialCommand?[JSON.stringify({module:m.id,...m.initialCommand})]:[]);
 game.startNewGame({seed:1,mode:'wizard',ruleSet:'extended',extensions:ids,initialCommands});game.animationEnabled=false;return game;
}
const json=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
afterEach(()=>logger.reset());
it('one safe-boundary collection already removes an unreachable dead source; repeated collection is idempotent',()=>{
 const game=start(['growth']),runtime=game.extensionRuntime!;
 const actor=new Monster(game.player.x-1,game.player.y,monsters.find(m=>m.id==='rat')!);
 game.monsters.push(actor);runtime.attachCreature(actor);
 const origin=runtime.causality.create('melee',actor.id);
 runtime.causality.withOrigin(origin,()=>actor.takeDamage(1000,true));game.killMonster(actor);
 (game as any).removeDeadMonsters();
 (game as any).collectExtensionComponents();const once=json(runtime.snapshot());
 (game as any).collectExtensionComponents();const twice=json(runtime.snapshot());
 expect((once.modules.growth as any).actors[actor.id]).toBeUndefined();
 expect(twice).toEqual(once);
});
it('a native decision that breaks player poise mid-wait drains recovery before returning input',()=>{
 const game=start(['combat']);
 const actor=new Monster(game.player.x-1,game.player.y,monsters.find(m=>m.id==='jackal')!);
 game.monsters.push(actor);game.extensionRuntime!.attachCreature(actor);actor.state=MonsterState.HUNTING;
 for(const other of game.monsters)other.ticksUntilTurn=10000;
 actor.ticksUntilTurn=50;let hits=0;
 actor.prepareNativeDecision=()=>false;
 actor.takeNativeDecision=()=>{if(!hits++)applyActorPoiseDamage(game,game.player.id,999);actor.ticksUntilTurn=10000;};
 game.executeCommand('wait');while(logger.pendingAcknowledgment)logger.acknowledgeNext();
 expect(hits).toBe(1);expect(game.isAdvancing).toBe(false);expect(game.lastAdvancementError).toBeNull();
 const row=game.extensionRuntime!.actorActionBinding()!.state.actors.find(a=>a.actorId===game.player.id)!;
 expect(row.staggerRemainingTicks).toBe(0);expect(game.player.ticksUntilTurn).toBe(0);expect(game.isInputLocked()).toBe(false);
 const n=game.exportRecording().events.length;game.executeCommand('wait');expect(game.exportRecording().events).toHaveLength(n+1);
});
