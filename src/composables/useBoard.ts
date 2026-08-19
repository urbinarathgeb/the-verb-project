import {computed, shallowRef, type ComputedRef} from 'vue'
import {
	createBoard,
	createEmptySelection,
	getSelectedCells,
	isMatchingTriad,
	refillSlots,
} from '@/lib/board'
import type {Rng} from '@/lib/shuffle'
import type {Cell, CellId, Columns, Selection, SelectionOutcome} from '@/types/game'
import type {Verb} from '@/types/verb'

export interface UseBoardOptions {
	rng?: Rng
}

export interface UseBoardReturn {
	columns: ComputedRef<Columns>
	pool: ComputedRef<readonly Verb[]>
	selection: ComputedRef<Selection>
	errorCellIds: ComputedRef<readonly CellId[]>
	resolvedVerbIds: ComputedRef<readonly number[]>
	visibleVerbIds: ComputedRef<number[]>
	visibleCount: ComputedRef<number>
	vacatedCount: ComputedRef<number>
	isPoolExhausted: ComputedRef<boolean>
	isCleared: ComputedRef<boolean>
	matchedCount: ComputedRef<number>
	selectedCount: ComputedRef<number>
	deal: (verbs: readonly Verb[], boardSize: number) => void
	select: (cell: Cell) => SelectionOutcome
	clearError: () => void
	clearSelection: () => void
	refill: () => boolean
}

function createEmptyColumns(): Columns {
	return {present: [], past: [], participle: []}
}

export function useBoard(options: UseBoardOptions = {}): UseBoardReturn {
	const {rng = Math.random} = options

	const boardColumns = shallowRef<Columns>(createEmptyColumns())
	const remainingPool = shallowRef<Verb[]>([])
	const currentSelection = shallowRef<Selection>(createEmptySelection())
	const errors = shallowRef<CellId[]>([])
	const resolved = shallowRef<number[]>([])

	const columns = computed(() => boardColumns.value)
	const pool = computed<readonly Verb[]>(() => remainingPool.value)
	const selection = computed(() => currentSelection.value)
	const errorCellIds = computed<readonly CellId[]>(() => errors.value)
	const resolvedVerbIds = computed<readonly number[]>(() => resolved.value)

	const unresolvedCells = computed(() =>
		boardColumns.value.present.filter((cell) => !resolved.value.includes(cell.verbId)),
	)

	const visibleVerbIds = computed(() => unresolvedCells.value.map((cell) => cell.verbId))
	const visibleCount = computed(() => unresolvedCells.value.length)
	const vacatedCount = computed(() => boardColumns.value.present.length - visibleCount.value)
	const isPoolExhausted = computed(() => remainingPool.value.length === 0)
	const isCleared = computed(() => visibleCount.value === 0)
	const matchedCount = computed(() => resolved.value.length)
	const selectedCount = computed(
		() => Object.values(currentSelection.value).filter((cellId) => cellId !== null).length,
	)

	function deal(verbs: readonly Verb[], boardSize: number): void {
		const setup = createBoard(verbs, boardSize, rng)
		boardColumns.value = setup.columns
		remainingPool.value = setup.pool
		currentSelection.value = createEmptySelection()
		errors.value = []
		resolved.value = []
	}

	function clearError(): void {
		if (errors.value.length > 0) errors.value = []
	}

	function clearSelection(): void {
		currentSelection.value = createEmptySelection()
	}

	function resolveTriad(verbId: number): void {
		resolved.value = [...resolved.value, verbId]
		currentSelection.value = createEmptySelection()
	}

	function refill(): boolean {
		const [incoming, ...rest] = remainingPool.value
		if (incoming === undefined) return false

		const next = refillSlots(boardColumns.value, resolved.value, incoming, rng)
		if (next === boardColumns.value) return false

		boardColumns.value = next
		remainingPool.value = rest

		return true
	}

	function select(cell: Cell): SelectionOutcome {
		clearError()

		if (resolved.value.includes(cell.verbId)) return {type: 'ignored'}

		if (currentSelection.value[cell.form] === cell.id) {
			currentSelection.value = {...currentSelection.value, [cell.form]: null}
			return {type: 'deselected'}
		}

		currentSelection.value = {...currentSelection.value, [cell.form]: cell.id}

		const selectedCells = getSelectedCells(boardColumns.value, currentSelection.value)
		if (selectedCells === null) return {type: 'selected'}

		const cellIds = selectedCells.map((selected) => selected.id)

		if (isMatchingTriad(selectedCells)) {
			const verbId = cell.verbId
			resolveTriad(verbId)
			return {type: 'match', verbId, cellIds}
		}

		errors.value = cellIds
		currentSelection.value = createEmptySelection()
		return {type: 'mismatch', cellIds}
	}

	return {
		columns,
		pool,
		selection,
		errorCellIds,
		resolvedVerbIds,
		visibleVerbIds,
		visibleCount,
		vacatedCount,
		isPoolExhausted,
		isCleared,
		matchedCount,
		selectedCount,
		deal,
		select,
		clearError,
		clearSelection,
		refill,
	}
}
