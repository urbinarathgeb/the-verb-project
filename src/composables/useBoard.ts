import {computed, shallowRef, type ComputedRef} from 'vue'
import {
	createBoard,
	createEmptySelection,
	getSelectedCells,
	isMatchingTriad,
	replaceTriad,
} from '@/lib/board'
import type {Rng} from '@/lib/shuffle'
import type {Cell, CellId, Columns, Selection, SelectionOutcome} from '@/types/game'
import type {Verb} from '@/types/verb'

/**
 * Estado reactivo del tablero de emparejamiento: reparto, selección, validación
 * de tríadas y reposición (`MECHANICS.md` §1).
 *
 * No sabe de puntaje, tiempo ni fin de partida: `select` devuelve un
 * `SelectionOutcome` y el motor de juego (Fase 2) decide las consecuencias, que
 * difieren por modo. La lógica pura vive en `lib/board.ts`; aquí sólo se envuelve
 * en estado, siguiendo la skill `vue-best-practices`
 * (`references/composables.md`, «Keep Utilities as Utilities»).
 *
 * No es un store de Pinia porque el tablero no se comparte entre componentes
 * desconectados: pertenece a la partida en curso y muere con ella
 * (`CLAUDE.md` §6).
 */
export interface UseBoardOptions {
	/**
	 * Fuente de aleatoriedad. Inyectable para que los tests puedan fijar una
	 * semilla y obtener siempre el mismo tablero.
	 */
	rng?: Rng
}

export interface UseBoardReturn {
	columns: ComputedRef<Columns>
	/** Verbos del nivel aún no mostrados, en el orden en que entrarán al tablero. */
	pool: ComputedRef<readonly Verb[]>
	selection: ComputedRef<Selection>
	/** Celdas del último intento fallido. Transitorio: lo limpia `clearError` o la siguiente selección. */
	errorCellIds: ComputedRef<readonly CellId[]>
	/** Verbos acertados, en orden de resolución. Su longitud es el contador de aciertos. */
	resolvedVerbIds: ComputedRef<readonly number[]>
	/** Ids de los verbos presentes en el tablero, sin orden significativo. */
	visibleVerbIds: ComputedRef<number[]>
	/** Número de tríadas visibles. Coincide con la altura de cada columna. */
	visibleCount: ComputedRef<number>
	/** `true` cuando ya no quedan verbos para reponer y el tablero empezará a reducirse. */
	isPoolExhausted: ComputedRef<boolean>
	/** `true` cuando no queda ninguna celda: el tablero se resolvió por completo. */
	isCleared: ComputedRef<boolean>
	/** Cuántos aciertos lleva la partida. */
	matchedCount: ComputedRef<number>
	/** Cuántas columnas tienen ya una celda elegida. */
	selectedCount: ComputedRef<number>
	/** Reparte un tablero nuevo. Llamarlo otra vez descarta el anterior por completo. */
	deal: (verbs: readonly Verb[], boardSize: number) => void
	/** Registra la pulsación de una celda y devuelve qué ocurrió. */
	select: (cell: Cell) => SelectionOutcome
	/** Retira el estado de error una vez mostrado su feedback. */
	clearError: () => void
	/** Vacía la selección sin validar. Útil al pausar o abandonar la partida. */
	clearSelection: () => void
}

/** Tablero vacío, el estado antes del primer reparto (`GameStatus` en `idle`). */
function createEmptyColumns(): Columns {
	return {present: [], past: [], participle: []}
}

export function useBoard(options: UseBoardOptions = {}): UseBoardReturn {
	const {rng = Math.random} = options

	// `shallowRef` y no `ref`: las celdas son inmutables y cada operación
	// reemplaza la estructura entera en lugar de mutarla, así que la reactividad
	// profunda sólo añadiría el coste de proxiar cada celda sin aportar nada.
	const boardColumns = shallowRef<Columns>(createEmptyColumns())
	const remainingPool = shallowRef<Verb[]>([])
	const currentSelection = shallowRef<Selection>(createEmptySelection())
	const errors = shallowRef<CellId[]>([])
	const resolved = shallowRef<number[]>([])

	/**
	 * El estado se expone mediante `computed` en lugar de `readonly()` para
	 * impedir la escritura desde fuera sin envolver los tipos en `DeepReadonly`,
	 * que complicaría a los consumidores sin ganancia: `Cell` y `Verb` ya son
	 * inmutables en su definición.
	 */
	const columns = computed(() => boardColumns.value)
	const pool = computed<readonly Verb[]>(() => remainingPool.value)
	const selection = computed(() => currentSelection.value)
	const errorCellIds = computed<readonly CellId[]>(() => errors.value)
	const resolvedVerbIds = computed<readonly number[]>(() => resolved.value)

	// La columna de presente basta para leer qué verbos hay en el tablero: las
	// tres columnas contienen siempre el mismo conjunto de verbos, sólo difieren
	// en el orden.
	const visibleVerbIds = computed(() => boardColumns.value.present.map((cell) => cell.verbId))
	const visibleCount = computed(() => boardColumns.value.present.length)
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

	/** Saca del tablero la tríada acertada y repone otra si queda pool. */
	function resolveTriad(verbId: number): void {
		const [incoming, ...rest] = remainingPool.value

		boardColumns.value = replaceTriad(boardColumns.value, verbId, incoming ?? null, rng)
		remainingPool.value = rest
		resolved.value = [...resolved.value, verbId]
		currentSelection.value = createEmptySelection()
	}

	function select(cell: Cell): SelectionOutcome {
		// El feedback de error dura hasta la siguiente interacción del jugador, sin
		// depender de un temporizador: así nunca se queda pegado en pantalla.
		clearError()

		if (resolved.value.includes(cell.verbId)) return {type: 'ignored'}

		// Pulsar la celda ya elegida la deselecciona. `MECHANICS.md` §1 no cubre
		// este caso —sólo el reemplazo dentro de la columna—, y en pantalla táctil
		// deshacer una selección es lo que el jugador espera.
		if (currentSelection.value[cell.form] === cell.id) {
			currentSelection.value = {...currentSelection.value, [cell.form]: null}
			return {type: 'deselected'}
		}

		// Sustituye la selección previa de esa columna, si la hubiera.
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
		isPoolExhausted,
		isCleared,
		matchedCount,
		selectedCount,
		deal,
		select,
		clearError,
		clearSelection,
	}
}
