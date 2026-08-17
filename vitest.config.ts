import {fileURLToPath} from 'node:url'
import {defineConfig, mergeConfig} from 'vitest/config'
import viteConfig from './vite.config.ts'

// Se reutiliza la config de Vite (alias `@`) y se le añade el bloque de tests.
export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			// Sólo se testea lógica de negocio pura (CLAUDE.md §9): no hacen falta
			// ni jsdom ni el runtime de componentes.
			environment: 'node',
			include: ['src/**/__tests__/**/*.spec.ts'],
			root: fileURLToPath(new URL('./', import.meta.url)),
			coverage: {
				provider: 'v8',
				include: ['src/lib/**', 'src/data/**', 'src/stores/**', 'src/composables/**'],
			},
		},
	}),
)
