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
	/** Fila que devuelve la consulta de marca personal, o `null` si no tiene. */
	personalBestRow?: {time_ms?: number | null; pace?: number | null} | null
	/** Lo que devuelve el `count` de cabecera al calcular la posición. */
	count?: number | null
}

/**
 * Doble del cliente, limitado a lo que usa el store. Imita el encadenamiento de
 * PostgREST (`from().select().eq().order().limit()`), que sólo resuelve al
 * esperarlo, y anota cada llamada para poder afirmar sobre la consulta emitida.
 */
function createFakeClient(options: FakeOptions = {}) {
	const inserts: Record<string, unknown>[] = []
	/** Orden en que ocurren las operaciones, para poder afirmar sobre la secuencia. */
	const events: string[] = []

	/**
	 * Mejor marca visible AHORA MISMO, contando lo ya insertado.
	 *
	 * Imita el comportamiento real de la vista: en cuanto la partida se guarda,
	 * `distinct on (user_id, level)` la incluye. Sin esto, el doble devolvería
	 * siempre la misma marca previa y los tests no distinguirían leer antes de
	 * insertar de leer después, que es justo lo que hay que vigilar.
	 */
	function visibleBest(column: 'time_ms' | 'pace'): number | null {
		const stored = options.personalBestRow?.[column] ?? null
		const inserted = inserts.map((row) =>
			column === 'time_ms'
				? Number(row.time_ms)
				: (Number(row.verbs_matched) * 60_000) / Number(row.time_ms),
		)

		const candidates = [...(stored === null ? [] : [stored]), ...inserted]

		if (candidates.length === 0) return null

		return column === 'time_ms' ? Math.min(...candidates) : Math.max(...candidates)
	}
	const queries: {
		table: string
		column?: string
		value?: unknown
		ascending?: boolean
		head?: boolean
		compare?: {op: string; column: string; value: unknown}
		excluded?: {column: string; value: unknown}
	}[] = []

	const client = {
		from: (table: string) => ({
			insert: (values: Record<string, unknown>) => {
				events.push('insert')
				inserts.push({table, ...values})

				return Promise.resolve({error: options.insertError ?? null})
			},
			select: (_columns?: unknown, config?: {count?: string; head?: boolean}) => {
				const query: (typeof queries)[number] = {table}
				if (config?.head === true) query.head = true
				queries.push(query)

				const chain = {
					neq: (column: string, value: unknown) => {
						query.excluded = {column, value}
						return chain
					},
					lt: (column: string, value: unknown) => {
						query.compare = {op: 'lt', column, value}
						return chain
					},
					gt: (column: string, value: unknown) => {
						query.compare = {op: 'gt', column, value}
						return chain
					},
					maybeSingle: () => {
						events.push('personal-best')

						const column = table === 'target_ranking' ? 'time_ms' : 'pace'
						const best = visibleBest(column)

						return Promise.resolve({
							data: best === null ? null : {[column]: best},
							error: options.selectError ?? null,
						})
					},
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
						const settle = () =>
							resolve({
								data: rows,
								count: options.count ?? null,
								error: options.selectError ?? null,
							})
						const delay = options.delaysByTable?.[table] ?? options.selectDelayMs

						if (delay === undefined) settle()
						else setTimeout(settle, delay)
					},
				}

				return chain
			},
		}),
	}

	return {client, inserts, events, queries}
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

describe('posición y récord personal', () => {
	/**
	 * El orden es lo que hace correcto a `submitResult`: la marca previa se lee
	 * ANTES de insertar. Al revés, la vista ya incluiría la partida recién
	 * guardada y se compararía consigo misma, así que nunca habría un récord.
	 */
	it('lee la marca previa antes de guardar', async () => {
		const fake = createFakeClient({personalBestRow: {time_ms: 50_000}, count: 2})
		const store = await loadStore(fake.client, 'uuid-1')

		await store.submitResult(makeResult({mode: 'target', status: 'won', timeMs: 40_000}))

		// La marca personal se consulta primero; el insert viene después.
		expect(fake.events.slice(0, 2)).toEqual(['personal-best', 'insert'])
		expect(store.lastVerdict).toBe('improved')
	})

	it('calcula la posición como los que te superan más uno', async () => {
		const fake = createFakeClient({personalBestRow: null, count: 2})
		const store = await loadStore(fake.client, 'uuid-1')

		await store.submitResult(makeResult({mode: 'target', status: 'won', timeMs: 40_000}))

		expect(store.position).toBe(3)
	})

	it('la posición se consulta sin traer filas', async () => {
		const fake = createFakeClient({personalBestRow: null, count: 0})
		const store = await loadStore(fake.client, 'uuid-1')

		await store.submitResult(makeResult({mode: 'target', status: 'won', timeMs: 40_000}))

		const countQuery = fake.queries.find((query) => query.head === true)

		expect(countQuery?.compare).toEqual({op: 'lt', column: 'time_ms', value: 40_000})
	})

	/** En Precisión gana el ritmo mayor, así que se cuentan los que lo superan. */
	it('en Precisión cuenta por ritmo descendente', async () => {
		const fake = createFakeClient({personalBestRow: null, count: 1})
		const store = await loadStore(fake.client, 'uuid-1')

		await store.submitResult(makeResult({mode: 'precision', verbsMatched: 10, timeMs: 60_000}))

		const countQuery = fake.queries.find((query) => query.head === true)

		expect(countQuery?.compare).toEqual({op: 'gt', column: 'pace', value: 10})
	})

	/**
	 * El jugador no puede contarse a sí mismo. La vista calcula el ritmo con
	 * `numeric` de Postgres y el cliente con coma flotante, así que su propia fila
	 * podía salir mínimamente mayor y cumplía el «me superan»: quedaba segundo
	 * estando solo en la tabla.
	 */
	it('excluye la fila propia al contar quién te supera', async () => {
		const fake = createFakeClient({personalBestRow: null, count: 0})
		const store = await loadStore(fake.client, 'uuid-1')

		await store.submitResult(makeResult({mode: 'precision', verbsMatched: 10, timeMs: 60_000}))

		const countQuery = fake.queries.find((query) => query.head === true)

		expect(countQuery?.excluded).toEqual({column: 'user_id', value: 'uuid-1'})
		expect(store.position).toBe(1)
	})

	/** La primera partida no es un récord: no había nada que batir. */
	it('marca la primera partida como primera, no como récord', async () => {
		const fake = createFakeClient({personalBestRow: null, count: 0})
		const store = await loadStore(fake.client, 'uuid-1')

		await store.submitResult(makeResult({mode: 'target', status: 'won', timeMs: 40_000}))

		expect(store.lastVerdict).toBe('first')
	})

	it('conserva la marca previa si la partida no la mejora', async () => {
		const fake = createFakeClient({personalBestRow: {time_ms: 30_000}, count: 1})
		const store = await loadStore(fake.client, 'uuid-1')

		await store.submitResult(makeResult({mode: 'target', status: 'won', timeMs: 40_000}))

		expect(store.lastVerdict).toBe('not-improved')
		// La posición se calcula con la MEJOR marca, no con la de esta partida.
		expect(store.personalBestMetric).toBe(30_000)
	})

	/** Como invitado no hay puesto que mostrar: la partida no existe para nadie. */
	it('no consulta posición como invitado', async () => {
		const fake = createFakeClient({count: 5})
		const store = await loadStore(fake.client, null)

		expect(await store.submitResult(makeResult({mode: 'target', status: 'won'}))).toBe('guest')
		expect(store.position).toBeNull()
	})

	it('no consulta posición si la partida no se guarda', async () => {
		const fake = createFakeClient({count: 5})
		const store = await loadStore(fake.client, 'uuid-1')

		expect(await store.submitResult(makeResult({mode: 'target', status: 'lost'}))).toBe(
			'not-persisted',
		)
		expect(store.position).toBeNull()
	})

	it('olvida la posición de la partida anterior al empezar otra', async () => {
		const fake = createFakeClient({personalBestRow: null, count: 0})
		const store = await loadStore(fake.client, 'uuid-1')

		await store.submitResult(makeResult({mode: 'target', status: 'won', timeMs: 40_000}))
		expect(store.position).toBe(1)

		store.clearStanding()

		expect(store.position).toBeNull()
		expect(store.lastVerdict).toBeNull()
	})
})
