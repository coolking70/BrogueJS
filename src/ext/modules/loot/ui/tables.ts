import type { ItemClass, ModifierSpec } from '../types';
import type { LootPickupFilterDraft, LootTextRef } from './types';
import { freezeLootUi } from './errors';

export interface LootUiStatDefinition { readonly stat: string; readonly unit: ModifierSpec['unit']; readonly nameKey: string; readonly better: 'higher' | 'lower' }
export const LOOT_UI_STATS: readonly LootUiStatDefinition[] = freezeLootUi([
  { stat: 'loot.local.damage', unit: 'bp', nameKey: 'ext.loot.ui.stat.loot-local-damage', better: 'higher' },
  { stat: 'loot.local.damage', unit: 'int', nameKey: 'ext.loot.ui.stat.loot-local-damage', better: 'higher' },
  { stat: 'native.weapon-enchant', unit: 'int', nameKey: 'ext.loot.ui.stat.native-weapon-enchant', better: 'higher' },
  { stat: 'native.physical-damage-dealt', unit: 'bp', nameKey: 'ext.loot.ui.stat.native-physical-damage-dealt', better: 'higher' },
  { stat: 'loot.local.armor', unit: 'bp', nameKey: 'ext.loot.ui.stat.loot-local-armor', better: 'higher' },
  { stat: 'native.defense', unit: 'display-armor', nameKey: 'ext.loot.ui.stat.native-defense', better: 'higher' },
  { stat: 'native.physical-damage-taken', unit: 'bp', nameKey: 'ext.loot.ui.stat.native-physical-damage-taken', better: 'lower' },
  { stat: 'native.light', unit: 'ring-point', nameKey: 'ext.loot.ui.stat.native-light', better: 'higher' },
  { stat: 'native.accuracy', unit: 'bp', nameKey: 'ext.loot.ui.stat.native-accuracy', better: 'higher' },
  { stat: 'native.attack-speed', unit: 'bp', nameKey: 'ext.loot.ui.stat.native-attack-speed', better: 'lower' },
  { stat: 'native.max-hp', unit: 'int', nameKey: 'ext.loot.ui.stat.native-max-hp', better: 'higher' },
  { stat: 'native.regeneration', unit: 'ring-point', nameKey: 'ext.loot.ui.stat.native-regeneration', better: 'higher' },
  { stat: 'native.strength', unit: 'int', nameKey: 'ext.loot.ui.stat.native-strength', better: 'higher' },
  { stat: 'native.stealth-range', unit: 'ring-point', nameKey: 'ext.loot.ui.stat.native-stealth-range', better: 'higher' },
  { stat: 'native.awareness', unit: 'ring-point', nameKey: 'ext.loot.ui.stat.native-awareness', better: 'higher' },
  { stat: 'native.clairvoyance', unit: 'ring-point', nameKey: 'ext.loot.ui.stat.native-clairvoyance', better: 'higher' },
  { stat: 'native.wisdom', unit: 'ring-point', nameKey: 'ext.loot.ui.stat.native-wisdom', better: 'higher' },
  { stat: 'native.resist.fire', unit: 'bp', nameKey: 'ext.loot.ui.stat.native-resist-fire', better: 'higher' },
  { stat: 'native.resist.poison', unit: 'bp', nameKey: 'ext.loot.ui.stat.native-resist-poison', better: 'higher' },
  { stat: 'native.transference', unit: 'ring-point', nameKey: 'ext.loot.ui.stat.native-transference', better: 'higher' },
  { stat: 'native.reaping', unit: 'ring-point', nameKey: 'ext.loot.ui.stat.native-reaping', better: 'higher' },
  { stat: 'loot.rarity-find', unit: 'bp', nameKey: 'ext.loot.ui.stat.loot-rarity-find', better: 'higher' },
  { stat: 'combat.stamina-capacity', unit: 'int', nameKey: 'ext.loot.ui.stat.combat-stamina-capacity', better: 'higher' },
  { stat: 'combat.poise-capacity', unit: 'int', nameKey: 'ext.loot.ui.stat.combat-poise-capacity', better: 'higher' },
  { stat: 'combat.stamina-regen', unit: 'bp', nameKey: 'ext.loot.ui.stat.combat-stamina-regen', better: 'higher' },
  { stat: 'growth.focus-capacity', unit: 'int', nameKey: 'ext.loot.ui.stat.growth-focus-capacity', better: 'higher' },
  { stat: 'growth.attribute:{attribute}', unit: 'int', nameKey: 'ext.loot.ui.stat.growth-attribute', better: 'higher' },
  { stat: 'growth.xp-gain', unit: 'bp', nameKey: 'ext.loot.ui.stat.growth-xp-gain', better: 'higher' },
  { stat: 'combat.poise-recovery', unit: 'bp', nameKey: 'ext.loot.ui.stat.combat-poise-recovery', better: 'higher' },
  { stat: 'native.runic-power', unit: 'runic-strength', nameKey: 'ext.loot.ui.stat.native-runic-power', better: 'higher' },
  { stat: 'native.armor-runic-power', unit: 'runic-strength', nameKey: 'ext.loot.ui.stat.native-armor-runic-power', better: 'higher' },
  { stat: 'loot.ring-implicit', unit: 'ring-point', nameKey: 'ext.loot.ui.stat.loot-ring-implicit', better: 'higher' },
  { stat: 'native.defense', unit: 'int', nameKey: 'ext.loot.ui.stat.native-defense', better: 'higher' },
]);

export const LOOT_UI_BASE_NAMES = freezeLootUi([
  { baseId: 'dagger', nameKey: "name.Dagger" },
  { baseId: 'whip', nameKey: "name.Whip" },
  { baseId: 'spear', nameKey: "name.Spear" },
  { baseId: 'rapier', nameKey: "name.Rapier" },
  { baseId: 'sword', nameKey: "name.Sword" },
  { baseId: 'mace', nameKey: "name.Mace" },
  { baseId: 'axe', nameKey: "name.Axe" },
  { baseId: 'flail', nameKey: "name.Flail" },
  { baseId: 'broadsword', nameKey: "name.Broadsword" },
  { baseId: 'war_pike', nameKey: "name.War Pike" },
  { baseId: 'war_hammer', nameKey: "name.War Hammer" },
  { baseId: 'war_axe', nameKey: "name.War Axe" },
  { baseId: 'leather_armor', nameKey: "name.Leather Armor" },
  { baseId: 'scale_mail', nameKey: "name.Scale Mail" },
  { baseId: 'chain_mail', nameKey: "name.Chain Mail" },
  { baseId: 'banded_mail', nameKey: "name.Banded Mail" },
  { baseId: 'splint_mail', nameKey: "name.Splint Mail" },
  { baseId: 'plate_mail', nameKey: "name.Plate Mail" },
  { baseId: 'ring_of_clairvoyance', nameKey: "name.Ring of Clairvoyance" },
  { baseId: 'ring_of_stealth', nameKey: "name.Ring of Stealth" },
  { baseId: 'ring_of_regeneration', nameKey: "name.Ring of Regeneration" },
  { baseId: 'ring_of_transference', nameKey: "name.Ring of Transference" },
  { baseId: 'ring_of_light', nameKey: "name.Ring of Light" },
  { baseId: 'ring_of_awareness', nameKey: "name.Ring of Awareness" },
  { baseId: 'ring_of_wisdom', nameKey: "name.Ring of Wisdom" },
  { baseId: 'ring_of_reaping', nameKey: "name.Ring of Reaping" },
]);

export const LOOT_UI_RUNICS = freezeLootUi([
  { runicType: 'absorption', nameKey: 'runic.name.absorption' },
  { runicType: 'burden', nameKey: 'runic.name.burden' },
  { runicType: 'confusion', nameKey: 'runic.name.confusion' },
  { runicType: 'dampening', nameKey: 'runic.name.dampening' },
  { runicType: 'force', nameKey: 'runic.name.force' },
  { runicType: 'immolation', nameKey: 'runic.name.immolation' },
  { runicType: 'immunity', nameKey: 'runic.name.immunity' },
  { runicType: 'mercy', nameKey: 'runic.name.mercy' },
  { runicType: 'multiplicity', nameKey: 'runic.name.multiplicity' },
  { runicType: 'mutuality', nameKey: 'runic.name.mutuality' },
  { runicType: 'paralyzing', nameKey: 'runic.name.paralyzing' },
  { runicType: 'plenty', nameKey: 'runic.name.plenty' },
  { runicType: 'quietus', nameKey: 'runic.name.quietus' },
  { runicType: 'reflection', nameKey: 'runic.name.reflection' },
  { runicType: 'reprisal', nameKey: 'runic.name.reprisal' },
  { runicType: 'respiration', nameKey: 'runic.name.respiration' },
  { runicType: 'slaying', nameKey: 'runic.name.slaying' },
  { runicType: 'slowing', nameKey: 'runic.name.slowing' },
  { runicType: 'speed', nameKey: 'runic.name.speed' },
  { runicType: 'vulnerability', nameKey: 'runic.name.vulnerability' },
]);

export const LOOT_UI_CLASS_GLYPHS = freezeLootUi({ weapon: ')', armor: ']', ring: '=' } as const);

export const LOOT_UI_CLASS_NAMES: Readonly<Record<ItemClass, LootTextRef>> = freezeLootUi({
  weapon: { nameKey: 'ext.loot.ui.name.class-weapon', params: {} },
  armor: { nameKey: 'ext.loot.ui.name.class-armor', params: {} },
  ring: { nameKey: 'ext.loot.ui.name.class-ring', params: {} },
});

/** Initial integration defaults; review with the future set-filter command. */
export const LOOT_UI_FILTER_DEFAULTS: Readonly<Record<string, LootPickupFilterDraft>> = freezeLootUi({
  scarce: { v: 1, minRarity: 'normal', classes: ['weapon', 'armor', 'ring'], autoPickupGold: true },
  standard: { v: 1, minRarity: 'magic', classes: ['weapon', 'armor', 'ring'], autoPickupGold: true },
  bountiful: { v: 1, minRarity: 'magic', classes: ['weapon', 'armor', 'ring'], autoPickupGold: true },
});
