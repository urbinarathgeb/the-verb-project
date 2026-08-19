import {computed, ref} from 'vue'
import {defineStore} from 'pinia'
import {getSupabase} from '@/lib/supabase'
import {
	RANKING_PAGE_SIZE,
	bestMetricAfter,
	compareWithPersonalBest,
	isPersistable,
	toRankingEntries,
	type RankingEntry,
	type RankingRow,
	type RecordVerdict,
} from '@/lib/ranking'
import {useAuthStore} from '@/stores/auth'
import type {Difficulty, GameMode, SessionResult} from '@/types/game'

export type SaveOutcome = 'saved' | 'guest' | 'offline' | 'not-persisted' | 'error'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export const useRankingStore = defineStore('ranking', () => {
	const lastSaveOutcome = ref<SaveOutcome | null>(null)
	const isSaving = ref(false)

	const entries = ref<RankingEntry[]>([])
	const loadStatus = ref<LoadStatus>('idle')
	const loadError = ref<string | null>(null)
	const loadedMode = ref<GameMode | null>(null)
	const loadedDifficulty = ref<Difficulty | null>(null)

	const isLoading = computed(() => loadStatus.value === 'loading')
	const isEmpty = computed(() => loadStatus.value === 'ready' && entries.value.length === 0)

	const personalBestMetric = ref<number | null>(null)
	const position = ref<number | null>(null)
	const lastVerdict = ref<RecordVerdict | null>(null)

	async function loadPersonalBest(mode: GameMode, difficulty: Difficulty): Promise<number | null> {
		const client = await getSupabase()
		if (client === null) return null

		const userId = useAuthStore().userId
		if (userId === null) return null

		const response =
			mode === 'target'
				? await client
						.from('target_ranking')
						.select('time_ms')
						.eq('level', difficulty)
						.eq('user_id', userId)
						.maybeSingle()
				: await client
						.from('precision_ranking')
						.select('pace')
						.eq('level', difficulty)
						.eq('user_id', userId)
						.maybeSingle()

		if (response.error !== null || response.data === null) return null

		return mode === 'target'
			? ((response.data as {time_ms: number | null}).time_ms ?? null)
			: ((response.data as {pace: number | null}).pace ?? null)
	}

	async function loadPosition(
		mode: GameMode,
		difficulty: Difficulty,
		metric: number,
	): Promise<number | null> {
		const client = await getSupabase()
		if (client === null) return null

		const userId = useAuthStore().userId
		if (userId === null) return null

		const response =
			mode === 'target'
				? await client
						.from('target_ranking')
						.select('*', {count: 'exact', head: true})
						.eq('level', difficulty)
						.neq('user_id', userId)
						.lt('time_ms', metric)
				: await client
						.from('precision_ranking')
						.select('*', {count: 'exact', head: true})
						.eq('level', difficulty)
						.neq('user_id', userId)
						.gt('pace', metric)

		if (response.error !== null || response.count === null) return null

		return response.count + 1
	}

	function clearStanding(): void {
		personalBestMetric.value = null
		position.value = null
		lastVerdict.value = null
	}

	async function saveResult(result: SessionResult): Promise<SaveOutcome> {
		const auth = useAuthStore()

		const outcome = await runSave(result, auth.userId)

		lastSaveOutcome.value = outcome

		return outcome
	}

	async function runSave(result: SessionResult, userId: string | null): Promise<SaveOutcome> {
		const client = await getSupabase()
		if (client === null) return 'offline'
		if (userId === null) return 'guest'
		if (!isPersistable(result)) return 'not-persisted'

		isSaving.value = true

		const {error} = await client.from('game_sessions').insert({
			user_id: userId,
			mode: result.mode,
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

	async function submitResult(result: SessionResult): Promise<SaveOutcome> {
		clearStanding()

		const previousBest = await loadPersonalBest(result.mode, result.difficulty)
		const outcome = await saveResult(result)

		lastVerdict.value = compareWithPersonalBest(result, previousBest)

		if (outcome !== 'saved') return outcome

		const best = bestMetricAfter(result, previousBest)

		personalBestMetric.value = best
		position.value = await loadPosition(result.mode, result.difficulty, best)

		return outcome
	}

	async function loadRanking(mode: GameMode, difficulty: Difficulty): Promise<void> {
		const client = await getSupabase()

		if (client === null) {
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
				? await client
						.from('target_ranking')
						.select('*')
						.eq('level', difficulty)
						.order('time_ms', {ascending: true})
						.limit(RANKING_PAGE_SIZE)
				: await client
						.from('precision_ranking')
						.select('*')
						.eq('level', difficulty)
						.order('pace', {ascending: false})
						.limit(RANKING_PAGE_SIZE)

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
		lastSaveOutcome,
		isSaving,
		saveResult,
		submitResult,
		personalBestMetric,
		position,
		lastVerdict,
		loadPersonalBest,
		loadPosition,
		clearStanding,
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
