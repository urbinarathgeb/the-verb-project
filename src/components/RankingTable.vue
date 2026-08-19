<script setup lang="ts">
import {computed, ref} from 'vue'
import {formatDuration, formatPace} from '@/lib/format'
import type {RankingEntry} from '@/lib/ranking'
import type {GameMode} from '@/types/game'

/**
 * Tabla de clasificación. Componente puro: recibe las posiciones ya calculadas y
 * no sabe de dónde salen (`CLAUDE.md` §7).
 *
 * Se usa una `<table>` de verdad y no una rejilla de `div`s porque es una tabla:
 * así un lector de pantalla anuncia «fila 3, Tiempo, 42 s» en lugar de leer
 * números sueltos sin saber a qué columna pertenecen.
 */
const props = defineProps<{
	entries: readonly RankingEntry[]
	mode: GameMode
	/** Para destacar la fila propia, si el jugador aparece en la tabla. */
	currentUserId?: string | null
}>()

/** La columna que decide la clasificación cambia por modo (`MECHANICS.md` §2 y §3). */
const metricLabel = computed(() => (props.mode === 'target' ? 'Tiempo' : 'Ritmo'))

const secondaryLabel = computed(() => (props.mode === 'target' ? 'Errores' : 'Aciertos'))

function metricValue(entry: RankingEntry): string {
	return props.mode === 'target' ? formatDuration(entry.timeMs) : formatPace(entry.pace)
}

function secondaryValue(entry: RankingEntry): string {
	return props.mode === 'target' ? entry.errors.toString() : entry.verbsMatched.toString()
}

/** Avatares que no cargaron; ver la misma nota en `HomeScreen`. */
const failedAvatars = ref<string[]>([])

function showAvatar(entry: RankingEntry): boolean {
	return entry.avatarUrl !== null && !failedAvatars.value.includes(entry.avatarUrl)
}

function markAvatarFailed(entry: RankingEntry): void {
	if (entry.avatarUrl !== null) failedAvatars.value = [...failedAvatars.value, entry.avatarUrl]
}
</script>

<template>
	<div class="ranking-scroll">
		<table class="ranking-table">
			<caption class="ranking-caption">
				Mejor resultado de cada jugador, de mejor a peor.
			</caption>
			<thead>
				<tr>
					<th scope="col" class="ranking-numeric ranking-rank-column">#</th>
					<th scope="col">Jugador</th>
					<th scope="col" class="ranking-numeric ranking-metric-column">{{ metricLabel }}</th>
					<th scope="col" class="ranking-numeric ranking-metric-column">
						{{ secondaryLabel }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr
					v-for="entry in entries"
					:key="entry.userId"
					:class="{'ranking-own': entry.userId === currentUserId}"
				>
					<td class="ranking-numeric">{{ entry.position }}</td>
					<!--
						La celda conserva su `display` de tabla y el `flex` vive en un `div`
						interior: cambiar el `display` de un `th` lo saca del modelo de tabla
						en varios motores, y con él se pierde el «fila 3, Jugador» que esta
						tabla existe para dar.
					-->
					<th scope="row">
						<div class="ranking-player">
							<img
								v-if="showAvatar(entry)"
								:src="entry.avatarUrl ?? ''"
								alt=""
								width="24"
								height="24"
								class="ranking-avatar"
								referrerpolicy="no-referrer"
								@error="markAvatarFailed(entry)"
							/>
							<span class="ranking-name">{{ entry.displayName }}</span>
							<!-- Marca textual además del color: el color solo no basta (WCAG 1.4.1). -->
							<span v-if="entry.userId === currentUserId" class="ranking-you">tú</span>
						</div>
					</th>
					<td class="ranking-numeric">{{ metricValue(entry) }}</td>
					<td class="ranking-numeric">{{ secondaryValue(entry) }}</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<style scoped>
/* La tabla se desplaza dentro de su caja; la página nunca en horizontal. */
.ranking-scroll {
	width: 100%;
	max-width: 44rem;
	overflow-x: auto;
	border: 4px solid var(--color-ink);
	box-shadow: var(--shadow-brutal-md);
	background-color: var(--color-card);
}

/*
 * `table-layout: fixed` reparte el ancho por las anchuras declaradas en vez de
 * por el contenido. Es lo que hace que un nombre largo se recorte con puntos
 * suspensivos en lugar de estirar su columna: sin esto, en móvil el nombre
 * empujaba «Tiempo» fuera de la pantalla, y el tiempo es justo la métrica que
 * ordena la tabla.
 */
.ranking-table {
	width: 100%;
	table-layout: fixed;
	border-collapse: collapse;
	font-size: var(--text-caption);
}

.ranking-table .ranking-rank-column {
	width: 2.5rem;
}

/* Ancha lo justo para que quepa «ACIERTOS», el encabezado más largo: como van
   en `nowrap`, una columna más estrecha desbordaría la tabla en móvil. */
.ranking-table .ranking-metric-column {
	width: 5.5rem;
}

.ranking-caption {
	padding: calc(var(--spacing-gutter) / 2);
	font-family: var(--font-display);
	font-size: var(--text-label-bold);
	text-transform: uppercase;
	letter-spacing: 0.06em;
	text-align: left;
	border-bottom: 3px solid var(--color-ink);
}

.ranking-table th,
.ranking-table td {
	padding: calc(var(--spacing-gutter) / 3) calc(var(--spacing-gutter) / 2);
	text-align: left;
	border-bottom: 2px solid var(--color-ink);
}

.ranking-table thead th {
	font-family: var(--font-display);
	text-transform: uppercase;
	letter-spacing: 0.06em;
	background-color: var(--color-cyan);
	border-bottom: 3px solid var(--color-ink);
}

.ranking-table tbody tr:last-child th,
.ranking-table tbody tr:last-child td {
	border-bottom: none;
}

/*
 * Se cualifica con `.ranking-table` para ganarle en especificidad a la regla
 * `.ranking-table th, .ranking-table td` de arriba, que alinea a la izquierda.
 * Sin eso la alineación a la derecha no se aplica y las cifras no cuadran.
 */
.ranking-table .ranking-numeric {
	text-align: right;
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}

.ranking-player {
	display: flex;
	align-items: center;
	gap: calc(var(--spacing-gutter) / 3);
	font-weight: 500;
}

.ranking-avatar {
	width: 24px;
	height: 24px;
	border: 2px solid var(--color-ink);
	object-fit: cover;
	flex-shrink: 0;
}

.ranking-name {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ranking-own {
	background-color: var(--color-electric);
}

.ranking-you {
	flex-shrink: 0;
	padding: 0 4px;
	border: 2px solid var(--color-ink);
	background-color: var(--color-card);
	font-family: var(--font-display);
	text-transform: uppercase;
	font-size: 0.625rem;
	/* Hereda el recorte de la celda para que el nombre siga elipsándose. */
	min-width: 0;
}
</style>
