<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Application, Graphics } from 'pixi.js';
import type { ShooterSnapshot } from '../ShooterSession';

const props = defineProps<{ previous: ShooterSnapshot; current: ShooterSnapshot; alpha: number }>();
const surface = ref<HTMLDivElement>();
let app: Application | null = null;
let ink: Graphics | null = null;
let disposed = false;

function draw(): void {
    if (!ink || !app) return;
    ink.clear();
    const w = app.screen.width, h = app.screen.height;
    for (let x = 20; x < w; x += 32) ink.moveTo(x, 0).lineTo(x, h).stroke({ color: 0x24332d, width: 1 });
    for (let y = 20; y < h; y += 32) ink.moveTo(0, y).lineTo(w, y).stroke({ color: 0x24332d, width: 1 });
    const displayTick = props.previous.tick + (props.current.tick - props.previous.tick) * props.alpha;
    for (const [i, actor] of props.current.actors.entries()) {
        const x = w * (i === 0 ? 0.28 : 0.72), y = h / 2;
        const color = i === 0 ? 0xd2ef9b : 0x76bbde;
        const bundle = props.current.actions.bundles.find(item => item.decisionOwnerId === actor.id);
        const age = Math.max(0, displayTick - actor.lastPulseTick);
        if (actor.resolved && age < 18) ink.circle(x, y, 42 + age * 4).stroke({ color, width: 2, alpha: 1 - age / 18 });
        ink.circle(x, y, 49).stroke({ color, width: 1, alpha: 0.3 });
        ink.circle(x, y, 33).fill({ color, alpha: bundle ? 0.22 : 0.08 }).stroke({ color, width: 2 });
        ink.rect(x - 5, y - 5, 10, 10).fill(color);
        if (bundle) {
            const progress = bundle.elapsedActionTicks / (i === 0 ? 27 : 30);
            ink.moveTo(x, y - 49).arc(x, y, 49, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress).stroke({ color, width: 4 });
        }
    }
    const cursor = 20 + ((displayTick % 60) / 60) * (w - 40);
    ink.moveTo(20, h - 22).lineTo(w - 20, h - 22).stroke({ color: 0x455549, width: 1 });
    ink.circle(cursor, h - 22, 3).fill(0xd2ef9b);
}

onMounted(async () => {
    const candidate = new Application();
    await candidate.init({ width: 880, height: 300, background: '#101b17', antialias: true, autoStart: false });
    if (disposed) { candidate.destroy(true); return; }
    app = candidate;
    surface.value!.appendChild(app.canvas);
    ink = new Graphics();
    app.stage.addChild(ink);
    draw(); app.render();
});
watch(() => [props.current, props.alpha], () => { draw(); app?.render(); });
onBeforeUnmount(() => { disposed = true; app?.destroy(true, { children: true }); });
</script>

<template><div ref="surface" class="scope-canvas" /></template>
<style scoped>
.scope-canvas { width: 100%; overflow: hidden; border: 1px solid #34443a; border-radius: 12px; }
.scope-canvas :deep(canvas) { display: block; width: 100%; height: auto; }
</style>
