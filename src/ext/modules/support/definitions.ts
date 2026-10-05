import { dataArray, integer, record } from '../../../engine/Simulation/Protocol';
import { extensionDataFingerprint } from '../../fingerprint';
import data from './data/definitions.json';
export interface SupportDefinition {
    id: string; labelKey: string; delay: number; cooldown: number; lifetime: number;
    radius: number; range: number; charges: number; interval: number; damage: number;
}
export function loadSupport(value: unknown): readonly Readonly<SupportDefinition>[] {
    if (!record(value, ['schema', 'abilities']) || value.schema !== 1 || !dataArray(value.abilities, 4) || value.abilities.length !== 4)
        throw new Error('Invalid support data');
    const ids = ['supply', 'turret', 'bombard', 'scan'];
    for (const [slot, a] of value.abilities.entries()) {
        if (!record(a, ['id', 'labelKey', 'delay', 'cooldown', 'lifetime', 'radius', 'range', 'charges', 'interval', 'damage'])
            || a.id !== ids[slot] || a.labelKey !== 'ext.support.' + a.id || !integer(a.delay, 1, 300)
            || !integer(a.cooldown, a.delay + 1, 9000) || !integer(a.lifetime, 0, a.cooldown)
            || !integer(a.radius, 256, 16384) || !integer(a.range, 1024, 16384) || !integer(a.charges, 0, 200)
            || !integer(a.interval, 0, 300) || !integer(a.damage, 0, 10000)
            || slot === 0 && (a.charges < 1 || a.damage !== 0 || a.lifetime < 1)
            || slot === 1 && (a.charges < 1 || a.interval < 1 || a.damage < 1 || a.lifetime < 1)
            || slot === 2 && (a.damage < 1 || a.lifetime !== 0)
            || slot === 3 && (a.damage !== 0 || a.lifetime < 1)) throw new Error('Invalid support definition');
    }
    return Object.freeze((value.abilities as unknown as SupportDefinition[]).map(a => Object.freeze({ ...a })));
}
export const SUPPORTS = loadSupport(data);
export const SUPPORT_RULES = Object.freeze({ schema: 1, version: '1.1.0', fingerprint: extensionDataFingerprint(data) });
