import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {REFILL_APPEAR_MS, useGameStore} from '../game'
import {MIN_MATCHES_FOR_RANKING, getLevelConfig} from '@/data/levels'
import {getVerbsForDifficulty} from '@/data/verbs'
import {VERB_FORMS, type VerbForm} from '@/types/verb'
import type {Cell} from '@/types/game'

const SECOND = 1000

beforeEach(() => {
	setActivePinia(createPinia())
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

function advance(ms: number): void {
	vi.advanceTimersByTime(ms)
}

type Store = ReturnType<typeof useGameStore>

function cellOf(store: Store, verbId: number, form: VerbForm): Cell {
	const cell = store.columns[form].find((candidate) => candidate.verbId === verbId)
	if (cell === undefined) throw new Error(`El verbo ${verbId} no está en la columna ${form}`)
	return cell
}

function visibleVerbIds(store: Store): number[] {
	return store.columns.present
		.filter((cell) => !store.resolvedVerbIds.includes(cell.verbId))
		.map((cell) => cell.verbId)
}

function solveMany(store: Store, count: number): void {
	for (let index = 0; index < count; index++) {
		let next = visibleVerbIds(store)[0]

		if (next === undefined) {
			advance((store.level?.refillDelayMs ?? 0) + REFILL_APPEAR_MS)
			next = visibleVerbIds(store)[0]
		}

		if (next === undefined) return

		solve(store, next)
	}
}

function solve(store: Store, verbId: number): void {
	for (const form of VERB_FORMS) store.selectCell(cellOf(store, verbId, form))
}

function fail(store: Store): void {
	if (visibleVerbIds(store).length < 2) {
		advance((store.level?.refillDelayMs ?? 0) + REFILL_APPEAR_MS)
	}

	const [first, second] = visibleVerbIds(store)
	store.selectCell(cellOf(store, first ?? 0, 'present'))
	store.selectCell(cellOf(store, first ?? 0, 'past'))
	store.selectCell(cellOf(store, second ?? 0, 'participle'))
}

describe('useGameStore — estado inicial', () => {
	it('empieza en `idle` sin modo ni nivel', () => {
		const store = useGameStore()

		expect(store.status).toBe('idle')
		expect(store.mode).toBeNull()
		expect(store.difficulty).toBeNull()
		expect(store.level).toBeNull()
	})

	it('empieza con el tablero vacío y los contadores a cero', () => {
		const store = useGameStore()

		expect(store.visibleCount).toBe(0)
		expect(store.matchedCount).toBe(0)
		expect(store.errors).toBe(0)
		expect(store.elapsedMs).toBe(0)
	})

	it('no hay resultado antes de terminar una partida', () => {
		const store = useGameStore()

		expect(store.result).toBeNull()
	})

	it('expone su estado propio en `$state`', () => {
		const store = useGameStore()

		expect(Object.keys(store.$state).sort()).toEqual([
			'completedAt',
			'difficulty',
			'errors',
			'isPaused',
			'mistakeAttempts',
			'mode',
			'status',
		])
	})
})

describe('useGameStore — arranque de partida', () => {
	it('pasa a `playing` con el modo y el nivel elegidos', () => {
		const store = useGameStore()

		store.startGame('target', 'easy')

		expect(store.status).toBe('playing')
		expect(store.mode).toBe('target')
		expect(store.difficulty).toBe('easy')
		expect(store.isPlaying).toBe(true)
	})

	it('reparte el tablero del tamaño que marca el nivel', () => {
		const store = useGameStore()

		store.startGame('target', 'hard')

		const {boardSize} = getLevelConfig('hard')

		expect(store.visibleCount).toBe(boardSize)
		expect(VERB_FORMS.every((form) => store.columns[form].length === boardSize)).toBe(true)
	})

	it('pone el reloj en marcha', () => {
		const store = useGameStore()

		store.startGame('target', 'easy')
		advance(3 * SECOND)

		expect(store.isTimerRunning).toBe(true)
		expect(store.elapsedMs).toBe(3 * SECOND)
	})

	it('el Modo Objetivo cuenta hacia atrás desde el límite del nivel', () => {
		const store = useGameStore()

		store.startGame('target', 'easy')

		expect(store.timeLimitMs).toBe(getLevelConfig('easy').timeLimitMs)
		expect(store.remainingMs).toBe(getLevelConfig('easy').timeLimitMs)
	})

	it('el Modo Supervivencia no tiene límite de tiempo', () => {
		const store = useGameStore()

		store.startGame('precision', 'easy')

		expect(store.timeLimitMs).toBeNull()
		expect(store.remainingMs).toBeNull()
		expect(store.progress).toBeNull()
	})

	it('cada nivel usa su propio límite', () => {
		const store = useGameStore()

		store.startGame('target', 'hard')

		expect(store.remainingMs).toBe(getLevelConfig('hard').timeLimitMs)
	})

	it('empezar otra partida borra el rastro de la anterior', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		solve(store, visibleVerbIds(store)[0] ?? 0)
		fail(store)
		advance(10 * SECOND)

		store.startGame('precision', 'medium')

		expect(store.matchedCount).toBe(0)
		expect(store.errors).toBe(0)
		expect(store.elapsedMs).toBe(0)
		expect(store.completedAt).toBeNull()
		expect(store.status).toBe('playing')
	})
})

describe('useGameStore — jugadas', () => {
	it('un acierto suma al contador de aciertos', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		solve(store, visibleVerbIds(store)[0] ?? 0)

		expect(store.matchedCount).toBe(1)
		expect(store.errors).toBe(0)
	})

	it('un fallo suma al contador de errores', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		fail(store)

		expect(store.errors).toBe(1)
		expect(store.matchedCount).toBe(0)
	})

	it('acumula varios errores', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		fail(store)
		fail(store)

		expect(store.errors).toBe(2)
	})

	it('una selección incompleta no cuenta ni como acierto ni como error', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		const verbId = visibleVerbIds(store)[0] ?? 0

		const outcome = store.selectCell(cellOf(store, verbId, 'present'))

		expect(outcome).toEqual({type: 'selected'})
		expect(store.errors).toBe(0)
		expect(store.matchedCount).toBe(0)
	})

	it('devuelve el resultado de la jugada al llamador', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		const verbId = visibleVerbIds(store)[0] ?? 0
		store.selectCell(cellOf(store, verbId, 'present'))
		store.selectCell(cellOf(store, verbId, 'past'))

		const outcome = store.selectCell(cellOf(store, verbId, 'participle'))

		expect(outcome).toMatchObject({type: 'match', verbId})
	})

	it('el acierto deja un hueco en lugar de reponer al instante', () => {
		const store = useGameStore()
		const {boardSize} = getLevelConfig('easy')
		store.startGame('target', 'easy')
		const verbId = visibleVerbIds(store)[0] ?? 0

		solve(store, verbId)

		expect(store.visibleCount).toBe(boardSize - 1)
		expect(store.vacatedCount).toBe(1)
		expect(visibleVerbIds(store)).not.toContain(verbId)
	})

	it('no repone mientras no haya huecos suficientes', () => {
		const store = useGameStore()
		const {boardSize, refillDelayMs} = getLevelConfig('easy')
		store.startGame('target', 'easy')

		solve(store, visibleVerbIds(store)[0] ?? 0)
		advance(refillDelayMs + REFILL_APPEAR_MS)

		expect(store.vacatedCount).toBe(1)
		expect(store.visibleCount).toBe(boardSize - 1)
	})

	it('acaba reponiendo aunque no se alcance el mínimo, pasado el margen', () => {
		const store = useGameStore()
		const {boardSize, refillDelayMs, refillGraceMs} = getLevelConfig('easy')
		store.startGame('target', 'easy')

		solve(store, visibleVerbIds(store)[0] ?? 0)
		advance(refillDelayMs + REFILL_APPEAR_MS + refillGraceMs)

		expect(store.vacatedCount).toBe(0)
		expect(store.visibleCount).toBe(boardSize)
	})

	it('vuelve a su tamaño completo tras una racha larga', () => {
		const store = useGameStore()
		const {boardSize, refillDelayMs, refillGraceMs} = getLevelConfig('easy')
		store.startGame('precision', 'easy')

		for (let index = 0; index < 12; index++) {
			const next = visibleVerbIds(store)[0]
			if (next === undefined) break

			solve(store, next)
			advance(refillDelayMs)
		}

		advance((refillGraceMs + REFILL_APPEAR_MS) * boardSize)

		expect(store.vacatedCount).toBe(0)
		expect(store.visibleCount).toBe(boardSize)
	})

	it('los aciertos encadenados vacían el tablero antes de reponerse', () => {
		const store = useGameStore()
		const {boardSize, refillMinVacancies} = getLevelConfig('easy')
		store.startGame('target', 'easy')

		for (let index = 0; index < refillMinVacancies - 1; index++) {
			solve(store, visibleVerbIds(store)[0] ?? 0)
		}

		expect(store.visibleCount).toBe(boardSize - (refillMinVacancies - 1))
	})

	it('adelanta la reposición cuando el tablero se vacía demasiado', () => {
		const store = useGameStore()
		const {boardSize, refillForceVacancies} = getLevelConfig('easy')
		store.startGame('target', 'easy')

		for (let index = 0; index < refillForceVacancies; index++) {
			const next = visibleVerbIds(store)[0]
			if (next === undefined) break
			solve(store, next)
		}

		advance(REFILL_APPEAR_MS)

		expect(store.vacatedCount).toBeLessThan(refillForceVacancies)
		expect(store.visibleCount).toBeGreaterThan(boardSize - refillForceVacancies)
	})

	it('cancela las reposiciones pendientes al terminar', () => {
		const store = useGameStore()
		const {refillDelayMs} = getLevelConfig('easy')
		store.startGame('target', 'easy')

		solve(store, visibleVerbIds(store)[0] ?? 0)
		store.finish('lost')

		const before = store.visibleCount
		advance(refillDelayMs * 3)

		expect(store.visibleCount).toBe(before)
	})

	it('`clearError` retira el feedback del último fallo', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		fail(store)

		store.clearError()

		expect(store.errorCellIds).toEqual([])
	})

	it('ignora jugadas antes de arrancar', () => {
		const store = useGameStore()
		const cell: Cell = {id: '1:present', verbId: 1, form: 'present', text: 'be', meaning: 'ser'}

		expect(store.selectCell(cell)).toEqual({type: 'ignored'})
		expect(store.matchedCount).toBe(0)
	})

	it('ignora jugadas después de terminar', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		const cell = cellOf(store, visibleVerbIds(store)[0] ?? 0, 'present')
		store.finish('won')

		expect(store.selectCell(cell)).toEqual({type: 'ignored'})
	})
})

describe('useGameStore — fin de partida', () => {
	it('`finish` detiene el reloj y fija el estado', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		advance(5 * SECOND)

		store.finish('won')

		expect(store.status).toBe('won')
		expect(store.isFinished).toBe(true)
		expect(store.isTimerRunning).toBe(false)
	})

	it('el tiempo deja de correr tras terminar', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		advance(5 * SECOND)
		store.finish('won')

		advance(30 * SECOND)

		expect(store.elapsedMs).toBe(5 * SECOND)
	})

	it('`finish` no hace nada si la partida no está en curso', () => {
		const store = useGameStore()

		store.finish('won')

		expect(store.status).toBe('idle')
		expect(store.result).toBeNull()
	})

	it('no se puede cambiar el desenlace una vez terminada', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		store.finish('won')

		store.finish('lost')

		expect(store.status).toBe('won')
	})

	it('agotar la cuenta regresiva pierde la partida', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		advance(getLevelConfig('easy').timeLimitMs)

		expect(store.status).toBe('lost')
		expect(store.isFinished).toBe(true)
	})

	it('el Modo Supervivencia nunca pierde por tiempo', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')

		advance(60 * 60 * SECOND)

		expect(store.status).toBe('playing')
	})
})

describe('useGameStore — resultado', () => {
	it('recoge modo, nivel, desenlace y contadores', () => {
		const store = useGameStore()
		const {errorPenaltyMs} = getLevelConfig('medium')
		store.startGame('target', 'medium')
		solve(store, visibleVerbIds(store)[0] ?? 0)
		fail(store)
		advance(12 * SECOND)

		store.finish('won')

		expect(store.result).toMatchObject({
			mode: 'target',
			difficulty: 'medium',
			status: 'won',
			timeMs: 12 * SECOND + errorPenaltyMs,
			errors: 1,
			verbsMatched: 1,
		})
	})

	it('la marca de tiempo es una fecha ISO válida', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		store.finish('won')

		const completedAt = store.result?.completedAt ?? ''
		expect(new Date(completedAt).toISOString()).toBe(completedAt)
	})

	it('registra el tiempo exacto, no el del último tick', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		advance(7654)

		store.finish('won')

		expect(store.result?.timeMs).toBe(7654)
	})

	it('en una derrota por tiempo registra el límite exacto', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		advance(getLevelConfig('easy').timeLimitMs + 500)

		expect(store.result?.timeMs).toBe(getLevelConfig('easy').timeLimitMs)
	})

	it('sigue siendo `null` mientras la partida está en curso', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		advance(5 * SECOND)

		expect(store.result).toBeNull()
	})
})

describe('useGameStore — reinicio', () => {
	it('`resetGame` devuelve el store a su estado inicial', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		solve(store, visibleVerbIds(store)[0] ?? 0)
		advance(5 * SECOND)
		store.finish('won')

		store.resetGame()

		expect(store.status).toBe('idle')
		expect(store.mode).toBeNull()
		expect(store.difficulty).toBeNull()
		expect(store.matchedCount).toBe(0)
		expect(store.errors).toBe(0)
		expect(store.elapsedMs).toBe(0)
		expect(store.visibleCount).toBe(0)
		expect(store.result).toBeNull()
	})

	it('tras `resetGame` se puede empezar otra partida', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		store.finish('lost')

		store.resetGame()
		store.startGame('precision', 'hard')

		expect(store.status).toBe('playing')
		expect(store.visibleCount).toBe(getLevelConfig('hard').boardSize)
	})

	it('se puede volver a jugar tras perder por tiempo', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		advance(getLevelConfig('easy').timeLimitMs)

		store.startGame('target', 'easy')
		advance(3 * SECOND)

		expect(store.status).toBe('playing')
		expect(store.elapsedMs).toBe(3 * SECOND)
	})
})

describe('Modo Objetivo — penalización por error', () => {
	it('un fallo descuenta la penalización del nivel', () => {
		const store = useGameStore()
		const {timeLimitMs, errorPenaltyMs} = getLevelConfig('easy')
		store.startGame('target', 'easy')
		advance(10 * SECOND)

		fail(store)

		expect(store.remainingMs).toBe(timeLimitMs - 10 * SECOND - errorPenaltyMs)
	})

	it('la penalización se acumula con cada fallo', () => {
		const store = useGameStore()
		const {timeLimitMs, errorPenaltyMs} = getLevelConfig('easy')
		store.startGame('target', 'easy')

		fail(store)
		fail(store)

		expect(store.remainingMs).toBe(timeLimitMs - 2 * errorPenaltyMs)
	})

	it('cada nivel aplica su propia penalización', () => {
		const store = useGameStore()
		const {timeLimitMs, errorPenaltyMs} = getLevelConfig('hard')
		store.startGame('target', 'hard')

		fail(store)

		expect(errorPenaltyMs).toBe(3 * SECOND)
		expect(store.remainingMs).toBe(timeLimitMs - errorPenaltyMs)
	})

	it('un fallo no termina la partida', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		fail(store)

		expect(store.status).toBe('playing')
		expect(store.isPlaying).toBe(true)
	})

	it('la penalización empeora el tiempo registrado', () => {
		const store = useGameStore()
		const {errorPenaltyMs} = getLevelConfig('easy')
		store.startGame('target', 'easy')
		advance(20 * SECOND)
		fail(store)

		store.finish('won')

		expect(store.result?.timeMs).toBe(20 * SECOND + errorPenaltyMs)
	})

	it('una penalización que agota el tiempo pierde la partida en el acto', () => {
		const store = useGameStore()
		const {timeLimitMs, errorPenaltyMs} = getLevelConfig('easy')
		store.startGame('target', 'easy')
		advance(timeLimitMs - errorPenaltyMs + 100)

		fail(store)

		expect(store.status).toBe('lost')
		expect(store.remainingMs).toBe(0)
	})

	it('el Modo Supervivencia no penaliza el tiempo', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		advance(10 * SECOND)

		fail(store)

		expect(store.elapsedMs).toBe(10 * SECOND)
	})
})

describe('Modo Objetivo — victoria', () => {
	it('expone el objetivo del nivel y lo que falta', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		expect(store.targetVerbs).toBe(getLevelConfig('easy').targetVerbs)
		expect(store.remainingTargets).toBe(getLevelConfig('easy').targetVerbs)
	})

	it('`remainingTargets` baja con cada acierto', () => {
		const store = useGameStore()
		const {targetVerbs} = getLevelConfig('easy')
		store.startGame('target', 'easy')

		solveMany(store, 3)

		expect(store.remainingTargets).toBe(targetVerbs - 3)
	})

	it('no gana antes de alcanzar el objetivo', () => {
		const store = useGameStore()
		const {targetVerbs} = getLevelConfig('easy')
		store.startGame('target', 'easy')

		solveMany(store, targetVerbs - 1)

		expect(store.status).toBe('playing')
		expect(store.remainingTargets).toBe(1)
	})

	it('gana justo al alcanzar el objetivo', () => {
		const store = useGameStore()
		const {targetVerbs} = getLevelConfig('easy')
		store.startGame('target', 'easy')

		solveMany(store, targetVerbs)

		expect(store.status).toBe('won')
		expect(store.matchedCount).toBe(targetVerbs)
		expect(store.remainingTargets).toBe(0)
	})

	it('la victoria detiene el reloj', () => {
		const store = useGameStore()
		const {targetVerbs} = getLevelConfig('easy')
		store.startGame('target', 'easy')
		advance(15 * SECOND)

		solveMany(store, targetVerbs)

		expect(store.isTimerRunning).toBe(false)

		const registrado = store.result?.timeMs

		expect(registrado).toBeGreaterThan(0)

		advance(30 * SECOND)

		expect(store.result?.timeMs).toBe(registrado)
	})

	it('los errores previos no impiden ganar', () => {
		const store = useGameStore()
		const {targetVerbs} = getLevelConfig('easy')
		store.startGame('target', 'easy')
		fail(store)
		fail(store)

		solveMany(store, targetVerbs)

		expect(store.status).toBe('won')
		expect(store.result?.errors).toBe(2)
	})

	it('cada nivel tiene su propio objetivo', () => {
		const store = useGameStore()
		const {targetVerbs} = getLevelConfig('hard')
		store.startGame('target', 'hard')

		solveMany(store, targetVerbs - 1)
		expect(store.status).toBe('playing')

		solveMany(store, 1)
		expect(store.status).toBe('won')
	})

	it('el Modo Supervivencia no tiene objetivo ni gana por aciertos', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')

		expect(store.targetVerbs).toBeNull()
		expect(store.remainingTargets).toBeNull()

		solveMany(store, getLevelConfig('easy').targetVerbs + 2)

		expect(store.status).toBe('playing')
	})
})

describe('Modo Objetivo — candidatura al ranking', () => {
	it('una victoria clasifica', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		advance(30 * SECOND)

		solveMany(store, getLevelConfig('easy').targetVerbs)

		expect(store.isRankingEligible).toBe(true)
	})

	it('una derrota por tiempo no clasifica', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		advance(getLevelConfig('easy').timeLimitMs)

		expect(store.status).toBe('lost')
		expect(store.isRankingEligible).toBe(false)
	})

	it('una partida en curso no clasifica', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		solveMany(store, 2)

		expect(store.isRankingEligible).toBe(false)
	})

	it('sin partida no clasifica', () => {
		const store = useGameStore()

		expect(store.isRankingEligible).toBe(false)
	})
})

describe('Modo Supervivencia — muerte súbita', () => {
	it('el primer fallo termina la partida', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		solveMany(store, 3)

		fail(store)

		expect(store.status).toBe('lost')
		expect(store.isFinished).toBe(true)
	})

	it('el fallo detiene el reloj', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		advance(20 * SECOND)

		fail(store)
		advance(30 * SECOND)

		expect(store.isTimerRunning).toBe(false)
		expect(store.elapsedMs).toBe(20 * SECOND)
	})

	it('conserva los aciertos logrados antes del fallo', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		solveMany(store, 7)

		fail(store)

		expect(store.result?.verbsMatched).toBe(7)
	})

	it('la partida se registra con cero errores', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		solveMany(store, 5)

		fail(store)

		expect(store.errors).toBe(0)
		expect(store.result?.errors).toBe(0)
	})

	it('tras el fallo ya no admite más jugadas', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		const verbId = visibleVerbIds(store)[0] ?? 0
		const cell = cellOf(store, verbId, 'present')
		fail(store)

		expect(store.selectCell(cell)).toEqual({type: 'ignored'})
	})

	it('el Modo Objetivo no tiene muerte súbita', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		fail(store)

		expect(store.status).toBe('playing')
		expect(store.errors).toBe(1)
	})
})

describe('Modo Supervivencia — victoria por tablero vacío', () => {
	it('vaciar el tablero gana la partida', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		const poolSize = getVerbsForDifficulty('easy').length

		solveMany(store, poolSize)

		expect(store.isCleared).toBe(true)
		expect(store.status).toBe('won')
		expect(store.matchedCount).toBe(poolSize)
	})

	it('la victoria detiene el reloj y produce resultado', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		advance(5 * SECOND)

		solveMany(store, getVerbsForDifficulty('easy').length)

		expect(store.isTimerRunning).toBe(false)
		expect(store.result).toMatchObject({mode: 'precision', status: 'won', errors: 0})
	})
})

describe('Modo Supervivencia — ritmo y ranking', () => {
	it('el ritmo se calcula en vivo durante la partida', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')

		for (let index = 0; index < 5; index++) solve(store, visibleVerbIds(store)[0] ?? 0)
		advance(30 * SECOND)

		expect(store.pace).toBe(10)
	})

	it('sin aciertos el ritmo es 0', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		advance(10 * SECOND)

		expect(store.pace).toBe(0)
	})

	it('el ritmo queda congelado al terminar', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		for (let index = 0; index < 6; index++) solve(store, visibleVerbIds(store)[0] ?? 0)
		advance(60 * SECOND)

		fail(store)
		advance(60 * SECOND)

		expect(store.pace).toBe(6)
	})

	it('una sesión por encima del piso clasifica', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		solveMany(store, MIN_MATCHES_FOR_RANKING)
		advance(30 * SECOND)

		fail(store)

		expect(store.isRankingEligible).toBe(true)
	})

	it('una sesión por debajo del piso no clasifica', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		solveMany(store, MIN_MATCHES_FOR_RANKING - 1)
		advance(30 * SECOND)

		fail(store)

		expect(store.isRankingEligible).toBe(false)
	})

	it('1 acierto en 300 ms da un ritmo altísimo pero no clasifica', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		solve(store, visibleVerbIds(store)[0] ?? 0)
		advance(300)

		fail(store)

		expect(store.result?.timeMs).toBe(300)
		expect(store.pace).toBe(200)
		expect(store.isRankingEligible).toBe(false)
	})
})

describe('useGameStore — registro de fallos', () => {
	it('empieza sin fallos', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		expect(store.mistakes).toEqual([])
	})

	it('guarda las tres celdas de cada intento fallido', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		fail(store)

		expect(store.mistakes).toHaveLength(1)
		expect(store.mistakes[0]?.chosen).toHaveLength(3)
		expect(store.mistakes[0]?.chosen.map((choice) => choice.form)).toEqual([
			'present',
			'past',
			'participle',
		])
	})

	it('explica las tríadas de los verbos implicados', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		fail(store)

		const triads = store.mistakes[0]?.triads ?? []

		expect(triads.length).toBeGreaterThan(0)
		for (const verb of triads) {
			expect(verb.present).not.toBe('')
			expect(verb.past).not.toBe('')
			expect(verb.participle).not.toBe('')
		}
	})

	it('acumula varios fallos en orden', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		fail(store)
		fail(store)

		expect(store.mistakes).toHaveLength(2)
	})

	it('registra el fallo de Supervivencia aunque el contador siga en cero', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')

		fail(store)

		expect(store.errors).toBe(0)
		expect(store.status).toBe('lost')
		expect(store.mistakes).toHaveLength(1)
	})

	it('una partida nueva no hereda los fallos de la anterior', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		fail(store)

		store.startGame('target', 'easy')

		expect(store.mistakes).toEqual([])
	})
})

describe('useGameStore — pausa', () => {
	it('detiene el reloj sin terminar la partida', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')

		advance(3 * SECOND)
		store.pause()

		const frozen = store.elapsedMs

		advance(30 * SECOND)

		expect(store.isPaused).toBe(true)
		expect(store.status).toBe('playing')
		expect(store.elapsedMs).toBe(frozen)
	})

	it('el tiempo en pausa no cuenta para el resultado', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')

		solveMany(store, MIN_MATCHES_FOR_RANKING)

		advance(4 * SECOND)
		const playedMs = store.elapsedMs

		store.pause()
		advance(5 * 60 * SECOND)
		store.resume()

		fail(store)

		expect(store.result?.timeMs).toBeLessThan(playedMs + 60 * SECOND)
	})

	it('el tablero no acepta jugadas en pausa', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')

		const verbId = visibleVerbIds(store)[0] ?? 0
		store.pause()

		const outcome = store.selectCell(cellOf(store, verbId, 'present'))

		expect(outcome).toEqual({type: 'ignored'})
		expect(store.selection.present).toBeNull()
	})

	it('reanudar vuelve a poner el reloj en marcha', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')

		store.pause()
		store.resume()
		advance(2 * SECOND)

		expect(store.isPaused).toBe(false)
		expect(store.elapsedMs).toBeGreaterThanOrEqual(2 * SECOND)
	})

	it('las reposiciones vencidas durante la pausa se pagan al reanudar', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')

		const config = getLevelConfig('easy')
		solveMany(store, config.refillMinVacancies)

		const vacatedBeforePause = store.vacatedCount
		store.pause()

		advance(config.refillDelayMs + config.refillGraceMs + REFILL_APPEAR_MS)

		expect(store.vacatedCount).toBe(vacatedBeforePause)

		store.resume()
		advance(REFILL_APPEAR_MS)

		expect(store.vacatedCount).toBeLessThan(vacatedBeforePause)
	})

	it('una partida nueva no hereda la pausa', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		store.pause()

		store.startGame('target', 'medium')

		expect(store.isPaused).toBe(false)
	})

	it('terminar la partida cancela la pausa', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		store.pause()
		store.finish('lost')

		expect(store.isPaused).toBe(false)
	})

	it('pausar fuera de partida no hace nada', () => {
		const store = useGameStore()

		store.pause()

		expect(store.isPaused).toBe(false)
	})
})
