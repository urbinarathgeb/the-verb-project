import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {useGameStore} from '../game'
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

/** La celda de `verbId` en la columna `form`, tal como está ahora en el tablero. */
function cellOf(store: Store, verbId: number, form: VerbForm): Cell {
	const cell = store.columns[form].find((candidate) => candidate.verbId === verbId)
	if (cell === undefined) throw new Error(`El verbo ${verbId} no está en la columna ${form}`)
	return cell
}

/** Ids de los verbos visibles en el tablero. */
function visibleVerbIds(store: Store): number[] {
	return store.columns.present.map((cell) => cell.verbId)
}

/** Resuelve la tríada de `verbId` seleccionando sus tres celdas. */
function solve(store: Store, verbId: number): void {
	for (const form of VERB_FORMS) store.selectCell(cellOf(store, verbId, form))
}

/** Falla a propósito combinando celdas de dos verbos distintos. */
function fail(store: Store): void {
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

	/**
	 * La skill `vue-pinia-best-practices` exige devolver todo el estado propio del
	 * setup store: si algo se queda fuera, desaparece de DevTools y de `$state`.
	 */
	it('expone su estado propio en `$state`', () => {
		const store = useGameStore()

		expect(Object.keys(store.$state).sort()).toEqual([
			'completedAt',
			'difficulty',
			'errors',
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

		expect(store.visibleCount).toBe(getLevelConfig('hard').boardSize)
		expect(VERB_FORMS.every((form) => store.columns[form].length === 10)).toBe(true)
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

	/** En Precisión no hay límite: el cronómetro sube (`MECHANICS.md` §3). */
	it('el Modo Precisión no tiene límite de tiempo', () => {
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

	it('el tablero repone la tríada acertada', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		const verbId = visibleVerbIds(store)[0] ?? 0

		solve(store, verbId)

		expect(store.visibleCount).toBe(getLevelConfig('easy').boardSize)
		expect(visibleVerbIds(store)).not.toContain(verbId)
	})

	it('`clearError` retira el feedback del último fallo', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')
		fail(store)

		store.clearError()

		expect(store.errorCellIds).toEqual([])
	})

	/** El tablero es inerte fuera de la partida: ni antes de arrancar ni después de terminar. */
	it('ignora jugadas antes de arrancar', () => {
		const store = useGameStore()
		const cell: Cell = {id: '1:present', verbId: 1, form: 'present', text: 'be'}

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

	/**
	 * En Modo Objetivo, agotar el tiempo es la derrota (`MECHANICS.md` §2). Las
	 * condiciones de victoria propias de cada modo llegan en T2.2 y T2.3.
	 */
	it('agotar la cuenta regresiva pierde la partida', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		advance(getLevelConfig('easy').timeLimitMs)

		expect(store.status).toBe('lost')
		expect(store.isFinished).toBe(true)
	})

	it('el Modo Precisión nunca pierde por tiempo', () => {
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
			// El fallo penaliza tiempo y ese tiempo también cuenta para el ranking.
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

	/** El tiempo se lee con el reloj ya detenido, así que es exacto al milisegundo. */
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

	/** Un reloj expirado no vuelve a arrancar sin `reset`; `startGame` debe hacerlo. */
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

/** Resuelve `count` tríadas correctas seguidas, tomando siempre la primera visible. */
function solveMany(store: Store, count: number): void {
	for (let done = 0; done < count; done++) {
		const verbId = visibleVerbIds(store)[0]
		if (verbId === undefined) break
		solve(store, verbId)
	}
}

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

	/** El error consume tiempo pero no termina la ronda (`MECHANICS.md` §2). */
	it('un fallo no termina la partida', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		fail(store)

		expect(store.status).toBe('playing')
		expect(store.isPlaying).toBe(true)
	})

	/**
	 * La penalización cuenta como tiempo consumido, así que también empeora el
	 * tiempo que se registra en el ranking.
	 */
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

	it('el Modo Precisión no penaliza el tiempo', () => {
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
		store.startGame('target', 'easy')
		advance(15 * SECOND)

		solveMany(store, getLevelConfig('easy').targetVerbs)

		expect(store.isTimerRunning).toBe(false)
		expect(store.result?.timeMs).toBe(15 * SECOND)
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

	/** En Precisión no hay objetivo: se juega hasta fallar (`MECHANICS.md` §3). */
	it('el Modo Precisión no tiene objetivo ni gana por aciertos', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')

		expect(store.targetVerbs).toBeNull()
		expect(store.remainingTargets).toBeNull()

		solveMany(store, getLevelConfig('easy').targetVerbs + 2)

		expect(store.status).toBe('playing')
	})
})

describe('Modo Objetivo — candidatura al ranking', () => {
	/** La métrica es el tiempo empleado en alcanzar el objetivo (`MECHANICS.md` §2). */
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

describe('Modo Precisión — muerte súbita', () => {
	/** Un solo error termina la ronda inmediatamente (`MECHANICS.md` §3). */
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

	/**
	 * `MECHANICS.md` §3: toda partida registrada en este modo tiene, por
	 * definición, cero errores. El fallo es el terminador de la ronda, no una
	 * penalización acumulable, así que no se contabiliza.
	 */
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

	/** En Objetivo el error sólo cuesta tiempo; la ronda sigue (`MECHANICS.md` §2). */
	it('el Modo Objetivo no tiene muerte súbita', () => {
		const store = useGameStore()
		store.startGame('target', 'easy')

		fail(store)

		expect(store.status).toBe('playing')
		expect(store.errors).toBe(1)
	})
})

describe('Modo Precisión — victoria por tablero vacío', () => {
	/**
	 * No hay objetivo de aciertos: se juega hasta fallar o hasta agotar el pool del
	 * nivel, que es la victoria.
	 */
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

describe('Modo Precisión — ritmo y ranking', () => {
	it('el ritmo se calcula en vivo durante la partida', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		solveMany(store, 5)
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
		solveMany(store, 6)
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

	/**
	 * El caso degenerado que motiva el piso: un ritmo altísimo por inestabilidad
	 * del ratio, no por habilidad.
	 */
	it('1 acierto en 300 ms da un ritmo altísimo pero no clasifica', () => {
		const store = useGameStore()
		store.startGame('precision', 'easy')
		solveMany(store, 1)
		advance(300)

		fail(store)

		expect(store.result?.timeMs).toBe(300)
		expect(store.pace).toBe(200)
		expect(store.isRankingEligible).toBe(false)
	})
})
