import {storeToRefs} from 'pinia'
import {getCellStatus} from '@/lib/board'
import {useGameStore} from '@/stores/game'
import type {Cell, CellStatus} from '@/types/game'

/**
 * Interfaz pública del motor de juego.
 *
 * Es el **único** punto por el que la UI toca el estado de la partida: ningún
 * componente importa `useGameStore` directamente (`CLAUDE.md` §6). Así, si mañana
 * el estado deja de vivir en Pinia o el store se parte en dos, los componentes no
 * se enteran.
 *
 * El estado y los getters se extraen con `storeToRefs`; las acciones se toman
 * directamente del store. Desestructurar un store de Pinia sin `storeToRefs`
 * rompe la reactividad —los valores quedan congelados en el momento de la
 * desestructuración— y `storeToRefs` a su vez no incluye las acciones, así que
 * cada cosa va por su vía (skill `vue-pinia-best-practices`,
 * `pinia-store-destructuring-breaks-reactivity`).
 */
export function useGameEngine() {
	const store = useGameStore()

	// Estado y getters: reactivos vía `storeToRefs`.
	const {
		// Configuración de la partida
		mode,
		difficulty,
		level,
		status,
		// Tablero
		columns,
		selection,
		errorCellIds,
		resolvedVerbIds,
		visibleCount,
		vacatedCount,
		isCleared,
		// Marcadores
		matchedCount,
		errors,
		mistakes,
		targetVerbs,
		remainingTargets,
		pace,
		// Reloj
		elapsedMs,
		remainingMs,
		progress,
		timeLimitMs,
		// Desenlace
		isPlaying,
		isFinished,
		result,
		isRankingEligible,
	} = storeToRefs(store)

	// Acciones: funciones, no necesitan `storeToRefs`.
	const {startGame, selectCell, finish, clearError, resetGame} = store

	/**
	 * Estado visual de una celda, para que el componente no tenga que combinar
	 * selección, errores y verbos resueltos por su cuenta.
	 */
	function cellStatus(cell: Cell): CellStatus {
		return getCellStatus(cell, selection.value, errorCellIds.value, resolvedVerbIds.value)
	}

	/**
	 * ¿Se puede pulsar esta celda? Sirve para `disabled` y para `aria-disabled`:
	 * fuera de la partida y sobre un verbo ya resuelto, el tablero es inerte.
	 */
	function isCellSelectable(cell: Cell): boolean {
		return isPlaying.value && !resolvedVerbIds.value.includes(cell.verbId)
	}

	return {
		// Configuración
		mode,
		difficulty,
		level,
		status,
		// Tablero
		columns,
		selection,
		errorCellIds,
		resolvedVerbIds,
		visibleCount,
		vacatedCount,
		isCleared,
		cellStatus,
		isCellSelectable,
		// Marcadores
		matchedCount,
		errors,
		mistakes,
		targetVerbs,
		remainingTargets,
		pace,
		// Reloj
		elapsedMs,
		remainingMs,
		progress,
		timeLimitMs,
		// Desenlace
		isPlaying,
		isFinished,
		result,
		isRankingEligible,
		// Acciones
		startGame,
		selectCell,
		finish,
		clearError,
		resetGame,
	}
}
