import { footprintEvery } from './CreatureSpatial';
import type { Creature } from '../../entities/Creature';
import type { Monster } from '../../entities/Monster';
import type { Grid } from '../Map/Grid';
import { bodyDecisionActor, bodyGroupActors } from '../Status/BodyStatuses';
import { cellTerrainFlags, cellTerrainMechFlags } from '../Map/DungeonFeature';
import { T_IS_DEEP_WATER, T_LAVA_INSTA_DEATH, T_OBSTRUCTS_PASSABILITY, TM_ALLOWS_SUBMERGING } from '../Map/TerrainCatalog';

/** MB_SUBMERGED is bookkeeping, independent of invisibility and MONST_SUBMERGES. */
export function isSubmerged(creature: Creature | undefined | null): boolean {
    const owner = creature && bodyDecisionActor(creature);
    return !!owner && 'submerged' in owner && owner.submerged === true;
}

/** CE Monsters.c:692–700. Temporary levitation is deliberately not a veto. */
export function monsterCanSubmergeNow(m: Monster, grid: Grid): boolean {
    return (bodyGroupActors(m) as readonly Monster[]).every(part => partCanSubmergeNow(part, grid));
}
function partCanSubmergeNow(m: Monster, grid: Grid): boolean {
    return m.hasBehavior('MONST_SUBMERGES')
        && footprintEvery(m, p => !!(cellTerrainMechFlags(grid, p.x, p.y) & TM_ALLOWS_SUBMERGING))
        && footprintEvery(m, p => !(cellTerrainFlags(grid, p.x, p.y) & T_OBSTRUCTS_PASSABILITY))
        && !m.seizing && !m.seized && !m.isCaged
        && (m.hasBehavior('MONST_IMMUNE_TO_FIRE') || m.isInvulnerable() || m.hasStatus('immune_fire')
            || footprintEvery(m, p => !(cellTerrainFlags(grid, p.x, p.y) & T_LAVA_INSTA_DEATH)));
}

/** CE Monsters.c:179–192. Gas does not outline submerged creatures. */
export function hiddenBySubmersion(grid: Grid, target: Creature, observer?: Creature | null): boolean {
    return isSubmerged(target) && !(observer
        && (cellTerrainFlags(grid, observer.x, observer.y) & T_IS_DEEP_WATER)
        && !observer.hasStatus('levitating') && !observer.hasStatus('flying'));
}

/** CE Time.c:149 and setMonsterLocation: terrain changes surface immediately. */
export function surfaceOnDryLand(m: Monster, grid: Grid): void {
    const members = bodyGroupActors(m) as readonly Monster[];
    if (isSubmerged(m) && members.some(part => !footprintEvery(part, p => !!(cellTerrainMechFlags(grid, p.x, p.y) & TM_ALLOWS_SUBMERGING))))
        for (const part of members) part.submerged = false;
}
