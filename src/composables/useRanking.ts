import {storeToRefs} from 'pinia'
import {useRankingStore} from '@/stores/ranking'

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
