/**
 * Formato de los valores que muestra el HUD.
 *
 * Vive en `lib/` y no en los componentes porque es lógica pura y testeable, y
 * porque el mismo formato se reutiliza en la pantalla de resultado y en el
 * ranking.
 */

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60

/**
 * Duración en `m:ss`, por ejemplo `1:05`.
 *
 * Redondea **hacia arriba** los milisegundos sobrantes: un reloj que marca
 * `0:00` mientras aún queda tiempo jugable resulta desconcertante, y en cuenta
 * regresiva el `0:00` debe coincidir con el final real.
 */
export function formatDuration(ms: number): string {
	const totalSeconds = Math.ceil(Math.max(0, ms) / MS_PER_SECOND)
	const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
	const seconds = totalSeconds % SECONDS_PER_MINUTE

	return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Duración con décimas, `m:ss.d`. Se usa en los últimos segundos de la cuenta
 * regresiva, donde la décima comunica urgencia mejor que un número quieto.
 */
export function formatDurationPrecise(ms: number): string {
	const safeMs = Math.max(0, ms)
	const totalSeconds = Math.floor(safeMs / MS_PER_SECOND)
	const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
	const seconds = totalSeconds % SECONDS_PER_MINUTE
	const tenths = Math.floor((safeMs % MS_PER_SECOND) / 100)

	return `${minutes}:${seconds.toString().padStart(2, '0')}.${tenths}`
}

/** Ritmo del Modo Supervivencia con un decimal, por ejemplo `12.5`. */
export function formatPace(verbsPerMinute: number): string {
	return verbsPerMinute.toFixed(1)
}
