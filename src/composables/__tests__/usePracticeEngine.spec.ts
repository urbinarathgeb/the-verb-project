import {beforeEach, describe, expect, it} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {usePracticeEngine} from '../usePracticeEngine'
import {createSeededRng} from '@/lib/shuffle'
import {useProgressStore} from '@/stores/progress'
import {MASTERY_MIN_CORRECT} from '@/data/levels'

beforeEach(() => {
	setActivePinia(createPinia())
})

/** Motor con semilla fija y sesión ya empezada. */
function engineStarted(seed = 1) {
	const engine = usePracticeEngine({rng: createSeededRng(seed)})
	engine.start('easy')
	return engine
}

type Engine = ReturnType<typeof usePracticeEngine>

/** Responde correctamente la pregunta actual. */
function answerCorrectly(engine: Engine): void {
	engine.answer(engine.question.value?.correctAnswer ?? '')
}

/** Responde con un distractor. */
function answerWrong(engine: Engine): void {
	const question = engine.question.value
	const wrong = question?.options.find((option) => option !== question.correctAnswer) ?? ''
	engine.answer(wrong)
}

describe('usePracticeEngine — sesión', () => {
	it('empieza sin pregunta hasta que se arranca', () => {
		const engine = usePracticeEngine({rng: createSeededRng(1)})

		expect(engine.question.value).toBeNull()
		expect(engine.promptLabel.value).toBe('')
	})

	it('`start` reparte la primera pregunta', () => {
		const engine = engineStarted()

		expect(engine.question.value).not.toBeNull()
		expect(engine.question.value?.options).toHaveLength(3)
		expect(engine.isAnswered.value).toBe(false)
	})

	it('el enunciado indica la forma de partida y la pedida', () => {
		const engine = engineStarted()
		const question = engine.question.value

		expect(engine.promptLabel.value).toContain(question?.prompt ?? '')
		expect(engine.promptLabel.value).toContain('¿Cuál es el')
	})

	it('no hay cronómetro: nada que iniciar ni detener', () => {
		const engine = engineStarted()

		expect(Object.keys(engine)).not.toContain('elapsedMs')
		expect(Object.keys(engine)).not.toContain('remainingMs')
	})

	it('`start` reinicia los contadores de una sesión anterior', () => {
		const engine = engineStarted()
		answerCorrectly(engine)
		engine.next()
		answerCorrectly(engine)

		engine.start('medium')

		expect(engine.answeredCount.value).toBe(0)
		expect(engine.correctCount.value).toBe(0)
		expect(engine.streak.value).toBe(0)
		expect(engine.bestStreak.value).toBe(0)
	})
})

describe('usePracticeEngine — responder', () => {
	it('un acierto se marca como correcto', () => {
		const engine = engineStarted()

		const wasCorrect = engine.answer(engine.question.value?.correctAnswer ?? '')

		expect(wasCorrect).toBe(true)
		expect(engine.isAnswered.value).toBe(true)
		expect(engine.isLastAnswerCorrect.value).toBe(true)
		expect(engine.correctCount.value).toBe(1)
	})

	it('un fallo se marca como incorrecto', () => {
		const engine = engineStarted()

		answerWrong(engine)

		expect(engine.isLastAnswerCorrect.value).toBe(false)
		expect(engine.correctCount.value).toBe(0)
		expect(engine.answeredCount.value).toBe(1)
	})

	it('recuerda la opción elegida, para poder resaltarla', () => {
		const engine = engineStarted()
		const chosen = engine.question.value?.options[1] ?? ''

		engine.answer(chosen)

		expect(engine.selectedAnswer.value).toBe(chosen)
	})

	/** Responder dos veces la misma pregunta falsearía la racha y el progreso. */
	it('ignora una segunda respuesta a la misma pregunta', () => {
		const engine = engineStarted()
		answerCorrectly(engine)

		const second = engine.answer(engine.question.value?.correctAnswer ?? '')

		expect(second).toBe(false)
		expect(engine.answeredCount.value).toBe(1)
	})

	it('no se puede responder antes de empezar', () => {
		const engine = usePracticeEngine({rng: createSeededRng(1)})

		expect(engine.answer('lo que sea')).toBe(false)
	})
})

describe('usePracticeEngine — racha', () => {
	it('sube con cada acierto', () => {
		const engine = engineStarted()

		for (let i = 0; i < 3; i++) {
			answerCorrectly(engine)
			engine.next()
		}

		expect(engine.streak.value).toBe(3)
	})

	/** El reinicio total es lo que hace de la racha un refuerzo (`MECHANICS.md` §4). */
	it('un fallo la deja a cero', () => {
		const engine = engineStarted()
		answerCorrectly(engine)
		engine.next()
		answerCorrectly(engine)
		engine.next()

		answerWrong(engine)

		expect(engine.streak.value).toBe(0)
	})

	it('conserva la mejor racha de la sesión', () => {
		const engine = engineStarted()
		for (let i = 0; i < 4; i++) {
			answerCorrectly(engine)
			engine.next()
		}

		answerWrong(engine)

		expect(engine.streak.value).toBe(0)
		expect(engine.bestStreak.value).toBe(4)
	})
})

describe('usePracticeEngine — avanzar', () => {
	it('`next` reparte otra pregunta y limpia el feedback', () => {
		const engine = engineStarted()
		answerCorrectly(engine)

		engine.next()

		expect(engine.isAnswered.value).toBe(false)
		expect(engine.selectedAnswer.value).toBeNull()
		expect(engine.isLastAnswerCorrect.value).toBeNull()
	})

	/**
	 * Saltar preguntas sin contestar dejaría escapar justo los verbos que el
	 * jugador no sabe, que son los que debe practicar.
	 */
	it('no avanza si aún no se ha respondido', () => {
		const engine = engineStarted()
		const first = engine.question.value

		engine.next()

		expect(engine.question.value).toBe(first)
	})

	/**
	 * Con 49 verbos en el pool, unas pocas iteraciones no prueban nada: el azar
	 * casi nunca repite por sí solo. Sobre 200 preguntas, en cambio, sin excluir el
	 * verbo anterior cabría esperar unas cuatro repeticiones, así que exigir cero
	 * sí detecta que la exclusión falta. La semilla es fija, de modo que el test es
	 * reproducible y no depende de la suerte de cada ejecución.
	 */
	it('no repite el verbo de la pregunta anterior', () => {
		const engine = engineStarted()
		const repeats: number[] = []

		for (let i = 0; i < 200; i++) {
			const previous = engine.question.value?.verbId
			answerCorrectly(engine)
			engine.next()
			const current = engine.question.value?.verbId
			if (current !== undefined && current === previous) repeats.push(current)
		}

		expect(repeats).toEqual([])
	})
})

describe('usePracticeEngine — progreso', () => {
	it('registra cada respuesta en el store de progreso', () => {
		const engine = engineStarted()
		const store = useProgressStore()
		const verbId = engine.question.value?.verbId ?? 0

		answerCorrectly(engine)

		expect(store.progressFor(verbId).correct).toBe(1)
	})

	it('registra también los fallos', () => {
		const engine = engineStarted()
		const store = useProgressStore()
		const verbId = engine.question.value?.verbId ?? 0

		answerWrong(engine)

		expect(store.progressFor(verbId).wrong).toBe(1)
	})

	/** El progreso es global: sobrevive al final de la sesión de práctica. */
	it('el progreso sobrevive a un `start` nuevo', () => {
		const engine = engineStarted()
		const store = useProgressStore()
		answerCorrectly(engine)

		engine.start('easy')

		expect(store.totalCorrect).toBe(1)
	})

	it('expone cuántos verbos hay dominados', () => {
		const engine = engineStarted()
		const store = useProgressStore()

		expect(engine.masteredCount.value).toBe(0)

		const verbId = engine.question.value?.verbId ?? 0
		for (let i = 0; i < MASTERY_MIN_CORRECT; i++) store.recordAnswer(verbId, true)

		expect(engine.masteredCount.value).toBe(1)
	})
})
