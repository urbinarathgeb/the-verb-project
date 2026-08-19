import {fileURLToPath, URL} from 'node:url'

import {defineConfig, type Plugin} from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

const CRITICAL_FONTS = ['montserrat-latin-900-normal', 'jetbrains-mono-latin-400-normal']

function preloadCriticalFonts(): Plugin {
	let base = '/'

	return {
		name: 'the-verb-project:preload-critical-fonts',
		apply: 'build',
		configResolved(config) {
			base = config.base
		},
		transformIndexHtml: {
			order: 'post',
			handler(_html, ctx) {
				if (ctx.bundle === undefined) return []

				return Object.keys(ctx.bundle)
					.filter(
						(file) => file.endsWith('.woff2') && CRITICAL_FONTS.some((name) => file.includes(name)),
					)
					.map((file) => ({
						tag: 'link',
						attrs: {
							rel: 'preload',
							as: 'font',
							type: 'font/woff2',
							href: `${base}${file}`,
							crossorigin: '',
						},
						injectTo: 'head' as const,
					}))
			},
		},
	}
}

export default defineConfig({
	plugins: [vue(), vueDevTools(), tailwindcss(), preloadCriticalFonts()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
})
