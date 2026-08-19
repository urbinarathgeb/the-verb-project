<script setup lang="ts">
import {onMounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import {useAuth} from '@/composables/useAuth'
import {readCallbackError} from '@/lib/auth'

const router = useRouter()
const {initialize, isAuthenticated} = useAuth()

const failure = ref<string | null>(null)

onMounted(async () => {
	failure.value = readCallbackError(window.location.search, window.location.hash)

	if (failure.value !== null) return

	await initialize()

	if (!isAuthenticated.value) {
		failure.value = 'El acceso no llegó a completarse. Vuelve a intentarlo desde el menú.'
		return
	}

	await router.replace({name: 'home'})
})

function goHome(): void {
	void router.replace({name: 'home'})
}
</script>

<template>
	<section class="callback">
		<div v-if="failure === null" class="callback-card brutal-card paper-tilt-1">
			<p class="callback-status" role="status" aria-live="polite">Comprobando tu acceso…</p>
		</div>

		<div v-else class="callback-card brutal-card paper-tilt-2">
			<h1 class="callback-heading">No se pudo entrar</h1>
			<p class="callback-detail" role="alert">{{ failure }}</p>
			<p class="callback-hint">Puedes seguir jugando como invitado.</p>
			<ChoiceButton variant="primary" @click="goHome">Volver al menú</ChoiceButton>
		</div>
	</section>
</template>

<style scoped>
.callback {
	display: flex;
	flex: 1;
	min-height: 0;
	align-items: center;
	justify-content: center;
	padding: var(--spacing-screen-mobile);
}

.callback-card {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 2);
	align-items: center;
	max-width: 28rem;
	padding: var(--spacing-gutter);
	text-align: center;
}

.callback-status {
	font-family: var(--font-display);
	font-size: var(--text-headline-md);
	text-transform: uppercase;
}

.callback-heading {
	font-size: var(--text-headline-md);
	margin: 0;
}

.callback-detail {
	font-size: var(--text-body-md);
}

.callback-hint {
	font-size: var(--text-caption);
}
</style>
