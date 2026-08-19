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
	/**
	 * Cuánto tarda en reponerse una tríada acertada.
	 *
	 * No es sólo estético: durante esa espera el jugador puede seguir acertando y
	 * el tablero se va vaciando, lo que a su vez deja huecos de sobra para colocar
	 * las tríadas entrantes en filas distintas sin mover ninguna celda ocupada
	 * (`PLAN.md`, Bitácora, D8). Un valor por ajustar jugando.
	 */
	readonly refillDelayMs: number
	/**
	 * Huecos mínimos para que una reposición pueda aplicarse.
	 *
	 * Con **un solo hueco** las tres filas libres son exactamente las que dejó la
	 * tríada resuelta, así que la entrante cae siempre en esas mismas casillas —se
	 * midió: 200 de 200— y el jugador, que acaba de verlas atenuarse juntas, sabe
	 * al instante que las tres nuevas son un verbo.
	 *
	 * Exigir varios huecos permite mezclar casillas de tríadas distintas y deshace
	 * ese regalo. Cuantos más se exijan, más margen hay para colocar la entrante
	 * sin repetir posición; a cambio, la primera reposición tarda más en llegar y
	 * el tablero arranca encogiéndose. Es un parámetro de balance a ajustar
	 * jugando.
	 */
	readonly refillMinVacancies: number
	/**
	 * Huecos a partir de los cuales se adelanta la reposición más antigua.
	 *
	 * Evita que el tablero se quede prácticamente desierto durante una racha muy
	 * larga. Las reposiciones restantes **conservan su hora**: reprogramarlas haría
	 * que forzar una vez retrasara a todas las siguientes.
	 */
	readonly refillForceVacancies: number
	/**
	 * Cuánto se espera antes de reponer **ignorando** el mínimo de huecos.
	 *
	 * El mínimo es una preferencia, no una condición absoluta, y tiene que serlo:
	 * como cada acierto genera una reposición y el tablero deja de pagarlas al
	 * bajar del mínimo, un mínimo de G huecos dejaría el tablero fijo en N−(G−1)
	 * para el resto de la partida. Pasado este margen se repone igual, aceptando
	 * la colocación forzada: quedarse corto siempre es peor que el riesgo puntual.
	 */
	readonly refillGraceMs: number
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
		refillMinVacancies: 3,
		refillForceVacancies: 5,
		targetVerbs: 16,
		timeLimitMs: 90 * SECOND,
		refillDelayMs: 5 * SECOND,
		refillGraceMs: 5 * SECOND,
		errorPenaltyMs: 2 * SECOND,
	}),
	medium: Object.freeze({
		id: 'medium',
		label: 'Medio',
		verbLevels: Object.freeze(['beginner', 'intermediate'] as const),
		boardSize: 8,
		refillMinVacancies: 3,
		refillForceVacancies: 7,
		targetVerbs: 20,
		timeLimitMs: 90 * SECOND,
		refillDelayMs: 5 * SECOND,
		refillGraceMs: 5 * SECOND,
		errorPenaltyMs: 2 * SECOND,
	}),
	hard: Object.freeze({
		id: 'hard',
		label: 'Difícil',
		verbLevels: Object.freeze(['beginner', 'intermediate', 'advanced'] as const),
		boardSize: 10,
		refillMinVacancies: 3,
		refillForceVacancies: 9,
		targetVerbs: 24,
		timeLimitMs: 100 * SECOND,
		refillDelayMs: 5 * SECOND,
		refillGraceMs: 5 * SECOND,
		errorPenaltyMs: 3 * SECOND,
	}),
}) satisfies Readonly<Record<Difficulty, LevelConfig>>

/**
 * Piso mínimo de aciertos para clasificar en el ranking del Modo Supervivencia
 * (`MECHANICS.md` §3).
 *
 * Sin este piso, el ritmo `(aciertos / tiempo) * 60` premiaría sesiones
 * triviales: 1 acierto en 0,3 s da un ritmo altísimo por inestabilidad del
 * ratio, no por habilidad.
 */
export const MIN_MATCHES_FOR_RANKING = 5

/**
 * Cuántos aciertos necesita un verbo para considerarse dominado en el Modo
 * Dojo, y con qué porcentaje mínimo.
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
