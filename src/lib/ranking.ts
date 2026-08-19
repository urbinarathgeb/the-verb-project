import {MIN_MATCHES_FOR_RANKING} from '@/data/levels'
import {FALLBACK_DISPLAY_NAME} from '@/lib/auth'
import type {GameMode, SessionResult} from '@/types/game'

const MS_PER_MINUTE = 60_000

export const RANKING_PAGE_SIZE = 20

export function calculatePace(verbsMatched: number, timeMs: number): number {
	if (timeMs <= 0 || verbsMatched <= 0) return 0

	return (verbsMatched * MS_PER_MINUTE) / timeMs
}

export function isEligibleForRanking(result: SessionResult): boolean {
	if (result.mode === 'target') return result.status === 'won'

	return result.verbsMatched >= MIN_MATCHES_FOR_RANKING
}

export function isPersistable(result: SessionResult): boolean {
	return result.mode !== 'target' || result.status === 'won'
}

export function rankingMetric(result: SessionResult): number {
	return result.mode === 'target'
		? result.timeMs
		: calculatePace(result.verbsMatched, result.timeMs)
}

export function isBetterMetric(candidate: number, reference: number, mode: GameMode): boolean {
	return mode === 'target' ? candidate < reference : candidate > reference
}

export type RecordVerdict = 'first' | 'improved' | 'not-improved' | 'not-eligible'

export function compareWithPersonalBest(
	result: SessionResult,
	previousBestMetric: number | null,
): RecordVerdict {
	if (!isEligibleForRanking(result)) return 'not-eligible'
	if (previousBestMetric === null) return 'first'

	return isBetterMetric(rankingMetric(result), previousBestMetric, result.mode)
		? 'improved'
		: 'not-improved'
}

export function bestMetricAfter(result: SessionResult, previousBestMetric: number | null): number {
	const current = rankingMetric(result)

	if (previousBestMetric === null) return current

	return isBetterMetric(current, previousBestMetric, result.mode) ? current : previousBestMetric
}

export interface RankingRow {
	readonly user_id: string | null
	readonly display_name: string | null
	readonly avatar_url: string | null
	readonly time_ms: number | null
	readonly verbs_matched: number | null
	readonly completed_at: string | null
	readonly errors?: number | null
	readonly pace?: number | null
}

export interface RankingEntry {
	readonly position: number
	readonly userId: string
	readonly displayName: string
	readonly avatarUrl: string | null
	readonly timeMs: number
	readonly verbsMatched: number
	readonly errors: number
	readonly pace: number
	readonly completedAt: string
}

function metricOf(entry: Omit<RankingEntry, 'position'>, mode: GameMode): number {
	return mode === 'target' ? entry.timeMs : entry.pace
}

export function toRankingEntries(rows: readonly RankingRow[], mode: GameMode): RankingEntry[] {
	const parsed = rows.flatMap((row) => {
		if (row.user_id === null || row.time_ms === null || row.verbs_matched === null) return []

		const name = row.display_name?.trim()

		return [
			{
				userId: row.user_id,
				displayName: name === undefined || name === '' ? FALLBACK_DISPLAY_NAME : name,
				avatarUrl: row.avatar_url,
				timeMs: row.time_ms,
				verbsMatched: row.verbs_matched,
				errors: row.errors ?? 0,
				pace: row.pace ?? calculatePace(row.verbs_matched, row.time_ms),
				completedAt: row.completed_at ?? '',
			},
		]
	})

	let position = 0
	let previousMetric: number | null = null

	return parsed.map((entry, index) => {
		const metric = metricOf(entry, mode)

		if (previousMetric === null || metric !== previousMetric) position = index + 1

		previousMetric = metric

		return {position, ...entry}
	})
}
