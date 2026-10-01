<script setup lang="ts">
// DESIGN-2：标题页程序化氛围（Canvas）。纯装饰，用 fxNoise，不消耗游戏 rng；
// 尊重 prefers-reduced-motion（只画一帧）。
import { onMounted, onUnmounted, ref } from 'vue';
import { createFxNoise } from '../../ui/fxNoise';
const props = defineProps<{ kind: 'embers' | 'spores' | 'stars' | 'grid' | 'glyphs' | 'none' }>();
const canvas = ref<HTMLCanvasElement>();
let raf = 0;
let stop = false;
let resize: (() => void) | undefined;
onMounted(() => {
  const cv = canvas.value;
  const ctx = cv?.getContext('2d');
  if (!cv || !ctx || props.kind === 'none') return;
  const rand = createFxNoise();
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 1, H = 1, dpr = 1;
  const size = () => { const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = cv.width = Math.max(1, Math.round(r.width * dpr)); H = cv.height = Math.max(1, Math.round(r.height * dpr)); };
  size();
  resize = size; window.addEventListener('resize', size);
  const N = props.kind === 'grid' ? 0 : props.kind === 'glyphs' ? 90 : 80;
  const GLYPHS = '.#"~,:\'`^';
  const P = Array.from({ length: N }, () => ({ x: rand(), y: rand(), s: rand(), p: rand() * 6.283, v: rand(), c: GLYPHS.charAt(Math.floor(rand() * GLYPHS.length)) }));
  let t = 0;
  const frame = () => {
    if (stop) return;
    t++;
    ctx.clearRect(0, 0, W, H);
    if (props.kind === 'embers') {
      const g = ctx.createRadialGradient(W / 2, H * 1.1, 0, W / 2, H * 1.1, H * 0.95);
      g.addColorStop(0, 'rgba(255,120,40,.20)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const p of P) {
        p.y -= (0.0006 + p.v * 0.0012); p.x += Math.sin(p.p + t * 0.01) * 0.0004;
        if (p.y < -0.02) { p.y = 1.02; p.x = rand(); }
        ctx.fillStyle = `rgba(255,${150 + Math.floor(70 * p.y)},60,${Math.max(0, 0.75 * p.y)})`;
        const r = (1 + p.s * 1.6) * dpr; ctx.fillRect(p.x * W, p.y * H, r, r);
      }
    } else if (props.kind === 'spores') {
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
      g.addColorStop(0, 'rgba(120,100,255,.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const p of P) {
        p.p += 0.01; p.y -= 0.0002 + p.v * 0.0004; p.x += Math.sin(p.p) * 0.0003;
        if (p.y < -0.02) { p.y = 1.02; p.x = rand(); }
        ctx.fillStyle = `rgba(190,175,255,${0.2 + 0.4 * Math.abs(Math.sin(p.p))})`;
        ctx.beginPath(); ctx.arc(p.x * W, p.y * H, (0.6 + p.s * 1.8) * dpr, 0, 6.283); ctx.fill();
      }
    } else if (props.kind === 'stars') {
      ctx.strokeStyle = 'rgba(134,169,255,.10)'; ctx.lineWidth = dpr;
      for (let i = 0; i + 1 < P.length; i += 3) { const a = P[i]!, b = P[i + 1]!; if (Math.hypot((a.x - b.x) * W, (a.y - b.y) * H) < W * 0.16) { ctx.beginPath(); ctx.moveTo(a.x * W, a.y * H); ctx.lineTo(b.x * W, b.y * H); ctx.stroke(); } }
      for (const p of P) { ctx.fillStyle = `rgba(233,227,211,${0.2 + 0.5 * Math.abs(Math.sin(p.p + t * 0.012))})`; const r = (0.6 + p.s * 1.4) * dpr; ctx.fillRect(p.x * W, p.y * H, r, r); }
    } else if (props.kind === 'grid') {
      const step = 24 * dpr; ctx.strokeStyle = 'rgba(147,161,173,.08)'; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const sy = (t * 1.4 * dpr) % H; const gr = ctx.createLinearGradient(0, sy - 60 * dpr, 0, sy);
      gr.addColorStop(0, 'rgba(255,210,63,0)'); gr.addColorStop(1, 'rgba(255,210,63,.09)'); ctx.fillStyle = gr; ctx.fillRect(0, sy - 60 * dpr, W, 60 * dpr);
    } else if (props.kind === 'glyphs') {
      ctx.font = `${14 * dpr}px ui-monospace, Menlo, Consolas, monospace`; ctx.textBaseline = 'top';
      for (const p of P) { const a = 0.08 + 0.22 * Math.abs(Math.sin(p.p + t * 0.006 * (0.5 + p.v))); ctx.fillStyle = `rgba(228,223,209,${a})`; ctx.fillText(p.c, p.x * W, p.y * H); }
    }
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
