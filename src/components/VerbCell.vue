<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import type {Cell, CellStatus} from '@/types/game'

/**
 * Una celda del tablero.
 *
 * Componente puro: no conoce las reglas del juego. Recibe su estado ya calculado
 * y se limita a mapearlo a la utilidad `cell-*` correspondiente, que es donde
 * vive la semántica visual (`assets/main.css`).
 */
const props = withDefaults(
	defineProps<{
		cell: Cell
		status: CellStatus
		/** `false` cuando el tablero está inerte: fuera de partida o verbo ya resuelto. */
		selectable?: boolean
	}>(),
	{selectable: true},
)

const emit = defineEmits<{select: [cell: Cell]}>()

const STATUS_CLASSES: Record<CellStatus, string> = {
	neutral: 'cell-neutral',
	selected: 'cell-selected',
	resolved: 'cell-resolved',
	error: 'cell-error',
}

const TILT_CLASSES = ['paper-tilt-1', 'paper-tilt-2', 'paper-tilt-3', 'paper-tilt-4']

/** Duración de la entrada de una celda repuesta. */
const ENTER_MS = 300

const statusClass = computed(() => STATUS_CLASSES[props.status])

/*
 * La inclinación se deriva del VERBO, no de la fila.
 *
 * Antes iba atada al índice, y con la reposición diferida una celda entrante
 * ocupa una fila cualquiera: dos celdas distintas heredarían el ángulo de la
 * posición y el tablero parecería temblar. Atarla al verbo la hace estable
 * durante toda la vida de esa celda.
 */
const tiltClass = computed(
	() => TILT_CLASSES[props.cell.verbId % TILT_CLASSES.length] ?? TILT_CLASSES[0],
)

/*
 * Entrada de una celda repuesta.
 *
 * La animación vive AQUÍ y no en un `TransitionGroup` de la columna. Con
 * `TransitionGroup`, cambiar la clave hace coexistir la celda saliente y la
 * entrante durante un fotograma antes de que Vue aplique las clases de salida:
 * se midió y la columna llegaba a **siete hijos**, con las celdas pasando por
 * alturas de 92, 85, 79 y 72 px. Es decir, todo el tablero daba un salto en cada
 * reposición.
 *
 * Ahora la celda se parchea en su sitio —la clave es la fila, que ya no cambia—
 * y la entrada se anima con opacidad, que no afecta al layout.
 */
const isEntering = ref(false)

let enteringTimer: ReturnType<typeof setTimeout> | null = null

watch(
	() => props.cell.verbId,
	() => {
		isEntering.value = true

		if (enteringTimer !== null) clearTimeout(enteringTimer)
		enteringTimer = setTimeout(() => {
			isEntering.value = false
			enteringTimer = null
		}, ENTER_MS)
	},
)

// El gesto de presión sólo tiene sentido si la celda responde al toque.
const pressClass = computed(() => (props.selectable ? 'brutal-press' : ''))

function handleClick(): void {
	if (!props.selectable) return
	emit('select', props.cell)
}
</script>

<template>
	<button
		type="button"
		class="verb-cell"
		:class="[statusClass, tiltClass, pressClass, {'verb-cell-entering': isEntering}]"
		:disabled="!selectable"
		:aria-pressed="status === 'selected'"
		@click="handleClick"
	>
		<span class="verb-cell-form">{{ cell.text }}</span>
		<!--
			El significado sólo llega en las celdas de presente; el porqué está en
			`Cell.meaning`. Va dentro del botón a propósito: así el nombre accesible
			pasa a ser «go ir», que describe el control entero, en vez de exigir un
			`aria-label` que habría que mantener en paralelo.
		-->
		<span v-if="cell.meaning !== null" class="verb-cell-meaning">{{ cell.meaning }}</span>
	</button>
</template>

<style scoped>
/* La celda repuesta aparece con un fundido. Se anima sólo la opacidad, que no
   participa en el layout, así que el resto del tablero no se entera. */
@media (prefers-reduced-motion: no-preference) {
	.verb-cell-entering {
		animation: verb-cell-enter 300ms ease-out;
	}
}

@keyframes verb-cell-enter {
	from {
		opacity: 0;
	}

	to {
		opacity: 1;
	}
}

/*
 * La transición hace que una tríada acertada se atenúe en lugar de apagarse de
 * golpe: `cell-resolved` cambia fondo, borde y opacidad, y esto los interpola.
 * La celda persiste en el DOM al resolverse, así que la transición se aplica.
 */
@media (prefers-reduced-motion: no-preference) {
	.verb-cell {
		transition:
			background-color 400ms ease-out,
			border-color 400ms ease-out,
			opacity 400ms ease-out;
	}
}

.verb-cell {
	/*
	 * Las celdas se reparten la altura de la columna en lugar de crecer con su
	 * contenido: así el tablero cabe en el viewport sin scroll con cualquier N,
	 * que es el requisito de la app a pantalla completa.
	 */
	flex: 1 1 0;
	/*
	 * Suelo irrenunciable: `--spacing-touch` es el mínimo táctil de 44px que
	 * exige CLAUDE.md §11. Si ni así cabe, el tablero desborda antes que
	 * volverse impulsable con el dedo.
	 */
	min-height: var(--spacing-touch);
	width: 100%;
	/* Dos líneas cuando hay significado, así que el centrado se declara aquí en
	   vez de dejarlo al que trae el botón por defecto. */
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 2px;
	padding: calc(var(--spacing-gutter) / 3);
	font-family: var(--font-display);
	font-size: var(--text-label-bold);
	font-weight: 700;
	text-transform: lowercase;
	color: var(--color-ink);
	cursor: pointer;
	/* Las formas largas ("was / were") no deben romper la retícula del tablero. */
	overflow-wrap: anywhere;
}

/*
 * Aquí se juega el encaje del tablero entero, así que conviene la aritmética.
 *
 * La celda es `border-box` con 3px de borde arriba y abajo y 8px de relleno. El
 * verbo, sin esta regla, hereda el `line-height: 1.5` del `body` —el `1` que
 * declara `--text-label-bold--line-height` sólo se aplica a través de la utilidad
 * de Tailwind, no al leer la variable en CSS plano— y ocupa 21px en vez de 14:
 *
 *     21 + 16 + 6 = 43px  →  el mínimo táctil de 44px ya iba al límite
 *
 * Fijando el interlineado a 1, la línea baja a 14px y libera los 7px que paga la
 * segunda. Con `--text-micro` a interlineado 1 y 2px de hueco:
 *
 *     14 + 2 + 10 + 16 + 6 = 48px
 *
 * Cuatro por encima del suelo. Los recupera el relleno compacto de la celda con
 * significado, que sólo se aplica a la columna de presente. **Si alguien sube el
 * significado a 12px o devuelve los 8px de relleno, el texto se saldrá del borde
 * en `hard` sobre un móvil bajo**: ahí la celda no crece, porque `min-height`
 * sustituye al mínimo automático por contenido.
 */
.verb-cell-form {
	line-height: 1;
}

.verb-cell-meaning {
	/* Mono y regular frente al display 700 del verbo: se lee como anotación, no
	   como una segunda respuesta. */
	font-family: var(--font-body);
	font-size: var(--text-micro);
	line-height: 1;
	font-weight: 400;
	text-transform: none;
	opacity: 0.7;
}

.verb-cell:has(.verb-cell-meaning) {
	padding: calc(var(--spacing-gutter) / 4);
}

.verb-cell:disabled {
	cursor: default;
}

@media (width >= 40rem) {
	.verb-cell {
		font-size: var(--text-headline-md);
		padding: calc(var(--spacing-gutter) / 2);
		gap: 4px;
	}

	.verb-cell:has(.verb-cell-meaning) {
		padding: calc(var(--spacing-gutter) / 2);
	}

	.verb-cell-meaning {
		font-size: var(--text-caption);
	}
}
</style>
