import { describe, it, expect } from 'vitest';
import { computeMapCamera } from '../../../../ui/mapCamera';
import { usableMapViewport } from '../../../../ui/mapViewport';
describe('remaining map viewport camera', () => {
  it.each([320, 390, 1440])(
    'uses actual %i viewport and drawer bounds for layout and pointer inversion',
    (width) => {
      const a = usableMapViewport(
        { width, height: 844 },
        { left: 0, top: 60 },
        { width, height: 844 },
        [{ left: 0, right: width, top: 540, bottom: 844 }]
      );
      expect(a).toEqual({ width, height: 480 });
      const base = {
        scaleX: a.width / (79 * 16),
        scaleY: a.height / (29 * 16),
        offsetX: 0,
        offsetY: 0
      };
      for (const fillViewport of [false, true])
        for (const x of [1, 20, 60, 77])
          for (const y of [1, 14, 27]) {
            const cam = computeMapCamera(
              a.width,
              a.height,
              base,
              79,
              29,
              16,
              { x, y },
              1,
              { x: 0, y: 0 },
              true,
              { fillViewport, edgePaddingTiles: fillViewport ? 2 : 0 }
            );
            const screenX = cam.offsetX + (x + 0.5) * 16 * cam.scaleX,
              screenY = cam.offsetY + (y + 0.5) * 16 * cam.scaleY;
            expect(screenX).toBeGreaterThanOrEqual(0);
            expect(screenX).toBeLessThanOrEqual(a.width);
            expect(screenY).toBeGreaterThanOrEqual(0);
            expect(screenY).toBeLessThanOrEqual(a.height);
            expect(Math.floor((screenX - cam.offsetX) / (16 * cam.scaleX))).toBe(x);
            expect(Math.floor((screenY - cam.offsetY) / (16 * cam.scaleY))).toBe(y);
          }
    }
  );
  it('edge correction never becomes user pan after shrinking a drawer', () => {
    const base = { scaleX: 0.25, scaleY: 0.25, offsetX: 0, offsetY: 0 };
    let cam = computeMapCamera(390, 200, base, 79, 29, 16, { x: 1, y: 1 }, 1, { x: 0, y: 0 });
    expect(cam.panX).toBe(0);
    expect(cam.panY).toBe(0);
    cam = computeMapCamera(390, 480, base, 79, 29, 16, { x: 60, y: 20 }, 1, {
      x: cam.panX,
      y: cam.panY
    });
    const y = cam.offsetY + 20.5 * 16 * cam.scaleY;
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(480);
  });
});
