import {VERB_FORMS, type Verb, type VerbForm} from '@/types/verb'
import type {Cell} from '@/types/game'

/**
 * Lectura de los fallos de una partida.
 *
 * Existe porque un fallo sin explicación es una oportunidad de aprendizaje
 * desperdiciada: `PRODUCT.md` §1 identifica como problema que el estudiante
 * memoriza a corto plazo y falla al evocar, y §5 promete retroalimentación
 * inmediata. Hasta ahora un fallo sólo incrementaba un contador.
 */

/** Una de las tres celdas que el jugador eligió al fallar. */
export interface MistakeChoice {
	readonly form: VerbForm
	readonly text: string
	/** Verbo al que pertenecía realmente esa celda. */
	readonly verbId: number
}

export interface Mistake {
	/** Lo que se eligió, en orden de columna: presente, pasado, participio. */
	readonly chosen: readonly MistakeChoice[]
	/**
	 * Tríadas completas de los verbos implicados, sin repetir y en el orden en
	 * que aparecieron.
	 *
	 * Son varias porque al fallar se eligen celdas de hasta **tres verbos
	 * distintos**: no existe «la» tríada correcta. Mostrarlas todas es lo que
	 * revela dónde estaba la confusión.
	 */
	readonly triads: readonly Verb[]
}

/** Ordena las celdas por columna, para que la lectura sea siempre la misma. */
function sortByForm(cells: readonly Cell[]): Cell[] {
	return VERB_FORMS.flatMap((form) => cells.filter((cell) => cell.form === form))
}

/**
 * Convierte un intento fallido en algo que se pueda leer y aprender.
 *
 * Devuelve `null` si al fallo le falta alguna de las tres celdas: media
 * explicación confunde más que ninguna.
 */
export function describeMistake(cells: readonly Cell[], catalog: readonly Verb[]): Mistake | null {
	const chosenCells = sortByForm(cells)

	if (chosenCells.length !== VERB_FORMS.length) return null

	const chosen = chosenCells.map((cell) => ({
		form: cell.form,
		text: cell.text,
		verbId: cell.verbId,
	}))

	// Sin repetir: si dos de las celdas eran del mismo verbo, su tríada se enseña
	// una sola vez.
	const seen = new Set<number>()
	const triads: Verb[] = []

	for (const cell of chosenCells) {
		if (seen.has(cell.verbId)) continue

		seen.add(cell.verbId)

		const verb = catalog.find((candidate) => candidate.id === cell.verbId)

		if (verb !== undefined) triads.push(verb)
	}

	return {chosen, triads}
}

/** Lee los fallos de una partida, descartando los que no se puedan explicar. */
export function describeMistakes(
	attempts: readonly (readonly Cell[])[],
	catalog: readonly Verb[],
): Mistake[] {
	return attempts.flatMap((cells) => {
		const mistake = describeMistake(cells, catalog)

		return mistake === null ? [] : [mistake]
	})
}
