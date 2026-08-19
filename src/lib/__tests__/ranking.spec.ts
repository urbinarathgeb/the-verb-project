import {describe, expect, it} from 'vitest'
import {
	bestMetricAfter,
	calculatePace,
	compareWithPersonalBest,
	isBetterMetric,
	isEligibleForRanking,
	isPersistable,
	rankingMetric,
	toRankingEntries,
	type RankingRow,
} from '../ranking'
import {FALLBACK_DISPLAY_NAME} from '@/lib/auth'
import {MIN_MATCHES_FOR_RANKING} from '@/data/levels'
import type {FinishedStatus, GameMode, SessionResult} from '@/types/game'

const SECOND = 1000

function makeResult(overrides: Partial<SessionResult> = {}): SessionResult {
	return {
		mode: 'precision',
		difficulty: 'easy',
		status: 'lost',
		timeMs: 60 * SECOND,
		errors: 0,
		verbsMatched: 10,
		completedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	}
}

describe('calculatePace', () => {
	it('10 aciertos en un minuto son 10 verbos por minuto', () => {
		expect(calculatePace(10, 60 * SECOND)).toBe(10)
	})

	it('los mismos aciertos en medio minuto duplican el ritmo', () => {
		expect(calculatePace(10, 30 * SECOND)).toBe(20)
	})

	it('el doble de aciertos en el mismo tiempo duplica el ritmo', () => {
		expect(calculatePace(20, 60 * SECOND)).toBe(20)
	})

	/**
	 * La fórmula combina ambas variables para que no compense tomárselo con calma:
	 * más aciertos en más tiempo puede dar peor ritmo (`MECHANICS.md` §3).
	 */
	it('acertar más pero mucho más lento empeora el ritmo', () => {
		const rapido = calculatePace(10, 30 * SECOND)
		const lento = calculatePace(12, 90 * SECOND)

		expect(lento).toBeLessThan(rapido)
	})

	it('sin aciertos el ritmo es 0', () => {
		expect(calculatePace(0, 60 * SECOND)).toBe(0)
	})

	/**
	 * Un tiempo de 0 haría explotar el ratio y colocaría esa sesión en lo alto del
	 * ranking. Es imposible en una partida real, pero no debe producir `Infinity`.
	 */
	it('un tiempo de 0 no produce un ritmo infinito', () => {
		expect(calculatePace(5, 0)).toBe(0)
	})

	it('un tiempo negativo tampoco', () => {
		expect(calculatePace(5, -100)).toBe(0)
	})

	it('devuelve siempre un número finito', () => {
		const values = [calculatePace(1, 300), calculatePace(0, 0), calculatePace(100, 1)]

		expect(values.every((value) => Number.isFinite(value))).toBe(true)
	})
})

describe('isEligibleForRanking — Modo Objetivo', () => {
	/** La métrica es el tiempo empleado en alcanzar el objetivo (`MECHANICS.md` §2). */
	it('una victoria clasifica', () => {
		expect(isEligibleForRanking(makeResult({mode: 'target', status: 'won'}))).toBe(true)
	})

	it('una derrota no clasifica', () => {
		expect(isEligibleForRanking(makeResult({mode: 'target', status: 'lost'}))).toBe(false)
	})

	it('el número de aciertos no importa si se ganó', () => {
		const result = makeResult({mode: 'target', status: 'won', verbsMatched: 1})

		expect(isEligibleForRanking(result)).toBe(true)
	})
})

describe('isEligibleForRanking — Modo Precisión', () => {
	/**
	 * Lo normal en este modo es terminar fallando: el pool es mayor de lo que se
	 * completa en una sesión (`MECHANICS.md` §3). Exigir victoria vaciaría el
	 * ranking.
	 */
	it.each(['won', 'lost'] as FinishedStatus[])(
		'clasifica con desenlace "%s" si supera el piso',
		(status) => {
			const result = makeResult({status, verbsMatched: MIN_MATCHES_FOR_RANKING})

			expect(isEligibleForRanking(result)).toBe(true)
		},
	)

	it('justo en el piso clasifica', () => {
		expect(isEligibleForRanking(makeResult({verbsMatched: MIN_MATCHES_FOR_RANKING}))).toBe(true)
	})

	it('un acierto por debajo del piso no clasifica', () => {
		const result = makeResult({verbsMatched: MIN_MATCHES_FOR_RANKING - 1})

		expect(isEligibleForRanking(result)).toBe(false)
	})

	/**
	 * El caso degenerado que motiva el piso: 1 acierto en 300 ms da un ritmo de 200
	 * verbos por minuto, altísimo por inestabilidad del ratio y no por habilidad.
	 * Sin el piso encabezaría el ranking por encima de sesiones largas y hábiles.
	 */
	it('1 acierto en 300 ms tiene un ritmo altísimo pero no clasifica', () => {
		const result = makeResult({verbsMatched: 1, timeMs: 300})

		expect(calculatePace(result.verbsMatched, result.timeMs)).toBe(200)
		expect(isEligibleForRanking(result)).toBe(false)
	})

	it('una sesión sin aciertos no clasifica', () => {
		expect(isEligibleForRanking(makeResult({verbsMatched: 0, timeMs: 500}))).toBe(false)
	})
})

describe('isEligibleForRanking — cobertura de modos', () => {
	/** Si se añadiera un modo con ranking, este test obliga a decidir su regla. */
	it.each(['target', 'precision'] as GameMode[])('decide para el modo "%s"', (mode) => {
		const result = makeResult({mode, status: 'won', verbsMatched: MIN_MATCHES_FOR_RANKING})

		expect(typeof isEligibleForRanking(result)).toBe('boolean')
	})
})

function makeRow(overrides: Partial<RankingRow> = {}): RankingRow {
	return {
		user_id: 'uuid-1',
		display_name: 'Ada',
		avatar_url: null,
		time_ms: 60 * SECOND,
		verbs_matched: 10,
		completed_at: '2026-01-01T00:00:00.000Z',
		...overrides,
	}
}

describe('isPersistable', () => {
	/**
	 * Guardarse y clasificar no son lo mismo. Una partida de Precisión floja forma
	 * parte del historial del jugador aunque la vista la deje fuera del ranking.
	 */
	it('guarda las partidas de Precisión aunque no lleguen al piso del ranking', () => {
		const result = makeResult({mode: 'precision', verbsMatched: 1})

		expect(isPersistable(result)).toBe(true)
		expect(isEligibleForRanking(result)).toBe(false)
	})

	it('guarda las victorias de Contrarreloj', () => {
		expect(isPersistable(makeResult({mode: 'target', status: 'won'}))).toBe(true)
	})

	/** Una derrota en Contrarreloj no tiene tiempo que comparar: no aporta nada. */
	it('descarta las derrotas de Contrarreloj', () => {
		expect(isPersistable(makeResult({mode: 'target', status: 'lost'}))).toBe(false)
	})
})

describe('toRankingEntries', () => {
	it('numera las posiciones desde 1', () => {
		const entries = toRankingEntries(
			[
				makeRow({user_id: 'a', time_ms: 40 * SECOND}),
				makeRow({user_id: 'b', time_ms: 50 * SECOND}),
			],
			'target',
		)

		expect(entries.map((entry) => entry.position)).toEqual([1, 2])
	})

	/**
	 * Con dos tiempos idénticos, numerarlos 1 y 2 sugeriría una diferencia que no
	 * existe: la base desempata por fecha sólo para que el orden sea estable.
	 */
	it('los empates comparten posición y la siguiente salta', () => {
		const entries = toRankingEntries(
			[
				makeRow({user_id: 'a', time_ms: 40 * SECOND}),
				makeRow({user_id: 'b', time_ms: 40 * SECOND}),
				makeRow({user_id: 'c', time_ms: 55 * SECOND}),
			],
			'target',
		)

		expect(entries.map((entry) => entry.position)).toEqual([1, 1, 3])
	})

	it('en Precisión empata por ritmo, no por tiempo', () => {
		const entries = toRankingEntries(
			[
				makeRow({user_id: 'a', pace: 12, time_ms: 60 * SECOND}),
				makeRow({user_id: 'b', pace: 12, time_ms: 30 * SECOND}),
			],
			'precision',
		)

		expect(entries.map((entry) => entry.position)).toEqual([1, 1])
	})

	/** El orden lo fija la base, que es quien conoce la regla de desempate. */
	it('respeta el orden de llegada sin reordenar', () => {
		const entries = toRankingEntries(
			[
				makeRow({user_id: 'b', time_ms: 90 * SECOND}),
				makeRow({user_id: 'a', time_ms: 10 * SECOND}),
			],
			'target',
		)

		expect(entries.map((entry) => entry.userId)).toEqual(['b', 'a'])
	})

	it('usa el ritmo que entrega la vista de Precisión', () => {
		const entries = toRankingEntries([makeRow({pace: 7.5})], 'precision')

		expect(entries[0]?.pace).toBe(7.5)
	})

	/** La vista de Objetivo no trae ritmo, porque allí no clasifica. */
	it('calcula el ritmo cuando la vista no lo trae', () => {
		const entries = toRankingEntries([makeRow({verbs_matched: 10, time_ms: 60 * SECOND})], 'target')

		expect(entries[0]?.pace).toBe(10)
	})

	/**
	 * Los tipos generados declaran anulable todo lo que sale de una vista, porque
	 * Postgres no propaga `not null` a través de ella. Una fila sin usuario o sin
	 * tiempo no es una posición, es un dato roto: se omite en vez de pintar huecos.
	 */
	it('descarta las filas sin usuario, sin tiempo o sin aciertos', () => {
		const entries = toRankingEntries(
			[
				makeRow({user_id: null}),
				makeRow({time_ms: null}),
				makeRow({verbs_matched: null}),
				makeRow({user_id: 'ok'}),
			],
			'target',
		)

		expect(entries).toHaveLength(1)
		expect(entries[0]?.userId).toBe('ok')
	})

	it('cae al nombre de respaldo si el perfil no tiene ninguno', () => {
		const sinNombre = toRankingEntries([makeRow({display_name: null})], 'target')
		const enBlanco = toRankingEntries([makeRow({display_name: '   '})], 'target')

		expect(sinNombre[0]?.displayName).toBe(FALLBACK_DISPLAY_NAME)
		expect(enBlanco[0]?.displayName).toBe(FALLBACK_DISPLAY_NAME)
	})

	it('recorta los espacios del nombre', () => {
		expect(toRankingEntries([makeRow({display_name: '  Ada  '})], 'target')[0]?.displayName).toBe(
			'Ada',
		)
	})

	it('devuelve una lista vacía sin filas', () => {
		expect(toRankingEntries([], 'target')).toEqual([])
	})
})

describe('rankingMetric', () => {
	it('en Contrarreloj clasifica el tiempo', () => {
		expect(rankingMetric(makeResult({mode: 'target', status: 'won', timeMs: 42_000}))).toBe(42_000)
	})

	it('en Precisión clasifica el ritmo', () => {
		const result = makeResult({mode: 'precision', verbsMatched: 10, timeMs: 60 * SECOND})

		expect(rankingMetric(result)).toBe(10)
	})
})

describe('isBetterMetric', () => {
	/** La dirección se invierte por modo, y ahí es donde es fácil equivocarse. */
	it('en Contrarreloj gana el tiempo menor', () => {
		expect(isBetterMetric(40_000, 50_000, 'target')).toBe(true)
		expect(isBetterMetric(50_000, 40_000, 'target')).toBe(false)
	})

	it('en Precisión gana el ritmo mayor', () => {
		expect(isBetterMetric(14, 9, 'precision')).toBe(true)
		expect(isBetterMetric(9, 14, 'precision')).toBe(false)
	})

	it('empatar no es mejorar en ningún modo', () => {
		expect(isBetterMetric(40_000, 40_000, 'target')).toBe(false)
		expect(isBetterMetric(12, 12, 'precision')).toBe(false)
	})
})

describe('compareWithPersonalBest', () => {
	/**
	 * La primera marca no es un récord: no había nada que batir, y celebrarlo
	 * sonaría a premio vacío. Pero tampoco merece silencio, y por eso hay un
	 * veredicto propio en vez de un booleano.
	 */
	it('distingue la primera marca de un récord', () => {
		const result = makeResult({mode: 'target', status: 'won', timeMs: 40_000})

		expect(compareWithPersonalBest(result, null)).toBe('first')
		expect(compareWithPersonalBest(result, 50_000)).toBe('improved')
	})

	it('no celebra una marca peor ni un empate', () => {
		const result = makeResult({mode: 'target', status: 'won', timeMs: 50_000})

		expect(compareWithPersonalBest(result, 40_000)).toBe('not-improved')
		expect(compareWithPersonalBest(result, 50_000)).toBe('not-improved')
	})

	it('mejora en Precisión con más ritmo', () => {
		const result = makeResult({mode: 'precision', verbsMatched: 14, timeMs: 60 * SECOND})

		expect(compareWithPersonalBest(result, 9)).toBe('improved')
	})

	/** Una partida que no clasifica no puede ser récord de nada. */
	it('no es récord si la partida no entra en el ranking', () => {
		const perdida = makeResult({mode: 'target', status: 'lost', timeMs: 1000})
		const floja = makeResult({mode: 'precision', verbsMatched: 1})

		expect(compareWithPersonalBest(perdida, null)).toBe('not-eligible')
		expect(compareWithPersonalBest(floja, 999)).toBe('not-eligible')
	})
})

describe('bestMetricAfter', () => {
	it('sin marca previa, la marca es la de esta partida', () => {
		const result = makeResult({mode: 'target', status: 'won', timeMs: 40_000})

		expect(bestMetricAfter(result, null)).toBe(40_000)
	})

	it('se queda con el mejor de los dos en Contrarreloj', () => {
		const result = makeResult({mode: 'target', status: 'won', timeMs: 50_000})

		expect(bestMetricAfter(result, 40_000)).toBe(40_000)
	})

	it('se queda con el mejor de los dos en Precisión', () => {
		const result = makeResult({mode: 'precision', verbsMatched: 9, timeMs: 60 * SECOND})

		expect(bestMetricAfter(result, 14)).toBe(14)
	})
})
