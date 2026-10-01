<script setup lang="ts">
// DESIGN-2：标题页程序化氛围（Canvas）。纯装饰，用 fxNoise，不消耗游戏 rng；
// 尊重 prefers-reduced-motion（只画一帧）。
import { onMounted, onUnmounted, ref } from 'vue';
import { createFxNoise } from '../../ui/fxNoise';
const canvas = ref<HTMLCanvasElement>();
let raf = 0;
let stop = false;
let resize: (() => void) | undefined;
onMounted(() => {
  const cv = canvas.value;
  const ctx = cv?.getContext('2d');
  if (!cv || !ctx) return;
  const rand = createFxNoise();
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 1, H = 1, dpr = 1;
  const size = () => { const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = cv.width = Math.max(1, Math.round(r.width * dpr)); H = cv.height = Math.max(1, Math.round(r.height * dpr)); };
  size();
  resize = size; window.addEventListener('resize', size);
  const N = 90;
  const GLYPHS = '.#"~,:\'`^';
  const P = Array.from({ length: N }, () => ({ x: rand(), y: rand(), s: rand(), p: rand() * 6.283, v: rand(), c: GLYPHS.charAt(Math.floor(rand() * GLYPHS.length)) }));
  let t = 0;
  const frame = () => {
    if (stop) return;
    t++;
    ctx.clearRect(0, 0, W, H);
      ctx.font = `${14 * dpr}px ui-monospace, Menlo, Consolas, monospace`; ctx.textBaseline = 'top';
      for (const p of P) { const a = 0.08 + 0.22 * Math.abs(Math.sin(p.p + t * 0.006 * (0.5 + p.v))); ctx.fillStyle = `rgba(228,223,209,${a})`; ctx.fillText(p.c, p.x * W, p.y * H); }
    if (!reduce) raf = requestAnimationFrame(frame);
  };
  frame();
});
onUnmounted(() => { stop = true; cancelAnimationFrame(raf); if (resize) window.removeEventListener('resize', resize); });
</script>

<template>
  <canvas ref="canvas" class="title-fx" aria-hidden="true"></canvas>
</template>

<style scoped>
.title-fx { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
</style>
