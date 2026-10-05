import { idleInput, FIRE_BUTTON, type InputFrame } from './InputFrame';
import type { ShooterCommand } from '../../../engine/Simulation/RangedRuntime';

/** Continuous held state plus a captured short press. Discrete commands remain
 * a separate ordered stream and join the same mechanical tick transaction. */
export class InputFrameAssembler {
    private press = false;
    private held = false;
    private aim = 0;
    private movement = { x: 0, y: 0 };
    private commands: ({ kind: 'reload' | 'interact' | 'abort' } | { kind: 'equip'; slot: number })[] = [];
    setMovement(x: number, y: number): void {
        if (!Number.isInteger(x) || !Number.isInteger(y) || Math.abs(x) > 127 || Math.abs(y) > 127) throw new Error('Invalid movement sample');
        this.movement = { x, y };
    }
    setAim(angle: number): void {
        if (!Number.isInteger(angle) || angle < 0 || angle > 4095) throw new Error('Invalid aim sample');
        this.aim = angle;
    }
    setFire(held: boolean): void { if (held && !this.held) this.press = true; this.held = held; }
    requestFireTap(): void { this.press = true; }
    requestReload(): void { if (this.commands.length < 8) this.commands.push({ kind: 'reload' }); }
    requestInteract(): void { if (this.commands.length < 8) this.commands.push({ kind: 'interact' }); }
    requestAbort(): void { if (this.commands.length < 8) this.commands.push({ kind: 'abort' }); }
    requestEquip(slot: number): void {
        if (!Number.isInteger(slot) || slot < 0 || slot > 3) throw new Error('Invalid weapon slot');
        if (this.commands.length < 8) this.commands.push({ kind: 'equip', slot });
    }
    clear(): void { this.press = false; this.held = false; this.aim = 0; this.movement = { x: 0, y: 0 }; this.commands = []; }
    next(tick: number): InputFrame {
        const frame = { ...idleInput(tick), moveX: this.movement.x, moveY: this.movement.y, aimAngle: this.aim,
            buttons: this.held || this.press ? FIRE_BUTTON : 0 };
        this.press = false; return frame;
    }
    nextCommands(tick: number): ShooterCommand[] {
        const result = this.commands.map(c => ({ ...c, tick })); this.commands = []; return result;
    }
}
