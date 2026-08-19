/**
 * Reglas de clasificación en el ranking (`MECHANICS.md` §2, §3 y §5).
 *
 * Son funciones puras y viven fuera del store porque la Fase 5 las necesita
 * también del otro lado: el ritmo del Modo Precisión no se guarda en
 * `game_sessions`, se calcula al consultar el ranking a partir de
 * `verbs_matched` y `time_ms` (`MECHANICS.md` §6).
 */

import {MIN_MATCHES_FOR_RANKING} from '@/data/levels'
import {FALLBACK_DISPLAY_NAME} from '@/lib/auth'
import type {GameMode, SessionResult} from '@/types/game'

const MS_PER_MINUTE = 60_000

/** Cuántas posiciones se muestran por modo y nivel. */
export const RANKING_PAGE_SIZE = 20

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

/**
 * ¿Se guarda esta partida en `game_sessions`?
 *
 * No es lo mismo que entrar al ranking, y la diferencia es deliberada: una
 * partida de Precisión por debajo del piso **sí se guarda** —forma parte del
 * historial del jugador— pero la vista `precision_ranking` la deja fuera de la
 * clasificación. En Objetivo, en cambio, una derrota no tiene tiempo que
 * comparar y no aporta nada, así que ni se guarda (`MECHANICS.md` §5).
 */
export function isPersistable(result: SessionResult): boolean {
	return result.mode !== 'target' || result.status === 'won'
}

/**
 * Métrica por la que clasifica un resultado, según su modo.
 *
 * En Objetivo es el tiempo, donde **menos es mejor**; en Precisión el ritmo,
 * donde más es mejor (`MECHANICS.md` §2 y §3). Quien la use tiene que saber en
 * qué dirección compara, y por eso existe `isBetterMetric`.
 */
export function rankingMetric(result: SessionResult): number {
	return result.mode === 'target'
		? result.timeMs
		: calculatePace(result.verbsMatched, result.timeMs)
}

/** ¿`candidate` es mejor marca que `reference` en este modo? */
export function isBetterMetric(candidate: number, reference: number, mode: GameMode): boolean {
	return mode === 'target' ? candidate < reference : candidate > reference
}

/**
 * Cómo queda este resultado frente a la mejor marca anterior del jugador.
 *
 * Es una unión y no un booleano porque la primera partida **no es un récord**:
 * celebrar «¡nuevo récord!» cuando no había nada que batir suena a premio vacío,
 * pero tampoco merece silencio.
 */
export type RecordVerdict = 'first' | 'improved' | 'not-improved' | 'not-eligible'

export function compareWithPersonalBest(
	result: SessionResult,
	previousBestMetric: number | null,
): RecordVerdict {
	// Una partida que no clasifica no puede ser récord de nada.
	if (!isEligibleForRanking(result)) return 'not-eligible'
	if (previousBestMetric === null) return 'first'

	return isBetterMetric(rankingMetric(result), previousBestMetric, result.mode)
		? 'improved'
		: 'not-improved'
}

/**
 * Mejor marca del jugador tras contar este resultado.
 *
 * Se calcula en el cliente en lugar de releer la vista después de insertar: la
 * partida acaba de guardarse, así que el mejor de los dos valores es exactamente
 * lo que devolvería el servidor, y evita una consulta de ida y vuelta.
 */
export function bestMetricAfter(result: SessionResult, previousBestMetric: number | null): number {
	const current = rankingMetric(result)

	if (previousBestMetric === null) return current

	return isBetterMetric(current, previousBestMetric, result.mode) ? current : previousBestMetric
}

/**
 * Fila cruda de cualquiera de las dos vistas de ranking.
 *
 * Todo es opcional y anulable porque así lo declara el tipo generado: Postgres
 * no propaga `not null` a través de una vista, aunque las columnas de origen lo
 * sean. Se modela tal cual en vez de forzarlo, para que el filtrado sea
 * explícito y no una aserción escondida.
 */
export interface RankingRow {
	readonly user_id: string | null
	readonly display_name: string | null
	readonly avatar_url: string | null
	readonly time_ms: number | null
	readonly verbs_matched: number | null
	readonly completed_at: string | null
	readonly errors?: number | null
	readonly pace?: number | null
}

/** Una posición del ranking, ya lista para pintar. */
export interface RankingEntry {
	readonly position: number
	readonly userId: string
	readonly displayName: string
	readonly avatarUrl: string | null
	readonly timeMs: number
	readonly verbsMatched: number
	readonly errors: number
	/** Verbos por minuto. La vista de Precisión lo entrega; en Objetivo se calcula. */
	readonly pace: number
	readonly completedAt: string
}

/** La métrica por la que se clasifica cada modo (`MECHANICS.md` §2 y §3). */
function metricOf(entry: Omit<RankingEntry, 'position'>, mode: GameMode): number {
	return mode === 'target' ? entry.timeMs : entry.pace
}

/**
 * Convierte las filas de una vista en posiciones de ranking.
 *
 * Descarta las filas a las que les falte algo esencial en lugar de pintar
 * huecos: una fila sin usuario o sin tiempo no es una posición, es un dato roto,
 * y mostrarlo confundiría más que omitirlo.
 *
 * **Se respeta el orden de llegada.** Las filas vienen ya ordenadas por la base,
 * que es quien conoce la regla de desempate; reordenar aquí duplicaría esa
 * lógica y las dos copias podrían discrepar.
 */
export function toRankingEntries(rows: readonly RankingRow[], mode: GameMode): RankingEntry[] {
	const parsed = rows.flatMap((row) => {
		if (row.user_id === null || row.time_ms === null || row.verbs_matched === null) return []

		const name = row.display_name?.trim()

		return [
			{
				userId: row.user_id,
				// El nombre puede faltar si el perfil se creó sin metadatos de Google.
				displayName: name === undefined || name === '' ? FALLBACK_DISPLAY_NAME : name,
				avatarUrl: row.avatar_url,
				timeMs: row.time_ms,
				verbsMatched: row.verbs_matched,
				errors: row.errors ?? 0,
				// La vista de Precisión ya trae el ritmo calculado; la de Objetivo no,
				// porque allí no es la métrica de clasificación.
				pace: row.pace ?? calculatePace(row.verbs_matched, row.time_ms),
				completedAt: row.completed_at ?? '',
			},
		]
	})

	/*
	 * Los empates comparten posición. Con dos tiempos idénticos, numerarlos 1 y 2
	 * sugeriría una diferencia que no existe; la base desempata por fecha sólo
	 * para que el orden sea estable, no porque uno sea mejor.
	 */
	let position = 0
	let previousMetric: number | null = null

	return parsed.map((entry, index) => {
		const metric = metricOf(entry, mode)

		if (previousMetric === null || metric !== previousMetric) position = index + 1

		previousMetric = metric

		return {position, ...entry}
	})
}
