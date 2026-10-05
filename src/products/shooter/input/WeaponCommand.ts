import { integer, record } from '../../../engine/Simulation/Protocol';
import type { WeaponCommand } from '../../../engine/Simulation/RangedRuntime';
export function validateWeaponCommand(value: unknown, tick: number): asserts value is WeaponCommand {
    if (!(record(value, ['tick', 'kind']) && value.kind === 'reload')
        && !(record(value, ['tick', 'kind', 'slot']) && value.kind === 'equip' && integer(value.slot, 0, 3)))
        throw new Error('Invalid weapon command');
    if (value.tick !== tick) throw new Error('Out-of-order weapon command');
}
