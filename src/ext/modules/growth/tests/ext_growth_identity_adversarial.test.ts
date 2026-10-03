import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game, type GameMode, type HordeEntry } from '../../../../engine/Core/Game';
import { Monster, MonsterState } from '../../../../entities/Monster';
import { DCOLS, DROWS, TerrainType } from '../../../../engine/Map/Grid';
import { rng } from '../../../../engine/Random';
import { createHeadlessGame } from '../../../../test/harness';
import data from '../data/definitions.json';
import type { GrowthDefinitionPack, GrowthIdentity, GrowthModifier, GrowthSkill, GrowthTemplate } from '../types';
import type { GrowthAttributes, GrowthFocus, GrowthSkills } from '../components';
import type { GrowthSkillBuild } from '../skills';
import type { GrowthState } from '../state';
import { parseGrowthDefinitionPack } from '../definitions';
import { experienceThreshold } from '../experience';
import { createGrowthGameplay } from '../module';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { ExtensionRegistry } from '../../../../ext/registry';
import * as catalog from '../../../../ext/catalog';

const con = 'growth.attribute.constitution', will = 'growth.attribute.will';
const close = 'growth.skill.close-guard', brace = 'growth.skill.brace', guard = 'growth.profession.guardian';
const extra = 'growth.skill.adversarial-resources';
// Snapshot export timestamps are presentation metadata, independent of mechanical state.
const stableSnapshot = (game: Game) => ({ ...game.toSnapshot(), savedAt: 0 });
const state = (game: Game) => game.extensionRuntime!.snapshot().modules.growth as unknown as GrowthState;
const component = <T>(game: Game, id: number, name: string) => game.extensionRuntime!.snapshot().components[id]![`growth:${name}`] as T;
function finish(game: Game): void {
    for (let i = 0; i < 200 && game.isAdvancing; i++) game.stepAdvancement();
    expect(game.isAdvancing).toBe(false); expect(game.lastAdvancementError).toBeNull();
}
function configured(change: (pack: GrowthDefinitionPack) => void = () => {}) {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.experience.sources.firstVisits = false;
    pack.config.levels.experience = { kind: 'curve', base: 1, linear: 0, quadratic: 0 };
    const template: GrowthTemplate = { ...structuredClone(pack.config.monsters.templates[0]!), id: 'growth.template.adversarial-guard',
        level: 4, experience: experienceThreshold(pack.config.levels, 4), professionId: guard,
        attributes: [{ attributeId: con, amount: 2 }], skills: [close], passiveSlots: [close], unspentSkillPoints: 1 };
    pack.config.monsters.templates.push(template); pack.config.monsters.defaultTemplateId = template.id;
    change(pack);
    const parsed = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    const rules = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry(); registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(parsed, rules), rules); return registry;
    });
    return parsed;
}
function newGame(): Game {
    const game = createHeadlessGame(18391, 'test'); game.startNewGame({ seed: 18391, mode: 'test', ruleSet: 'extended',
        initialCommands: [JSON.stringify({ module: 'growth', action: 'create-character', payload: { revision: 0 } })] });
    finish(game); return game;
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
    game.executeCommand('identity-adversarial-fixture', undefined, () => undefined); return game;
}
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
function modifier(port: GrowthModifier['port'], amount: number): GrowthModifier {
    return { kind: 'modifier', port, operation: 'add', slot: null,
        magnitude: { source: { kind: 'constant' }, coefficient: amount, divisor: 1, rounding: 'floor', min: amount, max: amount }, conditions: [] };
}
const selectedCreation = () => JSON.stringify({ module: 'growth', action: 'create-character', payload: {
    revision: 0, professionId: guard, lineageId: 'growth.lineage.stoneborn', faithId: 'growth.faith.unaffiliated', choices: [],
} });
function nativeBoundary(resource: 'maxHp' | 'strength', amount: number): void {
    configured(pack => {
        pack.config.monsters.defaultTemplateId = pack.config.monsters.templates[0]!.id;
        pack.config.attributes.forEach(attribute => { attribute.effects = []; });
        const port = resource === 'maxHp' ? 'maxHpBonus' : 'strengthBonus';
        pack.config.rules.ports[port].globalClamp.max = Number.MAX_SAFE_INTEGER;
        pack.config.rules.budgets.find(budget => budget.id === pack.config.rules.ports[port].budgetId)!.max = Number.MAX_SAFE_INTEGER;
        (pack.definitions.find(definition => definition.id === guard) as GrowthIdentity).effects.push(modifier(port, amount));
    });
}
afterEach(() => vi.restoreAllMocks());

describe('EXT-1e independent native creation arithmetic regressions', () => {
    // Independent CE/native expectations, rather than reusing the preflight's exported bases.
    const modes: { mode: GameMode; maxHp: number; strength: number }[] = [
        { mode: 'normal', maxHp: 30, strength: 12 }, { mode: 'easy', maxHp: 45, strength: 14 }, { mode: 'wizard', maxHp: 999, strength: 18 },
    ];
    const rows = modes.flatMap(native => (['maxHp', 'strength'] as const).flatMap(resource => [false, true].map(overflow => ({ ...native, resource, overflow }))));
    it.each(rows)('$mode $resource overflow=$overflow accepts exact safe totals and rejects before replacing a run', ({ mode, resource, overflow, ...native }) => {
        const game = createHeadlessGame(2194, 'test'), player = game.player, random = rng.getState();
        const before = stableSnapshot(game), recording = structuredClone(game.recordedInputEvents);
        nativeBoundary(resource, Number.MAX_SAFE_INTEGER - native[resource] + (overflow ? 1 : 0));
        const start = () => game.startNewGame({ seed: 2195, mode, ruleSet: 'extended', initialCommands: [selectedCreation()] });
        if (overflow) {
            expect(start).toThrow(); expect(game.player).toBe(player); expect(rng.getState()).toEqual(random);
            expect(stableSnapshot(game)).toEqual(before); expect(game.recordedInputEvents).toEqual(recording);
        } else {
            expect(start).not.toThrow(); expect(game.player[resource]).toBe(Number.MAX_SAFE_INTEGER);
            const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true);
            expect(game.extensionRuntime!.snapshot()).toEqual(saved.extensions);
        }
    });
    it.each(['maxHp', 'strength'] as const)('rejects standalone %s overflow before mechanical or recording mutation', resource => {
        nativeBoundary(resource, Number.MAX_SAFE_INTEGER);
        const game = createHeadlessGame(2196, 'test'); game.startNewGame({ seed: 2196, mode: 'test', ruleSet: 'extended' });
        const before = stableSnapshot(game), random = rng.getState(), recording = structuredClone(game.recordedInputEvents);
        expect(game.hasCompleteRecording).toBe(true);
        expect(() => game.executeCommand('ext:command', selectedCreation())).not.toThrow();
        const after = stableSnapshot(game);
        // The existing rejected-command diagnostic is expected; all other logger and mechanical state stays exact.
        expect(after.run.logger).toEqual({ ...before.run.logger, nextId: before.run.logger.nextId + 1,
            messages: [...before.run.logger.messages, expect.objectContaining({ id: before.run.logger.nextId, color: '#ff6666', count: 1, turn: 0 })] });
        expect({ ...after, run: { ...after.run, logger: before.run.logger } }).toEqual(before);
        expect(rng.getState()).toEqual(random);
        expect(game.recordedInputEvents).toEqual(recording); expect(game.hasCompleteRecording).toBe(true); expect(state(game).created).toBe(false);
    });
});

describe('EXT-1e independent inherited native HP regressions', () => {
    it.each([[18, 18], [23, 21], [28, 26]] as const)('clones source HP%s to HP%s with final-cap clamping and existing overhealth exactly once', (hp, expected) => {
        configured(); const game = scene(), source = spawn(game); source.hp = hp;
        expect(source.maxHp).toBe(23);
        const clone = game.cloneMonster(source, { x: 8, y: 5 }, { creationReason: 'clone' })!;
        expect(clone.maxHp).toBe(21); expect(clone.hp).toBe(expected); expect(source.hp).toBe(hp); expect(source.maxHp).toBe(23);
        const second = game.cloneMonster(clone, { x: 9, y: 5 }, { creationReason: 'clone' })!;
        expect(second.maxHp).toBe(21); expect(second.hp).toBe(expected);
        game.executeCommand('identity-adversarial-fixture', undefined, () => undefined);
        const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true);
        expect(game.extensionRuntime!.snapshot()).toEqual(saved.extensions);
        expect(game.monsters.find(monster => monster.id === clone.id)!.hp).toBe(expected);
    });
});

describe('EXT-1e separate level, attribute, and passive-equipment resource recovery', () => {
    const rows = [
        { level: 'none', allocation: 'increase', preserve: true, hp: 13, focus: 3 },
        { level: 'none', allocation: 'full', preserve: true, hp: 27, focus: 9 },
        { level: 'increase', allocation: 'none', preserve: true, hp: 11, focus: 2 },
        { level: 'full', allocation: 'increase', preserve: true, hp: 27, focus: 9 },
        { level: 'none', allocation: 'none', preserve: false, hp: 10, focus: 11 },
        { level: 'none', allocation: 'increase', preserve: false, hp: 13, focus: 11 },
    ] as const;
    it.each(rows)('level=$level allocation=$allocation preserveEquip=$preserve gives HP$hp/focus$focus', ({ level, allocation, preserve, hp, focus }) => {
        configured(pack => {
            const guardian = pack.definitions.find(definition => definition.id === guard) as GrowthIdentity;
            guardian.recommendedAttributes = [con, will]; guardian.recommendedSkills = [extra];
            const skill: GrowthSkill = { ...structuredClone(pack.definitions.find(definition => definition.id === close) as GrowthSkill),
                id: extra, cost: 1, prerequisites: [], effects: [modifier('maxHpBonus', 5), modifier('focusCapacity', 2)] };
            pack.definitions.push(skill); pack.config.skills.activeSlots = 1; pack.config.skills.passiveSlots = 2;
            const willCapacity = pack.config.attributes.find(attribute => attribute.id === will)!.effects.find(effect => effect.port === 'focusCapacity')!;
            willCapacity.magnitude.divisor = 1;
            Object.assign(pack.config.monsters.templates[1]!, { skills: [close, brace], activeSlots: [brace] });
            Object.assign(pack.config.levels.recovery, { levelHp: level, allocationHp: allocation, levelFocus: level, allocationFocus: allocation });
            pack.config.skills.equipPreservesFocus = preserve; pack.config.skills.equipPreservesCooldowns = preserve;
            pack.config.focus.recoveryInterval = 1000;
        });
        replayScene(); const game = newGame(), allyId = game.monsters.find(monster => monster.isAlly)!.id;
        // A wounded, exhausted ally is a valid imported state; NPC active-skill AI is intentionally not implemented.
        game.clearRecording(); const exhausted = game.toSaveSnapshot();
        (exhausted.extensions!.components[allyId]!['growth:focus'] as unknown as GrowthFocus).current = 2;
        (exhausted.extensions!.components[allyId]!['growth:skills'] as unknown as GrowthSkills).readyAt[brace] = 100;
        expect(game.loadSnapshot(exhausted)).toBe(true);
        const ally = game.monsters.find(monster => monster.id === allyId)!;
        expect(ally.hp).toBe(10); expect(ally.maxHp).toBe(23);
        game.executeCommand('wait'); finish(game);
        expect(component<GrowthSkillBuild>(game, allyId, 'skill-build').passive).toContain(extra);
        expect(component<GrowthAttributes>(game, allyId, 'attributes').allocated).toMatchObject({ [con]: 1, [will]: 1 });
        expect(ally.maxHp).toBe(32); expect(ally.hp).toBe(hp);
        expect(component<GrowthFocus>(game, allyId, 'focus').current).toBe(focus);
        expect(component<GrowthSkills>(game, allyId, 'skills').readyAt[brace]).toBe(preserve ? 100 : 0);
        const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true);
        expect(game.extensionRuntime!.snapshot()).toEqual(saved.extensions);
    });
});
