/** Actual drawable/input viewport, including a resized shell and mobile visual viewport. */
export function usableMapViewport(
  size: { width: number; height: number },
  bounds: Pick<DOMRect, 'left' | 'top'>,
  viewport: { width: number; height: number; offsetLeft?: number; offsetTop?: number },
  occlusions: readonly Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>[] = []
) {
  let width = Math.max(
    0,
    Math.min(size.width, (viewport.offsetLeft ?? 0) + viewport.width - bounds.left)
  );
  let height = Math.max(
    0,
    Math.min(size.height, (viewport.offsetTop ?? 0) + viewport.height - bounds.top)
  );
  for (const r of occlusions) {
    // Module drawers reserve an edge of the same viewport; side drawers do not
    // remove the whole map band. Map origin remains fixed for pointer inversion.
    if (
      r.left <= bounds.left &&
      r.right >= bounds.left + width &&
      r.top > bounds.top &&
      r.top < bounds.top + height
    )
      height = r.top - bounds.top;
    if (
      r.top <= bounds.top &&
      r.bottom >= bounds.top + height &&
      r.left > bounds.left &&
      r.left < bounds.left + width
    )
      width = r.left - bounds.left;
  }
  return { width: Math.floor(width), height: Math.floor(height) };
}
export function readUsableMapViewport(el: HTMLElement) {
  const bounds = el.getBoundingClientRect(),
    v = window.visualViewport;
  return usableMapViewport(
    { width: el.clientWidth, height: el.clientHeight },
    bounds,
    v ?? { width: window.innerWidth, height: window.innerHeight },
    [...document.querySelectorAll<HTMLElement>('[data-map-drawer]')]
      .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden')
      .map((e) => e.getBoundingClientRect())
  );
}
