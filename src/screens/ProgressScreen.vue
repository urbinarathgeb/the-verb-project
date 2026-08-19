<script setup lang="ts">
import {onMounted} from 'vue'
import {useRouter} from 'vue-router'
import ChoiceButton from '@/components/ChoiceButton.vue'
import {useAuth} from '@/composables/useAuth'
import {useProgress} from '@/composables/useProgress'

const router = useRouter()
const {rows, summary, loadProgress} = useProgress()
const {isAuthenticated, isReady} = useAuth()

function percent(accuracy: number): string {
	return `${Math.round(accuracy * 100)} %`
}

function goHome(): void {
	router.push({name: 'home'})
}

function goToDojo(): void {
	router.push({name: 'practice', params: {difficulty: 'easy'}})
}

onMounted(() => {
	void loadProgress()
})
</script>

<template>
	<section class="progress">
		<header class="progress-header brutal-card paper-tilt-1">
			<h1 class="progress-heading">Tu progreso</h1>
		</header>

		<dl class="progress-summary">
			<div class="progress-stat brutal-card">
				<dt class="progress-stat-label">Dominados</dt>
				<dd class="progress-stat-value">{{ summary.mastered }}</dd>
			</div>
			<div class="progress-stat brutal-card">
				<dt class="progress-stat-label">Practicados</dt>
				<dd class="progress-stat-value">{{ summary.practiced }}</dd>
			</div>
			<div class="progress-stat brutal-card">
				<dt class="progress-stat-label">Aciertos</dt>
				<dd class="progress-stat-value">{{ percent(summary.accuracy) }}</dd>
			</div>
		</dl>

		<div v-if="rows.length === 0" class="progress-empty brutal-card">
			<p class="progress-empty-title">Todavía no has practicado ningún verbo</p>
			<p class="progress-empty-hint">
				En el Dojo se responde sin reloj y sin perder. Cada respuesta cuenta para esta pantalla.
			</p>
			<ChoiceButton variant="primary" @click="goToDojo">Entrar al Dojo</ChoiceButton>
		</div>

		<template v-else>
			<p class="progress-lead">
				Primero lo que peor se te da. Quedan {{ summary.remaining }} verbos por tocar.
			</p>

			<div class="progress-scroll">
				<table class="progress-table">
					<caption class="progress-caption">
						Verbos practicados, de peor a mejor
					</caption>
					<thead>
						<tr>
							<th scope="col">Verbo</th>
							<th scope="col" class="progress-numeric">Aciertos</th>
							<th scope="col" class="progress-numeric">Estado</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="row in rows"
							:key="row.verb.id"
							:class="{'progress-mastered': row.isMastered}"
						>
							<th scope="row" class="progress-verb">
								<span class="progress-forms">
									{{ row.verb.present }} · {{ row.verb.past }} · {{ row.verb.participle }}
								</span>
								<span class="progress-meaning">{{ row.verb.meaning }}</span>
							</th>
							<td class="progress-numeric">
								{{ percent(row.accuracy) }}
								<span class="progress-counts">
									{{ row.progress.correct }}/{{ row.progress.correct + row.progress.wrong }}
								</span>
							</td>
							<td class="progress-numeric">{{ row.isMastered ? 'Dominado' : 'En curso' }}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</template>

		<p v-if="isReady && !isAuthenticated" class="progress-guest">
			Juegas como invitado: esto se pierde al cerrar. Entra con tu cuenta desde el menú para
			guardarlo.
		</p>

		<div class="progress-actions">
			<ChoiceButton variant="secondary" @click="goHome">Volver al menú</ChoiceButton>
		</div>
	</section>
</template>

<style scoped>
.progress {
	display: flex;
	flex: 1;
	min-height: 0;
	flex-direction: column;
	align-items: center;
	gap: var(--spacing-gutter);
	padding: var(--spacing-screen-mobile);
	overflow-y: auto;
}

.progress-header {
	padding: calc(var(--spacing-gutter) / 2) var(--spacing-gutter);
	text-align: center;
}

.progress-heading {
	font-size: var(--text-headline-md);
	margin: 0;
}

.progress-summary {
	display: flex;
	flex-wrap: wrap;
	gap: calc(var(--spacing-gutter) / 2);
	width: 100%;
	max-width: 44rem;
	margin: 0;
}

.progress-stat {
	display: flex;
	flex-direction: column;
	align-items: center;
	flex: 1 1 7rem;
	padding: calc(var(--spacing-gutter) / 2);
	text-align: center;
}

.progress-stat-label {
	font-size: var(--text-caption);
	text-transform: uppercase;
	letter-spacing: 0.08em;
	opacity: 0.7;
}

.progress-stat-value {
	font-family: var(--font-display);
	font-size: var(--text-headline-lg);
	font-weight: 800;
	font-variant-numeric: tabular-nums;
	margin: 0;
}

.progress-lead {
	font-size: var(--text-caption);
	width: 100%;
	max-width: 44rem;
}

.progress-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: calc(var(--spacing-gutter) / 2);
	padding: var(--spacing-gutter);
	width: 100%;
	max-width: 32rem;
	text-align: center;
}

.progress-empty-title {
	font-family: var(--font-display);
	font-size: var(--text-headline-md);
	text-transform: uppercase;
}

.progress-empty-hint {
	font-size: var(--text-caption);
}

.progress-scroll {
	width: 100%;
	max-width: 44rem;
	overflow-x: auto;
	border: 4px solid var(--color-ink);
	box-shadow: var(--shadow-brutal-md);
	background-color: var(--color-card);
}

.progress-table {
	width: 100%;
	border-collapse: collapse;
	font-size: var(--text-caption);
}

.progress-caption {
	padding: calc(var(--spacing-gutter) / 2);
	font-family: var(--font-display);
	font-size: var(--text-label-bold);
	text-transform: uppercase;
	letter-spacing: 0.06em;
	text-align: left;
	border-bottom: 3px solid var(--color-ink);
}

.progress-table th,
.progress-table td {
	padding: calc(var(--spacing-gutter) / 3) calc(var(--spacing-gutter) / 2);
	text-align: left;
	border-bottom: 2px solid var(--color-ink);
}

.progress-table thead th {
	font-family: var(--font-display);
	text-transform: uppercase;
	letter-spacing: 0.06em;
	background-color: var(--color-cyan);
	border-bottom: 3px solid var(--color-ink);
}

.progress-table tbody tr:last-child th,
.progress-table tbody tr:last-child td {
	border-bottom: none;
}

.progress-table .progress-numeric {
	text-align: right;
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}

.progress-verb {
	font-weight: 500;
}

.progress-forms {
	overflow-wrap: anywhere;
}

.progress-meaning {
	display: block;
	font-size: var(--text-micro);
	opacity: 0.7;
}

.progress-counts {
	display: block;
	font-size: var(--text-micro);
	opacity: 0.7;
}

.progress-mastered {
	background-color: var(--color-paper-dim);
}

.progress-guest {
	font-size: var(--text-caption);
	text-align: center;
	max-width: 32rem;
	opacity: 0.7;
}

.progress-actions {
	width: 100%;
	max-width: 44rem;
}

.progress-actions > * {
	width: 100%;
}

@media (width >= 40rem) {
	.progress {
		padding: var(--spacing-screen-desktop);
	}

	.progress-heading {
		font-size: var(--text-headline-lg);
	}
}
</style>
