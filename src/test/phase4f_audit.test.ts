import { afterEach, expect, it, vi } from 'vitest';
import { Grid, TerrainType } from '../engine/Map/Grid';
import { SpatialCatalog } from '../engine/Movement/SpatialSchema';
import { bindSpatialCatalog, footprintOf } from '../engine/Movement/CreatureSpatial';
import { bodySightContact, BODY_SIGHT_PAIR_LIMIT } from '../engine/Combat/BodyPerception';
import { Monster, type MonsterData } from '../entities/Monster';
import species from '../data/monsters.json';
import { rng } from '../engine/Random';
import * as modules from '../ext/catalog';
import { productionBodyScene } from './support/productionComposite';
afterEach(() => vi.restoreAllMocks());

it('the foundation body/transition fixture needs no installed giants descriptor or declarations', () => {
  // Availability proof only; physical-deletion preparation is recorded separately.
  vi.spyOn(modules, 'getInstalledModuleDescriptors').mockReturnValue(modules.getInstalledModuleDescriptors().filter(d=>d.id!=='giants'));
  const {game,core,actors}=productionBodyScene();
  expect(modules.getInstalledModuleDescriptors().some(d=>d.id==='giants')).toBe(false);
  expect(game.extensionRuntime!.manifest.modules.map(m=>m.id)).toEqual(['body-fixture']);
  actors[1]!.takeDamage(20,true);expect(game.bodyGroups![0]!.appliedBreaks).toHaveLength(1);
  expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
  const source=game.monsters.find(m=>m.id===core.id)!, hp=source.hp;
  const result=game.transitionBody({sourceGroupId:source.id,reason:'split',results:[{formId:'body-fixture.ridgeback',memberMap:[]},{formId:'body-fixture.ridgeback',memberMap:[]}],hp:'conserve',statuses:'preserve',relationships:'preserve',placement:'nearest'});
  expect(result.outcome).toBe('applied');expect(game.bodyGroups).toBeUndefined();expect(game.monsters).toHaveLength(2);
  expect(game.monsters.reduce((sum,m)=>sum+m.hp,0)).toBe(hp);expect(game.monsters[0]!.id).toBe(core.id);
  expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});

it('16-cell observers/targets choose a stable 128-pair observation set before LOS, without RNG or player discovery', () => {
  const catalog = new SpatialCatalog(true), grid = new Grid(40, 30);
  catalog.registerFootprint({id:'fixture:sight',owner:'foundation',geometry:{kind:'rect',width:4,height:4},poses:['r0']});
  for(let y=0;y<grid.height;y++)for(let x=0;x<grid.width;x++)grid.setTerrain(x,y,TerrainType.FLOOR);
  const actors=[{x:3,y:3},{x:20,y:3}].map(at=>{
    const actor=new Monster(at.x,at.y,species.find(m=>m.id==='rat')! as MonsterData);
    actor.spatial={schema:1,footprintId:'fixture:sight',pose:'r0'};bindSpatialCatalog(actor,catalog);return actor;
  });
  const [observer,target]=actors as [Monster,Monster], before=rng.getState();
  const pairs=footprintOf(observer).flatMap(from=>footprintOf(target).map(to=>({from,to,distance:Math.max(Math.abs(from.x-to.x),Math.abs(from.y-to.y))}))).sort((a,b)=>a.distance-b.distance);
  expect(pairs).toHaveLength(256);expect(BODY_SIGHT_PAIR_LIMIT).toBe(128);
  const beyond=pairs[128]!, late=vi.fn((x0,y0,x1,y1)=>x0===beyond.from.x&&y0===beyond.from.y&&x1===beyond.to.x&&y1===beyond.to.y);
  expect(bodySightContact(grid,observer,target,late)).toBeNull();expect(late).toHaveBeenCalledTimes(128);
  const again=vi.fn(()=>false);expect(bodySightContact(grid,observer,target,again)).toBeNull();expect(again.mock.calls).toEqual(late.mock.calls);
  const first=vi.fn(()=>true);expect(bodySightContact(grid,observer,target,first)).toEqual(pairs[0]);expect(first).toHaveBeenCalledOnce();
  expect(rng.getState()).toEqual(before);
  for(let y=0;y<grid.height;y++)for(let x=0;x<grid.width;x++)expect(grid.getCell(x,y)).toMatchObject({hasMemory:false,isVisible:false});
});
