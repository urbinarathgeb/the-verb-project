import {computed, ref} from 'vue'
import {defineStore} from 'pinia'
import {supabase} from '@/lib/supabase'
import {
	RANKING_PAGE_SIZE,
	isPersistable,
	toRankingEntries,
	type RankingEntry,
	type RankingRow,
} from '@/lib/ranking'
import {useAuthStore} from '@/stores/auth'
import type {Difficulty, GameMode, SessionResult} from '@/types/game'

/**
 * Partidas competitivas: guardarlas y consultar la clasificación.
 *
 * Las dos mitades comparten dominio —la tabla `game_sessions` y sus vistas— así
 * que viven en el mismo store. Es el único sitio que habla con Supabase sobre
 * resultados; los componentes pasan por `useRanking()` (`CLAUDE.md` §6 y §8).
 */

/**
 * Qué pasó al intentar guardar una partida.
 *
 * Es una unión explícita y no un booleano porque la pantalla de resultado dice
 * cosas distintas en cada caso, y «no se guardó» por ser invitado no es un
 * error que haya que disculpar: es el modo invitado funcionando.
 */
export type SaveOutcome = 'saved' | 'guest' | 'offline' | 'not-persisted' | 'error'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export const useRankingStore = defineStore('ranking', () => {
	// ── Guardado de partidas
	const lastSaveOutcome = ref<SaveOutcome | null>(null)
	const isSaving = ref(false)

	// ── Consulta de la clasificación
	const entries = ref<RankingEntry[]>([])
	const loadStatus = ref<LoadStatus>('idle')
	const loadError = ref<string | null>(null)
	/** Combinación cargada ahora mismo, para no repetir la consulta al volver. */
	const loadedMode = ref<GameMode | null>(null)
	const loadedDifficulty = ref<Difficulty | null>(null)

	const isLoading = computed(() => loadStatus.value === 'loading')
	const isEmpty = computed(() => loadStatus.value === 'ready' && entries.value.length === 0)

	/**
	 * Guarda el resultado si procede.
	 *
	 * Devuelve el motivo en todos los casos en lugar de fallar en silencio: la
	 * pantalla de resultado necesita distinguir «guardada» de «no se guarda porque
	 * juegas como invitado» y de «no pudimos guardarla».
	 */
	async function saveResult(result: SessionResult): Promise<SaveOutcome> {
		const auth = useAuthStore()

		const outcome = await runSave(result, auth.userId)

		lastSaveOutcome.value = outcome

		return outcome
	}

	async function runSave(result: SessionResult, userId: string | null): Promise<SaveOutcome> {
		if (supabase === null) return 'offline'
		if (userId === null) return 'guest'
		// Una derrota en Objetivo no tiene tiempo que comparar: no se guarda.
		if (!isPersistable(result)) return 'not-persisted'

		isSaving.value = true

		const {error} = await supabase.from('game_sessions').insert({
			user_id: userId,
			mode: result.mode,
			// La columna se llama `level` y guarda la dificultad elegida.
			level: result.difficulty,
			status: result.status,
			time_ms: result.timeMs,
			errors: result.errors,
			verbs_matched: result.verbsMatched,
			completed_at: result.completedAt,
		})

		isSaving.value = false

		return error === null ? 'saved' : 'error'
	}

	/**
	 * Carga la clasificación de un modo y nivel.
	 *
	 * Cada modo tiene su vista y su orden porque «el mejor» significa cosas
	 * distintas: en Objetivo el menor tiempo, en Precisión el mayor ritmo. Las dos
	 * ramas se escriben enteras en lugar de parametrizar el nombre de la vista,
	 * para que el cliente tipado siga sabiendo qué columnas existen en cada una.
	 */
	async function loadRanking(mode: GameMode, difficulty: Difficulty): Promise<void> {
		if (supabase === null) {
			loadStatus.value = 'error'
			loadError.value = 'No hay conexión con el servidor: la clasificación no está disponible.'
			return
		}

		loadStatus.value = 'loading'
		loadError.value = null
		loadedMode.value = mode
		loadedDifficulty.value = difficulty

		const response =
			mode === 'target'
				? await supabase
						.from('target_ranking')
						.select('*')
						.eq('level', difficulty)
						.order('time_ms', {ascending: true})
						.limit(RANKING_PAGE_SIZE)
				: await supabase
						.from('precision_ranking')
						.select('*')
						.eq('level', difficulty)
						.order('pace', {ascending: false})
						.limit(RANKING_PAGE_SIZE)

		/*
		 * Se comprueba que la petición siga siendo la última: si el usuario cambia
		 * de pestaña mientras una consulta está en vuelo, la respuesta lenta de la
		 * anterior no debe pisar a la nueva.
		 */
		if (loadedMode.value !== mode || loadedDifficulty.value !== difficulty) return

		if (response.error !== null) {
			loadStatus.value = 'error'
			loadError.value = 'No se pudo cargar la clasificación. Inténtalo de nuevo.'
			entries.value = []
			return
		}

		entries.value = toRankingEntries(response.data as RankingRow[], mode)
		loadStatus.value = 'ready'
	}

	function reset(): void {
		entries.value = []
		loadStatus.value = 'idle'
		loadError.value = null
		loadedMode.value = null
		loadedDifficulty.value = null
	}

	return {
		// Guardado
		lastSaveOutcome,
		isSaving,
		saveResult,
		// Clasificación
		entries,
		loadStatus,
		loadError,
		loadedMode,
		loadedDifficulty,
		isLoading,
		isEmpty,
		loadRanking,
		reset,
	}
})
