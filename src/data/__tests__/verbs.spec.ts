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

	/**
	 * `easy ⊆ medium` sigue en pie: subir de fácil a medio añade verbos, no los
	 * cambia, así que lo aprendido se sigue practicando.
	 */
	it('el pool de medium incluye entero el de easy', () => {
		const easy = new Set(getVerbsForDifficulty('easy').map((verb) => verb.id))
		const medium = new Set(getVerbsForDifficulty('medium').map((verb) => verb.id))

		expect([...easy].every((id) => medium.has(id))).toBe(true)
		expect(medium.size).toBeGreaterThan(easy.size)
	})

	/**
	 * `hard` **rompe** esa cadena a propósito, y este test lo fija para que nadie
	 * la restaure sin querer: antes servía el catálogo entero y preguntaba `be` y
	 * `go` igual que el nivel fácil, de modo que su dificultad venía sólo del
	 * tamaño del tablero. Ahora es el repertorio que el fácil no enseña.
	 */
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
