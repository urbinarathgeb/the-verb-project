import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {effectScope, shallowRef} from 'vue'
import {useTimer} from '../useTimer'

const SECOND = 1000

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

function advance(ms: number): void {
	vi.advanceTimersByTime(ms)
}

describe('useTimer — cronómetro ascendente', () => {
	it('arranca en cero y parado', () => {
		const timer = useTimer()

		expect(timer.elapsedMs.value).toBe(0)
		expect(timer.isRunning.value).toBe(false)
		expect(timer.isExpired.value).toBe(false)
	})

	it('sin límite no expone tiempo restante ni progreso', () => {
		const timer = useTimer()

		expect(timer.remainingMs.value).toBeNull()
		expect(timer.progress.value).toBeNull()
	})

	it('no avanza mientras no se arranca', () => {
		const timer = useTimer()

		advance(5 * SECOND)

		expect(timer.elapsedMs.value).toBe(0)
	})

	it('cuenta hacia adelante desde que arranca', () => {
		const timer = useTimer()
		timer.start()

		advance(3 * SECOND)

		expect(timer.elapsedMs.value).toBe(3 * SECOND)
		expect(timer.isRunning.value).toBe(true)
	})

	it('nunca expira sin límite', () => {
		const timer = useTimer()
		timer.start()

		advance(60 * 60 * SECOND)

		expect(timer.isExpired.value).toBe(false)
		expect(timer.isRunning.value).toBe(true)
	})

	it('el valor mostrado avanza a la granularidad del tick', () => {
		const timer = useTimer()
		timer.start()

		advance(250)

		expect(timer.elapsedMs.value).toBe(200)
	})

	it('un tick más fino da un valor más fino', () => {
		const timer = useTimer({tickMs: 10})
		timer.start()

		advance(250)

		expect(timer.elapsedMs.value).toBe(250)
	})

	it('el valor es exacto al pausar, sin esperar al siguiente tick', () => {
		const timer = useTimer()
		timer.start()

		advance(1234)
		timer.pause()

		expect(timer.elapsedMs.value).toBe(1234)
	})
})

describe('useTimer — cuenta regresiva', () => {
	it('empieza con el límite completo disponible', () => {
		const timer = useTimer({limitMs: 90 * SECOND})

		expect(timer.remainingMs.value).toBe(90 * SECOND)
		expect(timer.progress.value).toBe(0)
	})

	it('descuenta el tiempo transcurrido', () => {
		const timer = useTimer({limitMs: 90 * SECOND})
		timer.start()

		advance(30 * SECOND)

		expect(timer.remainingMs.value).toBe(60 * SECOND)
		expect(timer.progress.value).toBeCloseTo(1 / 3)
	})

	it('expira al agotarse y se detiene', () => {
		const timer = useTimer({limitMs: 10 * SECOND})
		timer.start()

		advance(10 * SECOND)

		expect(timer.isExpired.value).toBe(true)
		expect(timer.isRunning.value).toBe(false)
		expect(timer.remainingMs.value).toBe(0)
	})

	it('invoca `onExpire` al llegar a cero', () => {
		const onExpire = vi.fn()
		const timer = useTimer({limitMs: 5 * SECOND, onExpire})
		timer.start()

		advance(5 * SECOND)

		expect(onExpire).toHaveBeenCalledTimes(1)
	})

	it('no invoca `onExpire` antes de tiempo', () => {
		const onExpire = vi.fn()
		const timer = useTimer({limitMs: 5 * SECOND, onExpire})
		timer.start()

		advance(4.9 * SECOND)

		expect(onExpire).not.toHaveBeenCalled()
	})

	it('invoca `onExpire` una sola vez aunque siga corriendo el reloj', () => {
		const onExpire = vi.fn()
		const timer = useTimer({limitMs: 5 * SECOND, onExpire})
		timer.start()

		advance(60 * SECOND)

		expect(onExpire).toHaveBeenCalledTimes(1)
	})

	it('el tiempo registrado al expirar es exactamente el límite', () => {
		const timer = useTimer({limitMs: 10 * SECOND})
		timer.start()

		advance(10 * SECOND + 350)

		expect(timer.elapsedMs.value).toBe(10 * SECOND)
	})

	it('acota el tiempo aunque el límite no caiga en un tick', () => {
		const timer = useTimer({limitMs: 10 * SECOND + 50})
		timer.start()

		advance(11 * SECOND)

		expect(timer.isExpired.value).toBe(true)
		expect(timer.elapsedMs.value).toBe(10 * SECOND + 50)
		expect(timer.remainingMs.value).toBe(0)
	})

	it('no se puede rearrancar un reloj expirado', () => {
		const timer = useTimer({limitMs: 5 * SECOND})
		timer.start()
		advance(5 * SECOND)

		timer.start()
		advance(SECOND)

		expect(timer.isRunning.value).toBe(false)
		expect(timer.elapsedMs.value).toBe(5 * SECOND)
	})

	it('un límite de cero expira al arrancar', () => {
		const onExpire = vi.fn()
		const timer = useTimer({limitMs: 0, onExpire})

		timer.start()

		expect(timer.isExpired.value).toBe(true)
		expect(onExpire).toHaveBeenCalledTimes(1)
	})
})

describe('useTimer — pausa y reanudación', () => {
	it('`pause` congela el tiempo', () => {
		const timer = useTimer()
		timer.start()
		advance(3 * SECOND)

		timer.pause()
		advance(10 * SECOND)

		expect(timer.elapsedMs.value).toBe(3 * SECOND)
		expect(timer.isRunning.value).toBe(false)
	})

	it('`start` reanuda desde donde se quedó', () => {
		const timer = useTimer()
		timer.start()
		advance(3 * SECOND)
		timer.pause()
		advance(10 * SECOND)

		timer.start()
		advance(2 * SECOND)

		expect(timer.elapsedMs.value).toBe(5 * SECOND)
	})

	it('acumula correctamente varias pausas', () => {
		const timer = useTimer()

		for (let round = 0; round < 3; round++) {
			timer.start()
			advance(SECOND)
			timer.pause()
			advance(5 * SECOND)
		}

		expect(timer.elapsedMs.value).toBe(3 * SECOND)
	})

	it('el tiempo en pausa no consume la cuenta regresiva', () => {
		const timer = useTimer({limitMs: 10 * SECOND})
		timer.start()
		advance(2 * SECOND)
		timer.pause()

		advance(30 * SECOND)

		expect(timer.remainingMs.value).toBe(8 * SECOND)
		expect(timer.isExpired.value).toBe(false)
	})

	it('`pause` sobre un reloj parado no altera nada', () => {
		const timer = useTimer()
		timer.start()
		advance(SECOND)
		timer.pause()

		timer.pause()

		expect(timer.elapsedMs.value).toBe(SECOND)
	})

	it('`start` sobre un reloj en marcha no reinicia el tramo', () => {
		const timer = useTimer()
		timer.start()
		advance(2 * SECOND)

		timer.start()
		advance(SECOND)

		expect(timer.elapsedMs.value).toBe(3 * SECOND)
	})
})

describe('useTimer — reinicio', () => {
	it('`reset` vuelve a cero y detiene el reloj', () => {
		const timer = useTimer()
		timer.start()
		advance(5 * SECOND)

		timer.reset()

		expect(timer.elapsedMs.value).toBe(0)
		expect(timer.isRunning.value).toBe(false)
	})

	it('tras `reset` el reloj no sigue avanzando solo', () => {
		const timer = useTimer()
		timer.start()
		advance(5 * SECOND)

		timer.reset()
		advance(5 * SECOND)

		expect(timer.elapsedMs.value).toBe(0)
	})

	it('`reset` borra las penalizaciones', () => {
		const timer = useTimer({limitMs: 90 * SECOND})
		timer.start()
		timer.penalize(2 * SECOND)

		timer.reset()

		expect(timer.elapsedMs.value).toBe(0)
		expect(timer.remainingMs.value).toBe(90 * SECOND)
	})

	it('`reset` permite volver a jugar tras expirar', () => {
		const timer = useTimer({limitMs: 5 * SECOND})
		timer.start()
		advance(5 * SECOND)

		timer.reset()
		timer.start()
		advance(2 * SECOND)

		expect(timer.isExpired.value).toBe(false)
		expect(timer.elapsedMs.value).toBe(2 * SECOND)
	})
})

describe('useTimer — penalizaciones', () => {
	it('la penalización descuenta del tiempo restante', () => {
		const timer = useTimer({limitMs: 90 * SECOND})
		timer.start()
		advance(10 * SECOND)

		timer.penalize(2 * SECOND)

		expect(timer.remainingMs.value).toBe(78 * SECOND)
	})

	it('la penalización cuenta como tiempo consumido', () => {
		const timer = useTimer()
		timer.start()
		advance(10 * SECOND)

		timer.penalize(2 * SECOND)

		expect(timer.elapsedMs.value).toBe(12 * SECOND)
	})

	it('acumula varias penalizaciones', () => {
		const timer = useTimer({limitMs: 90 * SECOND})
		timer.start()
		advance(10 * SECOND)

		timer.penalize(2 * SECOND)
		timer.penalize(3 * SECOND)

		expect(timer.remainingMs.value).toBe(75 * SECOND)
	})

	it('se puede penalizar con el reloj pausado', () => {
		const timer = useTimer()
		timer.start()
		advance(5 * SECOND)
		timer.pause()

		timer.penalize(2 * SECOND)

		expect(timer.elapsedMs.value).toBe(7 * SECOND)
	})

	it('ignora penalizaciones nulas o negativas', () => {
		const timer = useTimer()
		timer.start()
		advance(5 * SECOND)

		timer.penalize(0)
		timer.penalize(-10 * SECOND)

		expect(timer.elapsedMs.value).toBe(5 * SECOND)
	})

	it('una penalización que agota el límite expira de inmediato', () => {
		const onExpire = vi.fn()
		const timer = useTimer({limitMs: 10 * SECOND, onExpire})
		timer.start()
		advance(9 * SECOND)

		timer.penalize(2 * SECOND)

		expect(timer.isExpired.value).toBe(true)
		expect(timer.isRunning.value).toBe(false)
		expect(onExpire).toHaveBeenCalledTimes(1)
		expect(timer.remainingMs.value).toBe(0)
	})

	it('penalizar después de expirar no vuelve a invocar `onExpire`', () => {
		const onExpire = vi.fn()
		const timer = useTimer({limitMs: 5 * SECOND, onExpire})
		timer.start()
		advance(5 * SECOND)

		timer.penalize(2 * SECOND)

		expect(onExpire).toHaveBeenCalledTimes(1)
	})

	it('sin límite la penalización nunca expira el reloj', () => {
		const timer = useTimer()
		timer.start()

		timer.penalize(60 * 60 * SECOND)

		expect(timer.isExpired.value).toBe(false)
		expect(timer.isRunning.value).toBe(true)
	})
})

describe('useTimer — limpieza', () => {
	it('detiene el intervalo al destruirse el scope', () => {
		const scope = effectScope()
		const timer = scope.run(() => {
			const created = useTimer()
			created.start()
			return created
		})

		expect(vi.getTimerCount()).toBeGreaterThan(0)

		scope.stop()

		expect(vi.getTimerCount()).toBe(0)
		expect(timer).toBeDefined()
	})

	it('funciona fuera de un scope, sin avisos', () => {
		const timer = useTimer()
		timer.start()

		advance(SECOND)

		expect(timer.elapsedMs.value).toBe(SECOND)
	})

	it('no deja intervalos vivos tras pausar', () => {
		const timer = useTimer()
		timer.start()

		timer.pause()

		expect(vi.getTimerCount()).toBe(0)
	})
})

describe('useTimer — límite reactivo', () => {
	it('acepta un `ref` como límite', () => {
		const limit = shallowRef<number | null>(10 * SECOND)
		const timer = useTimer({limitMs: limit})

		expect(timer.remainingMs.value).toBe(10 * SECOND)
	})

	it('recalcula el tiempo restante al cambiar el límite', () => {
		const limit = shallowRef<number | null>(null)
		const timer = useTimer({limitMs: limit})

		expect(timer.remainingMs.value).toBeNull()

		limit.value = 90 * SECOND

		expect(timer.remainingMs.value).toBe(90 * SECOND)
		expect(timer.progress.value).toBe(0)
	})

	it('acepta un getter como límite', () => {
		const timer = useTimer({limitMs: () => 30 * SECOND})
		timer.start()

		advance(10 * SECOND)

		expect(timer.remainingMs.value).toBe(20 * SECOND)
	})

	it('expira según el límite vigente en ese momento', () => {
		const onExpire = vi.fn()
		const limit = shallowRef<number | null>(60 * SECOND)
		const timer = useTimer({limitMs: limit, onExpire})
		timer.start()
		advance(10 * SECOND)

		limit.value = 5 * SECOND
		advance(100)

		expect(timer.isExpired.value).toBe(true)
		expect(onExpire).toHaveBeenCalledTimes(1)
	})
})
