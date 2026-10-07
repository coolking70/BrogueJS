import { describe,expect,it } from 'vitest';
import { getInstalledModuleDescriptors } from '../../../catalog';
import { TerrainType } from '../../../../engine/Map/Grid';
import { makeHarness, scene, addFood, hearth, roast, edible, waitTurns } from './mechanicsHelpers';
import { worldHarnessGame } from '../../../testing/worldHarness';
import { NaturalForagingDriver, edibleContext, executeTraceCommand, foragingFinal, startNatural } from './traceHelpers';

const installed=getInstalledModuleDescriptors().map(d=>d.id);
const peers=['growth','narrative','combat','giants','crafting'].filter(id=>installed.includes(id));
const rows=[['foraging'],...peers.map(id=>['foraging',id]),['foraging',...peers],...(installed.includes('settlement')?[['settlement'],['foraging','settlement']]:[])];
describe('foraging T-COMBO seven actual installed combinations, not the 64-subset smoke',()=>{
 it.each(rows.map(modules=>({modules,label:modules.join('+')})))('$label natural harvest/eat/save/load/replay/seek/continuation',({modules})=>{
  let chosen:ReturnType<typeof startNatural>|undefined,driver:NaturalForagingDriver|undefined;
  const failures:string[]=[];
  for(let seed=1;seed<=64;seed++){
   const h=startNatural(seed,modules),d=new NaturalForagingDriver(h);
   try{
    if(modules.includes('foraging')){
     d.harvestNode(d.nearestFungus());
     const food=edibleContext(h).inventory.find(i=>i.definitionId?.startsWith('foraging.'));if(!food)throw Error('Harvest did not yield food');
     d.command('item:execute',`eat|${d.item(food.itemId).inventoryLetter}`);
    }else d.command('wait');
    chosen=h;driver=d;break;
   }catch(e){failures.push(`${seed}:${String(e)}`);h.dispose();}
  }
  expect(chosen,failures.join('\n')).toBeDefined();const h=chosen!,d=driver!;
  try{
   expect(worldHarnessGame(h).extensionRuntime!.manifest.modules.map(m=>m.id)).toEqual([...modules].sort());
   const final=foragingFinal(h),recording=h.exportRecording();
   expect((final.state as {totals:{eaten:number}}).totals.eaten).toBe(1);
   h.load(h.save());expect(foragingFinal(h)).toEqual(final);
   expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(foragingFinal(h)).toEqual(final);
   const halfway=Math.floor(d.commands.length/2);h.seek(recording,JSON.parse(recording).events.length-d.commands.length+halfway);h.load(h.save());
   for(const c of d.commands.slice(halfway))expect(executeTraceCommand(h,c)).toEqual(c.expect);
   expect(foragingFinal(h)).toEqual(final);expect(h.replay(h.exportRecording())).toEqual({ok:true,firstMismatch:null});
  }finally{h.dispose();}
 });
});


describe('foraging T-COMBO optional heat and composite interactions',()=>{
 it.each(['combat','crafting'])('%s real heat provider cooks without changing its rules identity',(peer)=>{
  const h=makeHarness(51020001,['foraging',peer]),g=scene(h);
  let id:number;
  if(peer==='crafting'){
   expect(getInstalledModuleDescriptors().find(d=>d.id==='crafting')!.rules!.fingerprint).toBe('sha256:fc1b8d11b7faf918331cf58895f135e11e67d397b5c88d1a08c5b2b679597fe1');
   id=hearth(h).interactableId;
  }else{
   const bindings=g.extensionRuntime!.actorActionBinding()!.state.bonfires!.bindings;
   const source=g.extensionRuntime!.worldWorkEntities().find(e=>bindings[String(e.id)]&&e.depth===g.depth)!;
   expect(source).toBeDefined();g.player.loc={x:source.x+1,y:source.y};g.grid.setTerrain(g.player.x,g.player.y,TerrainType.FLOOR);g.grid.getCell(source.x,source.y)!.isVisible=true;id=source.id;
  }
  expect(edible(h).heatSources.some(s=>s.interactableId===id)).toBe(true);
  const food=addFood(h,'mend',2);expect(roast(h,food,id)).toEqual({recorded:true,error:null});expect(food.worldItem!.definitionId).toBe('foraging.mend-roasted');
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
 });
 it('giants core alone has hunger; deadline retires the actual whole group without death facts',()=>{
  const h=makeHarness(51020001,['foraging','giants']),g=scene(h);
  const body=g.extensionRuntime!.edibleModule('giants')!.nativeBodies!.definitions[0]!;
  const core=g.createCompositeMonster(body.id,{x:13,y:12});expect(core).not.toBeNull();g.becomeAllyWith(core!);
  const group=g.bodyGroups![0]!,ids=group.members.flatMap(m=>m.entityId===null?[]:[m.entityId]);expect(ids.length).toBeGreaterThan(1);
  const snap=g.toSnapshot(),need=snap.extensions!.foundation.actorNeeds!.rows;expect(need.map(r=>r.actorId)).toEqual([group.coreId]);
  for(const m of g.monsters)m.ticksUntilTurn=1000000;
  const s=g.toSnapshot(),row=s.extensions!.foundation.actorNeeds!.rows[0]!;
  Object.assign(row,{value:0,band:'starving',remainderTicks:0,lastSettledTick:s.run.world5!.simulationTicks,zeroSinceTick:s.run.world5!.simulationTicks,deadlineFired:false});
  s.extensions!.components[String(core!.id)]!['foraging:hunger']={band:'starving'};expect(g.loadSnapshot(s)).toBe(true);g.animationEnabled=false;
  waitTurns(h,320);expect(g.monsters.some(m=>ids.includes(m.id))).toBe(false);expect(g.bodyGroups).toBeUndefined();expect(g.extensionRuntime!.snapshot().foundation.actorNeeds?.rows??[]).toEqual([]);
  expect(ids.every(id=>g.extensionRuntime!.snapshot().foundation.deaths[String(id)]===undefined)).toBe(true);
  const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);
 });
});
