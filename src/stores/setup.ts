import {ref} from 'vue'
import {defineStore} from 'pinia'
import {DIFFICULTIES, MENU_MODES, type Difficulty, type MenuMode} from '@/types/game'

/**
 * Lo que el jugador tiene elegido para su próxima partida.
 *
 * Vive en Pinia y no en la pantalla porque tiene que **sobrevivir a la
 * navegación**: desde que el menú se partió en portada y selección
 * (`PLAN.md`, Bitácora, D14), volver atrás y entrar de nuevo no debe borrar la
 * elección. Antes eran dos `ref` dentro de `HomeScreen` que volvían a
 * Contrarreloj/Fácil en cada visita.
 *
 * **No se persiste en `localStorage`.** `CLAUDE.md` §8 reserva el modo invitado
 * a memoria; una preferencia de interfaz no es progreso ni puntaje, pero no
 * compensa abrir una excepción a esa regla por recordar dos valores.
 */
export const useSetupStore = defineStore('setup', () => {
	const mode = ref<MenuMode>('target')
	const difficulty = ref<Difficulty>('easy')

	/**
	 * Los `set` validan en lugar de asignar a ciegas.
	 *
	 * El tipo sólo protege en compilación, y estos valores acaban formando parte
	 * de una URL (`/play/:mode/:difficulty`): un valor que no exista dejaría al
	 * jugador ante un guard de ruta que lo devuelve al inicio sin explicación.
	 */
	function setMode(next: MenuMode): void {
		if (!MENU_MODES.some((candidate) => candidate === next)) return

		mode.value = next
	}

	function setDifficulty(next: Difficulty): void {
		if (!DIFFICULTIES.some((candidate) => candidate === next)) return

		difficulty.value = next
	}

	return {mode, difficulty, setMode, setDifficulty}
})
