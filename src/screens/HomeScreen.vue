<script setup lang="ts">
import {computed, ref} from 'vue'
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import {LEVELS} from '@/data/levels'
import {DIFFICULTIES, GAME_MODES, type Difficulty, type GameMode} from '@/types/game'

/**
 * Menú de entrada: elegir modo y nivel.
 *
 * No hay header ni footer: la app es un juego a pantalla completa
 * (`CLAUDE.md`). El menú es la primera "pantalla de juego", no una portada.
 */
const router = useRouter()

/** Textos de cada modo. Los identificadores van en inglés; lo visible, en español. */
const MODE_INFO: Record<GameMode, {label: string; description: string}> = {
	target: {
		label: 'Contrarreloj',
		description: 'Empareja los verbos del objetivo antes de que se acabe el tiempo.',
	},
	precision: {
		label: 'Precisión',
		description: 'Sin límite de tiempo, pero un solo error termina la partida.',
	},
}

const selectedMode = ref<GameMode>('target')
const selectedDifficulty = ref<Difficulty>('easy')

const modeDescription = computed(() => MODE_INFO[selectedMode.value].description)

/** Resumen del nivel elegido, para que la dificultad no sea sólo una etiqueta. */
const levelSummary = computed(() => {
	const level = LEVELS[selectedDifficulty.value]
	const size = `${level.boardSize} verbos en pantalla`

	return selectedMode.value === 'target'
		? `${size} · objetivo de ${level.targetVerbs} · ${level.timeLimitMs / 1000} s`
		: `${size} · hasta el primer fallo`
})

function play(): void {
	router.push({
		name: 'play',
		params: {mode: selectedMode.value, difficulty: selectedDifficulty.value},
	})
}
</script>

<template>
	<section class="home">
		<header class="home-title brutal-card paper-tilt-1">
			<h1 class="home-heading">The Verb Project</h1>
			<p class="home-tagline">Empareja presente, pasado y participio.</p>
		</header>

		<div class="home-choices">
			<fieldset class="home-group">
				<legend class="home-legend">Modo</legend>
				<div class="home-options">
					<ChoiceButton
						v-for="mode in GAME_MODES"
						:key="mode"
						:selected="selectedMode === mode"
						@click="selectedMode = mode"
					>
						{{ MODE_INFO[mode].label }}
					</ChoiceButton>
				</div>
				<p class="home-hint">{{ modeDescription }}</p>
			</fieldset>

			<fieldset class="home-group">
				<legend class="home-legend">Nivel</legend>
				<div class="home-options">
					<ChoiceButton
						v-for="difficulty in DIFFICULTIES"
						:key="difficulty"
						:selected="selectedDifficulty === difficulty"
						@click="selectedDifficulty = difficulty"
					>
						{{ LEVELS[difficulty].label }}
					</ChoiceButton>
				</div>
				<p class="home-hint">{{ levelSummary }}</p>
			</fieldset>
		</div>

		<ChoiceButton variant="primary" class="home-play" @click="play">Jugar</ChoiceButton>
	</section>
</template>

<style scoped>
.home {
	display: flex;
	flex: 1;
	min-height: 0;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: var(--spacing-gutter);
	padding: var(--spacing-margin-mobile);
	/* El menú puede desbordar en pantallas muy bajas; el tablero nunca. */
	overflow-y: auto;
}

.home-title {
	padding: var(--spacing-gutter);
	text-align: center;
}

.home-heading {
	font-size: var(--text-headline-lg);
	margin: 0;
}

.home-tagline {
	font-size: var(--text-caption);
	margin-top: 4px;
	text-transform: none;
}

.home-choices {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-gutter);
	width: 100%;
	max-width: 32rem;
}

.home-group {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 2);
	border: none;
	padding: 0;
	margin: 0;
}

.home-legend {
	font-family: var(--font-display);
	font-size: var(--text-label-bold);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	padding: 0;
}

.home-options {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--spacing-gutter) / 2);
}

.home-options > * {
	flex: 1 1 8rem;
}

.home-hint {
	font-size: var(--text-caption);
	min-height: 2.4em;
}

.home-play {
	width: 100%;
	max-width: 32rem;
	font-size: var(--text-headline-md);
}

@media (width >= 40rem) {
	.home {
		padding: var(--spacing-margin-desktop);
		gap: calc(var(--spacing-gutter) * 1.5);
	}

	.home-heading {
		font-size: var(--text-display-lg);
	}

	.home-tagline {
		font-size: var(--text-body-md);
	}
}
</style>
