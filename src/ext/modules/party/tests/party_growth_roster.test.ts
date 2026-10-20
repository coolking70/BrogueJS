import {it,expect} from 'vitest';
import {creatureView} from '../../../types';
import {growthPartyId} from '../../growth/state';
import growthDefinitions from '../../growth/data/definitions.json';
import {createConfiguredWorldHarness} from '../../../testing/configuredWorldHarness';
import {residentScene} from '../../settlement/tests/residentHelpers';
import {current} from '../../settlement/tests/helpers';
import {logger} from '../../../../engine/Systems/Logger';
import {Game} from '../../../../engine/Core/Game';
it('keeps historical growth receipts while removing live control and never grants creation kits on roundtrip',()=>{
 const {g,h,a}=residentScene(['party','settlement','growth'],false,(options,config)=>createConfiguredWorldHarness(options,{...config,party:{schema:1,members:1}}));
 let loaded:Game|undefined;
 try{
  g.player.loc={x:19,y:13};a.loc={x:20,y:13};g.refreshStructureDerivedState();
  const command=(operation:'join'|'station')=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeCommand('party:roster',{kind:'party:roster',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:g.player.id,targetId:a.id,operation,campId:operation==='station'?current(g).regionId:null,level:{kind:'dungeon',depth:g.depth}});};
  command('join');const member=g.party!.actors.get(a.id)!;expect(member.inventory.items).toHaveLength(0);
  for(let n=0;n<40&&g.activeControlledActors.some(a=>a.ticksUntilTurn>0);n++){while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.submitPartyIntent({kind:'wait'},g.readyPartyActorId!);}
  g.extensionRuntime!.emit('enteredLevel',{depth:2,firstVisit:true,actorIds:[g.player.id,a.id]});(g as any).collectExtensionComponents();
  const before=g.toSnapshot().extensions!.modules.growth as any,receipts=structuredClone(before.party.receipts),build=structuredClone(g.toSnapshot().extensions!.components[a.id]);
  expect(receipts.some((r:any)=>r.shares.some((s:any)=>s.actorId===a.id))).toBe(true);
  command('station');const state=g.toSnapshot().extensions!.modules.growth as any;
  expect(state.party.receipts).toEqual(receipts);expect(state.party.members).toContain(a.id);
  const save=g.toSaveSnapshot();expect(Game.isSnapshot(save)).toBe(true);loaded=new Game({seed:1});expect(loaded.loadSnapshot(save,message=>console.error(message))).toBe(true);command('join');
  expect(g.toSnapshot().extensions!.modules.growth).toMatchObject({party:{receipts}});
  expect(g.toSnapshot().extensions!.components[a.id]).toEqual(build);expect(member.inventory.items).toHaveLength(0);
 }finally{h.dispose();loaded?.disposeRecording();}
},120000);

it('retains earned participation but treats new stationed kills as ordinary allied credit',()=>{
 const {g,h,a}=residentScene(['party','settlement','growth'],false,(options,config)=>createConfiguredWorldHarness(options,{...config,party:{schema:1,members:1}}));
 try{
  const runtime=g.extensionRuntime!,state=()=>runtime.snapshot().modules.growth as any;
  const component=(id:number,name:string)=>runtime.snapshot().components[id]?.['growth:'+name] as any;
  g.player.loc={x:19,y:13};a.loc={x:20,y:13};g.refreshStructureDerivedState();
  const roster=(operation:'join'|'station')=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeCommand('party:roster',{kind:'party:roster',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:g.player.id,targetId:a.id,operation,campId:operation==='station'?current(g).regionId:null,level:{kind:'dungeon',depth:g.depth}});};
  roster('join');
  for(let n=0;n<40&&g.activeControlledActors.some(a=>a.ticksUntilTurn>0);n++){while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.submitPartyIntent({kind:'wait'},g.readyPartyActorId!);}
  const targets=g.monsters.filter(m=>!m.isAlly&&component(m.id,'reward')?.amount>0).slice(0,2);expect(targets).toHaveLength(2);
  const origin=()=>runtime.causality.create('melee',a.id,a.id,growthPartyId(state(),a.id));
  // Hook-level fact probe: native combat itself is covered in the handoff suite.
  const damage=(target:typeof targets[number])=>runtime.emit('damage',{creature:creatureView(target,g.player.id),amount:1,hpBefore:target.hp,sourceId:a.id,origin:origin(),damageKind:'physical',hpLost:1});
  damage(targets[0]!);expect(state().party.participants[targets[0]!.id]).toEqual([a.id]);
  roster('station');damage(targets[1]!);
  expect(state().party.participants[targets[1]!.id]).toBeUndefined();expect(state().party.participants[targets[0]!.id]).toEqual([a.id]);
  const kill=(target:typeof targets[number])=>{runtime.causality.terminal(target.id,origin());target.hp=0;g.killMonster(target);(g as any).collectExtensionComponents();};
  const oldReward=component(targets[0]!.id,'reward');kill(targets[0]!);
  expect(state().party.receipts.find((r:any)=>r.rewardId===oldReward.rewardId).shares).toEqual([{actorId:a.id,base:Math.floor(oldReward.amount*growthDefinitions.config.experience.allySplit.playerBasisPoints/10000),alive:true}]);
  const newReward=component(targets[1]!.id,'reward');kill(targets[1]!);
  const receipt=state().party.receipts.find((r:any)=>r.rewardId===newReward.rewardId);
  expect(receipt.shares.map((s:any)=>s.actorId)).toEqual([g.player.id]);
  expect(state().party.members).toContain(a.id);
 }finally{h.dispose();}
},120000);
