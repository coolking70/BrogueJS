import { installedModuleSubsets } from '../../../../test/support/installedExtensions';
import { afterEach, expect, it, vi } from 'vitest';
import { startGiants, json } from './naturalFixture';
import { loadGiantsDefinitionPack } from '../definitions';
import { isGiantsPack } from '../schema';
import { emptyProductionArena } from '../../../../test/support/productionComposite';
import { footprintOf, commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { getNextEntityId } from '../../../../entities/Creature';
import { rng } from '../../../../engine/Random';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { compositeSideChamberValid, type SideChamberPlan } from '../../../../engine/Generator/SideChamber';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { observeDisplayFrame } from '../../../../ui/displayProjection';
import { selectBossHud } from '../ui/view';
import { logger } from '../../../../engine/Systems/Logger';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';

const BODY = 'giants.shale-weaver-body';
afterEach(() => vi.restoreAllMocks());
function scene(ids = ['giants']) {
  const game = startGiants(ids, 443003, 'wizard'); emptyProductionArena(game);
  const core = game.createCompositeMonster(BODY, {x:14,y:12}, undefined, 'natural')!, group = game.bodyGroups![0]!;
  for (const m of game.monsters) { m.ticksUntilTurn=10000; m.regenTurns=0; }
  return {game,core,group,legs: game.monsters.filter(m => m !== core)};
}

it('installed original body and generation references reject missing, foreign or non-core identities', () => {
  const pack=loadGiantsDefinitionPack(); expect(isGiantsPack(pack)).toBe(true);
  expect(pack.bodies!.definitions[0]!.parts).toHaveLength(9);
  for (const edit of [(p:typeof pack) => p.templates[3] = {...p.templates[3]!,bodyId:'giants.unknown'},
      (p:typeof pack) => p.templates[3] = {...p.templates[3]!,formId:'giants.shale-weaver-leg'},
      (p:typeof pack) => p.bodies!.definitions[0] = {...p.bodies!.definitions[0]!,parts:p.bodies!.definitions[0]!.parts.map((part,i)=>i===1?{...part,formId:'combat.fake'}:part)},
      (p:typeof pack) => p.bodies!.definitions[0] = {...p.bodies!.definitions[0]!,constraints:p.bodies!.definitions[0]!.constraints.map((edge,i)=>i===0?{...edge,maxStepPerAction:3}:edge)}]) {
    const bad=json(pack); edit(bad); expect(isGiantsPack(bad)).toBe(false);
  }
});
it('pure whole-body birth preflight fails on a leg cell even when the core fits; no IDs, RNG or partial group', () => {
  const {game}=scene(); const before=getNextEntityId(), random=rng.getState(), groups=json(game.bodyGroups);
  game.grid.setTerrain(29,11,T.WALL);
  expect(game.canCreateModuleMonster('giants.shale-weaver',{x:30,y:12})).toBe(true);
  expect(game.canCreateCompositeMonster(BODY,{x:30,y:12})).toBe(false);
  expect(game.createCompositeMonster(BODY,{x:30,y:12})).toBeNull();
  expect(getNextEntityId()).toBe(before); expect(rng.getState()).toEqual(random); expect(game.bodyGroups).toEqual(groups);
});
it('arena acceptance tests the real legs, entrance and player route rather than core area', () => {
  const {game}=scene();
  const plan:SideChamberPlan={bounds:{x:24,y:8,width:16,height:12},spawn:{x:30,y:12},carve:[],reserve:[],entry:[{x:30,y:8}]};
  expect(compositeSideChamberValid(game.grid,plan,game.spatialCatalog,BODY)).toBe(true);
  game.grid.setTerrain(29,11,T.WALL); expect(compositeSideChamberValid(game.grid,plan,game.spatialCatalog,BODY)).toBe(false);
  game.grid.setTerrain(29,11,T.FLOOR);
  // A 2x2 core still fits this entry; the eight-leg formation does not.
  for(let x=24;x<40;x++) if(x<30||x>31) game.grid.setTerrain(x,7,T.WALL);
  expect(compositeSideChamberValid(game.grid,plan,game.spatialCatalog,BODY)).toBe(false);
});
it('a failed whole-body generation publication restores the prior group and every reachable native object', () => {
  const game=startGiants(['giants'],7309,'wizard');emptyProductionArena(game);
  game.createCompositeMonster(BODY,{x:14,y:12});
  const birth=game.createCompositeMonster.bind(game);
  vi.spyOn(game,'createCompositeMonster').mockImplementation((...args)=>{const result=birth(...args);expect(result).toBeTruthy();throw Error('body-publication-failure');});
  const audit=auditFullObjectGraph({game},[game.extensionRuntime!]), runtime=game.extensionRuntime!.snapshot(), random=rng.getState(), allocator=getNextEntityId();
  game.depth=15; // the entry transaction restores the departed depth on failure
  expect(()=>(game as any).generateDepth(false)).toThrow('body-publication-failure');
  expect(audit.differences()).toEqual([]);expect(game.extensionRuntime!.snapshot()).toEqual(runtime);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(allocator);
});
it.each(installedModuleSubsets(['combat', 'growth']).map(subset => ['giants', ...subset]))('real native sweep hits two actual legs once in %j, with transfer only at the central HP exit', (...ids:string[]) => {
  const {game,core,legs}=scene(ids); commitCreatureAnchor(game.player,{x:13,y:10});
  const weapon=ItemLoader.spawnWeapon('axe',-1,-1)!;
  Object.assign(weapon,{damage:'8-8',enchantment:0,strengthRequired:game.player.effectiveStrength,flags:['ITEM_ATTACKS_ALL_ADJACENT']});
  game.player.inventory.addItem(weapon); game.player.equippedWeapon=weapon;
  for(const m of legs) m.defense=-1000;
  const hit=vi.spyOn(CombatSystem,'attack'), damage=vi.spyOn(core,'takeDamage'), before=core.hp;
  game.executeCommand('move',{x:0,y:1});
  const calls=hit.mock.calls.filter(c=>legs.includes(c[1] as typeof core));
  expect(calls).toHaveLength(2); expect(new Set(calls.map(c=>c[1].id)).size).toBe(2);
  expect(core.hp).toBe(before-legs.reduce((sum,m)=>sum+Math.floor((m.maxHp-m.hp)/4),0));
  expect(damage).not.toHaveBeenCalled();
});
it('public group HUD follows a focused leg, keeps core HP, clips hidden siblings and detaches historical members', () => {
  const {game,core,group,legs}=scene();
  for(let y=0;y<game.grid.height;y++)for(let x=0;x<game.grid.width;x++) {game.grid.getCell(x,y)!.isVisible=true;game.grid.getCell(x,y)!.isClairvoyantVisible=false;}
  const frame = () => ({...observeDisplayFrame(game,logger), actorTags: {[core.id]: ['giants.boss']}});
  game.hoveredCell={...legs[0]!.loc}; const random=rng.getState(), old=frame();
  expect(old.bodyGroups![0]!.members).toHaveLength(9);
  expect(selectBossHud(old)).toMatchObject({id:core.id,hp:96,members:{alive:8,broken:0}});
  core.hp=80; legs[0]!.hp=7; expect(selectBossHud(old)?.hp).toBe(96); expect(old.bodyGroups![0]!.members.find(m=>m.entityId===legs[0]!.id)!.hp).toBe(12);
  for(const p of footprintOf(legs[1]!)) game.grid.getCell(p.x,p.y)!.isVisible=false;
  const partial=frame(); expect(partial.bodyGroups![0]!.members.some(m=>m.entityId===legs[1]!.id)).toBe(false);
  expect(selectBossHud(partial)?.members).toEqual({alive:7});
  for(const p of footprintOf(core)) game.grid.getCell(p.x,p.y)!.isVisible=false;
  expect(observeDisplayFrame(game,logger).bodyGroups).toEqual([]);
  expect(group.members).toHaveLength(9); expect(rng.getState()).toEqual(random);
});
it('a real player member kill has no death fact/drop, then one core kill retires the entire remaining body once', () => {
  const {game,core,group,legs}=scene(); commitCreatureAnchor(game.player,{x:13,y:10});
  const weapon=ItemLoader.spawnWeapon('sword',-1,-1)!; Object.assign(weapon,{damage:'20-20',enchantment:0,strengthRequired:game.player.effectiveStrength,flags:[]});
  game.player.inventory.addItem(weapon); game.player.equippedWeapon=weapon; legs[0]!.defense=-1000;
  const emit=vi.spyOn(game.extensionRuntime!,'emit'), kills=game.stats.kills;
  game.executeCommand('move',{x:0,y:1});
  expect(group.members.find(s=>s.partId==='leg00')).toMatchObject({life:'removed',entityId:null});
  expect(emit.mock.calls.filter(c=>c[0]==='deathCaptured')).toHaveLength(0); expect(game.stats.kills).toBe(kills);
  core.hp=1; core.defense=-1000; commitCreatureAnchor(game.player,{x:13,y:12});
  game.executeCommand('move',{x:1,y:0});
  expect(core.hp).toBe(0); expect(emit.mock.calls.filter(c=>c[0]==='deathCaptured')).toHaveLength(1);
  expect(game.monsters).toHaveLength(0); expect(game.bodyGroups).toBeUndefined(); expect(game.stats.kills).toBe(kills+1);
});
it('one poisoned leg ticks and transfers once per objective block; untouched siblings keep HP and native timers', () => {
  const {game,core,legs}=scene(), member=legs[0]!, other=legs[1]!, otherTicks=other.ticksUntilTurn;
  member.addPoison(3,4); const hp=core.hp, coreDamage=vi.spyOn(core,'takeDamage');
  game.executeCommand('wait'); expect(member.hp).toBe(8);expect(member.getStatusDuration('poisoned')).toBe(2);expect(core.hp).toBe(hp-1);
  game.executeCommand('wait'); expect(member.hp).toBe(4);expect(member.getStatusDuration('poisoned')).toBe(1);expect(core.hp).toBe(hp-2);
  expect(other.hp).toBe(12);expect(other.hasStatus('poisoned')).toBe(false);expect(other.ticksUntilTurn).toBe(otherTicks);expect(coreDamage).not.toHaveBeenCalled();
});
it('a fatal 1:4 member transfer counts the core defeat once, even though the direct member never owns a kill', () => {
  const {game,core,legs}=scene();core.hp=1;legs[0]!.defense=-1000;commitCreatureAnchor(game.player,{x:13,y:10});
  const weapon=ItemLoader.spawnWeapon('sword',-1,-1)!;Object.assign(weapon,{damage:'20-20',enchantment:0,strengthRequired:game.player.effectiveStrength,flags:[]});
  game.player.inventory.addItem(weapon);game.player.equippedWeapon=weapon;const kills=game.stats.kills,emit=vi.spyOn(game.extensionRuntime!,'emit');
  game.executeCommand('move',{x:0,y:1});
  expect(core.hp).toBe(0);expect(game.stats.kills).toBe(kills+1);expect(emit.mock.calls.filter(c=>c[0]==='deathCaptured')).toHaveLength(1);
});
it.each(installedModuleSubsets(['combat', 'growth']).map(subset => ['giants', ...subset]))('public thrown incineration lights several real legs once per part in %j', (...ids:string[]) => {
  const {game,legs}=scene(ids); commitCreatureAnchor(game.player,{x:10,y:11});
  const item=ItemLoader.spawnPotion('potion_of_incineration',-1,-1)!;game.player.inventory.addItem(item);
  // Isolate the native item/DF area subsegment; objective burning is covered separately.
  vi.spyOn(game as any,'playerTurnEnded').mockImplementation(()=>{});
  const burning=vi.spyOn(game as any,'setBurningDuration');
  game.executeItemCommand('throw',item);game.executeCommand('mouse_travel',{x:13,y:11});
  for(const leg of legs.slice(0,2)) {expect((game as any).burningDuration(leg)).toBeGreaterThan(0);expect(burning.mock.calls.filter(c=>c[0]===leg&&c[1]===7)).toHaveLength(1);}
});
