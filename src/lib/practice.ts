import {VERB_FORMS, type Verb, type VerbForm} from '@/types/verb'
import {shuffle, type Rng} from './shuffle'

export const OPTIONS_PER_QUESTION = 3

export const FORM_LABELS: Record<VerbForm, string> = {
	present: 'presente',
	past: 'pasado',
	participle: 'participio',
}

export const FORM_PAIRS: readonly {promptForm: VerbForm; requestedForm: VerbForm}[] =
	VERB_FORMS.flatMap((promptForm) =>
		VERB_FORMS.filter((requestedForm) => requestedForm !== promptForm).map((requestedForm) => ({
			promptForm,
			requestedForm,
		})),
	)

export interface PracticeQuestion {
	readonly verbId: number
	readonly promptForm: VerbForm
	readonly prompt: string
	readonly meaning: string
	readonly requestedForm: VerbForm
	readonly correctAnswer: string
	readonly options: readonly string[]
}

export function createQuestion(
	verbs: readonly Verb[],
	rng: Rng = Math.random,
	excludeVerbId?: number,
): PracticeQuestion | null {
	if (verbs.length < OPTIONS_PER_QUESTION) return null

	const candidates = verbs.filter((verb) => verb.id !== excludeVerbId)
	const pool = candidates.length >= OPTIONS_PER_QUESTION ? candidates : verbs

	const [subject] = shuffle(pool, rng)
	if (subject === undefined) return null

	const [pair] = shuffle(FORM_PAIRS, rng)
	if (pair === undefined) return null

	const {promptForm, requestedForm} = pair
	const correctAnswer = subject[requestedForm]

	const distractors = shuffle(
		pool.filter((verb) => verb.id !== subject.id && verb[requestedForm] !== correctAnswer),
		rng,
	).slice(0, OPTIONS_PER_QUESTION - 1)

	if (distractors.length < OPTIONS_PER_QUESTION - 1) return null

	return {
		verbId: subject.id,
		promptForm,
		prompt: subject[promptForm],
		meaning: subject.meaning,
		requestedForm,
		correctAnswer,
		options: shuffle([correctAnswer, ...distractors.map((verb) => verb[requestedForm])], rng),
	}
}

export function isCorrectAnswer(question: PracticeQuestion, answer: string): boolean {
	return answer === question.correctAnswer
}

export function nextStreak(currentStreak: number, isCorrect: boolean): number {
	return isCorrect ? currentStreak + 1 : 0
}

export function formatPrompt(question: PracticeQuestion): string {
	const from = FORM_LABELS[question.promptForm]
	const asked = FORM_LABELS[question.requestedForm]

	return `${question.prompt}, en ${from}. ¿Cuál es el ${asked}?`
}
