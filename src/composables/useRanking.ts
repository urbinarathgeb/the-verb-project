import {storeToRefs} from 'pinia'
import {useRankingStore} from '@/stores/ranking'

/**
 * Interfaz pública de las partidas competitivas: guardar un resultado y leer la
 * clasificación.
 *
 * Es el único punto por el que la UI toca ese estado (`CLAUDE.md` §6). Estado y
 * getters con `storeToRefs` para no perder la reactividad; las acciones, del
 * store directamente.
 */
export function useRanking() {
	const store = useRankingStore()

	const {
		lastSaveOutcome,
		isSaving,
		personalBestMetric,
		position,
		lastVerdict,
		entries,
		loadStatus,
		loadError,
		loadedMode,
		loadedDifficulty,
		isLoading,
		isEmpty,
	} = storeToRefs(store)

	const {saveResult, submitResult, loadRanking, clearStanding, reset} = store

	return {
		lastSaveOutcome,
		isSaving,
		personalBestMetric,
		position,
		lastVerdict,
		entries,
		loadStatus,
		loadError,
		loadedMode,
		loadedDifficulty,
		isLoading,
		isEmpty,
		saveResult,
		submitResult,
		loadRanking,
		clearStanding,
		reset,
	}
}
