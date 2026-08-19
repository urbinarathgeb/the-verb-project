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

/**
 * Pantalla de juego: HUD, tablero y modales de estado.
 *
 * Consume el motor sólo a través de `useGameEngine`, nunca el store
 * (`CLAUDE.md` §6, aplicado además por ESLint).
 */
const props = defineProps<{mode: string; difficulty: string}>()

const router = useRouter()
const engine = useGameEngine()
const haptics = useHaptics()

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
 * El desenlace se anuncia **aquí, sobre el tablero**, y no navegando solo a
 * `ResultScreen`. Dos motivos:
 *
 * 1. Antes, todo el feedback vivía en otra ruta, detrás de una navegación
 *    asíncrona y dependiendo de que un estado en memoria sobreviviera al
 *    desmontaje. Si esa navegación fallaba, el jugador se quedaba ante un
 *    tablero muerto a 0:00 sin ningún mensaje. Anunciarlo in situ elimina esa
 *    clase de fallo entera, no sólo sus síntomas.
 * 2. El tablero congelado es información real: se ve qué tríadas faltaban.
 * ------------------------------------------------------------------------- */

/** Titular del desenlace. Cada modo pierde por un motivo distinto. */
const outcomeTitle = computed(() => {
	if (engine.status.value === 'won') return '¡Lo lograste!'

	return engine.mode.value === 'precision' ? 'Fallaste' : '¡Se acabó el tiempo!'
})

/** Una línea con el dato que importa en cada modo. */
const outcomeSummary = computed(() => {
	const matched = engine.matchedCount.value
	const target = engine.targetVerbs.value

	if (engine.mode.value === 'target' && target !== null) {
		return `${matched} de ${target} verbos emparejados.`
	}

	return `${matched} verbos emparejados.`
})

function goHome(): void {
	// Salir sin ver el resultado lo descarta: nadie más va a leerlo.
	engine.resetGame()
	router.push({name: 'home'}).catch(() => {})
}

/* ---------------------------------------------------------------------------
 * Abandonar la partida
 *
 * Hasta ahora esta pantalla no tenía salida mientras se jugaba: en Contrarreloj
 * había que esperar a que expirara el reloj y en Supervivencia, que no tiene
 * límite, no había ninguna salvo el «atrás» del navegador — que no existe con la
 * app instalada ni a pantalla completa.
 *
 * Se pide confirmación porque un toque accidental en pleno tablero tiraría la
 * partida. **El reloj sigue corriendo mientras se confirma**, y es deliberado:
 * detenerlo sería cambiar una regla del juego, y quien abre este diálogo ya ha
 * decidido marcharse.
 * ------------------------------------------------------------------------- */

const isQuitOpen = ref(false)

function requestQuit(): void {
	if (!engine.isPlaying.value) return
	isQuitOpen.value = true
}

function confirmQuit(): void {
	isQuitOpen.value = false
	goHome()
}

/* ---------------------------------------------------------------------------
 * Pausa al perder la pestaña
 *
 * Sólo se pausa: **reanudar es una acción explícita** del jugador. Volver a la
 * pestaña no significa estar mirando el tablero, y reanudar sola devolvería al
 * jugador a una partida ya en marcha sin darle tiempo a situarse — que es el
 * mismo problema que esto viene a resolver (`PLAN.md`, Bitácora, D13).
 * ------------------------------------------------------------------------- */

function handleVisibilityChange(): void {
	if (document.visibilityState === 'hidden') engine.pause()
}

/** `Esc` es lo que se espera para salir; abre la confirmación, no la salida. */
function handleEscape(event: KeyboardEvent): void {
	if (event.key !== 'Escape') return
	if (!engine.isPlaying.value || isQuitOpen.value) return

	event.preventDefault()
	requestQuit()
}

function goToResult(): void {
	// `catch` porque `push` devuelve una promesa que puede rechazar si falla la
	// carga del chunk. Antes se ignoraba y la navegación abortaba en silencio.
	router.push({name: 'result'}).catch(() => {
		router.push({name: 'home'}).catch(() => {})
	})
}

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
		haptics.signalMatch()
		announce(`Correcto. Llevas ${engine.matchedCount.value} aciertos.`)
	} else if (outcome.type === 'mismatch') {
		haptics.signalMistake()
		announce('Incorrecto. Esas tres formas no son del mismo verbo.')
	} else if (outcome.type === 'selected') {
		announce(`${cell.text} seleccionado.`)
	}
}

/*
 * El desenlace se comunica visualmente con un modal. Esto lo traduce a texto
 * para quien use un lector de pantalla, igual que las jugadas (`CLAUDE.md` §11).
 */
watch(
	() => engine.isFinished.value,
	(finished) => {
		if (finished) announce(`${outcomeTitle.value} ${outcomeSummary.value}`)
	},
)

onMounted(() => {
	// Un parámetro inválido no debería llegar hasta aquí (lo filtra el guard de
	// la ruta), pero si llegara, volver al menú es mejor que un tablero vacío.
	if (gameMode.value === null || difficultyLevel.value === null) {
		router.replace({name: 'home'})
		return
	}

	/*
	 * Se descarta cualquier partida anterior ANTES de la cuenta atrás.
	 *
	 * El desenlace sobrevive a propósito para que `ResultScreen` pueda leerlo, así
	 * que si el jugador terminó una partida y volvió al menú sin pasar por el
	 * resultado, el estado seguía en `won`/`lost`: al entrar aquí de nuevo, el
	 * modal de desenlace aparecía sobre la cuenta atrás y obligaba a pulsar «Ver
	 * resultado» para poder seguir jugando.
	 */
	if (engine.isFinished.value) engine.resetGame()

	countdown.start()
	window.addEventListener('keydown', handleEscape)
	document.addEventListener('visibilitychange', handleVisibilityChange)
})

/**
 * Sólo se descarta la partida si se abandona a medias. Si terminó, el resultado
 * debe sobrevivir a esta pantalla: `ResultScreen` lo lee del store, y resetear
 * aquí lo borraría justo al navegar.
 */
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

			<!--
				El aspa es decorativa para la tecnología asistiva: el nombre accesible
				lo pone `aria-label`, porque «×» se leería como «por» o como un símbolo
				suelto según el lector.
			-->
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

		<!--
			Región viva: `polite` espera a que el lector termine la frase en curso.
			`assertive` interrumpiría al jugador a cada celda pulsada.
		-->
		<p class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
			{{ announcement }}
		</p>

		<!--
			Confirmación de abandono. Descartable: cerrarla es justamente decir «no».
		-->
		<!--
			Pausa. No descartable: cerrarla sin reanudar dejaría el tablero inerte sin
			decir por qué, que es justo lo que esto evita.
		-->
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

		<!-- Cuenta atrás: no descartable, el jugador no puede saltársela. -->
		<GameModal :open="isCountingDown" :title="`Nivel ${levelLabel}`">
			<p class="game-countdown" aria-live="assertive">{{ countdownLabel }}</p>
			<p>Empareja las tres formas de cada verbo.</p>
		</GameModal>

		<!--
			Desenlace. No descartable: cerrarlo sin querer dejaría al jugador ante un
			tablero inerte sin saber qué pasó, que es justo el problema que resuelve.
		-->
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
	padding: var(--spacing-margin-mobile);
	/* La pantalla ocupa el viewport y no hace scroll: el tablero se adapta. */
	overflow: hidden;
}

.game-top {
	display: flex;
	align-items: stretch;
	gap: calc(var(--spacing-gutter) / 3);
	/* Sin esto, un valor largo del HUD estira la fila y con ella el documento. */
	min-width: 0;
}

.game-hud {
	flex: 1 1 auto;
	min-width: 0;
}

.game-quit {
	flex: 0 0 auto;
	/* Cuadrado: el aspa no necesita el relleno horizontal del botón de texto. */
	width: var(--spacing-touch);
	padding: 0;
	font-size: var(--text-headline-md);
	background-color: var(--color-card);
}

.game-board-area {
	flex: 1 1 auto;
	min-height: 0;
	/*
	 * Último recurso, no el modo normal: en un viewport lo bastante alto el
	 * tablero cabe entero y esto no hace nada. Cuando no cabe —`hard` en un móvil
	 * pequeño, o cualquier nivel en horizontal— el jugador puede desplazarse hasta
	 * las últimas filas en lugar de perderlas recortadas.
	 */
	overflow-y: auto;
	/* En horizontal se clipa igual que antes: las celdas inclinadas sobresalen
	   unos píxeles y no deben provocar una barra de desplazamiento. */
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
		padding: var(--spacing-margin-desktop);
		gap: var(--spacing-gutter);
	}
}
</style>
