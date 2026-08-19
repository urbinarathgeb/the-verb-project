import {computed, type ComputedRef, type Ref} from 'vue'
import {storeToRefs} from 'pinia'
import type {RouteLocationRaw} from 'vue-router'
import {LEVELS} from '@/data/levels'
import {MODE_DESCRIPTIONS} from '@/data/modes'
import {getVerbsForDifficulty} from '@/data/verbs'
import {useSetupStore} from '@/stores/setup'
import {PRACTICE_MODE, type Difficulty, type MenuMode} from '@/types/game'

export interface UseGameSetupReturn {
	mode: Ref<MenuMode>
	difficulty: Ref<Difficulty>
	setMode: (mode: MenuMode) => void
	setDifficulty: (difficulty: Difficulty) => void
	modeDescription: ComputedRef<string>
	levelSummary: ComputedRef<string>
	destination: ComputedRef<RouteLocationRaw>
}

export function useGameSetup(): UseGameSetupReturn {
	const store = useSetupStore()
	const {mode, difficulty} = storeToRefs(store)

	const modeDescription = computed(() => MODE_DESCRIPTIONS[mode.value])

	const levelSummary = computed(() => {
		const level = LEVELS[difficulty.value]
		const pool = `${getVerbsForDifficulty(difficulty.value).length} verbos`
		const size = `${level.boardSize} en pantalla`

		if (mode.value === PRACTICE_MODE) return `${pool} · preguntas de este nivel`

		return mode.value === 'target'
			? `${pool} · ${size} · objetivo de ${level.targetVerbs} · ${level.timeLimitMs / 1000} s`
			: `${pool} · ${size} · hasta el primer fallo`
	})

	const destination = computed(() =>
		mode.value === PRACTICE_MODE
			? {name: 'practice', params: {difficulty: difficulty.value}}
			: {name: 'play', params: {mode: mode.value, difficulty: difficulty.value}},
	)

	return {
		mode,
		difficulty,
		setMode: store.setMode,
		setDifficulty: store.setDifficulty,
		modeDescription,
		levelSummary,
		destination,
	}
}
