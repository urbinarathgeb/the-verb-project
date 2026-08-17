<script setup lang="ts">
import {computed} from 'vue'
import type {Cell, CellStatus} from '@/types/game'

/**
 * Una celda del tablero.
 *
 * Componente puro: no conoce las reglas del juego. Recibe su estado ya calculado
 * y se limita a mapearlo a la utilidad `cell-*` correspondiente, que es donde
 * vive la semántica visual (`assets/main.css`).
 */
const props = withDefaults(
	defineProps<{
		cell: Cell
		status: CellStatus
		/** `false` cuando el tablero está inerte: fuera de partida o verbo ya resuelto. */
		selectable?: boolean
		/**
		 * Posición de la celda en su columna. Fija la inclinación de "papel tirado"
		 * de forma determinista, para que un re-render no cambie el ángulo y el
		 * tablero no tiemble al reponerse una tríada.
		 */
		index?: number
	}>(),
	{selectable: true, index: 0},
)

const emit = defineEmits<{select: [cell: Cell]}>()

const STATUS_CLASSES: Record<CellStatus, string> = {
	neutral: 'cell-neutral',
	selected: 'cell-selected',
	resolved: 'cell-resolved',
	error: 'cell-error',
}

const TILT_CLASSES = ['paper-tilt-1', 'paper-tilt-2', 'paper-tilt-3', 'paper-tilt-4']

const statusClass = computed(() => STATUS_CLASSES[props.status])

const tiltClass = computed(() => TILT_CLASSES[props.index % TILT_CLASSES.length])

// El gesto de presión sólo tiene sentido si la celda responde al toque.
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
		:class="[statusClass, tiltClass, pressClass]"
		:disabled="!selectable"
		:aria-pressed="status === 'selected'"
		@click="handleClick"
	>
		{{ cell.text }}
	</button>
</template>

<style scoped>
.verb-cell {
	/*
	 * Las celdas se reparten la altura de la columna en lugar de crecer con su
	 * contenido: así el tablero cabe en el viewport sin scroll con cualquier N,
	 * que es el requisito de la app a pantalla completa.
	 */
	flex: 1 1 0;
	/*
	 * Suelo irrenunciable: `--spacing-touch` es el mínimo táctil de 44px que
	 * exige CLAUDE.md §11. Si ni así cabe, el tablero desborda antes que
	 * volverse impulsable con el dedo.
	 */
	min-height: var(--spacing-touch);
	width: 100%;
	padding: calc(var(--spacing-gutter) / 3);
	font-family: var(--font-display);
	font-size: var(--text-label-bold);
	font-weight: 700;
	text-transform: lowercase;
	color: var(--color-ink);
	cursor: pointer;
	/* Las formas largas ("was / were") no deben romper la retícula del tablero. */
	overflow-wrap: anywhere;
}

.verb-cell:disabled {
	cursor: default;
}

@media (width >= 40rem) {
	.verb-cell {
		font-size: var(--text-headline-md);
		padding: calc(var(--spacing-gutter) / 2);
	}
}
</style>
