import {
	computed,
	getCurrentScope,
	onScopeDispose,
	shallowRef,
	toValue,
	type ComputedRef,
	type MaybeRefOrGetter,
} from 'vue'

export interface UseTimerOptions {
	limitMs?: MaybeRefOrGetter<number | null>
	tickMs?: number
	onExpire?: () => void
}

export interface UseTimerReturn {
	elapsedMs: ComputedRef<number>
	remainingMs: ComputedRef<number | null>
	progress: ComputedRef<number | null>
	isRunning: ComputedRef<boolean>
	isExpired: ComputedRef<boolean>
	start: () => void
	pause: () => void
	reset: () => void
	penalize: (ms: number) => void
}

const DEFAULT_TICK_MS = 100

export function useTimer(options: UseTimerOptions = {}): UseTimerReturn {
	const {limitMs = null, tickMs = DEFAULT_TICK_MS, onExpire} = options

	function currentLimitMs(): number | null {
		return toValue(limitMs)
	}

	const startedAt = shallowRef<number | null>(null)
	const accumulatedMs = shallowRef(0)
	const penaltiesMs = shallowRef(0)
	const nowMs = shallowRef(Date.now())
	const expired = shallowRef(false)

	let intervalId: ReturnType<typeof setInterval> | null = null

	const isRunning = computed(() => startedAt.value !== null)
	const isExpired = computed(() => expired.value)

	function currentSegmentMs(): number {
		const start = startedAt.value
		return start === null ? 0 : Math.max(0, nowMs.value - start)
	}

	const elapsedMs = computed(() => {
		const total = accumulatedMs.value + currentSegmentMs() + penaltiesMs.value

		const limit = currentLimitMs()
		return limit === null ? total : Math.min(total, limit)
	})

	const remainingMs = computed<number | null>(() => {
		const limit = currentLimitMs()
		return limit === null ? null : Math.max(0, limit - elapsedMs.value)
	})

	const progress = computed<number | null>(() => {
		const limit = currentLimitMs()
		return limit === null || limit <= 0 ? null : Math.min(1, elapsedMs.value / limit)
	})

	function syncNow(): void {
		nowMs.value = Date.now()
	}

	function stopTicking(): void {
		if (intervalId === null) return
		clearInterval(intervalId)
		intervalId = null
	}

	function checkExpiry(): void {
		const limit = currentLimitMs()
		if (limit === null || expired.value) return
		if (elapsedMs.value < limit) return

		expired.value = true
		pause()
		onExpire?.()
	}

	function tick(): void {
		syncNow()
		checkExpiry()
	}

	function start(): void {
		if (expired.value || isRunning.value) return

		syncNow()
		startedAt.value = nowMs.value
		intervalId = setInterval(tick, tickMs)

		checkExpiry()
	}

	function pause(): void {
		if (!isRunning.value) return

		syncNow()
		accumulatedMs.value += currentSegmentMs()
		startedAt.value = null
		stopTicking()
	}

	function reset(): void {
		stopTicking()
		startedAt.value = null
		accumulatedMs.value = 0
		penaltiesMs.value = 0
		expired.value = false
		syncNow()
	}

	function penalize(ms: number): void {
		if (ms <= 0) return

		penaltiesMs.value += ms
		if (isRunning.value) syncNow()
		checkExpiry()
	}

	if (getCurrentScope() !== undefined) onScopeDispose(stopTicking)

	return {
		elapsedMs,
		remainingMs,
		progress,
		isRunning,
		isExpired,
		start,
		pause,
		reset,
		penalize,
	}
}
