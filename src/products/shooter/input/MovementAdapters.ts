import type { WorldPoint } from '../../../engine/Movement/WorldUnits';

export const STICK_DEADZONE = 0.15;
/** One radial deadzone and quantizer shared by all device paths. Browser floats
 * end here. Only signed int8 samples cross the recorded simulation boundary. */
export function normalizeStick(x: number, y: number): WorldPoint {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
    const length = Math.hypot(x, y);
    if (length <= STICK_DEADZONE) return { x: 0, y: 0 };
    const magnitude = (Math.min(1, length) - STICK_DEADZONE) / (1 - STICK_DEADZONE);
    return { x: Math.round(x / length * magnitude * 127) || 0, y: Math.round(y / length * magnitude * 127) || 0 };
}
export class KeyboardMovement {
    private readonly keys = new Set<string>();
    key(code: string, down: boolean): boolean {
        if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(code)) return false;
        if (down) this.keys.add(code); else this.keys.delete(code);
        return true;
    }
    clear(): void { this.keys.clear(); }
    sample(): WorldPoint {
        const held = (...keys: string[]) => Number(keys.some(key => this.keys.has(key)));
        return normalizeStick(held('KeyD', 'ArrowRight') - held('KeyA', 'ArrowLeft'), held('KeyS', 'ArrowDown') - held('KeyW', 'ArrowUp'));
    }
}
export function gamepadMovement(pad: { connected: boolean; mapping: string; axes: readonly number[] } | null | undefined): WorldPoint {
    return pad?.connected && pad.mapping === 'standard' ? normalizeStick(pad.axes[0] ?? 0, pad.axes[1] ?? 0) : { x: 0, y: 0 };
}
export function touchMovement(dx: number, dy: number, radius: number): WorldPoint {
    return radius > 0 ? normalizeStick(dx / radius, dy / radius) : { x: 0, y: 0 };
}
