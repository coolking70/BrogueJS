import i18next from 'i18next';
import type { Player } from '../../entities/Player';
import type { Monster } from '../../entities/Monster';
import type { Grid } from '../Map/Grid';
import type { Pos } from '../../types';
import { footprintOf, spatialCatalogFor } from '../Movement/CreatureSpatial';
import { canSeeMonsterAt } from './MonsterVisibility';
import { fixedZoneDamageMultiplier } from '../Combat/FixedZoneHealth';

export interface PublicMonsterZone {
    readonly id: string;
    readonly name: string;
    readonly cells: readonly Pos[];
    readonly hp: number;
    readonly maxHp: number;
    readonly broken: boolean;
    readonly weak: boolean;
}
/** Only currently visible, identified cells publish a zone. Hidden siblings,
 * telepathy markers and hallucinations carry no HP/weakness/topology. Values
 * are detached at observation, so old display frames never read future HP. */
export function publicMonsterZones(player: Player, grid: Grid, monster: Monster): readonly PublicMonsterZone[] {
    if (!monster.spatial || player.hasStatus('hallucinating')) return [];
    const catalog = spatialCatalogFor(monster), definition = catalog.definition(monster.spatial.footprintId);
    const cells = footprintOf(monster).filter(p => grid.getCell(p.x, p.y)?.isVisible && canSeeMonsterAt(player, grid, monster, p));
    return (definition.zones ?? []).flatMap(zone => {
        const publicCells = cells.filter(p => p.zoneId === zone.id).map(({ x, y }) => ({ x, y }));
        if (!publicCells.length) return [];
        const state = monster.spatial!.zoneState?.find(s => s.zoneId === zone.id);
        let name = zone.nameKey;
        for (const language of i18next.languages ?? []) {
            const text: unknown = i18next.getResource(language, 'translation', zone.nameKey);
            if (typeof text === 'string') { name = text; break; }
        }
        const multiplier = fixedZoneDamageMultiplier(monster, zone.id, catalog);
        return [{ id: zone.id, name, cells: publicCells, hp: state?.hp ?? monster.hp,
            maxHp: zone.health.kind === 'local' ? zone.health.maxHp : monster.maxHp,
            broken: state?.broken ?? false, weak: multiplier.numerator > multiplier.denominator }];
    });
}
export function publicZoneAt(player: Player, grid: Grid, monster: Monster, at: Pos): PublicMonsterZone | undefined {
    return publicMonsterZones(player, grid, monster).find(z => z.cells.some(p => p.x === at.x && p.y === at.y));
}
export function zoneStatusText(zone: PublicMonsterZone): string {
    return i18next.t('zone.summary', { defaultValue: '{{name}} {{current}} / {{maximum}} {{state}}', name: zone.name, current: zone.hp, maximum: zone.maxHp,
        state: zone.broken ? i18next.t('zone.broken', { defaultValue: 'Destroyed' }) : zone.weak ? i18next.t('zone.weak', { defaultValue: 'Weak point' }) : '' }).trim();
}
