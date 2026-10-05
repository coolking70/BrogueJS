import type { DisplayFrame } from '../../../../ui/displayProjection';
import type { PublicMonsterZone } from '../../../../engine/UI/MonsterZones';
export interface BossHudModel {
  id: number;
  name: string;
  hp: number;
  maxHp: number;
  color: string;
  zone?: PublicMonsterZone;
  members?: { alive: number; broken?: number };
}
/** Public historical DTO only: tags, identity, current/max HP and focus are
 * captured with the rows. No live actors, module state or RNG access. */
export function selectBossHud(frame: DisplayFrame): BossHudModel | null {
  if (frame.terminal || frame.player.statuses.hallucinating) return null;
  const aim = frame.arcana?.cursor ?? frame.throwAim;
  const rows = frame.rows.filter(
    (r) =>
      r.kind === 'monster' &&
      frame.actorTags?.[r.id]?.includes('giants.boss') &&
      r.direct &&
      r.hp > 0
  );
  rows.sort((a, b) => {
    const focused = (r: typeof a) =>
      r.focused ||
      !!frame.bodyGroups?.find(g => g.coreId === r.id)?.members.some(m =>
        frame.rows.some(row => row.id === m.entityId && row.focused)
        || !!aim && m.cells.some(p => p.x === aim.x && p.y === aim.y)) ||
      (!!aim &&
        (r.kind === 'monster' && r.bodyCells
          ? r.bodyCells.some((p) => p.x === aim.x && p.y === aim.y)
          : r.loc.x === aim.x && r.loc.y === aim.y));
    const dist = (r: typeof a) =>
      r.kind === 'monster'
        ? (r.distanceSquared ?? (r.loc.x - frame.player.x) ** 2 + (r.loc.y - frame.player.y) ** 2)
        : Infinity;
    return (
      Number(focused(b)) - Number(focused(a)) || dist(a) - dist(b) || Number(a.id) - Number(b.id)
    );
  });
  const row = rows[0];
  const group = frame.bodyGroups?.find(g => g.coreId === row?.id);
  const members = group ? { alive: group.members.filter(m => m.entityId !== group.coreId).length,
    ...(group.broken !== undefined ? { broken: group.broken } : {}) } : undefined;
  const at = aim ?? frame.hoverCell;
  const zone = row?.kind === 'monster' ? row.zones?.find(z => !z.broken && !!at && z.cells.some(p => p.x === at.x && p.y === at.y))
    ?? row.zones?.find(z => z.broken) ?? row.zones?.[0] : undefined;
  return row?.kind === 'monster'
    ? { id: row.id, name: row.name, hp: row.hp, maxHp: row.maxHp, color: row.color, ...(zone ? { zone } : {}), ...(members ? { members } : {}) }
    : null;
}
