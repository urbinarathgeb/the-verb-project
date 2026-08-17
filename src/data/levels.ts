/**
 * Parámetros de balance del juego.
 *
 * Este es el **único punto** donde se ajusta la dificultad. Los valores son
 * provisionales y se espera cambiarlos tras jugar el prototipo
 * (`MECHANICS.md` §7); por eso viven centralizados y no dispersos en la lógica.
 */

import type {Difficulty} from '@/types/game'
import type {VerbLevel} from '@/types/verb'

export interface LevelConfig {
	readonly id: Difficulty
	/** Etiqueta visible en la selección de nivel. */
	readonly label: string
	/** Niveles del catálogo que componen el pool de este nivel de dificultad. */
	readonly verbLevels: readonly VerbLevel[]
	/**
	 * N: tríadas visibles en el tablero a la vez.
	 *
	 * Escalonada por nivel también por usabilidad táctil: 3 columnas × 6 celdas
	 * caben en un viewport móvil sin scroll; × 10 no.
	 */
	readonly boardSize: number
	/** X: emparejamientos necesarios para ganar en Modo Objetivo. */
	readonly targetVerbs: number
	/** T: tiempo límite del Modo Objetivo, en milisegundos. */
	readonly timeLimitMs: number
	/** Penalización de tiempo por error en Modo Objetivo, en milisegundos. */
	readonly errorPenaltyMs: number
}

const SECOND = 1000

export const LEVELS = Object.freeze({
	easy: Object.freeze({
		id: 'easy',
		label: 'Fácil',
		verbLevels: Object.freeze(['beginner'] as const),
		boardSize: 6,
		targetVerbs: 8,
		timeLimitMs: 90 * SECOND,
		errorPenaltyMs: 2 * SECOND,
	}),
	medium: Object.freeze({
		id: 'medium',
		label: 'Medio',
		verbLevels: Object.freeze(['beginner', 'intermediate'] as const),
		boardSize: 8,
		targetVerbs: 10,
		timeLimitMs: 90 * SECOND,
		errorPenaltyMs: 2 * SECOND,
	}),
	hard: Object.freeze({
		id: 'hard',
		label: 'Difícil',
		verbLevels: Object.freeze(['beginner', 'intermediate', 'advanced'] as const),
		boardSize: 10,
		targetVerbs: 12,
		timeLimitMs: 100 * SECOND,
		errorPenaltyMs: 3 * SECOND,
	}),
}) satisfies Readonly<Record<Difficulty, LevelConfig>>

/**
 * Piso mínimo de aciertos para clasificar en el ranking del Modo Precisión
 * (`MECHANICS.md` §3).
 *
 * Sin este piso, el ritmo `(aciertos / tiempo) * 60` premiaría sesiones
 * triviales: 1 acierto en 0,3 s da un ritmo altísimo por inestabilidad del
 * ratio, no por habilidad.
 */
export const MIN_MATCHES_FOR_RANKING = 5

/**
 * Cuántos aciertos necesita un verbo para considerarse dominado en el Modo
 * Práctica, y con qué porcentaje mínimo.
 *
 * Un solo acierto puede ser suerte —hay tres opciones, así que acertar al azar
 * ocurre una de cada tres veces—, y sin exigir porcentaje bastaría con insistir
 * hasta acertar. Son parámetros de balance: se espera ajustarlos al usar el modo.
 */
export const MASTERY_MIN_CORRECT = 3
export const MASTERY_MIN_ACCURACY = 0.8

export function getLevelConfig(difficulty: Difficulty): LevelConfig {
	return LEVELS[difficulty]
}
