import { vi } from 'vitest';
import * as catalog from '../../ext/catalog';
import { registryFromDescriptors } from '../../ext/descriptor';
import { extensionDataFingerprint } from '../../ext/fingerprint';
import { createHeadlessGame } from '../harness';
import type { PartBreakProvider } from '../../ext/partBreak';
import type { NativeFormDefinition } from '../../ext/nativeForms';
import type { BodyDefinition, PartBreakRule } from '../../engine/Movement/SpatialSchema';
import { commitCreatureAnchor } from '../../engine/Movement/CreatureSpatial';
import { TerrainType as T, DungeonLayer as L } from '../../engine/Map/Grid';
import { EnvironmentManager } from '../../engine/Environment/Gas';
import { WaypointSystem } from '../../engine/Map/WaypointMap';
import { MonsterState } from '../../entities/Monster';
import type { Game } from '../../engine/Core/Game';

export const PRODUCTION_BODY_ID = 'giants.fixture-body';
const eight = [{ x: -1, y: -1 }, { x: 0, y: -1 }, { x: 2, y: -1 }, { x: 2, y: 0 },
    { x: 2, y: 2 }, { x: 1, y: 2 }, { x: -1, y: 2 }, { x: -1, y: 1 }];
/** Installed, immutable production authority, with diagnostic content only.
 * Never uses a fixture catalog or a second scheduler/HP store. */
export function installProductionBody(count = 8, provider?: PartBreakProvider, failBirth?: () => void, balance = false) {
    const descriptors = catalog.getInstalledModuleDescriptors();
    const base = descriptors.find(d => d.id === 'giants')!.create(), template = base.nativeForms![0]!;
    const core: NativeFormDefinition = { ...template, id: 'giants.fixture-core', hp: 160, moveSpeed: 100, attackSpeed: 70, size: 2 };
    const { size: _size, ...data } = template;
    const leg: NativeFormDefinition = { ...data, id: 'giants.fixture-leg', hp: 20, moveSpeed: 100, attackSpeed: 130,
        footprint: { geometry: { kind: 'rect', width: 1, height: 1 }, poses: ['r0'] } };
    const offsets = count === 8 ? eight : Array.from({ length: count }, (_, i) => ({ x: (i % 8) - 3, y: i < 8 ? -2 : 3 }));
    const rule: PartBreakRule = { id: 'giants.fixture-retire', owner: 'giants', trigger: 'hp-zero', disposition: 'remove',
        childrenOnBreak: 'retire-subtree', modifiers: [{ kind: 'move-ticks-multiplier', numerator: 9, denominator: 8 },
            ...(balance ? [{ kind: 'balance-loss' as const, amount: 20, fallbackStunTicks: 40 }] : [])] };
    const definition: BodyDefinition = { id: PRODUCTION_BODY_ID, owner: 'giants', minSupportParts: 1, noSupport: 'immobile',
        coreDeath: 'remove-members', statusProfileId: 'foundation:native', parts: [
            { partId: 'core', role: 'core', providesSupport: false, formId: core.id, preferredOffset: { x: 0, y: 0 },
                attackProfileIds: [], coreTransfer: { numerator: 0, denominator: 1 }, breakRuleId: 'foundation:keep-zone', statusProfileId: 'foundation:native' },
            ...offsets.map((offset, i) => ({ partId: `leg${String(i).padStart(2, '0')}`, role: 'support' as const, providesSupport: true,
                formId: leg.id, preferredOffset: offset, attackProfileIds: [], coreTransfer: { numerator: 1, denominator: 4 },
                breakRuleId: rule.id, statusProfileId: 'foundation:native' })),
        ], constraints: offsets.map((_, i) => ({ childPartId: `leg${String(i).padStart(2, '0')}`, parentPartId: 'core', kind: 'tether',
            minDistance: 1, maxDistance: count === 8 ? 3 : 6, maxStepPerAction: 2, requiresClearLink: true })) };
    const nativeBodies = { definitions: [definition], breakRules: [rule] };
    const forms = [...base.nativeForms!, core, leg], rules = { ...base.rules!, fingerprint: extensionDataFingerprint({ baseFingerprint: base.rules!.fingerprint, nativeBodies, forms }) };
    const module = () => ({ ...base, rules, nativeForms: forms, nativeBodies,
        ...(provider ? { optionalPartBreaks: { 'combat.part-break.v1': provider } } : {}),
        ...(failBirth ? { hooks: { ...base.hooks, creatureSpawned: failBirth } } : {}) });
    const registry = registryFromDescriptors(descriptors.map(d => d.id === 'giants'
        ? { ...d, rules, create: module } : d));
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
    return { definition, core, leg, rule };
}
export function emptyProductionArena(game: Game): void {
    game.animationEnabled = false; game.monsters = []; game.dormantMonsters = []; game.items = [];
    for (let y = 0; y < game.grid.height; y++) for (let x = 0; x < game.grid.width; x++) {
        game.grid.setTerrain(x, y, x === 0 || y === 0 || x === game.grid.width - 1 || y === game.grid.height - 1 ? T.WALL : T.FLOOR);
        for (const layer of [L.LIQUID, L.SURFACE, L.GAS]) game.grid.setTerrainLayer(x, y, layer, T.NOTHING);
        game.grid.getCell(x, y)!.machineNumber = 0;
    }
    game.environment = new EnvironmentManager(game.grid); game.waypoints = new WaypointSystem();
    commitCreatureAnchor(game.player, { x: 40, y: 12 }); game.player.hp = game.player.maxHp = 100000;
}
export function productionBodyScene(count = 8, combat = false) {
    installProductionBody(count);
    const game = startProductionGame(combat ? ['giants', 'combat'] : ['giants'], 7307, 'wizard');
    emptyProductionArena(game);
    const core = game.createCompositeMonster(PRODUCTION_BODY_ID, { x: 14, y: 12 })!;
    core.state = MonsterState.HUNTING; core.behaviorFlags.add('MONST_ALWAYS_HUNTING'); core.givenUpOnScent = true;
    const group = game.bodyGroups![0]!;
    return { game, core, group, actors: [...game.monsters] };
}

export function startProductionGame(ids: readonly string[] = ['giants'], seed = 7307, mode: 'normal' | 'easy' | 'wizard' = 'wizard'): Game {
    const game = createHeadlessGame(seed, 'test'), registry = catalog.createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(ids)).flatMap(m => m.initialCommand ? [JSON.stringify({ module: m.id, ...m.initialCommand })] : []);
    game.startNewGame({ seed, mode, ruleSet: 'extended', extensions: ids, initialCommands });
    game.animationEnabled = false; return game;
}
