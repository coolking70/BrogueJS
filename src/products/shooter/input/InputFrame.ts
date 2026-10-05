export interface InputFrame {
    readonly tick: number;
    readonly moveX: number;
    readonly moveY: number;
    readonly aimAngle: number;
    readonly buttons: number;
}

export const S0_PULSE_BUTTON = 1;
export function validateInputFrame(value: unknown, expectedTick: number): asserts value is InputFrame {
    const frame = value as InputFrame | null;
    if (!frame || typeof frame !== 'object' || Array.isArray(frame)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(frame))
        || Reflect.ownKeys(frame).some(key => {
            const descriptor = Object.getOwnPropertyDescriptor(frame, key)!;
            return !descriptor.enumerable || !('value' in descriptor);
        })
        || Object.keys(frame).sort().join(',') !== 'aimAngle,buttons,moveX,moveY,tick'
        || !Number.isSafeInteger(frame.tick) || frame.tick !== expectedTick
        || !Number.isInteger(frame.moveX) || Math.abs(frame.moveX) > 127
        || !Number.isInteger(frame.moveY) || Math.abs(frame.moveY) > 127
        || !Number.isInteger(frame.aimAngle) || frame.aimAngle < 0 || frame.aimAngle > 4095
        || !Number.isInteger(frame.buttons) || frame.buttons < 0 || frame.buttons > S0_PULSE_BUTTON)
        throw new Error('Invalid or out-of-order input frame');
    // Reserve the protocol fields without pretending that S1/S2 capabilities exist.
    if (frame.moveX !== 0 || frame.moveY !== 0 || frame.aimAngle !== 0) throw new Error('S0 spatial input is not open');
}

export function idleInput(tick: number): InputFrame {
    return { tick, moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 };
}
