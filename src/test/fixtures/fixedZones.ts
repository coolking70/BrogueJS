import { Monster, type MonsterData } from '../../entities/Monster';
import { Grid, TerrainType } from '../../engine/Map/Grid';
import { CreatureSpatial } from '../../engine/Movement/CreatureSpatial';
import { SpatialCatalog, type FootprintDefinition, type PartBreakRule } from '../../engine/Movement/SpatialSchema';
import { initialLocalZoneState, type FixedZoneHit } from '../../engine/Combat/FixedZoneHealth';
import data from '../../data/monsters.json';

export const ratio = (numerator = 1, denominator = 1) => ({ numerator, denominator });
export function rules(): PartBreakRule[] {
    return [
        { id: 'fixture:shell-break', owner: 'foundation', trigger: 'hp-zero', disposition: 'keep-zone', modifiers: [
            { kind: 'move-ticks-multiplier', ...ratio(3, 2) }, { kind: 'disable-attack', attackId: 'smash' },
            { kind: 'expose-zone', partId: 'self', zoneId: 'core', damageMultiplier: ratio(2) },
            { kind: 'balance-loss', amount: 6, fallbackStunTicks: 25 },
        ] },
        { id: 'fixture:leg-break', owner: 'foundation', trigger: 'hp-zero', disposition: 'keep-zone', modifiers: [
            { kind: 'move-ticks-multiplier', ...ratio(2) },
            { kind: 'expose-zone', partId: 'self', zoneId: 'core', damageMultiplier: ratio(3) },
        ] },
    ];
}
export function definition(): FootprintDefinition {
    return { id: 'fixture:zones', owner: 'foundation', geometry: { kind: 'rect', width: 3, height: 2 },
        poses: ['r0', 'r90', 'r180', 'r270'],
        zones: [
            { id: 'shell', nameKey: 'fixture.shell', health: { kind: 'local', maxHp: 12, ownerTransfer: ratio() }, armor: 2, damageMultiplier: ratio(), breakRuleId: 'fixture:shell-break' },
            { id: 'leg', nameKey: 'fixture.leg', health: { kind: 'local', maxHp: 10, ownerTransfer: ratio() }, armor: 0, damageMultiplier: ratio(), breakRuleId: 'fixture:leg-break' },
            { id: 'core', nameKey: 'fixture.core', health: { kind: 'native' }, armor: 0, damageMultiplier: ratio(), breakRuleId: 'foundation:keep-zone' },
        ], zoneCells: [{ x: 0, y: 0, zoneId: 'shell' }, { x: 1, y: 0, zoneId: 'shell' },
            { x: 0, y: 1, zoneId: 'leg' }, { x: 1, y: 1, zoneId: 'leg' }, { x: 2, y: 0, zoneId: 'core' }] };
}
export function fixedZoneScene() {
    const catalog = new SpatialCatalog(true); rules().forEach(r => catalog.registerBreakRule(r)); catalog.registerFootprint(definition());
    const actor = new Monster(5, 5, (data as MonsterData[]).find(d => d.id === 'rat')!); actor.hp = actor.maxHp = 100;
    actor.spatial = { schema: 1, footprintId: 'fixture:zones', pose: 'r0', zoneState: initialLocalZoneState(catalog, 'fixture:zones') };
    const grid = new Grid(18, 18);
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) grid.setTerrain(x, y, TerrainType.FLOOR);
    const spatial = new CreatureSpatial({ grid, monsters: [actor] }, catalog);
    const target = (zoneId = 'shell') => spatial.collectBodyTargets(spatial.footprintOf(actor).filter(p => p.zoneId === zoneId), { effect: 'direct' })[0]!;
    const input = (damage = 14, resolutionId = 1): FixedZoneHit => ({ damage, resolutionId, hit: true, sourceId: null, kind: 'physical' });
    return { catalog, actor, grid, spatial, target, input };
}

