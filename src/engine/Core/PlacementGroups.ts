import type { Game } from './Game';
import { placementCandidates, placeNode, recordWorldReceipt } from './WorldWorkWorld';
import { ownerRange } from './KindKnowledge';
import { TerrainType, DungeonLayer } from '../Map/Grid';
import { World5Error } from '../../ext/world5';
export function placeResourceGroups(game: Game): void {
  const groups =
    game.extensionRuntime
      ?.worldDefinitionPacks()
      .flatMap((p) => p.placementGroups ?? [])
      .sort((a, b) =>
        a.owner === b.owner ? (a.id < b.id ? -1 : 1) : a.owner < b.owner ? -1 : 1
      ) ?? [];
  for (const g of groups) {
    const band = g.perDepth.find((r) => game.depth >= r.fromDepth && game.depth <= r.toDepth),
      key = `dungeon.${game.depth}`;
    if (!band) continue;
    const count =
        band.min + ownerRange(game, g.owner, `${g.id}.count.${key}`, 0, band.max - band.min + 1),
      members = g.members.filter((m) => m.minDepth <= game.depth),
      nodes = game.world5!.nodes;
    let reason: 'no-space' | 'budget' | 'run-limit' | null = null;
    const cells = [...placementCandidates(game)];
    const weighted = <T>(
      values: readonly T[],
      weight: (v: T) => number,
      domain: string,
      k: number
    ): T => {
      const total = values.reduce((n, v) => n + weight(v), 0);
      let r = ownerRange(game, g.owner, domain, k, total);
      for (const v of values) {
        r -= weight(v);
        if (r < 0) return v;
      }
      throw new Error('C5_TRANSACTION');
    };
    const cellWeight = (p: { x: number; y: number }) => {
      const pref = g.preference;
      if (!pref) return 1;
      for (let y = p.y - pref.radius; y <= p.y + pref.radius; y++)
        for (let x = p.x - pref.radius; x <= p.x + pref.radius; x++) {
          // prettier-ignore -- pinned E23 base-type reader
          const t=game.grid.getCell(x,y)?.layers[DungeonLayer.SURFACE];
          if (
            (pref.tags.includes('terrain.luminescent-fungus') &&
              t === TerrainType.LUMINESCENT_FUNGUS) ||
            (pref.tags.includes('terrain.fungus-forest') &&
              (t === TerrainType.FUNGUS_FOREST || t === TerrainType.TRAMPLED_FUNGUS_FOREST))
          )
            return pref.preferredWeight;
        }
      return pref.otherWeight;
    };
    for (let k = 0; k < count; k++) {
      if (nodes.filter((n) => n.instanceKey.startsWith(g.id + '#')).length >= g.maxPerRun) {
        reason = 'run-limit';
        break;
      }
      if (
        nodes.length >= 512 ||
        nodes.filter((n) => n.levelRef.kind === 'dungeon' && n.levelRef.depth === game.depth)
          .length >= 32
      ) {
        reason = 'budget';
        break;
      }
      if (!cells.length || !members.length) {
        reason = 'no-space';
        break;
      }
      const member = weighted(members, (m) => m.weight, `${g.id}.kind.${key}`, k),
        at = weighted(cells, cellWeight, `${g.id}.cell.${key}`, k),
        d = game
          .extensionRuntime!.worldDefinitionPacks()
          .flatMap((p) => p.resourceNodes)
          .find((d) => d.id === member.resourceDefinitionId)!;
      try {
        placeNode(game, d, at, `${g.id}#${key}#${k}`);
      } catch (e) {
        if (e instanceof World5Error && e.code === 'C5_BUDGET') {
          reason = 'budget';
          break;
        }
        throw e;
      }
      cells.splice(cells.indexOf(at), 1);
    }
    recordWorldReceipt(
      game,
      g.owner,
      'placement',
      `${g.id}@${key}`,
      reason ? 'skipped' : 'completed',
      reason
    );
  }
}
