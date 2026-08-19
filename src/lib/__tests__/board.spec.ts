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
	refillSlots,
} from '../board'
import {createSeededRng} from '../shuffle'
import {VERB_FORMS, type Verb, type VerbForm} from '@/types/verb'
import {VERBS, getVerbsForDifficulty} from '@/data/verbs'
import {getLevelConfig} from '@/data/levels'
import {DIFFICULTIES, type Cell, type Selection} from '@/types/game'

function makeVerb(id: number): Verb {
	return {
		id,
		level: 'beginner',
		present: `present-${id}`,
		meaning: `significado-${id}`,
		past: `past-${id}`,
		participle: `participle-${id}`,
	}
}

function makeVerbs(count: number): Verb[] {
	return Array.from({length: count}, (_, index) => makeVerb(index + 1))
}

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

	it('pone el significado en la celda de presente', () => {
		expect(createCell(verb, 'present').meaning).toBe(verb.meaning)
	})

	it.each(['past', 'participle'] as const)('deja sin significado la celda de "%s"', (form) => {
		expect(createCell(verb, form).meaning).toBeNull()
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

	it('el error tiene prioridad sobre la selección', () => {
		expect(getCellStatus(cell, {...empty, past: cell.id}, [cell.id], [])).toBe('error')
	})
})

describe('refillSlots', () => {
	const verbs = makeVerbs(10)
	const {columns, pool} = createBoard(verbs, 6, createSeededRng(4))
	const incoming = pool[0] as Verb
	const resolvedId = (columns.present[0] as Cell).verbId

	it('da significado a la celda de presente que entra, y sólo a ésa', () => {
		const next = refillSlots(columns, [resolvedId], incoming, createSeededRng(1))
		const entrante = (form: VerbForm) =>
			next[form].find((cell) => cell.verbId === incoming.id) as Cell

		expect(entrante('present').meaning).toBe(incoming.meaning)
		expect(entrante('past').meaning).toBeNull()
		expect(entrante('participle').meaning).toBeNull()
	})

	it('coloca la tríada entrante, una celda por columna', () => {
		const next = refillSlots(columns, [resolvedId], incoming, createSeededRng(1))

		for (const form of VERB_FORMS) {
			const placed = next[form].filter((cell) => cell.verbId === incoming.id)

			expect(placed).toHaveLength(1)
			expect(placed[0]?.text).toBe(incoming[form])
		}
	})

	it('mantiene la altura de las columnas', () => {
		const next = refillSlots(columns, [resolvedId], incoming, createSeededRng(1))

		for (const form of VERB_FORMS) expect(next[form]).toHaveLength(6)
	})

	it('no mueve ninguna celda ocupada: sólo cambia la casilla libre', () => {
		const next = refillSlots(columns, [resolvedId], incoming, createSeededRng(7))

		for (const form of VERB_FORMS) {
			const changed = columns[form].filter((cell, index) => next[form][index]?.id !== cell.id)

			expect(changed).toHaveLength(1)
			expect(changed[0]?.verbId).toBe(resolvedId)
		}
	})

	it('nunca alinea la tríada entrante en la misma fila de dos columnas', () => {
		const vacated = [
			(columns.present[0] as Cell).verbId,
			(columns.present[2] as Cell).verbId,
			(columns.present[4] as Cell).verbId,
		]

		for (let seed = 1; seed <= 200; seed++) {
			const next = refillSlots(columns, vacated, incoming, createSeededRng(seed))
			const rows = VERB_FORMS.map((form) =>
				next[form].findIndex((cell) => cell.verbId === incoming.id),
			)

			expect(new Set(rows).size).toBe(VERB_FORMS.length)
		}
	})

	it('sólo usa casillas libres, nunca una ocupada', () => {
		const vacated = [(columns.present[3] as Cell).verbId]

		for (let seed = 1; seed <= 50; seed++) {
			const next = refillSlots(columns, vacated, incoming, createSeededRng(seed))

			for (const form of VERB_FORMS) {
				const row = next[form].findIndex((cell) => cell.verbId === incoming.id)

				expect(columns[form][row]?.verbId).toBe(vacated[0])
			}
		}
	})

	it('devuelve el tablero intacto si no hay verbo entrante', () => {
		expect(refillSlots(columns, [resolvedId], null, createSeededRng(1))).toBe(columns)
	})

	it('devuelve el tablero intacto si no hay ninguna casilla libre', () => {
		expect(refillSlots(columns, [], incoming, createSeededRng(1))).toBe(columns)
	})

	it('no muta las columnas recibidas', () => {
		const before = structuredClone(columns)

		refillSlots(columns, [resolvedId], incoming, createSeededRng(1))

		expect(columns).toEqual(before)
	})
})

describe('refillSlots — a lo largo de una partida', () => {
	it('ningún verbo del reparto inicial comparte fila entre columnas', () => {
		for (let seed = 1; seed <= 100; seed++) {
			const {columns} = createBoard(makeVerbs(30), 6, createSeededRng(seed))

			for (const cell of columns.present) {
				const rows = VERB_FORMS.map((form) =>
					columns[form].findIndex((candidate) => candidate.verbId === cell.verbId),
				)

				expect(new Set(rows).size).toBe(VERB_FORMS.length)
			}
		}
	})

	it('no repite la tríada entera ni alinea filas', () => {
		const {boardSize, refillMinVacancies} = getLevelConfig('easy')
		let refills = 0
		let aligned = 0
		let sameSlots = 0

		for (let seed = 1; seed <= 60; seed++) {
			const rng = createSeededRng(seed)
			let {columns, pool} = createBoard(makeVerbs(40), boardSize, rng)
			const resolved: number[] = []
			let owed = 0

			const vacated = (): number =>
				columns.present.filter((cell) => resolved.includes(cell.verbId)).length

			for (let round = 0; round < 40 && pool.length > 0; round++) {
				const next = columns.present.find((cell) => !resolved.includes(cell.verbId))
				if (next === undefined) break

				resolved.push(next.verbId)
				owed += 1

				while (owed > 0 && vacated() >= refillMinVacancies && pool.length > 0) {
					const incoming = pool[0] as Verb
					const freeBefore = VERB_FORMS.map((form) =>
						columns[form].flatMap((cell, row) =>
							resolved.includes(cell.verbId) ? [{row, verbId: cell.verbId}] : [],
						),
					)

					const before = columns
					columns = refillSlots(columns, resolved, incoming, rng)
					if (columns === before) break

					pool = pool.slice(1)
					owed -= 1
					refills += 1

					const rows = VERB_FORMS.map((form) =>
						columns[form].findIndex((cell) => cell.verbId === incoming.id),
					)

					if (new Set(rows).size !== VERB_FORMS.length) aligned += 1

					const owners = rows.map(
						(row, index) => freeBefore[index]?.find((slot) => slot.row === row)?.verbId,
					)

					if (owners[0] !== undefined && new Set(owners).size === 1) sameSlots += 1
				}
			}
		}

		expect(refills).toBeGreaterThan(500)
		expect(sameSlots).toBe(0)
		expect(aligned).toBe(0)
	})
})
