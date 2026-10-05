import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { CombatSystem } from '../engine/Combat/Combat';
import { chargeNativeActorAttack } from '../engine/Core/PhasedAttackProduction';
import { commitCreatureAnchor } from '../engine/Movement/CreatureSpatial';
import { TerrainType } from '../engine/Map/Grid';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { logger } from '../engine/Systems/Logger';

afterEach(() => { vi.restoreAllMocks(); logger.reset(); });

describe('native BE_ATTACK delivery preserves classic call shape and extended cost boundary', () => {
    it.each(['DISTANCE_ATTACK', 'POISON_DART'])('%s classic and combat-only real Game paths', name => {
        for (const extended of [false, true]) {
            const game = createHeadlessGame(923402, 'test');
            if (extended) game.startNewGame({ seed: 923402, mode: 'test', ruleSet: 'extended', extensions: ['combat'] });
            game.animationEnabled = false; game.monsters = []; game.items = [];
            for (let y = 10; y <= 20; y++) for (let x = 15; x <= 27; x++) game.grid.setTerrain(x, y, TerrainType.FLOOR);
            commitCreatureAnchor(game.player, { x: 20, y: 15 });
            const caster = new Monster(22, 15, monsters.find(m => m.id === 'jackal')! as MonsterData);
            caster.state = MonsterState.HUNTING; caster.accuracy = 10000; caster.damageString = '2d1';
            game.monsters.push(caster);
            if (extended) {
                let exhausted = false;
                for (let i = 0; i < 32; i++) if (!chargeNativeActorAttack(game, caster.id)) { exhausted = true; break; }
                expect(exhausted).toBe(true);
                expect(game.extensionRuntime!.actorActionBinding()!.state.actors.find(row => row.actorId === caster.id)!.stamina).toBe(0);
            }
            const hp = game.player.hp, attack = vi.spyOn(CombatSystem, 'attack');
            const result = game.castMonsterBolt(caster, game.player, name)!;
            expect(result.hits.map(hit => hit.creature)).toEqual([game.player]);
            expect(attack).toHaveBeenCalledExactlyOnceWith(caster, game.player, { grid: game.grid, isWeaponAttack: true,
                ...(extended ? { delivery: 'bolt' } : {}) });
            expect(attack.mock.results[0]!.value.staminaBlocked).toBeUndefined();
            expect(game.player.hp).toBeLessThan(hp);
            if (extended) expect(game.extensionRuntime!.actorActionBinding()!.state.actors.find(row => row.actorId === caster.id)!.stamina).toBe(0);
            attack.mockRestore();
        }
    });
});
