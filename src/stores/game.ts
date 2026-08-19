import {computed, shallowRef} from 'vue'
import {defineStore} from 'pinia'
import {useBoard} from '@/composables/useBoard'
import {useTimer} from '@/composables/useTimer'
import {getLevelConfig} from '@/data/levels'
import {VERBS, getVerbsForDifficulty} from '@/data/verbs'
import {describeMistakes} from '@/lib/mistakes'
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
import {VERB_FORMS} from '@/types/verb'

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
/**
 * Retardo con el que se aplica una reposición ya debida.
 *
 * Separa visualmente el acierto de la reposición: aplicarla en el mismo
 * fotograma hacía que tres celdas se atenuaran y otras tres aparecieran a la vez,
 * que se percibía como un pestañeo del tablero.
 */
export const REFILL_APPEAR_MS = 400

export const useGameStore = defineStore('game', () => {
	const mode = shallowRef<GameMode | null>(null)
	const difficulty = shallowRef<Difficulty | null>(null)
	const status = shallowRef<GameStatus>('idle')
	/** Intentos fallidos. En Modo Supervivencia siempre es 0 (`MECHANICS.md` §3). */
	const errors = shallowRef(0)
	/** Marca ISO del final de la partida. `null` mientras no haya terminado. */
	const completedAt = shallowRef<string | null>(null)

	/**
	 * Partida en pausa.
	 *
	 * Es un booleano aparte y **no** un valor más de `GameStatus`, a propósito: la
	 * partida sigue en curso: no ha terminado, no se ha descartado y su resultado
	 * no existe todavía. Meterlo en `status` obligaría a contemplar el caso en la
	 * condición de victoria, en el resultado y en las dos vistas de ranking, para
	 * representar algo que no cambia en qué estado está la partida sino si acepta
	 * jugadas.
	 */
	const isPaused = shallowRef(false)

	/**
	 * Celdas de cada intento fallido, para poder explicarlos al terminar.
	 *
	 * Es independiente del contador `errors`, y tiene que serlo: en Modo Supervivencia
	 * `errors` es siempre 0 por especificación (`MECHANICS.md` §3, el fallo es el
	 * terminador de la ronda, no una penalización acumulable), pero el fallo
	 * ocurrió y es justo el más valioso de explicar.
	 */
	const mistakeAttempts = shallowRef<Cell[][]>([])

	const level = computed(() =>
		difficulty.value === null ? null : getLevelConfig(difficulty.value),
	)

	/**
	 * Sólo el Modo Objetivo tiene cuenta regresiva; el de Supervivencia cronometra
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
	 * Ritmo en verbos por minuto, la métrica de ranking del Modo Supervivencia
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
		cancelRefills()
		timer.reset()
		board.deal([], 0)
		mode.value = null
		difficulty.value = null
		status.value = 'idle'
		errors.value = 0
		completedAt.value = null
		mistakeAttempts.value = []
		isPaused.value = false
	}

	/**
	 * Arranca una partida nueva. Reparte el tablero del nivel y pone el reloj en
	 * marcha; a partir de aquí `selectCell` acepta jugadas.
	 */
	function startGame(nextMode: GameMode, nextDifficulty: Difficulty): void {
		const config = getLevelConfig(nextDifficulty)

		// Una partida nueva no hereda las reposiciones pendientes de la anterior.
		cancelRefills()
		timer.reset()
		errors.value = 0
		completedAt.value = null
		mistakeAttempts.value = []
		isPaused.value = false
		mode.value = nextMode
		difficulty.value = nextDifficulty

		board.deal(getVerbsForDifficulty(nextDifficulty), config.boardSize)

		status.value = 'playing'
		timer.start()
	}

	/*
	 * Reposiciones pendientes.
	 *
	 * Cada acierto agenda la suya, así que puede haber varias en vuelo a la vez
	 * durante una racha. Se guardan para poder cancelarlas: una partida terminada
	 * que siguiera repoblando el tablero mostraría verbos nuevos bajo el modal de
	 * desenlace, y en la siguiente partida los temporizadores viejos repondrían
	 * sobre un tablero que ya no es el suyo.
	 *
	 * No es estado reactivo —nadie lo pinta— así que no forma parte del store.
	 */
	let refillTimers: ReturnType<typeof setTimeout>[] = []
	let drainTimer: ReturnType<typeof setTimeout> | null = null
	let graceTimer: ReturnType<typeof setTimeout> | null = null

	/**
	 * Reposiciones cuyo retardo ya venció pero que aún no se han aplicado.
	 *
	 * Existen porque una reposición puede quedar **en deuda**: si al vencer hay
	 * menos huecos de los que pide `refillMinVacancies`, aplicarla regalaría la
	 * tríada. Sin este contador la reposición se perdería y el tablero encogería
	 * para siempre.
	 */
	let owedRefills = 0

	function cancelRefills(): void {
		for (const timer of refillTimers) clearTimeout(timer)
		refillTimers = []

		if (drainTimer !== null) clearTimeout(drainTimer)
		if (graceTimer !== null) clearTimeout(graceTimer)

		drainTimer = null
		graceTimer = null
		owedRefills = 0
	}

	/**
	 * Caducidad del mínimo de huecos.
	 *
	 * El mínimo es una **preferencia, no una condición absoluta**, y tiene que
	 * serlo: cada acierto genera una reposición, y como el tablero deja de pagarlas
	 * al bajar del mínimo, un mínimo de G huecos dejaría el tablero fijo en N−(G−1)
	 * durante el resto de la partida, oscilando entre G−1 y G huecos sin volver a
	 * llenarse nunca. Pasado este margen se repone igual.
	 */
	function scheduleGrace(): void {
		if (graceTimer !== null) clearTimeout(graceTimer)
		graceTimer = null

		if (owedRefills === 0) return

		graceTimer = setTimeout(() => {
			graceTimer = null
			if (status.value !== 'playing' || isPaused.value) return

			applyRefills(true)
		}, level.value?.refillGraceMs ?? 0)
	}

	/**
	 * Aplica las reposiciones debidas que el tablero admita.
	 *
	 * Con `ignoreMinimum` se aplica **una sola** aunque falten huecos: es la salida
	 * del margen, y hacerlo de una en una devuelve el tablero a su tamaño a ritmo
	 * visible en lugar de llenarlo de golpe.
	 */
	function applyRefills(ignoreMinimum: boolean): void {
		const minVacancies = ignoreMinimum ? 1 : (level.value?.refillMinVacancies ?? 1)

		while (owedRefills > 0 && board.vacatedCount.value >= minVacancies) {
			// Si el pool se agotó no hay nada que colocar y la deuda es incobrable.
			if (!board.refill()) {
				owedRefills = 0
				break
			}

			owedRefills -= 1

			if (ignoreMinimum) break
		}

		scheduleGrace()
		forceRefillIfTooEmpty()
	}

	/**
	 * Pide aplicar las reposiciones debidas.
	 *
	 * Nunca en el mismo instante del acierto: hacerlo producía un salto: las tres
	 * celdas se atenuaban y otras tres aparecían en el mismo fotograma.
	 */
	function queueDrain(): void {
		if (drainTimer !== null) return

		drainTimer = setTimeout(() => {
			drainTimer = null
			// La deuda se conserva: al reanudar, `resume` vuelve a pedir el drenaje.
			if (status.value !== 'playing' || isPaused.value) return

			applyRefills(false)
		}, REFILL_APPEAR_MS)
	}

	/**
	 * Adelanta una reposición cuando el tablero se ha quedado demasiado vacío.
	 *
	 * Consume el temporizador **más antiguo** y deja a los demás con su hora
	 * original. Reprogramarlos haría que forzar una vez retrasara a todas las
	 * siguientes, y el tablero se llenaría a tirones en vez de a ritmo constante.
	 */
	function forceRefillIfTooEmpty(): void {
		const forceAt = level.value?.refillForceVacancies

		if (forceAt === undefined) return
		if (board.vacatedCount.value < forceAt) return

		const oldest = refillTimers.shift()
		if (oldest === undefined) return

		clearTimeout(oldest)
		owedRefills += 1
		queueDrain()
	}

	function scheduleRefill(): void {
		const delay = level.value?.refillDelayMs ?? 0

		const timer = setTimeout(() => {
			refillTimers = refillTimers.filter((pending) => pending !== timer)

			// Doble red: aunque `cancelRefills` los limpia, comprobar el estado evita
			// depender de que nadie olvide llamarlo en un camino nuevo.
			if (status.value !== 'playing') return

			owedRefills += 1
			queueDrain()
		}, delay)

		refillTimers.push(timer)
	}

	/**
	 * Cierra la partida. Detiene el reloj antes de leer el tiempo, para que el
	 * `timeMs` del resultado sea exacto y no el del último tick.
	 */
	function finish(finalStatus: FinishedStatus): void {
		if (status.value !== 'playing') return

		cancelRefills()
		timer.pause()
		isPaused.value = false
		status.value = finalStatus
		completedAt.value = new Date().toISOString()
	}

	/**
	 * Consecuencias de un fallo, propias de cada modo.
	 *
	 * En **Objetivo** el error no termina la ronda, sólo consume tiempo y suma al
	 * contador (`MECHANICS.md` §2). En **Supervivencia** el primer error termina la
	 * partida y **no se contabiliza**: §3 establece que toda partida registrada en
	 * ese modo tiene cero errores, porque el fallo es el terminador de la ronda y
	 * no una penalización acumulable.
	 */
	/** Guarda las celdas del intento fallido, resueltas desde el tablero. */
	function recordMistake(cellIds: readonly string[]): void {
		const cells = cellIds.flatMap((cellId) => {
			for (const form of VERB_FORMS) {
				const cell = board.columns.value[form].find((candidate) => candidate.id === cellId)
				if (cell !== undefined) return [cell]
			}

			return []
		})

		if (cells.length === 0) return

		mistakeAttempts.value = [...mistakeAttempts.value, cells]
	}

	/** Fallos de la partida, ya explicados. Vacío si no hubo ninguno. */
	const mistakes = computed(() => describeMistakes(mistakeAttempts.value, VERBS))

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
		/*
		 * Vaciar el tablero gana sólo si **además se agotó el pool**. Es la victoria
		 * del Modo Supervivencia, que no tiene objetivo de aciertos.
		 *
		 * La condición del pool es imprescindible desde la reposición diferida: un
		 * jugador rápido puede emparejar todas las tríadas visibles antes de que
		 * llegue ninguna reposición, y sin esta comprobación ganaría la partida a
		 * los pocos segundos con el pool casi intacto.
		 */
		if (board.isCleared.value && board.isPoolExhausted.value) {
			finish('won')
			return
		}

		if (targetVerbs.value === null) return
		if (board.matchedCount.value < targetVerbs.value) return

		finish('won')
	}

	/**
	 * Detiene la partida sin terminarla.
	 *
	 * La usa la pantalla cuando la pestaña pasa a segundo plano. `useTimer` mide
	 * contra el reloj del sistema a propósito —para que el tiempo del ranking no
	 * derive—, y el efecto colateral era que una notificación o una llamada
	 * arruinaban la partida: en Contrarreloj se volvía a un tablero muerto a 0:00
	 * y en Supervivencia el ritmo se hundía por tiempo que nadie jugó
	 * (`PLAN.md`, Bitácora, D13).
	 */
	function pause(): void {
		if (status.value !== 'playing' || isPaused.value) return

		isPaused.value = true
		timer.pause()
	}

	/**
	 * Reanuda. Es una acción explícita del jugador y no algo que ocurra al volver
	 * a la pestaña: recuperar el foco no significa estar mirando el tablero.
	 */
	function resume(): void {
		if (!isPaused.value) return

		isPaused.value = false

		if (status.value !== 'playing') return

		timer.start()
		// Paga lo que venciera durante la pausa; el drenaje volvió temprano.
		queueDrain()
	}

	/**
	 * Registra la pulsación de una celda y devuelve qué ocurrió.
	 *
	 * El resultado se devuelve siempre, incluso si la jugada termina la partida:
	 * la UI lo necesita para animar la tríada saliente o la sacudida del error.
	 */
	function selectCell(cell: Cell): SelectionOutcome {
		if (status.value !== 'playing' || isPaused.value) return {type: 'ignored'}

		const outcome = board.select(cell)

		if (outcome.type === 'mismatch') {
			recordMistake(outcome.cellIds)
			applyErrorRules()
		}

		if (outcome.type === 'match') {
			scheduleRefill()
			// El acierto acaba de abrir un hueco: puede desbloquear una reposición en
			// deuda, o dejar el tablero tan vacío que haya que adelantar la siguiente.
			queueDrain()
			forceRefillIfTooEmpty()
			checkWinCondition()
		}

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
		isPaused,
		mistakeAttempts,
		mistakes,
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
		vacatedCount: board.vacatedCount,
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
		pause,
		resume,
		clearError,
		resetGame,
	}
})
