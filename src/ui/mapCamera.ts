/**
 * src/ui/mapCamera.ts — FE-1 小屏地图相机（纯函数 + 纯 UI 状态）。
 *
 * zoom=1 时桌面仍由 GameCanvas.computeMapLayout 决定（等比/拉伸，P2-6 口径不变）。
 * 用户主动放大时桌面也可进入跟随模式。小屏基础格过小时自动跟随：
 * 以用户缩放级给出每格像素，视口以玩家为中心并夹在地图边界内，
 * 用户拖动产生的平移叠加在跟随中心上。
 *
 * 相机状态（缩放级、平移量）是纯显示状态：不进存档、不进录像、不碰 rng。
 */
import { reactive, watch } from 'vue';

export const MIN_READABLE_TILE_PX = 12;
export const MAX_TILE_PX = 40;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;
export const CAMERA_SETTINGS_KEY = 'brogue-web-camera-v1';

export interface BaseLayout {
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
}

export interface CameraLayout extends BaseLayout {
    /** true = 处于跟随模式（地图大于视口，可平移） */
    follow: boolean;
    /** 夹紧后实际生效的平移量（写回状态，防止平移"越界累积"） */
    panX: number;
    panY: number;
}

/** 默认每格像素：约 24 列 / 18 行可见（取较小者），夹在 [12, 22]。 */
export function defaultTilePx(viewW: number, viewH: number): number {
    return Math.max(MIN_READABLE_TILE_PX, Math.min(22, viewW / 24, viewH / 18));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 一个轴：地图比视口小就居中；否则以 focus 为中心 + pan，夹在 [view - map, 0]。 */
function axis(view: number, mapPx: number, focusPx: number, pan: number): { offset: number; pan: number } {
    if (mapPx <= view) return { offset: (view - mapPx) / 2, pan: 0 };
    const centered = view / 2 - focusPx;
    const offset = clamp(centered + pan, view - mapPx, 0);
    return { offset, pan: offset - centered };
}

/**
 * @param base    computeMapLayout 的结果
 * @param cols/rows/tile  地图格数与逻辑格边长（TILE_SIZE）
 * @param focus   跟随中心（玩家格坐标）
 * @param autoFollow 仅紧凑视口按可读性阈值自动放大；桌面默认完整适配
 */
export function computeMapCamera(
    viewW: number,
    viewH: number,
    base: BaseLayout,
    cols: number,
    rows: number,
    tile: number,
    focus: { x: number; y: number },
    zoom: number,
    pan: { x: number; y: number },
    autoFollow = true,
): CameraLayout {
    const baseTilePx = Math.min(base.scaleX, base.scaleY) * tile;
    if (viewW <= 0 || viewH <= 0) {
        return { ...base, follow: false, panX: 0, panY: 0 };
    }
    if (baseTilePx >= MIN_READABLE_TILE_PX || !autoFollow) {
        // No user zoom: preserve the established desktop layout exactly.
        if (zoom <= 1) return { ...base, follow: false, panX: 0, panY: 0 };
        const maxBaseTilePx = Math.max(base.scaleX, base.scaleY) * tile;
        const factor = Math.max(1, Math.min(clamp(zoom, MIN_ZOOM, MAX_ZOOM), MAX_TILE_PX / maxBaseTilePx));
        const scaleX = base.scaleX * factor;
        const scaleY = base.scaleY * factor;
        const x = axis(viewW, cols * tile * scaleX, (focus.x + 0.5) * tile * scaleX, pan.x);
        const y = axis(viewH, rows * tile * scaleY, (focus.y + 0.5) * tile * scaleY, pan.y);
        return { scaleX, scaleY, offsetX: x.offset, offsetY: y.offset, follow: factor > 1, panX: x.pan, panY: y.pan };
    }
    const tilePx = clamp(defaultTilePx(viewW, viewH) * clamp(zoom, MIN_ZOOM, MAX_ZOOM), baseTilePx, MAX_TILE_PX);
    if (tilePx <= baseTilePx + 1e-6) {
        return { ...base, follow: false, panX: 0, panY: 0 };
    }
    const scale = tilePx / tile;
    const x = axis(viewW, cols * tilePx, (focus.x + 0.5) * tilePx, pan.x);
    const y = axis(viewH, rows * tilePx, (focus.y + 0.5) * tilePx, pan.y);
    return { scaleX: scale, scaleY: scale, offsetX: x.offset, offsetY: y.offset, follow: true, panX: x.pan, panY: y.pan };
}

export interface CameraState {
    zoom: number;
    panX: number;
    panY: number;
    /** Explicit full-map view, including compact screens that normally auto-follow. */
    fit: boolean;
    /** 最近一次布局是否处于跟随模式（供 UI 决定是否显示缩放钮） */
    follow: boolean;
}

function loadZoom(): number {
    try {
        const raw = window.localStorage.getItem(CAMERA_SETTINGS_KEY);
        const z = raw ? Number(JSON.parse(raw).zoom) : 1;
        return Number.isFinite(z) ? clamp(z, MIN_ZOOM, MAX_ZOOM) : 1;
    } catch {
        return 1;
    }
}

export const cameraState = reactive<CameraState>({ zoom: loadZoom(), panX: 0, panY: 0, fit: false, follow: false });

watch(() => cameraState.zoom, (zoom) => {
    try {
        window.localStorage.setItem(CAMERA_SETTINGS_KEY, JSON.stringify({ zoom }));
    } catch {
        // headless / 隐私模式：仅本次会话有效
    }
});

export function zoomBy(factor: number): void {
    if (cameraState.fit && factor < 1) return;
    if (!cameraState.follow && !cameraState.fit && cameraState.zoom <= 1 && factor < 1) return;
    // A stored small-screen zoom below 1 should not make desktop's first + a no-op.
    if (!cameraState.follow && factor > 1 && cameraState.zoom < 1) cameraState.zoom = 1;
    cameraState.fit = false;
    cameraState.zoom = clamp(cameraState.zoom * factor, MIN_ZOOM, MAX_ZOOM);
}

/** Fit the whole map using the selected uniform/stretch layout. */
export function fitMap(): void {
    cameraState.zoom = 1;
    cameraState.fit = true;
    recenterCamera();
}

export function recenterCamera(): void {
    cameraState.panX = 0;
    cameraState.panY = 0;
}
