import {describe, expect, it} from 'vitest'
import {describeMistake, describeMistakes} from '../mistakes'
import {createCell} from '../board'
import type {Verb} from '@/types/verb'

const GO: Verb = {
	id: 1,
	present: 'go',
	past: 'went',
	participle: 'gone',
	meaning: 'ir',
	level: 'beginner',
}
const EAT: Verb = {
	id: 2,
	present: 'eat',
	past: 'ate',
	participle: 'eaten',
	meaning: 'comer',
	level: 'beginner',
}
const BE: Verb = {
	id: 3,
	present: 'be',
	past: 'was',
	participle: 'been',
	meaning: 'ser',
	level: 'beginner',
}

const CATALOG = [GO, EAT, BE]

describe('describeMistake', () => {
	it('ordena lo elegido por columna, sea cual sea el orden de pulsación', () => {
		const mistake = describeMistake(
			[createCell(BE, 'participle'), createCell(GO, 'present'), createCell(EAT, 'past')],
			CATALOG,
		)

		expect(mistake?.chosen.map((choice) => choice.text)).toEqual(['go', 'ate', 'been'])
		expect(mistake?.chosen.map((choice) => choice.form)).toEqual(['present', 'past', 'participle'])
	})

	it('devuelve la tríada de cada verbo implicado', () => {
		const mistake = describeMistake(
			[createCell(GO, 'present'), createCell(EAT, 'past'), createCell(BE, 'participle')],
			CATALOG,
		)

		expect(mistake?.triads).toEqual([GO, EAT, BE])
	})

	it('no repite la tríada si dos celdas eran del mismo verbo', () => {
		const mistake = describeMistake(
			[createCell(GO, 'present'), createCell(GO, 'past'), createCell(EAT, 'participle')],
			CATALOG,
		)

		expect(mistake?.triads).toEqual([GO, EAT])
	})

	it('descarta un intento incompleto', () => {
		expect(describeMistake([createCell(GO, 'present')], CATALOG)).toBeNull()
		expect(describeMistake([], CATALOG)).toBeNull()
	})

	it('omite los verbos que no estén en el catálogo, sin fallar', () => {
		const mistake = describeMistake(
			[createCell(GO, 'present'), createCell(EAT, 'past'), createCell(BE, 'participle')],
			[GO],
		)

		expect(mistake?.triads).toEqual([GO])
		expect(mistake?.chosen).toHaveLength(3)
	})
})

describe('describeMistakes', () => {
	it('conserva el orden de los fallos', () => {
		const primero = [
			createCell(GO, 'present'),
			createCell(GO, 'past'),
			createCell(EAT, 'participle'),
		]
		const segundo = [
			createCell(BE, 'present'),
			createCell(BE, 'past'),
			createCell(BE, 'participle'),
		]

		const mistakes = describeMistakes([primero, segundo], CATALOG)

		expect(mistakes.map((mistake) => mistake.chosen[0]?.text)).toEqual(['go', 'be'])
	})

	it('descarta los intentos incompletos en lugar de romper la lista', () => {
		const completo = [
			createCell(GO, 'present'),
			createCell(EAT, 'past'),
			createCell(BE, 'participle'),
		]

		expect(describeMistakes([[createCell(GO, 'present')], completo], CATALOG)).toHaveLength(1)
	})

	it('sin fallos devuelve una lista vacía', () => {
		expect(describeMistakes([], CATALOG)).toEqual([])
	})
})
