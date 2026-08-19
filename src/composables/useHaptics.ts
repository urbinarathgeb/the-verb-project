const MATCH_PATTERN = 18

const MISTAKE_PATTERN = [28, 70, 28]

export interface UseHapticsReturn {
	isAvailable: () => boolean
	signalMatch: () => void
	signalMistake: () => void
}

export function useHaptics(): UseHapticsReturn {
	function isAvailable(): boolean {
		if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false

		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true

		return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
	}

	function play(pattern: number | number[]): void {
		if (!isAvailable()) return

		navigator.vibrate(pattern)
	}

	return {
		isAvailable,
		signalMatch: () => play(MATCH_PATTERN),
		signalMistake: () => play(MISTAKE_PATTERN),
	}
}
