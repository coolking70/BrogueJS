import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import I18NextVue from 'i18next-vue';
import LootUiGallery from './LootUiGallery.vue';
import { createLootUiPreviewI18n } from './i18n';

/** Self-contained, deterministic static gallery; no filesystem or browser access. */
export async function renderLootUiPreview(options: { css: string }): Promise<string> {
  if (!options || typeof options.css !== 'string') throw new TypeError('Preview css must be a string');
  const app = createSSRApp(LootUiGallery, { mode: 'static' });
  app.use(I18NextVue, { i18next: await createLootUiPreviewI18n() });
  const markup = await renderToString(app);
  // Prevent caller CSS from breaking out of the single inline stylesheet.
  const css = options.css.replace(/<\/style/gi, '<\\/style');
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Loot UI · 静态组件预览</title><style>${css}</style></head><body style="margin:0">${markup}</body></html>\n`;
}
