import { afterEach, expect, it, vi } from 'vitest';
import { naturalColossus, giantsState, json } from './naturalFixture';
import { observeDisplayFrame } from '../../../../ui/displayProjection';
import { selectBossHud } from '../ui/view';
import { commitCreatureAnchor, footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { MonsterState } from '../../../../entities/Monster';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { auditFullObjectGraph, fullGenerationRoots } from '../../../../test/support/fullGenerationCheckpointOracle';
import { readCreatureBirth } from '../../../birth';
afterEach(()=>{vi.restoreAllMocks();logger.reset();});
function fractured() {
  const {game,boss}=naturalColossus();const id=boss.id,region=boss.spatial!.movementRegionId!;
  // Only the damage/readiness setup is diagnostic. The arena, original birth
  // and route are natural seed7309; an actual wait runs the native NPC selector.
  boss.hp=129;boss.state=MonsterState.HUNTING;boss.ticksUntilTurn=0;
  game.executeCommand('wait');expect(game.lastAdvancementError).toBeNull();
  const encounter=giantsState(game).bosses.find(b=>b.primaryId===id)!;
  const descendants=encounter.subjects.map(s=>game.monsters.find(m=>m.id===s.groupId)!);
  expect(descendants).toHaveLength(2);return {game,boss,id,region,encounter,descendants};
}
it('natural D7 seed7309 enters its data-driven half-HP split through the real native clock, preserving encounter and movement bounds',()=>{
  const {game,boss,id,region,descendants,encounter}=fractured();
  expect(boss.id).toBe(id);expect(descendants.map(m=>m.hp)).toEqual([65,64]);expect(descendants.every(m=>m.typeId==='giants.ridgeback')).toBe(true);
  expect(logger.messages.some(m=>m.text===`沉渊巨像崩解，裂成2具${descendants[0]!.name}！`)).toBe(true);
  expect(descendants.every(m=>m.spatial!.movementRegionId===region&&m.bodyTransitionHistory?.includes('giants.colossus-fracture'))).toBe(true);
  const bounds=game.extensionRuntime!.ownedRegion(region,7)!.bounds;
  for(const p of descendants.flatMap(m=>footprintOf(m)))expect(p.x>=bounds.x&&p.y>=bounds.y&&p.x<bounds.x+bounds.width&&p.y<bounds.y+bounds.height).toBe(true);
  expect(readCreatureBirth(descendants[1]!)).toMatchObject({creationReason:'split',sourceId:id});expect(descendants[1]!.bodyTransitionRewardless).toBe(true);
  expect(encounter.status).toBe('alive');expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
},60000);
it('split descendants terminate one encounter only after the last death; clone/summon do not enter its subject set',()=>{
  const {game,descendants,id}=fractured();
  const clone=game.cloneMonster(descendants[0]!)!;expect(clone).toBeTruthy();expect(game.extensionRuntime!.publicActorTags(clone.id)).toEqual([]);
  expect(giantsState(game).bosses.find(b=>b.primaryId===id)!.subjects).toHaveLength(2);
  descendants[0]!.takeDamage(10000);expect(giantsState(game).bosses.find(b=>b.primaryId===id)!.status).toBe('alive');
  expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
  const remaining=game.monsters.find(m=>m.id===descendants[1]!.id)!;remaining.takeDamage(10000);
  const end=giantsState(game).bosses.find(b=>b.primaryId===id)!;expect(end.status).toBe('defeated');expect(end.subjects.every(s=>s.status==='dead')).toBe(true);
  expect(game.monsters.find(m=>m.id===clone.id)!.hp).toBeGreaterThan(0);expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
},60000);
it('a no-fit natural arena retains positive paid time, HP/ID/bindings and a persistent spent receipt',()=>{
  const {game,boss}=naturalColossus();boss.hp=129;boss.state=MonsterState.HUNTING;
  const bounds=game.extensionRuntime!.ownedRegion(boss.spatial!.movementRegionId!,7)!.bounds;
  for(let x=bounds.x;x<bounds.x+bounds.width;x++)for(let y=bounds.y;y<bounds.y+bounds.height;y++)game.grid.setTerrain(x,y,T.WALL);
  for(const p of footprintOf(boss))game.grid.setTerrain(p.x,p.y,T.FLOOR);
  // Two 2x2 bodies cannot share the old 3x3 cavity.
  expect((game as any).tryActiveBodyTransition(boss)).toBe(true);expect(boss.typeId).toBe('giants.abyssal-colossus');expect(boss.hp).toBe(129);
  expect(boss.ticksUntilTurn).toBeGreaterThanOrEqual(200);expect(boss.bodyTransitionHistory).toEqual(['giants.colossus-fracture']);
  expect(giantsState(game).bosses.find(b=>b.primaryId===boss.id)!.subjects).toHaveLength(1);
  const state=giantsState(game);expect((game as any).tryActiveBodyTransition(boss)).toBe(false);expect(giantsState(game)).toEqual(state);
},60000);
it('current HUD combines only visible encounter descendants and old frames retain the pre-split HP/shape without reading live state or RNG',()=>{
  const {game,boss}=naturalColossus();boss.hp=129;boss.state=MonsterState.HUNTING;boss.ticksUntilTurn=0;
  commitCreatureAnchor(game.player,{x:boss.x-2,y:boss.y});(game as any).updateVision();
  const before=observeDisplayFrame(game,logger),old=selectBossHud(before)!;expect(old.hp).toBe(129);expect(old.maxHp).toBe(260);
  game.executeCommand('wait');const frame=observeDisplayFrame(game,logger),hud=selectBossHud(frame)!;
  expect(hud.descendants).toBe(2);expect(hud.hp).toBe(129);expect(hud.maxHp).toBe(240);expect(selectBossHud(before)).toEqual(old);
  const one=json(frame);const other=one.rows.find(r=>r.kind==='monster'&&r.id!==hud.id&&one.actorTags?.[r.id]?.includes('giants.boss'))!;
  one.rows=one.rows.filter(r=>r!==other);const visible=selectBossHud(one)!;expect(visible.descendants).toBeUndefined();expect(visible.hp).toBeLessThan(129);
  const random=rng.getState(),audit=auditFullObjectGraph(fullGenerationRoots(game),[game.extensionRuntime!]);
  for(let i=0;i<5;i++){selectBossHud(frame);selectBossHud(before);}expect(rng.getState()).toEqual(random);expect(audit.differences()).toEqual([]);
},60000);
