import { it, expect, vi } from 'vitest';
import expected from './fixtures/party-phase6-inert.json';
import { createHash } from 'node:crypto';
import { Game } from '../engine/Core/Game';
import { createExtensionRegistry } from '../ext/catalog';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import '../i18n';
it('captures phase6 unchanged run bytes', () => {
 vi.spyOn(Date, 'now').mockReturnValue(1792252800000);
 // No-party objective work must never enumerate the P1d stationed roster.
 // Spy on the prototype so the fixture's authoritative own-key check stays intact.
 const stationed = vi.spyOn(Game.prototype as any, 'activeStationedResidents', 'get');
 const rows=[];
 // Explicit module-bearing configuration lets the dependency guard see this fixed fixture's prerequisites.
 const legacy = {modules:['combat','crafting','foraging','giants','growth','loot','narrative','settlement']};
 for (const ids of [null, [], ['growth'], ['loot'], legacy.modules]) {
  const modules=ids ? createExtensionRegistry().create(createExtensionRegistry().manifest(ids)) : [];
  const initialCommands=modules.flatMap(m=>m.initialCommand?[JSON.stringify({module:m.id,...m.initialCommand})]:[]);
  const game=new Game({seed:1});
  game.startNewGame({seed:42,mode:'normal',...(ids?{ruleSet:'extended' as const,extensions:ids,initialCommands}:{})});
  game.animationEnabled=false;
  for(let i=0;i<4;i++) { while(logger.pendingAcknowledgment) logger.acknowledgeNext(); game.executeCommand('wait'); }
  const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
  rows.push({ids,keys:Object.keys(game).sort(),save:hash(game.toSaveSnapshot()),recording:hash(game.exportRecording()),random:rng.getState(),messages:hash(logger.messages)});
  game.disposeRecording();game.extensionRuntime?.unload();
 }
 expect(rows).toEqual(expected);
 expect(rows).toHaveLength(5);
 expect(stationed).not.toHaveBeenCalled();
 vi.restoreAllMocks();
},120000);

it('no-party light occupancy bypasses the party roster view', () => {
 const game = new Game({seed:42});
 const allies = vi.spyOn(Game.prototype, 'nativeAllyActors', 'get');
 try {
  expect(game.party).toBeUndefined();
  const occupied = (x:number,y:number) => (game as any).hasCreatureAtForLight(x,y);
  expect(occupied(game.player.x,game.player.y)).toBe(true);
  const monster = game.monsters.find(m => m.hp > 0);
  if(monster) expect(occupied(monster.x,monster.y)).toBe(true);
  expect(occupied(-1,-1)).toBe(false);
  expect(allies).not.toHaveBeenCalled();
 } finally {
  allies.mockRestore();game.disposeRecording();game.extensionRuntime?.unload();
 }
});
