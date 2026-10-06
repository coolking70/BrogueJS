import { afterEach, expect, it, vi } from 'vitest';
import '../i18n';
import { Game } from '../engine/Core/Game';
import { startProductionGame, emptyProductionArena, installBodyFixture } from './support/productionComposite';
import { commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { MonsterState } from '../entities/Monster';
import { logger } from '../engine/Systems/Logger';
import { canonical } from '../ext/json';
import * as catalog from '../ext/catalog';
import { registryFromDescriptors } from '../ext/descriptor';
import { extensionDataFingerprint } from '../ext/fingerprint';
import type { ActorAttackDefinitions } from '../ext/actorActions';
import type { Json } from '../ext/types';
import { TerrainType as T } from '../engine/Map/Grid';
afterEach(()=>{vi.restoreAllMocks();logger.reset();});
const detached=<V>(v:V):V=>JSON.parse(JSON.stringify(v));
const mechanics=(game:Game)=>{const s=detached(game.toSnapshot());s.savedAt=0;s.run.recordedInputEvents=[];s.run.recordedInputIndex=0;return canonical(s);};
const ack=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
function fixture(reason: 'phase'|'split'|'clone'|'summon', combat=false, noSpace=false, rest=false) {
  installBodyFixture();
  const descriptors=catalog.getInstalledModuleDescriptors(),registry=registryFromDescriptors(descriptors.map(d=>{
    const module=d.create();
    if(d.id==='body-fixture') {
      const transition=module.bodyTransitions![0]!;
      const results=Array.from({length:reason==='split'?2:1},()=>({formId:reason==='phase'?'body-fixture.shale-weaver':reason==='split'?'body-fixture.ridgeback':'body-fixture.abyssal-colossus',memberMap:[]}));
      const moves=[{...transition,transition:{...transition.transition,reason,results,statuses:rest?'clear' as const:transition.transition.statuses,hp:reason==='split'?'conserve' as const:['clone','summon'].includes(reason)?'current' as const:'ratio' as const}}];
      const rules={...module.rules!,fingerprint:extensionDataFingerprint(moves)};
      return {...d,rules,create:()=>({...module,rules,bodyTransitions:moves})};
    }
    if(d.id==='combat') {
      const definitions=structuredClone(module.actorActions!.definitions) as unknown as ActorAttackDefinitions;
      definitions.nativeProfiles.push({monsterId:'body-fixture.abyssal-colossus',profileId:'combat.follow-thrust'});
      const rules={...module.rules!,fingerprint:extensionDataFingerprint(definitions)};
      return {...d,rules,create:()=>({...module,rules,actorActions:{...module.actorActions!,definitions:definitions as unknown as Json}})};
    }
    return d;
  }));
  vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(registry);
  const native=Game.prototype.startNewGame;
  vi.spyOn(Game.prototype,'startNewGame').mockImplementation(function(this:Game,options){
    native.call(this,options);if(!options?.extensions?.includes('body-fixture'))return;
    emptyProductionArena(this);this.onConfirmRequest=()=>true;
    const fire=rest?this.extensionRuntime!.snapshot().foundation.world.entities.find(e=>e.owner==='combat'&&e.depth===1)!:null;
    const at=fire?{x:Math.min(Math.max(fire.x+4,5),this.grid.width-5),y:Math.min(Math.max(fire.y,5),this.grid.height-5)}:{x:20,y:12};
    const core=this.createModuleMonster('body-fixture.abyssal-colossus',at)!;core.state=MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');core.givenUpOnScent=true;
    core.hp=rest?129:131;core.defense=0;
    if(rest){core.setStatusDuration('invisible',1000);core.ticksUntilTurn=200;commitCreatureAnchor(this.player,{x:fire!.x,y:fire!.y});this.player.hp=10;}
    else {commitCreatureAnchor(this.player,{x:at.x-1,y:at.y});const weapon=ItemLoader.spawnWeapon('mace',-1,-1)!;weapon.damage='4-4';weapon.enchantment=0;this.player.strength=30;this.player.inventory.addItem(weapon);this.player.equippedWeapon=weapon;}
    if(noSpace){for(let x=0;x<this.grid.width;x++)for(let y=0;y<this.grid.height;y++)this.grid.setTerrain(x,y,T.WALL);for(const p of footprintOf(core))this.grid.setTerrain(p.x,p.y,T.FLOOR);this.grid.setTerrain(this.player.x,this.player.y,T.FLOOR);}
    (this as any).updateVision();ack();
  });
  return ()=>startProductionGame(combat?['body-fixture','combat']:['body-fixture'],7339,rest?'normal':'wizard');
}
function replay(fresh:()=>Game,recording:ReturnType<Game['exportRecording']>,points:Map<number,string>) {
  const game=fresh();expect(game.loadReplay(recording)).toBe(true);game.animationEnabled=false;
  while(game.replayCursor<recording.events.length){game.replayStep(true);expect(game.replayError).toBeNull();const expected=points.get(game.replayCursor);if(expected)expect(mechanics(game)).toBe(expected);}
  for(const [index,expected] of [...points].reverse()){game.replaySeek(index);expect(game.replayError).toBeNull();expect(game.replayCursor).toBe(index);expect(mechanics(game)).toBe(expected);}
}
it.each(['phase','split','clone','summon'] as const)('%s before, after and waiting snapshots continue/record/replay/seek exactly through the public command boundary',reason=>{
  const fresh=fixture(reason),game=fresh(),core=game.monsters[0]!,points=new Map<number,string>();
  game.executeCommand('wait');ack();points.set(game.exportRecording().events.length,mechanics(game));
  const initial=detached(game.toSaveSnapshot());expect(game.loadSnapshot(initial)).toBe(true);
  for(let i=0;i<12&&!game.monsters[0]!.bodyTransitionHistory?.length;i++){
    if(game.monsters[0]!.hp>130)game.executeCommand('move',{x:1,y:0});else game.executeCommand('wait');ack();
    points.set(game.exportRecording().events.length,mechanics(game));
  }
  expect(game.monsters[0]!.bodyTransitionHistory).toEqual(['body-fixture.colossus-fracture']);expect(game.lastAdvancementError).toBeNull();
  expect(game.monsters).toHaveLength(reason==='phase'?9:2);expect(core.id).toBe(game.monsters[0]!.id);
  const saved=detached(game.toSaveSnapshot());for(let i=0;i<3;i++){game.executeCommand('wait');ack();points.set(game.exportRecording().events.length,mechanics(game));}
  const recording=detached(game.exportRecording()),final=mechanics(game),loaded=fresh();expect(loaded.loadSnapshot(saved)).toBe(true);loaded.animationEnabled=false;
  for(const event of recording.events.slice(saved.run.recordedInputIndex)){loaded.executeCommand(event.action,event.data);ack();}
  expect(mechanics(loaded)).toBe(final);expect(loaded.exportRecording().events).toEqual(recording.events);replay(fresh,recording,points);
},60000);
it('the failed active split receipt and paid positive wait survive load, replay, seek and resumed recording',()=>{
  const fresh=fixture('split',false,true),game=fresh();
  for(let i=0;i<12&&!game.monsters[0]!.bodyTransitionHistory?.length;i++){game.executeCommand(game.monsters[0]!.hp>130?'move':'wait',{x:1,y:0});ack();}
  expect(game.monsters).toHaveLength(1);expect(game.monsters[0]!.bodyTransitionHistory).toEqual(['body-fixture.colossus-fracture']);
  const save=detached(game.toSaveSnapshot()),before=mechanics(game),index=game.exportRecording().events.length;game.executeCommand('wait');ack();
  const record=detached(game.exportRecording()),after=mechanics(game),loaded=fresh();expect(loaded.loadSnapshot(save)).toBe(true);loaded.executeCommand('wait');ack();expect(mechanics(loaded)).toBe(after);
  replay(fresh,record,new Map([[index,before],[record.events.length,after]]));
},60000);

it('normal finite equipment defeats the independent colossus fixture and both active split descendants via actual commands',()=>{
  const game=startProductionGame(['body-fixture'],7341,'normal');emptyProductionArena(game);game.player.hp=game.player.maxHp=30;
  const core=game.createModuleMonster('body-fixture.abyssal-colossus',{x:20,y:12})!;core.state=MonsterState.HUNTING;core.givenUpOnScent=true;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');
  game.player.strength=17;const axe=ItemLoader.spawnWeapon('axe',-1,-1)!;axe.enchantment=6;game.player.inventory.addItem(axe);game.player.equippedWeapon=axe;
  const armor=ItemLoader.spawnArmor('chain_mail',-1,-1)!;armor.enchantment=6;game.player.inventory.addItem(armor);game.player.equippedArmor=armor;
  const healing=Array.from({length:2},()=>ItemLoader.spawnPotion('potion_of_healing',-1,-1)!);healing.forEach(p=>game.player.inventory.addItem(p));
  commitCreatureAnchor(game.player,{x:19,y:12});(game as any).updateVision();game.onConfirmRequest=()=>true;let used=0;
  for(let commands=0;commands<120&&game.monsters.some(m=>m.hp>0)&&!game.isGameOver;commands++){
    if(game.player.hp<15&&used<healing.length){game.executeItemCommand('quaff',healing[used++]!);ack();continue;}
    const cells=game.monsters.filter(m=>m.hp>0).flatMap(m=>footprintOf(m)),at=game.player.loc;
    const target=cells.sort((a,b)=>Math.max(Math.abs(a.x-at.x),Math.abs(a.y-at.y))-Math.max(Math.abs(b.x-at.x),Math.abs(b.y-at.y))||a.y-b.y||a.x-b.x)[0]!;
    game.executeCommand('move',{x:Math.sign(target.x-at.x),y:Math.sign(target.y-at.y)});ack();
  }
  expect(core.bodyTransitionHistory).toEqual(['body-fixture.colossus-fracture']);expect(game.isGameOver).toBe(false);expect(game.monsters.every(m=>m.hp<=0)).toBe(true);expect(game.player.hp).toBeGreaterThan(0);expect(used).toBeLessThanOrEqual(2);expect(game.lastAdvancementError).toBeNull();
});
