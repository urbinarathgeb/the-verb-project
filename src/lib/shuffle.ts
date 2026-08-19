export type Rng = () => number

export function createSeededRng(seed: number): Rng {
	let state = seed >>> 0

	return () => {
		state = (state + 0x6d2b79f5) >>> 0
		let value = state
		value = Math.imul(value ^ (value >>> 15), value | 1)
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296
	}
}

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
	const remaining = [...items]
	const shuffled: T[] = []

	while (remaining.length > 0) {
		const index = Math.min(Math.floor(rng() * remaining.length), remaining.length - 1)
		shuffled.push(...remaining.splice(index, 1))
	}

	return shuffled
}
