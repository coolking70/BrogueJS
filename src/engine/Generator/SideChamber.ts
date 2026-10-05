import { DungeonLayer, TerrainType as T, type Grid } from '../Map/Grid';
import type { GenerationContribution } from '../../ext/generation';
import type { Pos } from '../../types';
import { generationReserved } from './GenerationReservation';
export interface SideChamberPlan {
  readonly bounds: { x: number; y: number; width: number; height: number };
  readonly carve: readonly Pos[];
  readonly reserve: readonly Pos[];
  readonly spawn: Pos;
  readonly entry: readonly Pos[];
}
const rect = (x: number, y: number, w: number, h: number): Pos[] =>
  Array.from({ length: w * h }, (_, i) => ({ x: x + (i % w), y: y + Math.floor(i / w) }));
const rock = (grid: Grid, p: Pos) => {
  const c = grid.getCell(p.x, p.y);
  return (
    !!c &&
    !generationReserved(grid, p.x, p.y) &&
    !c.machineNumber &&
    (c.layers[DungeonLayer.DUNGEON] === T.GRANITE || c.layers[DungeonLayer.DUNGEON] === T.WALL) &&
    c.layers.slice(1).every((t) => t === T.NOTHING)
  );
};
const floor = (grid: Grid, p: Pos) => {
  const c = grid.getCell(p.x, p.y);
  return (
    !!c &&
    !generationReserved(grid, p.x, p.y) &&
    !c.machineNumber &&
    c.layers[DungeonLayer.DUNGEON] === T.FLOOR &&
    c.layers.slice(1).every((t) => t === T.NOTHING)
  );
};
/** Deterministic finite list. Never replaces a traversable/native room: a rock
 * envelope has exactly one open, >=3-wide attachment to existing terrain. */
export function sideChamberCandidates(grid: Grid, t: GenerationContribution): SideChamberPlan[] {
  const result: SideChamberPlan[] = [];
  for (let y = 2; y + t.height < grid.height - 2; y++)
    for (let x = 2; x + t.width < grid.width - 2; x++) {
      const inside = rect(x, y, t.width, t.height);
      if (!inside.every((p) => rock(grid, p))) continue;
      for (const side of [0, 1, 2, 3]) {
        const horizontal = side < 2,
          width = horizontal ? t.width : t.height;
        for (let offset = 2; offset + t.entranceWidth <= width - 2; offset++) {
          const entry = Array.from({ length: t.entranceWidth }, (_, i) =>
            horizontal
              ? { x: x + offset + i, y: side === 0 ? y - 1 : y + t.height }
              : { x: side === 2 ? x - 1 : x + t.width, y: y + offset + i }
          );
          const envelope = rect(x - 1, y - 1, t.width + 2, t.height + 2);
          if (!envelope.every((p) => rock(grid, p))) continue;
          const dx = side === 2 ? -1 : side === 3 ? 1 : 0,
            dy = side === 0 ? -1 : side === 1 ? 1 : 0;
          const corridor: Pos[] = [];
          for (let length = 1; length <= 12; length++) {
            const row = entry.map((p) => ({ x: p.x + dx * length, y: p.y + dy * length }));
            if (!row.every((p) => rock(grid, p) || floor(grid, p))) break;
            if (row.some((p) => floor(grid, p))) {
              const reserve = [...envelope, ...entry, ...corridor, ...row];
              for (const p of [...corridor, ...row])
                for (const [a, b] of [
                  [1, 0],
                  [-1, 0],
                  [0, 1],
                  [0, -1]
                ])
                  if (grid.isValidPos(p.x + a!, p.y + b!))
                    reserve.push({ x: p.x + a!, y: p.y + b! });
              result.push({
                bounds: { x, y, width: t.width, height: t.height },
                carve: [...inside, ...entry, ...corridor, ...row],
                reserve,
                spawn: {
                  x: x + Math.floor((t.width - 2) / 2),
                  y: y + Math.floor((t.height - 2) / 2)
                },
                entry
              });
              break;
            }
            corridor.push(...row);
          }
        }
      }
    }
  return result;
}
/** Actual 2x2 anchor graph plus a player graph avoiding the boss. This is used
 * after all native placement/catch-up, not just an area arithmetic check. */
export function sideChamberValid(grid: Grid, plan: SideChamberPlan, size: number): boolean {
  const b = plan.bounds;
  const clean = (p: Pos) => {
    const c = grid.getCell(p.x, p.y);
    return (
      !!c &&
      c.layers[0] === T.FLOOR &&
      c.layers.slice(1).every((t) => t === T.NOTHING) &&
      !c.machineNumber
    );
  };
  if (
    !plan.carve.every(clean) ||
    plan.spawn.x - b.x < 2 ||
    plan.spawn.y - b.y < 2 ||
    b.x + b.width - (plan.spawn.x + size) < 2 ||
    b.y + b.height - (plan.spawn.y + size) < 2
  )
    return false;
  const fit = (p: Pos) =>
    p.x >= b.x &&
    p.y >= b.y &&
    p.x + size <= b.x + b.width &&
    p.y + size <= b.y + b.height &&
    rect(p.x, p.y, size, size).every(clean);
  const flood = (start: Pos, valid: (p: Pos) => boolean) => {
    const seen = new Set<string>(),
      q = [start];
    for (let i = 0; i < q.length; i++) {
      const p = q[i]!,
        key = `${p.x},${p.y}`;
      if (seen.has(key) || !valid(p)) continue;
      seen.add(key);
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0]
      ])
        q.push({ x: p.x + dx!, y: p.y + dy! });
    }
    return seen;
  };
  const anchors = flood(plan.spawn, fit);
  if (anchors.size !== (b.width - size + 1) * (b.height - size + 1)) return false;
  const player = flood(
    { x: b.x, y: b.y },
    (p) =>
      p.x >= b.x &&
      p.y >= b.y &&
      p.x < b.x + b.width &&
      p.y < b.y + b.height &&
      clean(p) &&
      !(
        p.x >= plan.spawn.x &&
        p.y >= plan.spawn.y &&
        p.x < plan.spawn.x + size &&
        p.y < plan.spawn.y + size
      )
  );
  return player.size === b.width * b.height - size * size;
}

/** Complete reachable anchor×pose component, with the same compiled sweep
 * volume as live rotations. A room cannot be accepted on bounding-box area. */
export function rigidSideChamberValid(grid: Grid, plan: SideChamberPlan, shape: import('../Movement/RigidFootprint').CompiledRigidFootprint): boolean {
  const b = plan.bounds, poses = shape.poses;
  const inside = (p: Pos) => p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height;
  const clean = (p: Pos) => { const c = grid.getCell(p.x, p.y); return !!c && c.layers[0] === T.FLOOR && c.layers.slice(1).every(t => t === T.NOTHING) && !c.machineNumber; };
  if (!plan.carve.every(clean)) return false;
  const cells = (at: Pos, p: number) => shape.cells.get(poses[p]!)!.map(o => ({x:at.x+o.x,y:at.y+o.y}));
  const body = cells(plan.spawn,0);
  if (!body.every(p => p.x >= b.x+2 && p.y >= b.y+2 && p.x < b.x+b.width-2 && p.y < b.y+b.height-2)) return false;
  const area = b.width*b.height, fit = new Uint8Array(area*poses.length), key = (at: Pos,p:number) => p*area+(at.y-b.y)*b.width+at.x-b.x;
  const at = (i:number):Pos => ({x:b.x+i%area%b.width,y:b.y+Math.floor(i%area/b.width)});
  let count = 0;
  for(let p=0;p<poses.length;p++) for(let y=b.y;y<b.y+b.height;y++) for(let x=b.x;x<b.x+b.width;x++) {
    if(cells({x,y},p).every(o=>inside(o)&&clean(o))) { fit[key({x,y},p)]=1; count++; }
  }
  const seen = new Set<number>(), queue = [key(plan.spawn,0)];
  for(let i=0;i<queue.length;i++) {
    const n=queue[i]!; if(seen.has(n)||!fit[n])continue; seen.add(n);
    const origin=at(n),p=Math.floor(n/area);
    for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
      const dest={x:origin.x+dx!,y:origin.y+dy!}; if(inside(dest)&&fit[key(dest,p)])queue.push(key(dest,p));
    }
    for(const turn of [-1,1]) {
      const to=(p+turn+poses.length)%poses.length, sweep=shape.sweeps.get(`${poses[p]}:${poses[to]}`);
      if(sweep&&fit[key(origin,to)]&&sweep.every(o=>{const tile={x:origin.x+o.x,y:origin.y+o.y};return inside(tile)&&clean(tile);})) queue.push(key(origin,to));
    }
  }
  if(seen.size!==count) return false;
  // Entrance must admit a declared real pose. The player can walk around the
  // actual resting mask, including concave gaps, without a square exclusion.
  if(!poses.some((_,p)=>plan.entry.some(e=>cells(e,p).every(clean))))return false;
  const occupied=new Set(body.map(p=>`${p.x},${p.y}`)), player=new Set<string>(), q=[{x:b.x,y:b.y}];
  for(let i=0;i<q.length;i++) {
    const p=q[i]!,k=`${p.x},${p.y}`;if(player.has(k)||!inside(p)||!clean(p)||occupied.has(k))continue;player.add(k);
    for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]])q.push({x:p.x+dx!,y:p.y+dy!});
  }
  return player.size===area-body.length;
}
