import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { ExtensionRegistry } from '../ext/registry';
import * as catalog from '../ext/catalog';
import type { ControlledActionRequest, ControlledActionResult, ExtensionContext, Json, PhysicalResolutionFact } from '../ext/types';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { TerrainType } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';
import { CombatSystem } from '../engine/Combat/Combat';
import { logger } from '../engine/Systems/Logger';

const rat = (monsters as MonsterData[]).find(monster => monster.id === 'rat')!;
function fixture(options: { before?(context: ExtensionContext): void; allow?: boolean; timedStealth?: boolean } = {}) {
    const facts: PhysicalResolutionFact[] = [], results: ControlledActionResult[] = [], enemyScopes: boolean[] = [], enemyClocks: number[] = [], commits: { actorId: number; action: string }[] = [];
    let retained: ExtensionContext | undefined;
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry();
        registry.register('bridge', '1.0.0', () => ({ id: 'bridge', version: '1.0.0',
            initialState: () => ({ paid: 0, active: false, ticks: 0 }),
            validateState: (state): state is Json => !!state && typeof state === 'object',
            allowInput: (action, data, context) => action !== 'ext:command' || options.allow === false
                || context.validateAction(JSON.parse(String(data)).payload),
            commands: { run(payload, context) {
                retained = context;
                context.executeAction(payload as unknown as ControlledActionRequest, {
                    beforeCommit(ctx) { options.before?.(ctx); const state = ctx.state as { paid: number; active: boolean; ticks: number };
                        ctx.setState({ ...state, paid: state.paid + 1, active: true }); },
                    afterResolve(result, ctx) { results.push(structuredClone(result)); ctx.setState({ ...(ctx.state as object), active: false } as Json); },
                });
            } },
            hooks: { committedAction: fact => commits.push({ ...fact }), physicalResolved: fact => facts.push(structuredClone(fact)),
                objectiveTime(fact, ctx) { const state = ctx.state as { ticks: number }; ctx.setState({ ...(ctx.state as object), ticks: state.ticks + fact.ticks } as Json); } },
            statSources:{collect(actor,context){
                if(context.facts.direct!==undefined&&context.facts.targetId===context.playerId&&actor.id!==context.playerId){
                    enemyScopes.push((context.state as {active:boolean}).active);enemyClocks.push((context.state as {ticks:number}).ticks);
                }
                return options.timedStealth?[{stat:'native.stealth-range',category:'override',layer:'temporary',value:(context.state as {ticks:number}).ticks<100?5:7,sourceKind:'timed',sourceId:'bridge.stealth'}]:[];
            }},
        }));
        return registry;
    });
    const game = createHeadlessGame(7181, 'test');
    game.startNewGame({ seed: 7181, mode: 'test', ruleSet: 'extended', extensions: ['bridge'] });
    game.monsters = []; game.items = [];
    for (let x = game.player.x - 3; x <= game.player.x + 3; x++) for (let y = game.player.y - 3; y <= game.player.y + 3; y++) {
        game.grid.setTerrain(x, y, TerrainType.FLOOR); const cell = game.grid.getCell(x, y)!;
        cell.isVisible = true; cell.isDiscovered = true; cell.hasMemory = true;
    }
    function target(dx = 1, dy = 0) {
        const result = new Monster(game.player.x + dx, game.player.y + dy, rat);
        result.state = MonsterState.HUNTING; result.hp = result.maxHp = 1000; result.damageString = '1d1'; result.ticksUntilTurn = 10000;
        game.monsters.push(result); game.extensionRuntime!.attachCreature(result); return result;
    }
    return { game, target, facts, results, enemyScopes, enemyClocks, commits, retained: () => retained!,
        state: () => game.extensionRuntime!.snapshot().modules.bridge as { paid: number; active: boolean; ticks: number },
        run: (request: unknown) => game.executeCommand('ext:command', JSON.stringify({ module: 'bridge', action: 'run', payload: { actorId: game.player.id, ...(request as object) } })) };
}
afterEach(() => { vi.restoreAllMocks(); logger.reset(); });

describe('EXT-1d controlled native primitives', () => {
    it.each(['wait', 'search'] as const)('%s commits once and closes transient scope before time', action => {
        const f = fixture(); const tick = timeSystem.currentTick, turn = f.game.stats.turns;
        f.run({ action, target: { kind: 'self' } });
        expect(f.state()).toEqual({ paid: 1, active: false, ticks: 100 });
        expect(timeSystem.currentTick - tick).toBe(100); expect(f.game.stats.turns - turn).toBe(1);
        expect(f.results).toHaveLength(1); expect(f.game.recordedInputEvents).toHaveLength(1);
    });
    it('publishes ordinary native move, wait and search commits for data-defined interruptions', () => {
        const f = fixture();
        f.game.executeCommand('move', { x: 0, y: 1 });
        f.game.executeCommand('wait'); f.game.executeCommand('search');
        expect(f.commits).toEqual(['move', 'wait', 'search'].map(action => ({ actorId: f.game.player.id, action })));
        expect(f.state().paid).toBe(0);
    });
    it('moves through the native displacement path and refuses occupied, forged, distant and confused targets before RNG', () => {
        const f = fixture(), x = f.game.player.x, y = f.game.player.y;
        f.run({ action: 'move', target: { kind: 'cell', x, y: y + 1 } });
        expect(f.game.player.loc).toEqual({ x, y: y + 1 }); expect(f.state().paid).toBe(1);
        expect(f.results[0]).toMatchObject({ action: 'move', moved: true });
        const target = f.target(), before = f.game.extensionRuntime!.snapshot(), random = rng.getState(), tick = timeSystem.currentTick;
        f.run({ action: 'move', target: { kind: 'cell', x: target.x, y: target.y } });
        f.run({ action: 'attack', target: { kind: 'creature', id: target.id }, actorId: target.id });
        f.run({ action: 'move', target: { kind: 'cell', x: x + 9, y } });
        f.game.player.setStatusDuration('confused', 3);
        f.run({ action: 'attack', target: { kind: 'creature', id: target.id } });
        expect(f.game.extensionRuntime!.snapshot()).toEqual(before); expect(rng.getState()).toEqual(random);
        expect(timeSystem.currentTick).toBe(tick); expect(f.game.recordedInputEvents).toHaveLength(1);
    });
    it.each([TerrainType.STAIRS_DOWN, TerrainType.STAIRS_UP, TerrainType.DUNGEON_PORTAL, TerrainType.ALTAR, TerrainType.LOCKED_DOOR])(
        'does not substitute a bump interaction for a controlled move (%s)', terrain => {
            const f = fixture(), x = f.game.player.x + 1, y = f.game.player.y;
            f.game.grid.setTerrain(x, y, terrain);
            const random = rng.getState(), tick = timeSystem.currentTick;
            f.run({ action: 'move', target: { kind: 'cell', x, y } });
            expect(f.state().paid).toBe(0); expect(f.game.recordedInputEvents).toHaveLength(0);
            expect(timeSystem.currentTick).toBe(tick); expect(rng.getState()).toEqual(random);
        });
    it('keeps ordinary native stairs commands available independently of the step primitive', () => {
        const f = fixture();
        f.game.grid.setTerrain(f.game.player.x, f.game.player.y, TerrainType.STAIRS_DOWN);
        f.game.executeCommand('stairs_down');
        expect(f.game.depth).toBe(2); expect(f.state().paid).toBe(0); expect(f.state().ticks).toBe(0);
    });
    it('returns only false for hidden occupied destinations and rejects guessed hidden creature IDs', () => {
        const f = fixture(), target = f.target(); target.setStatusDuration('invisible', 20);
        const result = f.game.validateControlledAction({ actorId: f.game.player.id, action: 'move',
            target: { kind: 'cell', x: target.x, y: target.y } });
        expect(result).toBe(false);
        expect(f.game.validateControlledAction({ actorId: f.game.player.id, action: 'attack', target: { kind: 'creature', id: target.id } })).toBe(false);
        f.run({ action: 'move', target: { kind: 'cell', x: target.x, y: target.y } });
        expect(f.results).toEqual([]); expect(f.state().paid).toBe(0);
    });
    it.each(['seized', 'web', 'vomit'] as const)('distinguishes a committed %s interruption from an actual move', interruption => {
        const f = fixture(), origin = { ...f.game.player.loc };
        if (interruption === 'seized') { const seizer = f.target(); seizer.abilityFlags.add('MA_SEIZES'); seizer.seizing = true; f.game.player.seized = true; }
        if (interruption === 'web') { f.game.grid.setTerrain(origin.x, origin.y, TerrainType.WEB); f.game.player.setStatusDuration('stuck', 3); }
        if (interruption === 'vomit') { f.game.player.setStatusDuration('nauseous', 10); vi.spyOn(rng, 'randPercent').mockReturnValue(true); }
        const tick = timeSystem.currentTick;
        f.run({ action: 'move', target: { kind: 'cell', x: origin.x, y: origin.y + 1 } });
        expect(f.game.player.loc).toEqual(origin); expect(f.state().paid).toBe(1);
        expect(timeSystem.currentTick - tick).toBe(100); expect(f.results).toHaveLength(1);
        expect(f.results[0]).toMatchObject({ action: 'move', moved: false });
    });
    it('records native hazard cancellation without paying, rolling or advancing', () => {
        const f = fixture(), x = f.game.player.x + 1, y = f.game.player.y;
        f.game.grid.setTerrain(x, y, TerrainType.PLAIN_FIRE);
        f.game.onConfirmRequest = vi.fn(() => false);
        const random = rng.getState(), tick = timeSystem.currentTick;
        f.run({ action: 'move', target: { kind: 'cell', x, y } });
        expect(f.game.onConfirmRequest).toHaveBeenCalledOnce(); expect(f.state().paid).toBe(0);
        expect(f.results).toHaveLength(0); expect(timeSystem.currentTick).toBe(tick); expect(rng.getState()).toEqual(random);
        expect(f.game.recordedInputEvents[0]?.decisions).toEqual([false]);
    });
    it('revalidates a target changed during a native confirmation without charging it', () => {
        const f = fixture(), x = f.game.player.x + 1, y = f.game.player.y;
        f.game.grid.setTerrain(x, y, TerrainType.PLAIN_FIRE);
        f.game.onConfirmRequest = () => { f.target(); return true; };
        const tick = timeSystem.currentTick;
        f.run({ action: 'move', target: { kind: 'cell', x, y } });
        expect(f.state().paid).toBe(0); expect(timeSystem.currentTick).toBe(tick);
        expect(f.game.player.x).toBe(x - 1);
    });
    it.each([
        ['normal', [], 100], ['quick', ['ITEM_ATTACKS_QUICKLY'], 100], ['stagger', ['ITEM_ATTACKS_STAGGER'], 100],
    ] as const)('%s weapon uses native attack recovery and tick accounting', (_name, flags, expectedTick) => {
        const f = fixture(), target = f.target(); target.setStatusDuration('paralyzed', 20);
        f.game.player.equippedWeapon!.flags = [...flags];
        const tick = timeSystem.currentTick;
        f.run({ action: 'attack', target: { kind: 'creature', id: target.id } });
        expect(f.state().paid).toBe(1); expect(f.results[0]?.hit).toBe(true);
        expect(timeSystem.currentTick - tick).toBe(expectedTick);
        expect(f.state().ticks).toBe(_name === 'quick' ? 0 : _name === 'stagger' ? 200 : 100);
    });
    it('preserves the native speed-rune free action without objective ticks or additional checkpoints', () => {
        const f = fixture(), target = f.target(); target.setStatusDuration('paralyzed', 20);
        f.game.player.equippedWeapon!.runicType = 'speed';
        vi.spyOn(rng, 'randPercent').mockReturnValue(true);
        const tick = timeSystem.currentTick;
        f.run({ action: 'attack', target: { kind: 'creature', id: target.id } });
        expect(f.state()).toEqual({ paid: 1, active: false, ticks: 0 });
        expect(timeSystem.currentTick).toBe(tick); expect(f.game.recordedInputEvents).toHaveLength(1);
    });
    it('distinguishes a guaranteed probability draw from a short-circuit guaranteed hit', () => {
        const f = fixture(), target = f.target();
        f.game.player.seizing = true; target.seized = true;
        CombatSystem.attack(f.game.player, target);
        expect(f.facts[0]?.probabilityRolled).toBe(true);
        target.setStatusDuration('paralyzed', 20);
        CombatSystem.attack(f.game.player, target);
        expect(f.facts[1]?.probabilityRolled).toBe(false);
    });
    it('rejects a whip ray that would replace the selected visible-in-gas invisible primary', () => {
        const f = fixture(), primary = f.target(1, 0), farther = f.target(2, 0);
        f.game.player.equippedWeapon!.flags = ['ITEM_ATTACKS_EXTEND']; primary.setStatusDuration('invisible', 20);
        f.game.grid.getCell(primary.x, primary.y)!.layers[2] = TerrainType.CONFUSION_GAS;
        const request = { actorId: f.game.player.id, action: 'attack' as const, target: { kind: 'creature' as const, id: primary.id } };
        expect(f.game.validateControlledAction(request)).toBe(true);
        const random = rng.getState(), tick = timeSystem.currentTick, hp = [primary.hp, farther.hp];
        f.run(request);
        expect(f.state().paid).toBe(0); expect(f.facts).toEqual([]); expect(f.results).toEqual([]);
        expect([primary.hp, farther.hp]).toEqual(hp); expect(timeSystem.currentTick).toBe(tick); expect(rng.getState()).toEqual(random);
    });
    it('rejects a spear hit list whose collateral was relocated by a confirmation', () => {
        const f = fixture(), primary = f.target(1, 0), collateral = f.target(2, 0);
        f.game.player.equippedWeapon!.flags = ['ITEM_ATTACKS_PENETRATE'];
        primary.behaviorFlags.add('MONST_DEFEND_DEGRADE_WEAPON');
        f.game.onConfirmRequest = vi.fn(() => { collateral.loc = { x: primary.x + 10, y: primary.y }; return true; });
        const random = rng.getState(), tick = timeSystem.currentTick;
        f.run({ action: 'attack', target: { kind: 'creature', id: primary.id } });
        expect(f.game.onConfirmRequest).toHaveBeenCalledOnce(); expect(f.state().paid).toBe(0);
        expect(f.facts).toEqual([]); expect(timeSystem.currentTick).toBe(tick); expect(rng.getState()).toEqual(random);
    });
    it('pays legal misses and reports no HP loss', () => {
        const f = fixture(), target = f.target();
        vi.spyOn(rng, 'randPercent').mockReturnValue(false);
        f.run({ action: 'attack', target: { kind: 'creature', id: target.id } });
        expect(f.state().paid).toBe(1); expect(f.results[0]).toMatchObject({ hit: false, hpLost: 0 });
        expect(f.facts[0]).toMatchObject({ probabilityRolled: true, positivePhysicalDamage: false, hpLost: 0 });
    });
    it('separates positive pre-shield physical facts from actual HP loss and skipped hit dice', () => {
        const f = fixture(), target = f.target(); target.setStatusDuration('paralyzed', 20);
        target.setStatusDuration('shielded', 10000);
        CombatSystem.attack(f.game.player, target);
        expect(f.facts[0]).toMatchObject({ probabilityRolled: false, positivePhysicalDamage: true, hpLost: 0 });
        target.setStatusDuration('shielded', 0); target.behaviorFlags.add('MONST_IMMUNE_TO_WEAPONS');
        CombatSystem.attack(f.game.player, target);
        expect(f.facts[1]).toMatchObject({ positivePhysicalDamage: false, hpLost: 0 });
        expect(f.facts[1]!.resolutionId).toBeGreaterThan(f.facts[0]!.resolutionId);
    });
    it.each([false, true])('closes the skill action scope before enemy attacks (animation=%s)', animated => {
        const f = fixture(), target = f.target(); target.ticksUntilTurn = 0;
        target.accuracy = 10000; f.game.player.setStatusDuration('slowed', 10); f.game.animationEnabled = animated;
        f.run({ action: 'wait', target: { kind: 'self' } });
        while (f.game.isAdvancing) f.game.stepAdvancement();
        expect(f.enemyScopes.length).toBeGreaterThan(0); expect(f.enemyScopes.every(active => !active)).toBe(true);
        expect(f.game.recordedInputEvents).toHaveLength(1);
    });
    it.each([false, true])('publishes completed blocks after same-tick monster attacks (animation=%s)', animated => {
        const f = fixture(), target = f.target(); target.ticksUntilTurn = 100; target.accuracy = 10000;
        f.game.animationEnabled = animated; f.game.player.setStatusDuration('slowed', 10);
        f.run({ action: 'wait', target: { kind: 'self' } });
        while (f.game.isAdvancing) f.game.stepAdvancement();
        expect(f.enemyClocks).toEqual([0, 100]);
        expect(f.state().ticks).toBe(200);
        expect(f.commits.filter(event => event.actorId === target.id)).toEqual([
            { actorId: target.id, action: 'attack' }, { actorId: target.id, action: 'attack' },
        ]);
    });
    it.each([false, true])('refreshes expiring extended stealth before the later slice of a slow action (animation=%s)', animated => {
        const f = fixture({ timedStealth: true }), target = f.target(), seen: number[] = [];
        target.ticksUntilTurn = 100; f.game.animationEnabled = animated; f.game.player.setStatusDuration('slowed', 10);
        const original = target.takeTurn;
        vi.spyOn(target, 'takeTurn').mockImplementation((game, range) => { seen.push(range); original.call(target, game, range); });
        f.run({ action: 'wait', target: { kind: 'self' } });
        while (f.game.isAdvancing) f.game.stepAdvancement();
        expect(seen).toEqual([5, 7]);
    });
    it('does not publish a partially suspended block when the animation is discarded', () => {
        const f = fixture(); f.game.animationEnabled = true; f.game.player.setStatusDuration('slowed', 10);
        f.run({ action: 'wait', target: { kind: 'self' } });
        expect(f.game.isAdvancing).toBe(true); expect(f.state().ticks).toBe(0);
        f.game.discardInFlightAdvancement(); expect(f.state().ticks).toBe(0);
    });
    it('rejects escaped contexts, nested action capability and a throwing pre-commit without world work', () => {
        const f = fixture({ before(context) {
            context.executeAction({ actorId: context.playerId, action: 'wait', target: { kind: 'self' } }, { beforeCommit() {}, afterResolve() {} });
        } });
        const random = rng.getState(), tick = timeSystem.currentTick;
        expect(() => f.run({ action: 'wait', target: { kind: 'self' } })).toThrow('Controlled action outside module command');
        expect(f.state().paid).toBe(0); expect(rng.getState()).toEqual(random); expect(timeSystem.currentTick).toBe(tick);
        expect(() => f.retained().executeAction({ actorId: f.game.player.id, action: 'wait', target: { kind: 'self' } }, { beforeCommit() {}, afterResolve() {} })).toThrow('outside lifecycle');
        expect((f.game as unknown as { recordingFromNewGame: boolean }).recordingFromNewGame).toBe(false);
    });
});
