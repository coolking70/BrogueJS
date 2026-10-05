import type { Pos } from '../../types';
import { Monster, type MonsterData } from '../../entities/Monster';
import monsters from '../../data/monsters.json';
import { Grid, TerrainType } from '../../engine/Map/Grid';
import { SpatialCatalog, type BodyDefinition, type BodyGroupState } from '../../engine/Movement/SpatialSchema';
import { CreatureSpatial } from '../../engine/Movement/CreatureSpatial';
import { CompositeMovement } from '../../engine/Movement/CompositeMovement';

export const SPIDER_LEGS: readonly Pos[] = [{ x: -1, y: -1 }, { x: 0, y: -1 }, { x: 2, y: -1 }, { x: 2, y: 0 },
    { x: 2, y: 2 }, { x: 1, y: 2 }, { x: -1, y: 2 }, { x: -1, y: 1 }];
export function compositeScene(offsets: readonly Pos[] = SPIDER_LEGS,
    options: { chain?: boolean; coreSize?: 1 | 2 | 3; maxDistance?: number; minDistance?: number; clearLink?: boolean; maxStep?: number } = {}) {
    const catalog = new SpatialCatalog(true), coreSize = options.coreSize ?? 2;
    catalog.registerForm({ id: 'fixture:core', owner: 'foundation', footprintId: coreSize === 1 ? 'builtin:single' : `builtin:square-${coreSize}` });
    catalog.registerForm({ id: 'fixture:limb', owner: 'foundation', footprintId: 'builtin:single' });
    const definition: BodyDefinition = {
        id: 'fixture:composite', owner: 'foundation', minSupportParts: 1, noSupport: 'immobile', coreDeath: 'remove-members', statusProfileId: 'foundation:native',
        parts: [{ partId: 'core', role: 'core', providesSupport: false, formId: 'fixture:core', preferredOffset: { x: 0, y: 0 }, attackProfileIds: [],
            coreTransfer: { numerator: 0, denominator: 1 }, breakRuleId: 'foundation:keep-zone', statusProfileId: 'foundation:native' },
        ...offsets.map((preferredOffset, i) => ({ partId: `limb${String(i).padStart(2, '0')}`, role: 'support' as const, providesSupport: true,
            formId: 'fixture:limb', preferredOffset, attackProfileIds: [], coreTransfer: { numerator: 1, denominator: 4 },
            breakRuleId: 'foundation:keep-zone', statusProfileId: 'foundation:native' }))],
        constraints: offsets.map((_, i) => ({ childPartId: `limb${String(i).padStart(2, '0')}`, parentPartId: options.chain && i ? `limb${String(i - 1).padStart(2, '0')}` : 'core',
            kind: options.chain ? 'chain' as const : 'tether' as const, minDistance: options.minDistance ?? 1, maxDistance: options.maxDistance ?? 2,
            maxStepPerAction: options.maxStep ?? 2, requiresClearLink: options.clearLink ?? false })),
    };
    catalog.registerBody(definition);
    const grid = new Grid(40, 30);
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) grid.setTerrain(x, y, TerrainType.FLOOR);
    const actors = [{ x: 0, y: 0 }, ...offsets].map((p, i) => {
        const actor = new Monster(14 + p.x, 12 + p.y, (monsters as MonsterData[]).find(m => m.id === 'rat')!);
        actor.spatial = { schema: 1, footprintId: catalog.form(definition.parts[i]!.formId).footprintId, pose: 'r0',
            bodyMember: { groupId: 1, partId: definition.parts[i]!.partId } };
        return actor;
    });
    const core = actors[0]!;
    for (const actor of actors) actor.spatial!.bodyMember!.groupId = core.id;
    const group: BodyGroupState = { schema: 1, groupId: core.id, coreId: core.id, bodyDefinitionId: definition.id,
        members: actors.map((c, i) => ({ partId: definition.parts[i]!.partId, entityId: c.id, life: 'active', generation: 0, readyInTicks: i * 10 })), appliedBreaks: [] };
    const world = { grid, monsters: actors, dormantMonsters: [] as Monster[] };
    const spatial = new CreatureSpatial(world, catalog);
    spatial.groups.push(group);
    return { grid, actors, core, group, definition, world, catalog, spatial, movement: new CompositeMovement(spatial) };
}
