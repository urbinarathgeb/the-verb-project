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
		ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', '.claude/skills/**'],
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
