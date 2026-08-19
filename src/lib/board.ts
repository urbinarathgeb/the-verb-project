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
 * Reintentos máximos al buscar un orden de columna que no comparta ninguna fila
 * con las anteriores.
 *
 * Dos permutaciones al azar no coinciden en ninguna posición con probabilidad
 * ≈ 1/e (37 %), así que la tercera columna necesita del orden de veinte intentos.
 * Cien deja margen de sobra. El límite existe para que un tablero degenerado
 * (`N ≤ 1`, donde no hay orden alternativo posible) no provoque un bucle
 * infinito; en ese caso se acepta el último candidato.
 */
const MAX_ORDER_ATTEMPTS = 100

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
		// Sólo el presente lleva significado; ver el porqué en `Cell.meaning`.
		meaning: form === 'present' ? verb.meaning : null,
	}
}

/** ¿Algún verbo de `candidate` cae en la misma fila que en un orden ya emitido? */
function sharesAnyRow(
	candidate: readonly Verb[],
	usedOrders: readonly (readonly Verb[])[],
): boolean {
	return usedOrders.some((order) => order.some((verb, index) => verb.id === candidate[index]?.id))
}

/**
 * Baraja `verbs` de modo que **ningún verbo repita fila** respecto a las
 * columnas ya emitidas.
 *
 * Es más exigente que evitar órdenes idénticos, y el motivo es de jugabilidad.
 * La regla de `MECHANICS.md` §1 dice que una tríada entrante nunca puede quedar
 * alineada en dos columnas, porque delataría que esas celdas son del mismo
 * verbo. Con el reparto barajado libremente, el 45 % de los verbos nacía ya
 * alineado, y al resolverse dejaban huecos que forzaban a alinear la tríada
 * entrante: la regla se rompía en un 5 % de las reposiciones por mucho cuidado
 * que se pusiera al elegir. Garantizarlo desde el reparto convierte «ningún
 * verbo comparte fila entre columnas» en un invariante de todo el tablero, y las
 * reposiciones lo heredan.
 *
 * De paso subsume la regla anterior: dos columnas con el mismo orden coincidirían
 * en todas las filas.
 */
function shuffleIntoDiscordantOrder(
	verbs: readonly Verb[],
	usedOrders: readonly Verb[][],
	rng: Rng,
): Verb[] {
	let candidate = shuffle(verbs, rng)

	for (let attempt = 1; attempt < MAX_ORDER_ATTEMPTS; attempt++) {
		if (!sharesAnyRow(candidate, usedOrders)) break
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
	const usedOrders: Verb[][] = []

	function buildColumn(form: VerbForm): Cell[] {
		const order = shuffleIntoDiscordantOrder(visible, usedOrders, rng)
		usedOrders.push(order)
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

/** Casilla libre: la fila y el verbo resuelto que la dejó. */
interface FreeSlot {
	readonly row: number
	readonly verbId: number
}

/** Casillas de una columna cuya celda pertenece a un verbo ya resuelto. */
function freeSlots(cells: readonly Cell[], resolvedVerbIds: readonly number[]): FreeSlot[] {
	return cells.flatMap((cell, row) =>
		resolvedVerbIds.includes(cell.verbId) ? [{row, verbId: cell.verbId}] : [],
	)
}

/** ¿Se puede elegir una fila distinta de cada conjunto? */
function hasDistinctAssignment(
	present: readonly FreeSlot[],
	past: readonly FreeSlot[],
	participle: readonly FreeSlot[],
): boolean {
	for (const presentSlot of present) {
		for (const pastSlot of past) {
			if (pastSlot.row === presentSlot.row) continue

			for (const participleSlot of participle) {
				if (participleSlot.row !== presentSlot.row && participleSlot.row !== pastSlot.row) {
					return true
				}
			}
		}
	}

	return false
}

/**
 * Una casilla libre por columna para la tríada entrante.
 *
 * Se buscan tres condiciones, en este orden de importancia:
 *
 * 1. **Que no sean las tres casillas de la misma tríada resuelta.** Es el peor
 *    de los regalos: el jugador acaba de ver esas tres celdas atenuarse juntas,
 *    así que ya sabe que forman tríada; ver tres celdas nuevas exactamente ahí
 *    le identifica el verbo entero sin pensar. Con un solo hueco es inevitable
 *    —por eso el motor de juego exige un mínimo de huecos antes de reponer—,
 *    pero con dos o más casi siempre se puede evitar.
 * 2. **Filas distintas entre las tres columnas** (`MECHANICS.md` §1): dos celdas
 *    alineadas revelarían que pertenecen al mismo verbo.
 * 3. **Que el resto siga teniendo salida.** Consumir la casilla equivocada puede
 *    dejar a la reposición siguiente sin ninguna combinación válida.
 *
 * La búsqueda es exhaustiva sobre las casillas barajadas —el azar lo da el
 * barajado— y su coste está acotado por el tamaño del tablero, que no pasa de
 * diez filas. Si no existe ninguna opción perfecta se elige la menos mala.
 */
function pickDistinctRows(
	presentSlots: readonly FreeSlot[],
	pastSlots: readonly FreeSlot[],
	participleSlots: readonly FreeSlot[],
	rng: Rng,
): [number, number, number] {
	const present = shuffle(presentSlots, rng)
	const past = shuffle(pastSlots, rng)
	const participle = shuffle(participleSlots, rng)

	let best: {penalty: number; rows: [number, number, number]} | null = null

	for (const presentSlot of present) {
		for (const pastSlot of past) {
			for (const participleSlot of participle) {
				const rows: [number, number, number] = [presentSlot.row, pastSlot.row, participleSlot.row]

				const aligned = new Set(rows).size !== rows.length
				const sameTriad =
					presentSlot.verbId === pastSlot.verbId && pastSlot.verbId === participleSlot.verbId

				const restPresent = present.filter((slot) => slot.row !== presentSlot.row)
				const restPast = past.filter((slot) => slot.row !== pastSlot.row)
				const restParticiple = participle.filter((slot) => slot.row !== participleSlot.row)

				// Sin huecos restantes no habrá más reposiciones a las que estorbar.
				const leavesWayOut =
					restPresent.length === 0 || hasDistinctAssignment(restPresent, restPast, restParticiple)

				const penalty = (sameTriad ? 4 : 0) + (aligned ? 2 : 0) + (leavesWayOut ? 0 : 1)

				if (best === null || penalty < best.penalty) best = {penalty, rows}
				if (penalty === 0) return rows
			}
		}
	}

	return best?.rows ?? [present[0]?.row ?? 0, past[0]?.row ?? 0, participle[0]?.row ?? 0]
}

/** Sustituye la celda de una fila, dejando el resto de la columna intacto. */
function placeAt(cells: readonly Cell[], row: number, cell: Cell): Cell[] {
	const next = [...cells]
	next[row] = cell

	return next
}

/**
 * Mete una tríada nueva en las casillas libres del tablero.
 *
 * «Libre» es la casilla de un verbo ya resuelto: al acertar, sus celdas no se
 * retiran, se quedan atenuadas ocupando su sitio hasta que una reposición las
 * sustituye (`PLAN.md`, Bitácora, D8).
 *
 * **No mueve ninguna celda ocupada.** Esa es la diferencia con la mecánica
 * anterior, que intercambiaba dos posiciones por columna y hacía que el jugador
 * perdiera de vista una celda que acababa de localizar. Es posible ahora porque
 * la reposición se difiere: al acumularse huecos hay filas libres de sobra donde
 * colocar la entrante en filas distintas, sin desplazar nada.
 *
 * Si el pool se agotó (`incoming === null`) o alguna columna no tiene hueco, el
 * tablero se devuelve tal cual: las celdas resueltas se quedan atenuadas y el
 * tablero se vacía a medida que se aciertan las que quedan.
 */
export function refillSlots(
	columns: Columns,
	resolvedVerbIds: readonly number[],
	incoming: Verb | null,
	rng: Rng = Math.random,
): Columns {
	if (incoming === null) return columns

	const presentSlots = freeSlots(columns.present, resolvedVerbIds)
	const pastSlots = freeSlots(columns.past, resolvedVerbIds)
	const participleSlots = freeSlots(columns.participle, resolvedVerbIds)

	if (presentSlots.length === 0 || pastSlots.length === 0 || participleSlots.length === 0) {
		return columns
	}

	const [presentRow, pastRow, participleRow] = pickDistinctRows(
		presentSlots,
		pastSlots,
		participleSlots,
		rng,
	)

	return {
		present: placeAt(columns.present, presentRow, createCell(incoming, 'present')),
		past: placeAt(columns.past, pastRow, createCell(incoming, 'past')),
		participle: placeAt(columns.participle, participleRow, createCell(incoming, 'participle')),
	}
}
