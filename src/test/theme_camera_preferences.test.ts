import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

afterEach(() => vi.unstubAllGlobals());

describe('DESIGN-2 temporary codex zoom', () => {
    it('never stores entry/manual codex zoom or Fit, restores prior camera, and reloads the original preference', async () => {
        const previousWindow = globalThis.window;
        const saved = new Map([['brogue-web-camera-v1', '{"zoom":1.25}']]);
        const setItem = vi.fn((key: string, value: string) => { saved.set(key, value); });
        vi.stubGlobal('window', { ...previousWindow, localStorage: { getItem: (key: string) => saved.get(key) ?? null, setItem } });
        try {
            vi.resetModules();
            const camera = await import('../ui/mapCamera');
            Object.assign(camera.cameraState, { fit: true, panX: 24, panY: -16 });
            camera.setCodexCamera(true);
            expect(camera.cameraState.zoom).toBe(2);
            expect([camera.cameraState.panX, camera.cameraState.panY, camera.cameraState.fit]).toEqual([0, 0, false]);
            await nextTick();
            camera.setCodexCamera(true); // repeated theme update must not overwrite the snapshot
            camera.zoomBy(1.25);
            expect(camera.cameraState.zoom).toBe(2.5);
            camera.fitMap();
            camera.zoomBy(1.25);
            await nextTick();
            expect(setItem).not.toHaveBeenCalled();
            camera.setCodexCamera(false);
            await nextTick();
            expect(camera.cameraState).toMatchObject({ zoom: 1.25, fit: true, panX: 24, panY: -16 });
            expect(setItem).not.toHaveBeenCalled();
            vi.resetModules(); // refresh in any other theme loads the unaffected global preference
            const reloaded = await import('../ui/mapCamera');
            expect(reloaded.cameraState.zoom).toBe(1.25);
            reloaded.zoomBy(1.25);
            await nextTick();
            expect(JSON.parse(saved.get('brogue-web-camera-v1')!).zoom).toBe(1.5625);
        } finally { vi.stubGlobal('window', previousWindow); }
    });

    it('preserves a pre-existing zoom above 2 through rapid enter/exit in one tick', async () => {
        const previousWindow = globalThis.window;
        const setItem = vi.fn();
        vi.stubGlobal('window', { ...previousWindow, localStorage: { getItem: () => '{"zoom":2.25}', setItem } });
        try {
            vi.resetModules();
            const camera = await import('../ui/mapCamera');
            camera.setCodexCamera(true);
            expect(camera.cameraState.zoom).toBe(2.25);
            camera.zoomBy(.8);
            camera.setCodexCamera(false);
            await nextTick();
            expect(camera.cameraState.zoom).toBe(2.25);
            expect(setItem).not.toHaveBeenCalled();
        } finally { vi.stubGlobal('window', previousWindow); }
    });
});

