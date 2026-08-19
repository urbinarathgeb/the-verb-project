import {computed, type ComputedRef} from 'vue'
import {storeToRefs} from 'pinia'
import {VERBS} from '@/data/verbs'
import {summarize, toReviewRows, type ProgressRow, type ProgressSummary} from '@/lib/progress'
import {useProgressStore} from '@/stores/progress'

export interface UseProgressReturn {
	rows: ComputedRef<ProgressRow[]>
	summary: ComputedRef<ProgressSummary>
	loadProgress: () => Promise<void>
}

export function useProgress(): UseProgressReturn {
	const store = useProgressStore()
	const {entries} = storeToRefs(store)

	const rows = computed(() => toReviewRows(VERBS, entries.value))
	const summary = computed(() => summarize(rows.value, VERBS.length))

	return {rows, summary, loadProgress: store.loadProgress}
}
