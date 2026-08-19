<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue'
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import {usePracticeEngine} from '@/composables/usePracticeEngine'
import {LEVELS} from '@/data/levels'
import {FORM_LABELS} from '@/lib/practice'
import {isDifficulty} from '@/types/game'

const props = defineProps<{difficulty: string}>()

const router = useRouter()
const engine = usePracticeEngine()

const level = computed(() => (isDifficulty(props.difficulty) ? LEVELS[props.difficulty] : null))

const question = computed(() => engine.question.value)

function optionVariant(option: string): 'primary' | 'secondary' | 'ghost' {
	if (!engine.isAnswered.value) return 'secondary'

	if (option === question.value?.correctAnswer) return 'primary'

	return option === engine.selectedAnswer.value ? 'ghost' : 'secondary'
}

function isWrongChoice(option: string): boolean {
	return (
		engine.isAnswered.value &&
		option === engine.selectedAnswer.value &&
		option !== question.value?.correctAnswer
	)
}

const announcement = ref('')

const nextButton = useTemplateRef<{focus: () => void}>('next')

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

		void nextTick(() => nextButton.value?.focus())
	},
)

function handleAnswer(option: string): void {
	engine.answer(option)
}

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
				<p class="practice-meaning">{{ question.meaning }}</p>
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
					{{ engine.isLastAnswerCorrect.value ? '¡Correcto!' : 'No era esa.' }}
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

		<p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
			{{ announcement }}
		</p>

		<footer class="practice-footer">
			<p class="practice-level">Nivel {{ level?.label }}</p>
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
	gap: calc(var(--spacing-gutter) * 2 / 3);
	padding: var(--spacing-screen-mobile);
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
	gap: calc(var(--spacing-gutter) * 2 / 3);
	width: 100%;
	max-width: 32rem;
	flex: 1 1 auto;
	justify-content: center;
}

.practice-question {
	padding: calc(var(--spacing-gutter) / 2);
	text-align: center;
}

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

.practice-meaning {
	font-size: var(--text-caption);
	opacity: 0.7;
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

.practice-option:disabled {
	opacity: 1;
	box-shadow: var(--shadow-brutal-sm);
}

.practice-option-wrong {
	background-color: var(--color-pink);
	opacity: 1;
}

.practice-feedback {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: calc(var(--spacing-gutter) / 2);
	min-height: calc(var(--spacing-touch) + 8px);
}

.practice-verdict {
	font-family: var(--font-display);
	white-space: nowrap;
	font-size: var(--text-label-bold);
	text-transform: uppercase;
	text-align: center;
	margin: 0;
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

@media (height < 40rem) {
	.practice {
		gap: calc(var(--spacing-gutter) / 3);
	}

	.practice-body {
		gap: calc(var(--spacing-gutter) / 3);
	}

	.practice-question {
		padding: calc(var(--spacing-gutter) / 3);
	}

	.practice-word {
		font-size: var(--text-headline-md);
	}

	.practice-meaning {
		font-size: var(--text-micro);
	}

	.practice-asked {
		margin-top: 4px;
	}

	.practice-options {
		gap: calc(var(--spacing-gutter) / 3);
	}

	.practice-hud {
		padding: calc(var(--spacing-gutter) / 4);
	}

	.practice-footer {
		gap: calc(var(--spacing-gutter) / 3);
	}

	.practice-footer > :last-child {
		padding-inline: calc(var(--spacing-gutter) / 2);
		font-size: var(--text-caption);
	}
}

@media (width >= 40rem) {
	.practice {
		padding: var(--spacing-screen-desktop);
		gap: var(--spacing-gutter);
	}

	.practice-body {
		gap: var(--spacing-gutter);
	}

	.practice-question {
		padding: var(--spacing-gutter);
	}

	.practice-verdict {
		font-size: var(--text-headline-md);
	}

	.practice-word {
		font-size: var(--text-display-lg);
	}

	.practice-shortcuts {
		display: block;
	}
}
</style>
