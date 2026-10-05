import { createApp } from 'vue';
import i18next from 'i18next';
import I18NextVue from 'i18next-vue';
import zhCN from '../../locales/zh_CN.json';
import ShooterApp from './ShooterApp.vue';

// Independent entry: no Game singleton, extension catalog or Brogue input handlers.
void i18next.init({ lng: 'zh_CN', resources: { zh_CN: { translation: zhCN } } }).then(() => {
    document.title = i18next.t('shooter.title');
    createApp(ShooterApp).use(I18NextVue, { i18next }).mount('#app');
});
