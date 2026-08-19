<script setup lang="ts">
import {onMounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import {useAuth} from '@/composables/useAuth'
import {readCallbackError} from '@/lib/auth'

/**
 * Destino del redirect de Supabase Auth.
 *
 * No canjea nada por su cuenta: el cliente lo hace solo, porque se creó con
 * `detectSessionInUrl` (`src/lib/supabase.ts`). Esta pantalla sólo espera a que
 * la sesión quede resuelta y decide a dónde ir. Es un paso de tránsito, así que
 * en el camino feliz no debería verse más que un instante.
 */
const router = useRouter()
const {initialize, isAuthenticated} = useAuth()

/** Mensaje del fallo, si lo hubo. Mientras sea nulo, seguimos en tránsito. */
const failure = ref<string | null>(null)

onMounted(async () => {
	/*
	 * Primero la URL: si el proveedor devolvió un error, no hay sesión que esperar
	 * y el mensaje que trae es más concreto que cualquier diagnóstico posterior.
	 */
	failure.value = readCallbackError(window.location.search, window.location.hash)

	if (failure.value !== null) return

	// `initialize()` comparte promesa con la que arrancó `main.ts`, así que aquí
	// se espera esa misma restauración en lugar de lanzar una segunda.
	await initialize()

	if (!isAuthenticated.value) {
		failure.value = 'El acceso no llegó a completarse. Vuelve a intentarlo desde el menú.'
		return
	}

	// `replace` y no `push`: volver atrás debe llevar a donde estaba el usuario
	// antes de entrar, no a una URL de callback ya consumida.
	await router.replace({name: 'home'})
})

function goHome(): void {
	void router.replace({name: 'home'})
}
</script>

<template>
	<section class="callback">
		<div v-if="failure === null" class="callback-card brutal-card paper-tilt-1">
			<!-- `aria-live` para que un lector de pantalla anuncie el tránsito, que
			     de otro modo pasa sin ninguna señal audible. -->
			<p class="callback-status" role="status" aria-live="polite">Comprobando tu acceso…</p>
		</div>

		<div v-else class="callback-card brutal-card paper-tilt-2">
			<h1 class="callback-heading">No se pudo entrar</h1>
			<p class="callback-detail" role="alert">{{ failure }}</p>
			<!-- El modo invitado siempre está disponible, así que el fallo nunca es un
			     callejón sin salida (`CLAUDE.md` §8). -->
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
