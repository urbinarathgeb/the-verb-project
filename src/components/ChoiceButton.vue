<script setup lang="ts">
import {computed, useTemplateRef} from 'vue'

/**
 * Botón del sistema. Concentra el gesto de presión física y los tres pesos
 * visuales, para que las pantallas no repitan la misma sopa de clases
 * (`CLAUDE.md` §10).
 */
const props = withDefaults(
	defineProps<{
		/**
		 * `primary` para la acción principal de la pantalla, `secondary` para las
		 * alternativas y `ghost` para volver o cancelar.
		 */
		variant?: 'primary' | 'secondary' | 'ghost'
		/**
		 * Marca la opción elegida en un grupo de selección.
		 *
		 * **No tiene valor por defecto, y es deliberado.** `undefined` significa
		 * «este botón no es un alternador» y omite `aria-pressed`; `false` significa
		 * «es un alternador y no está pulsado». Con un `false` por defecto, botones
		 * de acción como «Jugar» o «Volver al menú» se anunciaban como alternadores
		 * sin pulsar, que es mentir sobre lo que hacen (WCAG 4.1.2).
		 */
		selected?: boolean
		disabled?: boolean
	}>(),
	{variant: 'secondary', disabled: false},
)

const VARIANT_CLASSES = {
	primary: 'choice-primary',
	secondary: 'choice-secondary',
	ghost: 'choice-ghost',
} as const

const variantClass = computed(() => VARIANT_CLASSES[props.variant])

/*
 * Se expone `focus()` en lugar de dejar que el padre alcance el `$el` del
 * componente: `<script setup>` es cerrado por defecto, y una interfaz explícita
 * sobrevive a que el marcado interno cambie. Lo usa el Dojo para llevar el foco
 * a «Siguiente» cuando la opción pulsada se deshabilita.
 */
const root = useTemplateRef<HTMLButtonElement>('root')

defineExpose({focus: () => root.value?.focus()})
</script>

<template>
	<button
		ref="root"
		type="button"
		class="choice-button"
		:class="[variantClass, {'choice-selected': selected}, disabled ? '' : 'brutal-press']"
		:disabled="disabled"
		:aria-pressed="selected"
	>
		<slot />
	</button>
</template>

<style scoped>
.choice-button {
	min-height: var(--spacing-touch);
	padding: calc(var(--spacing-gutter) / 2) var(--spacing-gutter);
	border: 4px solid var(--color-ink);
	box-shadow: var(--shadow-brutal-sm);
	font-family: var(--font-display);
	font-size: var(--text-label-bold);
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--color-ink);
	cursor: pointer;
}

.choice-button:disabled {
	cursor: default;
	opacity: 0.45;
	box-shadow: none;
}

.choice-primary {
	background-color: var(--color-electric);
	box-shadow: var(--shadow-brutal-md);
}

.choice-secondary {
	background-color: var(--color-card);
}

.choice-ghost {
	background-color: transparent;
	border-width: 3px;
	box-shadow: var(--shadow-brutal-xs);
}

/*
 * La opción elegida se marca con cian y no con amarillo: fuera del tablero el
 * amarillo es la acción primaria, y usarlo aquí confundiría "seleccionado" con
 * "pulsa esto".
 */
.choice-selected {
	background-color: var(--color-cyan);
	box-shadow: var(--shadow-brutal-xs);
	translate: 2px 2px;
}
</style>
