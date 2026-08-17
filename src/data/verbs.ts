/**
 * Cargador tipado del catálogo de verbos.
 *
 * TypeScript ensancha los literales de un JSON importado, así que `level` llega
 * como `string` y el JSON no es asignable a `Verb[]` directamente. En vez de
 * silenciarlo con una aserción `as` —que anularía precisamente la comprobación
 * que queremos— se valida en runtime y se estrecha el tipo con guardas.
 *
 * El coste es despreciable (106 filas, una sola vez al importar el módulo) y a
 * cambio un catálogo mal editado falla de inmediato y con un mensaje claro, en
 * lugar de romper el tablero a mitad de una partida.
 */

import rawVerbs from './verbs.json'
import {VERB_FORMS, VERB_LEVELS, type Verb, type VerbLevel} from '@/types/verb'
import type {Difficulty} from '@/types/game'
import {getLevelConfig} from './levels'

interface RawVerb {
	id: number
	present: string
	past: string
	participle: string
	level: string
}

function isVerbLevel(value: string): value is VerbLevel {
	return (VERB_LEVELS as readonly string[]).includes(value)
}

function parseVerb(raw: RawVerb): Verb {
	if (!isVerbLevel(raw.level)) {
		throw new Error(
			`Verbo ${raw.id}: nivel "${raw.level}" no válido. Esperados: ${VERB_LEVELS.join(', ')}.`,
		)
	}

	for (const form of VERB_FORMS) {
		if (raw[form].trim() === '') {
			throw new Error(`Verbo ${raw.id}: la forma "${form}" está vacía.`)
		}
	}

	return {
		id: raw.id,
		present: raw.present,
		past: raw.past,
		participle: raw.participle,
		level: raw.level,
	}
}

/** Catálogo completo, validado y tipado. */
export const VERBS: readonly Verb[] = Object.freeze((rawVerbs as RawVerb[]).map(parseVerb))

/**
 * Verbos disponibles para un nivel de dificultad, según el pool definido en
 * `levels.ts`. Es el conjunto del que se toman las tríadas del tablero y su
 * reposición (`PLAN.md`, Bitácora, P1).
 */
export function getVerbsForDifficulty(difficulty: Difficulty): Verb[] {
	const {verbLevels} = getLevelConfig(difficulty)
	return VERBS.filter((verb) => verbLevels.includes(verb.level))
}
