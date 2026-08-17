import {createRouter, createWebHistory, type RouteRecordRaw} from 'vue-router'
import HomeScreen from '@/screens/HomeScreen.vue'
import {isDifficulty, isGameMode} from '@/types/game'

/**
 * Rutas de la aplicación.
 *
 * Las pantallas distintas de Home se cargan de forma diferida: la app es un
 * juego a pantalla completa y el arranque debe ser inmediato, así que sólo el
 * menú entra en el bundle inicial.
 */
const routes: RouteRecordRaw[] = [
	{
		path: '/',
		name: 'home',
		component: HomeScreen,
	},
	{
		// `mode` ∈ target | precision — `difficulty` ∈ easy | medium | hard.
		path: '/play/:mode/:difficulty',
		name: 'play',
		component: () => import('@/screens/GameScreen.vue'),
		props: true,
		/**
		 * Los parámetros de ruta son texto libre: una URL escrita a mano o un enlace
		 * viejo podría pedir un modo o un nivel que no existen. En vez de montar la
		 * pantalla y fallar dentro, se vuelve al menú.
		 */
		beforeEnter: (to) => {
			if (isGameMode(to.params.mode) && isDifficulty(to.params.difficulty)) return true
			return {name: 'home'}
		},
	},
	{
		// El pool de preguntas sale del nivel, igual que en una partida.
		path: '/practice/:difficulty',
		name: 'practice',
		component: () => import('@/screens/PracticeScreen.vue'),
		props: true,
		beforeEnter: (to) => (isDifficulty(to.params.difficulty) ? true : {name: 'home'}),
	},
	{
		path: '/result',
		name: 'result',
		component: () => import('@/screens/ResultScreen.vue'),
	},
	{
		path: '/ranking',
		name: 'ranking',
		component: () => import('@/screens/RankingScreen.vue'),
	},
	{
		// Destino del redirect de Supabase Auth (T5.3).
		path: '/auth/callback',
		name: 'auth-callback',
		component: () => import('@/screens/AuthCallbackScreen.vue'),
	},
	{
		// Cualquier URL desconocida vuelve al menú en lugar de mostrar un 404:
		// no hay contenido navegable fuera del juego.
		path: '/:pathMatch(.*)*',
		redirect: {name: 'home'},
	},
]

// Guía visual del sistema de diseño. Se inserta antes del catch-all y sólo en
// desarrollo, para que no forme parte del bundle de producción.
if (import.meta.env.DEV) {
	routes.splice(routes.length - 1, 0, {
		path: '/styleguide',
		name: 'styleguide',
		component: () => import('@/screens/StyleguideScreen.vue'),
	})
}

export const router = createRouter({
	history: createWebHistory(import.meta.env.BASE_URL),
	routes,
})

export default router
