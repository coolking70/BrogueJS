/** Container-owned Pixi sizing: renderer pixels and camera layout change together.
 * ResizeObserver only schedules work; DOM writes happen once in the next frame.
 * The container has an explicit size, so resizing its child canvas cannot grow it.
 */
export interface CanvasRenderer {
    readonly screen: { width: number; height: number };
    resize(width: number, height: number): void;
}

export function observeCanvasResize(container: HTMLElement, renderer: CanvasRenderer,
    onResize: () => void): () => void {
    let pendingFrame: number | null = null;
    let disposed = false;
    let width = 0;
    let height = 0;
    const sync = () => {
        pendingFrame = null;
        if (disposed) return;
        const nextWidth = container.clientWidth, nextHeight = container.clientHeight;
        // Hidden/zero-sized containers retain their last usable backing buffer.
        if (nextWidth <= 0 || nextHeight <= 0 || (nextWidth === width && nextHeight === height)) return;
        width = nextWidth; height = nextHeight;
        if (renderer.screen.width !== width || renderer.screen.height !== height) renderer.resize(width, height);
        onResize();
    };
    const observer = new ResizeObserver(() => {
        if (disposed || pendingFrame !== null) return;
        if (container.clientWidth === width && container.clientHeight === height) return;
        pendingFrame = requestAnimationFrame(sync);
    });
    sync(); // Initial camera/hit area use the same dimensions as the renderer.
    observer.observe(container);
    return () => {
        disposed = true;
        observer.disconnect();
        if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
        pendingFrame = null;
    };
}
