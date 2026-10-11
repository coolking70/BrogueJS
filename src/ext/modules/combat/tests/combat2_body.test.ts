import { afterEach, describe, expect, it, vi } from 'vitest';
import { installProductionBody, emptyProductionArena, startProductionGame, PRODUCTION_BODY_ID } from '../../../../test/support/productionComposite';
import { state, clone, observe, attackCommand, play } from './support/combat2Harness';
import { commitCreatureAnchor, footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { applyActorPoiseDamage } from '../../../../engine/Core/PhasedAttackProduction';
import { withBodyContact } from '../../../../engine/Combat/BodyCombat';
import { MonsterState } from '../../../../entities/Monster';
import { logger } from '../../../../engine/Systems/Logger';

/** Own lawful provider declarations; never replaces shipped giants content. */
function scene() {
    const data = installProductionBody(8);
    Object.assign(data.nativeBodies, { attackProfiles: [...(data.nativeBodies.attackProfiles ?? []), { id: 'body-fixture.combat2-profile', owner: 'body-fixture', providerProfileId: 'combat.advancing-point-profile' }] });
    const offsets = [{ x: 3, y: -1 }, { x: 4, y: -1 }, { x: 5, y: -1 }, { x: 3, y: 0 }, { x: 5, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }];
    for (const [index, part] of data.definition.parts.entries()) if (index) { part.attackProfileIds = ['body-fixture.combat2-profile']; part.preferredOffset = offsets[index - 1]!; }
    for (const constraint of data.definition.constraints) constraint.maxDistance = 6;
    const game = startProductionGame(['body-fixture', 'combat']); emptyProductionArena(game);
    const core = game.createCompositeMonster(PRODUCTION_BODY_ID, { x: 14, y: 12 })!;
    core.state = MonsterState.HUNTING; core.behaviorFlags.add('MONST_ALWAYS_HUNTING'); core.givenUpOnScent = true;
    commitCreatureAnchor(game.player, { x: 18, y: 12 });
    return { game, core, group: game.bodyGroups![0]!, legs: game.monsters.slice(1) };
}
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
describe('C2-BODY diagnostic new attack as independently paid member source', () => {
    it('admits four sources, excludes its whole group, charges each six and owns one max-duration clock', () => {
        const { game, core, legs, group } = scene(), timers = legs.map(leg => leg.ticksUntilTurn), observation = observe(game);
        play(game, 'wait'); const bundle = game.actorActions!.bundles.find(bundle => bundle.decisionOwnerId === core.id)!;
        expect(bundle.timeChargeOwnerId).toBe(core.id); expect(bundle.subactions).toHaveLength(4);
        expect(state(game).actions[0]!.paidCost).toBe(24);
        expect(state(game).actors.filter(actor => bundle.subactions.some(child => child.sourceEntityId === actor.actorId)).map(actor => actor.stamina)).toEqual([18, 18, 18, 18]);
        expect(state(game).actions[0]!.subactions.map(sub => sub.attackId)).toEqual(Array(4).fill('combat.advancing-point'));
        const own = new Set(game.monsters.flatMap(monster => footprintOf(monster)).map(point => `${point.x},${point.y}`));
        for (const sub of state(game).actions[0]!.subactions) expect(sub.lockedCells.every(point => !own.has(`${point.x},${point.y}`))).toBe(true);
        expect(group.members.filter(member => member.readyInTicks > 0)).toHaveLength(4);
        for (let i = 0; i < 3; i++) play(game, 'wait');
        expect(observation.releases.filter(release => release.actionId === bundle.actionId).map(release => release.elapsed)).toEqual([80, 80, 80, 80, 140, 140, 140, 140, 200, 200, 200, 200]);
        expect(legs.map(leg => leg.ticksUntilTurn)).toEqual(timers); observation.restore();
    });
    it('real retirement removes one child only, while core poise break cancels the remaining paid bundle', () => {
        const { game, core, legs } = scene(); play(game, 'wait');
        const bundle = game.actorActions!.bundles[0]!, retired = bundle.subactions[0]!;
        const leg = legs.find(leg => leg.id === retired.sourceEntityId)!;
        withBodyContact(leg, leg.loc, () => leg.takeDamage(100));
        expect(retired.cancelled).toBe(true); expect(bundle.subactions.filter(child => !child.cancelled)).toHaveLength(3);
        expect(state(game).actions[0]!.paidCost).toBe(24);
        applyActorPoiseDamage(game, core.id, 12);
        for (const child of bundle.subactions.filter(child => !child.cancelled)) expect(child.phases[child.phaseIndex]!.kind).toBe('break-recovery');
        expect(state(game).actions[0]!.subactions.every(sub => sub.lockedCells.length === 0)).toBe(true);
        expect(game.loadSnapshot(clone(game.toSaveSnapshot()))).toBe(true);
    });
    it('player anchor-break contacts real parts once and transfers native damage only once', () => {
        const { game, core, legs } = scene();
        for (const monster of game.monsters) { monster.ticksUntilTurn = 10000; monster.defense = -10000; }
        const observation = observe(game), before = core.hp;
        play(game, 'ext:command', attackCommand('combat.anchor-break', 'n'));
        const hits = observation.hits.filter(hit => hit.sourceId === game.player.id);
        expect(hits.length).toBeGreaterThan(0); expect(new Set(hits.map(hit => hit.targetId)).size).toBe(hits.length);
        expect(hits.every(hit => legs.some(leg => leg.id === hit.targetId))).toBe(true);
        expect(core.hp).toBeLessThan(before); observation.restore();
    });
});
