import { afterEach, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { ExtensionRegistry } from '../ext/registry';
import * as catalog from '../ext/catalog';
import { logger } from '../engine/Systems/Logger';
import { productionActorActionScheduler, disposeProductionActorActionSession } from '../engine/Core/ActorActionProduction';
import { bindPhasedAttackProduction } from '../engine/Core/PhasedAttackProduction';
import { installedOptionalModules } from './support/installedExtensions';
import { actorActionProtocolFixture } from './fixtures/actorActionProtocol';
import { getInstalledModuleDescriptors } from '../ext/catalog';
import { ItemCategory } from '../engine/Items/Item';
afterEach(()=>vi.restoreAllMocks());
function fixture(){
 const error=Object.freeze({failure:'original'}),registry=new ExtensionRegistry();
 registry.register('atomic','1.0.0',()=>({id:'atomic',version:'1.0.0',initialState:()=>({}),validateState:(x):x is any=>!!x&&typeof x==='object',commands:{fail(_p,c){c.setState({changed:true});throw error;}}}));
 vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(registry);
 const g=createHeadlessGame(717,'test');g.startNewGame({seed:717,mode:'test',ruleSet:'extended',extensions:['atomic']});g.animationEnabled=false;
 while(logger.pendingAcknowledgment)logger.acknowledgeNext();
 return {g,error,input:JSON.stringify({module:'atomic',action:'fail',payload:null})};
}
it.each(['pre-router','checkpoint','restore'] as const)('ORIGIN unknown %s failure closes recorder and retains original exception',kind=>{
 const {g,error,input}=fixture();
 if(kind==='pre-router')vi.spyOn(g.extensionRuntime!,'allowsInput').mockImplementation(()=>{g.player.hp--;throw error;});
 if(kind==='checkpoint')vi.spyOn(g as any,'checkpointExtensionCommandBoundary').mockImplementation(()=>{throw error;});
 if(kind==='restore')vi.spyOn(g as any,'checkpointExtensionCommandBoundary').mockImplementation(()=>()=>{g.player.hp--;throw Error('rollback failure');});
 try{g.executeCommand('ext:command',input);expect.unreachable();}catch(thrown){expect(thrown).toBe(error);}
 expect(g.hasPendingConfirmation).toBe(false);expect(g.hasCompleteRecording).toBe(false);expect(g.canExportRecording).toBe(false);
 expect(g.toSaveSnapshot().run.recordingOrigin).toBeUndefined();
});
it('ORIGIN real suspended native confirmation cancellation retires source without accepting its suffix',()=>{
 const {g}=fixture(),food=g.player.inventory.items.find(i=>i.category===ItemCategory.FOOD)!;
 g.onCommandConfirmRequest=()=>{};const before=g.recordedInputEvents.length;
 g.executeItemCommand('eat',food);expect(g.hasPendingConfirmation).toBe(true);
 const token=g.pendingCommandConfirmation!.token;g.cancelPendingCommand(token);
 expect(g.hasPendingConfirmation).toBe(false);expect(g.player.inventory.items).toContain(food);
 expect(g.recordedInputEvents).toHaveLength(before);expect(g.hasCompleteRecording).toBe(false);
 expect(g.toSaveSnapshot().run.recordingOrigin).toBeUndefined();
});

it('ORIGIN native action attempt stays fail closed when a nested committed-fact rollback resets its revision',()=>{
 const original=Object.freeze({failure:'native nested rollback'}),registry=new ExtensionRegistry();
 let game:ReturnType<typeof createHeadlessGame>;
 registry.register('atomic','1.0.0',()=>({id:'atomic',version:'1.0.0',initialState:()=>({}),
  validateState:(x):x is any=>!!x&&typeof x==='object',
  committedFacts:{'combat.event.v1':{maxDerivedFacts:0,prepare:()=>null,commit:()=>{}}},
  commands:{fail(_p,c){game.extensionRuntime!.withCommittedFacts(()=>c.executeAction(
   {actorId:c.playerId,action:'wait',target:{kind:'self'}},{beforeCommit(){},afterResolve(){throw original;}}
  ));}}
 }));
 vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(registry);
 game=createHeadlessGame(717,'test');game.startNewGame({seed:717,mode:'test',ruleSet:'extended',extensions:['atomic']});game.animationEnabled=false;
 while(logger.pendingAcknowledgment)logger.acknowledgeNext();
 expect(game.hasCompleteRecording).toBe(true);
 try{game.executeCommand('ext:command',JSON.stringify({module:'atomic',action:'fail',payload:null}));expect.unreachable();}
 catch(error){expect(error).toBe(original);}
 expect(game.hasCompleteRecording).toBe(false);expect(game.canExportRecording).toBe(false);
 expect(game.toSaveSnapshot().run.recordingOrigin).toBeUndefined();
});

it('ORIGIN replacement of a derived native scheduler during settlement is not certified',()=>{
 // The clock contract reserves combat protocol ownership. Its explicit data-only
 // fixture has version 0.0.1; it cannot impersonate the removed gameplay pack.
 const installed=getInstalledModuleDescriptors();
 const registry=catalog.createExtensionRegistry(installed.some(d=>d.id==='combat')?installed:[...installed,actorActionProtocolFixture]),original=Object.freeze({failure:'replaced scheduler'});
 registry.register('atomic','1.0.0',()=>({id:'atomic',version:'1.0.0',initialState:()=>({}),validateState:(x):x is any=>!!x&&typeof x==='object',commands:{fail(_p,c){c.setState({paid:true});}}}));
 vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(registry);
 const g=createHeadlessGame(717,'test');g.startNewGame({seed:717,mode:'test',ruleSet:'extended',extensions:['atomic','combat']});g.animationEnabled=false;
 while(logger.pendingAcknowledgment)logger.acknowledgeNext();
 const before=productionActorActionScheduler(g);expect(before).toBeDefined();
 vi.spyOn(g.extensionRuntime!,'settle').mockImplementation(()=>{
  disposeProductionActorActionSession(g);bindPhasedAttackProduction(g);
  expect(productionActorActionScheduler(g)).not.toBe(before);throw original;
 });
 try{g.executeCommand('ext:command',JSON.stringify({module:'atomic',action:'fail',payload:null}));expect.unreachable();}
 catch(error){expect(error).toBe(original);}
 expect(g.hasCompleteRecording).toBe(false);expect(g.canExportRecording).toBe(false);
 expect(g.toSaveSnapshot().run.recordingOrigin).toBeUndefined();
});

it.each([{modules:['combat']},{modules:['combat','giants','settlement','crafting','foraging']}])('ORIGIN pure rollback remains recordable with installed native/world modules $modules',({modules})=>{
 const registry=catalog.createExtensionRegistry(),original=Object.freeze({failure:'pure rollback'});let failing=true;
 registry.register('atomic','1.0.0',()=>({id:'atomic',version:'1.0.0',initialState:()=>({}),validateState:(x):x is any=>!!x&&typeof x==='object',commands:{fail(_p,c){c.setState({paid:true});c.message('buffered');c.randomInt(1,9);if(failing)throw original;}}}));
 vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(registry);
 const g=createHeadlessGame(717);g.startNewGame({seed:717,mode:'normal',ruleSet:'extended',extensions:['atomic',...installedOptionalModules(modules)]});g.animationEnabled=false;
 while(logger.pendingAcknowledgment)logger.acknowledgeNext();
 const before=g.toSaveSnapshot(),input=JSON.stringify({module:'atomic',action:'fail',payload:null});
 expect(g.hasCompleteRecording).toBe(true);expect(g.canExportRecording).toBe(true);
 try{g.executeCommand('ext:command',input);expect.unreachable();}catch(error){expect(error).toBe(original);}
 const after=g.toSaveSnapshot();after.savedAt=before.savedAt;
 expect(after).toEqual(before);expect(g.hasCompleteRecording).toBe(true);expect(g.canExportRecording).toBe(true);
 failing=false;g.executeCommand('ext:command',input);
 const saved=g.toSaveSnapshot(),recording=g.exportRecording();expect(g.loadSnapshot(saved)).toBe(true);
 expect(g.loadReplay(recording)).toBe(true);g.replaySeek(recording.events.length);expect(g.replayError).toBeNull();
});
