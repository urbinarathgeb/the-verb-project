import {afterEach, describe, expect, it, vi} from 'vitest'
import type {SessionResult} from '@/types/game'

afterEach(() => {
	vi.resetModules()
})

function makeResult(overrides: Partial<SessionResult> = {}): SessionResult {
	return {
		mode: 'precision',
		difficulty: 'easy',
		status: 'lost',
		timeMs: 60_000,
		errors: 0,
		verbsMatched: 10,
		completedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	}
}

interface FakeOptions {
	rows?: Record<string, unknown>[]
	/** Filas distintas por vista, para distinguir qué respuesta ganó una carrera. */
	rowsByTable?: Record<string, Record<string, unknown>[]>
	selectError?: {message: string} | null
	insertError?: {message: string} | null
	/** Retrasa la respuesta de la consulta, para provocar carreras a propósito. */
	selectDelayMs?: number
	/** Retraso por vista, para decidir qué respuesta llega la última. */
	delaysByTable?: Record<string, number>
}

/**
 * Doble del cliente, limitado a lo que usa el store. Imita el encadenamiento de
 * PostgREST (`from().select().eq().order().limit()`), que sólo resuelve al
 * esperarlo, y anota cada llamada para poder afirmar sobre la consulta emitida.
 */
function createFakeClient(options: FakeOptions = {}) {
	const inserts: Record<string, unknown>[] = []
	const queries: {table: string; column?: string; value?: unknown; ascending?: boolean}[] = []

	const client = {
		from: (table: string) => ({
			insert: (values: Record<string, unknown>) => {
				inserts.push({table, ...values})

				return Promise.resolve({error: options.insertError ?? null})
			},
			select: () => {
				const query: (typeof queries)[number] = {table}
				queries.push(query)

				const chain = {
					eq: (column: string, value: unknown) => {
						query.column = column
						query.value = value
						return chain
					},
					order: (_column: string, config: {ascending: boolean}) => {
						query.ascending = config.ascending
						return chain
					},
					limit: () => chain,
					// PostgREST es "thenable": la consulta se dispara al esperarla.
					then: (resolve: (value: unknown) => void) => {
						const rows = options.rowsByTable?.[table] ?? options.rows ?? []
						const settle = () => resolve({data: rows, error: options.selectError ?? null})
						const delay = options.delaysByTable?.[table] ?? options.selectDelayMs

						if (delay === undefined) settle()
						else setTimeout(settle, delay)
					},
				}

				return chain
			},
		}),
	}

	return {client, inserts, queries}
}

/**
 * Carga el store con el cliente y el usuario indicados.
 *
 * Igual que en los tests de `auth`, hace falta reiniciar el registro de módulos
 * y reimportar Pinia: `@/lib/supabase` expone constantes evaluadas al importar.
 */
async function loadStore(
	client: ReturnType<typeof createFakeClient>['client'] | null,
	userId: string | null,
) {
	vi.resetModules()
	vi.doMock('@/lib/supabase', () => ({supabase: client, isSupabaseConfigured: client !== null}))

	const {createPinia, setActivePinia} = await import('pinia')
	setActivePinia(createPinia())

	const {useRankingStore} = await import('@/stores/ranking')
	const {useAuthStore} = await import('@/stores/auth')

	const auth = useAuthStore()
	// Se fija la sesión directamente: aquí se prueba el ranking, no el login.
	if (userId !== null) {
		auth.session = {user: {id: userId, user_metadata: {}}} as never
	}

	return useRankingStore()
}

describe('guardar una partida', () => {
	it('inserta la partida del usuario autenticado', async () => {
		const fake = createFakeClient()
		const store = await loadStore(fake.client, 'uuid-1')

		const outcome = await store.saveResult(
			makeResult({mode: 'target', status: 'won', difficulty: 'hard', timeMs: 42_000}),
		)

		expect(outcome).toBe('saved')
		expect(fake.inserts).toEqual([
			{
				table: 'game_sessions',
				user_id: 'uuid-1',
				mode: 'target',
				level: 'hard',
				status: 'won',
				time_ms: 42_000,
				errors: 0,
				verbs_matched: 10,
				completed_at: '2026-01-01T00:00:00.000Z',
			},
		])
	})

	/** El modo invitado no persiste nada, y eso no es un error (`CLAUDE.md` §8). */
	it('no escribe nada sin sesión, y lo distingue de un fallo', async () => {
		const fake = createFakeClient()
		const store = await loadStore(fake.client, null)

		expect(await store.saveResult(makeResult())).toBe('guest')
		expect(fake.inserts).toEqual([])
	})

	it('informa de que no hay backend en lugar de fallar', async () => {
		const store = await loadStore(null, null)

		expect(await store.saveResult(makeResult())).toBe('offline')
	})

	/** Una derrota en Contrarreloj no tiene tiempo que comparar. */
	it('no guarda las derrotas de Contrarreloj', async () => {
		const fake = createFakeClient()
		const store = await loadStore(fake.client, 'uuid-1')

		expect(await store.saveResult(makeResult({mode: 'target', status: 'lost'}))).toBe(
			'not-persisted',
		)
		expect(fake.inserts).toEqual([])
	})

	/** En Precisión sí se guarda aunque no llegue al piso: es historial. */
	it('guarda una partida de Precisión por debajo del piso del ranking', async () => {
		const fake = createFakeClient()
		const store = await loadStore(fake.client, 'uuid-1')

		expect(await store.saveResult(makeResult({mode: 'precision', verbsMatched: 1}))).toBe('saved')
		expect(fake.inserts).toHaveLength(1)
	})

	it('devuelve el fallo de escritura y lo recuerda', async () => {
		const fake = createFakeClient({insertError: {message: 'sin red'}})
		const store = await loadStore(fake.client, 'uuid-1')

		expect(await store.saveResult(makeResult())).toBe('error')
		expect(store.lastSaveOutcome).toBe('error')
		expect(store.isSaving).toBe(false)
	})
})

describe('cargar la clasificación', () => {
	it('consulta la vista de Contrarreloj ordenada por tiempo ascendente', async () => {
		const fake = createFakeClient()
		const store = await loadStore(fake.client, null)

		await store.loadRanking('target', 'medium')

		expect(fake.queries).toEqual([
			{table: 'target_ranking', column: 'level', value: 'medium', ascending: true},
		])
	})

	/** En Precisión clasifica el ritmo, y más es mejor: orden descendente. */
	it('consulta la vista de Precisión ordenada por ritmo descendente', async () => {
		const fake = createFakeClient()
		const store = await loadStore(fake.client, null)

		await store.loadRanking('precision', 'easy')

		expect(fake.queries).toEqual([
			{table: 'precision_ranking', column: 'level', value: 'easy', ascending: false},
		])
	})

	it('convierte las filas en posiciones', async () => {
		const fake = createFakeClient({
			rows: [
				{user_id: 'a', display_name: 'Ada', avatar_url: null, time_ms: 40_000, verbs_matched: 8},
				{user_id: 'b', display_name: 'Grace', avatar_url: null, time_ms: 48_000, verbs_matched: 8},
			],
		})
		const store = await loadStore(fake.client, null)

		await store.loadRanking('target', 'easy')

		expect(store.entries.map((entry) => [entry.position, entry.displayName])).toEqual([
			[1, 'Ada'],
			[2, 'Grace'],
		])
		expect(store.loadStatus).toBe('ready')
		expect(store.isEmpty).toBe(false)
	})

	it('distingue una tabla vacía de una que aún no se ha cargado', async () => {
		const fake = createFakeClient({rows: []})
		const store = await loadStore(fake.client, null)

		expect(store.isEmpty).toBe(false)

		await store.loadRanking('target', 'easy')

		expect(store.isEmpty).toBe(true)
	})

	it('explica el fallo de red sin dejar datos viejos en pantalla', async () => {
		const fake = createFakeClient({
			rows: [{user_id: 'a', display_name: 'Ada', time_ms: 1000, verbs_matched: 5}],
		})
		const store = await loadStore(fake.client, null)

		await store.loadRanking('target', 'easy')
		expect(store.entries).toHaveLength(1)

		const failing = createFakeClient({selectError: {message: 'boom'}})
		// El store guarda la referencia al cliente al importarse, así que se prueba
		// el fallo con un store nuevo montado sobre el cliente que falla.
		const other = await loadStore(failing.client, null)
		await other.loadRanking('target', 'easy')

		expect(other.loadStatus).toBe('error')
		expect(other.loadError).not.toBeNull()
		expect(other.entries).toEqual([])
	})

	it('informa cuando no hay backend', async () => {
		const store = await loadStore(null, null)

		await store.loadRanking('target', 'easy')

		expect(store.loadStatus).toBe('error')
		expect(store.loadError).toContain('conexión')
	})

	/**
	 * Cambiar de pestaña dispara una consulta nueva mientras la anterior sigue en
	 * vuelo. Si la lenta llegara después y pisara a la rápida, el usuario vería la
	 * tabla de una pestaña que ya no está seleccionada.
	 */
	it('descarta la respuesta de una consulta que ya no es la vigente', async () => {
		const fake = createFakeClient({
			/*
			 * La consulta abandonada es la LENTA: así llega después de la vigente y
			 * tiene ocasión de pisarla. Con la vieja llegando primero, el test pasaría
			 * aunque no existiera la guarda, porque la vigente la sobrescribiría igual.
			 */
			delaysByTable: {target_ranking: 40, precision_ranking: 5},
			// Filas distintas por vista: así se ve cuál de las dos respuestas quedó.
			rowsByTable: {
				target_ranking: [{user_id: 'a', display_name: 'Vieja', time_ms: 1000, verbs_matched: 5}],
				precision_ranking: [
					{user_id: 'b', display_name: 'Vigente', time_ms: 2000, verbs_matched: 9, pace: 9},
				],
			},
		})
		const store = await loadStore(fake.client, null)

		const stale = store.loadRanking('target', 'easy')
		await store.loadRanking('precision', 'hard')
		await stale

		expect(store.loadedMode).toBe('precision')
		expect(store.loadedDifficulty).toBe('hard')
		// Lo que de verdad importa: la respuesta lenta no pisó a la vigente.
		expect(store.entries.map((entry) => entry.displayName)).toEqual(['Vigente'])
	})
})
