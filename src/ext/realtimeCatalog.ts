import type { RealtimeModuleDescriptor } from '../engine/Simulation/RangedRuntime';
import type { StrategicDescriptor } from '../engine/Simulation/StrategicRuntime';
import { validId } from './json';

// Separate pure runtime discovery avoids loading turn-based Game/i18n paths in
// headless rooms. Each module owns its entry and disappears with its directory.
const entries = import.meta.glob<{ runtime: RealtimeModuleDescriptor | StrategicDescriptor }>('./modules/*/runtime.ts', { eager: true });
const discovered = Object.entries(entries).map(([path, entry]) => {
    const d = entry.runtime;
    if (!d || !['realtime','strategic'].includes(d.runtime) || (d.runtime==='strategic')!==['meta','operation'].includes(d.kind) || d.foundation !== 4 || d.id !== path.split('/')[2]
        || !validId(d.id) || (d.kind === 'operation' ? typeof d.createOperations !== 'function'
            : d.kind === 'meta' ? typeof d.createMeta !== 'function' : d.kind === 'ranged' ? typeof d.create !== 'function'
            : d.kind === 'population' ? typeof d.createPopulation !== 'function'
            : d.kind === 'support' ? typeof d.createSupport !== 'function'
            : d.kind !== 'mission' || typeof d.createMission !== 'function') || !/^\d+\.\d+\.\d+$/.test(d.version)
        || !/^sha256:[a-f0-9]{64}$/.test(d.rules.fingerprint)) throw new Error('Invalid realtime module descriptor');
    return Object.freeze(d);
}).sort((a, b) => a.id.localeCompare(b.id, 'en'));
const installed = discovered.filter((d): d is RealtimeModuleDescriptor=>d.runtime==='realtime');
export function getRealtimeModules(): readonly RealtimeModuleDescriptor[] { return installed; }
export function getStrategicModules(): readonly StrategicDescriptor[] { return discovered.filter((d): d is StrategicDescriptor=>d.runtime==='strategic'); }
