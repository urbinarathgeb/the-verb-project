<script setup lang="ts">
import {useTemplateRef} from 'vue'
import BoardColumn from './BoardColumn.vue'
import VerbCell from './VerbCell.vue'
import type {Cell, CellStatus, Columns} from '@/types/game'
import {VERB_FORMS, type VerbForm} from '@/types/verb'

defineProps<{
	columns: Columns
	cellStatus: (cell: Cell) => CellStatus
	isCellSelectable: (cell: Cell) => boolean
}>()

const emit = defineEmits<{select: [cell: Cell]}>()

const COLUMN_LABELS: Record<VerbForm, string> = {
	present: 'Presente',
	past: 'Pasado',
	participle: 'Participio',
}

const COLUMN_ACCENTS: Record<VerbForm, 'cyan' | 'paper-dim'> = {
	present: 'paper-dim',
	past: 'cyan',
	participle: 'cyan',
}

function handleSelect(cell: Cell): void {
	emit('select', cell)
}

const boardRef = useTemplateRef<HTMLElement>('board')

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
				v-for="(cell, row) in columns[form]"
				:key="row"
				:cell="cell"
				:status="cellStatus(cell)"
				:selectable="isCellSelectable(cell)"
				@select="handleSelect"
			/>
		</BoardColumn>
	</div>
</template>

<style scoped>
.game-board {
	display: flex;
	gap: calc(var(--spacing-gutter) / 3);
	width: 100%;
	height: 100%;
	min-height: min-content;
}

@media (width >= 40rem) {
	.game-board {
		gap: var(--spacing-gutter);
	}
}
</style>
