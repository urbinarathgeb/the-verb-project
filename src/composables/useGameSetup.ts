import {computed, type ComputedRef, type Ref} from 'vue'
import {storeToRefs} from 'pinia'
import type {RouteLocationRaw} from 'vue-router'
import {LEVELS} from '@/data/levels'
import {MODE_DESCRIPTIONS} from '@/data/modes'
import {getVerbsForDifficulty} from '@/data/verbs'
import {useSetupStore} from '@/stores/setup'
import {PRACTICE_MODE, type Difficulty, type MenuMode} from '@/types/game'

/**
 * Interfaz pública de la configuración de partida.
 *
 * Es el único punto por el que la UI toca ese estado (`CLAUDE.md` §6, aplicado
 * por ESLint). Aquí se combinan la elección del jugador y los datos estáticos
 * del nivel, que no tienen por qué vivir en Pinia.
 */
export interface UseGameSetupReturn {
	mode: Ref<MenuMode>
	difficulty: Ref<Difficulty>
	setMode: (mode: MenuMode) => void
	setDifficulty: (difficulty: Difficulty) => void
	/** Qué promete el modo elegido, en una frase. */
	modeDescription: ComputedRef<string>
	/** Repertorio y reglas del nivel elegido, para que no sea sólo una etiqueta. */
	levelSummary: ComputedRef<string>
	/** Hacia dónde navegar al confirmar: el Dojo no usa el tablero. */
	destination: ComputedRef<RouteLocationRaw>
}

export function useGameSetup(): UseGameSetupReturn {
	const store = useSetupStore()
	const {mode, difficulty} = storeToRefs(store)

	const modeDescription = computed(() => MODE_DESCRIPTIONS[mode.value])

	/*
	 * Empieza por el tamaño del repertorio porque es lo único que significa algo
	 * en los tres casos: el nivel también decide de qué verbos pregunta el Dojo,
	 * y un resumen en términos de partida —«objetivo de 8 · 90 s»— allí no aplica
	 * (`PLAN.md`, Bitácora, D7).
	 */
	const levelSummary = computed(() => {
		const level = LEVELS[difficulty.value]
		const pool = `${getVerbsForDifficulty(difficulty.value).length} verbos`
		const size = `${level.boardSize} en pantalla`

		if (mode.value === PRACTICE_MODE) return `${pool} · preguntas de este nivel`

		return mode.value === 'target'
			? `${pool} · ${size} · objetivo de ${level.targetVerbs} · ${level.timeLimitMs / 1000} s`
			: `${pool} · ${size} · hasta el primer fallo`
	})

	/*
	 * El Dojo vive en otra ruta porque no usa el tablero, pero desde el menú se
	 * elige igual que los demás: para el jugador es un modo más, aunque por dentro
	 * sea otra pantalla y no genere ranking (`MECHANICS.md` §4).
	 */
	const destination = computed(() =>
		mode.value === PRACTICE_MODE
			? {name: 'practice', params: {difficulty: difficulty.value}}
			: {name: 'play', params: {mode: mode.value, difficulty: difficulty.value}},
	)

	return {
		mode,
		difficulty,
		setMode: store.setMode,
		setDifficulty: store.setDifficulty,
		modeDescription,
		levelSummary,
		destination,
	}
}
