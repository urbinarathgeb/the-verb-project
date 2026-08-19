import {afterEach, describe, expect, it, vi} from 'vitest'

const URL_KEY = 'VITE_SUPABASE_URL'
const KEY_KEY = 'VITE_SUPABASE_ANON_KEY'

afterEach(() => {
	vi.unstubAllEnvs()
	vi.resetModules()
})

async function loadModule({withCredentials}: {withCredentials: boolean}) {
	vi.resetModules()

	vi.stubEnv(URL_KEY, withCredentials ? 'https://ejemplo.supabase.co' : '')
	vi.stubEnv(KEY_KEY, withCredentials ? 'clave-anonima' : '')

	const state = {imports: 0, createCalls: 0}

	vi.doMock('@supabase/supabase-js', () => {
		state.imports += 1

		return {
			createClient: () => {
				state.createCalls += 1
				return {marca: 'cliente-falso'}
			},
		}
	})

	const module = await import('@/lib/supabase')

	return {module, state}
}

describe('disponibilidad del backend', () => {
	it('se resuelve sin cargar el SDK', async () => {
		const {module, state} = await loadModule({withCredentials: true})

		expect(module.isSupabaseConfigured).toBe(true)
		expect(state.imports).toBe(0)
	})

	it('sin credenciales queda en modo invitado', async () => {
		const {module, state} = await loadModule({withCredentials: false})

		expect(module.isSupabaseConfigured).toBe(false)
		expect(await module.getSupabase()).toBeNull()
		expect(state.imports).toBe(0)
	})
})

describe('obtener el cliente', () => {
	it('carga el SDK sólo al pedirlo', async () => {
		const {module, state} = await loadModule({withCredentials: true})

		expect(state.imports).toBe(0)

		const client = await module.getSupabase()

		expect(client).not.toBeNull()
		expect(state.imports).toBe(1)
	})

	it('devuelve siempre la misma instancia', async () => {
		const {module, state} = await loadModule({withCredentials: true})

		const [first, second] = await Promise.all([module.getSupabase(), module.getSupabase()])

		expect(first).toBe(second)
		expect(state.createCalls).toBe(1)
	})

	it('memoriza también entre llamadas sucesivas', async () => {
		const {module, state} = await loadModule({withCredentials: true})

		await module.getSupabase()
		await module.getSupabase()

		expect(state.createCalls).toBe(1)
	})
})
