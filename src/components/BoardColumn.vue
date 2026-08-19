<script setup lang="ts">
defineProps<{
	label: string
	accent: 'cyan' | 'paper-dim'
}>()

const ACCENT_CLASSES = {
	cyan: 'column-accent-cyan',
	'paper-dim': 'column-accent-dim',
} as const
</script>

<template>
	<section class="board-column" :aria-label="label">
		<h2 class="column-header" :class="ACCENT_CLASSES[accent]">{{ label }}</h2>

		<div class="column-cells">
			<slot />
		</div>
	</section>
</template>

<style scoped>
.board-column {
	display: flex;
	flex-direction: column;
	flex: 1 1 0;
	min-width: 0;
	gap: calc(var(--spacing-gutter) / 3);
}

.column-header {
	padding: calc(var(--spacing-gutter) / 4);
	border: 3px solid var(--color-ink);
	box-shadow: var(--shadow-brutal-xs);
	text-align: center;
	font-size: var(--text-micro);
	letter-spacing: 0;
	white-space: nowrap;
}

.column-accent-cyan {
	background-color: var(--color-cyan);
}

.column-accent-dim {
	background-color: var(--color-paper-dim);
}

.column-cells {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 3);
	flex: 1 1 auto;
	min-height: min-content;
}

@media (width >= 40rem) {
	.board-column {
		gap: calc(var(--spacing-gutter) / 2);
	}

	.column-header {
		font-size: var(--text-label-bold);
		letter-spacing: 0.08em;
		padding: calc(var(--spacing-gutter) / 3);
	}

	.column-cells {
		gap: calc(var(--spacing-gutter) / 2);
	}
}
</style>
