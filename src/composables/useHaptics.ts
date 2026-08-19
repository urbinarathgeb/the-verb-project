/**
 * Vibración de respuesta a las jugadas.
 *
 * El sistema ya comunica el acierto y el fallo por color y por movimiento
 * —amarillo, rosa y una sacudida—, y ninguna de las dos cosas llega al dedo, que
 * es donde se juega en móvil (`PLAN.md`, Bitácora, D13).
 *
 * Es un composable sin store porque no hay estado que compartir: son dos
 * funciones sobre una API del navegador (`CLAUDE.md` §6).
 */

/** Un toque seco. Lo bastante corto para no notarse como zumbido. */
const MATCH_PATTERN = 18

/**
 * Dos toques. El fallo se distingue del acierto por el **patrón**, no por la
 * duración: una vibración más larga se percibe como «más de lo mismo», mientras
 * que dos pulsos se leen como otra cosa sin mirar la pantalla.
 *
 * El array de `navigator.vibrate` **alterna vibración y pausa** empezando por
 * vibración: aquí son 28 ms de pulso, 70 de silencio y otros 28 de pulso.
 */
const MISTAKE_PATTERN = [28, 70, 28]

export interface UseHapticsReturn {
	/** `true` si el dispositivo vibra y el usuario no ha pedido reducir movimiento. */
	isAvailable: () => boolean
	signalMatch: () => void
	signalMistake: () => void
}

export function useHaptics(): UseHapticsReturn {
	/**
	 * Se comprueba en cada uso y no una sola vez al crear el composable: la
	 * preferencia de movimiento reducida puede cambiar durante la partida, y
	 * congelarla dejaría vibrando a quien acaba de pedir que no.
	 */
	function isAvailable(): boolean {
		if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false

		// Sin `matchMedia` no se puede consultar la preferencia; se asume la de por
		// defecto, que es no haber pedido nada.
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true

		return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
	}

	function play(pattern: number | number[]): void {
		if (!isAvailable()) return

		navigator.vibrate(pattern)
	}

	return {
		isAvailable,
		signalMatch: () => play(MATCH_PATTERN),
		signalMistake: () => play(MISTAKE_PATTERN),
	}
}
