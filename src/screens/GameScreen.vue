<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {useRouter} from 'vue-router'
import GameBoard from '@/components/GameBoard.vue'
import GameModal from '@/components/GameModal.vue'
import HudBar from '@/components/HudBar.vue'
import {useGameEngine} from '@/composables/useGameEngine'
import {useTimer} from '@/composables/useTimer'
import {LEVELS} from '@/data/levels'
import {isDifficulty, isGameMode, type Cell} from '@/types/game'

/**
 * Pantalla de juego: HUD, tablero y modales de estado.
 *
 * Consume el motor sólo a través de `useGameEngine`, nunca el store
 * (`CLAUDE.md` §6, aplicado además por ESLint).
 */
const props = defineProps<{mode: string; difficulty: string}>()

const router = useRouter()
const engine = useGameEngine()

/**
 * Los parámetros ya los validó el guard de la ruta; se vuelven a comprobar aquí
 * para estrechar el tipo sin aserciones.
 */
const gameMode = computed(() => (isGameMode(props.mode) ? props.mode : null))
const difficultyLevel = computed(() => (isDifficulty(props.difficulty) ? props.difficulty : null))

const levelLabel = computed(() =>
	difficultyLevel.value === null ? '' : LEVELS[difficultyLevel.value].label,
)

/* ---------------------------------------------------------------------------
 * Cuenta atrás inicial
 *
 * Da un instante para leer el tablero antes de que corra el reloj de la
 * partida. Reutiliza `useTimer` en vez de escribir otro contador: ya tiene
 * probada la expiración y la limpieza del intervalo.
 * ------------------------------------------------------------------------- */

const COUNTDOWN_MS = 3000

const isCountingDown = ref(true)

const countdown = useTimer({
	limitMs: COUNTDOWN_MS,
	tickMs: 100,
	onExpire: () => beginGame(),
})

/** Segundos que faltan, de 3 a 1. */
const countdownLabel = computed(() => {
	const remaining = countdown.remainingMs.value ?? 0
	return Math.max(1, Math.ceil(remaining / 1000)).toString()
})

function beginGame(): void {
	if (gameMode.value === null || difficultyLevel.value === null) return

	isCountingDown.value = false
	engine.startGame(gameMode.value, difficultyLevel.value)
}

/* ---------------------------------------------------------------------------
 * Fin de partida
 *
 * El desenlace se muestra en `ResultScreen`, no aquí: es una pantalla propia con
 * métricas por modo y es el destino natural tras una partida.
 * ------------------------------------------------------------------------- */

watch(
	() => engine.isFinished.value,
	(finished) => {
		if (finished) router.push({name: 'result'})
	},
)

/* ---------------------------------------------------------------------------
 * Anuncio para lectores de pantalla
 *
 * El resultado de una jugada se comunica sólo por color y movimiento: amarillo,
 * rosa y una sacudida. Nada de eso llega a quien usa un lector de pantalla, así
 * que se traduce a texto (`CLAUDE.md` §11).
 * ------------------------------------------------------------------------- */

const announcement = ref('')

function announce(message: string): void {
	// Se limpia antes de escribir para que repetir el mismo mensaje —dos aciertos
	// seguidos— vuelva a anunciarse en vez de pasar desapercibido.
	announcement.value = ''
	requestAnimationFrame(() => {
		announcement.value = message
	})
}

function handleSelect(cell: Cell): void {
	const outcome = engine.selectCell(cell)

	if (outcome.type === 'match') {
		announce(`Correcto. Llevas ${engine.matchedCount.value} aciertos.`)
	} else if (outcome.type === 'mismatch') {
		announce('Incorrecto. Esas tres formas no son del mismo verbo.')
	} else if (outcome.type === 'selected') {
		announce(`${cell.text} seleccionado.`)
	}
}

onMounted(() => {
	// Un parámetro inválido no debería llegar hasta aquí (lo filtra el guard de
	// la ruta), pero si llegara, volver al menú es mejor que un tablero vacío.
	if (gameMode.value === null || difficultyLevel.value === null) {
		router.replace({name: 'home'})
		return
	}

	countdown.start()
})

/**
 * Sólo se descarta la partida si se abandona a medias. Si terminó, el resultado
 * debe sobrevivir a esta pantalla: `ResultScreen` lo lee del store, y resetear
 * aquí lo borraría justo al navegar.
 */
onBeforeUnmount(() => {
	if (!engine.isFinished.value) engine.resetGame()
})
</script>

<template>
	<section class="game">
		<HudBar
			v-if="gameMode !== null"
			:mode="gameMode"
			:elapsed-ms="engine.elapsedMs.value"
			:remaining-ms="engine.remainingMs.value"
			:matched-count="engine.matchedCount.value"
			:errors="engine.errors.value"
			:remaining-targets="engine.remainingTargets.value"
			:pace="engine.pace.value"
		/>

		<div class="game-board-area">
			<GameBoard
				:columns="engine.columns.value"
				:cell-status="engine.cellStatus"
				:is-cell-selectable="engine.isCellSelectable"
				@select="handleSelect"
			/>
		</div>

		<!--
			Región viva: `polite` espera a que el lector termine la frase en curso.
			`assertive` interrumpiría al jugador a cada celda pulsada.
		-->
		<p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
			{{ announcement }}
		</p>

		<!-- Cuenta atrás: no descartable, el jugador no puede saltársela. -->
		<GameModal :open="isCountingDown" :title="`Nivel ${levelLabel}`">
			<p class="game-countdown" aria-live="assertive">{{ countdownLabel }}</p>
			<p>Empareja las tres formas de cada verbo.</p>
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
	padding: var(--spacing-margin-mobile);
	/* La pantalla ocupa el viewport y no hace scroll: el tablero se adapta. */
	overflow: hidden;
}

.game-board-area {
	flex: 1 1 auto;
	min-height: 0;
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
		padding: var(--spacing-margin-desktop);
		gap: var(--spacing-gutter);
	}
}
</style>
