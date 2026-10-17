import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import definitions from '../data/definitions.json';
import locale from '../locales/zh_CN.json';
import base from './fixtures/combat2-base.json';
import baseLocale from './fixtures/combat2-base-locale.json';
import { compileCombat2, type Combat2Row } from './support/compileCombat2.mjs';
import { CombatValidationError, loadCombatPack } from '../schema';
import { getCombatPackIdentity, loadCombatDefinitionPack } from '../definitions';
import { createCombatModuleFromPack } from '../module';
import { descriptor } from '../descriptor';
import { combatAttackDefinitions } from '../production';
import { validateProductionActorAttackState } from '../../../actorActionValidation';
import type { CombatPack } from '../types';
import { combatAttackPresentation } from '../ui/attackPresentation';

const task = readFileSync('docs/ext/combat2.dot-package.md', 'utf8');
const extract = (label: string, language: string) => task.match(new RegExp(`<!-- combat2-${label} -->\\s*\x60\x60\x60${language}\\n([\\s\\S]*?)\\n\x60\x60\x60`))![1]!;
export const combat2Rows: Combat2Row[] = JSON.parse(extract('content', 'json'));
const compiled = compileCombat2(base as unknown as CombatPack, baseLocale, combat2Rows);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('C2-DATA authoritative transcription and frozen identity', () => {
    it('uses the exact dispatched compiler and complete original rows', () => {
        expect(readFileSync('src/ext/modules/combat/tests/support/compileCombat2.mjs', 'utf8').trim()).toBe(extract('compiler', 'js').trim());
        expect(definitions).toEqual(compiled.pack);
        for (const [key, value] of Object.entries(compiled.locale)) expect(locale[key as keyof typeof locale]).toBe(value);
        expect(definitions.attacks).toHaveLength(8);
        expect(definitions.profiles).toHaveLength(10);
        expect(definitions.nativeProfiles).toHaveLength(8);
        expect(definitions.resourcePolicies.length + definitions.attacks.length + definitions.profiles.length + definitions.bonfires.definitions.length).toBe(20);
    });
    it('keeps old prefixes, resource/defense/bonfire objects and explicit eight directions', () => {
        expect(definitions.attacks.slice(0, 3)).toEqual(base.attacks);
        expect(definitions.profiles.slice(0, 4)).toEqual(base.profiles);
        expect(definitions.nativeProfiles.slice(0, 3)).toEqual(base.nativeProfiles);
        for (const key of ['resourcePolicies', 'dodge', 'parry', 'bonfires', 'breakRecoveryTicks'] as const) expect(definitions[key]).toEqual(base[key]);
        expect(definitions.playerProfileId).toBe('combat.second-profile');
        expect(definitions.profiles[definitions.profiles.length - 1]!.attackIds).toEqual(definitions.attacks.map(attack => attack.id));
        for (const attack of definitions.attacks) for (const segment of attack.segments) {
            expect(Object.keys(segment.shape.offsets)).toEqual(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']);
            expect(segment).toMatchObject({ locationPolicy: 'locked-world', targetPolicy: 'part', damageProfile: 'native-melee', dodgeable: true, friendlyFire: false });
        }
    });
    it('loads the full schema and production factory with one exact descriptor identity', () => {
        const pack = loadCombatDefinitionPack(), module = createCombatModuleFromPack(pack);
        expect(pack.schema).toBe(1); expect(pack.moduleVersion).toBe('1.6.0'); expect(pack.rulesVersion).toBe('1.6.0');
        expect(module.rules).toEqual(getCombatPackIdentity()); expect(descriptor.rules).toEqual(module.rules);
        expect(module.rules!.fingerprint).toBe('sha256:9c2be4947fa2e080890ad9ca2b6a7aca20197f0ee77648b042fc9194618587ae');
        expect(descriptor.foundation).toBe(20);
        expect(module.initialState()).toMatchObject({ schema: 4 });
        expect(() => validateProductionActorAttackState(module.initialState(), combatAttackDefinitions(pack))).not.toThrow();
        expect(Object.isFrozen(pack)).toBe(true);
    });
    it.each(combat2Rows)('$id has fixed presentation, timing, NPC single profile and original hint', row => {
        const id = `combat.${row.id}`, presentation = combatAttackPresentation(id)!;
        expect(presentation).toEqual({ hintKey: `ext.combat.attack.${row.id}.hint`, windup: row.windup,
            delays: row.segments.map(segment => segment.delay), recovery: row.recovery,
            total: row.windup + row.recovery + row.segments.reduce((sum, segment) => sum + segment.delay, 0) });
        expect(locale[presentation.hintKey as keyof typeof locale]).toBe(row.hint);
        expect(definitions.profiles.find(profile => profile.id === `${id}-profile`)!.attackIds).toEqual([id]);
        expect(definitions.nativeProfiles.find(binding => binding.monsterId === row.monster)!.profileId).toBe(`${id}-profile`);
    });
    it('does not expose timing or a guessed name for a non-attack identity', () => {
        for (const id of ['parry', 'dodge', 'unknown', '__proto__']) expect(combatAttackPresentation(id)).toBeNull();
    });
});

const invalid: [string, (pack: any) => void][] = [
    ['unknown shape', p => { p.attacks[3].segments[0].shape.kind = 'single-ray'; }],
    ['unknown damage', p => { p.attacks[3].segments[0].damageProfile = 'projectile'; }],
    ['damage multiplier', p => { p.attacks[3].segments[0].damage = 10; }],
    ['movement', p => { p.attacks[3].displacement = 2; }],
    ['stance', p => { p.attacks[3].stance = 'counter'; }],
    ['missing direction', p => { delete p.attacks[3].segments[0].shape.offsets.ne; }],
    ['missing cost', p => { delete p.attacks[3].cost; }],
    ['duplicate offset', p => { p.attacks[3].segments[0].shape.offsets.e.push(p.attacks[3].segments[0].shape.offsets.e[0]); }],
    ['duplicate id', p => { p.attacks[3].id = p.attacks[0].id; }],
    ['duplicate NPC', p => { p.nativeProfiles.push(p.nativeProfiles[3]); }],
    ['bad attack reference', p => { p.profiles[4].attackIds = ['combat.missing']; }],
    ['bad profile reference', p => { p.nativeProfiles[3].profileId = 'combat.missing'; }],
    ['total duration', p => { p.attacks[4].windupTicks = 999999; }],
    ['offset budget', p => { p.attacks[3].segments[0].shape.offsets.e = Array.from({ length: 257 }, (_, i) => ({ x: i % 33, y: Math.floor(i / 33) })); }],
    ['segment budget', p => { p.attacks[3].segments = Array.from({ length: 9 }, () => p.attacks[3].segments[0]); }],
    ['fraction', p => { p.attacks[3].cost = 1.5; }],
    ['negative delay', p => { p.attacks[4].segments[1].delayTicks = -1; }],
    ['zero later warning', p => { p.attacks[4].segments[1].delayTicks = 0; }],
    ['unsafe integer', p => { p.attacks[3].windupTicks = Number.MAX_SAFE_INTEGER + 1; }],
    ['unsupported version', p => { p.rulesVersion = '1.7.0'; }],
];
describe('C2-DATA strict negative schema', () => {
    it.each(invalid)('rejects %s without altering the caller input', (_name, mutate) => {
        const raw = clone(definitions); mutate(raw); const before = clone(raw);
        expect(() => loadCombatPack(raw, locale)).toThrow(CombatValidationError);
        expect(raw).toEqual(before);
    });
});

describe('C2-IMPORT module ownership', () => {
    it('has no import or private path access into another content module', () => {
        function scan(path: string) {
            for (const entry of readdirSync(path, { withFileTypes: true })) {
                const file = join(path, entry.name);
                if (entry.isDirectory()) { scan(file); continue; }
                if (!/\.(ts|vue|json|mjs)$/.test(file)) continue;
                const source = readFileSync(file, 'utf8');
                const specifiers = [...source.matchAll(/(?:from\s*|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g)].map(match => match[1]!);
                for (const specifier of specifiers) {
                    expect(specifier, file).not.toMatch(/(?:modules\/|\.\.\/)(?:giants|growth|narrative|crafting|foraging|settlement)(?:\/|$)/);
                }
                if (!file.includes('/tests/')) {
                    expect(source, file).not.toMatch(/import\.meta\.glob|\brequire\s*\(|new\s+Function\s*\(|\beval\s*\(/);
                    expect(source, file).not.toMatch(/modules\/(?:giants|growth|narrative|crafting|foraging|settlement)\//);
                }
            }
        }
        scan('src/ext/modules/combat');
    });
});
