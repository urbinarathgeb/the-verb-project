<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import {useGameEngine} from '@/composables/useGameEngine'
import {useRanking} from '@/composables/useRanking'
import {LEVELS, MIN_MATCHES_FOR_RANKING} from '@/data/levels'
import {formatDuration, formatPace} from '@/lib/format'

/**
 * Desenlace de la partida.
 *
 * Lee el resultado del motor, que sobrevive al desmontaje de `GameScreen`
 * precisamente para esto. Las métricas cambian por modo, porque cada uno se
 * clasifica por una cosa distinta (`MECHANICS.md` §2 y §3): en Contrarreloj
 * manda el tiempo, en Precisión el ritmo.
 */
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

const modeLabel = computed(() =>
	result.value === null ? '' : result.value.mode === 'target' ? 'Contrarreloj' : 'Precisión',
)

/** Métricas destacadas, distintas por modo. */
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

/**
 * Por qué esta partida no entra en el ranking, cuando no entra. Se explica el
 * motivo en lugar de callar: en Precisión el piso de aciertos es una regla que
 * el jugador no puede deducir del tablero.
 */
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

/**
 * Qué pasó con el guardado, en palabras.
 *
 * `null` significa que no hay nada que decir —la partida se guardó y ya lo dice
 * la nota del ranking— para no llenar la pantalla de confirmaciones obvias.
 */
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
		// `not-persisted` es una derrota en Contrarreloj, y `rankingNote` ya lo
		// explica mejor que un mensaje sobre el guardado.
		default:
			return null
	}
})

/**
 * El puesto sólo se anuncia cuando hay algo que celebrar.
 *
 * Decirle «quedaste 7.º» a quien acaba de hacer una partida mediocre no aporta
 * nada y suena a reproche; lo útil entonces es ver su propia marca para saber
 * cuánto le faltó. El puesto se reserva para el récord y la primera marca.
 */
const showsPosition = computed(
	() =>
		position.value !== null && (lastVerdict.value === 'improved' || lastVerdict.value === 'first'),
)

/** Mejor marca del jugador en este modo y nivel, ya formateada. */
const personalBestLabel = computed(() => {
	const metric = personalBestMetric.value
	const current = result.value

	if (metric === null || current === null) return null

	return current.mode === 'target' ? formatDuration(metric) : formatPace(metric)
})

/**
 * Mensaje de récord, o `null` si no hay nada que celebrar.
 *
 * La primera marca no se anuncia como récord: no había nada que batir, y decir
 * «¡nuevo récord!» sonaría a premio vacío. Pero tampoco merece silencio.
 */
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

/**
 * `true` cuando el jugador se marcha por su propio pie.
 *
 * Distingue salir de la pantalla de que la pantalla se remonte, y es lo que
 * permite descartar la partida sólo en el primer caso.
 */
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
	/*
	 * Sin resultado se muestra un estado vacío, NO se redirige.
	 *
	 * Antes había aquí un `router.replace({name:'home'})` mudo, y como esta
	 * pantalla se borra el resultado al salir, cualquier remontaje —una recarga,
	 * entrar por URL, volver atrás— expulsaba al jugador al menú sin decir nada.
	 * Era exactamente la sensación de «terminé la partida y volví al menú».
	 */
	if (result.value === null) return

	/*
	 * El guardado no bloquea la pantalla: el resultado ya está calculado y se
	 * muestra al instante, y la nota sobre la persistencia aparece cuando la
	 * escritura termine. Que falle la red no debe impedir ver la partida.
	 */
	void submitResult(result.value)
})

/*
 * La partida se descarta al salir para no arrastrarla a la siguiente, pero sólo
 * cuando el jugador se va por su propio pie. `isLeaving` lo marca; sin esa
 * guarda, un remontaje de esta pantalla se quedaría sin resultado que mostrar.
 */
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

			<!--
				Sólo aparece si se conoce. Como invitado, sin backend o si falla la
				consulta, se calla en lugar de mostrar un dato inventado.
			-->
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

		<p v-if="rankingNote" class="result-note">{{ rankingNote }}</p>

		<!--
			Estado de la persistencia. Se dice aquí, cuando hay un resultado concreto
			en juego, y no antes de jugar (`CLAUDE.md` §8).
		-->
		<p v-if="saveNote !== null" class="result-guest">{{ saveNote }}</p>

		<div class="result-actions">
			<ChoiceButton variant="primary" @click="playAgain">Jugar otra vez</ChoiceButton>
			<ChoiceButton variant="secondary" @click="goToRanking">Clasificación</ChoiceButton>
			<ChoiceButton variant="ghost" @click="goHome">Volver al menú</ChoiceButton>
		</div>
	</section>

	<!--
		Sin partida en memoria. Ocurre al recargar aquí o al entrar por URL. Antes
		esto redirigía al menú en silencio, que se percibía como que la partida se
		había perdido sin explicación.
	-->
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
	justify-content: center;
	gap: var(--spacing-gutter);
	padding: var(--spacing-margin-mobile);
	overflow-y: auto;
}

.result-header {
	padding: var(--spacing-gutter);
	text-align: center;
	width: 100%;
	max-width: 32rem;
}

/* La victoria se celebra en amarillo; la derrota no se castiga en rosa, que en
   el tablero significa "fallaste esta tríada" y aquí sería redundante. */
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
	justify-content: center;
	gap: 2px;
	flex: 1 1 8rem;
	padding: calc(var(--spacing-gutter) / 2);
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
	font-size: var(--text-headline-lg);
	font-weight: 800;
	font-variant-numeric: tabular-nums;
	margin: 0;
}

.result-metric-unit {
	font-size: var(--text-caption);
	margin: 0;
	opacity: 0.7;
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
		padding: var(--spacing-margin-desktop);
	}

	.result-title {
		font-size: var(--text-display-lg);
	}
}
</style>
