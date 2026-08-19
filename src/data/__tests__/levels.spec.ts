import {describe, expect, it} from 'vitest'
import {LEVELS, MIN_MATCHES_FOR_RANKING, getLevelConfig} from '../levels'
import {DIFFICULTIES, type Difficulty} from '@/types/game'
import {VERB_LEVELS} from '@/types/verb'

describe('configuración de niveles', () => {
	it('define una entrada por cada dificultad', () => {
		expect(Object.keys(LEVELS).sort()).toEqual([...DIFFICULTIES].sort())
	})

	it.each(DIFFICULTIES)('la clave y el id de "%s" coinciden', (difficulty) => {
		expect(LEVELS[difficulty].id).toBe(difficulty)
	})

	it.each(DIFFICULTIES)('"%s" tiene valores positivos y coherentes', (difficulty) => {
		const config = getLevelConfig(difficulty)

		expect(config.boardSize).toBeGreaterThan(0)
		expect(config.targetVerbs).toBeGreaterThan(0)
		expect(config.timeLimitMs).toBeGreaterThan(0)
		expect(config.errorPenaltyMs).toBeGreaterThanOrEqual(0)
		expect(config.label.trim()).not.toBe('')
		expect(config.verbLevels.length).toBeGreaterThan(0)
	})

	it.each(DIFFICULTIES)('"%s" usa solo niveles de catálogo válidos', (difficulty) => {
		const {verbLevels} = getLevelConfig(difficulty)
		expect(verbLevels.every((level) => VERB_LEVELS.includes(level))).toBe(true)
	})

	/**
	 * La penalización por error no puede superar al tiempo límite: un solo fallo
	 * terminaría la partida de golpe, convirtiendo el Modo Objetivo en el Modo
	 * Supervivencia y contradiciendo `MECHANICS.md` §2 ("los errores no terminan la
	 * ronda").
	 */
	it.each(DIFFICULTIES)('la penalización de "%s" no agota el tiempo límite', (difficulty) => {
		const {errorPenaltyMs, timeLimitMs} = getLevelConfig(difficulty)
		expect(errorPenaltyMs).toBeLessThan(timeLimitMs)
	})

	/**
	 * La dificultad crece, pero **no por el tamaño del tablero**. `hard` comparte
	 * las 8 celdas de `medium` a propósito: 30 celdas no caben en un móvil
	 * (`MECHANICS.md` §7) y su dificultad viene del objetivo y del repertorio, no
	 * de llenar más la pantalla. Por eso el tablero se compara con «no decrece» y
	 * el objetivo con «crece».
	 */
	it('la dificultad crece de forma monótona', () => {
		const easy = LEVELS.easy
		const medium = LEVELS.medium
		const hard = LEVELS.hard

		expect(medium.boardSize).toBeGreaterThan(easy.boardSize)
		expect(hard.boardSize).toBeGreaterThanOrEqual(medium.boardSize)

		expect(easy.targetVerbs).toBeLessThan(medium.targetVerbs)
		expect(medium.targetVerbs).toBeLessThan(hard.targetVerbs)
	})

	/**
	 * El ritmo exigido es lo que separa de verdad a `hard` de `medium` desde que
	 * comparten tablero: segundos disponibles por acierto, de más a menos.
	 */
	it('cada nivel deja menos tiempo por acierto que el anterior', () => {
		const perMatch = (level: (typeof LEVELS)[Difficulty]) => level.timeLimitMs / level.targetVerbs

		expect(perMatch(LEVELS.medium)).toBeLessThan(perMatch(LEVELS.easy))
		expect(perMatch(LEVELS.hard)).toBeLessThan(perMatch(LEVELS.medium))
	})

	it('la configuración está congelada', () => {
		expect(Object.isFrozen(LEVELS)).toBe(true)
		expect(Object.isFrozen(LEVELS.easy)).toBe(true)
	})
})

describe('MIN_MATCHES_FOR_RANKING', () => {
	it('es un piso positivo y alcanzable en el tablero más pequeño', () => {
		expect(MIN_MATCHES_FOR_RANKING).toBeGreaterThan(0)
		expect(MIN_MATCHES_FOR_RANKING).toBeLessThanOrEqual(LEVELS.easy.boardSize)
	})
})
