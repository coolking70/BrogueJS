import { installRecordingScene } from '../../../../test/support/recordingV4';
import { afterEach, expect, it, vi } from 'vitest';
import "../../../../i18n";
import { Game } from '../../../../engine/Core/Game';
import { startProductionGame, emptyProductionArena, installBodyFixture } from '../../../../test/support/productionComposite';
import { commitCreatureAnchor, footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { MonsterState } from '../../../../entities/Monster';
import { logger } from '../../../../engine/Systems/Logger';
import { canonical } from '../../../json';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import { extensionDataFingerprint } from '../../../fingerprint';
import type { ActorAttackDefinitions } from '../../../actorActions';
import type { Json } from '../../../types';
import { TerrainType as T } from '../../../../engine/Map/Grid';
afterEach(()=>{vi.restoreAllMocks();logger.reset();});
const detached=<V>(v:V):V=>JSON.parse(JSON.stringify(v));
const mechanics=(game:Game)=>{const s=detached(game.toSnapshot());s.savedAt=0;return canonical(s);};
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
  installRecordingScene((game) => {
    if(!game.extensionRuntime?.manifest.modules.some(m => m.id === 'body-fixture'))return;
    emptyProductionArena(game);game.onConfirmRequest=()=>true;
    const fire=rest?game.extensionRuntime!.snapshot().foundation.world.entities.find(e=>e.owner==='combat'&&e.depth===1)!:null;
    const at=fire?{x:Math.min(Math.max(fire.x+4,5),game.grid.width-5),y:Math.min(Math.max(fire.y,5),game.grid.height-5)}:{x:20,y:12};
    const core=game.createModuleMonster('body-fixture.abyssal-colossus',at)!;core.state=MonsterState.HUNTING;core.behaviorFlags.add('MONST_ALWAYS_HUNTING');core.givenUpOnScent=true;
    core.hp=rest?129:131;core.defense=0;
    if(rest){core.setStatusDuration('invisible',1000);core.ticksUntilTurn=200;commitCreatureAnchor(game.player,{x:fire!.x,y:fire!.y});game.player.hp=10;}
    else {commitCreatureAnchor(game.player,{x:at.x-1,y:at.y});const weapon=ItemLoader.spawnWeapon('mace',-1,-1)!;weapon.damage='4-4';weapon.enchantment=0;game.player.strength=30;game.player.inventory.addItem(weapon);game.player.equippedWeapon=weapon;}
    if(noSpace){for(let x=0;x<game.grid.width;x++)for(let y=0;y<game.grid.height;y++)game.grid.setTerrain(x,y,T.WALL);for(const p of footprintOf(core))game.grid.setTerrain(p.x,p.y,T.FLOOR);game.grid.setTerrain(game.player.x,game.player.y,T.FLOOR);}
    (game as any).updateVision();ack();
  });
  return ()=>startProductionGame(combat?['body-fixture','combat']:['body-fixture'],7339,rest?'normal':'wizard');
}
function replay(fresh:()=>Game,recording:ReturnType<Game['exportRecording']>,points:Map<number,string>) {
  const game=fresh();expect(game.loadReplay(recording)).toBe(true);game.animationEnabled=false;
  while(game.replayCursor<recording.events.length){game.replayStep(true);expect(game.replayError).toBeNull();const expected=points.get(game.replayCursor);if(expected)expect(mechanics(game)).toBe(expected);}
  for(const [index,expected] of [...points].reverse()){game.replaySeek(index);expect(game.replayError).toBeNull();expect(game.replayCursor).toBe(index);expect(mechanics(game)).toBe(expected);}
}

it('a paid core windup is cancelled by a body transition, keeps recovery/payment and never replays its old warning',()=>{
  const fresh=fixture('split',true),game=fresh(),core=game.monsters[0]!;core.hp=260;
  game.executeCommand('wait');game.executeCommand('wait');ack();
  const state=game.extensionRuntime!.actorActionBinding()!.state,bundle=game.actorActions!.bundles[0]!;expect(bundle).toBeTruthy();const paid=state.actions[0]!.paidCost;expect(paid).toBeGreaterThan(0);
  core.hp=129;expect((game as any).tryActiveBodyTransition(core)).toBe(true);
  expect(bundle.subactions.every(c=>c.cancelled||['break-recovery','recovery'].includes(c.phases[c.phaseIndex]?.kind??'')||c.phaseIndex===c.phases.length)).toBe(true);
  expect(state.actions[0]!.paidCost).toBe(paid);expect(state.actions.flatMap(a=>a.subactions).every(s=>s.lockedCells.length===0)).toBe(true);
  const save=detached(game.toSaveSnapshot());game.executeCommand('wait');ack();const after=mechanics(game);expect(game.loadSnapshot(save)).toBe(true);game.executeCommand('wait');ack();expect(mechanics(game)).toBe(after);
});
it('bonfire rest ends immediately when a hidden source converts and its visible descendants appear; one receipt and exact replay',()=>{
  const fresh=fixture('split',true,false,true),game=fresh(),fire=game.extensionRuntime!.snapshot().foundation.world.entities.find(e=>e.owner==='combat'&&e.depth===1)!;
  game.executeCommand('ext:command',JSON.stringify({module:'combat',action:'rest',payload:{bonfireId:fire.id}}));ack();
  expect(game.monsters).toHaveLength(2);const state=game.extensionRuntime!.actorActionBinding()!.state;
  expect(state.bonfires!.receipts).toHaveLength(1);expect(state.bonfires!.receipts[0]).toMatchObject({result:'interrupted',reason:'threat'});
  const recording=detached(game.exportRecording());replay(fresh,recording,new Map([[recording.events.length,mechanics(game)]]));
},60000);
