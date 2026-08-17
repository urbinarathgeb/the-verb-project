import {describe, expect, it} from 'vitest'
import {
	FORM_LABELS,
	FORM_PAIRS,
	OPTIONS_PER_QUESTION,
	createQuestion,
	formatPrompt,
	isCorrectAnswer,
	nextStreak,
} from '../practice'
import {createSeededRng} from '../shuffle'
import {getVerbsForDifficulty} from '@/data/verbs'
import {VERB_FORMS, type Verb} from '@/types/verb'

function makeVerb(id: number): Verb {
	return {
		id,
		level: 'beginner',
		present: `present-${id}`,
		past: `past-${id}`,
		participle: `participle-${id}`,
	}
}

function makeVerbs(count: number): Verb[] {
	return Array.from({length: count}, (_, index) => makeVerb(index + 1))
}

/** Una pregunta con semilla fija, para los casos que no dependen del azar. */
function question(seed = 1, verbs = makeVerbs(20)) {
	const result = createQuestion(verbs, createSeededRng(seed))
	if (result === null) throw new Error('No se pudo construir la pregunta')
	return result
}

describe('createQuestion — forma de la pregunta', () => {
	it('ofrece exactamente tres alternativas', () => {
		expect(question().options).toHaveLength(OPTIONS_PER_QUESTION)
	})

	it('incluye la respuesta correcta entre las alternativas', () => {
		const q = question()

		expect(q.options).toContain(q.correctAnswer)
	})

	it('el enunciado muestra la forma indicada por `promptForm`', () => {
		const verbs = makeVerbs(20)
		const q = question(3, verbs)
		const subject = verbs.find((verb) => verb.id === q.verbId)

		expect(q.prompt).toBe(subject?.[q.promptForm])
	})

	it('la respuesta correcta es la forma pedida de ese verbo', () => {
		const verbs = makeVerbs(20)
		const q = question(5, verbs)
		const subject = verbs.find((verb) => verb.id === q.verbId)

		expect(q.correctAnswer).toBe(subject?.[q.requestedForm])
	})

	/** Preguntar por la forma que ya está a la vista sería trivial. */
	it('nunca pide la forma que ya muestra el enunciado', () => {
		for (let seed = 0; seed < 200; seed++) {
			const q = question(seed)
			expect(q.requestedForm).not.toBe(q.promptForm)
		}
	})
})

describe('createQuestion — distractores', () => {
	/**
	 * Ésta es la invariante crítica del modo: dos opciones con el mismo texto
	 * harían la pregunta irresoluble, porque el jugador podría elegir la
	 * "correcta" y ser marcado como error.
	 */
	it('nunca repite una alternativa', () => {
		for (let seed = 0; seed < 200; seed++) {
			const q = question(seed)
			expect(new Set(q.options).size).toBe(OPTIONS_PER_QUESTION)
		}
	})

	it('ningún distractor coincide con la respuesta correcta', () => {
		for (let seed = 0; seed < 200; seed++) {
			const q = question(seed)
			const distractors = q.options.filter((option) => option !== q.correctAnswer)
			expect(distractors).toHaveLength(OPTIONS_PER_QUESTION - 1)
		}
	})

	/**
	 * Los distractores salen de la misma forma en otros verbos. Si vinieran de
	 * otra forma, el jugador acertaría por descarte sin saber el verbo.
	 */
	it('los distractores son de la misma forma que la pedida', () => {
		const verbs = makeVerbs(20)

		for (let seed = 0; seed < 60; seed++) {
			const q = createQuestion(verbs, createSeededRng(seed))
			if (q === null) continue

			const valid = verbs.map((verb) => verb[q.requestedForm])
			expect(q.options.every((option) => valid.includes(option))).toBe(true)
		}
	})

	it('los distractores pertenecen a verbos distintos del preguntado', () => {
		const verbs = makeVerbs(20)
		const q = question(11, verbs)
		const subject = verbs.find((verb) => verb.id === q.verbId)
		const otherForms = VERB_FORMS.filter((form) => form !== q.requestedForm)

		// Ninguna alternativa debe ser otra forma del propio verbo preguntado.
		const ownOtherForms = otherForms.map((form) => subject?.[form])
		expect(q.options.some((option) => ownOtherForms.includes(option))).toBe(false)
	})
})

describe('createQuestion — variedad', () => {
	/**
	 * Cualquiera de las tres formas puede aparecer en el enunciado y cualquiera de
	 * las otras dos como pregunta. Practicar sólo desde el presente dejaría sin
	 * ejercitar los saltos que más cuestan, como participio → pasado.
	 */
	it('las seis combinaciones de formas aparecen a lo largo de muchas preguntas', () => {
		const pairs = new Set(
			Array.from({length: 400}, (_, seed) => {
				const q = question(seed)
				return `${q.promptForm}->${q.requestedForm}`
			}),
		)

		expect(pairs.size).toBe(FORM_PAIRS.length)
		expect(FORM_PAIRS).toHaveLength(6)
	})

	it('las tres formas aparecen como enunciado', () => {
		const forms = new Set(Array.from({length: 200}, (_, seed) => question(seed).promptForm))

		expect(forms).toEqual(new Set(VERB_FORMS))
	})

	it('las tres formas aparecen como pregunta', () => {
		const forms = new Set(Array.from({length: 200}, (_, seed) => question(seed).requestedForm))

		expect(forms).toEqual(new Set(VERB_FORMS))
	})

	it('no pregunta siempre por el mismo verbo', () => {
		const ids = new Set(Array.from({length: 60}, (_, seed) => question(seed).verbId))

		expect(ids.size).toBeGreaterThan(5)
	})

	it('es determinista con la misma semilla', () => {
		expect(question(42)).toEqual(question(42))
	})

	/** Evita que dos preguntas seguidas sean idénticas, que se percibe como fallo. */
	it('no repite el verbo excluido', () => {
		const verbs = makeVerbs(20)

		for (let seed = 0; seed < 60; seed++) {
			const previous = question(seed, verbs)
			const next = createQuestion(verbs, createSeededRng(seed + 1000), previous.verbId)
			expect(next?.verbId).not.toBe(previous.verbId)
		}
	})

	/** Con el pool en el mínimo no hay alternativa: repetir es mejor que no preguntar. */
	it('ignora la exclusión si el pool no da para otra cosa', () => {
		const verbs = makeVerbs(3)
		const q = createQuestion(verbs, createSeededRng(1), verbs[0]?.id)

		expect(q).not.toBeNull()
	})
})

describe('createQuestion — casos límite', () => {
	it('devuelve null con un pool vacío', () => {
		expect(createQuestion([], createSeededRng(1))).toBeNull()
	})

	it('devuelve null si no hay verbos suficientes para tres opciones', () => {
		expect(createQuestion(makeVerbs(2), createSeededRng(1))).toBeNull()
	})

	it('funciona con el pool mínimo de tres verbos', () => {
		const q = createQuestion(makeVerbs(3), createSeededRng(1))

		expect(q?.options).toHaveLength(OPTIONS_PER_QUESTION)
	})

	/**
	 * Si todos los verbos compartieran la forma pedida, no habría distractores
	 * válidos. No pasa con el catálogo real, pero el motor no debe inventarse una
	 * pregunta con opciones repetidas.
	 */
	it('devuelve null si no existen distractores distintos', () => {
		const clones: Verb[] = [1, 2, 3, 4].map((id) => ({
			id,
			level: 'beginner',
			present: `present-${id}`,
			past: 'igual',
			participle: 'igual',
		}))

		expect(createQuestion(clones, createSeededRng(1))).toBeNull()
	})
})

describe('createQuestion — catálogo real', () => {
	it('genera preguntas válidas con los verbos del nivel fácil', () => {
		const verbs = getVerbsForDifficulty('easy')

		for (let seed = 0; seed < 100; seed++) {
			const q = createQuestion(verbs, createSeededRng(seed))

			expect(q).not.toBeNull()
			expect(new Set(q?.options).size).toBe(OPTIONS_PER_QUESTION)
			expect(q?.options).toContain(q?.correctAnswer)
		}
	})
})

describe('isCorrectAnswer', () => {
	it('acepta la respuesta correcta', () => {
		const q = question()

		expect(isCorrectAnswer(q, q.correctAnswer)).toBe(true)
	})

	it('rechaza un distractor', () => {
		const q = question()
		const distractor = q.options.find((option) => option !== q.correctAnswer) ?? ''

		expect(isCorrectAnswer(q, distractor)).toBe(false)
	})

	it('rechaza una respuesta que no está entre las opciones', () => {
		expect(isCorrectAnswer(question(), 'cualquier-cosa')).toBe(false)
	})
})

describe('nextStreak', () => {
	it('incrementa con un acierto', () => {
		expect(nextStreak(4, true)).toBe(5)
	})

	it('empieza a contar desde cero', () => {
		expect(nextStreak(0, true)).toBe(1)
	})

	/** El reinicio total es lo que hace de la racha un refuerzo (`MECHANICS.md` §4). */
	it('un error la deja a cero, no la decrementa', () => {
		expect(nextStreak(9, false)).toBe(0)
	})

	it('un error sobre racha cero la mantiene en cero', () => {
		expect(nextStreak(0, false)).toBe(0)
	})

	it('acumula a lo largo de una secuencia de respuestas', () => {
		const answers = [true, true, true, false, true, true]
		const streak = answers.reduce((current, correct) => nextStreak(current, correct), 0)

		expect(streak).toBe(2)
	})
})

describe('formatPrompt', () => {
	it('usa la forma `verbo (forma mostrada) → forma pedida`', () => {
		const q = question()

		expect(formatPrompt(q)).toBe(
			`${q.prompt} (${FORM_LABELS[q.promptForm]}) → ${FORM_LABELS[q.requestedForm]}`,
		)
	})

	/**
	 * Etiquetar la forma mostrada no es adorno: `read` se escribe igual en presente
	 * y en pasado, y `cut` en las tres. Sin la etiqueta, el jugador no sabría desde
	 * dónde se le pregunta y la pregunta sería irresoluble.
	 */
	it('indica siempre de qué forma parte el enunciado', () => {
		for (let seed = 0; seed < 20; seed++) {
			const q = question(seed)
			expect(formatPrompt(q)).toContain(`(${FORM_LABELS[q.promptForm]})`)
		}
	})

	it('traduce las tres formas al español', () => {
		expect(FORM_LABELS.present).toBe('presente')
		expect(FORM_LABELS.past).toBe('pasado')
		expect(FORM_LABELS.participle).toBe('participio')
	})
})
