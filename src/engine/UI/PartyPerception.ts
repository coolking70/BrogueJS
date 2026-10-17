import type {Creature} from '../../entities/Creature';
import type {Grid} from '../Map/Grid';
/** Derived per-observer masks. Shared display visibility never grants another actor a target. */
const masks=new WeakMap<Grid,Map<number,boolean[][]>>();
export function setPartyPerception(grid:Grid,rows:readonly {actor:Creature;legal:boolean[][]}[]):void {
  masks.set(grid,new Map(rows.map(row=>[row.actor.id,row.legal])));
}
export function canActorSeeCell(actor:Creature,grid:Grid,x:number,y:number):boolean {
  const own=masks.get(grid)?.get(actor.id);return own?!!own[x]?.[y]:!!grid.getCell(x,y)?.isVisible;
}

export function hasPartyPerception(actor:Creature,grid:Grid):boolean{return masks.get(grid)?.has(actor.id)??false;}
