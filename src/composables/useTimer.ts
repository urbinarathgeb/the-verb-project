import {
	computed,
	getCurrentScope,
	onScopeDispose,
	shallowRef,
	toValue,
	type ComputedRef,
	type MaybeRefOrGetter,
} from 'vue'

/**
 * Reloj de partida: cuenta regresiva para el Modo Objetivo y ascendente para el
 * Modo Supervivencia (`MECHANICS.md` §2 y §3).
 *
 * El tiempo **no se acumula sumando intervalos**, sino midiendo la diferencia
 * contra el reloj del sistema. Un `setInterval` no dispara con exactitud —se
 * retrasa si la pestaña pierde el foco o el hilo se congestiona— y sumar sus
 * disparos acumularía una deriva de segundos en una partida. Aquí el intervalo
 * sólo marca cada cuánto se refresca el valor mostrado; el valor en sí se calcula
 * siempre desde las marcas de tiempo. Importa porque el tiempo es la métrica de
 * ranking, no un adorno del HUD.
 */
export interface UseTimerOptions {
	/**
	 * Duración de la cuenta regresiva en milisegundos. `null` (por defecto) hace
	 * que el reloj cuente hacia adelante sin límite.
	 *
	 * Acepta un `ref` o un getter porque el límite depende del modo y del nivel,
	 * que no se conocen hasta que el jugador arranca la partida, mientras que el
	 * reloj se crea antes (en el setup del store).
	 */
	limitMs?: MaybeRefOrGetter<number | null>
	/** Cada cuánto se refresca el valor mostrado. No afecta a la precisión. */
	tickMs?: number
	/** Se invoca una sola vez, cuando una cuenta regresiva llega a 0. */
	onExpire?: () => void
}

export interface UseTimerReturn {
	/**
	 * Tiempo consumido, penalizaciones incluidas. En cuenta regresiva nunca supera
	 * el límite. Es el valor que se registra como `timeMs` en `SessionResult`.
	 *
	 * Entre ticks se queda en la última lectura, así que avanza a saltos de
	 * `tickMs`. `pause` lo sincroniza, y por eso el resultado de una partida se
	 * lee siempre con el reloj ya detenido.
	 */
	elapsedMs: ComputedRef<number>
	/** Tiempo que queda, o `null` si el reloj no tiene límite. */
	remainingMs: ComputedRef<number | null>
	/** Fracción del límite ya consumida, de 0 a 1. `null` sin límite. */
	progress: ComputedRef<number | null>
	isRunning: ComputedRef<boolean>
	/** `true` cuando una cuenta regresiva llegó a 0. Terminal hasta un `reset`. */
	isExpired: ComputedRef<boolean>
	/** Arranca el reloj, o lo reanuda si estaba pausado. */
	start: () => void
	/** Detiene el reloj conservando lo transcurrido. */
	pause: () => void
	/** Vuelve a cero: tiempo, penalizaciones y expiración. */
	reset: () => void
	/** Suma una penalización de tiempo por error (`MECHANICS.md` §2). */
	penalize: (ms: number) => void
}

/** 100 ms permite mostrar décimas en el HUD sin repintar en cada fotograma. */
const DEFAULT_TICK_MS = 100

export function useTimer(options: UseTimerOptions = {}): UseTimerReturn {
	const {limitMs = null, tickMs = DEFAULT_TICK_MS, onExpire} = options

	/** Lee el límite actual. Es una función porque la opción puede ser reactiva. */
	function currentLimitMs(): number | null {
		return toValue(limitMs)
	}

	/** Marca de inicio del tramo en curso, o `null` si el reloj está parado. */
	const startedAt = shallowRef<number | null>(null)
	/** Tiempo de los tramos ya cerrados por pausas anteriores. */
	const accumulatedMs = shallowRef(0)
	const penaltiesMs = shallowRef(0)
	/** Última lectura del reloj del sistema. Es lo que hace reactivo el paso del tiempo. */
	const nowMs = shallowRef(Date.now())
	const expired = shallowRef(false)

	let intervalId: ReturnType<typeof setInterval> | null = null

	const isRunning = computed(() => startedAt.value !== null)
	const isExpired = computed(() => expired.value)

	/**
	 * Duración del tramo en curso según la última lectura del reloj. La usan tanto
	 * `elapsedMs` como `pause`, para que no existan dos formas distintas de medir
	 * lo mismo.
	 */
	function currentSegmentMs(): number {
		const start = startedAt.value
		return start === null ? 0 : Math.max(0, nowMs.value - start)
	}

	const elapsedMs = computed(() => {
		const total = accumulatedMs.value + currentSegmentMs() + penaltiesMs.value

		// Con límite, el tiempo consumido se acota: al expirar, el tiempo de la
		// partida es exactamente el límite, no el instante del tick que lo detectó.
		const limit = currentLimitMs()
		return limit === null ? total : Math.min(total, limit)
	})

	const remainingMs = computed<number | null>(() => {
		const limit = currentLimitMs()
		return limit === null ? null : Math.max(0, limit - elapsedMs.value)
	})

	const progress = computed<number | null>(() => {
		const limit = currentLimitMs()
		return limit === null || limit <= 0 ? null : Math.min(1, elapsedMs.value / limit)
	})

	function syncNow(): void {
		nowMs.value = Date.now()
	}

	function stopTicking(): void {
		if (intervalId === null) return
		clearInterval(intervalId)
		intervalId = null
	}

	function checkExpiry(): void {
		const limit = currentLimitMs()
		if (limit === null || expired.value) return
		if (elapsedMs.value < limit) return

		expired.value = true
		pause()
		onExpire?.()
	}

	function tick(): void {
		syncNow()
		checkExpiry()
	}

	function start(): void {
		if (expired.value || isRunning.value) return

		syncNow()
		startedAt.value = nowMs.value
		intervalId = setInterval(tick, tickMs)

		// Un límite ya agotado (0, o cubierto por las penalizaciones) debe expirar
		// al arrancar, sin esperar al primer tick.
		checkExpiry()
	}

	function pause(): void {
		if (!isRunning.value) return

		syncNow()
		accumulatedMs.value += currentSegmentMs()
		startedAt.value = null
		stopTicking()
	}

	function reset(): void {
		stopTicking()
		startedAt.value = null
		accumulatedMs.value = 0
		penaltiesMs.value = 0
		expired.value = false
		syncNow()
	}

	/**
	 * La penalización cuenta como tiempo consumido, así que en el Modo Objetivo
	 * acerca el final de la cuenta y además empeora el tiempo registrado en el
	 * ranking. Si no contara para el ranking, fallar saldría gratis al jugador que
	 * de todas formas llega al objetivo.
	 */
	function penalize(ms: number): void {
		if (ms <= 0) return

		penaltiesMs.value += ms
		if (isRunning.value) syncNow()
		checkExpiry()
	}

	// El intervalo debe morir con el componente que lo creó; si no, seguiría
	// disparando tras salir de la partida.
	if (getCurrentScope() !== undefined) onScopeDispose(stopTicking)

	return {
		elapsedMs,
		remainingMs,
		progress,
		isRunning,
		isExpired,
		start,
		pause,
		reset,
		penalize,
	}
}
