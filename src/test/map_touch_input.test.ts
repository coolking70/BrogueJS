import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { bindMapTouchInput } from '../ui/mapTouchInput';
import { cancelHeldInputs, registerHeldInputContext, syncHeldInputContext } from '../ui/heldInput';
import type { GestureEvent } from '../ui/touchGestures';
import { commandConfirmationFixture } from './support/commandConfirmation';

class Canvas extends EventTarget {
    setPointerCapture = vi.fn();
    releasePointerCapture = vi.fn();
    getBoundingClientRect = () => ({ left: 0, top: 0, right: 300, bottom: 300 });
}
let win: EventTarget, doc: EventTarget & { hidden: boolean };
let canvas: Canvas, output: GestureEvent[], remove: () => void;
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
    win = Object.assign(new EventTarget(), { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval });
    doc = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal('window', win); vi.stubGlobal('document', doc);
    canvas = new Canvas(); output = [];
    remove = bindMapTouchInput(canvas as unknown as HTMLCanvasElement, events => output.push(...events));
});
afterEach(() => { remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function pointer(type: string, id = 1, x = 100, y = 100) {
    canvas.dispatchEvent(Object.assign(new Event(type, { cancelable: true }),
        { pointerType: 'touch', pointerId: id, clientX: x, clientY: y }));
}

describe('map touch hold lifecycle', () => {
    it('短按依旧 tap，松手立即清轮询；长按只输出一次查看并清轮询', () => {
        pointer('pointerdown'); vi.advanceTimersByTime(100); pointer('pointerup');
        expect(output).toEqual([{ type: 'tap', x: 100, y: 100 }]); expect(vi.getTimerCount()).toBe(0);
        output.length = 0; pointer('pointerdown'); vi.advanceTimersByTime(450);
        expect(output).toEqual([{ type: 'longpress', x: 100, y: 100 }]); expect(vi.getTimerCount()).toBe(0);
        vi.advanceTimersByTime(5000); pointer('pointerup'); expect(output).toHaveLength(1);
    });
    it.each([false, true])('确认返回 %s 前停止地图长按，迟到抬起不产生 tap', answer => {
        pointer('pointerdown'); vi.advanceTimersByTime(100);
        const confirm = commandConfirmationFixture();
        confirm.publish('flame?');
        expect(vi.getTimerCount()).toBe(0);
        expect(confirm.answer(answer)).toBe(true);
        expect(confirm.resolved).toHaveBeenCalledWith('flame?', answer);
        confirm.dispose();
        pointer('pointerup'); vi.advanceTimersByTime(5000);
        expect(output).toEqual([]); expect(vi.getTimerCount()).toBe(0);
        pointer('pointerdown'); vi.advanceTimersByTime(450); expect(output).toHaveLength(1);
    });
    it.each(['blur', 'visibilitychange', 'pointercancel', 'pointerleave', 'lostpointercapture'])('%s 清轮询与手势，恢复/迟到事件不会自行重启', type => {
        pointer('pointerdown'); vi.advanceTimersByTime(100);
        if (type === 'blur') win.dispatchEvent(new Event(type));
        else if (type === 'visibilitychange') { doc.hidden = true; doc.dispatchEvent(new Event(type)); }
        else pointer(type);
        expect(vi.getTimerCount()).toBe(0);
        doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); win.dispatchEvent(new Event('focus'));
        pointer('pointermove'); pointer('pointerup'); vi.advanceTimersByTime(5000);
        expect(output).toEqual([]); expect(vi.getTimerCount()).toBe(0);
    });
    it('指针捕获保证松手路径；捕获移动越界也取消，丢失捕获不依赖 pointerType', () => {
        pointer('pointerdown'); expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
        pointer('pointermove', 1, 301); pointer('pointerup'); expect(output).toEqual([]);
        pointer('pointerdown');
        canvas.dispatchEvent(Object.assign(new Event('lostpointercapture'), { pointerId: 1 }));
        pointer('pointerup'); expect(output).toEqual([]); expect(vi.getTimerCount()).toBe(0);
    });
    it.each(['inventory', 'menu', 'details', 'journal', 'target', 'gameOver', 'replay'])('打开 %s 丢弃旧地图按住，关闭不恢复', kind => {
        let modal: string | null = null;
        const removeContext = registerHeldInputContext(() => [modal]);
        try {
            pointer('pointerdown'); modal = kind; syncHeldInputContext();
            modal = null; syncHeldInputContext(); pointer('pointerup'); vi.advanceTimersByTime(5000);
            expect(output).toEqual([]); expect(vi.getTimerCount()).toBe(0);
        } finally { removeContext(); }
    });
    it('即使模态变化未绘制，下个长按轮询也会先取消', () => {
        let modal = false;
        const removeContext = registerHeldInputContext(() => [modal]);
        try {
            pointer('pointerdown'); modal = true; vi.advanceTimersByTime(5000);
            expect(output).toEqual([]); expect(vi.getTimerCount()).toBe(0);
        } finally { removeContext(); }
    });
    it('拖动/双指捏合不变，松开一指后不会触发 tap/长按', () => {
        pointer('pointerdown', 1, 50, 50); pointer('pointermove', 1, 70, 50); pointer('pointerup');
        expect(output).toEqual([{ type: 'pan', dx: 20, dy: 0 }]); output.length = 0;
        pointer('pointerdown', 1, 50, 50); pointer('pointerdown', 2, 100, 50); pointer('pointermove', 2, 150, 50);
        pointer('pointerup', 2); vi.advanceTimersByTime(5000); pointer('pointerup', 1);
        expect(output).toEqual([{ type: 'pinch', factor: 2 }]); expect(vi.getTimerCount()).toBe(0);
    });
    it('取消释放全部指针，卸载移除监听器与计时器', () => {
        pointer('pointerdown', 1); pointer('pointerdown', 2); cancelHeldInputs();
        expect(canvas.releasePointerCapture.mock.calls).toEqual([[1], [2]]);
        pointer('pointerdown'); remove(); pointer('pointerdown'); vi.advanceTimersByTime(5000);
        expect(output).toEqual([]); expect(vi.getTimerCount()).toBe(0);
    });
    it('GameCanvas 使用受控地图输入并观察全部引擎模态/终局/回放；App 同步观察局部模态', () => {
        const canvasSource = readFileSync('src/components/GameCanvas.vue', 'utf8');
        expect(canvasSource).toContain('bindMapTouchInput(canvasEl, handleGestures)');
        const context = canvasSource.slice(canvasSource.indexOf('registerHeldInputContext(()'), canvasSource.indexOf('frameProfile = new URLSearchParams'));
        for (const field of ['isInventoryOpen', 'referenceScreen', 'inspectTarget', 'pendingArcana', 'isThrowing',
            'pendingEnchantment', 'pendingIdentify', 'pendingUseConfirm', 'isGameOver', 'replayRecording', 'replayStatus']) {
            expect(context).toContain(`game.${field}`);
        }
        expect(context).toContain('logger.pendingAcknowledgment');
        const app = readFileSync('src/App.vue', 'utf8');
        expect(app).toMatch(/watch\(\[menuOpen, panelOpen, journalOpen, nearbyInspection, themePanelOpen\][\s\S]*?flush: 'sync'/);
    });
});
