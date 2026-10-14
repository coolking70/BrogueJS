import { missingPackages, verifyInstalledPackageFallback } from '../../../../test/support/optionalPackageLifecycle';
import { afterEach, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { digest, type Trace } from './support/combat2Natural';
import { validateNaturalPersistence } from './support/combat2Persistence';
import { rows, start, mechanical, play, observe, clone, state } from './support/combat2Harness';
import { logger } from '../../../../engine/Systems/Logger';
import { readCreatureBirth } from '../../../birth';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game, GameRecording } from '../../../../engine/Core/Game';
import { createExtensionRegistry } from '../../../catalog';
import seed118 from './fixtures/combat2-sdk-seed118.json';

const out=process.env.COMBAT2_INTEGRATION_EVIDENCE ?? '/tmp/combat2-evidence/integrated';
const fixture=(name:string)=>`src/ext/modules/combat/tests/fixtures/combat2-integrated-${name}.json`;
afterEach(()=>{vi.restoreAllMocks();logger.reset();logger.onDisturb=null;});
function fixed(trace:Trace) {
 const {game,zero}=start(trace.modules,trace.seed,trace.mode),observation=observe(game);
 const keys=new Map<number,{snapshot:ReturnType<typeof mechanical>;save:ReturnType<Game['toSaveSnapshot']>}>();
 expect(game.exportRecording().extensions).toEqual(trace.identity);
 const remember=()=>keys.set(game.recordedInputEvents.length,{snapshot:mechanical(game),save:clone(game.toSaveSnapshot())});remember();
 expect(digest(mechanical(game))).toBe(trace.checkpoints[trace.prefix]);
 for(const input of trace.inputs){play(game,input.action,input.data);expect(game.recordedInputEvents.length).toBe(input.index);
  expect(digest(mechanical(game))).toBe(trace.checkpoints[input.index]);if(trace.keyIndices.includes(input.index))remember();}
 expect(observation.hits).toEqual(trace.hits);expect(observation.releases).toEqual(trace.releases);expect(observation.parries).toEqual(trace.parries);observation.restore();
 return {game,zero,trace,keys,recording:clone(game.exportRecording())};
}
const naturalGiantHit=(trace:Trace)=>trace.hits.some(hit=>hit.sourceId===1&&hit.damage>0&&rows.some(row=>`combat.${row.id}`===hit.attackId)
 &&trace.births.some(birth=>birth.id===hit.targetId&&birth.type.startsWith('giants.')&&(birth.birth as {creationReason:string}).creationReason==='natural'));
it(missingPackages(seed118.modules).length ? 'C2-INTEGRATED seed118 dependencies absent: remaining-world lifecycle and genuine seven-pack save/replay rejection' : 'C2-INTEGRATED seed118 original safe prefix and attempted new attack deal positive natural giant damage with full persistence',()=>{
 mkdirSync(out,{recursive:true});
    if (missingPackages(seed118.modules).length) { verifyInstalledPackageFallback(seed118.modules); return; }
 const result=fixed(JSON.parse(readFileSync(fixture('seed118'),'utf8')));
 expect(result.trace.inputs.slice(0,seed118.inputs.length).map(({action,data})=>({action,...(data===undefined?{}:{data})}))).toEqual(seed118.inputs.map(({action,data})=>({action,...(data===undefined?{}:{data})})));
 expect(result.trace.inputs[seed118.inputs.length]).toMatchObject(seed118.attempted);
 expect(naturalGiantHit(result.trace)).toBe(true);
 writeFileSync(`${out}/seed118.persistence.json`,JSON.stringify(validateNaturalPersistence(result),null,2));
},1800000);
/** This fixed public route is an exact copy of the already captured seven-pack
 * natural input, owned here so replay never imports another optional package's
 * test helper/data. No route planner, actor injection or resource mutation. */
it(missingPackages(['narrative','growth','combat','giants','crafting','foraging','settlement']).length ? 'C2-INTEGRATED seven-pack route unavailable: remaining-world lifecycle and genuine seven-pack save/replay rejection' : 'C2-INTEGRATED natural seven-pack nonempty cached NPC combat rows freeze while active-world time advances',()=>{
 mkdirSync(out,{recursive:true});
 const input: {seed:number;mode:'wizard';modules:string[];commands:Pick<GameRecording['events'][number],'action'|'data'|'decisions'>[];finalRng:unknown} =
  JSON.parse(readFileSync(fixture('cached-route'),'utf8'));
 if (missingPackages(input.modules).length) { verifyInstalledPackageFallback(input.modules); return; }
 const registry=createExtensionRegistry();
 const initialCommands=registry.create(registry.manifest(input.modules)).flatMap(module=>module.initialCommand
  ?[JSON.stringify({module:module.id,...module.initialCommand})]:[]);
 const game=createHeadlessGame(input.seed,'test');
 game.startNewGame({seed:input.seed,mode:input.mode,ruleSet:'extended',extensions:input.modules,initialCommands});game.animationEnabled=false;
 const settle=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};settle();
 const prefix=game.recordedInputEvents.map(({action,data,decisions})=>({action,data,decisions}));
 expect(prefix).toEqual(input.commands.slice(0,prefix.length));
 for(const command of input.commands.slice(prefix.length)){
  settle();const index=game.recordedInputEvents.length;game.executeCommand(command.action,command.data);
  for(const answer of command.decisions??[])if(game.pendingCommandConfirmation)game.resolveCommandDecision(game.pendingCommandConfirmation.token,answer);
  settle();expect(game.lastAdvancementError).toBeNull();expect(game.recordedInputEvents.length).toBe(index+1);
  expect(game.recordedInputEvents[game.recordedInputEvents.length-1]!.decisions).toEqual(command.decisions??[]);
 }
 expect(game.depth).toBe(8);expect(game.recordedInputEvents.length).toBe(input.commands.length);
 expect(game.toSnapshot().rngState).toEqual(input.finalRng);
 // Adjacent-floor stair followers keep their native admission countdowns
 // while combat resources are frozen. The existing route ends with four
 // scheduled entrants (max six objective blocks). Let those real public waits
 // finish, then compare a genuinely stationary complete cache without deleting
 // any follower, clock or world field from the assertion.
 for(let n=0;n<6;n++){play(game,'wait');settle();}
 expect(game.recordedInputEvents.length).toBe(input.commands.length+6);
 expect([...game.levels.values()].flatMap(level=>level.monsters).filter(monster=>monster.hp>0&&monster.entersLevelIn>0)).toEqual([]);
 // Birth is a session-only construction bridge (ext/birth.ts), deliberately
 // absent after decoding. Observe the actual naturally created live objects
 // before save/load; the complete load equality and id/type/live checks below
 // prove those same naturally born NPCs own the cached persisted resources.
 const naturalBirths=[...game.levels.entries()].filter(([depth])=>depth!==game.depth)
  .flatMap(([,level])=>[...level.monsters,...(level.dormantMonsters??[])])
  .filter(monster=>monster.hp>0&&readCreatureBirth(monster)?.creationReason==='natural')
  .map(monster=>({id:monster.id,type:monster.typeId,birth:clone(readCreatureBirth(monster)!)}));
 const saved=clone(game.toSaveSnapshot()),routeWorld=mechanical(game);
 expect(game.loadSnapshot(saved)).toBe(true);expect(mechanical(game)).toEqual(routeWorld);game.animationEnabled=false;
 const before=mechanical(game),cached=new Set(before.levels.flatMap(level=>[...level.monsters,...(level.dormantMonsters??[])].map(monster=>monster.id)));
 const rowsBefore=clone(state(game).actors.filter(actor=>cached.has(actor.actorId)));
 expect(rowsBefore.length,'nonempty natural cached NPC rows required').toBeGreaterThan(0);
 const naturalSources=[...game.levels.entries()].filter(([depth])=>depth!==game.depth)
  .flatMap(([,level])=>[...level.monsters,...(level.dormantMonsters??[])])
  .filter(monster=>rowsBefore.some(row=>row.actorId===monster.id)&&monster.hp>0&&naturalBirths.some(birth=>birth.id===monster.id&&birth.type===monster.typeId&&birth.birth.creationReason==='natural'));
 expect(naturalSources.length,'living naturally born cached NPC resources required').toBeGreaterThan(0);
 const index=game.recordedInputEvents.length;play(game,'wait');settle();const after=mechanical(game);
 expect(game.recordedInputEvents.length).toBe(index+1);
 expect(after.run.currentTick).toBeGreaterThan(before.run.currentTick);
 const rowsAfter=clone(state(game).actors.filter(actor=>cached.has(actor.actorId)));
 writeFileSync(`${out}/cached-freeze-before.json`,JSON.stringify(before));
 writeFileSync(`${out}/cached-freeze-after.json`,JSON.stringify(after));
 writeFileSync(`${out}/cached-freeze.json`,JSON.stringify({seed:input.seed,modules:input.modules,commands:input.commands.length,settlingInputs:Array.from({length:6},()=>({action:'wait'})),index,
  naturalSources:naturalSources.map(monster=>naturalBirths.find(birth=>birth.id===monster.id&&birth.type===monster.typeId)!),activeDepth:game.depth,
  tickBefore:before.run.currentTick,tickAfter:after.run.currentTick,cachedIds:[...cached],rowsBefore,rowsAfter,
  cachedWorldBeforeHash:digest(before.levels),cachedWorldAfterHash:digest(after.levels)},null,2));
 expect(rowsAfter).toEqual(rowsBefore);expect(after.levels).toEqual(before.levels);
},1800000);
