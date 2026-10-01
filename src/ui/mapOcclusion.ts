/** 浮层避让：只读 DOM 几何，不改游戏状态、不消耗随机数。 */
export type MapOcclusion = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>;

/** 玩家及相邻格所在横向范围内，选最长的无遮挡纵向区间。 */
export function unobstructedMapBand(height: number, focusX: number, radius: number,
    occlusions: readonly MapOcclusion[]): { top: number; bottom: number } {
    const blocked = occlusions.filter(r => r.right > focusX - radius && r.left < focusX + radius)
        .map(r => ({ top: Math.max(0, r.top), bottom: Math.min(height, r.bottom) }))
        .filter(r => r.bottom > r.top).sort((a, b) => a.top - b.top);
    let end = 0;
    let best = { top: 0, bottom: 0 };
    const consider = (top: number, bottom: number) => {
        const length = bottom - top, bestLength = best.bottom - best.top;
        if (length > bestLength || (length === bestLength &&
            Math.abs(top + bottom - height) < Math.abs(best.top + best.bottom - height))) best = { top, bottom };
    };
    for (const rect of blocked) {
        consider(end, rect.top);
        end = Math.max(end, rect.bottom);
    }
    consider(end, height);
    // 极小视口或模态浮层覆盖整列时没有可用区间；保持可操作镜头。
    return best.bottom > best.top ? best : { top: 0, bottom: height };
}

const selector = ':scope > .area-vitals, :scope > .area-near, :scope > .area-cmd, :scope > .area-log, :scope > .area-pad, :scope > .area-target, .map-zoom, .command-overflow, .area-radial .rc-hub, .area-radial.open .rc-item';
const overlays = (canvas: HTMLElement) => Array.from(canvas.closest('.app-layout')?.querySelectorAll<HTMLElement>(selector) ?? []);

/** 矩形换算到画布坐标；隐藏或完全在画布外的元素不占安全区域。 */
export function readMapOcclusions(canvas: HTMLElement): MapOcclusion[] {
    const bounds = canvas.getBoundingClientRect();
    return overlays(canvas).map(el => el.getBoundingClientRect()).filter(r => r.right > r.left && r.bottom > r.top)
        .map(r => ({ left: r.left - bounds.left, right: r.right - bounds.left,
            top: r.top - bounds.top, bottom: r.bottom - bounds.top }))
        .filter(r => r.right > 0 && r.left < bounds.width && r.bottom > 0 && r.top < bounds.height);
}

/** 内容变高、浮层挂载/卸载、命令环开合与面板布局变化都重算；只在沉浸模式启用。 */
export function observeMapOcclusions(canvas: HTMLElement, onChange: () => void): () => void {
    const root = canvas.closest('.app-layout');
    if (!root) return () => {};
    const observed = new Set<HTMLElement>();
    const resize = new ResizeObserver(onChange);
    const scan = () => {
        const current = new Set(overlays(canvas));
        for (const el of observed) if (!current.has(el)) { resize.unobserve(el); observed.delete(el); }
        for (const el of current) if (!observed.has(el)) { resize.observe(el); observed.add(el); }
    };
    const mutations = new MutationObserver(() => { scan(); onChange(); });
    mutations.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    scan();
    return () => { resize.disconnect(); mutations.disconnect(); };
}
