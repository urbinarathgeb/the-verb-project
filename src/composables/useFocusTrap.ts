import {onBeforeUnmount, watch, type Ref} from 'vue'

/**
 * Atrapa el foco dentro de un contenedor mientras está activo, y lo devuelve a
 * donde estaba al desactivarse.
 *
 * Sin esto, un lector de pantalla o el tabulador se salen del modal y recorren
 * el tablero de fondo, que visualmente está tapado: el usuario queda navegando a
 * ciegas por controles que no puede ver (`CLAUDE.md` §11).
 *
 * No se usa el `<dialog>` nativo —que traería el atrapado de foco gratis— porque
 * los modales del juego no se abren imperativamente con `showModal()`, sino de
 * forma declarativa según el estado de la partida.
 */

/** Elementos que pueden recibir foco dentro del contenedor. */
const FOCUSABLE_SELECTOR = [
	'button:not([disabled])',
	'[href]',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(', ')

export interface UseFocusTrapOptions {
	/** Se invoca al pulsar `Esc`. Si se omite, `Esc` no hace nada. */
	onEscape?: () => void
}

export function useFocusTrap(
	container: Ref<HTMLElement | null>,
	isActive: Ref<boolean>,
	options: UseFocusTrapOptions = {},
): void {
	const {onEscape} = options

	/** Elemento que tenía el foco antes de abrirse el modal. */
	let previouslyFocused: HTMLElement | null = null

	function focusableElements(): HTMLElement[] {
		const root = container.value
		if (root === null) return []

		return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (!isActive.value) return

		if (event.key === 'Escape' && onEscape !== undefined) {
			event.preventDefault()
			onEscape()
			return
		}

		if (event.key !== 'Tab') return

		const elements = focusableElements()
		if (elements.length === 0) {
			// Un modal sin controles no debe dejar escapar el foco al fondo.
			event.preventDefault()
			return
		}

		const first = elements[0]
		const last = elements[elements.length - 1]
		if (first === undefined || last === undefined) return

		// El ciclo se cierra a mano en los extremos; en medio, el navegador ya
		// hace lo correcto.
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault()
			last.focus()
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault()
			first.focus()
		}
	}

	function activate(): void {
		previouslyFocused =
			document.activeElement instanceof HTMLElement ? document.activeElement : null

		document.addEventListener('keydown', handleKeydown)

		// El contenido del modal se monta en el mismo tick, así que el foco se
		// mueve en el siguiente para encontrar ya los controles en el DOM.
		requestAnimationFrame(() => {
			const [first] = focusableElements()
			// Si el modal no tiene controles (la cuenta atrás, por ejemplo), se
			// enfoca el propio panel para que el lector anuncie su contenido.
			;(first ?? container.value)?.focus()
		})
	}

	function deactivate(): void {
		document.removeEventListener('keydown', handleKeydown)
		previouslyFocused?.focus()
		previouslyFocused = null
	}

	watch(isActive, (active) => (active ? activate() : deactivate()), {immediate: true})

	onBeforeUnmount(() => {
		document.removeEventListener('keydown', handleKeydown)
	})
}
