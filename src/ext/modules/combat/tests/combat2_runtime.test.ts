import { afterEach, describe, expect, it, vi } from 'vitest';
import { rows, start, arena, add, state, play, mechanical, observe, attackCommand, acknowledge } from './support/combat2Harness';
import { preparePhasedAttackCommand, commitPhasedAttackCommand, bindPhasedAttackProduction } from '../../../../engine/Core/PhasedAttackProduction';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { loadCombatDefinitionPack } from '../definitions';
import { attackTiming } from '../components';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import type { Facing } from '../types';

const directions: [Facing, number, number][] = [['n', 0, -1], ['e', 1, 0], ['s', 0, 1], ['w', -1, 0], ['ne', 1, -1], ['se', 1, 1], ['sw', -1, 1], ['nw', -1, -1]];
const fans: Record<Facing, [number, number][]> = { n: [[-1, -1], [0, -1], [1, -1]], e: [[1, -1], [1, 0], [1, 1]], s: [[1, 1], [0, 1], [-1, 1]], w: [[-1, 1], [-1, 0], [-1, -1]],
    ne: [[0, -1], [1, -1], [1, 0]], se: [[1, 0], [1, 1], [0, 1]], sw: [[0, 1], [-1, 1], [-1, 0]], nw: [[-1, 0], [-1, -1], [0, -1]] };
const opposite: Record<Facing, Facing> = { n: 's', e: 'w', s: 'n', w: 'e', ne: 'sw', se: 'nw', sw: 'ne', nw: 'se' };
function expectedOffsets(shape: string, facing: Facing, dx: number, dy: number): [number, number][] {
    if (shape === 'heavy') return [...fans[facing], [2 * dx, 2 * dy]];
    if (shape === 'front') return fans[facing];
    if (shape === 'back') return fans[opposite[facing]];
    if (shape === 'far') return [[2 * dx, 2 * dy], [3 * dx, 3 * dy]];
    const distance = Number(shape.slice(-1)); return [[distance * dx, distance * dy]];
}
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

describe('C2-SHAPE/ACT diagnostic real Game eight-facing contract', () => {
    it.each(rows.flatMap(row => directions.map(direction => ({ row, direction, label: `${row.id}/${direction[0]}` }))))('$label locks only the current stage, resolves native contacts and remains stationary', ({ row, direction: [facing, dx, dy] }) => {
        const { game } = start(); arena(game);
        const target = add(game, 20 + dx * (row.id === 'cast-echo' ? 2 : 1), 15 + dy * (row.id === 'cast-echo' ? 2 : 1));
        const observation = observe(game), id = `combat.${row.id}`, originalLocation = { ...game.player.loc };
        const initial = mechanical(game), random = rng.getState(), plan = preparePhasedAttackCommand(game, attackCommand(id, facing))!;
        expect(plan).not.toBeNull(); expect(mechanical(game)).toEqual(initial); expect(rng.getState()).toEqual(random);
        const first = expectedOffsets(row.segments[0]!.shape, facing, dx, dy).map(([x, y]) => ({ x: 20 + x, y: 15 + y })).sort((a, b) => a.y - b.y || a.x - b.x);
        expect(plan.cells).toEqual(first);
        play(game, 'ext:command', attackCommand(id, facing));
        expect(game.player.loc).toEqual(originalLocation);
        expect(observation.hits.some(hit => hit.sourceId === game.player.id && hit.targetId === target.id && hit.damage > 0)).toBe(true);
        const own = observation.releases.filter(release => release.sourceId === game.player.id);
        expect(own.map(release => release.elapsed)).toEqual(attackTiming(loadCombatDefinitionPack().attacks.find(attack => attack.id === id)!).releases);
        expect(own.map(release => release.segmentIndex)).toEqual(row.segments.map((_segment, index) => index));
        for (const release of own) expect(release.cells).toEqual(expectedOffsets(row.segments[release.segmentIndex]!.shape, facing, dx, dy)
            .map(([x, y]) => ({ x: 20 + x, y: 15 + y })).sort((a, b) => a.y - b.y || a.x - b.x));
        expect(state(game).actors.find(actor => actor.actorId === game.player.id)!.stamina).toBe([20, 20, 21, 23, 23][rows.indexOf(row)]);
        expect(game.actorActions!.nextActionId).toBe(2); expect(game.actorActions!.bundles).toEqual([]);
        observation.restore();
    });
    it.each(rows)('$id can swing into empty space without moving or allocating an extra action', row => {
        const { game } = start(); arena(game); const location = { ...game.player.loc }, observation = observe(game);
        play(game, 'ext:command', attackCommand(`combat.${row.id}`));
        expect(observation.hits).toEqual([]); expect(observation.releases).toHaveLength(row.segments.length);
        expect(game.player.loc).toEqual(location); expect(game.actorActions!.nextActionId).toBe(2);
        observation.restore();
    });
    it('clips walls and map bounds and never treats the near-space creature as a projectile blocker', () => {
        const { game } = start(); arena(game); const near = add(game, 21, 15), far = add(game, 22, 15);
        const observation = observe(game);
        play(game, 'ext:command', attackCommand('combat.cast-echo'));
        expect(near.hp).toBe(1000); expect(far.hp).toBeLessThan(1000);
        game.grid.setTerrain(21, 15, T.WALL);
        expect(preparePhasedAttackCommand(game, attackCommand('combat.cast-echo'))!.cells).toEqual([]);
        commitCreatureAnchor(game.player, { x: game.grid.width - 2, y: 15 });
        expect(preparePhasedAttackCommand(game, attackCommand('combat.cast-echo'))!.cells).toEqual([]);
        observation.restore();
    });
});

describe('C2-RESOURCE exact payment and rejected transaction boundaries', () => {
    it.each(rows)('$id commits the fee once and distinguishes regeneration from payment', row => {
        const { game } = start(); arena(game); const id = `combat.${row.id}`;
        const native = game.resolveActorNativeMelee;
        add(game, row.id === 'cast-echo' ? 22 : 21, 15);
        const paid: number[] = [];
        game.resolveActorNativeMelee = function (...args) { paid.push(state(this).actors.find(actor => actor.actorId === this.player.id)!.stamina); return native.apply(this, args); };
        play(game, 'ext:command', attackCommand(id));
        expect(paid[0]).toBe(24 - row.cost);
        expect(state(game).actors.find(actor => actor.actorId === game.player.id)!.stamina).toBe([20, 20, 21, 23, 23][rows.indexOf(row)]);
        game.resolveActorNativeMelee = native;
    });
    it.each(rows)('$id accepts exactly its cost and rejects one below with complete state/RNG/ID preservation', row => {
        const { game } = start(); arena(game); play(game, 'ext:command', attackCommand('combat.answering-edge'));
        const actor = state(game).actors.find(actor => actor.actorId === game.player.id)!;
        actor.stamina = row.cost - 1; actor.regenRemainder = 0; actor.regenDelayRemaining = 0;
        acknowledge(); const before = mechanical(game);
        expect(preparePhasedAttackCommand(game, attackCommand(`combat.${row.id}`))).toBeNull();
        play(game, 'ext:command', attackCommand(`combat.${row.id}`)); expect(mechanical(game)).toEqual(before);
        actor.stamina = row.cost;
        expect(preparePhasedAttackCommand(game, attackCommand(`combat.${row.id}`))).not.toBeNull();
        const next = game.actorActions!.nextActionId; play(game, 'ext:command', attackCommand(`combat.${row.id}`));
        expect(game.actorActions!.nextActionId).toBe(next + 1); expect(actor.stamina).toBeGreaterThanOrEqual(0);
    });
    it('rejects an obsolete plan without paying or allocating and does not require a prior parry for answering-edge', () => {
        const { game } = start(); arena(game); const plan = preparePhasedAttackCommand(game, attackCommand('combat.answering-edge'))!;
        state(game).revision++; const before = mechanical(game);
        expect(() => commitPhasedAttackCommand(game, plan)).toThrow(); expect(mechanical(game)).toEqual(before);
        bindPhasedAttackProduction(game);
        expect(preparePhasedAttackCommand(game, attackCommand('combat.answering-edge'))).not.toBeNull();
    });
    it('refuses No and busy commands without another payment, clock, RNG or action ID', () => {
        const { game } = start(); arena(game); add(game, 21, 15, 'acid_mound');
        game.onConfirmRequest = () => false; acknowledge(); const before = mechanical(game);
        game.executeCommand('ext:command', attackCommand('combat.anchor-break'));
        expect(game.lastAdvancementError).toBeNull(); expect(mechanical(game)).toEqual(before);
        game.monsters = [];
        const plan = preparePhasedAttackCommand(game, attackCommand('combat.returning-sweep'))!;
        commitPhasedAttackCommand(game, plan); const busy = mechanical(game);
        expect(preparePhasedAttackCommand(game, attackCommand('combat.answering-edge'))).toBeNull();
        expect(mechanical(game)).toEqual(busy);
    });
});

describe('C2-ACT NPC single-profile selection and native fallback', () => {
    it.each(rows)('$monster starts only $id through the real ready decision and never adds a same-tick native hit', row => {
        const { game } = start(); arena(game);
        const distance = row.id === 'cast-echo' ? 2 : 1, source = add(game, 20 + distance, 15, row.monster);
        source.ticksUntilTurn = 1; source.accuracy = 10000; source.damageString = '1';
        const observation = observe(game);
        play(game, 'wait');
        const own = state(game).actions.find(action => game.actorActions!.bundles.some(bundle => bundle.actionId === action.actionId && bundle.decisionOwnerId === source.id));
        expect(own?.subactions[0]!.attackId).toBe(`combat.${row.id}`);
        expect(observation.hits.filter(hit => hit.sourceId === source.id && !hit.attackId)).toEqual([]);
        for (let index = 0; index < 4 && observation.releases.every(release => release.sourceId !== source.id); index++) play(game, 'wait');
        expect(observation.releases.some(release => release.sourceId === source.id && release.attackId === `combat.${row.id}`)).toBe(true);
        observation.restore();
    });
    it('advancing-point cannot start from its third stage range, while a near monkey falls back to native attack', () => {
        for (const [type, distance] of [['jackal', 3], ['monkey', 1]] as const) {
            const { game } = start(); arena(game); const source = add(game, 20 + distance, 15, type); source.ticksUntilTurn = 1;
            const native = vi.spyOn(CombatSystem, 'attack'), observation = observe(game); play(game, 'wait');
            expect(observation.releases.filter(release => release.sourceId === source.id)).toEqual([]);
            expect(state(game).actions.filter(action => action.subactions.some(sub => sub.attackId === (type === 'jackal' ? 'combat.advancing-point' : 'combat.cast-echo')))).toEqual([]);
            if (type === 'monkey') expect(native.mock.calls.filter(call => call[0] === source)).toHaveLength(1);
            observation.restore(); native.mockRestore();
        }
    });
});
