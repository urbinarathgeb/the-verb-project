<script setup lang="ts">
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import {useGameSetup} from '@/composables/useGameSetup'
import {LEVELS} from '@/data/levels'
import {MODE_LABELS, MODE_RULES} from '@/data/modes'
import {DIFFICULTIES, MENU_MODES, PRACTICE_MODE} from '@/types/game'

const router = useRouter()

const {mode, difficulty, setMode, setDifficulty, levelSummary, destination} = useGameSetup()

function play(): void {
	router.push(destination.value)
}

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
	padding: calc(var(--spacing-gutter) / 3) calc(var(--spacing-gutter) / 2);
	text-align: left;
}

.setup-mode-label {
	font-size: var(--text-label-bold);
}

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
