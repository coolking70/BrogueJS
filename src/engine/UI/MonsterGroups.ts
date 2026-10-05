import type { Game } from '../Core/Game';
import { footprintOf } from '../Movement/CreatureSpatial';
import { publicMonsterBody } from './MonsterBody';

/** Detached knowledge projection. Hidden cores publish no group identity;
 * hidden limbs publish no IDs, positions or HP. Exact break counts require
 * all live shapes and all missing preferred slots to be in current view. */
export function publicMonsterGroups(game: Game) {
  if (game.player.hasStatus('hallucinating')) return [];
  return (game.bodyGroups ?? []).flatMap(group => {
    const core = game.monsters.find(m => m.id === group.coreId);
    if (!core || !publicMonsterBody(game.player, game.grid, core)) return [];
    const definition = game.spatialCatalog.body(group.bodyDefinitionId);
    const visible = (p: { x: number; y: number }) => { const c = game.grid.getCell(p.x, p.y); return !!c?.isVisible && !c.isClairvoyantVisible; };
    const members = group.members.flatMap(s => {
      const m = game.monsters.find(m => m.id === s.entityId), body = m && publicMonsterBody(game.player, game.grid, m);
      if (!m || !body) return [];
      const cells = body.cells.filter(visible);
      return cells.length ? [{ entityId: m.id, partId: s.partId, name: m.name, hp: m.hp, maxHp: m.maxHp, cells: cells.map(p => ({ ...p })) }] : [];
    });
    if (!members.some(m => m.entityId === core.id)) return [];
    const complete = group.members.every(s => {
      const m = game.monsters.find(m => m.id === s.entityId), published = members.find(m => m.entityId === s.entityId);
      if (m) return !!published && published.cells.length === footprintOf(m).length;
      const part = definition.parts.find(p => p.partId === s.partId)!, fp = game.spatialCatalog.form(part.formId).footprintId;
      return game.spatialCatalog.cells(fp, game.spatialCatalog.definition(fp).poses[0]!).every(p => visible({ x: core.x + part.preferredOffset.x + p.x, y: core.y + part.preferredOffset.y + p.y }));
    });
    return [{ groupId: group.groupId, coreId: core.id, members,
      ...(complete ? { broken: group.members.filter(s => s.life === 'removed').length } : {}) }];
  });
}
