import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game, type HordeEntry } from '../../../../engine/Core/Game';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { DCOLS, DROWS, TerrainType } from '../../../../engine/Map/Grid';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import { createHeadlessGame } from '../../../../test/harness';
import data from '../data/definitions.json';
import type { GrowthDefinitionPack, GrowthTemplate } from '../types';
import type { GrowthAttributes, GrowthDerived, GrowthFocus, GrowthProgression, GrowthSkills } from '../components';
import type { GrowthIdentityBuild } from '../identities';
import type { GrowthSkillBuild } from '../skills';
import type { GrowthReward, GrowthState } from '../state';
import { parseGrowthDefinitionPack } from '../definitions';
import { experienceThreshold } from '../experience';
import { createGrowthGameplay } from '../module';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { ExtensionRegistry } from '../../../../ext/registry';
import * as catalog from '../../../../ext/catalog';

const con = 'growth.attribute.constitution', close = 'growth.skill.close-guard', guard = 'growth.profession.guardian';
const templateId = 'growth.template.runtime-guard';
const species = (id: string) => (monsters as MonsterData[]).find(monster => monster.id === id)!;
const state = (game: Game) => game.extensionRuntime!.snapshot().modules.growth as unknown as GrowthState;
const component = <T>(game: Game, id: number, name: string) => game.extensionRuntime!.snapshot().components[id]?.[`growth:${name}`] as T;
function finish(game: Game): void {
    for (let i = 0; i < 200 && game.isAdvancing; i++) game.stepAdvancement();
    expect(game.isAdvancing).toBe(false); expect(game.lastAdvancementError).toBeNull();
}
function command(game: Game, action: string, payload: Record<string, unknown> = {}): void {
    game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action, payload: { revision: state(game).revision, ...payload } })); finish(game);
}
function configured(change: (pack: GrowthDefinitionPack) => void = () => {}) {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.experience.sources.firstVisits = false;
    pack.config.levels.experience = { kind: 'curve', base: 1, linear: 0, quadratic: 0 };
    const template: GrowthTemplate = { ...structuredClone(pack.config.monsters.templates[0]!), id: templateId,
        level: 4, experience: experienceThreshold(pack.config.levels, 4), professionId: guard,
        attributes: [{ attributeId: con, amount: 2 }], skills: [close], passiveSlots: [close], unspentSkillPoints: 1 };
    pack.config.monsters.templates.push(template);
    pack.config.monsters.defaultTemplateId = templateId;
    change(pack);
    const parsed = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    const identity = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry(); registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(parsed, identity), identity); return registry;
    });
    return parsed;
}
function newGame(mode: 'test' | 'normal' = 'test', seed = 18391): Game {
    const game = createHeadlessGame(seed, 'test'); game.startNewGame({ seed, mode, ruleSet: 'extended' });
    command(game, 'create-character', { revision: 0 }); return game;
}
function openFloor(game: Game): void {
    game.monsters = []; game.dormantMonsters = []; game.items = []; game.player.loc = { x: 4, y: 5 };
    for (let x = 1; x < DCOLS - 1; x++) for (let y = 1; y < DROWS - 1; y++) {
        game.grid.setTerrain(x, y, TerrainType.FLOOR);
        Object.assign(game.grid.getCell(x, y)!, { isVisible: true, isDiscovered: true });
    }
}
function spawn(game: Game, id = 'goblin', x = 7, allied = false): Monster {
    const horde: HordeEntry = { leader: id.toUpperCase(), members: [], minLevel: 1, maxLevel: 26, spawnsIn: null,
        frequency: 1, machine: 0, flags: allied ? ['HORDE_ALLIED_WITH_PLAYER'] : [] };
    const adapter = game as unknown as { spawnHordeAt(horde: HordeEntry, pos: { x: number; y: number }, depth: number, wandering: boolean): boolean };
    expect(adapter.spawnHordeAt(horde, { x, y: 5 }, game.depth, false)).toBe(true);
    return game.monsters.find(monster => monster.x === x && monster.y === 5)!;
}
function scene(): Game {
    const game = newGame(); game.clearRecording(); openFloor(game);
    game.executeCommand('template-runtime-fixture', undefined, () => undefined); return game;
}
function standOn(game: Game, terrain: TerrainType): void {
    for (let x = 0; x < DCOLS; x++) for (let y = 0; y < DROWS; y++) if (game.grid.getCell(x, y)!.layers.includes(terrain)) {
        game.player.loc = { x, y }; return;
    }
    throw new Error('Expected generated stairs');
}
function settle(game: Game): void { game.executeCommand('template-runtime-fixture', undefined, () => undefined); finish(game); }
function replayScene(): void {
    const prototype = Game.prototype as unknown as { generateTestDepth(first: boolean): void }, original = prototype.generateTestDepth;
    vi.spyOn(prototype, 'generateTestDepth').mockImplementation(function (this: Game, first: boolean) {
        original.call(this, first);
        if (!this.extensionRuntime) return;
        openFloor(this); this.player.hp = this.player.maxHp = 200;
        const ally = spawn(this, 'goblin', 7, true), target = spawn(this, 'rat', 8);
        ally.hp = 10; target.hp = 1; target.state = MonsterState.ASLEEP;
        (this as unknown as { updateVision(): void }).updateVision();
    });
}
function projection(game: Game) {
    return { extensions: game.extensionRuntime!.snapshot(), random: rng.getState(), tick: timeSystem.currentTick,
        player: { hp: game.player.hp, maxHp: game.player.maxHp, loc: { ...game.player.loc } },
        monsters: game.monsters.map(monster => ({ id: monster.id, hp: monster.hp, maxHp: monster.maxHp, loc: { ...monster.loc } })) };
}
afterEach(() => vi.restoreAllMocks());

describe('EXT-1e templates through actual engine lifecycles', () => {
    it('selects priority depth templates for natural generated births and keeps existing actors unchanged across stairs/load', () => {
        configured(pack => {
            const shallow = { ...structuredClone(pack.config.monsters.templates[1]!), id: 'growth.template.shallow', level: 2, experience: 1 };
            pack.config.monsters.templates.push(shallow);
            pack.config.monsters.depthTemplates = [
                { minDepth: 1, maxDepth: 26, templateId: shallow.id, priority: 1 },
                { minDepth: 2, maxDepth: 2, templateId, priority: 20 },
            ];
        });
        const game = newGame('normal'); game.clearRecording();
        const originals = [...game.monsters, ...game.dormantMonsters]; expect(originals.length).toBeGreaterThan(0);
        for (const monster of originals) {
            expect(component<GrowthReward>(game, monster.id, 'reward').creationReason).toBe('natural');
            expect(component<GrowthIdentityBuild>(game, monster.id, 'identity').templateId).toBe('growth.template.shallow');
            expect(component<GrowthProgression>(game, monster.id, 'progression').level).toBe(2);
        }
        const old = new Map(originals.map(monster => [monster.id, component<GrowthIdentityBuild>(game, monster.id, 'identity')]));
        standOn(game, TerrainType.STAIRS_DOWN); game.executeCommand('stairs_down'); finish(game); expect(game.depth).toBe(2);
        const deep = [...game.monsters, ...game.dormantMonsters]; expect(deep.length).toBeGreaterThan(0);
        for (const monster of deep) if (!old.has(monster.id)) {
            expect(component<GrowthIdentityBuild>(game, monster.id, 'identity').templateId).toBe(templateId);
            expect(component<GrowthProgression>(game, monster.id, 'progression').level).toBe(4);
        }
        const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true);
        expect(game.extensionRuntime!.snapshot()).toEqual(saved.extensions);
        standOn(game, TerrainType.STAIRS_UP); game.executeCommand('stairs_up'); finish(game); expect(game.depth).toBe(1);
        for (const monster of [...game.monsters, ...game.dormantMonsters]) if (old.has(monster.id))
            expect(component<GrowthIdentityBuild>(game, monster.id, 'identity')).toEqual(old.get(monster.id));
    });
    it.each([false, true])('clones a wounded natural template actor with inheritBuild=%s without copying automatic levels or double-applying constitution', inheritBuild => {
        configured(pack => { pack.config.monsters.clone.inheritBuild = inheritBuild; });
        const game = scene(), source = spawn(game); source.hp = 10;
        expect(source.maxHp).toBe(species('goblin').hp + 8);
        const before = { hp: source.hp, maxHp: source.maxHp }, clone = game.cloneMonster(source, { x: 8, y: 5 }, { creationReason: 'clone' })!;
        expect(clone).not.toBeNull();
        expect(component<GrowthProgression>(game, clone.id, 'progression')).toEqual({ level: 1, experience: 0, attributePoints: 0, skillPoints: 0 });
        expect(component<GrowthDerived>(game, clone.id, 'derived').appliedMaxHp).toBe(inheritBuild ? 6 : 0);
        expect(clone.maxHp).toBe(species('goblin').hp + (inheritBuild ? 6 : 0)); expect(clone.hp).toBe(10);
        expect({ hp: source.hp, maxHp: source.maxHp }).toEqual(before);
        const second = game.cloneMonster(clone, { x: 9, y: 5 }, { creationReason: 'clone' })!; expect(second.maxHp).toBe(clone.maxHp); expect(second.hp).toBe(clone.hp);
        settle(game); const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true);
        expect(game.monsters.find(monster => monster.id === clone.id)!.maxHp).toBe(clone.maxHp);
        expect(game.extensionRuntime!.snapshot()).toEqual(saved.extensions);
    });
    it.each([false, true])('preserves template grants through real ally resurrection and respects native clone exclusion, copied=%s', copied => {
        configured(); const game = scene(), original = spawn(game, 'vampire', 7, true);
        const originalComponents = structuredClone(game.extensionRuntime!.snapshot().components[original.id]!);
        const actor = copied ? game.cloneMonster(original, { x: 8, y: 5 }, { creationReason: 'clone', initiallyAllied: true })! : original;
        const before = { identity: component<GrowthIdentityBuild>(game, actor.id, 'identity'), progression: component<GrowthProgression>(game, actor.id, 'progression'),
            attributes: component<GrowthAttributes>(game, actor.id, 'attributes'), build: component<GrowthSkillBuild>(game, actor.id, 'skill-build') };
        const bonus = component<GrowthDerived>(game, actor.id, 'derived').appliedMaxHp;
        expect(actor.empower()).toBe(true); expect(actor.maxHp).toBe(species('vampire').hp + bonus + 12);
        const runtime = game.extensionRuntime!, cause = runtime.causality.create('melee', game.player.id, game.player.id, game.player.extensionHooks!.partyId(game.player));
        runtime.causality.withOrigin(cause, () => game.killMonster(actor));
        (game as unknown as { removeDeadMonsters(): void }).removeDeadMonsters(); settle(game);
        expect(actor.hp).toBe(0);
        if (copied) {
            // Native CE excludes cloned bodies from purgatory; growth must not change that rule.
            expect(game.purgatory).not.toContain(actor); expect(game.resurrectAlly(game.player.loc)).toBe(false);
            expect(game.extensionRuntime!.snapshot().components[original.id]).toEqual(originalComponents);
            expect(game.extensionRuntime!.snapshot().components[actor.id]).toBeUndefined();
            expect(state(game).rewardReceipts).toContain(`birth:${actor.id}`);
            expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true); return;
        }
        expect(game.purgatory).toContain(actor);
        expect(game.resurrectAlly(game.player.loc)).toBe(true); settle(game);
        expect(game.monsters).toContain(actor); expect(game.purgatory).not.toContain(actor);
        expect(actor.maxHp).toBe(species('vampire').hp + bonus); expect(actor.hp).toBe(actor.maxHp);
        expect({ identity: component<GrowthIdentityBuild>(game, actor.id, 'identity'), progression: component<GrowthProgression>(game, actor.id, 'progression'),
            attributes: component<GrowthAttributes>(game, actor.id, 'attributes'), build: component<GrowthSkillBuild>(game, actor.id, 'skill-build') }).toEqual(before);
        const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true); expect(game.extensionRuntime!.snapshot()).toEqual(saved.extensions);
    });
    it.each([[18,18],[23,21],[33,31]])('clamps copied HP %s against the rebuilt maximum, preserving inherited constitution and native overhealth', (hp,expected) => {
        configured(); const game=scene(),source=spawn(game); source.hp=hp;
        expect(source.maxHp).toBe(23);
        const clone=game.cloneMonster(source,{x:8,y:5})!;
        expect(clone.maxHp).toBe(21);expect(clone.hp).toBe(expected);expect(source.hp).toBe(hp);
        settle(game);const saved=game.toSaveSnapshot();expect(game.loadSnapshot(saved)).toBe(true);
        expect(game.monsters.find(actor=>actor.id===clone.id)!.hp).toBe(expected);
    });
    it('disabled NPC growth retains rewards and an empty effect receptacle, pays genuine melee kills and saves', () => {
        configured(pack => { pack.config.monsters.enabled = false; pack.config.attributes.find(attribute => attribute.id === con)!.initial = 1; });
        const game = scene(), target = spawn(game, 'rat', 5); target.hp = 1; target.state = MonsterState.ASLEEP;
        expect(Object.keys(game.extensionRuntime!.snapshot().components[target.id]!).sort()).toEqual(['growth:reward', 'growth:skill-build']);
        expect(component<GrowthSkillBuild>(game, target.id, 'skill-build').effects).toEqual([]);
        expect(target.maxHp).toBe(species('rat').hp);
        const quote = component<GrowthReward>(game, target.id, 'reward').amount, before = component<GrowthProgression>(game, game.player.id, 'progression').experience;
        game.executeCommand('move', { x: 1, y: 0 }); finish(game);
        expect(target.hp).toBe(0); expect(state(game).rewardReceipts).toContain(`birth:${target.id}`);
        expect(component<GrowthProgression>(game, game.player.id, 'progression').experience).toBe(before + quote);
        const alive = spawn(game, 'goblin', 7); settle(game);
        const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true);
        expect(Object.keys(game.extensionRuntime!.snapshot().components[alive.id]!).sort()).toEqual(['growth:reward', 'growth:skill-build']);
    });
    it('strips copied player growth once from a real allied summoned clone when NPC growth is disabled', () => {
        configured(pack => { pack.config.monsters.enabled = false; pack.config.identities.enabled.lineages = false; pack.config.identities.enabled.faiths = false; });
        const game = createHeadlessGame(18395, 'test'); game.startNewGame({ seed: 18395, mode: 'test', ruleSet: 'extended' });
        command(game, 'create-character', { revision: 0, professionId: guard, lineageId: null, faithId: null, choices: [] });
        const bonus = component<GrowthDerived>(game, game.player.id, 'derived').appliedMaxHp;
        expect(bonus).toBe(6); const native = game.player.maxHp - bonus;
        game.clearRecording(); openFloor(game); game.player.hp = 20;
        const sourceMax = game.player.maxHp, clone = game.cloneMonster(game.player, { x: 5, y: 5 }, { creationReason: 'summoned', initiallyAllied: true })!;
        expect(clone).not.toBeNull(); expect(clone.maxHp).toBe(native); expect(clone.hp).toBe(20);
        expect(component<GrowthReward>(game, clone.id, 'reward')).toMatchObject({ nativeStatsCopied: true, sourceId: game.player.id, initiallyHostile: false });
        expect(Object.keys(game.extensionRuntime!.snapshot().components[clone.id]!).sort()).toEqual(['growth:reward', 'growth:skill-build']);
        expect(game.player.hp).toBe(20); expect(game.player.maxHp).toBe(sourceMax);
        const second = game.cloneMonster(clone, { x: 6, y: 5 }, { creationReason: 'clone' })!;
        expect(second.maxHp).toBe(native); expect(second.hp).toBe(20);
        settle(game); const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true);
        expect(game.extensionRuntime!.snapshot()).toEqual(saved.extensions);
    });
    it('receives, saves and consumes pressure on an NPC whose growth is disabled without creating a build', () => {
        const pressure = 'growth.skill.pressure';
        configured(pack => {
            pack.config.monsters.enabled = false;
            pack.config.levels.skillPoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 2 };
            const skill = pack.definitions.find(definition => definition.id === pressure)!;
            if (skill.kind === 'skill') skill.prerequisites = [];
        });
        const game = scene(); command(game, 'learn-skill', { skillId: pressure });
        command(game, 'equip-skills', { active: [pressure], passive: [] });
        const target = spawn(game, 'goblin', 5); target.hp = target.maxHp = 100; target.state = MonsterState.ASLEEP; target.ticksUntilTurn = 10000;
        (game as unknown as { updateVision(): void }).updateVision();
        command(game, 'use-skill', { skillId: pressure, target: { kind: 'creature', id: target.id } });
        expect(component<GrowthSkillBuild>(game, target.id, 'skill-build').effects).toHaveLength(1);
        expect(Object.keys(game.extensionRuntime!.snapshot().components[target.id]!).sort()).toEqual(['growth:reward', 'growth:skill-build']);
        const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true);
        const restored = game.monsters.find(monster => monster.id === target.id)!;
        game.executeCommand('template-runtime-fixture', undefined, () => { CombatSystem.attack(restored, game.player, { grid: game.grid }); });
        expect(component<GrowthSkillBuild>(game, restored.id, 'skill-build').effects).toEqual([]);
        expect(Object.keys(game.extensionRuntime!.snapshot().components[restored.id]!).sort()).toEqual(['growth:reward', 'growth:skill-build']);
        expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
    });
    it.each([[false, false], [false, true], [true, false], [true, true]] as const)(
        'keeps clone future progression=%s independent of copied unspent points=%s through a real attack and save', (progression, inheritUnspentPoints) => {
            const pack = configured(pack => {
                pack.config.monsters.clone.progression = progression; pack.config.monsters.clone.inheritUnspentPoints = inheritUnspentPoints;
                pack.config.monsters.templates[1]!.unspentAttributePoints = 2;
            });
            const game = scene(), source = spawn(game), clone = game.cloneMonster(source, { x: 8, y: 5 }, { creationReason: 'clone' })!, target = spawn(game, 'rat', 9);
            target.hp = 1; target.state = MonsterState.ASLEEP;
            const amount = component<GrowthReward>(game, target.id, 'reward').amount;
            expect(component<GrowthProgression>(game, clone.id, 'progression').attributePoints).toBe(inheritUnspentPoints ? 2 : 0);
            game.executeCommand('template-runtime-fixture', undefined, () => {
                const result = CombatSystem.attack(clone, target, { grid: game.grid }); expect(result.hit).toBe(true);
                if (target.hp <= 0) game.killMonster(target);
            });
            const next = component<GrowthProgression>(game, clone.id, 'progression');
            expect(next.experience).toBe(progression ? amount : 0); expect(next.level).toBe(progression ? amount + 1 : 1);
            expect(next.attributePoints).toBe((progression ? amount : 0) + (inheritUnspentPoints ? 2 : 0));
            expect(component<GrowthAttributes>(game, clone.id, 'attributes').values[con]).toBe(2);
            expect(next.experience).toBeLessThanOrEqual(experienceThreshold(pack.config.levels, pack.config.levels.cap));
            const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true); expect(game.extensionRuntime!.snapshot()).toEqual(saved.extensions);
        });
    it.each([[false, false], [false, true], [true, false], [true, true]] as const)('requires copied-body rewards=%s and creation eligibility=%s before paying a clone kill', (rewards, eligible) => {
        configured(pack => { pack.config.monsters.clone.rewards = rewards; if (eligible) pack.config.experience.kills.eligibleCreationReasons.push('clone'); });
        const game = scene(), source = spawn(game), clone = game.cloneMonster(source, { x: 5, y: 5 }, { creationReason: 'clone' })!;
        clone.hp = 1; clone.state = MonsterState.ASLEEP;
        const amount = component<GrowthReward>(game, clone.id, 'reward').amount;
        game.executeCommand('move', { x: 1, y: 0 }); finish(game);
        expect(clone.hp).toBe(0); expect(state(game).rewardReceipts).toContain(`birth:${clone.id}`);
        expect(component<GrowthProgression>(game, game.player.id, 'progression').experience).toBe(rewards && eligible ? amount : 0);
        expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
    });
    it.each([false, true])('keeps explicit ally points untouched until an actual level gain, capped=%s', capped => {
        configured(pack => {
            pack.config.levels.experience = { kind: 'curve', base: 100, linear: 0, quadratic: 0 };
            if (capped) pack.config.levels.cap = 4;
            pack.config.monsters.templates[1]!.experience = experienceThreshold(pack.config.levels, 4);
            pack.config.monsters.templates[1]!.unspentAttributePoints = 2;
            pack.config.monsters.templates[1]!.unspentSkillPoints = 0;
            pack.config.experience.allySplit.playerBasisPoints = 0;
        });
        const game = scene(), ally = spawn(game, 'goblin', 7, true), target = spawn(game, 'rat', 8);
        ally.hp = 10; target.hp = 1; target.state = MonsterState.ASLEEP;
        const before = component<GrowthProgression>(game, ally.id, 'progression'), revision = state(game).revision, hp = ally.hp;
        game.executeCommand('template-runtime-fixture', undefined, () => {
            const result = CombatSystem.attack(ally, target, { grid: game.grid }); expect(result.hit).toBe(true);
            if (target.hp <= 0) game.killMonster(target);
        });
        const next = component<GrowthProgression>(game, ally.id, 'progression');
        expect(next.level).toBe(before.level); expect(next.attributePoints).toBe(2);
        expect(component<GrowthAttributes>(game, ally.id, 'attributes').allocated[con]).toBe(0);
        expect(component<GrowthDerived>(game, ally.id, 'derived').appliedMaxHp).toBe(8);
        expect(ally.maxHp).toBe(species('goblin').hp + 8); expect(ally.hp).toBe(hp);
        expect(state(game).revision).toBe(revision + (capped ? 0 : 1));
        expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
    });
    it.each([
        ['none', 'increase', 13], ['increase', 'none', 11], ['increase', 'increase', 14], ['full', 'none', 24], ['none', 'full', 27],
    ] as const)('applies level HP recovery=%s before automatic allocation HP recovery=%s', (levelHp, allocationHp, expectedHp) => {
        configured(pack => { pack.config.levels.recovery.levelHp = levelHp; pack.config.levels.recovery.allocationHp = allocationHp; });
        replayScene(); const game = newGame(), ally = game.monsters.find(monster => monster.isAlly)!;
        expect(ally.hp).toBe(10); expect(ally.maxHp).toBe(species('goblin').hp + 8);
        game.executeCommand('wait'); finish(game);
        expect(component<GrowthProgression>(game, ally.id, 'progression').level).toBe(6);
        expect(component<GrowthAttributes>(game, ally.id, 'attributes').allocated[con]).toBe(1);
        expect(ally.maxHp).toBe(species('goblin').hp + 12); expect(ally.hp).toBe(expectedHp);
        expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
    });
    it('genuine ally melee XP buys the public build once, preserves wounds and round-trips replay, seek and save continuation', () => {
        configured(); replayScene(); const game = newGame();
        const ally = game.monsters.find(monster => monster.isAlly)!, target = game.monsters.find(monster => !monster.isAlly)!;
        const old = component<GrowthProgression>(game, ally.id, 'progression'), hp = ally.hp;
        const focus = component<GrowthFocus>(game, ally.id, 'focus'), skills = component<GrowthSkills>(game, ally.id, 'skills');
        const attack = vi.spyOn(CombatSystem, 'attack');
        game.executeCommand('wait'); finish(game);
        expect(attack.mock.calls.some(([attacker, defender]) => attacker.id === ally.id && defender.id === target.id)).toBe(true);
        expect(target.hp).toBe(0); expect(state(game).rewardReceipts).toContain(`birth:${target.id}`);
        const next = component<GrowthProgression>(game, ally.id, 'progression'), attributes = component<GrowthAttributes>(game, ally.id, 'attributes');
        expect(next.level).toBe(old.level + 2); expect(next.attributePoints).toBe(0); expect(next.skillPoints).toBe(0);
        expect(attributes.allocated[con]).toBe(1); expect(attributes.allocated['growth.attribute.agility']).toBe(1);
        expect(component<GrowthSkillBuild>(game, ally.id, 'skill-build').active).toEqual(['growth.skill.brace']);
        expect(component<GrowthSkills>(game, ally.id, 'skills')).toEqual(skills); expect(component<GrowthFocus>(game, ally.id, 'focus').current).toBe(focus.current);
        expect(ally.hp).toBe(hp); expect(ally.maxHp).toBe(species('goblin').hp + 12);
        game.executeCommand('wait'); finish(game);
        const saved = game.toSaveSnapshot(), recording = game.exportRecording(), expected = projection(game);
        expect(game.hasCompleteRecording).toBe(true);
        const replay = createHeadlessGame(18392, 'test'); expect(replay.loadReplay(recording)).toBe(true);
        while (replay.replayCursor < recording.events.length && !replay.replayError) replay.replayStep(true);
        expect(replay.replayError).toBeNull(); expect(projection(replay)).toEqual(expected);
        replay.replaySeek(1);
        while (replay.replayCursor < recording.events.length && !replay.replayError) replay.replayStep(true);
        expect(replay.replayError).toBeNull(); expect(projection(replay)).toEqual(expected);
        const loaded = createHeadlessGame(18393, 'test'); expect(loaded.loadSnapshot(saved)).toBe(true); expect(projection(loaded)).toEqual(expected);
        loaded.executeCommand('wait'); finish(loaded);
        const continuation = loaded.exportRecording(), resumed = projection(loaded), check = createHeadlessGame(18394, 'test');
        expect(check.loadReplay(continuation)).toBe(true);
        while (check.replayCursor < continuation.events.length && !check.replayError) check.replayStep(true);
        expect(check.replayError).toBeNull(); expect(projection(check)).toEqual(resumed);
    });
});
