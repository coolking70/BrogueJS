import { expect, it, vi } from 'vitest';
import {writeFileSync} from 'node:fs';
import {residentPlotReason,residentHasNativePriority} from '../../../../engine/Core/ResidentJobs';
import { current, build, base, establish, scene } from './helpers';
import { installRecordingScene } from '../../../../test/support/recordingV4';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { residentComponent, residentBedIds } from '../../../../engine/Core/ResidentWorld';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { TerrainType } from '../../../../engine/Map/Grid';
import { assign, waitUntil } from './residentJobHelpers';
import { getInstalledModuleDescriptors } from '../../../catalog';
import type { Game } from '../../../../engine/Core/Game';
import type { WorldHarness } from '../../../worldSdk';

const peers=getInstalledModuleDescriptors().map(d=>d.id).filter(id=>id!=='settlement');
const combinations=[['settlement'],...peers.map(id=>['settlement',id]),['settlement',...peers]];
function publicWalk(h:WorldHarness,g:Game,to:{x:number;y:number}) {
  for(let n=0;n<400&&(g.player.x!==to.x||g.player.y!==to.y);n++){
    const key=(p:{x:number;y:number})=>p.y*g.grid.width+p.x,root={...g.player.loc},queue=[root],parent=new Map<number,{x:number;y:number}>();parent.set(key(root),root);
    for(let k=0;k<queue.length&&!parent.has(key(to));k++)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const at=queue[k]!,p={x:at.x+dx!,y:at.y+dy!};if(parent.has(key(p))||!g.grid.getCell(p.x,p.y)?.isPassable||g.monsters.some(a=>!a.isAlly&&a.hp>0&&a.x===p.x&&a.y===p.y))continue;parent.set(key(p),at);queue.push(p);
    }
    if(!parent.has(key(to)))throw Error('public native path blocked');let next=to;while(key(parent.get(key(next))!)!==key(root))next=parent.get(key(next))!;h.command('move',{x:next.x-root.x,y:next.y-root.y});
  }
  expect(g.player.loc).toEqual(to);
}
function adjacent(h:WorldHarness,g:Game,at:{x:number;y:number}) {
  const places=[{x:at.x-1,y:at.y},{x:at.x+1,y:at.y},{x:at.x,y:at.y-1},{x:at.x,y:at.y+1}]
    .filter(p=>g.grid.getCell(p.x,p.y)?.isPassable&&!g.monsters.some(a=>a.x===p.x&&a.y===p.y&&a.hp>0))
    .sort((a,b)=>Math.abs(a.x-g.player.x)+Math.abs(a.y-g.player.y)-Math.abs(b.x-g.player.x)-Math.abs(b.y-g.player.y));
  let error:unknown;for(const p of places)try{publicWalk(h,g,p);return;}catch(e){error=e;}
  throw error??Error('no real adjacent work position');
}
export function publicBedroom(h:WorldHarness,g:Game) {
  expect(h.ext('settlement','establish',establish(g)).error).toBeNull();
  const buildAt=(name:string,at:{x:number;y:number})=>{adjacent(h,g,at);expect(h.ext('settlement','build',build(g,name,at)).error).toBeNull();};
  // Initial terrain/materials are controlled before the genuine recording header.
  // After that header every move, payment, confirmation and resident decision is public.
  buildAt('door',{x:19,y:12});const door=g.world5!.structures.find(s=>s.barrier?.definitionId==='settlement.door')!.barrier!;
  expect(h.ext('settlement','door',{...base(g),componentId:door.id,componentRevision:door.revision,open:true}).error).toBeNull();
  for(let y=12;y<=16;y++)for(let x=17;x<=21;x++){
    const edge=x===17||x===21||y===12||y===16;
    if(edge&&((x===17||x===21)&&(y===12||y===16)||x===19&&y===12))continue;
    buildAt(edge?'wood-wall':'roof',{x,y});
  }
  buildAt('bed',{x:18,y:13});expect(residentBedIds(g,current(g))).toHaveLength(1);
}
it.each(combinations.map(modules=>({modules})))('installed modules $modules: public resident jobs/needs and complete controlled-origin save/replay/seek/continuation', ({modules})=>{
  vi.restoreAllMocks();
  installRecordingScene((g:Game)=>{
    if(!g.extensionRuntime?.residentOwners().includes('settlement'))return;
    scene(g);g.grid.setTerrain(19,17,TerrainType.WATER_SHALLOW);
    const id=g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId!,a=g.monsters.find(a=>a.id===id)!;
    a.loc={x:22,y:13};a.ticksUntilTurn=100;
    g.refreshStructureDerivedState();
  });
  const h=createWorldHarness({seed:51020001,mode:'normal',modules}),g=worldHarnessGame(h);
  try{
    publicBedroom(h,g);
    const id=g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId!,original=g.monsters.find(a=>a.id===id)!;
    adjacent(h,g,original.loc);const c=current(g);
    expect(h.ext('settlement','recruit',{v:1,stateRevision:g.extensionRuntime!.worldCampState('settlement').revision,campId:c.regionId,campRevision:c.revision,targetId:id,targetRevision:0}).error).toBeNull();
    expect(g.monsters.find(a=>a.id===id)).toBe(original);
    adjacent(h,g,{x:19,y:15});expect(h.ext('settlement','build',build(g,'plot',{x:19,y:15})).error).toBeNull();
    adjacent(h,g,{x:20,y:15});expect(h.ext('settlement','build',build(g,'chest',{x:20,y:15})).error).toBeNull();
    adjacent(h,g,{x:21,y:12});const seed=g.player.inventory.items.find(i=>i.worldItem?.definitionId==='settlement.seed')!;
    expect(h.ext('settlement','transfer',{...base(g),containerId:c.supplyId,containerRevision:g.world5!.containers.find(b=>b.id===c.supplyId)!.revision,direction:'deposit',items:[{itemId:seed.id,quantity:6}]}).error).toBeNull();
    const dst=g.world5!.containers.find(b=>b.kind==='chest'&&b.id!==c.supplyId)!,plot=g.world5!.structures.find(s=>s.fixture?.definitionId==='settlement.plot')!.fixture!;
    adjacent(h,g,original.loc);
    expect(h.ext('settlement','set-schedule',{v:1,stateRevision:g.extensionRuntime!.worldCampState('settlement').revision,campId:c.regionId,campRevision:current(g).revision,targetId:id,targetRevision:residentComponent(g,id)!.revision,schedule:[8,8,16]}).error).toBeNull();
    expect(assign(h,g,id,{kind:'plant',plotIds:[plot.id],sourceId:c.supplyId,destinationId:dst.id}).error).toBeNull();
    publicWalk(h,g,{x:19,y:11});publicWalk(h,g,{x:18,y:11});publicWalk(h,g,{x:18,y:8});publicWalk(h,g,{x:29,y:8});publicWalk(h,g,{x:29,y:9});
    try{waitUntil(h,()=>containerItems(g,dst.id).some(i=>i.worldItem?.definitionId==='settlement.crop'),400);}finally{
      if(process.env.RESIDENT_COMBO_DEBUG)writeFileSync(process.env.RESIDENT_COMBO_DEBUG+'/'+modules.join('-')+'.json',JSON.stringify({tick:g.world5!.simulationTicks,player:g.player.loc,actor:{at:original.loc,timer:original.ticksUntilTurn,nativePriority:residentHasNativePriority(g,original)},resident:residentComponent(g,id),light:g.lightMap.lightSumAt(19,15),plotReason:residentPlotReason(g,plot.id),jobs:g.world5!.residentJobs,needs:g.world5!.offline,destination:containerItems(g,dst.id)},null,2));
    }
    const jobBoundary=g.recordedInputEvents.length,jobDigest=h.digest();
    for(let n=0;n<400&&g.world5!.simulationTicks<32000;n++)h.command('wait');
    expect(current(g).consumedLockedUnits).toBe(1);expect(residentComponent(g,id)?.mode).toBe('stay');
    expect(g.extensionRuntime!.queryOptional('settlement.resident-status.v1',{actorId:id})).toEqual({status:'available',value:{resident:true}});
    expect(g.extensionRuntime!.queryOptional('foraging.resident-status.v1',{actorId:id})).toMatchObject({status:'unavailable'});
    const recording=h.exportRecording(),save=h.save(),digest=h.digest(),boundary=g.recordedInputEvents.length;
    h.load(save);expect(h.digest()).toBe(digest);h.command('wait');
    expect(h.replay(h.exportRecording())).toEqual({ok:true,firstMismatch:null});
    expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});
    h.seek(recording,jobBoundary);expect(h.digest()).toBe(jobDigest);
    h.seek(recording,boundary);expect(h.digest()).toBe(digest);
  }finally{h.dispose();vi.restoreAllMocks();}
});
