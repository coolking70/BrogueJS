import { afterEach, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../test/harness';
import { ExtensionRegistry } from '../ext/registry';
import * as catalog from '../ext/catalog';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
import type { ExtensionModule, Json } from '../ext/types';
afterEach(() => vi.restoreAllMocks());
for (const failure of ['commit', 'settlement']) it(`atomic ${failure} preserves complete recording without narrative`, () => {
 let failing = true;
 const base = (id: string): ExtensionModule => ({ id, version:'1.0.0', initialState:()=>({}), validateState:(x):x is Json=>!!x&&typeof x==='object' });
 const registry=new ExtensionRegistry();
 registry.register('provider','1.0.0',()=>({...base('provider'), optionalRewards:{'foundation.sample-reward.v1':{
  prepare:()=>({status:'ready',plan:{}}), commit:(_r,_p,c)=>{c.setState({paid:true});c.message('must rollback');if(failing&&failure==='commit')throw Error('injected');}
 }}, hooks:{simulationSettled(_e,c){if(failing&&failure==='settlement'&&(c.state as {paid?:boolean}).paid)throw Error('injected');}}}));
 registry.register('consumer','1.0.0',()=>({...base('consumer'),commands:{claim:(_p,c)=>{c.commitOptionalReward('foundation.sample-reward.v1','known','once');}}}));
 vi.spyOn(catalog,'createExtensionRegistry').mockReturnValue(registry);
 const game=createHeadlessGame(717,'test');game.startNewGame({seed:717,mode:'test',ruleSet:'extended',extensions:['consumer','provider']});game.animationEnabled=false;
 while(logger.pendingAcknowledgment)logger.acknowledgeNext();
 const observe=()=>{const {savedAt,...s}=game.toSaveSnapshot();return {world:s,events:structuredClone(game.recordedInputEvents),random:rng.getState(),complete:game.hasCompleteRecording,exportable:game.canExportRecording};};
 const before=observe(), player=game.player,runtime=game.extensionRuntime;
 expect(before.complete).toBe(true);
 const input=JSON.stringify({module:'consumer',action:'claim',payload:null});
 expect(()=>game.executeCommand('ext:command',input)).toThrow('injected');
 const after=observe();expect(game.player).toBe(player);expect(game.extensionRuntime).toBe(runtime);
 const {recordingOrigin:originBefore,...runBefore}=before.world.run;
 const {recordingOrigin:originAfter,...runAfter}=after.world.run;
 expect({...after.world,run:runAfter}).toEqual({...before.world,run:runBefore});expect(after.events).toEqual(before.events);expect(after.random).toEqual(before.random);
 expect(after.complete).toBe(before.complete);expect(after.exportable).toBe(before.exportable);expect(originAfter).toEqual(originBefore);
 failing=false;game.executeCommand('ext:command',input);expect(game.hasCompleteRecording).toBe(true);
 const saved=game.toSaveSnapshot(),rec=game.exportRecording();expect(game.loadSnapshot(saved)).toBe(true);expect(game.loadReplay(rec)).toBe(true);game.replaySeek(rec.events.length);expect(game.replayError).toBeNull();
});

it('a native partial write still retires recording eligibility', () => {
 const game=createHeadlessGame(717,'test');game.animationEnabled=false;
 while(logger.pendingAcknowledgment)logger.acknowledgeNext();
 expect(game.hasCompleteRecording).toBe(true);
 expect(()=>game.executeCommand('wait',undefined,()=>{game.player.hp--;throw Error('partial native write');})).toThrow('partial native write');
 expect(game.hasCompleteRecording).toBe(false);
});
