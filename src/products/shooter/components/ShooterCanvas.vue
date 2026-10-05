<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Application, Container, Graphics } from 'pixi.js';
import { computeMapCamera } from '../../../ui/mapCamera';
import { TerrainType } from '../../../engine/Map/Grid';
import { createShooterArena, ARENA_WIDTH, ARENA_HEIGHT } from '../ShooterArena';
import type { ShooterSnapshot } from '../ShooterSession';

const props = defineProps<{ previous: ShooterSnapshot; current: ShooterSnapshot; alpha: number }>();
const surface = ref<HTMLDivElement>();
let app: Application | null = null, world: Container | null = null, actors: Graphics | null = null, overview: Graphics | null = null;
let resize: ResizeObserver | null = null, disposed = false;
const TILE = 1024, grid = createShooterArena();
function terrainColor(x: number, y: number): number {
    const cell = grid.getCell(x, y)!;
    if (!cell.isPassable) return 0x4e6256;
    if (cell.layers.includes(TerrainType.PLAIN_FIRE)) return 0x783b28;
    if (cell.layers.includes(TerrainType.POISON_GAS)) return 0x465d31;
    if (cell.layers.includes(TerrainType.WATER_SHALLOW)) return 0x234c60;
    if (cell.layers.includes(TerrainType.OPEN_DOOR)) return 0x778057;
    return (x + y) % 2 ? 0x17271f : 0x192b22;
}
function interpolated(index: number) {
    const current = props.current.actors[index]!.pose, previous = props.previous.actors[index]!.pose;
    return { x: previous.x + (current.x - previous.x) * props.alpha, y: previous.y + (current.y - previous.y) * props.alpha };
}
function draw(): void {
    if (!actors || !app || !world || !overview) return;
    const focus = interpolated(0);
    // Existing camera math, fed fractional cell focus instead of Creature.loc.
    const camera = computeMapCamera(app.screen.width, app.screen.height,
        { scaleX: 16 / TILE, scaleY: 16 / TILE, offsetX: 0, offsetY: 0 },
        ARENA_WIDTH, ARENA_HEIGHT, TILE, { x: focus.x / TILE - .5, y: focus.y / TILE - .5 }, 2, { x: 0, y: 0 }, false);
    world.scale.set(camera.scaleX, camera.scaleY); world.position.set(camera.offsetX, camera.offsetY);
    actors.clear();
    const displayTick = props.previous.tick + (props.current.tick - props.previous.tick) * props.alpha;
    for (const [index, actor] of props.current.actors.entries()) {
        const p = interpolated(index), color = index === 0 ? 0xd2ef9b : 0x76bbde;
        const age = Math.max(0, displayTick - actor.lastPulseTick);
        if (actor.resolved && age < 18) actors.circle(p.x, p.y, actor.radius + age * 28).stroke({ color, width: 30, alpha: 1 - age / 18 });
        actors.circle(p.x, p.y, actor.radius).fill({ color, alpha: .18 }).stroke({ color, width: 45 });
        actors.circle(p.x, p.y, 80).fill(color);
        const angle = actor.pose.facing / 4096 * Math.PI * 2;
        actors.moveTo(p.x, p.y).lineTo(p.x + Math.cos(angle) * 430, p.y + Math.sin(angle) * 430).stroke({ color, width: 48 });
    }
    overview.clear();
    const scale = 2.4, left = app.screen.width - ARENA_WIDTH * scale - 12, top = 12;
    overview.rect(left - 4, top - 4, ARENA_WIDTH * scale + 8, ARENA_HEIGHT * scale + 8).fill({ color: 0x08100c, alpha: .8 });
    for (let y = 0; y < ARENA_HEIGHT; y++) for (let x = 0; x < ARENA_WIDTH; x++)
        overview.rect(left + x * scale, top + y * scale, scale, scale).fill(terrainColor(x, y));
    overview.circle(left + focus.x / TILE * scale, top + focus.y / TILE * scale, 2.8).fill(0xd2ef9b);
    const viewX = -camera.offsetX / camera.scaleX / TILE, viewY = -camera.offsetY / camera.scaleY / TILE;
    overview.rect(left + viewX * scale, top + viewY * scale, app.screen.width / camera.scaleX / TILE * scale,
        app.screen.height / camera.scaleY / TILE * scale).stroke({ color: 0xb9c8b0, width: .6 });
    surface.value!.dataset.cameraX = String(camera.offsetX); surface.value!.dataset.cameraY = String(camera.offsetY);
}
function render(): void { draw(); app?.render(); }
onMounted(async () => {
    const candidate = new Application();
    await candidate.init({ width: 880, height: 400, background: '#101b17', antialias: true, autoStart: false });
    if (disposed) { candidate.destroy(true); return; }
    app = candidate; surface.value!.appendChild(app.canvas);
    world = new Container(); app.stage.addChild(world);
    const terrain = new Graphics();
    for (let y = 0; y < ARENA_HEIGHT; y++) for (let x = 0; x < ARENA_WIDTH; x++) {
        terrain.rect(x * TILE, y * TILE, TILE, TILE).fill(terrainColor(x, y));
        if (!grid.getCell(x, y)!.isPassable) terrain.rect(x * TILE + 80, y * TILE + 80, TILE - 160, 70).fill(0x6c8070);
    }
    world.addChild(terrain); actors = new Graphics(); world.addChild(actors);
    overview = new Graphics(); app.stage.addChild(overview);
    resize = new ResizeObserver(() => { if (app && surface.value) { app.renderer.resize(surface.value.clientWidth, surface.value.clientHeight); render(); } });
    resize.observe(surface.value!); render();
});
watch(() => [props.current, props.alpha], render);
onBeforeUnmount(() => { disposed = true; resize?.disconnect(); app?.destroy(true, { children: true }); });
</script>

<template><div ref="surface" class="scope-canvas" data-testid="movement-canvas" /></template>
<style scoped>
.scope-canvas { width: 100%; height: 400px; overflow: hidden; border: 1px solid #34443a; border-radius: 12px; }
.scope-canvas :deep(canvas) { display: block; }
@media (max-width: 600px) { .scope-canvas { height: 340px; } }
</style>
