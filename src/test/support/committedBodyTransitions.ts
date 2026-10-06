import { expect, vi } from 'vitest';
import '../../i18n';
import * as catalog from '../../ext/catalog';
import { registryFromDescriptors } from '../../ext/descriptor';
import { extensionDataFingerprint } from '../../ext/fingerprint';
import type { BodyTransitionRequest } from '../../ext/bodyTransitions';
import type { CombatEventFact, CombatEventPayload, ExtensionContext, ExtensionModule } from '../../ext/types';
import { MonsterState } from '../../entities/Monster';
import { TerrainType } from '../../engine/Map/Grid';
import { collectPhasedAttackActors } from '../../engine/Core/PhasedAttackProduction';
import { logger } from '../../engine/Systems/Logger';
import { emptyProductionArena, installProductionBody, PRODUCTION_BODY_ID, startProductionGame } from './productionComposite';
import { installedOptionalModules } from './installedExtensions';

export const modules = installedOptionalModules(['combat', 'giants', 'growth', 'narrative']);
export const capacityInput = { v: 1, baseStaminaCapacity: 24, basePoiseCapacity: 12 };
export const attack: CombatEventPayload = { eventKind: 'attack-resolved', actionId: 1, sourceSubactionId: 1,
    segmentIndex: 0, resolutionId: null, bonfireId: null, visit: null, hitCount: 1, hpLost: 1 };
export const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };

/** Retain every installed production module. When narrative is absent, the
 * independent body fixture observes the same foundation fact protocol. */
export function install(observer: (fact: CombatEventFact, context: ExtensionContext) => void = () => {}) {
    installProductionBody();
    const previous = catalog.createExtensionRegistry();
    const registry = registryFromDescriptors(catalog.getInstalledModuleDescriptors().map(descriptor => {
        const module = previous.create(previous.manifest([descriptor.id]))[0]!;
        if (descriptor.id === 'body-fixture') {
            const reduced = structuredClone(module.nativeBodies!.definitions.find(body => body.id === PRODUCTION_BODY_ID)!);
            reduced.id = 'body-fixture.fixture-reduced';
            reduced.parts = [{ ...reduced.parts[0]!, formId: 'body-fixture.fixture-reduced-core' }, reduced.parts[1]!, reduced.parts[2]!];
            reduced.constraints = reduced.constraints.slice(0, 2);
            const nativeForms = [...module.nativeForms!, { ...module.nativeForms!.find(form => form.id === 'body-fixture.fixture-core')!,
                id: 'body-fixture.fixture-reduced-core', hp: 80 }];
            const nativeBodies = { ...module.nativeBodies!, definitions: [...module.nativeBodies!.definitions, reduced] };
            const rules = { ...module.rules!, fingerprint: extensionDataFingerprint({ base: module.rules, nativeForms, nativeBodies }) };
            return { ...descriptor, rules, create: () => ({ ...module, rules, nativeForms, nativeBodies,
                ...(!modules.includes('narrative') ? { committedFacts: { ...module.committedFacts,
                    'combat.event.v1': { maxDerivedFacts: 0,
                        eventKinds: ['attack-resolved', 'staggered', 'parried', 'rest-completed'] as const,
                        prepare: (fact: CombatEventFact) => fact,
                        commit: (fact: unknown, context: ExtensionContext) => observer(fact as CombatEventFact, context) } } } : {}) }) };
        }
        if (descriptor.id === 'narrative') {
            const consumer = module.committedFacts!['combat.event.v1']!;
            const observed: ExtensionModule = { ...module, committedFacts: { ...module.committedFacts,
                'combat.event.v1': { ...consumer, eventKinds: ['attack-resolved', 'staggered', 'parried', 'rest-completed'],
                    prepare: (fact, allocation, context) => ({ fact, plan: consumer.prepare(fact, allocation, context) }),
                    commit: (value, context) => {
                        const { fact, plan } = value as { fact: CombatEventFact; plan: unknown };
                        consumer.commit(plan, context);
                        observer(fact, context);
                    } } } };
            return { ...descriptor, create: () => observed };
        }
        return { ...descriptor, rules: module.rules, create: () => module };
    }));
    vi.mocked(catalog.createExtensionRegistry).mockReturnValue(registry);
}

export function scene(observer?: (fact: CombatEventFact, context: ExtensionContext) => void, cached = false) {
    install(observer);
    const game = startProductionGame([...modules, 'body-fixture'], 7349, 'normal');
    if (cached) {
        // Stair location is fixture setup; caching/entry uses the public input.
        game.grid.setTerrain(game.player.x, game.player.y, TerrainType.STAIRS_DOWN);
        game.executeCommand('stairs_down'); acknowledge();
        expect(game.depth).toBe(2); expect(game.levels.has(1)).toBe(true);
    }
    emptyProductionArena(game);
    const core = game.createCompositeMonster(PRODUCTION_BODY_ID, { x: 14, y: 12 })!;
    core.hp = 80; core.state = MonsterState.HUNTING;
    const actors = [...game.monsters], group = game.bodyGroups![0]!;
    const external = game.createModuleMonster('body-fixture.ridgeback', { x: 55, y: 12 })!;
    game.planSquareStep(external, { kind: 'anchors', anchors: [{ x: 50, y: 12 }] });
    collectPhasedAttackActors(game, [game.player, ...game.monsters]);
    (game as any).updateVision(); acknowledge();
    return { game, core, actors, group, external };
}

export function transition(groupId: number, reason: 'phase' | 'split'): BodyTransitionRequest {
    return { sourceGroupId: groupId, reason,
        results: reason === 'phase'
            ? [{ formId: 'body-fixture.fixture-reduced-core', memberMap: [{ from: 'leg07', to: 'leg00' }, { from: 'leg06', to: 'leg01' }] }]
            : [{ formId: 'body-fixture.ridgeback', memberMap: [] }, { formId: 'body-fixture.ridgeback', memberMap: [] }],
        hp: reason === 'split' ? 'conserve' : 'ratio', statuses: 'preserve', relationships: 'preserve', placement: 'nearest' };
}
