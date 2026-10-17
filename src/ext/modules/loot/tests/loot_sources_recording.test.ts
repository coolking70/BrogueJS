import {expect,it} from 'vitest';
import {arriveNatural,attackNatural,settle,world,routeCommand} from '../../giants/tests/giants2NaturalFixture';
import {startGiants,json} from '../../giants/tests/naturalFixture';
import {readCreatureBirth} from '../../../birth';
import type {Game} from '../../../../engine/Core/Game';
it('natural copper parts: command attacks, broken save continuation, full replay and seek have exact world/RNG/receipts',()=>{
 const {game:g,boss}=arriveNatural('copper',3,['loot','giants']);
 expect(readCreatureBirth(boss)?.creationReason).toBe('natural');
 const id=boss.id,group=g.bodyGroups!.find(b=>b.coreId===id)!,events=g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId;
 expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.parts![id]!.remaining).toHaveLength(4);
 let save:ReturnType<Game['toSaveSnapshot']>|undefined,cut=0,cutWorld='';
 for(let n=0;n<600&&boss.hp>0&&!g.isGameOver;n++){
  attackNatural(g,'copper',id);settle(g);
  if(!save&&group.appliedBreaks.length){save=json(g.toSaveSnapshot());cut=g.recordedInputEvents.length;cutWorld=world(g);}
 }
 expect(save).toBeDefined();expect(group.appliedBreaks.length).toBeGreaterThan(0);
 expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId).toBeGreaterThan(events);
 const partItems=[...g.items,...g.player.inventory.items].filter(i=>(i.moduleData?.loot as any)?.origin.source==='part');
 expect(partItems).toHaveLength(2);
 const reward=partItems[0]!;for(let n=0;n<100&&!g.player.inventory.items.some(i=>i.id===reward.id);n++){if(g.player.x===reward.loc.x&&g.player.y===reward.loc.y)g.executeCommand('pickup');else routeCommand(g,reward.loc);settle(g);}
 expect(g.player.inventory.items.some(i=>i.id===reward.id)).toBe(true);
 // Real stairs away/back must not recreate terminal bodies or part items.
 const depth=g.depth;for(let n=0;n<300&&g.depth===depth;n++)routeCommand(g,g.levelSeeds[depth-1]!.upStairsLoc,undefined,'stairs_up');
 expect(g.depth).toBe(depth-1);for(let n=0;n<300&&g.depth===depth-1;n++)routeCommand(g,g.levelSeeds[depth-2]!.downStairsLoc);expect(g.depth).toBe(depth);
 const recording=json(g.exportRecording()),final=world(g);
 const continuation=startGiants(['loot','giants'],3,'wizard');expect(continuation.loadSnapshot(save!)).toBe(true);expect(world(continuation)).toBe(cutWorld);
 for(const event of recording.events.slice(cut)){continuation.executeCommand(event.action,event.data);for(const answer of event.decisions??[])if(continuation.pendingCommandConfirmation)continuation.resolveCommandDecision(continuation.pendingCommandConfirmation.token,answer);settle(continuation);}
 expect(world(continuation)).toBe(final);expect(continuation.exportRecording().events).toEqual(recording.events);
 const replay=startGiants(['loot','giants'],3,'wizard');expect(replay.loadReplay(recording)).toBe(true);
 while(replay.replayCursor<recording.events.length){replay.replayStep(true);expect(replay.replayError).toBeNull();}
 expect(world(replay)).toBe(final);
 replay.replaySeek(cut);expect(replay.replayError).toBeNull();expect(world(replay)).toBe(cutWorld);
 replay.replaySeek(recording.events.length);expect(replay.replayError).toBeNull();expect(world(replay)).toBe(final);
},180000);
