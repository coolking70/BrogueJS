import { createApp } from 'vue';
import I18NextVue from 'i18next-vue';
import LootUiGallery from './LootUiGallery.vue';
import { createLootUiPreviewI18n } from './i18n';

async function mountPreview() {
  const instance = await createLootUiPreviewI18n();
  const app = createApp(LootUiGallery);
  app.use(I18NextVue, { i18next: instance });
  app.mount('#loot-ui-preview');
}
void mountPreview();
