import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { markCreatureBirth } from '../ext/birth';
import { ExtensionRegistry } from '../ext/registry';
import * as catalog from '../ext/catalog';
import data from '../ext/modules/growth/definitions.json';
import type { GrowthDefinitionPack } from '../ext/modules/growth/types';
import type { GrowthDerived, GrowthProgression } from '../ext/modules/growth/components';
import { parseGrowthDefinitionPack } from '../ext/modules/growth/definitions';
import { createGrowthGameplay } from '../ext/modules/growth/module';
import { extensionDataFingerprint } from '../ext/fingerprint';

afterEach(() => vi.restoreAllMocks());
describe('EXT-1b copied native overhealth', () => {
    it('sheds copied automatic maximum once while retaining native overhealth through clone and load', () => {
        const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
        pack.config.levels.experience = { kind: 'curve', base: 1, linear: 0, quadratic: 0 };
        const parsed = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
        const identity = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
        vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
            const registry = new ExtensionRegistry();
            registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(parsed, identity), identity); return registry;
        });
        const game = createHeadlessGame(1907, 'test');
        game.startNewGame({ seed: 1907, mode: 'test', ruleSet: 'extended' });
        game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action: 'create-character', payload: { revision: 0 } }));
        game.clearRecording(); game.monsters = []; game.dormantMonsters = [];
        const species = (monsters as MonsterData[]).find(row => row.id === 'goblin')!;
        const source = new Monster(4, 4, species), victim = new Monster(6, 4, (monsters as MonsterData[]).find(row => row.id === 'rat')!);
        markCreatureBirth(source, 'natural'); markCreatureBirth(victim, 'natural'); game.monsters.push(source, victim);
        const runtime = game.extensionRuntime!, origin = runtime.causality.create('melee', source.id, source.id, source.extensionHooks!.partyId(source));
        runtime.causality.withOrigin(origin, () => game.killMonster(victim));
        game.executeCommand('clone-overhealth-fixture', undefined, () => undefined);
        const oldBonus = (runtime.snapshot().components[source.id]!['growth:derived'] as GrowthDerived).appliedMaxHp;
        expect(oldBonus).toBeGreaterThan(0); source.hp = source.maxHp + 10;
        const sourceHp = source.hp, sourceMax = source.maxHp;
        const clone = game.cloneMonster(source, { x: 5, y: 4 }, { creationReason: 'clone' })!;
        expect(clone).not.toBeNull(); expect(clone.maxHp).toBe(species.hp); expect(clone.hp).toBe(species.hp + 10);
        expect(source.hp).toBe(sourceHp); expect(source.maxHp).toBe(sourceMax);
        expect((runtime.snapshot().components[clone.id]!['growth:derived'] as GrowthDerived).appliedMaxHp).toBe(0);
        expect((runtime.snapshot().components[clone.id]!['growth:progression'] as GrowthProgression).level).toBe(1);
        game.executeCommand('clone-overhealth-fixture', undefined, () => undefined);
        const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true);
        const restored = game.monsters.find(actor => actor.id === clone.id)!;
        expect(restored.hp).toBe(species.hp + 10); expect(restored.maxHp).toBe(species.hp);
    });
});
