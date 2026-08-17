/**
 * Reglas de clasificación en el ranking (`MECHANICS.md` §2, §3 y §5).
 *
 * Son funciones puras y viven fuera del store porque la Fase 5 las necesita
 * también del otro lado: el ritmo del Modo Precisión no se guarda en
 * `game_sessions`, se calcula al consultar el ranking a partir de
 * `verbs_matched` y `time_ms` (`MECHANICS.md` §6).
 */

import {MIN_MATCHES_FOR_RANKING} from '@/data/levels'
import type {SessionResult} from '@/types/game'

const MS_PER_MINUTE = 60_000

/**
 * Ritmo en verbos por minuto: `(aciertos / segundos) * 60`.
 *
 * Combina ambas variables en un solo número, de modo que premia acertar más y
 * hacerlo rápido, sin que valga la pena tomárselo con calma para acumular
 * aciertos: el tiempo pesa en cada instante (`MECHANICS.md` §3).
 *
 * Con `timeMs` de 0 o negativo devuelve 0 en lugar de infinito. Es un valor
 * imposible en una partida real, pero dejar que el ratio explote pondría esa
 * sesión en lo alto del ranking.
 */
export function calculatePace(verbsMatched: number, timeMs: number): number {
	if (timeMs <= 0 || verbsMatched <= 0) return 0

	return (verbsMatched * MS_PER_MINUTE) / timeMs
}

/**
 * ¿Esta partida entra en el ranking de su modo?
 *
 * - **Objetivo:** sólo los intentos exitosos. La métrica es el tiempo empleado en
 *   alcanzar el objetivo, así que una derrota no tiene tiempo que comparar.
 * - **Precisión:** cualquier desenlace, siempre que supere el piso de aciertos.
 *   Lo normal en este modo es terminar fallando —el pool es mayor de lo que se
 *   completa en una sesión—, así que exigir victoria dejaría el ranking vacío. El
 *   piso evita que una sesión trivial (1 acierto en 300 ms) suba a lo alto por la
 *   inestabilidad matemática del ratio, no por habilidad.
 *
 * El filtro por usuario autenticado es aparte y vive en la capa de persistencia
 * (`MECHANICS.md` §5).
 */
export function isEligibleForRanking(result: SessionResult): boolean {
	if (result.mode === 'target') return result.status === 'won'

	return result.verbsMatched >= MIN_MATCHES_FOR_RANKING
}
