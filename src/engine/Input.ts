/**
 * src/engine/Input.ts
 * Handling keyboard and mouse/touch input
 */

import { Direction } from '../types';
import { isTextEntry, ModalKeyboard, type ModalKeyHandler } from '../ui/modalKeyboard';
import { dialogInput } from '../ui/dialogInput';

export class InputManager {
    private onActionCallback: ((action: string, data?: any) => void) | null = null;
    /** CE: any keystroke interrupts automation (Movement.c:2345-2351, IO.c:2366-2375).
     *  Unbound keys are not game commands (P1-46); the host decides whether an
     *  automation is running and only then issues `interrupt_auto`. */
    private onUnboundKeyCallback: (() => void) | null = null;
    private modalKeyboard = new ModalKeyboard();

    constructor() {
        dialogInput.install(window);
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    /** Display transition barrier, never a simulated action. A key held across
     * a dialogue must be released before it can resume world movement. */
    public cancelHeldKeys(): void {
        dialogInput.cancelHeldKeys();
    }

    public setCallback(cb: (action: string, data?: any) => void) {
        this.onActionCallback = cb;
    }

    public registerModalKeyHandler(handler: ModalKeyHandler, priority = 0): () => void {
        return this.modalKeyboard.register(handler, priority);
    }

    public setUnboundKeyCallback(cb: (() => void) | null) {
        this.onUnboundKeyCallback = cb;
    }

    public triggerAction(action: string, data?: any) {
        if (dialogInput.busy()) return;
        if (this.onActionCallback) {
            this.onActionCallback(action, data);
            dialogInput.sync();
        }
    }

    private handleKeyDown(e: KeyboardEvent) {
        if (dialogInput.busy()) return;
        // Text entry (e.g. call-item nickname) must not become a game command.
        if (e.defaultPrevented || isTextEntry(e.target)) return;
        if (this.modalKeyboard.handle(e)) {
            dialogInput.sync();
            e.stopImmediatePropagation();
            return;
        }

        if (this.onActionCallback) {
            // CE IO.c:2700-2711: modifiers run in all eight directions.
            // Use code for the numeric keypad, including when NumLock is off.
            const directions: Record<string, Direction> = {
                ArrowUp: Direction.UP, k: Direction.UP, K: Direction.UP,
                ArrowDown: Direction.DOWN, j: Direction.DOWN, J: Direction.DOWN,
                ArrowLeft: Direction.LEFT, h: Direction.LEFT, H: Direction.LEFT,
                ArrowRight: Direction.RIGHT, l: Direction.RIGHT, L: Direction.RIGHT,
                y: Direction.UPLEFT, Y: Direction.UPLEFT, u: Direction.UPRIGHT, U: Direction.UPRIGHT,
                b: Direction.DOWNLEFT, B: Direction.DOWNLEFT, n: Direction.DOWNRIGHT, N: Direction.DOWNRIGHT,
                Numpad1: Direction.DOWNLEFT, Numpad2: Direction.DOWN, Numpad3: Direction.DOWNRIGHT,
                Numpad4: Direction.LEFT, Numpad6: Direction.RIGHT,
                Numpad7: Direction.UPLEFT, Numpad8: Direction.UP, Numpad9: Direction.UPRIGHT,
            };
            const direction = directions[e.code?.startsWith('Numpad') ? e.code : e.key];
            if (direction !== undefined) {
                e.preventDefault?.();
                this.onActionCallback(e.shiftKey || e.ctrlKey ? 'run' : 'move', direction);
                dialogInput.sync();
                return;
            }
            if (e.code === 'Numpad5') {
                e.preventDefault?.();
                this.onActionCallback('wait');
                dialogInput.sync();
                return;
            }
            switch (e.key) {
                // P1-46: WASD stays free for CE commands; w/T/M/S remain unbound.
                case 's':
                    e.preventDefault?.(); // Ctrl-S must not open the browser Save dialog.
                    this.onActionCallback(e.ctrlKey ? 'search_long' : 'search');
                    break;
                // B-2：CE THROW_KEY（`Rogue.h:1183`）。P1-46 把移动键回归纯 vi 键
                // 后 `t` 空闲，接上投掷入口。CE 的大写 `T` 是 RETHROW_KEY
                //（`Rogue.h:1184`，重扔上一件）——web 无 lastItemThrown 簿记，
                // 不接（b_2 报告登记），也不得悄悄映射到其它动作。
                case 'a':
                    this.onActionCallback('apply_item');
                    break;
                case 'Tab':
                    e.preventDefault?.();
                    this.onActionCallback('cycle_target', e.shiftKey ? -1 : 1);
                    break;
                case ' ':
                    e.preventDefault?.();
                    this.onActionCallback('cancel_target');
                    break;
                case 'Enter':
                    this.onActionCallback('confirm_target');
                    break;
                case 't':
                    this.onActionCallback('throw_item');
                    break;
                case '.':
                case '。':
                case 'z':
                    this.onActionCallback('wait');
                    break;
                case 'Z':
                    this.onActionCallback('auto_rest');
                    break;
                case 'e':
                    this.onActionCallback('inventory_action', 'equip');
                    break;
                case 'r':
                    this.onActionCallback('inventory_action', 'unequip');
                    break;
                case 'd':
                    this.onActionCallback('inventory_action', 'drop');
                    break;
                case 'c':
                    this.onActionCallback('inventory_action', 'call');
                    break;
                case 'R':
                    this.onActionCallback('inventory_action', 'relabel');
                    break;
                case 'g':
                    this.onActionCallback('pickup');
                    break;
                case 'i':
                case 'I':
                    this.onActionCallback('toggle_inventory');
                    break;
                case 'D':
                    this.onActionCallback('discoveries');
                    break;
                case '?':
                    this.onActionCallback('help');
                    break;
                case 'Escape':
                    this.onActionCallback('escape');
                    break;
                case 'x':
                case 'X':
                    this.onActionCallback('auto_explore');
                    break;
                case '<':
                case ',':
                case '，':
                case '《':
                    this.onActionCallback('travel_stairs', 'up');
                    break;
                case '>':
                case '》':
                    this.onActionCallback('travel_stairs', 'down');
                    break;
                default:
                    this.onUnboundKeyCallback?.();
                    break;
                // null dir means rest
            }
            dialogInput.sync();
        }
    }

}

export const inputManager = new InputManager();
