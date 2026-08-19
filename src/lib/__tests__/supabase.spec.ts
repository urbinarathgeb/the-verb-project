import {afterEach, describe, expect, it, vi} from 'vitest'

/**
 * Carga diferida del cliente de Supabase.
 *
 * Lo que se vigila aquí no es sólo que el cliente se cree bien, sino que **el
 * SDK no se cargue hasta que alguien lo pida**: es una optimización que se
 * pierde en silencio en cuanto alguien añada un `import` estático de
 * `@supabase/supabase-js` en `lib/supabase.ts`, y sin este test nadie se
 * enteraría hasta mirar el tamaño del bundle.
 */

const URL_KEY = 'VITE_SUPABASE_URL'
const KEY_KEY = 'VITE_SUPABASE_ANON_KEY'

afterEach(() => {
	vi.unstubAllEnvs()
	vi.resetModules()
})

/** Simula el SDK y devuelve el módulo bajo prueba junto al contador de cargas. */
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
		// El punto entero de la optimización: leer si hay backend no descarga nada.
		expect(state.imports).toBe(0)
	})

	it('sin credenciales queda en modo invitado', async () => {
		const {module, state} = await loadModule({withCredentials: false})

		expect(module.isSupabaseConfigured).toBe(false)
		expect(await module.getSupabase()).toBeNull()
		// Sin credenciales no hay nada que crear, así que tampoco se carga el SDK.
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

	/**
	 * Dos clientes serían dos `onAuthStateChange`: el segundo dejaría al primero
	 * escuchando sobre una instancia que ya nadie usa.
	 */
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
