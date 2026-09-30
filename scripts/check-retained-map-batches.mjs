/** Read-only Pixi CPU render-instruction probe. No DOM rendering or GPU context.
 * node scripts/check-retained-map-batches.mjs
 * Actual Pixi GraphicsContextSystem, GraphicsPipe, SpritePipe, BatcherPipe and
 * InstructionSet execute. Only the shader precision lookup is stubbed to null.
 * This verifies batching/packing, not GPU time or actual pixels.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(process.argv[2] ?? process.cwd());
const local = p => pathToFileURL(resolve(root, p)).href;
const { createServer } = await import(local('node_modules/vite/dist/node/index.js'));
const { DOMAdapter } = await import(local('node_modules/pixi.js/lib/index.mjs'));
const { GraphicsContextSystem } = await import(local('node_modules/pixi.js/lib/scene/graphics/shared/GraphicsContextSystem.mjs'));
const { GraphicsPipe } = await import(local('node_modules/pixi.js/lib/scene/graphics/shared/GraphicsPipe.mjs'));
const { SpritePipe } = await import(local('node_modules/pixi.js/lib/scene/sprite/SpritePipe.mjs'));
const { BatcherPipe } = await import(local('node_modules/pixi.js/lib/rendering/batcher/shared/BatcherPipe.mjs'));
const { InstructionSet } = await import(local('node_modules/pixi.js/lib/rendering/renderers/shared/instructions/InstructionSet.mjs'));
const priorAdapter = DOMAdapter.get();
DOMAdapter.set({ ...priorAdapter, createCanvas: () => ({ getContext: () => null }) });
const vite = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { VectorGeometryCache, RetainedVectorLayer, RetainedBackgroundLayer } = await vite.ssrLoadModule('/src/ui/retainedMapDrawing.ts');
  for (const count of [320, 1200, 3713]) {
    // Renderer infrastructure is inert; the CPU pipes themselves are unmodified.
    const renderer = { uid: 9001, gc: { addResourceHash() {}, now: 0 }, runners: { contextChange: { add() {} } }, limits: { maxBatchableTextures: 16 }, _roundPixels: 0, renderPipes: {} };
    renderer.graphicsContext = new GraphicsContextSystem(renderer);
    renderer.renderPipes.batch = new BatcherPipe(renderer, {});
    renderer.renderPipes.graphics = new GraphicsPipe(renderer, { destroy() {} });
    renderer.renderPipes.sprite = new SpritePipe(renderer);
    const cache = new VectorGeometryCache();
    const bg = new RetainedBackgroundLayer();
    const layer = new RetainedVectorLayer(cache, bg);
    const instructions = new InstructionSet();
    const families = ['墙', '地', '地', '地', '墙', '水', '草', '地', '门', '深', '渊', '地'];
    for (let i = 0; i < count; i++) {
      const x = i % 79, y = Math.floor(i / 79);
      bg.paint(0x223344, x, y, 16);
      layer.paintTile({ id: 'sample', hanzi: families[i % families.length], kind: 'terrain', original: '#' }, 0x446688, x, y, 16);
    }
    layer.finish(); bg.finish(); bg.sortChildren();
    for (const mode of ['default', 'auto']) {
      // The default pass checks production; only the auto control overrides it.
      if (mode === 'auto') for (const s of bg.children.filter(s => s.renderPipeId === 'graphics')) {
        s.context.batchMode = mode;
        s.context.dirty = true;
        s.didViewUpdate = true;
      }
      instructions.reset();
      renderer.renderPipes.batch.buildStart(instructions);
      for (const s of bg.children) renderer.renderPipes[s.renderPipeId].addRenderable(s, instructions);
      renderer.renderPipes.batch.buildEnd(instructions);
      const actual = instructions.instructions.slice(0, instructions.instructionSize);
      const result = { mode, count, instructions: instructions.instructionSize,
        standaloneGraphics: actual.filter(x => x.renderPipeId === 'graphics').length,
        batches: actual.filter(x => x.renderPipeId === 'batch').length,
        indices: renderer.renderPipes.batch._activeBatch.indexSize,
        attributeSize: renderer.renderPipes.batch._activeBatch.attributeSize,
        indexBuffer: renderer.renderPipes.batch._activeBatch.indexBuffer.constructor.name };
      console.log(JSON.stringify(result));
      if (mode === 'default' && (result.batches !== 1 || result.standaloneGraphics !== 0)) throw new Error('Unexpected retained batching');
    }
    layer.destroy({ children: true, context: false }); bg.destroy({ children: true, texture: false }); cache.destroy();
    renderer.renderPipes.graphics.destroy(); renderer.renderPipes.sprite.destroy(); renderer.renderPipes.batch.destroy(); renderer.graphicsContext.destroy(); instructions.destroy();
  }
} finally { await vite.close(); DOMAdapter.set(priorAdapter); }
