<script setup lang="ts">
import {computed, useId, useTemplateRef} from 'vue'
import {useFocusTrap} from '@/composables/useFocusTrap'
import ChoiceButton from '@/components/ChoiceButton.vue'

const props = withDefaults(
	defineProps<{
		open: boolean
		title: string
		dismissible?: boolean
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

const titleId = useId()

function handleBackdropClick(): void {
	emit('close')
}
</script>

<template>
	<Teleport to="body">
		<div v-if="open" class="modal-backdrop">
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
	overflow: hidden;
}

.modal-header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: calc(var(--spacing-gutter) / 2);
	flex-shrink: 0;
}

.modal-title {
	font-size: var(--text-headline-md);
	margin: 0;
	min-width: 0;
}

.modal-close {
	flex: 0 0 auto;
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
