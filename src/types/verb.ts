export const VERB_FORMS = ['present', 'past', 'participle'] as const

export type VerbForm = (typeof VERB_FORMS)[number]

export const VERB_LEVELS = ['beginner', 'intermediate', 'advanced'] as const

export type VerbLevel = (typeof VERB_LEVELS)[number]

export interface Verb extends Record<VerbForm, string> {
	readonly id: number
	readonly level: VerbLevel
	readonly meaning: string
}
