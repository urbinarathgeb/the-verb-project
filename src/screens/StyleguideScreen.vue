<script setup lang="ts">
/**
 * Guía visual del sistema de diseño. Sólo se registra en la ruta cuando
 * `import.meta.env.DEV` es true, así que no entra en el bundle de producción.
 *
 * Sirve para validar los tokens de T0.5 sin depender de pantallas reales, y
 * como referencia al construir los componentes de la Fase 3.
 */

const colors = [
	{name: 'ink', className: 'bg-ink', value: '#000000'},
	{name: 'paper', className: 'bg-paper', value: '#F0EAD6'},
	{name: 'paper-dim', className: 'bg-paper-dim', value: '#DDD6C0'},
	{name: 'card', className: 'bg-card', value: '#FFFDF5'},
	{name: 'electric', className: 'bg-electric', value: '#FFFF00'},
	{name: 'cyan', className: 'bg-cyan', value: '#00FFFF'},
	{name: 'pink', className: 'bg-pink', value: '#FF69B4'},
] as const

const typography = [
	{token: 'display-lg', className: 'text-display-lg font-display', sample: 'Verbos'},
	{token: 'headline-lg', className: 'text-headline-lg font-display', sample: 'Desafío'},
	{token: 'headline-md', className: 'text-headline-md font-display', sample: 'Presente'},
	{token: 'body-lg', className: 'text-body-lg', sample: 'Empareja las tres formas'},
	{token: 'body-md', className: 'text-body-md', sample: 'Empareja las tres formas'},
	{token: 'label-bold', className: 'text-label-bold font-display', sample: 'NIVEL 4'},
	{token: 'caption', className: 'text-caption', sample: '00:45 restantes'},
] as const

const shadows = [
	'shadow-brutal-xs',
	'shadow-brutal-sm',
	'shadow-brutal-md',
	'shadow-brutal-lg',
] as const

/** Los 4 estados de celda del tablero, tal como los define PLAN.md. */
const cellStates = [
	{
		name: 'Neutra',
		text: 'Speak',
		className: 'cell-neutral paper-tilt-2',
	},
	{
		name: 'Seleccionada',
		text: 'Spoke',
		className: 'cell-selected paper-tilt-4',
	},
	{
		name: 'Resuelta',
		text: 'Spoken',
		className: 'cell-resolved',
	},
	{
		name: 'Error',
		text: 'Speaked',
		className: 'cell-error paper-tilt-1',
	},
] as const

/** Columna de sample: verifica que el tablero funciona sin posición absoluta. */
const sampleColumn = ['Go', 'Eat', 'Write', 'See', 'Take'] as const
const tilts = ['paper-tilt-1', 'paper-tilt-2', 'paper-tilt-3', 'paper-tilt-4'] as const
</script>

<template>
	<div class="flex-1 min-h-0 overflow-y-auto px-margin-mobile py-8 sm:px-margin-desktop">
		<div class="mx-auto flex w-full max-w-5xl flex-col gap-12">
			<header
				class="inline-block self-start border-4 border-ink bg-card px-6 py-4 shadow-brutal-lg paper-tilt-1"
			>
				<h1 class="text-headline-lg font-display">Neo-Paper Brutalist</h1>
				<p class="mt-1 text-caption">Guía visual — sólo disponible en desarrollo</p>
			</header>

			<!-- Paleta -->
			<section class="flex flex-col gap-gutter">
				<h2 class="text-headline-md font-display">Paleta</h2>
				<ul class="grid grid-cols-2 gap-gutter sm:grid-cols-4">
					<li v-for="color in colors" :key="color.name" class="brutal-card">
						<div :class="[color.className, 'h-20 border-b-3 border-ink']" />
						<div class="p-3">
							<p class="text-label-bold font-display">{{ color.name }}</p>
							<p class="text-caption">{{ color.value }}</p>
						</div>
					</li>
				</ul>
			</section>

			<!-- Tipografía -->
			<section class="flex flex-col gap-gutter">
				<h2 class="text-headline-md font-display">Tipografía</h2>
				<div class="brutal-card flex flex-col gap-4 p-6">
					<div
						v-for="t in typography"
						:key="t.token"
						class="flex flex-col gap-1 border-b-2 border-ink pb-4 last:border-b-0 last:pb-0"
					>
						<span class="text-caption opacity-60">{{ t.token }}</span>
						<span :class="t.className">{{ t.sample }}</span>
					</div>
				</div>
			</section>

			<!-- Sombras -->
			<section class="flex flex-col gap-gutter">
				<h2 class="text-headline-md font-display">Sombras duras</h2>
				<div class="flex flex-wrap gap-8">
					<div
						v-for="shadow in shadows"
						:key="shadow"
						:class="['border-3 border-ink bg-card px-6 py-4', shadow]"
					>
						<span class="text-label-bold font-display">{{ shadow }}</span>
					</div>
				</div>
			</section>

			<!-- Estados de celda -->
			<section class="flex flex-col gap-gutter">
				<h2 class="text-headline-md font-display">Estados de celda</h2>
				<div class="grid grid-cols-2 gap-8 sm:grid-cols-4">
					<div v-for="state in cellStates" :key="state.name" class="flex flex-col gap-3">
						<div
							:class="[
								state.className,
								'flex min-h-touch items-center justify-center px-4 py-3 text-center',
							]"
						>
							<span class="text-headline-md font-display">{{ state.text }}</span>
						</div>
						<span class="text-caption">{{ state.name }}</span>
					</div>
				</div>
			</section>

			<!-- Botones -->
			<section class="flex flex-col gap-gutter">
				<h2 class="text-headline-md font-display">Botones</h2>
				<div class="flex flex-wrap gap-6">
					<button
						type="button"
						class="min-h-touch border-4 border-ink bg-electric px-6 py-3 text-label-bold font-display uppercase shadow-brutal-md brutal-press"
					>
						Empezar partida
					</button>
					<button
						type="button"
						class="min-h-touch border-4 border-ink bg-cyan px-6 py-3 text-label-bold font-display uppercase shadow-brutal-sm brutal-press"
					>
						Ver ranking
					</button>
					<button
						type="button"
						class="min-h-touch border-4 border-ink bg-card px-6 py-3 text-label-bold font-display uppercase shadow-brutal-sm brutal-press"
					>
						Volver
					</button>
				</div>
				<p class="text-caption">
					Pulsa un botón: debe hundirse hacia su shadow. Con «reducir movimiento» activado en el
					sistema, el desplazamiento desaparece.
				</p>
			</section>

			<!-- Columna de tablero -->
			<section class="flex flex-col gap-gutter">
				<h2 class="text-headline-md font-display">Columna de tablero</h2>
				<p class="text-caption">
					Maquetada con flex, no con posición absoluta: admite N variable y reposición de tríadas.
				</p>
				<div class="brutal-panel max-w-xs bg-paper-dim">
					<div class="border-b-4 border-ink bg-cyan p-3 text-center">
						<h3 class="text-headline-md font-display tracking-wider">Pasado</h3>
					</div>
					<ul class="flex flex-col gap-4 p-4">
						<li
							v-for="(verb, i) in sampleColumn"
							:key="verb"
							:class="[
								'cell-neutral brutal-press flex min-h-touch items-center justify-center px-4 py-3 text-center',
								tilts[i % tilts.length],
							]"
						>
							<span class="text-headline-md font-display">{{ verb }}</span>
						</li>
					</ul>
				</div>
			</section>
		</div>
	</div>
</template>
