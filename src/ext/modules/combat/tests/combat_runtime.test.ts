import { continuingPrefix, extensionDigest, checkpointExtensionDigest } from '../../../../test/support/recordingV4';
import { installedModuleSubsets } from '../../../../test/support/installedExtensions';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import { createExtensionRegistry } from '../../../catalog';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import { getNextEntityId } from '../../../../entities/Creature';
import { createCombatModule } from '../index';
import { loadCombatDefinitionPack } from '../definitions';
import { combatAttackDefinitions } from '../production';
import { validateProductionActorAttackState } from '../../../actorActionValidation';
import { preparePhasedAttackCommand } from '../../../../engine/Core/PhasedAttackProduction';
import type { ProductionActorAttackState } from '../../../actorActions';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { TerrainType } from '../../../../engine/Map/Grid';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import type { Game } from '../../../../engine/Core/Game';
const command=(attackId='fixture.slash',facing='e')=>JSON.stringify({module:'combat',action:'attack',payload:{attackId,facing}});
function start(ids=['combat'],seed=8201){
 const game=createHeadlessGame(seed,'test'),registry=createExtensionRegistry();
 const initialCommands=registry.create(registry.manifest(ids)).flatMap(module=>module.initialCommand?[JSON.stringify({module:module.id,...module.initialCommand})]:[]);
 game.startNewGame({seed,mode:'test',ruleSet:'extended',extensions:ids,initialCommands});game.animationEnabled=false;return game;
}
function acknowledge(){while(logger.pendingAcknowledgment)logger.acknowledgeNext();}
function state(game:Game){return game.extensionRuntime!.actorActionBinding()!.state;}
function scene(type='rat'){
 const game=start();game.monsters=[];game.items=[];
 commitCreatureAnchor(game.player,{x:20,y:15});
 for(let x=15;x<=25;x++)for(let y=10;y<=20;y++)game.grid.setTerrain(x,y,TerrainType.FLOOR);
 const data=monsters.find(m=>m.id===type)! as unknown as MonsterData;
 const monster=new Monster(21,15,data);monster.state=MonsterState.HUNTING;monster.ticksUntilTurn=1000;monster.hp=monster.maxHp=1000;
 game.monsters.push(monster);(game as any).updateVision();return {game,monster};
}
afterEach(()=>{vi.restoreAllMocks();logger.reset();});
describe('3b production combat lifecycle',()=>{
 it('declares independent data-only production capabilities and exact compatible state',()=>{
  const module=createCombatModule();expect(module.actorActions).toBeDefined();expect(module.dependencies).toBeUndefined();
  expect(module.validateState(module.initialState())).toBe(true);
  expect(()=>validateProductionActorAttackState(module.initialState(),combatAttackDefinitions(loadCombatDefinitionPack()))).not.toThrow();
 });
 it('prepares all three attacks without either RNG, fee, timer, ID, or state write',()=>{
  const {game}=scene(),before=structuredClone(state(game)),random=rng.getState(),ticks=game.player.ticksUntilTurn;
  for(const id of ['fixture.slash','fixture.stomp','fixture.double-thrust'])expect(preparePhasedAttackCommand(game,command(id))).not.toBeNull();
  expect(state(game)).toEqual(before);expect(rng.getState()).toEqual(random);expect(game.player.ticksUntilTurn).toBe(ticks);
 });
 it.each(['fixture.slash','fixture.stomp','fixture.double-thrust'])('executes %s through native damage, one fee and the complete phase clock',(id)=>{
  const {game,monster}=scene(),attack=loadCombatDefinitionPack().attacks.find(a=>a.id===id)!;
  acknowledge();const hp=monster.hp;monster.defense=-10000;
  game.executeCommand('ext:command',command(id));
  expect(monster.hp).toBeLessThan(hp);expect(state(game).nextActionId).toBe(2);
  // 3c now regenerates during the declared recovery after the paid windup.
  expect(state(game).actors.find(a=>a.actorId===game.player.id)!.stamina).toBe(24-attack.cost+Math.floor(attack.recoveryTicks/20));
  expect(state(game).scheduler.bundles).toEqual([]);expect(state(game).actions).toEqual([]);expect(game.player.ticksUntilTurn).toBe(0);
  expect(()=>game.toSaveSnapshot()).not.toThrow();expect(()=>game.exportRecording()).not.toThrow();
 });
 it.each([false,true])('records one asynchronous risk decision %s with no premature writes',(answer)=>{
  const {game,monster}=scene();monster.isAlly=true;monster.setStatusDuration('discordant',1000);
  game.grid.getCell(monster.x,monster.y)!.isVisible=true;
  const before=structuredClone(state(game)),random=rng.getState(),turn=game.absoluteTurnNumber;
  game.onCommandConfirmRequest=()=>{};game.onConfirmRequest=()=>{throw new Error('Unexpected synchronous dialog');};
  acknowledge();game.executeCommand('ext:command',command());expect(game.pendingCommandConfirmation).not.toBeNull();
  expect(state(game)).toEqual(before);expect(rng.getState()).toEqual(random);
  game.resolveCommandDecision(game.pendingCommandConfirmation!.token,answer);
  expect(game.recordedInputEvents[game.recordedInputEvents.length-1]!.decisions).toEqual([answer]);
  if(!answer){expect(state(game)).toEqual(before);expect(rng.getState()).toEqual(random);expect(game.absoluteTurnNumber).toBe(turn);}
  else expect(state(game).nextActionId).toBe(2);
 });
 it('shows an NPC windup across player decisions and saves/rebinds its same clock',()=>{
  const {game,monster}=scene('ogre');monster.ticksUntilTurn=50;
  acknowledge();game.executeCommand('wait');
  const busy=state(game).scheduler.bundles.find(b=>b.decisionOwnerId===monster.id);expect(busy).toBeDefined();
  const saved=game.toSaveSnapshot(),before=structuredClone(state(game)),random=rng.getState();
  const loaded=createHeadlessGame(17,'test');expect(loaded.loadSnapshot(saved)).toBe(true);loaded.animationEnabled=false;
  expect(state(loaded)).toEqual(before);expect(rng.getState()).toEqual(random);
  acknowledge();loaded.executeCommand('wait');expect(state(loaded).revision).toBeGreaterThan(before.revision);
 });
 it('rejects corrupt scheduler mirrors before retiring the active run',()=>{
  const {game,monster}=scene('ogre');monster.ticksUntilTurn=50;acknowledge();game.executeCommand('wait');
  const saved=game.toSaveSnapshot(),before=game.player,runtime=game.extensionRuntime;
  const ledger=saved.extensions!.modules.combat as unknown as ProductionActorAttackState;
  ledger.scheduler.bundles[0]!.subactions[0]!.phaseRemainingTicks++;
  expect(game.loadSnapshot(saved)).toBe(false);expect(game.player).toBe(before);expect(game.extensionRuntime).toBe(runtime);
 });
 it('rejects future actor risk approvals while retaining historical dead target IDs',()=>{
  const {game,monster}=scene('ogre');
  const oldTarget=new Monster(24,15,monsters.find(data=>data.id==='rat')! as unknown as MonsterData);
  game.monsters.push(oldTarget);oldTarget.hp=0;game.monsters=game.monsters.filter(actor=>actor!==oldTarget);
  monster.ticksUntilTurn=50;acknowledge();game.executeCommand('wait');
  const saved=game.toSaveSnapshot(),player=game.player,runtime=game.extensionRuntime;
  const sub=(saved.extensions!.modules.combat as unknown as ProductionActorAttackState).actions[0]!.subactions[0]!;
  const future=saved.run.nextEntityId;
  sub.approvedRisks=[{targetId:future,risks:[{kind:'acid',target:{kind:'creature',id:future},message:'fixture approved risk'}]}];
  expect(game.loadSnapshot(saved)).toBe(false);expect(game.player).toBe(player);expect(game.extensionRuntime).toBe(runtime);
  sub.approvedRisks=[{targetId:oldTarget.id,risks:[{kind:'acid',target:{kind:'creature',id:oldTarget.id},message:'fixture historical risk'}]}];
  // A deliberately edited world has no authentic recording prefix.
  delete saved.run.recordingOrigin;
  expect(game.loadSnapshot(saved)).toBe(true);
 });
 it.each([{x:999999,y:0},{x:5,y:5}])('rejects forged locked geometry %j before replacing the old world',(cell)=>{
  const {game,monster}=scene('ogre');monster.ticksUntilTurn=50;acknowledge();game.executeCommand('wait');
  const saved=game.toSaveSnapshot(),player=game.player,runtime=game.extensionRuntime;
  (saved.extensions!.modules.combat as unknown as ProductionActorAttackState).actions[0]!.subactions[0]!.lockedCells=[cell];
  expect(game.loadSnapshot(saved)).toBe(false);expect(game.player).toBe(player);expect(game.extensionRuntime).toBe(runtime);
 });
 it.each(installedModuleSubsets(['growth', 'narrative']).map(subset => [['combat', ...subset]]))('plays and reloads enabled subset %j',(ids)=>{
  const game=start(ids as string[]);acknowledge();game.executeCommand('ext:command',command());
  const saved=game.toSaveSnapshot();expect(game.loadSnapshot(saved)).toBe(true);acknowledge();game.executeCommand('wait');
  expect(()=>game.exportRecording()).not.toThrow();
 });
 it('replays, seeks and continues genuine attack commands with both RNG streams and module checkpoints',()=>{
  const game=start();
  for(const attack of ['fixture.slash','fixture.stomp','fixture.double-thrust']){acknowledge();game.executeCommand('ext:command',command(attack));}
  const recording=structuredClone(game.exportRecording()),saved=game.toSaveSnapshot();
  const expected=structuredClone(state(game)),random=rng.getState();
  const replay=createHeadlessGame(81,'test');expect(replay.loadReplay(recording)).toBe(true);replay.animationEnabled=false;
  for(const event of recording.events){replay.replayStep(true);expect(replay.replayError).toBeNull();expect(extensionDigest(replay.extensionRuntime!.snapshot() ?? null)).toBe(checkpointExtensionDigest(event));}
  expect(state(replay)).toEqual(expected);expect(rng.getState()).toEqual(random);
  for(const index of [0,1,recording.events.length]){replay.replaySeek(index);expect(replay.replayError).toBeNull();expect(replay.replayCursor).toBe(index);}
  const loaded=createHeadlessGame(82,'test');expect(loaded.loadSnapshot(saved)).toBe(true);loaded.animationEnabled=false;
  acknowledge();loaded.executeCommand('ext:command',command('fixture.slash'));
  expect(loaded.exportRecording().events.slice(0,recording.events.length)).toEqual(continuingPrefix(recording));
 });
 it('records bounded real-command performance samples without claiming renderer FPS',()=>{
  const elapsed:number[]=[],cells:number[]=[];
  for(let i=0;i<9;i++){
   const {game}=scene();const id=['fixture.slash','fixture.stomp','fixture.double-thrust'][i%3]!;
   cells.push(preparePhasedAttackCommand(game,command(id))!.cells.length);acknowledge();
   const began=performance.now();game.executeCommand('ext:command',command(id));elapsed.push(performance.now()-began);
  }
  elapsed.sort((a,b)=>a-b);
  console.log('3b engine command performance',JSON.stringify({samples:elapsed.length,p50Ms:elapsed[4],p95Ms:elapsed[8],maxPreviewCells:Math.max(...cells)}));
  expect(elapsed.every(value=>Number.isFinite(value)&&value>=0)).toBe(true);
 },30000);
 it('rejects missing combat saves and recordings before retiring any old-world state',()=>{
  const game=start();acknowledge();game.executeCommand('wait');
  const saved=structuredClone(game.toSaveSnapshot()),recording=structuredClone(game.exportRecording());
  const player=game.player,runtime=game.extensionRuntime!,random=rng.getState(),nextId=getNextEntityId();
  const before=game.toSnapshot();before.savedAt=0;
  const unload=vi.spyOn(runtime,'unload');
  const remaining=registryFromDescriptors(catalog.getInstalledModuleDescriptors().filter(descriptor=>descriptor.id!=='combat'));
  vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(remaining);
  const onError=vi.fn();
  expect(game.loadSnapshot(saved,onError)).toBe(false);expect(game.loadReplay(recording,onError)).toBe(false);
  expect(onError).toHaveBeenCalledTimes(2);
  for(const [message] of onError.mock.calls){expect(message).toContain('combat');expect(message).toContain('not installed');}
  const after=game.toSnapshot();after.savedAt=0;
  // File refusal is visible feedback; it cannot change the persistent archive.
  expect(logger.displayMessages[logger.displayMessages.length-1]).toMatchObject({text:onError.mock.calls[0]![0]});
  expect(after.run.logger).toEqual(before.run.logger);
  expect(after).toEqual(before);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(nextId);
  expect(game.player).toBe(player);expect(game.extensionRuntime).toBe(runtime);expect(unload).not.toHaveBeenCalled();
 });
 it('rejects unknown/deferred commands and their recordings without allocating or advancing',()=>{
  const game=start();acknowledge();game.executeCommand('wait');
  const recording=structuredClone(game.exportRecording()),before=structuredClone(state(game)),random=rng.getState(),turn=game.absoluteTurnNumber;
  const player=game.player,runtime=game.extensionRuntime!,unload=vi.spyOn(runtime,'unload');
  for(const action of ['start','dodge','parry','rest','toString','__proto__']){
   const data=JSON.stringify({module:'combat',action,payload:{}});acknowledge();game.executeCommand('ext:command',data);
   expect(game.exportRecording().events).toEqual(recording.events);expect(state(game)).toEqual(before);expect(rng.getState()).toEqual(random);expect(game.absoluteTurnNumber).toBe(turn);
   const bad=structuredClone(recording);bad.events[0]!.action='ext:command';bad.events[0]!.data=data;
   expect(game.loadReplay(bad)).toBe(false);expect(game.player).toBe(player);expect(game.extensionRuntime).toBe(runtime);expect(unload).not.toHaveBeenCalled();
  }
 });
 it('keeps disabled runs without scheduler, declarations, components or combat views',()=>{
  const game=start([]);expect(game.extensionRuntime!.actorActionBinding()).toBeNull();
  expect(game.extensionRuntime!.readModuleView('combat')).toBeNull();acknowledge();game.executeCommand('wait');
  expect(game.toSaveSnapshot().extensions!.modules.combat).toBeUndefined();
 });
});
