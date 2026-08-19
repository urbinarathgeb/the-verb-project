/**
 * Lógica del Dojo (`MECHANICS.md` §4).
 *
 * No usa el tablero de tres columnas: muestra una forma verbal y pide otra, con
 * tres alternativas. Es el modo de aprendizaje relajado, sin cronómetro y sin
 * ranking; su refuerzo es la racha.
 *
 * Todo aquí es puro y testeable sin Vue, igual que `lib/board.ts`.
 */

import {VERB_FORMS, type Verb, type VerbForm} from '@/types/verb'
import {shuffle, type Rng} from './shuffle'

/** Opciones que se ofrecen por pregunta: una correcta y dos distractores. */
export const OPTIONS_PER_QUESTION = 3

/** Etiqueta en español de cada forma verbal, para el enunciado. */
export const FORM_LABELS: Record<VerbForm, string> = {
	present: 'presente',
	past: 'pasado',
	participle: 'participio',
}

/**
 * Las seis combinaciones de (forma mostrada → forma preguntada).
 *
 * Cualquiera de las tres formas puede aparecer en el enunciado y cualquiera de
 * las otras dos como pregunta: presente → pasado, participio → pasado,
 * pasado → presente, y así con todas. Practicar sólo desde el presente dejaría
 * sin ejercitar precisamente los saltos que más cuestan, como reconocer un
 * participio y recuperar su pasado.
 */
export const FORM_PAIRS: readonly {promptForm: VerbForm; requestedForm: VerbForm}[] =
	VERB_FORMS.flatMap((promptForm) =>
		VERB_FORMS.filter((requestedForm) => requestedForm !== promptForm).map((requestedForm) => ({
			promptForm,
			requestedForm,
		})),
	)

export interface PracticeQuestion {
	readonly verbId: number
	/** Forma que se muestra en el enunciado. */
	readonly promptForm: VerbForm
	/** Texto de la forma mostrada. */
	readonly prompt: string
	/** Forma por la que se pregunta. Siempre distinta de `promptForm`. */
	readonly requestedForm: VerbForm
	readonly correctAnswer: string
	/** Las tres alternativas ya barajadas. Incluye siempre `correctAnswer`. */
	readonly options: readonly string[]
}

/**
 * Construye una pregunta a partir del pool de verbos.
 *
 * Los distractores se toman de **la misma forma en otros verbos** del pool
 * (`MECHANICS.md` §4). Sacarlos de otra forma delataría la respuesta: si se pide
 * un participio y dos opciones son claramente presentes, el jugador acierta sin
 * saber el verbo.
 *
 * Devuelve `null` si el pool no da para una pregunta con alternativas reales.
 * Los niveles garantizan pools muy por encima del mínimo, así que en la práctica
 * no ocurre; devolver `null` evita inventar una pregunta degenerada.
 *
 * @param excludeVerbId Verbo de la pregunta anterior, para no repetirla seguida.
 */
export function createQuestion(
	verbs: readonly Verb[],
	rng: Rng = Math.random,
	excludeVerbId?: number,
): PracticeQuestion | null {
	if (verbs.length < OPTIONS_PER_QUESTION) return null

	// Se evita repetir el verbo anterior, salvo que no quede alternativa.
	const candidates = verbs.filter((verb) => verb.id !== excludeVerbId)
	const pool = candidates.length >= OPTIONS_PER_QUESTION ? candidates : verbs

	const [subject] = shuffle(pool, rng)
	if (subject === undefined) return null

	const [pair] = shuffle(FORM_PAIRS, rng)
	if (pair === undefined) return null

	const {promptForm, requestedForm} = pair
	const correctAnswer = subject[requestedForm]

	/*
	 * El filtro descarta por **texto** y no sólo por id. El catálogo ya garantiza
	 * que no hay formas repetidas dentro de una misma columna —hay un test que lo
	 * vigila—, pero apoyarse en eso convertiría un detalle del catálogo en un
	 * requisito del motor: dos opciones idénticas harían la pregunta irresoluble.
	 */
	const distractors = shuffle(
		pool.filter((verb) => verb.id !== subject.id && verb[requestedForm] !== correctAnswer),
		rng,
	).slice(0, OPTIONS_PER_QUESTION - 1)

	if (distractors.length < OPTIONS_PER_QUESTION - 1) return null

	return {
		verbId: subject.id,
		promptForm,
		prompt: subject[promptForm],
		requestedForm,
		correctAnswer,
		options: shuffle([correctAnswer, ...distractors.map((verb) => verb[requestedForm])], rng),
	}
}

/** ¿Es correcta la respuesta elegida? Comparación exacta contra la forma pedida. */
export function isCorrectAnswer(question: PracticeQuestion, answer: string): boolean {
	return answer === question.correctAnswer
}

/**
 * Racha tras responder.
 *
 * Un acierto la incrementa y un error la deja a cero (`MECHANICS.md` §4). El
 * reinicio total, y no un decremento, es lo que hace de la racha un refuerzo: su
 * valor está en sostenerla, no en acumular puntos.
 */
export function nextStreak(currentStreak: number, isCorrect: boolean): number {
	return isCorrect ? currentStreak + 1 : 0
}

/**
 * Enunciado completo, por ejemplo `spoke (pasado) → participio`.
 *
 * **La forma mostrada se etiqueta siempre**, y no es un adorno: hay verbos cuyo
 * texto coincide entre formas (`read` en presente y en pasado, `cut` en las
 * tres). Sin la etiqueta, el jugador no sabría desde dónde se le pregunta y la
 * pregunta sería irresoluble.
 */
export function formatPrompt(question: PracticeQuestion): string {
	return `${question.prompt} (${FORM_LABELS[question.promptForm]}) → ${FORM_LABELS[question.requestedForm]}`
}
