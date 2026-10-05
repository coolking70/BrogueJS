import type { Game } from '../engine/Core/Game';
import type { Monster } from '../entities/Monster';
import { monsterAppearance, type CosmeticRng } from '../engine/UI/Appearance';
import { canDirectlySeeMonster, canSeeMonster, canDisplayMonster, monsterInGas } from '../engine/UI/MonsterVisibility';
import { publicMonsterBody } from '../engine/UI/MonsterBody';
import { monsterSemantic } from './mapTileSemantics';
import type { DisplayBody } from './bodyDrawing';
import type { DisplayEntity } from './displayProjection';

/** One appearance (including hallucination) per entity, never per body cell. */
export function observeDisplayMonster(game: Game, monster: Monster, cosmetic: CosmeticRng,
    gasBackgrounds: ReadonlyMap<string, number>): { entity: DisplayEntity; body: DisplayBody | null } | null {
    const body = publicMonsterBody(game.player, game.grid, monster);
    const at = body?.glyph ?? monster.loc;
    const cell = game.grid.getCell(at.x, at.y);
    const direct = canDirectlySeeMonster(game.player, game.grid, monster);
    const known = canSeeMonster(game.player, game.grid, monster);
    const hallucinating = !!game.player.statusDurations.hallucinating;
    const visual = monsterAppearance(monster, { cellVisible: !!cell?.isVisible, cellHasMemory: !!cell?.hasMemory,
        telepathy: !!game.player.statusDurations.telepathy || monster.hasStatus('entranced'), hallucinating, cosmetic,
        monsterVisibility: direct ? 'direct' : known ? 'known' : canDisplayMonster(game.player, game.grid, monster) ? 'marker' : 'hidden',
        gasBackground: monsterInGas(game.grid, monster) ? gasBackgrounds.get(`${at.x},${at.y}`) : undefined });
    if (!visual) return null;
    return { entity: { x: at.x, y: at.y, semantic: monsterSemantic(monster, visual.char, hallucinating, !direct && !known),
        color: visual.color, bgColor: null, interactive: visual.interactive }, body: body ? { ...body, color: visual.color } : null };
}
