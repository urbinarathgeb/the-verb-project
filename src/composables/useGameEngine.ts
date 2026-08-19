import {storeToRefs} from 'pinia'
import {getCellStatus} from '@/lib/board'
import {useGameStore} from '@/stores/game'
import type {Cell, CellStatus} from '@/types/game'

export function useGameEngine() {
	const store = useGameStore()

	const {
		mode,
		difficulty,
		level,
		status,
		columns,
		selection,
		errorCellIds,
		resolvedVerbIds,
		visibleCount,
		vacatedCount,
		isCleared,
		matchedCount,
		errors,
		mistakes,
		targetVerbs,
		remainingTargets,
		pace,
		elapsedMs,
		remainingMs,
		progress,
		timeLimitMs,
		isPlaying,
		isPaused,
		isFinished,
		result,
		isRankingEligible,
	} = storeToRefs(store)

	const {startGame, selectCell, finish, pause, resume, clearError, resetGame} = store

	function cellStatus(cell: Cell): CellStatus {
		return getCellStatus(cell, selection.value, errorCellIds.value, resolvedVerbIds.value)
	}

	function isCellSelectable(cell: Cell): boolean {
		if (!isPlaying.value || isPaused.value) return false

		return !resolvedVerbIds.value.includes(cell.verbId)
	}

	return {
		mode,
		difficulty,
		level,
		status,
		columns,
		selection,
		errorCellIds,
		resolvedVerbIds,
		visibleCount,
		vacatedCount,
		isCleared,
		cellStatus,
		isCellSelectable,
		matchedCount,
		errors,
		mistakes,
		targetVerbs,
		remainingTargets,
		pace,
		elapsedMs,
		remainingMs,
		progress,
		timeLimitMs,
		isPlaying,
		isPaused,
		isFinished,
		result,
		isRankingEligible,
		startGame,
		selectCell,
		finish,
		pause,
		resume,
		clearError,
		resetGame,
	}
}
