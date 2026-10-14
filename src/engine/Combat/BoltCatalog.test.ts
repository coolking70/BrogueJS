import { describe, expect, it } from 'vitest';
import {
    CEBoltType as T, CEBoltEffect as E,
    CE_BOLT_CATALOG as catalog, resolveCEBoltMagnitude,
} from './BoltCatalog';
import { BoltEffect, BOLT_EFFECT_CE_EFFECT, getBoltConfigs, MONSTER_BOLT_TABLE, KNOWN_GAP_MONSTER_BOLT_NAMES } from './Bolt';
import { rng } from '../Random';

const members = (value: object) => Object.keys(value).filter(key => Number.isNaN(Number(key)));

describe('W-1 CE catalog contract (source rows, not execution coverage)', () => {






    it('web dispatch aliases preserve ATTACK versus DAMAGE and append type-only POLYMORPH/PLENTY without renumbering', () => {
        const oldNames = 'NONE FIRE LIGHTNING POISON TELEPORT SLOW HEALING HASTE TUNNELING BECKONING DISCORD CONJURATION SHIELDING NEGATION DOMINATION ENTRANCEMENT BLINKING OBSTRUCTION EMPOWERMENT INVISIBILITY SPARK DRAGONFIRE DISTANCE_ATTACK POISON_DART'.split(' ');
        oldNames.forEach((name, index) => expect(BoltEffect[name as keyof typeof BoltEffect]).toBe(index));
        expect(BoltEffect.POLYMORPH).toBe(24);
        expect(BoltEffect.PLENTY).toBe(25);
        expect(Object.keys(BOLT_EFFECT_CE_EFFECT)).toHaveLength(26);
        for (const name of members(BoltEffect)) {
            const canonical = ['FIRE', 'LIGHTNING', 'SPARK', 'DRAGONFIRE'].includes(name) ? 'DAMAGE'
                : ['DISTANCE_ATTACK', 'POISON_DART'].includes(name) ? 'ATTACK' : name;
            expect(BOLT_EFFECT_CE_EFFECT[BoltEffect[name as keyof typeof BoltEffect]]).toBe(E[canonical as keyof typeof E]);
        }
        expect(MONSTER_BOLT_TABLE.SLOW_2!.effect).toBe(BoltEffect.SLOW);
        expect(catalog[T.SLOW_2].magnitude).toBe(2);
        expect(catalog[T.SLOW].magnitude).toBe(10);
    });

    it('CE magnitude records source and consumer units, never charges, computed damage or legacy defaults', () => {
        const before = rng.randomNumbersGenerated;
        for (const enchantment of [0, 2, 8]) {
            expect(resolveCEBoltMagnitude(T.FIRE, { kind: 'staff', enchantment })).toEqual({ source: 'staff', value: enchantment, use: 'staff-damage' });
        }
        expect(resolveCEBoltMagnitude(T.SLOW, { kind: 'wand' })).toEqual({ source: 'wand', value: 10, use: 'slow-duration' });
        expect(resolveCEBoltMagnitude(T.SLOW_2, { kind: 'monster' })).toEqual({ source: 'monster', value: 2, use: 'slow-duration' });
        expect(resolveCEBoltMagnitude(T.FIRE, { kind: 'catalog' })).toEqual({ source: 'catalog', value: 4, use: 'staff-damage' });
        expect(resolveCEBoltMagnitude(T.DISTANCE_ATTACK, { kind: 'monster' }).use).toBe('unused-by-effect');
        expect(resolveCEBoltMagnitude(T.SHIELDING, { kind: 'staff', enchantment: 2 }).use).toBe('shielding-tenths-hp');
        expect(getBoltConfigs().map(b => b.magnitude)).toEqual([0, 0, 10, 10, 10, 0, 10, 0, 0, 5, 8, 10, 6, 4, 2, 2, 2, 2, 2, 3, 8, 0, 2, 0]);
        expect(rng.randomNumbersGenerated).toBe(before);
    });

    it('the 15 native entries retain their projections, plus U09 learnable identities and CE forbidden exceptions', () => {
        expect(Object.keys(MONSTER_BOLT_TABLE)).toEqual('SHIELDING HASTE SPARK DISTANCE_ATTACK HEALING BLINKING NEGATION DISCORD POISON_DART FIRE DRAGONFIRE BECKONING SLOW_2 SPIDERWEB ANCIENT_SPIRIT_VINES TELEPORT SLOW POLYMORPH DOMINATION INVISIBILITY LIGHTNING POISON ENTRANCEMENT CONJURATION TUNNELING OBSTRUCTION'.split(' '));
        expect(Object.values(MONSTER_BOLT_TABLE).map(({ targetAllies, targetEnemies, fiery, magnitude }) => [targetAllies, targetEnemies, fiery, magnitude])).toEqual([
            [true,false,false,5], [true,false,false,2], [false,true,false,1], [false,true,false,1],
            [true,false,false,5], [false,false,false,5], [false,true,false,10], [false,true,false,10],
            [false,true,false,1], [false,true,true,4], [false,true,true,18], [false,true,false,10],
            [false,true,false,2], [false,true,false,10], [false,true,false,5],
            [false,true,false,10], [false,true,false,10], [false,true,false,10], [false,true,false,10],
            [true,false,false,10], [false,true,false,10], [false,true,false,10], [false,true,false,10],
            [false,true,false,10], [false,false,false,10], [false,false,false,10],
        ]);
        expect(KNOWN_GAP_MONSTER_BOLT_NAMES).toEqual([]);
        for (const name of ['SPIDERWEB', 'ANCIENT_SPIRIT_VINES']) expect(MONSTER_BOLT_TABLE[name]!.effect).toBe(BoltEffect.NONE);
        expect(MONSTER_BOLT_TABLE.POLYMORPH!.effect).toBe(BoltEffect.POLYMORPH);
        for (const name of ['PLENTY', 'WHIP']) expect(MONSTER_BOLT_TABLE[name]).toBeUndefined();
    });
});
