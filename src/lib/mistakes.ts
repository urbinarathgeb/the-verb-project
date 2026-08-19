import {VERB_FORMS, type Verb, type VerbForm} from '@/types/verb'
import type {Cell} from '@/types/game'

export interface MistakeChoice {
	readonly form: VerbForm
	readonly text: string
	readonly verbId: number
}

export interface Mistake {
	readonly chosen: readonly MistakeChoice[]
	readonly triads: readonly Verb[]
}

function sortByForm(cells: readonly Cell[]): Cell[] {
	return VERB_FORMS.flatMap((form) => cells.filter((cell) => cell.form === form))
}

export function describeMistake(cells: readonly Cell[], catalog: readonly Verb[]): Mistake | null {
	const chosenCells = sortByForm(cells)

	if (chosenCells.length !== VERB_FORMS.length) return null

	const chosen = chosenCells.map((cell) => ({
		form: cell.form,
		text: cell.text,
		verbId: cell.verbId,
	}))

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

export function describeMistakes(
	attempts: readonly (readonly Cell[])[],
	catalog: readonly Verb[],
): Mistake[] {
	return attempts.flatMap((cells) => {
		const mistake = describeMistake(cells, catalog)

		return mistake === null ? [] : [mistake]
	})
}
