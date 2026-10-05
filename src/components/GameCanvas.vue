<script lang="ts">
import { displayRandom } from '../engine/Lighting/CosmeticLight';
import type { MapScaleMode } from '../engine/Settings';
import { DCOLS, DROWS } from '../types';

/** 地图单元格像素边长（与 setup 内共用，模块级以便 computeMapOffset 使用）。 */
export const TILE_SIZE = 16;

/**
 * 幻觉外观随显示帧变化，但显示帧数不得推进命令录像所记录的任何 RNG 流。
 * 和动态光照共用按地图隔离的显示随机流；省略 owner 时供旧的纯函数调用方使用。
 */
const fallbackDisplayOwner = {};
export function cosmeticPercent(percent: number, owner: object = fallbackDisplayOwner): boolean {
    return displayRandom(owner).randPercent(percent);
}

export function cosmeticPick<T>(list: readonly T[], owner: object = fallbackDisplayOwner): T {
    return list[displayRandom(owner).randRange(0, list.length - 1)]!;
}

/**
 * 地图在画布容器内的居中偏移（P2-4 居中修复）。
 *
 * 只能传**画布容器**的实际尺寸（flex 布局扣除 Sidebar 后的剩余区域），
 * 不能传窗口尺寸（innerWidth/innerHeight）——那会把 340px 侧栏算进居中，
 * 地图整体右移约 170px，右侧被侧栏压住、鼠标命中区随之错位。
 * 导出供测试锁定该口径（p2_4_animation_cadence.test.ts）。
 */
/**
 * 地图在视口中的布局：缩放 + 居中偏移（P2-6 起支持两种缩放模式）。
 *
 * 地图是固定的 DCOLS×DROWS 格、每格 TILE_SIZE 像素（79×16 = 1264px 宽）。
 * 当视口放不下时**必须等比缩小**，否则超出部分会被画布边界硬切——
 * 视觉上表现为"右侧被侧栏挡住一块"，这正是本项目长期未能修复的那个 bug：
 * 旧实现 `Math.max(0, (viewport - map) / 2)` 把负偏移钳成 0，
 * 地图便从 x=0 一路画到 1264 并溢出容器。
 *
 * 实测（侧栏 340px）：窗口 1280 → 切 21 列；1440 → 切 11 列；
 * 1604 才是完整显示的临界点。
 *
 * uniform（默认，= P2-5 现状）：scale 只缩不放（上限 1），避免小地图在大屏上
 * 被放大得糊掉；多余空间留黑边，方格保持正方形。
 *
 * stretch（CE 口径，platform/tiles.c:782-803）：x 方向按 outputWidth/格数、
 * y 方向按 outputHeight/格数**各自铺满**，两方向独立缩放、不保持宽高比，
 * 允许放大、无黑边。CE 用 `(x+1)*W/C - x*W/C` 的整除写法把余数摊到各格、
 * 使相邻格边界严丝合缝；web 用连续缩放 `viewportWidth/mapW` 达成同一效果
 * （右缘恰好 = 容器宽，无 1px 缝隙）。
 *
 * `scale` 是兼容字段，仅 uniform 模式有意义（= scaleX = scaleY）；
 * stretch 模式下两方向缩放不同，请一律使用 scaleX/scaleY。
 */
export function computeMapLayout(
    viewportWidth: number,
    viewportHeight: number,
    mode: MapScaleMode = 'uniform',
): { scale: number; scaleX: number; scaleY: number; offsetX: number; offsetY: number } {
    const mapW = DCOLS * TILE_SIZE;
    const mapH = DROWS * TILE_SIZE;
    if (viewportWidth <= 0 || viewportHeight <= 0) {
        return { scale: 1, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
    }
    if (mode === 'stretch') {
        return {
            scale: 1,
            scaleX: viewportWidth / mapW,
            scaleY: viewportHeight / mapH,
            offsetX: 0,
            offsetY: 0,
        };
    }
    const scale = Math.min(1, viewportWidth / mapW, viewportHeight / mapH);
    return {
        scale,
        scaleX: scale,
        scaleY: scale,
        offsetX: Math.max(0, (viewportWidth - mapW * scale) / 2),
        offsetY: Math.max(0, (viewportHeight - mapH * scale) / 2),
    };
}

/** 兼容旧签名：只取偏移。缩放请用 computeMapLayout。 */
export function computeMapOffset(viewportWidth: number, viewportHeight: number): { offsetX: number; offsetY: number } {
    const { offsetX, offsetY } = computeMapLayout(viewportWidth, viewportHeight);
    return { offsetX, offsetY };
}
</script>

<script setup lang="ts">
import { AUTO_ACTION_INTERVAL_MS, DISPLAY_FRAME_MS, stepCadence } from '../engine/UI/ActionCadence';
import { terrainRandomValues, tickTerrainColors } from '../engine/UI/DancingColors';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import * as PIXI from 'pixi.js';
import { Application, Text, TextStyle, Graphics, Container } from 'pixi.js';
// R-1 渲染纯重构：格子/实体「画什么字符、什么颜色」的决策已抽到
// Appearance.ts 纯函数（ctx 显式注入），本组件只保留 Pixi 绘制。
// 结构守卫（r_1_appearance.test.ts）钉死本文件不得再出现外观决策。
import { ARCANA_TRAJECTORY_FILL, cellAppearance, itemAppearance, rememberedItemAppearance, monsterAppearance, playerAppearance, type CosmeticRng } from '../engine/UI/Appearance';
import { canSeeMonster, canDirectlySeeMonster, canDisplayMonster, canSeeMonsterAt, monsterInGas } from '../engine/UI/MonsterVisibility';
// DCOLS/DROWS 已在上方 <script lang="ts"> 模块块导入（computeMapOffset 用），
// 同一模块内重复声明绑定会报错，这里只取 setup 独有的 Direction。
import { Direction } from '../types';
import { activeGame } from '../engine/Core/Game';
import { logger } from '../engine/Systems/Logger';
import { inputManager } from '../engine/Input';
import i18next from 'i18next';
import { displaySettings } from '../engine/Settings';
import { viewport } from '../ui/layout';
// FE-1：小屏跟随相机（纯显示状态，不进存档/录像）
import { computeMapCamera, cameraState, zoomBy } from '../ui/mapCamera';
import { observeCanvasResize } from '../ui/canvasResize';
import { readMapOcclusions, observeMapOcclusions } from '../ui/mapOcclusion';
import { MAP_HOVER_FILL, MAP_HOVER_STROKE, MousePanTracker, shouldHandleMapWheel, shouldHighlightMapCell, wheelZoomFactor } from '../ui/mapPointer';
// FE-1：触屏手势与目标选择（改状态的输出只经 ui/commands 的录制边界）
import type { GestureEvent } from '../ui/touchGestures';
import { bindMapTouchInput } from '../ui/mapTouchInput';
import { registerHeldInput, registerHeldInputContext, syncHeldInputContext } from '../ui/heldInput';
import { dialogInput } from '../ui/dialogInput';
import { normalizeMapGlyph } from '../ui/mapGlyph';
import { readInteractableMapMarkers } from '../ui/worldInteractableMap';
import { RetainedBackgroundLayer, RetainedVectorLayer, VectorGeometryCache } from '../ui/retainedMapDrawing';
import { displayedFrame, presentationTimeline } from '../ui/presentationTimeline';
import { publicMonsterBody, publicMonsterMapCells } from '../engine/UI/MonsterBody';
import { observeDisplayMonster } from '../ui/monsterDisplay';
import { paintBody, paintBodyOutline, selectedBodyCells } from '../ui/bodyDrawing';
import { paintCombatTelegraphs, readPublicCombatTelegraphs } from '../ui/combatDrawing';
import { installSquareBodyDiagnostics } from '../ui/squareBodyDiagnostics';
import type { DisplayFrame } from '../ui/displayProjection';
import { RenderRequests } from '../ui/renderRequests';
import { FrameProfile } from '../ui/frameProfile';
import { mapMode } from '../ui/mapTiles';
import { terrainSemantic, itemSemantic, rememberedItemSemantic, monsterSemantic, playerSemantic, projectileSemantic, floatingHanzi, type TileSemantic } from '../ui/mapTileSemantics';
import { paintMapText, paintVectorTile, HANZI_FONT } from '../ui/mapTileDrawing';
import { targetingState, clearAim, targetingTapCommand, type TapCommand, THROW_AIM_FILL, THROW_AIM_STROKE } from '../ui/targeting';
import { dispatch as dispatchCommand, travelTo } from '../ui/commands';

const props = withDefaults(defineProps<{ displayModalOpen?: boolean }>(), { displayModalOpen: false });

const canvasContainer = ref<HTMLDivElement | null>(null);
let pixiApp: Application | null = null;
const arcanaPrompt = ref('');
const arcanaCursorStroke = { width: 2, color: 0xdddddd };
const performanceReport = ref('');
let frameProfile: FrameProfile | null = null;
let vectorGeometry: VectorGeometryCache | null = null;
let destroyRetainedDrawing: (() => void) | null = null;
const resetProfile = () => frameProfile?.reset();
// Container sizing owns both the Pixi backing buffer and camera; no window-only resizeTo.
let removeCanvasResizeObserver: (() => void) | null = null;
// P2-6：地图缩放模式切换的 watch 停止器（onMounted 内创建，onUnmounted 内停止）
let stopScaleModeWatch: (() => void) | null = null;
let stopTileModeWatch: (() => void) | null = null;
let stopCameraWatch: (() => void) | null = null;
let stopImmersiveWatch: (() => void) | null = null;
let removeOcclusionObserver: (() => void) | null = null;
// FE-1：触屏手势监听的卸载函数
let removeDisplayClockListener: (() => void) | null = null;
let removeTouchListeners: (() => void) | null = null;
let removeSquareBodyDiagnostics: (() => void) | null = null;
let removeHeldInputContext: (() => void) | null = null;

onMounted(async () => {
  if (canvasContainer.value) {
    await document.fonts.load('14px "' + HANZI_FONT + '"');
    pixiApp = new Application();

    await pixiApp.init({
      width: Math.max(1, canvasContainer.value.clientWidth),
      height: Math.max(1, canvasContainer.value.clientHeight),
      backgroundColor: 0x111111,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    canvasContainer.value.appendChild(pixiApp.canvas);

    const baseStyleOptions = {
      fontFamily: 'Courier New',
      fontSize: TILE_SIZE,
      fill: '#ffffff',
    } as const;

    // P2-4 居中修复：地图居中与鼠标命中区一律基于**画布容器**的实际尺寸。
    // 旧实现用窗口视口尺寸（innerWidth/innerHeight）——把 340px 侧栏算进居中，
    // 地图整体右移约 170px 被侧栏遮挡。offset 在 resize 时由 ResizeObserver
    // 重算（observe 建立于图层创建之后），四个图层与 hitArea 同步更新。
    let offsetX = 0;
    let offsetY = 0;
    // FE-1：相机跟随的上次焦点与当前文字纹理分辨率
    let lastFocusX = -1;
    let lastFocusY = -1;
    let textResolution = window.devicePixelRatio || 1;
    let layoutScaleX = 1;
    let layoutScaleY = 1;

    // ---------- Pre-allocated tile layer ----------
    // Retained quads and shared vector geometry avoid per-refresh tessellation.
    vectorGeometry = new VectorGeometryCache();
    const bgGraphics = new RetainedBackgroundLayer();
    const vectorTerrain = new RetainedVectorLayer(vectorGeometry, bgGraphics);
    bgGraphics.position.set(offsetX, offsetY);

    // One Text sprite per cell, reused every frame
    const tileLayer = new Container();
    tileLayer.position.set(offsetX, offsetY);

    // Pre-allocated cells: tileSprites[x][y]
    const tileSprites: Text[][] = [];
    for (let x = 0; x < DCOLS; x++) {
        tileSprites[x] = [];
        for (let y = 0; y < DROWS; y++) {
            const t = new Text({ text: ' ', style: new TextStyle(baseStyleOptions) });
            t.x = x * TILE_SIZE;
            t.y = y * TILE_SIZE;
            t.visible = false;
            tileLayer.addChild(t);
            tileSprites[x]![y] = t;
        }
    }

    // Public combat warnings sit above terrain and below bodies/target outlines.
    const telegraphGraphics = new Graphics();
    tileLayer.addChild(telegraphGraphics);

    // ---------- Entity layer ----------
    // Fixed number of entity Text sprites (player + max ~30 entities)
    const MAX_ENTITY_SPRITES = 256;
    const entityLayer = new Container();
    const bodyGraphics = new Graphics();
    entityLayer.addChild(bodyGraphics);
    entityLayer.position.set(offsetX, offsetY);

    const vectorEntities = new RetainedVectorLayer(vectorGeometry);
    entityLayer.addChild(vectorEntities);
    destroyRetainedDrawing = () => {
        // The white background texture and contexts are shared, not sprite-owned.
        bgGraphics.destroy({ children: true, texture: false, context: false });
        vectorTerrain.destroy();
        vectorEntities.destroy({ children: true, context: false });
    };
    const entitySprites: Text[] = [];
    for (let i = 0; i < MAX_ENTITY_SPRITES; i++) {
        const t = new Text({ text: ' ', style: new TextStyle(baseStyleOptions) });
        t.visible = false;
        entityLayer.addChild(t);
        entitySprites.push(t);
    }

    // ---------- Bolt sprite (for projectile animation) ----------
    const boltSprite = new Text({
        text: '*',
        style: new TextStyle({
            fontFamily: 'Courier New',
            fontSize: 14,
            fontWeight: 'bold',
            fill: '#ffff00',
            dropShadow: { color: '#ffff00', blur: 12, distance: 0, angle: 0, alpha: 0.9 }
        })
    });
    boltSprite.visible = false;
    entityLayer.addChild(boltSprite);
    const arcanaCursor = new Graphics();
    entityLayer.addChild(arcanaCursor);
    const hoverHighlight = new Graphics();
    entityLayer.addChild(hoverHighlight);

    // A display-only overlay. CE cursor mode highlights its current cell
    // (IO.c:655-664); passive mouse hover is a Web affordance.
    const selectionCells = (at: { x: number; y: number }, frame?: DisplayFrame) => {
        if (frame) return selectedBodyCells(frame.map.bodies, at);
        const monster = activeGame.getMonsterAt(at.x, at.y);
        const body = monster && publicMonsterBody(activeGame.player, activeGame.grid, monster);
        return body?.cells.some(p => p.x === at.x && p.y === at.y) ? body.cells : null;
    };
    const drawHover = () => {
        hoverHighlight.clear();
        const game = activeGame, frame = displayedFrame(game);
        const pos = frame ? frame.hoverCell : game.hoveredCell;
        if (!pos || (frame ? frame.targeting !== 'none' || frame.terminal : game.isInventoryOpen || game.referenceScreen
            || game.pendingArcana || game.isThrowing || game.isGameOver)) return;
        if (frame ? !frame.map.columns[pos.x]?.[pos.y] : !shouldHighlightMapCell(game.grid.getCell(pos.x, pos.y))) return;
        const cells = selectionCells(pos, frame);
        if (cells) {
            for (const p of cells) hoverHighlight.rect(p.x * TILE_SIZE, p.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            hoverHighlight.fill({ color: MAP_HOVER_FILL, alpha: 0.14 });
            paintBodyOutline(hoverHighlight, cells, TILE_SIZE, MAP_HOVER_STROKE);
        } else {
            hoverHighlight.rect(pos.x * TILE_SIZE, pos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
                .fill({ color: MAP_HOVER_FILL, alpha: 0.14 });
            hoverHighlight.rect(pos.x * TILE_SIZE + 0.75, pos.y * TILE_SIZE + 0.75,
                TILE_SIZE - 1.5, TILE_SIZE - 1.5).stroke({ color: MAP_HOVER_STROKE, width: 1.5 });
        }
    };
    const drawTargetBody = (at: { x: number; y: number }, color: number, frame?: DisplayFrame) => {
        const cells = selectionCells(at, frame);
        if (cells) paintBodyOutline(arcanaCursor, cells, TILE_SIZE, color, 1, 2);
    };

    // Floating text layer (max 8 floaters)
    const MAX_FLOAT_SPRITES = 8;
    const floatLayer = new Container();
    floatLayer.position.set(offsetX, offsetY);

    const floatSprites: Text[] = [];
    for (let i = 0; i < MAX_FLOAT_SPRITES; i++) {
        const ft = new Text({
            text: ' ',
            style: new TextStyle({
                fontFamily: 'Courier New',
                fontSize: 14,
                fontWeight: 'bold',
                fill: '#ffffff',
                stroke: { color: '#000000', width: 2 }
            })
        });
        ft.visible = false;
        floatLayer.addChild(ft);
        floatSprites.push(ft);
    }

    // Add layers in order
    pixiApp.stage.addChild(bgGraphics);
    pixiApp.stage.addChild(tileLayer);
    pixiApp.stage.addChild(entityLayer);
    pixiApp.stage.addChild(floatLayer);

    // 居中偏移与命中区的一次性落地：以容器实际尺寸重算并同步到
    // 四个图层与 stage.hitArea。挂载时调用一次；此后由 ResizeObserver 驱动。
    const applyLayout = () => {
        const el = canvasContainer.value;
        if (!el || !pixiApp) return;
        // 容器 clientWidth/Height 是布局真值，覆盖侧栏增减等非窗口变化。
        // 尺寸观察器先同步 renderer，再进入这里更新图层与命中区；
        // 仅缩放/平移/遮挡变化也可独立走这里，不重复 resize 渲染器。
        const preferredLayout = computeMapLayout(
            el.clientWidth,
            el.clientHeight,
            displaySettings.mapScaleMode,
        );
        const base = mapMode.value === 'hanzi' || mapMode.value === 'tiles'
            ? computeMapLayout(el.clientWidth, el.clientHeight, 'uniform')
            : preferredLayout;
        // zoom=1 时保留原桌面布局；主动放大或小屏自动放大后使用跟随相机。
        const focus = displayedFrame(activeGame)?.player ?? activeGame.player?.loc ?? { x: 0, y: 0 };
        const cam = cameraState.fit ? { ...base, follow: false, panX: 0, panY: 0 } : computeMapCamera(
            el.clientWidth, el.clientHeight, base, DCOLS, DROWS, TILE_SIZE,
            focus, cameraState.zoom, { x: cameraState.panX, y: cameraState.panY },
            viewport.mode !== 'desktop' || mapMode.value === 'hanzi' || mapMode.value === 'tiles',
            { fillViewport: displaySettings.immersiveMode,
                edgePaddingTiles: displaySettings.immersiveMode ? 2 : 0,
                occlusions: displaySettings.immersiveMode ? readMapOcclusions(el) : undefined },
        );
        cameraState.follow = cam.follow;
        pixiApp.canvas.style.cursor = cam.follow ? 'grab' : 'crosshair';
        if (cameraState.panX !== cam.panX) cameraState.panX = cam.panX;
        if (cameraState.panY !== cam.panY) cameraState.panY = cam.panY;
        lastFocusX = focus.x;
        lastFocusY = focus.y;
        const { scaleX, scaleY } = cam;
        layoutScaleX = scaleX;
        layoutScaleY = scaleY;
        offsetX = cam.offsetX;
        offsetY = cam.offsetY;
        // 放大（scale > 1）时按比例提高文字纹理分辨率，避免字形被拉糊。
        const wantedResolution = Math.min(4, (window.devicePixelRatio || 1) * Math.max(1, scaleX, scaleY));
        if (wantedResolution !== textResolution) {
            textResolution = wantedResolution;
            for (const column of tileSprites) for (const t of column) t.resolution = wantedResolution;
            for (const t of entitySprites) t.resolution = wantedResolution;
        }
        // 四个图层同步缩放 + 居中。toLocal 走完整的仿射逆矩阵，x/y 缩放不同
        // （stretch 模式）也会被正确换算，因此指针→格子的映射
        // （pointermove / pointerup）无需另外处理。
        for (const layer of [bgGraphics, tileLayer, entityLayer, floatLayer]) {
            layer.position.set(offsetX, offsetY);
            layer.scale.set(scaleX, scaleY);
        }
        // 命中区 = 画布容器区域（stage 坐标即 CSS 像素，autoDensity）。
        // 旧实现用 window 尺寸，侧栏右侧的点击会被映射到错误的格子。
        pixiApp.stage.hitArea = new PIXI.Rectangle(0, 0, el.clientWidth, el.clientHeight);
    };

    // P2-6：地图缩放模式切换不改变容器尺寸（ResizeObserver 不会触发），
    // 需显式走同一条 applyLayout 重算路径，设置变更即时生效、无需刷新页面。
    stopScaleModeWatch = watch(() => displaySettings.mapScaleMode, () => applyLayout());
    // FE-1：缩放级 / 平移量变化同样走 applyLayout（纯显示，不影响玩法）。
    stopCameraWatch = watch(() => [cameraState.zoom, cameraState.panX, cameraState.panY, cameraState.fit], () => applyLayout());

    const game = activeGame;
    removeSquareBodyDiagnostics = installSquareBodyDiagnostics(game);
    removeHeldInputContext = registerHeldInputContext(() => [
        game.isInventoryOpen, game.referenceScreen, game.inspectTarget,
        game.pendingArcana, game.isThrowing, game.pendingEnchantment,
        game.pendingIdentify, game.pendingUseConfirm, logger.pendingAcknowledgment,
        game.isGameOver, game.replayRecording, game.replayStatus === 'playing',
    ]);
    frameProfile = new URLSearchParams(window.location.search).get('profile') === '1' ? new FrameProfile() : null;
    if (frameProfile) {
        let started = 0;
        const observer = {
            prerender() { started = performance.now(); },
            postrender() { frameProfile?.record('rendererCpuMs', performance.now() - started); },
        };
        // Renderer CPU submission, not GPU elapsed time; disabled in normal play.
        pixiApp.renderer.runners.prerender.add(observer);
        pixiApp.renderer.runners.postrender.add(observer);
    }
    // P2-4 动画节奏（决策 E1-修订，CE Time.c:2704 口径）：UI 挂载后启用分步
    // 推进——常规动作（≤100 tick）零插帧、下一渲染帧即完成；慢回合（>100
    // tick）在 100-tick 客观块处暂停 25ms 各一次；自动寻路/探索在引擎侧直接
    // 同步推进（isAutoTraveling），不再每步吃动画。推进进行中输入锁生效。
    // headless（无渲染）环境不挂载本组件，animationEnabled 保持 false，同步推进。
    game.animationEnabled = true;
    inputManager.setCallback((action, data) => {
        if (props.displayModalOpen) return;
        syncHeldInputContext();
        game.handlePlayerAction(action, data);
        syncHeldInputContext();
        game.update();
    });
    inputManager.setUnboundKeyCallback(() => {
        if (props.displayModalOpen) return;
        if (!game.isAutoTraveling()) return;
        game.handlePlayerAction('interrupt_auto');
        game.update();
    });

    const renders = new RenderRequests();
    const renderProjection = (frame: DisplayFrame) => {
        telegraphGraphics.clear();
        paintCombatTelegraphs(telegraphGraphics, frame.telegraphs, TILE_SIZE);
        bgGraphics.clear(); vectorTerrain.clear(); vectorEntities.clear(); arcanaCursor.clear(); bodyGraphics.clear();
        for (const body of frame.map.bodies) paintBody(bodyGraphics, body, TILE_SIZE);
        arcanaPrompt.value = frame.arcana ? i18next.t('arcana.target_prompt', {
            interpolation: { escapeValue: false }, name: frame.arcana.name,
            defaultValue: '{{name}} — hjklyubn / arrows: aim · Tab: next · Enter / click: cast · Esc: cancel',
        }) : '';
        if (frame.arcana) {
            if (frame.arcana.maxDistance !== null) arcanaPrompt.value += i18next.t('arcana.blink_range', { distance: frame.arcana.maxDistance });
            for (const p of frame.arcana.path) arcanaCursor.rect(p.x * TILE_SIZE, p.y * TILE_SIZE, TILE_SIZE, TILE_SIZE).fill(ARCANA_TRAJECTORY_FILL);
            drawTargetBody(frame.arcana.cursor, arcanaCursorStroke.color, frame);
            arcanaCursor.rect(frame.arcana.cursor.x * TILE_SIZE, frame.arcana.cursor.y * TILE_SIZE, TILE_SIZE, TILE_SIZE).stroke(arcanaCursorStroke);
        }
        if (frame.throwAim && !frame.arcana) {
            drawTargetBody(frame.throwAim, THROW_AIM_STROKE, frame);
            arcanaCursor.rect(frame.throwAim.x * TILE_SIZE, frame.throwAim.y * TILE_SIZE, TILE_SIZE, TILE_SIZE).fill(THROW_AIM_FILL);
            arcanaCursor.rect(frame.throwAim.x * TILE_SIZE, frame.throwAim.y * TILE_SIZE, TILE_SIZE, TILE_SIZE).stroke({ width: 2, color: THROW_AIM_STROKE });
        }
        for (let x = 0; x < DCOLS; x++) for (let y = 0; y < DROWS; y++) {
            const tile = frame.map.columns[x]?.[y];
            const sprite = tileSprites[x]![y]!;
            if (!tile) { sprite.visible = false; continue; }
            if (tile.bgColor !== null) bgGraphics.paint(tile.bgColor, x, y, TILE_SIZE);
            paintMapText(sprite, tile.semantic, tile.color, mapMode.value, x, y, TILE_SIZE, true);
            if (mapMode.value === 'tiles') sprite.visible = paintVectorTile(vectorTerrain, tile.semantic, tile.color, x, y, TILE_SIZE);
        }
        bgGraphics.finish(); vectorTerrain.finish();
        let entityIdx = 0;
        for (const entity of frame.map.entities) {
            if (entityIdx >= MAX_ENTITY_SPRITES) break;
            const sprite = entitySprites[entityIdx++]!;
            paintMapText(sprite, entity.semantic, entity.color, mapMode.value, entity.x, entity.y, TILE_SIZE);
            if (mapMode.value !== 'original' && tileSprites[entity.x]?.[entity.y]) tileSprites[entity.x]![entity.y]!.visible = false;
            sprite.visible = mapMode.value !== 'tiles' || paintVectorTile(vectorEntities, entity.semantic, entity.color, entity.x, entity.y, TILE_SIZE);
            (sprite.style as TextStyle).dropShadow = entity.interactive && mapMode.value !== 'tiles'
                ? { color: entity.color as never, blur: mapMode.value === 'original' ? 8 : 2, distance: 0, angle: 0, alpha: mapMode.value === 'original' ? 0.8 : 0.3 } : false;
        }
        for (let i = entityIdx; i < MAX_ENTITY_SPRITES; i++) entitySprites[i]!.visible = false;
        const bolt = frame.bolt;
        boltSprite.visible = !!bolt && mapMode.value !== 'tiles';
        if (bolt) {
            paintMapText(boltSprite, projectileSemantic(bolt.char), bolt.color, mapMode.value, bolt.x, bolt.y, TILE_SIZE);
            if (mapMode.value === 'tiles') paintVectorTile(vectorEntities, projectileSemantic(bolt.char), bolt.color, bolt.x, bolt.y, TILE_SIZE);
        }
        vectorEntities.finish();
        let floatIdx = 0;
        for (const ft of frame.floatingTexts) {
            if ((!displaySettings.showDamageNumbers && /^-\d+$/.test(ft.text)) || floatIdx >= MAX_FLOAT_SPRITES) continue;
            const sprite = floatSprites[floatIdx++]!;
            sprite.text = mapMode.value === 'hanzi' ? floatingHanzi(ft.text) : normalizeMapGlyph(ft.text);
            (sprite.style as TextStyle).fill = ft.color;
            (sprite.style as TextStyle).fontFamily = mapMode.value === 'hanzi' ? 'Noto Sans CJK SC, Microsoft YaHei, sans-serif' : 'Courier New';
            sprite.x = (ft.x + 0.5) * TILE_SIZE - sprite.width / 2; sprite.y = ft.y * TILE_SIZE;
            sprite.alpha = Math.max(0, ft.life / 30); sprite.visible = true;
        }
        for (let i = floatIdx; i < MAX_FLOAT_SPRITES; i++) floatSprites[i]!.visible = false;
    };
    const render = () => {
        const profileStart = frameProfile ? performance.now() : 0;
        drawHover();
        // FE-1：玩家移动后相机回到跟随（清掉临时平移）并重算视口
        const projection = displayedFrame(game);
        const focus = projection?.player ?? game.player.loc;
        if (focus.x !== lastFocusX || focus.y !== lastFocusY) {
            cameraState.panX = 0;
            cameraState.panY = 0;
            applyLayout();
        }
        if (projection) { renderProjection(projection); return; }
        // ---- Background rectangles (batch draw) ----
        bgGraphics.clear();
        vectorTerrain.clear();
        vectorEntities.clear();
        arcanaCursor.clear();
        bodyGraphics.clear();
        telegraphGraphics.clear();
        paintCombatTelegraphs(telegraphGraphics, readPublicCombatTelegraphs(game), TILE_SIZE);
        const selection = game.pendingArcana;
        arcanaPrompt.value = selection ? i18next.t('arcana.target_prompt', {
            interpolation: { escapeValue: false }, // Vue renders text; keep charge slash readable.
            name: selection.item.displayName,
            defaultValue: '{{name}} — hjklyubn / arrows: aim · Tab: next · Enter / click: cast · Esc: cancel'
        }) : '';
        if (selection) {
            const preview = game.getArcanaPreview();
            if (preview?.maxDistance !== null && preview?.maxDistance !== undefined) {
                arcanaPrompt.value += i18next.t('arcana.blink_range', { distance: preview.maxDistance });
            }
            for (const p of preview?.path ?? []) {
                arcanaCursor.rect(p.x * TILE_SIZE, p.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
                    .fill(ARCANA_TRAJECTORY_FILL);
            }
            drawTargetBody(selection.cursor, arcanaCursorStroke.color);
            arcanaCursor.rect(selection.cursor.x * TILE_SIZE, selection.cursor.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
                .stroke(arcanaCursorStroke);
        }
        // FE-1：触屏投掷的 UI 瞄准格（纯绘制；投掷模式结束即清除）
        const aim = targetingState.aim;
        if (aim && !game.isThrowing) clearAim();
        else if (aim && !selection) {
            drawTargetBody(aim, THROW_AIM_STROKE);
            arcanaCursor.rect(aim.x * TILE_SIZE, aim.y * TILE_SIZE, TILE_SIZE, TILE_SIZE).fill(THROW_AIM_FILL);
            arcanaCursor.rect(aim.x * TILE_SIZE, aim.y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
                .stroke({ width: 2, color: THROW_AIM_STROKE });
        }
        const hallucinating = !!game.player.statusDurations.hallucinating;
        const telepathyRevealed = !!game.player.statusDurations.telepathy;
        // 和动态光照使用同一张地图持有的显示随机流，避免重绘改变录像 RNG 检查点。
        // 仍由 Appearance 的 ctx 决定何时取数；这里仅绑定显示流 owner。
        const displayRng = displayRandom(game.grid);
        const cosmeticPercent = (percent: number) => displayRng.randPercent(percent);
        const cosmeticPick = <T,>(list: readonly T[]) => list[displayRng.randRange(0, list.length - 1)]!;
        const cosmetic: CosmeticRng = { percent: cosmeticPercent, pick: cosmeticPick };

        // ---- Tiles ----
        // UI-1 第 3 条接线：地面物品索引（探测魔法符号需要知道格子上有什么）。
        // 每帧建一次 O(items)，避免 3713 格 × 线性扫描。
        const itemAtCell = new Map<string, (typeof game.items)[number]>();
        const gasBackgrounds = new Map<string, number>();
        for (const item of game.items) {
            itemAtCell.set(`${item.loc.x},${item.loc.y}`, item);
        }

        for (let x = 0; x < DCOLS; x++) {
            for (let y = 0; y < DROWS; y++) {
                const cell = game.grid.getCell(x, y);
                const sprite = tileSprites[x]![y]!;

                // 该格画什么（字形/颜色/气体/光照/记忆/幻觉/探测符号）全部由
                // 纯函数决定；null = 未探索且不可见，什么都不画。
                // lightChannels = CE tmap.light 三通道（LightMap.lightAt），
                // UI-1 第 7 条起渲染按 CE 乘法消费；groundItem/carriedItem =
                // 探测魔法符号的 ctx 取值（web Monster 无载物载体，恒 null 留形）。
                const visual = cell
                    ? cellAppearance(cell, {
                        gas: game.environment.gasGrid[x]?.[y],
                        lightChannels: game.lightMap.lightAt(x, y),
                        dancingLightChannels: game.lightMap.renderLightAt(x, y),
                        terrainRandomValues: terrainRandomValues(cell, game.grid),
                        flareChannels: game.flareLightAt(x, y),
                        flashChannels: game.terrainFlashAt(x, y),
                        depth: game.depth,
                        groundItem: itemAtCell.get(`${x},${y}`) ?? null,
                        carriedItem: null,
                        hallucinating,
                        cosmetic,
                    })
                    : null;

                if (!visual) {
                    sprite.visible = false;
                    continue;
                }

                const { color, bgColor } = visual;
                if (bgColor !== null) {
                    gasBackgrounds.set(`${x},${y}`, bgColor);
                }

                // Update background rect
                if (bgColor !== null) {
                    bgGraphics.paint(bgColor, x, y, TILE_SIZE);
                }

                // Replace only after the authoritative appearance/visibility gate.
                const tile = terrainSemantic(cell!, visual, hallucinating);
                paintMapText(sprite, tile, color, mapMode.value, x, y, TILE_SIZE, true);
                if (mapMode.value === 'tiles') {
                    sprite.visible = paintVectorTile(vectorTerrain, tile, color, x, y, TILE_SIZE);
                }

            }
        }

        bgGraphics.finish();
        vectorTerrain.finish();

        // ---- Entities ----
        let entityIdx = 0;

        // Helper to place an entity sprite
        const placeEntity = (
            _text: string,
            color: string | number,
            ex: number,
            ey: number,
            isInteractive: boolean = false,
            semantic: TileSemantic
        ) => {
            if (entityIdx >= MAX_ENTITY_SPRITES) return;
            const s = entitySprites[entityIdx]!;
            paintMapText(s, semantic, color, mapMode.value, ex, ey, TILE_SIZE);
            if (mapMode.value !== 'original' && tileSprites[ex]?.[ey]) tileSprites[ex]![ey]!.visible = false;
            const showLabel = mapMode.value !== 'tiles' || paintVectorTile(vectorEntities, semantic, color, ex, ey, TILE_SIZE);

            if (isInteractive && mapMode.value !== 'tiles') {
                (s.style as TextStyle).dropShadow = {
                    color: color as never,
                    blur: mapMode.value === 'original' ? 8 : 2,
                    distance: 0,
                    angle: 0,
                    alpha: mapMode.value === 'original' ? 0.8 : 0.3,
                };
            } else {
                (s.style as TextStyle).dropShadow = false;
            }

            s.visible = showLabel;
            entityIdx++;
        };

        // Items
        for (let x = 0; x < DCOLS; x++) for (let y = 0; y < DROWS; y++) {
            const cell = game.grid.getCell(x, y);
            if (cell) {
                const visual = rememberedItemAppearance(cell);
                if (visual) placeEntity(visual.char, visual.color, x, y, visual.interactive, rememberedItemSemantic(cell, visual.char));
            }
        }
        for (const item of game.items) {
            const cell = game.grid.getCell(item.loc.x, item.loc.y);
            const visual = itemAppearance(item, {
                cellVisible: !!cell?.isVisible,
                cellHasMemory: !!cell?.hasMemory,
                telepathy: telepathyRevealed,
                hallucinating,
                cosmetic,
            });
            if (visual && cell?.isVisible) {
                placeEntity(visual.char, visual.color, item.loc.x, item.loc.y, visual.interactive, itemSemantic(item, visual.char, hallucinating));
            }
        }

        // Generic visible world markers remain subordinate to hazards, items
        // and actors. Their source is a detached engine DTO, never module state.
        const interactables = game.readVisibleInteractables();
        if (interactables.length) {
            const occupied = new Set([
                ...game.items.filter(item => game.grid.getCell(item.loc.x, item.loc.y)?.isVisible)
                    .map(item => `${item.loc.x},${item.loc.y}`),
                ...game.monsters.flatMap(monster => publicMonsterMapCells(game.player, game.grid, monster).map(p => `${p.x},${p.y}`)),
            ]);
            for (const marker of readInteractableMapMarkers(interactables, {
                depth: game.depth, player: game.player.loc, occupied,
                cellAt: (x, y) => game.grid.getCell(x, y),
            })) placeEntity(marker.glyph, marker.color, marker.x, marker.y, true, marker.semantic);
        }

        // Monsters
        for (const m of game.monsters) {
            if (m.spatial) {
                const display = observeDisplayMonster(game, m, cosmetic, gasBackgrounds);
                if (display) {
                    if (display.body) paintBody(bodyGraphics, display.body, TILE_SIZE);
                    const entity = display.entity;
                    placeEntity(entity.semantic.original, entity.color, entity.x, entity.y, entity.interactive, entity.semantic);
                }
                continue;
            }
            const cell = game.grid.getCell(m.loc.x, m.loc.y);
            const direct = canDirectlySeeMonster(game.player, game.grid, m);
            const known = canSeeMonster(game.player, game.grid, m);
            const visual = monsterAppearance(m, {
                cellVisible: !!cell?.isVisible,
                cellHasMemory: !!cell?.hasMemory,
                telepathy: telepathyRevealed || m.hasStatus('entranced'),
                hallucinating,
                cosmetic,
                monsterVisibility: direct ? 'direct' : known ? 'known' : canDisplayMonster(game.player, game.grid, m) ? 'marker' : 'hidden',
                gasBackground: monsterInGas(game.grid, m)
                    ? gasBackgrounds.get(`${m.loc.x},${m.loc.y}`) : undefined,
            });
            if (visual) {
                placeEntity(visual.char, visual.color, m.loc.x, m.loc.y, visual.interactive, monsterSemantic(m, visual.char, hallucinating, !direct && !known));
            }
        }

        // Player (always visible)
        const playerVisual = playerAppearance(game.player);
        placeEntity(playerVisual.char, playerVisual.color, game.player.loc.x, game.player.loc.y, playerVisual.interactive, playerSemantic(playerVisual.char));

        // Hide unused entity sprites
        for (let i = entityIdx; i < MAX_ENTITY_SPRITES; i++) {
            entitySprites[i]!.visible = false;
        }

        // ---- Bolt projectile ----
        const boltFrame = game.getCurrentBoltFrame();
        if (boltFrame) {
            paintMapText(boltSprite, projectileSemantic(boltFrame.char), boltFrame.color, mapMode.value, boltFrame.x, boltFrame.y, TILE_SIZE);
            const hexColor = '#' + boltFrame.color.toString(16).padStart(6, '0');
            (boltSprite.style as TextStyle).fill = hexColor as never;
            (boltSprite.style as TextStyle).dropShadow = {
                color: hexColor as never,
                blur: 14,
                distance: 0,
                angle: 0,
                alpha: 0.95
            };
            boltSprite.visible = mapMode.value !== 'tiles';
            if (mapMode.value === 'tiles') paintVectorTile(vectorEntities, projectileSemantic(boltFrame.char), boltFrame.color, boltFrame.x, boltFrame.y, TILE_SIZE);
        } else {
            boltSprite.visible = false;
        }

        vectorEntities.finish();

        // ---- Floating texts ----
        let floatIdx = 0;
        for (const ft of game.floatingTexts) {
            if (!displaySettings.showDamageNumbers && /^-\d+$/.test(ft.text)) continue;
            if (floatIdx >= MAX_FLOAT_SPRITES) break;
            const s = floatSprites[floatIdx]!;
            s.text = mapMode.value === 'hanzi' ? floatingHanzi(ft.text) : normalizeMapGlyph(ft.text);
            (s.style as TextStyle).fontFamily = mapMode.value === 'hanzi' ? 'Noto Sans CJK SC, Microsoft YaHei, sans-serif' : 'Courier New';
            (s.style as TextStyle).fill = ft.color;
            s.x = (ft.x + 0.5) * TILE_SIZE - s.width / 2;
            s.y = ft.y * TILE_SIZE;
            s.alpha = Math.max(0, ft.life / 30);
            s.visible = true;
            floatIdx++;
        }
        for (let i = floatIdx; i < MAX_FLOAT_SPRITES; i++) {
            floatSprites[i]!.visible = false;
        }
        frameProfile?.record('drawCpuMs', performance.now() - profileStart);
    };

    // DESIGN-3b browser regression: resizeTo only listened to window resize.
    // Observe the container and merge notifications in rAF, sizing the renderer
    // before updating the camera/hit area without recreating the Application.
    removeCanvasResizeObserver = observeCanvasResize(canvasContainer.value, pixiApp.renderer, () => {
        applyLayout(); renders.request();
    });
    stopTileModeWatch = watch(mapMode, () => { applyLayout(); renders.request(); });
    stopImmersiveWatch = watch(() => displaySettings.immersiveMode, () => {
        removeOcclusionObserver?.();
        removeOcclusionObserver = null;
        if (displaySettings.immersiveMode && canvasContainer.value) {
            removeOcclusionObserver = observeMapOcclusions(canvasContainer.value, () => { applyLayout(); renders.request(); });
        }
        applyLayout(); renders.request();
    }, { immediate: true, flush: 'post' });
    game.onRenderRequested = () => { syncHeldInputContext(); renders.request(); };

    (window as Window & { render_game_to_text?: () => string }).render_game_to_text = () => {
        const frame = displayedFrame(game);
        const visibleMonsters = game.monsters
            .filter((m) => canSeeMonster(game.player, game.grid, m))
            .map((m) => ({ name: m.name, x: m.loc.x, y: m.loc.y, hp: m.hp,
                maxHp: m.maxHp, weaknessAmount: m.weaknessAmount, maxStatus: { ...m.maxStatus }, accuracy: m.accuracy, defense: m.defense, damage: m.damageString,
                newPowerCount: m.newPowerCount, totalPowerCount: m.totalPowerCount,
                targetCorpseLoc: m.targetCorpseLoc && { ...m.targetCorpseLoc }, targetCorpseName: m.targetCorpseName,
                corpseAbsorptionCounter: m.corpseAbsorptionCounter, isAbsorbing: m.isAbsorbing,
                absorptionFlags: m.absorptionFlags, absorbBehavior: m.absorbBehavior, absorptionBolt: m.absorptionBolt,
                wasNegated: m.wasNegated, negated: m.displaysNegation, mutation: m.mutation?.id ?? null,
                behaviorFlags: [...m.behaviorFlags], abilityFlags: [...m.abilityFlags], bolts: [...m.bolts],
                typeId: m.typeId, isAlly: m.isAlly, boundToPlayer: m.boundToPlayer,
                dominated: m.dominated, isCaged: m.isCaged, leaderId: m.leader?.id ?? null,
                discordant: m.getStatusDuration('discordant'), entranced: m.getStatusDuration('entranced'),
                doesNotTrackLeader: m.doesNotTrackLeader, ticksUntilTurn: m.ticksUntilTurn,
                poisonAmount: m.poisonAmount, poisoned: m.getStatusDuration('poisoned'),
                shield: m.getStatusDuration('shielded'), maxShield: m.maxShield }));
        const revealedLocations = game.monsters
            .filter((m) => !canSeeMonster(game.player, game.grid, m) && canDisplayMonster(game.player, game.grid, m))
            .map((m) => ({ x: m.loc.x, y: m.loc.y, marker: 'x' }));
        const visibleItems = game.items
            .filter((i) => game.grid.getCell(i.loc.x, i.loc.y)?.isVisible)
            .map((i) => ({ name: i.displayName, x: i.loc.x, y: i.loc.y }));

        return JSON.stringify({
            mapStyle: mapMode.value,
            presentation: presentationTimeline(game)?.diagnostics ?? { simulationTurn: game.absoluteTurnNumber, displayTurn: game.absoluteTurnNumber },
            seed: game.currentSeed,
            acknowledgment: logger.pendingAcknowledgment?.text ?? null,
            pendingCommand: game.pendingCommandConfirmation?.ownerCommandId ?? null,
            confirmation: game.pendingCommandConfirmation?.message ?? null,
            mode: frame ? frame.targeting : game.pendingEnchantment ? 'enchantment_target' : game.pendingArcana ? 'arcana_target' : game.isInventoryOpen ? 'inventory' : (game.isThrowing ? 'throw_target' : 'explore'),
            enchantmentTargets: game.pendingEnchantment
                ? game.player.inventory.items.filter(item => game.canEnchantTarget(item)).map(item => ({ id: item.id, name: item.displayName })) : [],
            arcanaPreview: frame ? frame.arcana : game.getArcanaPreview(),
            arcanaTarget: game.pendingArcana ? { name: game.pendingArcana.item.displayName, ...game.pendingArcana.cursor } : null,
            coordinateSystem: { origin: 'top-left', xAxis: 'right', yAxis: 'down' },
            player: frame ? { ...frame.player, statuses: frame.player.statuses } : {
                weaknessAmount: game.player.weaknessAmount, effectiveStrength: game.player.effectiveStrength, maxStatus: { ...game.player.maxStatus },
                x: game.player.loc.x,
                y: game.player.loc.y,
                hp: game.player.hp,
                nutrition: game.player.nutrition,
                poisonAmount: game.player.poisonAmount,
                maxShield: game.player.maxShield,
                statuses: { ...game.player.statusDurations }
            },
            replay: {
                status: game.replayStatus,
                cursor: game.replayCursor,
                total: game.replayEvents.length
            },
            recordedInputEvents: game.recordedInputEvents.length,
            // FE-1：自动化验收用的只读补充——已知（见过/记得）的楼梯位置与背包清单
            depth: frame?.depth ?? game.depth,
            knownStairs: (() => {
                const s = game.levelSeeds[game.depth - 1];
                const known = (p?: { x: number; y: number }) => {
                    const c = p ? game.grid.getCell(p.x, p.y) : undefined;
                    return p && c && (c.isVisible || c.hasMemory) ? { x: p.x, y: p.y } : null;
                };
                return { down: known(s?.downStairsLoc), up: known(s?.upStairsLoc) };
            })(),
            inventory: game.player.inventory.items.map((i) => ({ letter: i.inventoryLetter, name: i.displayName, category: i.category })),
            isThrowing: game.isThrowing,
            referenceScreen: game.referenceScreen,
            // 画布内格子 → CSS 像素：x = offsetX + (cell + 0.5) * tile * scaleX
            mapLayout: { offsetX, offsetY, scaleX: layoutScaleX, scaleY: layoutScaleY, tile: TILE_SIZE, follow: cameraState.follow },
            autoPathLength: game.autoPath.length,
            monsters: frame ? frame.rows.filter(row => row.kind === 'monster') : visibleMonsters,
            revealedLocations: frame ? frame.map.entities.filter(entity => entity.semantic.kind === 'marker').map(entity => ({ x: entity.x, y: entity.y })) : revealedLocations,
            interactables: frame?.interactables ?? game.readVisibleInteractables(),
            items: frame ? frame.rows.filter(row => row.kind === 'item') : visibleItems
        });
    };

    (window as Window & { export_game_recording?: () => string }).export_game_recording = () =>
        JSON.stringify(game.exportRecording());

    (window as Window & { import_game_recording?: (json: string) => void }).import_game_recording = (json: string) => {
        game.loadReplay(JSON.parse(json));
    };

    (window as Window & { run_game_turn?: () => void }).run_game_turn = () => {
        game.update();
    };

    (window as Window & { tick_replay?: () => void }).tick_replay = () => {
        game.tickReplay();
    };

    (window as Window & { force_replay_step?: () => void }).force_replay_step = () => {
        game.replayStep(true);
    };

    pixiApp.canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    // Mouse interactions
    pixiApp.stage.eventMode = 'static';
    // hitArea 初值已在 applyLayout 中按容器尺寸设置（含 ResizeObserver 跟随）

    const mousePan = new MousePanTracker();
    let mousePointer: number | null = null;
    let suppressMouseClick = false;
    let suppressTimer = 0;
    const onMouseDown = (e: PointerEvent) => {
        if (dialogInput.busy()) return;
        if (e.pointerType !== 'mouse') return;
        window.clearTimeout(suppressTimer);
        suppressMouseClick = false;
        if (e.button !== 0 || !cameraState.follow) return;
        mousePointer = e.pointerId;
        mousePan.down(e.pointerId, e.clientX, e.clientY);
        try { pixiApp!.canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    };
    const onMouseMove = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        const pan = mousePan.move(e.pointerId, e.clientX, e.clientY);
        if (!pan.dragging) return;
        suppressMouseClick = true;
        cameraState.panX += pan.dx;
        cameraState.panY += pan.dy;
        game.clearHover();
        drawHover();
        pixiApp!.canvas.style.cursor = 'grabbing';
    };
    const onMouseUp = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return;
        if (mousePan.up(e.pointerId)) {
            suppressMouseClick = true;
            e.preventDefault();
            suppressTimer = window.setTimeout(() => { suppressMouseClick = false; }, 0);
        }
        pixiApp!.canvas.style.cursor = cameraState.follow ? 'grab' : 'crosshair';
        try { pixiApp!.canvas.releasePointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        mousePointer = null;
    };
    const onMouseCancel = () => { mousePan.cancel(); suppressMouseClick = false; };
    const removeMouseHold = registerHeldInput(() => {
        mousePan.cancel();
        window.clearTimeout(suppressTimer);
        suppressMouseClick = true;
        if (mousePointer !== null) {
            try { pixiApp!.canvas.releasePointerCapture(mousePointer); } catch { /* cancelled pointer */ }
            mousePointer = null;
        }
    });
    const onMapWheel = (e: WheelEvent) => {
        if (!shouldHandleMapWheel(e)) return; // browser Ctrl/Cmd zoom remains native
        e.preventDefault();
        zoomBy(wheelZoomFactor(e.deltaY));
    };
    pixiApp.canvas.addEventListener('pointerdown', onMouseDown);
    pixiApp.canvas.addEventListener('pointermove', onMouseMove);
    pixiApp.canvas.addEventListener('pointerup', onMouseUp);
    pixiApp.canvas.addEventListener('pointercancel', onMouseCancel);
    pixiApp.canvas.addEventListener('wheel', onMapWheel, { passive: false });

    pixiApp.stage.on('pointermove', (e) => {
        // FE-1：触屏拖动是平移相机，不应让悬停提示跟着手指闪；触屏查看走长按。
        if (e.pointerType !== 'mouse' || mousePan.isDragging) return;
        if (game.isInventoryOpen || game.referenceScreen || game.pendingArcana || game.isThrowing) {
            game.clearHover();
            drawHover();
            return;
        }
        const localPt = tileLayer.toLocal(e.global);
        const mapX = Math.floor(localPt.x / TILE_SIZE);
        const mapY = Math.floor(localPt.y / TILE_SIZE);
        if (mapX >= 0 && mapX < DCOLS && mapY >= 0 && mapY < DROWS) {
           game.updateHover(mapX, mapY);
        } else {
           game.clearHover();
        }
        drawHover();
    });
    const onMouseLeave = () => { game.clearHover(); drawHover(); };
    pixiApp.canvas.addEventListener('pointerleave', onMouseLeave);

    const publicSquareAt = (x: number, y: number) => {
        const monster = game.getMonsterAt(x, y);
        return !!monster?.spatial && canSeeMonsterAt(game.player, game.grid, monster, { x, y });
    };

    // FE-1：触屏目标选择的命令落地（全部经 ui/commands 的录制边界）。
    const runTapCommand = (cmd: TapCommand) => {
        if (cmd.kind === 'none') return;
        if (cmd.kind === 'aim') {
            targetingState.aim = { x: cmd.x, y: cmd.y };
            renders.request(); // 纯显示：下一帧画出瞄准格
            return;
        }
        if (cmd.kind === 'execute') {
            clearAim();
            travelTo(cmd.data.x, cmd.data.y);
            return;
        }
        if (cmd.action === 'move') dispatchCommand('move', cmd.data);
        else dispatchCommand(cmd.action);
    };

    /**
     * 一次"点选地图格"的完整语义（鼠标左/右键与触屏单击共用）。
     * 鼠标路径与 v0.1.0 完全一致，仅一处修正：投掷模式下点相邻格原先会被当成
     * "移动"（审查 P-18），现在与点远处格一样经 mouse_travel 投掷。
     * 触屏及公开 square 身体在投掷/法杖瞄准时使用"先瞄准、再确认"（ui/targeting.ts）。
     */
    const activateCell = (mapX: number, mapY: number, button: number, pointer: 'mouse' | 'touch') => {
        if (props.displayModalOpen) return;
        if (dialogInput.busy()) return;
        if (mapX < 0 || mapX >= DCOLS || mapY < 0 || mapY >= DROWS) return;
        if (game.pendingArcana) {
            if (pointer === 'touch' || publicSquareAt(mapX, mapY)) {
                if (button === 2) { dispatchCommand('escape'); return; }
                runTapCommand(targetingTapCommand('arcana', { x: mapX, y: mapY }, null, game.pendingArcana.cursor, game.player.loc));
                return;
            }
            if (button === 2) inputManager.triggerAction('escape');
            else if (button === 0) {
                game.executeCommand('mouse_travel', { x: mapX, y: mapY });
                game.update();
            }
            return; // Adjacent/origin clicks also belong to spell selection.
        }
        if (button === 2) {
            game.handleInspectAt(mapX, mapY);
            syncHeldInputContext();
            return;
        }

        if (game.isThrowing && game.throwItemTarget && !game.isInventoryOpen) {
            if (pointer === 'touch' || publicSquareAt(mapX, mapY)) {
                runTapCommand(targetingTapCommand('throw', { x: mapX, y: mapY }, targetingState.aim, null, game.player.loc));
                return;
            }
            if (mapX !== game.player.loc.x || mapY !== game.player.loc.y) {
                game.executeCommand('mouse_travel', { x: mapX, y: mapY });
                game.update();
            }
            return;
        }

        const dx = mapX - game.player.loc.x;
        const dy = mapY - game.player.loc.y;

        if (dx === 0 && dy === 0) {
            inputManager.triggerAction('move');
        } else if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
            let dir = Direction.NO_DIRECTION;
            if (dx === 0 && dy === -1)       dir = Direction.UP;
            else if (dx === 0 && dy === 1)   dir = Direction.DOWN;
            else if (dx === -1 && dy === 0)  dir = Direction.LEFT;
            else if (dx === 1 && dy === 0)   dir = Direction.RIGHT;
            else if (dx === -1 && dy === -1) dir = Direction.UPLEFT;
            else if (dx === 1 && dy === -1)  dir = Direction.UPRIGHT;
            else if (dx === -1 && dy === 1)  dir = Direction.DOWNLEFT;
            else if (dx === 1 && dy === 1)   dir = Direction.DOWNRIGHT;

            if (dir !== Direction.NO_DIRECTION) {
                inputManager.triggerAction('move', dir);
            }
        } else {
            game.executeCommand('mouse_travel', { x: mapX, y: mapY });
            game.update();
        }
    };

    pixiApp.stage.on('pointerup', (e) => {
        // FE-1：触屏/触控笔由下方手势识别器处理（区分单击/长按/拖动/捏合）
        if (e.pointerType !== 'mouse') return;
        if (dialogInput.busy() || suppressMouseClick || mousePan.isDragging) return;
        const localPt = tileLayer.toLocal(e.global);
        activateCell(Math.floor(localPt.x / TILE_SIZE), Math.floor(localPt.y / TILE_SIZE), e.button, 'mouse');
    });

    // ---------- FE-1：触屏手势（单击 / 长按查看 / 单指平移 / 双指缩放） ----------
    const canvasEl = pixiApp.canvas;
    const cellAtClient = (clientX: number, clientY: number) => {
        const rect = canvasEl.getBoundingClientRect();
        const localPt = tileLayer.toLocal(new PIXI.Point(clientX - rect.left, clientY - rect.top));
        return { x: Math.floor(localPt.x / TILE_SIZE), y: Math.floor(localPt.y / TILE_SIZE) };
    };
    const handleGestures = (events: GestureEvent[]) => {
        for (const ev of events) {
            if (ev.type === 'tap') {
                const cell = cellAtClient(ev.x, ev.y);
                activateCell(cell.x, cell.y, 0, 'touch');
            } else if (ev.type === 'longpress') {
                // 与桌面右键同一条只读路径：悬停描述 + 详情面板（不产生命令）
                const cell = cellAtClient(ev.x, ev.y);
                if (cell.x >= 0 && cell.x < DCOLS && cell.y >= 0 && cell.y < DROWS) {
                    game.updateHover(cell.x, cell.y);
                    game.handleInspectAt(cell.x, cell.y);
                    navigator.vibrate?.(15);
                }
            } else if (ev.type === 'pan') {
                if (cameraState.follow) {
                    cameraState.panX += ev.dx;
                    cameraState.panY += ev.dy;
                }
            } else if (ev.type === 'pinch') {
                zoomBy(ev.factor);
            }
        }
    };
    const removeMapTouchInput = bindMapTouchInput(canvasEl, handleGestures);
    removeTouchListeners = () => {
        removeMapTouchInput();
        window.clearTimeout(suppressTimer);
        canvasEl.removeEventListener('pointerdown', onMouseDown);
        removeMouseHold();
        canvasEl.removeEventListener('pointermove', onMouseMove);
        canvasEl.removeEventListener('pointerup', onMouseUp);
        canvasEl.removeEventListener('pointercancel', onMouseCancel);
        canvasEl.removeEventListener('pointerleave', onMouseLeave);
        canvasEl.removeEventListener('wheel', onMapWheel);
    };

    let pathingTimer = 0; // Display milliseconds, not rendered frame count.
    let colorTimer = 0;
    let lastProjection = displayedFrame(game);
    let lastInput = game.recordedInputEvents[game.recordedInputEvents.length - 1];
    let skipNextDisplayTime = false;
    const autoAllowed = () => !props.displayModalOpen && !game.replayRecording && !game.isTimePaused()
        && !game.hasPendingConfirmation && !game.isAdvancing && !game.isInputLocked() && !game.isGameOver
        && !presentationTimeline(game)?.busy && !dialogInput.busy() && !logger.pendingAcknowledgment && game.isAutoTraveling() && !document.hidden;
    const displayFrame = (elapsedMs: number, animationMs: number = elapsedMs) => {
        syncHeldInputContext();
        const profileNow = frameProfile ? performance.now() : 0;
        frameProfile?.frame(profileNow, game.isAutoTraveling());
        const report = frameProfile?.report(profileNow, { seed: game.currentSeed, depth: game.depth, turn: game.absoluteTurnNumber, mode: mapMode.value, geometryContexts: vectorGeometry?.size, position: [game.player.loc.x, game.player.loc.y], hp: game.player.hp, nutrition: game.player.nutrition, commands: game.recordedInputEvents.length });
        if (report) performanceReport.value = report;
        try {
            // Browsing freezes replay/auto travel. A skill may have already committed
            // its one native action while this panel stays open to prevent click-through;
            // drain only that in-flight advancement so its time/checkpoint can settle.
            if (props.displayModalOpen) {
                pathingTimer = 0;
                if (game.isAdvancing && !game.replayRecording) game.tickAdvancement(animationMs);
                // The panel can remain mounted through a skill's ACK. Drain its
                // display suffix too, without admitting replay or auto actions.
                presentationTimeline(game)?.tick(document.hidden ? 0 : animationMs);
                return;
            }
            const input = game.recordedInputEvents[game.recordedInputEvents.length - 1];
            if (input !== lastInput) {
                // A manual stop/restart can occur between frames. It starts a fresh
                // interval; autonomous commands retain the remaining display time.
                if (input?.action !== 'auto_step') pathingTimer = 0;
                lastInput = input;
            }
            if (document.hidden || skipNextDisplayTime) elapsedMs = 0;
            skipNextDisplayTime = false;
            const autoWasAllowed = autoAllowed();
            game.tickReplay(elapsedMs);

            // Advancement keeps its existing clamped animation-time clock.
            game.tickAdvancement(animationMs);
            presentationTimeline(game)?.tick(document.hidden ? 0 : animationMs);
            if (game.isTimePaused()) {
                pathingTimer = 0;
                return;
            }

            if (game.floatingTexts.length > 0) {
                game.floatingTexts.forEach(ft => ft.update());
                game.floatingTexts = game.floatingTexts.filter(ft => ft.life > 0);
                renders.request();
            }

            const boltChanged = game.tickBoltAnimation();
            const flareChanged = game.tickFlareAnimation(animationMs);
            const terrainChanged = tickTerrainColors(game.grid, animationMs, game.depth);
            colorTimer += animationMs;
            const lightChanged = colorTimer >= 50;
            if (lightChanged) { colorTimer %= 50; game.lightMap.dance(); }
            if (boltChanged || flareChanged || terrainChanged || lightChanged) renders.request();

            pathingTimer = stepCadence(pathingTimer, autoWasAllowed ? elapsedMs : 0,
                AUTO_ACTION_INTERVAL_MS, autoAllowed, () => {
                    const stepStart = frameProfile ? performance.now() : 0;
                    game.stepAutoPath();
                    game.update();
                    frameProfile?.record('autoStepCpuMs', performance.now() - stepStart);
                });
        } finally {
            syncHeldInputContext();
            const nextProjection = displayedFrame(game);
            if (nextProjection !== lastProjection) { lastProjection = nextProjection; renders.request(); }
            // Present requested overlays and final states even while paused.
            renders.flush(render);
        }
    };
    const resetDisplayClock = () => {
        pathingTimer = 0;
        game.tickReplay(0);
        skipNextDisplayTime = true;
    };
    document.addEventListener('visibilitychange', resetDisplayClock);
    removeDisplayClockListener = () => document.removeEventListener('visibilitychange', resetDisplayClock);
    pixiApp.ticker.add(ticker => displayFrame(ticker.elapsedMS, ticker.deltaMS));

    // Exercise the real display loop with deterministic nominal frames.
    (window as Window & { advanceTime?: (ms: number) => void }).advanceTime = (ms: number) => {
        if (!Number.isFinite(ms) || ms <= 0) return;
        let remaining = ms;
        while (remaining > 1e-7) {
            const frameMs = Math.min(remaining, DISPLAY_FRAME_MS);
            displayFrame(frameMs);
            remaining -= frameMs;
        }
    };

    game.update(); // Compute initial FOV and trigger first render
  }
});

onUnmounted(() => {
  // P2-2：组件卸载后没有 ticker 驱动动画了，关闭分步推进并丢弃在途推进，
  // 避免遗留一个只能等 5s 超时才解锁的输入锁
  activeGame.animationEnabled = false;
  activeGame.discardInFlightAdvancement();

  removeCanvasResizeObserver?.();
  removeCanvasResizeObserver = null;

  stopTileModeWatch?.();
  stopScaleModeWatch?.();
  stopScaleModeWatch = null;
  stopCameraWatch?.();
  stopCameraWatch = null;
  stopImmersiveWatch?.();
  stopImmersiveWatch = null;
  removeOcclusionObserver?.();
  removeOcclusionObserver = null;
  removeDisplayClockListener?.();
  removeDisplayClockListener = null;
  removeTouchListeners?.();
  removeTouchListeners = null;
  removeSquareBodyDiagnostics?.();
  removeSquareBodyDiagnostics = null;
  removeHeldInputContext?.();
  removeHeldInputContext = null;
  clearAim();

  delete (window as Window & { advanceTime?: (ms: number) => void }).advanceTime;
  delete (window as Window & { render_game_to_text?: () => string }).render_game_to_text;
  delete (window as Window & { export_game_recording?: () => string }).export_game_recording;
  
  if (activeGame.onRenderRequested) {
      activeGame.onRenderRequested = null;
  }
  
  destroyRetainedDrawing?.();
  destroyRetainedDrawing = null;
  if (pixiApp) {
    pixiApp.destroy(true, { children: true, texture: true });
    pixiApp = null;
  }
  vectorGeometry?.destroy();
  vectorGeometry = null;
});
</script>

<template>
  <div class="game-container" ref="canvasContainer" tabindex="-1">
    <aside v-if="performanceReport" class="performance-profile"><button @click="resetProfile">{{ i18next.t('performance.reset') }}</button><pre data-testid="game-performance">{{ performanceReport }}</pre></aside>
    <div v-if="arcanaPrompt" class="arcana-prompt" role="status">{{ arcanaPrompt }}</div>
  </div>
</template>

<style scoped>
.performance-profile { position:absolute; top:8px; left:8px; z-index:5; max-height:80%; overflow:auto; background:#101820eb; color:#def; font:11px monospace; padding:6px; }
.performance-profile pre { margin:4px 0 0; pointer-events:none; }
.arcana-prompt {
  position: absolute;
  top: 52px;
  left: 12px;
  right: 12px;
  z-index: 1;
  padding: 8px;
  color: #ddd;
  background: #181818e8;
  pointer-events: none;
}
/* FE-1：紧凑模式下由 TargetBar 显示触屏版提示与确认/取消按钮 */
@media (max-width: 1023px), (max-height: 599px) {
  .arcana-prompt { display: none; }
}
.game-container {
  position: relative;
  width: 100%;
  height: 100%;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  overflow: hidden;
  background-color: #000;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
