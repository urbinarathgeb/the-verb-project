<script setup lang="ts">
import {computed, useTemplateRef} from 'vue'

const props = withDefaults(
	defineProps<{
		variant?: 'primary' | 'secondary' | 'ghost'
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

.choice-selected {
	background-color: var(--color-cyan);
	box-shadow: var(--shadow-brutal-xs);
	translate: 2px 2px;
}
</style>
