import {computed, ref} from 'vue'
import {defineStore} from 'pinia'
import {MASTERY_MIN_ACCURACY, MASTERY_MIN_CORRECT} from '@/data/levels'

/**
 * Progreso del usuario por verbo, alimentado por el Modo Práctica
 * (`MECHANICS.md` §4 y §6).
 *
 * **En esta fase vive sólo en memoria.** El modo invitado no persiste nada
 * (`CLAUDE.md` §8), así que al recargar se pierde; la Fase 5 sincroniza esto con
 * la tabla `user_progress` de Supabase para usuarios autenticados. La forma de
 * los datos ya anticipa esa tabla para que la sincronización no obligue a
 * rediseñar el store.
 */

export interface VerbProgress {
	readonly verbId: number
	readonly correct: number
	readonly wrong: number
	/** Marca ISO de la última respuesta sobre este verbo. */
	readonly lastPracticedAt: string
}

/** Un verbo sin practicar todavía. */
function emptyProgress(verbId: number): VerbProgress {
	return {verbId, correct: 0, wrong: 0, lastPracticedAt: ''}
}

/** Porcentaje de aciertos de un verbo, de 0 a 1. Sin respuestas, 0. */
export function accuracyOf(progress: VerbProgress): number {
	const total = progress.correct + progress.wrong

	return total === 0 ? 0 : progress.correct / total
}

/**
 * Un verbo se considera dominado con suficientes aciertos **y** buen porcentaje.
 *
 * Las dos condiciones son necesarias: con tres opciones se acierta al azar una
 * de cada tres veces, así que sólo el porcentaje sería frágil; y sólo el número
 * de aciertos premiaría insistir hasta acertar.
 */
export function isMastered(progress: VerbProgress): boolean {
	return progress.correct >= MASTERY_MIN_CORRECT && accuracyOf(progress) >= MASTERY_MIN_ACCURACY
}

export const useProgressStore = defineStore('progress', () => {
	/**
	 * Progreso indexado por `verbId`. Es un `Record` y no un `Map` porque es la
	 * forma que se serializa directamente hacia `user_progress` en la Fase 5.
	 */
	const entries = ref<Record<number, VerbProgress>>({})

	const allProgress = computed(() => Object.values(entries.value))

	const practicedCount = computed(() => allProgress.value.length)

	const totalCorrect = computed(() =>
		allProgress.value.reduce((sum, progress) => sum + progress.correct, 0),
	)

	const totalWrong = computed(() =>
		allProgress.value.reduce((sum, progress) => sum + progress.wrong, 0),
	)

	/** Porcentaje global de aciertos de la práctica, de 0 a 1. */
	const overallAccuracy = computed(() => {
		const total = totalCorrect.value + totalWrong.value

		return total === 0 ? 0 : totalCorrect.value / total
	})

	const masteredVerbIds = computed(() =>
		allProgress.value.filter(isMastered).map((progress) => progress.verbId),
	)

	const masteredCount = computed(() => masteredVerbIds.value.length)

	/** Progreso de un verbo concreto, aunque nunca se haya practicado. */
	function progressFor(verbId: number): VerbProgress {
		return entries.value[verbId] ?? emptyProgress(verbId)
	}

	/** Registra una respuesta del Modo Práctica sobre un verbo. */
	function recordAnswer(verbId: number, isCorrect: boolean): void {
		const current = progressFor(verbId)

		entries.value = {
			...entries.value,
			[verbId]: {
				verbId,
				correct: current.correct + (isCorrect ? 1 : 0),
				wrong: current.wrong + (isCorrect ? 0 : 1),
				lastPracticedAt: new Date().toISOString(),
			},
		}
	}

	/** Borra todo el progreso. Al cerrar sesión, en Fase 5. */
	function resetProgress(): void {
		entries.value = {}
	}

	return {
		// Estado
		entries,
		// Derivados
		allProgress,
		practicedCount,
		totalCorrect,
		totalWrong,
		overallAccuracy,
		masteredVerbIds,
		masteredCount,
		// Acciones
		progressFor,
		recordAnswer,
		resetProgress,
	}
})
