import { normalizeStick } from './MovementAdapters';
/** Browser-only floating samples stop at this quantized boundary. */
export function mouseAim(dx: number, dy: number): number | null {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < .5) return null;
    return (Math.round(Math.atan2(dy, dx) * 4096 / (2 * Math.PI)) + 4096) % 4096;
}
export function stickAim(x: number, y: number): number | null {
    const normalized = normalizeStick(x, y);
    return normalized.x || normalized.y ? mouseAim(x * 1000, y * 1000) : null;
}
export interface StandardPad { connected: boolean; mapping: string; axes: readonly number[]; buttons: readonly { pressed: boolean; value: number }[] }
export function gamepadAim(pad: StandardPad | null | undefined): number | null {
    return pad?.connected && pad.mapping === 'standard' ? stickAim(pad.axes[2] ?? 0, pad.axes[3] ?? 0) : null;
}
export function gamepadButton(pad: StandardPad | null | undefined, index: number): boolean {
    const b = pad?.connected && pad.mapping === 'standard' ? pad.buttons[index] : undefined;
    return !!b && (b.pressed || b.value > .35);
}

export function touchAim(dx: number, dy: number, radius: number): number | null {
    return radius > 0 ? stickAim(dx / radius, dy / radius) : null;
}
