import { createApp } from 'vue'
import App from './App.vue'
import './assets/main.css'
import './assets/ui-concepts.css'
import './assets/gameplay-layout.css'
import setupI18n from './i18n'

const app = createApp(App)
setupI18n(app)
app.mount('#app')
