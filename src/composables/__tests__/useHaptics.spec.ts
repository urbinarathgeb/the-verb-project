import {afterEach, describe, expect, it, vi} from 'vitest'
import {useHaptics} from '@/composables/useHaptics'

afterEach(() => {
	vi.unstubAllGlobals()
})

function stubEnvironment({
	hasVibrate,
	reducedMotion,
}: {
	hasVibrate: boolean
	reducedMotion: boolean
}) {
	const vibrate = vi.fn()

	vi.stubGlobal('navigator', hasVibrate ? {vibrate} : {})
	vi.stubGlobal('window', {matchMedia: () => ({matches: reducedMotion})})

	return vibrate
}

describe('disponibilidad', () => {
	it('no vibra si el dispositivo no sabe', () => {
		const vibrate = stubEnvironment({hasVibrate: false, reducedMotion: false})
		const haptics = useHaptics()

		expect(haptics.isAvailable()).toBe(false)

		haptics.signalMatch()
		haptics.signalMistake()

		expect(vibrate).not.toHaveBeenCalled()
	})

	it('no vibra si se ha pedido reducir movimiento', () => {
		const vibrate = stubEnvironment({hasVibrate: true, reducedMotion: true})
		const haptics = useHaptics()

		expect(haptics.isAvailable()).toBe(false)

		haptics.signalMatch()

		expect(vibrate).not.toHaveBeenCalled()
	})

	it('deja de vibrar en cuanto cambia la preferencia', () => {
		const vibrate = vi.fn()
		let reduced = false

		vi.stubGlobal('navigator', {vibrate})
		vi.stubGlobal('window', {matchMedia: () => ({matches: reduced})})

		const haptics = useHaptics()

		haptics.signalMatch()
		expect(vibrate).toHaveBeenCalledTimes(1)

		reduced = true
		haptics.signalMatch()

		expect(vibrate).toHaveBeenCalledTimes(1)
	})
})

describe('patrones', () => {
	it('el acierto es un toque seco', () => {
		const vibrate = stubEnvironment({hasVibrate: true, reducedMotion: false})

		useHaptics().signalMatch()

		expect(vibrate).toHaveBeenCalledWith(18)
	})

	it('el fallo son dos toques', () => {
		const vibrate = stubEnvironment({hasVibrate: true, reducedMotion: false})

		useHaptics().signalMistake()

		const pattern: unknown = vibrate.mock.calls[0]?.[0]

		expect(Array.isArray(pattern)).toBe(true)

		const pulses = (pattern as number[]).filter((_ms, index) => index % 2 === 0)

		expect(pulses).toHaveLength(2)
		expect(pulses.every((ms) => ms > 0)).toBe(true)
	})
})
