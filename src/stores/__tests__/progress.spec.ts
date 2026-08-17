import {beforeEach, describe, expect, it} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {accuracyOf, isMastered, useProgressStore} from '../progress'
import {MASTERY_MIN_CORRECT} from '@/data/levels'

beforeEach(() => {
	setActivePinia(createPinia())
})

/** Responde `times` veces sobre el mismo verbo con el resultado indicado. */
function answerMany(
	store: ReturnType<typeof useProgressStore>,
	verbId: number,
	results: boolean[],
) {
	for (const isCorrect of results) store.recordAnswer(verbId, isCorrect)
}

describe('accuracyOf', () => {
	it('es 0 si el verbo no se ha practicado', () => {
		expect(accuracyOf({verbId: 1, correct: 0, wrong: 0, lastPracticedAt: ''})).toBe(0)
	})

	it('calcula la proporción de aciertos', () => {
		expect(accuracyOf({verbId: 1, correct: 3, wrong: 1, lastPracticedAt: ''})).toBe(0.75)
	})

	it('es 1 sin errores', () => {
		expect(accuracyOf({verbId: 1, correct: 5, wrong: 0, lastPracticedAt: ''})).toBe(1)
	})
})

describe('isMastered', () => {
	/**
	 * Hacen falta las dos condiciones: con tres opciones se acierta al azar una de
	 * cada tres veces, así que sólo el porcentaje sería frágil, y sólo el número de
	 * aciertos premiaría insistir hasta acertar.
	 */
	it('exige aciertos suficientes y buen porcentaje', () => {
		expect(isMastered({verbId: 1, correct: 4, wrong: 0, lastPracticedAt: ''})).toBe(true)
	})

	it('no basta con el porcentaje si hay pocos aciertos', () => {
		expect(isMastered({verbId: 1, correct: 1, wrong: 0, lastPracticedAt: ''})).toBe(false)
	})

	it('no basta con los aciertos si el porcentaje es bajo', () => {
		expect(isMastered({verbId: 1, correct: 4, wrong: 6, lastPracticedAt: ''})).toBe(false)
	})

	it('un verbo sin practicar no está dominado', () => {
		expect(isMastered({verbId: 1, correct: 0, wrong: 0, lastPracticedAt: ''})).toBe(false)
	})
})

describe('useProgressStore — estado inicial', () => {
	it('empieza sin progreso', () => {
		const store = useProgressStore()

		expect(store.practicedCount).toBe(0)
		expect(store.totalCorrect).toBe(0)
		expect(store.totalWrong).toBe(0)
		expect(store.masteredCount).toBe(0)
	})

	it('un porcentaje global sin respuestas es 0, no NaN', () => {
		expect(useProgressStore().overallAccuracy).toBe(0)
	})

	it('devuelve progreso vacío para un verbo nunca practicado', () => {
		const store = useProgressStore()

		expect(store.progressFor(42)).toEqual({
			verbId: 42,
			correct: 0,
			wrong: 0,
			lastPracticedAt: '',
		})
	})

	/** La skill de Pinia exige devolver todo el estado propio del setup store. */
	it('expone su estado en `$state`', () => {
		expect(Object.keys(useProgressStore().$state)).toEqual(['entries'])
	})
})

describe('useProgressStore — registro de respuestas', () => {
	it('cuenta un acierto', () => {
		const store = useProgressStore()

		store.recordAnswer(1, true)

		expect(store.progressFor(1).correct).toBe(1)
		expect(store.progressFor(1).wrong).toBe(0)
		expect(store.totalCorrect).toBe(1)
	})

	it('cuenta un error', () => {
		const store = useProgressStore()

		store.recordAnswer(1, false)

		expect(store.progressFor(1).wrong).toBe(1)
		expect(store.totalWrong).toBe(1)
	})

	it('acumula respuestas sobre el mismo verbo', () => {
		const store = useProgressStore()

		answerMany(store, 1, [true, true, false])

		expect(store.progressFor(1)).toMatchObject({correct: 2, wrong: 1})
		expect(store.practicedCount).toBe(1)
	})

	it('lleva la cuenta de varios verbos por separado', () => {
		const store = useProgressStore()

		store.recordAnswer(1, true)
		store.recordAnswer(2, false)

		expect(store.progressFor(1).correct).toBe(1)
		expect(store.progressFor(2).wrong).toBe(1)
		expect(store.practicedCount).toBe(2)
	})

	it('guarda una marca de tiempo ISO válida', () => {
		const store = useProgressStore()

		store.recordAnswer(1, true)

		const stamp = store.progressFor(1).lastPracticedAt
		expect(new Date(stamp).toISOString()).toBe(stamp)
	})

	it('calcula el porcentaje global sobre todos los verbos', () => {
		const store = useProgressStore()

		answerMany(store, 1, [true, true])
		answerMany(store, 2, [true, false])

		expect(store.overallAccuracy).toBe(0.75)
	})
})

describe('useProgressStore — dominio', () => {
	it('marca un verbo como dominado al alcanzar el umbral', () => {
		const store = useProgressStore()

		answerMany(store, 7, Array<boolean>(MASTERY_MIN_CORRECT).fill(true))

		expect(store.masteredVerbIds).toEqual([7])
		expect(store.masteredCount).toBe(1)
	})

	it('no lo marca antes de alcanzarlo', () => {
		const store = useProgressStore()

		answerMany(store, 7, Array<boolean>(MASTERY_MIN_CORRECT - 1).fill(true))

		expect(store.masteredCount).toBe(0)
	})

	/** Un verbo puede dejar de estar dominado si se vuelve a fallar mucho. */
	it('deja de estar dominado si el porcentaje baja del umbral', () => {
		const store = useProgressStore()
		answerMany(store, 7, Array<boolean>(MASTERY_MIN_CORRECT).fill(true))

		answerMany(store, 7, [false, false, false])

		expect(store.masteredCount).toBe(0)
	})
})

describe('useProgressStore — reinicio', () => {
	it('`resetProgress` borra todo', () => {
		const store = useProgressStore()
		answerMany(store, 1, [true, true, true])

		store.resetProgress()

		expect(store.practicedCount).toBe(0)
		expect(store.masteredCount).toBe(0)
		expect(store.progressFor(1).correct).toBe(0)
	})
})
