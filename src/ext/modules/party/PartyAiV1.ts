import { PARTY_AI_RULES, type PartyAiView, type PartyAiDecision } from '../../partyAi';
import type { ActorIntent } from '../../party';
const directions = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0]
] as const;
const key = (x: number, y: number) => `${x},${y}`;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
/** Selection draws are derived, never native combat RNG. Stable total ordering. */
function sample(v: PartyAiView, purpose: string, n: number): number {
  let h = 2166136261;
  for (const c of JSON.stringify([
    v.seed,
    v.fingerprint,
    PARTY_AI_RULES.policyId,
    v.actorId,
    v.ordinal,
    purpose
  ]))
    h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return n ? h % n : 0;
}
export const PartyAiV1 = {
  decide(v: Readonly<PartyAiView>): PartyAiDecision {
    let nodes = 0;
    const result = (intent: ActorIntent, diagnostic: string): PartyAiDecision => ({
      intent,
      diagnostic,
      nodes
    });
    const wait = (reason = 'wait') => result({ kind: 'wait' }, reason);
    const cells = new Map(v.cells.map((c) => [key(c.x, c.y), c])),
      occupied = new Set(v.occupied.map((c) => key(c.x, c.y)));
    const safe = (x: number, y: number) => {
      const c = cells.get(key(x, y));
      return (
        !!c && c.passable && !occupied.has(key(x, y)) && (!v.settings.avoidDanger || !c.danger)
      );
    };
    const enemies = [...v.enemies].sort(
      (a, b) => distance(v.at, a) - distance(v.at, b) || a.id - b.id
    );
    const adjacent = enemies.find((e) => e.attackable && (e.adjacent ?? distance(v.at, e) === 1));
    const still = v.settings.tactic === 'still';
    if (!still && v.settings.avoidDanger && cells.get(key(v.at.x, v.at.y))?.danger) {
      const p = directions
        .map(([dx, dy]) => ({ dx, dy, x: v.at.x + dx, y: v.at.y + dy }))
        .find((p) => safe(p.x, p.y) && !enemies.some((e) => e.x === p.x && e.y === p.y));
      if (p) return result({ kind: 'move', dx: p.dx, dy: p.dy }, 'move');
    }
    if (v.settings.consumables && v.recovery.length)
      return result(
        {
          kind: 'item',
          operation: 'use',
          itemId: [...v.recovery].sort((a, b) => a - b)[0]!,
          target: null
        },
        'recover'
      );
    if (adjacent && still) return result({ kind: 'attack', targetId: adjacent.id }, 'attack');
    if (still) return wait('hold');
    function route(goal: (x: number, y: number) => boolean): PartyAiDecision {
      const queue = [{ ...v.at, dx: 0, dy: 0 }],
        seen = new Set([key(v.at.x, v.at.y)]);
      for (let i = 0; i < queue.length; i++) {
        if (nodes >= PARTY_AI_RULES.nodes) return wait('budget');
        nodes++;
        const at = queue[i]!;
        if (i && goal(at.x, at.y)) return result({ kind: 'move', dx: at.dx, dy: at.dy }, 'move');
        // Stair entry is allowed, but never path through a choice point.
        if (i && cells.get(key(at.x, at.y))?.stairs) continue;
        for (const [dx, dy] of directions) {
          const x = at.x + dx,
            y = at.y + dy,
            k = key(x, y);
          if (seen.has(k) || !safe(x, y) || enemies.some((e) => e.x === x && e.y === y)) continue;
          seen.add(k);
          queue.push({ x, y, dx: i ? at.dx : dx, dy: i ? at.dy : dy });
        }
      }
      return wait('no-route');
    }
    const attack = (target: (typeof enemies)[number]) =>
      (target.adjacent ?? distance(v.at, target) === 1) && target.attackable
        ? result({ kind: 'attack', targetId: target.id }, 'attack')
        : route((x, y) => distance({ x, y }, target) === 1);
    if (v.order) {
      const order = v.order;
      if (order.kind === 'attack') {
        const e = enemies.find((e) => e.id === order.targetId);
        return e ? attack(e) : wait('target-lost');
      }
      if (order.level !== v.level) return wait('target-lost');
      if (order.kind !== 'explore') {
        const radius = order.kind === 'guard' && !occupied.has(key(order.x, order.y)) ? 0 : 1;
        const arrived = (x: number, y: number) => {
          if (distance({ x, y }, order) > radius) return false;
          if (x === order.x || y === order.y) return true;
          // Rally adjacency must be connected through known, unblocked corners.
          return [cells.get(key(x, order.y)), cells.get(key(order.x, y))]
            .every(c => !!c && !(c.blocksDiagonal ?? !c.passable));
        };
        if (arrived(v.at.x, v.at.y)) return wait('hold');
        return route(arrived);
      }
      if (enemies[0]) return attack(enemies[0]);
      const exit = v.cells.find((c) => c.downStairs && c.passable);
      if (exit) {
        if (distance(v.at, exit) === 0) return wait('explore-complete');
        return route((x, y) => x === exit.x && y === exit.y);
      }
      const frontier = (x: number, y: number) =>
        directions.some(([dx, dy]) => !cells.has(key(x + dx, y + dy)));
      const path = route(frontier);
      if (path.diagnostic !== 'no-route') return path;
      // Once known safe frontiers are exhausted, approach the known stair and yield.
      const stairs = v.cells.filter((c) => c.stairs && c.passable);
      if (stairs.some((c) => distance(c, v.at) === 0)) return wait('explore-complete');
      return stairs.length
        ? route((x, y) => stairs.some((c) => c.x === x && c.y === y))
        : wait('explore-complete');
    }
    if (adjacent && v.settings.tactic !== 'distance')
      return result({ kind: 'attack', targetId: adjacent.id }, 'attack');
    if (v.settings.tactic === 'distance' && enemies[0]) {
      const e = enemies[0];
      if (distance(v.at, e) <= 2) {
        const steps = directions
          .map(([dx, dy]) => ({ x: v.at.x + dx, y: v.at.y + dy, dx, dy }))
          .filter(
            (p) =>
              safe(p.x, p.y) &&
              !enemies.some((e) => distance(p, e) < 2) &&
              distance(p, e) > distance(v.at, e)
          );
        if (steps.length) {
          const best = steps[sample(v, 'retreat', steps.length)]!;
          return result({ kind: 'move', dx: best.dx, dy: best.dy }, 'move');
        }
      }
      if (v.rangedItem !== null && e.ranged)
        return result(
          { kind: 'item', operation: 'throw', itemId: v.rangedItem, target: { x: e.x, y: e.y } },
          'attack'
        );
      if (adjacent) return result({ kind: 'attack', targetId: adjacent.id }, 'attack');
      return wait('no-ranged');
    }
    if (v.settings.tactic === 'attack' && enemies[0]) return attack(enemies[0]);
    if (v.settings.tactic === 'follow') {
      if (!v.leader) return wait('follow-unavailable');
      if (distance(v.at, v.leader) > 1) return route((x, y) => distance({ x, y }, v.leader!) <= 1);
    }
    if (v.settings.autoPickup) {
      const items = [...v.pickups].sort(
        (a, b) => distance(v.at, a) - distance(v.at, b) || a.id - b.id
      );
      if (items[0]) {
        if (distance(v.at, items[0]) === 0)
          return result(
            {
              kind: 'module',
              owner: 'foundation',
              commandId: 'native-action',
              payload: { action: 'pickup' }
            },
            'pickup'
          );
        return route((x, y) => items[0]!.x === x && items[0]!.y === y);
      }
    }
    return wait();
  }
};
