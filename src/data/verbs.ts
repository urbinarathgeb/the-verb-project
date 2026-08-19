import rawVerbs from './verbs.json'
import {VERB_FORMS, VERB_LEVELS, type Verb, type VerbLevel} from '@/types/verb'
import type {Difficulty} from '@/types/game'
import {getLevelConfig} from './levels'

interface RawVerb {
	id: number
	present: string
	past: string
	participle: string
	meaning: string
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

	if (typeof raw.meaning !== 'string' || raw.meaning.trim() === '') {
		throw new Error(`Verbo ${raw.id}: el significado está vacío.`)
	}

	return {
		id: raw.id,
		present: raw.present,
		past: raw.past,
		participle: raw.participle,
		meaning: raw.meaning,
		level: raw.level,
	}
}

export const VERBS: readonly Verb[] = Object.freeze((rawVerbs as RawVerb[]).map(parseVerb))

export function getVerbsForDifficulty(difficulty: Difficulty): Verb[] {
	const {verbLevels} = getLevelConfig(difficulty)
	return VERBS.filter((verb) => verbLevels.includes(verb.level))
}
