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

	it('tiene significado en todos los verbs', () => {
		const sinSignificado = VERBS.filter((verb) => verb.meaning.trim() === '')
		expect(sinSignificado).toEqual([])
	})

	it('mantiene los significados dentro del ancho de una celda', () => {
		const largos = VERBS.filter((verb) => verb.meaning.length > 12).map((verb) => verb.meaning)
		expect(largos).toEqual([])
	})

	it('no repite el mismo significado en dos verbs', () => {
		const vistos = new Map<string, number>()
		const repetidos: string[] = []

		for (const verb of VERBS) {
			const previo = vistos.get(verb.meaning)
			if (previo !== undefined)
				repetidos.push(`"${verb.meaning}" en los verbs ${previo} y ${verb.id}`)
			else vistos.set(verb.meaning, verb.id)
		}

		expect(repetidos).toEqual([])
	})

	it('escribe los significados en minúscula', () => {
		const conMayusculas = VERBS.filter((verb) => verb.meaning !== verb.meaning.toLowerCase())
		expect(conMayusculas).toEqual([])
	})

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

	it.each(DIFFICULTIES)(
		'tiene pool suficiente para el tablero y el objetivo de "%s"',
		(difficulty) => {
			const {boardSize, targetVerbs} = getLevelConfig(difficulty)
			const available = getVerbsForDifficulty(difficulty).length

			expect(available).toBeGreaterThanOrEqual(boardSize)
			expect(available).toBeGreaterThanOrEqual(targetVerbs)
		},
	)

	it('el pool de medium incluye entero el de easy', () => {
		const easy = new Set(getVerbsForDifficulty('easy').map((verb) => verb.id))
		const medium = new Set(getVerbsForDifficulty('medium').map((verb) => verb.id))

		expect([...easy].every((id) => medium.has(id))).toBe(true)
		expect(medium.size).toBeGreaterThan(easy.size)
	})

	it('el pool de hard deja fuera los verbos exclusivos de principiante', () => {
		const easy = new Set(getVerbsForDifficulty('easy').map((verb) => verb.id))
		const hard = getVerbsForDifficulty('hard')

		expect(hard.some((verb) => easy.has(verb.id))).toBe(false)
		expect(hard.every((verb) => verb.level !== 'beginner')).toBe(true)
	})

	it('entre easy y hard cubren el catálogo completo', () => {
		const cubiertos = new Set([
			...getVerbsForDifficulty('easy').map((verb) => verb.id),
			...getVerbsForDifficulty('hard').map((verb) => verb.id),
		])

		expect(cubiertos.size).toBe(VERBS.length)
	})
})
