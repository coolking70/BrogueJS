import { describe, expect, it } from 'vitest';
import { computeMapCamera } from '../ui/mapCamera';
import { computeLayoutMode, shouldShowTouchControls } from '../ui/layout';
import { MousePanTracker, shouldHandleMapWheel, shouldHighlightMapCell } from '../ui/mapPointer';
import { Container, Point } from 'pixi.js';
import { normalizeUiScale } from '../engine/Settings';

const base = { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
const camera = (zoom: number) => computeMapCamera(1100, 900, base, 79, 30, 16,
    { x: 40, y: 14 }, zoom, { x: 0, y: 0 });

describe('UX-1C desktop display interactions', () => {
    it('keeps the existing full-map layout at zoom 1 and zooms desktop when requested', () => {
        expect(camera(1)).toEqual({ ...base, follow: false, panX: 0, panY: 0 });
        const zoomed = camera(1.5);
        expect(zoomed.follow).toBe(true);
        expect(zoomed.scaleX).toBeGreaterThan(base.scaleX);
        expect(zoomed.offsetX).toBeLessThan(0);
    });

    it('keeps the fitted desktop map at zoom 1 even in a narrow desktop grid', () => {
        const narrowBase = { scaleX: 0.74, scaleY: 0.74, offsetX: 2, offsetY: 100 };
        const view = computeMapCamera(940, 720, narrowBase, 79, 30, 16,
            { x: 40, y: 14 }, 1, { x: 0, y: 0 }, false);
        expect(view).toEqual({ ...narrowBase, follow: false, panX: 0, panY: 0 });
        const zoomed = computeMapCamera(940, 720, narrowBase, 79, 30, 16,
            { x: 40, y: 14 }, 1.25, { x: 0, y: 0 }, false);
        expect(zoomed.scaleX).toBeGreaterThan(narrowBase.scaleX);
    });

    it('does not mistake a fine-pointer short desktop window for a touch device', () => {
        expect(computeLayoutMode(1280, 560)).toBe('landscape');
        expect(shouldShowTouchControls(false, 'landscape')).toBe(false);
        expect(shouldShowTouchControls(true, 'landscape')).toBe(true);
    });

    it('reserves modifier-wheel gestures for browser zoom', () => {
        expect(shouldHandleMapWheel({ ctrlKey: true, metaKey: false })).toBe(false);
        expect(shouldHandleMapWheel({ ctrlKey: false, metaKey: true })).toBe(false);
        expect(shouldHandleMapWheel({ ctrlKey: false, metaKey: false })).toBe(true);
    });

    it('maps a zoomed and panned viewport back to the same map cell', () => {
        const view = computeMapCamera(1100, 900, base, 79, 30, 16,
            { x: 40, y: 14 }, 1.5, { x: -75, y: 18 });
        const layer = new Container();
        layer.position.set(view.offsetX, view.offsetY);
        layer.scale.set(view.scaleX, view.scaleY);
        for (const [x, y] of [[0, 0], [40, 14], [78, 29]] as const) {
            const local = layer.toLocal(new Point(view.offsetX + (x + .5) * 16 * view.scaleX,
                view.offsetY + (y + .5) * 16 * view.scaleY));
            expect({ x: Math.floor(local.x / 16), y: Math.floor(local.y / 16) }).toEqual({ x, y });
        }
    });

    it('highlights only cells the player already knows', () => {
        expect(shouldHighlightMapCell(null)).toBe(false);
        expect(shouldHighlightMapCell({ isVisible: false, hasMemory: false, isMagicMapped: false })).toBe(false);
        expect(shouldHighlightMapCell({ isVisible: false, hasMemory: true, isMagicMapped: false })).toBe(true);
        expect(shouldHighlightMapCell({ isVisible: true, hasMemory: false, isMagicMapped: false })).toBe(true);
    });

    it('keeps interface scale independent and bounded', () => {
        expect(normalizeUiScale(undefined)).toBe(1);
        expect(normalizeUiScale(.4)).toBe(.8);
        expect(normalizeUiScale(1.25)).toBe(1.25);
        expect(normalizeUiScale(1.264)).toBe(1.26);
        expect(normalizeUiScale(2)).toBe(1.5);
    });

    it('distinguishes a pan from a click and tracks incremental movement', () => {
        const drag = new MousePanTracker();
        drag.down(5, 100, 100);
        expect(drag.move(5, 102, 102)).toEqual({ dx: 0, dy: 0, dragging: false });
        expect(drag.up(5)).toBe(false);
        drag.down(5, 100, 100);
        expect(drag.move(5, 110, 100)).toEqual({ dx: 10, dy: 0, dragging: true });
        expect(drag.move(5, 115, 104)).toEqual({ dx: 5, dy: 4, dragging: true });
        expect(drag.up(5)).toBe(true);
    });
});
