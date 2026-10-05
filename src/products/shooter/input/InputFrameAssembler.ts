import { idleInput, PULSE_BUTTON, type InputFrame } from './InputFrame';

/** Capture an edge until the next mechanical tick. Render frames never consume it. */
export class InputFrameAssembler {
    private pulse = false;
    private movement = { x: 0, y: 0 };
    setMovement(x: number, y: number): void {
        if (!Number.isInteger(x) || !Number.isInteger(y) || Math.abs(x) > 127 || Math.abs(y) > 127) throw new Error('Invalid movement sample');
        this.movement = { x, y };
    }
    requestPulse(): void { this.pulse = true; }
    clear(): void { this.pulse = false; this.movement = { x: 0, y: 0 }; }
    next(tick: number): InputFrame {
        const frame = { ...idleInput(tick), moveX: this.movement.x, moveY: this.movement.y, buttons: this.pulse ? PULSE_BUTTON : 0 };
        this.pulse = false;
        return frame;
    }
}
