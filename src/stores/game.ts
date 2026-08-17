import {computed, shallowRef} from 'vue'
import {defineStore} from 'pinia'
import {useBoard} from '@/composables/useBoard'
import {useTimer} from '@/composables/useTimer'
import {getLevelConfig} from '@/data/levels'
import {getVerbsForDifficulty} from '@/data/verbs'
import {calculatePace, isEligibleForRanking} from '@/lib/ranking'
import type {
	Cell,
	Difficulty,
	FinishedStatus,
	GameMode,
	GameStatus,
	SelectionOutcome,
	SessionResult,
} from '@/types/game'

/**
 * Estado de la partida en curso.
 *
 * Es un store de Pinia y no un composable porque el HUD, el tablero y los
 * modales de resultado son componentes desconectados entre sí que necesitan el
 * mismo estado (`CLAUDE.md` §6). Los componentes **no** lo consumen directamente:
 * lo hacen a través de `useGameEngine` (T2.4).
 *
 * Compone `useBoard` y `useTimer` en lugar de reimplementar su estado. La
 * consecuencia, asumida a propósito, es que el estado interno del tablero y del
 * reloj aparece en DevTools como getters y no dentro de `$state`. No afecta al
 * proyecto: no hay SSR ni plugins de persistencia sobre este store. El estado
 * propio de la partida sí se declara aquí y se devuelve completo, como pide la
 * skill `vue-pinia-best-practices`.
 */
export const useGameStore = defineStore('game', () => {
	const mode = shallowRef<GameMode | null>(null)
	const difficulty = shallowRef<Difficulty | null>(null)
	const status = shallowRef<GameStatus>('idle')
	/** Intentos fallidos. En Modo Precisión siempre es 0 (`MECHANICS.md` §3). */
	const errors = shallowRef(0)
	/** Marca ISO del final de la partida. `null` mientras no haya terminado. */
	const completedAt = shallowRef<string | null>(null)

	const level = computed(() =>
		difficulty.value === null ? null : getLevelConfig(difficulty.value),
	)

	/**
	 * Sólo el Modo Objetivo tiene cuenta regresiva; el de Precisión cronometra
	 * hacia adelante sin límite (`MECHANICS.md` §2 y §3). Es un `computed` porque
	 * el reloj se crea aquí, antes de saber a qué modo va a jugar el usuario.
	 */
	const timeLimitMs = computed(() =>
		mode.value === 'target' && level.value !== null ? level.value.timeLimitMs : null,
	)

	const board = useBoard()
	const timer = useTimer({
		limitMs: timeLimitMs,
		onExpire: () => finish('lost'),
	})

	const isPlaying = computed(() => status.value === 'playing')
	const isFinished = computed(() => status.value === 'won' || status.value === 'lost')

	/** X: aciertos necesarios para ganar en Modo Objetivo. `null` en los demás modos. */
	const targetVerbs = computed(() =>
		mode.value === 'target' && level.value !== null ? level.value.targetVerbs : null,
	)

	/** Aciertos que faltan para el objetivo. `null` fuera del Modo Objetivo. */
	const remainingTargets = computed(() =>
		targetVerbs.value === null ? null : Math.max(0, targetVerbs.value - board.matchedCount.value),
	)

	/** Aciertos de la partida. Es el `verbsMatched` del resultado. */
	const matchedCount = board.matchedCount

	/**
	 * Resultado de la partida, o `null` si aún no ha terminado. Es la forma que se
	 * muestra en pantalla y, para usuarios autenticados, la que se persiste en
	 * `game_sessions` (Fase 5).
	 */
	const result = computed<SessionResult | null>(() => {
		const currentMode = mode.value
		const currentDifficulty = difficulty.value
		const currentStatus = status.value
		const finishedAt = completedAt.value

		if (currentMode === null || currentDifficulty === null || finishedAt === null) return null
		if (currentStatus !== 'won' && currentStatus !== 'lost') return null

		return {
			mode: currentMode,
			difficulty: currentDifficulty,
			status: currentStatus,
			timeMs: timer.elapsedMs.value,
			errors: errors.value,
			verbsMatched: board.matchedCount.value,
			completedAt: finishedAt,
		}
	})

	/**
	 * Ritmo en verbos por minuto, la métrica de ranking del Modo Precisión
	 * (`MECHANICS.md` §3). Se calcula en vivo, así que también sirve para mostrarlo
	 * en el HUD durante la partida.
	 */
	const pace = computed(() => calculatePace(board.matchedCount.value, timer.elapsedMs.value))

	/** ¿Esta partida puede entrar en el ranking? Las reglas viven en `lib/ranking.ts`. */
	const isRankingEligible = computed(() => {
		const current = result.value

		return current !== null && isEligibleForRanking(current)
	})

	/** Deja la partida en su estado inicial, sin configuración de modo ni nivel. */
	function resetGame(): void {
		timer.reset()
		board.deal([], 0)
		mode.value = null
		difficulty.value = null
		status.value = 'idle'
		errors.value = 0
		completedAt.value = null
	}

	/**
	 * Arranca una partida nueva. Reparte el tablero del nivel y pone el reloj en
	 * marcha; a partir de aquí `selectCell` acepta jugadas.
	 */
	function startGame(nextMode: GameMode, nextDifficulty: Difficulty): void {
		const config = getLevelConfig(nextDifficulty)

		timer.reset()
		errors.value = 0
		completedAt.value = null
		mode.value = nextMode
		difficulty.value = nextDifficulty

		board.deal(getVerbsForDifficulty(nextDifficulty), config.boardSize)

		status.value = 'playing'
		timer.start()
	}

	/**
	 * Cierra la partida. Detiene el reloj antes de leer el tiempo, para que el
	 * `timeMs` del resultado sea exacto y no el del último tick.
	 */
	function finish(finalStatus: FinishedStatus): void {
		if (status.value !== 'playing') return

		timer.pause()
		status.value = finalStatus
		completedAt.value = new Date().toISOString()
	}

	/**
	 * Consecuencias de un fallo, propias de cada modo.
	 *
	 * En **Objetivo** el error no termina la ronda, sólo consume tiempo y suma al
	 * contador (`MECHANICS.md` §2). En **Precisión** el primer error termina la
	 * partida y **no se contabiliza**: §3 establece que toda partida registrada en
	 * ese modo tiene cero errores, porque el fallo es el terminador de la ronda y
	 * no una penalización acumulable.
	 */
	function applyErrorRules(): void {
		if (mode.value === 'precision') {
			finish('lost')
			return
		}

		if (mode.value !== 'target' || level.value === null) return

		errors.value += 1
		// Puede agotar el tiempo por sí sola; en ese caso el reloj dispara
		// `onExpire` y la partida termina antes de volver de aquí.
		timer.penalize(level.value.errorPenaltyMs)
	}

	/** Condición de victoria, comprobada tras cada acierto. */
	function checkWinCondition(): void {
		// Vaciar el tablero gana en cualquier modo: no quedan jugadas posibles. Es
		// la victoria del Modo Precisión, que no tiene objetivo de aciertos.
		if (board.isCleared.value) {
			finish('won')
			return
		}

		if (targetVerbs.value === null) return
		if (board.matchedCount.value < targetVerbs.value) return

		finish('won')
	}

	/**
	 * Registra la pulsación de una celda y devuelve qué ocurrió.
	 *
	 * El resultado se devuelve siempre, incluso si la jugada termina la partida:
	 * la UI lo necesita para animar la tríada saliente o la sacudida del error.
	 */
	function selectCell(cell: Cell): SelectionOutcome {
		if (status.value !== 'playing') return {type: 'ignored'}

		const outcome = board.select(cell)

		if (outcome.type === 'mismatch') applyErrorRules()
		if (outcome.type === 'match') checkWinCondition()

		return outcome
	}

	function clearError(): void {
		board.clearError()
	}

	return {
		// Estado propio de la partida
		mode,
		difficulty,
		status,
		errors,
		completedAt,
		// Configuración derivada
		level,
		timeLimitMs,
		targetVerbs,
		remainingTargets,
		// Tablero
		columns: board.columns,
		selection: board.selection,
		errorCellIds: board.errorCellIds,
		resolvedVerbIds: board.resolvedVerbIds,
		visibleCount: board.visibleCount,
		isPoolExhausted: board.isPoolExhausted,
		isCleared: board.isCleared,
		matchedCount,
		// Reloj
		elapsedMs: timer.elapsedMs,
		remainingMs: timer.remainingMs,
		progress: timer.progress,
		isTimerRunning: timer.isRunning,
		// Estado derivado de la partida
		isPlaying,
		isFinished,
		result,
		pace,
		isRankingEligible,
		// Acciones
		startGame,
		selectCell,
		finish,
		clearError,
		resetGame,
	}
})
