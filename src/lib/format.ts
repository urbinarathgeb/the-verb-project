const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60

export function formatDuration(ms: number): string {
	const totalSeconds = Math.ceil(Math.max(0, ms) / MS_PER_SECOND)
	const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
	const seconds = totalSeconds % SECONDS_PER_MINUTE

	return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatDurationPrecise(ms: number): string {
	const safeMs = Math.max(0, ms)
	const totalSeconds = Math.floor(safeMs / MS_PER_SECOND)
	const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
	const seconds = totalSeconds % SECONDS_PER_MINUTE
	const tenths = Math.floor((safeMs % MS_PER_SECOND) / 100)

	return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`
}

export function formatPace(verbsPerMinute: number): string {
	return verbsPerMinute.toFixed(1)
}
