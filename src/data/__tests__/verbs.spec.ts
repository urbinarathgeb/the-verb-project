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

	/**
	 * El tope no es una manía de estilo, es estructural: el significado se pinta
	 * en la celda de presente, y **todas las celdas de una fila comparten altura**
	 * entre las tres columnas. Una sola glosa que envuelva a dos líneas engorda la
	 * fila entera, y con ella el tablero, que es lo más ajustado de la app —en
	 * `hard` sobre un iPhone SE ya iba al límite antes de existir este campo.
	 */
	it('mantiene los significados dentro del ancho de una celda', () => {
		const largos = VERBS.filter((verb) => verb.meaning.length > 12).map((verb) => verb.meaning)
		expect(largos).toEqual([])
	})

	/**
	 * Dos celdas de presente con la misma glosa se leen como un error de la app.
	 * Cuando dos verbos comparten sentido hay que matizar uno (`hacer` para `do`,
	 * `fabricar` para `make`), que además es la distinción que cuesta aprender.
	 */
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

	/**
	 * La celda del tablero aplica `text-transform: lowercase`, así que una
	 * mayúscula aquí se perdería ahí y sobreviviría en el repaso de errores y en
	 * la lista de progreso. El catálogo evita esa incoherencia en origen.
	 */
	it('escribe los significados en minúscula', () => {
		const conMayusculas = VERBS.filter((verb) => verb.meaning !== verb.meaning.toLowerCase())
		expect(conMayusculas).toEqual([])
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
