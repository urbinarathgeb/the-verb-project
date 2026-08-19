import {createRouter, createWebHistory, type RouteRecordRaw} from 'vue-router'
import HomeScreen from '@/screens/HomeScreen.vue'
import {isDifficulty, isGameMode} from '@/types/game'

const routes: RouteRecordRaw[] = [
	{
		path: '/',
		name: 'home',
		component: HomeScreen,
	},
	{
		path: '/setup',
		name: 'setup',
		component: () => import('@/screens/SetupScreen.vue'),
	},
	{
		path: '/play/:mode/:difficulty',
		name: 'play',
		component: () => import('@/screens/GameScreen.vue'),
		props: true,
		beforeEnter: (to) => {
			if (isGameMode(to.params.mode) && isDifficulty(to.params.difficulty)) return true
			return {name: 'home'}
		},
	},
	{
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
		path: '/progress',
		name: 'progress',
		component: () => import('@/screens/ProgressScreen.vue'),
	},
	{
		path: '/auth/callback',
		name: 'auth-callback',
		component: () => import('@/screens/AuthCallbackScreen.vue'),
	},
	{
		path: '/:pathMatch(.*)*',
		redirect: {name: 'home'},
	},
]

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
