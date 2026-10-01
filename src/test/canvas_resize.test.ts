import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Rectangle, ViewSystem } from 'pixi.js';
import { observeCanvasResize } from '../ui/canvasResize';
import { computeMapCamera } from '../ui/mapCamera';
import { DCOLS, DROWS } from '../types';
import { createHeadlessGame } from './harness';
import { rng } from '../engine/Random';

let computeMapLayout: typeof import('../components/GameCanvas.vue').computeMapLayout;
beforeAll(async () => {
    vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
    ({ computeMapLayout } = await import('../components/GameCanvas.vue'));
    vi.unstubAllGlobals();
});

let notify: () => void;
let frames: Map<number, FrameRequestCallback>;
let observe: ReturnType<typeof vi.fn>, disconnect: ReturnType<typeof vi.fn>, cancel: ReturnType<typeof vi.fn>;
const cleanup: Array<() => void> = [];
beforeEach(() => {
    frames = new Map();
    let nextFrame = 0; // rAF handle 0 must also be cancelled on unmount.
    observe = vi.fn(); disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
        constructor(callback: () => void) { notify = callback; }
        observe = observe; disconnect = disconnect;
    });
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
        const id = nextFrame++; frames.set(id, callback); return id;
    }));
    cancel = vi.fn((id: number) => { frames.delete(id); });
    vi.stubGlobal('cancelAnimationFrame', cancel);
});
afterEach(() => {
    for (const dispose of cleanup.splice(0)) dispose();
    vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function flushFrame() {
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback(0);
}
function fixture(width = 1040, height = 660, resolution = 2) {
    const dimensions = { clientWidth: width, clientHeight: height };
    const container = dimensions as HTMLElement;
    const canvas = { width: 0, height: 0, style: { width: '', height: '' } } as HTMLCanvasElement;
    // The real Pixi view/CanvasSource writes both CSS size and backing pixels;
    // camera-only tests cannot catch an unchanged canvas clipped to the old size.
    const view = new ViewSystem();
    view.init({ canvas, width: Math.max(1, width), height: Math.max(1, height), autoDensity: true, resolution });
    cleanup.push(() => view.destroy(false));
    const renderer = { screen: view.screen, resize: vi.fn((w: number, h: number) => view.resize(w, h, view.resolution)) };
    return { dimensions, container, canvas, view, renderer };
}
function watch(f: ReturnType<typeof fixture>, relayout: () => void) {
    const stop = observeCanvasResize(f.container, f.renderer, relayout);
    cleanup.unshift(stop); // Stop pending callbacks before destroying the Pixi view.
    return stop;
}

describe('DESIGN-3b container-driven canvas resizing', () => {
    it('updates real Pixi CSS/backing size and camera/hit area in both directions without a window event or new view', () => {
        const f = fixture();
        const view = f.view, canvas = f.canvas;
        const game = createHeadlessGame(12345);
        vi.spyOn(Date, 'now').mockReturnValue(12345); // Capture metadata must not mask a display-only regression.
        const before = game.toSnapshot(), recording = game.exportRecording(), state = rng.getState();
        let immersive = false;
        let hit = new Rectangle();
        let camera: ReturnType<typeof computeMapCamera>;
        const relayout = vi.fn(() => {
            const { clientWidth: w, clientHeight: h } = f.dimensions;
            // Resize and layout share one size, including the actual renderer screen.
            expect([f.renderer.screen.width, f.renderer.screen.height]).toEqual([w, h]);
            hit = new Rectangle(0, 0, w, h);
            camera = computeMapCamera(w, h, computeMapLayout(w, h), DCOLS, DROWS, 16,
                game.player.loc, 1, { x: 0, y: 0 }, false, { fillViewport: immersive });
        });
        watch(f, relayout);
        expect(observe).toHaveBeenCalledExactlyOnceWith(f.container);
        expect(f.renderer.resize).not.toHaveBeenCalled();
        const originalCamera = camera!;
        immersive = true;
        Object.assign(f.dimensions, { clientWidth: 1280, clientHeight: 729 });
        notify();
        expect(f.canvas.style.width).toBe('1040px'); // Observer delivery does no DOM writes.
        flushFrame();
        expect([f.canvas.style.width, f.canvas.style.height]).toEqual(['1280px', '729px']);
        expect([f.canvas.width, f.canvas.height]).toEqual([2560, 1458]);
        expect([hit.width, hit.height]).toEqual([1280, 729]);
        expect(camera!.offsetX).toBeLessThanOrEqual(0);
        expect(camera!.offsetX + DCOLS * 16 * camera!.scaleX).toBeGreaterThanOrEqual(1280);
        expect(f.renderer.resize).toHaveBeenCalledExactlyOnceWith(1280, 729);
        immersive = false;
        Object.assign(f.dimensions, { clientWidth: 1040, clientHeight: 660 });
        notify(); flushFrame();
        expect([f.canvas.style.width, f.canvas.style.height]).toEqual(['1040px', '660px']);
        expect([f.canvas.width, f.canvas.height]).toEqual([2080, 1320]);
        expect([hit.width, hit.height]).toEqual([1040, 660]);
        expect(camera!).toEqual(originalCamera);
        expect(f.view).toBe(view); expect(f.canvas).toBe(canvas);
        expect(game.toSnapshot()).toEqual(before); expect(game.exportRecording()).toEqual(recording);
        expect(rng.getState()).toEqual(state);
    });

    it('merges repeated notifications and reads the final container size once per frame', () => {
        const f = fixture();
        const relayout = vi.fn(); watch(f, relayout); relayout.mockClear();
        f.dimensions.clientWidth = 1100; notify(); notify();
        f.dimensions.clientWidth = 1280; notify();
        // A later layout pass before rAF must win even without another notification.
        f.dimensions.clientHeight = 729;
        expect(frames.size).toBe(1); expect(f.renderer.resize).not.toHaveBeenCalled();
        flushFrame();
        expect(f.renderer.resize).toHaveBeenCalledExactlyOnceWith(1280, 729);
        expect(relayout).toHaveBeenCalledOnce();
    });

    it('suppresses same-size feedback and a within-frame return to the previous size', () => {
        const f = fixture();
        const relayout = vi.fn(); watch(f, relayout); relayout.mockClear();
        notify(); expect(frames.size).toBe(0);
        f.dimensions.clientWidth = 1280; notify();
        f.dimensions.clientWidth = 1040; notify(); flushFrame();
        expect(f.renderer.resize).not.toHaveBeenCalled(); expect(relayout).not.toHaveBeenCalled();
        f.dimensions.clientWidth = 1280; notify(); flushFrame();
        f.renderer.resize.mockClear(); relayout.mockClear();
        for (let i = 0; i < 10; i++) notify();
        expect(frames.size).toBe(0); expect(f.renderer.resize).not.toHaveBeenCalled();
        expect(relayout).not.toHaveBeenCalled();
    });

    it('retains usable pixels while hidden and resizes on becoming visible', () => {
        const f = fixture(0, 0);
        const relayout = vi.fn(); watch(f, relayout);
        expect(relayout).not.toHaveBeenCalled();
        Object.assign(f.dimensions, { clientWidth: 390, clientHeight: 760 }); notify(); flushFrame();
        expect([f.canvas.style.width, f.canvas.style.height]).toEqual(['390px', '760px']);
        f.renderer.resize.mockClear(); relayout.mockClear();
        Object.assign(f.dimensions, { clientWidth: 0, clientHeight: 0 }); notify(); flushFrame();
        expect(f.renderer.resize).not.toHaveBeenCalled(); expect(relayout).not.toHaveBeenCalled();
        expect([f.canvas.style.width, f.canvas.style.height]).toEqual(['390px', '760px']);
        Object.assign(f.dimensions, { clientWidth: 844, clientHeight: 306 }); notify(); flushFrame();
        expect(f.renderer.resize).toHaveBeenCalledExactlyOnceWith(844, 306);
    });

    it('disconnects and cancels a pending frame on unmount, including late deliveries', () => {
        const f = fixture();
        const relayout = vi.fn(); const stop = watch(f, relayout); relayout.mockClear();
        f.dimensions.clientWidth = 1280; notify();
        const lateFrame = frames.get(0)!;
        stop();
        expect(disconnect).toHaveBeenCalledOnce(); expect(cancel).toHaveBeenCalledExactlyOnceWith(0);
        notify(); lateFrame(0); flushFrame();
        expect(frames.size).toBe(0); expect(f.renderer.resize).not.toHaveBeenCalled();
        expect(relayout).not.toHaveBeenCalled();
        cleanup.splice(cleanup.indexOf(stop), 1);
    });

    it('resizes for panel/sidebar container changes with an unchanged window and preserves pixel density', () => {
        const f = fixture(1040, 660, 1);
        const relayout = vi.fn(); watch(f, relayout); relayout.mockClear();
        for (const [w, h] of [[990, 660], [1050, 660], [1050, 620], [1040, 660]]) {
            Object.assign(f.dimensions, { clientWidth: w, clientHeight: h }); notify(); flushFrame();
            expect([f.renderer.screen.width, f.renderer.screen.height]).toEqual([w, h]);
            expect([f.canvas.style.width, f.canvas.style.height]).toEqual([`${w}px`, `${h}px`]);
            expect([f.canvas.width, f.canvas.height]).toEqual([w, h]);
        }
        expect(f.renderer.resize).toHaveBeenCalledTimes(4); expect(relayout).toHaveBeenCalledTimes(4);
    });

    it('wires the actual renderer/layout/redraw to the container owner and disposes before Application destruction', () => {
        const src = readFileSync(new URL('../components/GameCanvas.vue', import.meta.url), 'utf8');
        expect(src).toContain('observeCanvasResize(canvasContainer.value, pixiApp.renderer, () => {');
        expect(src).toMatch(/observeCanvasResize\(canvasContainer\.value, pixiApp\.renderer, \(\) => \{\s*applyLayout\(\); renders\.request\(\);/);
        expect(src).toContain('width: Math.max(1, canvasContainer.value.clientWidth)');
        expect(src).toContain('height: Math.max(1, canvasContainer.value.clientHeight)');
        expect(src).not.toMatch(/resizeTo\s*:/);
        expect(src.match(/new Application\(/g)).toHaveLength(1);
        expect(src.indexOf('removeCanvasResizeObserver?.()')).toBeLessThan(src.indexOf('pixiApp.destroy('));
    });
});
