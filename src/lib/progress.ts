/**
 * Lectura del progreso del Dojo (`MECHANICS.md` §4 y §6).
 *
 * Vive en `lib/` y no en el store porque es lógica pura: qué cuenta como
 * dominado y en qué orden conviene repasar no dependen de Vue ni de Pinia, y así
 * se pueden probar sin montar nada (`CLAUDE.md` §7 y §9).
 */

import {MASTERY_MIN_ACCURACY, MASTERY_MIN_CORRECT} from '@/data/levels'
import type {Verb} from '@/types/verb'

/** Lo que se sabe de un verbo tras practicarlo. */
export interface VerbProgress {
	readonly verbId: number
	readonly correct: number
	readonly wrong: number
	/** Marca ISO de la última respuesta sobre este verbo. */
	readonly lastPracticedAt: string
}

/** Un verbo sin practicar todavía. */
export function emptyProgress(verbId: number): VerbProgress {
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

/** Una fila de la pantalla de progreso: el verbo y lo que se sabe de él. */
export interface ProgressRow {
	readonly verb: Verb
	readonly progress: VerbProgress
	readonly accuracy: number
	readonly isMastered: boolean
}

/**
 * Filas de los verbos **ya practicados**, ordenadas por lo que conviene repasar.
 *
 * Se omiten los que nunca se han practicado: una lista con los 106 verbos del
 * catálogo, casi todos vacíos, esconde lo poco que sí dice algo. Lo que falta
 * por tocar se comunica con un recuento, no con cien filas en blanco.
 *
 * El orden es **lo peor primero**: los no dominados antes que los dominados y,
 * dentro de cada grupo, menor porcentaje primero. La pregunta que trae aquí al
 * jugador es «qué se me da mal», y responderla es más útil que ordenar por
 * alfabeto o por fecha. Los empates se rompen por el presente del verbo, para
 * que la lista no baile entre dos visitas.
 */
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

/** Resumen de cabecera de la pantalla de progreso. */
export interface ProgressSummary {
	readonly practiced: number
	readonly mastered: number
	readonly remaining: number
	/** Porcentaje global de aciertos sobre todo lo practicado, de 0 a 1. */
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
