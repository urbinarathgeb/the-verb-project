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

export interface UsePracticeEngineOptions {
	rng?: Rng
	syncDelayMs?: number
}

const DEFAULT_SYNC_DELAY_MS = 2000

export interface UsePracticeEngineReturn {
	question: ComputedRef<PracticeQuestion | null>
	promptLabel: ComputedRef<string>
	selectedAnswer: ComputedRef<string | null>
	isAnswered: ComputedRef<boolean>
	isLastAnswerCorrect: ComputedRef<boolean | null>
	streak: ComputedRef<number>
	bestStreak: ComputedRef<number>
	answeredCount: ComputedRef<number>
	correctCount: ComputedRef<number>
	masteredCount: ComputedRef<number>
	start: (difficulty: Difficulty) => void
	answer: (option: string) => boolean
	next: () => void
}

export function usePracticeEngine(options: UsePracticeEngineOptions = {}): UsePracticeEngineReturn {
	const {rng, syncDelayMs = DEFAULT_SYNC_DELAY_MS} = options

	const progress = useProgressStore()
	const {masteredCount} = storeToRefs(progress)

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

	function flushSync(): void {
		cancelScheduledSync()
		void progress.syncPending()
	}

	function onVisibilityChange(): void {
		if (document.visibilityState === 'hidden') flushSync()
	}

	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', onVisibilityChange)
	}

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
