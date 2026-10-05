import type { Pos } from '../../types';
import { SpatialCatalog, type FootprintDefinition } from '../../engine/Movement/SpatialSchema';
import { RIGID_POSES } from '../../engine/Movement/RigidFootprint';
import { CreatureSpatial } from '../../engine/Movement/CreatureSpatial';
import { Grid, TerrainType as T } from '../../engine/Map/Grid';
import { Monster, type MonsterData } from '../../entities/Monster';
import monsters from '../../data/monsters.json';
const rat = (x: number, y: number) => new Monster(x, y, (monsters as MonsterData[]).find(m => m.id === 'rat')!);

export const MASKS = {
    L: [{ x:0,y:0 }, { x:1,y:0 }, { x:0,y:1 }],
    cross: [{ x:0,y:0 }, { x:-1,y:0 }, { x:1,y:0 }, { x:0,y:-1 }, { x:0,y:1 }],
    ring: Array.from({ length: 9 }, (_, i) => ({ x:i%3, y:Math.floor(i/3) })).filter(p => p.x !== 1 || p.y !== 1),
    bar: Array.from({ length: 4 }, (_, x) => ({ x,y:0 })),
};
export const definition = (id = 'fixture:bar', cells: readonly Pos[] = MASKS.bar): FootprintDefinition =>
    ({ id, owner:'foundation', geometry:{ kind:'mask', cells }, poses:[...RIGID_POSES] });
export function rigidScene(cells: readonly Pos[] = MASKS.bar, width = 20, height = 20) {
    const catalog = new SpatialCatalog(true), d = definition('fixture:body', cells);
    catalog.registerFootprint(d);
    const grid = new Grid(width, height);
    for (let y=0;y<height;y++) for (let x=0;x<width;x++) grid.setTerrain(x,y,T.FLOOR);
    const actor = rat(Math.floor(width/2), Math.floor(height/2));
    actor.spatial = { schema:1, footprintId:d.id, pose:'r0' };
    const world = { grid, monsters:[actor], dormantMonsters:[] as Monster[] };
    const spatial = new CreatureSpatial(world,catalog);
    return { catalog, actor, world, spatial, grid };
}
