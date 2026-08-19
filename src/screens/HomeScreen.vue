<script setup lang="ts">
import {computed, ref} from 'vue'
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import GameModal from '@/components/GameModal.vue'
import {useAuth} from '@/composables/useAuth'
import {LEVELS} from '@/data/levels'
import {MODE_DESCRIPTIONS, MODE_LABELS} from '@/data/modes'
import {ONBOARDING_SECTIONS, ONBOARDING_TITLE} from '@/data/onboarding'
import {getVerbsForDifficulty} from '@/data/verbs'
import {DIFFICULTIES, MENU_MODES, PRACTICE_MODE, type Difficulty, type MenuMode} from '@/types/game'

/**
 * Menú de entrada: elegir modo y nivel.
 *
 * No hay header ni footer: la app es un juego a pantalla completa
 * (`CLAUDE.md`). El menú es la primera "pantalla de juego", no una portada.
 */
const router = useRouter()

/**
 * La sesión sólo decora este menú: nada de lo que hay aquí depende de estar
 * autenticado, porque el modo invitado es completo (`CLAUDE.md` §8).
 */
const {
	isAuthenticated,
	isReady,
	canSignIn,
	displayName,
	avatarUrl,
	isWorking,
	errorMessage,
	signInWithGoogle,
	signOut,
} = useAuth()

const selectedMode = ref<MenuMode>('target')
const selectedDifficulty = ref<Difficulty>('easy')

/**
 * Avatar que no cargó.
 *
 * Las URLs de `lh3.googleusercontent.com` fallan en la práctica —caducan, tienen
 * límites de tasa, o el usuario quitó la foto— y entonces el navegador dibuja su
 * icono de imagen rota, que parece un fallo de la app. Se guarda la URL en lugar
 * de un booleano para que otra distinta tenga su propia oportunidad.
 */
const failedAvatarUrl = ref<string | null>(null)

const showAvatar = computed(
	() => avatarUrl.value !== null && avatarUrl.value !== failedAvatarUrl.value,
)

const modeDescription = computed(() => MODE_DESCRIPTIONS[selectedMode.value])

/**
 * Resumen del nivel elegido, para que la dificultad no sea sólo una etiqueta.
 *
 * Empieza por el tamaño del repertorio porque es lo único que significa algo en
 * los tres casos: el nivel también decide de qué verbos pregunta el Modo
 * Dojo, y hasta ahora el resumen sólo hablaba de partida —«objetivo de 8 ·
 * 90 s»— que allí no aplica (`PLAN.md`, Bitácora, D7).
 */
const levelSummary = computed(() => {
	const level = LEVELS[selectedDifficulty.value]
	const pool = `${getVerbsForDifficulty(selectedDifficulty.value).length} verbos`
	const size = `${level.boardSize} en pantalla`

	// El Dojo no usa tablero, así que hablar de celdas o de objetivo no aplica.
	if (selectedMode.value === PRACTICE_MODE) return `${pool} · preguntas de este nivel`

	return selectedMode.value === 'target'
		? `${pool} · ${size} · objetivo de ${level.targetVerbs} · ${level.timeLimitMs / 1000} s`
		: `${pool} · ${size} · hasta el primer fallo`
})

/**
 * Arranca el modo elegido.
 *
 * El Dojo vive en otra ruta porque no usa el tablero, pero desde el menú se
 * elige igual que los demás: para el jugador es un modo más, aunque por dentro
 * sea otra pantalla y no genere ranking (`MECHANICS.md` §4).
 */
function play(): void {
	if (selectedMode.value === PRACTICE_MODE) {
		router.push({name: 'practice', params: {difficulty: selectedDifficulty.value}})
		return
	}

	router.push({
		name: 'play',
		params: {mode: selectedMode.value, difficulty: selectedDifficulty.value},
	})
}

/**
 * Onboarding. Se abre sólo al pulsar el botón: no se guarda ninguna marca de
 * «ya lo vi», porque el modo invitado no persiste nada (`CLAUDE.md` §8) y una
 * excepción para esto no compensa.
 */
const isHelpOpen = ref(false)

/** La clasificación es pública: se puede consultar sin haber iniciado sesión. */
function goToRanking(): void {
	router.push({name: 'ranking'})
}

/** El progreso del Dojo. Como invitado existe, pero sólo mientras dure la sesión. */
function goToProgress(): void {
	router.push({name: 'progress'})
}
</script>

<template>
	<section class="home">
		<header class="home-title brutal-card paper-tilt-1">
			<h1 class="home-heading">The Verb Project</h1>
			<p class="home-tagline">Empareja presente, pasado y participio.</p>
		</header>

		<div class="home-choices">
			<fieldset class="home-group">
				<legend class="home-legend">Modo</legend>
				<div class="home-options">
					<ChoiceButton
						v-for="mode in MENU_MODES"
						:key="mode"
						:selected="selectedMode === mode"
						@click="selectedMode = mode"
					>
						{{ MODE_LABELS[mode] }}
					</ChoiceButton>
				</div>
				<p class="home-hint">{{ modeDescription }}</p>
			</fieldset>

			<fieldset class="home-group">
				<legend class="home-legend">Nivel</legend>
				<div class="home-options">
					<ChoiceButton
						v-for="difficulty in DIFFICULTIES"
						:key="difficulty"
						:selected="selectedDifficulty === difficulty"
						@click="selectedDifficulty = difficulty"
					>
						{{ LEVELS[difficulty].label }}
					</ChoiceButton>
				</div>
				<p class="home-hint">{{ levelSummary }}</p>
			</fieldset>
		</div>

		<div class="home-actions">
			<ChoiceButton variant="primary" class="home-play" @click="play">
				{{ selectedMode === PRACTICE_MODE ? 'Entrar al Dojo' : 'Jugar' }}
			</ChoiceButton>
			<ChoiceButton variant="ghost" class="home-secondary" @click="goToRanking">
				Ver clasificación
			</ChoiceButton>
			<ChoiceButton variant="ghost" class="home-secondary" @click="goToProgress">
				Tu progreso
			</ChoiceButton>
			<ChoiceButton variant="ghost" class="home-secondary" @click="isHelpOpen = true">
				¿Cómo se juega?
			</ChoiceButton>
		</div>

		<!--
			Cuenta. Se reserva el hueco desde el principio (`min-height`) para que
			resolver la sesión no empuje el menú hacia arriba justo cuando el jugador
			va a pulsar «Jugar».
		-->
		<div v-if="canSignIn" class="home-account">
			<template v-if="isReady">
				<div v-if="isAuthenticated" class="home-account-row">
					<!-- `alt` vacío a propósito: el nombre va justo al lado, así que
					     describir el avatar sería redundante para un lector de pantalla. -->
					<img
						v-if="showAvatar"
						:src="avatarUrl ?? ''"
						alt=""
						width="32"
						height="32"
						class="home-avatar"
						referrerpolicy="no-referrer"
						@error="failedAvatarUrl = avatarUrl"
					/>
					<p class="home-account-name">{{ displayName }}</p>
					<ChoiceButton variant="ghost" :disabled="isWorking" @click="signOut">
						Salir
					</ChoiceButton>
				</div>

				<div v-else class="home-account-row">
					<p class="home-account-name">Juegas como invitado</p>
					<ChoiceButton variant="ghost" :disabled="isWorking" @click="signInWithGoogle">
						Entrar con Google
					</ChoiceButton>
				</div>

				<p v-if="!isAuthenticated" class="home-account-hint">
					Sin cuenta tu progreso no se guarda ni entras al ranking.
				</p>
			</template>

			<p v-if="errorMessage !== null" class="home-account-error" role="alert">
				{{ errorMessage }}
			</p>
		</div>
		<!--
			Descartable: es informativo, así que se cierra con `Esc`, con el fondo y
			con su botón. `GameModal` ya aporta el `Teleport`, la trampa de foco y la
			restauración al cerrar.
		-->
		<GameModal
			:open="isHelpOpen"
			:title="ONBOARDING_TITLE"
			dismissible
			focus-panel
			@close="isHelpOpen = false"
		>
			<div class="home-help">
				<!-- `h3` porque el título del modal es un `h2`: la jerarquía no salta. -->
				<section v-for="section in ONBOARDING_SECTIONS" :key="section.title">
					<h3 class="home-help-title">{{ section.title }}</h3>
					<p v-for="line in section.body" :key="line" class="home-help-line">{{ line }}</p>
				</section>
			</div>

			<template #actions>
				<ChoiceButton variant="primary" @click="isHelpOpen = false">Entendido</ChoiceButton>
			</template>
		</GameModal>
	</section>
</template>

<style scoped>
.home {
	display: flex;
	flex: 1;
	min-height: 0;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	gap: var(--spacing-gutter);
	padding: var(--spacing-screen-mobile);
	/* El menú puede desbordar en pantallas muy bajas; el tablero nunca. */
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
.home > :first-child {
	margin-block-start: auto;
}

.home > :last-child {
	margin-block-end: auto;
}

.home-title {
	padding: var(--spacing-gutter);
	text-align: center;
}

.home-heading {
	font-size: var(--text-headline-lg);
	margin: 0;
}

.home-tagline {
	font-size: var(--text-caption);
	margin-top: 4px;
	text-transform: none;
}

.home-choices {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-gutter);
	width: 100%;
	max-width: 32rem;
}

.home-group {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 2);
	border: none;
	padding: 0;
	margin: 0;
}

.home-legend {
	font-family: var(--font-display);
	font-size: var(--text-label-bold);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	padding: 0;
}

.home-options {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--spacing-gutter) / 2);
}

.home-options > * {
	flex: 1 1 8rem;
}

.home-hint {
	font-size: var(--text-caption);
	min-height: 2.4em;
}

.home-actions {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 2);
	width: 100%;
	max-width: 32rem;
}

.home-play {
	width: 100%;
	font-size: var(--text-headline-md);
}

.home-secondary {
	width: 100%;
}

.home-help {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-gutter);
	text-align: left;
}

.home-help-title {
	font-size: var(--text-label-bold);
	margin-bottom: 4px;
}

.home-help-line {
	font-size: var(--text-caption);
	margin-top: 4px;
}

.home-account {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 3);
	width: 100%;
	max-width: 32rem;
	/*
	 * No se encoge: como hijo de un contenedor flex en columna, el reparto de
	 * espacio lo comprimía por debajo de su contenido y la última línea del aviso
	 * quedaba fuera de la caja, sin contar para el scroll de la pantalla.
	 */
	flex-shrink: 0;
	/* Alto del contenido resuelto, para que aparecer no desplace el menú. */
	min-height: calc(var(--spacing-touch) + 5em);
}

.home-account-row {
	display: flex;
	align-items: center;
	gap: calc(var(--spacing-gutter) / 2);
	/*
	 * En móvil el texto compite con un botón que no se encoge, y el recorte
	 * pensado para nombres largos de Google acababa mutilando también la cadena
	 * fija «Juegas como invitado» («Juegas como i…»), que es lo que ve todo el
	 * que no ha iniciado sesión. Envolver deja el botón en su propia línea.
	 */
	flex-wrap: wrap;
}

.home-avatar {
	width: 32px;
	height: 32px;
	border: 3px solid var(--color-ink);
	object-fit: cover;
}

.home-account-name {
	/*
	 * `flex-basis` mínima suficiente para el nombre: por debajo de eso el botón
	 * se va a la línea siguiente en lugar de exprimir el texto hasta el elipsis.
	 */
	flex: 1 1 12rem;
	min-width: 0;
	font-size: var(--text-caption);
	/* Los nombres de Google pueden ser largos; recortar antes que romper la fila. */
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.home-account-hint {
	font-size: var(--text-caption);
}

.home-account-error {
	padding: calc(var(--spacing-gutter) / 3);
	border: 3px solid var(--color-ink);
	background-color: var(--color-pink);
	font-size: var(--text-caption);
}

@media (width >= 40rem) {
	.home {
		padding: var(--spacing-screen-desktop);
		gap: calc(var(--spacing-gutter) * 1.5);
	}

	.home-heading {
		font-size: var(--text-display-lg);
	}

	.home-tagline {
		font-size: var(--text-body-md);
	}
}
</style>
