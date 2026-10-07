import { expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { worldHarnessGame } from '../../../testing/worldHarness';
import { workPositions } from '../../../../engine/Core/WorldWorkWorld';
import { NaturalForagingDriver, edibleContext, foragingFinal, startNatural, copyJson } from './traceHelpers';

function cost(h:ReturnType<typeof startNatural>) {const g=worldHarnessGame(h),s=g.toSnapshot();return {inventory:copyJson(g.player.inventory.items),nutrition:g.player.nutrition,tick:s.run.currentTick,turn:g.absoluteTurnNumber};}
export function captureNatural(kind:'A'|'B',destination:string) {
 const attempts:{seed:number;result:string}[]=[];
 for(let seed=1;seed<=64;seed++){
  const modules=kind==='A'?['foraging']:['crafting','foraging'],h=startNatural(seed,modules),d=new NaturalForagingDriver(h);
  try {
   const node=d.nearestFungus();
   if(kind==='A'){
    d.harvestNode(node,'foraging',3);
    const id=edibleContext(h).inventory.find(i=>i.definitionId?.startsWith('foraging.'))!.itemId;
    const before=cost(h),index=d.game.recordedInputEvents.length;
    d.eat(id,false);expect(cost(h)).toEqual(before);expect(d.game.recordedInputEvents).toHaveLength(index+1);
    const beforeCount=d.item(id).quantity;
    d.eat(id,true);expect(d.item(id).quantity).toBe(beforeCount-1);expect(d.game.toSnapshot().run.currentTick).toBeGreaterThan(before.tick);
    const at={...d.game.player.loc},target=workPositions(d.game,at).find(p=>p.x!==at.x||p.y!==at.y);if(!target)throw Error('No throw target');
    d.command('item:execute',`throw|${d.item(id).inventoryLetter}`);d.command('mouse_travel',target);
    let unknown=edibleContext(h).inventory.find(i=>i.definitionId?.startsWith('foraging.')&&i.knowledge!=='known');
    if(!unknown){const other=h.world5()!.nodes.find(n=>n.owner==='foraging'&&n.interactableId!==node);if(!other)throw Error('No unknown fungus to call');d.harvestNode(other.interactableId);unknown=edibleContext(h).inventory.find(i=>i.definitionId?.startsWith('foraging.')&&i.knowledge!=='known');}
    if(!unknown)throw Error('No unknown fungus to call');
    d.command('item:execute',`call|${d.item(unknown.itemId).inventoryLetter}|旅途之星`);
    d.walk([d.game.levelSeeds[d.game.depth-1]!.downStairsLoc]);d.command('stairs_down');
    if(d.game.depth!==2)throw Error('Did not descend');
    d.harvestNode(d.nearestFungus());
   } else {
    const stone=d.approachNode('crafting.stone-node');d.harvestNode(stone,'crafting',2);
    // Put the hearth beside a reachable fungus so both roast operations remain adjacent.
    const fungus=h.world5()!.nodes.find(n=>n.interactableId===node)!;
    d.walk(workPositions(d.game,fungus.at));d.placeHearth();d.harvestNode(node,'foraging',3);
    const id=edibleContext(h).inventory.find(i=>i.definitionId?.startsWith('foraging.'))!.itemId;
    d.roast(id);const cooked=edibleContext(h).inventory.find(i=>i.definitionId?.endsWith('-roasted'))!;if(!cooked)throw Error('No roasted stack');
    // The generic capture callback records the actual confirmation, if this route is still nearly full.
    d.command('item:execute',`eat|${d.item(cooked.itemId).inventoryLetter}`);
    const remainder=edibleContext(h).inventory.find(i=>i.definitionId?.endsWith('-roasted'));if(!remainder)throw Error('No roast remainder');
    d.roast(remainder.itemId);expect(edibleContext(h).inventory.some(i=>i.definitionId==='foraging.char')).toBe(true);
   }
   const final=foragingFinal(h),recording=h.exportRecording(),g=d.game;
   const metadata={seed,commands:d.commands.length,tick:g.toSnapshot().run.currentTick,recordingBytes:Buffer.byteLength(recording)};
   expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(foragingFinal(h)).toEqual(final);
   h.seek(recording,JSON.parse(recording).events.length);expect(foragingFinal(h)).toEqual(final);
   attempts.push({seed,result:'selected'});
   const trace={seed,mode:'normal',modules,commands:d.commands,final};writeFileSync(destination,JSON.stringify(trace,null,2)+'\n');
   writeFileSync(destination.replace(/\.json$/,'.capture-metadata.json'),JSON.stringify({metadata,attempts},null,2)+'\n');
   return {trace,metadata,attempts};
  }catch(e){attempts.push({seed,result:e instanceof Error?e.message:String(e)});console.info(`trace ${kind} seed ${seed}: ${attempts[attempts.length-1]!.result.slice(0,180)}`);}
  finally{h.dispose();}
 }
 throw Error(`No natural trace ${kind}: ${JSON.stringify(attempts)}`);
}
