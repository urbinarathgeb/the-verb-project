import {describe, expect, it} from 'vitest'
import {createSeededRng, shuffle, type Rng} from '../shuffle'

/** Genera `[0, 1, ..., size - 1]`, cómodo para comprobar permutaciones. */
function range(size: number): number[] {
	return Array.from({length: size}, (_, index) => index)
}

/** Extrae los primeros `count` valores de un generador. */
function take(rng: Rng, count: number): number[] {
	return range(count).map(() => rng())
}

describe('createSeededRng', () => {
	it('produce valores dentro del rango [0, 1)', () => {
		const values = take(createSeededRng(1), 1000)

		expect(values.every((value) => value >= 0 && value < 1)).toBe(true)
	})

	it('es determinista: la misma semilla produce la misma secuencia', () => {
		expect(take(createSeededRng(12345), 50)).toEqual(take(createSeededRng(12345), 50))
	})

	it('semillas distintas producen secuencias distintas', () => {
		expect(take(createSeededRng(1), 20)).not.toEqual(take(createSeededRng(2), 20))
	})

	it('no se estanca en un valor constante', () => {
		const values = new Set(take(createSeededRng(7), 100))

		expect(values.size).toBeGreaterThan(90)
	})
})

describe('shuffle', () => {
	it('no muta el array original', () => {
		const original = range(10)
		const snapshot = [...original]

		shuffle(original, createSeededRng(42))

		expect(original).toEqual(snapshot)
	})

	it('devuelve un array nuevo, no la misma referencia', () => {
		const original = range(5)

		expect(shuffle(original, createSeededRng(1))).not.toBe(original)
	})

	it('preserva todos los elementos y su cantidad', () => {
		const original = range(30)
		const result = shuffle(original, createSeededRng(99))

		expect(result).toHaveLength(original.length)
		expect([...result].sort((a, b) => a - b)).toEqual(original)
	})

	it('preserva elementos repetidos sin colapsarlos', () => {
		const original = ['a', 'a', 'b', 'b', 'b']
		const result = shuffle(original, createSeededRng(3))

		expect([...result].sort()).toEqual([...original].sort())
	})

	it('es determinista: la misma semilla produce el mismo orden', () => {
		const original = range(20)

		expect(shuffle(original, createSeededRng(2024))).toEqual(
			shuffle(original, createSeededRng(2024)),
		)
	})

	it('semillas distintas producen órdenes distintos', () => {
		const original = range(20)

		expect(shuffle(original, createSeededRng(1))).not.toEqual(shuffle(original, createSeededRng(2)))
	})

	it('acepta un array vacío', () => {
		expect(shuffle([], createSeededRng(1))).toEqual([])
	})

	it('acepta un array de un solo elemento', () => {
		expect(shuffle(['solo'], createSeededRng(1))).toEqual(['solo'])
	})

	/**
	 * El tablero baraja para que la fila no delate la correspondencia entre
	 * columnas (`MECHANICS.md` §1). Con 30 elementos, la probabilidad de que un
	 * barajado uniforme devuelva el orden original es 1/30!, así que en la
	 * práctica esto verifica que el algoritmo realmente reordena.
	 */
	it('reordena de verdad: no devuelve el orden original', () => {
		const original = range(30)

		expect(shuffle(original, createSeededRng(5))).not.toEqual(original)
	})

	/**
	 * Un generador que devuelve siempre 0 extrae siempre el primer elemento
	 * restante, con lo que la salida coincide con la entrada. Sirve para
	 * comprobar que la elección del índice sale del `rng` inyectado y no de
	 * `Math.random`.
	 */
	it('respeta el generador inyectado', () => {
		const alwaysFirst: Rng = () => 0
		const original = range(6)

		expect(shuffle(original, alwaysFirst)).toEqual(original)
	})

	/**
	 * Un generador que devuelva exactamente 1 incumple el contrato de `Rng`, pero
	 * no debe colgar el juego: sin la cota del índice el `splice` no extraería
	 * nada y el bucle sería infinito. Extrae siempre el último elemento, así que
	 * la salida es la entrada invertida.
	 */
	it('termina aunque el generador devuelva el límite superior 1', () => {
		const alwaysLast: Rng = () => 1
		const original = range(6)

		expect(shuffle(original, alwaysLast)).toEqual([...original].reverse())
	})

	/**
	 * No verifica uniformidad estadística —eso requeriría otro tipo de test— sino
	 * que ninguna posición quede sistemáticamente fija, que es el sesgo típico de
	 * una implementación mal escrita de Fisher-Yates.
	 */
	it('mueve cada posición a lo largo de muchas ejecuciones', () => {
		const original = range(8)
		const seenAtIndex = original.map(() => new Set<number>())

		for (let seed = 0; seed < 200; seed++) {
			shuffle(original, createSeededRng(seed)).forEach((value, index) => {
				seenAtIndex[index]?.add(value)
			})
		}

		expect(seenAtIndex.every((values) => values.size === original.length)).toBe(true)
	})
})
