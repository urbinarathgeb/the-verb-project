<script setup lang="ts">
import type {Mistake} from '@/lib/mistakes'
import {FORM_LABELS} from '@/lib/practice'

/**
 * Un fallo del tablero: lo que se eligió y las formas correctas de los verbos
 * implicados.
 *
 * Vive como componente y no como marcado repetido porque aparece en dos sitios
 * de la pantalla de resultado —el repaso visible y el modal con la lista
 * completa— y ambos deben leerse igual.
 */
defineProps<{mistake: Mistake}>()
</script>

<template>
	<div class="mistake">
		<p class="mistake-label">Elegiste</p>
		<p class="mistake-chosen">
			<span v-for="choice in mistake.chosen" :key="choice.form" class="mistake-choice">
				{{ choice.text }}
				<span class="mistake-form">{{ FORM_LABELS[choice.form] }}</span>
			</span>
		</p>

		<!--
			Se muestran las tríadas de TODOS los verbos que tocó, no una sola: al
			fallar se eligen celdas de hasta tres verbos distintos, así que no existe
			«la» correcta. Ver las tres revela dónde estaba la confusión.
		-->
		<p class="mistake-label">
			{{ mistake.triads.length === 1 ? 'Sus formas son' : 'Sus formas correctas son' }}
		</p>
		<p v-for="verb in mistake.triads" :key="verb.id" class="mistake-triad">
			{{ verb.present }} · {{ verb.past }} · {{ verb.participle }}
		</p>
	</div>
</template>

<style scoped>
.mistake {
	text-align: left;
}

.mistake-label {
	font-family: var(--font-display);
	font-size: var(--text-caption);
	text-transform: uppercase;
	letter-spacing: 0.06em;
	opacity: 0.7;
}

.mistake-chosen {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--spacing-gutter) / 3);
	margin: 4px 0 calc(var(--spacing-gutter) / 2);
}

.mistake-choice {
	padding: 2px 6px;
	border: 3px solid var(--color-ink);
	/* Rosa: el mismo color con el que se marca el fallo en el tablero. */
	background-color: var(--color-pink);
	font-size: var(--text-caption);
}

.mistake-form {
	opacity: 0.75;
}

.mistake-triad {
	margin-top: 4px;
	font-size: var(--text-body-md);
}
</style>
