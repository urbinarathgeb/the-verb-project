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

	/*
	 * `flat/recommended` y no `flat/essential`: añade orden de atributos, nombres
	 * de componente en PascalCase y consistencia en las directivas. Se adoptó tras
	 * comprobar que el código existente pasa **sin un solo aviso**, así que no
	 * cuesta nada y evita que esas convenciones se vayan de las manos.
	 */
	pluginVue.configs['flat/recommended'],
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

	{
		name: 'app/componentes-no-acceden-a-pinia',
		files: ['src/components/**/*.{ts,vue}', 'src/screens/**/*.{ts,vue}'],
		rules: {
			/**
			 * `CLAUDE.md` §6: los componentes de UI nunca acceden a un store de Pinia
			 * directamente, siempre a través del composable que actúa de interfaz
			 * pública (`useGameEngine`, `useAuth`…). Como regla escrita dependía de la
			 * disciplina; aquí se vuelve exigible.
			 */
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
