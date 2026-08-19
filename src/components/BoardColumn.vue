<script setup lang="ts">
/**
 * Una columna del tablero: cabecera con el nombre de la forma verbal y el hueco
 * donde el padre coloca las celdas.
 *
 * No renderiza las celdas por su cuenta —lo hace `GameBoard` a través del slot—
 * para que la columna no necesite saber nada del estado de cada celda.
 */
defineProps<{
	/** Nombre visible de la columna: "Presente", "Pasado", "Participio". */
	label: string
	/**
	 * Color de la cabecera. Es decorativo: dentro del tablero, el amarillo y el
	 * rosa están reservados a los estados de celda seleccionada y de error.
	 */
	accent: 'cyan' | 'paper-dim'
}>()

const ACCENT_CLASSES = {
	cyan: 'column-accent-cyan',
	'paper-dim': 'column-accent-dim',
} as const
</script>

<template>
	<section class="board-column" :aria-label="label">
		<h2 class="column-header" :class="ACCENT_CLASSES[accent]">{{ label }}</h2>

		<div class="column-cells">
			<slot />
		</div>
	</section>
</template>

<style scoped>
.board-column {
	display: flex;
	flex-direction: column;
	/* Las tres columnas reparten el ancho por igual y se encogen sin desbordar. */
	flex: 1 1 0;
	min-width: 0;
	gap: calc(var(--spacing-gutter) / 3);
}

.column-header {
	padding: calc(var(--spacing-gutter) / 4);
	border: 3px solid var(--color-ink);
	box-shadow: var(--shadow-brutal-xs);
	text-align: center;
	/*
	 * «Participio» es la palabra más larga en la columna más estrecha: a 320px
	 * medía 88px dentro de una caja de 85px y se cortaba la última letra. Lo que
	 * sobra es el tracking en versales, no el texto; el bloque de escritorio de
	 * abajo restaura ambos en cuanto hay ancho.
	 */
	font-size: 0.625rem;
	letter-spacing: 0;
	white-space: nowrap;
}

.column-accent-cyan {
	background-color: var(--color-cyan);
}

.column-accent-dim {
	background-color: var(--color-paper-dim);
}

.column-cells {
	display: flex;
	flex-direction: column;
	gap: calc(var(--spacing-gutter) / 3);
	/*
	 * Las celdas reparten la altura disponible: el tablero cabe en el viewport
	 * sin scroll, que es el requisito de la app a pantalla completa.
	 */
	flex: 1 1 auto;
	/*
	 * Las celdas nunca se encogen por debajo de su altura mínima: el suelo táctil
	 * de 44px (`CLAUDE.md` §11) manda sobre el encaje en pantalla. Cuando no
	 * caben, quien se adapta es la pantalla, que desplaza el tablero.
	 */
	min-height: min-content;
}

@media (width >= 40rem) {
	.board-column {
		gap: calc(var(--spacing-gutter) / 2);
	}

	.column-header {
		font-size: var(--text-label-bold);
		letter-spacing: 0.08em;
		padding: calc(var(--spacing-gutter) / 3);
	}

	.column-cells {
		gap: calc(var(--spacing-gutter) / 2);
	}
}
</style>
