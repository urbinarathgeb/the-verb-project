<script setup lang="ts">
import {computed, useId, useTemplateRef} from 'vue'
import {useFocusTrap} from '@/composables/useFocusTrap'

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
	}>(),
	{dismissible: false},
)

const emit = defineEmits<{close: []}>()

const panel = useTemplateRef<HTMLElement>('panel')
const isOpen = computed(() => props.open)

useFocusTrap(panel, isOpen, {
	onEscape: props.dismissible ? () => emit('close') : undefined,
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
				<h2 :id="titleId" class="modal-title">{{ title }}</h2>

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
	overflow-y: auto;
}

.modal-title {
	font-size: var(--text-headline-md);
	margin: 0;
}

.modal-body {
	font-size: var(--text-body-md);
}

.modal-actions {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--spacing-gutter) / 2);
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
