import './assets/main.css'

import {inject as injectAnalytics} from '@vercel/analytics'
import {createApp} from 'vue'
import {createPinia} from 'pinia'
import App from './App.vue'
import router from './router'
import {useAuthStore} from './stores/auth'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// Analíticas de Vercel: sólo se activan en la build de producción.
// El script detecta por sí solo los cambios de ruta del SPA.
if (import.meta.env.PROD) {
	injectAnalytics()
}

void useAuthStore().initialize()
