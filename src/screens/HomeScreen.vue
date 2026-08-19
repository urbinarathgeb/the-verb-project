<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import GameModal from '@/components/GameModal.vue'
import {useAuth} from '@/composables/useAuth'
import {useProgress} from '@/composables/useProgress'
import {ONBOARDING_SECTIONS, ONBOARDING_TITLE} from '@/data/onboarding'
import {VERBS} from '@/data/verbs'

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

const failedAvatarUrl = ref<string | null>(null)

const showAvatar = computed(
	() => avatarUrl.value !== null && avatarUrl.value !== failedAvatarUrl.value,
)

const state = computed(() => {
	if (!isAuthenticated.value) return 'guest'

	return summary.value.practiced === 0 ? 'empty' : 'progress'
})

const stats = computed(() => [
	{label: 'Dominados', value: `${summary.value.mastered}`, of: `de ${VERBS.length}`},
	{label: 'Practicados', value: `${summary.value.practiced}`, of: 'verbos'},
	{label: 'Aciertos', value: `${Math.round(summary.value.accuracy * 100)} %`, of: 'del total'},
])

const isHelpOpen = ref(false)

function goToSetup(): void {
	router.push({name: 'setup'})
}

function goToRanking(): void {
	router.push({name: 'ranking'})
}

function goToProgress(): void {
	router.push({name: 'progress'})
}

onMounted(() => {
	void loadProgress()
})
</script>

<template>
	<section class="home">
		<div v-if="canSignIn" class="home-account">
			<template v-if="isReady">
				<div v-if="isAuthenticated" class="home-account-row">
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

		<GameModal
			:open="isHelpOpen"
			:title="ONBOARDING_TITLE"
			dismissible
			focus-panel
			@close="isHelpOpen = false"
		>
			<div class="home-help">
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
	overflow-y: auto;
}

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
	margin-block-end: calc(var(--spacing-gutter) / 2);
	font-size: var(--text-caption);
	text-align: center;
}

.home-actions {
	display: flex;
	flex-direction: column;
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
	flex-shrink: 0;
	min-height: var(--spacing-touch);
}

.home-account-row {
	display: flex;
	align-items: center;
	gap: calc(var(--spacing-gutter) / 3);
}

.home-account-row > :last-child {
	flex: 0 0 auto;
	padding-inline: calc(var(--spacing-gutter) / 2);
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
	flex: 1 1 auto;
	min-width: 0;
	font-size: var(--text-caption);
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
