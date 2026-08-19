<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import GameModal from '@/components/GameModal.vue'
import {useGameEngine} from '@/composables/useGameEngine'
import {useRanking} from '@/composables/useRanking'
import {LEVELS, MIN_MATCHES_FOR_RANKING} from '@/data/levels'
import {MODE_LABELS} from '@/data/modes'
import {formatDuration, formatPace} from '@/lib/format'
import MistakeItem from '@/components/MistakeItem.vue'

const router = useRouter()
const engine = useGameEngine()
const {lastSaveOutcome, position, personalBestMetric, lastVerdict, submitResult} = useRanking()

const result = computed(() => engine.result.value)

const isWin = computed(() => result.value?.status === 'won')

const title = computed(() => {
	if (result.value === null) return ''
	if (isWin.value) return '¡Lo lograste!'

	return result.value.mode === 'precision' ? 'Fallaste' : 'Se acabó el tiempo'
})

const levelLabel = computed(() =>
	result.value === null ? '' : LEVELS[result.value.difficulty].label,
)

const modeLabel = computed(() => (result.value === null ? '' : MODE_LABELS[result.value.mode]))

const metrics = computed(() => {
	const current = result.value
	if (current === null) return []

	if (current.mode === 'target') {
		return [
			{label: 'Tiempo', value: formatDuration(current.timeMs)},
			{label: 'Aciertos', value: current.verbsMatched.toString()},
			{label: 'Errores', value: current.errors.toString()},
		]
	}

	return [
		{label: 'Ritmo', value: formatPace(engine.pace.value), unit: 'verbos por minuto'},
		{label: 'Aciertos', value: current.verbsMatched.toString()},
		{label: 'Tiempo', value: formatDuration(current.timeMs)},
	]
})

const rankingNote = computed(() => {
	const current = result.value
	if (current === null) return ''

	if (current.mode === 'target' && !isWin.value) {
		return 'Sólo las partidas completadas entran en la clasificación.'
	}

	if (current.mode === 'precision' && current.verbsMatched < MIN_MATCHES_FOR_RANKING) {
		return `Necesitas al menos ${MIN_MATCHES_FOR_RANKING} aciertos para entrar en la clasificación.`
	}

	return ''
})

const saveNote = computed(() => {
	switch (lastSaveOutcome.value) {
		case 'guest':
			return 'Juegas como invitado: este resultado no se guarda ni entra en la clasificación.'
		case 'offline':
			return 'Sin conexión con el servidor: este resultado no se ha guardado.'
		case 'error':
			return 'No pudimos guardar este resultado. La partida cuenta igual, pero no aparecerá en la clasificación.'
		case 'saved':
			return 'Resultado guardado.'
		default:
			return null
	}
})

const showsPosition = computed(
	() =>
		position.value !== null && (lastVerdict.value === 'improved' || lastVerdict.value === 'first'),
)

const personalBestLabel = computed(() => {
	const metric = personalBestMetric.value
	const current = result.value

	if (metric === null || current === null) return null

	return current.mode === 'target' ? formatDuration(metric) : formatPace(metric)
})

const recordNote = computed(() => {
	switch (lastVerdict.value) {
		case 'improved':
			return '¡Nuevo récord personal en este nivel!'
		case 'first':
			return 'Tu primera marca en este nivel.'
		default:
			return null
	}
})

const mistakes = computed(() => engine.mistakes.value)

const isMistakesOpen = ref(false)

const INLINE_MISTAKES = 3

const visibleMistakes = computed(() => mistakes.value.slice(0, INLINE_MISTAKES))

const hiddenMistakeCount = computed(() => Math.max(0, mistakes.value.length - INLINE_MISTAKES))

const moreMistakesLabel = computed(() =>
	hiddenMistakeCount.value === 1
		? 'Ver el error restante'
		: `Ver los ${hiddenMistakeCount.value} errores restantes`,
)

const reviewTitle = computed(() =>
	mistakes.value.length === 1 ? 'Lo que fallaste' : `Lo que fallaste · ${mistakes.value.length}`,
)

const isLeaving = ref(false)

function leaveTo(navigate: () => void): void {
	isLeaving.value = true
	navigate()
}

function goToRanking(): void {
	leaveTo(() => void router.push({name: 'ranking'}))
}

function playAgain(): void {
	const current = result.value
	if (current === null) return

	leaveTo(
		() =>
			void router.push({
				name: 'play',
				params: {mode: current.mode, difficulty: current.difficulty},
			}),
	)
}

function goHome(): void {
	leaveTo(() => void router.push({name: 'home'}))
}

onMounted(() => {
	if (result.value === null) return

	void submitResult(result.value)
})

onBeforeUnmount(() => {
	if (isLeaving.value) engine.resetGame()
})
</script>

<template>
	<section v-if="result !== null" class="result">
		<header class="result-header brutal-card" :class="isWin ? 'result-win' : 'result-loss'">
			<h1 class="result-title">{{ title }}</h1>
			<p class="result-context">{{ modeLabel }} · Nivel {{ levelLabel }}</p>
		</header>

		<dl class="result-metrics">
			<div v-for="metric in metrics" :key="metric.label" class="result-metric brutal-card">
				<dt class="result-metric-label">{{ metric.label }}</dt>
				<dd class="result-metric-value">{{ metric.value }}</dd>
				<dd v-if="metric.unit" class="result-metric-unit">{{ metric.unit }}</dd>
			</div>

			<div v-if="showsPosition" class="result-metric brutal-card result-position">
				<dt class="result-metric-label">Posición</dt>
				<dd class="result-metric-value">{{ position }}º</dd>
				<dd class="result-metric-unit">en la clasificación</dd>
			</div>

			<div v-else-if="personalBestLabel !== null" class="result-metric brutal-card result-position">
				<dt class="result-metric-label">Tu mejor marca</dt>
				<dd class="result-metric-value">{{ personalBestLabel }}</dd>
				<dd class="result-metric-unit">en este nivel</dd>
			</div>
		</dl>

		<p v-if="recordNote !== null" class="result-record">{{ recordNote }}</p>

		<section v-if="mistakes.length > 0" class="result-review brutal-card">
			<h2 class="result-review-title">{{ reviewTitle }}</h2>

			<MistakeItem v-for="(mistake, index) in visibleMistakes" :key="index" :mistake="mistake" />

			<ChoiceButton v-if="hiddenMistakeCount > 0" variant="ghost" @click="isMistakesOpen = true">
				{{ moreMistakesLabel }}
			</ChoiceButton>
		</section>

		<p v-if="rankingNote" class="result-note">{{ rankingNote }}</p>

		<p v-if="saveNote !== null" class="result-guest">{{ saveNote }}</p>

		<div class="result-actions">
			<ChoiceButton variant="primary" @click="playAgain">Jugar otra vez</ChoiceButton>
			<ChoiceButton variant="secondary" @click="goToRanking">Clasificación</ChoiceButton>
			<ChoiceButton variant="ghost" @click="goHome">Volver al menú</ChoiceButton>
		</div>

		<GameModal
			:open="isMistakesOpen"
			title="Tus errores"
			dismissible
			focus-panel
			@close="isMistakesOpen = false"
		>
			<ol class="mistakes">
				<li v-for="(mistake, index) in mistakes" :key="index">
					<MistakeItem :mistake="mistake" />
				</li>
			</ol>

			<template #actions>
				<ChoiceButton variant="primary" @click="isMistakesOpen = false">Cerrar</ChoiceButton>
			</template>
		</GameModal>
	</section>

	<section v-else class="result">
		<div class="result-header brutal-card result-loss">
			<h1 class="result-title">No hay partida</h1>
			<p class="result-context">Nada que mostrar aquí todavía</p>
		</div>
		<p class="result-note">
			El resultado de una partida sólo vive mientras la ves. Juega una y vuelve.
		</p>
		<div class="result-actions">
			<ChoiceButton variant="primary" @click="goHome">Volver al menú</ChoiceButton>
		</div>
	</section>
</template>

<style scoped>
.result {
	display: flex;
	flex: 1;
	min-height: 0;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	gap: calc(var(--spacing-gutter) * 2 / 3);
	padding: var(--spacing-screen-mobile);
	overflow-y: auto;
}

.result > :first-child {
	margin-block-start: auto;
}

.result > :last-child {
	margin-block-end: auto;
}

.result-header {
	padding: calc(var(--spacing-gutter) / 2);
	text-align: center;
	width: 100%;
	max-width: 32rem;
}

.result-win {
	background-color: var(--color-electric);
}

.result-loss {
	background-color: var(--color-paper-dim);
}

.result-title {
	font-size: var(--text-headline-lg);
	margin: 0;
}

.result-context {
	font-size: var(--text-caption);
	margin-top: 4px;
	text-transform: uppercase;
	letter-spacing: 0.08em;
}

.result-metrics {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--spacing-gutter) / 2);
	width: 100%;
	max-width: 32rem;
	margin: 0;
}

.result-metric {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	gap: 2px;
	flex: 1 1 5rem;
	padding: calc(var(--spacing-gutter) / 3);
	text-align: center;
}

.result-metric-label {
	font-size: var(--text-caption);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	opacity: 0.7;
}

.result-metric-value {
	font-family: var(--font-display);
	font-size: var(--text-headline-md);
	font-weight: 800;
	font-variant-numeric: tabular-nums;
	margin: 0;
}

.result-metric-unit {
	font-size: var(--text-caption);
	margin: 0;
	opacity: 0.7;
}

.mistakes {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-gutter);
	margin: 0;
	padding: 0;
	list-style: none;
	text-align: left;
}

.result-record {
	padding: calc(var(--spacing-gutter) / 3) calc(var(--spacing-gutter) / 2);
	border: 3px solid var(--color-ink);
	background-color: var(--color-cyan);
	font-family: var(--font-display);
	font-size: var(--text-label-bold);
	text-transform: uppercase;
	letter-spacing: 0.04em;
	text-align: center;
}

.result-note,
.result-guest {
	font-size: var(--text-caption);
	text-align: center;
	max-width: 32rem;
}

.result-guest {
	opacity: 0.7;
}

.result-review {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-gutter);
	width: 100%;
	max-width: 32rem;
	padding: var(--spacing-gutter);
	text-align: left;
}

.result-review-title {
	font-size: var(--text-label-bold);
	letter-spacing: 0.04em;
	margin: 0;
}

.result-actions {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--spacing-gutter) / 2);
	width: 100%;
	max-width: 32rem;
}

.result-actions > * {
	flex: 1 1 10rem;
}

@media (width >= 40rem) {
	.result {
		padding: var(--spacing-screen-desktop);
	}

	.result {
		gap: var(--spacing-gutter);
	}

	.result-header {
		padding: var(--spacing-gutter);
	}

	.result-title {
		font-size: var(--text-display-lg);
	}

	.result-metric {
		flex: 1 1 8rem;
		padding: calc(var(--spacing-gutter) / 2);
	}

	.result-metric-value {
		font-size: var(--text-headline-lg);
	}
}
</style>
