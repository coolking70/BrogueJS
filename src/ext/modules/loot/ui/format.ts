import type { ModifierSpec } from '../types';
import { LootUiError } from './errors';

export function lootDecimal(value: number, digits = 2): string {
  if (!Number.isFinite(value)) throw new LootUiError('INVALID_INPUT', 'value');
  return Number(value.toFixed(digits)).toString();
}

export function lootSigned(value: number, digits = 2): string {
  const result = lootDecimal(value, digits);
  return value > 0 && result !== '0' ? `+${result}` : result;
}

/** An override expresses assignment even when its underlying unit is percentage. */
export function formatLootModifierValue(mod: Pick<ModifierSpec, 'stat' | 'category' | 'unit'>, value: number): string {
  if (!Number.isSafeInteger(value)) throw new LootUiError('INVALID_INPUT', 'modifier.value');
  if (mod.category === 'override') return `=${value}`;
  if (mod.unit === 'runic-strength') return String(value);
  if (mod.unit === 'bp') return `${lootSigned(value / 100)}%`;
  if (mod.stat === 'native.defense' && mod.unit === 'int') return lootSigned(value / 10, 1);
  return lootSigned(value, 0);
}

export function formatLootModifierRange(mod: Pick<ModifierSpec, 'stat' | 'category' | 'unit'>, min: number, max: number): string {
  return `${formatLootModifierValue(mod, min)}–${formatLootModifierValue(mod, max).replace(/^\+/, '')}`;
}
