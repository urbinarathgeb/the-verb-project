/**
 * Barajado con fuente de aleatoriedad inyectable.
 *
 * El tablero baraja cada columna de forma independiente (T1.2) y repone tríadas
 * en posiciones barajadas (T1.3). Que el generador sea un parámetro y no
 * `Math.random` cableado es lo que permite que esos tests sean deterministas:
 * se inyecta una semilla y la salida es siempre la misma.
 */

/** Devuelve un número en el rango `[0, 1)`, igual que `Math.random`. */
export type Rng = () => number

/**
 * Generador pseudoaleatorio con semilla (mulberry32).
 *
 * No es criptográficamente seguro y no pretende serlo: su único propósito es
 * producir secuencias reproducibles en los tests. La distribución es lo
 * bastante uniforme para barajar un tablero.
 */
export function createSeededRng(seed: number): Rng {
	// `>>> 0` fuerza el estado a entero sin signo de 32 bits, que es la
	// aritmética sobre la que está definido el algoritmo.
	let state = seed >>> 0

	return () => {
		state = (state + 0x6d2b79f5) >>> 0
		let value = state
		value = Math.imul(value ^ (value >>> 15), value | 1)
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296
	}
}

/**
 * Devuelve una copia barajada de `items`. Nunca muta la entrada: el catálogo de
 * verbos es una constante compartida y barajarlo in situ corrompería el pool
 * para el resto de la sesión.
 *
 * Usa la formulación por extracción de Fisher-Yates (se va sacando un elemento
 * al azar del pool restante) en lugar de la variante in situ de Durstenfeld.
 * Ambas producen la misma distribución uniforme; la de extracción es O(n²) por
 * los `splice`, coste irrelevante aquí porque el pool máximo es de 106 verbos, y
 * en cambio evita indexar el array por posición, que con
 * `noUncheckedIndexedAccess` obligaría a aserciones de tipo.
 */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
	const remaining = [...items]
	const shuffled: T[] = []

	while (remaining.length > 0) {
		// El `min` acota el índice por si un generador incumple el contrato y
		// devuelve exactamente 1: sin él, el `splice` no extraería nada y el bucle
		// no terminaría nunca.
		const index = Math.min(Math.floor(rng() * remaining.length), remaining.length - 1)
		shuffled.push(...remaining.splice(index, 1))
	}

	return shuffled
}
