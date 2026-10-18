import {describe,it,expect} from 'vitest';
import '../../../../i18n';
import {Game} from '../../../../engine/Core/Game';
import {Player} from '../../../../entities/Player';
import {logger} from '../../../../engine/Systems/Logger';
import {createExtensionRegistry} from '../../../../ext/catalog';
import {rng} from '../../../../engine/Random';
function start(count=2){const g=new Game({seed:1});g.startNewGame({seed:42,ruleSet:'extended',extensions:['party'],extensionConfigurations:{party:{schema:1,members:count}},initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:count}})]});g.animationEnabled=false;return g;}
function wait(g:Game,id:number){while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeCommand('party:actor-step',{kind:'party:actor-step',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:id,intent:{kind:'wait'}});}
describe('P1a public lifecycle',()=>{
 it('creates independent growth components through one recorded batch',()=>{
    const registry=createExtensionRegistry(),manifest=registry.manifest(['party','growth']);
    const initialCommands=registry.create(manifest).flatMap(m=>m.initialCommand?[JSON.stringify({module:m.id,...m.initialCommand})]:[]);
    const g=new Game({seed:1});g.startNewGame({seed:42,ruleSet:'extended',extensions:['party','growth'],initialCommands});g.animationEnabled=false;
    const snap=g.toSaveSnapshot();for(const actor of g.controlledActors)expect(snap.extensions!.components[actor.id]?.['growth:progression']).toBeTruthy();
    const h=new Game({seed:1});expect(h.loadSnapshot(JSON.parse(JSON.stringify(snap)))).toBe(true);g.disposeRecording();h.disposeRecording();
 });
 it.each([1,2,4])('owns %i members and a stable primary',count=>{const g=start(count);expect(g.controlledActors).toHaveLength(count);expect(g.player).toBeInstanceOf(Player);for(const actor of g.party!.actors.values())expect(actor).not.toBeInstanceOf(Player);expect(new Set(g.controlledActors.map(a=>a.inventory)).size).toBe(count);g.disposeRecording();});
 it('rejects stale/foreign actors before recording or RNG',()=>{const g=start(),before=g.exportRecording(),random=rng.getState();expect(()=>g.executeCommand('party:actor-step',{kind:'party:actor-step',schema:1,expectedRevision:1,issuerSlot:'local:0',actorId:g.player.id,intent:{kind:'wait'}})).toThrow('STALE_REVISION');expect(g.exportRecording().events).toEqual(before.events);expect(rng.getState()).toEqual(random);g.disposeRecording();});
 it('pauses for a second same-tick decision and then advances one world',()=>{const g=start(),[a,b]=g.controlledActors;const turns=g.absoluteTurnNumber;wait(g,a!.id);expect(g.absoluteTurnNumber).toBe(turns);expect(a!.ticksUntilTurn).toBeGreaterThan(0);wait(g,b!.id);expect(g.absoluteTurnNumber).toBe(turns+1);expect(a!.ticksUntilTurn).toBe(0);expect(b!.ticksUntilTurn).toBe(0);g.disposeRecording();});
 it('saves both entities and replays explicit actor commands',()=>{const g=start(),ids=g.controlledActors.map(a=>a.id);wait(g,ids[0]!);wait(g,ids[1]!);const save=JSON.parse(JSON.stringify(g.toSaveSnapshot())),recording=g.exportRecording();expect(save.version).toBe(9);expect(recording.version).toBe(6);expect(recording.initialDigest.domains.party).toBeTruthy();const h=new Game({seed:2});expect(h.loadSnapshot(save)).toBe(true);expect(h.controlledActors.map(a=>[a.id,a.hp,a.ticksUntilTurn])).toEqual(g.controlledActors.map(a=>[a.id,a.hp,a.ticksUntilTurn]));expect(h.loadReplay(recording)).toBe(true);while(h.replayCursor<recording.events.length&&!h.replayError)h.replayStep(true);expect(h.replayError).toBeNull();g.disposeRecording();h.disposeRecording();});
});
