import {computed, ref} from 'vue'
import {defineStore} from 'pinia'
import {accuracyOf, emptyProgress, isMastered, type VerbProgress} from '@/lib/progress'
import {getSupabase} from '@/lib/supabase'
import {useAuthStore} from '@/stores/auth'

export interface PendingDelta {
	readonly hits: number
	readonly misses: number
}

export type SyncOutcome = 'saved' | 'empty' | 'guest' | 'offline' | 'error'

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

export {accuracyOf, isMastered, type VerbProgress}

export const useProgressStore = defineStore('progress', () => {
	const entries = ref<Record<number, VerbProgress>>({})

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

	const overallAccuracy = computed(() => {
		const total = totalCorrect.value + totalWrong.value

		return total === 0 ? 0 : totalCorrect.value / total
	})

	const masteredVerbIds = computed(() =>
		allProgress.value.filter(isMastered).map((progress) => progress.verbId),
	)

	const masteredCount = computed(() => masteredVerbIds.value.length)

	function progressFor(verbId: number): VerbProgress {
		return entries.value[verbId] ?? emptyProgress(verbId)
	}

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

		const delta = pending.value[verbId] ?? {hits: 0, misses: 0}

		pending.value = {
			...pending.value,
			[verbId]: {
				hits: delta.hits + (isCorrect ? 1 : 0),
				misses: delta.misses + (isCorrect ? 0 : 1),
			},
		}
	}

	async function syncPending(): Promise<SyncOutcome> {
		const client = await getSupabase()
		if (client === null) return 'offline'

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

		const {error} = await client.rpc('record_practice_progress', {entries: batch})

		isSyncing.value = false

		if (error !== null) {
			pending.value = mergeDeltas(inFlight, pending.value)
			syncError.value = 'No se pudo guardar tu progreso. Se reintentará.'

			return 'error'
		}

		syncError.value = null

		return 'saved'
	}

	async function loadProgress(): Promise<void> {
		const client = await getSupabase()
		if (client === null) return

		const userId = useAuthStore().userId
		if (userId === null) return

		const {data, error} = await client
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

	function resetProgress(): void {
		entries.value = {}
		pending.value = {}
		syncError.value = null
	}

	return {
		entries,
		pending,
		isSyncing,
		syncError,
		allProgress,
		practicedCount,
		totalCorrect,
		totalWrong,
		overallAccuracy,
		masteredVerbIds,
		masteredCount,
		hasPendingChanges,
		progressFor,
		recordAnswer,
		syncPending,
		loadProgress,
		resetProgress,
	}
})
