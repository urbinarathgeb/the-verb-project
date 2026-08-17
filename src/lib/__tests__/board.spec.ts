import {describe, expect, it} from 'vitest'
import {
	createBoard,
	createCell,
	createCellId,
	createEmptySelection,
	findCell,
	getCellStatus,
	getSelectedCells,
	isMatchingTriad,
	replaceTriad,
} from '../board'
import {createSeededRng} from '../shuffle'
import {VERB_FORMS, type Verb} from '@/types/verb'
import {VERBS, getVerbsForDifficulty} from '@/data/verbs'
import {getLevelConfig} from '@/data/levels'
import {DIFFICULTIES, type Cell, type Selection} from '@/types/game'

/**
 * Verbos sintéticos en lugar del catálogo real: el tablero no debe depender del
 * contenido de `verbs.json`, y con textos predecibles los fallos se leen mejor.
 * La integración con el catálogo real se comprueba en el último bloque.
 */
function makeVerb(id: number): Verb {
	return {
		id,
		level: 'beginner',
		present: `present-${id}`,
		past: `past-${id}`,
		participle: `participle-${id}`,
	}
}

function makeVerbs(count: number): Verb[] {
	return Array.from({length: count}, (_, index) => makeVerb(index + 1))
}

/** Los ids de los verbos de una columna, en el orden en que se muestran. */
function orderOf(cells: readonly {verbId: number}[]): number[] {
	return cells.map((cell) => cell.verbId)
}

describe('createCellId', () => {
	it('usa el formato `verbId:form`', () => {
		expect(createCellId(7, 'participle')).toBe('7:participle')
	})

	it('produce un id distinto por cada forma del mismo verbo', () => {
		const ids = VERB_FORMS.map((form) => createCellId(1, form))

		expect(new Set(ids).size).toBe(VERB_FORMS.length)
	})
})

describe('createCell', () => {
	const verb = makeVerb(1)

	it.each(VERB_FORMS)('toma el texto de la forma "%s"', (form) => {
		expect(createCell(verb, form).text).toBe(verb[form])
	})

	it('conserva la identidad del verbo y la forma', () => {
		const cell = createCell(verb, 'past')

		expect(cell.verbId).toBe(verb.id)
		expect(cell.form).toBe('past')
		expect(cell.id).toBe('1:past')
	})
})

describe('createBoard', () => {
	it('reparte tres columnas de tamaño `boardSize`', () => {
		const {columns} = createBoard(makeVerbs(20), 6, createSeededRng(1))

		for (const form of VERB_FORMS) {
			expect(columns[form]).toHaveLength(6)
		}
	})

	it('cada columna contiene sólo celdas de su propia forma', () => {
		const {columns} = createBoard(makeVerbs(20), 8, createSeededRng(2))

		for (const form of VERB_FORMS) {
			expect(columns[form].every((cell) => cell.form === form)).toBe(true)
		}
	})

	/**
	 * Ésta es la invariante estructural del tablero: si faltara una celda o
	 * hubiera una repetida, una tríada sería imposible de completar o habría dos
	 * caminos para resolver el mismo verbo.
	 */
	it('existe exactamente una celda por cada par (verbo, forma)', () => {
		const {columns} = createBoard(makeVerbs(20), 10, createSeededRng(3))
		const allCells = VERB_FORMS.flatMap((form) => columns[form])

		expect(allCells).toHaveLength(10 * VERB_FORMS.length)
		expect(new Set(allCells.map((cell) => cell.id)).size).toBe(allCells.length)
	})

	it('las tres columnas contienen el mismo conjunto de verbos', () => {
		const {columns} = createBoard(makeVerbs(20), 8, createSeededRng(4))
		const present = new Set(orderOf(columns.present))

		expect(new Set(orderOf(columns.past))).toEqual(present)
		expect(new Set(orderOf(columns.participle))).toEqual(present)
	})

	/**
	 * La razón de barajar cada columna por separado (`MECHANICS.md` §1) es que la
	 * fila no delate la correspondencia. Con `N = 3` un barajado uniforme haría
	 * coincidir dos columnas en 1 de cada 6 intentos, así que sobre 200 semillas
	 * este test detecta de inmediato la ausencia del rechazo de órdenes repetidos.
	 */
	it('nunca deja dos columnas con el mismo orden de verbos', () => {
		const verbs = makeVerbs(3)

		for (let seed = 0; seed < 200; seed++) {
			const {columns} = createBoard(verbs, 3, createSeededRng(seed))
			const orders = VERB_FORMS.map((form) => orderOf(columns[form]).join(','))

			expect(new Set(orders).size).toBe(VERB_FORMS.length)
		}
	})

	it('deja en el pool los verbos que no entraron al tablero', () => {
		const verbs = makeVerbs(20)
		const {columns, pool} = createBoard(verbs, 6, createSeededRng(5))

		const visible = new Set(orderOf(columns.present))
		const pooled = pool.map((verb) => verb.id)

		expect(pool).toHaveLength(14)
		expect(pooled.some((id) => visible.has(id))).toBe(false)
		expect(new Set([...visible, ...pooled])).toEqual(new Set(verbs.map((verb) => verb.id)))
	})

	it('no elige siempre los mismos verbos para el tablero', () => {
		const verbs = makeVerbs(20)
		const first = orderOf(createBoard(verbs, 6, createSeededRng(1)).columns.present)
		const second = orderOf(createBoard(verbs, 6, createSeededRng(2)).columns.present)

		expect(new Set(first)).not.toEqual(new Set(second))
	})

	it('es determinista: la misma semilla reparte el mismo tablero', () => {
		const verbs = makeVerbs(20)

		expect(createBoard(verbs, 8, createSeededRng(7))).toEqual(
			createBoard(verbs, 8, createSeededRng(7)),
		)
	})

	it('semillas distintas reparten tableros distintos', () => {
		const verbs = makeVerbs(20)

		expect(createBoard(verbs, 8, createSeededRng(1))).not.toEqual(
			createBoard(verbs, 8, createSeededRng(2)),
		)
	})

	it('no muta el array de verbos recibido', () => {
		const verbs = makeVerbs(12)
		const snapshot = [...verbs]

		createBoard(verbs, 6, createSeededRng(9))

		expect(verbs).toEqual(snapshot)
	})

	describe('casos límite', () => {
		it('reparte con lo que haya si el pool es menor que `boardSize`', () => {
			const {columns, pool} = createBoard(makeVerbs(4), 10, createSeededRng(1))

			expect(columns.present).toHaveLength(4)
			expect(pool).toEqual([])
		})

		it('acepta un pool vacío sin fallar', () => {
			const {columns, pool} = createBoard([], 6, createSeededRng(1))

			expect(VERB_FORMS.every((form) => columns[form].length === 0)).toBe(true)
			expect(pool).toEqual([])
		})

		it('con `boardSize` 0 devuelve columnas vacías y todo el pool', () => {
			const {columns, pool} = createBoard(makeVerbs(5), 0, createSeededRng(1))

			expect(columns.present).toEqual([])
			expect(pool).toHaveLength(5)
		})

		it('trata un `boardSize` negativo como 0', () => {
			const {columns, pool} = createBoard(makeVerbs(5), -3, createSeededRng(1))

			expect(columns.present).toEqual([])
			expect(pool).toHaveLength(5)
		})

		it('trunca un `boardSize` fraccionario', () => {
			expect(createBoard(makeVerbs(10), 4.7, createSeededRng(1)).columns.present).toHaveLength(4)
		})

		/**
		 * Con un solo verbo no existe ningún orden alternativo, así que el rechazo
		 * de órdenes repetidos no puede satisfacerse. Debe agotar sus reintentos y
		 * devolver el tablero, nunca quedarse colgado.
		 */
		it('termina con un tablero de un único verbo', () => {
			const {columns} = createBoard(makeVerbs(1), 1, createSeededRng(1))

			expect(VERB_FORMS.every((form) => columns[form].length === 1)).toBe(true)
		})
	})

	describe('integración con el catálogo real', () => {
		it.each(DIFFICULTIES)('reparte un tablero completo para "%s"', (difficulty) => {
			const {boardSize} = getLevelConfig(difficulty)
			const verbs = getVerbsForDifficulty(difficulty)
			const {columns, pool} = createBoard(verbs, boardSize, createSeededRng(1))

			expect(columns.present).toHaveLength(boardSize)
			expect(pool).toHaveLength(verbs.length - boardSize)
		})

		it('las celdas muestran textos del catálogo, no marcadores vacíos', () => {
			const {columns} = createBoard(VERBS, 10, createSeededRng(1))
			const texts = VERB_FORMS.flatMap((form) => columns[form].map((cell) => cell.text))

			expect(texts.every((text) => text.trim().length > 0)).toBe(true)
		})
	})
})

describe('createEmptySelection', () => {
	it('deja las tres columnas sin selección', () => {
		const selection = createEmptySelection()

		expect(VERB_FORMS.every((form) => selection[form] === null)).toBe(true)
	})
})

describe('findCell', () => {
	const {columns} = createBoard(makeVerbs(10), 6, createSeededRng(1))

	it('encuentra la celda por su id dentro de su columna', () => {
		const target = columns.past[2]

		expect(findCell(columns, 'past', target?.id ?? '')).toBe(target)
	})

	it('no busca fuera de la columna indicada', () => {
		const target = columns.past[2]

		expect(findCell(columns, 'present', target?.id ?? '')).toBeUndefined()
	})

	it('devuelve `undefined` con un id inexistente', () => {
		expect(findCell(columns, 'present', '999:present')).toBeUndefined()
	})
})

describe('getSelectedCells', () => {
	const {columns} = createBoard(makeVerbs(10), 6, createSeededRng(2))

	function selectionOf(verbId: number): Selection {
		return {
			present: createCellId(verbId, 'present'),
			past: createCellId(verbId, 'past'),
			participle: createCellId(verbId, 'participle'),
		}
	}

	it('devuelve las tres celdas cuando la selección está completa', () => {
		const verbId = columns.present[0]?.verbId ?? 0
		const cells = getSelectedCells(columns, selectionOf(verbId))

		expect(cells).not.toBeNull()
		expect(cells?.map((cell) => cell.form)).toEqual(['present', 'past', 'participle'])
	})

	it.each(VERB_FORMS)('devuelve `null` si falta la columna "%s"', (form) => {
		const verbId = columns.present[0]?.verbId ?? 0

		expect(getSelectedCells(columns, {...selectionOf(verbId), [form]: null})).toBeNull()
	})

	it('devuelve `null` si un id seleccionado ya no está en el tablero', () => {
		expect(getSelectedCells(columns, selectionOf(999))).toBeNull()
	})
})

describe('isMatchingTriad', () => {
	const {columns} = createBoard(makeVerbs(10), 6, createSeededRng(3))

	/** Las tres celdas del verbo `verbId`, una por columna. */
	function triadOf(verbId: number): [Cell, Cell, Cell] {
		const cells = getSelectedCells(columns, {
			present: createCellId(verbId, 'present'),
			past: createCellId(verbId, 'past'),
			participle: createCellId(verbId, 'participle'),
		})
		if (cells === null) throw new Error(`El verbo ${verbId} no está en el tablero`)
		return cells
	}

	it('acepta las tres formas del mismo verbo', () => {
		const verbId = columns.present[0]?.verbId ?? 0

		expect(isMatchingTriad(triadOf(verbId))).toBe(true)
	})

	it('rechaza una tríada con un verbo distinto en una columna', () => {
		const [first, second] = [
			triadOf(columns.present[0]?.verbId ?? 0),
			triadOf(columns.present[1]?.verbId ?? 0),
		]

		expect(isMatchingTriad([first[0], first[1], second[2]])).toBe(false)
	})

	/**
	 * La validación es por identidad, no por texto (`MECHANICS.md` §1). Dos verbos
	 * distintos que compartieran la misma cadena no deben pasar por correctos.
	 */
	it('no valida por texto: mismas cadenas con ids distintos no son tríada', () => {
		const first = triadOf(columns.present[0]?.verbId ?? 0)
		const impostor: Cell = {...first[2], verbId: -1, id: 'impostor'}

		expect(isMatchingTriad([first[0], first[1], impostor])).toBe(false)
	})
})

describe('getCellStatus', () => {
	const cell = createCell(makeVerb(1), 'past')
	const empty = createEmptySelection()

	it('una celda sin relación con el estado es neutra', () => {
		expect(getCellStatus(cell, empty, [], [])).toBe('neutral')
	})

	it('marca como seleccionada la celda elegida en su columna', () => {
		expect(getCellStatus(cell, {...empty, past: cell.id}, [], [])).toBe('selected')
	})

	it('no marca como seleccionada una celda con el mismo id en otra columna', () => {
		expect(getCellStatus(cell, {...empty, present: cell.id}, [], [])).toBe('neutral')
	})

	it('marca como resuelta cualquier celda de un verbo ya acertado', () => {
		expect(getCellStatus(cell, empty, [], [cell.verbId])).toBe('resolved')
	})

	/** El error es feedback inmediato: debe verse por encima de cualquier otro estado. */
	it('el error tiene prioridad sobre la selección', () => {
		expect(getCellStatus(cell, {...empty, past: cell.id}, [cell.id], [])).toBe('error')
	})
})

describe('replaceTriad', () => {
	const verbs = makeVerbs(10)
	const {columns, pool} = createBoard(verbs, 6, createSeededRng(4))
	const resolvedVerbId = columns.present[0]?.verbId ?? 0
	const incoming = pool[0] ?? makeVerb(99)

	it('retira del tablero las tres celdas del verbo resuelto', () => {
		const next = replaceTriad(columns, resolvedVerbId, incoming, createSeededRng(1))

		for (const form of VERB_FORMS) {
			expect(next[form].some((cell) => cell.verbId === resolvedVerbId)).toBe(false)
		}
	})

	it('mete las tres celdas del verbo entrante', () => {
		const next = replaceTriad(columns, resolvedVerbId, incoming, createSeededRng(1))

		for (const form of VERB_FORMS) {
			const entering = next[form].filter((cell) => cell.verbId === incoming.id)
			expect(entering).toHaveLength(1)
			expect(entering[0]?.text).toBe(incoming[form])
		}
	})

	it('mantiene la altura del tablero mientras haya pool', () => {
		const next = replaceTriad(columns, resolvedVerbId, incoming, createSeededRng(1))

		expect(VERB_FORMS.every((form) => next[form].length === 6)).toBe(true)
	})

	it('conserva el resto de verbos del tablero', () => {
		const before = new Set(columns.present.map((cell) => cell.verbId))
		before.delete(resolvedVerbId)

		const next = replaceTriad(columns, resolvedVerbId, incoming, createSeededRng(1))
		const after = new Set(next.present.map((cell) => cell.verbId))

		expect([...before].every((id) => after.has(id))).toBe(true)
	})

	it('no muta las columnas recibidas', () => {
		const snapshot = structuredClone(columns)

		replaceTriad(columns, resolvedVerbId, incoming, createSeededRng(1))

		expect(columns).toEqual(snapshot)
	})

	/**
	 * Ésta es la razón de ser de la elección de filas: el jugador acaba de ver
	 * cambiar tres celdas, así que si dos quedaran en la misma fila sabría gratis
	 * que pertenecen al mismo verbo. Colocar la tríada en los huecos liberados sin
	 * más produce esa alineación en torno al 44 % de las veces con N = 6.
	 */
	it('nunca coloca la tríada entrante en la misma fila de dos columnas', () => {
		for (let seed = 0; seed < 200; seed++) {
			const board = createBoard(verbs, 6, createSeededRng(seed))
			const resolvedId = board.columns.present[0]?.verbId ?? 0
			const entering = board.pool[0] ?? makeVerb(99)
			const next = replaceTriad(board.columns, resolvedId, entering, createSeededRng(seed))

			const rows = VERB_FORMS.map((form) =>
				next[form].findIndex((cell) => cell.verbId === entering.id),
			)

			expect(new Set(rows).size).toBe(VERB_FORMS.length)
		}
	})

	it('mueve como máximo una celda además de la que entra', () => {
		const next = replaceTriad(columns, resolvedVerbId, incoming, createSeededRng(7))

		for (const form of VERB_FORMS) {
			const moved = columns[form].filter((cell, index) => next[form][index]?.id !== cell.id)
			// La celda resuelta y, si el destino no era su hueco, la desplazada.
			expect(moved.length).toBeLessThanOrEqual(2)
		}
	})

	describe('con el pool agotado', () => {
		it('reduce el tablero en una fila por columna', () => {
			const next = replaceTriad(columns, resolvedVerbId, null, createSeededRng(1))

			expect(VERB_FORMS.every((form) => next[form].length === 5)).toBe(true)
		})

		it('deja el tablero vacío al resolver la última tríada', () => {
			const single = createBoard(makeVerbs(1), 1, createSeededRng(1))
			const lastVerbId = single.columns.present[0]?.verbId ?? 0
			const next = replaceTriad(single.columns, lastVerbId, null, createSeededRng(1))

			expect(VERB_FORMS.every((form) => next[form].length === 0)).toBe(true)
		})
	})

	it('deja las columnas intactas si el verbo no está en el tablero', () => {
		const next = replaceTriad(columns, -1, incoming, createSeededRng(1))

		expect(next).toEqual(columns)
	})
})
