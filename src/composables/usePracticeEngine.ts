import {computed, getCurrentScope, onScopeDispose, ref, shallowRef, type ComputedRef} from 'vue'
import {storeToRefs} from 'pinia'
import {
	createQuestion,
	formatPrompt,
	isCorrectAnswer,
	nextStreak,
	type PracticeQuestion,
} from '@/lib/practice'
import type {Rng} from '@/lib/shuffle'
import {useProgressStore} from '@/stores/progress'
import {getVerbsForDifficulty} from '@/data/verbs'
import type {Difficulty} from '@/types/game'

/**
 * Motor del Dojo: pregunta actual, respuesta, racha y progreso.
 *
 * La **sesión** (qué pregunta se ve, la racha en curso) es estado local del
 * composable, no de Pinia: muere al salir de la pantalla y ningún otro
 * componente desconectado la necesita (`CLAUDE.md` §6). El **progreso por
 * verbo** sí es global y vive en `useProgressStore`, que este composable
 * envuelve para que la UI no lo toque directamente.
 *
 * No hay cronómetro: es el modo de aprendizaje relajado (`MECHANICS.md` §4).
 */
export interface UsePracticeEngineOptions {
	/** Fuente de aleatoriedad, inyectable para tests deterministas. */
	rng?: Rng
	/**
	 * Cuánto se espera antes de enviar los incrementos acumulados. Agrupar evita
	 * una petición por respuesta sin que el progreso se quede colgando: en una
	 * sesión de veinte preguntas la diferencia es de veinte peticiones a unas
	 * pocas. Inyectable para que los tests no dependan del reloj real.
	 */
	syncDelayMs?: number
}

/** Dos segundos: lo bastante para agrupar una ráfaga de respuestas seguidas. */
const DEFAULT_SYNC_DELAY_MS = 2000

export interface UsePracticeEngineReturn {
	question: ComputedRef<PracticeQuestion | null>
	/** Enunciado ya formateado, del tipo `spoke (pasado) → participio`. */
	promptLabel: ComputedRef<string>
	/** Opción elegida, o `null` mientras no se haya respondido. */
	selectedAnswer: ComputedRef<string | null>
	/** `true` cuando la pregunta actual ya se respondió y se muestra el feedback. */
	isAnswered: ComputedRef<boolean>
	/** Resultado de la última respuesta. `null` si aún no se ha respondido. */
	isLastAnswerCorrect: ComputedRef<boolean | null>
	streak: ComputedRef<number>
	/** Mejor racha de esta sesión. */
	bestStreak: ComputedRef<number>
	/** Respuestas dadas en esta sesión. */
	answeredCount: ComputedRef<number>
	correctCount: ComputedRef<number>
	/** Verbos dominados en total, no sólo en esta sesión. */
	masteredCount: ComputedRef<number>
	/** Empieza una sesión con el pool del nivel indicado. */
	start: (difficulty: Difficulty) => void
	/** Responde la pregunta actual. Devuelve si fue correcta. */
	answer: (option: string) => boolean
	/** Pasa a la siguiente pregunta. */
	next: () => void
}

export function usePracticeEngine(options: UsePracticeEngineOptions = {}): UsePracticeEngineReturn {
	const {rng, syncDelayMs = DEFAULT_SYNC_DELAY_MS} = options

	const progress = useProgressStore()
	const {masteredCount} = storeToRefs(progress)

	/** Temporizador del envío agrupado. */
	let syncTimer: ReturnType<typeof setTimeout> | null = null

	function cancelScheduledSync(): void {
		if (syncTimer === null) return

		clearTimeout(syncTimer)
		syncTimer = null
	}

	function scheduleSync(): void {
		cancelScheduledSync()

		syncTimer = setTimeout(() => {
			syncTimer = null
			void progress.syncPending()
		}, syncDelayMs)
	}

	/** Envía ya lo pendiente, sin esperar al temporizador. */
	function flushSync(): void {
		cancelScheduledSync()
		void progress.syncPending()
	}

	/*
	 * `visibilitychange` y no `beforeunload`: en móvil el navegador puede matar la
	 * pestaña sin disparar nunca `beforeunload`, y entonces las últimas respuestas
	 * se perderían. Pasar a segundo plano sí se notifica de forma fiable.
	 */
	function onVisibilityChange(): void {
		if (document.visibilityState === 'hidden') flushSync()
	}

	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', onVisibilityChange)
	}

	// Al salir de la pantalla se envía lo que quede: si no, las respuestas de los
	// últimos segundos morirían con el componente.
	if (getCurrentScope() !== undefined) {
		onScopeDispose(() => {
			if (typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', onVisibilityChange)
			}

			flushSync()
		})
	}

	const currentQuestion = shallowRef<PracticeQuestion | null>(null)
	const chosenAnswer = ref<string | null>(null)
	const currentStreak = ref(0)
	const bestStreakValue = ref(0)
	const answered = ref(0)
	const correct = ref(0)

	/** Pool del nivel elegido. Se fija al empezar la sesión. */
	let pool = getVerbsForDifficulty('easy')

	const question = computed(() => currentQuestion.value)
	const selectedAnswer = computed(() => chosenAnswer.value)
	const isAnswered = computed(() => chosenAnswer.value !== null)

	const promptLabel = computed(() =>
		currentQuestion.value === null ? '' : formatPrompt(currentQuestion.value),
	)

	const isLastAnswerCorrect = computed(() => {
		const current = currentQuestion.value
		const chosen = chosenAnswer.value
		if (current === null || chosen === null) return null

		return isCorrectAnswer(current, chosen)
	})

	function drawQuestion(): void {
		currentQuestion.value = createQuestion(pool, rng, currentQuestion.value?.verbId)
		chosenAnswer.value = null
	}

	function start(difficulty: Difficulty): void {
		// Se trae el progreso guardado antes de empezar: sin esto, un usuario que
		// vuelve vería su recuento de verbos dominados a cero pese a tenerlos.
		void progress.loadProgress()

		pool = getVerbsForDifficulty(difficulty)
		currentQuestion.value = null
		chosenAnswer.value = null
		currentStreak.value = 0
		bestStreakValue.value = 0
		answered.value = 0
		correct.value = 0

		drawQuestion()
	}

	function answer(option: string): boolean {
		const current = currentQuestion.value
		// Responder dos veces la misma pregunta falsearía la racha y el progreso.
		if (current === null || chosenAnswer.value !== null) return false

		const wasCorrect = isCorrectAnswer(current, option)

		chosenAnswer.value = option
		answered.value += 1
		if (wasCorrect) correct.value += 1

		currentStreak.value = nextStreak(currentStreak.value, wasCorrect)
		bestStreakValue.value = Math.max(bestStreakValue.value, currentStreak.value)

		progress.recordAnswer(current.verbId, wasCorrect)
		scheduleSync()

		return wasCorrect
	}

	function next(): void {
		// Sólo se avanza tras responder: saltar preguntas sin contestar dejaría
		// escapar los verbos que el jugador no sabe, que son justo los que debe
		// practicar.
		if (chosenAnswer.value === null) return

		drawQuestion()
	}

	return {
		question,
		promptLabel,
		selectedAnswer,
		isAnswered,
		isLastAnswerCorrect,
		streak: computed(() => currentStreak.value),
		bestStreak: computed(() => bestStreakValue.value),
		answeredCount: computed(() => answered.value),
		correctCount: computed(() => correct.value),
		masteredCount,
		start,
		answer,
		next,
	}
}
