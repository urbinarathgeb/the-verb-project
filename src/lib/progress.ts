import {MASTERY_MIN_ACCURACY, MASTERY_MIN_CORRECT} from '@/data/levels'
import type {Verb} from '@/types/verb'

export interface VerbProgress {
	readonly verbId: number
	readonly correct: number
	readonly wrong: number
	readonly lastPracticedAt: string
}

export function emptyProgress(verbId: number): VerbProgress {
	return {verbId, correct: 0, wrong: 0, lastPracticedAt: ''}
}

export function accuracyOf(progress: VerbProgress): number {
	const total = progress.correct + progress.wrong

	return total === 0 ? 0 : progress.correct / total
}

export function isMastered(progress: VerbProgress): boolean {
	return progress.correct >= MASTERY_MIN_CORRECT && accuracyOf(progress) >= MASTERY_MIN_ACCURACY
}

export interface ProgressRow {
	readonly verb: Verb
	readonly progress: VerbProgress
	readonly accuracy: number
	readonly isMastered: boolean
}

export function toReviewRows(
	catalog: readonly Verb[],
	progressByVerbId: Readonly<Record<number, VerbProgress>>,
): ProgressRow[] {
	const rows = catalog.flatMap((verb) => {
		const progress = progressByVerbId[verb.id]

		if (progress === undefined || progress.correct + progress.wrong === 0) return []

		return [{verb, progress, accuracy: accuracyOf(progress), isMastered: isMastered(progress)}]
	})

	return rows.sort((left, right) => {
		if (left.isMastered !== right.isMastered) return left.isMastered ? 1 : -1
		if (left.accuracy !== right.accuracy) return left.accuracy - right.accuracy

		return left.verb.present.localeCompare(right.verb.present)
	})
}

export interface ProgressSummary {
	readonly practiced: number
	readonly mastered: number
	readonly remaining: number
	readonly accuracy: number
}

export function summarize(rows: readonly ProgressRow[], catalogSize: number): ProgressSummary {
	const correct = rows.reduce((sum, row) => sum + row.progress.correct, 0)
	const answered = rows.reduce((sum, row) => sum + row.progress.correct + row.progress.wrong, 0)

	return {
		practiced: rows.length,
		mastered: rows.filter((row) => row.isMastered).length,
		remaining: Math.max(0, catalogSize - rows.length),
		accuracy: answered === 0 ? 0 : correct / answered,
	}
}
