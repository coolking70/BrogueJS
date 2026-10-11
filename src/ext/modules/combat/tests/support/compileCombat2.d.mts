import type { CombatPack } from '../../types';
export interface Combat2Row {
    id: string; name: string; monster: string; cost: number; windup: number; recovery: number; hint: string;
    segments: { delay: number; shape: string; poise: number; parry: boolean }[];
}
export function compileCombat2(base: CombatPack, baseLocale: Record<string, string>, rows: Combat2Row[]): { pack: CombatPack; locale: Record<string, string> };
