<script setup lang="ts">
import {useTemplateRef} from 'vue'
import BoardColumn from './BoardColumn.vue'
import VerbCell from './VerbCell.vue'
import type {Cell, CellStatus, Columns} from '@/types/game'
import {VERB_FORMS, type VerbForm} from '@/types/verb'

/**
 * El tablero de emparejamiento: tres columnas, una por forma verbal
 * (`MECHANICS.md` §1).
 *
 * Componente puro. Recibe el estado de cada celda mediante funciones en vez de
 * calcularlo, para no importar lógica de dominio (`CLAUDE.md` §7). Quien las
 * provee es `useGameEngine`.
 */
defineProps<{
	columns: Columns
	cellStatus: (cell: Cell) => CellStatus
	isCellSelectable: (cell: Cell) => boolean
}>()

const emit = defineEmits<{select: [cell: Cell]}>()

/** Etiquetas de columna en español, en el orden de `VERB_FORMS`. */
const COLUMN_LABELS: Record<VerbForm, string> = {
	present: 'Presente',
	past: 'Pasado',
	participle: 'Participio',
}

/**
 * La columna de presente se deja sin acento de color para que se lea como el
 * punto de partida; las otras dos lo llevan.
 */
const COLUMN_ACCENTS: Record<VerbForm, 'cyan' | 'paper-dim'> = {
	present: 'paper-dim',
	past: 'cyan',
	participle: 'cyan',
}

function handleSelect(cell: Cell): void {
	emit('select', cell)
}

const boardRef = useTemplateRef<HTMLElement>('board')

/**
 * Navegación con flechas por la cuadrícula.
 *
 * Las celdas son `<button>` nativos, así que Tab y Enter ya funcionan sin nada
 * más. Las flechas se añaden porque recorrer un tablero de 30 celdas a base de
 * Tab es agotador, y porque arriba/abajo e izquierda/derecha son el mapa mental
 * que el jugador ya tiene del tablero (`CLAUDE.md` §11).
 */
function handleKeydown(event: KeyboardEvent): void {
	const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
	if (!keys.includes(event.key)) return

	const root = boardRef.value
	if (root === null) return

	const columns = [...root.querySelectorAll<HTMLElement>('.column-cells')]
	const active = document.activeElement
	if (!(active instanceof HTMLElement)) return

	const columnIndex = columns.findIndex((column) => column.contains(active))
	if (columnIndex === -1) return

	const currentColumn = columns[columnIndex]
	if (currentColumn === undefined) return

	const cells = [...currentColumn.children]
	const rowIndex = cells.indexOf(active)
	if (rowIndex === -1) return

	// El movimiento no da la vuelta: al llegar al borde se queda ahí, para que el
	// jugador no pierda la referencia de dónde está en el tablero.
	const nextColumnIndex =
		event.key === 'ArrowLeft'
			? Math.max(0, columnIndex - 1)
			: event.key === 'ArrowRight'
				? Math.min(columns.length - 1, columnIndex + 1)
				: columnIndex

	const targetColumn = columns[nextColumnIndex]
	if (targetColumn === undefined) return

	const targetCells = [...targetColumn.children]
	const nextRowIndex =
		event.key === 'ArrowUp'
			? Math.max(0, rowIndex - 1)
			: event.key === 'ArrowDown'
				? Math.min(targetCells.length - 1, rowIndex + 1)
				: Math.min(rowIndex, targetCells.length - 1)

	const target = targetCells[nextRowIndex]
	if (!(target instanceof HTMLElement)) return

	event.preventDefault()
	target.focus()
}
</script>

<template>
	<div ref="board" class="game-board" @keydown="handleKeydown">
		<BoardColumn
			v-for="form in VERB_FORMS"
			:key="form"
			:label="COLUMN_LABELS[form]"
			:accent="COLUMN_ACCENTS[form]"
		>
			<VerbCell
				v-for="(cell, index) in columns[form]"
				:key="cell.id"
				:cell="cell"
				:status="cellStatus(cell)"
				:selectable="isCellSelectable(cell)"
				:index="index"
				@select="handleSelect"
			/>
		</BoardColumn>
	</div>
</template>

<style scoped>
.game-board {
	display: flex;
	/*
	 * Las 3 columnas se mantienen en cualquier tamaño de pantalla: la mecánica
	 * exige elegir una celda por columna, así que apilarlas rompería el juego.
	 * Lo que se reduce en móvil es el tamaño de celda, no el número de columnas.
	 */
	gap: calc(var(--spacing-gutter) / 3);
	width: 100%;
	height: 100%;
	min-height: 0;
}

@media (width >= 40rem) {
	.game-board {
		gap: var(--spacing-gutter);
	}
}
</style>
