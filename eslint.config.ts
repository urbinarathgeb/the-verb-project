import pluginVue from 'eslint-plugin-vue'
import {defineConfigWithVueTs, vueTsConfigs} from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfigWithVueTs(
	{
		name: 'app/archivos-a-lintear',
		files: ['**/*.{ts,mts,tsx,vue}'],
	},

	{
		name: 'app/ignorados',
		// `videos/` es el proyecto del video promocional: scripts de montaje y
		// composiciones HTML que no son código de la aplicación y no se versionan
		// (están en .gitignore). Prettier ya los ignora por leer el .gitignore;
		// ESLint no lo lee, así que hay que excluirlos aquí a mano.
		ignores: [
			'**/dist/**',
			'**/coverage/**',
			'**/node_modules/**',
			// `.claude/skills` es un enlace simbólico a `.agents/skills`, y ESLint
			// resuelve la ruta real, así que hay que nombrar ambas.
			'.claude/skills/**',
			'.agents/**',
			'videos/**',
		],
	},

	pluginVue.configs['flat/recommended'],
	vueTsConfigs.recommended,

	{
		name: 'app/reglas-del-proyecto',
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
			],
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{prefer: 'type-imports', fixStyle: 'inline-type-imports'},
			],
			'vue/multi-word-component-names': 'off',
		},
	},

	{
		name: 'app/componentes-no-acceden-a-pinia',
		files: ['src/components/**/*.{ts,vue}', 'src/screens/**/*.{ts,vue}'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['@/stores/*', '**/stores/*'],
							message:
								'Los componentes no acceden a Pinia directamente (CLAUDE.md §6). Usa el composable que envuelve el store, por ejemplo useGameEngine().',
						},
						{
							group: ['pinia'],
							message:
								'La interacción con Pinia vive en stores/ y en los composables que los envuelven (CLAUDE.md §6).',
						},
					],
				},
			],
		},
	},

	skipFormatting,
)
