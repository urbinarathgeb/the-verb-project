import './assets/main.css'

import {createApp} from 'vue'
import {createPinia} from 'pinia'
import App from './App.vue'
import router from './router'
import {useAuthStore} from './stores/auth'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

/*
 * La restauración de la sesión arranca DESPUÉS de montar y sin bloquear: la app
 * es jugable como invitado, así que esperar a la red antes de pintar retrasaría
 * el arranque sin ganar nada (`CLAUDE.md` §8). La interfaz se actualiza sola
 * cuando la sesión llega.
 *
 * Aquí se usa el store en directo, y no `useAuth()`, porque esto es arranque de
 * la aplicación y no interfaz: la regla de `CLAUDE.md` §6 —y la de ESLint que la
 * aplica— acota los componentes y las pantallas, no el punto de entrada.
 */
void useAuthStore().initialize()
