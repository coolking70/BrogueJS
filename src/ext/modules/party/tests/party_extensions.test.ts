import {timeSystem} from '../../../../engine/Systems/Time';
import {it,expect,vi} from 'vitest';
import '../../../../i18n';
import {Game} from '../../../../engine/Core/Game';
import {createExtensionRegistry} from '../../../catalog';
import {logger} from '../../../../engine/Systems/Logger';
import {readGrowthCharacterView,createGrowthAllocationDraft,buildGrowthAllocateCommand} from '../../growth/view';
import {buildCraftCommand,buildCancelCommand} from '../../crafting/ui/commands';
import {TerrainType} from '../../../../engine/Map/Grid';
import {mechanicalDigest} from '../../../../engine/Core/RecordingDigest';
import {inventoryStamp} from '../../../../engine/Core/RecordingDigest';
import {worldWorkLastError} from '../../../../engine/Core/WorldWork';
import {rng} from '../../../../engine/Random';
import {commitCreatureAnchor} from '../../../../engine/Movement/CreatureSpatial';
function start(combat=false){const registry=createExtensionRegistry(),extensions=['party','growth','crafting','foraging','settlement','loot',...(combat?['combat']:[])],manifest=registry.manifest(extensions),initialCommands=registry.create(manifest).flatMap(m=>m.initialCommand?[JSON.stringify({module:m.id,...m.initialCommand})]:[]);const g=new Game({seed:1});g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions,initialCommands});g.animationEnabled=false;while(logger.pendingAcknowledgment)logger.acknowledgeNext();return g;}
it('binds growth component commands and display drafts to the secondary actor',()=>{const g=start();try{
 const a=g.player,b=g.controlledActors[1]!;for(let depth=2;depth<=20;depth++)g.extensionRuntime!.emit('enteredLevel',{depth,firstVisit:true,actorIds:[a.id,b.id]});(g as any).collectExtensionComponents();const primary=JSON.parse(JSON.stringify(g.toSaveSnapshot().extensions!.components[a.id]));
 const first=readGrowthCharacterView(g)!;g.submitPartyIntent({kind:'wait'},a.id);g.focusPartyMember(b.id);while(logger.pendingAcknowledgment)logger.acknowledgeNext();
 const view=readGrowthCharacterView(g)!;expect(view.session).not.toBe(first.session);expect(readGrowthCharacterView(g,createGrowthAllocationDraft(first))!.draft.stale).toBe(true);
 const attribute=view.attributes.find(a=>a.canIncrease)!;expect(attribute).toBeTruthy();const draft={...createGrowthAllocationDraft(view),attributes:{[attribute.id]:1}},next=readGrowthCharacterView(g,draft)!;
 const command=buildGrowthAllocateCommand(next,g);expect(command).toBeTruthy();g.executeCommand('ext:command',command);const save=g.toSaveSnapshot();
 expect(save.extensions!.components[a.id]).toEqual(primary);expect(save.extensions!.components[b.id]?.['growth:attributes']).not.toEqual(primary['growth:attributes']);
 const h=new Game({seed:1});try{expect(h.loadSnapshot(JSON.parse(JSON.stringify(save)),message=>console.error(message))).toBe(true);}finally{h.disposeRecording();}
 }finally{g.disposeRecording();}},120000);
it('projects production and food inventories from the focused member without RNG or mechanical writes',()=>{const g=start();try{const b=g.controlledActors[1]!;g.focusPartyMember(b.id);const before=g.toSaveSnapshot(),random=rng.getState();
 const food=g.readFocusedModuleView('foraging')!,craft=g.readFocusedModuleView('crafting')!,camp=g.readFocusedModuleView('settlement')!;
 expect(food).toBeTruthy();expect(craft).toBeTruthy();expect(camp).toBeTruthy();expect(JSON.stringify(food.state)).toContain(String(b.inventory.items[0]!.id));
 expect(rng.getState()).toEqual(random);const after=g.toSaveSnapshot();after.savedAt=before.savedAt;expect(after).toEqual(before);
 }finally{g.disposeRecording();}},120000);
it.each(['crafting','foraging'])('charges and delivers a real secondary %s harvest ticket to its owner, then saves the roots',owner=>{const g=start();try{
 const a=g.player,b=g.controlledActors[1]!,node=g.world5!.nodes.find(n=>n.owner===owner&&n.levelRef.kind==='dungeon'&&n.levelRef.depth===g.depth)!;expect(node).toBeTruthy();
 g.monsters=g.monsters.filter(m=>m.isAlly);b.loc={...node.at};g.focusPartyMember(b.id);(g as any).updateVision();
 g.submitPartyIntent({kind:'wait'},a.id);while(logger.pendingAcknowledgment)logger.acknowledgeNext();const view=g.readFocusedModuleView(owner)!.state as any,target=view.nodes.find((n:any)=>n.interactableId===node.interactableId);expect(target.canHarvest).toBe(true);
 const before=a.inventory.items.map(i=>[i.id,i.quantity]),count=b.inventory.items.reduce((n,i)=>n+i.quantity,0);g.executeCommand('ext:command',JSON.stringify({module:owner,action:'harvest',payload:{v:1,nodeId:target.interactableId,nodeRevision:target.nodeRevision,inventoryStamp:view.inventoryStamp,destinationId:null,destinationRevision:null}}));
 for(let step=0;step<60&&g.world5!.tickets.some(t=>t.actorId===b.id);step++){while(logger.pendingAcknowledgment)logger.acknowledgeNext();const id=g.readyPartyActorId;expect(id).not.toBeNull();g.submitPartyIntent({kind:'wait'},id!);}
 expect(g.world5!.terminalTickets.some(t=>t.actorId===b.id&&t.status==='completed')).toBe(true);expect(a.inventory.items.map(i=>[i.id,i.quantity])).toEqual(before);expect(b.inventory.items.reduce((n,i)=>n+i.quantity,0)).toBeGreaterThan(count);
 const save=g.toSaveSnapshot(),h=new Game({seed:1});try{expect(h.loadSnapshot(save,message=>console.error(message))).toBe(true);}finally{h.disposeRecording();}
 }finally{g.disposeRecording();}},120000);

it.each([false,true])('secondary two-batch craft resumes or cancels at its own next boundary, cancel=%s',cancel=>{const g=start();try{const a=g.player,b=g.controlledActors[1]!;g.monsters=g.monsters.filter(m=>m.isAlly);for(const item of [...a.inventory.items].filter(i=>i.worldItem?.definitionId.startsWith('crafting.'))){a.inventory.removeItem(item);expect(b.inventory.addItem(item)).toBe(true);}g.focusPartyMember(b.id);g.submitPartyIntent({kind:'wait'},a.id);while(logger.pendingAcknowledgment)logger.acknowledgeNext();const view=g.readFocusedModuleView('crafting')!.state as any,command=buildCraftCommand(view,'crafting.make-pick',2);expect(command,JSON.stringify({view,items:b.inventory.items.map(i=>i.worldItem)})).toBeTruthy();const primary=a.inventory.items.map(i=>i.id);g.executeCommand('ext:command',command);for(let i=0;i<40&&g.world5!.tickets.some(t=>t.actorId===b.id);i++){while(logger.pendingAcknowledgment)logger.acknowledgeNext();const id=g.readyPartyActorId!;expect(id).toBeTruthy();const ticket=g.world5!.tickets.find(t=>t.actorId===b.id);if(cancel&&id===b.id&&ticket?.completedBatches===1){g.focusPartyMember(b.id);const command=buildCancelCommand(g.readFocusedModuleView('crafting')!.state as any);expect(command).toBeTruthy();g.executeCommand('ext:command',command);}else g.submitPartyIntent({kind:'wait'},id);}expect(g.world5!.terminalTickets.find(t=>t.actorId===b.id)).toMatchObject({status:cancel?'cancelled':'completed',completedBatches:cancel?1:2});expect(a.inventory.items.map(i=>i.id)).toEqual(primary);expect(b.inventory.items.filter(i=>i.worldItem?.definitionId==='crafting.pick')).toHaveLength(cancel?1:2);}finally{g.disposeRecording();}},120000);
it.each([false,true])('bonfire restores all active members, secondary-only=%s',secondaryOnly=>{const g=start(true);try{const a=g.player,b=g.controlledActors[1]!,fire=g.extensionRuntime!.snapshot().foundation.world.entities.find(e=>e.owner==='combat'&&e.depth===g.depth)!;expect(fire).toBeTruthy();g.monsters=g.monsters.filter(m=>m.isAlly);for(let y=fire.y-1;y<=fire.y+1;y++)for(let x=fire.x-1;x<=fire.x+1;x++)g.grid.setTerrain(x,y,TerrainType.FLOOR);a.loc={x:fire.x,y:fire.y};b.loc={x:fire.x+1,y:fire.y};a.hp=a.maxHp-5;b.hp=b.maxHp-5;if(secondaryOnly){a.hp=0;g.triggerGameOver(false,'fixture');g.focusPartyMember(b.id);} (g as any).updateVision();g.onConfirmRequest=()=>true;while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeCommand('ext:command',JSON.stringify({module:'combat',action:'rest',payload:{bonfireId:fire.id}}));const ledger=g.extensionRuntime!.actorActionBinding()!.state.bonfires!;expect(ledger.receipts[ledger.receipts.length-1]).toMatchObject({result:'completed',actorId:secondaryOnly?b.id:a.id});for(const actor of g.activeControlledActors)expect(actor.hp).toBe(actor.maxHp);expect(ledger.active).toBeNull();}finally{g.disposeRecording();}},120000);

it('secondary establishes camp, builds a chest, and transfers its own roots both ways',()=>{const g=start();try{const a=g.player,b=g.controlledActors[1]!;
 for(let y=7;y<=18;y++)for(let x=16;x<=29;x++){g.grid.setTerrain(x,y,TerrainType.FLOOR);g.grid.getCell(x,y)!.machineNumber=0;}g.grid.impregnableCells.clear();a.loc={x:18,y:12};b.loc={x:20,y:12};g.monsters=g.monsters.filter(m=>m.isAlly);for(const item of [...a.inventory.items].filter(i=>i.worldItem?.definitionId.startsWith('settlement.'))){item.quantity=99;a.inventory.removeItem(item);expect(b.inventory.addItem(item)).toBe(true);}const food=b.inventory.items.find(i=>i.consumableId==='ration_of_food')!;food.quantity=4;(g as any).updateVision();g.onConfirmRequest=()=>true;g.focusPartyMember(b.id);
 const ready=()=>{for(let i=0;i<30&&g.readyPartyActorId!==b.id;i++){while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.submitPartyIntent({kind:'wait'},g.readyPartyActorId!);}expect(g.readyPartyActorId).toBe(b.id);while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
 const send=(action:string,payload:object)=>{const command=JSON.stringify({module:'settlement',action,payload:{v:1,stateRevision:g.extensionRuntime!.worldCampState('settlement').revision,inventoryStamp:inventoryStamp(b.inventory.items),...payload}});g.executeCommand('ext:command',command);expect(worldWorkLastError(g)).toBeNull();};
 const primary=a.inventory.items.map(i=>[i.id,i.quantity]);ready();send('establish',{sourceContainerId:null,sourceRevision:null,materials:[{itemDefinitionId:'settlement.wood',count:4},{itemDefinitionId:'settlement.stone',count:2}],x:21,y:12,bounds:{x:17,y:8,width:9,height:9},food:[{itemId:food.id,quantity:2}]});
 const camp=g.extensionRuntime!.worldCampState('settlement').camps[0]!;expect(camp).toBeTruthy();ready();const region=g.extensionRuntime!.worldStructureRegions().find(r=>r.id===camp.regionId)!,definition=g.extensionRuntime!.worldDefinitionPacks().flatMap(p=>p.structures??[]).find(d=>d.id==='settlement.chest')!;
 send('build',{sourceContainerId:null,sourceRevision:null,materials:definition.constructionCost,regionId:region.id,regionRevision:region.revision,definitionId:definition.id,x:20,y:13});ready();const view=g.readFocusedModuleView('settlement')!.state as any,box=view.boxes.find((c:any)=>c.id!==camp.supplyId);expect(box).toBeTruthy();const item=b.inventory.items.find(i=>i.worldItem?.definitionId==='settlement.wood')!,quantity=item.quantity;
 send('transfer',{containerId:box.id,containerRevision:box.revision,items:[{itemId:item.id,quantity:1}],direction:'deposit'});expect(item.quantity).toBe(quantity-1);ready();const c=g.world5!.containers.find(c=>c.id===box.id)!,stored=g.worldContainerItems!.get(c.itemIds[0]!)!;send('transfer',{containerId:c.id,containerRevision:c.revision,items:[{itemId:stored.id,quantity:1}],direction:'withdraw'});expect(item.quantity).toBe(quantity);expect(a.inventory.items.map(i=>[i.id,i.quantity])).toEqual(primary);const saved=JSON.parse(JSON.stringify(g.toSaveSnapshot())),h=new Game({seed:1});try{expect(h.loadSnapshot(saved,message=>console.error(message))).toBe(true);}finally{h.disposeRecording();}
 }finally{g.disposeRecording();}},120000);

it.each([false,true])('splits one real kill pool after both members damage, with dead participant=%s and secondary drop credit',dead=>{const g=start();try{const a=g.player,b=g.controlledActors[1]!,target=g.monsters.find(m=>!m.isAlly)!;expect(target).toBeTruthy();g.monsters=g.monsters.filter(m=>m===target||m.isAlly);for(let y=10;y<=15;y++)for(let x=18;x<=23;x++){g.grid.setTerrain(x,y,TerrainType.FLOOR);g.grid.getCell(x,y)!.machineNumber=0;}a.loc={x:20,y:12};b.loc={x:20,y:13};target.loc={x:21,y:12};target.maxHp=target.hp=10000;target.ticksUntilTurn=100000;(g as any).updateVision();const runtime=g.extensionRuntime!,drop=vi.spyOn(runtime,'resolveItemDrop');
 const state=()=>runtime.snapshot().modules.growth as any;
 for(let i=0;i<80&&(state().party.participants[target.id]?.length??0)<2;i++){while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.submitPartyIntent({kind:'attack',targetId:target.id},g.readyPartyActorId!);}expect(state().party.participants[target.id]).toEqual([a.id,b.id]);
 if(dead){a.hp=0;g.triggerGameOver(false,'fixture');}target.hp=1;
 for(let i=0;i<80&&target.hp>0;i++){while(logger.pendingAcknowledgment)logger.acknowledgeNext();const id=g.readyPartyActorId!;g.submitPartyIntent(id===b.id?{kind:'attack',targetId:target.id}:{kind:'wait'},id);}
 expect(target.hp).toBeLessThanOrEqual(0);const calls=drop.mock.calls.map(call=>call[0]).filter(event=>event.source==='kill'&&event.actorId===target.id);expect(calls).toHaveLength(1);expect(calls[0]!.playerId).toBe(b.id);const receipt=state().party.receipts.find((r:any)=>r.shares.length===2&&r.rewardId.startsWith('birth:'));expect(receipt,JSON.stringify(state().party.receipts)).toBeTruthy();expect(receipt.shares.map((r:any)=>[r.actorId,r.alive])).toEqual([[a.id,!dead],[b.id,true]]);expect(Math.abs(receipt.shares[0].base-receipt.shares[1].base)).toBeLessThanOrEqual(1);drop.mockRestore();
 }finally{g.disposeRecording();vi.restoreAllMocks();}},120000);

it('freezes committed growth effect duration, cooldown, focus and native hunger across travel and save/load',()=>{const g=new Game({seed:1});try{const creation={revision:0,professionId:'growth.profession.guardian',lineageId:'growth.lineage.stoneborn',faithId:'growth.faith.watch',choices:[]};g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:['party','growth'],initialCommands:[JSON.stringify({module:'growth',action:'create-party',payload:{schema:1,members:[0,1].map(slot=>({slot,creation}))}}),JSON.stringify({module:'party',action:'create',payload:{schema:1,members:2}})]});g.animationEnabled=false;g.monsters=[];const a=g.player,b=g.controlledActors[1]!,id=b.id;commitCreatureAnchor(a,g.levelSeeds[0]!.downStairsLoc);while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.submitPartyIntent({kind:'wait'},a.id);g.focusPartyMember(b.id);while(logger.pendingAcknowledgment)logger.acknowledgeNext();const state=()=>g.extensionRuntime!.snapshot().modules.growth as any,component=(name:string)=>g.extensionRuntime!.snapshot().components[id]!['growth:'+name] as any;
 g.executeCommand('ext:command',JSON.stringify({module:'growth',action:'use-skill',payload:{revision:state().revision,skillId:'growth.skill.brace',target:{kind:'self'}}}));expect(component('skill-build').effects).toHaveLength(1);const effect=structuredClone(component('skill-build').effects[0]),clock=state().objectiveClock,cooldown=component('skills').readyAt['growth.skill.brace'],focus=component('focus'),nutrition=b.nutrition;
 const travel=(depth:number,leave:number[])=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeCommand('party:control',{kind:'party:control',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:g.player.id,change:{kind:'travel-party',destination:{kind:'dungeon',depth},leavingBehind:leave}});};travel(2,[id]);for(let i=0;i<8;i++){while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.submitPartyIntent({kind:'wait'},g.player.id);}const elapsed=state().objectiveClock-clock;expect(elapsed).toBeGreaterThan(0);expect(component('skill-build').effects[0]).toMatchObject({startedAt:effect.startedAt+elapsed,expiresAt:effect.expiresAt+elapsed});expect(component('skills').readyAt['growth.skill.brace']).toBe(cooldown+elapsed);expect(component('focus')).toEqual(focus);expect(b.nutrition).toBe(nutrition);const save=JSON.parse(JSON.stringify(g.toSaveSnapshot()));expect(g.loadSnapshot(save,message=>console.error(message))).toBe(true);commitCreatureAnchor(g.player,g.levelSeeds[1]!.upStairsLoc);travel(1,[]);expect(g.party!.state.members.find(m=>m.actorId===id)!.life).toBe('active');expect(component('skill-build').effects[0].expiresAt-state().objectiveClock).toBe(effect.expiresAt-clock);
 }finally{g.disposeRecording();}},120000);

it('R1 audit: delayed edible fire contacts retain their secondary carrier across actor scopes',async()=>{
 const {assembleEdibleItem}=await import('../../../../engine/Core/KindKnowledge');
 const {queueFireContact,drainFireContacts}=await import('../../../../engine/Core/FireContact');
 const {withPartyActor}=await import('../../../../engine/Core/PartyRuntime');
 const g=start();try{const [a,b]=g.controlledActors,primary=assembleEdibleItem(g,'foraging.mend'),secondary=assembleEdibleItem(g,'foraging.mend');a!.inventory.addItem(primary);b!.inventory.addItem(secondary);
 withPartyActor(g,b!,()=>queueFireContact(g,secondary,'carrier-ignited'));drainFireContacts(g);
 expect(primary.worldItem!.definitionId).toBe('foraging.mend');expect(secondary.worldItem!.definitionId).toBe('foraging.mend-roasted');expect(b!.inventory.items).toContain(secondary);expect(a!.inventory.items).not.toContain(secondary);
 for(let i=0;i<3&&b!.inventory.items.includes(secondary);i++){queueFireContact(g,secondary,'carrier-ignited');drainFireContacts(g);}expect(b!.inventory.items).not.toContain(secondary);expect(a!.inventory.items).toContain(primary);
 const save=JSON.parse(JSON.stringify(g.toSnapshot()));expect(g.loadSnapshot(save)).toBe(true);
 }finally{g.disposeRecording();}
},120000);
it('R1 audit: poison death cancels a busy phased member before the final terminal boundary',()=>{
 const g=start(true);try{g.mode='normal';g.monsters=g.monsters.filter(m=>m.isAlly);const [a,b]=g.controlledActors;
 for(let y=8;y<=14;y++)for(let x=17;x<=26;x++)g.grid.setTerrain(x,y,TerrainType.FLOOR);commitCreatureAnchor(a!,{x:20,y:10});commitCreatureAnchor(b!,{x:24,y:10});
 for(const actor of g.controlledActors){actor.hp=1;actor.poisonAmount=2;actor.setStatusDuration('poisoned',3);}(g as any).updateVision();
 g.submitPartyIntent({kind:'module',owner:'combat',commandId:'attack',payload:{attackId:'fixture.double-thrust',facing:'s'}},a!.id);
 expect(g.actorActions!.bundles.some(bundle=>bundle.decisionOwnerId===a!.id)).toBe(true);
 for(let i=0;i<8&&!g.isGameOver;i++){while(logger.pendingAcknowledgment)logger.acknowledgeNext();expect(g.readyPartyActorId).not.toBeNull();g.submitPartyIntent({kind:'wait'},g.readyPartyActorId!);}
 expect(g.isGameOver).toBe(true);expect(g.party!.state.members.every(m=>m.life==='dead')).toBe(true);expect(g.actorActions!.bundles).toEqual([]);expect(g.extensionRuntime!.actorActionBinding()!.state.actors.filter(r=>[a!.id,b!.id].includes(r.actorId))).toEqual([]);
 const save=JSON.parse(JSON.stringify(g.toSnapshot()));expect(g.loadSnapshot(save)).toBe(true);
 }finally{g.disposeRecording();}
},120000);

it.each([0,1])('P1b window retains phased member %i across budgets and completes it once',memberIndex=>{
 const g=start(true);try{g.monsters=g.monsters.filter(m=>m.isAlly);const a=g.player,b=g.controlledActors[1]!;
 for(let y=8;y<=14;y++)for(let x=17;x<=26;x++)g.grid.setTerrain(x,y,TerrainType.FLOOR);commitCreatureAnchor(a,{x:20,y:10});commitCreatureAnchor(b,{x:24,y:10});(g as any).updateVision();
 const advance=(first:boolean)=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.submitPartyWindow({kind:'party:window',schema:1,seq:g.party!.state.window.seq+1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',startTick:timeSystem.currentTick,length:{kind:'ticks',ticks:100},fineActorId:null,automatic:false,trigger:'manual',plans:first?[{actorId:g.controlledActors[memberIndex]!.id,controllerSlot:'local:0',update:'replace',plan:{kind:'queue',actions:[{kind:'module',owner:'combat',commandId:'attack',payload:{attackId:'fixture.double-thrust',facing:'s'}}]}}]:[]});};
 advance(true);expect(g.party!.state.window.elapsed).toBe(100);const bundle=g.actorActions!.bundles.find(x=>x.decisionOwnerId===g.controlledActors[memberIndex]!.id)!;expect(bundle).toBeTruthy();const id=bundle.actionId;expect(g.party!.state.window.members[memberIndex]!.cursor).toBe(1);const before=timeSystem.currentTick;
 advance(false);expect(timeSystem.currentTick-before).toBe(100);expect(g.actorActions!.bundles.some(x=>x.actionId===id)).toBe(false);expect(g.party!.state.window.members[memberIndex]!.cursor).toBe(1);const save=g.toSaveSnapshot(),h=new Game({seed:1});try{expect(h.loadSnapshot(save)).toBe(true);}finally{h.disposeRecording();}
 }finally{g.disposeRecording();}
},120000);

it('P1b accepts a secondary growth plan before its own ready point and revalidates on execution',()=>{
 const g=start();try{const a=g.player,b=g.controlledActors[1]!;for(let depth=2;depth<=20;depth++)g.extensionRuntime!.emit('enteredLevel',{depth,firstVisit:true,actorIds:[a.id,b.id]});(g as any).collectExtensionComponents();g.focusPartyMember(b.id);
 const state=g.extensionRuntime!.snapshot().modules.growth as any;
 const before=JSON.parse(JSON.stringify(g.toSaveSnapshot().extensions!.components[b.id]!['growth:attributes']));const attribute=Object.keys(before.values)[0]!;
 // Production UI projection chooses the allocatable attribute; it is read-only even before readiness.
 const model=readGrowthCharacterView(g)!,id=model.attributes.find(x=>x.value<x.cap&&x.enabled)?.id??attribute;
 const payload={actorId:b.id,revision:state.revision,attributes:{[id]:1}};
 while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.submitPartyWindow({kind:'party:window',schema:1,seq:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',startTick:timeSystem.currentTick,length:{kind:'ticks',ticks:100},fineActorId:null,automatic:false,trigger:'manual',plans:[{actorId:b.id,controllerSlot:'local:0',update:'replace',plan:{kind:'queue',actions:[{kind:'module',owner:'growth',commandId:'allocate',payload}]}}]});
 expect(g.party!.state.window.members[1]!.cursor).toBe(1);expect(g.toSaveSnapshot().extensions!.components[b.id]!['growth:attributes']).not.toEqual(before);expect(model.attributePoints).toBeGreaterThan(0);
 }finally{g.disposeRecording();}
},120000);

it.each([1,2,4])('P1b primary phased windows record, save, resume, replay and seek with %i members',members=>{
 const registry=createExtensionRegistry(),phaseExtensions=['party','combat'],configuration={party:{schema:1,members}},manifest=registry.manifest(phaseExtensions,configuration),initialCommands=registry.create(manifest).flatMap(m=>m.initialCommand?[JSON.stringify({module:m.id,...m.initialCommand})]:[]);
 const g=new Game({seed:1}),h=new Game({seed:1});
 try{
  g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:phaseExtensions,extensionConfigurations:configuration,initialCommands});g.animationEnabled=false;
  const advance=(game:Game,first=false)=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();const before=game.recordedInputEvents.length;game.submitPartyWindow({kind:'party:window',schema:1,seq:game.party!.state.window.seq+1,expectedRevision:game.party!.state.revision,issuerSlot:'local:0',startTick:timeSystem.currentTick,length:{kind:'ticks',ticks:100},fineActorId:null,automatic:false,trigger:'manual',plans:first?[{actorId:game.player.id,controllerSlot:'local:0',update:'replace',plan:{kind:'queue',actions:[{kind:'module',owner:'combat',commandId:'attack',payload:{attackId:'fixture.double-thrust',facing:'s'}}]}}]:[]});expect(game.recordedInputEvents.length).toBe(before+1);};
  advance(g,true);expect(g.actorActions!.bundles.some(b=>b.decisionOwnerId===g.player.id)).toBe(true);
  const pending=JSON.parse(JSON.stringify(g.toSaveSnapshot()));expect(pending.run.recordingOrigin).toBeTruthy();expect(h.loadSnapshot(pending)).toBe(true);h.animationEnabled=false;
  const tick=timeSystem.currentTick;advance(h);expect(timeSystem.currentTick-tick).toBe(100);expect(h.actorActions!.bundles.some(b=>b.decisionOwnerId===h.player.id)).toBe(false);
  const saved=JSON.parse(JSON.stringify(h.toSaveSnapshot())),rec=h.exportRecording(),digest=mechanicalDigest((h as any).projectWholeRun(),(h as any).recordingInputState());
  expect(g.loadSnapshot(saved)).toBe(true);expect(mechanicalDigest((g as any).projectWholeRun(),(g as any).recordingInputState())).toEqual(digest);
  expect(g.loadReplay(rec)).toBe(true);g.replayPlay();
  for(let i=0;i<=rec.events.length&&g.replayCursor<rec.events.length&&!g.replayError;i++)g.tickReplay(100);
  expect(g.replayError).toBeNull();expect(g.replayCursor).toBe(rec.events.length);expect(mechanicalDigest((g as any).projectWholeRun(),(g as any).recordingInputState())).toEqual(digest);
  g.replaySeek(rec.events.length);expect(g.replayError).toBeNull();expect(mechanicalDigest((g as any).projectWholeRun(),(g as any).recordingInputState())).toEqual(digest);
  expect(g.loadSnapshot(saved)).toBe(true);advance(g);expect(g.exportRecording().events.length).toBe(rec.events.length+1);
 }finally{g.disposeRecording();h.disposeRecording();}
},120000);
