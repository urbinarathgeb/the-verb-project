/**
 * Construcción del tablero de emparejamiento (`MECHANICS.md` §1).
 *
 * Todo aquí es función pura, sin reactividad: la skill `vue-best-practices`
 * (`references/composables.md`, «Keep Utilities as Utilities») pide que la lógica
 * sin estado viva como utilidad y no dentro de un composable. `useBoard` se
 * limita a envolver estas funciones en estado reactivo.
 */

import type {Cell, CellId, CellStatus, Columns, Selection} from '@/types/game'
import type {Verb, VerbForm} from '@/types/verb'
import {shuffle, type Rng} from './shuffle'

/** Resultado de repartir un tablero. */
export interface BoardSetup {
	/** Las 3 columnas, cada una barajada de forma independiente. */
	columns: Columns
	/** Verbos del nivel que no entraron al tablero. Alimentan la reposición (T1.3). */
	pool: Verb[]
}

/**
 * Reintentos máximos al buscar un orden de columna distinto de los ya usados.
 *
 * Con `N ≥ 4` la probabilidad de agotarlos es despreciable. El límite existe
 * para que un tablero degenerado (`N ≤ 1`, donde no hay orden alternativo
 * posible) no provoque un bucle infinito.
 */
const MAX_ORDER_ATTEMPTS = 10

/** Identificador estable de celda, con el formato documentado en `CellId`. */
export function createCellId(verbId: number, form: VerbForm): string {
	return `${verbId}:${form}`
}

export function createCell(verb: Verb, form: VerbForm): Cell {
	return {
		id: createCellId(verb.id, form),
		verbId: verb.id,
		form,
		text: verb[form],
	}
}

/** Huella del orden de una columna, para comparar dos órdenes entre sí. */
function orderKey(verbs: readonly Verb[]): string {
	return verbs.map((verb) => verb.id).join(',')
}

/**
 * Baraja `verbs` evitando repetir cualquiera de los órdenes de `usedOrders`.
 *
 * El motivo es de jugabilidad, no estético: si dos columnas acabaran con los
 * verbos en el mismo orden, la fila delataría la correspondencia y el tablero se
 * resolvería sin saber los verbos, justo lo que `MECHANICS.md` §1 evita al
 * desordenar cada columna. Un barajado uniforme produce esa coincidencia con
 * probabilidad 1/N!, que con N = 6 es aproximadamente una partida de cada 250:
 * poco frecuente, pero demasiado como para dejarlo al azar.
 */
function shuffleIntoNewOrder(verbs: readonly Verb[], usedOrders: string[], rng: Rng): Verb[] {
	let candidate = shuffle(verbs, rng)

	for (let attempt = 1; attempt < MAX_ORDER_ATTEMPTS; attempt++) {
		if (!usedOrders.includes(orderKey(candidate))) break
		candidate = shuffle(verbs, rng)
	}

	return candidate
}

/**
 * Reparte un tablero de hasta `boardSize` verbos tomados de `verbs`.
 *
 * Los verbos visibles se eligen al azar del pool del nivel, y cada columna se
 * baraja por separado. Si `verbs` tiene menos elementos que `boardSize`, el
 * tablero se reparte con los que haya en lugar de fallar: los niveles garantizan
 * pool suficiente (hay un test para ello en `data/__tests__/levels.spec.ts`),
 * pero un tablero más pequeño sigue siendo jugable y un error aquí no.
 */
export function createBoard(
	verbs: readonly Verb[],
	boardSize: number,
	rng: Rng = Math.random,
): BoardSetup {
	const shuffledPool = shuffle(verbs, rng)
	const visibleCount = Math.max(0, Math.min(Math.floor(boardSize), shuffledPool.length))
	const visible = shuffledPool.slice(0, visibleCount)
	const pool = shuffledPool.slice(visibleCount)

	// Se acumulan los órdenes ya emitidos para que la siguiente columna no repita
	// ninguno. Depende de que las propiedades del literal de abajo se evalúen en
	// orden de escritura, que es el comportamiento garantizado en JavaScript.
	const usedOrders: string[] = []

	function buildColumn(form: VerbForm): Cell[] {
		const order = shuffleIntoNewOrder(visible, usedOrders, rng)
		usedOrders.push(orderKey(order))
		return order.map((verb) => createCell(verb, form))
	}

	// Las tres formas se escriben explícitamente en vez de recorrer `VERB_FORMS`:
	// así el tipo `Columns` se satisface sin aserciones, y añadir una cuarta forma
	// rompería la compilación aquí, que es donde debe notarse.
	const columns: Columns = {
		present: buildColumn('present'),
		past: buildColumn('past'),
		participle: buildColumn('participle'),
	}

	return {columns, pool}
}

/** Selección vacía: ninguna columna tiene celda elegida. */
export function createEmptySelection(): Selection {
	return {present: null, past: null, participle: null}
}

/** Busca una celda por su id dentro de la columna de una forma concreta. */
export function findCell(columns: Columns, form: VerbForm, cellId: CellId): Cell | undefined {
	return columns[form].find((cell) => cell.id === cellId)
}

/**
 * Las tres celdas de una selección completa, o `null` si aún falta alguna.
 *
 * Devolver una tupla y no un array suelto permite validar sin comprobaciones de
 * longitud en el llamador.
 */
export function getSelectedCells(
	columns: Columns,
	selection: Selection,
): [Cell, Cell, Cell] | null {
	const present =
		selection.present === null ? undefined : findCell(columns, 'present', selection.present)
	const past = selection.past === null ? undefined : findCell(columns, 'past', selection.past)
	const participle =
		selection.participle === null
			? undefined
			: findCell(columns, 'participle', selection.participle)

	if (present === undefined || past === undefined || participle === undefined) return null

	return [present, past, participle]
}

/**
 * ¿Las tres celdas pertenecen al mismo verbo?
 *
 * Compara **ids de verbo, nunca los textos mostrados** (`MECHANICS.md` §1). El
 * catálogo actual no tiene formas repetidas dentro de una columna —hay un test
 * que lo vigila—, pero validar por texto convertiría ese detalle del catálogo en
 * un requisito del motor.
 */
export function isMatchingTriad(cells: readonly [Cell, Cell, Cell]): boolean {
	const [first, second, third] = cells
	return first.verbId === second.verbId && second.verbId === third.verbId
}

/**
 * Estado visual de una celda, derivado del estado del tablero.
 *
 * Es una función y no un `computed` porque depende de la celda: el `computed`
 * vive en el componente que renderiza cada celda (T3).
 */
export function getCellStatus(
	cell: Cell,
	selection: Selection,
	errorCellIds: readonly CellId[],
	resolvedVerbIds: readonly number[],
): CellStatus {
	if (errorCellIds.includes(cell.id)) return 'error'
	if (resolvedVerbIds.includes(cell.verbId)) return 'resolved'
	if (selection[cell.form] === cell.id) return 'selected'
	return 'neutral'
}

/**
 * Coloca `incomingCell` en la columna, retirando la celda del verbo resuelto.
 *
 * La celda nueva no ocupa necesariamente el hueco: va a `targetRow`, y la celda
 * que estuviera ahí baja al hueco. Es un intercambio de dos posiciones, así que
 * mueve una sola celda además de la que entra — el resto del tablero permanece
 * donde el jugador lo dejó.
 */
function replaceInColumn(
	cells: readonly Cell[],
	resolvedVerbId: number,
	incomingCell: Cell | null,
	targetRow: number | undefined,
): Cell[] {
	const holeIndex = cells.findIndex((cell) => cell.verbId === resolvedVerbId)
	if (holeIndex === -1) return [...cells]

	const result = [...cells]

	// Sin verbo entrante el hueco no se rellena: el pool se agotó y el tablero
	// se reduce hasta resolverse por completo (`PLAN.md`, Bitácora, P1).
	if (incomingCell === null) {
		result.splice(holeIndex, 1)
		return result
	}

	const target = targetRow ?? holeIndex
	const displaced = result[target]

	if (target === holeIndex || displaced === undefined) {
		result[holeIndex] = incomingCell
		return result
	}

	result[holeIndex] = displaced
	result[target] = incomingCell
	return result
}

/**
 * Retira del tablero la tríada de `resolvedVerbId` y, si hay verbo disponible,
 * mete una tríada nueva en su lugar (`PLAN.md`, Bitácora, P1).
 *
 * Las filas de destino se eligen **distintas entre las tres columnas**. Si la
 * tríada entrante quedara alineada en dos columnas, el jugador —que acaba de ver
 * cambiar esas tres celdas— sabría de inmediato que pertenecen al mismo verbo.
 * Colocarla sin más en los huecos liberados provoca esa alineación en torno al
 * 44 % de las reposiciones con `N = 6`, así que no basta con dejarlo al azar.
 */
export function replaceTriad(
	columns: Columns,
	resolvedVerbId: number,
	incoming: Verb | null,
	rng: Rng = Math.random,
): Columns {
	const height = columns.present.length
	const rows = shuffle(
		Array.from({length: height}, (_, index) => index),
		rng,
	)

	function rebuild(form: VerbForm, targetRow: number | undefined): Cell[] {
		const incomingCell = incoming === null ? null : createCell(incoming, form)
		return replaceInColumn(columns[form], resolvedVerbId, incomingCell, targetRow)
	}

	// Una fila distinta por columna, tomada del barajado de arriba. Con un tablero
	// de menos de 3 filas alguna queda `undefined` y esa columna usa su hueco.
	return {
		present: rebuild('present', rows[0]),
		past: rebuild('past', rows[1]),
		participle: rebuild('participle', rows[2]),
	}
}
