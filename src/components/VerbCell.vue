<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import type {Cell, CellStatus} from '@/types/game'

const props = withDefaults(
	defineProps<{
		cell: Cell
		status: CellStatus
		selectable?: boolean
	}>(),
	{selectable: true},
)

const emit = defineEmits<{select: [cell: Cell]}>()

const STATUS_CLASSES: Record<CellStatus, string> = {
	neutral: 'cell-neutral',
	selected: 'cell-selected',
	resolved: 'cell-resolved',
	error: 'cell-error',
}

const TILT_CLASSES = ['paper-tilt-1', 'paper-tilt-2', 'paper-tilt-3', 'paper-tilt-4']

const ENTER_MS = 300

const statusClass = computed(() => STATUS_CLASSES[props.status])

const tiltClass = computed(
	() => TILT_CLASSES[props.cell.verbId % TILT_CLASSES.length] ?? TILT_CLASSES[0],
)

const isEntering = ref(false)

let enteringTimer: ReturnType<typeof setTimeout> | null = null

watch(
	() => props.cell.verbId,
	() => {
		isEntering.value = true

		if (enteringTimer !== null) clearTimeout(enteringTimer)
		enteringTimer = setTimeout(() => {
			isEntering.value = false
			enteringTimer = null
		}, ENTER_MS)
	},
)

const pressClass = computed(() => (props.selectable ? 'brutal-press' : ''))

function handleClick(): void {
	if (!props.selectable) return
	emit('select', props.cell)
}
</script>

<template>
	<button
		type="button"
		class="verb-cell"
		:class="[statusClass, tiltClass, pressClass, {'verb-cell-entering': isEntering}]"
		:disabled="!selectable"
		:aria-pressed="status === 'selected'"
		@click="handleClick"
	>
		<span class="verb-cell-form">{{ cell.text }}</span>
		<span v-if="cell.meaning !== null" class="verb-cell-meaning">{{ cell.meaning }}</span>
	</button>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
	.verb-cell-entering {
		animation: verb-cell-enter 300ms ease-out;
	}
}

@keyframes verb-cell-enter {
	from {
		opacity: 0;
	}

	to {
		opacity: 1;
	}
}

@media (prefers-reduced-motion: no-preference) {
	.verb-cell {
		transition:
			background-color 400ms ease-out,
			border-color 400ms ease-out,
			opacity 400ms ease-out;
	}
}

.verb-cell {
	flex: 1 1 0;
	min-height: var(--spacing-touch);
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 2px;
	padding: calc(var(--spacing-gutter) / 3);
	font-family: var(--font-display);
	font-size: var(--text-label-bold);
	font-weight: 700;
	text-transform: lowercase;
	color: var(--color-ink);
	cursor: pointer;
	overflow-wrap: anywhere;
}

.verb-cell-form {
	line-height: 1;
}

.verb-cell-meaning {
	font-family: var(--font-body);
	font-size: var(--text-micro);
	line-height: 1;
	font-weight: 400;
	text-transform: none;
	opacity: 0.7;
}

.verb-cell:has(.verb-cell-meaning) {
	padding: calc(var(--spacing-gutter) / 4);
}

.verb-cell:disabled {
	cursor: default;
}

@media (width >= 40rem) {
	.verb-cell {
		font-size: var(--text-headline-md);
		padding: calc(var(--spacing-gutter) / 2);
		gap: 4px;
	}

	.verb-cell:has(.verb-cell-meaning) {
		padding: calc(var(--spacing-gutter) / 2);
	}

	.verb-cell-meaning {
		font-size: var(--text-caption);
	}
}
</style>
