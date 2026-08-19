import {describe, expect, it} from 'vitest'
import {useBoard} from '../useBoard'
import {createSeededRng} from '@/lib/shuffle'
import {VERB_FORMS, type Verb, type VerbForm} from '@/types/verb'
import type {Cell, SelectionOutcome} from '@/types/game'

function makeVerbs(count: number): Verb[] {
	return Array.from({length: count}, (_, index) => ({
		id: index + 1,
		level: 'beginner',
		present: `present-${index + 1}`,
		past: `past-${index + 1}`,
		participle: `participle-${index + 1}`,
	}))
}

/** Un tablero con semilla fija, para que cada test parta de un estado conocido. */
function setup(seed = 1) {
	return useBoard({rng: createSeededRng(seed)})
}

describe('useBoard', () => {
	it('arranca vacío, antes del primer reparto', () => {
		const board = setup()

		expect(VERB_FORMS.every((form) => board.columns.value[form].length === 0)).toBe(true)
		expect(board.pool.value).toEqual([])
		expect(board.visibleCount.value).toBe(0)
		expect(board.visibleVerbIds.value).toEqual([])
	})

	it('un tablero vacío se considera con el pool agotado', () => {
		expect(setup().isPoolExhausted.value).toBe(true)
	})

	it('`deal` llena las tres columnas y guarda el resto en el pool', () => {
		const board = setup()
		board.deal(makeVerbs(20), 6)

		expect(VERB_FORMS.every((form) => board.columns.value[form].length === 6)).toBe(true)
		expect(board.pool.value).toHaveLength(14)
		expect(board.visibleCount.value).toBe(6)
	})

	it('`visibleVerbIds` expone un id por tríada visible, sin repetidos', () => {
		const board = setup()
		board.deal(makeVerbs(20), 8)

		const ids = board.visibleVerbIds.value

		expect(ids).toHaveLength(8)
		expect(new Set(ids).size).toBe(8)
	})

	it('`isPoolExhausted` es falso mientras queden verbos por mostrar', () => {
		const board = setup()
		board.deal(makeVerbs(20), 6)

		expect(board.isPoolExhausted.value).toBe(false)
	})

	it('`isPoolExhausted` es verdadero cuando el tablero consume todo el pool', () => {
		const board = setup()
		board.deal(makeVerbs(6), 6)

		expect(board.isPoolExhausted.value).toBe(true)
	})

	it('un segundo `deal` descarta el tablero anterior por completo', () => {
		const board = setup()
		board.deal(makeVerbs(20), 6)
		const first = board.columns.value

		board.deal(makeVerbs(20), 10)

		expect(board.columns.value).not.toBe(first)
		expect(board.visibleCount.value).toBe(10)
		expect(board.pool.value).toHaveLength(10)
	})

	/**
	 * Los derivados deben recalcularse al repartir. Si `visibleCount` se hubiera
	 * escrito como valor almacenado en vez de `computed`, aquí quedaría desfasado.
	 */
	it('los valores derivados siguen al estado tras cada reparto', () => {
		const board = setup()

		expect(board.visibleCount.value).toBe(0)
		board.deal(makeVerbs(20), 6)
		expect(board.visibleCount.value).toBe(6)
		board.deal(makeVerbs(20), 9)
		expect(board.visibleCount.value).toBe(9)
	})

	it('usa el generador inyectado: la misma semilla reparte el mismo tablero', () => {
		const verbs = makeVerbs(20)
		const first = setup(42)
		const second = setup(42)

		first.deal(verbs, 8)
		second.deal(verbs, 8)

		expect(first.columns.value).toEqual(second.columns.value)
		expect(first.pool.value).toEqual(second.pool.value)
	})

	it('semillas distintas reparten tableros distintos', () => {
		const verbs = makeVerbs(20)
		const first = setup(1)
		const second = setup(2)

		first.deal(verbs, 8)
		second.deal(verbs, 8)

		expect(first.columns.value).not.toEqual(second.columns.value)
	})

	it('dos instancias mantienen estado independiente', () => {
		const first = setup(1)
		const second = setup(1)

		first.deal(makeVerbs(20), 6)

		expect(second.visibleCount.value).toBe(0)
	})
})

/**
 * Un tablero repartido y las utilidades para jugarlo en los tests: `cellOf`
 * localiza la celda de un verbo en una columna y `triadOf` las tres de un verbo.
 */
function playable(verbCount = 20, boardSize = 6, seed = 1) {
	const board = useBoard({rng: createSeededRng(seed)})
	board.deal(makeVerbs(verbCount), boardSize)

	function cellOf(verbId: number, form: VerbForm): Cell {
		const cell = board.columns.value[form].find((candidate) => candidate.verbId === verbId)
		if (cell === undefined) throw new Error(`El verbo ${verbId} no está en la columna ${form}`)
		return cell
	}

	function triadOf(verbId: number): Cell[] {
		return VERB_FORMS.map((form) => cellOf(verbId, form))
	}

	/** Ids de los verbos visibles, para elegir con qué jugar. */
	const visible = () => board.visibleVerbIds.value

	return {board, cellOf, triadOf, visible}
}

/** Resuelve la tríada de `verbId` seleccionando sus tres celdas. */
function solve(play: ReturnType<typeof playable>, verbId: number): SelectionOutcome {
	const cells = play.triadOf(verbId)
	let outcome: SelectionOutcome = {type: 'ignored'}
	for (const cell of cells) outcome = play.board.select(cell)
	return outcome
}

describe('useBoard — selección', () => {
	it('la primera pulsación registra la selección de su columna', () => {
		const play = playable()
		const verbId = play.visible()[0] ?? 0
		const cell = play.cellOf(verbId, 'present')

		expect(play.board.select(cell)).toEqual({type: 'selected'})
		expect(play.board.selection.value.present).toBe(cell.id)
		expect(play.board.selectedCount.value).toBe(1)
	})

	it('no toca las otras columnas al seleccionar', () => {
		const play = playable()
		const verbId = play.visible()[0] ?? 0

		play.board.select(play.cellOf(verbId, 'present'))

		expect(play.board.selection.value.past).toBeNull()
		expect(play.board.selection.value.participle).toBeNull()
	})

	/** `MECHANICS.md` §1: nunca dos celdas seleccionadas en la misma columna. */
	it('seleccionar otra celda de la misma columna reemplaza la anterior', () => {
		const play = playable()
		const [firstVerb, secondVerb] = play.visible()
		const first = play.cellOf(firstVerb ?? 0, 'present')
		const second = play.cellOf(secondVerb ?? 0, 'present')

		play.board.select(first)
		play.board.select(second)

		expect(play.board.selection.value.present).toBe(second.id)
		expect(play.board.selectedCount.value).toBe(1)
	})

	it('pulsar la celda ya seleccionada la deselecciona', () => {
		const play = playable()
		const cell = play.cellOf(play.visible()[0] ?? 0, 'past')

		play.board.select(cell)

		expect(play.board.select(cell)).toEqual({type: 'deselected'})
		expect(play.board.selection.value.past).toBeNull()
		expect(play.board.selectedCount.value).toBe(0)
	})

	it('`clearSelection` vacía las tres columnas sin validar', () => {
		const play = playable()
		const verbId = play.visible()[0] ?? 0
		play.board.select(play.cellOf(verbId, 'present'))
		play.board.select(play.cellOf(verbId, 'past'))

		play.board.clearSelection()

		expect(play.board.selectedCount.value).toBe(0)
		expect(play.board.matchedCount.value).toBe(0)
	})
})

describe('useBoard — validación de tríadas', () => {
	it('tres formas del mismo verbo son un acierto', () => {
		const play = playable()
		const verbId = play.visible()[0] ?? 0

		expect(solve(play, verbId)).toMatchObject({type: 'match', verbId})
		expect(play.board.matchedCount.value).toBe(1)
		expect(play.board.resolvedVerbIds.value).toEqual([verbId])
	})

	it('el acierto devuelve las tres celdas que salen del tablero', () => {
		const play = playable()
		const verbId = play.visible()[0] ?? 0
		const expected = play.triadOf(verbId).map((cell) => cell.id)

		const outcome = solve(play, verbId)

		expect(outcome.type === 'match' && outcome.cellIds).toEqual(expected)
	})

	/**
	 * `MECHANICS.md` §1 permite seleccionar en cualquier orden. Se prueban las seis
	 * permutaciones para que ninguna dependa del orden de las columnas.
	 */
	const selectionOrders: VerbForm[][] = [
		['present', 'past', 'participle'],
		['present', 'participle', 'past'],
		['past', 'present', 'participle'],
		['past', 'participle', 'present'],
		['participle', 'present', 'past'],
		['participle', 'past', 'present'],
	]

	it.each(selectionOrders)('acierta seleccionando en el orden %s → %s → %s', (...forms) => {
		const play = playable()
		const verbId = play.visible()[0] ?? 0

		let outcome: SelectionOutcome = {type: 'ignored'}
		for (const form of forms) outcome = play.board.select(play.cellOf(verbId, form))

		expect(outcome).toMatchObject({type: 'match', verbId})
	})

	it('una tríada con un verbo distinto es un error', () => {
		const play = playable()
		const [firstVerb, secondVerb] = play.visible()
		const impostor = play.cellOf(secondVerb ?? 0, 'participle')

		play.board.select(play.cellOf(firstVerb ?? 0, 'present'))
		play.board.select(play.cellOf(firstVerb ?? 0, 'past'))
		const outcome = play.board.select(impostor)

		expect(outcome.type).toBe('mismatch')
		expect(play.board.matchedCount.value).toBe(0)
	})

	it('el error deselecciona las tres celdas y las marca', () => {
		const play = playable()
		const [firstVerb, secondVerb] = play.visible()
		const cells = [
			play.cellOf(firstVerb ?? 0, 'present'),
			play.cellOf(firstVerb ?? 0, 'past'),
			play.cellOf(secondVerb ?? 0, 'participle'),
		]

		for (const cell of cells) play.board.select(cell)

		expect(play.board.selectedCount.value).toBe(0)
		expect(play.board.errorCellIds.value).toEqual(cells.map((cell) => cell.id))
	})

	it('el error no retira ninguna celda del tablero', () => {
		const play = playable()
		const [firstVerb, secondVerb] = play.visible()

		play.board.select(play.cellOf(firstVerb ?? 0, 'present'))
		play.board.select(play.cellOf(firstVerb ?? 0, 'past'))
		play.board.select(play.cellOf(secondVerb ?? 0, 'participle'))

		expect(play.board.visibleCount.value).toBe(6)
	})

	it('la siguiente selección limpia el estado de error', () => {
		const play = playable()
		const [firstVerb, secondVerb] = play.visible()
		play.board.select(play.cellOf(firstVerb ?? 0, 'present'))
		play.board.select(play.cellOf(firstVerb ?? 0, 'past'))
		play.board.select(play.cellOf(secondVerb ?? 0, 'participle'))

		play.board.select(play.cellOf(firstVerb ?? 0, 'present'))

		expect(play.board.errorCellIds.value).toEqual([])
	})

	it('`clearError` retira el estado de error', () => {
		const play = playable()
		const [firstVerb, secondVerb] = play.visible()
		play.board.select(play.cellOf(firstVerb ?? 0, 'present'))
		play.board.select(play.cellOf(firstVerb ?? 0, 'past'))
		play.board.select(play.cellOf(secondVerb ?? 0, 'participle'))

		play.board.clearError()

		expect(play.board.errorCellIds.value).toEqual([])
	})

	it('ignora una celda de un verbo ya resuelto', () => {
		const play = playable()
		const verbId = play.visible()[0] ?? 0
		const cell = play.cellOf(verbId, 'present')
		solve(play, verbId)

		expect(play.board.select(cell)).toEqual({type: 'ignored'})
	})
})

describe('useBoard — reposición de tríadas', () => {
	/**
	 * La reposición ya no ocurre al acertar: `refill` la dispara aparte, y en la
	 * app la agenda el store tras `refillDelayMs`. Ese hueco intermedio es la
	 * mecánica, no un efecto secundario (`PLAN.md`, Bitácora, D8).
	 */
	it('el acierto deja un hueco en lugar de reponer', () => {
		const play = playable(20, 6)
		const verbId = play.visible()[0] ?? 0

		solve(play, verbId)

		expect(play.board.visibleCount.value).toBe(5)
		expect(play.board.vacatedCount.value).toBe(1)
		expect(play.board.visibleVerbIds.value).not.toContain(verbId)
		// La columna no encoge: la celda acertada sigue ahí, atenuada.
		expect(play.board.columns.value.present).toHaveLength(6)
	})

	it('`refill` devuelve el tablero a su tamaño jugable', () => {
		const play = playable(20, 6)

		solve(play, play.visible()[0] ?? 0)
		play.board.refill()

		expect(play.board.visibleCount.value).toBe(6)
		expect(play.board.vacatedCount.value).toBe(0)
	})

	it('los aciertos encadenados acumulan huecos', () => {
		const play = playable(20, 6)

		for (let index = 0; index < 3; index++) solve(play, play.visible()[0] ?? 0)

		expect(play.board.visibleCount.value).toBe(3)
		expect(play.board.vacatedCount.value).toBe(3)
	})

	it('el verbo entrante sale del pool al reponer, no al acertar', () => {
		const play = playable(20, 6)
		const incoming = play.board.pool.value[0]

		solve(play, play.visible()[0] ?? 0)
		expect(play.board.pool.value).toHaveLength(14)

		play.board.refill()

		expect(play.board.pool.value).toHaveLength(13)
		expect(play.board.visibleVerbIds.value).toContain(incoming?.id)
		expect(play.board.pool.value.map((verb) => verb.id)).not.toContain(incoming?.id)
	})

	it('el acierto vacía la selección', () => {
		const play = playable()

		solve(play, play.visible()[0] ?? 0)

		expect(play.board.selectedCount.value).toBe(0)
	})

	it('la tríada repuesta es jugable de inmediato', () => {
		const play = playable(20, 6)
		const incoming = play.board.pool.value[0]?.id ?? 0

		solve(play, play.visible()[0] ?? 0)
		play.board.refill()

		expect(solve(play, incoming)).toMatchObject({type: 'match', verbId: incoming})
		expect(play.board.matchedCount.value).toBe(2)
	})

	/** Una celda acertada no es pulsable aunque siga en el tablero. */
	it('la tríada acertada deja de aceptar selecciones', () => {
		const play = playable(20, 6)
		const verbId = play.visible()[0] ?? 0

		solve(play, verbId)

		const cell = play.board.columns.value.present.find((candidate) => candidate.verbId === verbId)

		expect(play.board.select(cell as Cell)).toEqual({type: 'ignored'})
	})

	describe('con el pool agotado', () => {
		it('reponer no hace nada y las celdas resueltas se quedan atenuadas', () => {
			const play = playable(6, 6)

			expect(play.board.isPoolExhausted.value).toBe(true)
			solve(play, play.visible()[0] ?? 0)
			play.board.refill()

			expect(play.board.visibleCount.value).toBe(5)
			expect(play.board.columns.value.present).toHaveLength(6)
		})

		it('se puede resolver el tablero por completo', () => {
			const play = playable(6, 6)

			while (!play.board.isCleared.value) {
				const verbId = play.visible()[0]
				if (verbId === undefined) break
				expect(solve(play, verbId)).toMatchObject({type: 'match'})
			}

			expect(play.board.isCleared.value).toBe(true)
			expect(play.board.matchedCount.value).toBe(6)
		})

		/**
		 * El recorrido completo del nivel: se agota el pool reponiendo y después el
		 * tablero se vacía. Es el camino de la victoria en Modo Precisión.
		 */
		it('agota el pool reponiendo y luego vacía el tablero', () => {
			const play = playable(10, 6)

			while (!play.board.isCleared.value) {
				const verbId = play.visible()[0]
				if (verbId === undefined) break
				solve(play, verbId)
				play.board.refill()
			}

			expect(play.board.matchedCount.value).toBe(10)
			expect(play.board.pool.value).toEqual([])
			expect(play.board.isCleared.value).toBe(true)
		})
	})

	it('`deal` reinicia aciertos, selección y errores', () => {
		const play = playable()
		solve(play, play.visible()[0] ?? 0)

		play.board.deal(makeVerbs(20), 6)

		expect(play.board.matchedCount.value).toBe(0)
		expect(play.board.resolvedVerbIds.value).toEqual([])
		expect(play.board.selectedCount.value).toBe(0)
		expect(play.board.errorCellIds.value).toEqual([])
	})
})
