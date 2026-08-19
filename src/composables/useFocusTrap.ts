import {onBeforeUnmount, watch, type Ref} from 'vue'

const FOCUSABLE_SELECTOR = [
	'button:not([disabled])',
	'[href]',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(', ')

export interface UseFocusTrapOptions {
	onEscape?: () => void
	focusContainer?: boolean
}

export function useFocusTrap(
	container: Ref<HTMLElement | null>,
	isActive: Ref<boolean>,
	options: UseFocusTrapOptions = {},
): void {
	const {onEscape, focusContainer = false} = options

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
			event.preventDefault()
			return
		}

		const first = elements[0]
		const last = elements[elements.length - 1]
		if (first === undefined || last === undefined) return

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

		requestAnimationFrame(() => {
			const [first] = focusableElements()
			const target = focusContainer ? container.value : (first ?? container.value)

			target?.focus()
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
