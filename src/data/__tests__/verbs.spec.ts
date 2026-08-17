import {describe, expect, it} from 'vitest'
import {VERBS, getVerbsForDifficulty} from '../verbs'
import {DIFFICULTIES} from '@/types/game'
import {VERB_FORMS, VERB_LEVELS} from '@/types/verb'
import {getLevelConfig} from '../levels'

describe('integridad del catálogo de verbs', () => {
	it('no está vacío', () => {
		expect(VERBS.length).toBeGreaterThan(0)
	})

	it('no tiene ids duplicados', () => {
		const ids = VERBS.map((verb) => verb.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	it('tiene las tres formas no vacías en todos los verbs', () => {
		const incomplete = VERBS.filter((verb) => VERB_FORMS.some((form) => verb[form].trim() === ''))
		expect(incomplete).toEqual([])
	})

	it('usa solo niveles válidos', () => {
		const invalid = VERBS.filter((verb) => !VERB_LEVELS.includes(verb.level))
		expect(invalid).toEqual([])
	})

	/**
	 * Ésta es la invariante crítica del tablero: si dos verbs comparten la misma
	 * cadena dentro de una misma columna, se renderizan dos celdas visualmente
	 * idénticas. El jugador no podría distinguirlas y una jugada correcta se
	 * marcaría como error. Hoy el catálogo cumple; el test protege futuras
	 * incorporaciones.
	 */
	it.each(VERB_FORMS)('no tiene formas repetidas dentro de la columna "%s"', (form) => {
		const seen = new Map<string, number>()
		const collisions: string[] = []

		for (const verb of VERBS) {
			const text = verb[form]
			const previous = seen.get(text)
			if (previous !== undefined) {
				collisions.push(`"${text}" en los verbs ${previous} y ${verb.id}`)
			} else {
				seen.set(text, verb.id)
			}
		}

		expect(collisions).toEqual([])
	})
})

describe('getVerbsForDifficulty', () => {
	it.each(DIFFICULTIES)('devuelve solo verbs del pool declarado para "%s"', (difficulty) => {
		const {verbLevels} = getLevelConfig(difficulty)
		const verbs = getVerbsForDifficulty(difficulty)

		expect(verbs.length).toBeGreaterThan(0)
		expect(verbs.every((verb) => verbLevels.includes(verb.level))).toBe(true)
	})

	/**
	 * Sin verbs suficientes no se puede ni siquiera montar el tablero inicial,
	 * y el Modo Objetivo sería imposible de ganar.
	 */
	it.each(DIFFICULTIES)(
		'tiene pool suficiente para el tablero y el objetivo de "%s"',
		(difficulty) => {
			const {boardSize, targetVerbs} = getLevelConfig(difficulty)
			const available = getVerbsForDifficulty(difficulty).length

			expect(available).toBeGreaterThanOrEqual(boardSize)
			expect(available).toBeGreaterThanOrEqual(targetVerbs)
		},
	)

	it('el pool de hard incluye el catálogo completo', () => {
		expect(getVerbsForDifficulty('hard').length).toBe(VERBS.length)
	})

	it('los pools son acumulativos: easy ⊆ medium ⊆ hard', () => {
		const ids = (difficulty: 'easy' | 'medium' | 'hard') =>
			new Set(getVerbsForDifficulty(difficulty).map((verb) => verb.id))

		const easy = ids('easy')
		const medium = ids('medium')
		const hard = ids('hard')

		expect([...easy].every((id) => medium.has(id))).toBe(true)
		expect([...medium].every((id) => hard.has(id))).toBe(true)
	})
})
