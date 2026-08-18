import {storeToRefs} from 'pinia'
import {useAuthStore} from '@/stores/auth'

/**
 * Interfaz pública de la sesión.
 *
 * Igual que `useGameEngine`, es el único punto por el que la UI toca el estado
 * de autenticación: ningún componente importa `useAuthStore` (`CLAUDE.md` §6, y
 * lo verifica ESLint). El estado y los getters salen con `storeToRefs`, que
 * mantiene la reactividad, y las acciones se toman del store directamente
 * porque `storeToRefs` no las incluye (skill `vue-pinia-best-practices`,
 * `pinia-store-destructuring-breaks-reactivity`).
 */
export function useAuth() {
	const store = useAuthStore()

	const {
		// Sesión
		session,
		status,
		identity,
		// Derivados
		isAuthenticated,
		isGuest,
		isReady,
		userId,
		displayName,
		avatarUrl,
		canSignIn,
		// Interacción
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
