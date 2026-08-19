<script setup lang="ts">
import {onMounted, ref, watch} from 'vue'
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import RankingTable from '@/components/RankingTable.vue'
import {useAuth} from '@/composables/useAuth'
import {useRanking} from '@/composables/useRanking'
import {LEVELS, MIN_MATCHES_FOR_RANKING} from '@/data/levels'
import {DIFFICULTIES, GAME_MODES, type Difficulty, type GameMode} from '@/types/game'

/**
 * Clasificación por modo y nivel.
 *
 * Son seis tablas distintas (dos modos × tres niveles) y no una sola: comparar
 * un tiempo de nivel fácil con uno de difícil no significaría nada, porque el
 * tablero y el objetivo cambian (`MECHANICS.md` §5).
 */
const router = useRouter()
const {entries, isLoading, isEmpty, loadError, loadRanking} = useRanking()
const {userId, isAuthenticated} = useAuth()

const MODE_LABELS: Record<GameMode, string> = {
	target: 'Contrarreloj',
	precision: 'Supervivencia',
}

const selectedMode = ref<GameMode>('target')
const selectedDifficulty = ref<Difficulty>('easy')

// Un único observador para las dos pestañas: cualquier cambio recarga.
watch([selectedMode, selectedDifficulty], ([mode, difficulty]) => {
	void loadRanking(mode, difficulty)
})

onMounted(() => {
	void loadRanking(selectedMode.value, selectedDifficulty.value)
})

function goHome(): void {
	router.push({name: 'home'})
}
</script>

<template>
	<section class="ranking">
		<header class="ranking-header brutal-card paper-tilt-1">
			<h1 class="ranking-heading">Ranking</h1>
		</header>

		<div class="ranking-filters">
			<fieldset class="ranking-group">
				<legend class="ranking-legend">Modo</legend>
				<div class="ranking-options">
					<ChoiceButton
						v-for="mode in GAME_MODES"
						:key="mode"
						:selected="selectedMode === mode"
						@click="selectedMode = mode"
					>
						{{ MODE_LABELS[mode] }}
					</ChoiceButton>
				</div>
			</fieldset>

			<fieldset class="ranking-group">
				<legend class="ranking-legend">Nivel</legend>
				<div class="ranking-options">
					<ChoiceButton
						v-for="difficulty in DIFFICULTIES"
						:key="difficulty"
						:selected="selectedDifficulty === difficulty"
						@click="selectedDifficulty = difficulty"
					>
						{{ LEVELS[difficulty].label }}
					</ChoiceButton>
				</div>
			</fieldset>
		</div>

		<!--
			`aria-live` para que quien no ve la pantalla se entere de que la tabla
			cambió al pulsar una pestaña: sin esto, el cambio ocurre en silencio.
		-->
		<div class="ranking-body" aria-live="polite" :aria-busy="isLoading">
			<p v-if="isLoading" class="ranking-state">Cargando…</p>

			<p v-else-if="loadError !== null" class="ranking-state ranking-error" role="alert">
				{{ loadError }}
			</p>

			<div v-else-if="isEmpty" class="ranking-state ranking-empty">
				<p>Todavía no hay marcas en esta tabla.</p>
				<!-- Estado vacío que explica cómo dejar de estarlo, en vez de sólo constatarlo. -->
				<p class="ranking-empty-hint">
					<template v-if="!isAuthenticated">
						Entra con tu cuenta desde el menú y juega una partida: los resultados de invitado no se
						guardan.
					</template>
					<template v-else-if="selectedMode === 'target'">
						Completa el objetivo en este nivel para aparecer aquí.
					</template>
					<template v-else>
						Consigue al menos {{ MIN_MATCHES_FOR_RANKING }} aciertos en este nivel para aparecer
						aquí.
					</template>
				</p>
			</div>

			<RankingTable v-else :entries="entries" :mode="selectedMode" :current-user-id="userId" />
		</div>

		<div class="ranking-actions">
			<ChoiceButton variant="secondary" @click="goHome">Volver al menú</ChoiceButton>
		</div>
	</section>
</template>

<style scoped>
.ranking {
	display: flex;
	flex: 1;
	min-height: 0;
	flex-direction: column;
	align-items: center;
	gap: var(--spacing-gutter);
	padding: var(--spacing-margin-mobile);
	overflow-y: auto;
}

.ranking-header {
	padding: calc(var(--spacing-gutter) / 2) var(--spacing-gutter);
	text-align: center;
}

.ranking-heading {
	font-size: var(--text-headline-md);
	margin: 0;
}

.ranking-filters {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 2);
	width: 100%;
	max-width: 44rem;
}

.ranking-group {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 3);
	border: none;
	padding: 0;
	margin: 0;
}

.ranking-legend {
	font-family: var(--font-display);
	font-size: var(--text-label-bold);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	padding: 0;
}

.ranking-options {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--spacing-gutter) / 2);
}

.ranking-options > * {
	flex: 1 1 7rem;
}

.ranking-body {
	display: flex;
	justify-content: center;
	width: 100%;
	/* Reserva para que cambiar de pestaña no haga saltar los botones de abajo. */
	min-height: 12rem;
}

.ranking-state {
	align-self: center;
	text-align: center;
	font-size: var(--text-caption);
	max-width: 32rem;
}

.ranking-error {
	padding: calc(var(--spacing-gutter) / 3);
	border: 3px solid var(--color-ink);
	background-color: var(--color-pink);
}

.ranking-empty-hint {
	margin-top: calc(var(--spacing-gutter) / 3);
	opacity: 0.75;
}

.ranking-actions {
	width: 100%;
	max-width: 44rem;
}

.ranking-actions > * {
	width: 100%;
}

@media (width >= 40rem) {
	.ranking {
		padding: var(--spacing-margin-desktop);
	}

	.ranking-heading {
		font-size: var(--text-headline-lg);
	}
}
</style>
