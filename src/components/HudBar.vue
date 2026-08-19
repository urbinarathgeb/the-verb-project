<script setup lang="ts">
import {computed} from 'vue'
import {formatDuration, formatDurationPrecise, formatPace} from '@/lib/format'
import type {GameMode} from '@/types/game'

const props = defineProps<{
	mode: GameMode
	elapsedMs: number
	remainingMs: number | null
	matchedCount: number
	errors: number
	remainingTargets: number | null
	pace: number
}>()

const URGENT_THRESHOLD_MS = 10_000

const isCountdown = computed(() => props.remainingMs !== null)

const isUrgent = computed(
	() => props.remainingMs !== null && props.remainingMs <= URGENT_THRESHOLD_MS,
)

const clockLabel = computed(() => {
	if (props.remainingMs === null) return formatDuration(props.elapsedMs)

	return isUrgent.value
		? formatDurationPrecise(props.remainingMs)
		: formatDuration(props.remainingMs)
})
</script>

<template>
	<div class="hud-bar brutal-panel">
		<p class="hud-slot hud-clock" :class="{'hud-clock-urgent': isUrgent}" aria-live="off">
			<span class="hud-label">{{ isCountdown ? 'Restante' : 'Tiempo' }}</span>
			<span class="hud-value">{{ clockLabel }}</span>
		</p>

		<p class="hud-slot">
			<span class="hud-label">Aciertos</span>
			<span class="hud-value">{{ matchedCount }}</span>
		</p>

		<p v-if="remainingTargets !== null" class="hud-slot">
			<span class="hud-label">Faltan</span>
			<span class="hud-value">{{ remainingTargets }}</span>
		</p>

		<p v-if="mode === 'target'" class="hud-slot">
			<span class="hud-label">Errores</span>
			<span class="hud-value">{{ errors }}</span>
		</p>

		<p v-else class="hud-slot">
			<span class="hud-label">Ritmo</span>
			<span class="hud-value">{{ formatPace(pace) }}</span>
		</p>
	</div>
</template>

<style scoped>
.hud-bar {
	display: flex;
	align-items: stretch;
	justify-content: space-between;
	gap: calc(var(--spacing-gutter) / 4);
	padding: calc(var(--spacing-gutter) / 3);
	background-color: var(--color-card);
	width: 100%;
	min-width: 0;
}

.hud-slot {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 2px;
	flex: 1 1 0;
	min-width: 0;
	margin: 0;
}

.hud-label {
	font-size: var(--text-micro);
	letter-spacing: 0;
	text-transform: uppercase;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	opacity: 0.7;
}

.hud-value {
	font-family: var(--font-display);
	font-size: var(--text-headline-md);
	font-weight: 800;
	font-variant-numeric: tabular-nums;
}

.hud-clock {
	flex-grow: 1.6;
}

.hud-clock-urgent {
	background-color: var(--color-pink);
	outline: 3px solid var(--color-ink);
}

@media (width < 23.4375rem) {
	.hud-bar {
		gap: calc(var(--spacing-gutter) / 8);
		padding: calc(var(--spacing-gutter) / 6);
	}

	.hud-value {
		font-size: 1.25rem;
	}
}

@media (width >= 40rem) {
	.hud-bar {
		padding: calc(var(--spacing-gutter) / 2);
		gap: var(--spacing-gutter);
	}

	.hud-label {
		font-size: var(--text-caption);
		letter-spacing: 0.08em;
	}

	.hud-value {
		font-size: var(--text-headline-lg);
	}
}
</style>
