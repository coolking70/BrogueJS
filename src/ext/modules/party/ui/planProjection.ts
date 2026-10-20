import type { KnownPartyWorld } from '../../../../engine/Core/PartyPlanning';
import type { PartyPlan } from '../../../partyWindow';
export const PARTY_PLAN_COLORS = [0xebd37a, 0x7bd8e8, 0xb29cfa, 0x9bdd8e] as const;
export interface PlanProjection {
  actorId: number;
  draft: boolean;
  points: { x: number; y: number }[];
  target: { x: number; y: number } | null;
  status: 'known' | 'unknown' | 'blocked' | 'unsupported';
}
/** Display-only, bounded projection. Its only input is the public known-world DTO. */
export function projectPartyPlans(view: KnownPartyWorld, drafts: ReadonlyMap<number, PartyPlan | null>): PlanProjection[] {
  const cells = new Map(view.cells.map(c => [`${c.x},${c.y}`, c]));
  return view.members.map(member => {
    const draft = drafts.has(member.id), plan = draft ? drafts.get(member.id) : member.plan;
    const points = [{ x: member.x, y: member.y }];
    const row: PlanProjection = { actorId: member.id, draft, points, target: null, status: 'known' };
    const enter = (x: number, y: number) => {
      const cell = cells.get(`${x},${y}`), previous = points[points.length - 1]!;
      if (!cell) { row.status = 'unknown'; return false; }
      if (!cell.passable || view.enemies.some(e => e.x === x && e.y === y) ||
        (previous.x !== x && previous.y !== y && (!cells.get(`${previous.x},${y}`)?.passable || !cells.get(`${x},${previous.y}`)?.passable))) {
        row.status = 'blocked'; return false;
      }
      points.push({ x, y }); return true;
    };
    if (plan?.kind === 'queue') {
      for (const intent of plan.actions.slice(draft ? 0 : member.cursor)) {
        const previous = points[points.length - 1]!;
        if (intent.kind === 'move') { if (!enter(previous.x + intent.dx, previous.y + intent.dy)) break; }
        else if (intent.kind === 'attack') {
          const enemy = view.enemies.find(e => e.id === intent.targetId);
          row.target = enemy ? { x: enemy.x, y: enemy.y } : null;
          row.status = enemy ? 'unsupported' : 'unknown'; break;
        } else if (intent.kind === 'item') {
          row.target = intent.target && cells.has(`${intent.target.x},${intent.target.y}`) ? { ...intent.target } : null;
          row.status = 'unsupported'; break;
        } else if (!['wait', 'search'].includes(intent.kind)) { row.status = 'unsupported'; break; }
      }
    } else if (plan?.kind === 'travel') {
      if (plan.level.kind !== 'dungeon' || plan.level.depth !== view.level || !cells.has(`${plan.target.x},${plan.target.y}`)) row.status = 'unknown';
      else {
        row.target = { ...plan.target };
        const queue = [{ x: member.x, y: member.y, parent: -1 }], seen = new Set([`${member.x},${member.y}`]);
        let found = -1;
        for (let index = 0; index < queue.length && index < 4096; index++) {
          const at = queue[index]!;
          if (at.x === plan.target.x && at.y === plan.target.y) { found = index; break; }
          for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]] as const) {
            const x = at.x + dx, y = at.y + dy, key = `${x},${y}`;
            if (seen.has(key) || !cells.get(key)?.passable || view.enemies.some(e => e.x === x && e.y === y)) continue;
            seen.add(key); queue.push({ x, y, parent: index });
          }
        }
        if (found < 0) row.status = 'blocked';
        else {
          const route: {x:number;y:number}[] = [];
          for (let index = found; queue[index]!.parent >= 0; index = queue[index]!.parent) route.push({x:queue[index]!.x,y:queue[index]!.y});
          points.push(...route.reverse());
        }
      }
    } else if (plan?.kind === 'ai-this-window' || member.ai?.active) row.status = 'unsupported';
    return row;
  });
}
