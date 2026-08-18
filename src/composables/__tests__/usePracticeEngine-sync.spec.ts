import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {effectScope} from 'vue'
import {createPinia, setActivePinia} from 'pinia'
import {usePracticeEngine} from '../usePracticeEngine'
import {createSeededRng} from '@/lib/shuffle'
import {useProgressStore} from '@/stores/progress'

/**
 * Cuándo se envía el progreso acumulado. El *qué* se envía se prueba en
 * `stores/__tests__/progress-sync.spec.ts`; aquí sólo interesa el ritmo: agrupar
 * las respuestas seguidas y no perder las últimas al salir.
 */

const SYNC_DELAY_MS = 2000

/**
 * `document` mínimo, lo justo para el listener de visibilidad.
 *
 * Se prefiere a instalar jsdom porque el proyecto no testea componentes
 * (`vitest.config.ts`) y traer un DOM completo para escuchar un evento sería
 * desproporcionado. Además deja contar los listeners, que es como se comprueba
 * que se sueltan al salir.
 */
function createFakeDocument() {
	const listeners = new Map<string, Set<() => void>>()

	return {
		visibilityState: 'visible' as 'visible' | 'hidden',
		addEventListener(type: string, callback: () => void) {
			const set = listeners.get(type) ?? new Set()
			set.add(callback)
			listeners.set(type, set)
		},
		removeEventListener(type: string, callback: () => void) {
			listeners.get(type)?.delete(callback)
		},
		dispatch(type: string) {
			for (const callback of listeners.get(type) ?? []) callback()
		},
		listenerCount(type: string) {
			return listeners.get(type)?.size ?? 0
		},
	}
}

let fakeDocument: ReturnType<typeof createFakeDocument>

beforeEach(() => {
	setActivePinia(createPinia())
	vi.useFakeTimers()
	fakeDocument = createFakeDocument()
	vi.stubGlobal('document', fakeDocument)
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

/**
 * Motor dentro de un `effectScope` propio, para poder simular la salida de la
 * pantalla parándolo. Se espía `syncPending` en lugar de simular Supabase: lo
 * que se comprueba aquí es cuándo se llama, no qué hace.
 */
function setup() {
	const progress = useProgressStore()
	const syncPending = vi.spyOn(progress, 'syncPending').mockResolvedValue('saved')

	const scope = effectScope()
	const engine = scope.run(() =>
		usePracticeEngine({rng: createSeededRng(1), syncDelayMs: SYNC_DELAY_MS}),
	)

	if (engine === undefined) throw new Error('el scope no devolvió el motor')

	engine.start('easy')

	return {engine, scope, syncPending}
}

function answerSomething(engine: ReturnType<typeof setup>['engine']): void {
	engine.answer(engine.question.value?.correctAnswer ?? '')
	engine.next()
}

describe('envío agrupado', () => {
	it('no envía nada inmediatamente al responder', () => {
		const {engine, syncPending} = setup()

		answerSomething(engine)

		expect(syncPending).not.toHaveBeenCalled()
	})

	it('envía cuando pasa el retardo', () => {
		const {engine, syncPending} = setup()

		answerSomething(engine)
		vi.advanceTimersByTime(SYNC_DELAY_MS)

		expect(syncPending).toHaveBeenCalledTimes(1)
	})

	/**
	 * Lo que justifica el retardo: en una ráfaga de respuestas seguidas sale una
	 * sola petición en vez de una por respuesta.
	 */
	it('agrupa una ráfaga de respuestas en un solo envío', () => {
		const {engine, syncPending} = setup()

		for (let i = 0; i < 5; i += 1) {
			answerSomething(engine)
			vi.advanceTimersByTime(SYNC_DELAY_MS / 4)
		}

		expect(syncPending).not.toHaveBeenCalled()

		vi.advanceTimersByTime(SYNC_DELAY_MS)

		expect(syncPending).toHaveBeenCalledTimes(1)
	})

	it('vuelve a enviar tras una pausa entre ráfagas', () => {
		const {engine, syncPending} = setup()

		answerSomething(engine)
		vi.advanceTimersByTime(SYNC_DELAY_MS)
		answerSomething(engine)
		vi.advanceTimersByTime(SYNC_DELAY_MS)

		expect(syncPending).toHaveBeenCalledTimes(2)
	})
})

describe('envío al salir', () => {
	/** Sin esto, las respuestas de los últimos segundos morirían con la pantalla. */
	it('envía lo pendiente al desmontar la pantalla', () => {
		const {engine, scope, syncPending} = setup()

		answerSomething(engine)
		scope.stop()

		expect(syncPending).toHaveBeenCalledTimes(1)
	})

	it('no deja el temporizador vivo tras salir', () => {
		const {engine, scope, syncPending} = setup()

		answerSomething(engine)
		scope.stop()
		vi.advanceTimersByTime(SYNC_DELAY_MS * 3)

		// Un solo envío, el de la salida: el temporizador pendiente se canceló.
		expect(syncPending).toHaveBeenCalledTimes(1)
	})

	/**
	 * `visibilitychange` y no `beforeunload`: en móvil el navegador puede matar la
	 * pestaña sin disparar nunca `beforeunload`, y las últimas respuestas se
	 * perderían.
	 */
	it('envía al pasar la pestaña a segundo plano', () => {
		const {engine, syncPending} = setup()

		answerSomething(engine)
		fakeDocument.visibilityState = 'hidden'
		fakeDocument.dispatch('visibilitychange')

		expect(syncPending).toHaveBeenCalledTimes(1)
	})

	it('no envía al volver a primer plano', () => {
		const {engine, syncPending} = setup()

		answerSomething(engine)
		fakeDocument.visibilityState = 'visible'
		fakeDocument.dispatch('visibilitychange')

		expect(syncPending).not.toHaveBeenCalled()
	})

	/** El listener debe soltarse al salir, o seguiría vivo tras cerrar la pantalla. */
	it('deja de escuchar la visibilidad tras salir', () => {
		const {engine, scope, syncPending} = setup()

		answerSomething(engine)
		expect(fakeDocument.listenerCount('visibilitychange')).toBe(1)

		scope.stop()
		syncPending.mockClear()

		expect(fakeDocument.listenerCount('visibilitychange')).toBe(0)

		fakeDocument.visibilityState = 'hidden'
		fakeDocument.dispatch('visibilitychange')

		expect(syncPending).not.toHaveBeenCalled()
	})
})
