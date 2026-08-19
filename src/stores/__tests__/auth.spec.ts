import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

const ORIGIN = 'http://localhost:5173'

beforeEach(() => {
	vi.stubGlobal('window', {location: {origin: ORIGIN}})
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.resetModules()
})

function fakeSession(metadata: Record<string, unknown> = {full_name: 'Ada Lovelace'}) {
	return {user: {id: 'uuid-1', email: 'ada@example.com', user_metadata: metadata}}
}

type FakeSession = ReturnType<typeof fakeSession>
type Listener = (event: string, session: FakeSession | null) => void

interface FakeClientOptions {
	storedSession?: FakeSession | null
	emitOnSubscribe?: {event: string; session: FakeSession | null}
	getSessionError?: Error | null
	signInError?: Error | null
	signOutError?: Error | null
}

function createFakeClient(options: FakeClientOptions = {}) {
	const listeners: Listener[] = []
	const signInCalls: unknown[] = []
	let getSessionCalls = 0
	let signOutCalls = 0
	let unsubscribeCalls = 0

	const client = {
		auth: {
			getSession: () => {
				getSessionCalls += 1

				return Promise.resolve({
					data: {session: options.storedSession ?? null},
					error: options.getSessionError ?? null,
				})
			},
			onAuthStateChange: (listener: Listener) => {
				listeners.push(listener)

				const emit = options.emitOnSubscribe

				if (emit !== undefined) listener(emit.event, emit.session)

				return {
					data: {
						subscription: {
							unsubscribe: () => {
								unsubscribeCalls += 1
							},
						},
					},
				}
			},
			signInWithOAuth: (params: unknown) => {
				signInCalls.push(params)

				return Promise.resolve({
					data: {provider: 'google', url: null},
					error: options.signInError ?? null,
				})
			},
			signOut: () => {
				signOutCalls += 1

				return Promise.resolve({error: options.signOutError ?? null})
			},
		},
	}

	return {
		client,
		signInCalls,
		emit: (event: string, session: FakeSession | null) => {
			for (const listener of listeners) listener(event, session)
		},
		get getSessionCalls() {
			return getSessionCalls
		},
		get signOutCalls() {
			return signOutCalls
		},
		get unsubscribeCalls() {
			return unsubscribeCalls
		},
	}
}

async function loadStore(client: ReturnType<typeof createFakeClient>['client'] | null) {
	vi.resetModules()
	vi.doMock('@/lib/supabase', () => ({
		getSupabase: () => Promise.resolve(client),
		isSupabaseConfigured: client !== null,
	}))

	const {createPinia, setActivePinia} = await import('pinia')
	setActivePinia(createPinia())

	const {useAuthStore} = await import('@/stores/auth')
	const {useProgressStore} = await import('@/stores/progress')

	return {auth: useAuthStore(), progress: useProgressStore()}
}

describe('sin credenciales de Supabase', () => {
	it('queda listo en modo invitado en lugar de fallar', async () => {
		const {auth} = await loadStore(null)

		await auth.initialize()

		expect(auth.isReady).toBe(true)
		expect(auth.isGuest).toBe(true)
		expect(auth.isAuthenticated).toBe(false)
	})

	it('no ofrece el acceso', async () => {
		const {auth} = await loadStore(null)

		expect(auth.canSignIn).toBe(false)
	})

	it('explica la situación si se intenta entrar de todos modos', async () => {
		const {auth} = await loadStore(null)

		await auth.signInWithGoogle()

		expect(auth.errorMessage).toContain('invitado')
		expect(auth.isAuthenticated).toBe(false)
	})
})

describe('restauración de sesión', () => {
	it('recupera la sesión guardada y deriva la identidad', async () => {
		const fake = createFakeClient({storedSession: fakeSession()})
		const {auth} = await loadStore(fake.client)

		await auth.initialize()

		expect(auth.isAuthenticated).toBe(true)
		expect(auth.userId).toBe('uuid-1')
		expect(auth.displayName).toBe('Ada Lovelace')
	})

	it('queda como invitado si no hay sesión guardada', async () => {
		const fake = createFakeClient({storedSession: null})
		const {auth} = await loadStore(fake.client)

		await auth.initialize()

		expect(auth.isGuest).toBe(true)
		expect(auth.isReady).toBe(true)
	})

	it('comparte una sola restauración entre llamadas concurrentes', async () => {
		const fake = createFakeClient({storedSession: fakeSession()})
		const {auth} = await loadStore(fake.client)

		await Promise.all([auth.initialize(), auth.initialize()])
		await auth.initialize()

		expect(fake.getSessionCalls).toBe(1)
		expect(auth.isAuthenticated).toBe(true)
	})

	it('conserva la sesión del listener aunque la lectura inicial llegue vacía', async () => {
		const fake = createFakeClient({
			storedSession: null,
			emitOnSubscribe: {event: 'SIGNED_IN', session: fakeSession()},
		})
		const {auth} = await loadStore(fake.client)

		await auth.initialize()

		expect(auth.isAuthenticated).toBe(true)
		expect(auth.displayName).toBe('Ada Lovelace')
	})

	it('queda listo aunque falle la lectura de la sesión', async () => {
		const fake = createFakeClient({
			getSessionError: Object.assign(new Error('storage ilegible'), {code: 'unexpected_failure'}),
		})
		const {auth} = await loadStore(fake.client)

		await auth.initialize()

		expect(auth.isReady).toBe(true)
		expect(auth.isGuest).toBe(true)
		expect(auth.errorMessage).toBe('storage ilegible')
	})

	it('sigue los cambios de sesión posteriores al arranque', async () => {
		const fake = createFakeClient({storedSession: null})
		const {auth} = await loadStore(fake.client)

		await auth.initialize()
		fake.emit('SIGNED_IN', fakeSession({name: 'Grace'}))

		expect(auth.displayName).toBe('Grace')

		fake.emit('SIGNED_OUT', null)

		expect(auth.isGuest).toBe(true)
		expect(auth.displayName).toBeNull()
	})
})

describe('entrar con Google', () => {
	it('pide el proveedor google y vuelve a la ruta de callback', async () => {
		const fake = createFakeClient()
		const {auth} = await loadStore(fake.client)

		await auth.signInWithGoogle()

		expect(fake.signInCalls).toEqual([
			{provider: 'google', options: {redirectTo: `${ORIGIN}/auth/callback`}},
		])
	})

	it('traduce el fallo del proveedor', async () => {
		const fake = createFakeClient({
			signInError: Object.assign(new Error('Provider denied'), {code: 'access_denied'}),
		})
		const {auth} = await loadStore(fake.client)

		await auth.signInWithGoogle()

		expect(auth.errorMessage).toContain('Google denegó el acceso')
		expect(auth.isWorking).toBe(false)
	})

	it('limpia un error anterior al reintentar', async () => {
		const fake = createFakeClient()
		const {auth} = await loadStore(fake.client)

		auth.errorMessage = 'fallo viejo'
		await auth.signInWithGoogle()

		expect(auth.errorMessage).toBeNull()
	})
})

describe('cerrar sesión', () => {
	it('deja la app en modo invitado', async () => {
		const fake = createFakeClient({storedSession: fakeSession()})
		const {auth} = await loadStore(fake.client)

		await auth.initialize()
		await auth.signOut()

		expect(fake.signOutCalls).toBe(1)
		expect(auth.isGuest).toBe(true)
		expect(auth.displayName).toBeNull()
	})

	it('borra el progreso del usuario que se va', async () => {
		const fake = createFakeClient({storedSession: fakeSession()})
		const {auth, progress} = await loadStore(fake.client)

		await auth.initialize()
		progress.recordAnswer(7, true)

		expect(progress.practicedCount).toBe(1)

		await auth.signOut()

		expect(progress.practicedCount).toBe(0)
	})

	it('conserva la sesión y el progreso si el cierre falla', async () => {
		const fake = createFakeClient({
			storedSession: fakeSession(),
			signOutError: new Error('sin red'),
		})
		const {auth, progress} = await loadStore(fake.client)

		await auth.initialize()
		progress.recordAnswer(7, true)
		await auth.signOut()

		expect(auth.isAuthenticated).toBe(true)
		expect(auth.errorMessage).toBe('sin red')
		expect(progress.practicedCount).toBe(1)
	})

	it('no hace nada sin backend', async () => {
		const {auth} = await loadStore(null)

		await auth.signOut()

		expect(auth.errorMessage).toBeNull()
	})
})

describe('teardown', () => {
	it('suelta el listener de sesión', async () => {
		const fake = createFakeClient({storedSession: fakeSession()})
		const {auth} = await loadStore(fake.client)

		await auth.initialize()
		auth.teardown()

		expect(fake.unsubscribeCalls).toBe(1)
	})
})
