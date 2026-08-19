import {computed, ref} from 'vue'
import {defineStore} from 'pinia'
import type {Session} from '@supabase/supabase-js'
import {describeAuthError, identityFromUser} from '@/lib/auth'
import {getSupabase, isSupabaseConfigured} from '@/lib/supabase'
import {useProgressStore} from '@/stores/progress'

export type AuthStatus = 'unknown' | 'loading' | 'ready'

export const useAuthStore = defineStore('auth', () => {
	const session = ref<Session | null>(null)
	const status = ref<AuthStatus>('unknown')
	const errorMessage = ref<string | null>(null)
	const isWorking = ref(false)

	let restoration: Promise<void> | null = null
	let unsubscribe: (() => void) | null = null

	const identity = computed(() =>
		session.value === null ? null : identityFromUser(session.value.user),
	)

	const isAuthenticated = computed(() => session.value !== null)
	const isGuest = computed(() => session.value === null)
	const isReady = computed(() => status.value === 'ready')
	const userId = computed(() => identity.value?.userId ?? null)
	const displayName = computed(() => identity.value?.displayName ?? null)
	const avatarUrl = computed(() => identity.value?.avatarUrl ?? null)

	const canSignIn = computed(() => isSupabaseConfigured)

	function clearError(): void {
		errorMessage.value = null
	}

	async function restoreSession(): Promise<void> {
		status.value = 'loading'

		const client = await getSupabase()

		if (client === null) {
			status.value = 'ready'
			return
		}

		const {data: listener} = client.auth.onAuthStateChange((_event, nextSession) => {
			session.value = nextSession
			status.value = 'ready'
		})

		unsubscribe = () => listener.subscription.unsubscribe()

		const {data, error} = await client.auth.getSession()

		if (error !== null) errorMessage.value = describeAuthError(error)

		if (!isReady.value) {
			session.value = data.session
			status.value = 'ready'
		}
	}

	function initialize(): Promise<void> {
		restoration ??= restoreSession()

		return restoration
	}

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

		useProgressStore().resetProgress()
	}

	function teardown(): void {
		unsubscribe?.()
		unsubscribe = null
		restoration = null
		status.value = 'unknown'
	}

	return {
		session,
		status,
		errorMessage,
		isWorking,
		identity,
		isAuthenticated,
		isGuest,
		isReady,
		userId,
		displayName,
		avatarUrl,
		canSignIn,
		initialize,
		signInWithGoogle,
		signOut,
		clearError,
		teardown,
	}
})
