/**
 * src/ui/fxNoise.ts — DESIGN-2 标题氛围动画专用的装饰噪声。
 *
 * 纯显示：不触碰游戏 rng（两条流都不消耗），也不进存档/录像。
 * 用 mulberry32 小型生成器，种子取启动时刻，只决定粒子位置这类无关紧要的外观。
 */
export function createFxNoise(seed = Date.now() >>> 0): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
