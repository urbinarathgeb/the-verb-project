import {ref} from 'vue'
import {defineStore} from 'pinia'
import {DIFFICULTIES, MENU_MODES, type Difficulty, type MenuMode} from '@/types/game'

export const useSetupStore = defineStore('setup', () => {
	const mode = ref<MenuMode>('target')
	const difficulty = ref<Difficulty>('easy')

	function setMode(next: MenuMode): void {
		if (!MENU_MODES.some((candidate) => candidate === next)) return

		mode.value = next
	}

	function setDifficulty(next: Difficulty): void {
		if (!DIFFICULTIES.some((candidate) => candidate === next)) return

		difficulty.value = next
	}

	return {mode, difficulty, setMode, setDifficulty}
})
