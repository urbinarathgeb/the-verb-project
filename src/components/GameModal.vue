<script setup lang="ts">
import {computed, useId, useTemplateRef} from 'vue'
import {useFocusTrap} from '@/composables/useFocusTrap'
import ChoiceButton from '@/components/ChoiceButton.vue'

/**
 * Modal base del juego: cuenta atrás inicial, pausa y resultado.
 *
 * Se teletransporta a `body` porque el tablero vive dentro de contenedores con
 * `overflow` y contextos de apilamiento propios, donde un `position: fixed`
 * quedaría recortado o por debajo del HUD.
 *
 * El foco queda atrapado dentro mientras está abierto y vuelve a su origen al
 * cerrarse (`useFocusTrap`). `Esc` cierra sólo los modales descartables: en la
 * cuenta atrás o el resultado no hay nada que descartar.
 */
const props = withDefaults(
	defineProps<{
		open: boolean
		title: string
		/**
		 * `false` en los modales que el jugador no puede descartar, como la cuenta
		 * atrás inicial o el resultado de una partida.
		 */
		dismissible?: boolean
		/**
		 * Enfoca el panel en lugar del primer botón al abrirse. Para diálogos que
		 * son sobre todo texto: si no, el scroll salta al control del final.
		 */
		focusPanel?: boolean
	}>(),
	{dismissible: false, focusPanel: false},
)

const emit = defineEmits<{close: []}>()

const panel = useTemplateRef<HTMLElement>('panel')
const isOpen = computed(() => props.open)

useFocusTrap(panel, isOpen, {
	onEscape: props.dismissible ? () => emit('close') : undefined,
	focusContainer: props.focusPanel,
})

// Asocia el título con el diálogo sin depender de un id fijo, que se repetiría
// si hubiera dos modales montados.
const titleId = useId()

function handleBackdropClick(): void {
	emit('close')
}
</script>

<template>
	<Teleport to="body">
		<div v-if="open" class="modal-backdrop">
			<!--
				El fondo cierra el modal sólo si es descartable. Es un atajo, no el
				único camino: los modales descartables llevan además su propio botón.
			-->
			<div
				v-if="dismissible"
				class="modal-backdrop-hit"
				aria-hidden="true"
				@click="handleBackdropClick"
			/>

			<div
				ref="panel"
				class="modal-panel brutal-panel"
				tabindex="-1"
				role="dialog"
				aria-modal="true"
				:aria-labelledby="titleId"
			>
				<div class="modal-header">
					<h2 :id="titleId" class="modal-title">{{ title }}</h2>

					<!--
						Segundo camino de salida, no el único: el botón de acción sigue
						ahí. Existe porque `Esc` no está en una pantalla táctil y el
						cuerpo de un diálogo largo puede medir varias pantallas.
					-->
					<ChoiceButton
						v-if="dismissible"
						variant="ghost"
						class="modal-close"
						aria-label="Cerrar"
						@click="emit('close')"
					>
						<span aria-hidden="true">×</span>
					</ChoiceButton>
				</div>

				<div class="modal-body">
					<slot />
				</div>

				<div v-if="$slots.actions" class="modal-actions">
					<slot name="actions" />
				</div>
			</div>
		</div>
	</Teleport>
</template>

<style scoped>
.modal-backdrop {
	position: fixed;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: var(--spacing-margin-mobile);
	/* Tinta translúcida en vez de desenfoque: el sistema no usa blur. */
	background-color: color-mix(in srgb, var(--color-ink) 55%, transparent);
	z-index: 50;
}

.modal-backdrop-hit {
	position: absolute;
	inset: 0;
}

/*
 * El panel no se desplaza; lo hace su cuerpo.
 *
 * Con el panel entero desplazándose, el título y las acciones se iban hacia
 * arriba con el texto: en «¿Cómo se juega?», que mide unos cinco viewports en un
 * móvil, había que recorrer el diálogo completo para llegar al botón de cierre.
 * Dejando que se desplace sólo el cuerpo, la salida está siempre a un toque.
 */
.modal-panel {
	position: relative;
	display: flex;
	flex-direction: column;
	gap: var(--spacing-gutter);
	padding: var(--spacing-gutter);
	background-color: var(--color-card);
	width: 100%;
	max-width: 28rem;
	max-height: 100%;
	overflow: hidden;
}

.modal-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: calc(var(--spacing-gutter) / 2);
	/* No se encoge: el título puede ocupar dos líneas y el aspa acompañarlo. */
	flex-shrink: 0;
}

.modal-title {
	font-size: var(--text-headline-md);
	margin: 0;
	min-width: 0;
}

/*
 * La cabecera queda **fuera** del contenedor que desplaza, no superpuesta a él,
 * así que nada de lo que reciba el foco puede quedar debajo (WCAG 2.4.11).
 */
.modal-close {
	flex: 0 0 auto;
	/* Cuadrado, como el aspa de abandonar del tablero: mismo gesto, misma forma. */
	width: var(--spacing-touch);
	padding: 0;
	font-size: var(--text-headline-md);
	background-color: var(--color-card);
}

.modal-body {
	font-size: var(--text-body-md);
	flex: 1 1 auto;
	min-height: 0;
	overflow-y: auto;
}

.modal-actions {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--spacing-gutter) / 2);
	/* Ancladas abajo: son la salida del diálogo y no deben irse con el scroll. */
	flex-shrink: 0;
}

@media (width >= 40rem) {
	.modal-backdrop {
		padding: var(--spacing-margin-desktop);
	}

	.modal-title {
		font-size: var(--text-headline-lg);
	}
}
</style>
