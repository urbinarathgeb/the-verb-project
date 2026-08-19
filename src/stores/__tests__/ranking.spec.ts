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
	rowsByTable?: Record<string, Record<string, unknown>[]>
	selectError?: {message: string} | null
	insertError?: {message: string} | null
	selectDelayMs?: number
	delaysByTable?: Record<string, number>
	personalBestRow?: {time_ms?: number | null; pace?: number | null} | null
	count?: number | null
}

function createFakeClient(options: FakeOptions = {}) {
	const inserts: Record<string, unknown>[] = []
	const events: string[] = []

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

async function loadStore(
	client: ReturnType<typeof createFakeClient>['client'] | null,
	userId: string | null,
) {
	vi.resetModules()
	vi.doMock('@/lib/supabase', () => ({
		getSupabase: () => Promise.resolve(client),
		isSupabaseConfigured: client !== null,
	}))

	const {createPinia, setActivePinia} = await import('pinia')
	setActivePinia(createPinia())

	const {useRankingStore} = await import('@/stores/ranking')
	const {useAuthStore} = await import('@/stores/auth')

	const auth = useAuthStore()
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

	it('no guarda las derrotas de Contrarreloj', async () => {
		const fake = createFakeClient()
		const store = await loadStore(fake.client, 'uuid-1')

		expect(await store.saveResult(makeResult({mode: 'target', status: 'lost'}))).toBe(
			'not-persisted',
		)
		expect(fake.inserts).toEqual([])
	})

	it('guarda una partida de Supervivencia por debajo del piso del ranking', async () => {
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

	it('consulta la vista de Supervivencia ordenada por ritmo descendente', async () => {
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

	it('descarta la respuesta de una consulta que ya no es la vigente', async () => {
		const fake = createFakeClient({
			delaysByTable: {target_ranking: 40, precision_ranking: 5},
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
		expect(store.entries.map((entry) => entry.displayName)).toEqual(['Vigente'])
	})
})

describe('posición y récord personal', () => {
	it('lee la marca previa antes de guardar', async () => {
		const fake = createFakeClient({personalBestRow: {time_ms: 50_000}, count: 2})
		const store = await loadStore(fake.client, 'uuid-1')

		await store.submitResult(makeResult({mode: 'target', status: 'won', timeMs: 40_000}))

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

	it('en Supervivencia cuenta por ritmo descendente', async () => {
		const fake = createFakeClient({personalBestRow: null, count: 1})
		const store = await loadStore(fake.client, 'uuid-1')

		await store.submitResult(makeResult({mode: 'precision', verbsMatched: 10, timeMs: 60_000}))

		const countQuery = fake.queries.find((query) => query.head === true)

		expect(countQuery?.compare).toEqual({op: 'gt', column: 'pace', value: 10})
	})

	it('excluye la fila propia al contar quién te supera', async () => {
		const fake = createFakeClient({personalBestRow: null, count: 0})
		const store = await loadStore(fake.client, 'uuid-1')

		await store.submitResult(makeResult({mode: 'precision', verbsMatched: 10, timeMs: 60_000}))

		const countQuery = fake.queries.find((query) => query.head === true)

		expect(countQuery?.excluded).toEqual({column: 'user_id', value: 'uuid-1'})
		expect(store.position).toBe(1)
	})

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
		expect(store.personalBestMetric).toBe(30_000)
	})

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
