import {computed, ref} from 'vue'
import {defineStore} from 'pinia'
import {MASTERY_MIN_ACCURACY, MASTERY_MIN_CORRECT} from '@/data/levels'
import {supabase} from '@/lib/supabase'
import {useAuthStore} from '@/stores/auth'

/**
 * Progreso del usuario por verbo, alimentado por el Dojo
 * (`MECHANICS.md` §4 y §6).
 *
 * Sin sesión vive sólo en memoria y se pierde al recargar: es el modo invitado
 * funcionando (`CLAUDE.md` §8). Con sesión se sincroniza contra la tabla
 * `user_progress` de Supabase.
 *
 * **La sincronización va por incrementos, no por totales.** Cada respuesta se
 * acumula en `pending` y se envía como «suma esto a lo que ya haya» a la función
 * `record_practice_progress`. Mandar totales absolutos calculados desde la copia
 * local haría que practicar en dos dispositivos sin recargar borrara lo
 * aprendido en el otro.
 */

export interface VerbProgress {
	readonly verbId: number
	readonly correct: number
	readonly wrong: number
	/** Marca ISO de la última respuesta sobre este verbo. */
	readonly lastPracticedAt: string
}

/** Incrementos aún no enviados al servidor, por verbo. */
export interface PendingDelta {
	readonly hits: number
	readonly misses: number
}

/**
 * Qué pasó al intentar sincronizar. `empty` y `guest` no son fallos: significan
 * que no había nada que enviar o que no hay a quién atribuirlo.
 */
export type SyncOutcome = 'saved' | 'empty' | 'guest' | 'offline' | 'error'

/** Un verbo sin practicar todavía. */
function emptyProgress(verbId: number): VerbProgress {
	return {verbId, correct: 0, wrong: 0, lastPracticedAt: ''}
}

/** Suma dos colas de incrementos, verbo a verbo. */
function mergeDeltas(
	left: Record<number, PendingDelta>,
	right: Record<number, PendingDelta>,
): Record<number, PendingDelta> {
	const merged: Record<number, PendingDelta> = {...left}

	for (const [key, delta] of Object.entries(right)) {
		const verbId = Number(key)
		const existing = merged[verbId] ?? {hits: 0, misses: 0}

		merged[verbId] = {hits: existing.hits + delta.hits, misses: existing.misses + delta.misses}
	}

	return merged
}

/** Porcentaje de aciertos de un verbo, de 0 a 1. Sin respuestas, 0. */
export function accuracyOf(progress: VerbProgress): number {
	const total = progress.correct + progress.wrong

	return total === 0 ? 0 : progress.correct / total
}

/**
 * Un verbo se considera dominado con suficientes aciertos **y** buen porcentaje.
 *
 * Las dos condiciones son necesarias: con tres opciones se acierta al azar una
 * de cada tres veces, así que sólo el porcentaje sería frágil; y sólo el número
 * de aciertos premiaría insistir hasta acertar.
 */
export function isMastered(progress: VerbProgress): boolean {
	return progress.correct >= MASTERY_MIN_CORRECT && accuracyOf(progress) >= MASTERY_MIN_ACCURACY
}

export const useProgressStore = defineStore('progress', () => {
	/**
	 * Progreso indexado por `verbId`. Es un `Record` y no un `Map` porque es la
	 * forma que se serializa directamente hacia `user_progress` en la Fase 5.
	 */
	const entries = ref<Record<number, VerbProgress>>({})

	/** Incrementos pendientes de enviar, por verbo. */
	const pending = ref<Record<number, PendingDelta>>({})
	const isSyncing = ref(false)
	const syncError = ref<string | null>(null)

	const hasPendingChanges = computed(() => Object.keys(pending.value).length > 0)

	const allProgress = computed(() => Object.values(entries.value))

	const practicedCount = computed(() => allProgress.value.length)

	const totalCorrect = computed(() =>
		allProgress.value.reduce((sum, progress) => sum + progress.correct, 0),
	)

	const totalWrong = computed(() =>
		allProgress.value.reduce((sum, progress) => sum + progress.wrong, 0),
	)

	/** Porcentaje global de aciertos de la práctica, de 0 a 1. */
	const overallAccuracy = computed(() => {
		const total = totalCorrect.value + totalWrong.value

		return total === 0 ? 0 : totalCorrect.value / total
	})

	const masteredVerbIds = computed(() =>
		allProgress.value.filter(isMastered).map((progress) => progress.verbId),
	)

	const masteredCount = computed(() => masteredVerbIds.value.length)

	/** Progreso de un verbo concreto, aunque nunca se haya practicado. */
	function progressFor(verbId: number): VerbProgress {
		return entries.value[verbId] ?? emptyProgress(verbId)
	}

	/** Registra una respuesta del Dojo sobre un verbo. */
	function recordAnswer(verbId: number, isCorrect: boolean): void {
		const current = progressFor(verbId)

		entries.value = {
			...entries.value,
			[verbId]: {
				verbId,
				correct: current.correct + (isCorrect ? 1 : 0),
				wrong: current.wrong + (isCorrect ? 0 : 1),
				lastPracticedAt: new Date().toISOString(),
			},
		}

		// El incremento se acumula siempre, también sin sesión: si el jugador entra
		// a mitad de sesión, `syncPending` no tendrá nada que enviar porque
		// `loadProgress` limpia lo de invitado, y eso es lo correcto.
		const delta = pending.value[verbId] ?? {hits: 0, misses: 0}

		pending.value = {
			...pending.value,
			[verbId]: {
				hits: delta.hits + (isCorrect ? 1 : 0),
				misses: delta.misses + (isCorrect ? 0 : 1),
			},
		}
	}

	/**
	 * Envía los incrementos acumulados.
	 *
	 * Se vacía `pending` **antes** de la petición y se restituye si falla, para
	 * que las respuestas dadas mientras la petición está en vuelo no se pierdan al
	 * volver ni se envíen dos veces.
	 */
	async function syncPending(): Promise<SyncOutcome> {
		if (supabase === null) return 'offline'

		const userId = useAuthStore().userId
		if (userId === null) return 'guest'

		const batch = Object.entries(pending.value).map(([verbId, delta]) => ({
			verb_id: Number(verbId),
			hits: delta.hits,
			misses: delta.misses,
		}))

		if (batch.length === 0) return 'empty'

		const inFlight = pending.value
		pending.value = {}
		isSyncing.value = true

		const {error} = await supabase.rpc('record_practice_progress', {entries: batch})

		isSyncing.value = false

		if (error !== null) {
			// Se devuelven los incrementos a la cola, sumándolos a lo que haya
			// llegado entretanto en lugar de sobrescribirlo.
			pending.value = mergeDeltas(inFlight, pending.value)
			syncError.value = 'No se pudo guardar tu progreso. Se reintentará.'

			return 'error'
		}

		syncError.value = null

		return 'saved'
	}

	/**
	 * Carga el progreso guardado y **descarta** lo que hubiera en memoria.
	 *
	 * Descartar es deliberado: si alguien practicó como invitado y luego inició
	 * sesión, ese progreso no es suyo —o al menos no se pidió atribuírselo— y
	 * subirlo falsearía sus estadísticas.
	 */
	async function loadProgress(): Promise<void> {
		if (supabase === null) return

		const userId = useAuthStore().userId
		if (userId === null) return

		const {data, error} = await supabase
			.from('user_progress')
			.select('verb_id, hits, misses, last_practiced_at')

		if (error !== null || data === null) return

		entries.value = Object.fromEntries(
			data.map((row) => [
				row.verb_id,
				{
					verbId: row.verb_id,
					correct: row.hits,
					wrong: row.misses,
					lastPracticedAt: row.last_practiced_at,
				},
			]),
		)
		pending.value = {}
	}

	/** Borra todo el progreso, incluidos los incrementos sin enviar. */
	function resetProgress(): void {
		entries.value = {}
		// Vaciar la cola es imprescindible: si no, el progreso de quien acaba de
		// cerrar sesión se subiría a la cuenta del siguiente que entre.
		pending.value = {}
		syncError.value = null
	}

	return {
		// Estado
		entries,
		pending,
		isSyncing,
		syncError,
		// Derivados
		allProgress,
		practicedCount,
		totalCorrect,
		totalWrong,
		overallAccuracy,
		masteredVerbIds,
		masteredCount,
		hasPendingChanges,
		// Acciones
		progressFor,
		recordAnswer,
		syncPending,
		loadProgress,
		resetProgress,
	}
})
