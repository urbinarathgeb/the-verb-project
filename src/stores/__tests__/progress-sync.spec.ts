import {afterEach, describe, expect, it, vi} from 'vitest'

/**
 * Sincronización del progreso contra Supabase. Va en un archivo aparte de
 * `progress.spec.ts` porque necesita simular el módulo del cliente, y eso obliga
 * a reiniciar el registro de módulos en cada caso.
 */

afterEach(() => {
	vi.resetModules()
})

interface FakeOptions {
	rpcError?: {message: string} | null
	rows?: {verb_id: number; hits: number; misses: number; last_practiced_at: string}[]
	selectError?: {message: string} | null
	/** Deja la llamada en el aire hasta que se resuelva a mano. */
	holdRpc?: boolean
}

function createFakeClient(options: FakeOptions = {}) {
	const rpcCalls: {name: string; params: unknown}[] = []
	let releaseRpc: (() => void) | null = null
	let announceRpc: (() => void) | null = null

	/**
	 * Se resuelve cuando la petición ha salido de verdad.
	 *
	 * Los casos de «se responde mientras está en vuelo» tienen que esperarla en
	 * lugar de dar por hecho que `syncPending()` vacía la cola en el mismo tick:
	 * el cliente se resuelve de forma asíncrona porque el SDK se carga bajo
	 * demanda. Esperar al hecho, y no a un número de microtareas, deja el test a
	 * salvo de cómo esté escrito el store por dentro.
	 */
	const rpcCalled = new Promise<void>((resolve) => {
		announceRpc = resolve
	})

	const client = {
		rpc: (name: string, params: unknown) => {
			rpcCalls.push({name, params})
			announceRpc?.()

			if (options.holdRpc !== true) {
				return Promise.resolve({error: options.rpcError ?? null})
			}

			return new Promise((resolve) => {
				releaseRpc = () => resolve({error: options.rpcError ?? null})
			})
		},
		from: () => ({
			select: () => Promise.resolve({data: options.rows ?? [], error: options.selectError ?? null}),
		}),
	}

	return {
		client,
		rpcCalls,
		rpcCalled,
		releaseRpc: () => releaseRpc?.(),
	}
}

async function loadStore(
	client: ReturnType<typeof createFakeClient>['client'] | null,
	userId: string | null,
) {
	vi.resetModules()
	vi.doMock('@/lib/supabase', () => ({
		// El SDK se carga bajo demanda, así que el módulo expone una función que
		// resuelve al cliente en lugar de la instancia ya creada.
		getSupabase: () => Promise.resolve(client),
		isSupabaseConfigured: client !== null,
	}))

	const {createPinia, setActivePinia} = await import('pinia')
	setActivePinia(createPinia())

	const {useProgressStore} = await import('@/stores/progress')
	const {useAuthStore} = await import('@/stores/auth')

	if (userId !== null) {
		useAuthStore().session = {user: {id: userId, user_metadata: {}}} as never
	}

	return useProgressStore()
}

describe('acumulación de incrementos', () => {
	it('cuenta aciertos y fallos por verbo', async () => {
		const store = await loadStore(null, null)

		store.recordAnswer(7, true)
		store.recordAnswer(7, true)
		store.recordAnswer(7, false)
		store.recordAnswer(9, false)

		expect(store.pending).toEqual({7: {hits: 2, misses: 1}, 9: {hits: 0, misses: 1}})
		expect(store.hasPendingChanges).toBe(true)
	})

	it('empieza sin nada pendiente', async () => {
		const store = await loadStore(null, null)

		expect(store.hasPendingChanges).toBe(false)
	})
})

describe('enviar los incrementos', () => {
	/**
	 * Se envían INCREMENTOS y no totales. Mandar totales calculados desde la copia
	 * local haría que practicar en dos dispositivos sin recargar borrara lo
	 * aprendido en el otro.
	 */
	it('manda a la función los incrementos, no los totales', async () => {
		const fake = createFakeClient()
		const store = await loadStore(fake.client, 'uuid-1')

		store.recordAnswer(7, true)
		store.recordAnswer(7, true)
		store.recordAnswer(9, false)

		expect(await store.syncPending()).toBe('saved')
		expect(fake.rpcCalls).toEqual([
			{
				name: 'record_practice_progress',
				params: {
					entries: [
						{verb_id: 7, hits: 2, misses: 0},
						{verb_id: 9, hits: 0, misses: 1},
					],
				},
			},
		])
	})

	it('vacía la cola tras enviarla', async () => {
		const fake = createFakeClient()
		const store = await loadStore(fake.client, 'uuid-1')

		store.recordAnswer(7, true)
		await store.syncPending()

		expect(store.hasPendingChanges).toBe(false)
		expect(store.isSyncing).toBe(false)
	})

	it('no llama a la función si no hay nada que enviar', async () => {
		const fake = createFakeClient()
		const store = await loadStore(fake.client, 'uuid-1')

		expect(await store.syncPending()).toBe('empty')
		expect(fake.rpcCalls).toEqual([])
	})

	/** Sin sesión no hay a quién atribuir el progreso, y eso no es un error. */
	it('no envía nada como invitado', async () => {
		const fake = createFakeClient()
		const store = await loadStore(fake.client, null)

		store.recordAnswer(7, true)

		expect(await store.syncPending()).toBe('guest')
		expect(fake.rpcCalls).toEqual([])
		// La cola se conserva: si el jugador entra luego, no se ha perdido nada.
		expect(store.hasPendingChanges).toBe(true)
	})

	it('informa cuando no hay backend', async () => {
		const store = await loadStore(null, null)

		store.recordAnswer(7, true)

		expect(await store.syncPending()).toBe('offline')
	})

	/** Un fallo de red no puede tragarse las respuestas del jugador. */
	it('devuelve los incrementos a la cola si el envío falla', async () => {
		const fake = createFakeClient({rpcError: {message: 'sin red'}})
		const store = await loadStore(fake.client, 'uuid-1')

		store.recordAnswer(7, true)
		store.recordAnswer(7, false)

		expect(await store.syncPending()).toBe('error')
		expect(store.pending).toEqual({7: {hits: 1, misses: 1}})
		expect(store.syncError).not.toBeNull()
	})

	/**
	 * El caso delicado: se responde mientras la petición está en vuelo. La cola se
	 * vacía ANTES de enviar, así que lo nuevo entra en una cola limpia; si el
	 * envío falla, lo viejo debe **sumarse** a lo nuevo en lugar de pisarlo.
	 */
	it('suma lo respondido durante el envío en lugar de perderlo', async () => {
		const fake = createFakeClient({holdRpc: true, rpcError: {message: 'sin red'}})
		const store = await loadStore(fake.client, 'uuid-1')

		store.recordAnswer(7, true)

		const inFlight = store.syncPending()
		await fake.rpcCalled

		// Llega una respuesta más mientras la petición sigue abierta.
		store.recordAnswer(7, true)
		store.recordAnswer(8, false)

		fake.releaseRpc()
		await inFlight

		expect(store.pending).toEqual({7: {hits: 2, misses: 0}, 8: {hits: 0, misses: 1}})
	})

	it('no reenvía lo que ya llegó bien si se responde durante el envío', async () => {
		const fake = createFakeClient({holdRpc: true})
		const store = await loadStore(fake.client, 'uuid-1')

		store.recordAnswer(7, true)

		const inFlight = store.syncPending()
		await fake.rpcCalled

		store.recordAnswer(8, true)

		fake.releaseRpc()
		await inFlight

		// Sólo queda lo nuevo: el verbo 7 ya se guardó y reenviarlo lo contaría dos veces.
		expect(store.pending).toEqual({8: {hits: 1, misses: 0}})
	})
})

describe('cargar el progreso guardado', () => {
	it('reemplaza el estado con lo que hay en el servidor', async () => {
		const fake = createFakeClient({
			rows: [
				{verb_id: 7, hits: 5, misses: 1, last_practiced_at: '2026-08-01T10:00:00Z'},
				{verb_id: 9, hits: 2, misses: 3, last_practiced_at: '2026-08-02T10:00:00Z'},
			],
		})
		const store = await loadStore(fake.client, 'uuid-1')

		await store.loadProgress()

		expect(store.progressFor(7)).toEqual({
			verbId: 7,
			correct: 5,
			wrong: 1,
			lastPracticedAt: '2026-08-01T10:00:00Z',
		})
		expect(store.practicedCount).toBe(2)
	})

	/**
	 * Lo practicado como invitado no se sube al iniciar sesión: no se pidió
	 * atribuírselo a nadie, y subirlo falsearía las estadísticas de esa cuenta.
	 */
	it('descarta lo practicado como invitado', async () => {
		const fake = createFakeClient({rows: []})
		const store = await loadStore(fake.client, 'uuid-1')

		store.recordAnswer(7, true)
		expect(store.hasPendingChanges).toBe(true)

		await store.loadProgress()

		expect(store.hasPendingChanges).toBe(false)
		expect(store.practicedCount).toBe(0)
	})

	it('no toca el estado si la consulta falla', async () => {
		const fake = createFakeClient({selectError: {message: 'boom'}})
		const store = await loadStore(fake.client, 'uuid-1')

		store.recordAnswer(7, true)
		await store.loadProgress()

		expect(store.progressFor(7).correct).toBe(1)
	})

	it('no consulta nada como invitado', async () => {
		const fake = createFakeClient({rows: [{verb_id: 7, hits: 9, misses: 0, last_practiced_at: ''}]})
		const store = await loadStore(fake.client, null)

		await store.loadProgress()

		expect(store.practicedCount).toBe(0)
	})
})

describe('cerrar sesión', () => {
	/**
	 * Vaciar la cola al salir es imprescindible: si no, el progreso de quien acaba
	 * de cerrar sesión se subiría a la cuenta del siguiente que entre.
	 */
	it('borra también los incrementos sin enviar', async () => {
		const store = await loadStore(null, null)

		store.recordAnswer(7, true)
		store.resetProgress()

		expect(store.hasPendingChanges).toBe(false)
		expect(store.practicedCount).toBe(0)
	})
})
