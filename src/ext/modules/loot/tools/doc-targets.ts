/** Independently transcribed documentation targets. These are evidence, never tuning inputs. */
export const PRESET_IDS = ['scarce', 'standard', 'bountiful'] as const;
export type StatsPresetId = typeof PRESET_IDS[number];
export const RARITY_IDS = ['normal', 'magic', 'rare', 'unique'] as const;
export const CHECKPOINT_DEPTHS = [1, 5, 10, 15, 20, 26] as const;

// v1.1 B3: retain printed precision, including trailing .0, independently of JSON rules.
export function rarityTolerancePp(printed: string): number {
  return .5 * 10 ** -(printed.split('.')[1]?.length ?? 0);
}
function rarityRow(ilvl: number, ordinary: string, elite: string | null) {
  const values = (text: string) => text.split('/').map(Number);
  const tolerances = (text: string) => text.split('/').map(rarityTolerancePp);
  return { ilvl, ordinary: values(ordinary), elite: elite === null ? null : values(elite),
    tolerancePp: { ordinary: tolerances(ordinary), elite: elite === null ? null : tolerances(elite) } };
}
// phase6-loot-numbers.md §6: percentages exactly as printed; elite ilvl15/30 were not published.
export const RARITY_TARGETS = {
  scarce: [
    rarityRow(1, '85/12/2.7/0.3', '79/17/3.7/0.4'),
    rarityRow(15, '83/13.5/3.2/0.3', null),
    rarityRow(30, '81/15/3.7/0.4', null),
    rarityRow(39, '80/15.6/4.0/0.4', '73/21/5.4/0.5'),
  ],
  standard: [
    rarityRow(1, '70/22/7.1/1.0', '61/29/9.2/1.3'),
    rarityRow(15, '65/25/8.9/1.2', null),
    rarityRow(30, '60/27.5/10.5/1.5', null),
    rarityRow(39, '58/29/11.5/1.6', '48/36/14/1.9'),
  ],
  bountiful: [
    rarityRow(1, '48/33/16/3.0', '38/39/19/3.5'),
    rarityRow(15, '41/35/20/3.7', null),
    rarityRow(30, '36/36/23/4.3', null),
    rarityRow(39, '34/37/24.5/4.6', '25.5/42/28/5.2'),
  ],
};

export interface LayerTarget {
  depth: number; items: number; kill: number; floor: number; vault: number; encounter: number;
  normal: number; magic: number; rare: number; unique: number; cumulative: number; killGold: number; nativeFloorGold: number;
}
const layer = (depth: number, items: number, sources: [number, number, number, number], rarity: [number, number, number, number], cumulative: number, killGold: number, nativeFloorGold: number): LayerTarget => ({
  depth, items, kill: sources[0], floor: sources[1], vault: sources[2], encounter: sources[3],
  normal: rarity[0], magic: rarity[1], rare: rarity[2], unique: rarity[3], cumulative, killGold, nativeFloorGold,
});
// phase6-loot-numbers.md §10.1 v1.1: all 15 rows; rare is net rare, unique is pre-downgrade opportunity. Parenthesized gold is native context, not simulated.
// M3-A: bountiful D10/20/26 items/kill/composition/cumulative re-baselined to v1.1 seed1–300, rounded as §10.1.
// These accepted scale targets are observed evidence, not an independent balance prediction.
export const LAYER_TARGETS: Record<StatsPresetId, LayerTarget[]> = {
  scarce: [
    layer(1, 1.6, [.22, 1.07, .31, 0], [1.10, .38, .10, .007], 1.6, 13, 122),
    layer(5, 2.1, [.5, .73, .29, .53], [1.05, .82, .19, .010], 9.4, 57, 330),
    layer(10, 3.0, [.9, .75, .28, 1], [1.40, 1.21, .33, .020], 22, 149, 680),
    layer(20, 4.1, [2, .77, .34, 1], [2.06, 1.64, .38, .027], 58, 615, 2080),
    layer(26, 4.1, [3.1, .71, .31, 0], [2.80, 1, .30, .020], 81, 1201, 2560),
  ],
  standard: [
    layer(1, 1.7, [.37, 1.08, .29, 0], [1, .53, .21, .017], 1.7, 26, 122),
    layer(5, 3, [1.1, .74, .30, .97], [1.06, 1.05, .80, .113], 12, 115, 330),
    layer(10, 5, [1.9, .77, .30, 2], [1.71, 1.64, 1.43, .213], 33, 271, 680),
    layer(20, 7.4, [4.4, .75, .29, 2], [2.44, 2.87, 1.91, .237], 97, 1184, 2080),
    layer(26, 8.6, [7.5, .78, .34, 0], [3.57, 3.57, 1.25, .163], 145, 2573, 2560),
  ],
  bountiful: [
    layer(1, 2.1, [.74, 1.07, .26, 0], [.86, .59, .52, .100], 2.1, 40, 122),
    layer(5, 5.1, [2.6, .76, .28, 1.46], [1.39, 1.85, 1.52, .337], 17, 185, 330),
    layer(10, 8.56, [4.52, .73, .30, 3], [1.86, 3.08, 3.13, .483], 51.6, 441, 680),
    layer(20, 15.49, [11.45, .77, .33, 3], [2.92, 6.46, 5.23, .873], 177.4, 1748, 2080),
    layer(26, 21.13, [20.13, .73, .28, 0], [4.09, 9.32, 6.51, 1.220], 296.4, 3801, 2560),
  ],
};
// phase6-loot-numbers.md §10.1, opportunities before base/level/receipt downgrade.
export const UNIQUE_OPPORTUNITY_TARGETS = { scarce: .6, standard: 4.5, bountiful: 14 } as const;
// phase6-loot-numbers.md §9.2, standard columns only; mitigation is percentage points.
export const POWER_TARGETS = [
  { depth: 1, weapon: 6, hp: 30, armor: 3, mitigation: 0 },
  { depth: 5, weapon: 21, hp: 51, armor: 11, mitigation: 3 },
  { depth: 10, weapon: 34, hp: 88, armor: 12, mitigation: 6 },
  { depth: 15, weapon: 42, hp: 146, armor: 14, mitigation: 7 },
  { depth: 20, weapon: 52, hp: 175, armor: 14.7, mitigation: 9 },
  { depth: 26, weapon: 64, hp: 205, armor: 16, mitigation: 11 },
] as const;
// phase6-loot-numbers.md §1.2. Where the printed table gives only Boss, vault is unpublished.
export const FIRST_TIER_TARGETS = [
  { tier: 1, minIlvl: 1, ordinary: 1, encounter: 1, vault: 1 },
  { tier: 2, minIlvl: 6, ordinary: 4, encounter: 1, vault: 2 },
  { tier: 3, minIlvl: 12, ordinary: 8, encounter: 5, vault: null },
  { tier: 4, minIlvl: 20, ordinary: 14, encounter: 10, vault: null },
  { tier: 5, minIlvl: 30, ordinary: 20, encounter: 17, vault: null },
  { tier: 6, minIlvl: 40, ordinary: 27, encounter: 24, vault: 25 },
] as const;
