<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import GameModal from '@/components/GameModal.vue'
import {useAuth} from '@/composables/useAuth'
import {useProgress} from '@/composables/useProgress'
import {ONBOARDING_SECTIONS, ONBOARDING_TITLE} from '@/data/onboarding'
import {VERBS} from '@/data/verbs'

/**
 * Portada.
 *
 * Dejó de ser el menú de selección: elegir modo y nivel vive ahora en
 * `/setup` (`PLAN.md`, Bitácora, D14). Lo que hace aquí no es sólo llevar a
 * jugar, porque una pantalla cuyo único contenido es una marca y unos botones es
 * una pantalla de trámite. Muestra **cuánto llevas aprendido**, que es la
 * promesa de `PRODUCT.md` y hasta ahora estaba escondida tras un botón.
 */
const router = useRouter()

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

const {summary, loadProgress} = useProgress()

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

/**
 * Qué enseña la portada bajo la marca.
 *
 * Son tres situaciones distintas y no dos: quien ya practicó ve sus números,
 * quien tiene sesión pero no ha empezado necesita saber por dónde, y quien juega
 * como invitado no tiene progreso que mostrar porque no se guarda nada
 * (`CLAUDE.md` §8). Sin este tercer caso, el primerizo se encontraría tres ceros
 * y ninguna explicación.
 */
const state = computed(() => {
	if (!isAuthenticated.value) return 'guest'

	return summary.value.practiced === 0 ? 'empty' : 'progress'
})

const stats = computed(() => [
	{label: 'Dominados', value: `${summary.value.mastered}`, of: `de ${VERBS.length}`},
	{label: 'Practicados', value: `${summary.value.practiced}`, of: 'verbos'},
	{label: 'Aciertos', value: `${Math.round(summary.value.accuracy * 100)} %`, of: 'del total'},
])

/**
 * Onboarding. Se abre sólo al pulsar el botón: no se guarda ninguna marca de
 * «ya lo vi», porque el modo invitado no persiste nada (`CLAUDE.md` §8) y una
 * excepción para esto no compensa.
 */
const isHelpOpen = ref(false)

function goToSetup(): void {
	router.push({name: 'setup'})
}

/** La clasificación es pública: se puede consultar sin haber iniciado sesión. */
function goToRanking(): void {
	router.push({name: 'ranking'})
}

/** El progreso del Dojo. Como invitado existe, pero sólo mientras dure la sesión. */
function goToProgress(): void {
	router.push({name: 'progress'})
}

onMounted(() => {
	// Sin sesión no hay nada que traer y la llamada vuelve sola.
	void loadProgress()
})
</script>

<template>
	<section class="home">
		<!--
			Cuenta. Va arriba, que es donde se busca la sesión por convención: al final
			de la pantalla quedaba a 326px por debajo del pliegue en un móvil, invisible
			salvo que alguien se desplazara hasta el fondo del menú.

			Se reserva el hueco desde el principio (`min-height`) para que resolver la
			sesión no desplace el contenido justo cuando el jugador va a pulsar «Jugar».
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
			</template>

			<p v-if="errorMessage !== null" class="home-account-error" role="alert">
				{{ errorMessage }}
			</p>
		</div>

		<header class="home-title brutal-card paper-tilt-1">
			<h1 class="home-heading">The Verb Project</h1>
			<p class="home-tagline">Empareja presente, pasado y participio.</p>
		</header>

		<!--
			El estado del jugador. Es lo que evita que esta pantalla sea un trámite
			por el que se pasa sin hacer nada.
		-->
		<dl v-if="state === 'progress'" class="home-progress">
			<div v-for="stat in stats" :key="stat.label" class="home-stat brutal-card">
				<dt class="home-stat-label">{{ stat.label }}</dt>
				<dd class="home-stat-value">{{ stat.value }}</dd>
				<dd class="home-stat-of">{{ stat.of }}</dd>
			</div>
		</dl>

		<p v-else-if="state === 'empty'" class="home-pitch">
			Todavía no has practicado ningún verbo. El Dojo lleva la cuenta de cuáles dominas.
		</p>

		<p v-else class="home-pitch">
			{{ VERBS.length }} verbos irregulares en sus tres formas. Sin cuenta puedes jugar, pero no se
			guarda lo que aprendes.
		</p>

		<div class="home-actions">
			<ChoiceButton variant="primary" class="home-play" @click="goToSetup">Jugar</ChoiceButton>
			<ChoiceButton variant="ghost" class="home-secondary" @click="goToProgress">
				Tu progreso
			</ChoiceButton>
			<ChoiceButton variant="ghost" class="home-secondary" @click="goToRanking">
				Ver clasificación
			</ChoiceButton>
			<ChoiceButton variant="ghost" class="home-secondary" @click="isHelpOpen = true">
				¿Cómo se juega?
			</ChoiceButton>
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
	gap: calc(var(--spacing-gutter) / 2);
	padding: var(--spacing-screen-mobile);
	/* La portada puede desbordar en pantallas muy bajas; el tablero nunca. */
	overflow-y: auto;
}

/*
 * Dos anclajes, no uno.
 *
 * La cuenta y la marca se quedan **arriba**: son identidad y estado, y su sitio
 * es el borde superior de la pantalla, no el centro. Lo que se centra en el
 * espacio que sobra es el bloque de decisión —lo que llevas aprendido y los
 * botones—, que es donde va la mirada y el pulgar.
 *
 * Se hace con márgenes automáticos y no con `justify-content: center` porque
 * este contenedor también desplaza: centrar así reparte el desbordamiento arriba
 * y abajo, y como `scrollTop` no puede ser negativo, la mitad superior quedaría
 * inalcanzable. Cuando el contenido no cabe, los `auto` valen cero y todo se
 * ancla arriba, que es exactamente lo que hace falta.
 */
.home-progress,
.home-pitch {
	margin-block-start: auto;
}

.home-actions {
	margin-block-end: auto;
}

.home-title {
	padding: calc(var(--spacing-gutter) / 2);
	text-align: center;
}

.home-heading {
	font-size: var(--text-headline-md);
	margin: 0;
}

.home-tagline {
	font-size: var(--text-caption);
	margin-top: 4px;
	text-transform: none;
}

.home-progress {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--spacing-gutter) / 3);
	width: 100%;
	max-width: 32rem;
	margin-block-end: calc(var(--spacing-gutter) / 2);
}

.home-stat {
	display: flex;
	flex-direction: column;
	align-items: center;
	/* Alineadas por arriba: los rótulos de la fila deben leerse a la misma altura
	   aunque el pie de cada tarjeta tenga distinto largo. */
	justify-content: flex-start;
	gap: 2px;
	flex: 1 1 5rem;
	padding: calc(var(--spacing-gutter) / 3);
	text-align: center;
}

.home-stat-label {
	font-size: var(--text-caption);
	text-transform: uppercase;
	letter-spacing: 0.04em;
	opacity: 0.7;
}

.home-stat-value {
	font-family: var(--font-display);
	font-size: var(--text-headline-md);
	font-weight: 800;
	font-variant-numeric: tabular-nums;
	margin: 0;
}

.home-stat-of {
	font-size: var(--text-caption);
	margin: 0;
	opacity: 0.7;
}

.home-pitch {
	width: 100%;
	max-width: 32rem;
	/* Separado de los botones, no pegado: encabeza el bloque, no es su subtítulo. */
	margin-block-end: calc(var(--spacing-gutter) / 2);
	font-size: var(--text-caption);
	text-align: center;
}

.home-actions {
	display: flex;
	flex-direction: column;
	/* Los botones respiran entre sí más que los bloques de arriba: son la zona de
	   toque y conviene que no se lean como una lista apretada. */
	gap: calc(var(--spacing-gutter) / 2);
	width: 100%;
	max-width: 32rem;
}

.home-play {
	font-size: var(--text-headline-md);
}

.home-secondary {
	font-size: var(--text-label-bold);
}

.home-account {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 3);
	width: 100%;
	max-width: 32rem;
	/*
	 * No se encoge: como hijo de un contenedor flex en columna, el reparto de
	 * espacio lo comprimía por debajo de su contenido y la última línea quedaba
	 * fuera de la caja, sin contar para el scroll de la pantalla.
	 */
	flex-shrink: 0;
	/* Alto del contenido resuelto, para que aparecer no desplace la portada. */
	min-height: var(--spacing-touch);
}

.home-account-row {
	display: flex;
	align-items: center;
	gap: calc(var(--spacing-gutter) / 3);
}

/*
 * El botón de la franja va más estrecho que un botón de acción normal: con el
 * relleno del sistema, «Juegas como invitado» y «Entrar con Google» sumaban
 * 350px en una fila de 343 y el nombre se recortaba a «Juegas como i…». El alto
 * táctil de 44px no se toca; sólo cede el aire lateral.
 */
.home-account-row > :last-child {
	flex: 0 0 auto;
	padding-inline: calc(var(--spacing-gutter) / 2);
	/*
	 * Y con la etiqueta un escalón por debajo del botón de acción, que es lo que
	 * es: una acción secundaria en una franja de estado, no el botón por el que se
	 * entra a la app.
	 */
	font-size: var(--text-caption);
	letter-spacing: 0.02em;
}

.home-avatar {
	width: 32px;
	height: 32px;
	border: 3px solid var(--color-ink);
	object-fit: cover;
}

.home-account-name {
	/*
	 * El nombre cede el ancho, no el botón. Con el reparto al revés, «Entrar con
	 * Google» se quedaba sin sitio y partía en dos líneas, y una franja de 44px
	 * pasaba a medir 72 en la zona más cara de la pantalla.
	 */
	flex: 1 1 auto;
	min-width: 0;
	font-size: var(--text-caption);
	/* Los nombres de Google pueden ser largos; recortar antes que romper la fila. */
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.home-account-error {
	padding: calc(var(--spacing-gutter) / 3);
	border: 3px solid var(--color-ink);
	background-color: var(--color-pink);
	font-size: var(--text-caption);
}

.home-help {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-gutter);
	text-align: left;
}

.home-help-title {
	font-size: var(--text-label-bold);
	margin-bottom: calc(var(--spacing-gutter) / 3);
}

.home-help-line + .home-help-line {
	margin-top: calc(var(--spacing-gutter) / 3);
}

@media (width >= 40rem) {
	.home {
		padding: var(--spacing-screen-desktop);
		gap: var(--spacing-gutter);
	}

	.home-title {
		padding: var(--spacing-gutter);
	}

	.home-heading {
		font-size: var(--text-display-lg);
	}

	.home-tagline {
		font-size: var(--text-body-md);
	}

	.home-stat-value {
		font-size: var(--text-headline-lg);
	}
}
</style>
