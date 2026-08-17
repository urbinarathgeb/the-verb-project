import {describe, expect, it} from 'vitest'
import {formatDuration, formatDurationPrecise, formatPace} from '../format'

const SECOND = 1000
const MINUTE = 60 * SECOND

describe('formatDuration', () => {
	it('rellena los segundos a dos cifras', () => {
		expect(formatDuration(65 * SECOND)).toBe('1:05')
	})

	it('muestra 0:00 en cero', () => {
		expect(formatDuration(0)).toBe('0:00')
	})

	it('formatea minutos completos', () => {
		expect(formatDuration(2 * MINUTE)).toBe('2:00')
	})

	it('formatea el límite de 90 segundos del Modo Objetivo', () => {
		expect(formatDuration(90 * SECOND)).toBe('1:30')
	})

	/**
	 * Redondear hacia abajo mostraría `0:00` con 900 ms aún jugables, que es
	 * desconcertante en una cuenta regresiva.
	 */
	it('redondea hacia arriba: quedan milisegundos, aún no es 0:00', () => {
		expect(formatDuration(1)).toBe('0:01')
		expect(formatDuration(900)).toBe('0:01')
	})

	it('trata un valor negativo como cero', () => {
		expect(formatDuration(-500)).toBe('0:00')
	})

	it('no reinicia el contador pasada la hora', () => {
		expect(formatDuration(75 * MINUTE)).toBe('75:00')
	})
})

describe('formatDurationPrecise', () => {
	it('muestra la décima de segundo', () => {
		expect(formatDurationPrecise(65_400)).toBe('1:05.4')
	})

	it('muestra 0:00.0 en cero', () => {
		expect(formatDurationPrecise(0)).toBe('0:00.0')
	})

	/** Aquí sí se trunca: la décima debe bajar de 9 a 0 al cruzar el segundo. */
	it('trunca en vez de redondear, para que la cuenta baje de forma continua', () => {
		expect(formatDurationPrecise(1999)).toBe('0:01.9')
	})

	it('trata un valor negativo como cero', () => {
		expect(formatDurationPrecise(-100)).toBe('0:00.0')
	})
})

describe('formatPace', () => {
	it('muestra un decimal', () => {
		expect(formatPace(12.5)).toBe('12.5')
	})

	it('añade el decimal a un entero', () => {
		expect(formatPace(10)).toBe('10.0')
	})

	it('redondea a la décima', () => {
		expect(formatPace(12.46)).toBe('12.5')
	})

	it('formatea el ritmo nulo', () => {
		expect(formatPace(0)).toBe('0.0')
	})
})
