import type { Game } from '../Core/Game';
import { footprintOf } from '../Movement/CreatureSpatial';
import { publicMonsterBody } from './MonsterBody';
import i18next from 'i18next';
import { sidebarEntityRows, type SidebarEntityRow } from './MonsterSidebar';
import type { DetailInfo } from './DetailGenerator';

/** Detached knowledge projection. Unseen cores publish no group identity;
 * hidden limbs publish no IDs, positions or HP. Exact break counts require
 * all live shapes and all missing preferred slots to be in current view. */
export function publicMonsterGroups(game: Game) {
  if (game.player.hasStatus('hallucinating')) return [];
  return (game.bodyGroups ?? []).flatMap(group => {
    const core = game.monsters.find(m => m.id === group.coreId);
    if (!core) return [];
    const coreVisible = !!publicMonsterBody(game.player, game.grid, core)?.cells.some(p => {
      const c=game.grid.getCell(p.x,p.y);return !!c?.isVisible && !c.isClairvoyantVisible;
    });
    if (!coreVisible && !game.seenBodyCoreIds.has(core.id)) return [];
    const definition = game.spatialCatalog.body(group.bodyDefinitionId);
    const visible = (p: { x: number; y: number }) => { const c = game.grid.getCell(p.x, p.y); return !!c?.isVisible && !c.isClairvoyantVisible; };
    const members = group.members.flatMap(s => {
      const m = game.monsters.find(m => m.id === s.entityId), body = m && publicMonsterBody(game.player, game.grid, m);
      if (!m || !body) return [];
      const cells = body.cells.filter(visible);
      return cells.length ? [{ entityId: m.id, partId: s.partId, name: m.name, hp: m.hp, maxHp: m.maxHp, cells: cells.map(p => ({ ...p })) }] : [];
    });
    if (!members.length) return [];
    const complete = coreVisible && group.members.every(s => {
      const m = game.monsters.find(m => m.id === s.entityId), published = members.find(m => m.entityId === s.entityId);
      if (m) return !!published && published.cells.length === footprintOf(m).length;
      const part = definition.parts.find(p => p.partId === s.partId)!, fp = game.spatialCatalog.form(part.formId).footprintId;
      return game.spatialCatalog.cells(fp, game.spatialCatalog.definition(fp).poses[0]!).every(p => visible({ x: core.x + part.preferredOffset.x + p.x, y: core.y + part.preferredOffset.y + p.y }));
    });
    return [{ groupId: group.groupId, coreId: core.id, coreVisible, members,
      ...(complete ? { broken: group.members.filter(s => s.life === 'removed').length } : {}) }];
  });
}

type PublicGroup = ReturnType<typeof publicMonsterGroups>[number];
export type PublicSidebarEntityRow = Exclude<SidebarEntityRow, { kind: 'monster' }>
  | (Extract<SidebarEntityRow, { kind: 'monster' }> & { bodyGroup?: PublicGroup });

/** Preserve native per-entity selection for aiming/inspection. Only the list
 * projection collapses published members, at the first member's priority. */
export function publicSidebarEntityRows(game: Game): PublicSidebarEntityRow[] {
  const rows = sidebarEntityRows(game.player, game.grid, game.monsters, game.items, game.hoveredCell, game.depth);
  if (!game.bodyGroups?.length) return rows;
  const published = publicMonsterGroups(game);
  const membership = new Map(published.flatMap(g => g.members.map(m => [m.entityId, g] as const)));
  const added = new Set<number>();
  return rows.flatMap((row): PublicSidebarEntityRow[] => {
    const group = row.kind === 'monster' ? membership.get(row.id) : undefined;
    if (!group) return [row];
    if (added.has(group.groupId)) return [];
    added.add(group.groupId);
    const core = rows.find((r): r is Extract<SidebarEntityRow, { kind: 'monster' }> => r.kind === 'monster' && r.id === group.coreId);
    const memberRows = rows.filter((r): r is Extract<SidebarEntityRow, { kind: 'monster' }> => r.kind === 'monster' && membership.get(r.id) === group);
    const representative = core ?? memberRows[0]!;
    const publicRow = group.coreVisible ? representative : { ...representative,
      name: i18next.t('sidebar.body_core_hidden'), hp: 0, maxHp: 0, bodySize: null, bodyCellCount: null,
      behavior: '', statuses: [], negated: false };
    return [{ ...publicRow, bodyGroup: group, focused: memberRows.some(r => r.focused),
      distanceSquared: Math.min(...memberRows.map(r => r.distanceSquared ?? (r.loc.x - game.player.x) ** 2 + (r.loc.y - game.player.y) ** 2)),
      distance: Math.min(...memberRows.map(r => r.distance ?? Math.max(Math.abs(r.loc.x - game.player.x), Math.abs(r.loc.y - game.player.y)))) }];
  });
}

export function bodyMemberSummary(group: PublicGroup): string {
  const alive = group.members.filter(m => m.entityId !== group.coreId).length;
  return i18next.t(group.broken === undefined ? 'sidebar.body_members_visible' : 'sidebar.body_members', { alive, broken: group.broken });
}

/** Core inspection includes only currently published members; limb inspection
 * remains independent. Rebuild on click, never consult a future history frame. */
export function appendPublicBodyDetail(game: Game, entityId: number, detail: DetailInfo): DetailInfo {
  const group = publicMonsterGroups(game).find(g => g.coreId === entityId);
  if (!group) return detail;
  const rows = sidebarEntityRows(game.player, game.grid, game.monsters, [], null, game.depth);
  const members = group.members.filter(m => m.entityId !== group.coreId);
  return { ...detail, sections: [...detail.sections, { header: i18next.t('sidebar.body_members_detail'),
    lines: [{ text: bodyMemberSummary(group) }, ...members.map((m, i) => {
      const row = rows.find(r => r.kind === 'monster' && r.id === m.entityId);
      const status = row?.kind === 'monster' ? [row.behavior, ...row.statuses.map(s => `${s.label} ${s.value}`)].filter(Boolean).join(' · ') : '';
      return { text: i18next.t('sidebar.body_member_hp', { index: i + 1, name: m.name, hp: m.hp, maxHp: m.maxHp }) + (status ? ` · ${status}` : ''),
        progress: { value: m.hp, max: m.maxHp } };
    })] }] };
}
