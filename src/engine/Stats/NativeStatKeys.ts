import type { StatKeyDeclaration } from '../../ext/stats';

const categories = ['override', 'flat', 'increased', 'more', 'clamp'] as const;
/** Bounds are foundation data, not inferred from CE at runtime. */
function key(
  id: string,
  unit: string,
  minimum: number,
  maximum: number,
  rounding: StatKeyDeclaration['rounding'] = 'floor',
  kind: StatKeyDeclaration['kind'] = 'query'
): StatKeyDeclaration {
  return {
    id: `native.${id}`,
    owner: 'native',
    unit,
    kind,
    minimum,
    maximum,
    rounding,
    categories,
    increased: { minimum: -9000, maximum: 50000 },
    moreSlots: [
      { id:'growth.slot.final',minimum:id==='attack-speed'||id==='move-speed'?-5000:-10000,maximum:30000 },
      ...['native','equipment','character','temporary','environment'].map(slot=>({id:slot,minimum:id==='attack-speed'||id==='move-speed'?-5000:0,maximum:40000}))
    ]
  };
}
export const NATIVE_STAT_KEYS: readonly StatKeyDeclaration[] = Object.freeze([
  { ...key('regeneration', 'HP/turn rational', 0, 1_000_000), rational: true },
  key('regeneration-bonus', 'ring enchant', -1_000_000, 1_000_000),
  key('weapon-enchant', 'quarter enchant', -800, 2000),
  key('armor-enchant', 'quarter enchant', -800, 2000),
  key('accuracy', 'accuracy', 0, 1_000_000),
  key('hit-chance', 'bp', 500, 9500),
  key('defense', 'tenth defense', 0, 1_000_000),
  key('evasion', 'bp', 0, 10000),
  key('damage-min', 'HP', 0, 1_000_000),
  key('damage-max', 'HP', 0, 1_000_000),
  key('physical-damage-dealt', 'HP', 0, 1_000_000, 'floor'),
  key('physical-damage-taken', 'HP', 0, 1_000_000, 'floor'),
  key('strength', 'strength', 1, Number.MAX_SAFE_INTEGER, 'floor', 'materialized'),
  key('effective-strength', 'strength', -1_000_000, 1_000_000),
  key('max-hp', 'HP', 1, Number.MAX_SAFE_INTEGER, 'floor', 'materialized'),
  key('stealth-range', 'tile', 1, 1_000_000, 'floor'),
  key('search-strength', 'search strength', 0, 1_000_000, 'floor'),
  key('awareness', 'search strength', -1_000_000, 1_000_000),
  key('clairvoyance', 'ring enchant', -1_000_000, 1_000_000),
  key('light', 'light multiplier', -1_000_000, 1_000_000),
  key('reaping', 'ring enchant', -1_000_000, 1_000_000),
  key('transference', 'ring enchant', -1_000_000, 1_000_000),
  key('wisdom', 'ring enchant', -1_000_000, 1_000_000),
  key('attack-speed', 'tick', 25, 400),
  key('move-speed', 'tick', 1, 1_000_000),
  key('runic-power', 'quarter enchant', -800, 2000),
  key('armor-runic-power', 'quarter enchant', -800, 2000),
  ...['physical', 'fire', 'poison', 'other'].map((kind) => key(`resist.${kind}`, 'bp', 0, 7500))
]);
export const NATIVE_STAT_DAG: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'native.regeneration': ['native.regeneration-bonus'],
  'native.effective-strength': ['native.strength'],
  'native.weapon-enchant': ['native.effective-strength'],
  'native.armor-enchant': ['native.effective-strength'],
  'native.accuracy': ['native.weapon-enchant'],
  'native.defense': ['native.armor-enchant'],
  'native.damage-min': ['native.weapon-enchant'],
  'native.damage-max': ['native.weapon-enchant'],
  'native.runic-power': ['native.weapon-enchant'],
  'native.armor-runic-power': ['native.armor-enchant']
});
