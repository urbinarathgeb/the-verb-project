import {fileURLToPath, URL} from 'node:url'

import {defineConfig, type Plugin} from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

/**
 * Fuentes que se ven en el primer pintado de cualquier pantalla: el peso de
 * titular y el cuerpo monoespaciado. Las otras tres aparecen más abajo o en
 * pantallas concretas y no merecen adelantarse.
 */
const CRITICAL_FONTS = ['montserrat-latin-900-normal', 'jetbrains-mono-latin-400-normal']

/**
 * Inyecta `<link rel="preload">` para esas fuentes.
 *
 * Hace falta un plugin porque `@fontsource` las carga con un `@import` dentro de
 * `main.css`: el navegador no sabe que existen hasta que ha descargado y
 * analizado la hoja de estilos entera, así que el texto se pinta antes con la
 * tipografía de respaldo y luego salta.
 *
 * Los nombres finales llevan hash, así que se leen del propio bundle en lugar de
 * escribirse a mano. Se usa el `bundle` que Vite pasa al hook y no el de
 * `generateBundle`, para no depender del orden entre plugins.
 */
function preloadCriticalFonts(): Plugin {
	// `base` se lee de la configuración resuelta: en el hook no hay servidor del
	// que sacarlo, y darlo por `/` rompería un despliegue en subcarpeta.
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
							// Las fuentes se piden en modo anónimo aunque sean del mismo
							// origen; sin esto el navegador descargaría el archivo dos veces.
							crossorigin: '',
						},
						injectTo: 'head' as const,
					}))
			},
		},
	}
}

// https://vite.dev/config/
export default defineConfig({
	plugins: [vue(), vueDevTools(), tailwindcss(), preloadCriticalFonts()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
})
