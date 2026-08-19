<script setup lang="ts">
import {computed, ref} from 'vue'
import {formatDuration, formatPace} from '@/lib/format'
import type {RankingEntry} from '@/lib/ranking'
import type {GameMode} from '@/types/game'

const props = defineProps<{
	entries: readonly RankingEntry[]
	mode: GameMode
	currentUserId?: string | null
}>()

const metricLabel = computed(() => (props.mode === 'target' ? 'Tiempo' : 'Ritmo'))

const secondaryLabel = computed(() => (props.mode === 'target' ? 'Errores' : 'Aciertos'))

function metricValue(entry: RankingEntry): string {
	return props.mode === 'target' ? formatDuration(entry.timeMs) : formatPace(entry.pace)
}

function secondaryValue(entry: RankingEntry): string {
	return props.mode === 'target' ? entry.errors.toString() : entry.verbsMatched.toString()
}

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
.ranking-scroll {
	width: 100%;
	max-width: 44rem;
	overflow-x: auto;
	border: 4px solid var(--color-ink);
	box-shadow: var(--shadow-brutal-md);
	background-color: var(--color-card);
}

.ranking-table {
	width: 100%;
	table-layout: fixed;
	border-collapse: collapse;
	font-size: var(--text-caption);
}

.ranking-table .ranking-rank-column {
	width: 2.25rem;
}

.ranking-table .ranking-metric-column {
	width: 4rem;
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
	padding: calc(var(--spacing-gutter) / 3);
	text-align: left;
	border-bottom: 2px solid var(--color-ink);
}

.ranking-table thead th {
	font-family: var(--font-display);
	text-transform: uppercase;
	font-size: var(--text-micro);
	letter-spacing: 0;
	background-color: var(--color-cyan);
	border-bottom: 3px solid var(--color-ink);
}

@media (width >= 40rem) {
	.ranking-table .ranking-metric-column {
		width: 5.5rem;
	}

	.ranking-table th,
	.ranking-table td {
		padding: calc(var(--spacing-gutter) / 3) calc(var(--spacing-gutter) / 2);
	}

	.ranking-table thead th {
		font-size: var(--text-caption);
		letter-spacing: 0.06em;
	}
}

.ranking-table tbody tr:last-child th,
.ranking-table tbody tr:last-child td {
	border-bottom: none;
}

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
	min-width: 0;
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
	font-size: var(--text-micro);
}
</style>
