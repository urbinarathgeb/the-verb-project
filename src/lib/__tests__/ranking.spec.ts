import {describe, expect, it} from 'vitest'
import {calculatePace, isEligibleForRanking} from '../ranking'
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
