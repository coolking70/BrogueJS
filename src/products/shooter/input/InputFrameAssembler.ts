import { idleInput, S0_PULSE_BUTTON, type InputFrame } from './InputFrame';

/** Capture an edge until the next mechanical tick. Render frames never consume it. */
export class InputFrameAssembler {
    private pulse = false;
    requestPulse(): void { this.pulse = true; }
    clear(): void { this.pulse = false; }
    next(tick: number): InputFrame {
        const frame = { ...idleInput(tick), buttons: this.pulse ? S0_PULSE_BUTTON : 0 };
        this.clear();
        return frame;
    }
}
