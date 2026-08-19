import {computed, ref} from 'vue'
import {defineStore} from 'pinia'
import type {Session} from '@supabase/supabase-js'
import {describeAuthError, identityFromUser} from '@/lib/auth'
import {getSupabase, isSupabaseConfigured} from '@/lib/supabase'
import {useProgressStore} from '@/stores/progress'

/**
 * Sesión del usuario.
 *
 * Regla de fondo (`CLAUDE.md` §8): **el modo invitado es un estado legítimo, no
 * un error**. Sin sesión —o sin credenciales de Supabase— la app se juega
 * completa; lo único que falta es la persistencia. Por eso aquí no hay ni un
 * camino que bloquee el juego, y `status` sirve para no parpadear al arrancar,
 * no para vetar el acceso.
 */

/**
 * `unknown` antes de intentar restaurar, `loading` mientras se intenta, `ready`
 * cuando ya sabemos si hay sesión o no. La distinción evita mostrar «entra con
 * Google» durante el instante en que aún se está restaurando una sesión válida.
 */
export type AuthStatus = 'unknown' | 'loading' | 'ready'

export const useAuthStore = defineStore('auth', () => {
	const session = ref<Session | null>(null)
	const status = ref<AuthStatus>('unknown')
	const errorMessage = ref<string | null>(null)
	/** Verdadero mientras se resuelve un `signIn` o un `signOut`. */
	const isWorking = ref(false)

	/**
	 * Promesa de la restauración en curso, para que `initialize()` sea idempotente
	 * *y* reentrante: la arranca `main.ts` y la vuelve a esperar la pantalla de
	 * callback. Sin compartir la promesa, la segunda llamada volvería de inmediato
	 * y leería una sesión que todavía no existe.
	 *
	 * No es estado reactivo, así que no forma parte de lo que devuelve el store.
	 */
	let restoration: Promise<void> | null = null
	let unsubscribe: (() => void) | null = null

	/**
	 * Identidad derivada de la sesión, nunca almacenada aparte: así no puede
	 * quedarse desincronizada del usuario que hay realmente conectado.
	 */
	const identity = computed(() =>
		session.value === null ? null : identityFromUser(session.value.user),
	)

	const isAuthenticated = computed(() => session.value !== null)
	/** Jugar sin sesión es el modo invitado, haya backend disponible o no. */
	const isGuest = computed(() => session.value === null)
	const isReady = computed(() => status.value === 'ready')
	const userId = computed(() => identity.value?.userId ?? null)
	const displayName = computed(() => identity.value?.displayName ?? null)
	const avatarUrl = computed(() => identity.value?.avatarUrl ?? null)

	/**
	 * ¿Tiene sentido ofrecer el acceso? Sin credenciales no hay a dónde ir, así
	 * que la interfaz oculta el botón en lugar de mostrar uno que falla al pulsar.
	 */
	const canSignIn = computed(() => isSupabaseConfigured)

	function clearError(): void {
		errorMessage.value = null
	}

	async function restoreSession(): Promise<void> {
		status.value = 'loading'

		const client = await getSupabase()

		if (client === null) {
			// Sin backend no hay nada que restaurar: invitado permanente y listo.
			status.value = 'ready'
			return
		}

		/*
		 * El listener se registra ANTES de la primera lectura, y es deliberado:
		 * `detectSessionInUrl` canjea el código del callback de forma asíncrona, así
		 * que una única llamada a `getSession()` puede resolverse antes de que la
		 * sesión exista. El listener recoge ese `SIGNED_IN` posterior; sin él, el
		 * login parecería no hacer nada al volver de Google.
		 */
		const {data: listener} = client.auth.onAuthStateChange((_event, nextSession) => {
			session.value = nextSession
			status.value = 'ready'
		})

		unsubscribe = () => listener.subscription.unsubscribe()

		const {data, error} = await client.auth.getSession()

		if (error !== null) errorMessage.value = describeAuthError(error)

		/*
		 * Red de seguridad: si el listener ya resolvió el estado, su valor es el
		 * bueno y esta lectura podría estar obsoleta. Sólo se usa si no llegó nada.
		 *
		 * Se pregunta por `isReady` y no por `status.value !== 'ready'` porque el
		 * análisis de flujo de TypeScript no ve la escritura del listener: se queda
		 * con el `'loading'` de arriba y declara la comparación imposible. El
		 * `computed` es de tipo `boolean`, así que no arrastra ese estrechamiento.
		 */
		if (!isReady.value) {
			session.value = data.session
			status.value = 'ready'
		}
	}

	/** Restaura la sesión guardada y queda escuchando los cambios. Idempotente. */
	function initialize(): Promise<void> {
		restoration ??= restoreSession()

		return restoration
	}

	/**
	 * Manda al usuario a Google. En caso de éxito el navegador abandona la página,
	 * así que sólo se vuelve de aquí cuando algo ha fallado.
	 */
	async function signInWithGoogle(): Promise<void> {
		const client = await getSupabase()

		if (client === null) {
			errorMessage.value = 'No hay conexión con el servidor: sólo se puede jugar como invitado.'
			return
		}

		clearError()
		isWorking.value = true

		const {error} = await client.auth.signInWithOAuth({
			provider: 'google',
			// La ruta existe en el router; Supabase la exige en su lista blanca de
			// «Redirect URLs» o la ignora y usa la Site URL en su lugar.
			options: {redirectTo: `${window.location.origin}/auth/callback`},
		})

		if (error !== null) errorMessage.value = describeAuthError(error)

		isWorking.value = false
	}

	async function signOut(): Promise<void> {
		const client = await getSupabase()
		if (client === null) return

		clearError()
		isWorking.value = true

		const {error} = await client.auth.signOut()

		isWorking.value = false

		if (error !== null) {
			errorMessage.value = describeAuthError(error)
			return
		}

		session.value = null

		/*
		 * El progreso se borra al salir: vive en memoria y es de la persona que
		 * estaba conectada, así que dejarlo puesto lo atribuiría al invitado que
		 * siga jugando en el mismo navegador —y, en cuanto T5.5 sincronice, al
		 * siguiente usuario que entre.
		 */
		useProgressStore().resetProgress()
	}

	/** Suelta el listener. Para los tests y para un hipotético desmontaje. */
	function teardown(): void {
		unsubscribe?.()
		unsubscribe = null
		restoration = null
		status.value = 'unknown'
	}

	return {
		// Estado
		session,
		status,
		errorMessage,
		isWorking,
		// Derivados
		identity,
		isAuthenticated,
		isGuest,
		isReady,
		userId,
		displayName,
		avatarUrl,
		canSignIn,
		// Acciones
		initialize,
		signInWithGoogle,
		signOut,
		clearError,
		teardown,
	}
})
