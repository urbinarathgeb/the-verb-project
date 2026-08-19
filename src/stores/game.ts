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

export const REFILL_APPEAR_MS = 400

export const useGameStore = defineStore('game', () => {
	const mode = shallowRef<GameMode | null>(null)
	const difficulty = shallowRef<Difficulty | null>(null)
	const status = shallowRef<GameStatus>('idle')
	const errors = shallowRef(0)
	const completedAt = shallowRef<string | null>(null)

	const isPaused = shallowRef(false)

	const mistakeAttempts = shallowRef<Cell[][]>([])

	const level = computed(() =>
		difficulty.value === null ? null : getLevelConfig(difficulty.value),
	)

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

	const targetVerbs = computed(() =>
		mode.value === 'target' && level.value !== null ? level.value.targetVerbs : null,
	)

	const remainingTargets = computed(() =>
		targetVerbs.value === null ? null : Math.max(0, targetVerbs.value - board.matchedCount.value),
	)

	const matchedCount = board.matchedCount

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

	const pace = computed(() => calculatePace(board.matchedCount.value, timer.elapsedMs.value))

	const isRankingEligible = computed(() => {
		const current = result.value

		return current !== null && isEligibleForRanking(current)
	})

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

	function startGame(nextMode: GameMode, nextDifficulty: Difficulty): void {
		const config = getLevelConfig(nextDifficulty)

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

	let refillTimers: ReturnType<typeof setTimeout>[] = []
	let drainTimer: ReturnType<typeof setTimeout> | null = null
	let graceTimer: ReturnType<typeof setTimeout> | null = null

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

	function applyRefills(ignoreMinimum: boolean): void {
		const minVacancies = ignoreMinimum ? 1 : (level.value?.refillMinVacancies ?? 1)

		while (owedRefills > 0 && board.vacatedCount.value >= minVacancies) {
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

	function queueDrain(): void {
		if (drainTimer !== null) return

		drainTimer = setTimeout(() => {
			drainTimer = null
			if (status.value !== 'playing' || isPaused.value) return

			applyRefills(false)
		}, REFILL_APPEAR_MS)
	}

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

			if (status.value !== 'playing') return

			owedRefills += 1
			queueDrain()
		}, delay)

		refillTimers.push(timer)
	}

	function finish(finalStatus: FinishedStatus): void {
		if (status.value !== 'playing') return

		cancelRefills()
		timer.pause()
		isPaused.value = false
		status.value = finalStatus
		completedAt.value = new Date().toISOString()
	}

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

	const mistakes = computed(() => describeMistakes(mistakeAttempts.value, VERBS))

	function applyErrorRules(): void {
		if (mode.value === 'precision') {
			finish('lost')
			return
		}

		if (mode.value !== 'target' || level.value === null) return

		errors.value += 1
		timer.penalize(level.value.errorPenaltyMs)
	}

	function checkWinCondition(): void {
		if (board.isCleared.value && board.isPoolExhausted.value) {
			finish('won')
			return
		}

		if (targetVerbs.value === null) return
		if (board.matchedCount.value < targetVerbs.value) return

		finish('won')
	}

	function pause(): void {
		if (status.value !== 'playing' || isPaused.value) return

		isPaused.value = true
		timer.pause()
	}

	function resume(): void {
		if (!isPaused.value) return

		isPaused.value = false

		if (status.value !== 'playing') return

		timer.start()
		queueDrain()
	}

	function selectCell(cell: Cell): SelectionOutcome {
		if (status.value !== 'playing' || isPaused.value) return {type: 'ignored'}

		const outcome = board.select(cell)

		if (outcome.type === 'mismatch') {
			recordMistake(outcome.cellIds)
			applyErrorRules()
		}

		if (outcome.type === 'match') {
			scheduleRefill()
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
		mode,
		difficulty,
		status,
		errors,
		completedAt,
		isPaused,
		mistakeAttempts,
		mistakes,
		level,
		timeLimitMs,
		targetVerbs,
		remainingTargets,
		columns: board.columns,
		selection: board.selection,
		errorCellIds: board.errorCellIds,
		resolvedVerbIds: board.resolvedVerbIds,
		visibleCount: board.visibleCount,
		vacatedCount: board.vacatedCount,
		isPoolExhausted: board.isPoolExhausted,
		isCleared: board.isCleared,
		matchedCount,
		elapsedMs: timer.elapsedMs,
		remainingMs: timer.remainingMs,
		progress: timer.progress,
		isTimerRunning: timer.isRunning,
		isPlaying,
		isFinished,
		result,
		pace,
		isRankingEligible,
		startGame,
		selectCell,
		finish,
		pause,
		resume,
		clearError,
		resetGame,
	}
})
