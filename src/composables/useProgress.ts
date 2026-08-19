import {computed, type ComputedRef} from 'vue'
import {storeToRefs} from 'pinia'
import {VERBS} from '@/data/verbs'
import {summarize, toReviewRows, type ProgressRow, type ProgressSummary} from '@/lib/progress'
import {useProgressStore} from '@/stores/progress'

/**
 * Interfaz pública del progreso del Dojo.
 *
 * Como `useGameEngine` y `useAuth`, es el único punto por el que la UI toca este
 * estado (`CLAUDE.md` §6, aplicado por ESLint). Aquí se combina lo que guarda el
 * store —respuestas por verbo— con el catálogo, que es dato estático y no tiene
 * por qué vivir en Pinia.
 */
export interface UseProgressReturn {
	/** Verbos practicados, ordenados por lo que conviene repasar. */
	rows: ComputedRef<ProgressRow[]>
	summary: ComputedRef<ProgressSummary>
	/** Trae lo guardado en el servidor. Sin sesión no hace nada. */
	loadProgress: () => Promise<void>
}

export function useProgress(): UseProgressReturn {
	const store = useProgressStore()
	const {entries} = storeToRefs(store)

	const rows = computed(() => toReviewRows(VERBS, entries.value))
	const summary = computed(() => summarize(rows.value, VERBS.length))

	return {rows, summary, loadProgress: store.loadProgress}
}
