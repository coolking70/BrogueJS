import i18next from 'i18next';
import zhCN from '../../../../../locales/zh_CN.json';
import lootZhCN from '../../locales/zh_CN.json';
import uiZhCN from '../../locales/ui.zh_CN.json';

/** Per-render instance: preview never changes the game's global translator. */
export async function createLootUiPreviewI18n() {
  const instance = i18next.createInstance();
  await instance.init({
    lng: 'zh_CN', fallbackLng: 'zh_CN',
    resources: { zh_CN: { translation: { ...zhCN, ...lootZhCN, ...uiZhCN } } },
  });
  return instance;
}
