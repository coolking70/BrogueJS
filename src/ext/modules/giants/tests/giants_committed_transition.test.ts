import { afterEach, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import type { CombatEventFact } from '../../../types';
import { getNextEntityId } from '../../../../entities/Creature';
import { MonsterState } from '../../../../entities/Monster';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { logger } from '../../../../engine/Systems/Logger';
import { emptyProductionArena, startProductionGame } from '../../../../test/support/productionComposite';
import { install, acknowledge, modules } from '../../../../test/support/committedBodyTransitions';

afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

it('executes the formal active split and subsequent committed attack through normal commands with every installed optional module', () => {
        const facts: CombatEventFact[] = [];
        install(fact => facts.push(structuredClone(fact)));
        const game = startProductionGame(modules.includes('narrative') ? modules : [...modules, 'body-fixture'], 7351, 'normal');
        emptyProductionArena(game);
        // Functional encounter setup, not a natural-generation claim. Only the
        // HP threshold/readiness/position are arranged; transition and attacks use input.
        const core = game.createModuleMonster('giants.abyssal-colossus', { x: 20, y: 12 })!;
        core.hp = 129; core.state = MonsterState.HUNTING; core.givenUpOnScent = true; core.ticksUntilTurn = 0;
        core.behaviorFlags.add('MONST_ALWAYS_HUNTING');
        commitCreatureAnchor(game.player, { x: 19, y: 12 });
        (game as any).updateVision(); acknowledge();
        const next = getNextEntityId();
        game.executeCommand('wait'); acknowledge();
        expect(core.bodyTransitionHistory).toEqual(['giants.colossus-fracture']);
        expect(game.monsters.map(actor => actor.id)).toEqual([core.id, next]);
        expect(game.monsters.map(actor => actor.hp)).toEqual([65, 64]);
        vi.spyOn(Date, 'now').mockReturnValue(Date.now());
        const beforeAttack = game.toSaveSnapshot();
        game.executeCommand('ext:command', JSON.stringify({ module: 'combat', action: 'attack',
            payload: { attackId: 'fixture.double-thrust', facing: 'e' } })); acknowledge();
        const resolved = facts.filter(fact => fact.eventKind === 'attack-resolved' && fact.actor.entityId === game.player.id);
        if (modules.includes('combat')) {
            expect(resolved.map(fact => fact.segmentIndex)).toEqual([0, 1]);
            expect(new Set(resolved.map(fact => fact.factId)).size).toBe(2);
        } else {
            expect(resolved).toEqual([]);
            expect(game.toSaveSnapshot()).toEqual({ ...beforeAttack, run: { ...beforeAttack.run,
                logger: { ...beforeAttack.run.logger, nextId: beforeAttack.run.logger.nextId + 1,
                    messages: [...beforeAttack.run.logger.messages, { id: beforeAttack.run.logger.nextId,
                        text: i18next.t('ext.command.rejected'), color: '#ff6666', count: 1,
                        turn: beforeAttack.run.logger.turn }] } } });
            expect(game.extensionRuntime!.actorActionBinding()).toBeNull();
        }
        expect(game.lastAdvancementError).toBeNull();
        expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
    });
