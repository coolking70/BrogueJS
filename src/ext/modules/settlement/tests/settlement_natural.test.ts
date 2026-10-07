import {it,expect,vi} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {effectScope,ref} from 'vue';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {ItemCategory} from '../../../../engine/Items/Item';
import {inventoryStamp} from '../../../../engine/Core/RecordingDigest';
import {clearWorldCell,threat} from '../../../../engine/Core/WorldWorkWorld';
import {loadSettlementPack} from '../definitions';
import {useSettlementUi} from '../ui/useSettlementUi';
import route from './natural-route.json';
function naturalLoop(depth:1|5) {
  vi.restoreAllMocks();
  const h=createWorldHarness({seed:route.seed,mode:'normal',modules:['settlement']});const g=worldHarnessGame(h);
  const evidence:Record<string,unknown>={seed:route.seed,modules:['settlement'],mode:'normal',depth,
    note:depth===1?'Native D1 route and camp closure':'Same real D1 food pickup, then explicit first-visit D5 preparation; not a walked D1→D5 journey',
    planningKnowledge:route.planningKnowledge};
  const inputs:unknown[]=[]; evidence.inputs=inputs;
  const base=()=>({v:1,stateRevision:g.extensionRuntime!.worldCampState('settlement').revision,inventoryStamp:inventoryStamp(g.player.inventory.items)});
  const command=(action:string,payload:Record<string,unknown>,answers:boolean[]=[true])=>{
    const result=h.ext('settlement',action,{...base(),...payload},answers);inputs.push({action,payload,result});return result;
  };
  try {
    expect(g.player.loc).toEqual(route.start);
    expect(g.player.inventory.items.filter(i=>i.category===ItemCategory.FOOD).reduce((n,i)=>n+i.quantity,0)).toBe(1);
    for(let k=0;k<route.moves.length;k++){
      const m=route.moves[k]!;h.command('move',m.data);expect(g.player.loc).toEqual(m.at);
      if(k===61)expect(g.player.inventory.items.filter(i=>i.category===ItemCategory.FOOD).reduce((n,i)=>n+i.quantity,0)).toBe(2);
    }
    expect(g.isGameOver).toBe(false);
    const originalFood=g.player.inventory.items.find(i=>i.category===ItemCategory.FOOD)!;
    const foodId=originalFood.id;
    if(depth===5){
      const inventory=inventoryStamp(g.player.inventory.items),grants=structuredClone(g.world5!.startupGrants);
      g.depth=5;(g as unknown as {generateDepth():void}).generateDepth();
      expect(inventoryStamp(g.player.inventory.items)).toBe(inventory);expect(g.world5!.startupGrants).toEqual(grants);
      evidence.nativeD5Landing={...g.player.loc};
    }
    if(depth===5){
      const before={...g.player.loc};h.command('move',{x:1,y:0});
      expect(g.player.loc).toEqual({x:before.x+1,y:before.y});
      evidence.nativeD5Walk=[{before,data:{x:1,y:0},at:{...g.player.loc}}];
    }
    // D5 is a separate first-visit eligibility sample. Use only visible nearby
    // safe cells to choose its actual marker; never relocate player or world.
    const targets=depth===1?[route.campTarget]:[1,-1,0].flatMap(dx=>[0,-1,1].map(dy=>({x:g.player.x+dx,y:g.player.y+dy}))).filter(p=>g.grid.getCell(p.x,p.y)?.isVisible&&clearWorldCell(g,p));
    expect(targets.length).toBeGreaterThan(0);expect(threat(g)).toBe(false);
    const payment={sourceContainerId:null,sourceRevision:null,materials:[{itemDefinitionId:'settlement.wood',count:4},{itemDefinitionId:'settlement.stone',count:2}]};
    let at=targets[0]!,bounds={x:1,y:1,width:9,height:9},created=false;
    for(const target of targets){
      at=target;bounds={x:Math.max(1,Math.min(69,at.x-4)),y:Math.max(1,Math.min(19,at.y-4)),width:9,height:9};
      if(command('establish',{...payment,...at,bounds,food:[{itemId:foodId,quantity:2}]}).error===null){created=true;break;}
    }
    expect(created).toBe(true);
    const c=g.extensionRuntime!.worldCampState('settlement').camps.find(c=>c.depth===depth)!;
    expect(c.locked.reduce((n,l)=>n+l.quantity,0)).toBe(2);
    evidence.camp={at,bounds,foodId,locked:c.locked};
    const pack=loadSettlementPack();
    const candidates=[{x:g.player.x,y:g.player.y+1},{x:g.player.x,y:g.player.y-1},{x:g.player.x-1,y:g.player.y},{x:g.player.x+1,y:g.player.y}];
    const bedAt=candidates.find(p=>g.grid.getCell(p.x,p.y)?.isVisible&&clearWorldCell(g,p));expect(bedAt).toBeDefined();
    const bed=pack.world.structures!.find(d=>d.id==='settlement.bed')!;
    const region=()=>g.extensionRuntime!.worldStructureRegions().find(r=>r.id===c.regionId)!;
    expect(command('build',{regionId:c.regionId,regionRevision:region().revision,definitionId:bed.id,...bedAt!,sourceContainerId:null,sourceRevision:null,materials:bed.constructionCost}).error).toBeNull();
    expect(command('expand',{regionId:c.regionId,regionRevision:region().revision,bounds:{...bounds,x:depth===5?bounds.x-1:bounds.x,width:10},sourceContainerId:null,sourceRevision:null,materials:pack.camp.expandCost}).error).toBeNull();
    // Deposit/withdraw a genuine unlocked startup material through the real supply.
    const wood=g.player.inventory.items.find(i=>i.worldItem?.definitionId==='settlement.wood')!;
    const box=()=>g.world5!.containers.find(b=>b.id===c.supplyId)!;
    expect(command('transfer',{containerId:c.supplyId,containerRevision:box().revision,direction:'deposit',items:[{itemId:wood.id,quantity:1}]}).error).toBeNull();
    const stored=g.worldContainerItems!.get(box().itemIds.find(id=>g.worldContainerItems!.get(id)?.worldItem?.definitionId==='settlement.wood')!)!;
    expect(command('transfer',{containerId:c.supplyId,containerRevision:box().revision,direction:'withdraw',items:[{itemId:stored.id,quantity:1}]}).error).toBeNull();
    const scope=effectScope(),ui=scope.run(()=>useSettlementUi({game:()=>g,tick:ref(0),immersive:ref(false),canOpenPanel:()=>true,beforeOpenPanel(){},afterClosePanel(){}}))!;
    ui.commands.value[0]!.invoke();const ticks=g.world5!.simulationTicks,nutrition=g.player.nutrition,hp=g.player.hp;
    (ui.panel.value!.props as any).onRest(g.world5!.restPoints[0]!.interactableId);
    expect(g.hasFoundationRestPoint()).toBe(true);h.command('auto_step');h.command('escape');scope.stop();
    evidence.rest={startHP:hp,maxHP:g.player.maxHp,ticks:g.world5!.simulationTicks-ticks,nutritionConsumed:nutrition-g.player.nutrition,note:'At full HP native rest may stop with zero elapsed time; no artificial damage/heal injection'};
    const part=g.world5!.structures.find(s=>s.regionId===c.regionId)!.fixture!;
    expect(command('dismantle',{componentId:part.id,componentRevision:part.revision}).error).toBeNull();
    expect(command('retire',{regionId:c.regionId,regionRevision:region().revision}).error).toBeNull();
    expect(g.player.inventory.items.find(i=>i.id===foodId)).toBe(originalFood);expect(originalFood.quantity).toBe(2);
    evidence.closure=true;evidence.end={at:g.player.loc,food:originalFood.quantity,hp:g.player.hp,ticks:g.world5!.simulationTicks};
    evidence.inputs=inputs;evidence.recording=h.exportRecording();
    const save=h.save(),digest=h.digest();h.load(save);expect(h.digest()).toBe(digest);
    if(depth===1){const recording=h.exportRecording();expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});}
    return evidence;
  }finally{
    const path=process.env.SETTLEMENT_NATURAL_OUT;
    if(path){mkdirSync(path,{recursive:true});writeFileSync(path+'/D'+depth+'.json',JSON.stringify(evidence,null,2)+'\n');}
    h.dispose();
  }
}
it('normal seed28 native D1 pickup→camp/build/expand/storage/UI rest/dismantle/retire/save/replay without injections',()=>{expect(naturalLoop(1).closure).toBe(true);});
it('natural unmodified D5 eligibility and paid closure after explicit first-visit preparation, backpack/landing preserved',()=>{expect(naturalLoop(5).closure).toBe(true);});
