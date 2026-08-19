import {beforeEach, describe, expect, it} from 'vitest'
import {createPinia, setActivePinia} from 'pinia'
import {useSetupStore} from '@/stores/setup'
import type {Difficulty, MenuMode} from '@/types/game'

beforeEach(() => {
	setActivePinia(createPinia())
})

describe('store de configuración de partida', () => {
	it('arranca en Contrarreloj y nivel fácil', () => {
		const store = useSetupStore()

		expect(store.mode).toBe('target')
		expect(store.difficulty).toBe('easy')
	})

	it('recuerda el modo elegido', () => {
		const store = useSetupStore()

		store.setMode('precision')

		expect(store.mode).toBe('precision')
	})

	it('recuerda el nivel elegido', () => {
		const store = useSetupStore()

		store.setDifficulty('hard')

		expect(store.difficulty).toBe('hard')
	})

	it('acepta el Dojo como modo, porque en el menú es un modo más', () => {
		const store = useSetupStore()

		store.setMode('practice')

		expect(store.mode).toBe('practice')
	})

	it('ignora un modo que no existe y conserva el anterior', () => {
		const store = useSetupStore()
		store.setMode('precision')

		store.setMode('supervivencia' as MenuMode)

		expect(store.mode).toBe('precision')
	})

	it('ignora un nivel que no existe y conserva el anterior', () => {
		const store = useSetupStore()
		store.setDifficulty('medium')

		store.setDifficulty('imposible' as Difficulty)

		expect(store.difficulty).toBe('medium')
	})

	it('mantiene la elección entre lecturas del store, que es su razón de ser', () => {
		useSetupStore().setMode('practice')
		useSetupStore().setDifficulty('hard')

		const later = useSetupStore()

		expect(later.mode).toBe('practice')
		expect(later.difficulty).toBe('hard')
	})
})
