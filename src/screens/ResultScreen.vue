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

/**
 * Desenlace de la partida.
 *
 * Lee el resultado del motor, que sobrevive al desmontaje de `GameScreen`
 * precisamente para esto. Las métricas cambian por modo, porque cada uno se
 * clasifica por una cosa distinta (`MECHANICS.md` §2 y §3): en Contrarreloj
 * manda el tiempo, en Supervivencia el ritmo.
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

const modeLabel = computed(() => (result.value === null ? '' : MODE_LABELS[result.value.mode]))

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
 * motivo en lugar de callar: en Supervivencia el piso de aciertos es una regla que
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
 * Fallos de la partida, para repasarlos.
 *
 * Un fallo sin explicación es una oportunidad de aprendizaje desperdiciada
 * (`PRODUCT.md` §1 y §5). Se ofrecen sólo si los hubo: un botón que abre una
 * lista vacía es peor que no tenerlo.
 */
const mistakes = computed(() => engine.mistakes.value)

const isMistakesOpen = ref(false)

/**
 * Cuántos errores se repasan sin abrir nada.
 *
 * El repaso es la razón de ser de esta pantalla —el instante posterior a fallar
 * es cuando el error significa algo—, así que se ve en la propia pantalla y no
 * tras un modal. El tope existe porque una partida con ocho fallos empujaría las
 * acciones a otro scroll, que es justo el defecto que se está corrigiendo.
 */
const INLINE_MISTAKES = 3

const visibleMistakes = computed(() => mistakes.value.slice(0, INLINE_MISTAKES))

const hiddenMistakeCount = computed(() => Math.max(0, mistakes.value.length - INLINE_MISTAKES))

/** «Los 1 restantes» chirría; el singular necesita su propia frase. */
const moreMistakesLabel = computed(() =>
	hiddenMistakeCount.value === 1
		? 'Ver el error restante'
		: `Ver los ${hiddenMistakeCount.value} errores restantes`,
)

/** Encabeza el repaso. En singular no se anuncia una lista que no existe. */
const reviewTitle = computed(() =>
	mistakes.value.length === 1 ? 'Lo que fallaste' : `Lo que fallaste · ${mistakes.value.length}`,
)

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

		<!--
			El repaso va **antes** de las acciones y a la vista. Estaba al final, tras
			los tres botones y fuera de pantalla, así que lo único visible al terminar
			una partida era volver a jugar.

			La jerarquía la dan la posición y la presencia, no el color: «Jugar otra
			vez» sigue siendo el único botón primario, porque el amarillo significa
			«acción principal» en todo el sistema y dos seguidos no significarían nada.
		-->
		<section v-if="mistakes.length > 0" class="result-review brutal-card">
			<h2 class="result-review-title">{{ reviewTitle }}</h2>

			<MistakeItem v-for="(mistake, index) in visibleMistakes" :key="index" :mistake="mistake" />

			<ChoiceButton v-if="hiddenMistakeCount > 0" variant="ghost" @click="isMistakesOpen = true">
				{{ moreMistakesLabel }}
			</ChoiceButton>
		</section>

		<!--
			Las dos notas administrativas —si el resultado clasifica y si se guarda—
			bajan aquí, junto a las acciones con las que se relacionan. Entre las
			métricas y el repaso costaban 72px del presupuesto que decide si el
			jugador ve o no lo que falló.
		-->
		<p v-if="rankingNote" class="result-note">{{ rankingNote }}</p>

		<p v-if="saveNote !== null" class="result-guest">{{ saveNote }}</p>

		<div class="result-actions">
			<ChoiceButton variant="primary" @click="playAgain">Jugar otra vez</ChoiceButton>
			<ChoiceButton variant="secondary" @click="goToRanking">Clasificación</ChoiceButton>
			<ChoiceButton variant="ghost" @click="goHome">Volver al menú</ChoiceButton>
		</div>

		<!--
			`focus-panel` porque es sobre todo texto: enfocar el botón del final
			arrastraría el scroll y el modal se abriría por la mitad.
		-->
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
	justify-content: flex-start;
	/*
	 * Intervalo corto en móvil. El presupuesto vertical de esta pantalla lo manda
	 * el repaso de errores, que tiene que verse sin desplazarse; el aire entre
	 * bloques es lo primero que cede para conseguirlo.
	 */
	gap: calc(var(--spacing-gutter) * 2 / 3);
	padding: var(--spacing-screen-mobile);
	overflow-y: auto;
}

/*
 * Centrado que no se come el contenido.
 *
 * `justify-content: center` sobre un contenedor que además desplaza reparte el
 * desbordamiento arriba y abajo, pero `scrollTop` no puede ser negativo: la
 * mitad superior queda inalcanzable para siempre. Los márgenes automáticos
 * centran igual cuando el contenido cabe, y cuando no cabe lo anclan arriba,
 * que es lo que hace que se pueda llegar a todo.
 *
 * `justify-content: safe center` dice esto mismo en una línea, pero su soporte
 * en el Safari de iOS es irregular y el móvil es justo el caso a resolver.
 */
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

/*
 * Las tres métricas caben en una fila en móvil.
 *
 * Con una base de 8rem sólo entraban dos por línea y el bloque medía 276px: dos
 * filas y media de tarjetas para tres números de dos caracteres. Ese alto era el
 * que empujaba el repaso de errores fuera de la pantalla.
 */
.result-metric {
	display: flex;
	flex-direction: column;
	align-items: center;
	/*
	 * Alineadas por arriba, no centradas: sólo una de las tarjetas lleva unidad
	 * («verbos por minuto»), y centrar cada una por su cuenta dejaba sus rótulos y
	 * sus cifras a alturas distintas dentro de la misma fila.
	 */
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

/*
 * El repaso de errores. Es el bloque por el que existe esta pantalla, así que
 * ocupa una superficie propia en lugar de ser una línea más de texto suelto.
 */
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
