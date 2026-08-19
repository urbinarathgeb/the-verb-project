import {storeToRefs} from 'pinia'
import {useAuthStore} from '@/stores/auth'

export function useAuth() {
	const store = useAuthStore()

	const {
		session,
		status,
		identity,
		isAuthenticated,
		isGuest,
		isReady,
		userId,
		displayName,
		avatarUrl,
		canSignIn,
		isWorking,
		errorMessage,
	} = storeToRefs(store)

	const {initialize, signInWithGoogle, signOut, clearError} = store

	return {
		session,
		status,
		identity,
		isAuthenticated,
		isGuest,
		isReady,
		userId,
		displayName,
		avatarUrl,
		canSignIn,
		isWorking,
		errorMessage,
		initialize,
		signInWithGoogle,
		signOut,
		clearError,
	}
}
