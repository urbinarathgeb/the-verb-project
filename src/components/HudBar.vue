<script setup lang="ts">
import {computed} from 'vue'
import {formatDuration, formatDurationPrecise, formatPace} from '@/lib/format'
import type {GameMode} from '@/types/game'

/**
 * Marcador de la partida.
 *
 * Es el HUD del juego, no una cabecera de sitio: `CLAUDE.md` prohíbe headers y
 * footers tradicionales. Muestra métricas distintas según el modo, porque lo que
 * el jugador necesita vigilar es distinto en cada uno (`MECHANICS.md` §2 y §3).
 */
const props = defineProps<{
	mode: GameMode
	/** Tiempo consumido. En Modo Precisión es lo que se muestra. */
	elapsedMs: number
	/** Tiempo restante, o `null` si el reloj no tiene límite. */
	remainingMs: number | null
	matchedCount: number
	errors: number
	/** Aciertos que faltan para el objetivo, o `null` fuera del Modo Objetivo. */
	remainingTargets: number | null
	/** Ritmo en verbos por minuto (Modo Precisión). */
	pace: number
}>()

/** Umbral por debajo del cual el reloj entra en modo urgencia. */
const URGENT_THRESHOLD_MS = 10_000

const isCountdown = computed(() => props.remainingMs !== null)

const isUrgent = computed(
	() => props.remainingMs !== null && props.remainingMs <= URGENT_THRESHOLD_MS,
)

/**
 * En los últimos segundos se muestran décimas: un número que cambia comunica la
 * urgencia mejor que uno quieto durante un segundo entero.
 */
const clockLabel = computed(() => {
	if (props.remainingMs === null) return formatDuration(props.elapsedMs)

	return isUrgent.value
		? formatDurationPrecise(props.remainingMs)
		: formatDuration(props.remainingMs)
})
</script>

<template>
	<div class="hud-bar brutal-panel">
		<!--
			`aria-live="off"`: el reloj cambia diez veces por segundo y anunciarlo
			taparía cualquier otro mensaje del lector de pantalla.
		-->
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

		<!-- En Precisión el ritmo sustituye a los errores: no hay errores que contar. -->
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
	/* Sin esto, un valor largo estira el HUD y con él el documento entero. */
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
	font-size: var(--text-caption);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	/* El valor manda; la etiqueta se lee sólo cuando hace falta. */
	opacity: 0.7;
}

.hud-value {
	font-family: var(--font-display);
	font-size: var(--text-headline-md);
	font-weight: 800;
	/* Los dígitos no deben cambiar de ancho al pasar de 9 a 10. */
	font-variant-numeric: tabular-nums;
}

/*
 * Urgencia: el reloj se rellena de rosa. Es el único punto del chrome donde el
 * rosa aparece, y se lee como alarma sin competir con el tablero, que está en
 * otra zona de la pantalla.
 */
.hud-clock-urgent {
	background-color: var(--color-pink);
	outline: 3px solid var(--color-ink);
}

@media (width >= 40rem) {
	.hud-bar {
		padding: calc(var(--spacing-gutter) / 2);
		gap: var(--spacing-gutter);
	}

	.hud-value {
		font-size: var(--text-headline-lg);
	}
}
</style>
