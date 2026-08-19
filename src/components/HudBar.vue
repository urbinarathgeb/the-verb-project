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
	/** Tiempo consumido. En Modo Supervivencia es lo que se muestra. */
	elapsedMs: number
	/** Tiempo restante, o `null` si el reloj no tiene límite. */
	remainingMs: number | null
	matchedCount: number
	errors: number
	/** Aciertos que faltan para el objetivo, o `null` fuera del Modo Objetivo. */
	remainingTargets: number | null
	/** Ritmo en verbos por minuto (Modo Supervivencia). */
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

		<!-- En Supervivencia el ritmo sustituye a los errores: no hay errores que contar. -->
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
	/*
	 * Compacta en móvil por defecto: a 375px las cuatro etiquetas a 12px con
	 * tracking sumaban más que la barra y se tocaban entre sí, y a 320px llegaban
	 * a pisarse («RESTANTAECIERTOSFALTANERRORES»). Lo que sobra es el tracking en
	 * versales, no el texto. El bloque de escritorio de abajo restaura el tamaño
	 * del sistema en cuanto hay ancho para él.
	 */
	font-size: var(--text-micro);
	letter-spacing: 0;
	text-transform: uppercase;
	/*
	 * Techo duro: pase lo que pase con la tipografía o con una etiqueta futura
	 * más larga, una ranura no invade a la vecina. `min-width: 0` en `.hud-slot`
	 * no basta, porque sin esto el texto se sale igual de la caja ya encogida.
	 */
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
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
/*
 * El reloj pide más ancho que los contadores: muestra hasta seis caracteres
 * frente a uno o dos. Repartir la barra en partes iguales le quedaba corto.
 */
.hud-clock {
	flex-grow: 1.6;
}

.hud-clock-urgent {
	background-color: var(--color-pink);
	outline: 3px solid var(--color-ink);
}

/*
 * Escalón compacto para móviles de 320px (iPhone SE de 1ª generación).
 *
 * Ahí las cuatro etiquetas sumaban 236px dentro de una barra de 228px y se
 * pisaban entre sí: se leía «RESTANTAECIERTOSFALTANERRORES». Lo que sobra es el
 * tracking en versales y el aire de la barra, no el texto, así que se recortan
 * los tres y las palabras caben enteras en lugar de recortarse con un elipsis.
 *
 * El corte va en `width <`, no en el `width >=` de abajo, para que los anchos de
 * 375px en adelante conserven exactamente la barra diseñada.
 */
@media (width < 23.4375rem) {
	.hud-bar {
		gap: calc(var(--spacing-gutter) / 8);
		padding: calc(var(--spacing-gutter) / 6);
	}

	/*
	 * El reloj es el único campo con seis caracteres —«0:09.0», cuando la cuenta
	 * atrás pasa a décimas en los últimos segundos— frente a uno o dos de los
	 * contadores. Con ranuras iguales se salía de la barra y se montaba sobre el
	 * marcador de aciertos, justo en el momento de más tensión de la partida.
	 */
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
