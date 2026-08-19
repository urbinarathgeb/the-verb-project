<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue'
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import {usePracticeEngine} from '@/composables/usePracticeEngine'
import {LEVELS} from '@/data/levels'
import {FORM_LABELS} from '@/lib/practice'
import {isDifficulty} from '@/types/game'

/**
 * Dojo: opción múltiple sin cronómetro (`MECHANICS.md` §4).
 *
 * El identificador de la ruta y del código sigue siendo `practice`; «Dojo» es
 * sólo el nombre visible (`CLAUDE.md` §5).
 *
 * A diferencia de la partida, aquí no hay reloj ni derrota. El refuerzo es la
 * racha, y el feedback es inmediato: se responde, se ve el resultado y se pasa a
 * la siguiente cuando el jugador quiere.
 */
const props = defineProps<{difficulty: string}>()

const router = useRouter()
const engine = usePracticeEngine()

const level = computed(() => (isDifficulty(props.difficulty) ? LEVELS[props.difficulty] : null))

const question = computed(() => engine.question.value)

/** Estado visual de cada opción, una vez respondida. */
function optionVariant(option: string): 'primary' | 'secondary' | 'ghost' {
	if (!engine.isAnswered.value) return 'secondary'

	// La correcta siempre se resalta, se haya acertado o no: ver la respuesta
	// buena es lo que convierte un fallo en aprendizaje.
	if (option === question.value?.correctAnswer) return 'primary'

	return option === engine.selectedAnswer.value ? 'ghost' : 'secondary'
}

/** Marca la opción elegida cuando fue incorrecta, para distinguirla del resto. */
function isWrongChoice(option: string): boolean {
	return (
		engine.isAnswered.value &&
		option === engine.selectedAnswer.value &&
		option !== question.value?.correctAnswer
	)
}

/* ---------------------------------------------------------------------------
 * Anuncio para lectores de pantalla
 * ------------------------------------------------------------------------- */

const announcement = ref('')

const nextButton = useTemplateRef<{focus: () => void}>('next')

/*
 * Cada pregunta nueva se anuncia entera.
 *
 * En pantalla el enunciado se reparte en tres líneas —la forma de partida, el
 * verbo y lo que se pregunta— y al pulsar «Siguiente» cambian las tres sin que
 * nada lo diga: quien usa un lector de pantalla tenía que ir a buscarlas. Se
 * anuncia `promptLabel`, que es la versión en una frase y sin símbolos.
 */
watch(
	() => engine.question.value?.verbId,
	(verbId) => {
		if (verbId === undefined) return

		announcement.value = engine.promptLabel.value
	},
)

watch(
	() => engine.isAnswered.value,
	(answered) => {
		if (!answered || question.value === null) return

		announcement.value = engine.isLastAnswerCorrect.value
			? `Correcto. Racha de ${engine.streak.value}.`
			: `Incorrecto. La respuesta era ${question.value.correctAnswer}.`

		/*
		 * El foco se mueve a «Siguiente» al responder, y no es un adorno: la opción
		 * que se acaba de pulsar se deshabilita, y el navegador saca el foco de un
		 * control deshabilitado hacia `<body>`. Sin esto, quien juega con teclado
		 * tenía que tabular desde el principio de la página en **cada** pregunta.
		 */
		void nextTick(() => nextButton.value?.focus())
	},
)

function handleAnswer(option: string): void {
	engine.answer(option)
}

/*
 * Atajos: 1, 2 y 3 eligen opción. Avanzar no necesita atajo propio porque el
 * foco ya está en «Siguiente» y Enter lo activa de forma nativa.
 *
 * El listener va en `window` y no en la sección: tras responder el foco se
 * mueve, y atarlo al árbol de la pantalla haría que el atajo dependiera de
 * dónde esté el foco en ese momento.
 */
function handleShortcut(event: KeyboardEvent): void {
	if (event.metaKey || event.ctrlKey || event.altKey) return
	if (engine.isAnswered.value) return

	const options = question.value?.options
	if (options === undefined) return

	const index = Number(event.key) - 1
	const option = Number.isInteger(index) ? options[index] : undefined
	if (option === undefined) return

	event.preventDefault()
	handleAnswer(option)
}

function goHome(): void {
	router.push({name: 'home'})
}

onMounted(() => {
	if (!isDifficulty(props.difficulty)) {
		router.replace({name: 'home'})
		return
	}

	engine.start(props.difficulty)
	window.addEventListener('keydown', handleShortcut)
})

onBeforeUnmount(() => {
	window.removeEventListener('keydown', handleShortcut)
})
</script>

<template>
	<section class="practice">
		<div class="practice-hud brutal-panel">
			<p class="practice-stat">
				<span class="practice-stat-label">Racha</span>
				<span class="practice-stat-value">{{ engine.streak.value }}</span>
			</p>
			<p class="practice-stat">
				<span class="practice-stat-label">Aciertos</span>
				<span class="practice-stat-value">
					{{ engine.correctCount.value }}/{{ engine.answeredCount.value }}
				</span>
			</p>
			<p class="practice-stat">
				<span class="practice-stat-label">Dominados</span>
				<span class="practice-stat-value">{{ engine.masteredCount.value }}</span>
			</p>
		</div>

		<div v-if="question !== null" class="practice-body">
			<div class="practice-question brutal-card paper-tilt-2">
				<p class="practice-form">{{ FORM_LABELS[question.promptForm] }}</p>
				<p class="practice-word">{{ question.prompt }}</p>
				<p class="practice-asked">¿Cuál es el {{ FORM_LABELS[question.requestedForm] }}?</p>
			</div>

			<ul class="practice-options">
				<li v-for="option in question.options" :key="option">
					<ChoiceButton
						class="practice-option"
						:class="{'practice-option-wrong': isWrongChoice(option)}"
						:variant="optionVariant(option)"
						:disabled="engine.isAnswered.value"
						@click="handleAnswer(option)"
					>
						{{ option }}
					</ChoiceButton>
				</li>
			</ul>

			<div class="practice-feedback">
				<p v-if="engine.isAnswered.value" class="practice-verdict">
					{{ engine.isLastAnswerCorrect.value ? '¡Correcto!' : 'La respuesta era otra.' }}
				</p>
				<ChoiceButton
					v-if="engine.isAnswered.value"
					ref="next"
					variant="primary"
					class="practice-next"
					@click="engine.next"
				>
					Siguiente
				</ChoiceButton>
			</div>
		</div>

		<!-- El feedback se comunica por color; esto lo traduce a texto. -->
		<p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
			{{ announcement }}
		</p>

		<footer class="practice-footer">
			<p class="practice-level">Nivel {{ level?.label }}</p>
			<!-- Sólo desde 40rem: es donde se da por hecho que hay teclado. -->
			<p class="practice-shortcuts">1 · 2 · 3 para responder</p>
			<ChoiceButton variant="ghost" @click="goHome">Volver al menú</ChoiceButton>
		</footer>
	</section>
</template>

<style scoped>
.practice {
	display: flex;
	flex: 1;
	min-height: 0;
	flex-direction: column;
	align-items: center;
	gap: var(--spacing-gutter);
	padding: var(--spacing-margin-mobile);
	overflow-y: auto;
}

.practice-hud {
	display: flex;
	justify-content: space-between;
	gap: calc(var(--spacing-gutter) / 4);
	padding: calc(var(--spacing-gutter) / 3);
	background-color: var(--color-card);
	width: 100%;
	max-width: 32rem;
}

.practice-stat {
	display: flex;
	flex-direction: column;
	align-items: center;
	flex: 1 1 0;
	min-width: 0;
	margin: 0;
}

.practice-stat-label {
	font-size: var(--text-caption);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	opacity: 0.7;
}

.practice-stat-value {
	font-family: var(--font-display);
	font-size: var(--text-headline-md);
	font-weight: 800;
	font-variant-numeric: tabular-nums;
}

.practice-body {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-gutter);
	width: 100%;
	max-width: 32rem;
	flex: 1 1 auto;
	justify-content: center;
}

.practice-question {
	padding: var(--spacing-gutter);
	text-align: center;
}

/*
 * La forma de partida se etiqueta siempre: `read` se escribe igual en presente y
 * pasado, y `cut` en las tres, así que sin esto la pregunta sería irresoluble.
 */
.practice-form {
	font-size: var(--text-caption);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	opacity: 0.7;
}

.practice-word {
	font-family: var(--font-display);
	font-size: var(--text-headline-lg);
	font-weight: 900;
	line-height: 1.1;
	overflow-wrap: anywhere;
}

.practice-asked {
	font-size: var(--text-body-md);
	margin-top: 8px;
}

.practice-options {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 2);
	list-style: none;
	padding: 0;
	margin: 0;
}

.practice-option {
	width: 100%;
	font-size: var(--text-headline-md);
	text-transform: lowercase;
}

/*
 * Tras responder, las opciones quedan deshabilitadas para que no se pueda volver
 * a pulsarlas, pero **no se atenúan**: aquí el deshabilitado es informativo, no
 * "no disponible". Con la opacidad de `ChoiceButton` el texto sobre rosa cae a
 * 2,73:1, por debajo incluso del mínimo para texto grande, y además apagaría
 * justo la respuesta correcta, que es lo que el jugador necesita leer.
 */
.practice-option:disabled {
	opacity: 1;
	box-shadow: var(--shadow-brutal-sm);
}

/* El fallo se marca en rosa, el mismo color que el error en el tablero. */
.practice-option-wrong {
	background-color: var(--color-pink);
	opacity: 1;
}

.practice-feedback {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: calc(var(--spacing-gutter) / 2);
	/* Reserva el hueco para que las opciones no salten al aparecer el feedback. */
	min-height: calc(var(--spacing-touch) + var(--spacing-gutter));
}

.practice-verdict {
	font-family: var(--font-display);
	font-size: var(--text-headline-md);
	text-transform: uppercase;
}

.practice-next {
	width: 100%;
}

.practice-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--spacing-gutter);
	width: 100%;
	max-width: 32rem;
}

.practice-level {
	font-size: var(--text-caption);
	text-transform: uppercase;
	letter-spacing: 0.08em;
}

.practice-shortcuts {
	display: none;
	font-size: var(--text-caption);
	opacity: 0.7;
}

@media (width >= 40rem) {
	.practice {
		padding: var(--spacing-margin-desktop);
	}

	.practice-word {
		font-size: var(--text-display-lg);
	}

	.practice-shortcuts {
		display: block;
	}
}
</style>
