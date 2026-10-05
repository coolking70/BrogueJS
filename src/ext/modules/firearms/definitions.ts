import { extensionDataFingerprint } from '../../fingerprint';
import { dataArray, integer, record } from '../../../engine/Simulation/Protocol';
import type { FriendlyFire } from '../../../engine/Combat/DamageResolution';
import data from './data/definitions.json';

export interface WeaponDefinition {
    id: string; trigger: 'semi' | 'auto'; fireIntervalTicks: number; magazineSize: number; reloadTicks: number;
    ballistic: 'hitscan' | 'projectile'; pellets: number; range: number; damage: number; spread: number; movingSpread: number;
    recoilKick: number; recoilRecovery: number; recoilMax: number; speed: number; fuseTicks: number; blastRadius: number; friendlyFire: FriendlyFire;
}
export const FIREARMS_VERSION = '1.1.0';
export function loadWeapons(value: unknown): readonly Readonly<WeaponDefinition>[] {
    if (!record(value, ['schema', 'weapons']) || value.schema !== 1 || !dataArray(value.weapons, 4) || value.weapons.length !== 4)
        throw new Error('Invalid firearms pack');
    const keys = ['id', 'trigger', 'fireIntervalTicks', 'magazineSize', 'reloadTicks', 'ballistic', 'pellets', 'range', 'damage',
        'spread', 'movingSpread', 'recoilKick', 'recoilRecovery', 'recoilMax', 'speed', 'fuseTicks', 'blastRadius', 'friendlyFire'];
    return Object.freeze(value.weapons.map((w, i) => {
        if (!record(w, keys) || w.id !== ['pistol', 'rifle', 'shotgun', 'grenade'][i]
            || !['semi', 'auto'].includes(w.trigger as string) || !['hitscan', 'projectile'].includes(w.ballistic as string)
            || !['none', 'team', 'all'].includes(w.friendlyFire as string)
            || !['fireIntervalTicks', 'magazineSize', 'reloadTicks', 'range', 'damage'].every(k => integer(w[k], 1, 65536))
            || !integer(w.pellets, 1, 16) || !['spread', 'movingSpread', 'recoilKick', 'recoilRecovery', 'recoilMax'].every(k => integer(w[k], 0, 512))
            || !integer(w.speed, 0, 4096) || !integer(w.fuseTicks, 0, 600) || !integer(w.blastRadius, 0, 8192)
            || (w.ballistic === 'projectile' ? !w.speed || !w.fuseTicks || !w.blastRadius || w.pellets !== 1 : !!w.speed || !!w.fuseTicks || !!w.blastRadius))
            throw new Error('Invalid weapon definition');
        return Object.freeze({ ...w } as unknown as WeaponDefinition);
    }));
}
export const WEAPONS = loadWeapons(data);
export const FIREARMS_RULES = Object.freeze({ schema: 1, version: FIREARMS_VERSION, fingerprint: extensionDataFingerprint(data) });
