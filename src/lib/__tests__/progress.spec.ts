import {describe, expect, it} from 'vitest'
import {summarize, toReviewRows, type VerbProgress} from '@/lib/progress'
import type {Verb} from '@/types/verb'

const CATALOG: readonly Verb[] = [
	{id: 1, present: 'be', past: 'was / were', participle: 'been', meaning: 'ser', level: 'beginner'},
	{id: 2, present: 'go', past: 'went', participle: 'gone', meaning: 'ir', level: 'beginner'},
	{
		id: 3,
		present: 'speak',
		past: 'spoke',
		participle: 'spoken',
		meaning: 'hablar',
		level: 'intermediate',
	},
	{id: 4, present: 'weave', past: 'wove', participle: 'woven', meaning: 'tejer', level: 'advanced'},
]

function progress(verbId: number, correct: number, wrong: number): VerbProgress {
	return {verbId, correct, wrong, lastPracticedAt: '2026-08-01T10:00:00Z'}
}

describe('toReviewRows', () => {
	it('deja fuera los verbos que nunca se han practicado', () => {
		const rows = toReviewRows(CATALOG, {2: progress(2, 3, 0)})

		expect(rows.map((row) => row.verb.id)).toEqual([2])
	})

	it('trata una entrada sin respuestas como no practicada', () => {
		const rows = toReviewRows(CATALOG, {2: progress(2, 0, 0)})

		expect(rows).toEqual([])
	})

	it('pone lo no dominado por delante de lo dominado', () => {
		const rows = toReviewRows(CATALOG, {
			1: progress(1, 4, 0),
			2: progress(2, 1, 0),
		})

		expect(rows.map((row) => row.verb.id)).toEqual([2, 1])
		expect(rows.map((row) => row.isMastered)).toEqual([false, true])
	})

	it('dentro de cada grupo, lo peor primero', () => {
		const rows = toReviewRows(CATALOG, {
			1: progress(1, 1, 3),
			2: progress(2, 1, 1),
			3: progress(3, 1, 9),
		})

		expect(rows.map((row) => row.verb.id)).toEqual([3, 1, 2])
	})

	it('desempata por el presente del verbo', () => {
		const rows = toReviewRows(CATALOG, {
			3: progress(3, 1, 1),
			2: progress(2, 1, 1),
			4: progress(4, 1, 1),
		})

		expect(rows.map((row) => row.verb.present)).toEqual(['go', 'speak', 'weave'])
	})

	it('no muta el catálogo que recibe', () => {
		const order = CATALOG.map((verb) => verb.id)

		toReviewRows(CATALOG, {3: progress(3, 1, 5), 1: progress(1, 4, 0)})

		expect(CATALOG.map((verb) => verb.id)).toEqual(order)
	})

	it('calcula el porcentaje de cada verbo', () => {
		const [row] = toReviewRows(CATALOG, {2: progress(2, 3, 1)})

		expect(row?.accuracy).toBe(0.75)
	})
})

describe('summarize', () => {
	it('cuenta practicados, dominados y lo que falta del catálogo', () => {
		const rows = toReviewRows(CATALOG, {1: progress(1, 4, 0), 2: progress(2, 1, 2)})

		expect(summarize(rows, CATALOG.length)).toEqual({
			practiced: 2,
			mastered: 1,
			remaining: 2,
			accuracy: 5 / 7,
		})
	})

	it('sin nada practicado no divide por cero', () => {
		expect(summarize([], CATALOG.length)).toEqual({
			practiced: 0,
			mastered: 0,
			remaining: 4,
			accuracy: 0,
		})
	})

	it('nunca informa de un resto negativo', () => {
		const rows = toReviewRows(CATALOG, {1: progress(1, 4, 0), 2: progress(2, 1, 2)})

		expect(summarize(rows, 1).remaining).toBe(0)
	})
})
