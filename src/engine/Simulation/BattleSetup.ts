import { dataArray, integer, record } from './Protocol';
/** Frozen at deployment, never reads the mutable strategic account. */
export interface BattleSetup { variant: number; difficulty: number; weapons: number[]; support: number[] }
export type BattleEquipment = Readonly<Pick<BattleSetup,'variant'|'difficulty'>> & {readonly weapons:readonly number[];readonly support:readonly number[]};
/** A module cannot alter or retain a writable alias to the product's setup. */
export function detachedEquipment(setup:BattleSetup|null):BattleEquipment|null {
    return setup?Object.freeze({...setup,weapons:Object.freeze([...setup.weapons]),support:Object.freeze([...setup.support])}):null;
}
export function validateBattleSetup(v: unknown): asserts v is BattleSetup {
    if (!record(v, ['variant','difficulty','weapons','support']) || !integer(v.variant,0,2) || !integer(v.difficulty,0,2)
        || !dataArray(v.weapons,4) || !v.weapons.length || !v.weapons.every(n=>integer(n,0,3)) || new Set(v.weapons).size!==v.weapons.length
        || !dataArray(v.support,4) || v.support.length!==4 || !v.support.every(n=>integer(n,-1,2))) throw new Error('Invalid battle setup');
}
