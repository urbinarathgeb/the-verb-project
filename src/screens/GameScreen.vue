<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import GameBoard from '@/components/GameBoard.vue'
import GameModal from '@/components/GameModal.vue'
import HudBar from '@/components/HudBar.vue'
import {useGameEngine} from '@/composables/useGameEngine'
import {useHaptics} from '@/composables/useHaptics'
import {useTimer} from '@/composables/useTimer'
import {LEVELS} from '@/data/levels'
import {isDifficulty, isGameMode, type Cell} from '@/types/game'

const props = defineProps<{mode: string; difficulty: string}>()

const router = useRouter()
const engine = useGameEngine()
const haptics = useHaptics()

const gameMode = computed(() => (isGameMode(props.mode) ? props.mode : null))
const difficultyLevel = computed(() => (isDifficulty(props.difficulty) ? props.difficulty : null))

const levelLabel = computed(() =>
	difficultyLevel.value === null ? '' : LEVELS[difficultyLevel.value].label,
)

const COUNTDOWN_MS = 3000

const isCountingDown = ref(true)

const countdown = useTimer({
	limitMs: COUNTDOWN_MS,
	tickMs: 100,
	onExpire: () => beginGame(),
})

const countdownLabel = computed(() => {
	const remaining = countdown.remainingMs.value ?? 0
	return Math.max(1, Math.ceil(remaining / 1000)).toString()
})

function beginGame(): void {
	if (gameMode.value === null || difficultyLevel.value === null) return

	isCountingDown.value = false
	engine.startGame(gameMode.value, difficultyLevel.value)
}

const outcomeTitle = computed(() => {
	if (engine.status.value === 'won') return '¡Lo lograste!'

	return engine.mode.value === 'precision' ? 'Fallaste' : '¡Se acabó el tiempo!'
})

const outcomeSummary = computed(() => {
	const matched = engine.matchedCount.value
	const target = engine.targetVerbs.value

	if (engine.mode.value === 'target' && target !== null) {
		return `${matched} de ${target} verbos emparejados.`
	}

	return `${matched} verbos emparejados.`
})

function goHome(): void {
	engine.resetGame()
	router.push({name: 'home'}).catch(() => {})
}

const isQuitOpen = ref(false)

function requestQuit(): void {
	if (!engine.isPlaying.value) return
	isQuitOpen.value = true
}

function confirmQuit(): void {
	isQuitOpen.value = false
	goHome()
}

function handleVisibilityChange(): void {
	if (document.visibilityState === 'hidden') engine.pause()
}

function handleEscape(event: KeyboardEvent): void {
	if (event.key !== 'Escape') return
	if (!engine.isPlaying.value || isQuitOpen.value) return

	event.preventDefault()
	requestQuit()
}

function goToResult(): void {
	router.push({name: 'result'}).catch(() => {
		router.push({name: 'home'}).catch(() => {})
	})
}

const announcement = ref('')

function announce(message: string): void {
	announcement.value = ''
	requestAnimationFrame(() => {
		announcement.value = message
	})
}

function handleSelect(cell: Cell): void {
	const outcome = engine.selectCell(cell)

	if (outcome.type === 'match') {
		haptics.signalMatch()
		announce(`Correcto. Llevas ${engine.matchedCount.value} aciertos.`)
	} else if (outcome.type === 'mismatch') {
		haptics.signalMistake()
		announce('Incorrecto. Esas tres formas no son del mismo verbo.')
	} else if (outcome.type === 'selected') {
		announce(`${cell.text} seleccionado.`)
	}
}

watch(
	() => engine.isFinished.value,
	(finished) => {
		if (finished) announce(`${outcomeTitle.value} ${outcomeSummary.value}`)
	},
)

onMounted(() => {
	if (gameMode.value === null || difficultyLevel.value === null) {
		router.replace({name: 'home'})
		return
	}

	if (engine.isFinished.value) engine.resetGame()

	countdown.start()
	window.addEventListener('keydown', handleEscape)
	document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
	window.removeEventListener('keydown', handleEscape)
	document.removeEventListener('visibilitychange', handleVisibilityChange)

	if (!engine.isFinished.value) engine.resetGame()
})
</script>

<template>
	<section class="game">
		<div class="game-top">
			<HudBar
				v-if="gameMode !== null"
				class="game-hud"
				:mode="gameMode"
				:elapsed-ms="engine.elapsedMs.value"
				:remaining-ms="engine.remainingMs.value"
				:matched-count="engine.matchedCount.value"
				:errors="engine.errors.value"
				:remaining-targets="engine.remainingTargets.value"
				:pace="engine.pace.value"
			/>

			<ChoiceButton
				variant="ghost"
				class="game-quit"
				aria-label="Abandonar la partida"
				@click="requestQuit"
			>
				<span aria-hidden="true">×</span>
			</ChoiceButton>
		</div>

		<div class="game-board-area">
			<GameBoard
				:columns="engine.columns.value"
				:cell-status="engine.cellStatus"
				:is-cell-selectable="engine.isCellSelectable"
				@select="handleSelect"
			/>
		</div>

		<p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
			{{ announcement }}
		</p>

		<GameModal :open="engine.isPaused.value" title="Partida en pausa">
			<p class="game-outcome">El reloj está detenido. Sigue cuando quieras.</p>
			<template #actions>
				<ChoiceButton variant="primary" @click="engine.resume">Reanudar</ChoiceButton>
				<ChoiceButton variant="ghost" @click="goHome">Volver al menú</ChoiceButton>
			</template>
		</GameModal>

		<GameModal
			:open="isQuitOpen && !engine.isPaused.value"
			title="¿Abandonar la partida?"
			dismissible
			@close="isQuitOpen = false"
		>
			<p class="game-outcome">Se perderá el progreso de esta partida.</p>
			<template #actions>
				<ChoiceButton variant="primary" @click="isQuitOpen = false">Seguir jugando</ChoiceButton>
				<ChoiceButton variant="ghost" @click="confirmQuit">Abandonar</ChoiceButton>
			</template>
		</GameModal>

		<GameModal :open="isCountingDown" :title="`Nivel ${levelLabel}`">
			<p class="game-countdown" aria-live="assertive">{{ countdownLabel }}</p>
			<p>Empareja las tres formas de cada verbo.</p>
		</GameModal>

		<GameModal :open="engine.isFinished.value" :title="outcomeTitle">
			<p class="game-outcome">{{ outcomeSummary }}</p>
			<template #actions>
				<ChoiceButton variant="primary" @click="goToResult">Ver resultado</ChoiceButton>
				<ChoiceButton variant="ghost" @click="goHome">Volver al menú</ChoiceButton>
			</template>
		</GameModal>
	</section>
</template>

<style scoped>
.game {
	display: flex;
	flex: 1;
	min-height: 0;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 2);
	padding: var(--spacing-screen-mobile);
	overflow: hidden;
}

.game-top {
	display: flex;
	align-items: stretch;
	gap: calc(var(--spacing-gutter) / 3);
	min-width: 0;
}

.game-hud {
	flex: 1 1 auto;
	min-width: 0;
}

.game-quit {
	flex: 0 0 auto;
	width: var(--spacing-touch);
	padding: 0;
	font-size: var(--text-headline-md);
	background-color: var(--color-card);
}

.game-board-area {
	flex: 1 1 auto;
	min-height: 0;
	overflow-y: auto;
	overflow-x: hidden;
}

.game-outcome {
	font-size: var(--text-body-lg);
	text-align: center;
}

.game-countdown {
	font-family: var(--font-display);
	font-size: var(--text-display-lg);
	line-height: 1;
	text-align: center;
	font-variant-numeric: tabular-nums;
}

@media (width >= 40rem) {
	.game {
		padding: var(--spacing-screen-desktop);
		gap: var(--spacing-gutter);
	}
}
</style>
