import {it,expect,afterEach,vi} from 'vitest';
import {start,arena,play,state,attackCommand,mechanical,clone} from './src/ext/modules/combat/tests/support/combat2Harness';
import {createExtensionRegistry} from './src/ext/catalog';
import {logger} from './src/engine/Systems/Logger';
import {createHeadlessGame} from './src/test/harness';
import f23 from './src/ext/modules/combat/tests/fixtures/combat2-sdk-seed23.json';
import f118 from './src/ext/modules/combat/tests/fixtures/combat2-sdk-seed118.json';
afterEach(()=>{vi.restoreAllMocks();logger.reset();logger.onDisturb=null;});
it('MRE old fixture.stomp survives no-op nested generation rollback with ledger identity intact',()=>{
 const {game}=start();arena(game);game.animationEnabled=true;
 play(game,'ext:command',attackCommand('fixture.stomp'));
 expect(game.actorActions!.bundles.length).toBe(1);
 const runtime=game.extensionRuntime!,ledger=state(game),saved=clone(ledger),action=ledger.actions[0],resource=ledger.actors[0];
 const outer=runtime.beginGeneration('floor-probe');const child=runtime.beginGeneration('blueprint-probe');runtime.rollbackGeneration(child);runtime.commitGeneration(outer);
 expect(state(game)).toBe(ledger);expect(state(game)).toEqual(saved);expect(state(game).actions[0]).toBe(action);expect(state(game).actors[0]).toBe(resource);
 game.animationEnabled=false;while(game.isAdvancing)game.stepAdvancement();expect(game.lastAdvancementError).toBeNull();expect(state(game).actions).toHaveLength(0);expect(game.actorActions!.bundles).toHaveLength(0);
 const save=game.toSaveSnapshot();const loaded=createHeadlessGame(301,'test');expect(loaded.loadSnapshot(save)).toBe(true);
});
it('MRE growth deathCaptured projects a regional ActorFacts into its existing closed pending schema',()=>{
 const registry=createExtensionRegistry();const module=registry.create(registry.manifest(['growth']))[0]!;
 let saved=module.initialState();
 const context={get state(){return structuredClone(saved)},setState(next:any){expect(module.validateState(next),'strict pending codec').toBe(true);saved=structuredClone(next)}};
 const actor={id:2,name:'regional actor',hp:0,maxHp:10,x:5,y:5,player:false,allied:false,hostile:true,monsterId:'rat',movementRegionId:42};
 module.hooks!.deathCaptured!({actor,origin:null,administrative:false},context as any);
 expect((saved as any).pending).toHaveLength(1);expect((saved as any).pending[0].actor).toEqual({id:2,name:'regional actor',hp:0,maxHp:10,x:5,y:5,player:false,allied:false,hostile:true,monsterId:'rat'});
 const forged=structuredClone(saved) as any;forged.pending[0].actor.extra='bad';expect(module.validateState(forged)).toBe(false);
});
for(const f of [f23,f118])it(`public seed${f.seed} closes original failure and accepts real save`,()=>{
 const {game}=start(f.modules,f.seed,'wizard');for(const input of f.inputs)play(game,input.action,input.data);play(game,f.attempted.action,f.attempted.data);
 expect(game.lastAdvancementError).toBeNull();const save=game.toSaveSnapshot();const loaded=createHeadlessGame(302,'test');expect(loaded.loadSnapshot(save)).toBe(true);
 expect(mechanical(loaded)).toEqual(mechanical(game));
});
it('VISIBILITY seed3 direct snapshot cadence and seek produce the same complete world',async()=>{
 const {default:trace}=await import('./src/ext/modules/combat/tests/fixtures/combat2-evasion.json');
 const {game}=start(trace.modules,trace.seed,'wizard');
 for(const input of trace.inputs){play(game,input.action,input.data);mechanical(game);}
 const expected=mechanical(game),recording=clone(game.exportRecording());
 const replay=createHeadlessGame(303,'test');expect(replay.loadReplay(recording)).toBe(true);replay.animationEnabled=false;
 while(replay.replayCursor<recording.events.length){replay.replayStep(true);expect(replay.replayError).toBeNull();mechanical(replay);}
 expect(mechanical(replay)).toEqual(expected);
 replay.replaySeek(recording.events.length);expect(replay.replayError).toBeNull();expect(mechanical(replay)).toEqual(expected);
});
