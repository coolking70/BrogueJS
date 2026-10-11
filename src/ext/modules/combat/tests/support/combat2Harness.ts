import { expect } from 'vitest';
import { createHeadlessGame } from '../../../../../test/harness';
import { Game, type GameMode } from '../../../../../engine/Core/Game';
import { logger } from '../../../../../engine/Systems/Logger';
import { TerrainType as T, DungeonLayer as L } from '../../../../../engine/Map/Grid';
import { commitCreatureAnchor } from '../../../../../engine/Movement/CreatureSpatial';
import { EnvironmentManager } from '../../../../../engine/Environment/Gas';
import { WaypointSystem } from '../../../../../engine/Map/WaypointMap';
import { Monster, MonsterState, type MonsterData } from '../../../../../entities/Monster';
import monsters from '../../../../../data/monsters.json';
import { productionActorActionScheduler } from '../../../../../engine/Core/ActorActionProduction';
import { createExtensionRegistry } from '../../../../catalog';
import rows from '../fixtures/combat2-rows.json';

export { rows };
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const command = (action: string, payload: object) => JSON.stringify({ module: 'combat', action, payload });
export const attackCommand = (id: string, facing = 'e') => command('attack', { attackId: id, facing });
export const state = (game: Game) => game.extensionRuntime!.actorActionBinding()!.state;
export function acknowledge() { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); }
export function mechanical(game: Game) { const value = clone(game.toSnapshot()); value.savedAt = 0; return value; }
export function play(game: Game, action: string, data?: unknown) {
    acknowledge(); game.executeCommand(action, data);
    if (game.pendingCommandConfirmation) game.resolveCommandDecision(game.pendingCommandConfirmation.token, true);
    expect(game.lastAdvancementError).toBeNull();
}
export function start(ids: string[] = ['combat'], seed = 1, mode: GameMode = 'wizard') {
    const game = createHeadlessGame(seed, 'test'), registry = createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(ids)).flatMap(module => module.initialCommand
        ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
    if (ids.includes('growth')) {
        const index = initialCommands.findIndex(value => JSON.parse(value).module === 'growth');
        initialCommands[index] = JSON.stringify({ module: 'growth', action: 'create-character', payload: { revision: 0,
            professionId: 'growth.profession.skirmisher', lineageId: 'growth.lineage.human', faithId: 'growth.faith.unaffiliated',
            choices: [{ identityId: 'growth.lineage.human', choiceIndex: 0, attributes: { 'growth.attribute.agility': 1 } }] } });
    }
    const prototype = Game.prototype as unknown as { makeRecordingHeader(): unknown };
    const nativeHeader = prototype.makeRecordingHeader;
    let zero: ReturnType<typeof mechanical> | undefined;
    prototype.makeRecordingHeader = function (this: Game) {
        const header = nativeHeader.call(this); zero = mechanical(this); return header;
    };
    try { game.startNewGame({ seed, mode, ruleSet: 'extended', extensions: ids, initialCommands }); }
    finally { prototype.makeRecordingHeader = nativeHeader; }
    game.animationEnabled = false; game.onConfirmRequest = () => true;
    return { game, initialCommands, zero: zero! };
}
/** Diagnostic fixture only. Natural controllers must never call this function. */
export function arena(game: Game) {
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    for (let y = 0; y < game.grid.height; y++) for (let x = 0; x < game.grid.width; x++) {
        game.grid.setTerrain(x, y, x === 0 || y === 0 || x === game.grid.width - 1 || y === game.grid.height - 1 ? T.WALL : T.FLOOR);
        for (const layer of [L.LIQUID, L.GAS, L.SURFACE]) game.grid.setTerrainLayer(x, y, layer, T.NOTHING);
        game.grid.getCell(x, y)!.machineNumber = 0;
    }
    commitCreatureAnchor(game.player, { x: 20, y: 15 });
    game.environment = new EnvironmentManager(game.grid); game.waypoints = new WaypointSystem();
    (game as any).bindDungeonFeatureEffects();
}
export function add(game: Game, x: number, y: number, type = 'jackal') {
    const monster = new Monster(x, y, monsters.find(value => value.id === type)! as unknown as MonsterData);
    monster.state = MonsterState.HUNTING; monster.ticksUntilTurn = 10000;
    monster.hp = monster.maxHp = 1000; monster.defense = -10000;
    game.monsters.push(monster); (game as any).updateVision(); return monster;
}
export interface Release {
    actionId: number; sourceId: number; sourceSubactionId: number; attackId: string;
    segmentIndex: number; elapsed: number; cells: { x: number; y: number }[];
}
export interface Hit {
    sourceId: number; targetId: number; attackId: string | null; segmentIndex: number | null;
    elapsed: number | null; damage: number; hit: boolean;
}
/** Bounded observations wrap the existing executor without replacing its result.
 * They store detached records, avoiding method-mock retention of whole Games. */
export function observe(game: Game) {
    const releases: Release[] = [], hits: Hit[] = [], parries: { sourceId: number; targetId: number; depth: number }[] = [];
    const runtime = game.extensionRuntime!, nativeParried = runtime.notifyActorParried;
    runtime.notifyActorParried = function (sourceId, targetId, depth) {
        const result = nativeParried.call(this, sourceId, targetId, depth); parries.push({ sourceId, targetId, depth }); return result;
    };
    const scheduler = productionActorActionScheduler(game)!, nativeDispatch = scheduler.dispatchActorBoundary;
    scheduler.dispatchActorBoundary = ownerId => {
        const bundle = game.actorActions!.bundles.find(entry => entry.decisionOwnerId === ownerId);
        const pending: Release[] = bundle?.subactions.flatMap(child => {
            const phase = child.phases[child.phaseIndex];
            const sub = state(game).actions.find(entry => entry.actionId === bundle.actionId)?.subactions.find(entry => entry.sourceSubactionId === child.sourceSubactionId);
            const source = child.sourceEntityId === game.player.id ? game.player : game.monsters.find(monster => monster.id === child.sourceEntityId);
            return phase?.segmentIndex !== null && phase?.segmentIndex !== undefined && child.phaseRemainingTicks === 0 && sub && source && source.hp > 0
                ? [{ actionId: bundle.actionId, sourceId: child.sourceEntityId, sourceSubactionId: child.sourceSubactionId,
                    attackId: sub.attackId, segmentIndex: phase.segmentIndex, elapsed: bundle.elapsedActionTicks, cells: clone(sub.lockedCells) }] : [];
        }) ?? [];
        const result = nativeDispatch(ownerId); releases.push(...pending); return result;
    };
    const nativeMelee = game.resolveActorNativeMelee;
    game.resolveActorNativeMelee = function (scope, source, target, poiseDamage) {
        const bundle = this.actorActions!.bundles.find(entry => entry.subactions.some(child => child.sourceEntityId === source.id));
        const child = bundle?.subactions.find(entry => entry.sourceEntityId === source.id);
        const sub = bundle && state(this).actions.find(entry => entry.actionId === bundle.actionId)?.subactions.find(entry => entry.sourceSubactionId === child?.sourceSubactionId);
        const result = nativeMelee.call(this, scope, source, target, poiseDamage);
        hits.push({ sourceId: source.id, targetId: target.id, attackId: sub?.attackId ?? null,
            segmentIndex: child?.phases[child.phaseIndex]?.segmentIndex ?? null,
            elapsed: bundle?.elapsedActionTicks ?? null, damage: result.damage, hit: result.hit });
        return result;
    };
    return { releases, hits, parries, restore: () => { scheduler.dispatchActorBoundary = nativeDispatch; game.resolveActorNativeMelee = nativeMelee; runtime.notifyActorParried = nativeParried; } };
}
