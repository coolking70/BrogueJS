import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../engine/Core/Game';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { createHeadlessGame } from './harness';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';
import data from '../ext/modules/growth/definitions.json';
import type { GrowthDefinitionPack, GrowthTimedEffect } from '../ext/modules/growth/types';
import type { GrowthState } from '../ext/modules/growth/state';
import type { GrowthAttributes, GrowthProgression } from '../ext/modules/growth/components';
import { growthRuleActor } from '../ext/modules/growth/attributes';
import { createGrowthEffectInstance, growthLearnedCost, growthSkillDefinition, initialGrowthSkillBuild, type GrowthSkillBuild } from '../ext/modules/growth/skills';
import { createGrowthGameplay } from '../ext/modules/growth/module';
import { parseGrowthDefinitionPack } from '../ext/modules/growth/definitions';
import { extensionDataFingerprint } from '../ext/fingerprint';
import { ExtensionRegistry } from '../ext/registry';
import type { Json } from '../ext/types';
import * as catalog from '../ext/catalog';

const marker = 'growth-npc-replay-fixture';
const skillId = (name: string) => `growth.skill.${name}`;
/** Deterministic test-only birth adapter: replay reconstructs this same starting scene.
 * No debug mutation after recording starts and no production NPC spell-selection API. */
function configuredNpcScene() {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.levels.skillPoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 30 };
    // Equivalent NPC birth budget under the now-active complete-template contract.
    pack.config.monsters.templates[0]!.unspentSkillPoints = 30;
    pack.config.experience.sources.firstVisits = false;
    for (const def of pack.definitions) if (def.kind === 'skill') def.prerequisites = [];
    const parsed = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    const identity = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry();
        registry.register('growth', pack.moduleVersion, () => {
            const module = createGrowthGameplay(parsed, identity), original = module.hooks!.creatureSpawned!;
            return { ...module, hooks: { ...module.hooks, creatureSpawned(event, context) {
                original(event, context);
                if (event.creature.name !== marker) return;
                const state = context.state as unknown as GrowthState, actorId = event.creature.id;
                const progression = context.getComponent(actorId, 'progression') as GrowthProgression;
                const attributes = context.getComponent(actorId, 'attributes') as GrowthAttributes;
                const build = initialGrowthSkillBuild();
                build.learned = ['brace', 'close-guard', 'weapon-familiarity'].map(skillId).sort();
                build.passive = ['close-guard', 'weapon-familiarity'].map(skillId);
                progression.skillPoints -= growthLearnedCost(parsed, build);
                const skill = growthSkillDefinition(parsed, skillId('brace'))!;
                const effect = skill.effects.find(effect => effect.kind === 'timed') as GrowthTimedEffect;
                build.effects.push(createGrowthEffectInstance(parsed, skill, effect,
                    growthRuleActor(actorId, progression, attributes), build, state.objectiveClock, state.nextActionId++, state.nextEffectId++));
                context.setComponent(actorId, 'progression', progression);
                context.setComponent(actorId, 'skill-build', build as unknown as Json);
                context.setState(state as unknown as Json);
            } } };
        }, identity);
        return registry;
    });
    const prototype = Game.prototype as unknown as { generateTestDepth(first: boolean): void };
    const native = prototype.generateTestDepth;
    vi.spyOn(prototype, 'generateTestDepth').mockImplementation(function (this: Game, first: boolean) {
        native.call(this, first);
        if (!this.extensionRuntime) return;
        this.player.hp = this.player.maxHp = 200;
        const species = (monsters as MonsterData[]).find(monster => monster.id === 'rat')!;
        const enemy = new Monster(this.player.x + 1, this.player.y, { ...species, name: marker, hp: 200, damage: '20d1', accuracy: 1000, defense: 0 });
        enemy.name = marker; enemy.state = MonsterState.HUNTING;
        enemy.setStatusDuration('shielded', 1000);
        this.monsters.push(enemy);
        (this as unknown as { updateVision(): void }).updateVision();
    });
}
const npc = (game: Game) => game.monsters.find(monster => monster.name === marker)!;
const build = (game: Game) => game.extensionRuntime!.snapshot().components[npc(game).id]!['growth:skill-build'] as unknown as GrowthSkillBuild;
function finish(game: Game) { for (let i = 0; i < 100 && game.isAdvancing; i++) game.stepAdvancement(); expect(game.isAdvancing).toBe(false); }
function projection(game: Game) {
    return { extensions: game.extensionRuntime!.snapshot(), rng: rng.getState(), tick: timeSystem.currentTick,
        player: { hp: game.player.hp, maxHp: game.player.maxHp, loc: { ...game.player.loc } },
        npc: { id: npc(game).id, hp: npc(game).hp, maxHp: npc(game).maxHp, loc: { ...npc(game).loc }, shield: npc(game).getStatusDuration('shielded') } };
}
afterEach(() => vi.restoreAllMocks());

describe('EXT-1d recorded native NPC common skill components', () => {
    it('applies NPC defense/damage/one-shot consumption during native turns and round-trips replay, seek and save continuation', () => {
        configuredNpcScene();
        const game = createHeadlessGame(4471, 'test'); game.startNewGame({ seed: 4471, mode: 'test', ruleSet: 'extended' });
        game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action: 'create-character', payload: { revision: 0 } }));
        expect(build(game).effects).toHaveLength(1); expect(build(game).passive).toHaveLength(2);
        const before = game.player.hp;
        game.executeCommand('move', { x: 1, y: 0 }); finish(game);
        // Both the player strike and NPC AI response are genuine native combat paths.
        expect(game.player.hp).toBeLessThan(before);
        expect(build(game).effects).toHaveLength(0);
        game.executeCommand('wait'); finish(game);
        const saved = game.toSaveSnapshot(), recording = game.exportRecording(), expected = projection(game);
        expect(game.hasCompleteRecording).toBe(true);
        const replay = createHeadlessGame(4472, 'test'); expect(replay.loadReplay(recording)).toBe(true);
        while (replay.replayCursor < recording.events.length && !replay.replayError) replay.replayStep(true);
        expect(replay.replayError).toBeNull(); expect(projection(replay)).toEqual(expected);
        replay.replaySeek(1);
        while (replay.replayCursor < recording.events.length && !replay.replayError) replay.replayStep(true);
        expect(replay.replayError).toBeNull(); expect(projection(replay)).toEqual(expected);
        const loaded = createHeadlessGame(4473, 'test'); expect(loaded.loadSnapshot(saved)).toBe(true);
        expect(projection(loaded)).toEqual(expected); loaded.executeCommand('wait'); finish(loaded);
        const continuation = loaded.exportRecording(), resumed = projection(loaded), check = createHeadlessGame(4474, 'test');
        expect(check.loadReplay(continuation)).toBe(true);
        while (check.replayCursor < continuation.events.length && !check.replayError) check.replayStep(true);
        expect(check.replayError).toBeNull(); expect(projection(check)).toEqual(resumed);
    });
    it('expires an unused NPC temporary effect on real objective blocks without requiring a player-owned skill', () => {
        configuredNpcScene(); const game = createHeadlessGame(4471, 'test');
        game.startNewGame({ seed: 4471, mode: 'test', ruleSet: 'extended' });
        game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action: 'create-character', payload: { revision: 0 } }));
        expect(build(game).effects).toHaveLength(1);
        game.executeCommand('wait'); finish(game); expect(build(game).effects).toHaveLength(1);
        game.executeCommand('wait'); finish(game); expect(build(game).effects).toHaveLength(0);
    });
});
