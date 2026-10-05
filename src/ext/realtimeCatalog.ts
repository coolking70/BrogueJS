import type { RealtimeModuleDescriptor } from '../engine/Simulation/RangedRuntime';
import { validId } from './json';

// Separate pure runtime discovery avoids loading turn-based Game/i18n paths in
// headless rooms. Each module owns its entry and disappears with its directory.
const entries = import.meta.glob<{ runtime: RealtimeModuleDescriptor }>('./modules/*/runtime.ts', { eager: true });
const installed = Object.entries(entries).map(([path, entry]) => {
    const d = entry.runtime;
    if (!d || d.runtime !== 'realtime' || d.foundation !== 4 || d.id !== path.split('/')[2]
        || !validId(d.id) || (d.kind === 'ranged' ? typeof d.create !== 'function'
            : d.kind !== 'population' || typeof d.createPopulation !== 'function') || !/^\d+\.\d+\.\d+$/.test(d.version)
        || !/^sha256:[a-f0-9]{64}$/.test(d.rules.fingerprint)) throw new Error('Invalid realtime module descriptor');
    return Object.freeze(d);
}).sort((a, b) => a.id.localeCompare(b.id, 'en'));
export function getRealtimeModules(): readonly RealtimeModuleDescriptor[] { return installed; }
