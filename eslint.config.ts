import pluginVue from 'eslint-plugin-vue'
import {defineConfigWithVueTs, vueTsConfigs} from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

/**
 * Configuración de ESLint (flat config).
 *
 * El formato lo gestiona Prettier: `skipFormatting` desactiva las reglas de
 * ESLint que chocarían con él, para que no haya dos herramientas discutiendo
 * sobre lo mismo.
 */
export default defineConfigWithVueTs(
	{
		name: 'app/archivos-a-lintear',
		files: ['**/*.{ts,mts,tsx,vue}'],
	},

	{
		name: 'app/ignorados',
		ignores: [
			'**/dist/**',
			'**/coverage/**',
			'**/node_modules/**',
			// Skills de terceros: no son código del proyecto.
			'.claude/skills/**',
		],
	},

	pluginVue.configs['flat/essential'],
	vueTsConfigs.recommended,

	{
		name: 'app/reglas-del-proyecto',
		rules: {
			// `CLAUDE.md` §5: se evita `any` salvo justificación explícita en comentario.
			'@typescript-eslint/no-explicit-any': 'error',
			// Permite descartar valores con `_` como prefijo, útil en firmas de callbacks.
			'@typescript-eslint/no-unused-vars': [
				'error',
				{argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
			],
			// Preferir `import type` mantiene el runtime limpio de imports innecesarios.
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{prefer: 'type-imports', fixStyle: 'inline-type-imports'},
			],
			// Los componentes de `screens/` son de una sola palabra por convención de rutas.
			'vue/multi-word-component-names': 'off',
		},
	},

	skipFormatting,
)
