<script setup lang="ts">
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import {useGameSetup} from '@/composables/useGameSetup'
import {LEVELS} from '@/data/levels'
import {MODE_LABELS, MODE_RULES} from '@/data/modes'
import {DIFFICULTIES, MENU_MODES, PRACTICE_MODE} from '@/types/game'

/**
 * Selección de modo y nivel.
 *
 * Se separó de la portada porque una sola pantalla hacía seis trabajos y ninguno
 * cabía entero en un móvil (`PLAN.md`, Bitácora, D14). Con sitio propio, los
 * tres modos pueden mostrar su regla **a la vez**: elegir pasa a ser comparar en
 * lugar de adivinar.
 */
const router = useRouter()

const {mode, difficulty, setMode, setDifficulty, levelSummary, destination} = useGameSetup()

function play(): void {
	router.push(destination.value)
}

/**
 * Salida explícita. Instalada como PWA no hay «atrás» del navegador: dejar una
 * pantalla sin salida propia es el defecto 4 de T8.1, que ya mordió una vez en
 * la pantalla de juego.
 */
function goBack(): void {
	router.push({name: 'home'})
}
</script>

<template>
	<section class="setup">
		<header class="setup-header">
			<ChoiceButton
				variant="ghost"
				class="setup-back"
				aria-label="Volver a la portada"
				@click="goBack"
			>
				<span aria-hidden="true">←</span>
			</ChoiceButton>
			<h1 class="setup-heading">Nueva partida</h1>
		</header>

		<div class="setup-choices">
			<!--
				Los modos van apilados a ancho completo y con su regla visible, no como
				pastillas: la diferencia entre ellos es la regla, no el nombre.
			-->
			<fieldset class="setup-group">
				<legend class="setup-legend">Modo</legend>
				<div class="setup-modes">
					<ChoiceButton
						v-for="option in MENU_MODES"
						:key="option"
						class="setup-mode"
						:selected="mode === option"
						@click="setMode(option)"
					>
						<span class="setup-mode-label">{{ MODE_LABELS[option] }}</span>
						<span class="setup-mode-rule">{{ MODE_RULES[option] }}</span>
					</ChoiceButton>
				</div>
			</fieldset>

			<fieldset class="setup-group">
				<legend class="setup-legend">Nivel</legend>
				<div class="setup-levels">
					<ChoiceButton
						v-for="option in DIFFICULTIES"
						:key="option"
						:selected="difficulty === option"
						@click="setDifficulty(option)"
					>
						{{ LEVELS[option].label }}
					</ChoiceButton>
				</div>
				<p class="setup-hint">{{ levelSummary }}</p>
			</fieldset>
		</div>

		<ChoiceButton variant="primary" class="setup-play" @click="play">
			{{ mode === PRACTICE_MODE ? 'Entrar al Dojo' : 'Jugar' }}
		</ChoiceButton>
	</section>
</template>

<style scoped>
.setup {
	display: flex;
	flex: 1;
	min-height: 0;
	flex-direction: column;
	align-items: center;
	gap: calc(var(--spacing-gutter) * 2 / 3);
	padding: var(--spacing-screen-mobile);
	overflow-y: auto;
}

.setup-header {
	display: flex;
	align-items: center;
	gap: calc(var(--spacing-gutter) / 2);
	width: 100%;
	max-width: 32rem;
}

.setup-back {
	flex: 0 0 auto;
	/* Cuadrado, como las demás salidas del sistema: la flecha no necesita
	   el relleno horizontal de un botón de texto. */
	width: var(--spacing-touch);
	padding: 0;
	font-size: var(--text-headline-md);
	background-color: var(--color-card);
}

.setup-heading {
	font-size: var(--text-headline-md);
	margin: 0;
}

.setup-choices {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) * 2 / 3);
	width: 100%;
	max-width: 32rem;
}

.setup-group {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 3);
	border: none;
	padding: 0;
	margin: 0;
}

.setup-legend {
	font-family: var(--font-display);
	font-size: var(--text-label-bold);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	padding: 0;
}

.setup-modes {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 3);
}

.setup-mode {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 2px;
	/* El texto manda el alto: son dos líneas, no una etiqueta centrada. */
	padding: calc(var(--spacing-gutter) / 3) calc(var(--spacing-gutter) / 2);
	text-align: left;
}

.setup-mode-label {
	font-size: var(--text-label-bold);
}

/*
 * La regla se lee en el cuerpo del texto y no en versales: es una frase, no una
 * etiqueta, y en versales con tracking competiría con el nombre del modo.
 */
.setup-mode-rule {
	font-family: var(--font-body);
	font-size: var(--text-caption);
	font-weight: 500;
	text-transform: none;
	letter-spacing: 0;
	opacity: 0.75;
}

.setup-levels {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--spacing-gutter) / 3);
}

.setup-levels > * {
	flex: 1 1 6rem;
}

.setup-hint {
	font-size: var(--text-caption);
}

.setup-play {
	width: 100%;
	max-width: 32rem;
	font-size: var(--text-headline-md);
}

@media (width >= 40rem) {
	.setup {
		padding: var(--spacing-screen-desktop);
		gap: var(--spacing-gutter);
	}

	.setup-choices {
		gap: var(--spacing-gutter);
	}

	.setup-heading {
		font-size: var(--text-headline-lg);
	}
}
</style>
